/**
 * Treasury snapshot suite (isolated test database; injected chain reader,
 * no network). Verifies exact valuation, unpriced/stale price handling and
 * that a failed read keeps the last good snapshot flagged stale.
 * Run: DATABASE_URL=postgresql://localhost:5432/openfund_economy_test node --test test/treasury.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import pg from 'pg'
import { Treasury, treasuryConfig } from '../treasury.js'

const url = process.env.DATABASE_URL || ''
const pool = /(?:^|[_-])(test|audit|ci)(?:$|[_-])/.test(url.split('/').pop() || '') ? new pg.Pool({ connectionString: url }) : null
test.after(() => pool?.end())

const address = '0x' + crypto.randomBytes(20).toString('hex')
const USDC = '0x' + 'a'.repeat(40), FEED_ETH = '0x' + 'b'.repeat(40), FEED_USDC = '0x' + 'c'.repeat(40)
const env = { TREASURY_WALLET_ADDRESS: address, TREASURY_CHAIN_ID: '42161', TREASURY_REFRESH_MINUTES: '500',
  TREASURY_ASSETS: JSON.stringify([{ symbol: 'ETH', address: 'native', decimals: 18, priceFeed: FEED_ETH }, { symbol: 'USDC', address: USDC, decimals: 6, priceFeed: FEED_USDC }]) }
const nowSec = () => Math.floor(Date.now() / 1000)

test('configuration: unset address is Not Configured; refresh clamps to 60–120 minutes', () => {
  assert.equal(treasuryConfig({}).configured, false)
  assert.equal(treasuryConfig({}).configError, 'not_configured')
  assert.equal(treasuryConfig({ TREASURY_WALLET_ADDRESS: 'nope' }).configError, 'invalid_address')
  assert.equal(treasuryConfig(env).refreshMinutes, 120)
  assert.equal(treasuryConfig({ ...env, TREASURY_REFRESH_MINUTES: '5' }).refreshMinutes, 60)
  assert.equal(treasuryConfig({ ...env, TREASURY_REFRESH_MINUTES: undefined }).refreshMinutes, 90)
})

test('snapshot values balances exactly from Chainlink answers', { skip: !pool }, async () => {
  const reader = {
    blockNumber: async () => 123n,
    nativeBalance: async () => 2_500000000000000000n,            // 2.5 ETH
    tokenBalance: async () => 1_234_567_890n,                    // 1,234.56789 USDC
    price: async feed => feed === FEED_ETH ? { answer: 300012345678n, decimals: 8, updatedAt: nowSec() } : { answer: 99990000n, decimals: 8, updatedAt: nowSec() },
  }
  const t = new Treasury(pool, { config: treasuryConfig(env), reader })
  assert.equal((await t.refresh()).status, 'ok')
  const v = await t.view()
  assert.equal(v.status, 'ok')
  assert.equal(v.snapshot.fullyPriced, true)
  assert.deepEqual(v.snapshot.assets.map(a => a.valueUsd), ['7500.30', '1234.44'])   // 2.5 × 3000.12345678; 1234.56789 × 0.9999 (floored cents)
  assert.equal(v.snapshot.totalUsd, '8734.74')
  assert.match(v.explorerUrl, /arbiscan\.io\/address\//)
})

test('stale or missing price leaves the asset unpriced; total is marked incomplete', { skip: !pool }, async () => {
  const reader = { blockNumber: async () => 124n, nativeBalance: async () => 10n ** 18n, tokenBalance: async () => 5_000_000n,
    price: async feed => ({ answer: feed === FEED_ETH ? 300000000000n : 100000000n, decimals: 8, updatedAt: feed === FEED_ETH ? nowSec() - 3 * 86400 : nowSec() }) }
  const t = new Treasury(pool, { config: treasuryConfig(env), reader })
  await t.refresh()
  const v = await t.view()
  assert.equal(v.snapshot.fullyPriced, false)
  assert.equal(v.snapshot.assets[0].priceError, 'price_stale')
  assert.equal(v.snapshot.totalUsd, '5.00')
})

test('RPC failure keeps the last good snapshot and flags it stale', { skip: !pool }, async () => {
  const t = new Treasury(pool, { config: treasuryConfig(env), reader: { blockNumber: async () => { throw new Error('rpc down') } } })
  assert.equal((await t.refresh()).status, 'error')
  const v = await t.view()
  assert.equal(v.stale, true)
  assert.equal(v.status, 'stale')
  assert.equal(v.lastAttempt.status, 'error')
  assert.equal(v.snapshot.totalUsd, '5.00')
})
