// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import http from 'http'
import querystring from 'querystring'
import { HttpMethod } from '../HttpProtocol'
import { HttpServerHandler } from './HttpServer'

//
// Experimantal TypeScript decorator for handler methods. See examples/server.ts
//
export function httpRouterMethod(method: HttpMethod, filter?: RegExp | string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    descriptor.value.method = method
    descriptor.value.filter = filter === undefined ? '/' + propertyKey : filter
  }
}

export type HttpRouterRequestBody = Record<string, any> | string | undefined

export interface HttpRouterRequest extends http.IncomingMessage {
  body: HttpRouterRequestBody
  params?: string[]
  query?: Record<string, string>
}

export interface HttpRouterResponse extends http.ServerResponse {
  respond(statusCode: number, responseBody: any): void
}

export interface HttpRouterOptions {
  cors?: boolean
}

//
// This class servers as a handler for HttpServer requests and routes different
// requests to different handler methods. In order to do this, it uses attributes
// attached to each method.
//
// The easiest way to get those in place, is to extend this class and use the
// httpRouterMethod function above as an experimental TypeScript decorator to
// each handler method. See examples/server.ts
//
export abstract class HttpRouter implements HttpServerHandler {
  private routes: { filter: RegExp | string, funcname: string, method: string }[] = []

  constructor(private readonly options: HttpRouterOptions = {}) {
    const funcnames = Object.getOwnPropertyNames(this.constructor.prototype)
    for (const funcname of funcnames) {
      const func = (this as any)[funcname]
      if (func.method && func.filter) {
        this.routes.push({ filter: func.filter, funcname, method: func.method })
      }
    }
  }

  private resolve(method: string, path: string): { funcname: string, params?: string[] } | undefined {
    for (const route of this.routes) {
      if (route.method !== method) {
        continue
      }
      if (typeof route.filter === 'string' && route.filter === path) {
        return { funcname: route.funcname }
      }
      if (route.filter instanceof RegExp) {
        const match = path.match(route.filter)
        if (match) {
          return { funcname: route.funcname, params: match.slice(1) }
        }
      }
    }
  }

  public onRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const responseHeaders = this.options.cors
      ? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': '*' }
      : {}

    const buffers: Buffer[] = []
    req.on('data', buffer => buffers.push(buffer))

    req.on('end', async () => {
      let body: HttpRouterRequestBody
      if (buffers.length) {
        const str = Buffer.concat(buffers).toString('utf-8')
        const contentType = req.headers['content-type'] || 'application/octet-stream'
        if (contentType === 'application/json') {
          body = JSON.parse(str)
        } else if (contentType === 'application/x-www-form-urlencoded') {
          body = querystring.parse(str)
        } else {
          body = str
        }
      }

      function respond(statusCode: number, responseBody: any): void {
        res.statusCode = statusCode
        const isJSON = typeof responseBody === 'object'
        res.setHeader('Content-Type', isJSON ? 'application/json' : 'text/plain')
        for (const [key, value] of Object.entries(responseHeaders)) {
          res.setHeader(key, value)
        }
        res.end(isJSON ? JSON.stringify(responseBody) : String(responseBody))
      }

      const parts = req.url?.split('?')
      if (!Array.isArray(parts) || parts.length < 1 || 2 < parts.length) {
        return respond(404, 'Not Found')
      }

      const match = this.resolve(req.method!, parts[0])
      if (!match) {
        return respond(404, 'Not Found')
      }

      const query = parts.length === 2 ? querystring.parse(parts[1]) : undefined

      try {
        const ret = (this as any)[match.funcname]({ ...req, body, params: match.params, query }, { ...res, respond })
        const out = ret instanceof Promise ? await ret : ret
        if (Array.isArray(out) && out.length === 2 && typeof out[0] === 'number') {
          respond(out[0], out[1])
        }
      } catch (e) {
        console.error(e)
        return respond(500, 'Internal Server Error')
      }
    })
  }
}
