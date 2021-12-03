// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Printer } from '../../util'
import { HttpRequestPool, HttpRequestPoolResponse } from '..'

const CONNECTION_COUNT = 10
const SERVER_LATENCY_MS = 43

const pool = new HttpRequestPool<any>('https://localhost:3000', { connectionCount: CONNECTION_COUNT })

let count = 0
const printer = new Printer(4)

setInterval(() => {
  printer.printLines(
    `Active connections: ${pool.getConnectionsCount()}`,
    `Requests in flight: ${pool.getInflightCount()}`,
    `Requests per second: ${count}`,
  )
  count = 0
}, 1000)

const sendRequest = () => pool.GET(`/wait/${SERVER_LATENCY_MS}`, undefined)

pool.addResponseListener(({ response }: HttpRequestPoolResponse<any>) => {
  if (!response) {
    console.error('Disconnected')
    process.exit(1)
  }
  if (response.statusCode !== 200) {
    console.error('Server error:', response.statusCode, response.statusText)
    process.exit(1)
  }
  count++
  sendRequest()
})

console.log(`Sending ${CONNECTION_COUNT} concurrent requests, each with ${SERVER_LATENCY_MS}ms added latency`)
for (let i = 0; i < CONNECTION_COUNT; i++) {
  sendRequest()
}
