/**
 * Growth Partner referral attribution test suite.
 *
 * Exercises the server-authoritative flow against the running backend:
 * code issuance, one-time attribution at account creation, self-referral
 * prevention, invalid codes, session scoping and unauthenticated access.
 *
 * Run: node test/referral.test.mjs   (backend must be running on :8080)
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'

const BASE = process.env.TEST_BACKEND_URL || 'http://localhost:8080'
const DOMAIN = 'localhost:5173'
const CHAIN = 42161

let passed = 0, failed = 0
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('PASS -', name) }
  else { failed++; console.log('FAIL -', name, extra) }
}
const j = async (method, path, body, cookie, extraCookie) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json', Origin: 'http://localhost:5173',
      ...((cookie || extraCookie) ? { Cookie: [cookie, extraCookie].filter(Boolean).join('; ') } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie') || ''
  let data = null
  try { data = await res.json() } catch { /* empty body */ }
  return { status: res.status, data, cookie: setCookie.split(';')[0] }
}

async function authenticate(wallet, refCode) {
  const n = (await j('POST', '/auth/nonce', { address: wallet.address })).data
  const message = createSiweMessage({ domain: DOMAIN, address: wallet.address, uri: 'http://localhost:5173/', chainId: CHAIN, nonce: n.nonce, version: '1' })
  const signature = await wallet.signMessage({ message })
  return j('POST', '/auth/verify', { message, signature }, null, refCode ? `of_ref=${refCode}` : null)
}

const summary = cookie => j('GET', '/referral/summary', null, cookie)

/* ---- 1. code issuance ---- */
const partner = privateKeyToAccount(generatePrivateKey())
{
  const auth = await authenticate(partner)
  ok('partner sign-in → 200', auth.status === 200, JSON.stringify(auth.data).slice(0, 120))
  const s = await summary(auth.cookie)
  ok('summary issues a code', s.status === 200 && /^[A-HJ-NP-Z2-9]{8}$/.test(s.data?.code || ''), JSON.stringify(s.data).slice(0, 120))
  ok('program state is prelaunch (no reward terms)', s.data?.programState === 'prelaunch')
  ok('no commission/reward fields in the payload', !('commission' in (s.data || {})) && !('rewards' in (s.data || {})) && !('balance' in (s.data || {})))
  ok('attributed count starts at 0', s.data?.attributed?.count === 0)
  globalThis.code = s.data.code
  globalThis.partnerCookie = auth.cookie
}

/* ---- 2. referral attribution at first sign-in ---- */
const referred = privateKeyToAccount(generatePrivateKey())
{
  const auth = await authenticate(referred, globalThis.code)
  ok('referred wallet sign-in → 200', auth.status === 200)
  const mine = await summary(auth.cookie)
  ok('referred wallet sees it was attributed', mine.data?.attributedTo?.code === globalThis.code, JSON.stringify(mine.data?.attributedTo))
  const partner2 = await summary(globalThis.partnerCookie)
  ok('partner count → 1', partner2.data?.attributed?.count === 1)
  ok('list masks the referred address', /^0x[0-9a-f]{4}…[0-9a-f]{4}$/.test(partner2.data?.attributed?.referrals?.[0]?.wallet || ''), partner2.data?.attributed?.referrals?.[0]?.wallet)
}

/* ---- 3. re-sign-in never re-attributes ---- */
{
  const auth = await authenticate(referred, globalThis.code)
  ok('referred wallet can sign in again', auth.status === 200)
  const partner2 = await summary(globalThis.partnerCookie)
  ok('count still 1 after re-sign-in', partner2.data?.attributed?.count === 1)
}

/* ---- 4. self-referral is impossible ---- */
{
  const auth = await authenticate(partner, globalThis.code)
  ok('partner sign-in with own code → 200', auth.status === 200)
  const s = await summary(auth.cookie)
  ok('own code did not create an attribution', s.data?.attributed?.count === 1)
  ok('partner itself is not attributed to anyone', s.data?.attributedTo === null)
}

/* ---- 5. invalid codes are ignored ---- */
const stranger = privateKeyToAccount(generatePrivateKey())
{
  const auth = await authenticate(stranger, 'ZZZZ9999')
  ok('stranger sign-in with unknown code → 200', auth.status === 200)
  const s = await summary(auth.cookie)
  ok('unknown code leaves no attribution', s.data?.attributedTo === null)
  const partner2 = await summary(globalThis.partnerCookie)
  ok('partner count still 1', partner2.data?.attributed?.count === 1)
}

/* ---- 6. summary requires a session ---- */
{
  const anon = await summary(null)
  ok('unauthenticated summary → 401', anon.status === 401)
}

console.log(`\nreferral tests: ${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
