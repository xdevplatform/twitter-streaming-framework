// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { HttpHeaders, HttpRequest, HttpResponse } from '../HttpProtocol'
import { HttpRequestPool, HttpRequestPoolOptions, HttpRequestPoolResponse } from './HttpRequestPool'

export interface HttpPromisifiedRequestPoolResponse {
  attempts: number
  elapsed: number
  request: HttpRequest
  response?: HttpResponse
}

type Resolver = (value: any) => void

export class HttpPromisifiedRequestPool {
  private pool: HttpRequestPool<Resolver>

  constructor(public readonly host: string, options: HttpRequestPoolOptions = {}) {
    this.pool = new HttpRequestPool<Resolver>(host, options)
    this.pool.addResponseListener(({ userp, ...rest }: HttpRequestPoolResponse<Resolver>) => userp(rest))
  }

  public close(): void {
    this.pool.close()
  }

  public async request(httpRequest: HttpRequest): Promise<HttpPromisifiedRequestPoolResponse> {
    return new Promise(resolve => this.pool.request({ ...httpRequest, userp: resolve }))
  }

  public GET(path: string, headers?: HttpHeaders): Promise<HttpPromisifiedRequestPoolResponse> {
    return this.request({ method: 'GET', path, headers })
  }

  public POST(path: string, body?: string, headers?: HttpHeaders): Promise<HttpPromisifiedRequestPoolResponse> {
    return this.request({ method: 'POST', path, headers, body })
  }
}
