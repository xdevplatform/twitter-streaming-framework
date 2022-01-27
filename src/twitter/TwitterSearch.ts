// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Obj } from '../util'
import { Tweet } from './Tweet'
import { request } from '../http'
import { TwitterBase } from './TwitterBase'

export interface TwitterSearchResults {
  next: string | undefined
  tweets: Tweet[]
}

//
// Use the search API endpoints to count or search for Tweets matching specified
// queries. It also supports iteration over the search endpoint to download larger
// volumes of Tweets.
//
export class TwitterSearch extends TwitterBase {

  private async request(path: string, query?: Obj, body?: Obj): Promise<Obj> {
    const opts = { query, body, headers: this.account.auth, timeout: 30000 }
    const url = `https://gnip-api.twitter.com/search/fullarchive/accounts/${this.account.name}/${path}`
    const res = await request(url, opts)
    if (typeof res !== 'object') {
      throw new Error(`Invalid API response: ${res}`)
    }
    return res
  }

  // Tweets ///////////////////////////////////////////////

  public static readonly minMaxResults = 10
  public static readonly maxMaxResults = 500
  public static readonly defaultMaxResults = TwitterSearch.maxMaxResults

  public async count(query: string, opts: Obj = {}): Promise<number> {
    const startTime = opts.startTime && TwitterSearch.validateTime(opts.startTime)
    const endTime = opts.endTime && TwitterSearch.validateTime(opts.endTime)

    let next: string | undefined
    let total = 0
    do {
      const res = await this.request(
        `${this.label}/counts.json`,
        {
          bucket: 'day',
          query,
          ...(next ? { next } : {}),
          ...(startTime ? { fromDate: startTime } : {}),
          ...(endTime ? { toDate: endTime } : {}),
        },
      )
      total += res.totalCount
      next = res.next
    } while (next)
    return total
  }

  public async download(
    query: string,
    startTime: Date | string,
    endTime: Date | string,
    tweetLoader: (tweets: Tweet[]) => Promise<void>,
  ): Promise<void> {
    let next: string | undefined
    let loader: (() => Promise<void>) | undefined
    do {
      const [res, _]: [TwitterSearchResults, unknown] = await Promise.all([
        this.search(query, { maxResults: TwitterSearch.maxMaxResults, startTime, endTime, next }),
        loader && loader(),
      ])
      loader = 0 < res.tweets.length ? () => tweetLoader(res.tweets) : undefined
      next = res.next
    } while (next)
    if (loader) {
      await loader()
    }
  }

  public async search(query: string, opts: Obj = {}): Promise<TwitterSearchResults> {
    const startTime = opts.startTime && TwitterSearch.validateTime(opts.startTime)
    const endTime = opts.endTime && TwitterSearch.validateTime(opts.endTime)
    const res = await this.request(
      `${this.label}.json`,
      {},
      {
        query,
        maxResults: opts.maxResults || TwitterSearch.defaultMaxResults,
        ...(startTime ? { fromDate: startTime } : {}),
        ...(endTime ? { toDate: endTime } : {}),
        ...(opts.next ? { next: opts.next } : {}),
      },
    )
    return { tweets: (res.results || []).map((raw: any) => new Tweet(raw)).reverse(), next: res.next }
  }

  // Static ///////////////////////////////////////////////

  static validateTime(time: Date | string): string {
    const tm = time instanceof Date ? time.toISOString() : time
    if (typeof tm !== 'string' || !/^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(.\d\d\d)?Z$/.test(tm)) {
      throw new Error(`Invalid time format: ${time}`)
    }
    return tm.substring(0, 16).replace(/[^\d]/g, '')
  }
}
