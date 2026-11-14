#!/usr/bin/env node
/* Post-deploy verification for the Iran edge (ADR 0031).

   Usage:
     node scripts/liara/verify-edge.mjs --edge https://iran.openfund.cloud \
       --upstream https://<render-service>.onrender.com \
       [--target staging|production] [--expect-edge-commit <sha>] [--expect-app-commit <sha>]
       [--out output/liara-edge-status.json]

   Read-only: GET requests plus one POST to a path that does not exist (the
   backend answers it before any route or database write). No credentials,
   cookies or wallet signatures are used. Exits non-zero on any failure. */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : 'true'])
  return acc
}, []))
const edge = (args.edge || '').replace(/\/$/, '')
const upstream = (args.upstream || '').replace(/\/$/, '')
if (!/^https?:\/\//.test(edge) || !/^https?:\/\//.test(upstream)) {
  console.error('usage: verify-edge.mjs --edge <url> --upstream <url> [--expect-edge-commit sha] [--expect-app-commit sha] [--out file]')
  process.exit(2)
}
const edgeOrigin = new URL(edge).origin
const results = []
const timeout = () => AbortSignal.timeout(20_000)
const get = (base, p, headers = {}) => fetch(base + p, { headers, redirect: 'manual', signal: timeout() })
const sha256 = buf => crypto.createHash('sha256').update(Buffer.from(buf)).digest('hex')

async function check(name, fn) {
  try {
    const detail = await fn()
    results.push({ name, ok: true, detail: detail ?? null })
    console.log(`PASS ${name}${detail ? ` - ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`)
  } catch (e) {
    results.push({ name, ok: false, detail: e.message })
    console.log(`FAIL ${name} - ${e.message}`)
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg) }

let edgeVersion, upstreamVersion, html

await check('edge liveness (/__edge/live)', async () => {
  const r = await get(edge, '/__edge/live')
  expect(r.status === 200, `status ${r.status}`)
  expect((await r.json()).ok === true, 'ok is not true')
})

await check('edge release identity (/__edge/info)', async () => {
  const r = await get(edge, '/__edge/info')
  expect(r.status === 200, `status ${r.status}`)
  const info = await r.json()
  if (args['expect-edge-commit']) expect(info.commit === args['expect-edge-commit'], `edge commit ${info.commit} != ${args['expect-edge-commit']}`)
  return { commit: info.commit }
})

await check('origin readiness through the edge (/__edge/ready)', async () => {
  const r = await get(edge, '/__edge/ready')
  expect(r.status === 200, `status ${r.status}`)
  expect((await r.json()).ok === true, 'backend /health is not ok')
})

await check('application version through the edge equals the origin', async () => {
  edgeVersion = await (await get(edge, '/version')).json()
  upstreamVersion = await (await get(upstream, '/version')).json()
  expect(edgeVersion.status === 'matched', `edge /version status ${edgeVersion.status}`)
  expect(edgeVersion.commit === upstreamVersion.commit, `edge ${edgeVersion.commit} != origin ${upstreamVersion.commit}`)
  expect(edgeVersion.backend?.id === upstreamVersion.backend?.id, 'backend id differs')
  expect(edgeVersion.frontend?.id === upstreamVersion.frontend?.id, 'frontend id differs')
  if (args['expect-app-commit']) expect(edgeVersion.commit === args['expect-app-commit'], `app commit ${edgeVersion.commit} != expected ${args['expect-app-commit']}`)
  return { version: edgeVersion.version, commit: edgeVersion.commit }
})

await check('HTML shell served with the backend CSP and noindex', async () => {
  const r = await get(edge, '/', { accept: 'text/html' })
  expect(r.status === 200, `status ${r.status}`)
  expect((r.headers.get('content-type') || '').includes('text/html'), 'not text/html')
  expect(r.headers.get('content-security-policy'), 'missing Content-Security-Policy')
  expect((r.headers.get('x-robots-tag') || '').includes('noindex'), 'missing X-Robots-Tag noindex')
  html = await r.text()
})

await check('runtime configuration identical to the origin', async () => {
  const a = await (await get(edge, '/runtime-config.js')).text()
  const b = await (await get(upstream, '/runtime-config.js')).text()
  expect(a.startsWith('window.__OPENFUND_RUNTIME_CONFIG__='), 'unexpected body')
  expect(a === b, 'edge and origin runtime config differ')
})

await check('hashed asset byte-identical to the origin and cached at the edge', async () => {
  const asset = html?.match(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/)?.[0]
  expect(asset, 'no /assets/ reference in the HTML shell')
  const e1 = await get(edge, asset); const body = await e1.arrayBuffer()
  const e2 = await get(edge, asset); await e2.arrayBuffer()
  const o = await (await get(upstream, asset)).arrayBuffer()
  expect(e1.status === 200, `status ${e1.status}`)
  expect(sha256(body) === sha256(o), 'asset bytes differ from origin')
  const cache = e2.headers.get('x-edge-cache')
  expect(['HIT', 'UPDATING', 'STALE'].includes(cache), `second request cache status ${cache}`)
  return { asset, cache }
})

await check("edge Origin accepted by the backend's same-origin check", async () => {
  const r = await fetch(`${edge}/__openfund-edge-origin-probe`, { method: 'POST', headers: { origin: edgeOrigin }, signal: timeout() })
  expect(r.status === 404, `expected 404 not_found, got ${r.status}`)
})

await check('foreign Origin still rejected by the backend', async () => {
  const r = await fetch(`${edge}/__openfund-edge-origin-probe`, { method: 'POST', headers: { origin: 'https://evil.example' }, signal: timeout() })
  expect(r.status === 403, `expected 403 invalid_origin, got ${r.status}`)
})

await check('operator and DePay server routes blocked at the edge', async () => {
  for (const p of ['/admin', '/internal/x', '/purchases/depay/callback', '/api/payments/depay/events']) {
    const r = await get(edge, p)
    expect(r.status === 404, `${p} returned ${r.status}`)
  }
})

await check('authenticated API answers through the edge (unauthenticated = 401)', async () => {
  const r = await get(edge, '/trading/health')
  expect(r.status === 401, `status ${r.status}`)
})

await check('visitor IP echo answers (/__edge/whoami)', async () => {
  const r = await get(edge, '/__edge/whoami')
  expect(r.status === 200, `status ${r.status}`)
  const { clientIp } = await r.json()
  expect(typeof clientIp === 'string' && clientIp.length > 0, 'no clientIp')
  return { clientIp }
})

await check('robots.txt disallows the mirror', async () => {
  const t = await (await get(edge, '/robots.txt')).text()
  expect(/Disallow: \/\s*$/.test(t), 'robots.txt does not disallow /')
})

const failed = results.filter(r => !r.ok)
const status = {
  checkedAt: new Date().toISOString(), target: args.target || 'manual', edge, upstream,
  edgeCommit: results.find(r => r.name.startsWith('edge release'))?.detail?.commit ?? null,
  application: edgeVersion ? { version: edgeVersion.version, commit: edgeVersion.commit } : null,
  status: failed.length ? 'failed' : 'verified', results,
  notVerifiedHere: ['that clientIp above equals the caller address as seen from outside Liara', 'wallet sign-in (SIWE) on the edge host', 'authenticated SSE streaming', 'checkout', 'reachability from Iranian ISPs'],
}
if (args.out) { fs.mkdirSync(path.dirname(args.out), { recursive: true }); fs.writeFileSync(args.out, JSON.stringify(status, null, 2) + '\n') }
console.log(`\n${failed.length ? 'FAILED' : 'VERIFIED'}: ${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
