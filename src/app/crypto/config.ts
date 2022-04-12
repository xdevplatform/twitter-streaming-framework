// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

export const API_MAX_RESPONSE_SIZE = 256 * 1024
export const API_PORT = 4000
export const BATCH_INTERVAL = 60000
export const COIN_API_MAX_ATTEMPTS = 3
export const EXPECTED_TWEET_RATE = 10
export const HEARTBEAT_INTERVAL_MS = 1000
export const OBJECT_STORE_BASE_PATH = '.'
export const OBJECT_STORE_BUCKET_NAME = 'crypto'
export const PRINT_COUNTERS_INTERVAL_MS: undefined /* never */ | 0 /* immediate */ | number = 500
export const PRINT_COUNTERS_LEVEL = 'debug'

export const CONVERSEON_API_KEY = process.env.CONVERSEON_API_KEY

export const TWITTER_ACCOUNT = process.env.TWITTER_ACCOUNT
export const TWITTER_EMAIL = process.env.TWITTER_EMAIL
export const TWITTER_PASSWORD = process.env.TWITTER_PASSWORD
export const TWITTER_USE_FAKE_STREAM = false
