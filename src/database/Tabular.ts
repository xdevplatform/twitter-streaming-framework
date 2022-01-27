// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Obj, assert } from '../util'

export interface TabularOptions {
  allowEmptyFields?: boolean
  ignoreUnrecognizedFields?: boolean
}

export abstract class Tabular {
  protected readonly allowEmptyFields: boolean
  protected readonly ignoreUnrecognizedFields: boolean
  protected readonly fieldCount: number
  protected readonly originalFieldNames: string[] = []
  protected readonly transformedFieldNames: string[] = []
  protected readonly fieldRecord: Record<string, true> = {}

  constructor(fields: string[], options: TabularOptions = {}) {
    this.allowEmptyFields = options.allowEmptyFields === false ? false : true
    this.ignoreUnrecognizedFields = options.ignoreUnrecognizedFields === false ? false : true
    this.fieldCount = fields.length
    assert(0 < this.fieldCount, 'No fields')
    for (const originalFieldName of fields) {
      const transformedFieldName = this.transformFieldName(originalFieldName)
      assert(this.fieldRecord[originalFieldName] === undefined, `Duplicate field: ${originalFieldName}`)
      this.fieldRecord[originalFieldName] = true
      this.originalFieldNames.push(originalFieldName)
      this.transformedFieldNames.push(transformedFieldName)
    }
  }

  protected isValid(values: Obj): string | undefined {
    let matches = 0
    for (const field of Object.keys(values)) {
      if (field in this.fieldRecord) {
        matches++
      } else if (!this.ignoreUnrecognizedFields) {
        return `Unrecognized field: ${field}`
      }
    }
    if (matches < this.fieldCount && !this.allowEmptyFields) {
      return 'Empty fields'
    }
  }

  protected transformFieldName(originalFieldName: string): string {
    return originalFieldName
  }

  protected validate(values: Obj): void {
    const error = this.isValid(values)
    assert(error === undefined, error!)
  }

  public abstract appendOne(values: Obj): Promise<void>

  public abstract appendArray(valuesArray: Obj[]): Promise<void>
}
