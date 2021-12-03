// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { testClear } from '../../util/test'

const tests: Record<string, boolean> | undefined =
  typeof process.env.TESTS === 'string'
    ? process.env.TESTS.split(',').reduce(
        (obj: Record<string, boolean>, str: string) => { obj[str] = true; return obj },
        {},
      )
    : undefined

async function run(name: string) {
  if (!tests || tests[name]) {
    console.log(`\n\x1b[35m***** Starting test: ${name} *****\x1b[0m\n`)
    testClear()
    const { main } = require('./' + name)
    await main()
  }
}

;(async () => {

  await run('disconnect')
  await run('messagedrop')
  await run('streamerror')
  await run('streamtimeout')

})().catch(e => {
  console.error(e)
  console.error(JSON.stringify(e))
  process.exit(1)
})
