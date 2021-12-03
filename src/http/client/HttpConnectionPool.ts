// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import '../../util/array'
import { assert, assertInteger, counters } from '../../util'
import { SimpleEventDispatcher, SimpleEventListener } from '../../util/event'
import {
  HttpConnection,
  HttpConnectionError,
  HttpConnectionOptions,
  HttpConnectionRequest,
  HttpConnectionTransaction,
} from './HttpConnection'

export interface HttpConnectionPoolOptions extends HttpConnectionOptions {

  // Number of open HTTP/S connections
  connectionCount?: number
}

//
// Multiplex HTTP requests over a number of connections. Upon construction, the
// class attempts to establish the requested number of connections. It keeps track
// of which connections are connected or not, and only sends requests on active
// connections.
//
export class HttpConnectionPool<T> {
  public readonly connectionCount: number

  private readonly all: HttpConnection<T>[] = []
  private readonly disabled: HttpConnection<T>[] = []
  private readonly enabled: HttpConnection<T>[] = []

  private inflight = 0

  private readonly errorDispatcher = new SimpleEventDispatcher<HttpConnectionError<T>>()
  private readonly readyDispatcher = new SimpleEventDispatcher<void>()
  private readonly responseDispatcher = new SimpleEventDispatcher<HttpConnectionTransaction<T>>()

  constructor(host: string, options: HttpConnectionPoolOptions = {}) {
    const { connectionCount, ...connectionOptions } = options

    this.connectionCount = connectionCount || 1
    assertInteger(this.connectionCount, 1, 5000, 'Connection count')

    for (let i = 0; i < this.connectionCount; i++) {
      const con = this.createConnection(host, connectionOptions)
      this.all.push(con)
      this.disabled.push(con)
      counters.debug.HttpConnectionPool.disabled.inc()
    }
  }

  private createConnection(host: string, connectionOptions: HttpConnectionOptions): HttpConnection<T> {
    const con = new HttpConnection<T>(host, connectionOptions)

    con.addReadyListener(() => {
      this.disabled.remove(con)
      counters.debug.HttpConnectionPool.disabled.dec()
      this.enabled.push(con)
      counters.debug.HttpConnectionPool.enabled.inc()
      this.readyDispatcher.fire()
    })

    con.addErrorListener((error: HttpConnectionError<T>) => {
      if (this.enabled.indexOf(con)) {
        throw error
      }
      this.inflight -= error.requests.length
      this.enabled.remove(con)
      counters.debug.HttpConnectionPool.enabled.dec()
      this.disabled.push(con)
      counters.debug.HttpConnectionPool.disabled.inc()
      this.errorDispatcher.fire(error)
    })

    con.addResponseListener((tx: HttpConnectionTransaction<T>) => {
      this.inflight--
      const cons = this.enabled
      const index = cons.indexOf(con)
      assert(0 <= index, 'Connection not found')
      const inflight = con.getInflightCount()!
      let i = index - 1
      while (0 <= i && inflight < cons[i].getInflightCount()!) {
        i--
      }
      if (i < index - 1) {
        cons.splice(index, 1)
        cons.splice(i + 1, 0, con)
      }
      this.responseDispatcher.fire(tx)
    })

    return con
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
    for (const con of this.all) {
      con.close()
    }
  }

  public getConnectionsCount(): number {
    return this.enabled.length
  }

  public getInflightCount(): number {
    return this.inflight
  }

  public request(req: HttpConnectionRequest<T>): void {
    const cons = this.enabled
    assert(0 < cons.length, 'No active connections')
    const con = cons[0]
    con.request(req)
    this.inflight++
    const inflight = con.getInflightCount()!
    let index = 1
    while (index < cons.length && cons[index].getInflightCount()! < inflight) {
      index++
    }
    if (1 < index) {
      cons.splice(index, 0, con)
      cons.shift()
    }
  }
}
