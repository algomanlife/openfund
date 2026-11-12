/**
 * Synthetic Gains Network market-data server (REST + WS) for isolated load tests.
 *
 * Mirrors the contract documented in apps/backend/market-data.js and
 * dist/gains-adapter.js so neither the backend nor the browser chart ever
 * reaches api.gains.trade during a test:
 *   GET /v1/arbitrum/markets
 *   GET /v1/arbitrum/prices
 *   GET /v1/arbitrum/markets/:SYMBOL-DASHED/candles?interval=&from=&to=
 *   WS  /v1/arbitrum/ws   {op:'subscribe',channel:'prices'} → {channel:'prices',seq,data,snapshot?}
 *
 * Latency probe market "LT/USD": its mark encodes the emit time,
 *   mark = 1000 + ((emitMs - T0) mod 600000) / 1000      (3 decimals = 1 ms)
 * so any downstream consumer (SSE client) can compute end-to-end delay:
 *   delay = ((recvMs - T0) - (mark - 1000) * 1000) mod 600000
 *
 * Env: MOCK_PORT (default 18090), MOCK_T0 (ms epoch, default now),
 *      MOCK_TICK_MS (default 250), MOCK_BATCH (markets per tick, default all)
 */
import http from 'node:http'
import fs from 'node:fs'
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.MOCK_PORT || 18090)
const T0 = Number(process.env.MOCK_T0 || Date.now())
const TICK_MS = Number(process.env.MOCK_TICK_MS || 250)
const here = new URL('.', import.meta.url)
const markets = JSON.parse(fs.readFileSync(new URL('markets.json', here))).data
const seedPrices = JSON.parse(fs.readFileSync(new URL('prices.json', here))).data
markets.push({
  symbol: 'LT/USD', pairIndex: 9999, base: 'LT', quote: 'USD', group: 'crypto', groupIndex: 0, feeIndex: 0,
  isOpen: true, minLeverage: '1.1', maxLeverage: '100', minCollateralUsd: '1', minPositionUsd: '5',
  pricePrecision: 3, sizePrecision: 6, spreadRate: '0',
  fees: { openFeeRate: '0.0003', closeFeeRate: '0.0003', minPositionSizeUsd: '5' },
})
/* production lists ~493 markets: clone the recorded shapes with unique
   symbols so payloads (/context pricing map, WS ticks) have realistic size */
const TARGET_MARKETS = Number(process.env.MOCK_MARKETS || 493)
const shapes = markets.filter(m => m.symbol !== 'LT/USD')
for (let k = 0; markets.length < TARGET_MARKETS; k++) {
  const b = shapes[k % shapes.length]
  markets.push({ ...b, symbol: `SYN${k}/USD`, base: `SYN${k}`, quote: 'USD', pairIndex: 10000 + k })
}
const price = new Map(seedPrices.map(p => [p.market, Number(p.mark)]))
for (const m of markets) if (!price.has(m.symbol)) price.set(m.symbol, 100)
const ltMark = now => (1000 + (((now - T0) % 600000) + 600000) % 600000 / 1000).toFixed(3)
const quote = (symbol, now) => {
  if (symbol === 'LT/USD') return { market: symbol, mark: ltMark(now), index: ltMark(now), updatedAt: now }
  const p = price.get(symbol)
  return { market: symbol, mark: String(+p.toPrecision(8)), index: String(+p.toPrecision(8)), updatedAt: now }
}
/* bounded random walk */
setInterval(() => { for (const [s, p] of price) if (s !== 'LT/USD') price.set(s, Math.max(p * (1 + (Math.random() - 0.5) * 0.0008), 1e-6)) }, TICK_MS).unref()

const stats = { rest: 0, candles: 0, wsClients: 0, wsMessages: 0 }
const json = (res, body, status = 200) => { res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(body)) }
const INTERVAL_MS = { '1m': 60e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3, '1h': 3600e3, '4h': 14400e3, '1d': 86400e3 }

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x')
  stats.rest++
  if (url.pathname === '/__stats') return json(res, { ...stats, T0 })
  if (url.pathname === '/v1/arbitrum/markets') return json(res, { data: markets })
  if (url.pathname === '/v1/arbitrum/prices') { const now = Date.now(); return json(res, { data: markets.map(m => quote(m.symbol, now)) }) }
  const c = url.pathname.match(/^\/v1\/arbitrum\/markets\/([^/]+)\/candles$/)
  if (c) {
    stats.candles++
    const symbol = decodeURIComponent(c[1]).replace('-', '/')
    const step = INTERVAL_MS[url.searchParams.get('interval')] || 60e3
    const to = Number(url.searchParams.get('to')) || Date.now()
    const from = Math.max(Number(url.searchParams.get('from')) || to - step * 500, to - step * 1000)
    const base = price.get(symbol) || 100
    const data = []
    let p = base
    for (let t = Math.floor(from / step) * step; t <= to; t += step) {
      const o = p, cl = p * (1 + (Math.sin(t / step) * 0.002)), hi = Math.max(o, cl) * 1.001, lo = Math.min(o, cl) * 0.999
      data.push({ time: t, open: o, high: hi, low: lo, close: cl }); p = cl
    }
    return json(res, { data })
  }
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }); return res.end() }
  json(res, { error: 'not_found' }, 404)
})

const wss = new WebSocketServer({ server, path: '/v1/arbitrum/ws' })
wss.on('connection', ws => {
  stats.wsClients++
  let seq = 0, subscribed = false
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw) } catch { return }
    if (m.op === 'subscribe' && m.channel === 'prices') {
      subscribed = true; seq = 0
      const now = Date.now()
      ws.send(JSON.stringify({ channel: 'prices', snapshot: true, seq: seq++, data: markets.map(x => quote(x.symbol, now)) }))
    }
    if (m.op === 'unsubscribe') subscribed = false
  })
  const tick = setInterval(() => {
    if (!subscribed || ws.readyState !== 1) return
    const now = Date.now()
    ws.send(JSON.stringify({ channel: 'prices', seq: seq++, data: markets.map(x => quote(x.symbol, now)) }))
    stats.wsMessages++
  }, TICK_MS)
  const ping = setInterval(() => { if (ws.readyState === 1) ws.send(JSON.stringify({ op: 'ping' })) }, 15000)
  ws.on('close', () => { clearInterval(tick); clearInterval(ping); stats.wsClients-- })
})
server.listen(PORT, '127.0.0.1', () => console.log(`[mock-gains] :${PORT} T0=${T0} tick=${TICK_MS}ms markets=${markets.length}`))
