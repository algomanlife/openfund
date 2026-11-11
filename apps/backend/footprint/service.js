/**
 * Openfund Footprint Service — chart analytics only.
 *
 *   Hyperliquid WS ─▶ HyperliquidTradeFeed (one shared upstream connection)
 *                        │  minute slices (exact per-level aggressor volume)
 *                        ├──▶ FootprintStore (Postgres, own tables, optional own DB)
 *                        └──▶ StreamHub (SSE fan-out: one serialization per coin batch)
 *   GET /api/footprint/markets   verified symbol mapping + feed status
 *   GET /api/footprint/history   footprint bars for a Gains symbol/timeframe/range
 *   GET /api/footprint/stream    live minute slices + heartbeat (SSE)
 *   GET /api/footprint/health    ingestion metrics
 *
 * Isolation contract: this module imports nothing from the trading engine,
 * Gains market data, accounts, wallets, payments or CMS, needs no key or
 * signature, and exposes no write endpoint. Disabled (FOOTPRINT_ENABLED != '1')
 * it starts nothing and every route answers 404 footprint_disabled.
 */
import { Router } from 'express'
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { HyperliquidTradeFeed } from './feed.js'
import { bucketBars, timeframeMs, MINUTE_MS } from '../../../packages/openfund-footprint/src/core.mjs'
import { CANDIDATE_MARKETS, candidateFor, verifyMarket } from '../../../packages/openfund-footprint/src/markets.mjs'

/** Measured Gains↔Hyperliquid basis per market (scripts/footprint/measure-basis.mjs).
 *  A missing file means "not measured": every market then reports basis_not_measured. */
export function loadCalibration() {
  try { return JSON.parse(readFileSync(new URL('../../../packages/openfund-footprint/src/calibration.json', import.meta.url), 'utf8')) }
  catch { return { markets: {} } }
}
const INFO = 'https://api.hyperliquid.xyz/info'
const MAX_BARS = 1000
const MAX_ROWS_PER_BAR = 600

export function footprintConfig(env = process.env) {
  const int = (v, d, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : d }
  return {
    enabled: env.FOOTPRINT_ENABLED === '1',
    databaseUrl: env.FOOTPRINT_DATABASE_URL || '',
    retentionDays: int(env.FOOTPRINT_RETENTION_DAYS, 30, 1, 3650),
    maxStreams: int(env.FOOTPRINT_MAX_STREAMS, 5000, 1, 100000),
    infoUrl: env.FOOTPRINT_HL_INFO_URL || INFO,
    wsUrl: env.FOOTPRINT_HL_WS_URL || undefined,
  }
}

/* ---------------- persistence ---------------- */

export class FootprintStore {
  constructor(pool) { this.pool = pool; this.dirty = new Map() /* `${coin}|${minute}` → slice+spec */ }

  mark(coin, spec, slice) { this.dirty.set(coin + '|' + slice.t, { coin, spec, slice }) }

  async flush() {
    if (!this.pool || !this.dirty.size) return 0
    const batch = [...this.dirty.values()]
    this.dirty.clear()
    const v = (k) => batch.map(k)
    await this.pool.query(
      `INSERT INTO footprint_minutes (coin, minute, price_decimals, size_decimals, levels, last_pu, last_time, trades)
       SELECT * FROM unnest($1::text[], $2::bigint[], $3::smallint[], $4::smallint[], $5::jsonb[], $6::bigint[], $7::bigint[], $8::int[])
       ON CONFLICT (coin, minute) DO UPDATE SET levels = EXCLUDED.levels, last_pu = EXCLUDED.last_pu,
         last_time = EXCLUDED.last_time, trades = EXCLUDED.trades, updated_at = now()`,
      [v(b => b.coin), v(b => b.slice.t), v(b => b.spec.priceDecimals), v(b => b.spec.szDecimals),
        v(b => JSON.stringify(b.slice.levels)), v(b => b.slice.lastPu), v(b => b.slice.lastTime), v(b => b.slice.n)])
    return batch.length
  }

  async gap(g) {
    if (!this.pool) return
    await this.pool.query('INSERT INTO footprint_gaps (coin, from_ms, to_ms, reason) VALUES ($1, $2, $3, $4)', [g.coin, g.from, g.to, g.reason])
  }

  async slices(coin, from, to, spec) {
    if (!this.pool) return []
    const r = await this.pool.query(
      'SELECT minute, price_decimals, size_decimals, levels, last_pu, last_time, trades FROM footprint_minutes WHERE coin = $1 AND minute >= $2 AND minute < $3 ORDER BY minute',
      [coin, from, to])
    /* a precision change on the venue would make old units incomparable: skip, never rescale silently */
    return r.rows.filter(x => x.price_decimals === spec.priceDecimals && x.size_decimals === spec.szDecimals)
      .map(x => ({ t: Number(x.minute), levels: x.levels, lastPu: Number(x.last_pu), lastTime: Number(x.last_time), n: x.trades }))
  }

  async gaps(coin, from, to) {
    if (!this.pool) return []
    const r = await this.pool.query('SELECT from_ms, to_ms, reason FROM footprint_gaps WHERE coin = $1 AND to_ms >= $2 AND (from_ms IS NULL OR from_ms < $3) ORDER BY to_ms', [coin, from, to])
    return r.rows.map(x => ({ from: x.from_ms == null ? null : Number(x.from_ms), to: Number(x.to_ms), reason: x.reason }))
  }

  async lastTrades() {
    if (!this.pool) return new Map()
    const r = await this.pool.query('SELECT coin, max(last_time) AS t FROM footprint_minutes GROUP BY coin')
    return new Map(r.rows.map(x => [x.coin, Number(x.t)]))
  }

  async prune(retentionDays, now = Date.now()) {
    if (!this.pool) return
    const floor = now - retentionDays * 86_400_000
    await this.pool.query('DELETE FROM footprint_minutes WHERE minute < $1', [floor])
    await this.pool.query('DELETE FROM footprint_gaps WHERE to_ms < $1', [floor])
  }
}

/* ---------------- live fan-out ---------------- */

export class StreamHub {
  constructor({ maxStreams = 5000, flushMs = 500, heartbeatMs = 5000, status = () => ({}) } = {}) {
    Object.assign(this, { maxStreams, status })
    this.rooms = new Map()     /* coin → Set(res) */
    this.pending = new Map()   /* coin → Map(minute → slice) */
    this.count = 0
    this.flushTimer = setInterval(() => this.flush(), flushMs); this.flushTimer.unref?.()
    this.beatTimer = setInterval(() => this.heartbeat(), heartbeatMs); this.beatTimer.unref?.()
  }

  join(coin, res) {
    if (this.count >= this.maxStreams) return false
    let room = this.rooms.get(coin)
    if (!room) { room = new Set(); this.rooms.set(coin, room) }
    room.add(res); this.count++
    return true
  }

  leave(coin, res) {
    const room = this.rooms.get(coin)
    if (room?.delete(res)) this.count--
    if (room && !room.size) { this.rooms.delete(coin); this.pending.delete(coin) }
  }

  push(coin, slice) {
    if (!this.rooms.has(coin)) return           /* no subscriber: nothing buffered */
    let p = this.pending.get(coin)
    if (!p) { p = new Map(); this.pending.set(coin, p) }
    p.set(slice.t, slice)
  }

  #send(room, coin, frame) {
    for (const res of room) {
      /* a client that cannot keep up is dropped instead of buffering without bound */
      if (res.writableLength > 1 << 20) { try { res.end() } catch {} this.leave(coin, res); continue }
      try { res.write(frame) } catch { this.leave(coin, res) }
    }
  }

  flush() {
    for (const [coin, slices] of this.pending) {
      const room = this.rooms.get(coin)
      if (!room || !slices.size) continue
      const frame = `event: slices\ndata: ${JSON.stringify({ coin, slices: [...slices.values()] })}\n\n`
      slices.clear()
      this.#send(room, coin, frame)
    }
  }

  heartbeat() {
    if (!this.count) return
    const frame = `event: status\ndata: ${JSON.stringify(this.status())}\n\n`
    for (const [coin, room] of this.rooms) this.#send(room, coin, frame)
  }

  stop() { clearInterval(this.flushTimer); clearInterval(this.beatTimer); for (const [coin, room] of this.rooms) for (const res of room) { try { res.end() } catch {} this.leave(coin, res) } }
}

/* ---------------- history assembly ---------------- */

/** Smallest "nice" row (1, 2, 5 × 10^k price units) keeping every bar ≤ maxRows rows. */
export function baseRowUnits(bars, maxRows = MAX_ROWS_PER_BAR) {
  let widest = 0
  for (const b of bars) if (b.rows.length > 1) widest = Math.max(widest, (b.rows[b.rows.length - 1][0] - b.rows[0][0]))
  let k = 1
  const steps = [1, 2, 5]
  for (let e = 0; e < 12; e++) for (const m of steps) { k = m * 10 ** e; if (widest / k < maxRows) return k }
  return k
}

/* ---------------- service ---------------- */

export function createFootprintService({ env = process.env, mainPool = null, fetchImpl = (...a) => fetch(...a), feed = null, now = () => Date.now(), log = console, calibration = null } = {}) {
  const cfg = footprintConfig(env)
  const router = Router()
  const CALIBRATION = calibration || loadCalibration()
  if (!cfg.enabled) {
    router.use('/api/footprint', (req, res) => res.status(404).json({ error: 'footprint_disabled' }))
    return { router, enabled: false, start: async () => {}, stop: async () => {} }
  }

  const ownPool = cfg.databaseUrl ? new pg.Pool({ connectionString: cfg.databaseUrl, max: 4 }) : null
  const store = new FootprintStore(ownPool || mainPool)
  feed = feed || new HyperliquidTradeFeed({ url: cfg.wsUrl, now, log })
  const markets = new Map()   /* gains symbol → verification record */
  const bootedAt = now()
  const hub = new StreamHub({
    maxStreams: cfg.maxStreams,
    status: () => ({ connected: feed.state.connected, lastHeartbeat: now(), lastUpstreamAt: feed.state.lastMessageAt, reconnects: feed.state.reconnects }),
  })
  const cache = new Map()     /* closed-range history responses (bounded LRU) */
  const timers = []

  feed.onSlice(({ coin, slice }) => {
    const spec = feed.specs.get(coin)
    store.mark(coin, spec, slice)
    hub.push(coin, slice)
  })
  feed.onGap((g) => { store.gap(g).catch(e => log.warn?.('[footprint] gap record failed', e.message)) })

  async function verify() {
    const dexes = [...new Set(CANDIDATE_MARKETS.map(m => m.dex))]
    const universes = new Map()
    for (const dex of dexes) {
      const r = await fetchImpl(cfg.infoUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(dex ? { type: 'meta', dex } : { type: 'meta' }), signal: AbortSignal.timeout(10_000) })
      if (!r.ok) throw new Error('meta_unavailable')
      const j = await r.json()
      universes.set(dex, Array.isArray(j?.universe) ? j.universe : [])
    }
    for (const c of CANDIDATE_MARKETS) {
      const rec = verifyMarket(c, universes.get(c.dex), CALIBRATION.markets?.[c.gains])
      rec.verifiedAt = now()
      markets.set(c.gains, rec)
      if (rec.status === 'supported') feed.track({ coin: c.coin, priceDecimals: rec.priceDecimals, szDecimals: rec.szDecimals })
    }
  }

  const specOf = (symbol) => {
    const c = candidateFor(symbol)
    const rec = c && markets.get(c.gains)
    return rec && rec.status === 'supported' ? { ...rec, priceDecimals: rec.priceDecimals, szDecimals: rec.szDecimals } : null
  }

  const publicMarket = (rec) => ({
    gains: rec.gains, coin: rec.coin, dex: rec.dex, unit: rec.unit, status: rec.status, reasons: rec.reasons,
    priceDecimals: rec.priceDecimals ?? null, sizeDecimals: rec.szDecimals ?? null,
    calibration: CALIBRATION.markets?.[rec.gains] ?? null,
  })

  router.get('/api/footprint/markets', (req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({ markets: [...markets.values()].map(publicMarket), calibration: { measuredAt: CALIBRATION.measuredAt, method: CALIBRATION.method }, feed: { connected: feed.state.connected }, bootedAt })
  })

  router.get('/api/footprint/health', (req, res) => {
    res.set('Cache-Control', 'no-store')
    res.json({ feed: feed.health(), streams: hub.count, rooms: hub.rooms.size, cacheEntries: cache.size, pendingWrites: store.dirty.size })
  })

  router.get('/api/footprint/history', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store')
      const spec = specOf(String(req.query.symbol || ''))
      if (!spec) return res.status(404).json({ error: 'footprint_unsupported_market' })
      const tfMs = timeframeMs(String(req.query.tf || ''))
      if (!tfMs) return res.status(400).json({ error: 'invalid_timeframe' })
      let from = Number(req.query.from), to = Number(req.query.to)
      if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return res.status(400).json({ error: 'invalid_range' })
      from = Math.floor(from / tfMs) * tfMs
      /* CLOSED minutes only: the forming minute arrives on the live stream, so the
         client can join history and live at `to` without double counting */
      to = Math.min(Math.ceil(to / tfMs) * tfMs, Math.floor(now() / MINUTE_MS) * MINUTE_MS)
      if (to <= from) return res.json({ symbol: spec.gains, coin: spec.coin, tf: req.query.tf, tfMs, from, to: Math.max(from, to), priceDecimals: spec.priceDecimals, sizeDecimals: spec.szDecimals, rowUnits: 1, bars: [], gaps: [], source: 'hyperliquid-trades' })
      if ((to - from) / tfMs > MAX_BARS) from = to - MAX_BARS * tfMs
      /* closed ranges (ending before the late-arrival window) are immutable → cacheable */
      const closed = to < now() - 5 * MINUTE_MS
      const key = `${spec.coin}|${tfMs}|${from}|${to}`
      if (closed && cache.has(key)) { const hit = cache.get(key); cache.delete(key); cache.set(key, hit); return res.type('json').send(hit) }

      const stored = await store.slices(spec.coin, from, to, spec)
      const mem = feed.slices(spec.coin, from, to)
      const byMinute = new Map(stored.map(s => [s.t, s]))
      for (const s of mem) byMinute.set(s.t, s)           /* memory holds the newest version */
      const exact = [...bucketBars([...byMinute.values()], tfMs, 1).values()].sort((a, b) => a.t - b.t)
      const rowUnits = baseRowUnits(exact)
      const bars = rowUnits > 1 ? [...bucketBars([...byMinute.values()], tfMs, rowUnits).values()].sort((a, b) => a.t - b.t) : exact
      const gaps = await store.gaps(spec.coin, from, to)
      const body = JSON.stringify({
        symbol: spec.gains, coin: spec.coin, unit: spec.unit, tf: req.query.tf, tfMs, from, to,
        priceDecimals: spec.priceDecimals, sizeDecimals: spec.szDecimals, rowUnits, bars, gaps,
        source: 'hyperliquid-trades',
      })
      if (closed) { cache.set(key, body); if (cache.size > 500) cache.delete(cache.keys().next().value) }
      res.type('json').send(body)
    } catch (e) { next(e) }
  })

  router.get('/api/footprint/stream', (req, res) => {
    const spec = specOf(String(req.query.symbol || ''))
    if (!spec) return res.status(404).json({ error: 'footprint_unsupported_market' })
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
    if (!hub.join(spec.coin, res)) { res.write('event: error\ndata: {"error":"footprint_stream_capacity"}\n\n'); return res.end() }
    res.write(`retry: 3000\nevent: status\ndata: ${JSON.stringify({ connected: feed.state.connected, lastHeartbeat: now(), coin: spec.coin })}\n\n`)
    /* the forming + previous minute right away, so a quiet minute is never missing
       between the history edge and the first live batch */
    const m0 = Math.floor(now() / MINUTE_MS) * MINUTE_MS
    const recent = feed.slices(spec.coin, m0 - MINUTE_MS, m0 + MINUTE_MS)
    if (recent.length) res.write(`event: slices\ndata: ${JSON.stringify({ coin: spec.coin, slices: recent })}\n\n`)
    req.on('close', () => hub.leave(spec.coin, res))
  })

  async function start() {
    try { await verify() } catch (e) { log.warn?.('[footprint] market verification failed', e.message) }
    try { for (const [coin, t] of await store.lastTrades()) feed.seedLastTrade(coin, t) } catch (e) { log.warn?.('[footprint] coverage seed failed', e.message) }
    feed.start()
    const every = (ms, fn) => { const t = setInterval(() => fn().catch(e => log.warn?.('[footprint]', e.message)), ms); t.unref?.(); timers.push(t) }
    every(5000, () => store.flush())
    every(3_600_000, () => verify())
    every(86_400_000, () => store.prune(cfg.retentionDays, now()))
  }

  async function stop() {
    timers.forEach(clearInterval)
    hub.stop(); feed.stop()
    try { await store.flush() } catch {}
    await ownPool?.end().catch(() => {})
  }

  return { router, enabled: true, start, stop, feed, hub, store, markets, verify }
}
