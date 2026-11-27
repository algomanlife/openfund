/**
 * Server-side Gains Network market data — the authoritative price stream for
 * the demo trading engine (the browser adapter stays for the chart).
 *
 * Protocol (verified 2026-10-31, mirrors packages/openfund-gains-adapter):
 *   REST  GET /v1/arbitrum/markets  → 488 markets with metadata
 *         GET /v1/arbitrum/prices   → [{market, mark, index, updatedAt}]
 *   WS    wss://api.gains.trade/v1/arbitrum/ws
 *         send {op:'subscribe', channel:'prices'}
 *         recv {op:'ping'} → answer {op:'pong'}
 *         recv {channel:'prices', snapshot?, seq, data:[{market, mark, ...}]}
 *         sequence gap → resubscribe (snapshot resync)
 *
 * Test seam: `injectPrice(symbol, mark)` overrides the mark (engine tests use
 * deterministic synthetic prices). `mark()` reports freshness.
 *
 * Open Oracle (ADR 0059): with `attachOracle(service)` Gains quotes become one
 * input of the Openfund pricing service instead of the execution price. The
 * engine then reads composite marks (`this.marks`) that the service refreshes
 * every evaluation; a composite that is stale, divergent, closed or
 * unavailable is never executable (`isUsable`). Raw Gains quotes stay in
 * `gainsMarks` for diagnostics. Without an attached service the behaviour is
 * the original Gains-only one (MARKET_PRICE_SOURCE=gains).
 */
import WebSocket from 'ws'
import { isUsable } from '../../packages/open-oracle/src/service.mjs'

const API = 'https://api.gains.trade/v1/arbitrum'
const WSS = 'wss://api.gains.trade/v1/arbitrum/ws'

const STALE_MS = 5000          /* marks older than this are rejected for execution */

export function quoteRecord(p, now = Date.now()) {
  if (!p || typeof p.market !== 'string' || !Number.isFinite(Number(p.mark)) || Number(p.mark) <= 0) return null
  if (p.updatedAt == null) return null
  let at = Number(p.updatedAt)
  if (!Number.isFinite(at)) at = Date.parse(p.updatedAt)
  if (at > 0 && at < 100000000000) at *= 1000
  if (!Number.isFinite(at) || at <= 0 || at > now + 1000) return null
  return {mark:String(p.mark),index:p.index != null ? String(p.index) : null,at:Math.min(now,at),updatedAt:p.updatedAt}
}
export class MarketData {
  /* Injection seam for contract tests (recorded fixtures, fake socket, fake clock).
     Production uses the defaults; behaviour is identical. */
  constructor({ fetchImpl = (...a) => fetch(...a), WebSocketImpl = WebSocket, now = () => Date.now(), api = API, wss = WSS, reconnectMs = 2000 } = {}) {
    this.fetchImpl = fetchImpl; this.WebSocketImpl = WebSocketImpl; this.now = now
    this.api = api; this.wss = wss; this.reconnectMs = reconnectMs
    this.markets = new Map()   /* symbol → metadata (maxLeverage, isOpen, …) */
    this.marks = new Map()     /* symbol → {mark, index, at, updatedAt} — execution marks */
    this.gainsMarks = new Map() /* symbol → raw Gains quote (equals `marks` without an oracle) */
    this.oracle = null
    this.injected = new Map()  /* test overrides */
    this.priceSeq = null
    this.ws = null
    this.subscribers = new Set()   /* (symbol, mark) => void — engine ticks */
    this.stopped = false
    this.retryTimer = null
    this.refreshTimer = null
  }

  async bootstrap() {
    if (this.stopped) return
    try {
      await this.#loadMarkets()
      await this.#loadPrices()
      if (this.stopped) return
      this.#connect()
      if (!this.refreshTimer) this.refreshTimer = setInterval(() => {
        if (!this.stopped) Promise.all([this.#loadMarkets(),this.#loadPrices()]).catch(e=>console.warn('[market-data] refresh failed',e.message))
      },60000)
      this.refreshTimer.unref?.()
    } catch(e) {
      if (!this.stopped) { this.retryTimer = setTimeout(()=>this.bootstrap().catch(()=>{}),3000); this.retryTimer.unref?.() }
      throw e
    }
  }

  stop() {
    this.stopped = true
    clearTimeout(this.retryTimer); clearInterval(this.refreshTimer)
    this.retryTimer = null; this.refreshTimer = null
    try { this.ws?.close() } catch {}
  }

  async #loadMarkets() {
    const r = await this.fetchImpl(this.api + '/markets', { signal: AbortSignal.timeout(15000) })
    if (!r.ok) throw new Error('markets_unavailable')
    const j = await r.json()
    if (!Array.isArray(j.data) || !j.data.length) throw new Error('invalid_market_schema')
    if (this.stopped) return
    for (const m of (j.data || [])) {
      if (m && typeof m.symbol === 'string') this.markets.set(m.symbol, m)
    }
    this.oracle?.setGainsCatalog([...this.markets.values()])
    console.log(`[market-data] ${this.markets.size} markets loaded`)
  }

  async #loadPrices() {
    const r = await this.fetchImpl(this.api + '/prices', { signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error('prices_unavailable')
    const j = await r.json()
    if (!Array.isArray(j.data)) throw new Error('invalid_price_schema')
    if (this.stopped) return
    let n = 0
    for (const p of (j.data || [])) {
      const quote = quoteRecord(p, this.now())
      if (quote && (!this.gainsMarks.has(p.market) || quote.at >= this.gainsMarks.get(p.market).at)) {
        this.#quote(p.market, quote, false)
        n++
      }
    }
    console.log(`[market-data] ${n} price marks loaded`)
  }

  #connect() {
    if (this.stopped) return
    this.ws = new this.WebSocketImpl(this.wss)
    this.ws.on('open', () => {
      this.priceSeq = null
      this.ws.send(JSON.stringify({ op: 'subscribe', channel: 'prices' }))
      console.log('[market-data] ws subscribed')
    })
    this.ws.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw.toString()) } catch { return }
      if (msg && msg.op === 'ping') {
        try { this.ws.send(JSON.stringify({ op: 'pong' })) } catch {}
        return
      }
      if (msg && msg.channel === 'prices' && Array.isArray(msg.data)) {
        /* sequence-gap → resubscribe for a snapshot resync */
        if (!msg.snapshot && this.priceSeq !== null && Number.isFinite(msg.seq) && msg.seq !== this.priceSeq + 1) {
          console.warn(`[market-data] seq gap ${this.priceSeq} → ${msg.seq}, resubscribing`)
          try { this.ws.send(JSON.stringify({ op: 'unsubscribe', channel: 'prices' })) } catch {}
          this.priceSeq = null
          try { this.ws.send(JSON.stringify({ op: 'subscribe', channel: 'prices' })) } catch {}
          this.gainsMarks.clear()
          if (!this.oracle) this.marks.clear()
          return
        }
        if (Number.isFinite(msg.seq)) this.priceSeq = msg.seq
        const now = this.now()
        for (const p of msg.data) {
          const quote = quoteRecord(p,now)
          if (!quote || (this.gainsMarks.has(p.market) && quote.at < this.gainsMarks.get(p.market).at)) continue
          this.#quote(p.market, quote, true)
        }
      }
    })
    this.ws.on('close', () => { if (!this.stopped) { this.retryTimer = setTimeout(() => this.#connect(), this.reconnectMs); this.retryTimer.unref?.() } })
    this.ws.on('error', () => { try { this.ws.close() } catch {} })
  }

  #emit(symbol, mark) { for (const fn of this.subscribers) { try { fn(symbol, mark) } catch {} } }

  /* One Gains quote: the execution mark without an oracle, an oracle input with one. */
  #quote(symbol, quote, live) {
    this.gainsMarks.set(symbol, quote)
    if (this.oracle) {
      /* the Gains mark is the comparable price; live evidence shows the Gains index field 2–7 % away from Hyperliquid and GMX */
      this.oracle.ingestGains(symbol, { price: quote.mark, field: 'mark', updatedAt: quote.at, receivedAt: this.now() })
      return
    }
    this.marks.set(symbol, quote)
    if (!live) return
    const inj = this.injected.get(symbol)
    this.#emit(symbol, inj ?? String(quote.mark))
  }

  /* ---------- Open Oracle ---------- */
  /** Route Gains quotes into the pricing service and execute on its usable composites. */
  attachOracle(service) {
    if (this.oracle === service) return service
    this.oracle = service
    this.marks.clear()
    if (this.markets.size) service.setGainsCatalog([...this.markets.values()])
    for (const [symbol, quote] of this.gainsMarks) this.#quote(symbol, quote, false)
    this.detachOracle = service.onUpdate((changed, time) => this.#applyComposites(changed, time))
    return service
  }
  #applyComposites(changed, time) {
    const now = this.now(), moved = new Set(changed.map(r => r.market))
    for (const record of this.oracle.snapshot()) {
      if (isUsable(record, now, STALE_MS)) {
        const previous = this.marks.get(record.market)
        this.marks.set(record.market, { mark: record.price, index: null, at: record.at, updatedAt: record.at, mode: record.mode, confidence: record.confidence })
        if (moved.has(record.market) && previous?.mark !== record.price && !this.injected.has(record.market)) this.#emit(record.market, record.price)
      } else if (record.price !== null && (record.mode === 'DIVERGENT' || record.mode === 'MARKET_CLOSED')) {
        /* keep the last good composite for valuation, but never execute on a
           composite the sources disagree on or on a closed market */
        const previous = this.marks.get(record.market)
        this.marks.set(record.market, { mark: record.price, index: null, at: previous?.at ?? record.referenceTimestamp ?? record.at, updatedAt: record.at, mode: record.mode, confidence: 0, blocked: record.mode })
      }
      /* STALE / UNAVAILABLE: the previous mark ages out through freshMark() */
    }
    void time
  }

  /* ---------- public API (engine) ---------- */
  marketMeta(symbol) { return this.markets.get(symbol) || null }

  /* test seam — deterministic price for engine tests */
  injectPrice(symbol, mark) { this.injected.set(symbol, String(mark)); this.#emit(symbol, String(mark)) }
  clearInjection(symbol) { this.injected.delete(symbol) }

  mark(symbol) {
    const inj = this.injected.get(symbol)
    if (inj != null) return { mark: String(inj), at: this.now(), injected: true }
    const m = this.marks.get(symbol)
    return m ? { mark: m.mark, at: m.at, injected: false, ...(m.blocked ? { blocked: m.blocked } : {}) } : null
  }

  freshMark(symbol) {
    const m = this.mark(symbol)
    if (!m || m.blocked || m.at < this.now() - STALE_MS || !Number.isFinite(Number(m.mark)) || Number(m.mark) <= 0) return null
    return m
  }

  /* tradeable market with valid fresh price + open */
  tradeable(symbol) {
    const meta = this.markets.get(symbol)
    if (!meta) return { ok: false, reason: 'unknown_market' }
    if (meta.isOpen === false) return { ok: false, reason: 'market_closed' }
    const m = this.freshMark(symbol)
    if (!m) return { ok: false, reason: 'stale_price' }
    return { ok: true, meta, mark: m.mark }
  }

  onTick(fn) { this.subscribers.add(fn); return () => this.subscribers.delete(fn) }
}

export const marketData = new MarketData()
