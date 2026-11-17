/* Deterministic market feed implementing the MarketData surface the engine
   uses; a price is fresh when set and stale (untradeable) when cleared. */
export class FakeMarket {
  constructor() {
    this.prices = new Map()
    this.meta = new Map([
      ['XSOL/USD', { symbol: 'XSOL/USD', group: 'crypto', base: 'SOL', quote: 'USD', maxLeverage: 100, isOpen: true }],
    ])
  }
  set(symbol, price) { if (price == null) this.prices.delete(symbol); else this.prices.set(symbol, String(price)) }
  marketMeta(symbol) { return this.meta.get(symbol) || null }
  mark(symbol) {
    const p = this.prices.get(symbol)
    return p == null ? null : { mark: p, at: Date.now(), injected: true }
  }
  tradeable(symbol) {
    const meta = this.meta.get(symbol)
    if (!meta) return { ok: false, reason: 'unknown_market' }
    const m = this.mark(symbol)
    if (!m) return { ok: false, reason: 'stale_price' }
    return { ok: true, meta, mark: m.mark }
  }
}
