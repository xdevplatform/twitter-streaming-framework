// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { HttpConnection, HttpConnectionError, HttpTransaction } from '..'

const con = new HttpConnection<any>('localhost', { port: 3000 })

con.addResponseListener(({ response }: HttpTransaction) => {
  console.log('Received response:')
  console.log(response)
  process.exit(0)
})

con.addErrorListener((error: HttpConnectionError<any>) => {
  console.error('Http connection error. Terminating')
  console.log(error)
  process.exit(1)
})

con.addReadyListener(() => {
  console.log('Http connection ready. Sending request')
  con.GET('/', undefined)
})
