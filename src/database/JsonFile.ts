// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { promises as fs } from 'fs'
import { Obj, exists } from '../util'

export class JsonFile {
  constructor(private readonly filename: string) {
  }

  private record(values: Obj): string {
    return JSON.stringify(values, null, '  ')
  }

  public async close(): Promise<void> {
    await fs.appendFile(this.filename, '\n]')
  }

  public async open(): Promise<void> {
    if (!(await exists(this.filename))) {
      await fs.writeFile(this.filename, '[\n')
    }
  }

  public async appendOne(values: Obj): Promise<void> {
    const size = (await fs.stat(this.filename)).size
    const prefix = 2 < size ? ',\n' : ''
    await fs.appendFile(this.filename, prefix + this.record(values))
  }

  public async appendArray(valuesArray: Obj[]): Promise<void> {
    await fs.appendFile(this.filename, valuesArray.map(values => this.record(values)).join(',\n'))
  }
}
