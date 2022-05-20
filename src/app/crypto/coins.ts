// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as config from './config'
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

async function getLatestCoinToUSDRateOnce(coin: string): Promise<number> {
  //const res = await request(`https://api.coingecko.com/api/v3/coins/${coin}/tickers`)
  const response = await request(`https://nomics.com/data/currencies-ticker\?filter\=any\&interval\=1d\&quote-currency\=USD\&symbols\=BTC`)
  const res = JSON.parse(response as string);
  assert(
    typeof res === 'object' && Array.isArray(res.items) && 0 < res.items.length,
    `Empty response: ${JSON.stringify(res)}`
  )
  const price = (res as any).items.find((item : {id: string; price: string}) => item.id === 'BTC').price;

  return Math.round(Number(price))
}

export async function getLatestCoinToUSDRate(coin: string): Promise<number> {
  let error
  for (let attempts = 0; attempts < config.COIN_API_MAX_ATTEMPTS; attempts++) {
    try {
      return getLatestCoinToUSDRateOnce(coin)
    } catch (err) {
      error = err
    }
  }
  throw new Error(`Error getting coin rate: ${error}`)
}
