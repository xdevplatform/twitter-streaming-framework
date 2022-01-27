// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import path from 'path'
import { pad } from './string'

export interface CommandLineOption {
  argument?: string
  description: string
  parser?: (arg: string) => any,
  required?: boolean
}

export function getCommandLineOptions(options: Record<string, string | CommandLineOption>): Record<string, any> {
  const opts: Record<string, CommandLineOption> = {}
  for (const [name, val] of Object.entries(options)) {
    opts[name] = typeof val === 'string' ? { description: val } : val
  }

  function usage(error?: string) {
    if (error) {
      console.error(error)
      console.error()
    }
    console.error('usage:', path.basename(process.argv[1]), '[options]')
    console.error()
    console.error('  Options:')
    const names = Object.keys(opts).sort()
    const keys = names.map(name => opts[name].argument === undefined ? name : `${name} <${opts[name].argument}>`)
    const width = keys.reduce((a, v) => Math.max(a, v.length), 0)
    for (let i = 0; i < names.length; i++) {
      const opt = opts[names[i]]
      console.error(`    --${pad(keys[i], -width, ' ')}  ${opt.required ? '(required) ' : ''}${opt.description}`)
    }
    console.error()
    process.exit(1)
  }

  if (process.argv.length == 2) {
    usage()
  }

  const values: Record<string, any> = {}
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    const name = arg.substring(2)
    if (!arg.startsWith('--')) {
      usage(`Option should begin with '--': ${arg}`)
    }
    if (!(name in opts)) {
      usage(`Unrecognized option: ${name}`)
    }
    const opt = opts[name]
    if (opt.argument) {
      if (i === process.argv.length - 1) {
        usage(`Option ${name} requires an argument`)
      }
      let val = process.argv[++i]
      if (opt.parser) {
        try {
          val = opt.parser(val)
        } catch (e: any) {
          usage(`Option ${name} argument error: ${e.message}`)
        }
      }
      values[name] = val
    } else {
      values[name] = true
    }
  }

  let missing = false
  for (const name of Object.keys(opts).sort()) {
    if (!(name in values) && opts[name].required) {
      console.error(`Missing required option: ${name}`)
      missing = true
    }
  }
  if (missing) {
    console.error()
    usage()
  }

  return values
}
