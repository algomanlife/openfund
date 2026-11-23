/**
 * Bug bounty program (ADR 0057) on real PostgreSQL: a payout is recorded as a
 * verified expense in the "bug_bounty" category and appears in the public
 * economy figures; unknown categories stay refused; /.well-known/security.txt
 * is served from the request's validated origin (siteOrigin, test/seo.test.mjs).
 * Run: DATABASE_URL=<isolated test db> node --test test/bug-bounty.test.mjs
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import pg from 'pg'
import { economyRoutes } from '../economy.js'
import { seoRoutes } from '../seo.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const ref = `BB-TEST-${Date.now().toString(36)}`
let server, base
before(async () => {
  const app = express()
  app.use(economyRoutes({ pool, treasury: { view: async () => ({ configured: false }) } }))
  seoRoutes(app)
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  /* financial rows are never deleted: the test row is voided */
  await pool.query(`UPDATE verified_expenses SET status='void' WHERE invoice_reference=$1`, [ref])
  server?.close(); await pool.end()
})

test('a bounty payout is a verified "bug_bounty" expense in the public figures', async () => {
  await pool.query(`INSERT INTO verified_expenses (category, description, amount, currency, amount_usd, incurred_on, source, invoice_reference, status, payment_status, recorded_by, verified_by, verified_at)
    VALUES ('bug_bounty', 'Bug bounty: test advisory', 300, 'USDC', 300, current_date, 'receipt', $1, 'verified', 'paid', 'test', 'test', now())`, [ref])
  const body = await (await fetch(base + '/economy/transparency')).json()
  const row = body.expenses.categories.find(c => c.category === 'bug_bounty')
  assert.ok(row, 'the category is published')
  assert.ok(row.records >= 1 && Number(row.totalUsd) >= 300)
  await assert.rejects(pool.query(`INSERT INTO verified_expenses (category, description, amount, currency, amount_usd, incurred_on, source, invoice_reference, recorded_by)
    VALUES ('bounty_misc', 'x', 1, 'USD', 1, current_date, 'receipt', $1, 'test')`, [ref + '-x']), /verified_expenses_category_check/)
})

test('security.txt is served on /.well-known with the request origin', async () => {
  const res = await fetch(base + '/.well-known/security.txt')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /text\/plain/)
  const txt = await res.text()
  assert.match(txt, /^Contact: https:\/\/github\.com\/algomanlife\/openfund\/security\/advisories\/new$/m)
  assert.ok(txt.split('\n').includes(`Policy: ${base}/en/bug-bounty`), 'the policy lives on the same origin')
  assert.ok(txt.split('\n').includes(`Canonical: ${base}/.well-known/security.txt`))
})
