/**
 * Backstage operations backend — user status actions, unified audit reads,
 * global search, risk board, commercial coupon administration, trader
 * support threads and in-app notifications, on real PostgreSQL with the
 * real routers mounted on an ephemeral Express app.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import pg from 'pg'
import { adminRoutes } from '../admin.js'
import { operationsAdminRoutes } from '../admin-operations.js'
import { couponAdminRoutes } from '../coupons.js'
import { supportRoutes, supportAdminRoutes, supportInboxRoutes } from '../support.js'
import { notificationRoutes, notify, relayChallengeEvents } from '../notifications.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const TOKEN = 'backstage-ops-test-token-0123456789'
const tag = `ops${Date.now()}`
const CODE = `OPS-${String(Date.now()).slice(-8)}`
let server, base, trader, otherTrader, planId, challengeId, supportRef
const audits = []

const call = async (method, path, { body, admin, actor = 'qa operator', user } = {}) => {
  const headers = { 'content-type': 'application/json' }
  if (admin) { headers.authorization = `Bearer ${TOKEN}`; if (actor) headers['x-admin-actor'] = actor }
  if (user) headers['x-test-user'] = user
  const response = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  return { status: response.status, data: await response.json().catch(() => null) }
}

before(async () => {
  process.env.ADMIN_API_TOKEN = TOKEN
  const wallet = suffix => '0x' + crypto.randomBytes(20).toString('hex').slice(0, 36) + suffix
  trader = (await pool.query(
    `INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, 42161) RETURNING id, wallet_address`,
    [wallet('aaaa')])).rows[0]
  otherTrader = (await pool.query(
    `INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, 42161) RETURNING id, wallet_address`,
    [wallet('bbbb')])).rows[0]
  planId = (await pool.query(`SELECT id FROM challenge_plans LIMIT 1`)).rows[0].id
  challengeId = (await pool.query(
    `INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, stage, account_size_usd, rules_snapshot)
     VALUES ($1, $2, 'started', 1, 10000, '{}'::jsonb) RETURNING id`, [trader.id, planId])).rows[0].id

  const requireTestUser = (req, res, next) => {
    const id = req.headers['x-test-user']
    if (!id) return res.status(401).json({ error: 'unauthenticated' })
    req.user = { user_id: id }
    next()
  }
  const app = express()
  app.use(express.json({ limit: '64kb' }))
  app.use(supportRoutes({ pool, optionalUser: async req => req.headers['x-test-user'] ?? null }))
  app.use(supportInboxRoutes({ pool, requireAuth: requireTestUser }))
  app.use(notificationRoutes({ pool, requireAuth: requireTestUser }))
  app.use('/admin/support', supportAdminRoutes({ pool }))
  app.use('/admin/operations', operationsAdminRoutes({ pool }))
  app.use('/admin/coupons', couponAdminRoutes({ pool }))
  app.use('/admin', adminRoutes({ pool, audit: async (action, userId, req, details) => audits.push({ action, userId, details }), claimPayout: async () => {} }))
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.status ? err.message : 'internal' }))
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  server?.close()
  await pool.query(`DELETE FROM support_messages WHERE email LIKE $1`, [`%${tag}%`])
  await pool.query(`DELETE FROM notifications WHERE user_id IN ($1, $2)`, [trader.id, otherTrader.id])
  /* coupon rows stay: coupon_audit is append-only by design, so test coupons
     (unique code per run) remain in the disposable test database */
  await pool.query(`DELETE FROM openfund_challenges WHERE id=$1`, [challengeId])
  await pool.query(`DELETE FROM openfund_users WHERE id IN ($1, $2)`, [trader.id, otherTrader.id])
  await pool.end()
})

test('U1 user status change requires auth, actor, a reason and valid transitions', async () => {
  assert.equal((await call('POST', `/admin/users/${trader.id}/status`, { body: { status: 'suspended', reason: 'r' } })).status, 403)
  assert.equal((await call('POST', `/admin/users/${trader.id}/status`, { admin: true, actor: '', body: { status: 'suspended', reason: 'abuse review' } })).status, 400)
  assert.equal((await call('POST', `/admin/users/${trader.id}/status`, { admin: true, body: { status: 'deleted', reason: 'x' } })).status, 400)
  assert.equal((await call('POST', `/admin/users/${trader.id}/status`, { admin: true, body: { status: 'suspended' } })).status, 400)
  const suspended = await call('POST', `/admin/users/${trader.id}/status`, { admin: true, body: { status: 'suspended', reason: 'abuse review' } })
  assert.equal(suspended.status, 200)
  assert.equal((await pool.query(`SELECT status FROM openfund_users WHERE id=$1`, [trader.id])).rows[0].status, 'suspended')
  assert.ok(audits.some(a => a.action === 'user_suspended' && a.userId === trader.id && a.details.reason === 'abuse review'))
  const duplicate = await call('POST', `/admin/users/${trader.id}/status`, { admin: true, body: { status: 'suspended', reason: 'again' } })
  assert.equal(duplicate.data.duplicate, true)
  assert.equal((await call('POST', `/admin/users/${trader.id}/status`, { admin: true, body: { status: 'active', reason: 'cleared' } })).status, 200)
  assert.equal((await call('POST', `/admin/users/${crypto.randomUUID()}/status`, { admin: true, body: { status: 'active', reason: 'x' } })).status, 404)
})

test('C1 commercial coupon lifecycle: create → activate → update → disable, audited by the schema trigger', async () => {
  assert.equal((await call('POST', '/admin/coupons', { body: { code: CODE+'X', kind: 'percent', value: 10 } })).status, 403)
  assert.equal((await call('POST', '/admin/coupons', { admin: true, body: { code: 'bad code!', kind: 'percent', value: 10 } })).status, 400)
  assert.equal((await call('POST', '/admin/coupons', { admin: true, body: { code: CODE, kind: 'percent', value: 101 } })).status, 400)
  assert.equal((await call('POST', '/admin/coupons', { admin: true, body: { code: CODE, kind: 'fixed', value: 0 } })).status, 400)
  assert.equal((await call('POST', '/admin/coupons', { admin: true, body: { code: CODE, kind: 'percent', value: 100, internal: true } })).status, 400)
  const created = await call('POST', '/admin/coupons', { admin: true, body: {
    code: CODE.toLowerCase(), kind: 'percent', value: 25, name: 'Ops launch', maxRedemptions: 10, perUserLimit: 2,
    accountSizes: [10000], challengePlanIds: [planId], allowedUserIds: [trader.id], expiresAt: '2030-01-01T00:00:00Z' } })
  assert.equal(created.status, 201)
  assert.equal(created.data.coupon.code, CODE)
  assert.equal(created.data.coupon.status, 'inactive')
  const id = created.data.coupon.id
  assert.equal((await call('POST', '/admin/coupons', { admin: true, body: { code: CODE, kind: 'percent', value: 5 } })).status, 409)
  const activated = await call('POST', `/admin/coupons/${id}`, { admin: true, body: { status: 'active', name: 'Ops launch v2', allowedUserIds: null } })
  assert.equal(activated.status, 200)
  assert.equal(activated.data.coupon.status, 'active')
  assert.equal(activated.data.coupon.name, 'Ops launch v2')
  assert.equal((await pool.query(`SELECT count(*)::int c FROM coupon_allowed_users WHERE coupon_id=$1`, [id])).rows[0].c, 0)
  assert.equal((await pool.query(`SELECT count(*)::int c FROM coupon_challenge_plans WHERE coupon_id=$1`, [id])).rows[0].c, 1)
  const disabled = await call('POST', `/admin/coupons/${id}`, { admin: true, body: { status: 'inactive' } })
  assert.equal(disabled.data.coupon.status, 'inactive')
  const revoked = await call('POST', `/admin/coupons/${id}`, { admin: true, body: { status: 'revoked' } })
  assert.equal(revoked.data.coupon.status, 'revoked')
  assert.equal((await call('POST', `/admin/coupons/${id}`, { admin: true, body: { status: 'active' } })).status, 409, 'revocation is final')
  const auditRows = (await pool.query(`SELECT actor, action FROM coupon_audit WHERE coupon_id=$1 ORDER BY id`, [id])).rows
  assert.ok(auditRows.length >= 2, 'schema trigger recorded coupon changes')
  assert.ok(auditRows.every(row => row.actor === 'admin:qa operator'), 'audit rows carry the named operator, not the database role')
})

test('C2 create-and-activate in one request, the 100% guard, date-only expiry and the plan picker', async () => {
  const stamp = String(Date.now()).slice(-7)
  /* activate on creation: two audited changes (created, then activated) */
  const live = await call('POST', '/admin/coupons', { admin: true, body: { code: `LIVE-${stamp}`, kind: 'fixed', value: '15', activate: true, expiresAt: '2030-03-01' } })
  assert.equal(live.status, 201)
  assert.equal(live.data.activation, 'activated')
  assert.equal(live.data.coupon.status, 'active')
  /* a calendar-date expiry keeps the coupon valid for that whole UTC day */
  assert.equal(new Date(live.data.coupon.expires_at).toISOString(), '2030-03-02T00:00:00.000Z')
  const trail = (await pool.query(`SELECT after->>'status' AS status FROM coupon_audit WHERE coupon_id=$1 ORDER BY id`, [live.data.coupon.id])).rows.map(r => r.status)
  assert.deepEqual(trail, ['inactive', 'active'])
  /* not requested: created inactive, and the response says so */
  const draft = await call('POST', '/admin/coupons', { admin: true, body: { code: `DRAFT-${stamp}`, kind: 'percent', value: 10 } })
  assert.equal(draft.data.activation, 'not_requested')
  assert.equal(draft.data.coupon.status, 'inactive')
  /* a 100% coupon without a total cap is created but refused activation */
  const free = await call('POST', '/admin/coupons', { admin: true, body: { code: `FULL-${stamp}`, kind: 'percent', value: 100, activate: true } })
  assert.equal(free.status, 201)
  assert.equal(free.data.activation, 'failed')
  assert.equal(free.data.activationError, 'full_discount_needs_limit')
  assert.equal(free.data.coupon.status, 'inactive')
  assert.equal((await pool.query(`SELECT status FROM coupons WHERE id=$1`, [free.data.coupon.id])).rows[0].status, 'inactive')
  const refused = await call('POST', `/admin/coupons/${free.data.coupon.id}`, { admin: true, body: { status: 'active' } })
  assert.equal(refused.status, 409)
  assert.equal(refused.data.error, 'full_discount_needs_limit')
  const capped = await call('POST', `/admin/coupons/${free.data.coupon.id}`, { admin: true, body: { status: 'active', maxRedemptions: 3 } })
  assert.equal(capped.status, 200)
  assert.equal(capped.data.coupon.status, 'active')
  /* a duplicate with activate stays a duplicate (nothing created) */
  assert.equal((await call('POST', '/admin/coupons', { admin: true, body: { code: `LIVE-${stamp}`, kind: 'percent', value: 5, activate: true } })).status, 409)
  /* plan picker: ids, names and sizes for eligibility, admin only */
  assert.equal((await call('GET', '/admin/coupons/plans')).status, 403)
  const plans = await call('GET', '/admin/coupons/plans', { admin: true })
  assert.equal(plans.status, 200)
  assert.ok(plans.data.plans.some(p => p.id === planId))
  for (const p of plans.data.plans) assert.ok(Array.isArray(p.accountSizesUsd) && typeof p.name === 'string')
})

test('S1 operator reply reaches the trader inbox and notifies; trader replies back; closed threads refuse', async () => {
  const submitted = await call('POST', '/support/messages', { user: trader.id, body: {
    fullName: 'Ops Tester', email: `ops.${tag}@example.com`, department: 'support', subject: 'Payout question here',
    message: 'I would like to understand the payout waiting period for my account.',
    privacyConsent: true, locale: 'en', website: '', startedAt: Date.now() - 10_000 } })
  assert.equal(submitted.status, 201)
  supportRef = submitted.data.reference
  assert.equal((await call('POST', `/admin/support/messages/${supportRef}/thread`, { admin: true, body: { action: 'reply', message: '' } })).status, 400)
  const reply = await call('POST', `/admin/support/messages/${supportRef}/thread`, { admin: true, body: { action: 'reply', message: 'Payouts are reviewed within two business days.' } })
  assert.equal(reply.status, 200)
  assert.equal(reply.data.messages.at(-1).role, 'operator')
  const inbox = await call('GET', '/support/inbox', { user: trader.id })
  assert.equal(inbox.data.messages[0].reference, supportRef)
  assert.equal(inbox.data.messages[0].unread, 1)
  const otherInbox = await call('GET', '/support/inbox', { user: otherTrader.id })
  assert.equal(otherInbox.data.messages.length, 0, 'inbox is scoped to the owner')
  assert.equal((await call('GET', `/support/inbox/${supportRef}/thread`, { user: otherTrader.id })).status, 404)
  const thread = await call('GET', `/support/inbox/${supportRef}/thread`, { user: trader.id })
  assert.equal(thread.data.messages.length, 1)
  assert.equal(thread.data.messages[0].actor, undefined, 'operator identity is not exposed to traders')
  await call('POST', `/support/inbox/${supportRef}/thread`, { user: trader.id, body: { action: 'read', through: thread.data.total } })
  const traderReply = await call('POST', `/support/inbox/${supportRef}/thread`, { user: trader.id, body: { action: 'reply', message: 'Thank you, that answers it.' } })
  assert.equal(traderReply.status, 200)
  const operatorView = await call('GET', `/admin/support/messages/${supportRef}`, { admin: true })
  assert.equal(operatorView.data.thread.messages.length, 2)
  assert.equal(operatorView.data.thread.unread, 1)
  const notifications = await call('GET', '/notifications', { user: trader.id })
  assert.equal(notifications.data.unread, 1)
  assert.equal(notifications.data.notifications[0].kind, 'support_reply')
  assert.equal(notifications.data.notifications[0].payload.reference, supportRef)
  await call('POST', `/admin/support/messages/${supportRef}`, { admin: true, body: { status: 'closed' } })
  assert.equal((await call('POST', `/support/inbox/${supportRef}/thread`, { user: trader.id, body: { action: 'reply', message: 'One more thing please.' } })).status, 409)
})

test('N1 notifications dedupe, challenge-event relay and read receipts', async () => {
  const dedupeKey = `test:${tag}`
  assert.ok(await notify(pool, { userId: trader.id, kind: 'payout_approved', payload: { amountUsd: '10.00' }, dedupeKey }))
  assert.equal(await notify(pool, { userId: trader.id, kind: 'payout_approved', payload: { amountUsd: '10.00' }, dedupeKey }), null)
  await assert.rejects(notify(pool, { userId: trader.id, kind: 'everything_else' }), /unknown notification kind/)
  await relayChallengeEvents(pool)
  await pool.query(`INSERT INTO challenge_events (challenge_id, kind, detail) VALUES ($1, 'passed', '{}'::jsonb)`, [challengeId])
  const relayed = await relayChallengeEvents(pool)
  /* the cursor is global: a running backend's interval relay may deliver the
     event first. Delivery itself is checked through /notifications below. */
  assert.ok(relayed === 0 || relayed === 1, `relayed ${relayed}`)
  assert.equal(await relayChallengeEvents(pool), 0, 'relay cursor advances')
  const list = await call('GET', '/notifications', { user: trader.id })
  assert.ok(list.data.notifications.some(n => n.kind === 'challenge_passed' && n.payload.challengeId === challengeId))
  const marked = await call('POST', '/notifications/read', { user: trader.id, body: {} })
  assert.ok(marked.data.marked >= 2)
  assert.equal((await call('GET', '/notifications', { user: trader.id })).data.unread, 0)
  assert.equal((await call('GET', '/notifications', {})).status, 401)
})

test('A1 unified audit viewer merges both trails with filters', async () => {
  await pool.query(`INSERT INTO audit_log (action, user_id, details) VALUES ('ops_probe_action', $1, '{"a":1}'::jsonb)`, [trader.id])
  await pool.query(`INSERT INTO financial_audit_log (actor, action, entity, entity_id, before, after)
                    VALUES ('admin:qa operator', 'ops_probe_financial', 'withdrawal', $1, '{}'::jsonb, '{}'::jsonb)`, [crypto.randomUUID()])
  assert.equal((await call('GET', '/admin/operations/audit')).status, 403)
  const merged = await call('GET', '/admin/operations/audit?action=ops_probe', { admin: true })
  assert.equal(merged.status, 200)
  const sources = new Set(merged.data.entries.map(e => e.source))
  assert.ok(sources.has('operational') && sources.has('financial'))
  const financialOnly = await call('GET', '/admin/operations/audit?action=ops_probe&source=financial', { admin: true })
  assert.ok(financialOnly.data.entries.every(e => e.source === 'financial'))
  assert.equal((await call('GET', '/admin/operations/audit?source=nope', { admin: true })).status, 400)
})

test('G1 global search resolves wallet, challenge id, support reference and tx hash', async () => {
  const byWallet = await call('GET', `/admin/operations/search?q=${trader.wallet_address}`, { admin: true })
  assert.ok(byWallet.data.results.some(r => r.kind === 'user' && r.id === trader.id))
  const byChallenge = await call('GET', `/admin/operations/search?q=${challengeId}`, { admin: true })
  assert.ok(byChallenge.data.results.some(r => r.kind === 'challenge' && r.id === challengeId))
  const byRef = await call('GET', `/admin/operations/search?q=${supportRef}`, { admin: true })
  assert.ok(byRef.data.results.some(r => r.kind === 'support' && r.reference === supportRef))
  const byTx = await call('GET', `/admin/operations/search?q=0x${'1'.repeat(64)}`, { admin: true })
  assert.deepEqual(byTx.data.results, [])
  assert.equal((await call('GET', '/admin/operations/search?q=', { admin: true })).status, 400)
})

test('R1 risk board returns recorded aggregates and engine/feed health, read-only', async () => {
  const board = await call('GET', '/admin/operations/risk', { admin: true })
  assert.equal(board.status, 200)
  assert.ok(Array.isArray(board.data.accounts) && Array.isArray(board.data.exposure))
  assert.ok('engineLoop' in board.data && 'feed' in board.data)
  assert.equal((await call('GET', '/admin/operations/risk')).status, 403)
})

test('N2 a paid purchase that provisions its challenge notifies purchase_paid once; unpaid orders do not', async () => {
  await relayChallengeEvents(pool)
  const order = async status => (await pool.query(
    `INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, status) VALUES ($1,$2,10000,99,'pending') RETURNING id`,
    [otherTrader.id, planId])).rows[0].id
  const paidOrder = await order(), openOrder = await order()
  await pool.query(`UPDATE purchase_orders SET status='paid', paid_at=now() WHERE id=$1`, [paidOrder])
  const provision = async orderId => {
    const { rows: [c] } = await pool.query(
      `INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, stage, account_size_usd, rules_snapshot, purchase_order_id)
       VALUES ($1,$2,'created',1,10000,'{}'::jsonb,$3) RETURNING id`, [otherTrader.id, planId, orderId])
    await pool.query(`INSERT INTO challenge_events (challenge_id, kind, detail) VALUES ($1,'account_provisioned','{}'::jsonb)`, [c.id])
    return c.id
  }
  const paidChallenge = await provision(paidOrder)
  await provision(openOrder)
  await relayChallengeEvents(pool)
  await relayChallengeEvents(pool)
  const { rows } = await pool.query(`SELECT payload FROM notifications WHERE user_id=$1 AND kind='purchase_paid'`, [otherTrader.id])
  assert.equal(rows.length, 1, 'exactly one notification, only for the paid order')
  assert.equal(rows[0].payload.orderId, paidOrder)
  assert.equal(rows[0].payload.challengeId, paidChallenge)
  await pool.query(`DELETE FROM openfund_challenges WHERE user_id=$1`, [otherTrader.id])
  await pool.query(`DELETE FROM purchase_orders WHERE user_id=$1`, [otherTrader.id])
})
