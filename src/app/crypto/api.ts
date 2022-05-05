// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { ConverseonSentiment } from './converseon'
import {assert, counters, Minutes, Obj} from '../../util'
import { FilesystemObjectStore, ObjectListing } from '../../database'
import { HttpRouter, httpRouterMethod, HttpRouterRequest } from '../../http'

const COIN_REGEX_STR = '[a-z]+'
const COIN_REGEX = new RegExp(`^${COIN_REGEX_STR}$`)
const URL_REGEX = new RegExp(`^\/(${COIN_REGEX_STR})\/(${Minutes.REGEX_STR})(\/(${Minutes.REGEX_STR}))?\/?$`)

type TweetStored = {
  id: string;
  followers_count: number;
  sentiment: ConverseonSentiment;
}

interface Entry {
  timestamp: string
  coin: string
  tweets: Array<TweetStored>
  usdRate: number
}

interface ApiResults {
  results: Entry[]
  nextStartTime?: string
}

const fos = new FilesystemObjectStore(config.OBJECT_STORE_BASE_PATH)

const scoreOptions = ['positive', 'neutral', 'negative', 'unknown']

function computeTwitterRank(tweets: Array<TweetStored>): Obj {
  const defaultValue = {sentiment: {positive: 0, neutral: 0, negative: 0, unknown: 0}, sentimentByFollowers: {positive: 0, neutral: 0, negative: 0, unknown: 0, totalFollowers: 0}}
  if (!tweets || tweets.length === 0) {
    return defaultValue
  }
  const ranks = tweets.reduce(({sentiment, sentimentByFollowers}, tweet) => {
    const {sentiment: tweetSentiment, followers_count} = tweet
    const value = tweetSentiment?.value || 'unknown'

    return {
      sentiment:{
        ...sentiment,
        [value]: sentiment[value] + 1,
      },
      sentimentByFollowers: {
        ...sentimentByFollowers,
        [value]: sentimentByFollowers[value] + followers_count,
        totalFollowers: sentimentByFollowers.totalFollowers + followers_count,
      }
    }
  }, defaultValue)

  // @ts-ignore
  const maxRank = (rankType: 'sentiment' | 'sentimentByFollowers') => (max: string, v: string) => ranks[rankType][max] > ranks[rankType][v] ? max : v
  const score = scoreOptions.reduce(maxRank('sentiment'))
  const scoreByFollowers = scoreOptions.reduce(maxRank('sentimentByFollowers'))

  return {
    ...ranks,
    score,
    scoreByFollowers
  }

}

export async function getHandler(coin: string, startTime: string, endTime?: string): Promise<ApiResults> {
  assert(COIN_REGEX.test(coin), `Invalid coin: ${coin}`)

  const startMinutes = new Minutes(startTime)
  const endMinutes = endTime ? new Minutes(endTime) : startMinutes.next()
  assert(startMinutes.le(endMinutes), `End time: ${endTime} precedes start time: ${startTime}`)
  if (startMinutes.eq(endMinutes)) {
    return { results: [] }
  }

  const res = await fos.listObjects(config.OBJECT_STORE_BUCKET_NAME)
  if (res === undefined) {
    return { results: [] }
  }

  const listings = (res as ObjectListing[])
    .sort((a, b) => a.timeCreated - b.timeCreated)
    .map(listing => ({ ...listing, minutes: new Minutes(listing.objectName) }))

  let first: number | undefined
  let last: number | undefined
  let size = 0

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i]
    if (listing.minutes.lt(startMinutes)) {
      continue
    }
    if (first === undefined) {
      first = i
    }
    if (config.API_MAX_RESPONSE_SIZE < size + listing.size || endMinutes.le(listing.minutes)) {
      last = i
      break
    }
    size += listing.size
  }

  if (first === last) {
    return { results: [] }
  }

  if (last === undefined) {
    last = listings.length
  }

  const results = await Promise.all(
    listings
      .slice(first, last)
      .map(async listing => {
        const buffer = await fos.getObject(config.OBJECT_STORE_BUCKET_NAME, listing.objectName)
        const { tweets, ...result } = JSON.parse(buffer!.toString())
        const twitterRank = computeTwitterRank(tweets)
        return { twitterRank, tweets, ...result }
      })
  )

  return last < listings.length && listings[last].minutes.lt(endMinutes)
    ? { results, nextStartTime: listings[last].minutes.toShortISOString() }
    : { results }
}

export class ApiRouter extends HttpRouter {
  constructor() {
    super({ cors: true })
  }

  @httpRouterMethod('GET', URL_REGEX)
  public async trends(req: HttpRouterRequest) {
    counters.info.requests.trends.inc()
    const [coin, startTime, _, endTime] = req.params!
    const ret = await getHandler(coin, startTime, endTime)
    return [200, ret]
  }
}
