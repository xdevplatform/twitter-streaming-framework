// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { counters } from '../../util'
import { createStreamProbabilities } from './rules'
import { FilesystemObjectStore } from '../../database'
import { FakeTwitterStream, StreamedTweet, TwitterAccount, TwitterStreamer } from '../../twitter'
import {getDataToStore} from "./utils";

const fos = new FilesystemObjectStore(config.OBJECT_STORE_BASE_PATH)
let interval: NodeJS.Timeout
let streamedTweets: StreamedTweet[] = []

async function onInterval() {
  try {
    counters.info.streamer.writes.inc()
    counters.info.streamer.tweetsInBatch.set(0)

    const coin = 'bitcoin'

    const payload = await getDataToStore(streamedTweets, coin)

    await fos.putObject(config.OBJECT_STORE_BUCKET_NAME, String(payload.timeMs), Buffer.from(JSON.stringify(payload)))

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
