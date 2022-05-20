// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { assert, counters } from '../../util'
import { FilesystemObjectStore, ObjectListing } from '../../database'
import { HttpRouter, httpRouterMethod, HttpRouterRequest } from '../../http'
import {
  getCombinedResults,
  getDatapointFrequency,
  ONE_WEEK_MS,
  Result
} from './utils'

const COIN_REGEX_STR = '[a-z]+'
const COIN_REGEX = new RegExp(`^${COIN_REGEX_STR}$`)
const URL_REGEX = new RegExp(`^\/(${COIN_REGEX_STR})\/(\\d+)(\/(\\d+))?\/?$`)

interface ApiResults {
  results: Array<Result>
  nextStartTime?: string
}

const fos = new FilesystemObjectStore(config.OBJECT_STORE_BASE_PATH)

export async function getHandler(coin: string, startTime: number, endTime?: number): Promise<ApiResults> {
  console.log('\nHERE\n')
  assert(COIN_REGEX.test(coin), `Invalid coin: ${coin}`)

  const startTimestamp = startTime
  const endTimestamp = endTime ? endTime : startTimestamp + 60 * 1000
  assert(startTimestamp <= endTimestamp, `End time: ${endTime} precedes start time: ${startTime}`)
  assert(endTimestamp - startTime < ONE_WEEK_MS, 'More than a week worth of data requested')
  const dataFrequency = getDatapointFrequency(startTimestamp, endTimestamp)

  if (startTimestamp === endTimestamp) {
    return { results: [] }
  }

  const res = await fos.listObjects(config.OBJECT_STORE_BUCKET_NAME)
  if (res === undefined) {
    return { results: [] }
  }

  console.log('res', res.length)
  const listings = (res as ObjectListing[])
      .filter(listing => Number(listing.objectName) >= startTimestamp && Number(listing.objectName) <= endTimestamp)
  console.log('listings', listings.length)
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
        return JSON.parse(buffer!.toString()) as Result
      })
  )
  console.log('results', results.map(({tweetIds, ...rest}) => ({...rest})))

  const combinedResults = getCombinedResults(results, dataFrequency)
  console.log('combinedResults', combinedResults.map(({tweetIds, ...rest}) => ({...rest})))

  return last < listings.length
    ? { results: combinedResults, nextStartTime: listings[last].objectName }
    : { results: combinedResults }
}

export class ApiRouter extends HttpRouter {
  constructor() {
    super({ cors: true })
  }

  @httpRouterMethod('GET', URL_REGEX)
  public async trends(req: HttpRouterRequest) {
    counters.info.requests.trends.inc()
    const [coin, startTime, _, endTime] = req.params!

    const ret = await getHandler(coin, Number(startTime), Number(endTime))
    return [200, ret]
  }
}
