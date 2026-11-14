import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import express from 'express'
import pg from 'pg'
import { certificateRoutes, certificateAdminRoutes, syncCertificates, certificateName } from '../certificates.js'
if (!/test|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
let server, base, user, other, plan, order, challenge, payout
const token = 'certificate-local-test-token'
const call = async (path, { method = 'GET', body, as = user, admin = false } = {}) => {
  const headers = { 'content-type': 'application/json' }
  if (as) headers['x-test-user'] = as
  if (admin) { headers.authorization = `Bearer ${token}`; headers['x-admin-actor'] = 'certificate qa' }
  const r = await fetch(base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: r.status, data: await r.json() }
}
before(async () => {
  process.env.ADMIN_API_TOKEN = token
  const app = express(); app.use(express.json())
  const requireAuth = (req, res, next) => { if (!req.headers['x-test-user']) return res.status(401).json({ error: 'unauthenticated' }); req.user = { user_id: req.headers['x-test-user'] }; next() }
  app.use(certificateRoutes({ pool, requireAuth })); app.use('/admin/certificates', certificateAdminRoutes({ pool }))
  app.use((e, _req, res, _next) => res.status(e.status || 500).json({ error: e.message }))
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`
  for (let n = 0; n < 2; n++) {
    const id = (await pool.query('INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id', [`0x${randomUUID().replaceAll('-', '')}12345678`])).rows[0].id
    if (n === 0) user = id; else other = id
  }
  plan = (await pool.query('INSERT INTO challenge_plans (slug,name) VALUES ($1,$2) RETURNING id', [`cert-${randomUUID()}`, 'Certificate test plan'])).rows[0].id
  order = (await pool.query(`INSERT INTO purchase_orders (user_id,challenge_plan_id,account_size_usd,price_usd) VALUES ($1,$2,10000,100) RETURNING id`, [user, plan])).rows[0].id
})
after(async () => { await new Promise(resolve => server.close(resolve)); await pool.end() })
test('name validation rejects control characters and accepts Persian ZWNJ', () => {
  assert.equal(certificateName('  آزمایش‌گر  '), 'آزمایش‌گر'); assert.equal(certificateName(null), null)
  assert.throws(() => certificateName('abc\u202Edef')); assert.throws(() => certificateName('<script>')); assert.throws(() => certificateName('x'))
})
test('private list requires a session and rejects unconfirmed identity', async () => {
  assert.equal((await call('/certificates', { as: null })).status, 401)
  assert.equal((await call('/certificates/identity', { method: 'POST', body: { displayName: 'Sample' } })).status, 400)
})
test('identity confirmation is one-time even under concurrency', async () => {
  const results = await Promise.all(Array.from({ length: 4 }, () => call('/certificates/identity', { method: 'POST', body: { confirmed: true, displayName: 'آزمایش‌گر' } })))
  assert.equal(results.filter(r => r.status === 201).length, 1); assert.equal(results.filter(r => r.status === 409).length, 3)
  assert.equal((await call('/certificates')).data.certificates.length, 0)
})
test('purchase needs both paid order and actual provisioned challenge', async () => {
  await pool.query(`UPDATE purchase_orders SET status='paid', paid_at=now() WHERE id=$1`, [order])
  assert.equal((await call('/certificates')).data.certificates.length, 0)
  challenge = (await pool.query(`INSERT INTO openfund_challenges (user_id,challenge_plan_id,account_size_usd,purchase_order_id) VALUES ($1,$2,10000,$3) RETURNING id`, [user, plan, order])).rows[0].id
  const row = (await call('/certificates')).data.certificates[0]
  assert.equal(row.kind, 'purchase'); assert.equal(row.holder, 'آزمایش‌گر'); assert.match(row.serial, /^[0-9a-f]{32}$/)
  await Promise.all([syncCertificates(pool, user), syncCertificates(pool, user)])
  assert.equal((await call('/certificates')).data.certificates.length, 1)
})
test('passed challenge alone never issues completion; approved final review does', async () => {
  await pool.query(`UPDATE openfund_challenges SET status='passed',completed_at=now() WHERE id=$1`, [challenge])
  assert.equal((await call('/certificates')).data.certificates.length, 1)
  const funded = (await pool.query(`INSERT INTO openfund_challenges (user_id,challenge_plan_id,account_size_usd,funded_from_challenge_id) VALUES ($1,$2,10000,$3) RETURNING id`, [user, plan, challenge])).rows[0].id
  await pool.query(`INSERT INTO challenge_reviews (challenge_id,decision,actor,funded_challenge_id) VALUES ($1,'approved','admin:test',$2)`, [challenge, funded])
  assert.equal((await call('/certificates')).data.certificates.filter(c => c.kind === 'completion').length, 1)
})
test('approved payout is ineligible; paid payout needs reference and date; duplicates prevented', async () => {
  payout = (await pool.query(`INSERT INTO withdrawal_requests (user_id,challenge_id,amount_usd,status) VALUES ($1,$2,123.45,'approved') RETURNING id`, [user, challenge])).rows[0].id
  assert.equal((await call('/certificates')).data.certificates.filter(c => c.kind === 'payout').length, 0)
  await pool.query(`UPDATE withdrawal_requests SET status='paid',reviewed_at=now() WHERE id=$1`, [payout])
  assert.equal((await call('/certificates')).data.certificates.filter(c => c.kind === 'payout').length, 0)
  await pool.query(`UPDATE withdrawal_requests SET payout_ref='isolated-test-record' WHERE id=$1`, [payout])
  await Promise.all([syncCertificates(pool, user), syncCertificates(pool, user)])
  const rows = (await call('/certificates')).data.certificates.filter(c => c.kind === 'payout')
  assert.equal(rows.length, 1); assert.equal(rows[0].amount, '123.45')
})
test('owner isolation, public whitelist and unknown identifiers', async () => {
  assert.equal((await call('/certificates', { as: other })).data.certificates.length, 0)
  const c = (await call('/certificates')).data.certificates[0]
  const publicResult = await call('/certificates/verify', { method: 'POST', as: null, body: { serial: c.serial } })
  assert.equal(publicResult.status, 200); assert.equal(publicResult.data.status, 'valid')
  assert.deepEqual(Object.keys(publicResult.data.certificate).sort(), ['serial','kind','status','holder','plan','amount','currency','eventAt','issuedAt','revokedAt'].sort())
  assert.equal((await call('/certificates/verify', { method: 'POST', body: { serial: 'a'.repeat(32) } })).status, 404)
})
test('revocation requires operator, persists history and removes public holder details', async () => {
  const c = (await call('/certificates')).data.certificates[0]
  const path = `/admin/certificates/${c.serial}/revoke`, body = { reason: 'Isolated test revocation' }
  assert.equal((await call(path, { method: 'POST', body })).status, 403)
  assert.equal((await call(path, { method: 'POST', body, admin: true })).status, 200)
  assert.equal((await call(path, { method: 'POST', body, admin: true })).status, 200)
  const result = (await call('/certificates/verify', { method: 'POST', body: { serial: c.serial } })).data
  assert.equal(result.status, 'revoked'); assert.equal(result.certificate, undefined)
  assert.equal((await pool.query(`SELECT * FROM certificate_events WHERE serial=$1 AND action='revoked'`, [c.serial])).rowCount, 1)
  await assert.rejects(pool.query('UPDATE certificates SET holder=$2 WHERE serial=$1', [c.serial, 'Different']))
  await assert.rejects(pool.query('DELETE FROM certificate_events WHERE serial=$1', [c.serial]))
})
test('administrative correction is audited and preserves issued identity snapshots', async () => {
  const c = (await call('/certificates')).data.certificates.find(c => c.status === 'valid')
  const r = await call(`/admin/certificates/identities/${user}/correct`, { method: 'POST', admin: true, body: { displayName: 'Corrected test holder', reason: 'Documented correction in test' } })
  assert.equal(r.status, 200)
  assert.equal((await call('/certificates')).data.certificates.find(x => x.serial === c.serial).holder, 'آزمایش‌گر')
  assert.equal((await pool.query(`SELECT * FROM audit_log WHERE user_id=$1 AND action='certificate_identity_corrected'`, [user])).rowCount, 1)
})
test('wallet fallback is permanently confirmed and clients cannot supply issuance evidence', async () => {
  const r = await call('/certificates/identity', { method: 'POST', as: other, body: { confirmed: true, displayName: null, amount: 999, kind: 'payout' } })
  assert.equal(r.status, 201)
  const result = (await call('/certificates', { as: other })).data
  assert.equal(result.identity.display_name, null); assert.equal(result.certificates.length, 0)
  assert.equal((await call('/certificates/identity', { method: 'POST', as: other, body: { confirmed: true, displayName: 'New name' } })).status, 409)
})
test('anonymous public lookup rate limit is shared across requested serials', async () => {
  let last
  for (let i = 0; i < 31; i++) last = await call('/certificates/verify', { method: 'POST', as: null, body: { serial: randomUUID().replaceAll('-', '') } })
  assert.equal(last.status, 429)
})
