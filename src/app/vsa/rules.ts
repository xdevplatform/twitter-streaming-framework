// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'

export function createStreamRules(): Record<string, string> {
  const rules: Record<string, string> = { images: 'has:images -is:retweet' }
  for (const [brand, context] of Object.entries(config.BRANDS)) {
    rules[`@${brand}`] = `context:${context} -is:retweet`
  }
  return rules
}

export function createStreamProbabilities(): Record<string, number> {
  const rules: Record<string, number> = { images: Math.round(3 / config.VISUA_DETECTION_RATE) }
  for (const [brand, context] of Object.entries(config.BRANDS)) {
    rules[`@${brand}`] = 1
  }
  return rules
}
