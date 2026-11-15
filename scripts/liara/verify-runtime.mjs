#!/usr/bin/env node
/**
 * Smoke test of a deployed regional runtime (ADR 0033). Read-only except one
 * unauthenticated POST that the Iran policy must refuse before any handler.
 *
 *   node scripts/liara/verify-runtime.mjs --url https://iran.openfund.cloud --region IRAN \
 *     [--expect-commit <40-hex>] [--out output/runtime-status.json] [--target staging|production]
 *
 * Fails when the answers come from another region (for example a proxy to
 * Render): /ready and /runtime/status must report the expected region.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const arg = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null }
const base = (arg('--url') || '').replace(/\/+$/, ''), region = arg('--region') || 'IRAN', expect = arg('--expect-commit'), out = arg('--out')
/* --content required (deployments, default) | path (CI boot without any CMS: the path must answer, content or an explicit 503) */
const contentMode = arg('--content') || 'required'
const expectVersion = arg('--expect-version'), compareWith = (arg('--compare-with') || '').replace(/\/+$/, '')
if (!/^https?:\/\//.test(base)) { console.error('--url is required'); process.exit(2) }
const checks = []
const check = (name, ok, detail) => { checks.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail != null ? ' — ' + JSON.stringify(detail) : ''}`) }
const get = async (path, init) => { const r = await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(15000), ...init }); return { status: r.status, type: r.headers.get('content-type') || '', text: await r.text() } }
const json = t => { try { return JSON.parse(t) } catch { return null } }

try {
  const health = await get('/health'); check('health 200', health.status === 200, health.status)
  const ready = await get('/ready'), rj = json(ready.text)
  check('ready', ready.status === 200 && rj?.ok, rj && { database: rj.database, marketData: rj.marketData?.execution })
  check('served by the expected region (not proxied)', rj?.region === region, rj?.region)
  const st = json((await get('/runtime/status')).text)
  check('runtime status region', st?.region === region, { mode: st?.mode, roles: st?.roles })
  const v = json((await get('/version')).text)
  if (expect) check('release commit', v?.commit === expect, v?.commit)
  if (expectVersion) check('release version', v?.version === expectVersion, v?.version)
  check('release manifests consistent', v?.status === 'matched', v?.status)
  if (compareWith) {
    /* the other region must serve the same release (Render first, then Liara) */
    const g = json(await (await fetch(compareWith + '/version', { signal: AbortSignal.timeout(15000) })).text())
    check('same commit and version as the compared region', g?.commit === v?.commit && g?.version === v?.version, { here: [v?.version, v?.commit], there: [g?.version, g?.commit] })
    /* identical source normally builds identical trees; a difference is reported for review */
    console.log(`info frontend id ${v?.frontend?.id === g?.frontend?.id ? 'identical' : 'differs'}, backend id ${v?.backend?.id === g?.backend?.id ? 'identical' : 'differs'}`)
  }
  const home = await get('/'); check('website shell', home.status === 200 && home.type.includes('text/html'), home.status)
  const rc = await get('/runtime-config.js'); check('runtime config', rc.status === 200, rc.status)
  if (region === 'IRAN') {
    check('runtime config reports region IRAN', /"region":"IRAN"/.test(rc.text))
    /* essential content comes from the same origin (live or last-known-good snapshot) */
    const home = await get('/cms/items/home_content?fields=*,translations.*')
    if (contentMode === 'path') check('content path answers (content or explicit content_unavailable)', (home.status === 200 && json(home.text)?.data != null) || (home.status === 503 && json(home.text)?.error === 'content_unavailable'), home.status)
    else check('home content served by this runtime', home.status === 200 && json(home.text)?.data != null, home.status)
    const p = await get('/purchases/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    check('purchases refused by the Iran policy', p.status === 503 && json(p.text)?.reason === 'purchases_global_region_only', p.status)
  }
} catch (e) { check('reachable', false, e.message) }

const ok = checks.every(c => c.ok)
if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify({ target: arg('--target'), url: base, region, commit: expect, status: ok ? 'verified' : 'failed', checks, at: new Date().toISOString() }, null, 2)) }
process.exit(ok ? 0 : 1)
