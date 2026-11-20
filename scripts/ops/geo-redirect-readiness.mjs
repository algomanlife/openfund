#!/usr/bin/env node
/**
 * Readiness of the IRAN geographic redirect (ADR 0043 §Gates). READ-ONLY.
 *
 * It reads the public, credential-free endpoints of both regions and reports
 * each gate as pass, fail or owner-approval-required. It never changes
 * Cloudflare, Liara or any runtime, and it can never report "ready": the
 * last gate is always the owner's explicit approval. Enabling the rule is a
 * separate, owner-approved action (infra/cloudflare/README.md).
 *
 *   node scripts/ops/geo-redirect-readiness.mjs [--json] [--global https://openfi.cloud] [--iran https://openfi.live]
 *
 * Exit status: 0 when no gate fails (only owner approval remains), 1 when any
 * gate fails, 2 when the script itself could not run.
 *
 * Privacy: /runtime/ingress echoes the caller's own forwarded addresses and
 * country. Only the hop count, whether the last hop is Cloudflare and the
 * country source are kept; addresses and the country are never printed.
 */
import https from 'node:https'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { IRAN_ALIAS_CASES, NAV } from '../cloudflare/verify-public.mjs'
import { CANONICAL } from '../../infra/cloudflare/policy.mjs'

const root = new URL('../../', import.meta.url)
export const GATE = Object.freeze({ pass: 'pass', fail: 'fail', owner: 'owner-approval-required' })

/* ---------- observation (network, read-only GET/HEAD) ---------- */

function request(url, { headers = { accept: '*/*' }, timeout = 20000 } = {}) {
  return new Promise(resolve => {
    const u = new URL(url)
    const req = https.request({ host: u.hostname, path: u.pathname + u.search, method: 'GET', timeout,
      headers: { 'user-agent': 'openfund-geo-readiness', ...headers } }, res => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', d => { if (body.length < 200000) body += d })
      res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location ?? null, body }))
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', e => resolve({ status: null, error: e.code || e.message, body: '' }))
    req.end()
  })
}
const json = body => { try { return JSON.parse(body) } catch { return null } }

/** /runtime-config.js → its JSON object, or null */
export function parseRuntimeConfig(body) {
  const m = String(body || '').match(/__OPENFUND_RUNTIME_CONFIG__\s*=\s*(\{[\s\S]*\})\s*;?\s*$/)
  return m ? json(m[1]) : null
}

/** what one region publishes, reduced to the fields the gates need */
export async function observeRegion(origin, get = request) {
  const [version, config, ingress, ready] = await Promise.all(
    ['/version', '/runtime-config.js', '/runtime/ingress', '/ready'].map(p => get(origin + p)))
  const v = json(version.body), c = parseRuntimeConfig(config.body), i = json(ingress.body), r = json(ready.body)
  return {
    origin,
    version: v ? { http: version.status, status: v.status ?? null, version: v.version ?? null, commit: v.commit ?? null, official: v.manifest?.official === true } : { http: version.status ?? version.error },
    runtimeConfig: c ? { http: config.status, region: c.region ?? null, hasGeoLocale: typeof c.geoLocale === 'string' } : { http: config.status ?? config.error },
    /* never the addresses or the country: they are the caller's own */
    ingress: i && ingress.status === 200 ? { http: 200, countrySource: i.countrySource ?? null, forwardedHops: i.forwardedHops ?? null, lastHopCloudflare: i.lastHopCloudflare === true } : { http: ingress.status ?? ingress.error },
    ready: r ? { http: ready.status, region: r.region ?? null, execution: r.marketData?.execution ?? null } : { http: ready.status ?? ready.error },
  }
}

export async function observe({ globalOrigin = CANONICAL.GLOBAL, iranOrigin = CANONICAL.IRAN, get = request } = {}) {
  const stack = JSON.parse(readFileSync(new URL('infra/liara-iran-runtime/stack.json', root), 'utf8'))
  const worker = stack.environments.production.apps.find(a => a.role === 'worker').id
  const adr0044 = readFileSync(new URL('docs/decisions/0044-cross-region-operation-forwarding.md', root), 'utf8')
  const [global, iran] = await Promise.all([observeRegion(globalOrigin, get), observeRegion(iranOrigin, get)])
  const aliases = []
  for (const c of IRAN_ALIAS_CASES) {
    const r = await get(c.url, { headers: c.headers ?? NAV })
    const ok = (c.status ? r.status === c.status : !c.statusNot.includes(r.status)) && (!c.location || r.location === c.location)
    aliases.push({ url: c.url, expected: c.status ?? `not ${c.statusNot.join('/')}`, status: r.status ?? r.error, location: r.location ?? null, ok })
  }
  const workerHealth = await get(`https://${worker}.liara.run/health`)
  return {
    observedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    global, iran, aliases,
    worker: { host: `${worker}.liara.run`, http: workerHealth.status ?? workerHealth.error, servesOpenfund: json(workerHealth.body)?.ok === true },
    adr0044Status: (adr0044.match(/^- \*\*Status:\*\*\s*(.+)$/m)?.[1] ?? 'unknown').trim(),
  }
}

/* ---------- evaluation (pure) ---------- */

export function evaluateGates(o) {
  const g = o.global, i = o.iran
  const checks = (...list) => list.map(([ok, text]) => ({ ok: !!ok, text }))

  const g1 = checks(
    [g.version.status === 'matched' && i.version.status === 'matched', `release identity matched on both (GLOBAL ${g.version.status ?? g.version.http}, IRAN ${i.version.status ?? i.version.http})`],
    [g.version.official && i.version.official, `official release on both (GLOBAL ${g.version.official ? 'official' : 'unofficial'}, IRAN ${i.version.official ? 'official' : 'unofficial'})`],
    [g.version.commit && g.version.commit === i.version.commit, `same release on both (GLOBAL ${g.version.version ?? '?'} ${String(g.version.commit ?? '?').slice(0, 7)}, IRAN ${i.version.version ?? '?'} ${String(i.version.commit ?? '?').slice(0, 7)})`],
    [g.runtimeConfig.hasGeoLocale && i.runtimeConfig.hasGeoLocale, `runtime-config.js carries geoLocale (GLOBAL ${g.runtimeConfig.hasGeoLocale ? 'yes' : 'no'}, IRAN ${i.runtimeConfig.hasGeoLocale ? 'yes' : 'no'})`],
    [g.ingress.http === 200 && i.ingress.http === 200, `/runtime/ingress served (GLOBAL ${g.ingress.http}, IRAN ${i.ingress.http})`],
    ...o.aliases.map(a => [a.ok, `${a.url} → ${a.status}${a.location ? ' ' + a.location : ''} (expected ${a.expected})`]),
  )
  const g2 = checks([i.ready.region === 'IRAN' && i.ready.execution === 'available_for_fresh_markets', `IRAN /ready execution: ${i.ready.execution ?? i.ready.http}`])
  const g3 = checks([!o.worker.servesOpenfund, `${o.worker.host}/health → ${o.worker.http}${o.worker.servesOpenfund ? ' (Openfund answers: default subdomain enabled)' : ' (no Openfund service)'}`])
  const proposed = /^proposed|not implemented/i.test(o.adr0044Status)

  const gates = [
    { id: 1, name: 'ADR 0043 release on both regions; Iran alias redirects verified', checks: g1, result: g1.every(c => c.ok) ? GATE.pass : GATE.fail },
    { id: 2, name: 'Iran web reports fresh marks', checks: g2, result: g2.every(c => c.ok) ? GATE.pass : GATE.fail },
    { id: 3, name: "Worker's default subdomain disabled", checks: g3, result: g3.every(c => c.ok) ? GATE.pass : GATE.fail },
    { id: 4, name: 'Cross-region identity and operation forwarding (ADR 0044) implemented, tested on two regions, approved',
      checks: checks([!proposed, `ADR 0044 status: ${o.adr0044Status}`]),
      /* implementation is visible in the repository; two-region acceptance is the owner's */
      result: proposed ? GATE.fail : GATE.owner },
    { id: 5, name: 'Explicit owner approval to enable openfund_geo_iran', checks: checks([false, 'recorded outside this script; never inferred']), result: GATE.owner },
  ]
  const advisory = [
    { ok: g.ingress.lastHopCloudflare === true, text: `GLOBAL last ingress hop is Cloudflare: ${g.ingress.http === 200 ? g.ingress.lastHopCloudflare : g.ingress.http}` },
    { ok: i.ingress.countrySource === 'ip-database', text: `IRAN country source: ${i.ingress.countrySource ?? `unknown (/runtime/ingress ${i.ingress.http})`} — direct openfi.live visitors get a country locale only with ip-database` },
  ]
  const verdict = gates.some(x => x.result === GATE.fail) ? 'not_ready' : 'awaiting_owner_approval'
  return { observedAt: o.observedAt, verdict, gates, advisory }
}

export function formatReport(report) {
  const mark = { [GATE.pass]: 'PASS ', [GATE.fail]: 'FAIL ', [GATE.owner]: 'OWNER' }
  const lines = [`Geographic redirect readiness (ADR 0043 §Gates) — observed ${report.observedAt}`, '']
  for (const g of report.gates) {
    lines.push(`[${mark[g.result]}] Gate ${g.id}: ${g.name}`)
    for (const c of g.checks) lines.push(`         ${g.result === GATE.owner && !c.ok ? '·' : c.ok ? '✓' : '✗'} ${c.text}`)
  }
  lines.push('', 'Advisory (not gates):')
  for (const a of report.advisory) lines.push(`         ${a.ok ? '✓' : '✗'} ${a.text}`)
  lines.push('', `Verdict: ${report.verdict === 'not_ready' ? 'NOT READY — keep openfund_geo_iran disabled' : 'all verifiable gates pass; owner approval still required'}`)
  return lines.join('\n')
}

async function main() {
  const arg = name => { const k = process.argv.indexOf(name); return k > 0 ? process.argv[k + 1] : undefined }
  const report = evaluateGates(await observe({ globalOrigin: arg('--global'), iranOrigin: arg('--iran') }))
  console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 2) : formatReport(report))
  process.exit(report.verdict === 'not_ready' ? 1 : 0)
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e); process.exit(2) })
