/**
 * Openfund — signed-in chart user workload (HTTP half; the SSE stream for
 * the same user is held by harness/sse-swarm.mjs, slot = __VU - 1).
 *
 * Modelled on the shipped client:
 *   - terminal boot: /auth/me, /accounts, /chart/workspaces/prop (restore),
 *     /trading/state, /products/prop/context
 *   - TerminalShell live /products/prop/context: 5 s timer + refetch on SSE
 *     push throttled to 2 s  → one call per ~2.5 s cycle here
 *   - Accounts.tsx /accounts every 15 s
 *   - chart-workspace.js saves: '*' settings (timeframe/indicators/tools)
 *     and per-symbol drawings with optimistic revisions (409 → adopt)
 *   - order review → submit with Idempotency-Key (+ deliberate retries),
 *     SL/TP edits, partial/complete closes
 *   - multi-tab concurrent saves (same base revision, parallel)
 *   - cross-wallet probe (stale identity header must be refused)
 * Candles and live chart prices come from Gains directly in the browser and
 * never touch this backend (see browser/chart-render.mjs for that path).
 */
import http from 'k6/http'
import { sleep, check } from 'k6'
import { Counter, Trend, Rate } from 'k6/metrics'
import { SharedArray } from 'k6/data'
import { TARGET, k6Stages, stageNow, stageThresholds, stopThresholds, summaryTrendStats, canon, fnv } from './lib.js'

const users = new SharedArray('users', () => JSON.parse(open(__ENV.USERS || '../results/users.json')))
const integrity = new Counter('integrity_violations')
const saveMs = new Trend('chart_save_ms', true)
const restoreMs = new Trend('workspace_restore_ms', true)
const orderMs = new Trend('order_submit_ms', true)
const protMs = new Trend('sltp_update_ms', true)
const conflicts = new Rate('workspace_conflict_rate')
const timeouts = new Counter('timeouts')
const EP = ['context', 'accounts', 'ws_get', 'ws_put', 'preview', 'order', 'protection', 'close', 'state', 'me']

export const options = {
  scenarios: { charts: { executor: 'ramping-vus', startVUs: 0, stages: k6Stages('charts'), gracefulRampDown: '5s', gracefulStop: '10s' } },
  thresholds: { ...stopThresholds, ...stageThresholds(EP), chart_save_ms: ['p(95)>=0'], order_submit_ms: ['p(95)>=0'] },
  summaryTrendStats,
  discardResponseBodies: false,
  noConnectionReuse: false,
  insecureSkipTLSVerify: false,
}

const SYMBOLS = ['BTC/USD', 'ETH/USD', 'LT/USD', 'EUR/USD', 'SYN3/USD', 'SYN17/USD', 'SYN42/USD']
const TFS = ['1m', '5m', '15m', '1h', '4h', '1d']
const IND = ['RSI', 'MACD', 'EMA', 'SMA', 'BB', 'VWAP', 'ATR', 'Stoch']

/* VU-local state */
let me, boot = false, iter = 0, positions = [], revs = {}
const confirmed = {} /* scope → {rev, hash} of the last write this VU saw confirmed */

function req(method, path, body, ep, extra = {}) {
  const tags = { ep, stage: stageNow() }
  const headers = { cookie: me.cookie, 'x-forwarded-for': me.xff, 'content-type': 'application/json', origin: TARGET, ...extra }
  const r = http.request(method, TARGET + path, body == null ? null : JSON.stringify(body), { headers, tags, timeout: '30s', responseCallback: http.expectedStatuses({ min: 200, max: 299 }, 409) })
  if (r.error_code === 1050) timeouts.add(1, tags)
  return r
}
const flag = (kind, detail) => { integrity.add(1, { kind }); console.error(`[integrity] ${kind} user=${me.i} ${detail || ''}`) }
const pick = a => a[Math.floor(Math.random() * a.length)]

function adoptWorkspace(body) {
  for (const e of body.entries || []) {
    revs[e.scope] = e.revision
    if (e.data && e.data.owner && e.data.owner !== me.userId) flag('cross_wallet_read', `scope=${e.scope} owner=${e.data.owner}`)
    const c = confirmed[e.scope]
    if (c) {
      if (e.revision < c.rev) flag('lost_confirmed_update', `scope=${e.scope} server=${e.revision} confirmed=${c.rev}`)
      else if (e.revision === c.rev && fnv(canon(e.data)) !== c.hash) flag('workspace_content_mismatch', `scope=${e.scope} rev=${e.revision}`)
    }
  }
}
function restore() {
  const r = req('GET', '/chart/workspaces/prop', null, 'ws_get', { 'x-openfund-chart-user': me.userId })
  restoreMs.add(r.timings.duration)
  if (r.status === 200) { try { adoptWorkspace(r.json()) } catch { flag('malformed_workspace_response') } }
}
function settingsDoc() {
  const n = 1 + Math.floor(Math.random() * 8)
  return { owner: me.userId, workspace: `layout-${Math.floor(Math.random() * 4)}`,
    config: { timeframe: pick(TFS), symbol: pick(SYMBOLS), chartType: pick(['candles', 'line', 'heikin']),
      indicators: Array.from({ length: n }, (_, k) => ({ id: `${pick(IND)}-${k}`, inputs: { length: 5 + k * 3, source: 'close', mult: 2 }, style: { color: '#26a69a', width: 1 + (k % 3) } })) },
    tools: { magnet: Math.random() < 0.5, defaults: { trendline: { color: '#2962ff', width: 2 }, fib: { levels: [0, 0.236, 0.382, 0.5, 0.618, 1] } } } }
}
function drawingsDoc(symbol) {
  const n = 1 + Math.floor(Math.random() * 30)
  const now = Date.now()
  return { owner: me.userId, symbol, drawings: Array.from({ length: n }, (_, k) => ({ id: `d${k}`, type: pick(['trendline', 'hline', 'fib', 'rect', 'text']),
    points: [{ t: now - k * 6e4, p: 100 + k }, { t: now - k * 3e4, p: 101 + k }], style: { color: '#ff9800', width: 2 }, text: k % 5 === 0 ? 'note ' + k : undefined })) }
}
function save(scope, doc) {
  const base = revs[scope] || 0
  const r = req('PUT', `/chart/workspaces/prop/${encodeURIComponent(scope)}`, { data: doc, schemaVersion: 1, baseRevision: base }, 'ws_put', { 'x-openfund-chart-user': me.userId })
  saveMs.add(r.timings.duration)
  conflicts.add(r.status === 409)
  if (r.status === 200) {
    const b = r.json()
    if (b.revision !== base + 1) flag('revision_skip', `scope=${scope} base=${base} got=${b.revision}`)
    revs[scope] = b.revision; confirmed[scope] = { rev: b.revision, hash: fnv(canon(doc)) }
  } else if (r.status === 409) {
    const cur = r.json('current')
    if (cur) revs[scope] = cur.revision
  }
  return r
}
/* two tabs flush the same entry at the same instant from the same base */
function multiTab() {
  const scope = pick(SYMBOLS), base = revs[scope] || 0
  const mk = () => ({ method: 'PUT', url: `${TARGET}/chart/workspaces/prop/${encodeURIComponent(scope)}`, body: JSON.stringify({ data: drawingsDoc(scope), schemaVersion: 1, baseRevision: base }),
    params: { headers: { cookie: me.cookie, 'x-forwarded-for': me.xff, 'content-type': 'application/json', origin: TARGET, 'x-openfund-chart-user': me.userId }, tags: { ep: 'ws_put', stage: stageNow(), multitab: '1' }, responseCallback: http.expectedStatuses({ min: 200, max: 299 }, 409) } })
  const a = mk(), b = mk()
  const [ra, rb] = http.batch([a, b])
  const ok = [ra, rb].filter(r => r.status === 200)
  if (ok.length > 1) flag('multitab_double_commit', `scope=${scope} base=${base}`)
  for (const [r, q] of [[ra, a], [rb, b]]) if (r.status === 200) { const rv = r.json('revision'); revs[scope] = rv; confirmed[scope] = { rev: rv, hash: fnv(canon(JSON.parse(q.body).data)) } }
  if (!ok.length) { const cur = (ra.status === 409 ? ra : rb).json('current'); if (cur) revs[scope] = cur.revision }
}
function context() {
  const r = req('GET', '/products/prop/context', null, 'context')
  if (r.status === 200) {
    try {
      const b = r.json()
      positions = (b.state && b.state.positions) || []
      for (const p of positions) {
        if (p.status !== 'open') flag('closed_position_in_open_list', p.id)
        if (Number(p.quantity) <= 0 || Number(p.margin) <= 0) flag('corrupt_position', `${p.id} qty=${p.quantity} margin=${p.margin}`)
      }
      if (b.wallet && b.wallet !== me.address) flag('cross_wallet_context', b.wallet)
    } catch { flag('malformed_context') }
  }
}
function order() {
  const market = Math.random() < 0.6 ? 'LT/USD' : pick(['BTC/USD', 'ETH/USD', 'SYN3/USD'])
  const side = Math.random() < 0.5 ? 'long' : 'short'
  const base = { market, side, order_type: 'market', margin: '20', leverage: 5, product: 'prop' }
  const pv = req('POST', '/trading/preview', base, 'preview')
  if (pv.status !== 200) return
  const entry = Number(pv.json('entry_price'))
  const body = { ...base, sl: (entry * (side === 'long' ? 0.85 : 1.15)).toPrecision(8), tp: (entry * (side === 'long' ? 1.25 : 0.75)).toPrecision(8) }
  const key = `k6-${me.i}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const r = req('POST', '/trading/order', body, 'order', { 'idempotency-key': key })
  orderMs.add(r.timings.duration)
  /* client retry with the same key (lost response / double click) must not create a second order */
  if (Math.random() < 0.3 && r.status === 200) {
    const r2 = req('POST', '/trading/order', body, 'order', { 'idempotency-key': key })
    if (r2.status === 200) {
      const a = r.json('order.id'), b2 = r2.json('order.id')
      if (a && b2 && a !== b2) flag('duplicate_order_on_retry', `${a} vs ${b2}`)
      if (!r2.json('duplicate')) flag('retry_not_marked_duplicate', key)
    }
  }
}
function protection() {
  const p = positions.find(x => x.status === 'open' && x.mark_price)
  if (!p) return
  const m = Number(p.mark_price), long = p.side === 'long'
  const sl = (m * (long ? 0.8 : 1.2)).toPrecision(8), tp = (m * (long ? 1.3 : 0.7)).toPrecision(8)
  const r = req('POST', `/trading/positions/${p.id}/protection`, { sl, tp }, 'protection', { 'idempotency-key': `p-${me.i}-${Date.now()}` })
  protMs.add(r.timings.duration)
}
function closePos() {
  const p = positions.find(x => x.status === 'open' && x.market !== 'LT/USD') || (positions.length > 3 && positions[positions.length - 1])
  if (!p) return
  req('POST', `/trading/positions/${p.id}/close`, { fraction: Math.random() < 0.3 ? 0.5 : 1 }, 'close', { 'idempotency-key': `c-${me.i}-${p.id}-${iter}` })
}
function crossWalletProbe() {
  const other = users[(me.i + 7) % users.length]
  const r = req('GET', '/chart/workspaces/prop', null, 'ws_get', { 'x-openfund-chart-user': other.userId })
  check(r, { 'stale identity header refused': x => x.status === 409 })
  if (r.status === 200) flag('cross_wallet_header_accepted', other.userId)
}

export default function () {
  if (!me) me = users[(__VU - 1) % users.length]
  const t0 = Date.now()
  if (!boot) {
    req('GET', '/auth/me', null, 'me'); req('GET', '/accounts', null, 'accounts')
    restore(); req('GET', '/trading/state', null, 'state'); context()
    boot = true
  }
  iter++
  context()
  if (iter % 6 === 0) req('GET', '/accounts', null, 'accounts')
  const x = Math.random()
  if (x < 0.05) save('*', settingsDoc())                     /* timeframe / indicator / style change */
  else if (x < 0.13) { const s = pick(SYMBOLS); save(s, drawingsDoc(s)) } /* drawing edit on current symbol */
  else if (x < 0.16) order()
  else if (x < 0.19) protection()                            /* SL/TP drag → risk/reward overlay update */
  else if (x < 0.20) closePos()
  else if (x < 0.215) multiTab()
  else if (x < 0.235) restore()                              /* reload / second device: wallet workspace restore */
  else if (x < 0.24) crossWalletProbe()
  const spent = (Date.now() - t0) / 1000
  sleep(Math.max(0.2, 2.5 - spent + (Math.random() - 0.5) * 0.4))
}

export function handleSummary(data) {
  return { [`${__ENV.RUN_DIR || '.'}/k6-charts-summary.json`]: JSON.stringify(data, null, 1), stdout: `charts: ${data.metrics.http_reqs?.values.count} req, failed ${(100 * (data.metrics.http_req_failed?.values.rate || 0)).toFixed(2)}%, integrity ${data.metrics.integrity_violations?.values.count || 0}\n` }
}
