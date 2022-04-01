// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { promises as fs } from 'fs'
import { Obj, exists } from '../util'
import { Tabular, TabularOptions } from './Tabular'

export class CsvFile extends Tabular {
  constructor(private readonly filename: string, fields: string[], options: TabularOptions = {}) {
    super(fields, options)
  }

  private record(values: Obj): string {
    this.validate(values)
    return this.originalFieldNames.map(field => this.escape(values[field])).join(',')
  }

  protected escape(value: any): string {
    if (value === undefined && this.allowEmptyFields) {
      return ''
    }
    const str = String(value).trim()
    return str.includes('"') || str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str
  }

  protected transformFieldName(originalFieldName: string): string {
    return this.escape(originalFieldName)
  }

  public async close(): Promise<void> {
  }

  public async open(): Promise<void> {
    if (!(await exists(this.filename))) {
      await fs.writeFile(this.filename, this.transformedFieldNames.join(',') + '\n')
    }
  }

  public async appendOne(values: Obj): Promise<void> {
    await fs.appendFile(this.filename, this.record(values) + '\n')
  }

  public async appendArray(valuesArray: Obj[]): Promise<void> {
    await fs.appendFile(this.filename, valuesArray.map(values => this.record(values)).join('\n') + '\n')
  }
}
