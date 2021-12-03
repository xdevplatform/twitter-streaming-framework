// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Tweet } from './Tweet'
import { TwitterAccount } from './TwitterAccount'
import { TwitterStream, TwitterStreamOptions } from './TwitterStream'
import { SimpleEventDispatcher, SimpleEventListener } from '../util/event'

const DELAY_SEC = 10 /* stream delay */ + 3 /* wait for out of order tweets */

export interface TweetGroup {
  groupId: string
  tweets: Tweet[]
}

export interface TwitterStreamGroupsOptions extends TwitterStreamOptions {

  // Time window length in seconds
  groupDurationSec?: number
}

//
// Stream Tweets and collect them into groups based on time windows.
//
export class TwitterStreamGroups {
  private twitterStream: TwitterStream
  private groupDurationMs: number
  private interval?: NodeJS.Timeout
  private groups: Record<string, Tweet[]> = {}
  private dispatcher = new SimpleEventDispatcher<TweetGroup>()
  private delay: number

  constructor(account: TwitterAccount, options: TwitterStreamGroupsOptions = {}) {
    this.twitterStream = new TwitterStream(account, options)
    this.twitterStream.addListener((tweet: Tweet) => this.onTweet(tweet))
    const groupDurationSec = options.groupDurationSec || 1
    if (groupDurationSec < 1 || 60 < groupDurationSec) {
      throw new Error(`Group duration out of bounds: ${groupDurationSec} seconds`)
    }
    this.groupDurationMs = groupDurationSec * 1000
    this.delay = Math.ceil(DELAY_SEC / groupDurationSec)
  }

  private getGroupNumber(date?: Date): number {
    return Math.floor((date ? date.getTime() : Date.now()) / this.groupDurationMs)
  }

  private onTweet(tweet: Tweet) {
    const groupId = this.getGroupNumber(tweet.date).toString(36)
    if (!this.groups[groupId]) {
      this.groups[groupId] = []
    }
    this.groups[groupId].push(tweet)
  }

  private onInterval(): void {
    const now = this.getGroupNumber()
    for (const groupId of Object.keys(this.groups)) {
      if (this.delay < now - parseInt(groupId, 36)) {
        this.dispatcher.fire({ groupId, tweets: this.groups[groupId] })
        delete this.groups[groupId]
      }
    }
  }

  public addListener(listener: SimpleEventListener<TweetGroup>): void {
    this.dispatcher.addListener(listener)
  }

  public connect(): void {
    if (this.interval) {
      throw new Error('Streaming already in progress')
    }
    this.twitterStream.connect()
    this.interval = setInterval(() => this.onInterval(), 1000)
  }

  public disconnect(): void {
    if (!this.interval) {
      throw new Error('Not streaming')
    }
    clearInterval(this.interval)
    this.interval = undefined
    this.twitterStream.disconnect()
  }

  public setStreamRules(rules: Record<string, string> = {}, force = true): Promise<void> {
    return this.twitterStream.setStreamRules(rules, force)
  }
}
