/**
 * Labs drops (labs.js, ADR 0055) on real PostgreSQL: validation refuses
 * rules the engine does not enforce, concurrent buyers never oversell, the
 * per-wallet cap holds, expired reservations return to the drop, the sale
 * window is respected, and the public view carries real counts only.
 * Every drop here is test data created by this file.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import pg from 'pg'
import { labReserveTx, labRoutes, labCounts } from '../labs.js'
import { configurationProblems, labStatus } from '../../../packages/plan-validation/index.mjs'
import { validatePlanDraft } from '../admin-console.js'
import { PLAN_SEEDS } from '../plan-catalog.js'
import { publicPlanRules } from '../purchases.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 20 })
const base = PLAN_SEEDS.find(p => p.slug === 'one-phase').configuration
const hour = 3600_000
const iso = t => new Date(t).toISOString()
const run = Date.now().toString(36) /* unique per run: the test database keeps earlier runs' orders */
const S = name => `test-lab-${name}-${run}`
let server, url, users = [], drop
const labConfig = (lab) => ({ ...base, lab: { number: 9001, inventory: 3, perWalletCap: 2, saleStartsAt: iso(Date.now() - hour), saleEndsAt: iso(Date.now() + 24 * hour), ...lab } })

const order = async (client, plan, userId, extra = {}) => {
  await labReserveTx(client, { plan, userId, graceMinutes: 60 })
  return (await client.query(`INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, lifecycle_state, expires_at)
    VALUES ($1,$2,10000,111,'awaiting_payment',$3) RETURNING id`, [userId, plan.id, extra.expiresAt ?? new Date(Date.now() + hour)])).rows[0].id
}
const buy = async (plan, userId) => {
  const client = await pool.connect()
  try { await client.query('BEGIN'); const id = await order(client, plan, userId); await client.query('COMMIT'); return { ok: true, id } }
  catch (e) { await client.query('ROLLBACK').catch(() => {}); return { ok: false, error: e.message } } finally { client.release() }
}
const plant = async (slug, configuration, status = 'active') =>
  (await pool.query(`INSERT INTO challenge_plans (slug, name, configuration, status) VALUES ($1,$2,$3,$4)
    ON CONFLICT (slug) DO UPDATE SET configuration=excluded.configuration, status=excluded.status RETURNING id, slug, status, configuration`,
  [slug, 'آزمایش — Test drop', JSON.stringify(configuration), status])).rows[0]

before(async () => {
  for (const p of PLAN_SEEDS) await pool.query(`INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3) ON CONFLICT (slug) DO NOTHING`, [p.slug, p.name, JSON.stringify(p.configuration)])
  for (let i = 0; i < 8; i++) users.push((await pool.query(`INSERT INTO openfund_users (wallet_address, wallet_chain) VALUES ($1, 42161) RETURNING id`,
    ['0x' + crypto.randomUUID().replace(/-/g, '').padEnd(40, '0').slice(0, 40)])).rows[0].id)
  drop = await plant(S('drop'), labConfig())
  const app = express()
  app.use(labRoutes({ pool, graceMinutes: () => 60 }))
  server = app.listen(0); url = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  /* retire this run's drops so later suites on the same database (the browser
     checks in CI) see no open drop; the rows stay as history */
  await pool.query(`UPDATE challenge_plans SET status='inactive' WHERE slug LIKE $1`, [`test-lab-%-${run}`])
  server?.close(); await pool.end()
})

test('validation refuses rules the engine does not enforce, and malformed lab blocks', () => {
  assert.deepEqual(configurationProblems('x', labConfig()), [])
  for (const [key, value] of [['trailingEodLockPct', 4], ['maxPayoutCount', 3], ['minTradingDayProfitPct', 0.5]])
    assert.match(configurationProblems('x', { ...base, [key]: value }).join(), /not enforced by the evaluation engine/, key)
  assert.match(configurationProblems('x', { ...base, drawdownMode: 'trailing_eod' }).join(), /drawdown mode trailing_eod/)
  assert.match(configurationProblems('x', labConfig({ perWalletCap: 6 })).join(), /per-wallet cap/)
  assert.match(configurationProblems('x', labConfig({ inventory: 0 })).join(), /inventory/)
  assert.match(configurationProblems('x', labConfig({ saleEndsAt: iso(Date.now() - 2 * hour) })).join(), /sale end/)
  assert.match(configurationProblems('x', labConfig({ price: 10 })).join(), /unknown lab fields: price/)
  const draft = validatePlanDraft({ slug: 'lab-x', nameFa: 'آزمایش', nameEn: 'Lab X', configuration: { ...labConfig(), maxPayoutCount: 2 } })
  assert.ok(draft.problems.some(p => /maxPayoutCount/.test(p)), 'Backstage publishing refuses it too')
})

test('status follows the window, the sales and the plan state', () => {
  const lab = labConfig().lab, now = Date.now()
  assert.equal(labStatus(lab, { sold: 0, now }), 'open')
  assert.equal(labStatus({ ...lab, saleStartsAt: iso(now + hour) }, { now }), 'coming_soon')
  assert.equal(labStatus(lab, { sold: 3, now }), 'sold_out')
  assert.equal(labStatus(lab, { sold: 1, now: now + 48 * hour }), 'closed')
  assert.equal(labStatus(lab, { sold: 0, active: false, now }), 'closed')
})

test('concurrent buyers never oversell the inventory', async () => {
  const results = await Promise.all(users.map(u => buy(drop, u)))
  assert.equal(results.filter(r => r.ok).length, 3, JSON.stringify(results))
  assert.ok(results.filter(r => !r.ok).every(r => r.error === 'lab_sold_out'))
  const counts = await labCounts(pool, drop.id, { graceMinutes: 60 })
  assert.deepEqual([counts.sold, counts.reserved], [0, 3])
})

test('an expired reservation returns to the drop after the grace period, not before', async () => {
  const { rows: [held] } = await pool.query(`SELECT id, user_id FROM purchase_orders WHERE challenge_plan_id=$1 ORDER BY created_at LIMIT 1`, [drop.id])
  await pool.query(`UPDATE purchase_orders SET status='expired', expires_at=now() - interval '10 minutes' WHERE id=$1`, [held.id])
  assert.equal((await buy(drop, users[7])).error, 'lab_sold_out', 'still inside the late-payment grace')
  await pool.query(`UPDATE purchase_orders SET expires_at=now() - interval '2 hours' WHERE id=$1`, [held.id])
  assert.equal((await buy(drop, users[7])).ok, true, 'the unit came back')
})

test('the per-wallet cap holds across orders', async () => {
  const capped = await plant(S('cap'), labConfig({ number: 9002, inventory: 10, perWalletCap: 2 }))
  assert.equal((await buy(capped, users[0])).ok, true)
  assert.equal((await buy(capped, users[0])).ok, true)
  assert.equal((await buy(capped, users[0])).error, 'lab_wallet_cap')
  assert.equal((await buy(capped, users[1])).ok, true, 'another wallet still buys')
})

test('nothing is sold before the window opens, after it closes, or once retired', async () => {
  const soon = await plant(S('soon'), labConfig({ number: 9003, saleStartsAt: iso(Date.now() + hour), saleEndsAt: null }))
  assert.equal((await buy(soon, users[2])).error, 'lab_not_open')
  const ended = await plant(S('ended'), labConfig({ number: 9004, saleStartsAt: iso(Date.now() - 3 * hour), saleEndsAt: iso(Date.now() - hour) }))
  assert.equal((await buy(ended, users[2])).error, 'lab_closed')
  const retired = await plant(S('retired'), labConfig({ number: 9005 }), 'inactive')
  assert.equal((await buy(retired, users[2])).error, 'lab_closed')
})

test('GET /labs: current and previous drops with real counts and the comparison plans', async () => {
  const sold = await plant(S('sold'), labConfig({ number: 9006, inventory: 2 }))
  await pool.query(`INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, status, lifecycle_state, paid_at)
    SELECT u, $1, 10000, 111, 'paid', 'provisioned', now() FROM unnest($2::uuid[]) u`, [sold.id, users.slice(0, 2)])
  const body = await (await fetch(url + '/labs')).json()
  const current = body.current.find(d => d.slug === S('drop'))
  assert.equal(current.status, 'open')
  assert.equal(current.inventory, 3)
  assert.equal(current.available, 3 - current.sold - current.reserved)
  assert.deepEqual(current.rules, publicPlanRules(labConfig()), 'the rules shown are the engine rules of the drop')
  assert.ok(!JSON.stringify(body).match(/0x[0-9a-f]{40}|user_?id|wallet_?address/i), 'no buyer identities')
  const archived = body.previous.find(d => d.slug === S('sold'))
  assert.equal(archived.status, 'sold_out')
  assert.equal(archived.sold, 2)
  assert.ok(!body.previous.some(d => d.slug === S('retired')), 'a retired drop with no sales is not history')
  assert.ok(body.current.find(d => d.slug === S('soon'))?.status === 'coming_soon')
  assert.ok(body.reference.length >= 3 && body.reference.every(r => r.dailyLossPct > 0), 'standard plans for the gauges')
  assert.ok(!body.reference.some(r => r.slug.startsWith('test-lab-')), 'drops are not their own reference')
})
