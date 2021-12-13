// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
import { createStreamRules } from './rules'
import { getDynamoDBClient, DynamoDBKVStore } from '../../database'
import { TwitterAccount, TwitterDynamoDBTweetTable, TwitterStream } from '../../twitter'

export async function createDynamoDBTables() {
  const client = getDynamoDBClient(config.AWS_REGION, config.AWS_DYNAMODB_ENDPOINT)

  const tweets = new TwitterDynamoDBTweetTable(client, config.TWEET_TABLE_NAME)
  console.log('Creating DynamoDB Tweets table:', tweets.tableName)
  console.log('DynamoDB Tweets table ARN:', await tweets.create())

  const control = new DynamoDBKVStore(client, config.CONTROL_TABLE_NAME)
  console.log('Creating DynamoDB control table:', control.tableName)
  console.log('DynamoDB control table ARN:', await control.create())
}

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
