/**
 * Footprint service: ingestion (dedup, gaps, reconnect, privacy), feature flag,
 * HTTP/SSE contract, fan-out sharing, and module isolation.
 *
 * Upstream is a FAKE socket fed with hand-built trades in the documented
 * Hyperliquid WsTrade shape (test inputs, not market data). The optional
 * Postgres part runs only against an isolated test DATABASE_URL.
 * Run: node --test test/footprint.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { readFileSync, readdirSync } from 'node:fs'
import http from 'node:http'
import express from 'express'
import pg from 'pg'
import { HyperliquidTradeFeed } from '../footprint/feed.js'
import { createFootprintService, StreamHub, FootprintStore, baseRowUnits } from '../footprint/service.js'

class FakeSocket extends EventEmitter {
  static all = []
  constructor(url) { super(); this.url = url; this.sent = []; FakeSocket.all.push(this) }
  send(s) { this.sent.push(JSON.parse(s)) }
  close() { this.emit('close') }
  terminate() { this.emit('close') }
  trades(list) { this.emit('message', Buffer.from(JSON.stringify({ channel: 'trades', data: list }))) }
}
const T0 = Date.UTC(2026, 10, 12, 12, 0, 0)
const trade = (o) => ({ coin: 'BTC', side: 'B', px: '100000.0', sz: '0.00100', time: T0 + 1000, tid: 1, hash: '0xdead', users: ['0xbuyer', '0xseller'], ...o })
const quietLog = { warn() {} }
const spec = { coin: 'BTC', priceDecimals: 1, szDecimals: 5 }

function newFeed(clock) {
  FakeSocket.all = []
  return new HyperliquidTradeFeed({ WebSocketImpl: FakeSocket, now: () => clock.t, log: quietLog })
}

test('feed: one upstream socket subscribes every tracked coin; snapshot replay is deduplicated', () => {
  const clock = { t: T0 + 5000 }
  const feed = newFeed(clock)
  feed.track(spec); feed.track({ coin: 'xyz:GOLD', priceDecimals: 2, szDecimals: 4 })
  const slices = []
  feed.onSlice(e => slices.push(e))
  feed.start()
  const ws = FakeSocket.all[0]
  ws.emit('open')
  assert.equal(FakeSocket.all.length, 1)
  assert.deepEqual(ws.sent.map(m => m.subscription.coin).sort(), ['BTC', 'xyz:GOLD'])
  ws.trades([trade({ tid: 1 }), trade({ tid: 2, side: 'A' })])     // snapshot
  ws.trades([trade({ tid: 2, side: 'A' }), trade({ tid: 3 })])     // live, tid 2 repeated
  const s = feed.books.get('BTC').slice(T0)
  assert.equal(s.n, 3)
  assert.deepEqual(s.levels, [[1000000, 100, 200, 1, 2]])
  assert.equal(feed.health().duplicates, 1)
  feed.stop()
})

test('feed: trades never retain counterparty addresses or hashes', () => {
  const clock = { t: T0 + 5000 }
  const feed = newFeed(clock); feed.track(spec)
  const seen = []
  feed.onSlice(e => seen.push(JSON.stringify(e)))
  feed.start(); FakeSocket.all[0].emit('open')
  FakeSocket.all[0].trades([trade({})])
  assert.ok(seen.length > 0)
  for (const s of seen) assert.ok(!s.includes('0xbuyer') && !s.includes('0xseller') && !s.includes('0xdead'))
  feed.stop()
})

test('feed: reconnect records a gap when the snapshot does not reach back to the last trade', async () => {
  const clock = { t: T0 + 5000 }
  const feed = newFeed(clock); feed.track(spec)
  const gaps = []
  feed.onGap(g => gaps.push(g))
  feed.start()
  let ws = FakeSocket.all[0]; ws.emit('open')
  ws.trades([trade({ tid: 1, time: T0 + 1000 })])
  assert.deepEqual(gaps.map(g => g.reason), ['coverage_start'])
  ws.emit('close')
  await new Promise(r => setTimeout(r, 1100))   // backoff (first retry 0.5–1 s)
  ws = FakeSocket.all.at(-1)
  assert.notEqual(ws, FakeSocket.all[0], 'a new socket was opened')
  ws.emit('open')
  clock.t = T0 + 120_000
  ws.trades([trade({ tid: 9, time: T0 + 90_000 })])
  assert.equal(gaps.at(-1).reason, 'reconnect')
  assert.equal(gaps.at(-1).from, T0 + 1000)
  assert.equal(gaps.at(-1).to, T0 + 90_000)
  assert.ok(feed.health().reconnects >= 1)
  feed.stop()
})

test('feed: an upstream that accepts then drops keeps backing off (no reconnect storm)', async () => {
  const clock = { t: T0 }
  const feed = newFeed(clock); feed.track(spec)
  feed.start()
  const delays = []
  const realSetTimeout = global.setTimeout
  global.setTimeout = (fn, ms) => { delays.push(ms); return realSetTimeout(() => {}, 0) }
  try {
    for (let i = 0; i < 6; i++) { const ws = FakeSocket.all.at(-1); ws.emit('open'); ws.emit('close'); FakeSocket.all.push(new FakeSocket('x')); feed['ws'] = FakeSocket.all.at(-1); }
  } finally { global.setTimeout = realSetTimeout }
  /* each retry's minimum (half the base) must grow: 0.5 s, 1 s, 2 s, 4 s, 8 s, 15 s */
  const floors = [500, 1000, 2000, 4000, 8000, 15000]
  delays.slice(0, 6).forEach((d, i) => assert.ok(d >= floors[i], `retry ${i}: ${d} ms`))
  feed.stop()
})

test('feed: a snapshot overlapping the last seen trade records no gap', () => {
  const clock = { t: T0 + 5000 }
  const feed = newFeed(clock); feed.track(spec)
  const gaps = []
  feed.onGap(g => gaps.push(g))
  feed.seedLastTrade('BTC', T0 + 2000)
  feed.start(); FakeSocket.all[0].emit('open')
  FakeSocket.all[0].trades([trade({ tid: 4, time: T0 + 1500 }), trade({ tid: 5, time: T0 + 3000 })])
  assert.equal(gaps.length, 0)
  feed.stop()
})

test('feed: after a service restart the stored coverage edge opens a "restart" gap', () => {
  const clock = { t: T0 + 600_000 }
  const feed = newFeed(clock); feed.track(spec)
  const gaps = []
  feed.onGap(g => gaps.push(g))
  feed.seedLastTrade('BTC', T0 + 2000)
  feed.start(); FakeSocket.all[0].emit('open')
  FakeSocket.all[0].trades([trade({ tid: 4, time: T0 + 500_000 })])
  assert.deepEqual(gaps, [{ coin: 'BTC', from: T0 + 2000, to: T0 + 500_000, reason: 'restart' }])
  feed.stop()
})

test('feed: malformed and too-old trades are rejected, not coerced', () => {
  const clock = { t: T0 + 400 * 60_000 }
  const feed = newFeed(clock); feed.track(spec)
  feed.start(); FakeSocket.all[0].emit('open')
  FakeSocket.all[0].trades([trade({ side: '?' }), trade({ px: 'abc', tid: 2 }), trade({ tid: 3 })])
  const h = feed.health()
  assert.equal(h.rejected, 2)
  assert.equal(h.lateDropped, 1, 'older than the in-memory window')
  feed.stop()
})

test('flag off: every footprint route answers 404 and nothing starts', async () => {
  const svc = createFootprintService({ env: {}, log: quietLog })
  assert.equal(svc.enabled, false)
  await svc.start()
  const app = express(); app.use(svc.router)
  const srv = app.listen(0); const port = srv.address().port
  for (const p of ['markets', 'history?symbol=BTC/USD&tf=1&from=0&to=1', 'stream?symbol=BTC/USD', 'health']) {
    const r = await fetch(`http://127.0.0.1:${port}/api/footprint/${p}`)
    assert.equal(r.status, 404)
    assert.equal((await r.json()).error, 'footprint_disabled')
  }
  srv.close()
})

function metaFetch() {
  const main = { universe: [{ name: 'BTC', szDecimals: 5 }, { name: 'ETH', szDecimals: 4 }, { name: 'SOL', szDecimals: 2 }] }
  const xyz = { universe: [{ name: 'xyz:GOLD', szDecimals: 4 }, { name: 'xyz:SILVER', szDecimals: 2 }, { name: 'xyz:EUR', szDecimals: 1 }, { name: 'xyz:JPY', szDecimals: 2 }] }
  return async (url, init) => ({ ok: true, json: async () => (JSON.parse(init.body).dex === 'xyz' ? xyz : main) })
}

/* TEST calibration (not measured data): a tight band so every listed market verifies */
const TEST_CAL = { measuredAt: 'test', method: 'test fixture', markets: Object.fromEntries(['BTC/USD', 'ETH/USD', 'SOL/USD', 'XAU/USD', 'XAG/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY'].map(g => [g, { n: 100, medianBps: 3, madBps: 1, p05Bps: 1, p95Bps: 5, p99Bps: 6, maxAbsBps: 7 }])) }
async function startEnabled(clock, calibration = TEST_CAL) {
  const feed = newFeed(clock)
  const svc = createFootprintService({ env: { FOOTPRINT_ENABLED: '1' }, fetchImpl: metaFetch(), feed, now: () => clock.t, log: quietLog, calibration })
  await svc.start()
  const app = express(); app.use(svc.router)
  const srv = app.listen(0)
  return { svc, feed, srv, base: `http://127.0.0.1:${srv.address().port}` }
}

test('markets: verified against the live meta universe; unlisted candidates are unsupported', async () => {
  const clock = { t: T0 + 5000 }
  const { svc, srv, base } = await startEnabled(clock)
  const j = await (await fetch(base + '/api/footprint/markets')).json()
  const by = Object.fromEntries(j.markets.map(m => [m.gains, m]))
  assert.equal(j.markets.length, 8)
  assert.equal(by['GBP/USD'].status, 'unsupported', 'xyz:GBP missing from the fake universe')
  assert.deepEqual(by['GBP/USD'].reasons, ['market_not_listed'])
  for (const g of ['BTC/USD', 'XAU/USD', 'USD/JPY']) assert.equal(by[g].status, 'supported', g)
  assert.equal(by['BTC/USD'].priceDecimals, 1)
  const h = await fetch(base + '/api/footprint/history?symbol=GBP/USD&tf=1&from=0&to=1')
  assert.equal(h.status, 404)
  await svc.stop(); srv.close()
})

test('markets: without measured calibration nothing is reported supported', async () => {
  const clock = { t: T0 + 5000 }
  const { svc, srv, base } = await startEnabled(clock, { markets: {} })
  const j = await (await fetch(base + '/api/footprint/markets')).json()
  assert.ok(j.markets.every(m => m.status === 'unsupported'))
  assert.ok(j.markets.filter(m => m.gains !== 'GBP/USD').every(m => m.reasons.includes('basis_not_measured')))
  await svc.stop(); srv.close()
})

test('history: closed minutes only, exact levels, timeframe re-bucketing, validation', async () => {
  const clock = { t: T0 + 3 * 60_000 + 10_000 }
  const { svc, feed, srv, base } = await startEnabled(clock)
  const ws = FakeSocket.all[0]; ws.emit('open')
  ws.trades([
    trade({ tid: 1, time: T0 + 1000, side: 'B', sz: '0.00100' }),
    trade({ tid: 2, time: T0 + 61_000, side: 'A', sz: '0.00300', px: '100001.0' }),
    trade({ tid: 3, time: T0 + 3 * 60_000 + 5000, side: 'B' }),      // forming minute
  ])
  const r = await fetch(`${base}/api/footprint/history?symbol=BTC/USD&tf=5&from=${T0}&to=${T0 + 5 * 60_000}`)
  const j = await r.json()
  assert.equal(j.to, T0 + 3 * 60_000, 'history ends at the forming minute')
  assert.equal(j.bars.length, 1)
  assert.deepEqual(j.bars[0].rows, [[1000000, 0, 100, 0, 1], [1000010, 300, 0, 1, 0]])
  assert.equal(j.source, 'hyperliquid-trades')
  assert.equal((await fetch(`${base}/api/footprint/history?symbol=BTC/USD&tf=7&from=0&to=1`)).status, 400)
  assert.equal((await fetch(`${base}/api/footprint/history?symbol=BTC/USD&tf=1&from=5&to=1`)).status, 400)
  feed.stop(); await svc.stop(); srv.close()
})

function sse(url) {
  return new Promise((resolve) => {
    const events = []
    const req = http.get(url, (res) => {
      res.setEncoding('utf8')
      let buf = ''
      res.on('data', (c) => { buf += c; let i; while ((i = buf.indexOf('\n\n')) >= 0) { const raw = buf.slice(0, i); buf = buf.slice(i + 2); const ev = /event: (\w+)/.exec(raw)?.[1]; const data = /data: (.*)/.exec(raw)?.[1]; if (ev) events.push({ ev, data: JSON.parse(data) }) } })
      resolve({ events, close: () => req.destroy(), status: res.statusCode })
    })
  })
}

test('stream: status on connect, recent minutes replayed, live slices fanned out to every client', async () => {
  const clock = { t: T0 + 30_000 }
  const { svc, srv, base } = await startEnabled(clock)
  const ws = FakeSocket.all[0]; ws.emit('open')
  ws.trades([trade({ tid: 1, time: T0 + 1000 })])
  const clients = await Promise.all(Array.from({ length: 25 }, () => sse(`${base}/api/footprint/stream?symbol=BTC/USD`)))
  await new Promise(r => setTimeout(r, 50))
  for (const c of clients) {
    assert.equal(c.status, 200)
    assert.equal(c.events[0].ev, 'status')
    assert.equal(c.events[1].ev, 'slices', 'forming minute replayed on connect')
  }
  ws.trades([trade({ tid: 2, time: T0 + 2000, side: 'A' })])
  await new Promise(r => setTimeout(r, 700))   // hub flushes every 500 ms
  for (const c of clients) {
    const last = c.events.filter(e => e.ev === 'slices').at(-1)
    assert.equal(last.data.slices[0].n, 2)
  }
  assert.equal(svc.hub.count, 25)
  assert.equal(FakeSocket.all.length, 1, '25 viewers, one upstream connection')
  clients.forEach(c => c.close())
  await new Promise(r => setTimeout(r, 50))
  assert.equal(svc.hub.count, 0, 'closed streams leave the hub')
  await svc.stop(); srv.close()
})

test('hub: one serialization per coin batch; nothing buffered without subscribers; slow clients dropped', () => {
  const hub = new StreamHub({ flushMs: 1e9, heartbeatMs: 1e9 })
  hub.push('BTC', { t: 1 })
  assert.equal(hub.pending.size, 0)
  const writes = []
  const mk = (writableLength = 0) => ({ writableLength, write: (f) => writes.push(f), end() {} })
  const a = mk(), b = mk(), slow = mk(2 << 20)
  hub.join('BTC', a); hub.join('BTC', b); hub.join('BTC', slow)
  hub.push('BTC', { t: 1, levels: [] })
  hub.flush()
  assert.equal(writes.length, 2)
  assert.equal(writes[0], writes[1], 'same frame string reused')
  assert.equal(hub.count, 2)
  hub.stop()
})

test('hub: capacity limit refuses extra streams', () => {
  const hub = new StreamHub({ maxStreams: 1, flushMs: 1e9, heartbeatMs: 1e9 })
  assert.equal(hub.join('BTC', {}), true)
  assert.equal(hub.join('BTC', {}), false)
  hub.stop()
})

test('baseRowUnits keeps every bar under the row cap with a nice step', () => {
  assert.equal(baseRowUnits([{ rows: [[0], [100]] }]), 1)
  assert.equal(baseRowUnits([{ rows: [[0], [1000]] }], 600), 2)
  assert.equal(baseRowUnits([{ rows: [[0], [20000]] }], 600), 50)
})

test('isolation: footprint modules import nothing from trading, accounts, wallets, payments or CMS', () => {
  const dir = new URL('../footprint/', import.meta.url)
  const forbidden = /(engine|portfolio|accounts|purchases|payment|treasury|coupons|admin|evaluation|live-funding|market-data|governance|partners|economy|referrals|products|siwe|directus|backstage)/
  for (const f of readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8')
    for (const m of src.matchAll(/^import .* from ['"]([^'"]+)['"]/gm)) assert.ok(!forbidden.test(m[1]), `${f} imports ${m[1]}`)
    assert.ok(!/router\.(post|put|patch|delete)\(/.test(src), `${f} exposes no write endpoint`)
  }
  const server = readFileSync(new URL('../server.js', import.meta.url), 'utf8')
  const code = server.split('\n').filter(l => /footprint/.test(l) && !/^\s*(\/\*|\*|\/\/)/.test(l)).map(l => l.trim())
  /* the service is constructed from the DB pool only (no engine, market data, accounts) … */
  assert.deepEqual(code.filter(l => l.includes('createFootprintService(')), ['const footprint = createFootprintService({ mainPool: pool })'])
  /* … and is otherwise only imported, mounted, started and stopped */
  for (const l of code) assert.match(l, /^(import \{ createFootprintService \} from '\.\/footprint\/service\.js'|const footprint = createFootprintService\(\{ mainPool: pool \}\)|app\.use\(footprint\.router\)|(?:if \(hasRole\(region, 'footprint'\)\) )?footprint\.start\(\)\.catch\(.*\)|const shutdown = .*footprint\.stop\(\).*|isolated from the engine.*|.*inert unless FOOTPRINT_ENABLED=1.*)$/, l)
})

const dbUrl = process.env.DATABASE_URL || ''
test('store: Postgres upsert, gap and retention (isolated test DB only)', { skip: !/test|_ci/.test(dbUrl) && 'no isolated test DATABASE_URL' }, async () => {
  const pool = new pg.Pool({ connectionString: dbUrl })
  await pool.query(readFileSync(new URL('../footprint/schema.sql', import.meta.url), 'utf8'))
  await pool.query("DELETE FROM footprint_minutes WHERE coin = 'TESTCOIN'"); await pool.query("DELETE FROM footprint_gaps WHERE coin = 'TESTCOIN'")
  const store = new FootprintStore(pool)
  const sp = { coin: 'TESTCOIN', priceDecimals: 1, szDecimals: 5 }
  store.mark('TESTCOIN', sp, { t: T0, levels: [[1, 2, 3, 1, 1]], lastPu: 1, lastTime: T0 + 1, n: 2 })
  assert.equal(await store.flush(), 1)
  store.mark('TESTCOIN', sp, { t: T0, levels: [[1, 2, 5, 1, 2]], lastPu: 1, lastTime: T0 + 2, n: 3 })
  await store.flush()
  const rows = await store.slices('TESTCOIN', T0, T0 + 60_000, sp)
  assert.deepEqual(rows, [{ t: T0, levels: [[1, 2, 5, 1, 2]], lastPu: 1, lastTime: T0 + 2, n: 3 }])
  assert.deepEqual(await store.slices('TESTCOIN', T0, T0 + 60_000, { ...sp, priceDecimals: 2 }), [], 'precision change is never rescaled')
  await store.gap({ coin: 'TESTCOIN', from: T0, to: T0 + 5, reason: 'reconnect' })
  assert.equal((await store.gaps('TESTCOIN', T0, T0 + 60_000)).length, 1)
  assert.equal((await store.lastTrades()).get('TESTCOIN'), T0 + 2)
  await store.prune(1, T0 + 2 * 86_400_000)
  assert.deepEqual(await store.slices('TESTCOIN', T0, T0 + 60_000, sp), [])
  await pool.end()
})
