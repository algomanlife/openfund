#!/usr/bin/env node
/*
 * Footprint load test — run against an ISOLATED local server (never production).
 *
 * Simulates N concurrent chart users holding a live footprint SSE stream (real
 * Hyperliquid data through the server's single shared upstream connection) plus
 * V "normal visitors" fetching ordinary pages, and records:
 *   server CPU % and RSS (sampled with `ps` on --pid), upstream sockets (from
 *   /api/footprint/health), stream count, bytes received, history API latency
 *   (p50/p95/p99), visitor page latency, live event lag (server heartbeat stamp →
 *   client receipt), errors, and stream reconnect counts.
 *
 * Usage pattern (one row of the matrix):
 *   node scripts/footprint/load-test.mjs --base http://127.0.0.1:8181 --pid <server pid> \
 *        --chart 1000 --visitors 2000 --seconds 120 --out result.json
 * --chart 0 measures the visitor-only baseline.
 */
import http from 'node:http'
import { execFile } from 'node:child_process'
import { writeFile } from 'node:fs/promises'

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d }
const BASE = new URL(arg('base', 'http://127.0.0.1:8181'))
const PID = arg('pid', '')
const CHART = Number(arg('chart', 100)), VISITORS = Number(arg('visitors', 2000)), SECONDS = Number(arg('seconds', 60))
const OUT = arg('out', '')
/* usage mix: one popular symbol, several shared ones, a few rare ones */
const MIX = [['BTC/USD', 0.55], ['ETH/USD', 0.2], ['SOL/USD', 0.08], ['XAU/USD', 0.08], ['XAG/USD', 0.04], ['EUR/USD', 0.03], ['USD/JPY', 0.02]]
const TFS = ['1', '5', '15', '60']
const pick = () => { let r = Math.random(); for (const [s, w] of MIX) if ((r -= w) <= 0) return s; return MIX[0][0] }
const agent = new http.Agent({ keepAlive: true, maxSockets: 256 })

const stats = { streamsOpened: 0, streamErrors: 0, streamReconnects: 0, bytes: 0, slicesEvents: 0, statusEvents: 0, lagMs: [], historyMs: [], historyErrors: 0, visitorMs: [], visitorErrors: 0, switches: 0 }
let stopping = false

function get(path, { timeout = 15000, html = false } = {}) {
  return new Promise((resolve) => {
    const t0 = performance.now()
    /* browsers ask for HTML: the SPA fallback answers page routes only to that */
    const headers = html ? { accept: 'text/html,application/xhtml+xml' } : { accept: 'application/json' }
    const req = http.get({ host: BASE.hostname, port: BASE.port, path, agent, timeout, headers }, (res) => {
      let n = 0
      res.on('data', (c) => { n += c.length })
      res.on('end', () => resolve({ ok: res.statusCode < 400, ms: performance.now() - t0, bytes: n }))
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', () => resolve({ ok: false, ms: performance.now() - t0, bytes: 0 }))
  })
}

class ChartUser {
  constructor() { this.symbol = pick(); this.tf = TFS[Math.floor(Math.random() * TFS.length)]; this.req = null }
  async start() {
    await this.history()
    this.open()
    /* ~10% of users switch symbol or timeframe roughly every 20 s */
    if (Math.random() < 0.1) this.switchTimer = setInterval(() => this.switch(), 15000 + Math.random() * 10000)
  }
  async history() {
    const to = Date.now(), tfMs = (this.tf === 'D' ? 1440 : Number(this.tf)) * 60000
    const r = await get(`/api/footprint/history?symbol=${encodeURIComponent(this.symbol)}&tf=${this.tf}&from=${to - 300 * tfMs}&to=${to}`)
    stats.historyMs.push(r.ms); stats.bytes += r.bytes
    if (!r.ok) stats.historyErrors++
  }
  open() {
    if (stopping) return
    const req = http.get({ host: BASE.hostname, port: BASE.port, path: `/api/footprint/stream?symbol=${encodeURIComponent(this.symbol)}`, headers: { accept: 'text/event-stream' } }, (res) => {
      if (res.statusCode !== 200) { stats.streamErrors++; res.resume(); return }
      stats.streamsOpened++
      res.setEncoding('utf8')
      let buf = ''
      res.on('data', (c) => {
        stats.bytes += Buffer.byteLength(c)
        buf += c
        let i
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const raw = buf.slice(0, i); buf = buf.slice(i + 2)
          if (raw.includes('event: slices')) stats.slicesEvents++
          else if (raw.includes('event: status')) {
            stats.statusEvents++
            const m = /"lastHeartbeat":(\d+)/.exec(raw)
            if (m) stats.lagMs.push(Date.now() - Number(m[1]))
          }
        }
      })
      res.on('end', () => { if (!stopping) { stats.streamReconnects++; setTimeout(() => this.open(), 3000) } })
    })
    req.on('error', () => { stats.streamErrors++; if (!stopping) setTimeout(() => this.open(), 3000) })
    this.req = req
  }
  async switch() {
    stats.switches++
    this.req?.destroy()
    if (Math.random() < 0.5) this.symbol = pick(); else this.tf = TFS[Math.floor(Math.random() * TFS.length)]
    await this.history()
    this.open()
  }
  stop() { clearInterval(this.switchTimer); this.req?.destroy() }
}

/* normal visitors: each loads one ordinary page about every 30 s */
function visitorLoop() {
  const paths = ['/health', '/en', '/en/markets', '/fa/prop/trade']
  const perSec = VISITORS / 30
  let carry = 0
  return setInterval(() => {
    carry += perSec / 10
    for (; carry >= 1; carry--) {
      const p = paths[Math.floor(Math.random() * paths.length)]   /* visitors never touch footprint */
      get(p, { html: p !== '/health' }).then(r => { stats.visitorMs.push(r.ms); if (!r.ok) stats.visitorErrors++ })
    }
  }, 100)
}

function sampleProc() {
  return new Promise((resolve) => {
    if (!PID) return resolve(null)
    execFile('ps', ['-o', '%cpu=,rss=', '-p', PID], (e, out) => {
      if (e) return resolve(null)
      const [cpu, rss] = out.trim().split(/\s+/).map(Number)
      resolve({ cpu, rssMb: Math.round(rss / 1024) })
    })
  })
}

const q = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 10) / 10 }

const users = Array.from({ length: CHART }, () => new ChartUser())
const procSamples = []
const t0 = Date.now()
/* ramp chart users over 10 s (browsers do not all arrive in the same millisecond) */
users.forEach((u, i) => setTimeout(() => u.start(), (i / Math.max(1, CHART)) * 10000))
const vTimer = visitorLoop()
const pTimer = setInterval(async () => { const s = await sampleProc(); if (s) procSamples.push(s) }, 2000)
await new Promise(r => setTimeout(r, SECONDS * 1000))
stopping = true
clearInterval(vTimer); clearInterval(pTimer)
const health = await new Promise((resolve) => http.get({ host: BASE.hostname, port: BASE.port, path: '/api/footprint/health' }, (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { resolve(JSON.parse(b)) } catch { resolve(null) } }) }).on('error', () => resolve(null)))
users.forEach(u => u.stop())
const elapsed = (Date.now() - t0) / 1000
const result = {
  at: new Date(t0).toISOString(), seconds: Math.round(elapsed), chartUsers: CHART, visitors: VISITORS,
  server: procSamples.length ? { cpuAvg: Math.round(procSamples.reduce((s, x) => s + x.cpu, 0) / procSamples.length), cpuMax: Math.max(...procSamples.map(x => x.cpu)), rssMaxMb: Math.max(...procSamples.map(x => x.rssMb)) } : null,
  upstream: health ? { connected: health.feed?.connected, reconnects: health.feed?.reconnects, accepted: health.feed?.accepted, duplicates: health.feed?.duplicates, streamsAtEnd: health.streams, rooms: health.rooms } : null,
  streams: { opened: stats.streamsOpened, errors: stats.streamErrors, reconnects: stats.streamReconnects, slicesEvents: stats.slicesEvents, statusEvents: stats.statusEvents },
  bandwidthKBps: Math.round(stats.bytes / 1024 / elapsed),
  eventLagMs: { p50: q(stats.lagMs, 0.5), p95: q(stats.lagMs, 0.95), p99: q(stats.lagMs, 0.99) },
  historyMs: { n: stats.historyMs.length, p50: q(stats.historyMs, 0.5), p95: q(stats.historyMs, 0.95), p99: q(stats.historyMs, 0.99), errors: stats.historyErrors },
  visitorMs: { n: stats.visitorMs.length, p50: q(stats.visitorMs, 0.5), p95: q(stats.visitorMs, 0.95), p99: q(stats.visitorMs, 0.99), errors: stats.visitorErrors },
  switches: stats.switches,
}
console.log(JSON.stringify(result, null, 1))
if (OUT) await writeFile(OUT, JSON.stringify(result, null, 2) + '\n')
agent.destroy()
process.exit(0)
