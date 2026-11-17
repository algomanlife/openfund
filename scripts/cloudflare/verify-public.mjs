#!/usr/bin/env node
/**
 * Public, credential-free verification of the domain policy (ADR 0043).
 * Real HTTPS requests from wherever this runs; it cannot prove geographic
 * routing (that needs a probe inside the country), and it does not try to.
 *
 *   node scripts/cloudflare/verify-public.mjs [--iran-aliases]   # exit 1 on any failure
 *
 * --iran-aliases also requires the Liara-side 301s (needs a release with
 * canonical-host.js deployed to openfund-iran and its env set).
 */
import https from 'node:https'
import tls from 'node:tls'

const get = (url, { method = 'GET', headers = {} } = {}) => new Promise((resolve, reject) => {
  const u = new URL(url)
  const req = https.request({ host: u.hostname, path: u.pathname + u.search, method, headers: { 'user-agent': 'openfund-verify-public', accept: 'text/html', ...headers }, timeout: 20000 }, res => {
    res.resume(); res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location ?? null }))
  })
  req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', reject)
  req.end()
})
const certOk = host => new Promise(resolve => {
  const s = tls.connect({ host, port: 443, servername: host, timeout: 15000 }, () => { resolve(s.authorized ? 'valid' : `invalid: ${s.authorizationError}`); s.end() })
  s.on('error', e => resolve(`error: ${e.code || e.message}`)); s.on('timeout', () => { s.destroy(); resolve('timeout') })
})

export const CASES = [
  /* GLOBAL canonical aliases (Cloudflare) */
  { url: 'https://openfund.cloud/fa/challenges?plan=25k', status: 301, location: 'https://openfi.cloud/fa/challenges?plan=25k' },
  { url: 'https://www.openfund.cloud/en/home?a=1&b=2', status: 301, location: 'https://openfi.cloud/en/home?a=1&b=2' },
  { url: 'https://www.openfi.cloud/ru/markets', status: 301, location: 'https://openfi.cloud/ru/markets' },
  /* never redirected */
  { url: 'https://openfi.cloud/fa/home', status: 200 },
  { url: 'https://openfund.cloud/version', status: 200 },
  { url: 'https://openfund.cloud/health', status: 200 },
  { url: 'https://openfund.cloud/sync/v1/batches', statusNot: [301, 302, 307, 308] },
  { url: 'https://openfund.cloud/auth/nonce', statusNot: [301, 302, 307, 308] },
  { url: 'https://openfund.cloud/purchases/orders', method: 'POST', statusNot: [301, 302, 307, 308] },
  { url: 'http://openfi.cloud/fa/home', status: 301, location: 'https://openfi.cloud/fa/home' },
  { url: 'https://openfi.live/fa/home', status: 200 },
  { url: 'https://cms.openfi.cloud/server/health', status: 200 },
  { url: 'https://backstage.openfi.cloud/', statusNot: [301, 302, 307, 308, 502, 503] },
]
export const IRAN_ALIAS_CASES = [
  { url: 'https://iran.openfi.cloud/fa/challenges?plan=25k', status: 301, location: 'https://openfi.live/fa/challenges?plan=25k' },
  { url: 'https://iran.openfund.cloud/en/home', status: 301, location: 'https://openfi.live/en/home' },
  { url: 'https://www.openfi.live/', status: 301, location: 'https://openfi.live/' },
  { url: 'https://iran.openfi.cloud/version', status: 200 },
]
export const TLS_HOSTS = ['openfi.cloud', 'www.openfi.cloud', 'openfund.cloud', 'www.openfund.cloud', 'openfi.live', 'iran.openfi.cloud', 'iran.openfund.cloud', 'www.openfi.live', 'cms.openfi.cloud', 'backstage.openfi.cloud']

async function main() {
  const cases = [...CASES, ...(process.argv.includes('--iran-aliases') ? IRAN_ALIAS_CASES : [])]
  let failed = 0
  for (const c of cases) {
    let r
    try { r = await (c.url.startsWith('http:') ? new Promise((resolve, reject) => import('node:http').then(({ default: http }) => {
      const u = new URL(c.url); http.get({ host: u.hostname, path: u.pathname + u.search, headers: { accept: 'text/html' } }, res => { res.resume(); resolve({ status: res.statusCode, location: res.headers.location ?? null }) }).on('error', reject)
    })) : get(c.url, { method: c.method })) } catch (e) { r = { status: `error ${e.message}` } }
    const ok = (c.status ? r.status === c.status : !c.statusNot.includes(r.status)) && (!c.location || r.location === c.location)
    if (!ok) failed++
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${(c.method || 'GET').padEnd(4)} ${c.url} → ${r.status}${r.location ? ' ' + r.location : ''}`)
  }
  for (const h of TLS_HOSTS) {
    const v = await certOk(h)
    console.log(`${v === 'valid' ? 'ok  ' : 'warn'} TLS  ${h}: ${v}`)
  }
  console.log(failed ? `${failed} failure(s)` : 'domain policy verified')
  process.exit(failed ? 1 : 0)
}
if (import.meta.url === `file://${process.argv[1]}`) main()
