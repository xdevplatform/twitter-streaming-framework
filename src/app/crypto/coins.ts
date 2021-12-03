// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { assert } from '../../util'
import { request } from '../../http'

interface Ticker {
  converted_last?: {
    usd?: number
  }
  converted_volume?: {
    usd?: number
  }
  trust_score?: string
}

interface Transaction {
  usd: number
  volume: number
}

export async function getLatestCoinToUSDRate(coin: 'bitcoin'): Promise<number> {
  const res = await request(`https://api.coingecko.com/api/v3/coins/${coin}/tickers`)
  assert(
    typeof res === 'object' && Array.isArray(res.tickers) && 0 < res.tickers.length,
    `Empty coingecko response: ${JSON.stringify(res)}`
  )

  const tickers = (res as any).tickers as Ticker[]
  const txs: Transaction[] = tickers
    .filter(t =>
      t.converted_last !== undefined &&
      t.converted_last.usd !== undefined &&
      t.converted_volume !== undefined &&
      t.converted_volume.usd !== undefined &&
      t.trust_score === 'green'
    )
    .map(t => ({ usd: t.converted_last!.usd!, volume: t.converted_volume!.usd! }))
  assert(0 < txs.length, `No trusted rates in coingecko response: ${JSON.stringify(res)}`)

  const sum = txs.reduce((a, v) => a + v.usd * v.volume, 0)
  const vol = txs.reduce((a, v) => a + v.volume, 0)
  return Math.round(sum / vol)
}
