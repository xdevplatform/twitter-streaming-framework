// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import '../util/array'
import querystring from 'querystring'
import { assert, assertInteger, counters, sleep } from '../../../util'
import { HttpPromisifiedRequestPool, HttpRequestPoolOptions } from '../../../http'

export interface VisuaOptions extends HttpRequestPoolOptions {
  apiEndpoint?: string
  waitTimeForDetectionMs?: number
}

export interface VisuaDetectionResult {
  hash: string
  status: 'complete' | 'error' | 'pending'
  size?: { width: number, height: number }
  logos?: string[]
}

export class Visua {
  private pool: HttpPromisifiedRequestPool
  private waitTimeForDetectionMs: number

  constructor(developerKey?: string, options: VisuaOptions = {}) {
    assert(typeof developerKey !== 'string' || /^[\da-z]+$/.test(developerKey), `Invalid key: ${developerKey}`)
    const { apiEndpoint, waitTimeForDetectionMs, ...originalRequestPoolOptions } = options

    this.waitTimeForDetectionMs = waitTimeForDetectionMs || 30000
    assertInteger(this.waitTimeForDetectionMs, 0, 120000, 'Wait time for detetion')

    const requestPoolOptions = {
      ...originalRequestPoolOptions,
      defaultRequestHeaders: {
        ...(originalRequestPoolOptions.defaultRequestHeaders || {}),
        'X-DEVELOPER-KEY': developerKey!,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
    this.pool = new HttpPromisifiedRequestPool(apiEndpoint || 'https://api.visua.com', requestPoolOptions)
  }

  public close(): void {
    this.pool.close()
  }

  public async detectLogosInImage(url: string): Promise<VisuaDetectionResult> {
    counters.debug.Visua.activeDetections.inc()
    const token = await this.startDetection(url)
    counters.debug.Visua.activeDetections.dec()

    counters.debug.Visua.activeWaits.inc()
    await sleep(this.waitTimeForDetectionMs)
    counters.debug.Visua.activeWaits.dec()

    counters.debug.Visua.activePolls.inc()
    const res = await this.pollDetection(token)
    counters.debug.Visua.activePolls.dec()

    if (res.status === 'pending') {
      counters.warn.Visua.detectionPending.inc()
    } else if (res.status === 'complete') {
      counters.debug.Visua.detectionComplete.inc()
    }
    return res
  }

  public async pollDetection(hash: string): Promise<VisuaDetectionResult> {
    const res = await this.pool.GET(`/detect/${hash}/response`)
    counters.debug.Visua.pollLatencyAvg.avg(res.elapsed)
    counters.debug.Visua.pollLatencyMax.max(res.elapsed)
    const body = res.response?.responseBody
    if (!body) {
      counters.error.Visua.connectionError.inc()
      return { hash, status: 'error' }
    }
    if (typeof body.errorMessage === 'string' && body.errorMessage.startsWith('Processing still in progress:')) {
      return { hash, status: 'pending' }
    }
    if (body.errorMessage || !body.data) {
      counters.error.Visua.detectionError.inc()
      return { hash, status: 'error' }
    }
    const logos = body.data.detections
      .filter((det: any) => det.type === 'logo')
      .map((det: any) => det.name.toLowerCase())
      .sort()
      .uniq()
    return { hash, status: 'complete', logos, size: body.data.mediaInfo }
    }

  public async startDetection(url: string): Promise<string> {
    const res = await this.pool.POST('/detect', querystring.stringify({ mediaUrl: url }))
    counters.debug.Visua.detectLatencyAvg.avg(res.elapsed)
    counters.debug.Visua.detectLatencyMax.max(res.elapsed)
    return res.response?.responseBody?.data.requestHash
  }
}
