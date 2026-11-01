/**
 * Server-side Gains Network market data — the authoritative price stream for
 * the demo trading engine (the browser adapter stays for the chart).
 *
 * Protocol (verified 2026-10-31, mirrors dist/gains-adapter.js):
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
 */
import WebSocket from 'ws'

const API = 'https://api.gains.trade/v1/arbitrum'
const WSS = 'wss://api.gains.trade/v1/arbitrum/ws'

const STALE_MS = 5000          /* marks older than this are rejected for execution */

class MarketData {
  constructor() {
    this.markets = new Map()   /* symbol → metadata (maxLeverage, isOpen, …) */
    this.marks = new Map()     /* symbol → {mark, index, at, updatedAt} */
    this.injected = new Map()  /* test overrides */
    this.priceSeq = null
    this.ws = null
    this.subscribers = new Set()   /* (symbol, mark) => void — engine ticks */
    this.stopped = false
  }

  async bootstrap() {
    await this.#loadMarkets()
    await this.#loadPrices()
    this.#connect()
  }

  stop() { this.stopped = true; try { this.ws?.close() } catch {} }

  async #loadMarkets() {
    const r = await fetch(API + '/markets', { signal: AbortSignal.timeout(15000) })
    const j = await r.json()
    for (const m of (j.data || [])) {
      if (m && typeof m.symbol === 'string') this.markets.set(m.symbol, m)
    }
    console.log(`[market-data] ${this.markets.size} markets loaded`)
  }

  async #loadPrices() {
    const r = await fetch(API + '/prices', { signal: AbortSignal.timeout(10000) })
    const j = await r.json()
    let n = 0
    for (const p of (j.data || [])) {
      if (p && typeof p.market === 'string' && p.mark != null) {
        this.marks.set(p.market, { mark: String(p.mark), index: p.index != null ? String(p.index) : null, at: Date.now(), updatedAt: p.updatedAt })
        n++
      }
    }
    console.log(`[market-data] ${n} price marks loaded`)
  }

  #connect() {
    if (this.stopped) return
    this.ws = new WebSocket(WSS)
    let alive = false
    this.ws.on('open', () => {
      alive = true
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
        }
        if (Number.isFinite(msg.seq)) this.priceSeq = msg.seq
        const now = Date.now()
        for (const p of msg.data) {
          if (!p || typeof p.market !== 'string' || p.mark == null) continue
          this.marks.set(p.market, { mark: String(p.mark), index: p.index != null ? String(p.index) : null, at: now, updatedAt: p.updatedAt })
          const inj = this.injected.get(p.market)
          if (inj) this.#emit(p.market, inj)
          else this.#emit(p.market, String(p.mark))
        }
      }
    })
    this.ws.on('close', () => { if (!this.stopped) setTimeout(() => this.#connect(), 2000) })
    this.ws.on('error', () => { try { this.ws.close() } catch {} })
    /* watchdog: full REST resync every 60s regardless of ws health */
    setInterval(() => { this.#loadPrices().catch(() => {}) }, 60_000).unref()
  }

  #emit(symbol, mark) { for (const fn of this.subscribers) { try { fn(symbol, mark) } catch {} } }

  /* ---------- public API (engine) ---------- */
  marketMeta(symbol) { return this.markets.get(symbol) || null }

  /* test seam — deterministic price for engine tests */
  injectPrice(symbol, mark) { this.injected.set(symbol, String(mark)); this.#emit(symbol, String(mark)) }
  clearInjection(symbol) { this.injected.delete(symbol) }

  mark(symbol) {
    const inj = this.injected.get(symbol)
    if (inj != null) return { mark: String(inj), at: Date.now(), injected: true }
    const m = this.marks.get(symbol)
    return m ? { mark: m.mark, at: m.at, injected: false } : null
  }

  freshMark(symbol) {
    const m = this.mark(symbol)
    if (!m || m.at < Date.now() - STALE_MS) return null
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
