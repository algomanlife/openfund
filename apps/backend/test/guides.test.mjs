/**
 * Terminal guide counters (guides.js, ADR 0056), DB-backed.
 *  - events increment one anonymous daily row per guide and version;
 *  - malformed events are refused;
 *  - stats need the admin token and compute the completion rate.
 * Run: DATABASE_URL=<isolated test db> node --test test/guides.test.mjs
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import pg from 'pg'
import { guideRoutes } from '../guides.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
process.env.ADMIN_API_TOKEN ||= 'guide-test-admin-token-0123456789'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
let server, base
const call = (method, path, { body, admin } = {}) => fetch(base + path, {
  method, headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: `Bearer ${process.env.ADMIN_API_TOKEN}`, 'X-Admin-Actor': 'guide-test' } : {}) },
  body: body ? JSON.stringify(body) : undefined,
}).then(async r => ({ status: r.status, data: r.status === 204 ? null : await r.json().catch(() => null) }))

before(async () => {
  const app = express()
  app.use(express.json())
  app.use(guideRoutes({ pool, limit: () => (req, res, next) => next() }))
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.status ? err.message : 'internal' }))
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  server?.close()
  await pool.query(`DELETE FROM guide_daily_stats WHERE guide_id IN ('991','992')`)
  await pool.end()
})

test('events increment one anonymous daily row per guide and version', async () => {
  for (const event of ['shown', 'shown', 'shown', 'completed', 'opted_out'])
    assert.equal((await call('POST', '/guides/events', { body: { guideId: 991, version: 2, event } })).status, 204)
  assert.equal((await call('POST', '/guides/events', { body: { guideId: 991, version: 3, event: 'shown' } })).status, 204)
  const { rows } = await pool.query(`SELECT * FROM guide_daily_stats WHERE guide_id='991' ORDER BY version`)
  assert.equal(rows.length, 2, 'a new version is counted separately')
  assert.deepEqual([rows[0].shown, rows[0].completed, rows[0].opted_out], [3, 1, 1])
  const columns = Object.keys(rows[0])
  for (const forbidden of ['ip', 'wallet', 'user_id', 'user_agent', 'cookie']) assert.ok(!columns.some(c => c.includes(forbidden)), forbidden)
})

test('malformed events are refused', async () => {
  for (const body of [
    { guideId: 992, version: 1, event: 'click' },
    { guideId: 992, version: 1, event: 'constructor' },
    { guideId: 992, version: 0, event: 'shown' },
    { guideId: 992, version: '1', event: 'shown' },
    { guideId: 'x; drop', version: 1, event: 'shown' },
    {},
  ]) assert.equal((await call('POST', '/guides/events', { body })).status, 400, JSON.stringify(body))
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM guide_daily_stats WHERE guide_id='992'`)).rows[0].n, 0)
})

test('stats need the admin token and report the completion rate', async () => {
  assert.equal((await call('GET', '/admin/guides/stats')).status, 403)
  const { status, data } = await call('GET', '/admin/guides/stats', { admin: true })
  assert.equal(status, 200)
  const row = data.stats.find(s => s.guide_id === '991' && s.version === 2)
  assert.equal(row.shown, 3)
  assert.equal(row.completionRate, 0.3333)
})
