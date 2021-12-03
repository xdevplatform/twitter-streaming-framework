// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { HttpConnection, HttpConnectionError, HttpTransaction } from '..'

const con = new HttpConnection<any>('localhost', { port: 3000, activityTimeoutMs: 1000 })

con.addResponseListener(({ response }: HttpTransaction) => {
  console.log('Received response:')
  console.log(response)
  process.exit(0)
})

con.addErrorListener((error: HttpConnectionError<any>) => {
  console.error(`HTTP connection error${error.originalError ? ': ' + error.originalError : ''}`)
  process.exit(1)
})

con.addReadyListener(() => {
  console.log('Http connection ready. Sending request')
  con.GET('/wait/2000', undefined)
})
