/**
 * Terminal Funding and Details tabs (item G).
 *
 *   GET /markets/:symbol/funding           current long/short funding, borrowing, open interest and skew
 *   GET /markets/:symbol/details           the Gains market specification and the Openfund account limits
 *   GET /markets/:symbol/funding-history   ?range=1d|1w|1m|3m&interval=1h|4h|1d, from our own hourly samples
 *
 * Current values come only from the documented Gains endpoints
 * `GET /v1/arbitrum/markets/{symbol}/funding` and `GET /v1/arbitrum/markets/{symbol}`
 * (docs/integrations/GAINS.md). Gains publishes no funding history, and
 * undocumented endpoints are not used: `sampleFunding` records the funding
 * block of the documented `/markets` list (already refreshed every minute by
 * market-data.js) once per hour, kept for 400 days. A range is offered only
 * when the samples cover it; otherwise the answer says from which date data
 * exists. Nothing is estimated or interpolated.
 */
import { Router } from 'express'
import { propLeverageCategory, propMaxLeverage, PROP_LEVERAGE_POLICY } from './prop-leverage.js'

const API = 'https://api.gains.trade/v1/arbitrum'
const SYMBOL = /^[A-Za-z0-9][A-Za-z0-9.]{0,15}\/[A-Za-z0-9][A-Za-z0-9.]{0,15}$/
const DECIMAL = /^-?\d{1,30}(\.\d{1,40})?(e-?\d{1,3})?$/i
export const FUNDING_RANGES = { '1d': 86_400_000, '1w': 7 * 86_400_000, '1m': 30 * 86_400_000, '3m': 90 * 86_400_000 }
export const FUNDING_INTERVALS = { '1h': 3_600_000, '4h': 4 * 3_600_000, '1d': 86_400_000 }
export const RETENTION_DAYS = 400
const fail = (status, error) => Object.assign(new Error(error), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const dec = v => (typeof v === 'string' && DECIMAL.test(v) ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : null)

/** the funding block of a Gains market object, validated; null when absent */
export function fundingOf(f) {
  if (!f || typeof f !== 'object') return null
  const out = {
    fundingRateLongHourly: dec(f.fundingRateLongHourly), fundingRateShortHourly: dec(f.fundingRateShortHourly),
    borrowingRateHourly: dec(f.borrowingRateHourly), openInterestLongUsd: dec(f.openInterestLongUsd),
    openInterestShortUsd: dec(f.openInterestShortUsd), skewUsd: dec(f.skewUsd),
  }
  return out.fundingRateLongHourly === null || out.fundingRateShortHourly === null ? null : out
}

/** symbol in the URL: `BTC-USD` or `BTC/USD` → `BTC/USD` */
export function marketSymbol(raw) {
  const s = String(raw || '').replace('-', '/').toUpperCase()
  if (!SYMBOL.test(s)) throw fail(404, 'unknown_market')
  return s
}
const dashed = symbol => symbol.replace('/', '-')

/** the history query → validated range and interval, or a 400 */
export function historyQuery(q = {}) {
  const range = Object.hasOwn(FUNDING_RANGES, q.range) ? q.range : null
  const interval = Object.hasOwn(FUNDING_INTERVALS, q.interval) ? q.interval : null
  if (!range || !interval) throw fail(400, 'invalid_range')
  if (FUNDING_INTERVALS[interval] >= FUNDING_RANGES[range]) throw fail(400, 'invalid_interval')
  return { range, interval }
}

/** which ranges our samples cover, given the oldest sample time */
export function rangeAvailability(oldest, now) {
  return Object.fromEntries(Object.entries(FUNDING_RANGES).map(([k, ms]) => [k, oldest != null && now - oldest >= ms - FUNDING_INTERVALS['1h']]))
}

export function marketFundingRoutes({ pool, marketData, limit, fetchImpl = (...a) => fetch(...a), now = () => Date.now() }) {
  const router = Router()
  const cache = new Map() /* path → { at, body } (30 s) */
  async function gains(path) {
    const hit = cache.get(path)
    if (hit && now() - hit.at < 30_000) return hit.body
    let r
    try { r = await fetchImpl(API + path, { signal: AbortSignal.timeout(8000) }) } catch { throw fail(502, 'upstream_unavailable') }
    if (r.status === 404) throw fail(404, 'unknown_market')
    if (!r.ok) throw fail(502, 'upstream_unavailable')
    const body = await r.json().catch(() => null)
    if (!body || typeof body !== 'object') throw fail(502, 'upstream_schema')
    cache.set(path, { at: now(), body })
    if (cache.size > 2000) cache.delete(cache.keys().next().value)
    return body
  }
  const headers = res => res.set({ 'Cache-Control': 'public, max-age=30', 'X-Openfund-Source': 'Gains Network' })

  router.get('/markets/:symbol/funding', limit(120), wrap(async (req, res) => {
    const symbol = marketSymbol(req.params.symbol)
    const funding = fundingOf(await gains(`/markets/${dashed(symbol)}/funding`))
    if (!funding) throw fail(502, 'upstream_schema')
    headers(res).json({ market: symbol, ...funding, fetchedAt: new Date(now()).toISOString(), source: 'Gains Network' })
  }))

  router.get('/markets/:symbol/details', limit(120), wrap(async (req, res) => {
    const symbol = marketSymbol(req.params.symbol)
    const m = await gains(`/markets/${dashed(symbol)}`)
    if (m.symbol !== symbol) throw fail(502, 'upstream_schema')
    const spec = {
      symbol: m.symbol, base: typeof m.base === 'string' ? m.base : null, quote: typeof m.quote === 'string' ? m.quote : null,
      group: typeof m.group === 'string' ? m.group : null, isOpen: m.isOpen === true,
      minLeverage: dec(m.minLeverage), maxLeverage: dec(m.maxLeverage), minCollateralUsd: dec(m.minCollateralUsd), minPositionUsd: dec(m.minPositionUsd),
      spreadRate: dec(m.spreadRate), openFeeRate: dec(m.fees?.openFeeRate), closeFeeRate: dec(m.fees?.closeFeeRate),
      pricePrecision: Number.isInteger(m.pricePrecision) ? m.pricePrecision : null, onlyIsolated: m.onlyIsolated === true,
      collaterals: Array.isArray(m.collaterals) ? m.collaterals.map(c => c?.symbol).filter(s => typeof s === 'string' && /^[A-Z0-9]{1,12}$/.test(s)) : [],
    }
    const category = propLeverageCategory(m, symbol)
    const limits = { prop: { category, maxLeverage: category == null ? null : propMaxLeverage(m, symbol), policyVersion: PROP_LEVERAGE_POLICY.version } }
    headers(res).json({ market: symbol, spec, accountLimits: limits, fetchedAt: new Date(now()).toISOString(), source: 'Gains Network' })
  }))

  router.get('/markets/:symbol/funding-history', limit(120), wrap(async (req, res) => {
    const symbol = marketSymbol(req.params.symbol)
    const { range, interval } = historyQuery(req.query)
    if (marketData?.markets instanceof Map && marketData.markets.size && !marketData.markets.has(symbol)) throw fail(404, 'unknown_market')
    const t = now()
    const { rows: [first] } = await pool.query(`SELECT min(sampled_at) AS oldest FROM market_funding_samples WHERE market=$1`, [symbol])
    const oldest = first?.oldest ? new Date(first.oldest).getTime() : null
    const available = rangeAvailability(oldest, t)
    const base = { market: symbol, range, interval, available, availableFrom: oldest ? new Date(oldest).toISOString() : null, source: 'Gains Network (sampled hourly by Openfund)' }
    if (!available[range]) return res.set('Cache-Control', 'no-store').json({ ...base, points: [] })
    const { rows } = await pool.query(`
      SELECT to_timestamp(floor(extract(epoch FROM sampled_at) / $3) * $3) AS bucket,
             avg(funding_long_hourly)::text AS long, avg(funding_short_hourly)::text AS short,
             avg(borrowing_hourly)::text AS borrowing, count(*)::int AS samples
        FROM market_funding_samples
       WHERE market=$1 AND sampled_at >= $2
       GROUP BY bucket ORDER BY bucket`, [symbol, new Date(t - FUNDING_RANGES[range]).toISOString(), FUNDING_INTERVALS[interval] / 1000])
    res.set('Cache-Control', 'public, max-age=300').json({ ...base, points: rows.map(r => ({ t: new Date(r.bucket).toISOString(), long: r.long, short: r.short, borrowing: r.borrowing, samples: r.samples })) })
  }))
  return router
}

/** One sample per market per hour from the documented /markets list held in
 *  memory; a repeat within the same hour is ignored. Returns rows written. */
export async function sampleFunding(pool, marketData, now = Date.now()) {
  const markets = marketData?.markets instanceof Map ? [...marketData.markets.values()] : []
  const hour = new Date(Math.floor(now / 3_600_000) * 3_600_000).toISOString()
  const rows = []
  for (const m of markets) {
    const f = fundingOf(m?.funding)
    if (!f || typeof m.symbol !== 'string' || !SYMBOL.test(m.symbol)) continue
    rows.push([m.symbol, f.fundingRateLongHourly, f.fundingRateShortHourly, f.borrowingRateHourly, f.openInterestLongUsd, f.openInterestShortUsd])
  }
  if (!rows.length) return 0
  const { rowCount } = await pool.query(`
    INSERT INTO market_funding_samples (market, sampled_at, funding_long_hourly, funding_short_hourly, borrowing_hourly, oi_long_usd, oi_short_usd)
    SELECT m, $1::timestamptz, l::numeric, s::numeric, b::numeric, ol::numeric, os::numeric
      FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[]) AS x(m, l, s, b, ol, os)
    ON CONFLICT (market, sampled_at) DO NOTHING`,
    [hour, rows.map(r => r[0]), rows.map(r => r[1]), rows.map(r => r[2]), rows.map(r => r[3]), rows.map(r => r[4]), rows.map(r => r[5])])
  await pool.query(`DELETE FROM market_funding_samples WHERE sampled_at < now() - make_interval(days => $1)`, [RETENTION_DAYS])
  return rowCount
}
