// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { assert, Minutes } from '../../util'
import { HttpRouter, httpRouterMethod, HttpRouterRequest } from '../../http'
import { TwitterDynamoDBTweetRecord, TwitterDynamoDBTweetTable } from '../../twitter'
import { DynamoDBSearchResults, dynamodDBTimedPrefixSearch, getDynamoDBClient } from '../../database'

const tweetTable = new TwitterDynamoDBTweetTable(getDynamoDBClient(config.AWS_REGION), config.TWEET_TABLE_NAME)

const BRAND_REGEX_STR = '[a-zA-Z]\\w+'
const BRAND_REGEX = new RegExp(`^${BRAND_REGEX_STR}$`)
const SEARCH_REGEX = new RegExp(`^\/search/(${BRAND_REGEX_STR})\/(${Minutes.REGEX_STR})(\/(${Minutes.REGEX_STR}))?\/?$`)

export type SearchResult = TwitterDynamoDBTweetRecord

export async function search(
  brand: string,
  startTime: string,
  endTime?: string,
): Promise<DynamoDBSearchResults<SearchResult>> {
  assert(BRAND_REGEX.test(brand), `Invalid brand: ${brand}`)
  const qf = async (minute: Minutes) => {
    const res = await tweetTable.query(brand, minute)
    return res?.map(record => { const { brand, uid, ...data } = record as any; return data })
  }
  return dynamodDBTimedPrefixSearch(startTime, endTime, config.API_MAX_RESULTS, qf)
}

export class ApiRouter extends HttpRouter {
  @httpRouterMethod('GET', SEARCH_REGEX)
  public async search(req: HttpRouterRequest) {
    const [brand, startTime, _, endTime] = req.params!
    const ret = await search(brand, startTime, endTime)
    return [200, ret]
  }
}
