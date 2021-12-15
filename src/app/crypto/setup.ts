// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { createStreamRules } from './rules'
import { TwitterAccount, TwitterStream } from '../../twitter'

export async function setTwitterStreamRules() {
  const twitterAccount = new TwitterAccount(
    config.TWITTER_ACCOUNT,
    config.TWITTER_EMAIL,
    config.TWITTER_PASSWORD,
  )
  const twitterStream = new TwitterStream(twitterAccount)
  const rules = createStreamRules()
  console.log('Setting Twitter stream rules:')
  for (const rule in rules) {
    console.log(`  ${rule}: ${rules[rule]}`)
  }
  await twitterStream.setStreamRules(rules)
}
