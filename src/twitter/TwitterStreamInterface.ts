// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Tweet } from './Tweet'
import { HttpStreamEventType } from '../http'
import { EventListener, SimpleEventListener } from '../util/event'

export interface StreamedTweet extends Tweet {
  rules: string[]
}

export type TwitterStreamEventType = HttpStreamEventType | 'tweet'

export interface TwitterStreamInterface {
  addListener(
    typeOrListener: TwitterStreamEventType | SimpleEventListener<StreamedTweet>,
    listener?: EventListener<TwitterStreamEventType, string> | SimpleEventListener<StreamedTweet>,
  ): void

  connect(): void

  disconnect(): void

  setStreamRules(newRulesRecord: Record<string, string>, force?: boolean): Promise<void>
}
