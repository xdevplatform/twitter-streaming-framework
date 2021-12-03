// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Visua } from './visua'
import { Printer } from '../../../util'

const img = 'http://s3.visua.com/pub/test-logo.jpg'

async function measureLatency(visua: Visua): Promise<void> {

  async function perf(label:string, func: () => Promise<any>) {
    const latencies: number[] = []
    for (let i = 1000; 0 < i; i--) {
      const start = Date.now()
      await func()
      latencies.push(Date.now() - start)
      process.stdout.write(`\r${label}: ${i} `)
    }
    console.log(`\r${label}:  `)
    latencies.sort()
    const last = latencies.length - 1
    console.log('  90%:     ', latencies[Math.round(last * 0.9)])
    console.log('  99%:     ', latencies[Math.round(last * 0.99)])
    console.log('  99.9%:   ', latencies[Math.round(last * 0.999)])
    console.log('  Maximum: ', latencies[last])
    console.log('  Average: ', latencies.reduce((acc, val) => acc + val, 0) / latencies.length)
    console.log()
  }

  await perf('Start detection', () => visua.startDetection(img))
  const token = await visua.startDetection(img)
  await perf('Poll detection', () => visua.pollDetection(token))
}

async function runOneJob(visua: Visua): Promise<void> {
  console.log('Staring detection job')
  const token = await visua.startDetection(img)
  console.log('Job started:', token)
  const printer = new Printer(0)
  for (let i = 1; ; i++) {
    await new Promise(res => setTimeout(res, 1000))
    const res = await visua.pollDetection(token)
    if (res.status === 'pending') {
      if (i === 60) {
        printer.printLines(`Giving up after ${i} seconds`)
        return
      }
      printer.printLines(`Waited ${i} second${i === 1 ? '' : 's'}`)
    }
    if (res.status === 'error') {
      console.log('Error')
      return
    }
    if (res.status === 'complete') {
      printer.printLines(`Done in ${i} seconds`)
      console.log(res)
      return
    }
  }
}

async function main() {
  const visua = new Visua(
    process.env.VISUA_DEVELOPER_KEY,
    { apiEndpoint: process.env.VISUA_ENDPOINT },
  )
  await runOneJob(visua)
  // await measureLatency(visua)
  visua.close()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
