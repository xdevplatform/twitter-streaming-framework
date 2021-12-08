// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { assert, counters, Minutes } from '../../util'
import { DynamoDBSearchResults, getDynamoDBClient } from '../../database'
import { HttpRouter, httpRouterMethod, HttpRouterRequest } from '../../http'
import { TwitterDynamoDBPartialTweetRecord, TwitterDynamoDBTweetTable, twitterDynamoDBTweetSearch } from '../../twitter'

const tweetTable = new TwitterDynamoDBTweetTable(getDynamoDBClient(config.AWS_REGION), config.TWEET_TABLE_NAME)

const BRAND_REGEX_STR = '[a-zA-Z]\\w+'
const BRAND_REGEX = new RegExp(`^${BRAND_REGEX_STR}$`)
const SEARCH_REGEX = new RegExp(`^\/search/(${BRAND_REGEX_STR})\/(${Minutes.REGEX_STR})(\/(${Minutes.REGEX_STR}))?\/?$`)

export async function search(
  brand: string,
  startTime: string,
  endTime?: string,
  full = false,
): Promise<DynamoDBSearchResults<TwitterDynamoDBPartialTweetRecord>> {
  assert(BRAND_REGEX.test(brand), `Invalid brand: ${brand}`)
  const qf = async (minute: Minutes) => {
    const res = await tweetTable.query(brand, minute)
    return res?.map(record => { const { brand, uid, ...data } = record as any; return data })
  }
  return twitterDynamoDBTweetSearch(startTime, endTime, full, config.API_MAX_RESULTS, qf)
}

export class ApiRouter extends HttpRouter {
  constructor() {
    super({ cors: true })
  }

  @httpRouterMethod('GET', SEARCH_REGEX)
  public async search(req: HttpRouterRequest) {
    counters.info.requests.search.inc()
    const [brand, startTime, _, endTime] = req.params!
    const ret = await search(brand, startTime, endTime, req.query?.format?.toLocaleLowerCase() === 'full')
    return [200, ret]
  }
}
