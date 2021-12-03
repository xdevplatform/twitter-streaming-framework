// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

const emailRegex = new RegExp(
  '(?:[a-z0-9!#$%&\'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&\'*+/=?^_`{|}~-]+)*|"(?:' +
  '[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]|\\\\[\\x01-' +
  '\\x09\\x0b\\x0c\\x0e-\\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+' +
  '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|' +
  '[1-9]?[0-9]))\\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|' +
  '[a-z0-9-]*[a-z0-9]:(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21-\\x5a\\x53-\\x7f]' +
  '|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])+)\\])'
)

//
// Twitter v1.1 account information.
//
export class TwitterAccount {
  private _auth: { Authorization: string }
  private _name: string

  constructor(account?: string, email?: string, password?: string) {
    if (typeof account !== 'string' || account.trim().length === 0) {
      throw new Error(`Invalid Twitter account: ${account}`)
    }
    if (typeof email !== 'string' || !emailRegex.test(email)) {
      throw new Error(`Invalid email: ${email}`)
    }
    if (typeof password !== 'string' || password.trim().length === 0) {
      throw new Error(`Invalid Twitter password: ${password}`)
    }

    this._auth = { Authorization: `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}` }
    this._name = account
  }

  public get auth(): { Authorization: string } {
    return this._auth
  }

  public get name(): string {
    return this._name
  }
}
