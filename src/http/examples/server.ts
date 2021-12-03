// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Printer } from '../../util'
import {
  HttpRouter,
  httpRouterMethod,
  HttpRouterRequest,
  HttpRouterResponse,
  HttpServer,
} from '..'

let count = 0
const printer = new Printer(4)
setInterval(() => {
  printer.printLines(`Serving ${count} requests per second`)
  count = 0
}, 1000)

class Server extends HttpRouter {
  @httpRouterMethod('POST', /^\/echo(\/(\d{1,4}))?\/?$/)
  public echo(req: HttpRouterRequest, res: HttpRouterResponse) {
    const wait = req.params![1]
    if (wait === undefined) {
      return [200, req.body]
    }
    setTimeout(() => res.respond(200, req.body), parseInt(wait))
  }

  @httpRouterMethod('GET', '/')
  public index() {
    count++
    return [200, 'Hello, HTTP!\n']
  }

  @httpRouterMethod('GET')
  public ping() {
    count++
    return [200, { oops: 'pong' }]
  }

  @httpRouterMethod('GET', /^\/wait\/(\d{1,4})\/?$/)
  public wait(req: HttpRouterRequest, res: HttpRouterResponse) {
    count++
    setTimeout(() => res.respond(200, 'Wait is over'), parseInt(req.params![0]))
  }
}

new HttpServer(new Server(), { port: 3000 }).start()
