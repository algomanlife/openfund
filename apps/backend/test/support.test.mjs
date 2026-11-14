/**
 * Contact Us support messages — validation, persistence, anti-spam,
 * public/admin isolation and operator workflow on real PostgreSQL.
 * The real routers are mounted on an ephemeral Express app.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import pg from 'pg'
import { supportRoutes, supportAdminRoutes, validateSubmission, newReference, MIN_FILL_MS } from '../support.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const TOKEN = 'support-test-token-0123456789'
let server, base
const tag = `t${Date.now()}`

const call = async (method, path, { body, admin, actor = 'qa operator', raw } = {}) => {
  const headers = { 'content-type': 'application/json' }
  if (admin) { headers.authorization = `Bearer ${TOKEN}`; if (actor) headers['x-admin-actor'] = actor }
  const r = await fetch(base + path, { method, headers, body: raw ?? (body ? JSON.stringify(body) : undefined) })
  return { status: r.status, data: await r.json().catch(() => null) }
}
const form = (over = {}) => ({
  fullName: '  Sara   Example ', email: `Sara.${tag}.${Math.random().toString(36).slice(2, 7)}@Example.com`, department: 'support',
  subject: 'Challenge not visible', message: 'I paid for a 10k Standard challenge but it is not in my dashboard yet.',
  orderId: 'a1b2c3', challengeId: '', privacyConsent: true, locale: 'fa', website: '', startedAt: Date.now() - 10_000, ...over,
})

before(async () => {
  process.env.ADMIN_API_TOKEN = TOKEN
  const app = express()
  app.use(express.json({ limit: '32kb' }))
  app.use(supportRoutes({ pool }))
  app.use('/admin/support', supportAdminRoutes({ pool }))
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.status ? err.message : 'internal' }))
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
})
after(async () => { server?.close(); await pool.query(`DELETE FROM support_messages WHERE email LIKE $1`, [`%.${tag}.%`]); await pool.end() })

test('S1 validation normalizes whitespace, email case and control characters', () => {
  const row = validateSubmission(form({ subject: 'Hello‮ world\u0007', email: 'A.B@Example.COM' }))
  assert.equal(row.fullName, 'Sara Example')
  assert.equal(row.email, 'a.b@example.com')
  assert.equal(row.subject, 'Hello world')
  assert.equal(row.orderRef, 'a1b2c3')
  assert.equal(row.challengeRef, null)
})

test('S2 malformed, oversized and incomplete submissions are rejected with the field', () => {
  const bad = [
    [{ email: 'not-an-email' }, 'email'], [{ department: 'sales' }, 'department'], [{ subject: 'x' }, 'subject'],
    [{ message: 'short' }, 'message'], [{ message: 'x'.repeat(5001) }, 'message'], [{ fullName: 'y'.repeat(121) }, 'fullName'],
    [{ orderId: '<script>' }, 'orderId'], [{ privacyConsent: 'yes' }, 'privacyConsent'], [{ privacyConsent: false }, 'privacyConsent'],
    [{ website: 'http://spam.example' }, 'website'], [{ startedAt: Date.now() - MIN_FILL_MS + 500 }, 'startedAt'], [{ startedAt: undefined }, 'startedAt'],
  ]
  for (const [over, field] of bad) assert.throws(() => validateSubmission(form(over)), e => e.status === 400 && e.field === field, JSON.stringify(over))
  assert.throws(() => validateSubmission(null), /invalid_body/)
  assert.throws(() => validateSubmission([]), /invalid_body/)
})

test('S3 references are random and well-formed', () => {
  const refs = new Set(Array.from({ length: 500 }, () => newReference()))
  assert.equal(refs.size, 500)
  for (const r of refs) assert.match(r, /^OF-\d{6}-[A-Z2-9]{6}$/)
})

test('S4 a valid submission persists with status new and returns only the public reference', async () => {
  const f = form()
  const r = await call('POST', '/support/messages', { body: f })
  assert.equal(r.status, 201)
  assert.deepEqual(Object.keys(r.data).sort(), ['createdAt', 'reference', 'status'])
  assert.equal(r.data.status, 'new')
  const row = (await pool.query('SELECT * FROM support_messages WHERE reference=$1', [r.data.reference])).rows[0]
  assert.equal(row.full_name, 'Sara Example'); assert.equal(row.email, f.email.trim().toLowerCase())
  assert.equal(row.department, 'support'); assert.equal(row.order_ref, 'a1b2c3'); assert.equal(row.locale, 'fa')
  assert.ok(row.privacy_consent_at && row.created_at)
})

test('S5 duplicate and rapid repeat submissions from one email are refused', async () => {
  const email = `dup.${tag}.x@example.com`
  assert.equal((await call('POST', '/support/messages', { body: form({ email }) })).status, 201)
  assert.equal((await call('POST', '/support/messages', { body: form({ email }) })).status, 409)
  assert.equal((await call('POST', '/support/messages', { body: form({ email, subject: 'Second question' }) })).status, 201)
  assert.equal((await call('POST', '/support/messages', { body: form({ email, subject: 'Third question' }) })).status, 201)
  const fourth = await call('POST', '/support/messages', { body: form({ email, subject: 'Fourth question' }) })
  assert.equal(fourth.status, 429)
})

test('S6 HTTP errors name the field and never echo stored data', async () => {
  const r = await call('POST', '/support/messages', { body: form({ email: 'bad' }) })
  assert.equal(r.status, 400); assert.deepEqual(r.data, { error: 'invalid_email', field: 'email' })
  assert.equal((await call('POST', '/support/messages', { raw: '{bad json' })).status, 400)
})

test('S7 there is no public way to list or read messages', async () => {
  for (const path of ['/support/messages', '/support/messages/OF-000000-AAAAAA']) {
    const r = await call('GET', path)
    assert.ok([404, 405].includes(r.status) || r.status >= 400, path)
    assert.ok(!Array.isArray(r.data?.messages))
  }
  assert.equal((await call('GET', '/admin/support/messages')).status, 403)
  const wrong = await fetch(base + '/admin/support/messages', { headers: { authorization: 'Bearer wrong-token-of-same-length-xx' } })
  assert.equal(wrong.status, 403)
})

test('S8 operators list, assign, annotate and move messages through allowed states; closed is final', async () => {
  const { data: { reference } } = await call('POST', '/support/messages', { body: form({ department: 'technical', subject: 'Chart freezes' }) })
  const list = await call('GET', '/admin/support/messages?department=technical&status=new', { admin: true })
  assert.equal(list.status, 200); assert.ok(list.data.messages.some(m => m.reference === reference))
  assert.equal((await call('POST', `/admin/support/messages/${reference}`, { admin: true, actor: '', body: { status: 'in_progress' } })).status, 400)
  const a = await call('POST', `/admin/support/messages/${reference}`, { admin: true, body: { status: 'in_progress', assignedTo: 'tech.desk', internalNote: 'Reproduced on Safari' } })
  assert.equal(a.status, 200); assert.equal(a.data.message.status, 'in_progress'); assert.equal(a.data.message.assignedTo, 'tech.desk')
  assert.match(a.data.message.internalNotes, /admin:qa operator\] Reproduced on Safari/)
  assert.equal((await call('POST', `/admin/support/messages/${reference}`, { admin: true, body: { status: 'new' } })).status, 409)
  assert.equal((await call('POST', `/admin/support/messages/${reference}`, { admin: true, body: { status: 'closed' } })).status, 200)
  assert.equal((await call('POST', `/admin/support/messages/${reference}`, { admin: true, body: { status: 'in_progress' } })).status, 409)
  assert.equal((await call('POST', `/admin/support/messages/${reference}`, { admin: true, body: { internalNote: 'late note' } })).status, 409)
  const detail = await call('GET', `/admin/support/messages/${reference}`, { admin: true })
  assert.deepEqual(detail.data.events.map(e => [e.from_status, e.to_status]), [['new', 'in_progress'], ['in_progress', 'closed']])
})

test('S9 submitted content is immutable at the database level', async () => {
  const { data: { reference } } = await call('POST', '/support/messages', { body: form({ subject: 'Immutable check' }) })
  await assert.rejects(pool.query(`UPDATE support_messages SET message='tampered message body text' WHERE reference=$1`, [reference]), /support_message_content_immutable/)
  await pool.query(`UPDATE support_messages SET status='in_progress' WHERE reference=$1`, [reference])
})
