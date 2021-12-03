// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import '../util/array'
import * as config from '../config'
import { Obj, Printer, Sequence, pad } from '../../../util'
import { HttpRouter, httpRouterMethod, HttpRouterRequest, HttpRouterResponse, HttpServer } from '../../../http'

class FakeVisuaBackend {
  private sequence = new Sequence(10000)
  private detetionCompletionTimes: Record<string, number> = {}

  private detectLogos() {
    return config.VISUA_DETECTION_RATE <= Math.random()
      ? []
      : [ { type: 'logo', name: Object.keys(config.BRANDS).random() } ]
  }

  public startDetection(url: string): Obj {
    const hash = pad(this.sequence.next, 4, '0')
    this.detetionCompletionTimes[hash] = Date.now() + 1000 * config.VISUA_FAKE_JOB_TIME_SEC
    return { data: { requestHash: hash } }
  }

  public pollDetection(hash: string): Obj | undefined {
    const completionTime = this.detetionCompletionTimes[hash]
    if (completionTime === undefined) {
      return
    }
    const isComplete = completionTime <= Date.now()
    return isComplete
      ? { data: { mediaInfo: { width: 400, height: 300 }, detections: this.detectLogos() } }
      : { errorMessage: 'Processing still in progress:' }
  }
}

class FakeVisuaServer extends HttpRouter {
  private readonly visua = new FakeVisuaBackend()
  private readonly printer = new Printer()
  private startDetectionRequests = 0
  private pollDetectionRequests = 0

  constructor() {
    super()
    setInterval(() => this.onInterval(), 1000)
  }

  private onInterval() {
    this.printer.printLines(
      `Detection requests per second: \x1b[33m${this.startDetectionRequests}\x1b[0m`,
      `Poll requests per second: \x1b[33m${this.pollDetectionRequests}\x1b[0m`,
    )
    this.startDetectionRequests = 0
    this.pollDetectionRequests = 0
  }

  @httpRouterMethod('POST', '/detect')
  public startDetection(req: HttpRouterRequest, res: HttpRouterResponse) {
    this.startDetectionRequests += 1
    if (typeof req.body !== 'object' || typeof req.body.mediaUrl !== 'string') {
      return [400, 'No media URL']
    }
    const body = this.visua.startDetection(req.body.mediaUrl)
    setTimeout(() => res.respond(200, body), config.VISUA_FAKE_API_DELAY)
  }

  @httpRouterMethod('GET', /^\/detect\/(\w+)\/response\/?$/)
  public pollDetection(req: HttpRouterRequest, res: HttpRouterResponse) {
    this.pollDetectionRequests += 1
    const hash = req.params![0]
    const status = this.visua.pollDetection(hash)
    if (status === undefined) {
      return [404, `Invalid detection hash: ${hash}`]
    }
    setTimeout(() => res.respond(200, status), config.VISUA_FAKE_API_DELAY)
  }
}

new HttpServer(new FakeVisuaServer(), { port: 3000 }).start()
