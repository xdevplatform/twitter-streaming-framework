// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { assert, counters } from '../../util'
import { FilesystemObjectStore, ObjectListing } from '../../database'
import { HttpRouter, httpRouterMethod, HttpRouterRequest } from '../../http'
import mcache from 'memory-cache'

const COIN_REGEX_STR = '[a-z]+'
const COIN_REGEX = new RegExp(`^${COIN_REGEX_STR}$`)
const URL_REGEX = new RegExp(`^\/(${COIN_REGEX_STR})\/(\\d+)(\/(\\d+))?\/?$`)

interface Entry {
  timeMs: number
  coin: string
  tweetIds: Array<string>
  usdRate: number
}

interface ApiResults {
  results: Entry[]
  nextStartTime?: string
}

const fos = new FilesystemObjectStore(config.OBJECT_STORE_BASE_PATH)

const FIVE_MIN = 1000 * 60 * 5
const ONE_WEEK_MS = 1000 * 60 * 60 * 24 * 7 + FIVE_MIN

export async function getHandler(coin: string, startTime: number, endTime?: number): Promise<ApiResults> {
  assert(COIN_REGEX.test(coin), `Invalid coin: ${coin}`)

  const startTimestamp = startTime
  const endTimestamp = endTime ? endTime : startTimestamp + 60 * 1000
  assert(startTimestamp <= endTimestamp, `End time: ${endTime} precedes start time: ${startTime}`)
  assert(endTimestamp - startTime < ONE_WEEK_MS, 'More than a week worth of data requested')
  if (startTimestamp === endTimestamp) {
    return { results: [] }
  }

  const res = await fos.listObjects(config.OBJECT_STORE_BUCKET_NAME)
  if (res === undefined) {
    return { results: [] }
  }

  const listings = (res as ObjectListing[])
      .filter(listing => Number(listing.objectName) >= startTimestamp && Number(listing.objectName) <= endTimestamp)

  let first: number | undefined
  let last: number | undefined
  let size = 0

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i]
    if (first === undefined) {
      first = i
    }
    if (config.API_MAX_RESPONSE_SIZE < size + listing.size) {
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
        return JSON.parse(buffer!.toString())
      })
  )

  return last < listings.length
    ? { results, nextStartTime: listings[last].objectName }
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
    const cacheKey = `${coin}_${startTime}_${endTime}`
    const cachedResponse = mcache.get(cacheKey)
    if (cachedResponse) {
      return [200, cachedResponse]
    } else {
      const ret = await getHandler(coin, Number(startTime), Number(endTime))
      mcache.put(cacheKey, ret, 2 * 24 * 60 * 60 * 1000); // Keep for 2 days max
      return [200, ret]
    }
  }
}
