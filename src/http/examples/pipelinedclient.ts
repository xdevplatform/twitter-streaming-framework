// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { pad } from '../../util'
import { HttpConnection, HttpConnectionError, HttpTransaction } from '..'

const con = new HttpConnection<any>(
  'https://localhost:3000',
  { defaultRequestHeaders: { 'content-type': 'text/plain' } },
)

con.addErrorListener((error: HttpConnectionError<any>) => {
  console.error('Http connection error. Terminating')
  console.log(error)
  process.exit(1)
})

let count = 10

con.addResponseListener((tx: HttpTransaction) => {
  console.log('Received response:', tx.request.body, '=>', tx.response.responseText)
  if (--count === 0) {
    process.exit(0)
  }
})

con.addReadyListener(() => {
  console.log('Http connection ready. Sending requests:')
  for (let i = 0; i < count; i++) {
    const req = pad(i, 2, '0')
    console.log('Sending request:', req)
    con.POST('/echo/3000', undefined, req)
  }
  console.log()
})
