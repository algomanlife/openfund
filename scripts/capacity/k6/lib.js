/* Shared k6 helpers: stage schedule (same staircase as harness/sse-swarm.mjs),
   steady-state stage tagging, per-stage/per-endpoint summary sub-metrics and
   stop conditions. */
import exec from 'k6/execution'

const cfg = JSON.parse(open('../harness/stages.json'))
export const RAMP = Number(__ENV.STAGE_RAMP_S || 60)
export const HOLD = Number(__ENV.STAGE_HOLD_S || 180)
export const TARGET = __ENV.TARGET || 'http://127.0.0.1:18080'
if (!/^http:\/\/(127\.0\.0\.1|localhost):|^https:\/\/[^/]*(staging|-stg\.)/.test(TARGET)) throw new Error(`refusing non-local, non-staging TARGET ${TARGET}`)

/* ordered plan: [{name, key-targets, ramp, hold}] */
export function plan() {
  if (__ENV.CONST) { const [n, s] = __ENV.CONST.split(':').map(Number); const r = Math.min(RAMP, s); return [{ name: 'const', charts: n, visitors: Math.round(n * Number(__ENV.VISITOR_RATIO || 1)), ramp: r, hold: s - r }] }
  const only = __ENV.STAGES ? __ENV.STAGES.split(',') : null
  const out = cfg.stages.filter(s => !only || only.includes(s.name)).map(s => ({ ...s, ramp: RAMP, hold: HOLD }))
  if (__ENV.RECOVERY_S) out.push({ name: 'recovery', charts: Number(__ENV.RECOVERY_CHARTS || 100), visitors: Number(__ENV.RECOVERY_VISITORS || 200), ramp: 10, hold: Number(__ENV.RECOVERY_S) })
  return out
}
export function k6Stages(key) {
  const out = []
  for (const s of plan()) out.push({ duration: `${s.ramp}s`, target: s[key] }, { duration: `${s.hold}s`, target: s[key] })
  return out
}
/* 'peak' during the hold window of peak, 'ramp' while ramping */
export function stageNow() {
  const t = (Date.now() - exec.scenario.startTime) / 1000
  let acc = 0
  for (const s of plan()) {
    if (t < acc + s.ramp) return 'ramp'
    acc += s.ramp
    if (t < acc + s.hold) return s.name
    acc += s.hold
  }
  return 'end'
}
/* dummy thresholds force per-stage, per-endpoint sub-metrics into the summary */
export function stageThresholds(endpoints) {
  const th = {}
  for (const s of plan()) {
    th[`http_req_duration{stage:${s.name}}`] = ['p(99)>=0']
    th[`http_req_failed{stage:${s.name}}`] = ['rate>=0']
    th[`http_reqs{stage:${s.name}}`] = ['count>=0']
    for (const e of endpoints) {
      th[`http_req_duration{stage:${s.name},ep:${e}}`] = ['p(99)>=0']
      th[`http_req_failed{stage:${s.name},ep:${e}}`] = ['rate>=0']
    }
  }
  return th
}
/* stop conditions (abortOnFail ends the whole run) */
export const stopThresholds = {
  http_req_failed: [{ threshold: 'rate<0.25', abortOnFail: true, delayAbortEval: '60s' }],
  integrity_violations: [{ threshold: 'count<1', abortOnFail: __ENV.ABORT_ON_INTEGRITY !== '0' }],
}
export const summaryTrendStats = ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count']

/* canonical JSON (jsonb re-orders keys) + FNV-1a hash for confirmed-write bookkeeping */
export function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'
  if (v && typeof v === 'object') return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'
  return JSON.stringify(v)
}
export function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 } return h.toString(16) }
