// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

export function assertInteger(num: number, min?: number, max?: number, label?: string): number {
  assert(typeof num === 'number', `${label ? `${label} n` : 'N'}ot a number: ${num}`)
  assert(Math.floor(num) === num, `${label ? `${label} n` : 'N'}ot an integer: ${num}`)
  if (min !== undefined) {
    assert(min <= num, `${label ? `${label} t` : 'T'}oo small: ${num} < ${min}`)
  }
  if (max !== undefined) {
    assert(num <= max, `${label ? `${label} t` : 'T'}oo large: ${max} < ${num}`)
  }
  return num
}
