// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import net from 'net'
import http from 'http'
import https from 'https'
import { assert } from '../../util'
import { HttpServerCertificates } from './HttpServerCertificates'

export interface HttpServerHandler {

  // New connection created
  onConnection?: (socket: net.Socket) => void

  // New request arrived
  onRequest: http.RequestListener

  // Server started
  onStart?: () => void

  // Server stopped
  onStop?: () => void
}

export interface HttpServerOptions {

  // SSL certificates for secure HTTPS servers
  certificates?: HttpServerCertificates

  // Port to listen on
  port?: number
}

export type HttpServerState = 'init' | 'listening' | 'stopping'

//
// An HTTP/S server you can start and stop. An HTTPS secure server is created if
// the constructor options include SSL certificates.
//
export class HttpServer {
  private port: number
  private server: http.Server
  private _state: HttpServerState = 'init'

  constructor(public readonly handler: HttpServerHandler, options: HttpServerOptions = {}) {
    this.port = options.port !== undefined ? options.port : (options.certificates ? 443 : 80)
    const onRequest = (req: http.IncomingMessage, res: http.ServerResponse) => {
      if (this.state !== 'listening') {
        res.writeHead(503, { 'Content-Type': 'text/plain' })
        res.write('Service Unavailable')
        res.end()
        return
      }
      handler.onRequest(req, res)
    }
    this.server = options.certificates
      ? https.createServer(options.certificates, onRequest)
      : http.createServer(onRequest)
  }

  public get state(): HttpServerState {
    return this._state
  }

  public start(port?: number): void {
    if (this._state === 'listening') {
      return
    }
    assert(this._state === 'init', `Cannot start listening while in state: ${this._state}`)
    const listener = this.server.listen(port === undefined ? this.port : port, () => {
      if (this.handler.onStart) {
        this.handler.onStart()
      }
    })
    if (this.handler.onConnection) {
      listener.on('connection', (socket: net.Socket) => this.handler.onConnection!(socket))
    }
    this._state = 'listening'
  }

  public async stop(): Promise<void> {
    if (this._state !== 'listening') {
      return
    }
    this._state = 'stopping'
    if (this.handler.onStop) {
      this.handler.onStop()
    }
    await new Promise<void>((resolve, reject) => {
      this.server.close((error: any) => {
        this._state = 'init'
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }
}
