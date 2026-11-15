/* Trade Radar feed: transforms, shared caching, stale fallback and the shared tape. No network. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import express from 'express'
import { condenseBoard, toMarkets, toAccount, positioning, fillRecord, createRadar, radarRoutes, openfundMarketFor, THRESHOLDS } from '../radar.js'

const W1 = '0x' + '1'.repeat(40), W2 = '0x' + '2'.repeat(40)
const perf = (pnl, vlm = 2e6) => [['day', { pnl: String(pnl), roi: '0.1', vlm: String(vlm) }], ['week', { pnl: String(pnl), roi: '0.1', vlm: String(vlm) }], ['month', { pnl: String(pnl), roi: '0.2', vlm: String(vlm) }], ['allTime', { pnl: String(pnl), roi: '1', vlm: String(vlm) }]]
const RAW = { leaderboardRows: [
  { ethAddress: W1, accountValue: '1000000', displayName: 'Alpha', windowPerformances: perf(500000) },
  { ethAddress: W2, accountValue: '500000', displayName: null, windowPerformances: perf(900000) },
  { ethAddress: '0x' + '3'.repeat(40), accountValue: '1', windowPerformances: perf(1e9, 10) }, // never trades: excluded
  { ethAddress: 'not-a-wallet', accountValue: '1', windowPerformances: perf(1) },
] }
const META = [{ universe: [{ name: 'BTC', maxLeverage: 40 }, { name: 'ETH', maxLeverage: 25 }, { name: 'OLD', maxLeverage: 3, isDelisted: true }] },
  [{ markPx: '100000', prevDayPx: '95000', funding: '0.00001', openInterest: '10', dayNtlVlm: '5000000000' }, { markPx: '2000', prevDayPx: '2100', funding: '0', openInterest: '100', dayNtlVlm: '1000000000' }, {}]]
const STATE = (szi, entry) => ({ marginSummary: { accountValue: '1000000', totalMarginUsed: '1', totalNtlPos: '2' }, withdrawable: '3',
  assetPositions: [{ position: { coin: 'BTC', szi: String(szi), entryPx: String(entry), positionValue: String(Math.abs(szi) * 100000), unrealizedPnl: '10', returnOnEquity: '0.1', liquidationPx: '50000', leverage: { type: 'cross', value: 5 }, marginUsed: '1' } }] })

test('leaderboard keeps only trading wallets, ranked by window PnL', () => {
  const board = condenseBoard(RAW, {}, 1)
  assert.deepEqual(board.windows.month.map(t => t.wallet), [W2, W1])
  assert.equal(board.windows.month[1].name, 'Alpha')
  assert.equal(board.windows.month[0].rank, 1)
})

test('markets carry real 24h change, OI in USD and skip delisted coins', () => {
  const m = toMarkets(META)
  assert.deepEqual(m.map(x => x.coin), ['BTC', 'ETH'])
  assert.ok(Math.abs(m[0].change - (100000 / 95000 - 1)) < 1e-12)
  assert.equal(m[0].openInterest, 1_000_000)
  assert.equal(toMarkets(null).length, 0)
})

test('positioning adds up both sides with size-weighted entry and counts a wallet once', () => {
  const t1 = { wallet: W1, name: 'A', rank: 1 }, t2 = { wallet: W2, name: '', rank: 2 }
  const long = toAccount(W1, STATE(2, 90000)).positions, short = toAccount(W2, STATE(-1, 110000)).positions
  const [btc] = positioning([{ trader: t1, positions: long }, { trader: t1, positions: long }, { trader: t2, positions: short }])
  assert.equal(btc.long.traders, 1); assert.equal(btc.short.traders, 1)
  assert.equal(btc.long.entry, 90000); assert.equal(btc.short.entry, 110000)
  assert.ok(Math.abs(btc.bias - 2 / 3) < 1e-9); assert.equal(btc.concentration, 1)
})

test('track record ignores closes within a dollar of even', () => {
  const r = fillRecord([{ closedPnl: 100, fee: 1, time: 5 }, { closedPnl: -50, fee: 1, time: 3 }, { closedPnl: 0.5, fee: 0, time: 4 }, { closedPnl: 0, fee: 1, time: 9 }])
  assert.equal(r.wins, 1); assert.equal(r.losses, 1); assert.equal(r.closes, 3); assert.equal(r.winRate, 0.5); assert.equal(r.since, 3)
})

function fakeFetch(handler) {
  const calls = []
  const impl = async (url, init) => { calls.push({ url, body: init?.body }); const out = await handler(url, init); return { ok: true, status: 200, headers: new Map(), json: async () => out } }
  return { impl, calls }
}

test('concurrent viewers share one upstream request; a failed refresh serves stale data', async () => {
  let clock = 0, failing = false
  const { impl, calls } = fakeFetch(async () => { if (failing) throw new Error('down'); await new Promise(r => setTimeout(r, 5)); return META })
  const radar = createRadar({ fetchImpl: impl, now: () => clock })
  const [a, b] = await Promise.all([radar.markets(), radar.markets()])
  assert.equal(calls.length, 1); assert.equal(a.value, b.value); assert.equal(a.stale, false)
  clock += 60_000; failing = true
  const c = await radar.markets()
  assert.equal(c.stale, true); assert.equal(c.value.length, 2)
  radar.close()
})

test('aggregated positions are built from the top wallets, cached for every viewer', async () => {
  const { impl, calls } = fakeFetch(async (url, init) => {
    if (url.includes('leaderboard')) return RAW
    const body = JSON.parse(init.body)
    if (body.type === 'metaAndAssetCtxs') return META
    if (body.type === 'clearinghouseState') return body.user === W1 ? STATE(2, 90000) : STATE(-1, 110000)
    throw new Error('unexpected')
  })
  const radar = createRadar({ fetchImpl: impl })
  const first = await radar.positions('month', 10)
  await radar.positions('month', 10)
  assert.equal(first.value.answered, 2)
  assert.equal(first.value.coins[0].coin, 'BTC')
  assert.equal(calls.filter(c => c.body?.includes('clearinghouseState')).length, 2)
  radar.close()
})

class FakeSocket extends EventEmitter {
  static last
  constructor(url) { super(); this.url = url; this.sent = []; FakeSocket.last = this; setImmediate(() => this.emit('open')) }
  send(message) { this.sent.push(JSON.parse(message)) }
  close() { this.emit('close') }
}

test('one shared tape subscribes the busiest coins, keeps trades >= $10K once, and filters per viewer', async () => {
  const { impl } = fakeFetch(async () => META)
  const radar = createRadar({ fetchImpl: impl, WebSocketImpl: FakeSocket })
  assert.equal(radar.tape().state, 'idle')
  await new Promise(r => setTimeout(r, 20))
  const socket = FakeSocket.last
  assert.deepEqual(socket.sent.map(m => m.subscription.coin), ['BTC', 'ETH'])
  const row = (tid, px, sz, time) => ({ coin: 'BTC', side: 'B', px: String(px), sz: String(sz), time, hash: '0xh', tid, users: [W1, W2] })
  socket.emit('message', JSON.stringify({ channel: 'trades', data: [row(1, 100000, 0.05, 10), row(2, 100000, 1, 11), row(2, 100000, 1, 11), row(3, 100000, 20, 12)] }))
  const all = radar.tape()
  assert.equal(all.state, 'live')
  assert.deepEqual(all.trades.map(t => t.usd), [2_000_000, 100_000])
  assert.deepEqual(radar.tape({ min: 1_000_000 }).trades.map(t => t.usd), [2_000_000])
  assert.deepEqual(radar.tape({ since: 11 }).trades.length, 1)
  radar.close()
})

test('HTTP: invalid wallets are rejected and upstream outages answer 503, never fabricated data', async () => {
  const radar = createRadar({ fetchImpl: async () => { throw new Error('down') } })
  const app = express(); app.use(radarRoutes({ radar }))
  const server = app.listen(0); const base = `http://127.0.0.1:${server.address().port}`
  try {
    assert.equal((await fetch(base + '/radar/wallet/nope')).status, 400)
    const r = await fetch(base + '/radar/markets')
    assert.equal(r.status, 503); assert.deepEqual(await r.json(), { error: 'radar_unavailable' })
    const tape = await (await fetch(base + '/radar/tape?min=123')).json()
    assert.deepEqual(tape.thresholds, THRESHOLDS); assert.deepEqual(tape.trades, [])
  } finally { server.close(); radar.close() }
})

test('a Hyperliquid coin links to the Openfund market only when Gains lists it open', () => {
  const gains = new Map([['BTC/USD', { symbol: 'BTC/USD', group: 'crypto', isOpen: true }], ['PEPE/USD', { symbol: 'PEPE/USD', group: 'crypto' }], ['XYZ/USD', { symbol: 'XYZ/USD', isOpen: false }]])
  assert.deepEqual(openfundMarketFor('BTC', gains), { symbol: 'BTC/USD', group: 'crypto' })
  assert.deepEqual(openfundMarketFor('kPEPE', gains), { symbol: 'PEPE/USD', group: 'crypto' })
  assert.equal(openfundMarketFor('XYZ', gains), null)
  assert.equal(openfundMarketFor('NOPE', gains), null)
})
