// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { assert, Minutes } from '../../util'
import { HttpRouter, httpRouterMethod, HttpRouterRequest } from '../../http'
import { DynamoDBTrendRecord, DynamoDBTrendsTable } from './DynamoDBTrendsTable'
import { TwitterDynamoDBTweetRecord, TwitterDynamoDBTweetTable } from '../../twitter'
import { DynamoDBSearchResults, dynamodDBTimedPrefixSearch, getDynamoDBClient } from '../../database'

const trendsTable = new DynamoDBTrendsTable(getDynamoDBClient(config.AWS_REGION), config.TRENDS_TABLE_NAME)
const tweetTable = new TwitterDynamoDBTweetTable(getDynamoDBClient(config.AWS_REGION), config.TWEET_TABLE_NAME)

const COIN_REGEX_STR = '[a-z]+'
const COIN_REGEX = new RegExp(`^${COIN_REGEX_STR}$`)
const TRENDS_REGEX = new RegExp(`^\/trends/(${COIN_REGEX_STR})\/(${Minutes.REGEX_STR})(\/(${Minutes.REGEX_STR}))?\/?$`)
const TWEETS_REGEX = new RegExp(`^\/tweets/(${COIN_REGEX_STR})\/(${Minutes.REGEX_STR})(\/(${Minutes.REGEX_STR}))?\/?$`)

export interface TrendResult extends DynamoDBTrendRecord {
  time: string
}

export function trends(
  coin: string,
  startTime: string,
  endTime?: string,
): Promise<DynamoDBSearchResults<DynamoDBTrendRecord>> {
  assert(COIN_REGEX.test(coin), `Invalid coin: ${coin}`)
  const qf = async (minute: Minutes) => {
    const res = await trendsTable.query(coin, minute)
    return res?.map(record => {
      const { coin, uid, ...data } = record as any
      return { time: minute.toShortISOString(), ...data }
    })
  }
  return dynamodDBTimedPrefixSearch(startTime, endTime, config.API_MAX_RESULTS, qf)
}

export type TweetResult = TwitterDynamoDBTweetRecord

export function tweets(
  coin: string,
  startTime: string,
  endTime?: string,
): Promise<DynamoDBSearchResults<TweetResult>> {
  assert(COIN_REGEX.test(coin), `Invalid coin: ${coin}`)
  const qf = async (minute: Minutes) => {
    const res = await tweetTable.query(coin, minute)
    return res?.map(record => { const { coin, uid, ...data } = record as any; return data })
  }
  return dynamodDBTimedPrefixSearch(startTime, endTime, config.API_MAX_RESULTS, qf)
}

export class ApiRouter extends HttpRouter {
  @httpRouterMethod('GET', TRENDS_REGEX)
  public async trends(req: HttpRouterRequest) {
    const [brand, startTime, _, endTime] = req.params!
    const ret = await trends(brand, startTime, endTime)
    return [200, ret]
  }

  @httpRouterMethod('GET', TWEETS_REGEX)
  public async tweets(req: HttpRouterRequest) {
    const [brand, startTime, _, endTime] = req.params!
    const ret = await tweets(brand, startTime, endTime)
    return [200, ret]
  }
}
