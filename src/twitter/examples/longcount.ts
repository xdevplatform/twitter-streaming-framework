// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import fs from 'fs'
import { pad } from '../../util'
import { StreamedTweet, TwitterAccount, TwitterStream } from '..'

const SAMPLES = 1500 // 25 hours
const INTERVAL = 60000
const RULES = { images: 'has:images -is:retweet', videos: 'has:videos -is:retweet' }

let samples: number
const counts = {
  tweetsWithImages: 0,
  images: 0,
  tweetsWithVideos: 0,
}

function getTimestamp(): string {
  const now = new Date()
  const hh = pad(now.getUTCHours(), 2, '0')
  const mm = pad(now.getUTCMinutes(), 2, '0')
  return `${hh}:${mm}`
}

function perSecond(count: number): number {
  return Math.round(count * 1000 / INTERVAL)
}

function onInterval() {
  const logline = [
    getTimestamp(),
    perSecond(counts.tweetsWithImages),
    perSecond(counts.images),
    perSecond(counts.tweetsWithVideos),
  ].join(',') + '\n'
  counts.tweetsWithImages = counts.images = counts.tweetsWithVideos = 0
  const done = SAMPLES <= ++samples
  process.stdout.write(`\r${samples} samples`)
  fs.appendFile(
    'longcount.csv',
    logline,
    (err) => {
      if (err) {
        console.error(err)
        process.exit(1)
      }
      if (done) {
        console.log('\nDone.')
        process.exit(0)
      }
    },
  )
}

function onTweet(tweet: StreamedTweet) {
  if (tweet.rules.includes('images')) {
    counts.tweetsWithImages += 1
    counts.images += tweet.media.length
  }
  if (tweet.rules.includes('videos')) {
    counts.tweetsWithVideos += 1
  }
  if (samples === undefined) {
    console.log()
    samples = 0
    setInterval(onInterval, INTERVAL)
  }
}

async function main() {
  const twitterAccount = new TwitterAccount(
    process.env.TWITTER_ACCOUNT,
    process.env.TWITTER_EMAIL,
    process.env.TWITTER_PASSWORD,
  )
  const twitterStream = new TwitterStream(twitterAccount)
  console.log('Setting rules:', RULES)
  await twitterStream.setStreamRules(RULES, true)
  twitterStream.addListener(onTweet)
  twitterStream.addListener('connected', () => process.stdout.write('Waiting... '))
  twitterStream.connect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
