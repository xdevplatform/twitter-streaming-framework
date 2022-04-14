// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { ConverseonSentiment } from './converseon'
import { assert, counters, Minutes } from '../../util'
import { FilesystemObjectStore, ObjectListing } from '../../database'
import { HttpRouter, httpRouterMethod, HttpRouterRequest } from '../../http'

const COIN_REGEX_STR = '[a-z]+'
const COIN_REGEX = new RegExp(`^${COIN_REGEX_STR}$`)
const URL_REGEX = new RegExp(`^\/(${COIN_REGEX_STR})\/(${Minutes.REGEX_STR})(\/(${Minutes.REGEX_STR}))?\/?$`)

interface Entry {
  timestamp: string
  coin: string
  tweetIds: string[]
  usdRate: number
}

interface ApiResults {
  results: Entry[]
  nextStartTime?: string
}

const fos = new FilesystemObjectStore(config.OBJECT_STORE_BASE_PATH)

function computeTwitterRank(sentiments: ConverseonSentiment[]): number {
  return 0
}

export async function getHandler(coin: string, startTime: string, endTime?: string): Promise<ApiResults> {
  assert(COIN_REGEX.test(coin), `Invalid coin: ${coin}`)

  const startMinutes = new Minutes(startTime)
  const endMinutes = endTime ? new Minutes(endTime) : startMinutes.next()
  assert(startMinutes.le(endMinutes), `End time: ${endTime} preceeds start time: ${startTime}`)
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
        const { sentiments, ...result } = JSON.parse(buffer!.toString())
        const twitterRank = computeTwitterRank(sentiments)
        return { twitterRank, ...result }
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
