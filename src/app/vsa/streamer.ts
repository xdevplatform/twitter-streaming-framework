// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { Visua } from './visua/visua'
import { counters } from '../../util'
import { createStreamProbabilities } from './rules'
import { DynamoDBKVStore, getDynamoDBClient } from '../../database'
import {
  FakeTwitterStream,
  StreamedTweet,
  Tweet,
  TwitterAccount,
  TwitterDynamoDBTweetTable,
  TwitterStreamer,
} from '../../twitter'

const visua = new Visua(config.VISUA_DEVELOPER_KEY, {
  activityTimeoutMs: config.VISUA_ACTIVITY_TIMEOUT_MS,
  apiEndpoint: config.VISUA_ENDPOINT,
  connectionCount: config.VISUA_PIPELINED_CONNECTION_COUNT,
  maxAttempts: config.VISUA_MAX_ATTEMPTS,
  maxPipelineDepth: config.VISUA_PIPELINE_DEPTH,
  waitTimeForDetectionMs: config.VISUA_WAIT_TIME,
})

const dynamodDBClient = getDynamoDBClient(config.AWS_REGION, config.AWS_DYNAMODB_ENDPOINT)
const tweetTable = new TwitterDynamoDBTweetTable(dynamodDBClient, config.TWEET_TABLE_NAME)

async function saveTweet(tweet: Tweet, brands: string[]): Promise<void> {
  for (const brand of brands) {
    counters.info.streamer.totalWrites.inc()
    counters.debug.streamer.activeWrites.inc()
    await tweetTable.store(brand, tweet)
    counters.debug.streamer.activeWrites.dec()
  }
}

async function onImage(tweet: Tweet, url: string): Promise<void> {
  counters.debug.streamer.activeImages.inc()
  counters.debug.streamer.activeDetections.inc()
  const res = await visua.detectLogosInImage(url)
  counters.debug.streamer.activeDetections.dec()
  if (res.status === 'complete' && res.logos !== undefined) {
    counters.info.streamer.totalDetections.inc(res.logos.length)
    await saveTweet(tweet, res.logos)
  }
  counters.debug.streamer.activeImages.dec()
}

function onStreamedTweet(streamedTweet: StreamedTweet): void {
  const { rules, ...tweet } = streamedTweet
  if (rules.includes('images')) {
    counters.debug.streamer.totalTweetsWithImages.inc()
    for (const url of tweet.media) {
      counters.info.streamer.totalImages.inc()
      onImage(tweet, url)
    }
  }
  saveTweet(tweet, rules.filter(rule => rule.startsWith('@')).map(rule => rule.substr(1)))
}

export function stream(shouldBackfill = false) {
  const streamer = new TwitterStreamer(
    config.TWITTER_USE_FAKE_STREAM
      ? { twitterStream: new FakeTwitterStream(config.EXPECTED_IMAGE_RATE, createStreamProbabilities()) }
      : {
        backfillMarginMinutes: Math.ceil((config.VISUA_WAIT_TIME + 2 * config.VISUA_API_LATENCY_MS + 1000) / 60000),
        heartbeatIntervalMs: config.HEARTBEAT_INTERVAL_MS,
        heartbeatMonitoringIntervalMs: config.PRINT_COUNTERS_INTERVAL_MS,
        heartbeatMonitoringLevel: config.PRINT_COUNTERS_LEVEL,
        heartbeatStore: new DynamoDBKVStore(dynamodDBClient, config.CONTROL_TABLE_NAME),
        twitterAccount: new TwitterAccount(config.TWITTER_ACCOUNT, config.TWITTER_EMAIL, config.TWITTER_PASSWORD),
      }
  )

  streamer.addListener(onStreamedTweet)
  streamer.connect(shouldBackfill)
}
