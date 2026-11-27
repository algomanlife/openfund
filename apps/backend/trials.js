/**
 * Request-based Free Trial (ADR 0062).
 *
 * A trial is an ordinary challenge row (openfund_challenges) on the
 * `free-trial` catalog plan, so the engine, the evaluation rules, stage
 * progression, expiry and certificates all apply unchanged. The trader picks
 * the evaluation model (Standard two-phase or One-phase) and an account size;
 * the frozen rules snapshot is the CURRENT configuration of that paid plan
 * with the trial overrides below. Each phase lasts TRIAL_DAYS_PER_PHASE days
 * (startTx reads rules.trialDaysPerPhase for free snapshots, and the stage-2
 * row created on a phase-1 pass starts its own 14 days).
 *
 * Eligibility (owner decision 2026-11-27):
 *  - no challenge of the user (paid, trial, tournament or funded) is
 *    `created` or `started`;
 *  - TRIAL_COOLDOWN_HOURS after the user's most recent trial ended;
 *  - Instant has no trial; trial accounts never earn rewards, are never
 *    funded and never pay out (rewards.js `trial_not_fundable`).
 *
 * Requests are serialized per user with a transaction-scoped advisory lock,
 * so two concurrent requests cannot both pass the checks.
 */
import { Router } from 'express'
import { normalizeRules, ChallengeService } from './evaluation.js'
import { limiter } from './rate-limit-store.js'

export const TRIAL_PLAN_SLUG = 'free-trial'
export const TRIAL_DAYS_PER_PHASE = 14
export const TRIAL_COOLDOWN_HOURS = 72
/** trial model → the paid catalog plan whose rules the trial copies */
export const TRIAL_MODELS = Object.freeze({ standard: 'standard', 'one-phase': 'one-phase' })

const fail = (status, code, extra = {}) => Object.assign(new Error(code), { status, ...extra })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

/**
 * Trial rules: the paid plan's configuration with the free overrides. Rules
 * that only govern rewards and payouts are removed; evaluation rules (targets,
 * loss limits, drawdown mode, minimum trading days, conduct rules) are kept.
 */
export function trialRules(baseConfiguration, model) {
  const c = { ...(baseConfiguration || {}) }
  const rules = normalizeRules({
    ...c,
    free: true,
    timeLimitDays: TRIAL_DAYS_PER_PHASE,
    trialDaysPerPhase: TRIAL_DAYS_PER_PHASE,
    dailyLossPctAlt: null,
    profitSplitPct: 0,
    profitSplitMonthlyPct: null,
    payoutCapPct: 0,
    firstPayoutDays: null,
    minPayoutPct: null,
    refundPolicy: 'none',
    rewardCycles: [],
  })
  return { ...rules, trialModel: model }
}

const ACTIVE = `SELECT id, status, stage, challenge_plan_id FROM openfund_challenges
  WHERE user_id=$1 AND status IN ('created','started') ORDER BY created_at DESC LIMIT 1`

/** Eligibility of one user (read-only; the request re-checks under its lock). */
export async function trialEligibility(db, userId, now = Date.now()) {
  const active = (await db.query(ACTIVE, [userId])).rows[0]
  if (active) return { eligible: false, reason: 'active_account_exists', activeChallengeId: active.id }
  const last = (await db.query(
    `SELECT c.completed_at FROM openfund_challenges c JOIN challenge_plans p ON p.id=c.challenge_plan_id
      WHERE c.user_id=$1 AND p.slug=$2 AND c.completed_at IS NOT NULL
      ORDER BY c.completed_at DESC LIMIT 1`, [userId, TRIAL_PLAN_SLUG])).rows[0]
  if (last) {
    const availableAt = new Date(new Date(last.completed_at).getTime() + TRIAL_COOLDOWN_HOURS * 3600_000)
    if (availableAt.getTime() > now) return { eligible: false, reason: 'trial_cooldown', availableAt: availableAt.toISOString() }
  }
  return { eligible: true, reason: null }
}

/** Public catalog of what a trial offers (sizes from the free-trial plan). */
export async function trialOffer(db) {
  const plans = (await db.query(
    `SELECT slug, configuration FROM challenge_plans WHERE slug = ANY($1) AND status='active'`,
    [[TRIAL_PLAN_SLUG, ...Object.values(TRIAL_MODELS)]])).rows
  const trial = plans.find(p => p.slug === TRIAL_PLAN_SLUG)
  if (!trial) return null
  const models = Object.entries(TRIAL_MODELS)
    .map(([model, slug]) => ({ model, plan: plans.find(p => p.slug === slug) }))
    .filter(m => m.plan)
    .map(({ model, plan }) => {
      const r = trialRules(plan.configuration, model)
      return { model, phases: r.phases, phase1TargetPct: r.phase1TargetPct, phase2TargetPct: r.phase2TargetPct,
        dailyLossPct: r.dailyLossPct, maxTotalLossPct: r.maxTotalLossPct, drawdownMode: r.drawdownMode,
        minTradingDays: r.minTradingDays, daysPerPhase: TRIAL_DAYS_PER_PHASE }
    })
  return {
    accountSizesUsd: (trial.configuration?.accountSizesUsd ?? []).map(Number),
    models, daysPerPhase: TRIAL_DAYS_PER_PHASE, cooldownHours: TRIAL_COOLDOWN_HOURS,
  }
}

/** Create and start a trial challenge inside the caller's transaction. */
export async function requestTrialTx(client, userId, { model, accountSizeUsd }) {
  if (!Object.hasOwn(TRIAL_MODELS, model)) throw fail(400, 'invalid_trial_model')
  await client.query(`SELECT pg_advisory_xact_lock(hashtext('openfund-trial:' || $1::text))`, [userId])
  const user = (await client.query('SELECT id, status FROM openfund_users WHERE id=$1 FOR UPDATE', [userId])).rows[0]
  if (!user) throw fail(404, 'user_not_found')
  if (user.status !== 'active') throw fail(403, 'account_suspended')
  const eligibility = await trialEligibility(client, userId)
  if (!eligibility.eligible) throw fail(409, eligibility.reason, { detail: eligibility })
  const plans = (await client.query(
    `SELECT id, slug, configuration FROM challenge_plans WHERE slug = ANY($1) AND status='active'`,
    [[TRIAL_PLAN_SLUG, TRIAL_MODELS[model]]])).rows
  const trialPlan = plans.find(p => p.slug === TRIAL_PLAN_SLUG)
  const base = plans.find(p => p.slug === TRIAL_MODELS[model])
  if (!trialPlan || !base) throw fail(409, 'trial_not_available')
  const size = Number(accountSizeUsd)
  if (!(trialPlan.configuration?.accountSizesUsd ?? []).map(Number).includes(size)) throw fail(400, 'invalid_account_size')
  const rules = trialRules(base.configuration, model)
  if (!rules.evaluationCapable) throw fail(409, 'trial_not_available')
  const challenge = (await client.query(
    `INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, stage, rules_snapshot)
     VALUES ($1,$2,'created',$3,1,$4) RETURNING *`,
    [userId, trialPlan.id, size, JSON.stringify(rules)])).rows[0]
  await ChallengeService.event(client, challenge.id, 'trial_requested', { model, accountSizeUsd: size, daysPerPhase: TRIAL_DAYS_PER_PHASE })
  return await new ChallengeService(null).startTx(client, challenge)
}

export function trialRoutes({ pool, requireAuth, audit }) {
  const router = Router()
  const requestLimit = limiter('trials.request', { windowMs: 60_000, limit: 6, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'rate_limited' } })
  router.get('/trials', requireAuth, wrap(async (req, res) => {
    const offer = await trialOffer(pool)
    const eligibility = await trialEligibility(pool, req.user.user_id)
    res.set('Cache-Control', 'no-store').json({ offer, eligibility })
  }))
  router.post('/trials', requireAuth, requestLimit, wrap(async (req, res) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const started = await requestTrialTx(client, req.user.user_id, {
        model: req.body?.model, accountSizeUsd: req.body?.accountSizeUsd })
      await client.query('COMMIT')
      await audit?.('trial_requested', req.user.user_id, req, { challengeId: started.id, model: req.body?.model, accountSizeUsd: started.account_size_usd })
      res.status(201).json({ ok: true, challenge: { id: started.id, accountId: started.demo_account_id, status: started.status,
        stage: started.stage, accountSizeUsd: started.account_size_usd, expiresAt: started.expires_at } })
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      if (e.detail && e.status === 409) return res.status(409).json({ error: e.message, ...e.detail })
      throw e
    } finally { client.release() }
  }))
  return router
}
