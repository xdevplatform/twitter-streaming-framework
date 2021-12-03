// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { promises as fs } from 'fs'
import { Tweet, TwitterAccount, TwitterStream } from '..'

const SECONDS = 3600
const RULES = { bitcoin: '(bitcoin OR btc) -cash -is:retweet' }
const FILENAME = 'out.tsv'
const BATCH = 10

let totalTweets = 0
let seconds: number
let tweets: Tweet[] = []

async function onInterval() {
  process.stdout.write(`\r${totalTweets += tweets.length} Tweets in ${++seconds} seconds`)
  const isDone = SECONDS <= seconds
  if (BATCH <= tweets.length || isDone) {
    await fs.appendFile(
      FILENAME,
      tweets
        .map(t => `${t.id}\t${t.date.toISOString()}\t${
          t.text.replace(/\s/g, ' ')}\t${t.type}\t${t.user}\t${JSON.stringify(t.full).replace(/\s/g, ' ')}\n`)
        .join('')
    )
    tweets = []
  }
  if (isDone) {
    console.log()
    process.exit(0)
  }
}

function onTweet(tweet: Tweet) {
  if (seconds === undefined) {
    console.log()
    seconds = 0
    setInterval(onInterval, 1000)
  }
  tweets.push(tweet)
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

  await fs.writeFile(FILENAME, 'id\tdate\ttext\ttype\tuser\tfull\n')

  twitterStream.addListener(onTweet)
  twitterStream.addListener('connected', () => process.stdout.write('Waiting... '))
  twitterStream.connect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
