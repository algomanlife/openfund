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
  const home = await get('/'); check('website shell', home.status === 200 && home.type.includes('text/html'), home.status)
  const rc = await get('/runtime-config.js'); check('runtime config', rc.status === 200, rc.status)
  const cms = rc.text.match(/"cmsUrl":"([^"]+)"/)?.[1]
  if (region === 'IRAN') {
    check('CMS is not the global Render service', cms && !/onrender\.com/.test(cms), cms)
    const p = await get('/purchases/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    check('purchases refused by the Iran policy', p.status === 503 && json(p.text)?.reason === 'purchases_global_region_only', p.status)
  }
} catch (e) { check('reachable', false, e.message) }

const ok = checks.every(c => c.ok)
if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify({ target: arg('--target'), url: base, region, commit: expect, status: ok ? 'verified' : 'failed', checks, at: new Date().toISOString() }, null, 2)) }
process.exit(ok ? 0 : 1)
