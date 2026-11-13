/**
 * Reward lifecycle — Scenario E on real PostgreSQL:
 * final pass → manual review → funded-demo transition → reward eligibility
 * → reward request → operator review → paid; plus the pure eligibility rules
 * (waiting period, minimum, consistency, profitable days, split, cap, fee
 * refund on the fourth reward) and isolation/idempotency guarantees.
 * The real routers are mounted on an ephemeral Express app; only the
 * session lookup is stubbed (x-test-user header → req.user).
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import pg from 'pg'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { rewardRoutes, rewardAdminRoutes, evaluateRewardEligibility, payoutTerms, isFundedAccount } from '../rewards.js'
import { adminRoutes } from '../admin.js'
import { normalizeRules, evaluateRules } from '../evaluation.js'
import { PLAN_SEEDS } from '../plan-catalog.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const TOKEN = 'rewards-test-token-0123456789'
const DAY = 86_400_000
let server, base
const users = []
const plans = {}

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
const newUser = async () => {
  const id = (await pool.query('INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id', [privateKeyToAccount(generatePrivateKey()).address.toLowerCase()])).rows[0].id
  users.push(id); return id
}

/** Paid order → stage 1 passed → stage 2 passed (final), as the engine leaves them. */
async function finalPass(userId, slug = 'standard', size = 10000, price = 80) {
  const plan = plans[slug]
  const rules = normalizeRules(plan.configuration)
  const order = (await pool.query(`INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, status, paid_at) VALUES ($1,$2,$3,$4,'paid',now()) RETURNING id`,
    [userId, plan.id, size, price])).rows[0]
  const s1 = (await pool.query(`INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, purchase_order_id, rules_snapshot, stage, completed_at)
    VALUES ($1,$2,'passed',$3,$4,$5,1,now()) RETURNING *`, [userId, plan.id, size, order.id, JSON.stringify(rules)])).rows[0]
  const s2 = (await pool.query(`INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, rules_snapshot, stage, parent_challenge_id, completed_at)
    VALUES ($1,$2,'passed',$3,$4,2,$5,now()) RETURNING *`, [userId, plan.id, size, JSON.stringify(rules), s1.id])).rows[0]
  return { order, s1, s2 }
}

/** Synthetic closed trades on an account: [{ daysAgo, net }] — fill, close and fee rows as the engine writes them. */
async function trade(userId, challengeId, trades) {
  const c = (await pool.query('SELECT * FROM openfund_challenges WHERE id=$1', [challengeId])).rows[0]
  let balance = Number((await pool.query('SELECT balance FROM demo_accounts WHERE id=$1', [c.demo_account_id])).rows[0].balance)
  for (const { daysAgo, net } of trades) {
    const at = new Date(Date.now() - daysAgo * DAY)
    const o = (await pool.query(`INSERT INTO trading_orders (account_id, user_id, market, side, order_type, margin, leverage, status) VALUES ($1,$2,'BTC/USD','long','market',100,5,'filled') RETURNING id`, [c.demo_account_id, userId])).rows[0]
    const p = (await pool.query(`INSERT INTO trading_positions (order_id, account_id, user_id, market, side, quantity, entry_price, margin, leverage, status, opened_at, closed_at, realized_pnl)
      VALUES ($1,$2,$3,'BTC/USD','long',0.01,50000,100,5,'closed',$4,$4,$5) RETURNING id`, [o.id, c.demo_account_id, userId, at, net])).rows[0]
    balance += net
    await pool.query(`INSERT INTO trading_ledger (account_id, user_id, event, position_id, amount, balance_after, ts) VALUES ($1,$2,'close',$3,$4,$5,$6)`,
      [c.demo_account_id, userId, p.id, net, balance, at])
  }
  await pool.query('UPDATE demo_accounts SET balance=$2 WHERE id=$1', [c.demo_account_id, balance])
  return balance
}

before(async () => {
  process.env.ADMIN_API_TOKEN = TOKEN
  for (const seed of PLAN_SEEDS) {
    const slug = `${seed.slug}-rw-${Date.now()}`
    plans[seed.slug] = (await pool.query(`INSERT INTO challenge_plans (slug, name, configuration) VALUES ($1,$2,$3) RETURNING *`, [slug, seed.name, JSON.stringify(seed.configuration)])).rows[0]
  }
  const app = express()
  app.use(express.json())
  app.use(rewardRoutes({ pool, requireAuth }))
  app.use('/admin/rewards', rewardAdminRoutes({ pool }))
  app.use('/admin', adminRoutes({ pool, audit: async () => {} }))
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.status ? err.message : 'internal', detail: err.status ? undefined : String(err.message) }))
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  server?.close()
  await pool.end()
})

/* ---------------- pure rules ---------------- */
const standardTerms = payoutTerms(normalizeRules(PLAN_SEEDS.find(p => p.slug === 'standard').configuration))
const instantTerms = payoutTerms(normalizeRules(PLAN_SEEDS.find(p => p.slug === 'instant').configuration))
const base10k = { startingBalance: '10000', firstFillAt: new Date(Date.now() - 20 * DAY).toISOString(), now: Date.now() }
const failed = r => r.checks.filter(c => !c.ok).map(c => c.key)

test('E1 standard bi-weekly: 80% of realized profit, no consistency condition', () => {
  const r = evaluateRewardEligibility({ ...base10k, terms: standardTerms, balance: '10600', dailyNet: [{ day: 'd1', net: '600' }] })
  assert.equal(r.eligible, true, JSON.stringify(r.checks))
  assert.equal(r.reward, '480.00'); assert.equal(r.splitPct, 80); assert.equal(r.grossProfit, '600.00')
})

test('E2 waiting period counts from the first funded trade, then one cycle per request', () => {
  const early = evaluateRewardEligibility({ ...base10k, terms: standardTerms, balance: '10600', firstFillAt: new Date(Date.now() - 13 * DAY).toISOString() })
  assert.deepEqual(failed(early), ['waiting_period'])
  const none = evaluateRewardEligibility({ ...base10k, terms: standardTerms, balance: '10600', firstFillAt: null })
  assert.deepEqual(failed(none), ['waiting_period'])
  const next = evaluateRewardEligibility({ ...base10k, terms: standardTerms, balance: '10600', lastRequestAt: new Date(Date.now() - 10 * DAY).toISOString() })
  assert.deepEqual(failed(next), ['waiting_period'])
})

test('E3 minimum request is 1% of account size; losses and open exposure block', () => {
  assert.deepEqual(failed(evaluateRewardEligibility({ ...base10k, terms: standardTerms, balance: '10099.99' })), ['minimum_request'])
  assert.deepEqual(failed(evaluateRewardEligibility({ ...base10k, terms: standardTerms, balance: '9990' })), ['profit', 'minimum_request'])
  assert.deepEqual(failed(evaluateRewardEligibility({ ...base10k, terms: standardTerms, balance: '10600', openPositions: 1 })), ['flat_account'])
  assert.deepEqual(failed(evaluateRewardEligibility({ ...base10k, terms: standardTerms, balance: '10600', pendingOrders: 2 })), ['flat_account'])
})

test('E4 monthly 100% cycle needs 30 days, 7 profitable days and the 35% consistency score', () => {
  const firstFillAt = new Date(Date.now() - 31 * DAY).toISOString()
  const seven = Array.from({ length: 7 }, (_, i) => ({ day: `d${i}`, net: '100' }))
  const ok = evaluateRewardEligibility({ ...base10k, firstFillAt, terms: standardTerms, cycle: 'monthly', balance: '10700', dailyNet: seven })
  assert.equal(ok.eligible, true, JSON.stringify(ok.checks)); assert.equal(ok.reward, '700.00'); assert.equal(ok.splitPct, 100)
  const spiky = evaluateRewardEligibility({ ...base10k, firstFillAt, terms: standardTerms, cycle: 'monthly', balance: '10700', dailyNet: [...seven.slice(0, 6), { day: 'big', net: '400' }, { day: 'loss', net: '-300' }] })
  assert.deepEqual(failed(spiky), ['consistency'])
  const fewDays = evaluateRewardEligibility({ ...base10k, firstFillAt, terms: standardTerms, cycle: 'monthly', balance: '10600', dailyNet: seven.slice(0, 6).map(d => ({ ...d, net: '100' })) })
  assert.deepEqual(failed(fewDays), ['profitable_days'])
  const tooSoon = evaluateRewardEligibility({ ...base10k, terms: standardTerms, cycle: 'monthly', balance: '10700', dailyNet: seven })
  assert.deepEqual(failed(tooSoon), ['waiting_period'])
})

test('E5 Instant applies 15% consistency and 7 profitable days to every request at 95%', () => {
  const days = Array.from({ length: 8 }, (_, i) => ({ day: `d${i}`, net: '100' }))
  const ok = evaluateRewardEligibility({ ...base10k, terms: instantTerms, balance: '10800', dailyNet: days })
  assert.equal(ok.eligible, true, JSON.stringify(ok.checks)); assert.equal(ok.reward, '760.00')
  assert.deepEqual(failed(evaluateRewardEligibility({ ...base10k, terms: instantTerms, balance: '10820', dailyNet: [...days.slice(0, 7), { day: 'x', net: '120' }] })), [], '120 / 820 = 14.6%')
  assert.deepEqual(failed(evaluateRewardEligibility({ ...base10k, terms: instantTerms, balance: '10900', dailyNet: [...days.slice(0, 7), { day: 'x', net: '200' }] })), ['consistency'], '200 / 900 = 22%')
  assert.deepEqual(failed(evaluateRewardEligibility({ ...base10k, terms: instantTerms, balance: '10800', dailyNet: [{ day: 'a', net: '800' }] })), ['consistency', 'profitable_days'])
  assert.ok(failed(evaluateRewardEligibility({ ...base10k, terms: instantTerms, cycle: 'monthly', balance: '10800', dailyNet: days })).includes('cycle'), 'Instant has no monthly cycle')
})

test('E6 fee refund joins the fourth reward only; free trials never earn rewards', () => {
  const r3 = evaluateRewardEligibility({ ...base10k, terms: standardTerms, balance: '10600', priorRewards: 2, feePaidUsd: '80.00' })
  assert.equal(r3.feeRefund, '0.00')
  const r4 = evaluateRewardEligibility({ ...base10k, terms: standardTerms, balance: '10600', priorRewards: 3, feePaidUsd: '80.00' })
  assert.equal(r4.feeRefund, '80.00')
  const trial = payoutTerms(normalizeRules(PLAN_SEEDS.find(p => p.slug === 'free-trial').configuration))
  assert.ok(failed(evaluateRewardEligibility({ ...base10k, terms: trial, balance: '10600' })).includes('reward_plan'))
  assert.equal(evaluateRewardEligibility({ ...base10k, terms: { ...standardTerms, payoutCapPct: 2 }, balance: '10600' }).reward, '200.00')
})

test('E7 version-1 snapshots keep their frozen evaluation terms; payout terms come from the plan row and are flagged', () => {
  const v1 = { ...normalizeRules(PLAN_SEEDS.find(p => p.slug === 'standard').configuration), rulesVersion: 1, profitSplitPct: 70 }
  delete v1.firstPayoutDays; delete v1.minPayoutPct
  const t = payoutTerms(v1, PLAN_SEEDS.find(p => p.slug === 'standard').configuration)
  assert.equal(t.source, 'plan_configuration'); assert.equal(t.profitSplitPct, 70); assert.equal(t.firstPayoutDays, 14)
})

test('E8 a funded (stage 0) account is never "passed" again by the evaluation engine', () => {
  const rules = { ...normalizeRules(PLAN_SEEDS.find(p => p.slug === 'standard').configuration), funded: true }
  const r = evaluateRules({ rules, stage: 0, startingBalance: '10000', balance: '12000', equity: '12000', dayBasis: '12000', tradingDays: 10 })
  assert.equal(r.status, 'none')
  const breach = evaluateRules({ rules, stage: 0, startingBalance: '10000', balance: '10000', equity: '8999', dayBasis: '10000', tradingDays: 10 })
  assert.equal(breach.status, 'fail')
})

/* ---------------- lifecycle over HTTP + PostgreSQL ---------------- */
test('E9 final pass → review → exactly one funded-demo account → reward request → reject/re-credit → approve → paid', async () => {
  const user = await newUser(), other = await newUser()
  const { s2, s1 } = await finalPass(user)

  const status0 = await call('GET', '/rewards/status', { user })
  assert.equal(status0.data.reviews.find(r => r.id === s2.id)?.review, 'under_review')
  assert.ok(!status0.data.reviews.some(r => r.id === s1.id), 'a stage-1 pass is not a final pass')

  const pending = await call('GET', '/admin/rewards/reviews', { admin: true })
  assert.ok(pending.data.reviews.some(r => r.id === s2.id))
  assert.equal((await call('POST', `/admin/rewards/reviews/${s1.id}`, { admin: true, body: { decision: 'approve' } })).status, 409)
  assert.equal((await call('POST', `/admin/rewards/reviews/${s2.id}`, { admin: true, body: { decision: 'reject' } })).status, 400, 'rejection needs a reason')

  const [a, b] = await Promise.all([1, 2].map(() => call('POST', `/admin/rewards/reviews/${s2.id}`, { admin: true, body: { decision: 'approve', note: 'clean evaluation' } })))
  assert.deepEqual([a.status, b.status].sort(), [200, 409], 'concurrent approvals: exactly one wins')
  const fundedId = (a.status === 200 ? a : b).data.fundedChallengeId
  assert.equal((await pool.query('SELECT count(*)::int n FROM openfund_challenges WHERE funded_from_challenge_id=$1', [s2.id])).rows[0].n, 1)
  const funded = (await pool.query('SELECT c.*, d.balance FROM openfund_challenges c JOIN demo_accounts d ON d.id=c.demo_account_id WHERE c.id=$1', [fundedId])).rows[0]
  assert.equal(funded.status, 'started'); assert.equal(funded.stage, 0); assert.equal(Number(funded.balance), 10000)
  assert.equal(funded.rules_snapshot.funded, true); assert.equal(funded.rules_snapshot.profitSplitPct, 80)
  assert.ok(isFundedAccount(funded))
  const events = (await pool.query('SELECT kind FROM challenge_events WHERE challenge_id = ANY($1) ORDER BY id', [[s2.id, fundedId]])).rows.map(r => r.kind)
  assert.ok(events.includes('review_approved') && events.includes('funded_demo_activated') && events.includes('account_provisioned'))

  /* not yet eligible: no trades */
  const early = await call('POST', '/withdrawals', { user, body: { challengeId: fundedId } })
  assert.equal(early.status, 409); assert.equal(early.data.error, 'not_eligible')
  assert.equal((await call('POST', '/withdrawals', { user: other, body: { challengeId: fundedId } })).status, 404, 'other wallet cannot request')

  await trade(user, fundedId, [{ daysAgo: 20, net: 300 }, { daysAgo: 10, net: 200 }, { daysAgo: 2, net: 100 }])
  const status1 = await call('GET', '/rewards/status', { user })
  const elig = status1.data.funded.find(f => f.id === fundedId).eligibility.find(e => e.cycle === 'biweekly')
  assert.equal(elig.eligible, true, JSON.stringify(elig.checks)); assert.equal(elig.reward, '480.00')

  const req1 = await call('POST', '/withdrawals', { user, body: { challengeId: fundedId, amountUsd: 999999 } })
  assert.equal(req1.status, 200, JSON.stringify(req1.data)); assert.equal(req1.data.amountUsd, '480.00', 'client amount is ignored')
  const bal = async () => Number((await pool.query('SELECT balance FROM demo_accounts WHERE id=$1', [funded.demo_account_id])).rows[0].balance)
  assert.equal(await bal(), 10000, 'profit removed from the funded account')
  const dup = await call('POST', '/withdrawals', { user, body: { challengeId: fundedId } })
  assert.equal(dup.status, 409, 'one open reward request per account')

  const rej = await call('POST', `/admin/withdrawals/${req1.data.id}/review`, { admin: true, body: { action: 'reject', note: 'needs KYC review' } })
  assert.equal(rej.status, 200); assert.equal(await bal(), 10600, 'rejection re-credits the profit')

  /* a rejected request does not consume the cycle: the trader may request again */
  const req4 = await call('POST', '/withdrawals', { user, body: { challengeId: fundedId } })
  assert.equal(req4.status, 200, JSON.stringify(req4.data))
  assert.equal((await call('POST', `/admin/withdrawals/${req4.data.id}/review`, { admin: true, body: { action: 'paid', payoutRef: 'x' } })).status, 409)
  assert.equal((await call('POST', `/admin/withdrawals/${req4.data.id}/review`, { admin: true, body: { action: 'approve', note: 'ok' } })).status, 200)
  assert.equal((await call('POST', `/admin/withdrawals/${req4.data.id}/review`, { admin: true, body: { action: 'paid', payoutRef: 'manual-usdt-0001' } })).status, 200)
  const row = (await pool.query('SELECT * FROM withdrawal_requests WHERE id=$1', [req4.data.id])).rows[0]
  assert.equal(row.kind, 'reward'); assert.equal(row.status, 'paid'); assert.equal(row.payout_ref, 'manual-usdt-0001')
  assert.equal(row.amount_usd, '480.00'); assert.equal(row.gross_profit_usd, '600.00'); assert.equal(Number(row.split_pct), 80)
  const ledger = (await pool.query(`SELECT event, amount::numeric::text AS amount FROM trading_ledger WHERE account_id=$1 AND event LIKE 'reward%' ORDER BY id`, [funded.demo_account_id])).rows
  assert.deepEqual(ledger.map(l => [l.event, Number(l.amount)]), [['reward_withdrawal', -600], ['reward_reversal', 600], ['reward_withdrawal', -600]])

  /* the next cycle opens 14 days after this request */
  await trade(user, fundedId, [{ daysAgo: 0, net: 300 }])
  const next = await call('POST', '/withdrawals', { user, body: { challengeId: fundedId } })
  assert.equal(next.status, 409); assert.ok(next.data.checks.some(c => c.key === 'waiting_period'))
  const again = await call('POST', `/admin/rewards/reviews/${s2.id}`, { admin: true, body: { decision: 'reject', note: 'late' } })
  assert.equal(again.status, 409, 'a decided review is final')
})

test('E10 the fourth reward includes the challenge fee actually paid (lineage stage 2 → stage 1 → order)', async () => {
  const user = await newUser()
  const { s2 } = await finalPass(user, 'standard', 10000, 80)
  const { data } = await call('POST', `/admin/rewards/reviews/${s2.id}`, { admin: true, body: { decision: 'approve' } })
  const fundedId = data.fundedChallengeId
  await trade(user, fundedId, [{ daysAgo: 20, net: 500 }])
  for (let i = 0; i < 3; i++) {
    await pool.query(`INSERT INTO withdrawal_requests (user_id, challenge_id, amount_usd, status, kind, requested_at) VALUES ($1,$2,100,'paid','reward', now() - interval '60 days')`, [user, fundedId])
  }
  const r = await call('POST', '/withdrawals', { user, body: { challengeId: fundedId } })
  assert.equal(r.status, 200, JSON.stringify(r.data))
  assert.equal(r.data.feeRefund, '80.00'); assert.equal(r.data.reward, '400.00'); assert.equal(r.data.amountUsd, '480.00')
})

test('E11 a paid Instant account is a reward account; an evaluation in progress is not', async () => {
  const user = await newUser()
  const plan = plans.instant
  const order = (await pool.query(`INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, status, paid_at) VALUES ($1,$2,10000,88,'paid',now()) RETURNING id`, [user, plan.id])).rows[0]
  const { ChallengeService } = await import('../evaluation.js')
  const svc = new ChallengeService(pool)
  const c = (await pool.query(`INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, purchase_order_id, rules_snapshot) VALUES ($1,$2,'created',10000,$3,$4) RETURNING *`,
    [user, plan.id, order.id, JSON.stringify(normalizeRules(plan.configuration))])).rows[0]
  await svc.start(user, c.id)
  const started = (await pool.query('SELECT * FROM openfund_challenges WHERE id=$1', [c.id])).rows[0]
  assert.ok(isFundedAccount(started))
  const status = await call('GET', '/rewards/status', { user })
  const inst = status.data.funded.find(f => f.id === c.id)
  assert.deepEqual(inst.eligibility.map(e => e.cycle), ['biweekly'])
  const std = await finalPass(user)
  assert.ok(!isFundedAccount(std.s1) && !isFundedAccount(std.s2))
})
