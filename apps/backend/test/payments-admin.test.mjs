/**
 * Operator payment investigation API (/admin/payments) — HTTP tests.
 * Run: node test/payments-admin.test.mjs  (backend running, ADMIN_API_TOKEN set, isolated DB)
 */
import crypto from 'node:crypto'
import pg from 'pg'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const BASE = process.env.TEST_BACKEND_URL || 'http://localhost:8080'
const TOKEN = process.env.ADMIN_API_TOKEN
let passed = 0, failed = 0
const ok = (name, cond, extra = '') => { if (cond) { passed++; console.log('PASS -', name) } else { failed++; console.log('FAIL -', name, extra) } }
const api = async (method, path, body, { token = TOKEN, actor = 'ops.alice' } = {}) => {
  const res = await fetch(BASE + path, {
    method, signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(actor ? { 'X-Admin-Actor': actor } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null; try { data = await res.json() } catch {}
  return { status: res.status, data }
}
const hash = () => '0x' + crypto.randomBytes(32).toString('hex')

if (!TOKEN) { console.log('SKIP - ADMIN_API_TOKEN not set'); process.exit(0) }

const wallet = '0x' + crypto.randomBytes(20).toString('hex')
const { rows: [user] } = await pool.query(`INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, 1) RETURNING id`, [wallet])
const { rows: [plan] } = await pool.query(
  `INSERT INTO challenge_plans (slug, name, configuration) VALUES ('pa-test-plan','PA Test',$1)
   ON CONFLICT (slug) DO UPDATE SET configuration = EXCLUDED.configuration RETURNING id`,
  [JSON.stringify({ accountSizesUsd: [5000], priceUsd: { 5000: 100 }, phases: 1 })])
const { rows: [order] } = await pool.query(
  `INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd) VALUES ($1,$2,5000,100) RETURNING id`, [user.id, plan.id])
const tx = hash()
const { rows: [attempt] } = await pool.query(
  `INSERT INTO payment_attempts (purchase_order_id, user_id, chain_id, tx_hash, status, error_code, classification, review_status, detail)
   VALUES ($1,$2,42161,$3,'rejected','insufficient_amount','underpayment','open','{"received":"99000000"}') RETURNING id`, [order.id, user.id, tx])

ok('payments admin requires the service token', (await api('GET', '/admin/payments/attempts', null, { token: 'wrong' })).status === 403)
ok('lookup requires an order id or a transaction hash', (await api('GET', '/admin/payments/lookup')).status === 400)
ok('lookup rejects malformed identifiers', (await api('GET', '/admin/payments/lookup?txHash=0x12')).status === 400)

const byOrder = await api('GET', '/admin/payments/lookup?orderId=' + order.id)
ok('lookup by order id returns order, payments and attempts', byOrder.status === 200 && byOrder.data.order?.id === order.id && byOrder.data.attempts.length === 1)
const byTx = await api('GET', '/admin/payments/lookup?txHash=' + tx.toUpperCase().replace('0X', '0x'))
ok('lookup by transaction hash finds the attempt (case-insensitive)', byTx.status === 200 && byTx.data.attempts[0]?.classification === 'underpayment')

const queue = await api('GET', '/admin/payments/attempts?review=open')
ok('review queue lists the open underpayment', queue.status === 200 && queue.data.attempts.some(a => a.id === attempt.id))

ok('review needs a named operator', (await api('POST', `/admin/payments/attempts/${attempt.id}/review`, { note: 'refund by Safe' }, { actor: '' })).status === 400)
ok('review needs a note', (await api('POST', `/admin/payments/attempts/${attempt.id}/review`, { note: ' ' })).status === 400)
const review = await api('POST', `/admin/payments/attempts/${attempt.id}/review`, { note: 'Underpayment of 1 USDC; customer asked to top up' })
ok('review resolves the case', review.status === 200 && review.data.ok === true)
ok('a case cannot be resolved twice', (await api('POST', `/admin/payments/attempts/${attempt.id}/review`, { note: 'again' })).status === 409)
const row = (await pool.query('SELECT review_status, reviewed_by, review_note FROM payment_attempts WHERE id=$1', [attempt.id])).rows[0]
ok('resolution is attributed to the named operator', row.review_status === 'resolved' && row.reviewed_by === 'admin:ops.alice' && /Underpayment/.test(row.review_note))
const audited = (await pool.query(`SELECT count(*)::int n FROM financial_audit_log WHERE entity='payment_attempt' AND entity_id=$1 AND action='payment_review_resolved'`, [attempt.id])).rows[0].n
ok('resolution is written to the append-only financial audit log', audited === 1)

ok('re-verify of an unknown attempt is 404', (await api('POST', `/admin/payments/attempts/${crypto.randomUUID()}/reverify`)).status === 404)
await pool.query(`UPDATE purchase_orders SET status='cancelled' WHERE id=$1`, [order.id])
ok('re-verify refuses a cancelled order', (await api('POST', `/admin/payments/attempts/${attempt.id}/reverify`)).status === 409)

await pool.query('DELETE FROM payment_attempts WHERE purchase_order_id=$1', [order.id])
await pool.query('DELETE FROM purchase_orders WHERE id=$1', [order.id])
await pool.query('DELETE FROM openfund_users WHERE id=$1', [user.id])
await pool.query(`DELETE FROM challenge_plans WHERE slug='pa-test-plan'`)
await pool.end()
console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
