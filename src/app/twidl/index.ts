// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { CsvFile } from '../../database'
import { JsonFile } from '../../database'
import { Tweet, TwitterAccount, TwitterSearch } from '../../twitter'
import { Obj, assert, getCommandLineOptions, hideCursor, showCursor } from '../../util'

function transformTweet(tweet?: Tweet): Record<string, string> {
  const guard = (val?: string): string => tweet && val !== undefined && val !== null ? val : ''

  return {
    ID: guard(tweet?.id),
    Created_At: guard(tweet?.date.toISOString()),
    Lang: guard(tweet?.full.lang),
    Text: guard(tweet?.text.replace(/\s/g, ' ')),
    Type: guard(tweet?.type),

    Like_Count: guard(tweet?.full.favorite_count),
    Retweet_Count: guard(tweet?.full.retweet_count),
    Quote_Count: guard(tweet?.full.quote_count),
    Reply_Count: guard(tweet?.full.reply_count),

    User_ID: guard(tweet?.full.user.id_str),
  }
}

function transformTweetWide(tweet?: Tweet): Record<string, string> {
  const guard = (val?: string): string => tweet && val !== undefined && val !== null ? val : ''

  const array = (arr?: string[]): string =>
    tweet && arr !== undefined && arr !== null && 0 < arr.length ? JSON.stringify(arr) : ''

  const media = tweet?.media
  let video: string | undefined
  let images: string[] = []
  if (media) {
    for (const url of media) {
      if (url.endsWith('mp4')) {
        video = url
      } else {
        images.push(url)
      }
    }
  }

  const place = tweet?.full.place
  const coordinates = tweet?.full.coordinates
  const user = tweet?.full.user
  const derived = user?.derived

  return {
    ID: guard(tweet?.id),
    Created_At: guard(tweet?.date.toISOString()),
    Lang: guard(tweet?.full.lang),
    Text: guard(tweet?.text.replace(/\s/g, ' ')),
    Type: guard(tweet?.type),
    Source: guard(tweet?.full.source),
    Withheld_Copyright: guard(tweet?.full.withheld_copyright),
    Withheld_In_Countries: guard(tweet?.full.withheld_in_countries ? tweet?.full.withheld_in_countries.join(';') : ''),

    Image1: guard(images[0]),
    Image2: guard(images[1]),
    Image3: guard(images[2]),
    Image4: guard(images[3]),
    Video: guard(video),

    Place_Country: guard(place?.country),
    Place_Country_Code: guard(place?.country_code),
    Place_Full_Name: guard(place?.full_name),
    Place_ID: guard(place?.id),
    Place_Name: guard(place?.name),
    Place_Type: guard(place?.place_type),
    Place_URL: guard(place?.url),
    Coordinates: array(coordinates && coordinates.coordinates && coordinates.coordinates),

    Like_Count: guard(tweet?.full.favorite_count),
    Retweet_Count: guard(tweet?.full.retweet_count),
    Quote_Count: guard(tweet?.full.quote_count),
    Reply_Count: guard(tweet?.full.reply_count),

    In_Reply_To_Tweet_ID: guard(tweet?.full.in_reply_to_status_id_str),
    In_Reply_To_User_ID: guard(tweet?.full.in_reply_to_user_id_str),
    In_Reply_To_Screen_Name: guard(tweet?.full.in_reply_to_screen_name),

    Quoted_Status_ID: guard(tweet?.full.quoted_status_id_str),
    Quoted_Status_Created_At: guard(tweet?.full.quoted_status?.created_at),
    Quoted_Status_Text: guard(tweet?.full.quoted_status?.full_text || tweet?.full.quoted_status?.text),
    Quoted_Status_Permalink: guard(tweet?.full.quoted_status_permalink?.expanded),
    Quoted_Status_User_ID: guard(tweet?.full.quoted_status?.user.id_str),
    Quoted_Status_User_Name: guard(tweet?.full.quoted_status?.user.name),
    Quoted_Status_User_Screen_Name: guard(tweet?.full.quoted_status?.user.screen_name),

    Retweeted_Status_ID: guard(tweet?.full.retweeted_status?.id_str),
    Retweeted_Status_Created_At: guard(tweet?.full.retweeted_status?.created_at),
    Retweeted_Status_Text: guard(tweet?.full.retweeted_status?.full_text || tweet?.full.retweeted_status?.text),
    Retweeted_Status_User_ID: guard(tweet?.full.retweeted_status?.user.id_str),
    Retweeted_Status_User_Name: guard(tweet?.full.retweeted_status?.user.name),
    Retweeted_Status_User_Screen_Name: guard(tweet?.full.retweeted_status?.user.screen_name),

    User_ID: guard(tweet?.full.user.id_str),
    User_Name: guard(tweet?.full.user.name),
    User_Screen_Name: guard(tweet?.full.user.screen_name),
    User_Created_At: guard(user && (new Date(user.created_at)).toISOString()),
    User_Description: guard(tweet?.full.user.description),
    User_Location: guard(user?.location),
    User_Derived_Location_Country_Code: guard(derived && derived.locations && derived.locations[0].country_code),
    User_Derived_Location_Full_Name: guard(derived && derived.locations && derived.locations[0].full_name),
    User_Derived_Location_Locality: guard(derived && derived.locations && derived.locations[0].locality),
    User_Derived_Location_Region: guard(derived && derived.locations && derived.locations[0].region),
    User_Derived_Location_Sub_Region: guard(derived && derived.locations && derived.locations[0].sub_region),
    User_Is_Verified: guard(user?.verified),
    User_Followers_Count: guard(user?.followers_count),
    User_Friends_Count: guard(user?.friends_count),
    User_Tweet_Count: guard(user?.statuses_count),

    Hashtags: array(tweet?.full.entities.hashtags.map((o: Obj) => o.text)),
    Mentions: array(tweet?.full.entities.user_mentions.map((o: Obj) => o.screen_name)),
    Symbols: array(tweet?.full.entities.symbols.map((o: Obj) => o.text)),

    Annotations: array(
      tweet?.full.entities?.annotations?.context?.map((o: Obj) =>
        `${o.context_domain_name}.${o.context_entity_name}(${o.context_domain_id_str}.${o.context_entity_id_str})`
      )
    ),

    Named_Entity: array(
      tweet?.full.entities?.annotations?.entity?.map((o: Obj) =>
        `${o.type}.${o.normalized_text}(${o.probability})`
      )
    ),

    // JSON: tweet ? JSON.stringify(tweet?.full) : '',
  }
}

function progressBarString(complete: number, total: number): string {
   const done = Math.round(complete * config.PROGRESS_BAR_WIDTH / total)
   return `|${'*'.repeat(done)}${'-'.repeat(config.PROGRESS_BAR_WIDTH - done)}|`
 }

async function downloadTweets(
  twitter: TwitterSearch,
  query: string,
  startTime: Date,
  endTime: Date,
  count: number,
  filenames: { csv?: string, json?: string },
  flags: Record<string, boolean>,
): Promise<void> {

  const csv = await (async () => {
    if (!filenames.csv) {
      return
    }
    const fields = Object.keys(flags.wide ? transformTweetWide() : transformTweet())
    const csv = new CsvFile(filenames.csv, fields, { allowEmptyFields: true, ignoreUnrecognizedFields: false })
    await csv.open()
    return csv
  })()

  const json = await (async () => {
    if (!filenames.json) {
      return
    }
    const json = new JsonFile(filenames.json)
    await json.open()
    return json
  })()

  let total = 0
  await twitter.download(query, startTime, endTime, async (tweets: Tweet[]) => {
    if (csv) {
      await csv.appendArray(tweets.map(flags.wide ? transformTweetWide : transformTweet))
    }
    if (json) {
      await json.appendArray(tweets.map(tweet => tweet.full))
    }
    total += tweets.length
    process.stdout.write(
      `Downloading: ${progressBarString(total, count)} (${total} / ${count})\n` +
      `Last Tweet time: ${tweets[tweets.length - 1].date.toISOString()}\r\x1b[A`
    )
  })

  if (csv) {
    await csv.close()
  }
  if (json) {
    await json.close()
  }

  console.log(`Downloading: ${progressBarString(count, count)} (${total} / ${count})\nDone.${' '.repeat(36)}`)
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
    count: 'Count matching Tweets without downloading (ignore --csv and --json)',
    csv: {
      description: 'Target CSV filename',
      argument: 'filename',
      required: false,
    },
    end: {
      description: 'End time (exclusive) in ISO 8601/RFC 3339 format (YYYY-MM-DDTHH:mm:ssZ)',
      argument: 'time',
      required: true,
      parser: dateParser,
    },
    json: {
      description: 'Target JSON filename',
      argument: 'filename',
      required: false,
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
    wide: 'Write more columns to CSV output',
  })
}

async function main(): Promise<void> {
  const twitter = new TwitterSearch(
    new TwitterAccount(config.TWITTER_ACCOUNT, config.TWITTER_EMAIL, config.TWITTER_PASSWORD),
    { label: config.TWITTER_LABEL },
  )

  const options = getOptions()

  const count = await countTweets(twitter, options.query, options.start, options.end)

  if ((options.csv !== undefined || options.json !== undefined) && options.count === undefined) {
    function onExit() {
      showCursor()
      console.log('\n')
      process.exit(0)
    }
    process.on('SIGINT', onExit)
    process.on('SIGTERM', onExit)
    hideCursor()

    try {
      await downloadTweets(
        twitter,
        options.query,
        options.start,
        options.end,
        count,
        { csv: options.csv, json: options.json },
        { wide: options.wide === undefined ? false : true },
      )
    } finally {
      showCursor()
    }
  }
}

if (typeof require === 'function' && require.main === module) {
  main().catch(e => { console.error(e); process.exit(1) })
}
