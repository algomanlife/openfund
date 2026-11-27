/**
 * Open Oracle runtime wiring (ADR 0059) — no network, no database.
 * MarketData executes only on usable composites; the public API publishes
 * composites without provider payloads; the regional mirror follows the
 * upstream SSE stream; configuration is validated at startup.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { MarketData } from '../market-data.js'
import { oracleConfig, oracleRoutes, OracleMirror, compact } from '../open-oracle.js'
import { OpenOracleService } from '../../../packages/open-oracle/src/index.mjs'
import { freshMark } from '../trading-math.js'

const T0 = 1795500000000
class FakeSocket extends EventEmitter { send() {} close() { this.emit('close') } }
const json = body => ({ ok: true, json: async () => body })
const catalog = { data: [
  { symbol: 'BTC/USD', base: 'BTC', quote: 'USD', group: 'crypto', isOpen: true },
  { symbol: 'EUR/USD', base: 'EUR', quote: 'USD', group: 'forex', isOpen: true },
] }

function setup() {
  const clock = { t: T0 }
  const prices = { data: [
    { market: 'BTC/USD', mark: '100000', index: '100000', updatedAt: clock.t },
    { market: 'EUR/USD', mark: '1.1', index: '1.1', updatedAt: clock.t },
  ] }
  const md = new MarketData({ now: () => clock.t, WebSocketImpl: FakeSocket, fetchImpl: async url => json(url.endsWith('/markets') ? catalog : prices) })
  const service = new OpenOracleService({ now: () => clock.t, logger: {} })
  service.external.hyperliquid.inventory = [{ sourceMarketId: 'main/BTC', coin: 'BTC', dex: '', symbol: 'BTC', baseAsset: 'BTC', quoteAsset: 'USD', instrumentType: 'PERPETUAL_UNDERLYING', unit: 'BTC', identityVerified: true, semantics: 'UNDERLYING_REFERENCE', delisted: false }]
  md.attachOracle(service)
  return { md, service, clock }
}
const hl = (service, price, at) => service.accept('hyperliquid', [{ source: 'hyperliquid', sourceMarketId: 'main/BTC', price, timestamp: at, receivedAt: at, timestampKind: 'RECEIPT', semantics: 'UNDERLYING_REFERENCE' }])

test('MARKET_PRICE_SOURCE and OPEN_ORACLE_UPSTREAM are validated at startup', () => {
  assert.deepEqual(oracleConfig({}), { source: 'open-oracle', upstream: null })
  assert.equal(oracleConfig({ MARKET_PRICE_SOURCE: 'GAINS' }).source, 'gains')
  assert.throws(() => oracleConfig({ MARKET_PRICE_SOURCE: 'chainlink' }), /MARKET_PRICE_SOURCE/)
  assert.equal(oracleConfig({ OPEN_ORACLE_UPSTREAM: 'https://openfi.cloud/' }).upstream, 'https://openfi.cloud')
  for (const bad of ['http://openfi.cloud', 'openfi.cloud', 'https://openfi.cloud/api', 'https://u:p@openfi.cloud']) assert.throws(() => oracleConfig({ OPEN_ORACLE_UPSTREAM: bad }), /OPEN_ORACLE_UPSTREAM/, bad)
  assert.equal(oracleConfig({ OPEN_ORACLE_UPSTREAM: 'http://127.0.0.1:8080' }).upstream, 'http://127.0.0.1:8080')
})

test('with an oracle attached the engine executes on composites, not raw Gains quotes', async () => {
  const { md, service, clock } = setup()
  const ticks = []; md.onTick((symbol, mark) => ticks.push([symbol, mark]))
  await md.bootstrap(); md.stop()
  assert.equal(md.gainsMarks.size, 2)
  assert.equal(md.tradeable('BTC/USD').ok, false, 'no composite yet: Gains alone is not the execution price')
  hl(service, '100200', clock.t)
  clock.t += 1000; service.tick()
  const btc = service.get('BTC/USD')
  assert.equal(btc.mode, 'DUAL_SOURCE')
  const t = md.tradeable('BTC/USD')
  assert.equal(t.ok, true); assert.equal(t.mark, btc.price); assert.notEqual(t.mark, '100000')
  assert.equal(md.marks.get('BTC/USD').mode, 'DUAL_SOURCE')
  assert.equal(md.tradeable('EUR/USD').mark, '1.1', 'single-source composites stay executable')
  assert.ok(ticks.some(([symbol, mark]) => symbol === 'BTC/USD' && mark === btc.price))
})

test('divergent composites are kept for valuation but never executable', async () => {
  const { md, service, clock } = setup()
  await md.bootstrap(); md.stop()
  hl(service, '100000', clock.t); clock.t += 1000; service.tick()
  assert.equal(md.tradeable('BTC/USD').ok, true)
  hl(service, '120000', clock.t); clock.t += 1000; service.tick()
  assert.equal(service.get('BTC/USD').mode, 'DIVERGENT')
  assert.deepEqual(md.tradeable('BTC/USD'), { ok: false, reason: 'stale_price' })
  assert.equal(md.mark('BTC/USD').blocked, 'DIVERGENT')
  assert.equal(freshMark(md, 'BTC/USD'), null, 'liquidation and settlement never use a divergent composite')
})

test('composites age out of execution when the service stops evaluating', async () => {
  const { md, service, clock } = setup()
  await md.bootstrap(); md.stop()
  clock.t += 1000; service.tick()
  assert.equal(md.tradeable('EUR/USD').ok, true)
  clock.t += 6000
  assert.deepEqual(md.tradeable('EUR/USD'), { ok: false, reason: 'stale_price' })
})

test('the Gains-only fallback is unchanged without an attached oracle', async () => {
  const md = new MarketData({ now: () => T0, WebSocketImpl: FakeSocket, fetchImpl: async url => json(url.endsWith('/markets') ? catalog : { data: [{ market: 'BTC/USD', mark: '100000', index: '99990', updatedAt: T0 }] }) })
  await md.bootstrap(); md.stop()
  assert.equal(md.tradeable('BTC/USD').mark, '100000')
})

/* minimal Router/response doubles: the routes only use get(), status/set/json, writeHead/write */
function fakeRouter() { const routes = new Map(); return Object.assign(() => ({ get: (path, ...handlers) => routes.set(path, handlers.at(-1)) }), { routes }) }
function response() {
  const res = new EventEmitter(); res.statusCode = 200; res.headers = {}; res.chunks = []
  Object.assign(res, { status(c) { this.statusCode = c; return this }, set(k, v) { this.headers[k] = v; return this }, json(b) { this.body = b; return this },
    writeHead(c, h) { this.statusCode = c; Object.assign(this.headers, h) }, write(c) { this.chunks.push(c); return true }, destroy() { this.emit('close') } })
  return res
}

test('the public API serves composites without provider payloads and streams changes', async () => {
  const { md, service, clock } = setup()
  await md.bootstrap(); md.stop()
  hl(service, '100200', clock.t); clock.t += 1000; service.tick()
  const R = fakeRouter(); let current = null
  const api = oracleRoutes({ Router: R, oracle: () => current, limit: () => (q, s, n) => n(), now: () => clock.t })
  const get = (path, req = {}) => { const res = response(); R.routes.get(path)({ query: {}, params: {}, on() {}, ...req }, res); return res }
  assert.equal(get('/api/oracle/prices').statusCode, 503, 'no oracle on this process: explicit unavailability')
  current = service
  const list = get('/api/oracle/prices')
  assert.equal(list.headers['Cache-Control'], 'no-store'); assert.equal(list.body.source, 'open-oracle')
  assert.deepEqual(Object.keys(list.body.data[0]).sort(), ['at', 'confidence', 'configured', 'eligible', 'market', 'mode', 'price', 'stale'])
  assert.equal(get('/api/oracle/prices/:market', { params: { market: 'btc-usd' } }).body.sources.length, 2)
  assert.equal(get('/api/oracle/prices/:market', { params: { market: 'NOPE-USD' } }).statusCode, 404)
  assert.ok(!JSON.stringify(get('/api/oracle/status').body).includes('rawObservation'))
  const req = new EventEmitter(); req.query = {}; req.params = {}
  const stream = response(); R.routes.get('/api/oracle/stream')(req, stream)
  assert.match(stream.chunks[1], /^event: snapshot\n/)
  hl(service, '100400', clock.t); clock.t += 1000; service.tick()
  assert.ok(stream.chunks.some(c => c.startsWith('event: prices\n') && c.includes('BTC/USD')))
  req.emit('close'); const n = stream.chunks.length
  clock.t += 1000; hl(service, '100600', clock.t); service.tick()
  assert.equal(stream.chunks.length, n, 'a closed stream is unsubscribed'); assert.equal(service.listeners.size, 1)
  api.close()
})

test('the regional mirror follows the upstream stream and reports its freshness', async () => {
  let now = T0
  const mirror = new OracleMirror({ upstream: 'https://global.invalid', now: () => now, logger: {} })
  const record = { market: 'BTC/USD', price: '100100', mode: 'TRIPLE_SOURCE', confidence: 91, stale: false, at: T0, eligible: 3, configured: 3 }
  const encoder = new TextEncoder()
  async function* body() {
    yield encoder.encode('retry: 3000\n\n')
    yield encoder.encode(`event: snapshot\ndata: ${JSON.stringify({ at: T0, data: [record] })}\n\nevent: pri`)
    yield encoder.encode(`ces\ndata: ${JSON.stringify({ at: T0 + 1000, data: [{ ...record, price: '100200', at: T0 + 1000 }] })}\n\n: heartbeat\n\n`)
  }
  const seen = []; mirror.onUpdate(changed => seen.push(...changed.map(r => r.price)))
  await mirror.consume(body())
  assert.deepEqual(seen, ['100100', '100200'])
  assert.deepEqual(compact(mirror.get('BTC/USD')), { ...record, price: '100200', at: T0 + 1000 })
  assert.equal(mirror.status().mirror.connected, true)
  now += 31000; assert.equal(mirror.status().mirror.connected, false)
})

test('Open Oracle market API: catalog, validated candles closed at the composite, cached book', async () => {
  const { oracleMarketData } = await import('../open-oracle.js')
  const calls = []
  let clock = 1_800_000_000_000
  const markets = new Map([['BTC/USD', { symbol: 'BTC/USD', base: 'BTC', pairIndex: 0 }], ['X/USD', { symbol: 'X/USD', base: 'X' }]])
  const fetchImpl = async url => {
    calls.push(String(url))
    const body = String(url).includes('/candles')
      ? { data: [{ time: clock - 3_600_000, open: 100, high: 110, low: 90, close: 105 }, { time: clock - 60_000, open: 105, high: 106, low: 104, close: 105 }] }
      : { market: 'BTC/USD', markPrice: 105, timestamp: clock, bids: [], asks: [] }
    return { ok: true, json: async () => body }
  }
  const api = oracleMarketData({ markets: () => markets, oracle: () => ({ get: () => ({ price: 120, stale: false }) }), fetchImpl, now: () => clock })
  assert.deepEqual((await api.catalog()).data, [{ symbol: 'BTC/USD', base: 'BTC', pairIndex: 0 }])
  const candles = await api.candles('BTC-USD', '1h', clock - 7_200_000, clock)
  assert.equal(candles.source, 'open-oracle')
  assert.deepEqual(candles.data.at(-1), { time: clock - 60_000, open: 105, high: 120, low: 104, close: 120 })
  await assert.rejects(api.candles('ETH-USD', '1h', 0, clock), /invalid_request/)
  await assert.rejects(api.candles('BTC-USD', '1w', 0, clock), /invalid_request/)
  await assert.rejects(api.candles('../x', '1h', 0, clock), /invalid_request/)
  await api.book('BTC/USD', 15); await api.book('BTC/USD', 15)
  assert.equal(calls.filter(u => u.includes('/book')).length, 1, 'book cached for one second')
  clock += 1_500
  await api.book('BTC/USD', 15)
  assert.equal(calls.filter(u => u.includes('/book')).length, 2)
  assert.ok(calls.every(u => u.startsWith('https://api.gains.trade/v1/arbitrum/markets/')))
})
