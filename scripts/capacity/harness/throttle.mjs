/**
 * CPU quota emulation for macOS (no cgroups; cpulimit 0.2 does not throttle here).
 * Behaves like a Linux CFS quota (what container CPU limits use): per 100 ms
 * period the target processes may consume <pct> ms of CPU in total; once the
 * quota is used up they are SIGSTOPped until the next period. An idle or
 * lightly loaded process is never throttled. CPU time is read with `ps -o time`
 * (10 ms resolution) every 10 ms, so enforcement can overshoot by ~10–20 ms
 * per period; the effective cap is measured and reported in each run.
 *   node throttle.mjs <pct> pid <pid>            one process (Node backend)
 *   node throttle.mjs <pct> children <ppid>      all children of a parent
 *                                                (PostgreSQL backends of one cluster)
 */
import { execFileSync } from 'node:child_process'
const [pct, mode, id] = process.argv.slice(2)
const QUOTA_MS = Math.max(1, Math.min(100, Number(pct)))
const PERIOD = 100
let pids = [], lastScan = 0, periodStart = Date.now(), periodBase = null, stopped = false
const scan = () => {
  if (mode === 'pid') return [Number(id)]
  try { return execFileSync('pgrep', ['-P', id], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).map(Number) } catch { return [] }
}
const parse = t => { const m = t.trim().match(/^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$/); if (!m) return 0; return ((+(m[1] || 0) * 24 + +(m[2] || 0)) * 3600 + +m[3] * 60 + +m[4]) * 1000 }
const cpuMs = () => { try { return execFileSync('ps', ['-o', 'time=', '-p', pids.join(',')], { encoding: 'utf8' }).trim().split('\n').reduce((a, l) => a + parse(l), 0) } catch { return null } }
const sig = s => { for (const p of pids) { try { process.kill(p, s) } catch {} } }
function tick() {
  const now = Date.now()
  if (now - lastScan > 1000) { const n = scan(); if (n.join() !== pids.join()) { if (stopped) sig('SIGCONT'); pids = n; stopped = false; periodBase = null } lastScan = now }
  if (!pids.length) return
  if (now - periodStart >= PERIOD) { periodStart = now; if (stopped) { sig('SIGCONT'); stopped = false } periodBase = cpuMs(); return }
  if (stopped || periodBase == null) return
  const used = cpuMs()
  if (used != null && used - periodBase >= QUOTA_MS) { sig('SIGSTOP'); stopped = true }
}
const timer = setInterval(tick, 10)
const end = () => { clearInterval(timer); sig('SIGCONT'); process.exit(0) }
process.on('SIGINT', end); process.on('SIGTERM', end)
