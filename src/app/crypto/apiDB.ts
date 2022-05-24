// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { assert, counters } from '../../util'
import { getDynamoDBClient } from '../../database'
import { HttpRouter, httpRouterMethod, HttpRouterRequest } from '../../http'
import { TwitterDynamoDBTweetSentimentTable } from "../../twitter/TwitterDynamoDBTweetSentimentTable"
import { COIN_REGEX, getCombinedResults, getDatapointFrequency, ONE_WEEK_MS, Result, URL_LATEST_REGEX, URL_REGEX } from "./utils"

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

export async function getLatestHandler(coin: string, frequency = 1): Promise<ApiResults> {
  assert(COIN_REGEX.test(coin), `Invalid coin: ${coin}`)

  const endTimestamp = new Date().getTime()
  const startTimestamp = endTimestamp - (frequency + 2) * 60 * 1000

  const results = (await tweetSentimentTable.queryTimeRange(coin, startTimestamp, endTimestamp) || []) as Result[]

  const combinedResults = getCombinedResults(results.slice(-frequency), frequency)

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

  @httpRouterMethod('GET', URL_LATEST_REGEX)
  public async trendLatest(req: HttpRouterRequest) {
    counters.info.requests.trends.inc()
    const [coin, _, frequency = 1] = req.params!

    const ret = await getLatestHandler(coin, Number(frequency))
    return [200, ret]
  }
}
