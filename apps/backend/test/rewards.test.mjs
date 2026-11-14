/**
 * Reward lifecycle on real PostgreSQL — owner decisions D1, D2 and D5 on
 * rules snapshot v3, plus the unchanged terms of snapshots sold before it:
 * final pass → manual review → funded-demo account → one-time reward-cycle
 * choice → eligibility per cycle (timing, consistency, profitable-day
 * thresholds, strikes, news and strike deductions) → request → operator
 * review → paid → fee refund on the fourth paid Standard reward (exactly once).
 * The real routers run on an ephemeral Express app; only the session lookup
 * is stubbed (x-test-user header → req.user).
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import pg from 'pg'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { rewardRoutes, rewardAdminRoutes, cycleEligibility, legacyEligibility, payoutTerms, isFundedAccount, effectiveCycle } from '../rewards.js'
import { adminRoutes } from '../admin.js'
import { normalizeRules, evaluateRules, ChallengeService } from '../evaluation.js'
import { PLAN_SEEDS } from '../plan-catalog.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const TOKEN = 'rewards-test-token-0123456789'
const DAY = 86_400_000
let server, base
const plans = {}
const seed = slug => PLAN_SEEDS.find(p => p.slug === slug).configuration
/** the Standard terms sold before catalog v3 (snapshot v2) */
const LEGACY_STANDARD = { ...seed('standard'), profitSplitMonthlyPct: 100, firstPayoutDays: 14, referenceLeverageX: 5 }
const legacyRules = () => ({ ...normalizeRules(LEGACY_STANDARD), rulesVersion: 2, rewardCycles: [], conduct: {}, inactivityDays: null, model: null })

const call = async (method, path, { user, body, admin } = {}) => {
  const headers = { 'content-type': 'application/json' }
  if (user) headers['x-test-user'] = user
  if (admin) { headers.authorization = `Bearer ${TOKEN}`; headers['x-admin-actor'] = 'qa reviewer' }
  const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, data: await r.json().catch(() => null) }
}
const requireAuth = (req, res, next) => {
  const id = req.headers['x-test-user']
  if (!id) return res.status(401).json({ error: 'unauthenticated' })
  req.user = { user_id: id, status: 'active' }; next()
}
const newUser = async () => (await pool.query('INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id', [privateKeyToAccount(generatePrivateKey()).address.toLowerCase()])).rows[0].id

/** Paid order → stage 1 passed → final stage passed, as the engine leaves them. */
async function finalPass(userId, slug = 'standard', { size = 10000, price = 80, snapshot = null } = {}) {
  const plan = plans[slug]
  const rules = snapshot ?? normalizeRules(plan.configuration)
  const order = (await pool.query(`INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, status, paid_at, payment_required, payment_method)
    VALUES ($1,$2,$3,$4,'paid',now(),$5,$6) RETURNING id`, [userId, plan.id, size, price, price > 0, price > 0 ? 'crypto' : 'coupon'])).rows[0]
  const s1 = (await pool.query(`INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, purchase_order_id, rules_snapshot, stage, completed_at)
    VALUES ($1,$2,'passed',$3,$4,$5,1,now()) RETURNING *`, [userId, plan.id, size, order.id, JSON.stringify(rules)])).rows[0]
  if (Number(rules.phases) === 1) return { order, s1, final: s1 }
  const s2 = (await pool.query(`INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, rules_snapshot, stage, parent_challenge_id, completed_at)
    VALUES ($1,$2,'passed',$3,$4,2,$5,now()) RETURNING *`, [userId, plan.id, size, JSON.stringify(rules), s1.id])).rows[0]
  return { order, s1, s2, final: s2 }
}

/** Synthetic closed trades: [{ daysAgo, net }] — fill, close and ledger rows as the engine writes them. */
async function trade(userId, challengeId, trades) {
  const c = (await pool.query('SELECT * FROM openfund_challenges WHERE id=$1', [challengeId])).rows[0]
  let balance = Number((await pool.query('SELECT balance FROM demo_accounts WHERE id=$1', [c.demo_account_id])).rows[0].balance)
  for (const { daysAgo, net, market = 'BTC/USD' } of trades) {
    const at = new Date(Date.now() - daysAgo * DAY - 120_000)
    const o = (await pool.query(`INSERT INTO trading_orders (account_id, user_id, market, side, order_type, margin, leverage, status) VALUES ($1,$2,$3,'long','market',100,5,'filled') RETURNING id`, [c.demo_account_id, userId, market])).rows[0]
    const p = (await pool.query(`INSERT INTO trading_positions (order_id, account_id, user_id, market, side, quantity, entry_price, margin, leverage, status, opened_at, closed_at, realized_pnl)
      VALUES ($1,$2,$3,$4,'long',0.01,50000,100,5,'closed',$5,$6,$7) RETURNING id`, [o.id, c.demo_account_id, userId, market, at, new Date(at.getTime() + 60_000), net])).rows[0]
    balance += net
    await pool.query(`INSERT INTO trading_ledger (account_id, user_id, event, position_id, amount, balance_after, ts) VALUES ($1,$2,'close',$3,$4,$5,$6)`,
      [c.demo_account_id, userId, p.id, net, balance, new Date(at.getTime() + 60_000)])
  }
  await pool.query('UPDATE demo_accounts SET balance=$2 WHERE id=$1', [c.demo_account_id, balance])
  return balance
}
const approve = async id => call('POST', `/admin/rewards/reviews/${id}`, { admin: true, body: { decision: 'approve', note: 'clean evaluation' } })

before(async () => {
  process.env.ADMIN_API_TOKEN = TOKEN
  for (const s of PLAN_SEEDS) {
    plans[s.slug] = (await pool.query(`INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3) RETURNING *`, [`${s.slug}-rw-${Date.now()}`, s.name, JSON.stringify(s.configuration)])).rows[0]
  }
  /* inactive: a fixture plan must never appear on public pages that later suites render */
  plans.legacy = (await pool.query(`INSERT INTO challenge_plans (slug, name, status, configuration) VALUES ($1,$2,'inactive',$3) RETURNING *`, [`standard-legacy-rw-${Date.now()}`, 'legacy', JSON.stringify(LEGACY_STANDARD)])).rows[0]
  const app = express()
  app.use(express.json())
  app.use(rewardRoutes({ pool, requireAuth }))
  app.use('/admin/rewards', rewardAdminRoutes({ pool }))
  app.use('/admin', adminRoutes({ pool, audit: async () => {} }))
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.status ? err.message : 'internal', detail: err.status ? undefined : String(err.message) }))
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
})
after(async () => { server?.close(); await pool.end() })

/* ---------------- pure cycle rules (v3) ---------------- */
const v3 = slug => normalizeRules(seed(slug))
const ctx = (over = {}) => ({ startingBalance: '10000', balance: '10600', firstFillAt: new Date(Date.now() - 20 * DAY).toISOString(), now: Date.now(), dailyNet: [{ day: 'd', net: '600' }], ...over })
const failed = r => r.checks.filter(c => !c.ok).map(c => c.key)
const sevenDays = (net = '100') => Array.from({ length: 7 }, (_, i) => ({ day: `d${i}`, net }))

test('R1 Standard weekly 60% opens 7 days after the first funded trade, then every 7 days', () => {
  const r = cycleEligibility({ ...ctx({ firstFillAt: new Date(Date.now() - 8 * DAY).toISOString() }), rules: v3('standard'), cycleKey: 'weekly' })
  assert.equal(r.eligible, true, JSON.stringify(r.checks)); assert.equal(r.reward, '360.00'); assert.equal(r.splitPct, 60)
  assert.deepEqual(failed(cycleEligibility({ ...ctx({ firstFillAt: new Date(Date.now() - 6 * DAY).toISOString() }), rules: v3('standard'), cycleKey: 'weekly' })), ['waiting_period'])
  assert.deepEqual(failed(cycleEligibility({ ...ctx({ lastRequestAt: new Date(Date.now() - 6 * DAY).toISOString() }), rules: v3('standard'), cycleKey: 'weekly' })), ['waiting_period'])
})

test('R2 bi-weekly 80% (Standard, One-step) and 95% (Instant, with the 15% consistency score)', () => {
  assert.equal(cycleEligibility({ ...ctx(), rules: v3('standard'), cycleKey: 'biweekly' }).reward, '480.00')
  assert.equal(cycleEligibility({ ...ctx(), rules: v3('one-phase'), cycleKey: 'biweekly' }).reward, '480.00')
  assert.deepEqual(failed(cycleEligibility({ ...ctx({ firstFillAt: new Date(Date.now() - 13 * DAY).toISOString() }), rules: v3('one-phase'), cycleKey: 'biweekly' })), ['waiting_period'])
  const inst = cycleEligibility({ ...ctx({ balance: '10820', dailyNet: [...sevenDays(), { day: 'x', net: '120' }] }), rules: v3('instant'), cycleKey: 'biweekly' })
  assert.equal(inst.eligible, true, JSON.stringify(inst.checks)); assert.equal(inst.reward, '779.00')
  assert.deepEqual(failed(cycleEligibility({ ...ctx({ balance: '10900', dailyNet: [...sevenDays(), { day: 'x', net: '200' }] }), rules: v3('instant'), cycleKey: 'biweekly' })), ['consistency'])
})

test('R3 on-demand 100%: no waiting period; 35% consistency; 7 profitable days of ≥ 0.5% of the size', () => {
  const od = over => cycleEligibility({ ...ctx({ firstFillAt: new Date(Date.now() - DAY).toISOString(), balance: '10700', dailyNet: sevenDays(), ...over }), rules: v3('standard'), cycleKey: 'on_demand' })
  const ok = od(); assert.equal(ok.eligible, true, JSON.stringify(ok.checks)); assert.equal(ok.reward, '700.00')
  assert.deepEqual(failed(od({ dailyNet: sevenDays('49.99'), balance: '10349.93' })), ['profitable_days'], '$49.99 < 0.5% of $10,000')
  assert.deepEqual(failed(od({ dailyNet: [...sevenDays('60'), { day: 'big', net: '400' }, { day: 'l', net: '-80' }], balance: '10740' })), ['consistency'])
  assert.ok(failed(od({ balance: '10050' })).includes('minimum_request'))
})

test('R4 strikes reduce the on-demand split (2 → half, 3 → 20%, 4 → none) and struck/news profit is not paid', () => {
  const od = over => cycleEligibility({ ...ctx({ balance: '10700', dailyNet: sevenDays(), ...over }), rules: v3('standard'), cycleKey: 'on_demand' })
  assert.equal(od({ strikes: 1 }).reward, '700.00')
  assert.equal(od({ strikes: 2 }).reward, '350.00')
  assert.equal(od({ strikes: 3 }).reward, '140.00')
  assert.ok(failed(od({ strikes: 4 })).includes('strikes'))
  const d = od({ deductions: [{ kind: 'news', amount: '150.00' }, { kind: 'strike', amount: '50.00' }] })
  assert.equal(d.deducted, '200.00'); assert.equal(d.reward, '500.00')
})

test('R5 a funded news rule needs verified calendar coverage before a reward can be computed', () => {
  const funded = { ...v3('standard'), funded: true }
  assert.deepEqual(failed(cycleEligibility({ ...ctx(), rules: funded, cycleKey: 'biweekly', newsVerified: false })), ['news_calendar_verified'])
  assert.equal(cycleEligibility({ ...ctx(), rules: funded, cycleKey: 'biweekly', newsVerified: true }).eligible, true)
})

test('R6 an unselected or unknown cycle is never paid; no monthly cycle exists in v3', () => {
  assert.ok(failed(cycleEligibility({ ...ctx(), rules: v3('standard'), cycleKey: null })).includes('reward_cycle_selected'))
  assert.ok(failed(cycleEligibility({ ...ctx(), rules: v3('standard'), cycleKey: 'monthly' })).includes('reward_cycle_selected'))
  assert.ok(failed(cycleEligibility({ ...ctx(), rules: v3('instant'), cycleKey: 'on_demand' })).includes('reward_cycle_selected'))
  assert.equal(effectiveCycle({ reward_cycle: null, rules_snapshot: v3('instant') }), 'biweekly', 'a single-cycle model uses it')
  assert.equal(effectiveCycle({ reward_cycle: null, rules_snapshot: v3('standard') }), null)
})

test('R7 snapshots sold before v3 keep their terms (bi-weekly 80% or monthly 100% per request)', () => {
  const terms = payoutTerms(legacyRules(), LEGACY_STANDARD)
  assert.equal(legacyEligibility({ ...ctx(), terms, cycle: 'biweekly' }).reward, '480.00')
  const monthly = legacyEligibility({ ...ctx({ firstFillAt: new Date(Date.now() - 31 * DAY).toISOString(), balance: '10700', dailyNet: sevenDays() }), terms, cycle: 'monthly' })
  assert.equal(monthly.eligible, true, JSON.stringify(monthly.checks)); assert.equal(monthly.reward, '700.00')
})

test('R8 a funded (stage 0) account is never "passed" again by the evaluation engine', () => {
  const rules = { ...v3('standard'), funded: true }
  assert.equal(evaluateRules({ rules, stage: 0, startingBalance: '10000', balance: '12000', equity: '12000', dayBasis: '12000', tradingDays: 10 }).status, 'none')
})

/* ---------------- lifecycle over HTTP + PostgreSQL ---------------- */
test('R9 v3: review → funded account waits for a one-time cycle choice → request → reject/re-credit → approve → paid', async () => {
  const user = await newUser(), other = await newUser()
  const { s2, s1 } = await finalPass(user)
  assert.equal((await call('GET', '/rewards/status', { user })).data.reviews.find(r => r.id === s2.id)?.review, 'under_review')
  assert.equal((await call('POST', `/admin/rewards/reviews/${s1.id}`, { admin: true, body: { decision: 'approve' } })).status, 409)
  assert.equal((await call('POST', `/admin/rewards/reviews/${s2.id}`, { admin: true, body: { decision: 'reject' } })).status, 400, 'rejection needs a reason')
  const [a, b] = await Promise.all([approve(s2.id), approve(s2.id)])
  assert.deepEqual([a.status, b.status].sort(), [200, 409], 'concurrent approvals: exactly one wins')
  const fundedId = (a.status === 200 ? a : b).data.fundedChallengeId
  let funded = (await pool.query('SELECT c.*, d.balance FROM openfund_challenges c JOIN demo_accounts d ON d.id=c.demo_account_id WHERE c.id=$1', [fundedId])).rows[0]
  assert.equal(funded.status, 'created', 'the account waits for the cycle choice'); assert.equal(Number(funded.balance), 10000)
  assert.equal(funded.rules_snapshot.funded, true); assert.equal(funded.rules_snapshot.rulesVersion, 3)
  const status = await call('GET', '/rewards/status', { user })
  assert.deepEqual(status.data.awaitingCycle.find(x => x.id === fundedId).cycles.map(c => c.key), ['weekly', 'biweekly', 'on_demand'])

  assert.equal((await call('POST', `/rewards/accounts/${fundedId}/cycle`, { user: other, body: { cycle: 'biweekly' } })).status, 404)
  assert.equal((await call('POST', `/rewards/accounts/${fundedId}/cycle`, { user, body: { cycle: 'monthly' } })).status, 400)
  const pick = await call('POST', `/rewards/accounts/${fundedId}/cycle`, { user, body: { cycle: 'biweekly' } })
  assert.equal(pick.status, 200, JSON.stringify(pick.data)); assert.equal(pick.data.status, 'started')
  assert.equal((await call('POST', `/rewards/accounts/${fundedId}/cycle`, { user, body: { cycle: 'on_demand' } })).status, 409)
  await assert.rejects(pool.query(`UPDATE openfund_challenges SET reward_cycle='on_demand' WHERE id=$1`, [fundedId]), /reward_cycle_immutable/)
  funded = (await pool.query('SELECT * FROM openfund_challenges WHERE id=$1', [fundedId])).rows[0]
  assert.ok(isFundedAccount(funded))

  assert.equal((await call('POST', '/withdrawals', { user, body: { challengeId: fundedId } })).data.error, 'not_eligible')
  /* no restricted news in the calendar for this period: verified coverage, no events */
  await pool.query(`INSERT INTO economic_calendar_coverage (source, covers_from, covers_to, event_count, actor) VALUES ('rw-test', now() - interval '40 days', now() + interval '1 day', 0, 'test')`)
  await trade(user, fundedId, [{ daysAgo: 20, net: 300 }, { daysAgo: 10, net: 200 }, { daysAgo: 2, net: 100 }])
  const req1 = await call('POST', '/withdrawals', { user, body: { challengeId: fundedId, cycle: 'on_demand', amountUsd: 999999 } })
  assert.equal(req1.status, 200, JSON.stringify(req1.data)); assert.equal(req1.data.cycle, 'biweekly', 'the stored cycle wins'); assert.equal(req1.data.amountUsd, '480.00')
  const bal = async () => Number((await pool.query('SELECT balance FROM demo_accounts WHERE id=$1', [funded.demo_account_id])).rows[0].balance)
  assert.equal(await bal(), 10000)
  assert.equal((await call('POST', '/withdrawals', { user, body: { challengeId: fundedId } })).status, 409, 'one open request per account')
  assert.equal((await call('POST', `/admin/withdrawals/${req1.data.id}/review`, { admin: true, body: { action: 'reject', note: 'needs review' } })).status, 200)
  assert.equal(await bal(), 10600, 'rejection re-credits the profit')
  const req2 = await call('POST', '/withdrawals', { user, body: { challengeId: fundedId } })
  assert.equal(req2.status, 200)
  assert.equal((await call('POST', `/admin/withdrawals/${req2.data.id}/review`, { admin: true, body: { action: 'approve', note: 'ok' } })).status, 200)
  assert.equal((await call('POST', `/admin/withdrawals/${req2.data.id}/review`, { admin: true, body: { action: 'paid', payoutRef: 'manual-usdt-0001' } })).status, 200)
  const row = (await pool.query('SELECT * FROM withdrawal_requests WHERE id=$1', [req2.data.id])).rows[0]
  assert.deepEqual([row.kind, row.status, row.payout_ref, row.amount_usd, row.gross_profit_usd, Number(row.split_pct), row.reward_cycle], ['reward', 'paid', 'manual-usdt-0001', '480.00', '600.00', 80, 'biweekly'])
  await trade(user, fundedId, [{ daysAgo: 0, net: 300 }])
  const next = await call('POST', '/withdrawals', { user, body: { challengeId: fundedId } })
  assert.equal(next.status, 409); assert.ok(next.data.checks.some(c => c.key === 'waiting_period'))
})

test('R10 D5: the Standard fee refund is created exactly once, when the fourth reward is PAID', async () => {
  const user = await newUser()
  const { s2, order } = await finalPass(user, 'standard', { price: 80 })
  const fundedId = (await approve(s2.id)).data.fundedChallengeId
  await call('POST', `/rewards/accounts/${fundedId}/cycle`, { user, body: { cycle: 'weekly' } })
  const ids = []
  for (let i = 0; i < 4; i++) {
    const w = (await pool.query(`INSERT INTO withdrawal_requests (user_id, challenge_id, amount_usd, status, kind, requested_at) VALUES ($1,$2,100,'approved','reward', now() - make_interval(days => $3)) RETURNING id`, [user, fundedId, 40 - i * 7])).rows[0]
    ids.push(w.id)
    const r = await call('POST', `/admin/withdrawals/${w.id}/review`, { admin: true, body: { action: 'paid', payoutRef: `ref-${i}` } })
    assert.equal(r.status, 200)
    assert.equal(!!r.data.feeRefund, i === 3, `refund only with the 4th paid reward (got ${JSON.stringify(r.data)})`)
  }
  const refunds = (await pool.query('SELECT * FROM fee_refunds WHERE purchase_order_id=$1', [order.id])).rows
  assert.equal(refunds.length, 1); assert.equal(refunds[0].amount_usd, '80.00'); assert.equal(refunds[0].status, 'pending')
  assert.equal(refunds[0].withdrawal_id, ids[3])
  const again = await call('POST', `/admin/withdrawals/${ids[3]}/review`, { admin: true, body: { action: 'paid', payoutRef: 'ref-3' } })
  assert.equal(again.data.duplicate, true)
  assert.equal((await pool.query('SELECT count(*)::int n FROM fee_refunds WHERE purchase_order_id=$1', [order.id])).rows[0].n, 1)
  assert.equal((await call('POST', `/admin/rewards/fee-refunds/${refunds[0].id}/paid`, { admin: true, body: {} })).status, 400)
  assert.equal((await call('POST', `/admin/rewards/fee-refunds/${refunds[0].id}/paid`, { admin: true, body: { payoutRef: 'refund-0001' } })).data.status, 'paid')
  assert.equal((await call('POST', `/admin/rewards/fee-refunds/${refunds[0].id}/paid`, { admin: true, body: { payoutRef: 'refund-0001' } })).data.duplicate, true)
  const view = await call('GET', '/rewards/status', { user })
  assert.equal(view.data.funded.find(f => f.id === fundedId).feeRefund.status, 'paid')
})

test('R11 no fee refund for One-step, nor when the originating order cannot be traced', async () => {
  const user = await newUser()
  const { final } = await finalPass(user, 'one-phase', { price: 111 })
  const fundedId = (await approve(final.id)).data.fundedChallengeId
  await call('POST', `/rewards/accounts/${fundedId}/cycle`, { user, body: { cycle: 'biweekly' } })
  for (let i = 0; i < 4; i++) {
    const w = (await pool.query(`INSERT INTO withdrawal_requests (user_id, challenge_id, amount_usd, status, kind) VALUES ($1,$2,100,'approved','reward') RETURNING id`, [user, fundedId])).rows[0]
    assert.equal((await call('POST', `/admin/withdrawals/${w.id}/review`, { admin: true, body: { action: 'paid', payoutRef: `r${i}` } })).data.feeRefund, undefined)
  }
  const u2 = await newUser()
  const untraced = await finalPass(u2, 'standard', { price: 80 })
  /* a stage-2 row created before lineage links existed */
  await pool.query('UPDATE openfund_challenges SET parent_challenge_id=NULL WHERE id=$1', [untraced.s2.id])
  const f2 = (await approve(untraced.s2.id)).data.fundedChallengeId
  await call('POST', `/rewards/accounts/${f2}/cycle`, { user: u2, body: { cycle: 'biweekly' } })
  for (let i = 0; i < 4; i++) {
    const w = (await pool.query(`INSERT INTO withdrawal_requests (user_id, challenge_id, amount_usd, status, kind) VALUES ($1,$2,100,'approved','reward') RETURNING id`, [u2, f2])).rows[0]
    await call('POST', `/admin/withdrawals/${w.id}/review`, { admin: true, body: { action: 'paid', payoutRef: `z${i}` } })
  }
  assert.equal((await pool.query('SELECT count(*)::int n FROM fee_refunds WHERE challenge_id=$1', [f2])).rows[0].n, 0)
  const ev = (await pool.query(`SELECT detail FROM challenge_events WHERE challenge_id=$1 AND kind='fee_refund_not_applicable'`, [f2])).rows[0]
  assert.equal(ev?.detail?.reason, 'origin_order_unknown', 'recorded for the operator')
})

test('R12 Instant needs no cycle choice; an evaluation in progress is not a reward account', async () => {
  const user = await newUser()
  const plan = plans.instant
  const order = (await pool.query(`INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, status, paid_at) VALUES ($1,$2,10000,88,'paid',now()) RETURNING id`, [user, plan.id])).rows[0]
  const c = (await pool.query(`INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, purchase_order_id, rules_snapshot, stage) VALUES ($1,$2,'created',10000,$3,$4,0) RETURNING *`,
    [user, plan.id, order.id, JSON.stringify(normalizeRules(plan.configuration))])).rows[0]
  await new ChallengeService(pool).start(user, c.id)
  const status = await call('GET', '/rewards/status', { user })
  const inst = status.data.funded.find(f => f.id === c.id)
  assert.equal(inst.rewardCycle, 'biweekly'); assert.equal(inst.eligibility[0].splitPct, 95)
  const std = await finalPass(user)
  assert.ok(!isFundedAccount(std.s1) && !isFundedAccount(std.s2))
})

test('R13 a v2 (pre-v3) final pass is approved under its own terms: starts at once, per-request cycle', async () => {
  const user = await newUser()
  const { s2 } = await finalPass(user, 'legacy', { snapshot: legacyRules() })
  const r = await approve(s2.id)
  const funded = (await pool.query('SELECT * FROM openfund_challenges WHERE id=$1', [r.data.fundedChallengeId])).rows[0]
  assert.equal(funded.status, 'started'); assert.equal(funded.rules_snapshot.rulesVersion, 2)
  assert.equal(funded.rules_snapshot.referenceLeverageX, 5, 'the sold leverage cap is kept')
  await trade(user, funded.id, [{ daysAgo: 20, net: 600 }])
  const w = await call('POST', '/withdrawals', { user, body: { challengeId: funded.id, cycle: 'biweekly' } })
  assert.equal(w.status, 200, JSON.stringify(w.data)); assert.equal(w.data.amountUsd, '480.00')
  const view = (await call('GET', '/rewards/status', { user })).data.funded.find(f => f.id === funded.id)
  assert.equal(view.legacyTerms, true)
})
