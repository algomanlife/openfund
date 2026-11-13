/**
 * Backend preload (node --import) — test harness only.
 *  1. registers loader-hooks.mjs (Gains → local synthetic server)
 *  2. refuses to start unless DATABASE_URL points at a local *_test database
 *  3. writes process metrics every second to $METRICS_FILE (JSONL):
 *     cpu %, rss, heap, event-loop delay p50/p99/max, pg pool total/idle/waiting,
 *     open handles (approximate active sockets)
 */
import { register, createRequire } from 'node:module'
import { monitorEventLoopDelay } from 'node:perf_hooks'
import fs from 'node:fs'

register(new URL('./loader-hooks.mjs', import.meta.url))

const db = new URL(process.env.DATABASE_URL || 'postgres://x@nowhere/none')
if (!['127.0.0.1', 'localhost', '::1'].includes(db.hostname) || !/_test$/.test(db.pathname.slice(1)))
  throw new Error(`[harness] refusing: DATABASE_URL must be a local *_test database (got ${db.hostname}${db.pathname})`)

/* engine loop observation (harness only, no source change): wraps
   Engine.prototype.loop to time each pass, count ticks skipped because a
   pass was still running, and record the delay from pass start to the
   SL/TP/liquidation sweep query (= risk-check scheduling delay) */
const eng = { passes: [], skipped: 0, sweepDelay: [], passStart: null }
const SWEEP_SQL = 'SELECT p.*, a.balance FROM trading_positions p'
try {
  const { pathToFileURL } = await import('node:url')
  const { Engine } = await import(pathToFileURL(process.env.BACKEND_DIR + '/engine.js').href)
  const loop = Engine.prototype.loop
  Engine.prototype.loop = async function () {
    if (!this.running) return loop.call(this)
    if (this.loopBusy) { eng.skipped++; return }
    const t0 = performance.now(); eng.passStart = t0
    try { return await loop.call(this) } finally { eng.passes.push(performance.now() - t0); eng.passStart = null }
  }
} catch (e) { console.error('[harness] engine observation unavailable', e.message) }

/* track pg pools created by the app (pg is CommonJS; mutate its export) */
const pools = []
try {
  const require = createRequire(process.env.BACKEND_DIR + '/package.json')
  const pg = require('pg')
  const Orig = pg.Pool
  pg.Pool = class extends Orig {
    constructor(o) { if (process.env.HARNESS_PG_MAX && !pools.length) o = { ...o, max: Number(process.env.HARNESS_PG_MAX) }; super(o); pools.push(this) }
    query(text, ...rest) {
      if (eng.passStart != null && typeof text === 'string' && text.includes(SWEEP_SQL)) eng.sweepDelay.push(performance.now() - eng.passStart)
      return super.query(text, ...rest)
    }
  }
} catch (e) { console.error('[harness] pg tracking unavailable', e.message) }
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1) }

const out = process.env.METRICS_FILE
if (out) {
  const h = monitorEventLoopDelay({ resolution: 1 }); h.enable()
  let lastCpu = process.cpuUsage(), lastT = process.hrtime.bigint()
  const t = setInterval(() => {
    const cpu = process.cpuUsage(), now = process.hrtime.bigint()
    const wallUs = Number(now - lastT) / 1000
    const cpuPct = ((cpu.user - lastCpu.user) + (cpu.system - lastCpu.system)) / wallUs * 100
    lastCpu = cpu; lastT = now
    const m = process.memoryUsage()
    const p = pools[0]
    const rec = {
      t: Date.now(), cpuPct: +cpuPct.toFixed(1), rssMB: +(m.rss / 1048576).toFixed(1), heapMB: +(m.heapUsed / 1048576).toFixed(1),
      eld: { p50: +(h.percentile(50) / 1e6).toFixed(2), p99: +(h.percentile(99) / 1e6).toFixed(2), max: +(h.max / 1e6).toFixed(2) },
      pool: p ? { total: p.totalCount, idle: p.idleCount, waiting: p.waitingCount, max: p.options.max } : null,
      /* any further pool (e.g. a dedicated engine-loop pool) */
      extraPools: pools.slice(1).map(x => ({ total: x.totalCount, idle: x.idleCount, waiting: x.waitingCount, max: x.options.max })),
      handles: process._getActiveHandles?.().length ?? null,
      /* engine passes completed in this second, their duration, ticks skipped
         while a pass was still running, running pass age, pass-start → SL/TP sweep */
      engine: { passes: eng.passes.length, passMs: { p50: pct(eng.passes, 0.5), max: pct(eng.passes, 1) },
        skipped: eng.skipped, runningMs: eng.passStart == null ? 0 : +(performance.now() - eng.passStart).toFixed(0),
        sweepDelayMs: pct(eng.sweepDelay, 1) },
    }
    eng.passes = []; eng.skipped = 0; eng.sweepDelay = []
    h.reset()
    fs.appendFile(out, JSON.stringify(rec) + '\n', () => {})
  }, 1000)
  t.unref()
}
