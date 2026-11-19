/**
 * Security audit 2026-11 regression tests for auth-hygiene.js.
 *  - internalTokenGuard: wrong-length and missing tokens are 401 (never a
 *    RangeError/500); both supported header forms authenticate.
 *  - sweepExpiredAuth (real PostgreSQL, isolated test database only):
 *    expired nonces and sessions are removed, live ones are kept.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import pg from 'pg'
import { internalTokenGuard, sweepExpiredAuth } from '../auth-hygiene.js'

const serve = async env => {
  const app = express()
  app.post('/internal/x', internalTokenGuard(env), (req, res) => res.json({ ok: true }))
  app.use((err, req, res, next) => res.status(500).json({ error: 'internal' }))
  const server = app.listen(0)
  const base = `http://127.0.0.1:${server.address().port}`
  const call = headers => fetch(base + '/internal/x', { method: 'POST', headers }).then(r => r.status)
  return { server, call }
}

test('internal token guard: fail closed without a 500 on any supplied value', async () => {
  const { server, call } = await serve({ INTERNAL_API_TOKEN: 'a'.repeat(40) })
  try {
    assert.equal(await call({}), 401)
    assert.equal(await call({ 'x-internal-token': 'short' }), 401, 'length mismatch is a 401, not a RangeError')
    assert.equal(await call({ 'x-internal-token': 'b'.repeat(40) }), 401)
    assert.equal(await call({ 'x-internal-token': 'a'.repeat(40) }), 200)
    assert.equal(await call({ authorization: `Bearer ${'a'.repeat(40)}` }), 200)
    assert.equal(await call({ authorization: 'Bearer wrong' }), 401)
  } finally { server.close() }
})

test('internal token guard: unset token keeps the documented test-mode behaviour', async () => {
  const { server, call } = await serve({})
  try { assert.equal(await call({}), 200) } finally { server.close() }
})

const dbUrl = process.env.DATABASE_URL || ''
test('expired SIWE nonces and sessions are swept; live rows stay', { skip: !/test|audit|_ci/.test(dbUrl) && 'needs an isolated test DATABASE_URL' }, async () => {
  const pool = new pg.Pool({ connectionString: dbUrl })
  const tag = crypto.randomBytes(6).toString('hex')
  const addr = '0x' + crypto.randomBytes(20).toString('hex')
  try {
    const { rows: [u] } = await pool.query('INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id', [addr])
    await pool.query(`INSERT INTO auth_nonces (nonce, address, expires_at) VALUES
      ($1, $3, now() - interval '2 hours'), ($2, $3, now() + interval '10 minutes')`, [`old${tag}`, `new${tag}`, addr])
    await pool.query(`INSERT INTO auth_sessions (id_hash, user_id, expires_at) VALUES
      ($1, $3, now() - interval '2 days'), ($2, $3, now() + interval '1 day')`, [`old${tag}`, `new${tag}`, u.id])
    const removed = await sweepExpiredAuth(pool)
    assert.ok(removed.nonces >= 1 && removed.sessions >= 1)
    const left = async t => (await pool.query(`SELECT nonce AS k FROM auth_nonces WHERE nonce LIKE $1 UNION ALL
      SELECT id_hash FROM auth_sessions WHERE id_hash LIKE $1`, [`%${tag}`])).rows.map(r => r.k).sort()
    assert.deepEqual(await left(), [`new${tag}`, `new${tag}`])
    await pool.query('DELETE FROM auth_nonces WHERE nonce LIKE $1', [`%${tag}`])
    await pool.query('DELETE FROM openfund_users WHERE id=$1', [u.id])
  } finally { await pool.end() }
})
