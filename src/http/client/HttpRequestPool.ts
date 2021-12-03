// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { assertInteger, counters } from '../../util'
import { HttpHeaders, HttpRequest, HttpResponse } from '../HttpProtocol'
import { SimpleEventDispatcher, SimpleEventListener } from '../../util/event'
import { HttpConnectionPool, HttpConnectionPoolOptions } from './HttpConnectionPool'
import { HttpConnectionError, HttpConnectionRequest, HttpConnectionTransaction } from './HttpConnection'

export interface HttpRequestPoolOptions extends HttpConnectionPoolOptions {

  // Number of atempts to send a request before emitting an error
  maxAttempts?: number

  // Number of requests to send in parallel over a single connection
  maxPipelineDepth?: number
}

export interface HttpRequestPoolResponse<T> {

  // Number of attempts made to send the request
  attempts: number

  // Elapsed time (in milliseconds) for the last attempt
  elapsed: number

  // Http request
  request: HttpRequest

  // Possible response (might be undefined if all attempts failed to send the request)
  response?: HttpResponse

  // User object provided with the original request
  userp: T
}

interface U<T> {
  attempts: number
  sendTime?: number
  userp: T
}

//
// An HTTP/S request intefrace optimized for sending massively parallel requests to
// a server or API. This class maintains an HttpConnectionPool of persistent HTTP/S 1.1
// connections to the server and pipelines requests allong these different connections.
//
// The class relies on the underlying recconect mechanism provided by HttpConnection and
// HttpConnectionPool to maintain the connection and adds its own mechanism for
// retransmitting requests in cases of connection failures.
//
export class HttpRequestPool<T> {
  private readonly maxAttempts: number
  private readonly maxPipelineDepth: number
  private readonly connectionPool: HttpConnectionPool<U<T>>
  private readonly requestQueue: HttpConnectionRequest<U<T>>[] = []
  private readonly maxInflight: number
  private readonly dispatcher = new SimpleEventDispatcher<HttpRequestPoolResponse<T>>()

  constructor(host: string, options: HttpRequestPoolOptions = {}) {
    const { maxAttempts, maxPipelineDepth, ...connectionPoolOptions } = options

    this.maxAttempts = maxAttempts || 1
    assertInteger(this.maxAttempts, 1, 10, 'Max attempts')

    this.maxPipelineDepth = maxPipelineDepth || 1
    assertInteger(this.maxPipelineDepth, 1, 100, 'Pipeline depth')

    const respond = (req: HttpConnectionRequest<U<T>>, response?: HttpResponse): void => {
      const { userp, ...request } = req
      this.dispatcher.fire({
        attempts: userp.attempts,
        elapsed: Date.now() - userp.sendTime!,
        userp: userp.userp,
        request,
        response,
      })
    }

    this.connectionPool = new HttpConnectionPool(host, connectionPoolOptions)

    this.connectionPool.addReadyListener(() => this.sendNextRequests())

    this.connectionPool.addErrorListener((error: HttpConnectionError<U<T>>) => {
      counters.warn.HttpRequestPool.errors.inc()
      for (const req of error.requests) {
        if (req.userp.attempts < this.maxAttempts) {
          this.requestQueue.push(req)
        } else {
          counters.warn.HttpRequestPool.abortedRequests.inc()
          respond(req)
        }
      }
    })

    this.connectionPool.addResponseListener(({ request, response }: HttpConnectionTransaction<U<T>>) => {
      counters.debug.HttpRequestPool.responses.inc()
      counters.debug.HttpRequestPool.inflight.dec()
      respond(request, response)
      this.sendNextRequests()
    })

    this.maxInflight = this.connectionPool.connectionCount * this.maxPipelineDepth
  }

  private sendNextRequests(): void {
    while (
      0 < this.requestQueue.length &&
      0 < this.connectionPool.getConnectionsCount() &&
      this.connectionPool.getInflightCount() < this.maxInflight
    ) {
      const req = this.requestQueue.shift()!
      req.userp.attempts++
      req.userp.sendTime = Date.now()
      this.connectionPool.request(req)
      counters.debug.HttpRequestPool.inflight.inc()
      counters.debug.HttpRequestPool.requests.inc()
    }
  }

  public addResponseListener(listener: SimpleEventListener<HttpRequestPoolResponse<T>>): void {
    this.dispatcher.addListener(listener)
  }

  public close(): void {
    this.connectionPool.close()
  }

  public getConnectionsCount(): number {
    return this.connectionPool.getConnectionsCount()
  }

  public getInflightCount(): number {
    return this.connectionPool.getInflightCount()
  }

  public request(request: HttpConnectionRequest<T>): void {
    const { userp, ...other } = request
    this.requestQueue.push({ ...other, userp: { attempts: 0, userp } })
    this.sendNextRequests()
  }

  public GET(path: string, userp: T, headers?: HttpHeaders): void {
    this.request({ method: 'GET', path, userp, headers })
  }

  public POST(path: string, userp: T, body?: string, headers?: HttpHeaders): void {
    this.request({ method: 'POST', path, userp, body, headers })
  }
}
