// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

export * from './file'
export * from './time'
export * from './assert'
export * from './cursor'
export * from './string'
export * from './command'
export * from './Printer'
export * from './counters'
export * from './Sequence'
export * from './BufferList'
export * as event from './event'

export type Obj = Record<string, any>

export function safe<T>(func: () => T): T | undefined {
  try {
    return func()
  } catch {}
}
