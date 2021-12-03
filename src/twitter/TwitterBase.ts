// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TwitterAccount } from './TwitterAccount'

export interface TwitterBaseOptions {
  label?: string
}

export class TwitterBase {
  protected label: string

  constructor(protected account: TwitterAccount, options: TwitterBaseOptions = {}) {
    if (options.label !== undefined && typeof options.label !== 'string') {
      throw new Error(`Invalid Twitter label: ${options.label}`)
    }
    this.label = (options.label as string) || 'prod'
  }
}
