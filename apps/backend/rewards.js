/**
 * Openfund — reward lifecycle after an evaluation (simulated accounts only).
 *
 *   final stage passed ──(operator review)──► approved → funded-demo account
 *                                          └► rejected (final, recorded)
 *   funded-demo account ──(trader picks the reward cycle once)──► active
 *   funded account (Instant or funded-demo) ──► eligible ──► reward request
 *        requested → approved → paid (manual payout reference)
 *                  └► rejected / cancelled (profit re-credited)
 *   4th paid reward of a Standard lineage ──► fee refund (exactly once)
 *
 * RULES OF RECORD
 *  Rules snapshot v3 (owner decisions D1–D8, catalog v3):
 *  - Reward cycles per model (catalog `rewardCycles`): Standard weekly 60% /
 *    bi-weekly 80% / on-demand 100%; One-step bi-weekly 80% / on-demand 100%;
 *    Instant bi-weekly 95%. The trader selects one cycle ONCE, before the
 *    funded-demo account starts (openfund_challenges.reward_cycle, immutable
 *    by trigger). A model with a single cycle uses it automatically.
 *  - Timed cycles: first request `firstAfterDays` after the first funded
 *    trade, then every `everyDays` after the previous request.
 *  - On-demand: no waiting period; consistency score (best winning day ≤ 35%
 *    of cycle profit), 7 profitable days of ≥ 0.5% of the account size, and
 *    the strike system (2 strikes halve the split, 3 → 20%, 4 = breach).
 *  - Instant: 15% consistency on every request (profitable days are a hard
 *    rule, enforced by the engine — conduct.js).
 *  - Minimum request: realized profit ≥ `minPayoutPct` % of the size.
 *  - Funded Standard/One-step news rule: profit of a trade opened or closed
 *    inside a restricted window (unless opened ≥ 5 h before) is not paid.
 *    It needs verified calendar coverage for the cycle; without it the
 *    request is not eligible (never computed from incomplete data).
 *  - Profit of a trade idea that received a strike is not paid.
 *  Snapshots v1/v2 keep the terms they were sold with (bi-weekly / monthly
 *  per request, see `legacyEligibility`).
 *
 *  - The reward basis is realized net profit (balance − starting size); the
 *    account must be flat. The requested profit is removed in the same
 *    transaction; the day's loss basis moves down by the same amount;
 *    rejection or cancellation re-credits it. One open request per account.
 *  - D5: when the FOURTH reward of a lineage whose snapshot says
 *    `refundPolicy: 'fourth-reward'` is marked paid, a fee refund equal to the
 *    price actually paid on the originating order is created (unique per
 *    order and per withdrawal) and paid out manually with its own reference.
 * All money is Decimal; every transition runs under row locks.
 */
import { Router } from 'express'
import { D } from './trading-math.js'
import { ChallengeService, normalizeRules, DAY_UTC3_OFFSET_MS } from './evaluation.js'
import { adminAuth, adminActor } from './admin.js'
import { strikeAdjustedSplit, tradeIdeas, newsDeductions } from './model-rules.js'
import { calendarCovered, restrictedEvents, positionNets, isFundedStage } from './conduct.js'

export const LEGACY_CYCLES = { biweekly: 14, monthly: 30 }
const DAY_MS = 86_400_000
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const fail = (status, error, extra) => Object.assign(new Error(error), { status, extra })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const num = v => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const isV3 = snap => Number(snap?.rulesVersion) >= 3

/** Payout terms of a v1/v2 challenge: its own snapshot (v2), else the plan row (flagged). */
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
const pickSnapshotEvaluation = s => (s ? Object.fromEntries(['consistencyPct', 'profitableDaysPer30', 'profitSplitPct', 'free'].filter(k => s[k] !== undefined && s[k] !== null).map(k => [k, s[k]])) : {})

const checker = () => { const checks = []; return { checks, add: (key, ok, detail = {}) => checks.push({ key, ok: !!ok, ...detail }) } }
const bestWinningDay = days => days.reduce((m, d) => (D(d.net).gt(m) ? D(d.net) : m), D(0))

/**
 * v1/v2 eligibility (terms sold before catalog v3): bi-weekly at the plan split,
 * or a monthly cycle where the plan offered one. Kept unchanged for those accounts.
 */
export function legacyEligibility({ terms, cycle = 'biweekly', startingBalance, balance, openPositions = 0, pendingOrders = 0,
  firstFillAt = null, lastRequestAt = null, dailyNet = [], now = Date.now() }) {
  const { checks, add } = checker()
  const starting = D(startingBalance), profit = D(balance).minus(starting)
  const monthlyOffered = terms.profitSplitMonthlyPct != null && terms.profitSplitMonthlyPct > 0
  if (!LEGACY_CYCLES[cycle] || (cycle === 'monthly' && !monthlyOffered)) add('cycle', false, { cycle })
  add('reward_plan', !terms.free && terms.profitSplitPct > 0)
  add('flat_account', openPositions === 0 && pendingOrders === 0, { openPositions, pendingOrders })
  add('profit', profit.gt(0), { profit: profit.toFixed(2) })
  const minimum = starting.times(D(terms.minPayoutPct || 0)).div(100)
  add('minimum_request', profit.gte(minimum) && profit.gt(0), { minimum: minimum.toFixed(2) })
  const waitDays = lastRequestAt ? LEGACY_CYCLES[cycle] || LEGACY_CYCLES.biweekly : Math.max(terms.firstPayoutDays || 0, cycle === 'monthly' ? LEGACY_CYCLES.monthly : 0)
  const anchor = lastRequestAt ?? firstFillAt
  const opensAt = anchor ? new Date(new Date(anchor).getTime() + waitDays * DAY_MS) : null
  add('waiting_period', !!opensAt && opensAt.getTime() <= now, { days: waitDays, opensAt: opensAt?.toISOString() ?? null, from: lastRequestAt ? 'previous_request' : 'first_funded_trade' })
  const conditional = cycle === 'monthly' || !monthlyOffered
  if (conditional && terms.consistencyPct > 0) {
    const best = bestWinningDay(dailyNet), share = profit.gt(0) ? best.div(profit).times(100) : D(100)
    add('consistency', profit.gt(0) && share.lte(terms.consistencyPct), { bestDay: best.toFixed(2), sharePct: share.toFixed(2), limitPct: terms.consistencyPct })
  }
  const neededDays = cycle === 'monthly' ? (terms.profitableDaysPer30 ?? 7) : terms.profitableDaysPer30
  if (conditional && neededDays) {
    const positive = dailyNet.filter(d => D(d.net).gt(0)).length
    add('profitable_days', positive >= neededDays, { count: positive, required: neededDays })
  }
  const split = cycle === 'monthly' ? terms.profitSplitMonthlyPct : terms.profitSplitPct
  let reward = profit.gt(0) ? profit.times(D(split || 0)).div(100) : D(0)
  if (terms.payoutCapPct > 0) { const cap = starting.times(D(terms.payoutCapPct)).div(100); if (reward.gt(cap)) reward = cap }
  return { eligible: checks.every(c => c.ok), cycle, checks, splitPct: split ?? 0, grossProfit: profit.toFixed(2),
    reward: reward.toDecimalPlaces(2, 1).toFixed(2), deductions: [], termsSource: terms.source }
}

/**
 * v3 eligibility for the account's selected cycle (pure).
 * deductions: [{ kind:'news'|'strike', amount }] — profit not paid.
 */
export function cycleEligibility({ rules, cycleKey, startingBalance, balance, openPositions = 0, pendingOrders = 0, firstFillAt = null,
  lastRequestAt = null, dailyNet = [], strikes = 0, deductions = [], newsVerified = true, now = Date.now() }) {
  const { checks, add } = checker()
  const cycle = (rules.rewardCycles || []).find(c => c.key === cycleKey)
  const starting = D(startingBalance), profit = D(balance).minus(starting)
  add('reward_cycle_selected', !!cycle, { cycle: cycleKey ?? null })
  add('reward_plan', !rules.free && !!cycle)
  add('flat_account', openPositions === 0 && pendingOrders === 0, { openPositions, pendingOrders })
  add('profit', profit.gt(0), { profit: profit.toFixed(2) })
  const minimum = starting.times(D(rules.minPayoutPct || 0)).div(100)
  add('minimum_request', profit.gte(minimum) && profit.gt(0), { minimum: minimum.toFixed(2) })
  if (cycle?.firstAfterDays != null) {
    const waitDays = lastRequestAt ? cycle.everyDays : cycle.firstAfterDays
    const anchor = lastRequestAt ?? firstFillAt
    const opensAt = anchor ? new Date(new Date(anchor).getTime() + waitDays * DAY_MS) : null
    add('waiting_period', !!opensAt && opensAt.getTime() <= now, { days: waitDays, opensAt: opensAt?.toISOString() ?? null, from: lastRequestAt ? 'previous_request' : 'first_funded_trade' })
  }
  if (cycle?.consistencyPct) {
    const best = bestWinningDay(dailyNet), share = profit.gt(0) ? best.div(profit).times(100) : D(100)
    add('consistency', profit.gt(0) && share.lte(cycle.consistencyPct), { bestDay: best.toFixed(2), sharePct: share.toFixed(2), limitPct: cycle.consistencyPct })
  }
  if (cycle?.profitableDays) {
    const min = starting.times(D(cycle.profitableDayPct ?? 0)).div(100)
    const count = dailyNet.filter(d => D(d.net).gt(0) && D(d.net).gte(min)).length
    add('profitable_days', count >= cycle.profitableDays, { count, required: cycle.profitableDays, minPerDay: min.toFixed(2) })
  }
  if (cycle?.strikeLossPct) add('strikes', strikes < 4, { strikes })
  if (rules.conduct?.news?.mode === 'deduct' && isFundedStage(rules)) add('news_calendar_verified', newsVerified)
  const split = cycle ? strikeAdjustedSplit(cycle.splitPct, cycle.strikeLossPct ? strikes : 0) : 0
  const deducted = deductions.reduce((s, d) => s.plus(D(d.amount)), D(0))
  const basis = profit.minus(deducted)
  let reward = basis.gt(0) ? basis.times(D(split)).div(100) : D(0)
  if (rules.payoutCapPct > 0) { const cap = starting.times(D(rules.payoutCapPct)).div(100); if (reward.gt(cap)) reward = cap }
  return { eligible: checks.every(c => c.ok), cycle: cycleKey ?? null, checks, splitPct: split, grossProfit: profit.toFixed(2),
    deducted: deducted.toFixed(2), deductions, reward: reward.toDecimalPlaces(2, 1).toFixed(2), termsSource: 'rules_snapshot' }
}

/** Is this challenge a funded simulated account that can earn rewards? */
export const isFundedAccount = c => !!c && c.status === 'started' && !c.rules_snapshot?.free
  && (!!c.funded_from_challenge_id || (Number(c.rules_snapshot?.phases ?? -1) === 0 && !!c.purchase_order_id))
/** Effective cycle: the stored choice, or the only cycle a model offers. */
export const effectiveCycle = c => c.reward_cycle ?? ((c.rules_snapshot?.rewardCycles || []).length === 1 ? c.rules_snapshot.rewardCycles[0].key : null)

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
export async function originOrder(client, challenge) {
  let cur = challenge
  for (let hop = 0; cur && hop < 4; hop++) {
    if (cur.purchase_order_id) {
      return (await client.query(`SELECT id, price_usd, status, payment_method FROM purchase_orders WHERE id=$1`, [cur.purchase_order_id])).rows[0] || null
    }
    if (!cur.parent_challenge_id) return null
    cur = (await client.query('SELECT id, purchase_order_id, parent_challenge_id FROM openfund_challenges WHERE id=$1', [cur.parent_challenge_id])).rows[0]
  }
  return null
}

/** Everything the eligibility decision needs (inside a transaction). */
export async function rewardContext(client, challenge, md, { lock = false, now = Date.now() } = {}) {
  const acc = (await client.query(`SELECT * FROM demo_accounts WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`, [challenge.demo_account_id])).rows[0]
  if (!acc) throw fail(409, 'account_not_provisioned')
  const [{ open }] = (await client.query(`SELECT count(*)::int AS open FROM trading_positions WHERE account_id=$1 AND status='open'`, [acc.id])).rows
  const [{ pending }] = (await client.query(`SELECT count(*)::int AS pending FROM trading_orders WHERE account_id=$1 AND status='pending'`, [acc.id])).rows
  const firstFillAt = (await client.query(`SELECT min(opened_at) AS t FROM trading_positions WHERE account_id=$1 AND parent_position_id IS NULL`, [acc.id])).rows[0].t
  const prior = (await client.query(
    `SELECT max(requested_at) FILTER (WHERE status IN ('requested','approved','paid')) AS last
       FROM withdrawal_requests WHERE challenge_id=$1 AND kind='reward'`, [challenge.id])).rows[0]
  const dailyNet = await dailyNetSince(client, acc.id, prior.last)
  const base = { acc, openPositions: open, pendingOrders: pending, firstFillAt, lastRequestAt: prior.last, dailyNet, startingBalance: challenge.account_size_usd, balance: acc.balance, now }
  if (!isV3(challenge.rules_snapshot)) {
    const plan = (await client.query('SELECT configuration FROM challenge_plans WHERE id=$1', [challenge.challenge_plan_id])).rows[0]
    return { ...base, legacy: true, terms: payoutTerms(challenge.rules_snapshot, plan?.configuration) }
  }
  const rules = challenge.rules_snapshot
  const cycleKey = effectiveCycle(challenge)
  const cycle = (rules.rewardCycles || []).find(c => c.key === cycleKey)
  /* positions closed in this reward cycle (after the previous request) */
  const since = prior.last ?? challenge.started_at
  const positions = (await positionNets(client, acc.id, md, null, { closedOnly: true }))
    .filter(p => p.closed_at && new Date(p.closed_at) > new Date(since))
  const deductions = []
  let newsVerified = true
  if (rules.conduct?.news?.mode === 'deduct' && isFundedStage(rules) && positions.length) {
    const from = Math.min(...positions.map(p => new Date(p.opened_at).getTime())) - 6 * 3_600_000
    newsVerified = await calendarCovered(client, from, now)
    if (newsVerified) {
      const events = await restrictedEvents(client, from, now)
      for (const d of newsDeductions(positions, events, rules.conduct.news)) deductions.push({ kind: 'news', ...d })
    }
  }
  let strikes = 0
  if (cycle?.strikeLossPct) {
    const rows = (await client.query('SELECT idea_key FROM challenge_strikes WHERE challenge_id=$1', [challenge.id])).rows
    strikes = rows.length
    if (strikes) {
      const keys = new Set(rows.map(r => r.idea_key))
      const all = await positionNets(client, acc.id, md, challenge.started_at, { closedOnly: true })
      const inCycle = new Set(positions.map(p => p.id))
      for (const idea of tradeIdeas(all)) {
        if (!keys.has(idea.key)) continue
        const paid = all.filter(p => idea.members.includes(p.id) && inCycle.has(p.id) && D(p.net).gt(0)).reduce((s, p) => s.plus(D(p.net)), D(0))
        if (paid.gt(0)) deductions.push({ kind: 'strike', idea: idea.key, amount: paid.toFixed(2) })
      }
    }
  }
  return { ...base, legacy: false, rules, cycleKey, strikes, deductions, newsVerified }
}

const decide = ctx => ctx.legacy ? legacyEligibility({ ...ctx, cycle: ctx.cycle }) : cycleEligibility(ctx)

/** Move the day basis and trailing state with a balance change of `delta`. */
async function shiftRiskBasis(client, challenge, newBalance, delta) {
  const today = new Date(Date.now() + DAY_UTC3_OFFSET_MS).toISOString().slice(0, 10)
  await client.query(
    `UPDATE challenge_equity_days SET day_start_balance = day_start_balance + $3, day_start_equity = day_start_equity + $3,
            basis = basis + $3, peak_equity = peak_equity + $3, last_equity = last_equity + $3, updated_at = now()
      WHERE challenge_id=$1 AND day=$2`, [challenge.id, today, delta.toFixed(10)])
  /* OPEN OWNER DECISION D9: the reference says the Instant trailing limit
     does not reset after a reward. Literally applied, a breakeven-locked floor
     equals the post-reward balance and the account breaches at once. Until
     decided, trailing restarts from the post-reward balance. */
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

/**
 * D5: called inside the transaction that marks a reward PAID. Creates the fee
 * refund exactly once when this is the fourth paid reward of a lineage whose
 * snapshot carries `refundPolicy: 'fourth-reward'`. Returns the refund or null.
 */
export async function onRewardPaidTx(client, w, actor) {
  if (w.kind !== 'reward' || !w.challenge_id) return null
  const challenge = (await client.query('SELECT * FROM openfund_challenges WHERE id=$1', [w.challenge_id])).rows[0]
  if (challenge?.rules_snapshot?.refundPolicy !== 'fourth-reward') return null
  const { n } = (await client.query(`SELECT count(*)::int AS n FROM withdrawal_requests WHERE challenge_id=$1 AND kind='reward' AND status='paid'`, [challenge.id])).rows[0]
  if (n !== 4) return null
  const order = await originOrder(client, challenge)
  if (!order || order.status !== 'paid' || !(D(order.price_usd).gt(0))) {
    await ChallengeService.event(client, challenge.id, 'fee_refund_not_applicable', { withdrawalId: w.id, reason: !order ? 'origin_order_unknown' : 'no_fee_paid' })
    return null
  }
  const { rows: [refund] } = await client.query(
    `INSERT INTO fee_refunds (purchase_order_id, challenge_id, user_id, withdrawal_id, amount_usd, actor)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING *`,
    [order.id, challenge.id, challenge.user_id, w.id, D(order.price_usd).toFixed(2), actor])
  if (refund) await ChallengeService.event(client, challenge.id, 'fee_refund_created', { refundId: refund.id, orderId: order.id, amount: refund.amount_usd })
  return refund || null
}

const challengeView = (c, extra = {}) => ({ id: c.id, planSlug: c.plan_slug, planName: c.plan_name, stage: c.stage, status: c.status,
  accountSizeUsd: c.account_size_usd, fundedFrom: c.funded_from_challenge_id || null, startedAt: c.started_at,
  rewardCycle: effectiveCycle(c), ...extra })

/** Customer routes: reward status, cycle selection and requests. */
export function rewardRoutes({ pool, requireAuth, audit = async () => {}, limit = () => (req, res, next) => next(), md = null, challenges = new ChallengeService(pool) }) {
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
    /* approved funded-demo accounts waiting for the one-time cycle choice */
    const awaitingCycle = rows.filter(c => c.funded_from_challenge_id && c.status === 'created' && !c.reward_cycle)
      .map(c => challengeView(c, { cycles: (c.rules_snapshot?.rewardCycles || []) }))
    const client = await pool.connect()
    try {
      const funded = []
      for (const c of rows.filter(isFundedAccount)) {
        const ctx = await rewardContext(client, c, md)
        const eligibility = ctx.legacy
          ? (ctx.terms.profitSplitMonthlyPct ? ['biweekly', 'monthly'] : ['biweekly']).map(cycle => legacyEligibility({ ...ctx, cycle }))
          : [cycleEligibility(ctx)]
        const fee = (await client.query('SELECT id, amount_usd, status, paid_at, payout_ref FROM fee_refunds WHERE challenge_id=$1', [c.id])).rows[0] || null
        funded.push(challengeView(c, { balance: D(ctx.acc.balance).toFixed(2), legacyTerms: ctx.legacy, eligibility, strikes: ctx.strikes ?? 0, feeRefund: fee }))
      }
      res.set('Cache-Control', 'no-store').json({ reviews, awaitingCycle, funded })
    } finally { client.release() }
  }))

  /* D1: one-time reward-cycle choice; activates the funded-demo account */
  router.post('/rewards/accounts/:id/cycle', requireAuth, limit(10), wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'challenge_not_found')
    const { cycle } = req.body || {}
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const c = (await client.query('SELECT * FROM openfund_challenges WHERE id=$1 AND user_id=$2 FOR UPDATE', [req.params.id, req.user.user_id])).rows[0]
      if (!c) throw fail(404, 'challenge_not_found')
      if (!c.funded_from_challenge_id || !isV3(c.rules_snapshot)) throw fail(409, 'cycle_not_selectable')
      if (c.reward_cycle) throw fail(409, 'reward_cycle_already_selected')
      if (!(c.rules_snapshot.rewardCycles || []).some(x => x.key === cycle)) throw fail(400, 'invalid_cycle')
      await client.query('UPDATE openfund_challenges SET reward_cycle=$2 WHERE id=$1', [c.id, cycle])
      await ChallengeService.event(client, c.id, 'reward_cycle_selected', { cycle })
      const started = await challenges.startTx(client, { ...c, reward_cycle: cycle })
      await client.query('COMMIT')
      await audit('reward_cycle_selected', req.user.user_id, req, { challengeId: c.id, cycle })
      res.json({ ok: true, rewardCycle: cycle, status: started.status })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))

  router.post('/withdrawals', requireAuth, limit(10), wrap(async (req, res) => {
    const { challengeId, cycle = 'biweekly', note } = req.body || {}
    if (!challengeId) throw fail(400, 'reward_account_required')
    if (!uuid.test(challengeId)) throw fail(400, 'invalid_challenge')
    if (note != null && (typeof note !== 'string' || note.length > 500)) throw fail(400, 'invalid_note')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const c = (await client.query('SELECT * FROM openfund_challenges WHERE id=$1 AND user_id=$2 FOR UPDATE', [challengeId, req.user.user_id])).rows[0]
      if (!c) throw fail(404, 'challenge_not_found')
      if (!isFundedAccount(c)) throw fail(409, 'not_a_funded_account')
      const ctx = await rewardContext(client, c, md, { lock: true })
      if (ctx.legacy && !LEGACY_CYCLES[cycle]) throw fail(400, 'invalid_cycle')
      const decision = decide({ ...ctx, cycle })
      if (!decision.eligible) throw fail(409, 'not_eligible', { checks: decision.checks.filter(x => !x.ok) })
      const amount = D(decision.reward)
      const { rows: [w] } = await client.query(
        `INSERT INTO withdrawal_requests (user_id, challenge_id, amount_usd, note, kind, reward_cycle, gross_profit_usd, split_pct, fee_refund_usd, eligibility)
         VALUES ($1,$2,$3,$4,'reward',$5,$6,$7,0,$8) RETURNING id, requested_at`,
        [req.user.user_id, c.id, amount.toFixed(2), note || null, decision.cycle, decision.grossProfit, decision.splitPct, JSON.stringify(decision)])
      await adjustBalance(client, c, ctx.acc, D(decision.grossProfit).negated(), 'reward_withdrawal', { withdrawalId: w.id, cycle: decision.cycle, splitPct: decision.splitPct })
      await ChallengeService.event(client, c.id, 'reward_requested', { withdrawalId: w.id, grossProfit: decision.grossProfit, reward: decision.reward, deducted: decision.deducted ?? '0.00', cycle: decision.cycle })
      await client.query('COMMIT')
      await audit('withdrawal_requested', req.user.user_id, req, { withdrawalId: w.id, amount: amount.toFixed(2), kind: 'reward' })
      res.json({ id: w.id, requestedAt: w.requested_at, status: 'requested', amountUsd: amount.toFixed(2), reward: decision.reward, grossProfit: decision.grossProfit, deducted: decision.deducted ?? '0.00', cycle: decision.cycle })
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

/** Operator routes: final-pass reviews, the funded-demo transition and fee refunds. */
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
        /* funded-demo account: same purchased size and frozen terms, restarted at
           the starting virtual balance, stage 0 (loss limits, no target). A v3
           account waits for the trader's one-time reward-cycle choice before it
           starts; older snapshots start at once (no cycle choice existed). */
        const snapshot = { ...c.rules_snapshot, funded: true }
        funded = (await client.query(
          `INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, stage, rules_snapshot, parent_challenge_id, funded_from_challenge_id)
           VALUES ($1,$2,'created',$3,0,$4,$5,$5) RETURNING *`,
          [c.user_id, c.challenge_plan_id, c.account_size_usd, JSON.stringify(snapshot), c.id])).rows[0]
        if (isV3(snapshot)) await challenges.provisionTx(client, funded)
        else funded = await challenges.startTx(client, funded)
        await ChallengeService.event(client, funded.id, 'funded_demo_activated', { fromChallengeId: c.id, startingBalance: D(c.account_size_usd).toFixed(2), actor, awaitingCycle: isV3(snapshot) })
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
  /* D5 fee refunds: listed and marked paid (manual payout reference) */
  router.get('/fee-refunds', wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT f.*, u.wallet_address FROM fee_refunds f JOIN openfund_users u ON u.id=f.user_id ORDER BY f.created_at DESC LIMIT 200`)
    res.set('Cache-Control', 'no-store').json({ refunds: rows })
  }))
  router.post('/fee-refunds/:id/paid', wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'refund_not_found')
    const actor = adminActor(req)
    const ref = typeof req.body?.payoutRef === 'string' ? req.body.payoutRef.trim() : ''
    if (!ref || ref.length > 200) throw fail(400, 'payout_ref_required')
    const { rows: [r] } = await pool.query(
      `UPDATE fee_refunds SET status='paid', payout_ref=$2, paid_at=now(), actor=$3 WHERE id=$1 AND status='pending' RETURNING *`, [req.params.id, ref, actor])
    if (!r) {
      const cur = (await pool.query('SELECT status FROM fee_refunds WHERE id=$1', [req.params.id])).rows[0]
      if (!cur) throw fail(404, 'refund_not_found')
      return res.json({ ok: true, duplicate: true, status: cur.status })
    }
    res.json({ ok: true, status: 'paid' })
  }))
  router.use((err, req, res, next) => {
    if (!err?.status || err.status >= 500) return next(err)
    res.status(err.status).json({ error: err.message })
  })
  return router
}
