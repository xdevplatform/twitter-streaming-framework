// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

interface Array<T> {
  random(): T
  remove(element: T): Array<T>
  toDict(): Record<string, boolean>
  uniq(): Array<T>
}

Array.prototype.random = function random<T>(): T | undefined {
  return this.length === 0 ? undefined : this[Math.floor(Math.random() * this.length)]
}

Array.prototype.remove = function remove<T>(element: T): Array<T> {
  const index = this.indexOf(element)
  if (index < 0) {
    throw new Error('Array element not found')
  }
  this.splice(index, 1)
  return this
}

Array.prototype.toDict = function toDict(): Record<string, boolean> {
  return this.map(e => e.toString()).reduce((res, key)=> (res[key] = true, res), {} as Record<string, boolean>)
}

Array.prototype.uniq = function uniq<T>(): Array<T> {
  return this.filter((element: any, index: number) => index === 0 || element !== this[index - 1])
}
