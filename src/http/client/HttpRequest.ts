// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import http from 'http'
import https from 'https'
import { URL } from 'url'
import querystring from 'querystring'
import { Obj, sleep } from '../../util'
import { HttpMethod } from '../HttpProtocol'

const TIMEOUT_MS = 5000

const httpAgent = new http.Agent({ keepAlive: true })
const httpsAgent = new https.Agent({ keepAlive: true })

export interface HttpRequestOpts {
  body?: Obj | string
  headers?: http.OutgoingHttpHeaders
  keepalive?: boolean
  method?: HttpMethod
  query?: Obj
  retry?: boolean
  retryInitialTimeout?: number
  retryMaxAttempts?: number
  timeout?: number // 0 to disable
}

export class HttpRequestError extends Error {
  constructor(message: string, public code: number = 0, public details: string = '') {
    super(message)
  }

  public static ETIMEOUT = 900
  public static EPARSERESPONSE = 901
  public static ESENDREQUEST = 902
  // public static ECONNRESET = 903
  // public static EPIPE = 904
}

//
// A conveniece wrapper for sending request using the built in HTTP client. Unlike
// HttpConnection, this interface is not designed for massive parallel requests.
//
export async function request(url: string, opts: HttpRequestOpts = {}): Promise<Obj | string> {
  const u = new URL(url)
  const isSecure = u.protocol === 'https:'
  const qurl = url + (opts.query ? '?' + querystring.stringify(opts.query) : '')

  const options: http.RequestOptions = {
    ...(opts.method ? { method: opts.method } : {}),
    ...(opts.keepalive !== false ? { agent: isSecure ? httpsAgent : httpAgent } : {}),
    ...(opts.headers ? { headers: { ...opts.headers } } : ({} as http.OutgoingHttpHeaders))
  }

  function sendRequest(): Promise<Obj | string> {
    let encoded: Uint8Array
    if (opts.body) {
      let body: string
      const contentType = options.headers!['Content-Type'] || 'application/json'
      switch (contentType) {
        case 'application/json':
          if (typeof opts.body !== 'object') {
            throw new Error(`Expected object body for JSON request: ${opts.body}`)
          }
          body = JSON.stringify(opts.body)
          break
        case 'application/x-www-form-urlencoded':
          if (typeof opts.body !== 'object') {
            throw new Error(`Expected object body for urlencoded request: ${opts.body}`)
          }
          body = querystring.stringify(opts.body)
          break
        case 'application/octet-stream':
          if (typeof opts.body !== 'string') {
            throw new Error(`Expected string body for octet-stream request: ${opts.body}`)
          }
          body = opts.body
          break
        default:
          throw new Error(`Unsupported content type: ${contentType}`)
      }
      encoded = (new TextEncoder()).encode(body)
      options.method = options.method || 'POST'
      options.headers!['Content-Type'] = contentType
      options.headers!['Content-Length'] = encoded.length
    }

    return new Promise((resolve, reject) => {
      let code: number
      let timeout: NodeJS.Timeout | undefined

      if ((typeof opts.timeout === 'number' && 0 < opts.timeout) || opts.timeout === undefined) {
        const timeoutMs = opts.timeout || TIMEOUT_MS
        timeout = setTimeout(() => {
          timeout = undefined
          if (!code) {
            reject(new HttpRequestError(`Request timed out after ${timeoutMs} ms`, HttpRequestError.ETIMEOUT))
          }
        }, timeoutMs)
      }

      const req = (isSecure ? https : http).request(qurl, options, (res: any) => {
        const buffers: Buffer[] = []

        res.on('data', (data: Buffer) => buffers.push(data))

        res.on('end', (data: Buffer) => {
          buffers.push(data)
          if (timeout) {
            clearTimeout(timeout)
            timeout = undefined
          }
          if (!code) {
            const responseText: string = buffers.join('').trim()
            let responseBody: Obj | undefined
            if ((res.headers['content-type'] || '').startsWith('application/json')) {
              try {
                responseBody = JSON.parse(responseText)
              } catch (e: any) {
                reject(
                  new HttpRequestError('Error parsing JSON response', HttpRequestError.EPARSERESPONSE, responseText)
                )
                return
              }
            }
            if (res.statusCode < 200 || 299 < res.statusCode) {
              reject(new HttpRequestError(`API error: ${res.statusCode}`, code = res.statusCode, responseText))
            } else {
              resolve(responseBody || responseText)
            }
          }
        })
      })

      req.on('error', (error: any) => {
        if (timeout) {
          clearTimeout(timeout)
          timeout = undefined
        }
        if (!code) {
          reject(new HttpRequestError(`Error sending request: ${error}`, HttpRequestError.ESENDREQUEST))
        }
      })

      if (encoded) {
        req.write(encoded)
      }
      req.end()
    })
  }

  const retry = opts.retry || opts.retryInitialTimeout || opts.retryMaxAttempts
  let timeout = opts.retryInitialTimeout || 1000
  let attempts = opts.retryMaxAttempts || 4
  let lastError: any
  const start = Date.now()
  for (let attempt = 0; ++attempt <= attempts;) {
    try {
      const res = await sendRequest() // must await to catch
      return res
    } catch (e: any) {
      lastError = e
      if (retry && (e.code === 429 || e.code === HttpRequestError.ETIMEOUT)) {
        if (attempt < attempts) {
          await sleep(timeout)
          timeout *= 2
        }
      } else if (retry && e.code == HttpRequestError.ESENDREQUEST) {
        // retry immediately
      } else {
        throw e
      }
    }
  }

  const elapsed = Date.now() - start
  throw new HttpRequestError(
    `Request timed out after ${attempts} attempts and ${elapsed} ms (last error code was ${lastError.code})`,
    HttpRequestError.ETIMEOUT,
  )
}
