// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ApiRouter } from './api'
import * as config from './config'
import { stream } from './streamer'
import { HttpServer } from '../../http'
import { counters, getCommandLineOptions } from '../../util'
import { createDynamoDBTables, setTwitterStreamRules } from './setup'

async function main(): Promise<void> {
  const options = getCommandLineOptions({
    api: 'Start API server',
    backfill: 'Backfill Tweets from last heartbeat',
    stream: 'Start streaming',
    setup: 'Setup streaming rules and create DynamoDB tables',
  })

  if (options.api) {
    counters.monitor(config.PRINT_COUNTERS_INTERVAL_MS, config.PRINT_COUNTERS_LEVEL)
    const server = new HttpServer(new ApiRouter(), { port: config.API_PORT })
    server.start()
  } else if (options.setup) {
    await setTwitterStreamRules()
    await createDynamoDBTables()
  } else if (options.stream) {
    stream(options.backfill)
  }
}

if (typeof require === 'function' && require.main === module) {
  main().catch(e => { console.error(e); process.exit(1) })
}
