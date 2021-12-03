// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import net from 'net'
import http from 'http'
import https from 'https'
import { Sequence } from '../../util'
import { HttpHeaders } from '../HttpProtocol'
import { HttpEndpoint } from '../HttpEndpoint'
import { HttpServerHandler } from './HttpServer'

export class HttpProxy implements HttpServerHandler {
  private requestOptions: Record<string, any>
  private sockets: Record<number, net.Socket> = {}
  private sequence = new Sequence()

  constructor(private readonly endpoint: HttpEndpoint, requestHeaders: HttpHeaders) {
    this.requestOptions = { headers: requestHeaders, ...(endpoint.agent ? { agent: endpoint.agent } : {}) }
  }

  public onConnection(socket: net.Socket): void {
    const sid = this.sequence.next
    this.sockets[sid] = socket
    socket.on('close', () => delete this.sockets[sid])
  }

  public onRequest(clientReq: http.IncomingMessage, serverRes: http.ServerResponse): void {
    const req = https.request(this.endpoint.url, this.requestOptions, (res: http.IncomingMessage) => {
      res.pipe(serverRes, { end: true })
    })
    clientReq.pipe(req, { end: true })
  }

  public onStop(): void {
    for (const sid in this.sockets) {
      this.sockets[sid].destroy()
      delete this.sockets[sid]
    }
  }
}
