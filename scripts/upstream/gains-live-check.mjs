#!/usr/bin/env node
/**
 * Optional, read-only live check of the Gains public API against the contract recorded in
 * apps/backend/test/fixtures/gains. NOT part of CI gating (network, third-party availability).
 * Run manually or from the scheduled watcher: npm run check:gains-live
 *
 * Exit 0 = live shapes satisfy the contract. Exit 1 = drift (open a review, do not auto-adapt).
 * Exit 3 = API unreachable (no verdict).
 */
import { createRequire } from 'node:module'
import { quoteRecord } from '../../apps/backend/market-data.js'
const require = createRequire(new URL('../../apps/backend/package.json', import.meta.url))
const API = process.env.GAINS_API || 'https://api.gains.trade/v1/arbitrum'
const WSS = process.env.GAINS_WSS || 'wss://api.gains.trade/v1/arbitrum/ws'
const problems = []
const need = (ok, msg) => { if (!ok) problems.push(msg) }

let markets, prices
try {
  markets = await (await fetch(`${API}/markets`, { signal: AbortSignal.timeout(20000) })).json()
  prices = await (await fetch(`${API}/prices`, { signal: AbortSignal.timeout(20000) })).json()
} catch (e) { console.error(`unreachable: ${e.message}`); process.exit(3) }

need(Array.isArray(markets.data) && markets.data.length > 100, 'markets.data is not a populated array')
const required = ['symbol', 'base', 'quote', 'group', 'isOpen', 'minLeverage', 'maxLeverage', 'pricePrecision']
const groups = new Set(['crypto', 'forex', 'stocks', 'indices', 'commodities'])
for (const m of markets.data ?? []) {
  for (const k of required) if (m[k] === undefined) { problems.push(`market ${m.symbol ?? '?'} lacks ${k}`); break }
  if (!groups.has(m.group)) problems.push(`market ${m.symbol} has unknown group ${m.group}`)
  if (!Number.isInteger(m.pricePrecision)) problems.push(`market ${m.symbol} pricePrecision not an integer`)
}
need(Array.isArray(prices.data) && prices.data.length > 100, 'prices.data is not a populated array')
const symbols = new Set((markets.data ?? []).map((m) => m.symbol))
let usable = 0
for (const p of prices.data ?? []) { if (!symbols.has(p.market)) problems.push(`price for unknown market ${p.market}`); if (quoteRecord(p)) usable++ }
need(usable / Math.max(1, prices.data?.length) > 0.8, `only ${usable}/${prices.data?.length} prices pass quoteRecord`)

const WebSocket = require('ws')
const seen = await new Promise((resolve) => {
  const out = []; const ws = new WebSocket(WSS)
  ws.on('open', () => ws.send(JSON.stringify({ op: 'subscribe', channel: 'prices' })))
  ws.on('message', (raw) => { try { out.push(JSON.parse(raw.toString())) } catch { /* ignored like the engine does */ } })
  ws.on('error', () => resolve(out))
  setTimeout(() => { ws.close(); resolve(out) }, 8000)
})
const snap = seen.find((m) => m.channel === 'prices' && m.snapshot === true)
need(Boolean(snap), 'no prices snapshot within 8 s of subscribing')
need(snap ? Number.isFinite(snap.seq) && Array.isArray(snap.data) : true, 'snapshot lacks numeric seq or data array')
need(snap ? snap.data.some((p) => quoteRecord(p)) : true, 'snapshot contains no valid quote')

if (problems.length) { console.error(`CONTRACT DRIFT (${problems.length}):\n- ${problems.slice(0, 25).join('\n- ')}`); process.exit(1) }
console.log(`Gains live contract OK: ${markets.data.length} markets, ${prices.data.length} prices, ${seen.length} websocket frames`)
