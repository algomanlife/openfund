/**
 * Open Oracle — Openfund's own price aggregation and discovery (ADR 0059).
 *
 * Runtime wiring for packages/open-oracle:
 *  - `oracleConfig(env)` reads MARKET_PRICE_SOURCE (`open-oracle`, the
 *    default, or `gains`, the emergency fallback to Gains-only marks) and
 *    OPEN_ORACLE_UPSTREAM (an Openfund origin to mirror when this process
 *    does not run the market-data role, e.g. the IRAN region).
 *  - `createOpenOracle()` builds the pricing service with Hyperliquid (main
 *    perp dex) and GMX (Arbitrum) inputs; Gains quotes arrive from
 *    MarketData, which already holds the Gains price socket.
 *  - `OracleMirror` follows another Openfund region's public stream so
 *    browsers in a region without provider access still read Open Oracle
 *    composites from their own origin.
 *  - `oracleRoutes()` is the public, read-only API: /api/oracle/prices,
 *    /api/oracle/prices/:market, /api/oracle/status and the
 *    /api/oracle/stream SSE feed.
 *    Responses carry composites and per-source contributions only, never
 *    provider payloads.
 */
import { OpenOracleService, HyperliquidAdapter, GMXAdapter, PublicTransport } from '../../packages/open-oracle/src/index.mjs'

export const PRICE_SOURCES = Object.freeze(['open-oracle', 'gains'])

export function oracleConfig(env = process.env) {
  const source = String(env.MARKET_PRICE_SOURCE || 'open-oracle').trim().toLowerCase()
  if (!PRICE_SOURCES.includes(source)) throw new Error(`MARKET_PRICE_SOURCE must be one of ${PRICE_SOURCES.join(', ')}`)
  let upstream = String(env.OPEN_ORACLE_UPSTREAM || '').trim().replace(/\/+$/, '')
  if (upstream) {
    let url
    try { url = new URL(upstream) } catch { throw new Error('OPEN_ORACLE_UPSTREAM must be an absolute https URL') }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('OPEN_ORACLE_UPSTREAM must be an absolute https URL')
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('OPEN_ORACLE_UPSTREAM must be an origin without a path')
    upstream = url.origin
  }
  return Object.freeze({ source, upstream: upstream || null })
}

export function createOpenOracle({ fetchImpl = fetch, logger = console } = {}) {
  const transport = () => new PublicTransport({ fetchImpl, retries: 1, timeoutMs: 10000 })
  return new OpenOracleService({
    logger,
    adapters: {
      /* main perp dex only: builder dexes and spot are never joined, and skipping them keeps the request budget low */
      hyperliquid: new HyperliquidAdapter({ transport: transport(), includeBuilderDexs: false, includeSpot: false }),
      gmx: new GMXAdapter({ transport: transport(), networks: [{ name: 'arbitrum', oracle: 'https://arbitrum-api.gmxinfra.io', api: 'https://arbitrum.gmxapi.io' }] }),
    },
  })
}

/**
 * Read-only mirror of another region's Open Oracle, with the service's read
 * interface. It follows the upstream /api/oracle/stream (snapshot, then only the
 * changed composites), so a region pays for changes, not for a full snapshot
 * every second; it reconnects with backoff and reports its own freshness.
 */
export class OracleMirror {
  constructor({ upstream, fetchImpl = (...a) => fetch(...a), now = () => Date.now(), logger = console, staleAfterMs = 30000 }) {
    Object.assign(this, { upstream, fetchImpl, now, logger, staleAfterMs })
    this.records = new Map(); this.listeners = new Set(); this.stopped = true; this.controller = null
    this.lastEventAt = 0; this.connects = 0; this.failures = 0; this.lastError = null; this.upstreamStatus = null
  }
  start() {
    if (!this.stopped) return this
    this.stopped = false
    this.#run().catch(() => {})
    return this
  }
  stop() { this.stopped = true; this.controller?.abort() }
  async #run() {
    while (!this.stopped) {
      this.controller = new AbortController()
      try {
        const r = await this.fetchImpl(`${this.upstream}/api/oracle/stream`, { headers: { accept: 'text/event-stream' }, signal: this.controller.signal })
        if (!r.ok || !r.body) throw new Error(`upstream_${r.status}`)
        this.connects++
        await this.consume(r.body)
        throw new Error('upstream_closed')
      } catch (e) {
        if (this.stopped) break
        this.failures++; this.lastError = e.message
        if (this.failures === 1 || this.failures % 30 === 0) this.logger.warn?.('[open-oracle] mirror stream', e.message)
        await new Promise(resolve => { const t = setTimeout(resolve, Math.min(30000, 1000 * 2 ** Math.min(this.failures, 5))); t.unref?.() })
      }
    }
  }
  /** Parses an SSE body (async iterable of bytes) and applies snapshot/prices events. */
  async consume(body) {
    const decoder = new TextDecoder()
    let buffer = ''
    for await (const chunk of body) {
      buffer += decoder.decode(chunk, { stream: true })
      if (buffer.length > 8 * 1024 * 1024) throw new Error('upstream_event_too_large')
      let cut
      while ((cut = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, cut); buffer = buffer.slice(cut + 2)
        let event = 'message', data = ''
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) data += line.slice(5).trim()
        }
        if (data && (event === 'snapshot' || event === 'prices')) this.apply(event, JSON.parse(data))
      }
    }
  }
  apply(event, payload) {
    if (!Array.isArray(payload?.data)) return
    const changed = []
    if (event === 'snapshot') this.records.clear()
    for (const c of payload.data) {
      if (!c || typeof c.market !== 'string' || !Number.isFinite(c.at)) continue
      const record = { market: c.market, price: c.price ?? null, mode: c.mode, confidence: c.confidence, stale: Boolean(c.stale), at: c.at,
        eligibleSources: c.eligible, configuredSources: c.configured, sources: [] }
      this.records.set(c.market, record); changed.push(record)
    }
    this.lastEventAt = this.now(); this.failures = 0; this.lastError = null
    for (const fn of this.listeners) try { fn(changed, this.now()) } catch {}
  }
  onUpdate(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  get(symbol) { return this.records.get(symbol) ?? null }
  snapshot() { return [...this.records.values()] }
  status() {
    const modes = {}
    for (const r of this.records.values()) modes[r.mode] = (modes[r.mode] ?? 0) + 1
    return { running: !this.stopped, markets: this.records.size, modes,
      mirror: { upstream: this.upstream, connected: this.lastEventAt > 0 && this.now() - this.lastEventAt < this.staleAfterMs, lastEventAt: this.lastEventAt || null, connects: this.connects, failures: this.failures, lastError: this.lastError } }
  }
}

/* ---------------- public API ---------------- */
export const compact = r => ({ market: r.market, price: r.price, mode: r.mode, confidence: r.confidence, stale: r.stale, at: r.at, eligible: r.eligibleSources, configured: r.configuredSources })
const summary = status => status && ({ markets: status.markets, modes: status.modes, joinedMarkets: status.joinedMarkets, algorithmVersion: status.algorithmVersion, configurationVersion: status.configurationVersion, lastEvaluation: status.lastEvaluation })
const MAX_STREAMS = 2000
const MAX_STREAMS_PER_VISITOR = 6 /* a few tabs per visitor */

const GAINS_API = 'https://api.gains.trade/v1/arbitrum'
const CANDLE_INTERVALS = new Set(['1m', '5m', '15m', '30m', '1h', '4h', '1d'])
const MARKET_PATH = /^[A-Za-z0-9._]{1,24}[/-][A-Za-z0-9._]{1,12}$/

/**
 * Open Oracle market data API (ADR 0059): the one source the website and the
 * terminal read for the market catalog, candles and the virtual order book.
 * Catalog: the market-data role's catalog. Candles, book and trades: read
 * server-side from the upstream venue feeds, cached briefly, with the newest
 * candle closed at the Open Oracle composite. A process without the market
 * data (a mirror region) forwards to OPEN_ORACLE_UPSTREAM. Browsers never
 * call a venue directly.
 */
export function oracleMarketData({ markets, oracle, upstream = null, fetchImpl = (...a) => fetch(...a), now = () => Date.now(), api = GAINS_API }) {
  const cache = new Map()
  const cached = async (key, ttlMs, load) => {
    const hit = cache.get(key)
    if (hit && hit.until > now()) return hit.value
    const value = await load()
    if (cache.size >= 2000) cache.delete(cache.keys().next().value)
    cache.set(key, { until: now() + ttlMs, value })
    return value
  }
  const read = async url => {
    const r = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000), redirect: 'error' })
    if (!r.ok) { await r.body?.cancel?.(); throw Object.assign(new Error('upstream_' + r.status), { status: r.status === 404 ? 404 : 502 }) }
    return r.json()
  }
  const local = () => markets().size > 0
  /* 'BTC-USD' or 'BTC/USD' → the catalog symbol, or null */
  const symbolOf = raw => {
    const text = String(raw || '')
    if (!MARKET_PATH.test(text)) return null
    const symbol = text.replace('-', '/').toUpperCase()
    return !local() || markets().has(symbol) ? symbol : null
  }
  const remote = path => read(upstream + '/api/oracle' + path)
  return {
    async catalog() {
      /* venue catalog rows only (a pair index); placeholder rows a test server
         injects with a price are not a catalog */
      const data = [...markets().values()].filter(m => Number.isInteger(m?.pairIndex))
      if (data.length) return { data }
      if (upstream) return cached('catalog', 60_000, () => remote('/markets'))
      throw Object.assign(new Error('catalog_unavailable'), { status: 503 })
    },
    async candles(raw, interval, from, to) {
      const symbol = symbolOf(raw)
      if (!symbol || !CANDLE_INTERVALS.has(interval)) throw Object.assign(new Error('invalid_request'), { status: 400 })
      const f = Math.floor(Number(from)), t = to == null || to === '' ? now() : Math.floor(Number(to))
      if (!Number.isFinite(f) || !Number.isFinite(t) || f < 0 || t < f || t - f > 400 * 86_400_000) throw Object.assign(new Error('invalid_range'), { status: 400 })
      /* round the end to the candle cadence so concurrent viewers share a cache entry */
      const bucket = Math.floor(t / 15_000) * 15_000
      const query = `/markets/${symbol.replace('/', '-')}/candles?interval=${interval}&from=${f}&to=${bucket}`
      const body = await cached('c' + query, 15_000, () => !local() && upstream ? remote(query) : read(api + query))
      const data = Array.isArray(body?.data) ? body.data.map(c => ({ ...c })) : []
      /* the open candle follows the Open Oracle composite */
      const record = oracle()?.get?.(symbol), last = data[data.length - 1], price = Number(record?.price)
      if (last && Number.isFinite(price) && price > 0 && !record.stale && t >= now() - 60_000) {
        last.close = price
        last.high = Math.max(Number(last.high) || price, price)
        last.low = Math.min(Number(last.low) || price, price)
      }
      return { source: 'open-oracle', data }
    },
    async book(raw, levels) {
      const symbol = symbolOf(raw)
      const n = Math.min(50, Math.max(1, Math.floor(Number(levels) || 15)))
      if (!symbol) throw Object.assign(new Error('invalid_request'), { status: 400 })
      const query = `/markets/${encodeURIComponent(symbol)}/book?levels=${n}`
      return cached('b' + query, 1_000, () => !local() && upstream ? remote(query) : read(api + query))
    },
    async trades(raw, limitRows) {
      const symbol = symbolOf(raw)
      const n = Math.min(100, Math.max(1, Math.floor(Number(limitRows) || 50)))
      if (!symbol) throw Object.assign(new Error('invalid_request'), { status: 400 })
      const query = `/markets/${encodeURIComponent(symbol)}/trades?limit=${n}`
      return cached('t' + query, 2_000, () => !local() && upstream ? remote(query) : read(api + query))
    },
  }
}

/**
 * @param {{ Router: Function, oracle: () => (OpenOracleService|OracleMirror|null), limit: Function, now?: Function, marketApi?: ReturnType<typeof oracleMarketData> }} deps
 */
export function oracleRoutes({ Router, oracle, limit, now = () => Date.now(), marketApi = null }) {
  const router = Router()
  if (marketApi) {
    const send = (res, maxAge, work) => work.then(body => res.set('Cache-Control', `public, max-age=${maxAge}`).json(body),
      error => res.status(error.status && error.status < 500 ? error.status : (error.status || 502)).set('Cache-Control', 'no-store').json({ error: error.status === 400 ? error.message : 'market_data_unavailable' }))
    router.get('/api/oracle/markets', limit(60), (req, res) => send(res, 60, marketApi.catalog()))
    router.get('/api/oracle/markets/:market/candles', limit(240), (req, res) =>
      send(res, 10, marketApi.candles(req.params.market, String(req.query.interval || ''), req.query.from, req.query.to)))
    router.get('/api/oracle/markets/:market/book', limit(240), (req, res) => send(res, 1, marketApi.book(req.params.market, req.query.levels)))
    router.get('/api/oracle/markets/:market/trades', limit(120), (req, res) => send(res, 2, marketApi.trades(req.params.market, req.query.limit)))
  }
  const streams = new Set(), perVisitor = new Map()
  const unavailable = res => res.status(503).set('Cache-Control', 'no-store').json({ error: 'oracle_unavailable' })
  router.get('/api/oracle/prices', limit(120), (req, res) => {
    const o = oracle(); if (!o) return unavailable(res)
    const records = o.snapshot()
    res.set('Cache-Control', 'no-store').json({ source: 'open-oracle', at: now(), status: summary(o.status()), data: records.map(compact) })
  })
  router.get('/api/oracle/prices/:market', limit(240), (req, res) => {
    const o = oracle(); if (!o) return unavailable(res)
    const symbol = String(req.params.market || '').replace('-', '/').toUpperCase()
    const record = o.get(symbol)
    if (!record) return res.status(404).set('Cache-Control', 'no-store').json({ error: 'unknown_market' })
    res.set('Cache-Control', 'no-store').json(record)
  })
  router.get('/api/oracle/status', limit(60), (req, res) => {
    const o = oracle(); if (!o) return unavailable(res)
    res.set('Cache-Control', 'no-store').json({ source: 'open-oracle', ...o.status() })
  })
  router.get('/api/oracle/stream', limit(30), (req, res) => {
    const o = oracle(); if (!o) return unavailable(res)
    if (streams.size >= MAX_STREAMS) return res.status(503).set('Cache-Control', 'no-store').json({ error: 'stream_capacity' })
    /* one visitor cannot hold the shared capacity (security assessment 2026-11-27) */
    const visitor = req.ip || 'unknown'
    if ((perVisitor.get(visitor) || 0) >= MAX_STREAMS_PER_VISITOR) return res.status(429).set('Cache-Control', 'no-store').json({ error: 'too_many_streams' })
    perVisitor.set(visitor, (perVisitor.get(visitor) || 0) + 1)
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
    res.write('retry: 3000\n\n')
    res.write(`event: snapshot\ndata: ${JSON.stringify({ at: now(), data: o.snapshot().map(compact) })}\n\n`)
    const unsubscribe = o.onUpdate((changed, time) => {
      if (!changed.length) return
      if (!res.write(`event: prices\ndata: ${JSON.stringify({ at: time, data: changed.map(compact) })}\n\n`)) res.destroy()
    })
    const heartbeat = setInterval(() => { if (!res.write(': heartbeat\n\n')) res.destroy() }, 15000); heartbeat.unref?.()
    let closed = false
    const cleanup = () => {
      if (closed) return
      closed = true; clearInterval(heartbeat); unsubscribe(); streams.delete(cleanup)
      const left = (perVisitor.get(visitor) || 1) - 1
      if (left > 0) perVisitor.set(visitor, left); else perVisitor.delete(visitor)
    }
    streams.add(cleanup)
    req.on('close', cleanup); res.on('close', cleanup)
  })
  router.close = () => { for (const cleanup of [...streams]) cleanup() }
  return router
}
