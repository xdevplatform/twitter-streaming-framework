// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import http from 'http'
import https from 'https'
import { Obj } from '../../util'
import { testOnce } from '../../util/test'
import { HttpEndpoint } from '../HttpEndpoint'
import { EventDispatcher, EventListener } from '../../util/event'

export type HttpStreamEventType = 'connected' | 'message'

export class HttpStreamError extends Error {
  constructor(message: string, public readonly code: number) {
    super(message)
  }

  public toStr(): string {
    const code = this.code == HttpStreamError.EANY ? 'EANY'
      : this.code == HttpStreamError.EEND ? 'EEND'
      : this.code == HttpStreamError.EREQUEST ? 'EREQUEST'
      : this.code == HttpStreamError.ERESPONSE ? 'ERESPONSE'
      : `HTTP(${this.code})`
    return `${this.code}: ${this.message}`
  }

  public static readonly EANY = 0 // any error
  public static readonly EEND = -1
  public static readonly EREQUEST = -2
  public static readonly ERESPONSE = -3
}

//
// Handle streaming HTTP/S messages, sent over a single connection as a response
// to a single request. This class uses the built in HTTP client and emits one
// message event for each sequence of response bytes separated by a newline (\r\n)
// character combination.
//
export class HttpStream {
  private req?: http.ClientRequest
  private buffers: Buffer[] = []
  private eventDispatcher = new EventDispatcher<HttpStreamEventType, string>()
  private errorDispatcher = new EventDispatcher<number, HttpStreamError>()

  constructor(endpoint: HttpEndpoint, headers: Obj) {

    if (testOnce.STREAM_SERVER_TIMEOUT(() => {
      console.debug('Simulating stream server timeout')
      return true
    })) return

    const options = { headers, ...(endpoint.agent ? { agent: endpoint.agent } : {}) }
    this.req = https.request(endpoint.url, options, (res: http.IncomingMessage) => {

      testOnce.STREAM_SERVER_ERROR(() => {
        console.debug('Injecting HTTP error: 999')
        res.statusCode = 999
      })

      if (typeof res.statusCode !== 'number' || res.statusCode < 200 || 299 < res.statusCode) {
        this.handleError(
          `Error connecting to streaming server: ${res.statusCode}`,
          typeof res.statusCode === 'number' ? res.statusCode : HttpStreamError.EREQUEST,
        )
        return
      }

      this.eventDispatcher.fire('connected', endpoint.url)

      res.on('data', (buf: Buffer) => {
        this.handleBuffer(buf)
      })
      res.on('end', (buf: Buffer) => {
        this.handleBuffer(buf)
        this.handleError('Disconnected', HttpStreamError.EEND)
      })
      res.on('error', (error: any) => {
        this.handleError(`Response error: ${error.message}: ${error.code}`, HttpStreamError.ERESPONSE)
      })
    })

    this.req.on('error', (error: any) => {
      this.handleError(`Request error: ${error.message}: ${error.code}`, HttpStreamError.EREQUEST)
    })

    this.req.end()
  }

  private handleBuffer(buf: Buffer): void {
    if (!this.req) {
      return
    }
    this.buffers.push(buf)
    if (buf && 2 <= buf.length && buf[buf.length - 2] === 13 && buf[buf.length - 1] === 10) {
      Buffer.concat(this.buffers)
        .toString()
        .split('\r\n')
        .forEach((message: string) => message.length && this.eventDispatcher.fire('message', message))
      this.buffers.splice(0, this.buffers.length)
    }
  }

  private handleError(message: string, code: number) {
    if (!this.req) {
      return
    }
    const error = new HttpStreamError(message, code)
    this.errorDispatcher.fire(code, error)
    this.errorDispatcher.fire(HttpStreamError.EANY, error)
  }

  public addErrorListener(type: number, listener: EventListener<number, HttpStreamError>): void {
    this.errorDispatcher.addListener(type, listener)
  }

  public addEventListener(type: HttpStreamEventType, listener: EventListener<HttpStreamEventType, string>): void {
    this.eventDispatcher.addListener(type, listener)
  }

  public copyEventListeners(dispatcher: EventDispatcher<HttpStreamEventType, string>): void {
    this.eventDispatcher.copyListeners(dispatcher)
  }

  public close(): void {
    if (this.req) {
      this.req.destroy()
      this.req = undefined
    }
  }
}
