/* Observability signals: failure counters, structured log lines without
 * personal data, and the metrics snapshot (engine lag, feed staleness). */
import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { recordFailure, metricsSnapshot, failureCounts, resetForTests } from '../observability.js'
import { operationsAdminRoutes } from '../admin-operations.js'

test('failures are counted and logged as one structured line without request details', () => {
  resetForTests()
  const lines = [], original = console.error
  console.error = line => lines.push(String(line))
  try {
    recordFailure('audit_insert_failure', { action: 'user_suspended', error: Object.assign(new Error('boom 0xabc wallet'), { code: '57P01' }) })
    recordFailure('audit_insert_failure', { action: 'user_suspended', error: new Error('again') })
  } finally { console.error = original }
  assert.equal(failureCounts().audit_insert_failure.count, 2)
  const event = JSON.parse(lines[0].replace('[obs] ', ''))
  assert.deepEqual(event, { event: 'audit_insert_failure', action: 'user_suspended', code: '57P01', count: 1 })
  assert.ok(!lines.join('').includes('0xabc'), 'error messages are not logged')
})

test('snapshot reports engine lag and feed staleness and raises alerts past the limits', () => {
  resetForTests()
  const now = 1_000_000_000
  const marketData = { marks: new Map([['BTC/USD', { at: now - 1000 }], ['ETH/USD', { at: now - 30_000 }]]) }
  const healthy = metricsSnapshot({ engine: { lastPassAt: now - 1500 }, marketData, now })
  assert.equal(healthy.engineLoop.lagMs, 1500)
  assert.deepEqual([healthy.marketFeed.markets, healthy.marketFeed.fresh, healthy.marketFeed.newestMarkAgeMs], [2, 1, 1000])
  assert.equal(healthy.ok, true)
  const late = metricsSnapshot({ engine: { lastPassAt: now - 20_000 }, marketData: { marks: new Map([['BTC/USD', { at: now - 120_000 }]]) }, now })
  assert.deepEqual(late.alerts, ['engine_loop_lag', 'market_feed_stale'])
  assert.deepEqual(metricsSnapshot({ engine: { lastPassAt: null }, now }).alerts, ['engine_loop_lag'], 'a loop that never ran is an alert')
  const original = console.error; console.error = () => {}
  try { recordFailure('payment_recovery_failure', { action: 'sweep', error: new Error('rpc') }) } finally { console.error = original }
  assert.ok(metricsSnapshot({ now }).alerts.includes('payment_recovery_failures'))
})

test('the metrics endpoint requires the admin token', async () => {
  process.env.ADMIN_API_TOKEN = 'observability-test-token-0123456789'
  const app = express()
  app.use('/admin/operations', operationsAdminRoutes({ pool: null, engine: { lastPassAt: Date.now() }, marketData: { marks: new Map() } }))
  const server = app.listen(0); const base = `http://127.0.0.1:${server.address().port}`
  try {
    assert.equal((await fetch(base + '/admin/operations/metrics')).status, 403)
    const ok = await fetch(base + '/admin/operations/metrics', { headers: { authorization: 'Bearer observability-test-token-0123456789' } })
    assert.equal(ok.status, 200)
    const body = await ok.json()
    assert.ok('engineLoop' in body && 'marketFeed' in body && Array.isArray(body.alerts))
  } finally { server.close() }
})
