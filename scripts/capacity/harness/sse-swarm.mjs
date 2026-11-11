/**
 * SSE swarm — one GET /trading/stream per active chart user, exactly as
 * apps/web-react/src/trading/TradingBridge.tsx opens it (credentials +
 * reconnect 3 s after an error). k6 has no native SSE reader, so this Node
 * generator owns the streaming half of the chart-user workload while k6
 * drives the same users' HTTP calls.
 *
 * Measures per second (JSONL to $OUT):
 *   active / connecting streams, data events and heartbeats received,
 *   gap between consecutive events (server promises ≤ 1 s),
 *   connect time (request → first byte), drops, reconnects, HTTP errors,
 *   market-data delay: LT/USD mark encodes its emit time at the synthetic
 *   Gains server (see mock-gains.mjs) → delay = receive − emit, end to end
 *   through backend WS ingest → engine → SSE snapshot.
 *
 * Usage: node sse-swarm.mjs <users.json> <out.jsonl> [schedule]
 *   schedule = "stages" (stages.json staircase), or "const:<n>:<seconds>"
 */
import fs from 'node:fs'
import http from 'node:http'

const TARGET = new URL(process.env.TARGET || 'http://127.0.0.1:18080')
const T0 = Number(process.env.MOCK_T0 || 1794000000000)
const users = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const OUT = process.argv[3]
const sched = process.argv[4] || 'stages'
const RAMP = Number(process.env.STAGE_RAMP_S || 60), HOLD = Number(process.env.STAGE_HOLD_S || 180)
const STOP_FILE = process.env.STOP_FILE

/* target(t) in seconds since start */
let plan
if (sched.startsWith('const:')) {
  const [, n, s] = sched.split(':'); plan = [{ name: 'const', from: 0, to: +n, ramp: Math.min(RAMP, +s), hold: +s - Math.min(RAMP, +s) }]
} else {
  const st = JSON.parse(fs.readFileSync(new URL('stages.json', import.meta.url))).stages
  const only = process.env.STAGES ? process.env.STAGES.split(',') : null
  let prev = 0; plan = []
  for (const s of st) { if (only && !only.includes(s.name)) continue; plan.push({ name: s.name, from: prev, to: s.charts, ramp: RAMP, hold: HOLD }); prev = s.charts }
  if (process.env.RECOVERY_S) plan.push({ name: 'recovery', from: prev, to: Number(process.env.RECOVERY_TO || 100), ramp: 10, hold: Number(process.env.RECOVERY_S) })
}
const total = plan.reduce((a, p) => a + p.ramp + p.hold, 0)
function target(t) {
  let acc = 0
  for (const p of plan) {
    if (t < acc + p.ramp) return { stage: p.name, n: Math.round(p.from + (p.to - p.from) * (t - acc) / p.ramp) }
    acc += p.ramp
    if (t < acc + p.hold) return { stage: p.name, n: p.to }
    acc += p.hold
  }
  return null
}
if (users.length < Math.max(...plan.map(p => p.to))) console.warn(`[sse] only ${users.length} users for ${Math.max(...plan.map(p => p.to))} streams — users will be reused (multi-tab)`)

const agent = new http.Agent({ keepAlive: false, maxSockets: Infinity })
const conns = new Map() /* slot → conn */
const w = { data: 0, hb: 0, drops: 0, reconnects: 0, errors: {}, connectMs: [], gapMs: [], mdDelayMs: [], bytes: 0 }
const lastPrice = new Map()

function open(slot, isReconnect) {
  const u = users[slot % users.length]
  const c = { slot, ended: false, last: 0, buf: '' }
  conns.set(slot, c)
  if (isReconnect) w.reconnects++
  const t0 = Date.now()
  const req = http.request({ agent, host: TARGET.hostname, port: TARGET.port, path: '/trading/stream', method: 'GET',
    headers: { cookie: u.cookie, 'x-forwarded-for': u.xff, accept: 'text/event-stream' } }, res => {
    if (res.statusCode !== 200) { w.errors[res.statusCode] = (w.errors[res.statusCode] || 0) + 1; res.resume(); return fail() }
    w.connectMs.push(Date.now() - t0); c.last = Date.now(); c.connected = true
    res.setEncoding('utf8')
    res.on('data', chunk => {
      w.bytes += chunk.length; c.buf += chunk
      let i
      while ((i = c.buf.indexOf('\n\n')) >= 0) {
        const ev = c.buf.slice(0, i); c.buf = c.buf.slice(i + 2)
        const now = Date.now()
        if (ev.startsWith('retry:')) continue
        if (c.last) w.gapMs.push(now - c.last)
        c.last = now
        if (ev.startsWith(': hb')) { w.hb++; continue }
        if (ev.startsWith('data: ')) {
          w.data++
          try {
            const s = JSON.parse(ev.slice(6))
            for (const p of s.positions || []) if (p.market === 'LT/USD' && p.mark_price) {
              const mark = Number(p.mark_price)
              if (lastPrice.get(slot) === mark) continue
              lastPrice.set(slot, mark)
              const d = (((now - T0) - Math.round((mark - 1000) * 1000)) % 600000 + 600000) % 600000
              w.mdDelayMs.push(d)
            }
          } catch { w.errors.parse = (w.errors.parse || 0) + 1 }
        }
      }
    })
    res.on('end', fail); res.on('error', fail)
  })
  req.on('error', e => { w.errors[e.code || 'neterr'] = (w.errors[e.code || 'neterr'] || 0) + 1; fail() })
  req.setTimeout(30000, () => { w.errors.timeout = (w.errors.timeout || 0) + 1; req.destroy() })
  req.end()
  c.req = req
  function fail() {
    if (c.ended) return
    c.ended = true
    if (conns.get(slot) !== c) return
    if (c.closing) { conns.delete(slot); return }
    w.drops++
    c.retry = setTimeout(() => { if (conns.get(slot) === c && !c.closing) open(slot, true) }, 3000)
  }
}
function close(slot) { const c = conns.get(slot); if (!c) return; c.closing = true; clearTimeout(c.retry); c.req?.destroy(); conns.delete(slot) }

const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))] }
const start = Date.now()
const out = fs.createWriteStream(OUT)
const timer = setInterval(() => {
  const t = (Date.now() - start) / 1000
  const tg = target(t)
  if (!tg || (STOP_FILE && fs.existsSync(STOP_FILE))) { finish(); return }
  /* adjust concurrency: open at most 50 new streams per second (gradual ramp) */
  let opened = 0
  for (let s = 0; s < tg.n && opened < 50; s++) if (!conns.has(s)) { open(s, false); opened++ }
  for (const s of [...conns.keys()]) if (s >= tg.n) close(s)
  /* streams silent > 5 s count as stalled */
  const now = Date.now(); let stalled = 0, active = 0
  for (const c of conns.values()) { if (c.connected && !c.ended) { active++; if (now - c.last > 5000) stalled++ } }
  const rec = { t: now, stage: tg.stage, target: tg.n, open: conns.size, active, stalled, data: w.data, hb: w.hb, drops: w.drops, reconnects: w.reconnects,
    errors: w.errors, kbps: +(w.bytes / 1024).toFixed(1),
    connectMs: { p50: pct(w.connectMs, .5), p95: pct(w.connectMs, .95), max: pct(w.connectMs, 1) },
    gapMs: { p50: pct(w.gapMs, .5), p95: pct(w.gapMs, .95), p99: pct(w.gapMs, .99), max: pct(w.gapMs, 1) },
    mdDelayMs: { n: w.mdDelayMs.length, p50: pct(w.mdDelayMs, .5), p95: pct(w.mdDelayMs, .95), p99: pct(w.mdDelayMs, .99), max: pct(w.mdDelayMs, 1) } }
  out.write(JSON.stringify(rec) + '\n')
  if (Math.floor(t) % 10 === 0) console.log(`[sse] t=${Math.floor(t)}s ${tg.stage} target=${tg.n} active=${active} stalled=${stalled} gap95=${rec.gapMs.p95} md95=${rec.mdDelayMs.p95} drops=${w.drops} err=${JSON.stringify(w.errors)}`)
  Object.assign(w, { data: 0, hb: 0, drops: 0, reconnects: 0, errors: {}, connectMs: [], gapMs: [], mdDelayMs: [], bytes: 0 })
}, 1000)
let done = false
function finish() { if (done) return; done = true; clearInterval(timer); for (const s of [...conns.keys()]) close(s); out.end(() => process.exit(0)) }
process.on('SIGINT', finish); process.on('SIGTERM', finish)
console.log(`[sse] plan ${plan.map(p => `${p.name}:${p.to}`).join(' → ')} total ${total}s`)
