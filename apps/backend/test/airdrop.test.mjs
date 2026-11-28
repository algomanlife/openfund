/*
 * Openfund airdrop: certificate-based missions for challenge buyers, claims
 * with public post links, admin review and payment with the on-chain hash.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import pg from 'pg'
import { airdropRoutes, airdropAdminRoutes, airdropProgress, postLinks, AIRDROP_MISSIONS } from '../airdrop.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const TOKEN = 'airdrop-test-token-0123456789abcdef'
let server, base

const call = async (method, path, { body, user, admin } = {}) => {
  const headers = { 'content-type': 'application/json' }
  if (user) headers['x-test-user'] = user
  if (admin) { headers.authorization = `Bearer ${TOKEN}`; headers['x-admin-actor'] = 'airdrop reviewer' }
  const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, data: await r.json().catch(() => null) }
}
const user = async () => (await pool.query('INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, 42161) RETURNING id', ['0x' + crypto.randomBytes(20).toString('hex')])).rows[0].id
const certify = (userId, kind, n = 1, status = 'valid') => Promise.all(Array.from({ length: n }, () => pool.query(
  `INSERT INTO certificates (user_id, kind, source_id, holder, plan, amount, event_at, status, revoked_at) VALUES ($1,$2,gen_random_uuid(),'0xholder','standard',100,now(),$3,$4)`,
  [userId, kind, status, status === 'revoked' ? new Date() : null])))
const links = ['https://x.com/trader/status/1', 'https://www.instagram.com/p/abc']

before(async () => {
  process.env.ADMIN_API_TOKEN = TOKEN
  const app = express()
  app.use(express.json())
  const requireAuth = (req, res, next) => (req.headers['x-test-user'] ? ((req.user = { user_id: req.headers['x-test-user'] }), next()) : res.status(401).json({ error: 'unauthenticated' }))
  app.use(airdropRoutes({ pool, requireAuth }))
  app.use('/admin/airdrop', airdropAdminRoutes({ pool }))
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message, details: error.details }))
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
})
after(async () => { server?.close(); await pool.end() })

test('five missions pay $1,000 to $5,000, and progress needs a purchase', () => {
  assert.deepEqual(AIRDROP_MISSIONS.map(m => m.rewardUsd), [1000, 2000, 3000, 4000, 5000])
  assert.equal(airdropProgress({ payout: 10 }).eligible, false)
  assert.equal(airdropProgress({ payout: 10 }).missions.find(m => m.id === 'ten-payouts').complete, false, 'no purchase, no airdrop')
  const p = airdropProgress({ purchase: 3, completion: 1 })
  assert.deepEqual(p.missions.filter(m => m.complete).map(m => m.id), ['buy-share', 'pass-share', 'three-buys-pass'])
})

test('post links: public https only, 1 to 5, de-duplicated', () => {
  assert.deepEqual(postLinks(['https://x.com/a', 'https://x.com/a']), ['https://x.com/a'])
  for (const bad of [[], ['http://x.com/a'], ['javascript:alert(1)'], ['https://user:pw@x.com/a'], ['https://localhost/a'], Array(6).fill(0).map((_, i) => `https://x.com/${i}`)])
    assert.throws(() => postLinks(bad))
})

test('a buyer sees progress from valid certificates only, and claims a completed mission once', async () => {
  const id = await user()
  assert.equal((await call('GET', '/airdrop/me')).status, 401)
  let me = await call('GET', '/airdrop/me', { user: id })
  assert.equal(me.data.eligible, false)
  assert.equal((await call('POST', '/airdrop/claims', { user: id, body: { mission: 'buy-share', links } })).data.error, 'purchase_required')
  await certify(id, 'purchase')
  await certify(id, 'completion', 1, 'revoked')
  me = await call('GET', '/airdrop/me', { user: id })
  assert.equal(me.data.eligible, true)
  assert.equal(me.data.counts.completion, 0, 'a revoked certificate does not count')
  assert.equal((await call('POST', '/airdrop/claims', { user: id, body: { mission: 'pass-share', links } })).data.error, 'mission_incomplete')
  assert.equal((await call('POST', '/airdrop/claims', { user: id, body: { mission: 'nope', links } })).data.error, 'invalid_mission')
  assert.equal((await call('POST', '/airdrop/claims', { user: id, body: { mission: 'buy-share', links: ['http://x.com/1'] } })).data.error, 'invalid_link')
  const ok = await call('POST', '/airdrop/claims', { user: id, body: { mission: 'buy-share', links } })
  assert.equal(ok.status, 201); assert.equal(ok.data.claim.status, 'submitted'); assert.equal(Number(ok.data.claim.rewardUsd), 1000)
  assert.equal((await call('POST', '/airdrop/claims', { user: id, body: { mission: 'buy-share', links } })).data.error, 'claim_exists')
  me = await call('GET', '/airdrop/me', { user: id })
  assert.equal(me.data.missions.find(m => m.id === 'buy-share').claim.status, 'submitted')
})

test('review: reject lets the wallet submit again; approve then paid needs the on-chain hash', async () => {
  const id = await user()
  await certify(id, 'purchase')
  const claim = (await call('POST', '/airdrop/claims', { user: id, body: { mission: 'buy-share', links } })).data.claim
  assert.equal((await call('POST', `/admin/airdrop/claims/${claim.id}/decide`, { body: { decision: 'approve', reason: 'ok' } })).status, 403)
  assert.equal((await call('POST', `/admin/airdrop/claims/${claim.id}/decide`, { admin: true, body: { decision: 'approve', reason: 'x' } })).data.error, 'reason_required')
  assert.equal((await call('POST', `/admin/airdrop/claims/${claim.id}/decide`, { admin: true, body: { decision: 'paid', reason: 'sent' } })).data.error, 'invalid_tx_hash')
  assert.equal((await call('POST', `/admin/airdrop/claims/${claim.id}/decide`, { admin: true, body: { decision: 'reject', reason: 'post was deleted' } })).data.claim.status, 'rejected')
  const again = await call('POST', '/airdrop/claims', { user: id, body: { mission: 'buy-share', links: ['https://x.com/trader/status/2'] } })
  assert.equal(again.status, 201); assert.equal(again.data.claim.id, claim.id)
  assert.equal((await call('POST', `/admin/airdrop/claims/${claim.id}/decide`, { admin: true, body: { decision: 'paid', reason: 'sent', txHash: '0x' + 'a'.repeat(64) } })).data.error, 'claim_not_in_state')
  assert.equal((await call('POST', `/admin/airdrop/claims/${claim.id}/decide`, { admin: true, body: { decision: 'approve', reason: 'two public posts verified' } })).data.claim.status, 'approved')
  const queue = await call('GET', '/admin/airdrop/claims?status=approved', { admin: true })
  assert.ok(queue.data.claims.some(c => c.id === claim.id && c.wallet))
  const paid = await call('POST', `/admin/airdrop/claims/${claim.id}/decide`, { admin: true, body: { decision: 'paid', reason: 'USDC sent from the treasury Safe', txHash: '0x' + 'AB'.repeat(32) } })
  assert.equal(paid.data.claim.status, 'paid'); assert.equal(paid.data.claim.paidTxHash, '0x' + 'ab'.repeat(32))
  assert.equal((await call('POST', `/admin/airdrop/claims/${claim.id}/decide`, { admin: true, body: { decision: 'reject', reason: 'late' } })).data.error, 'claim_not_in_state')
})

test('the public mission list says it is not a token', async () => {
  const r = await call('GET', '/airdrop/missions')
  assert.equal(r.data.token, false); assert.equal(r.data.missions.length, 5)
})
