/**
 * Create N synthetic wallet users through the REAL sign-in path
 * (POST /auth/nonce → EIP-4361 message signed by a throwaway key → POST /auth/verify).
 * Keys are derived from a fixed test seed, exist only for this local test
 * database, and are never written to disk — only the resulting session
 * cookie (valid for the disposable test database only) is stored.
 *
 * Each user gets a unique synthetic client IP via X-Forwarded-For (the app
 * trusts one proxy hop, exactly as behind Render), so the per-IP rate
 * limiter sees independent clients rather than one load-generator IP.
 *
 * Usage: node seed-users.mjs <count> <out.json> [openPositionShare=0.6]
 */
import fs from 'node:fs'
import { keccak256, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'

const TARGET = process.env.TARGET || 'http://127.0.0.1:18080'
const host = new URL(TARGET).host
const N = Number(process.argv[2] || 100)
const OUT = process.argv[3] || 'users.json'
const OPEN_SHARE = Number(process.argv[4] ?? 0.6)
const CONC = 16
const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : []
const users = existing.slice(0, N)

const xff = i => `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${(i & 255) + 1}`
async function signIn(i) {
  const account = privateKeyToAccount(keccak256(toHex(`openfund-capacity-synthetic-wallet-${i}`)))
  const headers = { 'content-type': 'application/json', 'x-forwarded-for': xff(i), origin: TARGET }
  const n = await fetch(TARGET + '/auth/nonce', { method: 'POST', headers, body: JSON.stringify({ address: account.address }) })
  if (!n.ok) throw new Error(`nonce ${n.status} ${await n.text()}`)
  const { nonce } = await n.json()
  const message = createSiweMessage({ domain: host, address: account.address, statement: 'Sign in to Openfund', uri: `https://${host}`, version: '1', chainId: 42161, nonce, issuedAt: new Date() })
  const signature = await account.signMessage({ message })
  const v = await fetch(TARGET + '/auth/verify', { method: 'POST', headers, body: JSON.stringify({ message, signature }) })
  if (!v.ok) throw new Error(`verify ${v.status} ${await v.text()}`)
  const cookie = v.headers.get('set-cookie').split(';')[0]
  const { user } = await v.json()
  const u = { i, address: account.address.toLowerCase(), userId: user.id, cookie, xff: xff(i) }
  if (Math.random() < OPEN_SHARE) {
    const r = await fetch(TARGET + '/trading/order', { method: 'POST', headers: { ...headers, cookie, 'idempotency-key': `seed-${i}-${Date.now()}` },
      body: JSON.stringify({ market: 'LT/USD', side: 'long', order_type: 'market', margin: '50', leverage: 2, product: 'prop' }) })
    u.seedOrder = r.status
  }
  return u
}

const t0 = Date.now()
let next = users.length, errors = 0
async function worker() {
  while (next < N) {
    const i = next++
    try { users[i] = await signIn(i) } catch (e) { errors++; console.error(i, e.message); if (errors > 20) throw e }
  }
}
await Promise.all(Array.from({ length: CONC }, worker))
const ok = users.filter(Boolean)
fs.writeFileSync(OUT, JSON.stringify(ok))
console.log(`seeded ${ok.length}/${N} users (${existing.length} reused) in ${((Date.now() - t0) / 1000).toFixed(1)}s, errors=${errors}, seed orders ok=${ok.filter(u => u.seedOrder === 200).length}`)
