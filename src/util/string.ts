// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

export function pad(content: any, length: number, chr: string): string {
  const str = String(content)
  const spaces = chr.substr(0, 1).repeat(Math.max(0, Math.abs(Math.round(length)) - str.length))
  return length < 0 ? str + spaces : spaces + str
}

export function splitOnce(str: string, delimiter: string): [string, string] | undefined {
  const index = str.indexOf(delimiter)
  return 0 <= index ? [str.substr(0, index), str.substr(index + delimiter.length)] : undefined
}
