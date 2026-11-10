/**
 * Gains market-data CONTRACT tests — recorded fixtures, no network.
 *
 * These pin the stable internal contract of apps/backend/market-data.js so a Gains
 * API change (or a dependency update such as `ws`) is detected here, in the
 * integration layer, and never inside the trading engine:
 *   symbols/metadata, prices and precision, mark vs index semantics, WebSocket
 *   updates, sequence-gap resync, ping/pong, reconnection, freshness/stale handling.
 * The optional live comparison is `npm run check:gains-live` (network, read-only).
 */
import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import { MarketData, quoteRecord } from '../market-data.js'

const fx = (n) => JSON.parse(readFileSync(new URL(`./fixtures/gains/${n}.json`, import.meta.url), 'utf8'))
const markets = fx('markets')
const prices = fx('prices')
const session = fx('ws-session')
const NOW = Math.max(...prices.data.map((p) => p.updatedAt), ...session.messages.flatMap((m) => (m.data ?? []).map((p) => p.updatedAt))) + 1000

class FakeSocket extends EventEmitter {
  static instances = []
  constructor() { super(); this.sent = []; this.closed = false; FakeSocket.instances.push(this) }
  send(x) { this.sent.push(JSON.parse(x)) }
  close() { this.closed = true; this.emit('close') }
  push(msg) { this.emit('message', Buffer.from(JSON.stringify(msg))) }
}
const json = (body, ok = true) => ({ ok, json: async () => body })

function make(overrides = {}) {
  FakeSocket.instances = []
  let clock = NOW
  const md = new MarketData({
    now: () => clock,
    WebSocketImpl: FakeSocket,
    fetchImpl: async (url) => (url.endsWith('/markets') ? json(markets) : json(prices)),
    ...overrides,
  })
  return { md, tick: (ms) => { clock += ms }, set: (t) => { clock = t }, socket: () => FakeSocket.instances.at(-1) }
}
async function started(overrides) {
  const ctx = make(overrides)
  await ctx.md.bootstrap()
  ctx.socket().emit('open')
  return ctx
}

test('recorded markets expose the metadata the platform relies on', () => {
  for (const m of markets.data) {
    assert.match(m.symbol, /^[A-Z0-9.]+\/[A-Z]+$/)
    assert.equal(typeof m.isOpen, 'boolean')
    assert.ok(Number.isInteger(m.pricePrecision) && m.pricePrecision >= 0)
    assert.ok(Number(m.maxLeverage) >= Number(m.minLeverage) && Number(m.minLeverage) > 0)
    assert.ok(['crypto', 'forex', 'stocks', 'indices', 'commodities'].includes(m.group))
  }
})

test('bootstrap loads metadata and prices keyed by symbol; unknown markets are not tradeable', async () => {
  const { md } = await started()
  md.stop()
  assert.equal(md.marketMeta('BTC/USD').pricePrecision, 1)
  assert.equal(md.marketMeta('EUR/USD').pricePrecision, 5)
  assert.equal(md.marketMeta('NOPE/USD'), null)
  assert.deepEqual(md.tradeable('NOPE/USD'), { ok: false, reason: 'unknown_market' })
})

test('mark and index stay separate; the engine reads the mark', async () => {
  const { md, set } = await started()
  md.stop()
  const btc = prices.data.find((p) => p.market === 'BTC/USD')
  set(btc.updatedAt + 1000)
  assert.notEqual(btc.mark, btc.index, 'fixture must carry differing mark and index to prove the distinction')
  assert.equal(md.mark('BTC/USD').mark, btc.mark)
  assert.equal(md.marks.get('BTC/USD').index, btc.index)
  assert.equal(md.tradeable('BTC/USD').mark, btc.mark)
})

test('closed markets are rejected even with a fresh price', async () => {
  const { md } = await started()
  md.stop()
  md.marks.set('AAPL/USD', { mark: '200', index: '200', at: NOW, updatedAt: NOW })
  assert.deepEqual(md.tradeable('AAPL/USD'), { ok: false, reason: 'market_closed' })
})

test('quoteRecord normalises timestamps and rejects malformed prices', () => {
  const ms = quoteRecord({ market: 'X', mark: '1.5', updatedAt: NOW - 500 }, NOW)
  assert.equal(ms.mark, '1.5'); assert.equal(ms.index, null); assert.equal(ms.at, NOW - 500)
  const seconds = quoteRecord({ market: 'X', mark: '1', updatedAt: Math.floor((NOW - 2000) / 1000) }, NOW)
  assert.equal(seconds.at, Math.floor((NOW - 2000) / 1000) * 1000, 'epoch seconds are converted to ms')
  const iso = quoteRecord({ market: 'X', mark: '1', updatedAt: new Date(NOW - 1000).toISOString() }, NOW)
  assert.equal(iso.at, NOW - 1000)
  for (const bad of [
    null, { market: 'X', mark: '0', updatedAt: NOW }, { market: 'X', mark: '-1', updatedAt: NOW },
    { market: 'X', mark: 'abc', updatedAt: NOW }, { market: 'X', mark: '1' }, { mark: '1', updatedAt: NOW },
    { market: 'X', mark: '1', updatedAt: NOW + 60_000 },
  ]) assert.equal(quoteRecord(bad, NOW), null, JSON.stringify(bad))
})

test('freshness: a mark older than five seconds is stale and not tradeable', async () => {
  const ctx = await started()
  ctx.md.stop()
  ctx.md.marks.set('BTC/USD', { mark: '100', index: null, at: NOW, updatedAt: NOW })
  ctx.set(NOW + 4_900); assert.equal(ctx.md.tradeable('BTC/USD').ok, true)
  ctx.set(NOW + 5_100); assert.deepEqual(ctx.md.tradeable('BTC/USD'), { ok: false, reason: 'stale_price' })
})

test('websocket: subscribe on open, answer ping, apply snapshot and incremental updates', async () => {
  const { md, socket } = await started()
  const ticks = []
  md.onTick((s, m) => ticks.push([s, m]))
  assert.deepEqual(socket().sent[0], { op: 'subscribe', channel: 'prices' })
  socket().push({ op: 'ping' })
  assert.deepEqual(socket().sent.at(-1), { op: 'pong' })
  for (const m of session.messages) socket().push(m)   /* hello / subscribed acks are ignored */
  md.stop()
  assert.deepEqual(ticks.map((t) => t[0]), ['BTC/USD', 'ETH/USD', 'EUR/USD'])
  assert.equal(md.mark('ETH/USD').mark, '2114.09')
  assert.equal(md.priceSeq, 1)
})

test('websocket: a sequence gap resubscribes and discards marks until the next snapshot', async () => {
  const { md, socket } = await started()
  for (const m of session.messages) socket().push(m)
  socket().push({ channel: 'prices', snapshot: false, seq: 5, data: [{ market: 'BTC/USD', mark: '1', updatedAt: NOW }] })
  md.stop()
  const ops = socket().sent.map((m) => m.op)
  assert.deepEqual(ops.slice(-2), ['unsubscribe', 'subscribe'])
  assert.equal(md.priceSeq, null)
  assert.equal(md.marks.size, 0, 'no stale marks survive a resync')
})

test('websocket: an older update never overwrites a newer mark', async () => {
  const { md, socket } = await started()
  socket().push({ channel: 'prices', snapshot: true, seq: 0, data: [{ market: 'BTC/USD', mark: '10', updatedAt: NOW - 100 }] })
  socket().push({ channel: 'prices', snapshot: false, seq: 1, data: [{ market: 'BTC/USD', mark: '9', updatedAt: NOW - 900 }] })
  md.stop()
  assert.equal(md.mark('BTC/USD').mark, '10')
})

test('websocket: malformed frames are ignored without throwing', async () => {
  const { md, socket } = await started()
  socket().emit('message', Buffer.from('not json'))
  socket().push({ channel: 'prices', data: 'nope' })
  socket().push({ channel: 'prices', snapshot: true, seq: 0, data: [null, { market: 1 }, { market: 'BTC/USD', mark: '0', updatedAt: NOW }] })
  md.stop()
  assert.equal(md.marks.get('BTC/USD').mark, prices.data.find((p) => p.market === 'BTC/USD').mark, 'the REST value survives; the zero mark was rejected')
})

test('feed interruption and recovery: close schedules a reconnect and resubscribes', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const { md, socket } = await started({ reconnectMs: 2000 })
    const first = socket()
    first.emit('close')
    assert.equal(FakeSocket.instances.length, 1, 'no immediate reconnect storm')
    mock.timers.tick(2000)
    assert.equal(FakeSocket.instances.length, 2)
    FakeSocket.instances[1].emit('open')
    assert.deepEqual(FakeSocket.instances[1].sent[0], { op: 'subscribe', channel: 'prices' })
    assert.equal(md.priceSeq, null, 'sequence state resets on reconnect')
    md.stop()
    first.emit('close')
    mock.timers.tick(5000)
    assert.equal(FakeSocket.instances.length, 2, 'a stopped feed does not reconnect')
  } finally { mock.timers.reset() }
})

test('REST failures and unexpected schemas fail closed', async () => {
  for (const [label, handler, error] of [
    ['markets HTTP error', async (u) => (u.endsWith('/markets') ? json({}, false) : json(prices)), /markets_unavailable/],
    ['markets wrong shape', async (u) => (u.endsWith('/markets') ? json({ data: {} }) : json(prices)), /invalid_market_schema/],
    ['markets empty', async (u) => (u.endsWith('/markets') ? json({ data: [] }) : json(prices)), /invalid_market_schema/],
    ['prices HTTP error', async (u) => (u.endsWith('/markets') ? json(markets) : json({}, false)), /prices_unavailable/],
    ['prices wrong shape', async (u) => (u.endsWith('/markets') ? json(markets) : json({ data: 'x' })), /invalid_price_schema/],
  ]) {
    const { md } = make({ fetchImpl: handler })
    await assert.rejects(() => md.bootstrap(), error, label)
    md.stop()
  }
})

test('test seam: injected prices override the feed without touching freshness rules', async () => {
  const { md } = await started()
  md.stop()
  md.injectPrice('BTC/USD', 123.45)
  assert.deepEqual({ ...md.mark('BTC/USD'), at: 0 }, { mark: '123.45', at: 0, injected: true })
  md.clearInjection('BTC/USD')
  assert.equal(md.mark('BTC/USD').injected, false)
})
