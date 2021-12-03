// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { HttpPromisifiedRequestPool } from '..'

async function main() {
  const pool = new HttpPromisifiedRequestPool('https://localhost:3000')
  const responses = await Promise.all([
    pool.GET('/'),
    pool.GET('/ping'),
    pool.GET('/wait/1000'),
  ])
  pool.close()
  console.log(responses)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
