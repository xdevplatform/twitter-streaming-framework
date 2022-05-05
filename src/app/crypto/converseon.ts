// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { request } from '../../http'
import querystring from 'querystring'
import { Obj, assert } from '../../util'

export interface ConverseonSentiment {
  value: 'positive' | 'neutral' | 'negative'
  confidence: number
}

const MAX_BATCH_SIZE = 50

export class Converseon {
  private url: string

  constructor(apiKey= '') {
    assert(/^[0-9a-f]{32}$/.test(apiKey), 'Invalid Converseon API key')
    const params: Record<string, any> = {
      apiKey,
      coreEngineId: 17,
      'annotation.emotion': false,
      'annotation.intensity': false,
      'annotation.spam': false,
      'annotation.polarity': true,
    }
    this.url = `https://conveyapi.conversus.ai/v2/process/?${querystring.stringify(params)}`
  }

  private async runSentimentBatch(texts: string[]): Promise<ConverseonSentiment[]> {
    const body: Record<string, any> = {}
    for (let i = 0; i < texts.length; i++) {
      body[`batch[${i}].id`] = i
      body[`batch[${i}].text`] = texts[i]
    }
    const raw = await request(this.url, { retry: true, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
    assert(
      typeof(raw) === 'object' && raw && raw.status && raw.status.code === 200,
      'Error sending request to Converseon',
    )
    const res = raw as Obj
    assert(Array.isArray(res.documents), 'Error in Converseon response')

    const sentiments: ConverseonSentiment[] = []
    for (const { id, annotations } of res.documents) {
      sentiments[parseInt(id)] = annotations.sentiment as ConverseonSentiment
    }
    return sentiments
  }

  public async sentiment(texts: string[]): Promise<ConverseonSentiment[]> {
    const inputs: string[][] = []
    while (MAX_BATCH_SIZE < texts.length) {
      inputs.push(texts.splice(0, MAX_BATCH_SIZE))
    }
    inputs.push(texts)

    const outputs = await Promise.all(inputs.map(input => this.runSentimentBatch(input)))
    return ([] as ConverseonSentiment[]).concat(...outputs)
  }
}
