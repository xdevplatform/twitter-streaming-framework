// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import path from 'path'
import { pad } from './string'

export function getCommandLineOptions(options: Record<string, string>): Record<string, boolean> {
  function usage() {
    console.error('usage:', path.basename(process.argv[1]), '[options]')
    console.error()
    console.error('  Options:')
    const keys = Object.keys(options)
    const width = keys.reduce((a, v) => Math.max(a, v.length), 0)
    for (const key of keys) {
      console.error(`    --${pad(key, -width, ' ')}  ${options[key]}`)
    }
    console.error()
    process.exit(1)
  }

  const values: Record<string, boolean> = {}
  for (const arg of process.argv.slice(2)) {
    const opt = arg.substr(2)
    if (!arg.startsWith('--') || !(opt in options)) {
      usage()
    }
    values[opt] = true
  }
  return values
}
