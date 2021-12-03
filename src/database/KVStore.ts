// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Obj } from '../util'

export interface KVStore {
  get(key: string): Promise<Obj | undefined>
  set(key: string, value: Obj): Promise<void>
}
