// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { counters } from '../../util'
import { getLatestCoinToUSDRate } from './coins'
import { createStreamProbabilities } from './rules'
import { DynamoDBTrendsTable } from './DynamoDBTrendsTable'
import { DynamoDBKVStore, getDynamoDBClient } from '../../database'
import {
  FakeTwitterStream,
  StreamedTweet,
  Tweet,
  TwitterAccount,
  TwitterDynamoDBTweetTable,
  TwitterStreamer,
} from '../../twitter'

const trendsTable = new DynamoDBTrendsTable(getDynamoDBClient(config.AWS_REGION), config.TRENDS_TABLE_NAME)
const tweetTable = new TwitterDynamoDBTweetTable(getDynamoDBClient(config.AWS_REGION), config.TWEET_TABLE_NAME)

async function saveTweet(tweet: Tweet, coins: string[]): Promise<void> {
  for (const coin of coins) {
    counters.info.streamer.totalTweetWrites.inc()
    counters.debug.streamer.activeTweetWrites.inc()
    await tweetTable.store(coin, tweet)
    counters.debug.streamer.activeTweetWrites.dec()
  }
}

let interval: NodeJS.Timeout

async function onInterval() {
  counters.info.streamer.totalTrendWrites.inc()
  counters.debug.streamer.activeTrendWrites.inc()
  const coin = 'bitcoin'
  await trendsTable.store(
    coin,
    counters.info.streamer.tweetsInLastTrend.value,
    await getLatestCoinToUSDRate(coin),
  )
  counters.info.streamer.tweetsInLastTrend.set(0)
  counters.debug.streamer.activeTrendWrites.dec()
}

function onStreamedTweet(streamedTweet: StreamedTweet): void {
  if (!interval) {
    interval = setInterval(onInterval, config.TREND_INTERVAL)
  }
  counters.info.streamer.tweetsInLastTrend.inc()
  const { rules, ...tweet } = streamedTweet
  saveTweet(tweet, rules)
}

export function stream(shouldBackfill = false) {
  const streamer = new TwitterStreamer(
    config.TWITTER_USE_FAKE_STREAM
      ? { twitterStream: new FakeTwitterStream(config.EXPECTED_TWEET_RATE, createStreamProbabilities()) }
      : {
        heartbeatIntervalMs: config.HEARTBEAT_INTERVAL_MS,
        heartbeatMonitoringIntervalMs: config.PRINT_COUNTERS_INTERVAL_MS,
        heartbeatMonitoringLevel: config.PRINT_COUNTERS_LEVEL,
        heartbeatStore: new DynamoDBKVStore(getDynamoDBClient(config.AWS_REGION), config.CONTROL_TABLE_NAME),
        twitterAccount: new TwitterAccount(config.TWITTER_ACCOUNT, config.TWITTER_EMAIL, config.TWITTER_PASSWORD),
      }
  )

  streamer.addListener(onStreamedTweet)
  streamer.connect(shouldBackfill)
}
