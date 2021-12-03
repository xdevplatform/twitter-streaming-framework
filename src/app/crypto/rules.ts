// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

export function createStreamRules(): Record<string, string> {
  const rules: Record<string, string> = { bitcoin: '(bitcoin OR btc) -cash -is:retweet' }
  return rules
}

export function createStreamProbabilities(): Record<string, number> {
  return { bitcoin: 1 }
}
