// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { URL } from 'url'
import { Agent } from 'https'

export interface HttpEndpointOptions {
  rejectUnauthorized?: boolean
}

export class HttpEndpoint {
  public readonly agent?: Agent

  constructor(public readonly url: string, options: HttpEndpointOptions = {}) {
    if (typeof url !== 'string') {
      throw new Error(`HTTP URL must be a string: ${url}`)
    }
    const u = new URL(url)
    if (u.protocol !== 'https:' || !u.hostname) {
      throw new Error(`Invalid HTTPS URL: ${url}`)
    }

    if (options.rejectUnauthorized === false) {
      this.agent = new Agent({
        host: u.hostname,
        port: parseInt(u.port || '443'),
        path: '/',
        rejectUnauthorized: false,
      })
    }
  }
}
