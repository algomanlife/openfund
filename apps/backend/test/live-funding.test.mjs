/**
 * Live Market Access — DB-backed suite (isolated test database only).
 *
 * Mounts the real live routers in-process with a stub treasury view and a
 * deterministic mark feed, then drives eligibility → approval → capital
 * gate → risk-checked orders → finalization → settlement. The sandbox
 * adapters are non-monetary; no chain or external service is contacted.
 *
 * Run: DATABASE_URL=postgresql://localhost:5432/openfund_economy_test ADMIN_API_TOKEN=... node --test test/live-funding.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import pg from 'pg'
import express from 'express'
import { liveRoutes, liveAdminRoutes, liveConfig, liveEligibility, finalizeTrade, processSettlements, settlementAdapter } from '../live-funding.js'

const url = process.env.DATABASE_URL || ''
const isolated = /(?:^|[_-])(test|audit|ci)(?:$|[_-])/.test(url.split('/').pop() || '')
const TOKEN = process.env.ADMIN_API_TOKEN || 'live-suite-admin-token'
process.env.ADMIN_API_TOKEN = TOKEN
const pool = isolated ? new pg.Pool({ connectionString: url }) : null
const marks = new Map([['BTC/USD', '100']])
const marketData = { tradeable: s => marks.has(s) ? { ok: true, meta: { base: 'BTC', group: 'crypto' }, mark: marks.get(s) } : { ok: false, reason: 'unknown_market' } }
let treasuryView = null
const treasury = { view: async () => treasuryView }
const config = { execution: 'sandbox', settlement: 'sandbox' }

let server, base
const http = async (method, path, body, { user, admin } = {}) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}), ...(admin ? { Authorization: `Bearer ${TOKEN}`, 'X-Admin-Actor': 'live-suite' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: res.status, data: await res.json().catch(() => null) }
}
const snapshot = (totalUsd, extra = {}) => ({ snapshot: { totalUsd, fullyPriced: true }, stale: false, ...extra })

async function user() {
  const { rows: [u] } = await pool.query(`INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id`, ['0x' + crypto.randomBytes(20).toString('hex')])
  return u.id
}
async function passedAccount(userId, planId, size, withdrawals) {
  const { rows: [o] } = await pool.query(`INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, status, paid_at) VALUES ($1,$2,$3,100,'paid',now()) RETURNING id`, [userId, planId, size])
  const rules = JSON.stringify({ phases: 2, dailyLossPct: 5, maxTotalLossPct: 10 })
  await pool.query(`INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, purchase_order_id, stage, rules_snapshot, completed_at) VALUES ($1,$2,'passed',$3,$4,1,$5, now() - interval '1 day')`, [userId, planId, size, o.id, rules])
  const { rows: [s2] } = await pool.query(`INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, stage, rules_snapshot, created_at) VALUES ($1,$2,'passed',$3,2,$4, now() - interval '1 day' + interval '1 second') RETURNING id`, [userId, planId, size, rules])
  for (let i = 0; i < withdrawals; i++) await pool.query(`INSERT INTO withdrawal_requests (user_id, challenge_id, amount_usd, status) VALUES ($1,$2,100,'paid')`, [userId, s2.id])
  return s2.id
}

const ctx = {}
test.before(async () => {
  if (!pool) return
  const app = express()
  app.use(express.json())
  const requireAuth = (req, res, next) => { req.user = { user_id: req.headers['x-test-user'] }; next() }
  app.use(liveRoutes({ pool, requireAuth, treasury, marketData, limit: () => (q, r, n) => n(), config }))
  app.use('/admin/live', liveAdminRoutes({ pool, treasury, config }))
  app.use('/disabled', liveRoutes({ pool, requireAuth, treasury, marketData, limit: () => (q, r, n) => n(), config: { execution: 'none', settlement: 'none' } }))
  app.use((err, req, res, next) => { void next; res.status(err.status || 500).json({ error: err.status ? err.message : String(err.message) }) })
  await new Promise(r => { server = app.listen(0, r) })
  base = `http://127.0.0.1:${server.address().port}`
  const { rows: [plan] } = await pool.query(`SELECT id FROM challenge_plans WHERE slug='standard'`)
  ctx.plan = plan.id
  ctx.trader = await user(); ctx.coach = await user()
  const { rows: [app1] } = await pool.query(`INSERT INTO partner_applications (user_id, role, status, contact_email, payload, terms_version) VALUES ($1,'coach','approved','c@example.test','{}','coach-2026-11') RETURNING id`, [ctx.coach])
  await pool.query(`INSERT INTO coach_profiles (user_id, application_id, coach_code, approved_by) VALUES ($1,$2,$3,'test')`, [ctx.coach, app1.id, 'C' + crypto.randomBytes(4).toString('hex').toUpperCase().replace(/[01IO]/g, 'Z')])
  await pool.query(`INSERT INTO trader_coach_links (trader_user_id, coach_user_id, status, qualification, verified_at) VALUES ($1,$2,'active','verified',now())`, [ctx.trader, ctx.coach])
  ctx.first = await passedAccount(ctx.trader, ctx.plan, 10000, 9)
  await passedAccount(ctx.trader, ctx.plan, 20000, 5)
})
test.after(async () => { server?.close(); await pool?.end() })

test('production refuses the sandbox adapters', () => {
  assert.deepEqual(liveConfig({ NODE_ENV: 'production', LIVE_EXECUTION_ADAPTER: 'sandbox', LIVE_SETTLEMENT_ADAPTER: 'sandbox' }), { execution: 'none', settlement: 'none', sandboxRefusedInProduction: true })
  assert.equal(liveConfig({}).execution, 'none')
})

test('eligibility is computed from records: 9 paid withdrawals is not enough', { skip: !pool }, async () => {
  let e = await liveEligibility(pool, ctx.trader)
  assert.equal(e.eligible, false)
  assert.deepEqual(e.checks.filter(c => !c.ok).map(c => c.key), ['first_account_paid_withdrawals'])
  /* requested (not paid) withdrawals do not count */
  await pool.query(`INSERT INTO withdrawal_requests (user_id, challenge_id, amount_usd, status) VALUES ($1,$2,100,'approved')`, [ctx.trader, ctx.first])
  assert.equal((await liveEligibility(pool, ctx.trader)).eligible, false)
  await pool.query(`INSERT INTO withdrawal_requests (user_id, challenge_id, amount_usd, status) VALUES ($1,$2,100,'paid')`, [ctx.trader, ctx.first])
  e = await liveEligibility(pool, ctx.trader)
  assert.equal(e.eligible, true, JSON.stringify(e.checks))
})

test('disabled execution refuses orders', { skip: !pool }, async () => {
  assert.equal((await http('POST', '/disabled/live/orders', { market: 'BTC/USD', side: 'long', collateralUsd: 1, leverage: 1, idempotencyKey: 'disabled-1' }, { user: ctx.trader })).data.error, 'live_execution_disabled')
})

test('request → management approval with an explicit tier', { skip: !pool }, async () => {
  const r = await http('POST', '/live/apply', {}, { user: ctx.trader })
  assert.equal(r.status, 201, JSON.stringify(r.data))
  ctx.approval = r.data.id
  assert.equal((await http('POST', '/live/apply', {}, { user: ctx.trader })).status, 409)
  const path = `/admin/live/approvals/${ctx.approval}/decision`
  assert.equal((await http('POST', path, { action: 'approve', note: 'ok' }, { admin: true })).data.error, 'tier_selection_required')
  assert.equal((await http('POST', path, { action: 'approve', tier: 'standard', note: 'Reviewed' }, { admin: true })).data.status, 'approved')
})

test('capital gate: unknown, below threshold, then verified capacity', { skip: !pool }, async () => {
  await pool.query(`INSERT INTO capital_reserves (kind, amount_usd, set_by) VALUES ('operational', 100000, 'test'), ('risk', 100000, 'test')`)
  const body = { approvalId: ctx.approval, amountUsd: '100000', riskLimits: { maxLeverage: 20, maxExposureUsd: '500000', maxOpenPositions: 3 } }
  treasuryView = null
  assert.equal((await http('POST', '/admin/live/allocations', body, { admin: true })).data.error, 'capital_not_verified')
  treasuryView = snapshot('10000000.00', { stale: true })
  assert.equal((await http('POST', '/admin/live/allocations', body, { admin: true })).data.error, 'capital_not_verified')
  treasuryView = snapshot('600000.00')
  assert.equal((await http('POST', '/admin/live/allocations', body, { admin: true })).data.error, 'capital_below_threshold')
  treasuryView = snapshot('10000000.00')
  assert.equal((await http('POST', '/admin/live/allocations', { ...body, riskLimits: { ...body.riskLimits, maxDrawdownPct: 20 } }, { admin: true })).data.error, 'max_limit_looser_than_policy')
  const ok = await http('POST', '/admin/live/allocations', body, { admin: true })
  assert.equal(ok.status, 200, JSON.stringify(ok.data))
  assert.equal(ok.data.allocation.risk_limits.dailyDrawdownPct, 5)
  assert.equal(ok.data.allocation.risk_limits.maxDrawdownPct, 10)
})

test('risk-checked orders, idempotent submission', { skip: !pool }, async () => {
  const tooBig = await http('POST', '/live/orders', { market: 'BTC/USD', side: 'long', collateralUsd: '6000', leverage: 5, idempotencyKey: 'order-too-big' }, { user: ctx.trader })
  assert.equal(tooBig.data.error, 'worst_case_loss_exceeds_drawdown_budget')
  const o = await http('POST', '/live/orders', { market: 'BTC/USD', side: 'long', collateralUsd: '1000', leverage: 5, idempotencyKey: 'order-long-1' }, { user: ctx.trader })
  assert.equal(o.status, 200, JSON.stringify(o.data))
  assert.equal(o.data.trade.status, 'open')
  assert.equal(o.data.monetary, false)
  const dup = await http('POST', '/live/orders', { market: 'BTC/USD', side: 'long', collateralUsd: '1000', leverage: 5, idempotencyKey: 'order-long-1' }, { user: ctx.trader })
  assert.equal(dup.data.duplicate, true)
  ctx.trade = o.data.trade.id
})

test('close: net PnL split 70/10/20 and settled exactly once', { skip: !pool }, async () => {
  marks.set('BTC/USD', '110')
  const c = await http('POST', `/live/trades/${ctx.trade}/close`, {}, { user: ctx.trader })
  assert.equal(c.status, 200, JSON.stringify(c.data))
  /* notional 5000, +10% → 500.00 gross; fees 0.035% × 5000 × 2 = 3.50 */
  assert.equal(c.data.share.distributable, '496.50')
  assert.deepEqual(c.data.share.shares, { trader: '347.55', coach: '49.65', openfund: '99.30' })
  const again = await finalizeTrade(pool, ctx.trade, { realizedPnlUsd: '500', tradingFeesUsd: '3.5', executionCostsUsd: '0' })
  assert.equal(again.duplicate, true)
  const { rows: shares } = await pool.query(`SELECT * FROM profit_share_allocations WHERE live_trade_id=$1`, [ctx.trade])
  assert.equal(shares.length, 1)
  await processSettlements(pool, settlementAdapter('sandbox'))
  const second = await processSettlements(pool, settlementAdapter('sandbox'))
  const { rows: s } = await pool.query(`SELECT beneficiary_role, status, amount_usd, settlement_reference FROM settlement_records WHERE profit_share_id=$1 ORDER BY beneficiary_role`, [shares[0].id])
  assert.deepEqual(s.map(x => [x.beneficiary_role, x.status, x.amount_usd]), [['coach', 'completed', '49.65'], ['trader', 'completed', '347.55']])
  assert.ok(s.every(x => x.settlement_reference.startsWith('sandbox-settlement:')))
  assert.equal(second.claimed, 0)
})

test('loss creates no profit share and updates allocation equity', { skip: !pool }, async () => {
  marks.set('BTC/USD', '100')
  const o = await http('POST', '/live/orders', { market: 'BTC/USD', side: 'short', collateralUsd: '1000', leverage: 2, idempotencyKey: 'order-short-1' }, { user: ctx.trader })
  marks.set('BTC/USD', '105')
  const c = await http('POST', `/live/trades/${o.data.trade.id}/close`, {}, { user: ctx.trader })
  assert.equal(c.data.share, null)
  assert.equal(c.data.net, '-101.40')   // −100.00 gross − 2 × 0.70 fees (0.035% × 2000)
  const { rows: [a] } = await pool.query(`SELECT realized_pnl_usd FROM capital_allocations WHERE trader_user_id=$1`, [ctx.trader])
  assert.equal(a.realized_pnl_usd, (496.50 - 101.40).toFixed(2))
})

test('settlement failures retry and are never paid twice', { skip: !pool }, async () => {
  marks.set('BTC/USD', '100')
  const o = await http('POST', '/live/orders', { market: 'BTC/USD', side: 'long', collateralUsd: '500', leverage: 2, idempotencyKey: 'order-long-2' }, { user: ctx.trader })
  marks.set('BTC/USD', '120')
  /* close without auto-settlement interference: finalize directly */
  const r = await finalizeTrade(pool, o.data.trade.id, { realizedPnlUsd: '200.00', tradingFeesUsd: '0.70', executionCostsUsd: '0.30', exitPrice: '120' })
  let calls = 0
  const flaky = { name: 'flaky', async pay() { calls++; throw new Error('rpc_timeout') } }
  await processSettlements(pool, flaky)
  const { rows: failed } = await pool.query(`SELECT status, attempts, last_error FROM settlement_records WHERE profit_share_id=$1`, [r.share.id])
  assert.ok(failed.every(f => f.status === 'failed' && f.attempts === 1 && f.last_error === 'rpc_timeout'))
  const paid = []
  await processSettlements(pool, { name: 'ok', async pay(s) { paid.push(s.id); return { ok: true, txHash: '0x' + 'b'.repeat(64) } } })
  await processSettlements(pool, { name: 'ok', async pay(s) { paid.push(s.id); return { ok: true } } })
  assert.equal(paid.length, 2)
  assert.equal(new Set(paid).size, 2)
  assert.ok(calls >= 2)
})

test('daily drawdown breach halts the allocation and blocks new orders', { skip: !pool }, async () => {
  marks.set('BTC/USD', '100')
  const o = await http('POST', '/live/orders', { market: 'BTC/USD', side: 'long', collateralUsd: '4000', leverage: 1, idempotencyKey: 'order-big-loss' }, { user: ctx.trader })
  assert.equal(o.status, 200, JSON.stringify(o.data))
  await finalizeTrade(pool, o.data.trade.id, { realizedPnlUsd: '-5600.00', tradingFeesUsd: '0', executionCostsUsd: '0' })
  const { rows: [a] } = await pool.query(`SELECT status, halt_reason FROM capital_allocations WHERE trader_user_id=$1`, [ctx.trader])
  assert.equal(a.status, 'halted')
  const blocked = await http('POST', '/live/orders', { market: 'BTC/USD', side: 'long', collateralUsd: '10', leverage: 1, idempotencyKey: 'order-after-halt' }, { user: ctx.trader })
  assert.equal(blocked.data.error, 'allocation_halted')
})
