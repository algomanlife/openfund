/**
 * Terminal Funding and Details tabs (market-funding.js) on real PostgreSQL:
 * current values only from the documented Gains funding and market
 * endpoints (a fake Gains here), the account limits from the Prop leverage
 * policy, the hourly sampler (one row per market per hour, 400-day
 * retention), and the history endpoint that offers a range only when the
 * samples cover it and never estimates.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import pg from 'pg'
import { marketFundingRoutes, sampleFunding, historyQuery, rangeAvailability, marketSymbol, fundingOf, RETENTION_DAYS } from '../market-funding.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const FUNDING = { fundingRateLongHourly: '-0.0000006', fundingRateShortHourly: '0.0000035', borrowingRateHourly: '0.0000023', openInterestLongUsd: '432927.03', openInterestShortUsd: '74507.43', skewUsd: '358419.60' }
const MARKET = { symbol: 'BTC/USD', base: 'BTC', quote: 'USD', group: 'crypto', isOpen: true, minLeverage: '1.1', maxLeverage: '200', minCollateralUsd: '0.5', minPositionUsd: '0.55',
  pricePrecision: 1, spreadRate: '0.0001', fees: { openFeeRate: '0.00035', closeFeeRate: '0.00035' }, onlyIsolated: true, collaterals: [{ symbol: 'USDC' }, { symbol: '<x>' }], funding: FUNDING }
const requested = []
let server, base, clock = Date.UTC(2026, 10, 23, 12, 0, 0)
const marketData = { markets: new Map([['BTC/USD', MARKET], ['ETH/USD', { ...MARKET, symbol: 'ETH/USD', base: 'ETH', funding: { ...FUNDING, fundingRateLongHourly: '0.000001' } }], ['BAD', { symbol: 'BAD', funding: {} }]]) }

const call = async path => {
  const r = await fetch(base + path)
  return { status: r.status, data: await r.json().catch(() => null), headers: r.headers }
}

before(async () => {
  await pool.query(`DELETE FROM market_funding_samples`)
  const fetchImpl = async url => {
    requested.push(url)
    const path = new URL(url).pathname
    if (path === '/v1/arbitrum/markets/BTC-USD/funding') return Response.json(FUNDING)
    if (path === '/v1/arbitrum/markets/BTC-USD') return Response.json(MARKET)
    return new Response('{}', { status: 404 })
  }
  const app = express()
  app.use(marketFundingRoutes({ pool, marketData, limit: () => (_q, _r, next) => next(), fetchImpl, now: () => clock }))
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }))
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
})
after(async () => { server?.close(); await pool.end() })

test('inputs: symbols, ranges and intervals are validated; funding blocks must be decimals', () => {
  assert.equal(marketSymbol('btc-usd'), 'BTC/USD')
  assert.throws(() => marketSymbol('../etc'), /unknown_market/)
  assert.deepEqual(historyQuery({ range: '1w', interval: '4h' }), { range: '1w', interval: '4h' })
  assert.throws(() => historyQuery({ range: '1d', interval: '1d' }), /invalid_interval/)
  assert.throws(() => historyQuery({ range: '5y', interval: '1h' }), /invalid_range/)
  assert.equal(fundingOf({ fundingRateLongHourly: 'NaN', fundingRateShortHourly: '1' }), null)
  assert.equal(fundingOf(FUNDING).skewUsd, '358419.60')
  const day = 86_400_000
  assert.deepEqual(rangeAvailability(null, clock), { '1d': false, '1w': false, '1m': false, '3m': false })
  assert.deepEqual(rangeAvailability(clock - 8 * day, clock), { '1d': true, '1w': true, '1m': false, '3m': false })
})

test('current funding and details come only from the documented Gains endpoints', async () => {
  const f = await call('/markets/BTC-USD/funding')
  assert.equal(f.status, 200)
  assert.equal(f.data.market, 'BTC/USD')
  assert.equal(f.data.fundingRateShortHourly, '0.0000035')
  assert.equal(f.data.source, 'Gains Network')
  const d = await call('/markets/BTC-USD/details')
  assert.equal(d.status, 200)
  assert.equal(d.data.spec.maxLeverage, '200')
  assert.deepEqual(d.data.spec.collaterals, ['USDC'])
  assert.equal(d.data.accountLimits.prop.category, 'btc')
  assert.equal(d.data.accountLimits.prop.maxLeverage, 20)
  assert.equal((await call('/markets/DOGE-USD/funding')).status, 404)
  for (const url of requested) assert.match(new URL(url).pathname, /^\/v1\/arbitrum\/markets\/[A-Z]+-[A-Z]+(\/funding)?$/, url)
  const before = requested.length
  await call('/markets/BTC-USD/funding')
  assert.equal(requested.length, before, 'cached for 30 s')
})

test('sampler: one row per market per hour from the in-memory list; invalid rows skipped; 400-day retention', async () => {
  assert.equal(await sampleFunding(pool, marketData, clock), 2)
  assert.equal(await sampleFunding(pool, marketData, clock + 20 * 60_000), 0, 'same hour: nothing new')
  assert.equal(await sampleFunding(pool, marketData, clock + 3_600_000), 2)
  await pool.query(`INSERT INTO market_funding_samples (market, sampled_at, funding_long_hourly, funding_short_hourly) VALUES ('BTC/USD', now() - make_interval(days => $1), 0, 0)`, [RETENTION_DAYS + 5])
  await sampleFunding(pool, marketData, clock + 2 * 3_600_000)
  const { rows } = await pool.query(`SELECT count(*)::int AS n, min(sampled_at) AS oldest FROM market_funding_samples WHERE market='BTC/USD'`)
  assert.equal(rows[0].n, 3)
  assert.ok(new Date(rows[0].oldest).getTime() >= clock)
})

test('history: unavailable ranges say from when data exists; available ranges are bucketed averages, never estimated', async () => {
  clock += 3 * 3_600_000
  const short = await call('/markets/BTC-USD/funding-history?range=1d&interval=1h')
  assert.equal(short.status, 200)
  assert.equal(short.data.available['1d'], false)
  assert.deepEqual(short.data.points, [])
  assert.ok(short.data.availableFrom)
  /* a full day of samples */
  await pool.query(`DELETE FROM market_funding_samples`)
  for (let h = 0; h < 25; h++) await pool.query(`INSERT INTO market_funding_samples (market, sampled_at, funding_long_hourly, funding_short_hourly, borrowing_hourly) VALUES ('BTC/USD', $1, $2, $3, 0.000002)`,
    [new Date(clock - h * 3_600_000).toISOString(), h % 2 ? '0.000001' : '0.000003', '-0.000002'])
  const day = await call('/markets/BTC-USD/funding-history?range=1d&interval=4h')
  assert.equal(day.status, 200)
  assert.equal(day.data.available['1d'], true)
  assert.equal(day.data.available['1w'], false)
  assert.ok(day.data.points.length >= 6 && day.data.points.length <= 7)
  for (const p of day.data.points) { assert.ok(Number(p.long) >= 0.000001 && Number(p.long) <= 0.000003); assert.equal(Number(p.short), -0.000002) }
  const counted = day.data.points.reduce((s, p) => s + p.samples, 0)
  assert.ok(counted >= 24 && counted <= 25, `every sample in range is counted once (${counted})`)
  assert.equal((await call('/markets/BTC-USD/funding-history?range=1w&interval=1h')).data.points.length, 0)
  assert.equal((await call('/markets/BTC-USD/funding-history?range=1d&interval=1d')).status, 400)
  assert.equal((await call('/markets/XYZ-USD/funding-history?range=1d&interval=1h')).status, 404)
})
