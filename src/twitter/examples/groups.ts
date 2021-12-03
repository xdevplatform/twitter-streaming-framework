// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { sleep } from '../../util'
import { TweetGroup, TwitterAccount, TwitterStreamGroups } from '..'

async function main() {
  const twitterAccount = new TwitterAccount(
    process.env.TWITTER_ACCOUNT,
    process.env.TWITTER_EMAIL,
    process.env.TWITTER_PASSWORD,
  )
  const twitterStreamGroups = new TwitterStreamGroups(twitterAccount)
  twitterStreamGroups.setStreamRules({ images: 'has:images -is:retweet' })

  twitterStreamGroups.addListener(({ groupId, tweets }: TweetGroup) => {
    console.log(`Group ${groupId}: ${tweets.length} Tweets`)
  })

  twitterStreamGroups.connect()

  console.log('Streaming for 20 seconds...')
  await sleep(20000)

  twitterStreamGroups.disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
