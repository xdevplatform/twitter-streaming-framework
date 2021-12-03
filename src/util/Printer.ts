// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { assertInteger } from './assert'

export class Printer {
  private spacer = ''
  private lineCount = 0

  constructor(spacing = 8) {
    this.setSpacing(spacing)
  }

  public printLines(...lines: string[]): void {
    process.stdout.write('\x1b[A'.repeat(this.lineCount))
    for (const line of lines) {
      console.log(line + this.spacer)
    }
    this.lineCount = lines.length
  }

  public setSpacing(spacing: number) {
    assertInteger(spacing, 0, 128, 'Spacing')
    this.spacer = ' '.repeat(spacing)
  }
}
