// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { pad } from './string'
import { assert, assertInteger } from './assert'

export function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

export class Minutes {
  public static readonly REGEX_STR = '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}'
  public static readonly REGEX = new RegExp(`^${Minutes.REGEX_STR}$`)

  private readonly date: Date
  public readonly minutes: number

  constructor(timestamp?: Date | number | string) {
    switch (typeof timestamp) {
      case 'number':
        assertInteger(timestamp, 0, undefined, `Invalid timestamp: ${timestamp}`)
        this.date = new Date(timestamp * 60000)
        break
      case 'object':
        assert(timestamp instanceof Date, `Invalid timestamp: ${timestamp}`)
        this.date = timestamp
        break
      case 'string':
        assert(Minutes.REGEX.test(timestamp), `Invalid timestamp: ${timestamp}`)
        this.date = new Date(`${timestamp}:00.000Z`)
        break
      case 'undefined':
        this.date = new Date()
        break
      default:
        throw new Error(`Invalid timestamp: ${timestamp}`)
    }
    this.minutes = Math.floor(this.date.getTime() / 60000)
  }

  public add(minutes: number): Minutes {
    return new Minutes(this.minutes + minutes)
  }

  public eq(other: Minutes): boolean {
    return this.minutes === other.minutes
  }

  public ge(other: Minutes): boolean {
    return this.minutes >= other.minutes
  }

  public gt(other: Minutes): boolean {
    return this.minutes > other.minutes
  }

  public le(other: Minutes): boolean {
    return this.minutes <= other.minutes
  }

  public lt(other: Minutes): boolean {
    return this.minutes < other.minutes
  }

  public ne(other: Minutes): boolean {
    return this.minutes !== other.minutes
  }

  public next(): Minutes {
    return this.add(1)
  }

  public toShortISOString(): string {
    return this.date.toISOString().substr(0, 16)
  }
}

export class Timeout {
  private timeout?: NodeJS.Timeout

  constructor(private milliseconds: number, private handler: () => void) {
    assertInteger(milliseconds, 1, 3600, 'Timer duration milliseconds')
  }

  public clear(): void {
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = undefined
    }
  }

  public reset(): void {
    this.clear()
    this.set()
  }

  public set(): void {
    if (!this.timeout) {
      this.timeout = setTimeout(this.handler, this.milliseconds)
    }
  }
}
