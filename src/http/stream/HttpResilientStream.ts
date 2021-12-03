// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { assert, Obj } from '../../util'
import { testAfter } from '../../util/test'
import { HttpEndpoint } from '../HttpEndpoint'
import { EventContext, EventDispatcher, EventListener } from '../../util/event'
import { HttpStream, HttpStreamError, HttpStreamEventType } from './HttpStream'

export interface HttpResilientStreamOptions {

  // Time interval for trackign connection status
  intervalMs?: number

  // Timeout for original HTTP request connection attempt
  connectTimeoutMs?: number

  // Timeout between stream messages
  messageTimeoutMs?: number

  // Minimal boundry for exponential reconnect backoff
  connectionMinWaitMs?: number

  // Maximal boundry for exponential reconnect backoff
  connectionMaxWaitMs?: number
}

//
// This class uses HttpStream to stream messages over an HTTP/S connection, adding
// support for reconnecting (with exponential backoff) upon error or timeout.
//
export class HttpResilientStream {
  private readonly intervalMs: number
  private readonly connectTimeoutMs: number
  private readonly messageTimeoutMs: number
  private readonly connectionMinWaitMs: number
  private readonly connectionMaxWaitMs: number

  private stream?: HttpStream
  private interval?: NodeJS.Timeout
  private connectionId = 0

  private connectTimestamp?: number
  private messageTimestamp?: number

  private waitMs?: number

  private eventDispatcher = new EventDispatcher<HttpStreamEventType, string>()
  private state: 'connected' | 'connecting' | 'init' | 'waiting' = 'init'

  constructor(private endpoint: HttpEndpoint, private headers: Obj, options: HttpResilientStreamOptions = {}) {
    this.intervalMs = options.intervalMs || 1000
    this.connectTimeoutMs = options.connectTimeoutMs || 8000
    this.messageTimeoutMs = options.messageTimeoutMs || 5000
    this.connectionMinWaitMs = options.connectionMinWaitMs || 1000
    this.connectionMaxWaitMs = options.connectionMaxWaitMs || 8000
  }

  private createStream(): void {
    const connectionId = ++this.connectionId
    this.stream = new HttpStream(this.endpoint, this.headers)
    this.stream.addEventListener('connected', () => this.onConnect(connectionId))
    this.stream.addEventListener(
      'message',
      (_: string, context: EventContext<HttpStreamEventType>) => this.onMessage(context, connectionId),
    )
    this.stream.addErrorListener(HttpStreamError.EANY, (event: HttpStreamError) => this.onStreamError(event))
    this.stream.copyEventListeners(this.eventDispatcher)
    this.interval = setInterval(() => this.onInterval(), this.intervalMs)
    this.connectTimestamp = Date.now()
  }

  private destroyStream(): void {
    clearInterval(this.interval!)
    this.stream!.close()
    this.interval = undefined
    this.stream = undefined
    this.connectTimestamp = undefined
    this.messageTimestamp = undefined
  }

  private onConnect(connectionId: number): void {
    if (connectionId !== this.connectionId) {
      console.log('HttpResilientStream: Ignoring old connection id', connectionId, 'already at', this.connectionId)
      return
    }
    console.log(`HttpResilientStream: Connected to ${this.endpoint.url} (id=${connectionId})`)
    assert(this.state === 'connecting', `Invalid state: ${this.state}`)
    this.connectTimestamp = undefined
    this.waitMs = undefined
    this.state = 'connected'
  }

  private onInterval(): void {
    // Using an interval and polling timestamps is a preformance optimization,
    // so we don't have to call setTimeout after each message received

    const now = Date.now()

    if (this.state === 'connecting') {
      assert(this.connectTimestamp !== undefined, 'No connect timestamp')
      const elapsed = now - this.connectTimestamp!
      if (this.connectTimeoutMs <= elapsed) {
        console.log(`HttpResilientStream: Connection attempt timed out after ${elapsed} ms`)
        this.waitMs = undefined
        this.destroyStream()
        this.createStream()
      }
      return
    }

    if (this.state === 'connected') {
      const elapsed = now - (this.messageTimestamp || now)
      if (this.messageTimeoutMs <= elapsed) {
        console.log(`HttpResilientStream: Stream timed out after ${elapsed} ms`)
        this.destroyStream()
        this.createStream()
        this.state = 'connecting'
      }
      return
    }
  }

  private onMessage(context: EventContext<HttpStreamEventType>, connectionId: number): void {
    if (testAfter.MESSAGE_TIMEOUT(`cid${connectionId}`, 5, () => {
      console.debug('Simulating message drop')
      context.stopPropagation()
      return true
    })) return
    this.messageTimestamp = Date.now()
  }

  private onStreamError(error: HttpStreamError) {
    if (this.state === 'connecting') {
      console.log('HttpResilientStream: Error connecting to stream:', error.toStr())
      this.destroyStream()
      this.waitMs = Math.min(this.waitMs ? this.waitMs * 2 : this.connectionMinWaitMs, this.connectionMaxWaitMs)
      console.log(`HttpResilientStream: Waiting ${this.waitMs} ms before reconnecting`)
      this.state = 'waiting'
      setTimeout(
        () => {
          console.log('HttpResilientStream: Done waiting, attempting to reconnect')
          this.createStream()
          this.state = 'connecting'
        },
        this.waitMs,
      )
      return
    }

    if (this.state === 'connected') {
      console.log('HttpResilientStream: Error detected while streaming:', error.toStr())
      console.log('HttpResilientStream: Attempting to reconnect')
      this.destroyStream()
      this.createStream()
      this.state = 'connecting'
      return
    }
  }

  public addEventListener(type: HttpStreamEventType, listener: EventListener<HttpStreamEventType, string>): void {
    this.eventDispatcher.addListener(type, listener)
    if (this.stream) {
      this.stream.addEventListener(type, listener)
    }
  }

  public copyEventListeners(dispatcher: EventDispatcher<HttpStreamEventType, string>): void {
    this.eventDispatcher.copyListeners(dispatcher)
  }

  public connect(): void {
    assert(this.state === 'init', 'Stream already connected')
    assert(this.stream === undefined, 'Has stream')
    assert(this.interval === undefined, 'Has interval')
    this.createStream()
    this.state = 'connecting'
  }

  public disconnect() {
    assert(this.state !== 'init', 'Stream not connected')
    if (this.state === 'connected' || this.state === 'connecting') {
      assert(this.stream !== undefined, 'No stream')
      assert(this.interval !== undefined, 'No interval')
      this.destroyStream()
    }
    if (this.state === 'waiting') {
      this.waitMs = undefined
    }
    this.state = 'init'
  }
}
