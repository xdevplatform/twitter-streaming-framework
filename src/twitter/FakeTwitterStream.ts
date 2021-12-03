// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import '../util/array'
import { assert } from '../util'
import { EventListener, SimpleEventDispatcher, SimpleEventListener } from '../util/event'
import { StreamedTweet, TwitterStreamEventType, TwitterStreamInterface } from './TwitterStreamInterface'

//
// Fake stream fo Tweets for testing.
//
export class FakeTwitterStream implements TwitterStreamInterface {
  private interval?: NodeJS.Timeout
  private dispatcher = new SimpleEventDispatcher<StreamedTweet>()
  private rules: string[] = []

  constructor(
    private readonly tweetsPerSecond: 1 | 2 | 5 | 10 | 50 | 100 | 200 | 400 | 600 | 800 | 1000,
    ruleProbabilities: Record<string, number>,
  ) {
    for (const [rule, probability] of Object.entries(ruleProbabilities)) {
      for (let i = 0; i < probability; i++) {
        this.rules.push(rule)
      }
    }
  }

  public addListener(
    typeOrListener: TwitterStreamEventType | SimpleEventListener<StreamedTweet>,
    listener?: EventListener<TwitterStreamEventType, string> | SimpleEventListener<StreamedTweet>,
  ): void {
    if (typeof typeOrListener === 'string') {
      assert(listener !== undefined, 'Listener type provided but no listener specified')
      if (typeOrListener !== 'tweet') {
        console.warn(`Event not supported by FakeTwitterStream: ${typeOrListener}. Ignored`)
        return
      }
      this.dispatcher.addListener(listener as SimpleEventListener<StreamedTweet>)
    } else {
      assert(listener === undefined, 'Two listener provided')
      this.dispatcher.addListener(typeOrListener as SimpleEventListener<StreamedTweet>)
    }
  }

  public connect(): void {
    assert(!this.interval, 'Already connected')
    const ms = this.tweetsPerSecond < 200 ? 1000 / this.tweetsPerSecond : 5
    const repeat = this.tweetsPerSecond < 200 ? 1 : this.tweetsPerSecond / 200
    console.log(`Connected: ms=${ms} repeat=${repeat}`)
    this.interval = setInterval(
      () => {
        const now = new Date()
        const timebase = (now.getTime() % 1000000) * 10
        for (let i = 0; i < repeat; i++) {
          const timestamp = String(timebase + i)
          this.dispatcher.fire({
            id: timestamp,
            date: now,
            media: [ 'http://example.com/image.jpg' ],
            text: `Example ${timestamp}`,
            type: 'original',
            user: 'johnappleseed',
            rules: [this.rules.random() || 'rule'],
            full: {},
          })
        }
      },
      ms,
    )
  }

  public disconnect(): void {
    assert(!this.interval, 'Not connected')
    clearInterval(this.interval!)
    this.interval = undefined
  }

  public async setStreamRules(newRulesRecord: Record<string, string>, force?: boolean): Promise<void> {
    console.log('Skipping setting of stream rules:', newRulesRecord)
  }
}
