/**
 * Openfund challenge evaluation engine (v0.3.1 soft launch).
 *
 * The rules of record are the published Rulebook terms
 * (apps/web-react/src/features/rulebook/content.ts), which derive from
 * the challenge catalog (apps/web-react/src/data/challengePlans.ts):
 *
 *  - Profit targets are measured on CLOSED NET PROFIT (balance −
 *    starting balance, including charged fees); open positions do not
 *    count until realized. Phase 1 / phase 2 targets per plan; Instant
 *    (phases=0) has no target and no pass transition.
 *  - Daily loss: measured against the HIGHER of the day's opening
 *    balance or opening equity; resets 00:00 UTC+3; touching once is a
 *    breach — a recovering trade does not undo it.
 *  - Maximum loss (static): equity must never fall that far below the
 *    starting size. Trailing (Instant): follows the highest recorded
 *    equity and locks at breakeven once the account is
 *    trailingLockAtProfitPct in profit.
 *  - Loss limits count EQUITY — unrealized losses move toward the
 *    boundary in real time. Evaluation is deferred (never forced)
 *    while marks are stale: no settlement with an unavailable quote.
 *  - A pass also requires the balance after settling open positions at
 *    the mark (exit spread + closing fee) to meet the target, and every
 *    open position to be settleable now (fresh mark, market open).
 *  - minTradingDays: distinct UTC+3 days with at least one order fill
 *    on the challenge account (pass condition, phases ≥ 1).
 *  - Consistency score and profitableDaysPer30 are PAYOUT conditions
 *    (Rulebook "practices"/"payouts"), not trading restrictions —
 *    they are surfaced as metrics only, never breach/pass triggers.
 *
 * Lifecycle state machine (openfund_challenges.status):
 *   created → started → passed | failed | expired | cancelled
 * Two-phase plans provision a stage-2 challenge row (stage=2, rules
 * snapshot inherited) when stage 1 passes. Instant starts at the funded
 * simulation stage (stage=0): limits enforced, no target, no pass.
 * All transitions run inside DB transactions with FOR UPDATE locks and
 * are recorded in the append-only challenge_events history.
 *
 * Canonical plan key is `dailyLossPct` (frontend catalog + CMS seed
 * path); the legacy backend key `maxDailyLossPct` is accepted during
 * normalization and never written back to live plan rows.
 */
import { D } from './trading-math.js'

export const RULES_VERSION = 1
/** Day boundary 00:00 UTC+3 (fixed offset, no DST) — published rule of record. */
export const DAY_UTC3_OFFSET_MS = 3 * 60 * 60 * 1000

const num = (v) => {
  /* null/undefined/'' mean "not configured" — Number(null)===0 must NOT
     turn an unlimited time limit into a same-second expiry */
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Normalize a plan configuration (JSONB) into the canonical rules
 * snapshot frozen at provisioning time. Legacy `maxDailyLossPct` keys
 * are accepted; `dailyLossPct` wins when both are present.
 */
export function normalizeRules(planConfiguration = {}) {
  const c = planConfiguration || {}
  const dailyLossPct = num(c.dailyLossPct) ?? num(c.maxDailyLossPct)
  const rules = {
    rulesVersion: RULES_VERSION,
    phases: num(c.phases) ?? 0,
    phase1TargetPct: num(c.phase1TargetPct),
    phase2TargetPct: num(c.phase2TargetPct),
    dailyLossPct,
    dailyLossPctAlt: num(c.dailyLossPct) != null ? num(c.dailyLossPctAlt) : num(c.maxDailyLossPctAlt),
    maxTotalLossPct: num(c.maxTotalLossPct),
    drawdownMode: c.drawdownMode === 'trailing' ? 'trailing' : 'static',
    trailingLockAtProfitPct: num(c.trailingLockAtProfitPct),
    minTradingDays: num(c.minTradingDays) ?? 0,
    timeLimitDays: num(c.timeLimitDays),
    trialDaysPerPhase: num(c.trialDaysPerPhase),
    referenceLeverageX: num(c.referenceLeverageX) ?? 5,
    consistencyPct: num(c.consistencyPct),
    profitableDaysPer30: num(c.profitableDaysPer30),
    profitSplitPct: num(c.profitSplitPct),
    free: !!c.free,
  }
  /* integrity: a plan without positive loss limits cannot be evaluated —
     its challenges stay inert (trading blocked) rather than mis-governed */
  if (!(rules.dailyLossPct > 0) || !(rules.maxTotalLossPct > 0)) rules.evaluationCapable = false
  else rules.evaluationCapable = true
  return rules
}

/** UTC+3 calendar day of a timestamp ('YYYY-MM-DD'). */
export function challengeDay(ts = Date.now()) {
  return new Date(ts + DAY_UTC3_OFFSET_MS).toISOString().slice(0, 10)
}

/** Distinct UTC+3 trading days with ≥1 filled order on the account. */
export async function countTradingDays(client, accountId) {
  /* A trading day is the UTC+3 day an order FILLED. Each fill creates exactly
     one root position (opened_at = fill time); partial-close slices carry a
     parent_position_id and the parent's opened_at, so they are excluded.
     (Order created_at would credit a pending order's placement day.) */
  const { rows } = await client.query(
    `SELECT count(DISTINCT (to_char(opened_at AT TIME ZONE 'UTC' + interval '3 hours', 'YYYY-MM-DD')))::int AS days
       FROM trading_positions
      WHERE account_id = $1 AND parent_position_id IS NULL`,
    [accountId])
  return rows[0]?.days ?? 0
}

/**
 * Pure evaluation of the rules of record against a challenge state.
 * `equity` may be null (stale marks) → status 'deferred'.
 *
 * @returns {{status:'pass'|'fail'|'none'|'deferred', violations:Array, metrics:object}}
 */
export function evaluateRules({ rules, stage = 1, startingBalance, balance, equity, settlementBalance, dayBasis, dailyLossSoFar, trailing, tradingDays = 0, now = Date.now(), expiresAt = null }) {
  const starting = D(startingBalance)
  const violations = []
  const metrics = {}
  if (!rules?.evaluationCapable) return { status: 'none', violations, metrics: { evaluationCapable: false } }
  if (equity === null || equity === undefined) return { status: 'deferred', violations, metrics: { reason: 'stale_marks' } }
  const eq = D(equity)
  metrics.equity = eq.toFixed(2)
  metrics.starting = starting.toFixed(2)
  /* realized (closed) net profit = balance − starting, fees included */
  metrics.realizedProfit = D(balance).minus(starting).toFixed(2)
  metrics.tradingDays = tradingDays

  /* ---- expiry (trial time limit / plan time limit) ---- */
  if (expiresAt && new Date(expiresAt).getTime() <= now) {
    violations.push({ rule: 'time_limit', detail: { expiresAt, at: new Date(now).toISOString() } })
  }

  /* ---- daily loss: equity vs basis × (1 − dailyLossPct/100) ---- */
  if (dayBasis != null && rules.dailyLossPct > 0) {
    const basis = D(dayBasis)
    const limit = basis.times(D(rules.dailyLossPct).div(100))
    const threshold = basis.minus(limit)
    metrics.daily = { basis: basis.toFixed(2), limit: limit.toFixed(2), threshold: threshold.toFixed(2) }
    if (eq.lte(threshold)) violations.push({ rule: 'daily_loss_breach', detail: { ...metrics.daily, equity: eq.toFixed(2) } })
  }

  /* ---- maximum loss: static vs trailing ---- */
  if (rules.drawdownMode === 'trailing') {
    const pct = D(rules.maxTotalLossPct).div(100)
    const peak = D(trailing?.peakEquity ?? starting)
    let floor = starting.times(D(1).minus(pct))
    if (peak.gt(starting)) floor = Decimal_max(floor, peak.minus(starting.times(pct)))
    if (rules.trailingLockAtProfitPct > 0 && peak.gte(starting.times(D(1).plus(D(rules.trailingLockAtProfitPct).div(100))))) {
      floor = Decimal_max(floor, starting) /* breakeven lock */
    }
    metrics.trailing = { peak: peak.toFixed(2), floor: floor.toFixed(2), locked: floor.gte(starting) }
    if (eq.lte(floor)) violations.push({ rule: 'trailing_loss_breach', detail: { ...metrics.trailing, equity: eq.toFixed(2) } })
  } else {
    const threshold = starting.times(D(1).minus(D(rules.maxTotalLossPct).div(100)))
    metrics.maximum = { threshold: threshold.toFixed(2) }
    if (eq.lte(threshold)) violations.push({ rule: 'maximum_loss_breach', detail: { threshold: threshold.toFixed(2), equity: eq.toFixed(2) } })
  }

  /* ---- pass: target on closed profit + minimum trading days (phases ≥ 1) ---- */
  if ((rules.phases ?? 0) >= 1) {
    const target = D(stage === 2 ? (rules.phase2TargetPct ?? rules.phase1TargetPct) : (rules.phase1TargetPct ?? 0))
    const targetAmount = starting.times(target).div(100)
    /* A pass settles every open position at the mark. The target is measured
       on CLOSED net profit, so the profit that will remain closed after that
       settlement must also meet the target — otherwise an open losing
       position would be realized below the target after the pass.
       settlementBalance: undefined → no open positions (equals balance);
       null → open positions cannot be settled now → no pass yet. */
    const settled = settlementBalance === undefined ? D(balance) : settlementBalance === null ? null : D(settlementBalance)
    metrics.target = { pct: target.toString(), amount: targetAmount.toFixed(2), reached: D(metrics.realizedProfit).gte(targetAmount),
      settlementProfit: settled ? settled.minus(starting).toFixed(2) : null }
    const pass = target.gt(0)
      && D(metrics.realizedProfit).gte(targetAmount)
      && settled !== null && settled.minus(starting).gte(targetAmount)
      && tradingDays >= (rules.minTradingDays ?? 0)
      && violations.length === 0
    if (pass) return { status: 'pass', violations, metrics }
  }

  if (violations.length) return { status: 'fail', violations, metrics }
  return { status: 'none', violations, metrics }
}

const Decimal_max = (a, b) => (a.gte(b) ? a : b)

/* ==================================================================
 * ChallengeService — lifecycle (provision / start / progression),
 * equity-day observation, trailing state, and dashboard views.
 * Financial trade-coupled enforcement (breach close-out) lives in
 * engine.js and reuses the pure functions above.
 * ================================================================== */
export class ChallengeService {
  constructor(pool) {
    this.pool = pool
  }

  static event(client, challengeId, kind, detail = {}) {
    return client.query(
      'INSERT INTO challenge_events (challenge_id, kind, detail) VALUES ($1,$2,$3)',
      [challengeId, kind, JSON.stringify(detail)])
  }

  /** challenge rows for a user (with account + plan references) */
  async listForUser(userId) {
    const { rows } = await this.pool.query(
      `SELECT c.*, p.slug AS plan_slug, p.name AS plan_name, p.configuration AS plan_configuration
         FROM openfund_challenges c JOIN challenge_plans p ON p.id = c.challenge_plan_id
        WHERE c.user_id = $1 ORDER BY c.created_at DESC`, [userId])
    return rows
  }

  async byId(challengeId, userId = null) {
    const q = userId
      ? 'SELECT c.*, p.slug AS plan_slug, p.name AS plan_name, p.configuration AS plan_configuration FROM openfund_challenges c JOIN challenge_plans p ON p.id=c.challenge_plan_id WHERE c.id=$1 AND c.user_id=$2'
      : 'SELECT c.*, p.slug AS plan_slug, p.name AS plan_name, p.configuration AS plan_configuration FROM openfund_challenges c JOIN challenge_plans p ON p.id=c.challenge_plan_id WHERE c.id=$1'
    const { rows } = await this.pool.query(q, userId ? [challengeId, userId] : [challengeId])
    return rows[0] || null
  }

  async events(challengeId) {
    const { rows } = await this.pool.query(
      'SELECT kind, detail, ts FROM challenge_events WHERE challenge_id=$1 ORDER BY id', [challengeId])
    return rows
  }

  /**
   * Provision the challenge trading account — called INSIDE the caller's
   * transaction (confirmPurchase or stage progression):
   *  - snapshot rules (freeze the plan configuration of record);
   *  - create the demo_accounts row (account_type='challenge',
   *    balance = purchased size, one auditable funding ledger row);
   *  - record the provisioning event.
   * Idempotent: returns the existing account when already provisioned.
   */
  async provisionTx(client, challenge) {
    if (challenge.demo_account_id) {
      const acc = (await client.query('SELECT * FROM demo_accounts WHERE id=$1', [challenge.demo_account_id])).rows[0]
      if (acc) return acc
    }
    /* an inherited rules snapshot (stage progression) wins; only fresh
       challenges normalize from the live plan configuration */
    const rules = challenge.rules_snapshot ?? normalizeRules({ ...(challenge.plan_configuration ?? {}) })
    const size = D(challenge.account_size_usd || 0)
    const { rows: [account] } = await client.query(
      `INSERT INTO demo_accounts (user_id, account_type, currency, balance)
       VALUES ($1,'challenge','USD',$2) RETURNING *`,
      [challenge.user_id, size.toFixed(10)])
    await client.query(
      `INSERT INTO trading_ledger (account_id, user_id, event, amount, balance_after, meta)
       VALUES ($1,$2,'challenge_funding',$3,$3,$4)`,
      [account.id, challenge.user_id, size.toFixed(10),
        JSON.stringify({ type: 'challenge', challengeId: challenge.id, currency: 'USD' })])
    await client.query(
      `UPDATE openfund_challenges SET rules_snapshot=$1, demo_account_id=$2 WHERE id=$3`,
      [JSON.stringify(rules), account.id, challenge.id])
    await ChallengeService.event(client, challenge.id, 'account_provisioned',
      { accountId: account.id, startingBalance: size.toFixed(2), rules })
    return account
  }

  /**
   * Start a provisioned challenge (created → started). Idempotent when
   * already started; rejects invalid transitions otherwise.
   */
  async startTx(client, challenge) {
    const locked = (await client.query('SELECT * FROM openfund_challenges WHERE id=$1 FOR UPDATE', [challenge.id])).rows[0]
    if (!locked) throw Object.assign(new Error('challenge_not_found'), { status: 404 })
    if (locked.status === 'started') return locked
    if (locked.status !== 'created') throw Object.assign(new Error(`challenge_${locked.status}_not_startable`), { status: 409 })
    const account = await this.provisionTx(client, locked)
    /* re-read: provisioning just froze the rules snapshot */
    const rules = (await client.query('SELECT rules_snapshot FROM openfund_challenges WHERE id=$1', [locked.id])).rows[0].rules_snapshot ?? normalizeRules({})
    const days = (rules.phases === 0 ? rules.trialDaysPerPhase : null)
      ?? (rules.free ? rules.trialDaysPerPhase : rules.timeLimitDays)
      ?? rules.timeLimitDays
    const { rows: [started] } = await client.query(
      `UPDATE openfund_challenges SET status='started', started_at=now(),
         expires_at = CASE WHEN $1::int IS NULL THEN NULL ELSE now() + ($1::int * interval '1 day') END
       WHERE id=$2 RETURNING *`,
      [days != null ? Number(days) : null, locked.id])
    await ChallengeService.event(client, locked.id, 'started',
      { accountId: account.id, stage: started.stage, timeLimitDays: days ?? null })
    return started
  }

  /** public wrapper: start with its own transaction */
  async start(userId, challengeId) {
    const challenge = await this.byId(challengeId, userId)
    if (!challenge) throw Object.assign(new Error('challenge_not_found'), { status: 404 })
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const started = await this.startTx(client, challenge)
      await client.query('COMMIT')
      return started
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally { client.release() }
  }

  /**
   * Observe an equity sample for a challenge (inside the caller's
   * transaction): rolls the UTC+3 day, records the day basis
   * (max(opening balance, opening equity)) and the trailing peak.
   * @returns the effective day row (basis, peak) for evaluation.
   */
  async observeEquityTx(client, challenge, balance, equity) {
    if (equity === null || equity === undefined) return null
    const day = challengeDay()
    /* carry the previous day's closing equity as this day's opening equity */
    const prev = (await client.query(
      `SELECT last_equity FROM challenge_equity_days
        WHERE challenge_id=$1 AND day < $2 ORDER BY day DESC LIMIT 1`,
      [challenge.id, day])).rows[0]
    const openingEquity = prev ? D(prev.last_equity) : D(equity)
    const basis = Decimal_max(D(balance), openingEquity)
    const { rows: [row] } = await client.query(
      `INSERT INTO challenge_equity_days (challenge_id, day, day_start_balance, day_start_equity, basis, peak_equity, last_equity)
       VALUES ($1,$2,$3,$4,$5,$6,$6)
       ON CONFLICT (challenge_id, day) DO UPDATE SET
         peak_equity = GREATEST(challenge_equity_days.peak_equity, excluded.last_equity),
         last_equity = excluded.last_equity,
         updated_at = now()
       RETURNING *`,
      [challenge.id, day, D(balance).toFixed(10), openingEquity.toFixed(10), basis.toFixed(10), D(equity).toFixed(10)])
    /* trailing state: global peak + floor lock (Instant) */
    const rules = challenge.rules_snapshot ?? {}
    if ((rules.drawdownMode ?? 'static') === 'trailing') {
      await client.query(
        `INSERT INTO challenge_trailing (challenge_id, peak_equity, trailing_floor, locked_breakeven)
         VALUES ($1,$2,$3,false)
         ON CONFLICT (challenge_id) DO UPDATE SET
           peak_equity = GREATEST(challenge_trailing.peak_equity, excluded.peak_equity),
           updated_at = now()`,
        [challenge.id, D(equity).toFixed(10), D(equity).toFixed(10)])
    }
    return row
  }

  /**
   * Dashboard view of a challenge: status, stage, rules of record,
   * live risk metrics (equity, realized profit, drawdowns, target
   * progress, trading days) and violation history.
   */
  async view(challenge, engineState = null) {
    const rules = challenge.rules_snapshot
      ?? normalizeRules({ ...(challenge.plan_configuration ?? {}) })
    const starting = D(challenge.account_size_usd || 0)
    const out = {
      id: challenge.id,
      planSlug: challenge.plan_slug,
      planName: challenge.plan_name,
      status: challenge.status,
      stage: challenge.stage,
      accountId: challenge.demo_account_id,
      accountSizeUsd: challenge.account_size_usd,
      startingBalance: starting.toFixed(2),
      startedAt: challenge.started_at,
      completedAt: challenge.completed_at,
      expiresAt: challenge.expires_at,
      createdAt: challenge.created_at,
      rules,
      metrics: null,
      violations: [],
      events: await this.events(challenge.id),
    }
    if (challenge.demo_account_id && engineState?.account) {
      const a = engineState.account
      const day = (await this.pool.query(
        `SELECT * FROM challenge_equity_days WHERE challenge_id=$1 ORDER BY day DESC LIMIT 1`,
        [challenge.id])).rows[0]
      const trailing = (await this.pool.query(
        `SELECT * FROM challenge_trailing WHERE challenge_id=$1`, [challenge.id])).rows[0]
      const tradingDays = await countTradingDays(this.pool, challenge.demo_account_id)
      const evaluation = evaluateRules({
        rules, stage: challenge.stage, startingBalance: starting,
        balance: a.balance, equity: a.equity, settlementBalance: a.settlement_balance,
        dayBasis: day ? day.basis : null,
        trailing: trailing ? { peakEquity: trailing.peak_equity } : null,
        tradingDays, expiresAt: challenge.expires_at,
      })
      out.metrics = { ...evaluation.metrics, balance: a.balance, tradingDays, valuation: a.valuation_status }
      if (day) {
        out.metrics.day = { day: day.day, basis: D(day.basis).toFixed(2), dailyDrawdown: Decimal_max(D(0), D(day.basis).minus(a.equity ?? day.last_equity)).toFixed(2) }
      }
      if (trailing) out.metrics.trailingPeak = D(trailing.peak_equity).toFixed(2)
      out.violations = evaluation.violations
    }
    return out
  }
}
