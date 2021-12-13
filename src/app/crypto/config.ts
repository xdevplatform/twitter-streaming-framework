// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

export const CONTROL_TABLE_NAME = 'twist-crypto-control'
export const TRENDS_TABLE_NAME = 'twist-crypto-trends'
export const TWEET_TABLE_NAME = 'twist-crypto-tweets'
export const TWEET_TABLE_TTL = 7 * 24

export const API_MAX_RESULTS = 500
export const API_PORT = 4000
export const AWS_REGION = process.env.AWS_REGION
export const AWS_DYNAMODB_ENDPOINT = process.env.AWS_DYNAMODB_ENDPOINT
export const EXPECTED_TWEET_RATE = 10
export const HEARTBEAT_INTERVAL_MS = 1000
export const PRINT_COUNTERS_INTERVAL_MS: undefined /* never */ | 0 /* immediate */ | number = 500
export const PRINT_COUNTERS_LEVEL = 'debug'
export const TREND_INTERVAL = 60000

export const TWITTER_ACCOUNT = process.env.TWITTER_ACCOUNT
export const TWITTER_EMAIL = process.env.TWITTER_EMAIL
export const TWITTER_PASSWORD = process.env.TWITTER_PASSWORD
export const TWITTER_USE_FAKE_STREAM = false
