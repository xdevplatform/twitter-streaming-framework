// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0
import 'dotenv/config'
import { ApiRouter } from './api'
import { ApiRouter as ApiRouterDB } from './apiDB'
import * as config from './config'
import { stream } from './streamer'
import { stream as streamDB } from './streamerDB'
import { HttpServer } from '../../http'
import { setTwitterStreamRules } from './setup'
import { counters, getCommandLineOptions } from '../../util'

async function main(): Promise<void> {
  const options = getCommandLineOptions({
    api: 'Start API server',
    apidb: 'Start API server using DynamoDB',
    backfill: 'Backfill Tweets from last heartbeat',
    stream: 'Start streaming',
    streamdb: 'Start streaming using DynamoDB',
    setup: 'Setup streaming rules and create DynamoDB tables',
  })

  if (options.setup) {
    await setTwitterStreamRules()
  }
  if (options.api) {
    console.info('Start API Server')
    counters.monitor(config.PRINT_COUNTERS_INTERVAL_MS, config.PRINT_COUNTERS_LEVEL)
    const server = new HttpServer(new ApiRouter(), { port: config.API_PORT })
    server.start()
  }
  if (options.stream) {
    console.info('Start Streaming Tweets')
    stream(options.backfill !== undefined)
  }
  if (options.apidb) {
    console.info('Start API Server using DynamoDB')
    counters.monitor(config.PRINT_COUNTERS_INTERVAL_MS, config.PRINT_COUNTERS_LEVEL)
    const server = new HttpServer(new ApiRouterDB(), { port: config.API_PORT })
    server.start()
  }
  if (options.streamdb) {
    console.info('Start Streaming Tweets using DynamoDB')
    streamDB(options.backfill !== undefined)
  }
}

if (typeof require === 'function' && require.main === module) {
  main().catch(e => { console.error(e); process.exit(1) })
}
