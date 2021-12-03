// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import ospath from 'path'
import { TwitterAccount, TwitterStream } from '..'

const DURATION = 30

async function main() {
  if (
    process.argv.length < 3 ||
    4 < process.argv.length ||
    (process.argv.length === 3 && (process.argv[2] === '-f' || process.argv[2] === '--force')) ||
    (process.argv.length === 4 && process.argv[2] !== '-f' && process.argv[2] !== '--force')
  ) {
    const exe = ospath.basename(process.argv[1])
    console.error(`Usage: node ${exe} [-f|--force] <rule>`)
    console.error()
    console.error('Examples:')
    console.error(`  node ${exe} twitter`)
    console.error(`  node ${exe} 'hello world'`)
    console.error(`  node ${exe} 'has:images lang:en -is:retweet'`)
    console.error(`  node ${exe} --force 'has:images -is:retweet'`)
    console.error()
    console.error('Learn more:')
    console.error('  https://developer.twitter.com/en/docs/twitter-api/enterprise/rules-and-filtering/building-a-rule')
    console.error()
    process.exit(1)
  }
  const force = process.argv.length === 4
  const rule = process.argv[process.argv.length - 1]

  const twitterAccount = new TwitterAccount(
    process.env.TWITTER_ACCOUNT,
    process.env.TWITTER_EMAIL,
    process.env.TWITTER_PASSWORD,
  )
  const twitterStream = new TwitterStream(twitterAccount)

  console.log('Setting rule:', rule)
  await twitterStream.setStreamRules({ rule }, force)

  let count: number
  twitterStream.addListener(() => {
    if (count !== undefined) {
      return count++
    }

    count = 0
    let countdown = DURATION
    function onTimeout() {
      process.stdout.write(`\rMeasuring for ${countdown} seconds... `)
      if (countdown-- === 0) {
        const frequency = Math.floor(10 * count / DURATION) / 10
        console.log(`\rTweets per second: ${frequency}      `)
        twitterStream.disconnect()
      } else {
        setTimeout(onTimeout, 1000)
      }
    }
    onTimeout()

  })

  twitterStream.addListener('connected', () => process.stdout.write('Waiting... '))
  twitterStream.connect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
