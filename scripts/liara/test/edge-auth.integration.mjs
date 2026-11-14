#!/usr/bin/env node
/* End-to-end check of wallet sign-in, cookies, CSRF and client-IP handling
   through the Iran edge, against the REAL backend on a disposable database.

   Prerequisites (see the Liara workflow's `edge-auth` job):
   - backend running with NODE_ENV unset, a *_test database,
     ALLOWED_DOMAINS including the edge host and EDGE_CLIENT_IP_KEY=<key>
   - edge running with OPENFUND_UPSTREAM_HOST=<backend>, EDGE_PUBLIC_SCHEME=http
     and OPENFUND_EDGE_CLIENT_IP_KEY=<same key>

   EDGE_URL (default http://127.0.0.1:18080), BACKEND_URL (default
   http://127.0.0.1:18090), DATABASE_URL (the same disposable database).
   The wallet is a fresh in-memory key generated for this run. */
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../../apps/backend/package.json', import.meta.url))
const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts')
const { createSiweMessage } = require('viem/siwe')
const pg = require('pg')

const EDGE = (process.env.EDGE_URL || 'http://127.0.0.1:18080').replace(/\/$/, '')
const BACKEND = (process.env.BACKEND_URL || 'http://127.0.0.1:18090').replace(/\/$/, '')
const EDGE_HOST = new URL(EDGE).host
const EDGE_ORIGIN = new URL(EDGE).origin
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
if (!/(?:^|[_-])(test|ci)(?:$|[_-])/.test(new URL(process.env.DATABASE_URL || 'postgres://x/none').pathname.slice(1))) {
  console.error('DATABASE_URL must name a disposable *_test or *_ci database'); process.exit(2)
}

let failed = 0
const ok = (name, cond, extra = '') => { if (cond) console.log('PASS -', name); else { failed++; console.log('FAIL -', name, extra) } }
const call = async (base, method, path, { body, cookie, origin = EDGE_ORIGIN, xff } = {}) => {
  const res = await fetch(base + path, {
    method, signal: AbortSignal.timeout(30_000),
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}), ...(xff ? { 'x-forwarded-for': xff } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null; try { data = await res.json() } catch {}
  return { status: res.status, data, setCookie: res.headers.get('set-cookie') || '' }
}

async function signIn(wallet, { domain = EDGE_HOST, uri = `${EDGE_ORIGIN}/`, xff } = {}) {
  const n = await call(EDGE, 'POST', '/auth/nonce', { body: { address: wallet.address }, xff })
  const message = createSiweMessage({ domain, address: wallet.address, uri, chainId: 42161, nonce: n.data?.nonce, version: '1' })
  const signature = await wallet.signMessage({ message })
  return call(EDGE, 'POST', '/auth/verify', { body: { message, signature }, xff })
}

await db.connect()
const visitor = '203.0.113.7'
const wallet = privateKeyToAccount(generatePrivateKey())

/* 1 — SIWE through the edge, Arbitrum One (42161) */
const v = await signIn(wallet, { xff: visitor })
ok('SIWE for the edge host through the edge → 200', v.status === 200 && v.data?.user?.walletAddress === wallet.address.toLowerCase(), JSON.stringify(v.data))
const cookie = v.setCookie.split(';')[0]
ok('session cookie is HttpOnly, SameSite=Lax, Path=/', /HttpOnly/i.test(v.setCookie) && /SameSite=Lax/i.test(v.setCookie) && /Path=\//.test(v.setCookie))
ok('session cookie is host-only (no Domain attribute)', !/;\s*domain=/i.test(v.setCookie))
const me = await call(EDGE, 'GET', '/auth/me', { cookie })
ok('GET /auth/me with the edge session → 200', me.status === 200 && me.data?.user?.walletAddress === wallet.address.toLowerCase())

/* 2 — what the backend recorded: the visitor, not the edge */
const { rows: [session] } = await db.query('SELECT s.ip FROM auth_sessions s JOIN openfund_users u ON u.id=s.user_id WHERE lower(u.wallet_address)=$1 ORDER BY s.created_at DESC LIMIT 1', [wallet.address.toLowerCase()])
ok('auth_sessions.ip is the visitor IP forwarded by the edge', session?.ip === visitor, JSON.stringify(session))
const { rows: [login] } = await db.query("SELECT ip FROM audit_log WHERE action='auth_login' ORDER BY id DESC LIMIT 1")
ok('audit_log auth_login ip is the visitor IP', login?.ip === visitor, JSON.stringify(login))

/* 3 — SIWE domain policy is unchanged */
const other = privateKeyToAccount(generatePrivateKey())
const wrongDomain = await signIn(other, { domain: 'openfund.cloud', uri: 'https://openfund.cloud/' })
ok('a message for a host not in ALLOWED_DOMAINS → 400 invalid_domain', wrongDomain.status === 400 && wrongDomain.data?.error === 'invalid_domain', JSON.stringify(wrongDomain.data))
const wrongChain = await (async () => {
  const n = await call(EDGE, 'POST', '/auth/nonce', { body: { address: other.address } })
  const message = createSiweMessage({ domain: EDGE_HOST, address: other.address, uri: `${EDGE_ORIGIN}/`, chainId: 1, nonce: n.data?.nonce, version: '1' })
  return call(EDGE, 'POST', '/auth/verify', { body: { message, signature: await other.signMessage({ message }) } })
})()
ok('a non-Arbitrum chain id is refused', wrongChain.status === 400 && wrongChain.data?.error === 'invalid_chain', JSON.stringify(wrongChain.data))

/* 4 — CSRF: only the edge's own origin is accepted for state changes */
const foreign = await call(EDGE, 'POST', '/auth/logout', { cookie, origin: 'https://evil.example' })
ok('foreign Origin through the edge → 403 invalid_origin', foreign.status === 403 && foreign.data?.error === 'invalid_origin')
const stillIn = await call(EDGE, 'GET', '/auth/me', { cookie })
ok('the session survives the rejected cross-origin logout', stillIn.status === 200)

/* 5 — per-visitor rate limits (POST /auth/nonce: 60 per minute per IP) */
const burst = []
for (let i = 0; i < 61; i++) burst.push((await call(EDGE, 'POST', '/auth/nonce', { body: { address: other.address }, xff: '198.51.100.1' })).status)
ok('visitor A is limited after 60 nonce requests', burst.slice(0, 60).every(s => s === 200) && burst[60] === 429, burst.slice(-3).join(','))
const b = await call(EDGE, 'POST', '/auth/nonce', { body: { address: other.address }, xff: '198.51.100.2' })
ok('visitor B behind the same edge is not limited by A', b.status === 200)

/* 6 — the key cannot be forged on the direct path */
const forged = await fetch(`${BACKEND}/auth/nonce`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BACKEND, 'x-openfund-edge-key': 'f'.repeat(40), 'x-openfund-edge-client-ip': '198.51.100.2' }, body: JSON.stringify({ address: other.address }) })
/* req.ip is not overridden for a wrong key: asserted in apps/backend/test/edge-client-ip.test.mjs */
ok('a direct request with a wrong edge key is handled as an ordinary request', forged.status === 200)

/* 7 — logout through the edge */
const out = await call(EDGE, 'POST', '/auth/logout', { cookie })
ok('logout through the edge → 200', out.status === 200)
ok('the session is gone after logout', (await call(EDGE, 'GET', '/auth/me', { cookie })).status === 401)

await db.end()
console.log(failed ? `\nFAILED: ${failed} check(s)` : '\nALL PASSED')
process.exit(failed ? 1 : 0)
