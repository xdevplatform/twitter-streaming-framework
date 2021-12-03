// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { assertInteger } from './assert'

export class Sequence {
  private sequence = 0

  constructor(private readonly limit = Number.MAX_SAFE_INTEGER) {
    assertInteger(limit, 1, Number.MAX_SAFE_INTEGER, 'Sequence limit')
  }

  public get next(): number {
    const seq = this.sequence
    if (++this.sequence === this.limit) {
      this.sequence = 0
    }
    return seq
  }
}
