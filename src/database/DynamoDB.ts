// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { KVStore } from './KVStore'
import { Minutes, Obj, assert, assertInteger, counters, sleep } from '../util'
import {
  AttributeValue,
  CreateTableCommand,
  CreateTableOutput,
  DescribeTableCommand,
  DescribeTableOutput,
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  UpdateTimeToLiveCommand,
} from '@aws-sdk/client-dynamodb'

const clients: Record<string, DynamoDBClient> = {}

export function getDynamoDBClient(region = 'us-east-1', endpoint?: string): DynamoDBClient {
  assert(typeof region === 'string' && /^[a-z]+(\-[a-z\d]+)+$/.test(region), `Invalid aws region: ${region}`)
  if (clients[region] === undefined) {
    clients[region] = new DynamoDBClient({ region, ...( endpoint ? { endpoint } : {}) })
  }
  return clients[region]
}

export class DynamoDBKey {
  public static BINARY = 'B'
  public static NUMBER = 'N'
  public static STRING = 'S'

  public static HASH = 'HASH'
  public static RANGE = 'RANGE'

  constructor(public readonly name: string, public readonly type: string, public readonly encoding: string) {
    assert(typeof name === 'string' && /^[a-zA-Z_][\w\-]*$/.test(name), `Invalid attribute name: ${name}`)
    assert([DynamoDBKey.STRING, DynamoDBKey.NUMBER].includes(type), `Invalid attribute type: ${type}`)
    assert([DynamoDBKey.HASH, DynamoDBKey.RANGE].includes(encoding), `Invalid key type: ${encoding}`)
  }
}

export class DynamoDBHashKey extends DynamoDBKey {
  constructor(name: string, type: string = DynamoDBKey.STRING) {
    super(name, type, DynamoDBKey.HASH)
  }
}

export class DynamoDBRangeKey extends DynamoDBKey {
  constructor(name: string, type: string = DynamoDBKey.STRING) {
    super(name, type, DynamoDBKey.RANGE)
  }
}

const WAIT_TIME_FOR_TABLE_CREATION_SECONDS = 15

//
// A class for accessing DynamoDB tables. It manages the partition key
// and search key and provides a method for creating the table in the
// database.
//
// This class is implemented as an abstract class and could allow
// extending classes to provide different interfaces like:
//
// Generic query/store interface:
//   query(...): Promise<T[] | undefined>
//   store(...): Promise<void>
//
// Simple get/set interface:
//   get(key: string): Promise<T | undefined>
//   set(key: string, value: T): Promise<void>
//
// (we do not include abstract methods here to provide extending
// calsses with flexibily to choose methods and argument types)
//
export abstract class DynamoDBTable {
  constructor(
    protected readonly client: DynamoDBClient,
    public readonly tableName: string,
    public readonly pkey: DynamoDBKey,
    public readonly skey: DynamoDBKey,
    public readonly timeToLiveAttributeName?: string,
    public readonly timeToLiveHours?: number,
  ) {
    const ident = /^[a-zA-Z_][\w\-]*$/
    assert(typeof tableName === 'string' && ident.test(tableName), `Invalid table name: ${tableName}`)
    if (timeToLiveAttributeName !== undefined) {
      assert(
        typeof timeToLiveAttributeName === 'string' && ident.test(timeToLiveAttributeName),
        `Invalid time to live attribute name: ${timeToLiveAttributeName}`,
      )
    }
    if (timeToLiveHours !== undefined) {
      assert(timeToLiveAttributeName !== undefined, 'Time to live attribute name is undefined')
      assertInteger(timeToLiveHours, 1, 24 * (365 * 5 - 1), `Invalid time to live: ${timeToLiveHours} hours`)
    }
  }

  protected async doQuery<T extends Obj>(
    condition: string,
    values: Record<string, AttributeValue>,
  ): Promise<T[] | undefined> {
    try {
      const res = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: condition,
          ExpressionAttributeValues: values,
        })
      )
      assert(res !== undefined && res.Items !== undefined, 'No items')
      return res.Items!.map((item: Record<string, AttributeValue>) => this.itemToRecord(item))
    } catch (e) {
      counters.error.DynamoDB.queryErrors.inc()
      console.error(e)
    }
  }

  protected async doPrefixQuery<T extends Obj>(pkey: string, skeyPrefix: string): Promise<T[] | undefined> {
    return this.doQuery<T>(
      `${this.pkey.name} = :${this.pkey.name} AND begins_with(${this.skey.name}, :prefix)`,
      { [`:${this.pkey.name}`]: { S: pkey }, ':prefix': { S: skeyPrefix } },
    )
  }

  protected async doStore<T extends Obj>(
    pkey: string,
    skey: string,
    record: T,
    timeToLiveHours = this.timeToLiveHours,
  ): Promise<void> {
    assert(
      this.timeToLiveAttributeName !== undefined || timeToLiveHours === undefined,
      'Time to live specified but no attribute name given at construction',
    )
    try {
      await this.client.send(
        new PutItemCommand({
          TableName: this.tableName,
          Item: this.recordToItem({
            ...record,
            [this.pkey.name]: pkey,
            [this.skey.name]: skey,
            ...(timeToLiveHours ? { [this.timeToLiveAttributeName!]: Date.now() + timeToLiveHours * 3600000 } : {}),
          }),
        })
      )
    } catch (e) {
      counters.error.DynamoDB.writeErrors.inc()
      console.error(e)
    }
  }

  protected itemToRecord<T extends Obj>(item: Record<string, AttributeValue>): T {
    const record: Obj = {}
    for (const [key, value] of Object.entries(item)) {
      record[key] = Object.values(value)[0]
    }
    return record as T
  }

  protected recordToItem<T extends Obj>(record: T): Record<string, AttributeValue> {
    const item: Record<string, AttributeValue> = {}
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'boolean') {
        item[key] = { BOOL: value }
      } else if (typeof value === 'number') {
        item[key] = { N: String(value) }
      } else if (typeof value === 'string') {
        item[key] = { S: value }
      } else if (Array.isArray(value) && value.filter(e => typeof e === 'number').length === value.length) {
        item[key] = { NS: value.map(e => String(e)) }
      } else if (Array.isArray(value) && value.filter(e => typeof e === 'string').length === value.length) {
        item[key] = { SS: value }
      } else {
        throw new Error(`Unsupported item value: [${key}] = ${value}`)
      }
    }
    return item
  }

  public async create(): Promise<string> {
    const keySchema = [{ AttributeName: this.pkey.name, KeyType: this.pkey.encoding }]
    const attrDefs = [{ AttributeName: this.pkey.name, AttributeType: this.pkey.type }]
    if (this.skey) {
      keySchema.push({ AttributeName: this.skey.name, KeyType: this.skey.encoding })
      attrDefs.push({ AttributeName: this.skey.name, AttributeType: this.skey.type })
    }

    const res: CreateTableOutput = await this.client.send(new CreateTableCommand({
      TableName : this.tableName,
      KeySchema: keySchema,
      AttributeDefinitions: attrDefs,
      BillingMode: 'PAY_PER_REQUEST',
    }))

    const arn = res.TableDescription && res.TableDescription.TableArn
    assert(arn !== undefined, `Error creating DynamoDB table: ${this.tableName}`)

    for (let i = WAIT_TIME_FOR_TABLE_CREATION_SECONDS; ; i--) {
      assert(0 < i, `Waited too long for DynamoDB table to be created: ${this.tableName}`)
      await sleep(1000)
      const res: DescribeTableOutput = await this.client.send(new DescribeTableCommand({ TableName: this.tableName }))
      assert(res.Table !== undefined, `Error getting DynamoDB table status: ${this.tableName}`)
      if (res.Table!.TableStatus === 'ACTIVE') {
        break
      }
      assert(res.Table!.TableStatus === 'CREATING', `Error creating DynamoDB table: ${this.tableName}`)
    }

    if (this.timeToLiveAttributeName !== undefined) {
      await this.client.send(new UpdateTimeToLiveCommand({
        TableName: this.tableName,
        TimeToLiveSpecification: {
          AttributeName: this.timeToLiveAttributeName,
          Enabled: true,
        },
      }))
    }

    return arn!
  }
}

//
// A specialized type of DynamoDB table that behaves like a simple key-value store.
//
export class DynamoDBKVStore extends DynamoDBTable implements KVStore {
  constructor(client: DynamoDBClient, tableName: string, timeToLiveAttributeName?: string, timeToLiveHours?: number) {
    super(
      client,
      tableName,
      new DynamoDBHashKey('pkey'),
      new DynamoDBRangeKey('skey'),
      timeToLiveAttributeName,
      timeToLiveHours,
    )
  }

  public async get(key: string): Promise<Obj | undefined> {
    const items = await this.doQuery<Obj>(
      `${this.pkey.name} = :${this.pkey.name} AND ${this.skey.name} = :${this.skey.name}`,
      { [`:${this.pkey.name}`]: { S: 'pkey' }, [`:${this.skey.name}`]: { S: key } },
    )
    assert(items === undefined || items.length === 1, `Unexpected number of items: ${items?.length}`)
    return items && items![0]
  }

  public async set(key: string, value: Obj, timeToLiveHours?: number): Promise<void> {
    await this.doStore<Obj>('pkey', key, value, timeToLiveHours)
  }
}

//
// A helper function for searching a DynamoDB table that uses time in
// search keys. This function receives a time range and a query function
// that should know how to search for keys in a specific minute. We
// assume that the query function has access to the partition key.
//

export interface DynamoDBSearchResults<T> {
  results: T[],
  nextStartTime?: string
}

export type DynamoDBTimedPrefixQueryFunction<T> = (minute: Minutes) => Promise<T[] | undefined>

export async function dynamodDBTimedPrefixSearch<T>(
  startTime: string,
  endTime: string | undefined,
  nearMaxResults: number,
  qf: DynamoDBTimedPrefixQueryFunction<T>,
): Promise<DynamoDBSearchResults<T>> {
  const startMinutes = new Minutes(startTime)
  const endMinutes = endTime ? new Minutes(endTime) : startMinutes.next()
  assert(startMinutes.le(endMinutes), `End time: ${endTime} preceeds start time: ${startTime}`)
  if (startMinutes.eq(endMinutes)) {
    return { results: [] }
  }

  let minutes = startMinutes
  const results: T[] = []
  do {
    const res = await qf(minutes)
    assert(res !== undefined, 'Error loading data')
    results.push(...res!)
    minutes = minutes.next()
  } while (minutes.lt(endMinutes) && results.length < nearMaxResults)

  return minutes.eq(endMinutes) ? { results } : { results, nextStartTime: minutes.toShortISOString() }
}
