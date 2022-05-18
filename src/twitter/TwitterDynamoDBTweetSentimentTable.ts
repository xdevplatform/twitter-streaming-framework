// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import {Minutes, Obj} from '../util'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBHashKey,
  DynamoDBRangeKey,
  DynamoDBSearchResults,
  DynamoDBTable,
  DynamoDBTimedPrefixQueryFunction,
  dynamodDBTimedPrefixSearch,
} from '../database'
import {ConverseonSentiment} from "../app/crypto/converseon";


export interface TwitterDynamoDBTweetSentiments {
  tweetIds: Array<string>
  sentiment: Obj
  sentimentByFollowers: Obj
}

export interface TwitterDynamoDBTweetSentimentsStored {
  tweetIds: string;
  sentiment: string
  sentimentByFollowers: string
}

export type TwitterDynamoDBSentMetadata = {
  coin: string;
  timeMs: number;
  usdRate: number;
  score: string
  scoreByFollowers: string
}

export type TwitterDynamoDBTweetSentimentRaw = TwitterDynamoDBTweetSentimentsStored & TwitterDynamoDBSentMetadata

export type TwitterDynamoDBTweetSentimentRecord = TwitterDynamoDBTweetSentiments & TwitterDynamoDBSentMetadata

export class TwitterDynamoDBTweetSentimentTable extends DynamoDBTable {
  constructor(client: DynamoDBClient, tableName: string, timeToLiveHours?: number) {
    super(
      client,
      tableName,
      new DynamoDBHashKey('coin'),
      new DynamoDBRangeKey('timeMs'),
      timeToLiveHours === undefined ? undefined : 'expirationTime',
      timeToLiveHours,
    )
  }

  public async queryTimeRange(coin: string, startTime: number, endTime: number): Promise<TwitterDynamoDBTweetSentimentRecord[] | undefined> {
    const res = await this.doQueryTimeRange<TwitterDynamoDBTweetSentimentRaw>(coin, startTime.toString(), endTime.toString())
    return res ? res.map(({tweetIds,sentiment,sentimentByFollowers, timeMs, ...rest}) => ({...rest, timeMs: Number(timeMs), tweetIds: JSON.parse(tweetIds),sentiment: JSON.parse(sentiment),sentimentByFollowers: JSON.parse(sentimentByFollowers)})) : undefined
  }

  public async store({coin, timeMs, tweetIds, sentiment, sentimentByFollowers,...rest}: TwitterDynamoDBTweetSentimentRecord): Promise<void> {
    await this.doStore<TwitterDynamoDBTweetSentimentsStored>(
        coin,
        timeMs,
        {
          ...rest,
          sentiment: JSON.stringify(sentiment),
          sentimentByFollowers: JSON.stringify(sentimentByFollowers),
          tweetIds: JSON.stringify(tweetIds),
      },
    )
  }
}

