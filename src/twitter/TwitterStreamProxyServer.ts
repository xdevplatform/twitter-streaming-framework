// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TwitterAccount } from './TwitterAccount'
import { createTwitterStreamEndpoint } from './TwitterStream'
import { TwitterBase, TwitterBaseOptions } from './TwitterBase'
import { HttpProxy, HttpServer, HttpServerOptions } from '../http'

//
// Twitter stream proxy server. Mostly used for testing diconnects.
//
export class TwitterStreamProxyServer extends TwitterBase {
  private server: HttpServer

  constructor(
    account: TwitterAccount,
    twitterOptions: TwitterBaseOptions = {},
    serverOptions: HttpServerOptions = {},
  ) {
    super(account, twitterOptions)
    const url = createTwitterStreamEndpoint(this.account, this.label)
    const proxy = new HttpProxy(url, this.account.auth)
    this.server = new HttpServer(proxy, serverOptions)
  }

  public start(): void {
    this.server.start()
  }

  public async stop(): Promise<void> {
    return this.server.stop()
  }
}
