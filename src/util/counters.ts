// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Printer } from './Printer'
import { assertInteger } from './assert'
import { SimpleEventDispatcher, SimpleEventListener } from './event'

class CountersEvent {
  constructor(public readonly name: string, public readonly op: string, public readonly value: number) {
  }
}

const dispatcher = new SimpleEventDispatcher<CountersEvent>()

class AveragingWindow {
  private readonly samples: { value: number, time: number }[] = []
  private sum = 0

  constructor(private readonly span = 1000) {
  }

  public append(value: number): number {
    const time = Date.now()
    this.samples.push({ value, time })
    this.sum += value
    const expired = time - this.span
    while (this.samples[0].time < expired) {
      this.sum -= this.samples[0].value
      this.samples.shift()
    }
    return Math.round(this.sum / this.samples.length)
  }
}

class Counter {
  public value = 0
  private window?: AveragingWindow

  constructor(public readonly group: string, public readonly name: string, public readonly level: number) {
  }

  private update(op: string, value: number): number {
    this.value = value
    dispatcher.fire(new CountersEvent(this.name, op, this.value))
    return this.value
  }

  public avg(value: number) {
    if (!this.window) {
      this.window = new AveragingWindow()
    }
    return this.update('avg', this.window.append(value))
  }

  public dec(delta = 1): number {
    return this.update('dec', this.value - delta)
  }

  public inc(delta = 1): number {
    return this.update('inc', this.value + delta)
  }

  public min(value: number): number {
    return this.update('min', Math.min(this.value, value))
  }

  public max(value: number): number {
    return this.update('max', Math.max(this.value, value))
  }

  public set(value: number): number {
    return this.update('set', value)
  }
}

const values: Record<string, Counter> = {}
const groups: Record<string, any> = {}
const printer = new Printer(4)
const keys: string[] = []

const LINE = ['\x1b[38;5;240m', '\x1b[38;5;7m', '\x1b[38;5;214m', '\x1b[31m']
const VALUE = ['', '\x1b[33m', '', '']

const DEBUG = 0
const INFO = 1
const WARN = 2
const ERROR = 3

export type CountersLevel = 'debug' | 'info' | 'warn' | 'error'
const LEVELS = { 'debug': DEBUG, 'info': INFO, 'warn': WARN, 'error': ERROR }
const PREFIX = ['DEBUG', 'INFO ', 'WARN ', 'ERROR']

function createGroup(group: string, level: number) {
  return new Proxy({}, {
    get: (target: any, name: string) => {
      const fn = `${group}.${name}`
      if (!values[fn]) {
        const nm = name.toLocaleLowerCase()
        values[fn] = new Counter(group, name, level)
        keys.push(fn)
        keys.sort()
        const lengths = keys.map(key => key.length)
        printer.setSpacing(4 + Math.max(...lengths) - Math.min(...lengths))
      }
      return values[fn]
    }
  })
}

function createProxy(level: number) {
  return new Proxy({}, {
    get: (target: any, key: string) => {
      const g = `${key}.${level}`
      if (!groups[g]) {
        groups[g] = createGroup(key, level)
      }
      return groups[g]
    },
  })
}

class Counters {
  public readonly debug = createProxy(DEBUG)
  public readonly info = createProxy(INFO)
  public readonly warn = createProxy(WARN)
  public readonly error = createProxy(ERROR)

  public addUpdateListener(listener: SimpleEventListener<CountersEvent>) {
    dispatcher.addListener(listener)
  }

  public monitor(interval: undefined /* never */ | 0 /* immediate */ | number, level: CountersLevel = 'info'): void {
    if (interval === undefined) {
      return
    }
    process.stdout.write('\x1b[?25l') // hide cursor

    if (interval === 0) {
      counters.addUpdateListener(() => this.print(level))
    } else {
      assertInteger(interval, 1, undefined, `Invalid interval: ${interval}`)
      setInterval(() => this.print(level), interval)
    }
    function onExit() {
      process.stdout.write('\x1b[?25h\n') // show cursor
      process.exit(0)
    }
    process.on('exit', onExit)
    process.on('SIGINT', onExit)
    process.on('SIGTERM', onExit)
  }

  public print(levelName: CountersLevel = 'info'): void {
    const lines = keys
      .filter(key => LEVELS[levelName] <= values[key].level)
      .map(key => {
        const val = values[key]
        const level = val.level
        return `${LINE[level]}${PREFIX[level]} ${val.group}.${val.name}: ${VALUE[level]}${val.value}\x1b[0m`
      })
    if (0 < lines.length) {
      printer.printLines(...lines)
    }
  }
}

export const counters = new Counters()
