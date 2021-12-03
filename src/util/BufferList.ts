// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

export class BufferList {
  private readonly buffers: Buffer[]
  private _length: number

  constructor(other?: BufferList) {
    this.buffers = other ? other.buffers : []
    this._length = other ? other._length : 0
  }

  public append(buffer: Buffer): void {
    this.buffers.push(buffer)
    this._length += buffer.length
  }

  public appendList(other: BufferList): void {
    for (const buffer of other.buffers) {
      this.append(buffer)
    }
  }

  public get length(): number {
    return this._length
  }

  public toBuffer(): Buffer {
    return Buffer.concat(this.buffers)
  }

  public toString(encoding: BufferEncoding = 'utf-8'): string {
    return this.toBuffer().toString(encoding)
  }
}
