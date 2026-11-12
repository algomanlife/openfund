/**
 * Turn one run's raw outputs into per-stage (steady-state hold window) results.
 * Inputs in <runDir>: run.txt, k6-*-summary.json, sse.jsonl, backend-metrics.jsonl,
 * monitor.jsonl, STOP (optional). Output: <runDir>/summary.json + console table.
 */
import fs from 'node:fs'
const RUN = process.argv[2]
const read = f => { try { return fs.readFileSync(`${RUN}/${f}`, 'utf8') } catch { return null } }
const jsonl = f => (read(f) || '').trim().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
const runTxt = read('run.txt') || ''
const env = Object.fromEntries(runTxt.split('\n').filter(l => /^[A-Z_]+=/.test(l) || /^(start|end)_ms=/.test(l)).map(l => l.split('=')))
const startMs = Number(env.start_ms), endMs = Number(env.end_ms)
const RAMP = Number(env.STAGE_RAMP_S || 60), HOLD = Number(env.STAGE_HOLD_S || 180)
let plan
if (env.CONST) { const [n, s] = env.CONST.split(':').map(Number); const r = Math.min(RAMP, s); plan = [{ name: 'const', charts: n, visitors: Math.round(n * Number(env.VISITOR_RATIO || 1)), ramp: r, hold: s - r }] }
else {
  const only = env.STAGES ? env.STAGES.split(',') : null
  plan = JSON.parse(fs.readFileSync(new URL('stages.json', import.meta.url))).stages.filter(s => !only || only.includes(s.name)).map(s => ({ ...s, ramp: RAMP, hold: HOLD }))
  if (env.RECOVERY_S) plan.push({ name: 'recovery', charts: Number(env.RECOVERY_CHARTS || 100), visitors: Number(env.RECOVERY_VISITORS || 200), ramp: 10, hold: Number(env.RECOVERY_S) })
}
/* hold windows (k6 starts ~1 s after start_ms; trim 10 s at each edge) */
let acc = startMs
for (const p of plan) { acc += p.ramp * 1000; p.from = acc + 10000; acc += p.hold * 1000; p.to = acc - 5000 }
const stop = read('STOP') ? JSON.parse(read('STOP').split('\n')[0]) : null
const inWin = (r, p) => r.t >= p.from && r.t <= p.to
const avg = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : null
const max = a => a.length ? Math.max(...a) : null
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const k6 = { charts: JSON.parse(read('k6-charts-summary.json') || 'null'), visitors: JSON.parse(read('k6-visitors-summary.json') || 'null') }
const sse = jsonl('sse.jsonl'), be = jsonl('backend-metrics.jsonl'), mon = jsonl('monitor.jsonl')

function k6Stage(sum, stage, ep, holdS) {
  if (!sum) return null
  const sel = ep ? `{stage:${stage},ep:${ep}}` : `{stage:${stage}}`
  const d = sum.metrics[`http_req_duration${sel}`]?.values, f = sum.metrics[`http_req_failed${sel}`]?.values
  if (!d || !d.count) return null
  return { n: d.count, rps: +(d.count / holdS).toFixed(1), avg: +d.avg.toFixed(1), p50: +d.med.toFixed(1), p95: +d['p(95)'].toFixed(1), p99: +d['p(99)'].toFixed(1), max: +d.max.toFixed(0), errPct: +((f?.rate || 0) * 100).toFixed(2) }
}
const EPC = ['context', 'accounts', 'ws_get', 'ws_put', 'preview', 'order', 'protection', 'close', 'state', 'me']
const EPV = ['document', 'asset', 'legacy', 'runtime', 'api_public']
const stages = plan.map(p => {
  const holdS = (p.to - p.from) / 1000 + 15
  const s = sse.filter(r => inWin(r, p)), b = be.filter(r => inWin(r, p)), m = mon.filter(r => inWin(r, p))
  const reached = s.length > 0 || b.length > 0
  return {
    stage: p.name, charts: p.charts, visitors: p.visitors, combined: p.charts + p.visitors, reached,
    window: { from: p.from, to: p.to },
    http: { charts: k6Stage(k6.charts, p.name, null, holdS), visitors: k6Stage(k6.visitors, p.name, null, holdS) },
    endpoints: { ...Object.fromEntries(EPC.map(e => [e, k6Stage(k6.charts, p.name, e, holdS)])), ...Object.fromEntries(EPV.map(e => [`v_${e}`, k6Stage(k6.visitors, p.name, e, holdS)])) },
    sse: s.length ? { activeAvg: avg(s.map(r => r.active)), target: p.charts, stalledMax: max(s.map(r => r.stalled)), drops: s.reduce((a, r) => a + r.drops, 0), reconnects: s.reduce((a, r) => a + r.reconnects, 0),
      errors: s.reduce((a, r) => { for (const [k, v] of Object.entries(r.errors)) a[k] = (a[k] || 0) + v; return a }, {}),
      eventsPerSec: avg(s.map(r => r.data + r.hb)), dataPerSec: avg(s.map(r => r.data)), gapP95: med(s.map(r => r.gapMs.p95).filter(x => x != null)), gapP99: med(s.map(r => r.gapMs.p99).filter(x => x != null)), gapMax: max(s.map(r => r.gapMs.max).filter(x => x != null)),
      mdDelayP50: med(s.map(r => r.mdDelayMs.p50).filter(x => x != null)), mdDelayP95: med(s.map(r => r.mdDelayMs.p95).filter(x => x != null)), mdDelayP99: med(s.map(r => r.mdDelayMs.p99).filter(x => x != null)), mdDelayMax: max(s.map(r => r.mdDelayMs.max).filter(x => x != null)),
      connectP95: med(s.map(r => r.connectMs.p95).filter(x => x != null)) } : null,
    backend: b.length ? { cpuAvg: avg(b.map(r => r.cpuPct)), cpuMax: max(b.map(r => r.cpuPct)), rssMax: max(b.map(r => r.rssMB)), heapMax: max(b.map(r => r.heapMB)),
      eldP50: med(b.map(r => r.eld.p50)), eldP99: med(b.map(r => r.eld.p99)), eldMax: max(b.map(r => r.eld.max)),
      poolWaitingAvg: avg(b.map(r => r.pool?.waiting ?? 0)), poolWaitingMax: max(b.map(r => r.pool?.waiting ?? 0)), poolTotalMax: max(b.map(r => r.pool?.total ?? 0)), poolMax: b[0].pool?.max } : null,
    postgres: m.length ? { connMax: max(m.map(r => r.connections.total)), connLimit: m[0].connections.max, tpsAvg: avg(m.map(r => r.tps).filter(x => x != null)), cpuAvg: avg(m.map(r => r.cpu.postgres)), cpuMax: max(m.map(r => r.cpu.postgres)),
      lockWaitsMax: max(m.map(r => r.lockWaits)), ungrantedLocksMax: max(m.map(r => r.ungrantedLocks)), longestQueryS: max(m.map(r => r.connections.longestQueryS)), deadlocks: m.at(-1).deadlocks - m[0].deadlocks,
      cacheHit: avg(m.map(r => r.cacheHit).filter(x => x != null)), engineLoopPassesPs: avg(m.map(r => r.engineLoopPassesPs).filter(x => x != null)) } : null,
    generators: m.length ? { cpuAvg: avg(m.map(r => r.cpu.generators)), cpuMax: max(m.map(r => r.cpu.generators)), rssMB: max(m.map(r => r.cpu.generatorsRssMB)) } : null,
  }
})
const k6Extra = k6.charts ? Object.fromEntries(['chart_save_ms', 'workspace_restore_ms', 'order_submit_ms', 'sltp_update_ms'].map(k => [k, k6.charts.metrics[k]?.values])) : null
const out = { run: RUN.split('/').at(-1), env, startMs, endMs, stop, stages, k6Extra,
  integrity: JSON.parse(read('integrity.json') || 'null'), sltp: (() => { const j = JSON.parse(read('sltp-latency.json') || 'null'); return j && { ...j, samples: undefined } })(),
  k6Counts: { integrityViolations: (k6.charts?.metrics.integrity_violations?.values.count) || 0, timeouts: k6.charts?.metrics.timeouts?.values.count || 0, conflictRate: k6.charts?.metrics.workspace_conflict_rate?.values.rate } }
fs.writeFileSync(`${RUN}/summary.json`, JSON.stringify(out, null, 1))
const f = v => v == null ? '–' : v
console.log(`run ${out.run} ${stop ? 'STOPPED: ' + stop.reason : ''}`)
console.log('stage      charts vis  | ch rps  p50   p95    p99   err% | vis rps p95   err% | sse act stall drop gap95 md95  | be cpu  eld99 poolW | pg conn tps   cpu  loop/s | gen cpu')
for (const s of stages) {
  if (!s.reached) { console.log(`${s.stage.padEnd(10)} not reached`); continue }
  const c = s.http.charts || {}, v = s.http.visitors || {}, x = s.sse || {}, b = s.backend || {}, p = s.postgres || {}, g = s.generators || {}
  console.log(`${s.stage.padEnd(10)} ${String(s.charts).padStart(5)} ${String(s.visitors).padStart(5)} | ${String(f(c.rps)).padStart(6)} ${String(f(c.p50)).padStart(5)} ${String(f(c.p95)).padStart(6)} ${String(f(c.p99)).padStart(6)} ${String(f(c.errPct)).padStart(5)} | ${String(f(v.rps)).padStart(6)} ${String(f(v.p95)).padStart(5)} ${String(f(v.errPct)).padStart(5)} | ${String(f(x.activeAvg)).padStart(7)} ${String(f(x.stalledMax)).padStart(5)} ${String(f(x.drops)).padStart(4)} ${String(f(x.gapP95)).padStart(5)} ${String(f(x.mdDelayP95)).padStart(5)} | ${String(f(b.cpuAvg)).padStart(6)} ${String(f(b.eldP99)).padStart(6)} ${String(f(b.poolWaitingAvg)).padStart(5)} | ${String(f(p.connMax)).padStart(7)} ${String(f(p.tpsAvg)).padStart(5)} ${String(f(p.cpuAvg)).padStart(4)} ${String(f(p.engineLoopPassesPs)).padStart(6)} | ${f(g.cpuAvg)}`)
}
console.log('sltp', JSON.stringify(out.sltp), 'integrity', out.integrity?.violations, 'k6', JSON.stringify(out.k6Counts))
