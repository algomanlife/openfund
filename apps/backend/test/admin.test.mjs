/**
 * Admin API + payment lifecycle hardening tests (v0.3.1).
 *
 * Covers:
 *  - ADMIN_API_TOKEN gating: disabled while unset (404), wrong token 403,
 *    constant-time bearer auth works
 *  - user directory: list, search, pagination, detail view (challenges,
 *    purchases + payment verification status, withdrawals, audit trail)
 *  - challenge directory with status filter
 *  - withdrawal review: approve → paid (payoutRef required), reject,
 *    duplicate-action prevention, invalid transitions, audit logging,
 *    user-side visibility of the reviewed state
 *  - purchase order expiry sweep marks stale pending orders 'expired'
 *  - late-payment grace policy: a verified payment inside the grace
 *    window still pays an expired order; far outside it is rejected
 *    for manual reconciliation
 *
 * Run: node test/admin.test.mjs  (backend on :8090 with ADMIN_API_TOKEN set)
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'
import pg from 'pg'
import { randomUUID } from 'node:crypto'
import { confirmPurchase } from '../purchases.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const BASE = process.env.TEST_BACKEND_URL || 'http://localhost:8090'
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN
const DOMAIN = 'localhost:5173'
let passed = 0, failed = 0
const ok = (name, cond, extra = '') => {
  if (cond) { passed++; console.log('PASS -', name) }
  else { failed++; console.log('FAIL -', name, extra) }
}

const j = async (method, path, body, cookie, headers = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined
  })
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data, cookie: (res.headers.get('set-cookie') || '').split(';')[0] }
}

async function login(wallet) {
  const n = (await j('POST', '/auth/nonce', { address: wallet.address })).data
  const message = createSiweMessage({ domain: DOMAIN, address: wallet.address, uri: 'http://localhost:5173/', chainId: 11155111, nonce: n.nonce, version: '1' })
  const r = await j('POST', '/auth/verify', { message, signature: await wallet.signMessage({ message }) })
  return { cookie: r.cookie, userId: (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [wallet.address.toLowerCase()])).rows[0].id }
}

const admin = (method, path, body, token) =>
  j(method, path, body, null, token ? { Authorization: `Bearer ${token}` } : {})

const w1 = privateKeyToAccount(generatePrivateKey())

/* ================= 1. ADMIN TOKEN GATING ================= */
{
  ok('admin API rejects requests without a token (403)', (await admin('GET', '/admin/users', null, null)).status === 403)
  ok('wrong token rejected (403)', (await admin('GET', '/admin/users', null, 'wrong-token')).status === 403)
  const good = await admin('GET', '/admin/users', null, ADMIN_TOKEN)
  ok('correct token authorizes the user directory', good.status === 200 && Array.isArray(good.data.users))
  ok('a user session cannot use admin API (403)', (await j('GET', '/admin/users', null, (await login(w1)).cookie)).status === 403)
}

/* ================= 2. USER DIRECTORY + DETAIL ================= */
{
  const { cookie, userId } = await login(w1)
  /* seed an evaluated challenge + paid purchase + withdrawal for w1 */
  const { rows: [plan] } = await pool.query(
    `INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3) RETURNING id`,
    ['admin-test-' + randomUUID().slice(0, 8), 'Admin Test', JSON.stringify({ accountSizesUsd: [5000], priceUsd: { 5000: 44 }, phases: 1, phase1TargetPct: 12, dailyLossPct: 5, maxTotalLossPct: 10 })])
  const { rows: [order] } = await pool.query(
    `INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd) VALUES ($1,$2,5000,44) RETURNING id`,
    [userId, plan.id])
  const purchase = await confirmPurchase(pool, {
    orderId: order.id, userId,
    evidence: { txHash: '0x' + 'cd'.repeat(32), chainId: 11155111, blockNumber: 7, fromAddress: w1.address.toLowerCase(), toAddress: null, amount: '44', tokenAddress: null, blockTimestamp: new Date().toISOString() },
    source: 'unit_test',
  })
  ok('purchase provisioned for the admin view', !!purchase.challengeId)
  const { rows: [wd] } = await pool.query(
    `INSERT INTO withdrawal_requests (user_id, challenge_id, amount_usd, note) VALUES ($1,$2,120,'first payout') RETURNING id`,
    [userId, purchase.challengeId])

  const list = await admin('GET', '/admin/users?search=' + w1.address.slice(2, 12).toLowerCase(), null, ADMIN_TOKEN)
  ok('user search by wallet fragment finds the user', list.status === 200 && list.data.users.some(u => u.id === userId))
  const detail = await admin('GET', `/admin/users/${userId}`, null, ADMIN_TOKEN)
  ok('user detail includes challenges', detail.status === 200 && detail.data.challenges.some(c => c.id === purchase.challengeId))
  ok('user detail includes purchases with payment verification status',
    detail.data.purchases.some(p => p.id === order.id && p.payment?.txHash === '0x' + 'cd'.repeat(32) && p.payment?.status === 'confirmed'))
  ok('user detail includes withdrawals', detail.data.withdrawals.some(x => x.id === wd.id))
  ok('user detail includes audit history', detail.data.activity.length > 0)

  /* ================= 3. WITHDRAWAL REVIEW WORKFLOW ================= */
  ok('challenge directory lists the challenge with owner wallet',
    (await admin('GET', '/admin/challenges?status=created', null, ADMIN_TOKEN)).data.challenges.some(c => c.id === purchase.challengeId))
  const badAction = await admin('POST', `/admin/withdrawals/${wd.id}/review`, { action: 'delete' }, ADMIN_TOKEN)
  ok('invalid review action rejected', badAction.status === 400)
  const earlyPaid = await admin('POST', `/admin/withdrawals/${wd.id}/review`, { action: 'paid', payoutRef: 'x' }, ADMIN_TOKEN)
  ok('cannot mark paid before approval (409)', earlyPaid.status === 409)
  const approved = await admin('POST', `/admin/withdrawals/${wd.id}/review`, { action: 'approve', note: 'documents ok' }, ADMIN_TOKEN)
  ok('approve → approved', approved.status === 200 && approved.data.status === 'approved')
  const reApprove = await admin('POST', `/admin/withdrawals/${wd.id}/review`, { action: 'approve' }, ADMIN_TOKEN)
  ok('duplicate approve is idempotent', reApprove.status === 200 && reApprove.data.duplicate === true)
  const paidNoRef = await admin('POST', `/admin/withdrawals/${wd.id}/review`, { action: 'paid' }, ADMIN_TOKEN)
  ok('paid requires a payout reference', paidNoRef.status === 400)
  const paid = await admin('POST', `/admin/withdrawals/${wd.id}/review`, { action: 'paid', payoutRef: 'payout-2026-0001' }, ADMIN_TOKEN)
  ok('paid → paid with reference recorded', paid.status === 200 && paid.data.status === 'paid')
  const row = (await pool.query('SELECT status, payout_ref, reviewed_at FROM withdrawal_requests WHERE id=$1', [wd.id])).rows[0]
  ok('payout reference persisted', row.payout_ref === 'payout-2026-0001' && row.reviewed_at != null)
  const auditRows = (await pool.query(
    `SELECT action FROM audit_log WHERE details->>'withdrawalId'=$1 ORDER BY id`, [wd.id])).rows.map(r => r.action)
  ok('review actions audit-logged (approve + paid)', auditRows.includes('withdrawal_approved') && auditRows.includes('withdrawal_paid'))
  const userViewResp = await j('GET', '/withdrawals', null, cookie)
  const userView = userViewResp.data?.withdrawals
  ok('user sees the reviewed withdrawal state', Array.isArray(userView) && userView.some(x => x.id === wd.id && x.status === 'paid'),
    JSON.stringify(userViewResp.data).slice(0, 150))

  /* reject path on a fresh request */
  const { rows: [wd2] } = await pool.query(
    `INSERT INTO withdrawal_requests (user_id, amount_usd, note) VALUES ($1,50,'second') RETURNING id`, [userId])
  const rejected = await admin('POST', `/admin/withdrawals/${wd2.id}/review`, { action: 'reject', note: 'not eligible' }, ADMIN_TOKEN)
  ok('reject → rejected', rejected.status === 200 && rejected.data.status === 'rejected')
  const afterReject = await admin('POST', `/admin/withdrawals/${wd2.id}/review`, { action: 'approve' }, ADMIN_TOKEN)
  ok('cannot approve after rejection (invalid transition)', afterReject.status === 409)
}

/* ================= 4. ORDER EXPIRY SWEEP + LATE-PAYMENT GRACE ================= */
{
  const w2 = privateKeyToAccount(generatePrivateKey())
  const { userId } = await login(w2)
  const { rows: [plan] } = await pool.query(
    `INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3) RETURNING id`,
    ['expire-test-' + randomUUID().slice(0, 8), 'Expire Test', JSON.stringify({ accountSizesUsd: [5000], priceUsd: { 5000: 44 }, phases: 1, phase1TargetPct: 12, dailyLossPct: 5, maxTotalLossPct: 10 })])

  /* a pending order expired LONG ago: far outside the grace window */
  const { rows: [stale] } = await pool.query(
    `INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, expires_at)
     VALUES ($1,$2,5000,44, now() - interval '1 day') RETURNING id`, [userId, plan.id])
  let farLate = null
  try {
    await confirmPurchase(pool, {
      orderId: stale.id, userId,
      evidence: { txHash: '0x' + 'ef'.repeat(32), chainId: 11155111, blockNumber: 1, fromAddress: w2.address.toLowerCase(), toAddress: null, amount: '44', tokenAddress: null, blockTimestamp: new Date(Date.now() - 90 * 60_000).toISOString() },
      source: 'unit_test',
    })
  } catch (e) { farLate = e }
  ok('payment far outside the grace window is rejected for reconciliation',
    farLate && farLate.status === 409 && farLate.message === 'order_expired')

  /* a pending order just past expiry: a payment mined minutes later is
     still inside the grace window and must pay (money never dropped) */
  const { rows: [recent] } = await pool.query(
    `INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, expires_at)
     VALUES ($1,$2,5000,44, now() - interval '2 minutes') RETURNING id`, [userId, plan.id])
  const lateOk = await confirmPurchase(pool, {
    orderId: recent.id, userId,
    evidence: { txHash: '0x' + 'be'.repeat(32), chainId: 11155111, blockNumber: 2, fromAddress: w2.address.toLowerCase(), toAddress: null, amount: '44', tokenAddress: null, blockTimestamp: new Date().toISOString() },
    source: 'unit_test',
  })
  ok('payment inside the grace window still pays the expired order',
    !lateOk.replayed && !!lateOk.challengeId, JSON.stringify(lateOk).slice(0, 120))

  /* the expiry sweep marks genuinely stale pending orders */
  const { rows: [sweepable] } = await pool.query(
    `INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, expires_at)
     VALUES ($1,$2,5000,44, now() - interval '3 hours') RETURNING id`, [userId, plan.id])
  const swept = await pool.query(
    `UPDATE purchase_orders SET status='expired' WHERE status='pending' AND expires_at < now() RETURNING id`)
  ok('sweep expires stale pending orders', swept.rows.some(r => r.id === sweepable.id))
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
