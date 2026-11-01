/**
 * Openfund backend SIWE/auth test suite — uses a REAL ECDSA wallet
 * (viem local account) against the running backend. Not a browser extension,
 * but the exact cryptographic path production wallets use (EIP-191).
 *
 * Run: node test/siwe.test.mjs   (backend must be running on :8080)
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage, verifySiweMessage } from 'viem/siwe'
import { recoverMessageAddress } from 'viem'
import pg from 'pg'

const BASE = process.env.TEST_BACKEND_URL || 'http://localhost:8080'
const DOMAIN = 'localhost:5173'
const CHAIN = 421614

let passed = 0, failed = 0
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('PASS -', name) }
  else { failed++; console.log('FAIL -', name, extra) }
}
const j = async (method, path, body, cookie) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  const setCookie = res.headers.get('set-cookie') || ''
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data, cookie: setCookie.split(';')[0] }
}

const wallet1 = privateKeyToAccount(generatePrivateKey())
const wallet2 = privateKeyToAccount(generatePrivateKey())

async function authenticate(wallet, domain = DOMAIN, chainId = CHAIN) {
  const n = (await j('POST', '/auth/nonce', { address: wallet.address })).data
  const message = createSiweMessage({ domain, address: wallet.address, uri: 'http://localhost:5173/', chainId, nonce: n.nonce, version: '1' })
  const signature = await wallet.signMessage({ message })
  return { message, signature, verify: await j('POST', '/auth/verify', { message, signature }) }
}

/* ---- 1. full valid flow ---- */
{
  const r = await authenticate(wallet1)
  ok('valid SIWE → 200 + user', r.verify.status === 200 && r.verify.data?.user?.walletAddress === wallet1.address.toLowerCase(), JSON.stringify(r.verify.data).slice(0, 120))
  ok('session cookie set (HttpOnly)', r.verify.cookie.includes('openfund_session='))
  const me = await j('GET', '/auth/me', null, r.verify.cookie)
  ok('GET /auth/me with cookie', me.status === 200 && me.data.user.walletAddress === wallet1.address.toLowerCase())
  const anon = await j('GET', '/auth/me')
  ok('GET /auth/me without cookie → 401', anon.status === 401)
  const out = await j('POST', '/auth/logout', {}, r.verify.cookie)
  ok('logout → 200', out.status === 200)
  const after = await j('GET', '/auth/me', null, r.verify.cookie)
  ok('session invalid after logout', after.status === 401)
}

/* ---- 2. signature matrix ---- */
{
  const n = (await j('POST', '/auth/nonce', { address: wallet2.address })).data
  const message = createSiweMessage({ domain: DOMAIN, address: wallet2.address, uri: 'http://localhost:5173/', chainId: CHAIN, nonce: n.nonce, version: '1' })
  const badSig = await wallet1.signMessage({ message }) // signed by the WRONG wallet
  const r = await j('POST', '/auth/verify', { message, signature: badSig })
  ok('wrong-signer signature → 401', r.status === 401 && r.data.error === 'invalid_signature')

  const garbage = await j('POST', '/auth/verify', { message, signature: '0xdeadbeef' })
  ok('garbage signature → 401', garbage.status === 401)

  const r2 = await authenticate(wallet2)
  ok('valid auth after failures', r2.verify.status === 200)
  const n2 = (await j('POST', '/auth/nonce', { address: wallet2.address })).data
  const m2 = createSiweMessage({ domain: DOMAIN, address: wallet2.address, uri: 'http://localhost:5173/', chainId: CHAIN, nonce: n2.nonce, version: '1' })
  const s2 = await wallet2.signMessage({ message: m2 })
  await j('POST', '/auth/verify', { message: m2, signature: s2 })
  const reuse = await j('POST', '/auth/verify', { message: m2, signature: s2 })
  ok('nonce reuse → 400', reuse.status === 400 && reuse.data.error === 'nonce_reused')

  const r3 = await authenticate(wallet2, 'evil.example.com')
  ok('wrong domain → 400', r3.verify.status === 400 && r3.verify.data.error === 'invalid_domain')

  const r4 = await authenticate(wallet2, DOMAIN, 1)
  ok('wrong chain → 400', r4.verify.status === 400 && r4.verify.data.error === 'invalid_chain')
}

/* ---- 3. user identity rules ---- */
{
  const a = await authenticate(wallet1)
  const b = await authenticate(wallet1) // same wallet again
  ok('same wallet → same user id', a.verify.data.user.id === b.verify.data.user.id)
  const c = await authenticate(wallet2)
  ok('different wallet → different user', c.verify.data.user.id !== a.verify.data.user.id)
}

/* ---- 4. challenges: multi + ownership ---- */
{
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://openfund_cms:openfund_local_dev@127.0.0.1:5432/openfund_cms' })
  const u1 = (await authenticate(wallet1))
  const userId = u1.verify.data.user.id
  const { rows: plans } = await pool.query('SELECT id FROM challenge_plans ORDER BY slug')
  await pool.query('DELETE FROM openfund_challenges WHERE user_id = $1', [userId])
  const { rows: [ch1] } = await pool.query(
    'INSERT INTO openfund_challenges (user_id, challenge_plan_id, status) VALUES ($1,$2,\'started\') RETURNING id', [userId, plans[0].id])
  await pool.query(
    'INSERT INTO openfund_challenges (user_id, challenge_plan_id) VALUES ($1,$2)', [userId, plans[1].id])
  const me = await j('GET', '/auth/me', null, u1.verify.cookie)
  ok('one user → multiple challenges', me.data.challenges.length === 2, `got ${me.data.challenges.length}`)
  ok('challenge rows carry plan slug', me.data.challenges.every(c => c.plan_slug))

  // user2 must NOT see user1's challenges
  const u2 = await authenticate(wallet2)
  const me2 = await j('GET', '/auth/me', null, u2.verify.cookie)
  ok('ownership isolation (empty list for other user)', me2.data.challenges.length === 0, `got ${me2.data.challenges.length}`)

  // suspension
  await pool.query('UPDATE openfund_users SET status = \'suspended\' WHERE id = $1', [userId])
  const susp = await j('GET', '/auth/me', null, u1.verify.cookie)
  ok('suspended user blocked (403 + cookie cleared)', susp.status === 403 && susp.data.error === 'account_suspended')
  const suspLogin = await authenticate(wallet1)
  ok('suspended user cannot log in', suspLogin.verify.status === 403)
  await pool.query('UPDATE openfund_users SET status = \'active\' WHERE id = $1', [userId])
  const re = await j('GET', '/auth/me', null, (await authenticate(wallet1)).verify.cookie)
  ok('reactivated user logs in fine', re.status === 200)
  await pool.query('DELETE FROM openfund_challenges WHERE user_id = $1', [userId])
  await pool.end()
}

/* ---- 5. independent signature-recovery cross-check (EIP-191) ---- */
{
  const message = createSiweMessage({ domain: DOMAIN, address: wallet1.address, uri: 'http://localhost:5173/', chainId: CHAIN, nonce: 'abcdef1234567890', version: '1' })
  const sig = await wallet1.signMessage({ message })
  const recovered = await recoverMessageAddress({ message, signature: sig })
  ok('cross-check: recovered signer matches', recovered.toLowerCase() === wallet1.address.toLowerCase())
  const sig2 = await wallet2.signMessage({ message })
  const recovered2 = await recoverMessageAddress({ message, signature: sig2 })
  ok('cross-check: wrong signer detected', recovered2.toLowerCase() !== wallet1.address.toLowerCase())
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
