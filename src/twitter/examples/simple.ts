// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { sleep } from '../../util'
import { Tweet, TwitterAccount, TwitterStream } from '..'

async function main() {
  const twitterAccount = new TwitterAccount(
    process.env.TWITTER_ACCOUNT,
    process.env.TWITTER_EMAIL,
    process.env.TWITTER_PASSWORD,
  )
  const twitterStream = new TwitterStream(twitterAccount)
  await twitterStream.setStreamRules({ streaming: 'streaming -is:retweet' })

  twitterStream.addListener((tweet: Tweet) => {
    console.log(tweet.id, tweet.text.replace(/[\r\n]/g, '.'))
  })

  twitterStream.connect()

  console.log('Streaming for 15 seconds...')
  await sleep(15000)

  twitterStream.disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
