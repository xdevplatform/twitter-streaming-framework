// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Obj } from '.'

let tests: Record<string, boolean> = {}

type Handler = () => void

function generateTest(tester: (name: string) => (...args: any[]) => any): Obj {
  return new Proxy({}, {
    get: (target: any, name: string) => tester(name)
  })
}

let testAfterCounters: Record<string, Record<string, number>> = {}

export const testAfter = generateTest((name: string) =>
  (tag: string, threshold: number, handler: Handler) => {
    if (tests[name]) {
      if (!testAfterCounters[name]) {
        testAfterCounters[name] = {}
      }
      if (testAfterCounters[name][tag] === undefined) {
        testAfterCounters[name][tag] = 0
      }
      if (threshold < ++testAfterCounters[name][tag]) {
        return handler()
      }
    }
  }
)

let testOnceFlags: Record<string, boolean> = {}

export const testOnce = generateTest((name: string) =>
  (handler: Handler) => {
    if (tests[name] && !testOnceFlags[name]) {
      testOnceFlags[name] = true
      return handler()
    }
  }
)

export const testRun = generateTest((name: string) =>
  (handler: Handler) => {
    if (tests[name]) {
      return handler()
    }
  }
)

export function testClear() {
  tests = {}
  testAfterCounters = {}
  testOnceFlags = {}
}

export function testSet(name: string, enable = true) {
  tests[name] = enable
}
