// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Tweet } from './Tweet'
import { Minutes } from '../util'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBHashKey, DynamoDBRangeKey, DynamoDBTable } from '../database'

export interface TwitterDynamoDBTweetRecord {
  imageUrl?: string
  tweetId: string
  tweetMedia?: string[]
  tweetText: string
  tweetTime: string
  tweetType: string
  tweetUser: string
  tweetFull: string
}

export class TwitterDynamoDBTweetTable extends DynamoDBTable {
  constructor(client: DynamoDBClient, tableName: string) {
    super(client, tableName, new DynamoDBHashKey('brand'), new DynamoDBRangeKey('uid'))
  }

  public async query(brand: string, minutes: Minutes): Promise<TwitterDynamoDBTweetRecord[] | undefined> {
    return this.doPrefixQuery<TwitterDynamoDBTweetRecord>(brand, `${minutes.toShortISOString()}`)
  }

  public async store(pkey: string, tweet: Tweet): Promise<void> {
    await this.doStore<TwitterDynamoDBTweetRecord>(
      pkey,
      `${(new Minutes(tweet.date)).toShortISOString()}=${tweet.id}`,
      {
        tweetId: tweet.id,
        ...(0 < tweet.media.length ? { tweetMedia: tweet.media } : {}),
        tweetText: tweet.text,
        tweetTime: tweet.date.toISOString(),
        tweetType: tweet.type,
        tweetUser: tweet.user,
        tweetFull: JSON.stringify(tweet.full),
      },
    )
  }
}
