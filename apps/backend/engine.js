/**
 * Openfund demo trading engine — server-authoritative simulation.
 *
 * INTEGRITY RULES
 *  - All money math uses decimal.js (never JS floats); persisted as NUMERIC.
 *  - Execution prices come from the server's own market-data marks — the
 *    client never submits an execution price.
 *  - Every balance change is a ledger row (append-only, balance_after).
 *  - Order submissions are idempotent (client idempotency-key).
 *  - Account mutations run inside DB transactions with per-account locking.
 *  - The engine loop keeps monitoring pending orders / SL / TP / liquidation
 *    even when the user's browser is closed.
 *
 * SIMULATION ASSUMPTIONS (Gains public API does not provide these —
 * documented in docs/audits/DEMO_TRADING_AUDIT.md, NOT claimed Gains parity):
 *  - execution at server mark, no slippage (no tick data exists)
 *  - fees/spread: explicit simulation asset tiers in trading-math.js
 *  - liquidation when margin + unrealized ≤ maintenance level (10% of margin)
 *  - limit/stop fill at the target price when the mark crosses it
 *  - funding not simulated in v1
 */
import crypto from 'node:crypto'
import {instrumentSpec} from './instruments.js'
import { propMaxLeverage } from './prop-leverage.js'
import Decimal from 'decimal.js'

import { D, SIM, feePct, spreadPct, withSpread, pnl, freshMark, positionMetrics, accountMetrics } from './trading-math.js'
import { ChallengeService, evaluateRules, normalizeRules, countTradingDays } from './evaluation.js'
export { SIM, feePct, spreadPct, withSpread } from './trading-math.js'

/* ---------- per-account async mutex (safe concurrency) ---------- */
const priceString = v => D(v).toFixed(Math.max(2,D(v).decimalPlaces()))
const intent = r => JSON.stringify([r.market,r.side,r.order_type || 'market',String(r.margin),Number(r.leverage),r.target_price == null ? null : String(r.target_price),r.sl == null ? null : String(r.sl),r.tp == null ? null : String(r.tp)])
const duplicate = (row, req, position) => {
  if (intent(row.request_meta.requested) !== intent(req)) throw Object.assign(new Error('idempotency_conflict'), {status:409})
  return {ok: row.status !== 'rejected',reason:row.reject_reason,duplicate:true,pending:row.status === 'pending',order:row,position}
}
const locks = new Map()
async function withAccountLock(accountId, fn) {
  const prev = locks.get(accountId) || Promise.resolve()
  const run = prev.then(fn, fn)
  const tail = run.catch(() => {})
  locks.set(accountId, tail)
  try { return await run } finally { if (locks.get(accountId) === tail) locks.delete(accountId) }
}

export class Engine {
  constructor(pool, marketData) {
    this.pool = pool
    this.md = marketData
    this.challenges = new ChallengeService(pool)
    this.listeners = new Set()          /* state-change → SSE push */
    this.timer = null
    this.running = false
  }

  onState(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  emit(accountId) { for (const fn of this.listeners) { try { fn(accountId) } catch {} } }

  start(intervalMs = 1000) {
    if (this.running) return
    this.running = true
    this.timer = setInterval(() => { this.loop().catch(console.error) }, intervalMs)
    this.timer.unref?.()
    console.log('[engine] monitoring loop started')
  }
  /* resolves once an in-flight monitoring pass has finished, so a graceful
     shutdown never ends the pool under a running pass */
  stop() { this.running = false; clearInterval(this.timer); return this.loopPass ?? Promise.resolve() }

  /* =========================================================
   * ACCOUNT / FUNDING
   * ======================================================= */

  /** one free_demo account per user — atomic + idempotent funding event */
  async ensureDemoAccount(userId, client) {
    const c = client || this.pool
    return c.connect ? c.connect().then(async cc => { try { return await this.#ensureTx(cc, userId) } finally { cc.release() } })
                      : this.#ensureTx(c, userId)
  }
  async #ensureTx(c, userId) {
    await c.query("BEGIN");
    try {
      const { rows } = await c.query(
        `INSERT INTO demo_accounts (user_id, balance, currency)
         VALUES ($1, $2, 'USD')
         ON CONFLICT (user_id) WHERE account_type = 'free_demo' DO NOTHING
         RETURNING *`,
        [userId, SIM.INITIAL_BALANCE],
      );
      let account;
      if (rows.length > 0) {
        account = rows[0];
        /* exactly ONE auditable funding event — same transaction */
        await c.query(
          `INSERT INTO trading_ledger (account_id, user_id, event, amount, balance_after, meta)
           VALUES ($1,$2,'demo_funding',$3,$3,$4)`,
          [
            account.id,
            userId,
            SIM.INITIAL_BALANCE,
            JSON.stringify({ type: "free_demo", currency: "USD" }),
          ],
        );
        await c.query(
          `INSERT INTO trading_events (account_id, kind, detail) VALUES ($1,'demo_account_created',$2)`,
          [
            account.id,
            JSON.stringify({ initial_balance: SIM.INITIAL_BALANCE }),
          ],
        );
        console.log(
          `[engine] demo account funded: 100000 virtual USD (user ${userId.slice(0, 8)})`,
        );
      } else {
        account = (
          await c.query(
            "SELECT * FROM demo_accounts WHERE user_id=$1 AND account_type=$2",
            [userId, "free_demo"],
          )
        ).rows[0];
      }
      await c.query("COMMIT");
      return account;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    }
  }

  async enforceTrialRisk(userId) {
    const account = await this.getAccount(userId)
    if (!account || account.status === 'permanently_disabled') return
    return withAccountLock(account.id, async () => {
      const c = await this.pool.connect()
      try {
        await c.query('BEGIN')
        const acc = (await c.query('SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE', [account.id])).rows[0]
        const stopped = await this.#trialRiskTx(c, acc)
        await c.query('COMMIT')
        if (stopped) this.emit(account.id)
      } catch(e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
    })
  }

  async #trialRiskTx(c, acc) {
    if (acc.account_type !== 'free_demo' || !['active','liquidating'].includes(acc.status)) return acc.status === 'permanently_disabled'
    const positions = (await c.query("SELECT * FROM trading_positions WHERE account_id=$1 AND status='open' ORDER BY id FOR UPDATE", [acc.id])).rows
    let equity = D(acc.balance)
    for (const p of positions) {
      const m = freshMark(this.md,p.market)
      if (!m || !this.md.tradeable(p.market).ok) return false // Never force settlement using an unavailable quote.
      equity = equity.plus(pnl(p.quantity,p.entry_price,m.mark,p.side))
    }
    if (equity.gt(0)) return false
    await c.query("UPDATE demo_accounts SET status='liquidating',updated_at=now() WHERE id=$1",[acc.id])
    await c.query("INSERT INTO trading_events(account_id,kind,detail) VALUES ($1,'trial_liquidating',$2)",[acc.id,JSON.stringify({equity:equity.toString(),threshold:'0',policy:1})])
    for (const p of positions) await this.#closeTx(c,p,freshMark(this.md,p.market).mark,'liquidation')
    const cancelled = (await c.query("UPDATE trading_orders SET status='cancelled',reject_reason='account_permanently_disabled',updated_at=now() WHERE account_id=$1 AND status='pending' RETURNING id",[acc.id])).rows
    await c.query("UPDATE demo_accounts SET status='permanently_disabled',disabled_at=now(),disable_reason='equity_at_or_below_zero',updated_at=now() WHERE id=$1",[acc.id])
    await c.query("INSERT INTO trading_events(account_id,kind,detail) VALUES ($1,'trial_permanently_disabled',$2)",[acc.id,JSON.stringify({threshold:'0',cancelled:cancelled.map(o=>o.id),policy:1})])
    return true
  }

  /* =========================================================
   * CHALLENGE EVALUATION (v0.3.1) — rules of record enforced
   * inside the caller's transaction, account row already FOR UPDATE.
   *
   * Samples equity (fresh marks only — stale marks defer evaluation),
   * observes the UTC+3 day basis + trailing peak, evaluates the
   * published rules, and on breach/pass/expiry:
   *   - closes open positions at the server mark (settlement),
   *   - cancels pending orders,
   *   - transitions the challenge status + appends challenge_events,
   *   - two-phase stage-1 pass provisions the stage-2 challenge.
   * @returns null | 'failed' | 'passed' | 'expired' | 'stage_passed'
   * ======================================================= */
  async #challengeRiskTx(c, acc) {
    if (acc.account_type !== 'challenge' || acc.status !== 'active') return null
    const challenge = (await c.query(
      `SELECT c.*, p.configuration AS plan_configuration
         FROM openfund_challenges c JOIN challenge_plans p ON p.id = c.challenge_plan_id
        WHERE c.demo_account_id = $1 FOR UPDATE OF c`, [acc.id])).rows[0]
    if (!challenge || challenge.status !== 'started') return null
    const rules = challenge.rules_snapshot ?? normalizeRules(challenge.plan_configuration ?? {})
    if (!rules.evaluationCapable) return null

    const positions = (await c.query(
      "SELECT * FROM trading_positions WHERE account_id=$1 AND status='open'", [acc.id])).rows
    const view = accountMetrics(acc, positions, this.md)
    const equity = view.equity === null ? null : D(view.equity)
    const day = await this.challenges.observeEquityTx(c, challenge, acc.balance, equity?.toString() ?? null)
    const trailing = rules.drawdownMode === 'trailing'
      ? (await c.query('SELECT * FROM challenge_trailing WHERE challenge_id=$1 FOR UPDATE', [challenge.id])).rows[0]
      : null
    const tradingDays = await countTradingDays(c, acc.id)
    /* a pass settles every open position now: only possible when each one
       has a fresh mark AND an open market (else the pass waits) */
    const settleable = positions.every(p => this.md.tradeable(p.market).ok)
    const evaluation = evaluateRules({
      rules, stage: challenge.stage, startingBalance: challenge.account_size_usd,
      balance: acc.balance, equity: equity?.toString() ?? null,
      settlementBalance: settleable ? view.settlement_balance : null,
      dayBasis: day ? day.basis : null,
      trailing: trailing ? { peakEquity: trailing.peak_equity } : null,
      tradingDays, expiresAt: challenge.expires_at,
    })
    if (evaluation.status === 'deferred') return null  /* never settle with stale marks */

    if (evaluation.status === 'fail') {
      const breach = evaluation.violations.find(v => v.rule !== 'time_limit')
      if (breach) return await this.#failChallengeTx(c, acc, challenge, evaluation, 'failed')
      return await this.#failChallengeTx(c, acc, challenge, evaluation, 'expired')
    }
    if (evaluation.status === 'pass') {
      const phases = rules.phases ?? 0
      if (phases >= 2 && challenge.stage === 1) {
        /* stage-1 row terminates 'passed' (schema state of record);
           the stage transition itself is recorded in challenge_events */
        await this.#settleChallengeTx(c, acc, challenge, 'passed', evaluation)
        await ChallengeService.event(c, challenge.id, 'stage_passed',
          { stage: 1, metrics: evaluation.metrics })
        /* stage 2 inherits the frozen rules snapshot; no new purchase */
        const stage2 = (await c.query(
          `INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, stage, rules_snapshot)
           VALUES ($1,$2,'created',$3,2,$4) RETURNING *`,
          [challenge.user_id, challenge.challenge_plan_id, challenge.account_size_usd,
            JSON.stringify(rules)])).rows[0]
        await this.challenges.startTx(c, stage2)
        return 'stage_passed'
      }
      await this.#settleChallengeTx(c, acc, challenge, 'passed', evaluation)
      await ChallengeService.event(c, challenge.id, 'passed', { stage: challenge.stage, metrics: evaluation.metrics })
      return 'passed'
    }
    return null
  }

  /** close positions + cancel pending + terminal status (fail / expire / pass) */
  async #settleChallengeTx(c, acc, challenge, status, evaluation) {
    for (const p of (await c.query(
      "SELECT * FROM trading_positions WHERE account_id=$1 AND status='open' FOR UPDATE", [acc.id])).rows) {
      const m = freshMark(this.md, p.market)
      if (!m || !this.md.tradeable(p.market).ok) continue  /* never force settlement without a mark */
      await this.#closeTx(c, p, m.mark, 'challenge_settlement')
    }
    const cancelled = (await c.query(
      "UPDATE trading_orders SET status='cancelled', reject_reason=$2, updated_at=now() WHERE account_id=$1 AND status='pending' RETURNING id",
      [acc.id, `challenge_${status === 'passed' ? 'passed' : status}`])).rows
    await c.query(
      `UPDATE openfund_challenges SET status=$2, completed_at=now() WHERE id=$1`,
      [challenge.id, status])
    await c.query("UPDATE demo_accounts SET status='closed', updated_at=now() WHERE id=$1", [acc.id])
    await c.query(`INSERT INTO trading_events(account_id,kind,detail) VALUES ($1,'challenge_settled',$2)`,
      [acc.id, JSON.stringify({ status, cancelled: cancelled.map(o => o.id), evaluation: { metrics: evaluation.metrics, violations: evaluation.violations } })])
  }

  async #failChallengeTx(c, acc, challenge, evaluation, status) {
    await this.#settleChallengeTx(c, acc, challenge, status, evaluation)
    await ChallengeService.event(c, challenge.id, status === 'failed' ? 'violation' : 'expired', {
      stage: challenge.stage,
      violations: evaluation.violations,
      metrics: evaluation.metrics,
    })
    return status
  }

  /** standalone challenge enforcement entry (engine loop / pre-submit) */
  async enforceChallengeRisk(accountId) {
    return withAccountLock(accountId, async () => {
      const c = await this.pool.connect()
      try {
        await c.query('BEGIN')
        const acc = (await c.query('SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE', [accountId])).rows[0]
        const transition = await this.#challengeRiskTx(c, acc)
        await c.query('COMMIT')
        if (transition) this.emit(accountId)
        return transition
      } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
    })
  }

  /** free_demo account (default) or an owned challenge account by id */
  async getAccount(userId, accountId = null) {
    if (accountId) {
      const { rows } = await this.pool.query(
        `SELECT a.* FROM demo_accounts a
           JOIN openfund_challenges c ON c.demo_account_id = a.id
          WHERE a.id = $1 AND c.user_id = $2 AND a.account_type = 'challenge'`,
        [accountId, userId])
      return rows[0] || null
    }
    const { rows } = await this.pool.query(
      'SELECT * FROM demo_accounts WHERE user_id=$1 AND account_type=$2', [userId, 'free_demo'])
    return rows[0] || null
  }

  /** the openfund_challenges row bound to a challenge account (with plan) */
  async #challengeOfAccount(client, accountId) {
    const { rows } = await client.query(
      `SELECT c.*, p.configuration AS plan_configuration
         FROM openfund_challenges c JOIN challenge_plans p ON p.id = c.challenge_plan_id
        WHERE c.demo_account_id = $1`, [accountId])
    return rows[0] || null
  }

  /* =========================================================
   * STATE (account + positions + orders) — server authoritative
   * ======================================================= */

  async state(userId, accountId = null) {
    const c = await this.pool.connect()
    const as_of = Date.now()
    try {
      await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      const account = accountId
        ? (await c.query(
            `SELECT a.* FROM demo_accounts a
               JOIN openfund_challenges ch ON ch.demo_account_id = a.id
              WHERE a.id = $1 AND ch.user_id = $2`, [accountId, userId])).rows[0]
        : (await c.query("SELECT * FROM demo_accounts WHERE user_id=$1 AND account_type='free_demo'", [userId])).rows[0]
      if (!account) { await c.query('COMMIT'); return { account: null, positions: [], orders: [], history: [] } }
      const challenge = account.account_type === 'challenge' ? await this.#challengeOfAccount(c, account.id) : null
      const positions = (await c.query("SELECT * FROM trading_positions WHERE account_id=$1 AND status='open' ORDER BY opened_at DESC", [account.id])).rows
      const orders = (await c.query("SELECT * FROM trading_orders WHERE account_id=$1 AND status='pending' ORDER BY created_at DESC", [account.id])).rows
      const history = (await c.query("SELECT * FROM trading_positions WHERE account_id=$1 AND status IN ('closed','liquidated') ORDER BY closed_at DESC LIMIT 100", [account.id])).rows
      await c.query('COMMIT')
      const view = this.#accountView(account, positions, challenge)
      if (challenge) {
        /* read-only risk view from the challenge evaluation tables
           (sampling happens on the engine's write path / loop) */
        const day = (await this.pool.query(
          'SELECT * FROM challenge_equity_days WHERE challenge_id=$1 ORDER BY day DESC LIMIT 1', [challenge.id])).rows[0]
        const trailing = (await this.pool.query(
          'SELECT * FROM challenge_trailing WHERE challenge_id=$1', [challenge.id])).rows[0]
        const rules = challenge.rules_snapshot ?? normalizeRules(challenge.plan_configuration ?? {})
        const tradingDays = await countTradingDays(this.pool, account.id)
        const evaluation = evaluateRules({
          rules, stage: challenge.stage, startingBalance: challenge.account_size_usd,
          balance: account.balance, equity: view.equity,
          settlementBalance: positions.every(p => this.md.tradeable(p.market).ok) ? view.settlement_balance : null,
          dayBasis: day ? day.basis : null,
          trailing: trailing ? { peakEquity: trailing.peak_equity } : null,
          tradingDays, expiresAt: challenge.expires_at,
        })
        view.risk = {
          basis: 'challenge_equity', timezone: 'UTC+3 (fixed)',
          challenge_id: challenge.id, challenge_status: challenge.status, stage: challenge.stage,
          day: day?.day ?? null, day_basis: day ? D(day.basis).toFixed(2) : null,
          day_start_equity: day ? D(day.day_start_equity).toFixed(2) : null,
          drawdown: Decimal.max(0, D(day ? day.peak_equity : view.equity ?? 0).minus(view.equity ?? 0)).toFixed(2),
          daily_drawdown: day ? Decimal.max(0, D(day.basis).minus(view.equity ?? day.last_equity)).toFixed(2) : null,
          maximum_drawdown: Decimal.max(0, D(challenge.account_size_usd).minus(view.equity ?? challenge.account_size_usd)).toFixed(2),
          /* the enforced daily limit is a share of the day basis (higher of
             opening balance / opening equity), not of the starting size */
          daily_limit: rules.dailyLossPct != null ? D(day ? day.basis : challenge.account_size_usd).times(rules.dailyLossPct).div(100).toFixed(2) : null,
          daily_threshold: rules.dailyLossPct != null ? D(day ? day.basis : challenge.account_size_usd).times(D(1).minus(D(rules.dailyLossPct).div(100))).toFixed(2) : null,
          maximum_limit: rules.maxTotalLossPct != null ? D(challenge.account_size_usd).times(rules.maxTotalLossPct).div(100).toFixed(2) : null,
          maximum_threshold: evaluation.metrics?.trailing?.floor ?? evaluation.metrics?.maximum?.threshold ?? null,
          drawdown_mode: rules.drawdownMode, trailing_peak: trailing ? D(trailing.peak_equity).toFixed(2) : null,
          trading_days: tradingDays, min_trading_days: rules.minTradingDays ?? 0,
          realized_profit: view.realized_pnl,
          target: evaluation.metrics?.target ?? null,
          evaluation: { status: evaluation.status, violations: evaluation.violations },
          rules_version: rules.rulesVersion,
        }
      } else {
        view.risk = await this.#sampleRisk(account.id, view.equity, c)
      }
      return { as_of, account: view, positions: positions.map(p => this.#positionView(p)), orders, history: history.map(p => this.#positionView(p)) }
    } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
  }

  /* engine-loop equity sampling for a free_demo account: exactly the
     account_equity_risk / account_equity_samples writes that state() makes
     for that account (same snapshot isolation, same rows and ordering, same
     #accountView equity), without the pending-order and closed-history
     reads that the loop never used */
  async #sampleTrialEquity(userId) {
    const c = await this.pool.connect()
    try {
      await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
      const account = (await c.query("SELECT * FROM demo_accounts WHERE user_id=$1 AND account_type='free_demo'", [userId])).rows[0]
      if (!account) { await c.query('COMMIT'); return }
      const positions = (await c.query("SELECT * FROM trading_positions WHERE account_id=$1 AND status='open' ORDER BY opened_at DESC", [account.id])).rows
      await c.query('COMMIT')
      await this.#sampleRisk(account.id, this.#accountView(account, positions, null).equity, c)
    } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
  }

  async #sampleRisk(accountId, equity, c = this.pool) {
    if (equity === null) return null
    const {rows} = await c.query(`INSERT INTO account_equity_risk
      (account_id,day,day_start_equity,peak_equity,last_equity)
      VALUES ($1,(now() AT TIME ZONE 'UTC')::date,$2,$2,$2)
      ON CONFLICT (account_id) DO UPDATE SET
        day = excluded.day,
        day_start_equity = CASE WHEN account_equity_risk.day=excluded.day THEN account_equity_risk.day_start_equity ELSE excluded.last_equity END,
        peak_equity = GREATEST(account_equity_risk.peak_equity,excluded.last_equity),
        maximum_drawdown = GREATEST(account_equity_risk.maximum_drawdown,account_equity_risk.peak_equity-excluded.last_equity,0),
        daily_drawdown = CASE WHEN account_equity_risk.day=excluded.day THEN GREATEST(account_equity_risk.daily_drawdown,account_equity_risk.day_start_equity-excluded.last_equity,0) ELSE 0 END,
        last_equity=excluded.last_equity,updated_at=now()
      RETURNING *`,[accountId,equity])
    const r = rows[0]
    await c.query(`INSERT INTO account_equity_samples(account_id,sampled_at,equity,balance) SELECT id,date_trunc('minute',now()),$2,balance FROM demo_accounts WHERE id=$1 ON CONFLICT DO NOTHING`,[accountId,equity])
    return { basis:'sampled_equity', timezone:'UTC', since:r.created_at, day:r.day,
      day_start_equity:r.day_start_equity, peak_equity:r.peak_equity,
      drawdown:Decimal.max(0,D(r.peak_equity).minus(equity)).toFixed(2),
      daily_drawdown:r.daily_drawdown, maximum_drawdown:r.maximum_drawdown,
      daily_limit:null, maximum_limit:null }
  }

  /** equity = balance + unrealized (all open positions) */
  #accountView(account, openPositions, challenge = null) {
    const starting = challenge ? D(challenge.account_size_usd || 0) : D(SIM.INITIAL_BALANCE)
    return {
      id: account.id, type: account.account_type, currency: account.currency, status: account.status,
      starting_balance: starting.toFixed(2), disabled_at: account.disabled_at, disable_reason: account.disable_reason,
      risk_policy: challenge
        ? { version: 2, position_maintenance_pct: SIM.MAINT_PCT, challenge_rules: true,
            challenge_id: challenge.id, challenge_status: challenge.status, stage: challenge.stage,
            plan_leverage: (challenge.rules_snapshot ?? {}).referenceLeverageX ?? 100,
            day_boundary: 'UTC+3' }
        : { version: 1, position_maintenance_pct: SIM.MAINT_PCT, trial_stop_equity_usd: '0', challenge_rules: false },
      ...accountMetrics(account, openPositions, this.md),
      realized_pnl: D(account.balance).minus(starting).toFixed(2),
      close_settlement_pnl: D(account.realized_pnl).toFixed(2),
    }
  }

  #positionView(p) {
    const metrics = positionMetrics(p, this.md)
    const mark = metrics.mark
    let pnl = null
    if (p.status === 'open' && mark) pnl = metrics.gross.toFixed(2)
    if (p.status !== 'open') pnl = D(p.realized_pnl).toFixed(2)
    return {
      id: p.id, market: p.market, side: p.side, quantity: D(p.quantity).toString(),
      entry_price: priceString(p.entry_price), mark_price: mark ? priceString(mark) : null,
      liquidation_price: metrics.liquidation, unrealized_pnl: p.status === 'open' ? pnl : null,
      gross_pnl: p.status === 'open' ? pnl : D(p.realized_pnl).plus(p.close_fee).toFixed(10),
      net_pnl: p.status === 'open' ? metrics.net?.minus(p.open_fee).toFixed(10) ?? null : D(p.realized_pnl).minus(p.open_fee).toFixed(10),
      roi_pct: p.status === 'open' ? metrics.gross?.div(p.margin).times(100).toFixed(4) ?? null : D(p.realized_pnl).minus(p.open_fee).div(p.margin).times(100).toFixed(4),
      valuation_status: p.status !== 'open' || mark ? 'fresh' : 'stale', parent_position_id: p.parent_position_id || null,
      margin: D(p.margin).toFixed(2), leverage: p.leverage,
      sl_price: p.sl_price ? priceString(p.sl_price) : null,
      tp_price: p.tp_price ? priceString(p.tp_price) : null,
      status: p.status, exit_price: p.exit_price ? priceString(p.exit_price) : null,
      exit_reason: p.exit_reason, open_fee: D(p.open_fee).toFixed(4), close_fee: D(p.close_fee).toFixed(4),
      realized_pnl: pnl, opened_at: p.opened_at, closed_at: p.closed_at
    }
  }

  #pnl(qty, entry, mark, side) {
    return pnl(qty, entry, mark, side)
  }

  /* =========================================================
   * ORDER SUBMISSION (idempotent, validated, transactional)
   * ======================================================= */

  async previewOrder(userId, req, accountId = null) {
    const st = await this.state(userId, accountId), a = st.account
    const fail = reason => { throw Object.assign(new Error(reason),{status:400}) }
    if (!a) fail('account_not_found')
    if (a.type === 'challenge' && a.risk_policy?.challenge_status !== 'started') fail('challenge_not_active')
    if (a.status !== 'active') fail('account_permanently_disabled')
    const t = this.md.tradeable(req.market)
    if (!t.ok) fail(t.reason)
    let margin, leverage, target, sl, tp
    try { margin=D(req.margin); leverage=D(req.leverage); target=req.target_price == null ? null : D(req.target_price); sl=req.sl == null ? null : D(req.sl); tp=req.tp == null ? null : D(req.tp) } catch { fail('invalid_numeric_input') }
    if (!['long','short'].includes(req.side) || !['market','limit','stop'].includes(req.order_type || 'market')) fail('invalid_order')
    if (!margin.isFinite() || margin.lt(SIM.MIN_MARGIN) || margin.gt('100000000')) fail('invalid_order_size')
    /* strictest of: market limit, Prop leverage policy, challenge plan limit */
    const maxLev = propMaxLeverage(t.meta, req.market, a.type === 'challenge' ? (a.risk_policy?.plan_leverage ?? 100) : null)
    if (!leverage.isInteger() || leverage.lt(1) || leverage.gt(maxLev)) fail('leverage_exceeded')
    const pending = req.order_type && req.order_type !== 'market'
    if (pending && (!target?.isFinite() || target.lte(0))) fail('target_price_required')
    const entry = pending ? target : withSpread(t.mark,req.side,'open',t.meta,req.market)
    for (const v of [sl,tp]) if (v && (!v.isFinite() || v.lte(0) || v.gt('1000000000000'))) fail('invalid_numeric_input')
    if (sl && (req.side === 'long' ? sl.gte(entry) : sl.lte(entry))) fail('invalid_sl')
    if (tp && (req.side === 'long' ? tp.lte(entry) : tp.gte(entry))) fail('invalid_tp')
    const spec=instrumentSpec(t.meta,req.market)
    if(margin.lt(spec.minMargin) || margin.times(leverage).lt(spec.minNotional))fail('instrument_minimum_size')
    const notional=margin.times(leverage), fee=notional.times(feePct(t.meta,req.market)).div(100)
    if (a.free_margin === null || margin.plus(fee).gt(a.free_margin) || margin.plus(fee).gt(D(a.balance).minus(a.used_margin))) fail('insufficient_margin')
    const quantity=notional.div(entry).toDecimalPlaces(spec.quantityPrecision,Decimal.ROUND_DOWN)
    if(quantity.lte(0))fail('instrument_minimum_size')
    const metrics=positionMetrics({market:req.market,side:req.side,margin:margin.toString(),leverage:leverage.toString(),quantity:quantity.toString(),entry_price:entry.toString()},this.md)
    return {estimate:true,as_of:Date.now(),currency:a.currency,entry_price:entry.toString(),quantity:quantity.toString(),notional:notional.toString(),required_margin:margin.toString(),open_fee:fee.toString(),estimated_close_fee:fee.toString(),available_margin:a.free_margin,liquidation_price:metrics.liquidation,sl:sl?.toString() ?? null,tp:tp?.toString() ?? null,model:'Openfund linear USD simulation v1; no funding or market impact'}
  }

  async submitOrder(userId, req, idempotencyKey, accountId = null) {
    await this.enforceTrialRisk(userId);
    if (accountId) await this.enforceChallengeRisk(accountId).catch(e => { if (e.status) throw e })
    if (
      idempotencyKey &&
      (typeof idempotencyKey !== "string" || idempotencyKey.length > 160)
    )
      throw Object.assign(new Error("invalid_idempotency_key"), {
        status: 400,
      });
    const legacyKey = idempotencyKey;
    idempotencyKey = idempotencyKey ? `${userId}:${idempotencyKey}` : null;
    if (idempotencyKey) {
      const { rows } = await this.pool.query(
        "SELECT * FROM trading_orders WHERE user_id=$1 AND idempotency_key IN ($2,$3)",
        [userId, idempotencyKey, legacyKey],
      );
      if (rows[0]) {
        return duplicate(
          rows[0],
          req,
          rows[0].position_id
            ? await this.#positionById(rows[0].position_id)
            : null,
        );
      }
    }
    const account = await this.getAccount(userId, accountId);
    if (!account)
      throw Object.assign(new Error("account_not_found"), { status: 404 });
    /* challenge status is reported first — a finished evaluation reads
       clearer than the generic account-status error */
    const challenge = account.account_type === 'challenge'
      ? await this.#challengeOfAccount(this.pool, account.id)
      : null
    if (challenge && challenge.status !== 'started')
      throw Object.assign(new Error(
        challenge.status === 'created' ? 'challenge_not_started'
        : `challenge_${challenge.status}`), { status: 409 })
    if (account.status !== "active")
      throw Object.assign(
        new Error(
          account.status === "permanently_disabled"
            ? "account_permanently_disabled"
            : "account_suspended",
        ),
        { status: 403 },
      );
    const rules = challenge ? (challenge.rules_snapshot ?? normalizeRules(challenge.plan_configuration ?? {})) : null

    if (!idempotencyKey) throw Object.assign(new Error('idempotency_key_required'),{status:400})

    let order;
    try {
      order = {
        market: String(req.market || ""),
        side: req.side,
        order_type: req.order_type || "market",
        margin: D(req.margin || 0),
        leverage: Number(req.leverage),
        target_price: req.target_price != null ? D(req.target_price) : null,
        sl_price: req.sl != null ? D(req.sl) : null,
        tp_price: req.tp != null ? D(req.tp) : null,
      };
    } catch {
      throw Object.assign(new Error("invalid_numeric_input"), { status: 400 });
    }
    if (
      !["long", "short"].includes(order.side) ||
      !["market", "limit", "stop"].includes(order.order_type)
    )
      throw Object.assign(new Error("invalid_order"), { status: 400 });
    if (
      ![order.margin, order.target_price, order.sl_price, order.tp_price].every(
        (v) =>
          v === null ||
          (v.isFinite() && v.gte("0.0000000001") && v.lte("1000000000000")),
      ) ||
      !Number.isInteger(order.leverage)
    )
      throw Object.assign(new Error("invalid_numeric_input"), { status: 400 });

    /* ---------- validation ---------- */
    const reject = async (reason) => {
      if (!idempotencyKey) return { ok: false, reason };
      const { rows } = await this.pool.query(
        `INSERT INTO trading_orders (idempotency_key, account_id, user_id, market, side, order_type,
           margin, leverage, target_price, sl_price, tp_price, status, reject_reason, request_meta)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'rejected',$12,$13) ON CONFLICT (idempotency_key) DO NOTHING RETURNING *`,
        [
          idempotencyKey,
          account.id,
          userId,
          order.market,
          order.side,
          order.order_type,
          order.margin.toFixed(10),
          order.leverage,
          order.target_price?.toFixed(10) || null,
          order.sl_price?.toFixed(10) || null,
          order.tp_price?.toFixed(10) || null,
          reason,
          JSON.stringify({ requested: req }),
        ],
      );
      if (!rows[0]) {
        const winner = (
          await this.pool.query(
            "SELECT * FROM trading_orders WHERE user_id=$1 AND idempotency_key=$2",
            [userId, idempotencyKey],
          )
        ).rows[0];
        return duplicate(
          winner,
          req,
          winner.position_id
            ? await this.#positionById(winner.position_id)
            : null,
        );
      }
      return { ok: false, reason, order: rows[0] };
    };

    const t = this.md.tradeable(order.market);
    if (!t.ok) return reject(t.reason);
    if (!order.margin.gte(SIM.MIN_MARGIN)) return reject("margin_too_small");
    const spec = instrumentSpec(t.meta, order.market);
    if (
      order.margin.lt(spec.minMargin) ||
      order.margin.times(order.leverage).lt(spec.minNotional)
    )
      return reject("instrument_minimum_size");
    if (
      order.leverage < 1 ||
      order.leverage > Number(t.meta.maxLeverage || 100) ||
      order.leverage > propMaxLeverage(t.meta, order.market) ||
      (rules && rules.referenceLeverageX && order.leverage > Number(rules.referenceLeverageX))
    )
      return reject("leverage_exceeded");
    if (order.order_type !== "market" && !order.target_price)
      return reject("target_price_required");
    if (order.margin.gt(D("100000000"))) return reject("margin_too_large");

    /* SL/TP sanity vs side */
    const mark =
      order.order_type === "market"
        ? withSpread(t.mark, order.side, "open", t.meta, order.market)
        : order.target_price;
    if (order.sl_price != null) {
      if (order.side === "long" && order.sl_price.gte(mark))
        return reject("sl_above_mark");
      if (order.side === "short" && order.sl_price.lte(mark))
        return reject("sl_below_mark");
    }
    if (order.tp_price != null) {
      if (order.side === "long" && order.tp_price.lte(mark))
        return reject("tp_below_mark");
      if (order.side === "short" && order.tp_price.gte(mark))
        return reject("tp_above_mark");
    }

    return withAccountLock(account.id, async () => {
      const c = await this.pool.connect();
      try {
        await c.query("BEGIN");
        const acc = (
          await c.query("SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE", [
            account.id,
          ])
        ).rows[0];
        if (idempotencyKey) {
          const winner = (
            await c.query(
              "SELECT * FROM trading_orders WHERE user_id=$1 AND idempotency_key=$2",
              [userId, idempotencyKey],
            )
          ).rows[0];
          if (winner) {
            await c.query("COMMIT");
            return duplicate(
              winner,
              req,
              winner.position_id
                ? await this.#positionById(winner.position_id)
                : null,
            );
          }
        }
        if (acc.status !== "active")
          throw Object.assign(
            new Error(
              acc.status === "permanently_disabled"
                ? "account_permanently_disabled"
                : "account_suspended",
            ),
            { status: 403 },
          );
        if (await this.#trialRiskTx(c, acc)) {
          await c.query("COMMIT");
          this.emit(acc.id);
          throw Object.assign(new Error("account_permanently_disabled"), {
            status: 403,
          });
        }
        /* challenge evaluation runs BEFORE the order is accepted: a
           breached/passed/expired challenge stops trading immediately */
        if (acc.account_type === 'challenge') {
          const transition = await this.#challengeRiskTx(c, acc)
          if (transition) {
            await c.query("COMMIT")
            this.emit(acc.id)
            throw Object.assign(new Error(`challenge_${transition}`), { status: 409 })
          }
        }
        const open = (
          await c.query(
            "SELECT * FROM trading_positions WHERE account_id=$1 AND status='open'",
            [acc.id],
          )
        ).rows;
        const view = accountMetrics(acc, open, this.md);
        const free = Decimal.min(
          D(acc.balance).minus(acc.used_margin),
          D(view.free_margin ?? 0),
        );
        const openingFee = order.margin
          .times(order.leverage)
          .times(feePct(t.meta, order.market))
          .div(100);
        if (order.margin.plus(openingFee).gt(free)) {
          await c.query("ROLLBACK");
          return reject("insufficient_margin");
        }

        /* create the order row first (idempotency captured even on race) */
        const { rows: orows } = await c.query(
          `INSERT INTO trading_orders (idempotency_key, account_id, user_id, market, side, order_type,
             margin, leverage, target_price, sl_price, tp_price, status, request_meta)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',$12) RETURNING *`,
          [
            idempotencyKey,
            account.id,
            userId,
            order.market,
            order.side,
            order.order_type,
            order.margin.toFixed(10),
            order.leverage,
            order.target_price?.toFixed(10) || null,
            order.sl_price?.toFixed(10) || null,
            order.tp_price?.toFixed(10) || null,
            JSON.stringify({ requested: req, mark: t.mark }),
          ],
        );
        const orow = orows[0];
        await c.query(
          "INSERT INTO trading_events(account_id,kind,detail) VALUES ($1,'order_created',$2)",
          [
            acc.id,
            JSON.stringify({
              order: orow.id,
              type: orow.order_type,
              status: "pending",
            }),
          ],
        );

        let result;
        if (order.order_type === "market") {
          const current = this.md.tradeable(order.market);
          if (!current.ok)
            throw Object.assign(new Error(current.reason), { status: 409 });
          result = await this.#fill(
            c,
            acc,
            orow,
            current.mark,
            order.sl_price?.toFixed(10) || null,
            order.tp_price?.toFixed(10) || null,
          );
          /* post-fill evaluation: the opening fee and immediate PnL can
             breach daily/total limits or complete the profit target.
             #fill updated the row — evaluate the CURRENT balance/margin. */
          if (acc.account_type === 'challenge') {
            const current = (await c.query('SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE', [acc.id])).rows[0]
            const transition = await this.#challengeRiskTx(c, current)
            if (transition) {
              result.challenge_transition = transition
              result.position = (await this.#positionByIdTx(c, result.position.id)) ?? result.position
            }
          }
          await c.query("COMMIT");
        } else {
          await c.query("COMMIT");
          result = { ok: true, order: orow, position: null, pending: true };
        }
        this.emit(account.id);
        return result;
      } catch (e) {
        await c.query("ROLLBACK").catch(() => {});
        /* unique idempotency race → return the winner */
        if (String(e.code) === "23505" && idempotencyKey) {
          const { rows } = await this.pool.query(
            "SELECT * FROM trading_orders WHERE user_id=$1 AND idempotency_key IN ($2,$3)",
            [userId, idempotencyKey, legacyKey],
          );
          if (rows[0])
            return duplicate(
              rows[0],
              req,
              rows[0].position_id
                ? await this.#positionById(rows[0].position_id)
                : null,
            );
        }
        throw e;
      } finally {
        c.release();
      }
    });
  }

  /* fill an order at `price` — inside the caller's transaction.
     Gains-aligned: entry gets the fixed spread applied (buy above mark for
     a long, sell below for a short); the opening fee is the market's
     per-class tier on the initial notional; the notional itself is NOT
     shrunk by fees (v10 behaviour). */
  async #fill(c, acc, orow, price, sl, tp, applySpread = true) {
    const meta = this.md.marketMeta(orow.market)
    /* market orders pay the fixed spread on top of the mark; limit/stop
       orders fill AT the trader's chosen target price (no extra spread) */
    const execPrice = applySpread ? withSpread(price, orow.side, 'open', meta, orow.market) : D(price)
    const margin = D(orow.margin), lev = Number(orow.leverage)
    const notional = margin.times(lev)
    const spec=instrumentSpec(meta,orow.market)
    const qty = notional.div(execPrice).toDecimalPlaces(spec.quantityPrecision,Decimal.ROUND_DOWN)
    if (qty.lte(0) || qty.gte('100000000000000')) throw Object.assign(new Error('position_size_out_of_range'), {status:400})
    const fee = notional.times(D(feePct(meta, orow.market))).div(100)
    price = execPrice.toString()

    /* balance -= open fee; used_margin += margin */
    const newBal = D(acc.balance).minus(fee)
    const newUsed = D(acc.used_margin).plus(margin)
    await c.query('UPDATE demo_accounts SET balance=$1, used_margin=$2, updated_at=now() WHERE id=$3',
      [newBal.toFixed(10), newUsed.toFixed(10), acc.id])

    const { rows: prows } = await c.query(
      `INSERT INTO trading_positions (order_id, account_id, user_id, market, side, quantity,
         entry_price, margin, leverage, sl_price, tp_price, status, open_fee)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'open',$12) RETURNING *`,
      [orow.id, acc.id, orow.user_id, orow.market, orow.side, qty.toFixed(10), D(price).toFixed(10),
       margin.toFixed(10), lev, sl, tp, fee.toFixed(10)])
    const pos = prows[0]

    await c.query('UPDATE trading_orders SET status=$1, filled_price=$2, position_id=$3, updated_at=now() WHERE id=$4',
      ['filled', D(price).toFixed(10), pos.id, orow.id])
    await c.query(
      `INSERT INTO trading_ledger (account_id, user_id, event, position_id, amount, balance_after, meta)
       VALUES ($1,$2,'open_fee',$3,$4,$5,$6)`,
      [acc.id, orow.user_id, pos.id, fee.negated().toFixed(10), newBal.toFixed(10),
       JSON.stringify({ market: orow.market, side: orow.side, leverage: lev, entry: price })])
    await c.query(`INSERT INTO trading_events (account_id, kind, detail) VALUES ($1,'order_filled',$2)`,
      [acc.id, JSON.stringify({ order: orow.id, position: pos.id, market: orow.market, entry: price, qty: qty.toFixed(10) })])

    const filled = (await c.query('SELECT * FROM trading_orders WHERE id=$1', [orow.id])).rows[0]
    return { ok: true, order: filled, position: this.#positionView(pos), pending: false }
  }

  async #positionById(id) {
    return this.#positionByIdTx(this.pool, id)
  }
  async #positionByIdTx(c, id) {
    const { rows } = await c.query('SELECT * FROM trading_positions WHERE id=$1', [id])
    return rows[0] ? this.#positionView(rows[0]) : null
  }

  /* =========================================================
   * POSITION MANAGEMENT
   * ======================================================= */

  async closePosition(userId, positionId, { fraction = 1, idempotencyKey = null } = {}) {
    let f
    try { f = D(fraction) } catch {}
    if (!f?.isFinite() || f.lte(0) || f.gt(1)) throw Object.assign(new Error('invalid_fraction'), { status: 400 })
    if (f.lt(1) && !idempotencyKey) throw Object.assign(new Error('idempotency_key_required'), { status: 400 })
    if (idempotencyKey && (typeof idempotencyKey !== 'string' || idempotencyKey.length > 160)) throw Object.assign(new Error('invalid_idempotency_key'), { status: 400 })
    /* the account is derived from the owned position itself, so closing
       works identically on free_demo and challenge accounts */
    const owned = (await this.pool.query(
      'SELECT account_id FROM trading_positions WHERE id=$1 AND user_id=$2', [positionId, userId])).rows[0]
    if (!owned) throw Object.assign(new Error('not_found'), { status: 404 })
    return withAccountLock(owned.account_id, async () => {
      const c = await this.pool.connect()
      try {
        await c.query('BEGIN')
        const locked = (await c.query('SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE', [owned.account_id])).rows[0]
        if (locked.status === 'permanently_disabled') throw Object.assign(new Error('account_permanently_disabled'),{status:403})
        if (idempotencyKey) {
          const previous = (await c.query('SELECT * FROM position_close_requests WHERE account_id=$1 AND request_key=$2', [locked.id, idempotencyKey])).rows[0]
          if (previous) {
            if (previous.position_id !== positionId || !D(previous.fraction).eq(f)) throw Object.assign(new Error('idempotency_conflict'), { status: 409 })
            await c.query('COMMIT'); return { ...previous.result, duplicate: true }
          }
        }
        let pos = (await c.query('SELECT * FROM trading_positions WHERE id=$1 FOR UPDATE', [positionId])).rows[0]
        if (!pos || pos.user_id !== userId) { await c.query('ROLLBACK'); throw Object.assign(new Error('not_found'), { status: 404 }) }
        if (pos.status !== 'open') { await c.query('ROLLBACK'); return { duplicate: true, position: this.#positionView(pos) } }
        const t = this.md.tradeable(pos.market)
        if (!t.ok) { await c.query('ROLLBACK'); throw Object.assign(new Error(t.reason), { status: 409 }) }
        if (f.lt(1)) {
          const precision = this.md.marketMeta(pos.market)?.sizePrecision ?? 10
          const qty = D(pos.quantity).times(f).toDecimalPlaces(precision,Decimal.ROUND_DOWN)
          const allocated = qty.div(pos.quantity)
          const margin = D(pos.margin).times(allocated).toDecimalPlaces(10)
          const fee = D(pos.open_fee).times(allocated).toDecimalPlaces(10)
          if (qty.lte(0) || margin.lt(SIM.MIN_MARGIN) || D(pos.margin).minus(margin).lt(SIM.MIN_MARGIN)) throw Object.assign(new Error('partial_close_too_small'), { status: 400 })
          const { rows } = await c.query(`INSERT INTO trading_positions
            (order_id,account_id,user_id,market,side,quantity,entry_price,margin,leverage,sl_price,tp_price,open_fee,opened_at,parent_position_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            [pos.order_id,pos.account_id,pos.user_id,pos.market,pos.side,qty.toFixed(10),pos.entry_price,margin.toFixed(10),pos.leverage,pos.sl_price,pos.tp_price,fee.toFixed(10),pos.opened_at,pos.id])
          await c.query('UPDATE trading_positions SET quantity=quantity-$1, margin=margin-$2, open_fee=open_fee-$3 WHERE id=$4', [qty.toFixed(10),margin.toFixed(10),fee.toFixed(10),pos.id])
          pos = rows[0]
        }
        const out = await this.#closeTx(c, pos, t.mark, f.lt(1) ? 'partial' : 'manual')
        await this.#trialRiskTx(c,(await c.query('SELECT * FROM demo_accounts WHERE id=$1',[locked.id])).rows[0])
        /* post-close evaluation: realized profit can complete a target,
           and the realized loss can breach a limit */
        if (locked.account_type === 'challenge') await this.#challengeRiskTx(c, (await c.query('SELECT * FROM demo_accounts WHERE id=$1',[locked.id])).rows[0])
        if (idempotencyKey) await c.query('INSERT INTO position_close_requests (account_id,request_key,position_id,fraction,result) VALUES ($1,$2,$3,$4,$5)', [locked.id,idempotencyKey,positionId,f.toString(),JSON.stringify(out)])
        await c.query('COMMIT')
        this.emit(locked.id)
        return out
      } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e } finally { c.release() }
    })
  }

  async updateProtection(userId, positionId, { sl, tp }) {
    const owned = (await this.pool.query(
      'SELECT account_id FROM trading_positions WHERE id=$1 AND user_id=$2', [positionId, userId])).rows[0]
    if (!owned) throw Object.assign(new Error('not_found'), { status: 404 })
    return this.#mutateOwned(userId, owned.account_id, async (c, account) => {
      const pos = (await c.query('SELECT * FROM trading_positions WHERE id=$1 AND user_id=$2 FOR UPDATE', [positionId, userId])).rows[0]
      if (!pos) throw Object.assign(new Error('not_found'), { status: 404 })
      if (pos.status !== 'open') throw Object.assign(new Error('position_not_open'), { status: 409 })
      const m = freshMark(this.md, pos.market)
      if (!m) throw Object.assign(new Error('stale_price'), { status: 409 })
      let slD, tpD
      try { slD = sl != null ? D(sl) : null; tpD = tp != null ? D(tp) : null } catch { throw Object.assign(new Error('invalid_numeric_input'), { status: 400 }) }
      for (const v of [slD,tpD]) if (v && (!v.isFinite() || v.lte(0) || v.gt('1000000000000'))) throw Object.assign(new Error('invalid_numeric_input'), { status: 400 })
      const mark = D(m.mark)
      if (slD && (pos.side === 'long' ? slD.gte(mark) : slD.lte(mark))) throw Object.assign(new Error(pos.side === 'long' ? 'sl_above_mark' : 'sl_below_mark'), { status: 400 })
      if (tpD && (pos.side === 'long' ? tpD.lte(mark) : tpD.gte(mark))) throw Object.assign(new Error(pos.side === 'long' ? 'tp_below_mark' : 'tp_above_mark'), { status: 400 })
      await c.query("UPDATE trading_positions SET sl_price=$1,tp_price=$2 WHERE id=$3", [slD?.toFixed(10) ?? null,tpD?.toFixed(10) ?? null,positionId])
      await c.query("INSERT INTO trading_events (account_id,kind,detail) VALUES ($1,'protection_updated',$2)", [account.id,JSON.stringify({position:positionId,sl,tp})])
      return { ok: true }
    })
  }

  async cancelOrder(userId, orderId) {
    const owned = (await this.pool.query(
      'SELECT account_id FROM trading_orders WHERE id=$1 AND user_id=$2', [orderId, userId])).rows[0]
    if (!owned) throw Object.assign(new Error('not_found'), { status: 404 })
    return this.#mutateOwned(userId, owned.account_id, async (c, account) => {
      const order = (await c.query('SELECT * FROM trading_orders WHERE id=$1 AND user_id=$2 FOR UPDATE', [orderId,userId])).rows[0]
      if (!order) throw Object.assign(new Error('not_found'), { status: 404 })
      if (order.status === 'cancelled') return { ok: true, duplicate: true, order }
      if (order.status !== 'pending') throw Object.assign(new Error('order_not_pending'), { status: 409 })
      const {rows} = await c.query("UPDATE trading_orders SET status='cancelled', updated_at=now() WHERE id=$1 RETURNING *", [orderId])
      await c.query("INSERT INTO trading_events (account_id,kind,detail) VALUES ($1,'order_cancelled',$2)", [account.id,JSON.stringify({order:orderId})])
      return { ok: true, order:rows[0] }
    })
  }

  async #mutateOwned(userId, accountId, fn) {
    return withAccountLock(accountId, async () => {
      const c = await this.pool.connect()
      try {
        await c.query('BEGIN')
        const locked = (await c.query('SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE',[accountId])).rows[0]
        if (locked.status === 'permanently_disabled') throw Object.assign(new Error('account_permanently_disabled'),{status:403})
        const out = await fn(c,locked)
        await c.query('COMMIT'); this.emit(accountId); return out
      } catch(e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
    })
  }

  /* =========================================================
   * MONITORING LOOP — pending orders, SL/TP, liquidation
   * (runs even with no browser open)
   * ======================================================= */

  async loop() {
    if (!this.running || this.loopBusy) return;
    this.loopBusy = true;
    let done; this.loopPass = new Promise(r => { done = r });
    try {
      for (const { user_id } of (
        await this.pool.query(
          "SELECT a.user_id FROM demo_accounts a WHERE a.account_type='free_demo' AND a.status='active' AND (a.balance<=0 OR EXISTS(SELECT 1 FROM trading_positions p WHERE p.account_id=a.id AND p.status='open'))",
        )
      ).rows) {
        await this.enforceTrialRisk(user_id);
        await this.#sampleTrialEquity(user_id);
      }
      /* challenge evaluation: accounts with live positions (equity moves
         with the marks) and challenges that have reached their time limit */
      for (const { id } of (
        await this.pool.query(
          `SELECT a.id FROM demo_accounts a
             JOIN openfund_challenges c ON c.demo_account_id = a.id
            WHERE a.account_type='challenge' AND a.status='active' AND c.status='started'
              AND (EXISTS(SELECT 1 FROM trading_positions p WHERE p.account_id=a.id AND p.status='open')
                   OR c.expires_at <= now())`,
        )
      ).rows) {
        await this.enforceChallengeRisk(id).catch(console.error);
      }
      /* terminal challenge accounts whose breach settlement could not close
         a position (market closed / no tradeable quote at that moment):
         finish the settlement as soon as the market is tradeable again */
      for (const { id } of (
        await this.pool.query(
          `SELECT DISTINCT a.id FROM demo_accounts a
             JOIN trading_positions p ON p.account_id = a.id AND p.status = 'open'
            WHERE a.account_type = 'challenge' AND a.status = 'closed'`,
        )
      ).rows) {
        await withAccountLock(id, () => this.#settleOrphans(id)).catch(console.error);
      }
      const pending = await this.pool.query(
        `SELECT o.*, a.balance, a.used_margin FROM trading_orders o
         JOIN demo_accounts a ON a.id = o.account_id
        WHERE o.status='pending'`,
      );
      for (const o of pending.rows) {
        if (this.#shouldTrigger(o)) {
          await withAccountLock(o.account_id, () =>
            this.#triggerPending(o).catch(console.error),
          );
        }
      }
      const open = await this.pool.query(
        `SELECT p.*, a.balance FROM trading_positions p
         JOIN demo_accounts a ON a.id = p.account_id
        WHERE p.status='open'`,
      );
      for (const p of open.rows) {
        const m = freshMark(this.md, p.market);
        if (!m) continue;
        const mark = D(m.mark);
        const pnl = positionMetrics(p, this.md).net;
        const margin = D(p.margin);
        const reason = this.#exitReason(p, mark, pnl, margin);
        if (reason) {
          await withAccountLock(p.account_id, () =>
            this.#autoExit(p, mark, reason).catch(console.error),
          );
        }
      }
    } finally {
      this.loopBusy = false;
      this.loopPass = null; done();
    }
  }

  #shouldTrigger(o) {
    const t = this.md.tradeable(o.market)
    const m = t.ok ? { mark: t.mark } : null
    if (!m) return false
    const mark = D(m.mark), target = D(o.target_price)
    if (o.order_type === 'limit') {
      return o.side === 'long' ? mark.lte(target) : mark.gte(target)
    } /* stop */
    return o.side === 'long' ? mark.gte(target) : mark.lte(target)
  }

  #exitReason(p, mark, pnl, margin) {
    if (p.sl_price != null) {
      const sl = D(p.sl_price)
      if (p.side === 'long' ? mark.lte(sl) : mark.gte(sl)) return 'sl'
    }
    if (p.tp_price != null) {
      const tp = D(p.tp_price)
      if (p.side === 'long' ? mark.gte(tp) : mark.lte(tp)) return 'tp'
    }
    /* liquidation: margin + unrealized ≤ maintenance level */
    const maint = margin.times(D(SIM.MAINT_PCT)).div(100)
    if (margin.plus(pnl).lte(maint)) return 'liquidation'
    return null
  }

  async #triggerPending(o) {
    const c = await this.pool.connect()
    try {
      await c.query('BEGIN')
      await c.query('SELECT id FROM demo_accounts WHERE id=$1 FOR UPDATE', [o.account_id])
      const cur = (await c.query('SELECT * FROM trading_orders WHERE id=$1 FOR UPDATE', [o.id])).rows[0]
      if (!cur || cur.status !== 'pending' || !this.#shouldTrigger(cur)) { await c.query('ROLLBACK'); return }
      const acc = (await c.query('SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE', [cur.account_id])).rows[0]
      const owner = (await c.query('SELECT status FROM openfund_users WHERE id=$1', [cur.user_id])).rows[0]
      if (acc.status !== 'active' || owner?.status !== 'active') { await c.query('ROLLBACK'); return }
      const open = (await c.query("SELECT * FROM trading_positions WHERE account_id=$1 AND status='open'", [acc.id])).rows
      const view = accountMetrics(acc, open, this.md)
      const free = Decimal.min(D(acc.balance).minus(acc.used_margin), D(view.free_margin ?? 0))
      const margin = D(cur.margin)
      const fee = margin.times(cur.leverage).times(feePct(this.md.marketMeta(cur.market), cur.market)).div(100)
      if (margin.plus(fee).gt(free)) {
        await c.query(`UPDATE trading_orders SET status='rejected', reject_reason='insufficient_margin', updated_at=now() WHERE id=$1`, [cur.id])
        await c.query('COMMIT')
        this.emit(acc.id)
        return
      }
      /* fills at the target price (deterministic; documented assumption) */
      const live = this.md.tradeable(cur.market)
      if (!live.ok) { await c.query('ROLLBACK'); return }
      await c.query("INSERT INTO trading_events(account_id,kind,detail) VALUES ($1,'order_triggered',$2)",[acc.id,JSON.stringify({order:cur.id,mark:live.mark})])
      await this.#fill(c, acc, cur, cur.order_type === 'stop' ? live.mark : D(cur.target_price).toString(), cur.sl_price, cur.tp_price, cur.order_type === 'stop')
      if (acc.account_type === 'challenge') await this.#challengeRiskTx(c, (await c.query('SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE', [acc.id])).rows[0])
      await c.query('COMMIT')
      this.emit(acc.id)
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e } finally { c.release() }
  }

  async #settleOrphans(accountId) {
    const c = await this.pool.connect()
    try {
      await c.query('BEGIN')
      const acc = (await c.query('SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE', [accountId])).rows[0]
      if (!acc || acc.account_type !== 'challenge' || acc.status !== 'closed') { await c.query('ROLLBACK'); return }
      let settled = 0
      for (const p of (await c.query("SELECT * FROM trading_positions WHERE account_id=$1 AND status='open' ORDER BY id FOR UPDATE", [accountId])).rows) {
        const m = freshMark(this.md, p.market)
        if (!m || !this.md.tradeable(p.market).ok) continue
        await this.#closeTx(c, p, m.mark, 'challenge_settlement')
        settled++
      }
      if (settled) await c.query("INSERT INTO trading_events(account_id,kind,detail) VALUES ($1,'challenge_settlement_completed',$2)", [accountId, JSON.stringify({ settled })])
      await c.query('COMMIT')
      if (settled) this.emit(accountId)
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e } finally { c.release() }
  }

  async #autoExit(p, mark, reason) {
    const c = await this.pool.connect()
    try {
      await c.query('BEGIN')
      await c.query('SELECT id FROM demo_accounts WHERE id=$1 FOR UPDATE', [p.account_id])
      const cur = (await c.query('SELECT * FROM trading_positions WHERE id=$1 FOR UPDATE', [p.id])).rows[0]
      if (!cur || cur.status !== 'open') { await c.query('ROLLBACK'); return }
      const m = freshMark(this.md, cur.market)
      if (!m || !this.md.tradeable(cur.market).ok) { await c.query('ROLLBACK'); return }
      const currentReason = this.#exitReason(cur, D(m.mark), positionMetrics(cur, this.md).net, D(cur.margin))
      if (!currentReason) { await c.query('ROLLBACK'); return }
      await this.#closeTx(c, cur, m.mark, currentReason)
      await this.#trialRiskTx(c,(await c.query('SELECT * FROM demo_accounts WHERE id=$1',[p.account_id])).rows[0])
      if ((await c.query('SELECT account_type FROM demo_accounts WHERE id=$1',[p.account_id])).rows[0].account_type === 'challenge')
        await this.#challengeRiskTx(c,(await c.query('SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE',[p.account_id])).rows[0])
      await c.query('COMMIT')
      this.emit(p.account_id)
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e } finally { c.release() }
  }

  /* close a position at `price` (mark) for `reason` — inside the caller's
     transaction. Gains-aligned: the closing fee is charged on the INITIAL
     position size (margin × leverage, not the exit value), and the exit
     execution price carries the fixed spread (long closes selling below
     mark, short closes buying above mark). */
  async #closeTx(c, pos, price, reason) {
    const meta = this.md.marketMeta(pos.market)
    const execPrice = withSpread(price, pos.side, 'close', meta, pos.market)
    const qty = D(pos.quantity), entry = D(pos.entry_price), margin = D(pos.margin)
    const initialNotional = margin.times(pos.leverage)
    const closeFee = initialNotional.times(D(feePct(meta, pos.market))).div(100)
    const gross = this.#pnl(qty, entry, execPrice, pos.side)
    const net = gross.minus(closeFee)
    price = execPrice.toString()

    const acc = (await c.query('SELECT * FROM demo_accounts WHERE id=$1 FOR UPDATE', [pos.account_id])).rows[0]
    const newBal = D(acc.balance).plus(net)
    const newUsed = D(acc.used_margin).minus(margin)
    const newRealized = D(acc.realized_pnl).plus(net)

    await c.query('UPDATE demo_accounts SET balance=$1, used_margin=$2, realized_pnl=$3, updated_at=now() WHERE id=$4',
      [newBal.toFixed(10), newUsed.toFixed(10), newRealized.toFixed(10), acc.id])
    await c.query(
      `UPDATE trading_positions SET status=$1, exit_price=$2, exit_reason=$3, close_fee=$4,
         realized_pnl=$5, closed_at=now() WHERE id=$6`,
      [reason === 'liquidation' ? 'liquidated' : 'closed', D(price).toFixed(10), reason,
       closeFee.toFixed(10), net.toFixed(10), pos.id])
    await c.query(
      `INSERT INTO trading_ledger (account_id, user_id, event, position_id, amount, balance_after, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [acc.id, pos.user_id, reason === 'liquidation' ? 'liquidation' : 'close', pos.id,
       net.toFixed(10), newBal.toFixed(10),
       JSON.stringify({ market: pos.market, side: pos.side, entry: entry.toString(), exit: price, reason, parent_position_id:pos.parent_position_id || null, allocated_open_fee:pos.open_fee })])
    await c.query(`INSERT INTO trading_events (account_id, kind, detail) VALUES ($1,'position_closed',$2)`,
      [acc.id, JSON.stringify({ position: pos.id, market: pos.market, reason, entry: entry.toString(), exit: price, net: net.toFixed(10) })])

    return { ok: true, position: this.#positionView((await c.query('SELECT * FROM trading_positions WHERE id=$1', [pos.id])).rows[0]) }
  }
}

export function newId() { return crypto.randomUUID() }
