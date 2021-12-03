// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Minutes } from '../../util'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBHashKey, DynamoDBRangeKey, DynamoDBTable } from '../../database'

export interface DynamoDBTrendRecord {
  tweetCount: number
  usdRate: number
}

export class DynamoDBTrendsTable extends DynamoDBTable {
  constructor(client: DynamoDBClient, tableName: string) {
    super(client, tableName, new DynamoDBHashKey('coin'), new DynamoDBRangeKey('uid'))
  }

  public async query(coin: string, minutes: Minutes): Promise<DynamoDBTrendRecord[] | undefined> {
    return this.doPrefixQuery<DynamoDBTrendRecord>(coin, `${minutes.toShortISOString()}$`)
  }

  public async store(coin: string, tweetCount: number, usdRate: number): Promise<void> {
    const uid = `${(new Minutes()).toShortISOString()}$`
    await this.doStore<DynamoDBTrendRecord>(coin, uid, { tweetCount, usdRate })
  }
}
