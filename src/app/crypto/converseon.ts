// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { request } from '../../http'
import querystring from 'querystring'
import { Obj, assert } from '../../util'

export interface ConverseonSentiment {
  value: string
  confidence: number
}

export class Converseon {
  constructor(private key= '') {
    assert(/^[0-9a-f]{32}$/.test(key), 'Invalid Converseon API key')
  }

  public async sentiment(texts: string[]): Promise<ConverseonSentiment[]> {
    const options: Record<string, any> = {
      apiKey: this.key,
      coreEngineId: 17,
      'annotation.emotion': false,
      'annotation.intensity': false,
      'annotation.spam': false,
      'annotation.polarity': true,
    }
    for (let i = 0; i < texts.length; i++) {
      options[`batch[${i}].id`] = i
      options[`batch[${i}].text`] = texts[i]
    }
    const res = await request(
      `https://conveyapi.conversus.ai/v2/process/?${querystring.stringify(options)}`,
      { method: 'POST' },
    ) as Obj
    assert(res && res.status && res.status.code === 200, 'Error sending request to Conversoen')
    assert(Array.isArray(res.documents), 'Error in Converseon response')

    const sentiments: ConverseonSentiment[] = []
    for (const { id, annotations } of res.documents) {
      sentiments[parseInt(id)] = annotations.sentiment as ConverseonSentiment
    }
    return sentiments
  }
}
