/**
 * Hybrid Governance v1.0 — HTTP authorization surface (no server process needed).
 * The real routers and the real admin token gate are mounted on an ephemeral
 * Express app; only session lookup is stubbed (x-test-user header).
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import pg from 'pg'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createGovernance } from '../governance.js'
import { governanceRoutes } from '../governance-routes.js'
import { adminRoutes } from '../admin.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const gov = createGovernance({ pool })
const TOKEN = 'http-test-admin-token'
let server, base, memberId, outsiderId

const requireAuth = async (req, res, next) => {
  const id = req.headers['x-test-user']
  if (!id) return res.status(401).json({ error: 'unauthenticated' })
  req.user = { user_id: id, status: 'active' }; next()
}
const call = async (method, path, { user, body, token, headers } = {}) => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, data: await r.json().catch(() => null) }
}
const newUser = async () => (await pool.query('INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id', [privateKeyToAccount(generatePrivateKey()).address.toLowerCase()])).rows[0].id

before(async () => {
  process.env.ADMIN_API_TOKEN = TOKEN
  await pool.query(`TRUNCATE gov_audit_events, gov_decisions, gov_votes, gov_vote_challenges, gov_voting_sessions, gov_comments, gov_proposal_history, gov_proposal_revisions, gov_proposals, gov_roles, gov_memberships, gov_eligibility, gov_seats, gov_terms, gov_implementation_log, gov_conflicts RESTART IDENTITY CASCADE`)
  const app = express(); app.use(express.json())
  app.use('/governance', governanceRoutes({ pool, requireAuth, service: gov }))
  app.use('/admin', adminRoutes({ pool, audit: async () => {} }))
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.status ? err.message : 'internal' }))
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
  outsiderId = await newUser(); memberId = await newUser()
})
after(async () => { server.close(); await pool.end() })

test('public reads work without a session and report the true empty state', async () => {
  const o = await call('GET', '/governance/overview')
  assert.equal(o.status, 200); assert.equal(o.data.council.seatedCount, 0); assert.equal(o.data.model.token, false)
  assert.equal((await call('GET', '/governance/council')).status, 200)
  assert.equal((await call('GET', '/governance/proposals')).data.total, 0)
  assert.equal((await call('GET', '/governance/decisions')).status, 200)
  assert.equal((await call('GET', '/governance/elections')).data.publicEnabled, false)
  assert.equal((await call('GET', '/governance/proposals/OFP-0001')).status, 404)
  assert.equal((await call('GET', '/governance/proposals/../../etc/passwd')).status, 404)
})
test('participation and staff routes require a session', async () => {
  for (const [m, p] of [['GET', '/governance/me'], ['GET', '/governance/workspace'], ['POST', '/governance/proposals'], ['POST', '/governance/proposals/OFP-0001/vote'], ['POST', '/governance/proposals/OFP-0001/comments'], ['POST', '/governance/manage/proposals/OFP-0001/finalize'], ['GET', '/governance/manage/audit']]) {
    assert.equal((await call(m, p)).status, 401, `${m} ${p}`)
  }
})
test('a signed-in member is not council, staff or management', async () => {
  const me = await call('GET', '/governance/me', { user: outsiderId })
  assert.deepEqual(me.data.roles, ['member']); assert.equal(me.data.councilMember, false)
  assert.equal((await call('GET', '/governance/workspace', { user: outsiderId })).status, 403)
  assert.equal((await call('GET', '/governance/manage/audit', { user: outsiderId })).status, 403)
  assert.equal((await call('POST', '/governance/manage/proposals/OFP-0001/finalize', { user: outsiderId, body: { rationale: 'a long enough rationale' } })).status, 403)
  assert.equal((await call('PUT', '/governance/manage/eligibility', { user: outsiderId, body: { userId: outsiderId, constituency: 'coach', status: 'verified', evidenceRef: 'self' } })).status, 403)
})
test('members create proposals; reserved powers cannot be binding; every request rejects financial fields', async () => {
  const ok = await call('POST', '/governance/proposals', { user: outsiderId, body: { title: 'Better docs', summary: 'Improve the docs structure.', category: 'documentation', classification: 'binding' } })
  assert.equal(ok.status, 201); assert.equal(ok.data.ofpId, 'OFP-0001'); assert.equal(ok.data.binding, true)
  const bad = await call('POST', '/governance/proposals', { user: outsiderId, body: { title: 'Cut prices', summary: 'Cut challenge prices now.', category: 'pricing', classification: 'binding' } })
  assert.equal(bad.status, 400); assert.equal(bad.data.error, 'reserved_power_is_advisory_only')
  for (const field of ['amount', 'priceUsd', 'commissionRate', 'treasury', 'payout', 'riskLimit']) {
    const r = await call('POST', '/governance/proposals', { user: outsiderId, body: { title: 'Sneaky', summary: 'Sneaky payload here.', category: 'documentation', [field]: 1 } })
    assert.equal(r.status, 400, field); assert.equal(r.data.error, 'financial_fields_not_accepted')
  }
  assert.equal((await call('GET', '/governance/proposals?amount=5')).status, 400)
  assert.equal((await call('GET', '/governance/proposals/OFP-0001')).status, 404)                          /* still a private draft */
  assert.equal((await call('GET', '/governance/proposals/OFP-0001', { user: outsiderId })).data.status, 'draft')
})
test('the admin governance API is disabled without a token, forbidden with a wrong one, and exposes no financial endpoints', async () => {
  delete process.env.ADMIN_API_TOKEN
  assert.equal((await call('GET', '/admin/governance/overview')).status, 404)
  process.env.ADMIN_API_TOKEN = TOKEN
  assert.equal((await call('GET', '/admin/governance/overview', { token: 'wrong' })).status, 403)
  assert.equal((await call('GET', '/admin/governance/overview', { token: TOKEN })).status, 200)
  for (const p of ['/admin/governance/treasury', '/admin/governance/transfer', '/admin/governance/pricing', '/admin/governance/payouts', '/admin/governance/commissions', '/governance/treasury', '/governance/manage/transfer']) {
    assert.equal((await call('POST', p, { token: TOKEN, user: memberId, body: {} })).status, 404, p)
  }
})
test('Company Management seats a council through the admin API; a seated member then sees a workspace', async () => {
  const t = await call('POST', '/admin/governance/terms', { token: TOKEN, body: { label: 'HTTP term', startsAt: new Date(Date.now() - 86400000).toISOString(), appointmentMethod: 'appointed' } })
  assert.equal(t.status, 200); assert.equal(t.data.seats, 10)
  assert.equal((await call('POST', `/admin/governance/terms/${t.data.id}/activate`, { token: TOKEN })).status, 200)
  const seat = (await pool.query("SELECT id FROM gov_seats WHERE term_id=$1 AND constituency='coach' AND seat_no=1", [t.data.id])).rows[0]
  assert.equal((await call('POST', `/admin/governance/seats/${seat.id}/appoint`, { token: TOKEN, body: { userId: memberId } })).status, 409)   /* not verified */
  assert.equal((await call('PUT', '/admin/governance/eligibility', { token: TOKEN, body: { userId: memberId, constituency: 'coach', status: 'verified', evidenceRef: 'coach-review#7' } })).status, 200)
  const a = await call('POST', `/admin/governance/seats/${seat.id}/appoint`, { token: TOKEN, body: { userId: memberId, publicDisplayName: 'Test Coach', publicConsent: true } })
  assert.equal(a.status, 200)
  const w = await call('GET', '/governance/workspace', { user: memberId })
  assert.equal(w.status, 200); assert.equal(w.data.seat.constituency, 'coach'); assert.equal(w.data.participation.votesCast, 0)
  const c = await call('GET', '/governance/council')
  assert.equal(c.data.seatedCount, 1); assert.equal(c.data.vacantCount, 9)
  assert.equal(c.data.seats.find((s) => s.status === 'seated').displayName, 'Test Coach')
  /* a council member can vote but cannot finalize, appoint, or read the audit log */
  assert.equal((await call('GET', '/governance/manage/audit', { user: memberId })).status, 403)
  assert.equal((await call('POST', `/admin/governance/seats/${seat.id}/appoint`, { user: memberId, body: { userId: memberId } })).status, 403)
})
test('invalid identifiers and malformed bodies fail cleanly', async () => {
  assert.equal((await call('PUT', '/admin/governance/eligibility', { token: TOKEN, body: { userId: 'not-a-uuid', constituency: 'coach', status: 'verified', evidenceRef: 'x#1' } })).status, 404)
  assert.equal((await call('POST', '/admin/governance/seats/not-a-uuid/appoint', { token: TOKEN, body: {} })).status >= 400, true)
  assert.equal((await call('GET', '/governance/proposals?limit=999')).status, 400)
})
