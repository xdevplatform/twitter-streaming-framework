// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import net from 'net'
import tls from 'tls'
import { URL } from 'url'
import { SimpleEventDispatcher, SimpleEventListener } from '../../util/event'
import { BufferList, Obj, Timeout, assert, assertInteger, counters, safe, splitOnce } from '../../util'
import { HttpHeaders, HttpRequest, HttpResponse, HttpTransaction, httpStringifyHeaders } from '../HttpProtocol'

const EOL = '\r\n'
const EOH = Buffer.from('\r\n\r\n')

const RECONNECT_TIMEOUT_MIN_MS = 100
const RECONNECT_TIMEOUT_MAX_MS = 1600

export const HTTP_CONNECTION_STATUS_CODE_ERROR = 0

export class HttpConnectionError<T> extends Error {
  constructor(public readonly requests: HttpConnectionRequest<T>[], public readonly originalError?: Error) {
    super('HTTP connection error')
  }
}

export enum HttpConnectionAllowUnauthorized {
  Always, // To any server
  Local,  // Only to localhost ports
  Never,  // To nowhere
}

export interface HttpConnectionOptions {

  // If provided, connection will be reset if no messages are recived after the specifieid number of milliseconds
  activityTimeoutMs?: number

  // Should allow HTTPS connections to servers with self issued (unauthorized) cerfiticates?
  allowUnauthorized?: HttpConnectionAllowUnauthorized

  // These headers will be added to all requests
  defaultRequestHeaders?: HttpHeaders

  // Server port number (defaults to 80 for HTTP and 443 for HTTPS)
  port?: number

  // Should use HTTPS (HTTP over TLS)
  useTLS?: boolean
}

export interface HttpConnectionRequest<T> extends HttpRequest {
  userp: T
}

export interface HttpConnectionTransaction<T> {
  request: HttpConnectionRequest<T>
  response: HttpResponse
}

//
// Manages a persistent HTTP/S version 1.1 connection, allowing multiple requests to be
// sent to the connected server. Supports request pipelining.
//
// The class automatically attempts to reconnect if the connection is unexpectedly
// disconnected. It implementes a backoff mechanism to prevent overloading the network
// stack and the server.
//
export class HttpConnection<T> {
  private readonly isSecure: boolean
  private readonly stringifiedDefaultRequestHeaders: string
  private readonly connectionOptions: net.SocketConnectOpts | tls.ConnectionOptions

  private error?: Error
  private socket?: net.Socket
  private timeout?: Timeout

  private requests?: HttpConnectionRequest<T>[]
  private responseReceiver?: ResponseReceiver

  private reconnectTimeout = RECONNECT_TIMEOUT_MIN_MS
  private shouldReconnect = true

  private errorDispatcher = new SimpleEventDispatcher<HttpConnectionError<T>>()
  private readyDispatcher = new SimpleEventDispatcher<void>()
  private responseDispatcher = new SimpleEventDispatcher<HttpConnectionTransaction<T>>()

  constructor(host: string, options: HttpConnectionOptions = {}) {
    let hostname: string
    const url = safe(() => new URL(host))
    if (url ? url.protocol === 'http:' : host.startsWith('http://')) {
      assert(options.useTLS !== true, 'Conflicting http protocol and useTLS option')
      this.isSecure = false
      hostname = url ? url.hostname : host.substring(7)
    } else if (url ? url.protocol === 'https:' : host.startsWith('https://')) {
      this.isSecure = true
      hostname = url ? url.hostname : host.substring(8)
    } else if (options.useTLS === true || options.port === 443) {
      this.isSecure = true
      hostname = url ? url.hostname : host
    } else {
      this.isSecure = false
      hostname = url ? url.hostname : host
    }

    this.stringifiedDefaultRequestHeaders = httpStringifyHeaders({
      Host: hostname,
      Connection: 'keep-alive',
      ...(options.defaultRequestHeaders || {}),
    })

    if (options.activityTimeoutMs !== undefined) {
      assertInteger(options.activityTimeoutMs, 1, 60000, 'Request timeout')
      this.timeout = new Timeout(options.activityTimeoutMs, () => this.reset('Timeout'))
    }

    const allowUnauthorized = options.allowUnauthorized === undefined
      ? HttpConnectionAllowUnauthorized.Local
      : options.allowUnauthorized

    this.connectionOptions = {
      port: options.port || (url ? parseInt(url.port) : undefined) || (this.isSecure ? 443 : 80),
      host: hostname,
      servername: hostname,
      ...(this.isSecure
        ? {
          rejectUnauthorized:
            allowUnauthorized === HttpConnectionAllowUnauthorized.Never ||
            (
              allowUnauthorized === HttpConnectionAllowUnauthorized.Local &&
              (hostname !== 'localhost' && hostname !== '127.0.0.1')
            )
          }
        : {}
      ),
    }
    this.connect()
  }

  private connect(): void {
    counters.debug.HttpConnection.connectionInitiated.inc()
    assert(this.socket === undefined, 'Socket already exists')
    this.requests = []
    this.socket = this.isSecure
      ? tls.connect(this.connectionOptions, () => this.onConnect())
      : net.connect(this.connectionOptions as net.SocketConnectOpts, () => this.onConnect())
    this.socket.addListener('close', () => this.onClose())
    this.socket.addListener('data', (buffer: Buffer) => this.onBuffer(buffer))
    this.socket.addListener('error', (error: Error) => this.onError(error))
  }

  private onClose(): void {
    counters.debug.HttpConnection.active.dec()
    counters.warn.HttpConnection.connectionClosed.inc()
    this.timeout?.clear()
    this.responseReceiver = undefined
    const requests: HttpConnectionRequest<T>[] = this.requests!
    this.requests = undefined
    this.socket = undefined
    counters.warn.HttpConnection.requestsAborted.inc(requests.length)
    this.errorDispatcher.fire(new HttpConnectionError(requests, this.error))
    if (this.shouldReconnect) {
      setTimeout(() => this.connect(), this.reconnectTimeout)
      this.reconnectTimeout = Math.min(this.reconnectTimeout * 2, RECONNECT_TIMEOUT_MAX_MS)
    }
  }

  private onConnect(): void {
    counters.debug.HttpConnection.connectionConnected.inc()
    counters.debug.HttpConnection.active.inc()
    this.reconnectTimeout = RECONNECT_TIMEOUT_MIN_MS
    this.readyDispatcher.fire()
  }

  private onBuffer(buffer: Buffer): void {
    this.timeout?.reset()
    if (!this.responseReceiver) {
      this.responseReceiver = new ResponseReceiver(
        (response: HttpResponse, remainder?: Buffer) => this.onResponse(response, remainder)
      )
    }
    if (0 < buffer.length) {
      this.responseReceiver.onBuffer(buffer)
    }
  }

  private onError(error: Error): void {
    counters.error.HttpConnection.connectionError.inc()
    this.reset(error)
  }

  private onResponse(response: HttpResponse, remainder?: Buffer): void {
    this.responseReceiver = undefined
    assert(this.requests !== undefined && 0 < this.requests.length, 'No requests')
    if (this.requests === undefined || this.requests.length === 0) {
      this.reset('Unexpected response')
      return
    }
    const request: HttpConnectionRequest<T> = this.requests!.shift()!
    this.responseDispatcher.fire({ request, response })
    if (response.statusCode === HTTP_CONNECTION_STATUS_CODE_ERROR) {
      this.reset(response.statusText)
      return
    }
    if (remainder) {
      this.onBuffer(remainder)
    }
  }

  public addErrorListener(listener: SimpleEventListener<HttpConnectionError<T>>): void {
    this.errorDispatcher.addListener(listener)
  }

  public addReadyListener(listener: SimpleEventListener<void>): void {
    this.readyDispatcher.addListener(listener)
  }

  public addResponseListener(listener: SimpleEventListener<HttpConnectionTransaction<T>>): void {
    this.responseDispatcher.addListener(listener)
  }

  public close(): void {
    this.shouldReconnect = false
    if (this.socket) {
      this.socket.destroy()
      this.socket = undefined
    }
  }

  public getInflightCount(): number | undefined {
    return this.requests?.length
  }

  public request(req: HttpConnectionRequest<T>): void {
    assert(this.socket !== undefined, 'Not connected')
    this.socket!.write(
      `${req.method} ${req.path} HTTP/1.1${EOL}` +
      this.stringifiedDefaultRequestHeaders +
      (req.headers ? httpStringifyHeaders(req.headers) : '') +
      (req.body ? `Content-Length: ${req.body.length}${EOL}` : '') +
      EOL + (req.body || '')
    )
    this.requests!.push(req)
    this.timeout?.set()
  }

  public reset(errorOrMessage: Error | string): void {
    counters.debug.HttpConnection.connectionReset.inc()
    this.error = typeof errorOrMessage === 'string' ? new Error(errorOrMessage) : errorOrMessage
    if (this.socket) {
      this.socket.destroy()
      this.socket = undefined
    }
  }

  public GET(path: string, userp: T, headers?: HttpHeaders): void {
    this.request({ method: 'GET', path, userp, headers })
  }

  public POST(path: string, userp: T, body?: string, headers?: HttpHeaders): void {
    this.request({ method: 'POST', path, userp, body, headers })
  }
}

class ResponseReceiver {
  private buffer?: Buffer
  private headers?: HttpHeaders
  private contentLength?: number

  private statusCode?: number
  private statusText?: string

  private chunkLength?: number
  private chunkData?: BufferList
  private chunkAwaitingEOL = false
  private chunksComplete = false

  private readonly data = new BufferList()

  constructor(private readonly responseHandler: (res: HttpResponse, remainder?: Buffer) => void) {
  }

  public onBuffer(buffer: Buffer): void {
// console.log('onBuffer: [[\x1b[35m' + buffer.toString('utf-8') + '\x1b[0m]]')
    if (this.headers === undefined) {
      this.buffer = this.buffer ? Buffer.concat([this.buffer, buffer]) : buffer
// console.log('onBuffer: header:', this.buffer.length)
      const buf = this.onHeaderBuffer(this.buffer)
      if (buf === undefined) {
        return
      }
      this.buffer = undefined
      if (buf.length === 0 && 0 < this.contentLength!) {
        return
      }
      buffer = buf
    }

    if (this.headers) {
// console.log('onBuffer: body:', buffer.length)
      if (this.contentLength === undefined) {
        this.onChunkBuffer(buffer)
      } else {
        this.onContentBuffer(buffer)
      }
    }
  }

  private onHeaderBuffer(buffer: Buffer): Buffer | undefined {
    const index = buffer.indexOf(EOH)
// console.log('onHeaderBuffer: index =', index)
    if (index < 0) {
      return
    }

    const [status, ...headerLines] = buffer.toString('utf-8', 0, index).split(EOL)

    const match = status.match(/^HTTP\/1\.1 ([12345]\d\d) (\w.+)$/)
    if (match === null) {
      this.onResponse(HTTP_CONNECTION_STATUS_CODE_ERROR, 'Malformed HTTP status')
      return
    }
    this.statusCode = parseInt(match[1])
    this.statusText = match[2]

    const headers: HttpHeaders = {}
    for (const header of headerLines) {
      const headerParts = splitOnce(header, ': ')
      if (headerParts === undefined) {
        this.onResponse(HTTP_CONNECTION_STATUS_CODE_ERROR, `Malformed HTTP header: ${header}`)
        return
      }
      headers[headerParts[0].toLowerCase()] = headerParts[1]
    }

    const contentLengthHeader = headers['content-length']
    if (contentLengthHeader) {
      this.contentLength = parseInt(contentLengthHeader)
    } else if (headers['transfer-encoding'] !== 'chunked') {
      this.contentLength = 0
    }
// console.log('onHeaderBuffer: Content length:', this.contentLength)

    this.headers = headers
    return buffer.slice(index + EOH.length)
  }

  private onChunkBuffer(buffer: Buffer): void {
    if (this.chunkLength !== undefined) {
      if (this.chunkData!.length + buffer.length < this.chunkLength) {
        this.chunkData!.append(buffer)
// console.log('onChunkBuffer: <:', buffer.length, '->', this.chunkData!.length)
        return
      }
      if (this.chunkData!.length + buffer.length === this.chunkLength) {
        this.chunkData!.append(buffer)
// console.log('onChunkBuffer: ===:', buffer.length, '->', this.chunkData!.length)
        this.data.appendList(this.chunkData!)
        return
      }
// console.log('onChunkBuffer: >:', buffer.length)
      const index = this.chunkLength - this.chunkData!.length
// console.log('onChunkBuffer: >: index =', index)
      const buf = buffer.slice(0, index)
      this.chunkData!.append(buf)
      this.data.appendList(this.chunkData!)
      buffer = buffer.slice(index)
      this.chunkData = undefined
      this.chunkLength = undefined
      this.chunkAwaitingEOL = true
    }

    this.buffer = this.buffer ? Buffer.concat([this.buffer, buffer]) : buffer
// console.log('onChunkBuffer: length:', this.buffer.length)
// console.log('onChunkBuffer: [[\x1b[33m' + this.buffer.toString('utf-8') + '\x1b[0m]]')
    if (this.buffer.length < EOL.length) {
      return
    }
    if (this.chunkAwaitingEOL) {
      if (this.buffer.indexOf(EOL) !== 0) {
        this.onResponse(HTTP_CONNECTION_STATUS_CODE_ERROR, 'Missing end of line after chunk')
        return
      }
      this.chunkAwaitingEOL = false
      if (this.chunksComplete) {
        this.chunksComplete = false
        if (EOL.length < this.buffer.length) {
          this.onResponse(HTTP_CONNECTION_STATUS_CODE_ERROR, 'Unexpected bytes after last chunk')
          return
        }
        this.buffer = undefined
        this.onDataResponse()
        return
      }
      if (this.buffer.length === EOL.length) {
// console.log('onChunkBuffer: EOL returning')
        this.buffer = undefined
        return
      }
// console.log('onChunkBuffer: EOL trimming')
      this.buffer = this.buffer.slice(EOL.length)
    }

    const index = buffer.indexOf(EOL)
// console.log('onChunkBuffer: index = ', index)
    this.chunkLength = parseInt(this.buffer.toString('utf-8', 0, index), 16)
// console.log('onChunkBuffer: Chunk length:', this.chunkLength)
    if (this.chunkLength === 0) {
      this.chunkLength = undefined
      this.chunkAwaitingEOL = true
      this.chunksComplete = true
    } else {
      this.chunkData = new BufferList()
    }
    const remainderLength = this.buffer.length - index - EOL.length
// console.log('onChunkBuffer: remainder length:', remainderLength)
    this.buffer = undefined
    if (0 < remainderLength) {
      this.onChunkBuffer(buffer.slice(index + EOL.length))
    }
  }

  private onContentBuffer(buffer: Buffer): void {
    this.data.append(buffer)
    if (this.contentLength! <= this.data.length) {
      return this.onDataResponse(this.contentLength!)
    }
  }

  private onDataResponse(length?: number): void {
    const buffer = this.data.toBuffer()
    const len = length === undefined ? buffer.length : length
    const responseText = buffer.toString('utf-8', 0, len)
    const remainder = len < buffer.length ? buffer.slice(len) : undefined

if (this.headers!['connection'] === 'close') counters.debug.HttpConnection.connectionClosedHeader.inc //

    let responseBody: Obj | undefined
    if (this.headers!['content-type']?.startsWith('application/json')) {
      try {
        responseBody = JSON.parse(responseText)
      } catch (e) {
// console.log('[[\x1b[31m' + responseText + '\x1b[0m]]')
        counters.debug.HttpConnection.jsonParseError.inc()
// console.error(e)
      }
    }

    this.onResponse(this.statusCode!, this.statusText!, responseText, responseBody, remainder)
  }

  private onResponse(
    statusCode: number,
    statusText: string,
    responseText = '',
    responseBody?: Obj,
    remainder?: Buffer,
  ): void {
    const response = { statusCode, statusText, responseHeaders: this.headers || {}, responseText, responseBody }
    this.responseHandler(response, remainder)
  }
}
