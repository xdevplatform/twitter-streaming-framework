// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Tweet } from './Tweet'
import querystring from 'querystring'
import { TwitterAccount } from './TwitterAccount'
import { assert, assertInteger, Obj } from '../util'
import { TwitterBase, TwitterBaseOptions } from './TwitterBase'
import { EventListener, SimpleEventDispatcher, SimpleEventListener } from '../util/event'
import { HttpEndpoint, HttpResilientStream, HttpStreamEventType, request } from '../http'
import { StreamedTweet, TwitterStreamEventType, TwitterStreamInterface } from './TwitterStreamInterface'

export function createTwitterStreamEndpoint(
  account: TwitterAccount,
  label: string,
  params?: Record<string, number | string>,
): HttpEndpoint {
  const qs = params === undefined ? '' : '?' + querystring.stringify(params)
  const url = `https://gnip-stream.twitter.com/stream/powertrack/accounts/${
   account.name}/publishers/twitter/${label}.json${qs}`
  return new HttpEndpoint(url)
}

export interface TwitterStreamOptions extends TwitterBaseOptions {

  // Start the stream 1-5 minutes in the past (in case of past failure)
  backfillMinutes?: number

  // An alternative API endpoint (for example, when using a proxy)
  endpoint?: HttpEndpoint
}

//
// this class uses HttpResilientStream to stream Tweets from Twitter's
// PowerTrack API. It also supports the rule API to set the rules to
// filter streamed Tweets.
//
export class TwitterStream extends TwitterBase implements TwitterStreamInterface {
  private stream: HttpResilientStream
  private tweetDispatcher = new SimpleEventDispatcher<StreamedTweet>()

  constructor(account: TwitterAccount, options: TwitterStreamOptions = {}) {
    super(account, options)
    const params = options.backfillMinutes === undefined
      ? undefined
      : { backfillMinutes: assertInteger(options.backfillMinutes, 1, 5, 'Backfill minutes') }
    this.stream = new HttpResilientStream(
      options.endpoint || createTwitterStreamEndpoint(this.account, this.label, params),
      this.account.auth,
      {
        connectTimeoutMs: 8000,
        messageTimeoutMs: 30000,
        connectionMinWaitMs: 1000,
        connectionMaxWaitMs: 8000,
      },
    )
    this.stream.addEventListener('message', (message: string) => {
      try {
        const raw = JSON.parse(message)
        const tweet = new Tweet(raw) as StreamedTweet
        tweet.rules = raw.matching_rules.map((r: any) => r.tag)
        this.tweetDispatcher.fire(tweet)
      } catch (e: any) {
        console.error('TwitterStream:', e)
        console.error('TwitterStream:', message)
      }
    })
  }

  public addListener(
    typeOrListener: TwitterStreamEventType | SimpleEventListener<StreamedTweet>,
    listener?: EventListener<TwitterStreamEventType, string> | SimpleEventListener<StreamedTweet>,
  ): void {
    if (typeof typeOrListener === 'string') {
      assert(listener !== undefined, 'Listener type provided but no listener specified')
      if (typeOrListener === 'tweet') {
        this.tweetDispatcher.addListener(listener as SimpleEventListener<StreamedTweet>)
      } else {
        this.stream.addEventListener(typeOrListener, listener as EventListener<HttpStreamEventType, string>)
      }
    } else {
      assert(listener === undefined, 'Two listener provided')
      this.tweetDispatcher.addListener(typeOrListener as SimpleEventListener<StreamedTweet>)
    }
  }

  public connect(): void {
    this.stream.connect()
  }

  public disconnect(): void {
    this.stream.disconnect()
  }

  public async setStreamRules(newRulesRecord: Record<string, string> = {}, force = true): Promise<void> {
    const url = `https://data-api.twitter.com/rules/powertrack/accounts/${
      this.account.name}/publishers/twitter/${this.label}.json`

    const res = await request(url, { headers: this.account.auth })
    if (typeof res !== 'object') {
      throw new Error(`Invalid API response: ${res}`)
    }
    const oldRules = res.rules.map((rule: Obj) => [rule.tag, rule.value]).sort()

    const newRules = Object.entries(newRulesRecord)
    const match = oldRules.length === newRules.length &&
      newRules
        .sort()
        .map((newRule, i) => newRule[0] === oldRules[i][0] && newRule[1] === oldRules[i][1])
        .reduce((result, same) => result && same, true)
    if (match) {
      return
    }

    if (oldRules.length !== 0) {
      if (force) {
        console.log(`Deleting existing rules:\n${oldRules.map((r: string) => `  ${r[0]}: ${r[1]}`).join('\n')}`)
        await request(url + '?_method=delete', { headers: this.account.auth, body: { rules: res.rules } })
      } else {
        console.error(`Existing rules:\n${oldRules.map((r: string) => '  ' + r).join('\n')}`)
        throw new Error('New rules will override existing rules')
      }
    }

    console.log(`Setting stream rules:\n${newRules.map(r => `  ${r[0]}: ${r[1]}`).join('\n')}`)
    await request(
      url,
      { headers: this.account.auth, body: { rules: newRules.map(r => ({ tag: r[0], value: r[1] })) } },
    )
  }
}
