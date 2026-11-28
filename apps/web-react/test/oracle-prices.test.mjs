/* Browser price source (ADR 0059): the shared adapter reads Open Oracle
   composites from the same origin and falls back to the Gains socket only
   when the origin serves no Open Oracle, saying which source is live.
   The shipped script runs unmodified in a minimal window; only fetch,
   EventSource and WebSocket are faked. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../public/legacy/gains-adapter.js', import.meta.url), 'utf8')
const record = (market, price, extra = {}) => ({ market, price, mode: 'TRIPLE_SOURCE', confidence: 92, stale: false, at: 1000, eligible: 3, configured: 3, ...extra })

function load({ oracle = 'ok', gains = [{ market: 'BTC/USD', mark: '100', index: '99', updatedAt: 1000 }], immediateTimers = false } = {}) {
  const timer = immediateTimers ? (fn => { queueMicrotask(fn); return 0 }) : setTimeout
  const streams = [], sockets = [], fetched = []
  class FakeEventSource {
    constructor(url) { this.url = url; this.readyState = 0; this.listeners = {}; streams.push(this) }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn) }
    emit(type, body) { for (const fn of this.listeners[type] || []) fn({ data: JSON.stringify(body) }) }
    close() { this.readyState = 2 }
  }
  class FakeSocket { constructor(url) { this.url = url; this.sent = []; sockets.push(this) } send(x) { this.sent.push(JSON.parse(x)) } close() {} }
  const fetch = async url => {
    fetched.push(url)
    if (url.startsWith('/api/oracle/')) {
      if (oracle === 'missing') return { ok: false, status: 404, json: async () => ({ error: 'not_found' }) }
      if (oracle === 'empty') return { ok: true, status: 200, json: async () => ({ source: 'open-oracle', data: [] }) }
      return { ok: true, status: 200, json: async () => ({ source: 'open-oracle', data: [record('BTC/USD', '101.5'), record('AAPL/USD', null, { mode: 'MARKET_CLOSED' })] }) }
    }
    return { ok: true, status: 200, json: async () => ({ data: gains }) }
  }
  const window = { fetch, EventSource: FakeEventSource, WebSocket: FakeSocket, AbortSignal, setTimeout, clearTimeout, setInterval: undefined }
  window.window = window
  vm.runInNewContext(source, { window, fetch, EventSource: FakeEventSource, WebSocket: FakeSocket, AbortSignal, setTimeout: timer, clearTimeout, console })
  return { G: window.OpenfundGains, streams, sockets, fetched }
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

test('prices come from the same-origin Open Oracle, never relabelled', async () => {
  const { G, streams, sockets } = load()
  const snapshot = await G.priceSnapshot()
  assert.deepEqual(snapshot.map(p => [p.market, p.mark, p.source]), [['BTC/USD', '101.5', 'open-oracle']], 'composites without a price are skipped')
  assert.equal(G.priceSource(), 'open-oracle')
  const seen = [], statuses = []
  G.subscribeStatus((s, info) => statuses.push([s, info.source]))
  G.subscribePrices(p => seen.push(p)); await flush()
  assert.equal(streams.length, 1); assert.equal(streams[0].url, '/api/oracle/stream'); assert.equal(sockets.length, 0, 'no Gains socket while Open Oracle serves')
  streams[0].emit('snapshot', { at: 1000, data: [record('BTC/USD', '101.5')] })
  streams[0].emit('prices', { at: 2000, data: [record('BTC/USD', '102', { mode: 'DUAL_SOURCE' })] })
  assert.deepEqual(seen.map(p => [p.mark, p.source, p.mode]), [[101.5, 'open-oracle', 'TRIPLE_SOURCE'], [102, 'open-oracle', 'DUAL_SOURCE']])
  assert.deepEqual(statuses.at(-1), ['live', 'open-oracle'])
})

test('a stale composite reaches the board flagged and never prints a chart bar', async () => {
  const { G, streams } = load()
  const seen = []; G.subscribePrices(p => seen.push(p)); await flush()
  const bars = []; G.createVelaProvider().subscribe('BTC/USD', '1', bar => bars.push(bar))
  streams[0].emit('prices', { at: 3000, data: [record('BTC/USD', '99', { stale: true, mode: 'DIVERGENT' })] })
  assert.equal(seen.at(-1).stale, true); assert.equal(bars.length, 0)
  streams[0].emit('prices', { at: 4000, data: [record('BTC/USD', '100')] })
  assert.equal(bars.length, 1); assert.equal(bars[0].close, 100)
})

for (const oracle of ['missing', 'empty']) test(`an origin without Open Oracle (${oracle}) falls back to the Gains socket and says so`, async () => {
  const { G, streams, sockets } = load({ oracle })
  const snapshot = await G.priceSnapshot()
  assert.equal(snapshot[0].mark, '100'); assert.equal(G.priceSource(), 'gains')
  G.subscribePrices(() => {}); await flush()
  assert.equal(streams.length, 0); assert.equal(sockets.length, 1); assert.match(sockets[0].url, /api\.gains\.trade/)
})

test('a stream that never delivers falls back to the Gains socket, labelled as such', async () => {
  const { G, streams, sockets } = load({ immediateTimers: true })
  await G.priceSnapshot(); G.subscribePrices(() => {}); await flush()
  for (let i = 0; i < 6 && !sockets.length; i++) { const s = streams.at(-1); s.readyState = 2; s.onerror(); await flush() }
  assert.equal(streams.length, 5, 'four retries after the first refusal'); assert.equal(sockets.length, 1); assert.equal(G.priceSource(), 'gains')
})

test('a stream that has delivered keeps reconnecting to Open Oracle', async () => {
  const { G, streams, sockets } = load({ immediateTimers: true })
  await G.priceSnapshot(); G.subscribePrices(() => {}); await flush()
  streams[0].emit('snapshot', { at: 1000, data: [record('BTC/USD', '101')] })
  for (let i = 0; i < 6; i++) { const s = streams.at(-1); s.readyState = 2; s.onerror(); await flush() }
  assert.equal(sockets.length, 0); assert.equal(G.priceSource(), 'open-oracle'); assert.equal(streams.length, 7)
})

/* catalog and candle reads: only an origin without the Open Oracle routes
   switches the session to the venue feed */
function loadRest(oracleReply) {
  const fetched = []
  const fetch = async url => {
    fetched.push(url)
    if (url.startsWith('/api/oracle/')) return oracleReply(url)
    return { ok: true, status: 200, json: async () => ({ data: url.includes('/candles') ? [{ time: 1, open: 1, high: 1, low: 1, close: 1 }] : [{ symbol: 'BTC/USD', pairIndex: 0 }] }) }
  }
  const window = { fetch, AbortSignal, setTimeout, clearTimeout }
  window.window = window
  vm.runInNewContext(source, { window, fetch, AbortSignal, setTimeout, clearTimeout, console })
  return { G: window.OpenfundGains, fetched }
}
const venue = urls => urls.filter(u => u.startsWith('https://api.gains.trade'))
const oracleCandles = { ok: true, status: 200, json: async () => ({ data: [{ time: 2, open: 2, high: 2, low: 2, close: 2 }] }) }

test('a busy Open Oracle catalog falls back for that read only; candles stay on Open Oracle', async () => {
  let busy = true
  const { G, fetched } = loadRest(url => url.endsWith('/markets') && busy
    ? { ok: false, status: 429, json: async () => ({ error: 'rate_limited' }) } : oracleCandles)
  assert.equal((await G.rest('/markets')).length, 1)
  assert.equal(venue(fetched).length, 1, 'the catalog read used the venue once')
  busy = false
  const bars = await G.fetchCandles('BTC/USD', '1h', 0, 10)
  assert.equal(bars[0].close, 2, 'candles still come from Open Oracle')
  assert.equal(venue(fetched).length, 1)
})

test('an empty Open Oracle catalog reads the venue catalog; candles stay on Open Oracle', async () => {
  const { G, fetched } = loadRest(url => url.endsWith('/markets')
    ? { ok: true, status: 200, json: async () => ({ data: [] }) } : oracleCandles)
  assert.equal((await G.rest('/markets')).length, 1)
  assert.equal((await G.fetchCandles('BTC/USD', '1h', 0, 10))[0].close, 2)
  assert.deepEqual(venue(fetched).map(u => u.split('/arbitrum')[1]), ['/markets'])
})

test('an origin without the Open Oracle routes (404) reads the venue for the session', async () => {
  const { G, fetched } = loadRest(() => ({ ok: false, status: 404, json: async () => ({}) }))
  await G.rest('/markets')
  assert.equal((await G.fetchCandles('BTC/USD', '1h', 0, 10))[0].close, 1)
  assert.equal(fetched.filter(u => u.startsWith('/api/oracle/')).length, 1, 'Open Oracle is not asked again')
})
