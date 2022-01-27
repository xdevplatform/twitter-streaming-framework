// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { CsvFile } from '../../database'
import { Tweet, TwitterAccount, TwitterSearch } from '../../twitter'
import { assert, getCommandLineOptions, hideCursor, showCursor } from '../../util'

function transformTweet(tweet?: Tweet): Record<string, string> {
  const guard = (val?: string): string => tweet && val !== undefined ? val : ''

  // const place = tweet?.full.place
  // const coordinates = tweet?.full.coordinates
  // const user = tweet?.full.user
  // const link = (id?: string) => id ? `https://twitter.com/twitter/status/${id}` : ''

  return {
    ID: guard(tweet?.id),
    Date: guard(tweet?.date.toISOString()),
    Language: guard(tweet?.full.lang),
    // Link: guard(link(tweet?.id)),
    // Media: guard(tweet?.media.join(';')),
    Text: guard(tweet?.text.replace(/\s/g, ' ')),
    Type: guard(tweet?.type),

    // Location_Country: guard(place?.country),
    // Location_Name: guard(place?.full_name),
    // Location_Coordinates: guard(coordinates && coordinates.coordinates && coordinates.coordinates.join(';') || ''),

    Like_Count: guard(tweet?.full.favorite_count),
    Retweet_Count: guard(tweet?.full.retweet_count),
    Quote_Count: guard(tweet?.full.quote_count),
    Reply_Count: guard(tweet?.full.reply_count),

    // In_Reply_To_Tweet_ID: guard(tweet?.full.in_reply_to_status_id_str),
    // In_Reply_To_Tweet_Link: guard(link(tweet?.full.in_reply_to_status_id_str)),

    Author: guard(tweet?.user),
    // Author_Creation_Date: user ? (new Date(user.created_at)).toISOString() : '',
    // Author_Tweet_Count: guard(user?.statuses_count),
    // Author_Location_Country_Code:
    //   guard(user?.derived && user?.derived.locations && user?.derived.locations[0].country_code || ''),
    // Author_Location_Region:
    //   guard(user?.derived && user?.derived.locations && user?.derived.locations[0].region || ''),
    // Author_Location_Full_Name:
    //   guard(user?.derived && user?.derived.locations && user?.derived.locations[0].full_name || ''),
    // Author_Is_Verified: guard(user?.verified),
    // Author_Follower_Count: guard(user?.followers_count),
    // Author_Following_Count: guard(user?.friends_count),

    // JSON: tweet ? JSON.stringify(tweet?.full) : '',
  }
}

function progressBarString(complete: number, total: number): string {
   const done = Math.round(complete * config.PROGRESS_BAR_WIDTH / total)
   return `|${'*'.repeat(done)}${'-'.repeat(config.PROGRESS_BAR_WIDTH - done)}|`
 }

async function downloadTweets(
  twitter: TwitterSearch,
  filename: string,
  query: string,
  startTime: Date,
  endTime: Date,
  count: number,
): Promise<void> {
  const fields = Object.keys(transformTweet())
  const csv = new CsvFile(filename, fields, { allowEmptyFields: true, ignoreUnrecognizedFields: false })
  await csv.init()

  let total = 0
  await twitter.download(query, startTime, endTime, async (tweets: Tweet[]) => {
    await csv.appendArray(tweets.map(transformTweet))
    total += tweets.length
    process.stdout.write(
      `Downloading: ${progressBarString(total, count)} (${total} / ${count})\n` +
      `Last Tweet time: ${tweets[tweets.length - 1].date.toISOString()}\r\x1b[A`
    )
  })
  process.stdout.write('\n\n\n')
}

async function countTweets(twitter: TwitterSearch, query: string, startTime: Date, endTime: Date): Promise<number> {
  const count = await twitter.count(query, { startTime, endTime })
  console.log(`Matched ${count} tweet${count === 1 ? '' : 's'}`)
  return count
}

function getOptions() {
  function dateParser(str: string): Date {
    const date = new Date(str)
    assert(date.toString() !== 'Invalid Date', 'Invalid Date')
    return date
  }

  return getCommandLineOptions({
    count: 'Count matching Tweets without downloading',
    csv: {
      description: 'Target CSV filename',
      argument: 'filename',
      required: true,
    },
    end: {
      description: 'End time (exclusive) in ISO 8601/RFC 3339 format (YYYY-MM-DDTHH:mm:ssZ)',
      argument: 'time',
      required: true,
      parser: dateParser,
    },
    query: {
      description: 'Twitter enterprise search query',
      argument: 'querystring',
      required: true,
    },
    start: {
      description: 'Start time (inclusive) in ISO 8601/RFC 3339 format (YYYY-MM-DDTHH:mm:ssZ)',
      argument: 'time',
      required: true,
      parser: dateParser,
    },
  })
}

async function main(): Promise<void> {
  const twitter = new TwitterSearch(
    new TwitterAccount(config.TWITTER_ACCOUNT, config.TWITTER_EMAIL, config.TWITTER_PASSWORD),
    { label: config.TWITTER_LABEL },
  )

  const options = getOptions()

  const count = await countTweets(twitter, options.query, options.start, options.end)
  if (options.count === undefined) {
    hideCursor()
    try {
      await downloadTweets(twitter, options.csv, options.query, options.start, options.end, count)
    } finally {
      showCursor()
    }
  }
}

if (typeof require === 'function' && require.main === module) {
  main().catch(e => { console.error(e); process.exit(1) })
}
