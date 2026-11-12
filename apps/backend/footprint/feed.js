/**
 * Hyperliquid trade ingestion for the footprint (read-only, chart analytics only).
 *
 * ONE shared upstream WebSocket per backend process carries the `trades`
 * subscription of every supported footprint coin; browsers never connect to
 * Hyperliquid and 1,000 viewers of BTC cost exactly one subscription.
 *
 * Nothing here touches the trading engine, Gains pricing, accounts or wallets:
 * no keys, no signatures, no user-specific subscriptions. Counterparty
 * addresses in the public trade feed are dropped at normalization.
 *
 * Reliability
 *   - heartbeat: `{"method":"ping"}` every 20 s; no inbound message for 60 s
 *     → the socket is considered dead and replaced.
 *   - reconnect: exponential backoff with jitter (1 s → 30 s cap), reset only once
 *     a connection delivers a message (accept-then-drop keeps backing off).
 *   - every (re)subscribe returns a snapshot of recent trades; MinuteBook dedup
 *     makes replays idempotent. When the snapshot's oldest trade is newer than
 *     the last trade seen before the drop, the interval between them is
 *     recorded as a GAP (never filled with synthetic data).
 *   - out-of-order arrivals land in their own minute; trades older than the
 *     in-memory window are counted as `lateDropped`, never forced into a newer minute.
 */
import WebSocket from 'ws'
import { MinuteBook, normalizeTrade } from '../../../packages/openfund-footprint/src/core.mjs'

const WSS = 'wss://api.hyperliquid.xyz/ws'

export class HyperliquidTradeFeed {
  constructor({ WebSocketImpl = WebSocket, url = WSS, now = () => Date.now(), pingMs = 20_000, deadMs = 60_000, retainMinutes = 180, log = console } = {}) {
    Object.assign(this, { WebSocketImpl, url, now, pingMs, deadMs, log })
    this.specs = new Map()       /* coin → { coin, priceDecimals, szDecimals } */
    this.books = new Map()       /* coin → MinuteBook */
    this.lastTrade = new Map()   /* coin → last trade time seen (ms) */
    this.awaitingSnapshot = new Set()
    this.seeded = new Set()
    this.retainMinutes = retainMinutes
    this.listeners = new Set()   /* ({ coin, minute, slice }) => void */
    this.gapListeners = new Set()/* ({ coin, from, to, reason }) => void */
    this.state = { connected: false, connectedAt: null, lastMessageAt: null, reconnects: 0, received: 0, accepted: 0, rejected: 0, lateDropped: 0 }
    this.ws = null; this.stopped = true; this.attempt = 0
  }

  /** Track a coin (spec from the verified market list). Safe before or after start(). */
  track(spec) {
    const known = this.specs.get(spec.coin)
    this.specs.set(spec.coin, { coin: spec.coin, priceDecimals: spec.priceDecimals, szDecimals: spec.szDecimals })
    if (!this.books.has(spec.coin)) this.books.set(spec.coin, new MinuteBook({ retainMinutes: this.retainMinutes }))
    if (!known && this.ws && this.state.connected) this.#subscribe(spec.coin)
  }

  /** Seed the last persisted trade time (after a restart) so the first
   *  snapshot's gap is measured from real stored coverage, not from nothing. */
  seedLastTrade(coin, time) {
    if (!(Number.isFinite(time) && time > 0) || this.lastTrade.has(coin)) return
    this.lastTrade.set(coin, time)
    this.seeded.add(coin)   /* the first gap after a seed is a service restart, not a reconnect */
  }

  onSlice(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  onGap(fn) { this.gapListeners.add(fn); return () => this.gapListeners.delete(fn) }

  start() { if (!this.stopped) return; this.stopped = false; this.#connect() }

  stop() {
    this.stopped = true
    clearTimeout(this.retryTimer); clearInterval(this.pingTimer); clearInterval(this.pruneTimer)
    try { this.ws?.close() } catch {}
    this.ws = null
    this.state.connected = false
  }

  health() {
    return { ...this.state, coins: [...this.specs.keys()], duplicates: [...this.books.values()].reduce((s, b) => s + b.duplicates, 0) }
  }

  #connect() {
    if (this.stopped) return
    let ws
    try { ws = new this.WebSocketImpl(this.url) } catch (e) { return this.#scheduleReconnect(e) }
    this.ws = ws
    ws.on('open', () => {
      if (ws !== this.ws) return
      /* backoff is NOT reset here: an upstream that accepts and drops at once must
         keep backing off (Hyperliquid allows 30 new connections per minute per IP).
         It resets on the first message from a working connection (#onMessage). */
      this.state.connected = true; this.state.connectedAt = this.now(); this.state.lastMessageAt = this.now()
      for (const coin of this.specs.keys()) this.#subscribe(coin)
      clearInterval(this.pingTimer)
      this.pingTimer = setInterval(() => this.#heartbeat(ws), this.pingMs)
      this.pingTimer.unref?.()
      clearInterval(this.pruneTimer)
      this.pruneTimer = setInterval(() => { const n = this.now(); for (const b of this.books.values()) b.prune(n) }, 60_000)
      this.pruneTimer.unref?.()
    })
    ws.on('message', (buf) => { if (ws === this.ws) this.#onMessage(buf) })
    ws.on('close', () => { if (ws === this.ws) this.#scheduleReconnect() })
    ws.on('error', (e) => { if (ws === this.ws) { this.log.warn?.('[footprint] upstream error', e?.message); try { ws.terminate?.() } catch {} this.#scheduleReconnect(e) } })
  }

  #heartbeat(ws) {
    if (ws !== this.ws) return
    if (this.now() - (this.state.lastMessageAt || 0) > this.deadMs) { try { ws.terminate?.() ?? ws.close() } catch {} this.#scheduleReconnect(new Error('heartbeat_timeout')); return }
    try { ws.send(JSON.stringify({ method: 'ping' })) } catch {}
  }

  #subscribe(coin) {
    this.awaitingSnapshot.add(coin)
    try { this.ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'trades', coin } })) } catch {}
  }

  #scheduleReconnect(err) {
    if (this.stopped) return
    if (this.state.connected || this.ws) this.state.reconnects++
    this.state.connected = false
    clearInterval(this.pingTimer)
    const old = this.ws; this.ws = null
    try { old?.removeAllListeners?.(); old?.close?.() } catch {}
    clearTimeout(this.retryTimer)
    const base = Math.min(30_000, 1000 * 2 ** Math.min(this.attempt++, 5))
    const delay = base / 2 + Math.random() * base / 2
    if (err) this.log.warn?.('[footprint] reconnecting in', Math.round(delay), 'ms')
    this.retryTimer = setTimeout(() => this.#connect(), delay)
    this.retryTimer.unref?.()
  }

  #onMessage(buf) {
    this.state.lastMessageAt = this.now()
    this.attempt = 0
    let msg
    try { msg = JSON.parse(String(buf)) } catch { return }
    if (msg?.channel !== 'trades' || !Array.isArray(msg.data) || !msg.data.length) return
    const coin = msg.data[0]?.coin
    const spec = this.specs.get(coin), book = this.books.get(coin)
    if (!spec || !book) return
    const trades = []
    for (const raw of msg.data) {
      this.state.received++
      const t = normalizeTrade(raw, spec)
      if (!t) { this.state.rejected++; continue }
      trades.push(t)
    }
    if (!trades.length) return
    /* first batch after a (re)subscribe is the snapshot: detect a gap */
    if (this.awaitingSnapshot.has(coin)) {
      this.awaitingSnapshot.delete(coin)
      const prev = this.lastTrade.get(coin)
      const oldest = Math.min(...trades.map(t => t.time))
      if (prev != null && oldest > prev) this.#emitGap({ coin, from: prev, to: oldest, reason: this.seeded.has(coin) ? 'restart' : 'reconnect' })
      else if (prev == null) this.#emitGap({ coin, from: null, to: oldest, reason: 'coverage_start' })
      this.seeded.delete(coin)
    }
    const floor = this.now() - this.retainMinutes * 60_000
    const changed = new Set()
    for (const t of trades) {
      if (t.time < floor) { this.state.lateDropped++; continue }
      const m = book.add(t)
      if (m == null) continue
      this.state.accepted++
      changed.add(m)
      if (t.time > (this.lastTrade.get(coin) ?? 0)) this.lastTrade.set(coin, t.time)
    }
    for (const minute of changed) {
      const slice = book.slice(minute)
      for (const fn of this.listeners) { try { fn({ coin, minute, slice }) } catch (e) { this.log.warn?.('[footprint] listener', e?.message) } }
    }
  }

  #emitGap(gap) { for (const fn of this.gapListeners) { try { fn(gap) } catch {} } }

  /** Current in-memory slices for a coin in [from, to). */
  slices(coin, from, to) {
    const book = this.books.get(coin)
    if (!book) return []
    const out = []
    for (const t of book.minutes.keys()) if (t >= from && t < to) out.push(book.slice(t))
    return out.sort((a, b) => a.t - b.t)
  }
}
