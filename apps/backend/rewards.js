/**
 * Openfund — reward lifecycle after an evaluation (simulated accounts only).
 *
 *   final stage passed ──(operator review)──► approved → funded-demo account
 *                                          └► rejected (final, recorded)
 *   funded account (Instant or funded-demo) ──► eligible ──► reward request
 *        requested → approved → paid (manual payout reference)
 *                  └► rejected / cancelled (profit re-credited)
 *
 * RULES OF RECORD (Rulebook "payouts"; plan catalog; rules snapshot):
 *  - Rewards exist only on a funded simulated account: a paid Instant
 *    challenge (phases 0), or a funded-demo account created by an APPROVED review.
 *    Nothing here moves real funds; 'paid' records an operator reference.
 *  - The reward basis is the account's realized net profit (balance −
 *    starting size; fees included). The account must be flat (no open
 *    positions, no pending orders) so the basis is final.
 *  - First request: `firstPayoutDays` after the first funded fill.
 *    Later requests: one cycle after the previous request.
 *  - Bi-weekly cycle (14 days) pays `profitSplitPct`. Plans that publish
 *    `profitSplitMonthlyPct` also offer a monthly cycle (30 days) paying
 *    that share, conditional on the consistency score and profitable days.
 *    Plans without a monthly share (Instant) apply those conditions to
 *    every request.
 *  - Minimum request: realized profit ≥ `minPayoutPct` % of account size.
 *  - Consistency: best profitable day ≤ `consistencyPct` % of cycle profit.
 *  - Profitable days: ≥ `profitableDaysPer30` days with positive realized
 *    net PnL in the cycle (monthly: 7 per Rulebook).
 *  - `refundPolicy: 'fourth-reward'`: the challenge fee actually paid on
 *    the originating order is added to the fourth reward request.
 *  - The requested profit is removed from the funded account in the same
 *    transaction (ledger 'reward_withdrawal'); the daily-loss basis moves
 *    down by the same amount (loss already used today is preserved) and
 *    trailing drawdown restarts from the new balance. A rejected or
 *    cancelled request re-credits it ('reward_reversal').
 * All money is Decimal; every transition runs under row locks and is
 * idempotent; duplicates are refused by database constraints.
 */
import { Router } from 'express'
import { D } from './trading-math.js'
import { ChallengeService, normalizeRules, DAY_UTC3_OFFSET_MS } from './evaluation.js'
import { adminAuth, adminActor } from './admin.js'

export const CYCLES = { biweekly: 14, monthly: 30 }
const DAY_MS = 86_400_000
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const fail = (status, error, extra) => Object.assign(new Error(error), { status, extra })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const num = v => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)

/** Payout terms of a challenge: its own snapshot (v2+), else the plan row (flagged). */
export function payoutTerms(snapshot, planConfiguration) {
  const own = snapshot && Number(snapshot.rulesVersion) >= 2
  const src = own ? snapshot : { ...normalizeRules(planConfiguration || {}), ...pickSnapshotEvaluation(snapshot) }
  return {
    source: own ? 'rules_snapshot' : 'plan_configuration',
    profitSplitPct: num(src.profitSplitPct) ?? 0,
    profitSplitMonthlyPct: num(src.profitSplitMonthlyPct),
    payoutCapPct: num(src.payoutCapPct) ?? 0,
    firstPayoutDays: num(src.firstPayoutDays) ?? 0,
    minPayoutPct: num(src.minPayoutPct) ?? 0,
    consistencyPct: num(src.consistencyPct),
    profitableDaysPer30: num(src.profitableDaysPer30),
    refundPolicy: src.refundPolicy || 'none',
    free: !!src.free,
  }
}
/* evaluation terms the v1 snapshot already froze win over the live plan row */
const pickSnapshotEvaluation = s => (s ? Object.fromEntries(['consistencyPct', 'profitableDaysPer30', 'profitSplitPct', 'free'].filter(k => s[k] !== undefined && s[k] !== null).map(k => [k, s[k]])) : {})

/**
 * Pure eligibility decision. Every check is reported (ok + detail) so the
 * customer sees exactly what is missing and the operator sees what passed.
 */
export function evaluateRewardEligibility({ terms, cycle = 'biweekly', startingBalance, balance, openPositions = 0, pendingOrders = 0,
  firstFillAt = null, lastRequestAt = null, dailyNet = [], priorRewards = 0, feePaidUsd = null, now = Date.now() }) {
  const checks = []
  const add = (key, ok, detail = {}) => checks.push({ key, ok: !!ok, ...detail })
  const starting = D(startingBalance)
  const profit = D(balance).minus(starting)
  const monthlyOffered = terms.profitSplitMonthlyPct != null && terms.profitSplitMonthlyPct > 0
  if (!CYCLES[cycle] || (cycle === 'monthly' && !monthlyOffered)) add('cycle', false, { cycle })
  add('reward_plan', !terms.free && terms.profitSplitPct > 0)
  add('flat_account', openPositions === 0 && pendingOrders === 0, { openPositions, pendingOrders })
  add('profit', profit.gt(0), { profit: profit.toFixed(2) })
  const minimum = starting.times(D(terms.minPayoutPct || 0)).div(100)
  add('minimum_request', profit.gte(minimum) && profit.gt(0), { minimum: minimum.toFixed(2) })
  /* waiting period: first request after the first funded fill; later ones one cycle after the previous */
  const waitDays = lastRequestAt ? CYCLES[cycle] || CYCLES.biweekly : Math.max(terms.firstPayoutDays || 0, cycle === 'monthly' ? CYCLES.monthly : 0)
  const anchor = lastRequestAt ?? firstFillAt
  const opensAt = anchor ? new Date(new Date(anchor).getTime() + waitDays * DAY_MS) : null
  add('waiting_period', !!opensAt && opensAt.getTime() <= now, { days: waitDays, opensAt: opensAt?.toISOString() ?? null, from: lastRequestAt ? 'previous_request' : 'first_funded_trade' })
  /* consistency + profitable days: monthly cycle, or every request when no monthly share exists */
  const conditional = cycle === 'monthly' || !monthlyOffered
  const days = dailyNet.map(d => ({ day: d.day, net: D(d.net) }))
  if (conditional && terms.consistencyPct != null && terms.consistencyPct > 0) {
    const best = days.reduce((m, d) => (d.net.gt(m) ? d.net : m), D(0))
    const share = profit.gt(0) ? best.div(profit).times(100) : D(100)
    add('consistency', profit.gt(0) && share.lte(terms.consistencyPct), { bestDay: best.toFixed(2), sharePct: share.toFixed(2), limitPct: terms.consistencyPct })
  }
  const neededDays = cycle === 'monthly' ? (terms.profitableDaysPer30 ?? 7) : terms.profitableDaysPer30
  if (conditional && neededDays) {
    const positive = days.filter(d => d.net.gt(0)).length
    add('profitable_days', positive >= neededDays, { count: positive, required: neededDays })
  }
  const split = cycle === 'monthly' ? terms.profitSplitMonthlyPct : terms.profitSplitPct
  let reward = profit.gt(0) ? profit.times(D(split || 0)).div(100) : D(0)
  if (terms.payoutCapPct > 0) {
    const cap = starting.times(D(terms.payoutCapPct)).div(100)
    if (reward.gt(cap)) reward = cap
  }
  const feeRefund = terms.refundPolicy === 'fourth-reward' && priorRewards === 3 && feePaidUsd != null && D(feePaidUsd).gt(0) ? D(feePaidUsd) : D(0)
  return {
    eligible: checks.every(c => c.ok), cycle, checks, splitPct: split ?? 0,
    grossProfit: profit.toFixed(2), reward: reward.toDecimalPlaces(2, 1).toFixed(2), feeRefund: feeRefund.toFixed(2),
    feeRefundPending: terms.refundPolicy === 'fourth-reward' && priorRewards === 3 && feePaidUsd == null,
    termsSource: terms.source,
  }
}

/** Is this challenge a funded simulated account that can earn rewards? */
export const isFundedAccount = c => !!c && c.status === 'started' && !c.rules_snapshot?.free
  && (!!c.funded_from_challenge_id || (Number(c.rules_snapshot?.phases ?? -1) === 0 && !!c.purchase_order_id))

/** UTC+3 day realized net (closes, liquidations and fees) since `since`. */
async function dailyNetSince(client, accountId, since) {
  const { rows } = await client.query(
    `SELECT to_char(ts AT TIME ZONE 'UTC' + make_interval(secs => $3), 'YYYY-MM-DD') AS day, sum(amount)::text AS net
       FROM trading_ledger
      WHERE account_id = $1 AND event IN ('close', 'liquidation', 'open_fee') AND ($2::timestamptz IS NULL OR ts > $2)
      GROUP BY 1 ORDER BY 1`, [accountId, since, DAY_UTC3_OFFSET_MS / 1000])
  return rows
}

/** Originating purchase order of a challenge lineage (stage 2 / funded → stage 1). */
async function originOrder(client, challenge) {
  let cur = challenge
  for (let hop = 0; cur && hop < 4; hop++) {
    if (cur.purchase_order_id) {
      return (await client.query(`SELECT id, price_usd, status, coupon_id FROM purchase_orders WHERE id=$1`, [cur.purchase_order_id])).rows[0] || null
    }
    if (!cur.parent_challenge_id) return null
    cur = (await client.query('SELECT id, purchase_order_id, parent_challenge_id FROM openfund_challenges WHERE id=$1', [cur.parent_challenge_id])).rows[0]
  }
  return null
}

/** Gather everything the eligibility decision needs (inside a transaction). */
export async function rewardContext(client, challenge, { lock = false } = {}) {
  const acc = (await client.query(`SELECT * FROM demo_accounts WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`, [challenge.demo_account_id])).rows[0]
  if (!acc) throw fail(409, 'account_not_provisioned')
  const plan = (await client.query('SELECT configuration FROM challenge_plans WHERE id=$1', [challenge.challenge_plan_id])).rows[0]
  const terms = payoutTerms(challenge.rules_snapshot, plan?.configuration)
  const [{ open }] = (await client.query(`SELECT count(*)::int AS open FROM trading_positions WHERE account_id=$1 AND status='open'`, [acc.id])).rows
  const [{ pending }] = (await client.query(`SELECT count(*)::int AS pending FROM trading_orders WHERE account_id=$1 AND status='pending'`, [acc.id])).rows
  const firstFillAt = (await client.query(`SELECT min(opened_at) AS t FROM trading_positions WHERE account_id=$1 AND parent_position_id IS NULL`, [acc.id])).rows[0].t
  const prior = (await client.query(
    `SELECT count(*) FILTER (WHERE status IN ('requested','approved','paid'))::int AS n,
            max(requested_at) FILTER (WHERE status IN ('requested','approved','paid')) AS last
       FROM withdrawal_requests WHERE challenge_id=$1 AND kind='reward'`, [challenge.id])).rows[0]
  const order = terms.refundPolicy === 'fourth-reward' ? await originOrder(client, challenge) : null
  const dailyNet = await dailyNetSince(client, acc.id, prior.last)
  return { acc, terms, openPositions: open, pendingOrders: pending, firstFillAt, lastRequestAt: prior.last, priorRewards: prior.n, dailyNet,
    feePaidUsd: order && order.status === 'paid' ? order.price_usd : null }
}

/** Move the day basis and trailing state with a balance change of `delta`. */
async function shiftRiskBasis(client, challenge, newBalance, delta) {
  const today = new Date(Date.now() + DAY_UTC3_OFFSET_MS).toISOString().slice(0, 10)
  await client.query(
    `UPDATE challenge_equity_days SET day_start_balance = day_start_balance + $3, day_start_equity = day_start_equity + $3,
            basis = basis + $3, peak_equity = peak_equity + $3, last_equity = last_equity + $3, updated_at = now()
      WHERE challenge_id=$1 AND day=$2`, [challenge.id, today, delta.toFixed(10)])
  if ((challenge.rules_snapshot?.drawdownMode ?? 'static') === 'trailing' && delta.lt(0)) {
    const pct = D(challenge.rules_snapshot.maxTotalLossPct || 0).div(100)
    await client.query(
      `UPDATE challenge_trailing SET peak_equity=$2, trailing_floor=$3, locked_breakeven=false, updated_at=now() WHERE challenge_id=$1`,
      [challenge.id, D(newBalance).toFixed(10), D(newBalance).times(D(1).minus(pct)).toFixed(10)])
  }
}

async function adjustBalance(client, challenge, acc, delta, event, meta) {
  const next = D(acc.balance).plus(delta)
  await client.query('UPDATE demo_accounts SET balance=$2, updated_at=now() WHERE id=$1', [acc.id, next.toFixed(10)])
  await client.query(
    `INSERT INTO trading_ledger (account_id, user_id, event, amount, balance_after, meta) VALUES ($1,$2,$3,$4,$5,$6)`,
    [acc.id, acc.user_id, event, delta.toFixed(10), next.toFixed(10), JSON.stringify(meta)])
  await shiftRiskBasis(client, challenge, next, delta)
  return next
}

/** Re-credit the profit of a rejected / cancelled reward request (inside a transaction). */
export async function reverseRewardTx(client, w, reason) {
  if (w.kind !== 'reward' || !w.gross_profit_usd) return
  const challenge = (await client.query('SELECT * FROM openfund_challenges WHERE id=$1 FOR UPDATE', [w.challenge_id])).rows[0]
  const acc = challenge && (await client.query('SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE', [challenge.demo_account_id])).rows[0]
  if (!acc) return
  await adjustBalance(client, challenge, acc, D(w.gross_profit_usd), 'reward_reversal', { withdrawalId: w.id, reason })
  await ChallengeService.event(client, challenge.id, 'reward_reversed', { withdrawalId: w.id, amount: w.gross_profit_usd, reason })
}

const challengeView = (c, extra = {}) => ({ id: c.id, planSlug: c.plan_slug, planName: c.plan_name, stage: c.stage, status: c.status,
  accountSizeUsd: c.account_size_usd, fundedFrom: c.funded_from_challenge_id || null, startedAt: c.started_at, ...extra })

/** Customer routes: reward status and requests (replace the free-amount withdrawal form). */
export function rewardRoutes({ pool, requireAuth, audit = async () => {}, limit = () => (req, res, next) => next() }) {
  const router = Router()
  const ownChallenges = userId => pool.query(
    `SELECT c.*, p.slug AS plan_slug, p.name AS plan_name, r.decision AS review_decision, r.decided_at AS review_decided_at, r.note AS review_note
       FROM openfund_challenges c JOIN challenge_plans p ON p.id=c.challenge_plan_id
       LEFT JOIN challenge_reviews r ON r.challenge_id=c.id
      WHERE c.user_id=$1 ORDER BY c.created_at DESC LIMIT 100`, [userId])

  router.get('/rewards/status', requireAuth, wrap(async (req, res) => {
    const { rows } = await ownChallenges(req.user.user_id)
    const reviews = rows.filter(c => c.status === 'passed' && c.stage >= 1 && c.stage === Number(c.rules_snapshot?.phases ?? 0) && !c.rules_snapshot?.free)
      .map(c => challengeView(c, { review: c.review_decision || 'under_review', decidedAt: c.review_decided_at, note: c.review_decision === 'rejected' ? c.review_note : null,
        fundedChallengeId: rows.find(f => f.funded_from_challenge_id === c.id)?.id || null }))
    const client = await pool.connect()
    try {
      const funded = []
      for (const c of rows.filter(isFundedAccount)) {
        const ctx = await rewardContext(client, c)
        const forCycle = cycle => evaluateRewardEligibility({ ...ctx, terms: ctx.terms, cycle, startingBalance: c.account_size_usd, balance: ctx.acc.balance })
        const cycles = ctx.terms.profitSplitMonthlyPct ? ['biweekly', 'monthly'] : ['biweekly']
        funded.push(challengeView(c, { balance: D(ctx.acc.balance).toFixed(2), eligibility: cycles.map(forCycle) }))
      }
      res.set('Cache-Control', 'no-store').json({ reviews, funded })
    } finally { client.release() }
  }))

  router.post('/withdrawals', requireAuth, limit(10), wrap(async (req, res) => {
    const { challengeId, cycle = 'biweekly', note } = req.body || {}
    if (!challengeId) throw fail(400, 'reward_account_required')
    if (!uuid.test(challengeId)) throw fail(400, 'invalid_challenge')
    if (!CYCLES[cycle]) throw fail(400, 'invalid_cycle')
    if (note != null && (typeof note !== 'string' || note.length > 500)) throw fail(400, 'invalid_note')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const c = (await client.query('SELECT * FROM openfund_challenges WHERE id=$1 AND user_id=$2 FOR UPDATE', [challengeId, req.user.user_id])).rows[0]
      if (!c) throw fail(404, 'challenge_not_found')
      if (!isFundedAccount(c)) throw fail(409, 'not_a_funded_account')
      const ctx = await rewardContext(client, c, { lock: true })
      const decision = evaluateRewardEligibility({ ...ctx, cycle, startingBalance: c.account_size_usd, balance: ctx.acc.balance })
      if (!decision.eligible) throw fail(409, 'not_eligible', { checks: decision.checks.filter(x => !x.ok) })
      const amount = D(decision.reward).plus(decision.feeRefund)
      const { rows: [w] } = await client.query(
        `INSERT INTO withdrawal_requests (user_id, challenge_id, amount_usd, note, kind, reward_cycle, gross_profit_usd, split_pct, fee_refund_usd, eligibility)
         VALUES ($1,$2,$3,$4,'reward',$5,$6,$7,$8,$9) RETURNING id, requested_at`,
        [req.user.user_id, c.id, amount.toFixed(2), note || null, cycle, decision.grossProfit, decision.splitPct, decision.feeRefund, JSON.stringify(decision)])
      await adjustBalance(client, c, ctx.acc, D(decision.grossProfit).negated(), 'reward_withdrawal', { withdrawalId: w.id, cycle, splitPct: decision.splitPct })
      await ChallengeService.event(client, c.id, 'reward_requested', { withdrawalId: w.id, grossProfit: decision.grossProfit, reward: decision.reward, feeRefund: decision.feeRefund, cycle })
      await client.query('COMMIT')
      await audit('withdrawal_requested', req.user.user_id, req, { withdrawalId: w.id, amount: amount.toFixed(2), kind: 'reward' })
      res.json({ id: w.id, requestedAt: w.requested_at, status: 'requested', amountUsd: amount.toFixed(2), reward: decision.reward, feeRefund: decision.feeRefund, grossProfit: decision.grossProfit })
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      if (e.code === '23505') throw fail(409, 'reward_request_open')
      throw e
    } finally { client.release() }
  }))

  router.post('/withdrawals/:id/cancel', requireAuth, wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'withdrawal_not_found')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const w = (await client.query(`SELECT * FROM withdrawal_requests WHERE id=$1 AND user_id=$2 FOR UPDATE`, [req.params.id, req.user.user_id])).rows[0]
      if (!w || w.status !== 'requested') throw fail(409, 'withdrawal_not_cancellable')
      await client.query(`UPDATE withdrawal_requests SET status='cancelled', reviewed_at=now() WHERE id=$1`, [w.id])
      await reverseRewardTx(client, w, 'cancelled_by_customer')
      await client.query('COMMIT')
      await audit('withdrawal_cancelled', req.user.user_id, req, { withdrawalId: w.id })
      res.json({ ok: true })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))

  router.use(['/withdrawals', '/rewards'], (err, req, res, next) => {
    if (!err?.status || err.status >= 500) return next(err)
    res.status(err.status).json({ error: err.message, ...(err.extra || {}) })
  })
  return router
}

/** Operator routes: final-pass reviews and the funded-demo transition. */
export function rewardAdminRoutes({ pool, challenges = new ChallengeService(pool) }) {
  const router = Router()
  router.use(adminAuth)
  router.get('/reviews', wrap(async (req, res) => {
    const pendingOnly = req.query.status !== 'all'
    const { rows } = await pool.query(
      `SELECT c.id, c.user_id, u.wallet_address, p.slug AS plan_slug, c.stage, c.account_size_usd, c.completed_at,
              r.decision, r.actor, r.decided_at, r.funded_challenge_id,
              (SELECT detail FROM challenge_events e WHERE e.challenge_id=c.id AND e.kind='passed' ORDER BY id DESC LIMIT 1) AS pass_event
         FROM openfund_challenges c JOIN challenge_plans p ON p.id=c.challenge_plan_id JOIN openfund_users u ON u.id=c.user_id
         LEFT JOIN challenge_reviews r ON r.challenge_id=c.id
        WHERE c.status='passed' AND c.stage >= 1 AND c.stage = coalesce((c.rules_snapshot->>'phases')::int, 0)
          AND NOT coalesce((c.rules_snapshot->>'free')::boolean, false) ${pendingOnly ? 'AND r.challenge_id IS NULL' : ''}
        ORDER BY c.completed_at DESC LIMIT 200`)
    res.set('Cache-Control', 'no-store').json({ reviews: rows })
  }))
  router.post('/reviews/:challengeId', wrap(async (req, res) => {
    if (!uuid.test(req.params.challengeId)) throw fail(404, 'challenge_not_found')
    const actor = adminActor(req)
    const { decision, note } = req.body || {}
    if (!['approve', 'reject'].includes(decision)) throw fail(400, 'invalid_decision')
    if (note != null && (typeof note !== 'string' || note.length > 1000)) throw fail(400, 'invalid_note')
    if (decision === 'reject' && !note?.trim()) throw fail(400, 'reason_required')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const c = (await client.query('SELECT * FROM openfund_challenges WHERE id=$1 FOR UPDATE', [req.params.challengeId])).rows[0]
      if (!c) throw fail(404, 'challenge_not_found')
      const phases = Number(c.rules_snapshot?.phases ?? 0)
      if (c.status !== 'passed' || c.stage < 1 || c.stage !== phases) throw fail(409, 'not_a_final_pass')
      if (c.rules_snapshot?.free) throw fail(409, 'trial_not_fundable')
      const existing = (await client.query('SELECT * FROM challenge_reviews WHERE challenge_id=$1', [c.id])).rows[0]
      if (existing) throw fail(409, `already_${existing.decision}`)
      let funded = null
      if (decision === 'approve') {
        /* funded-demo account: same purchased size and frozen terms, reset to the
           starting virtual balance, stage 0 (loss limits, no target) */
        const snapshot = { ...c.rules_snapshot, funded: true }
        funded = (await client.query(
          `INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, stage, rules_snapshot, parent_challenge_id, funded_from_challenge_id)
           VALUES ($1,$2,'created',$3,0,$4,$5,$5) RETURNING *`,
          [c.user_id, c.challenge_plan_id, c.account_size_usd, JSON.stringify(snapshot), c.id])).rows[0]
        funded = await challenges.startTx(client, funded)
        await ChallengeService.event(client, funded.id, 'funded_demo_activated', { fromChallengeId: c.id, startingBalance: D(c.account_size_usd).toFixed(2), actor })
      }
      await client.query(`INSERT INTO challenge_reviews (challenge_id, decision, actor, note, funded_challenge_id) VALUES ($1,$2,$3,$4,$5)`,
        [c.id, decision === 'approve' ? 'approved' : 'rejected', actor, note?.trim() || null, funded?.id ?? null])
      await ChallengeService.event(client, c.id, decision === 'approve' ? 'review_approved' : 'review_rejected', { actor, note: note?.trim() || null, fundedChallengeId: funded?.id ?? null })
      await client.query('COMMIT')
      res.json({ ok: true, decision: decision === 'approve' ? 'approved' : 'rejected', fundedChallengeId: funded?.id ?? null })
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      if (e.code === '23505') throw fail(409, 'already_reviewed')
      throw e
    } finally { client.release() }
  }))
  router.use((err, req, res, next) => {
    if (!err?.status || err.status >= 500) return next(err)
    res.status(err.status).json({ error: err.message })
  })
  return router
}
