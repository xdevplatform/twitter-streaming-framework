// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

export const CONTROL_TABLE_NAME = 'twist-vsa-control'
export const TWEET_TABLE_NAME = 'twist-vsa-tweets'

export const API_MAX_RESULTS = 500
export const API_PORT = 4000
export const AWS_REGION = process.env.AWS_REGION
export const EXPECTED_IMAGE_RATE = 100
export const HEARTBEAT_INTERVAL_MS = 1000
export const PRINT_COUNTERS_INTERVAL_MS: undefined /* never */ | 0 /* immediate */ | number = 500
export const PRINT_COUNTERS_LEVEL = 'debug'

export const TWITTER_ACCOUNT = process.env.TWITTER_ACCOUNT
export const TWITTER_EMAIL = process.env.TWITTER_EMAIL
export const TWITTER_PASSWORD = process.env.TWITTER_PASSWORD
export const TWITTER_USE_FAKE_STREAM = false

export const VISUA_ACTIVITY_TIMEOUT_MS = 2000
export const VISUA_API_LATENCY_MS = 1000
export const VISUA_DETECTION_RATE = 0.05
export const VISUA_DEVELOPER_KEY = process.env.VISUA_DEVELOPER_KEY
export const VISUA_ENDPOINT = process.env.VISUA_ENDPOINT
export const VISUA_FAKE_API_DELAY = Math.round(VISUA_API_LATENCY_MS * 0.9)
export const VISUA_FAKE_JOB_TIME_SEC = 3
export const VISUA_MAX_ATTEMPTS = 3
export const VISUA_PIPELINE_DEPTH = Math.round(EXPECTED_IMAGE_RATE / 10)
export const VISUA_PIPELINED_CONNECTION_COUNT =
  Math.round(2 * EXPECTED_IMAGE_RATE * (VISUA_API_LATENCY_MS / 1000) / VISUA_PIPELINE_DEPTH)
export const VISUA_WAIT_TIME = 15000

export const BRANDS = {
  adidas: '47.10026773952',
  asics: '47.10026876714',
  columbia: '47.10043412809',
  newbalance: '47.10027577872',
  nike: '47.10026482869',
  patagonia: '47.10042735382',
  puma: '47.10024011568',
  reebok: '47.10026482134',
  underarmour: '47.10024011486',
}
