// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { assert, counters } from '../../util'
import { getDynamoDBClient } from '../../database'
import { HttpRouter, httpRouterMethod, HttpRouterRequest } from '../../http'
import { TwitterDynamoDBTweetSentimentTable } from "../../twitter/TwitterDynamoDBTweetSentimentTable"
import {getCombinedResults, getDatapointFrequency, Result} from "./utils";

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

const dynamoDBClient = getDynamoDBClient(config.AWS_REGION);
const tweetSentimentTable = new TwitterDynamoDBTweetSentimentTable(dynamoDBClient, config.CRYPTO_SENTIMENT_TABLE_NAME);

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

  const dataFrequency = getDatapointFrequency(startTimestamp, endTimestamp)
  const results = await tweetSentimentTable.queryTimeRange(coin, startTimestamp, endTimestamp) || []

  const combinedResults = getCombinedResults(results as Result[], dataFrequency)

  return { results: combinedResults }
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
