// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { pad } from '../../util'
import { TwitterAccount, TwitterStream } from '..'

const BACKFILL_MINUTES = 2
const RUNNING_AVERAGE_LENGTH = 5

class Counter {
  private _value = 0
  private readonly history: number[] = []

  constructor(private readonly runningAverageLength = RUNNING_AVERAGE_LENGTH) {
  }

  public get average(): number {
    return this.history.length === 0
      ? 0
      : Math.round(this.history.reduce((a, v) => a + v, 0) / this.history.length)
  }

  public inc(delta = 1): number {
    return this._value += delta
  }

  public reset(): void {
    if (this.history.length === this.runningAverageLength) {
      this.history.shift()
    }
    this.history.push(this._value)
    this._value = 0
  }

  public get value(): number {
    return this._value
  }

  public set value(newValue: number) {
    this._value = newValue
  }
}

const counters: Record<string, Counter> = {
  current: new Counter(),
  backfill: new Counter(),
  diff: new Counter(),
}
let index = 0
let totalBackfill = 0
let interval: NodeJS.Timeout

function onInterval() {
  counters.diff.value = counters.backfill.value - counters.current.value
  totalBackfill += counters.diff.value
  console.log(
    [
      pad(index++, 5, ' '),
      `${pad(counters.backfill.value, 4, ' ')} \x1b[38;5;240m${pad(`(${counters.backfill.average})`, 6, ' ')}\x1b[0m`,
      `${pad(counters.current.value, 4, ' ')} \x1b[38;5;240m${pad(`(${counters.current.average})`, 6, ' ')}\x1b[0m`,
      `${pad(counters.diff.value, 4, ' ')} \x1b[38;5;240m${pad(`(${counters.diff.average})`, 6, ' ')}\x1b[0m`,
      pad(totalBackfill, 13, ' '),
    ].join('    ')
  )

  if (10 < index && Math.abs(counters.diff.average) < 10) {
    console.log()
    console.log(`Backfilled ${totalBackfill} tweets from ${BACKFILL_MINUTES} minutes in ${
      index - RUNNING_AVERAGE_LENGTH} seconds`)
    process.exit(0)
  }

  counters.current.reset()
  counters.backfill.reset()
  counters.diff.reset()
}

function onTweet(name: string): void {
  if (interval === undefined) {
    console.log()
    console.log('\x1b[33mIndex       Backfill        Current     Difference    TotalBackfill\x1b[0m')
    interval = setInterval(onInterval, 1000)
  }
  counters[name].inc()
}

function createStream(
  twitterAccount: TwitterAccount,
  name: string,
  params?: Record<string, number | string>,
): TwitterStream {
  const st = new TwitterStream(twitterAccount, params)
  st.addListener(() => onTweet(name))
  st.connect()
  return st
}

async function main() {
  const twitterAccount = new TwitterAccount(
    process.env.TWITTER_ACCOUNT,
    process.env.TWITTER_EMAIL,
    process.env.TWITTER_PASSWORD,
  )
  createStream(twitterAccount, 'current')
  createStream(twitterAccount, 'backfill', { backfillMinutes: BACKFILL_MINUTES })
  // await twitterStream.setStreamRules({ images: 'has:images -is:retweet' }, true)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
