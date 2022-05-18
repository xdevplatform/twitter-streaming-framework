// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import {Converseon, ConverseonSentiment} from './converseon'
import {counters, Obj} from '../../util'
import { getLatestCoinToUSDRate } from './coins'
import { createStreamProbabilities } from './rules'
import { getDynamoDBClient} from '../../database'
import {
  FakeTwitterStream,
  StreamedTweet,
  TwitterAccount,
  TwitterStreamer
} from '../../twitter'
import {
  TwitterDynamoDBTweetSentimentRecord,
  TwitterDynamoDBTweetSentimentTable
} from "../../twitter/TwitterDynamoDBTweetSentimentTable";
import {platform} from "os";

const scoreOptions = ['positive', 'neutral', 'negative', 'unknown']

const dynamoDBClient = getDynamoDBClient(config.AWS_REGION);
const tweetSentimentTable = new TwitterDynamoDBTweetSentimentTable(dynamoDBClient, config.CRYPTO_SENTIMENT_TABLE_NAME);

type TweetStored = {
    id: string;
    followers_count: number;
}

type TwitterRank = {
    score: string
    scoreByFollowers: string
    sentiment: {
        positive: number
        neutral: number
        negative: number
        unknown: number
    }
    sentimentByFollowers: {
        positive: number
        neutral: number
        negative: number
        unknown: number
        totalFollowers: number
    }
}

function computeTwitterRank(tweets: Array<TweetStored>, sentiments: Array<ConverseonSentiment>): TwitterRank {
    const defaultValue = {sentiment: {positive: 0, neutral: 0, negative: 0, unknown: 0}, sentimentByFollowers: {positive: 0, neutral: 0, negative: 0, unknown: 0, totalFollowers: 0}}
    if (!tweets || tweets.length === 0) {
        return {score: 'unknown', scoreByFollowers: 'unknown', ...defaultValue}
    }
    const ranks = tweets.reduce(({sentiment, sentimentByFollowers}, {followers_count}, idx) => {

        const tweetSentiment = sentiments[idx]
        const value = tweetSentiment?.value || 'unknown'

        return {
            sentiment:{
                ...sentiment,
                [value]: sentiment[value] + 1,
            },
            sentimentByFollowers: {
                ...sentimentByFollowers,
                [value]: sentimentByFollowers[value] + followers_count,
                totalFollowers: sentimentByFollowers.totalFollowers + followers_count,
            }
        }
    }, defaultValue)

    // @ts-ignore
    const maxRank = (rankType: 'sentiment' | 'sentimentByFollowers') => (max: string, v: string) => ranks[rankType][max] > ranks[rankType][v] ? max : v
    const score = scoreOptions.reduce(maxRank('sentiment'))
    const scoreByFollowers = scoreOptions.reduce(maxRank('sentimentByFollowers'))

    return {
        ...ranks,
        score,
        scoreByFollowers
    }
}

async function saveSentimentResults(record: TwitterDynamoDBTweetSentimentRecord): Promise<void> {
    counters.info.streamer.totalWrites.inc()
    counters.debug.streamer.activeWrites.inc()
    await tweetSentimentTable.store(record)
    counters.debug.streamer.activeWrites.dec()
}

let interval: NodeJS.Timeout
let streamedTweets: StreamedTweet[] = []

const converseon = new Converseon(config.CONVERSEON_API_KEY)

async function onInterval() {
  try {
    counters.info.streamer.writes.inc()
    counters.info.streamer.tweetsInBatch.set(0)

    const coin = 'bitcoin'
    const timeMs = new Date().getTime();
    const [usdRate, sentiments] = await Promise.all([
      getLatestCoinToUSDRate(coin),
      converseon.sentiment(streamedTweets.map(tweet => tweet.text)),
    ])
    const tweets = streamedTweets.map(({id, full: {user: {followers_count}}}, idx) => ({id, followers_count}))
      const tweetIds = tweets.sort(
          (a, b) => b.followers_count - a.followers_count)
          .map(({id}) => id)
    const twitterRank = computeTwitterRank(tweets, sentiments)
    const payload = { timeMs, coin, ...twitterRank, tweetIds, usdRate }
    await saveSentimentResults(payload);

  } catch (error) {
    console.log(error)
    counters.warn.streamer.errors.inc()
  }
}

function onStreamedTweet(streamedTweet: StreamedTweet): void {
  if (!interval) {
    interval = setInterval(onInterval, config.BATCH_INTERVAL)
  }
  counters.info.streamer.tweetsInBatch.inc()
  streamedTweets.push(streamedTweet)
}

export function stream(shouldBackfill = false) {
  const streamer = new TwitterStreamer(
    config.TWITTER_USE_FAKE_STREAM
      ? { twitterStream: new FakeTwitterStream(config.EXPECTED_TWEET_RATE, createStreamProbabilities()) }
      : {
        heartbeatIntervalMs: config.HEARTBEAT_INTERVAL_MS,
        heartbeatMonitoringIntervalMs: config.PRINT_COUNTERS_INTERVAL_MS,
        heartbeatMonitoringLevel: config.PRINT_COUNTERS_LEVEL,
        twitterAccount: new TwitterAccount(config.TWITTER_ACCOUNT, config.TWITTER_EMAIL, config.TWITTER_PASSWORD),
      }
  )

  streamer.addListener(onStreamedTweet)
  streamer.connect(shouldBackfill)
}
