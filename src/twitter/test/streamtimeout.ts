// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { sleep } from '../../util'
import { Tweet, TwitterAccount, TwitterStream } from '..'

import { testSet } from '../../util/test'
testSet('STREAM_SERVER_TIMEOUT')

const twitterAccount = new TwitterAccount(
  process.env.TWITTER_ACCOUNT,
  process.env.TWITTER_EMAIL,
  process.env.TWITTER_PASSWORD,
)

export async function main() {
  const twitterStream = new TwitterStream(twitterAccount)
  await twitterStream.setStreamRules({ rule: 'has:images lang:en -is:retweet' })
  twitterStream.addListener((tweet: Tweet) => console.log(tweet.id))
  twitterStream.connect()

  await sleep(13000)

  console.log('Disconnecting stream')
  twitterStream.disconnect()
}
