/* Shared, persistent rate limiting (rate-limit-store.js).
   With DATABASE_URL (CI backend job): counters live in PostgreSQL, survive a
   new store instance ("restart") and are shared by two instances. Without a
   database the store falls back to process memory instead of failing open
   or closed. */
import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { PostgresRateLimitStore, limiter, routeLimit, configureRateLimitStore, sweepRateLimits } from '../rate-limit-store.js'

const brokenPool = { query: async () => { throw new Error('connection refused') } }

test('a database outage falls back to a per-process window', async () => {
  const store = new PostgresRateLimitStore({ prefix: 'test-outage', pool: brokenPool })
  store.init({ windowMs: 60_000 })
  assert.equal((await store.increment('1.2.3.4')).totalHits, 1)
  assert.equal((await store.increment('1.2.3.4')).totalHits, 2)
  await store.resetKey('1.2.3.4')
  assert.equal((await store.increment('1.2.3.4')).totalHits, 1)
  store.shutdown()
})

async function serve(app) {
  const server = app.listen(0)
  await new Promise(r => server.once('listening', r))
  return { base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) }
}

const url = process.env.DATABASE_URL
test('counters are persistent and shared across instances', { skip: !url && 'needs DATABASE_URL' }, async () => {
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: url })
  try {
    await configureRateLimitStore(pool)
    await pool.query("DELETE FROM rate_limit_hits WHERE key LIKE 'test-shared:%' OR key LIKE 'route:%/rl-route'")
    const a = new PostgresRateLimitStore({ prefix: 'test-shared' }), b = new PostgresRateLimitStore({ prefix: 'test-shared' })
    a.init({ windowMs: 60_000 }); b.init({ windowMs: 60_000 })
    assert.equal((await a.increment('9.9.9.9')).totalHits, 1)
    assert.equal((await b.increment('9.9.9.9')).totalHits, 2, 'a second instance sees the same counter')
    const restarted = new PostgresRateLimitStore({ prefix: 'test-shared' }); restarted.init({ windowMs: 60_000 })
    assert.equal((await restarted.increment('9.9.9.9')).totalHits, 3, 'a restart keeps the window')
    const other = new PostgresRateLimitStore({ prefix: 'test-other' }); other.init({ windowMs: 60_000 })
    assert.equal((await other.increment('9.9.9.9')).totalHits, 1, 'limiters never share counters')
    const short = new PostgresRateLimitStore({ prefix: 'test-short' }); short.init({ windowMs: 50 })
    await short.increment('k'); await new Promise(r => setTimeout(r, 80))
    assert.equal((await short.increment('k')).totalHits, 1, 'an expired window starts again')
    await new Promise(r => setTimeout(r, 80))
    assert.ok(await sweepRateLimits(pool) >= 1)

    const app = express()
    app.get('/rl-route', routeLimit(2), (req, res) => res.json({ ok: true }))
    app.get('/rl-named', limiter('test-named', { windowMs: 60_000, limit: 1 }), (req, res) => res.json({ ok: true }))
    const s = await serve(app)
    try {
      const codes = []
      for (let i = 0; i < 3; i++) codes.push((await fetch(`${s.base}/rl-route`)).status)
      assert.deepEqual(codes, [200, 200, 429])
      const named = [(await fetch(`${s.base}/rl-named`)).status, (await fetch(`${s.base}/rl-named`)).status]
      assert.deepEqual(named, [200, 429])
    } finally { await s.close() }
  } finally {
    await pool.query("DELETE FROM rate_limit_hits WHERE key LIKE 'test-%' OR key LIKE 'route:%/rl-route'").catch(() => {})
    await pool.end()
  }
})
