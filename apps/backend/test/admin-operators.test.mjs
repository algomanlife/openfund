/* Named admin operators and access levels (admin-operators.js, adminAuth).
   Role rules run without a database. With DATABASE_URL (CI backend job) the
   operator table is created in a private schema of this test, so other test
   files that share the database keep the single-owner bootstrap. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import express from 'express'
import pg from 'pg'
import { roleAllows, configureAdminOperators, upsertOperator, authenticateOperator, resolveOperator, operatorAdminRoutes } from '../admin-operators.js'
import { adminAuth, adminActor } from '../admin.js'
import { limiter } from '../rate-limit-store.js'

test('roles: owner everything, others read plus their own write scope', () => {
  assert.equal(roleAllows('owner', 'POST', '/admin/runtime/mode'), true)
  assert.equal(roleAllows('viewer', 'GET', '/admin/users'), true)
  assert.equal(roleAllows('viewer', 'POST', '/admin/users/1/status'), false)
  assert.equal(roleAllows('finance', 'POST', '/admin/withdrawals/1/review'), true)
  assert.equal(roleAllows('finance', 'POST', '/admin/support/threads/1'), false)
  assert.equal(roleAllows('support', 'POST', '/admin/support/threads/1/reply'), true)
  assert.equal(roleAllows('support', 'POST', '/admin/withdrawals/1/review'), false)
  assert.equal(roleAllows('content', 'POST', '/admin/guides/x'), true)
  assert.equal(roleAllows('content', 'POST', '/admin/paymentsx'), false)
  for (const role of ['finance', 'support', 'content', 'viewer']) {
    assert.equal(roleAllows(role, 'GET', '/admin/operators'), false, role)
    assert.equal(roleAllows(role, 'GET', '/admin/regional/status'), false, role)
  }
  assert.equal(roleAllows('nobody', 'GET', '/admin/users'), false)
})

const url = process.env.DATABASE_URL
test('operators: bootstrap, enforcement, roles and sign-in', { skip: !url && 'needs DATABASE_URL' }, async () => {
  const schema = 'admin_ops_test_' + process.pid
  const setup = new pg.Pool({ connectionString: url })
  await setup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema}`)
  const ddl = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
  const table = ddl.slice(ddl.indexOf('CREATE TABLE IF NOT EXISTS admin_operators'), ddl.indexOf('CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_operators_username_ci'))
  const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` })
  await pool.query(table)
  configureAdminOperators(pool)
  process.env.ADMIN_API_TOKEN = 'operator-test-service-token-0123456789'
  const app = express()
  app.use(express.json())
  app.use('/admin/operators', operatorAdminRoutes({ Router: express.Router, adminAuth, adminActor, limiter }))
  const probe = express.Router().use(adminAuth)
  probe.all('/{*rest}', (req, res) => res.json({ actor: adminActor(req) }))
  app.use('/admin', probe)
  const server = app.listen(0)
  await new Promise(r => server.once('listening', r))
  const base = `http://127.0.0.1:${server.address().port}`
  const call = (path, { method = 'GET', actor, body } = {}) => fetch(base + path, { method,
    headers: { Authorization: `Bearer ${process.env.ADMIN_API_TOKEN}`, ...(actor && { 'X-Admin-Actor': actor }), ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body) }).then(async r => ({ status: r.status, data: await r.json() }))
  try {
    /* bootstrap: any named actor acts as the single owner */
    assert.equal((await call('/admin/users', { actor: 'anyone' })).status, 200)
    assert.equal((await resolveOperator('anyone')).bootstrap, true)
    await assert.rejects(upsertOperator({ username: 'fin', role: 'finance', password: 'x'.repeat(20) }, 't'), /first_operator_must_be_owner/)
    await upsertOperator({ username: 'Root', role: 'owner', password: 'owner-password-long-enough' }, 'test')
    await upsertOperator({ username: 'fin', role: 'finance', password: 'finance-password-long-enough' }, 'test')
    await assert.rejects(upsertOperator({ username: 'Root', role: 'viewer' }, 't'), /last_owner/)
    await new Promise(r => setTimeout(r, 5_100)) /* bootstrap cache */
    /* enforcement: unknown names are refused, roles apply, the name is canonical */
    assert.equal((await call('/admin/users', { actor: 'anyone' })).status, 403)
    assert.equal((await call('/admin/users')).status, 400)
    assert.deepEqual((await call('/admin/users', { actor: 'root' })).data, { actor: 'admin:Root' })
    assert.equal((await call('/admin/withdrawals/1/review', { method: 'POST', actor: 'fin', body: {} })).status, 200)
    assert.equal((await call('/admin/users/1/status', { method: 'POST', actor: 'fin', body: {} })).data.error, 'operator_role_forbidden')
    assert.equal((await call('/admin/operators', { actor: 'fin' })).status, 403)
    assert.equal((await call('/admin/operators', { actor: 'Root' })).data.operators.length, 2)
    /* sign-in check for Backstage; disabled operators lose access at once */
    assert.equal((await call('/admin/operators/authenticate', { method: 'POST', body: { username: 'fin', password: 'finance-password-long-enough' } })).data.role, 'finance')
    assert.equal((await call('/admin/operators/authenticate', { method: 'POST', body: { username: 'fin', password: 'wrong-password-long-enough' } })).status, 401)
    assert.equal((await call('/admin/operators', { method: 'POST', actor: 'Root', body: { username: 'fin', role: 'finance', status: 'disabled' } })).status, 200)
    assert.equal((await call('/admin/users', { actor: 'fin' })).data.error, 'operator_unknown_or_disabled')
    assert.equal(await authenticateOperator('fin', 'finance-password-long-enough'), null)
  } finally {
    server.close()
    configureAdminOperators(null)
    await pool.end()
    await setup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
    await setup.end()
  }
})
