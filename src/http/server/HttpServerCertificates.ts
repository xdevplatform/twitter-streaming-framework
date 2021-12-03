// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import fs from 'fs'

export interface HttpServerCertificatesOptions {

  // Raw key
  key?: Buffer | string

  // Key file name, see examples/example-key.pem
  keyfile?: string

  // Raw certificate
  cert?: Buffer | string

  // Certificate file name, see examples/example-cert.pem
  certfile?: string
}

export class HttpServerCertificates {
  public readonly key: Buffer
  public readonly cert: Buffer

  constructor(options: HttpServerCertificatesOptions) {
    this.key = this.load('key', options.key, options.keyfile, 'RSA PRIVATE KEY', 24)
    this.cert = this.load('certificate', options.cert, options.certfile, 'CERTIFICATE', 15)
  }

  private load(
    name: string,
    value: Buffer | string | undefined,
    file: string | undefined,
    head: string,
    lines: number,
  ): Buffer {
    if (value === undefined && file === undefined) {
      throw new Error(`Neither ${name} value or ${name} file specified`)
    }
    if (value !== undefined && file !== undefined) {
      throw new Error(`Both ${name} value and ${name} file specified. Can't decide which one to use`)
    }

    const val: string = value === undefined
      ? fs.readFileSync(file!, 'utf-8')
      : typeof value === 'object'
        ? value.toString('utf-8')
        : value.replace(/\n\s*/g, '\n')

    const regex = new RegExp(
      `^\\n?-----BEGIN ${head}-----\\n([\\w\\+\\/]{64}\\n){${
      lines}}[\\w\\+\\/]{48,62}=?=?\\n-----END ${head}-----\\n?$`
    )
    if (!regex.test(val)) {
      throw new Error(`Invalid ${name}`)
    }

    return Buffer.from(val)
  }
}
