// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { KVStore } from '../database'
import { TwitterAccount } from './TwitterAccount'
import { TwitterStream, TwitterStreamOptions } from './TwitterStream'
import { CountersLevel, assert, assertInteger, counters } from '../util'
import { SimpleEventDispatcher, SimpleEventListener } from '../util/event'
import { TwitterStreamInterface, StreamedTweet } from './TwitterStreamInterface'

export interface TwitterStreamerOptions {

  // Start the stream with a few (1-5) minutes backfill
  backfillMarginMinutes?: number

  // Time between heartbeats
  heartbeatIntervalMs?: number

  // Time interval for monitoring counters
  heartbeatMonitoringIntervalMs?: number

  // Counter monitoring level: debug, info, warn or error
  heartbeatMonitoringLevel?: CountersLevel

  // If no messages are generated during this number of heartbeat, crash the process
  heartbeatSilentIntervalsLimit?: number

  // Key-value datastore for tracking heartbeats
  heartbeatStore?: KVStore

  // Twitter account for connecting to PowerTrack (if specified, twitterStream must be undefined)
  twitterAccount?: TwitterAccount

  // Existing Twitter stream (if specified, twitterAccount must be undefined)
  twitterStream?: TwitterStreamInterface

  // Options for creating a new stream (if twitterAccount is provided)
  twitterStreamOptions?: TwitterStreamOptions
}

//
// Stream Tweets from the PowerTrack API on a specific account or through and existing
// TwitterStreamInterface (e.g. a FakeTwitterStream).
//
// This class supports backfill on Twitter streams. Backfill, specified in (1-5) minutes,
// starts the stream a few minutes in the past. This is useful in cases of failure, where
// the streamer needs to be restarted and needs to catch up on Tweets lost during its
// downtime.
//
// To facilitate backfill, this class provides a heartbeat mechanism. Heartbeat tracks
// incoming messages every time interval. It serves two functions:
//   1. Crash the process if the stream is silent for specified number of heartbeats
//   2. Optionally record the last time a message was received. The recorded time can
//      be used to determine required backfill, in case the streamer process crashes
//      or is terminated, and a replacement process is span up
//
export class TwitterStreamer {
  private readonly backfillMarginMinutes: number
  private readonly heartbeatIntervalMs?: number
  private readonly heartbeatMonitoringIntervalMs?: number
  private readonly heartbeatMonitoringLevel: CountersLevel
  private readonly heartbeatSilentIntervalsLimit: number
  private readonly heartbeatStore?: KVStore
  private readonly twitterAccount?: TwitterAccount
  private readonly twitterStream?: TwitterStreamInterface
  private readonly twitterStreamOptions?: TwitterStreamOptions

  private stream?: TwitterStreamInterface
  private readonly dispatcher = new SimpleEventDispatcher<StreamedTweet>()

  private streamListenerAdded = false

  private heartbeat?: NodeJS.Timeout
  private heartbeatSlideCounter = 0
  private lastTweetCount = 0

  constructor(options: TwitterStreamerOptions) {
    this.backfillMarginMinutes = options.backfillMarginMinutes || 0
    assertInteger(this.backfillMarginMinutes, 0, 5, `Invalid backgill margin: ${this.backfillMarginMinutes} minutes`)

    assert(
      options.twitterAccount !== undefined || options.twitterStream !== undefined,
      'Twitter streamer requires either account or stream',
    )
    assert(
      options.twitterAccount === undefined || options.twitterStream === undefined,
      'Twitter streamer cannot accept both account and stream',
    )
    assert(
      options.twitterStream === undefined || options.twitterStreamOptions === undefined,
      'Twitter stremer cannot accept stream options with stream',
    )
    this.twitterAccount = options.twitterAccount
    this.twitterStream = options.twitterStream

    if (options.heartbeatIntervalMs !== undefined) {
      this.heartbeatIntervalMs = assertInteger(
        options.heartbeatIntervalMs,
        100,
        undefined,
        `Invalid heartbeat interval: ${options.heartbeatIntervalMs}`,
      )
    }
    this.heartbeatMonitoringIntervalMs = options.heartbeatMonitoringIntervalMs || options.heartbeatIntervalMs
    this.heartbeatMonitoringLevel = options.heartbeatMonitoringLevel || 'info'
    this.heartbeatSilentIntervalsLimit = assertInteger(
      options.heartbeatSilentIntervalsLimit || 3,
      1,
      undefined,
      `Invalid heartbeat silent intervals limit: ${options.heartbeatSilentIntervalsLimit}`
    )
    this.heartbeatStore = options.heartbeatStore
  }

  private onHeartbeat(): void {
    const currentTweetCount = counters.debug.streamer.totalTweets.value
    if (
      this.lastTweetCount === currentTweetCount &&
      ++this.heartbeatSlideCounter === this.heartbeatSilentIntervalsLimit
    ) {
      console.error('\nConnection too slient. Terminating')
      process.exit(0)
    }
    this.heartbeatSlideCounter = 0
    this.lastTweetCount = currentTweetCount
    this.heartbeatStore?.set('heartbeat', { date: (new Date()).toISOString() })
  }

  private onStreamedTweet(streamedTweet: StreamedTweet): void {
    if (!this.heartbeat && this.heartbeatIntervalMs !== undefined) {
      counters.monitor(this.heartbeatMonitoringIntervalMs, this.heartbeatMonitoringLevel)
      this.heartbeat = setInterval(() => this.onHeartbeat(), this.heartbeatIntervalMs)
    }
    counters.debug.streamer.totalTweets.inc()
    this.dispatcher.fire(streamedTweet)
  }

  public addListener(listener: SimpleEventListener<StreamedTweet>): void {
    this.dispatcher.addListener(listener)
  }

  public async connect(shouldBackfill = false): Promise<void> {
    assert(this.stream === undefined, 'Already connected')
    if (this.twitterStream) {
      this.stream = this.twitterStream
      if (!this.streamListenerAdded) {
        this.stream.addListener((streamedTweet: StreamedTweet) => this.onStreamedTweet(streamedTweet))
        this.streamListenerAdded = true
      }
    } else {
      let backfillMinutes = 0
      if (shouldBackfill) {
        const heartbeat = await this.heartbeatStore?.get('heartbeat')
        if (heartbeat) {
          const elapsed = Date.now() - (new Date(heartbeat.date)).getTime()
          backfillMinutes = this.backfillMarginMinutes + Math.ceil(elapsed / 60000)
        }
        if (5 < backfillMinutes) {
          console.warn(`Data was lost. ${backfillMinutes} minutes time gap is over 5 minute backfill limit`)
          backfillMinutes = 5
        }
        console.log(`Backfilling ${backfillMinutes} minutes`)
      }
      const opts = { ...(this.twitterStreamOptions || {}), ...(0 < backfillMinutes ? { backfillMinutes } : {}) }
      this.stream = new TwitterStream(this.twitterAccount!, opts)
      this.stream.addListener((streamedTweet: StreamedTweet) => this.onStreamedTweet(streamedTweet))
    }
    this.stream.connect()
  }

  public disconnect(): void {
    assert(this.stream !== undefined, 'Not connected')
    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = undefined
    }
    this.stream!.disconnect()
    this.stream = undefined
  }
}
