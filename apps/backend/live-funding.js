/**
 * Openfund Live Market Access.
 *
 * Selected traders may trade Openfund-owned capital. This module is the
 * control plane: eligibility from system records, management approval,
 * capital allocation gated by VERIFIED allocatable capital ≥ $500,000,
 * pre-trade risk checks, execution through an adapter, realized-PnL
 * finalization and profit-share settlement.
 *
 * SAFETY DEFAULTS
 *  - LIVE_EXECUTION_ADAPTER defaults to 'none': every order is refused.
 *  - 'sandbox' is a NON-MONETARY adapter (fills at the server's mark,
 *    nothing leaves the backend). It is refused when NODE_ENV=production.
 *  - 'gains' is reserved: on-chain Gains execution needs an approved
 *    signer, supported testnet contracts and transaction simulation
 *    (AGENTS.md). Until then the adapter reports `adapter_unavailable`.
 *  - LIVE_SETTLEMENT_ADAPTER defaults to 'none': settlements are recorded
 *    and stay 'pending'. 'sandbox' completes them with a labelled
 *    non-monetary reference. No real transfer exists in this code.
 *  - Every money transition is in a transaction with row locks and a
 *    UNIQUE key (trade idempotency key, one share per trade, one
 *    settlement per beneficiary per share), so retries never double-pay.
 */
import { Router } from 'express'
import crypto from 'node:crypto'
import { adminAuth, adminActor } from './admin.js'
import { financialAudit } from './financial-audit.js'
import { computeFinancialPosition } from './economy.js'
import { checkLiveOrder, applyRealized, distributeProfit, evaluateLiveEligibility, programCapacity, PROFIT_SHARE_TIERS, D, usd } from './economy-math.js'
import { feePct } from './trading-math.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail = (status, error) => Object.assign(new Error(error), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const MAX_SETTLEMENT_ATTEMPTS = 5

export function liveConfig(env = process.env) {
  const exec = ['sandbox', 'gains'].includes(env.LIVE_EXECUTION_ADAPTER) ? env.LIVE_EXECUTION_ADAPTER : 'none'
  const settle = env.LIVE_SETTLEMENT_ADAPTER === 'sandbox' ? 'sandbox' : 'none'
  const prod = env.NODE_ENV === 'production'
  return {
    execution: prod && exec === 'sandbox' ? 'none' : exec,
    settlement: prod && settle === 'sandbox' ? 'none' : settle,
    sandboxRefusedInProduction: prod && (exec === 'sandbox' || settle === 'sandbox'),
  }
}

/* ------------------------------------------------------------------ */
/* Execution adapters                                                  */
/* ------------------------------------------------------------------ */
export function executionAdapter(name, { marketData } = {}) {
  if (name === 'sandbox') return {
    name: 'sandbox', monetary: false,
    async open({ market, side, collateralUsd, leverage }) {
      const t = marketData.tradeable(market)
      if (!t.ok) return { status: 'rejected', reason: t.reason }
      const fee = D(collateralUsd).mul(leverage).mul(feePct(t.meta, market)).div(100)
      return { status: 'open', entryPrice: t.mark, externalOrderId: `sandbox:${crypto.randomUUID()}`, openFeeUsd: usd(fee) }
    },
    async close(trade) {
      const t = marketData.tradeable(trade.market)
      if (!t.ok) return { status: 'retry', reason: t.reason }
      const exit = D(t.mark), entry = D(trade.entry_price)
      const notional = D(trade.collateral_usd).mul(trade.leverage)
      const move = trade.side === 'long' ? exit.minus(entry).div(entry) : entry.minus(exit).div(entry)
      /* isolated margin: loss is capped at the posted collateral */
      let gross = notional.mul(move)
      if (gross.lt(D(trade.collateral_usd).neg())) gross = D(trade.collateral_usd).neg()
      const closeFee = notional.mul(feePct(t.meta, trade.market)).div(100)
      return { status: 'closed', exitPrice: t.mark, realizedPnlUsd: usd(gross), tradingFeesUsd: usd(D(trade.open_fee || 0).plus(closeFee)), executionCostsUsd: '0.00' }
    },
  }
  if (name === 'gains') return {
    name: 'gains', monetary: true,
    async open() { return { status: 'rejected', reason: 'adapter_unavailable' } },
    async close() { return { status: 'retry', reason: 'adapter_unavailable' } },
  }
  return null
}

export function settlementAdapter(name) {
  if (name === 'sandbox') return { name: 'sandbox', async pay(s) { return { ok: true, reference: `sandbox-settlement:${s.id}` } } }
  return null
}

/* ------------------------------------------------------------------ */
/* Eligibility from system records                                     */
/* ------------------------------------------------------------------ */
/**
 * Purchased-account lineages. A two-phase purchase continues in the
 * stage-2 row the engine provisions on stage-1 pass (same user, plan,
 * size; first such row created after the stage-1 completion). The
 * account of record for withdrawals is the final passed stage.
 */
export async function accountLineages(db, userId) {
  const { rows } = await db.query(
    `SELECT o.id AS order_id, o.account_size_usd, o.paid_at, c.id AS challenge_id, c.status, c.stage, c.challenge_plan_id,
            c.completed_at, coalesce((c.rules_snapshot->>'phases')::int, 0) AS phases
       FROM purchase_orders o JOIN openfund_challenges c ON c.purchase_order_id=o.id
      WHERE o.user_id=$1 AND o.status='paid' ORDER BY o.paid_at, o.id`, [userId])
  const out = []
  for (const r of rows) {
    let final = r
    if (r.phases >= 2 && r.status === 'passed' && r.completed_at) {
      const { rows: [s2] } = await db.query(
        `SELECT id AS challenge_id, status, stage FROM openfund_challenges
          WHERE user_id=$1 AND challenge_plan_id=$2 AND stage=2 AND account_size_usd=$3 AND purchase_order_id IS NULL
            AND created_at >= $4::timestamptz - interval '5 seconds' ORDER BY created_at LIMIT 1`,
        [userId, r.challenge_plan_id, r.account_size_usd, r.completed_at])
      final = s2 ? { ...r, ...s2 } : { ...r, status: 'stage_2_missing' }
    }
    const evaluationPassed = r.phases >= 1 && final.status === 'passed'
    const { rows: [w] } = await db.query(`SELECT count(*)::int AS n FROM withdrawal_requests WHERE challenge_id=$1 AND status='paid'`, [final.challenge_id])
    out.push({ orderId: r.order_id, sizeUsd: r.account_size_usd, phases: r.phases, evaluationPassed, fundedChallengeId: evaluationPassed ? final.challenge_id : null, paidWithdrawals: evaluationPassed ? w.n : 0 })
  }
  return out
}

export async function coachState(db, userId) {
  const { rows: [l] } = await db.query(
    `SELECT l.id, l.coach_user_id, l.status, l.qualification, c.status AS coach_status
       FROM trader_coach_links l JOIN coach_profiles c ON c.user_id=l.coach_user_id
      WHERE l.trader_user_id=$1 AND l.status='active' LIMIT 1`, [userId])
  return l ? { linkId: l.id, coachUserId: l.coach_user_id, linkActive: true, coachActive: l.coach_status === 'active', qualificationVerified: l.qualification === 'verified' } : null
}

export async function liveEligibility(db, userId) {
  const accounts = await accountLineages(db, userId)
  const coach = await coachState(db, userId)
  return { ...evaluateLiveEligibility({ accounts, coach }), coach, fundedDefinition: 'final evaluation stage passed; instant (no evaluation) accounts do not qualify' }
}

/** Default limits from the funded account policy; admin may only tighten. */
async function policyLimits(db, eligibility) {
  const id = eligibility.secondAccount?.fundedChallengeId || eligibility.firstAccount?.fundedChallengeId
  const { rows: [c] } = id ? await db.query(`SELECT rules_snapshot FROM openfund_challenges WHERE id=$1`, [id]) : { rows: [] }
  const r = c?.rules_snapshot || {}
  return { dailyDrawdownPct: Number(r.dailyLossPct) || null, maxDrawdownPct: Number(r.maxTotalLossPct) || null }
}

export function validateLimits(input, policy) {
  const l = {
    dailyDrawdownPct: Number(input?.dailyDrawdownPct ?? policy.dailyDrawdownPct),
    maxDrawdownPct: Number(input?.maxDrawdownPct ?? policy.maxDrawdownPct),
    maxLeverage: Number(input?.maxLeverage), maxExposureUsd: String(input?.maxExposureUsd ?? ''),
    maxOpenPositions: input?.maxOpenPositions == null ? null : Number(input.maxOpenPositions),
    maxSlippageBps: input?.maxSlippageBps == null ? null : Number(input.maxSlippageBps),
  }
  if (!(l.dailyDrawdownPct > 0 && l.dailyDrawdownPct < 100) || !(l.maxDrawdownPct > 0 && l.maxDrawdownPct < 100)) throw fail(400, 'invalid_drawdown_limits')
  if (policy.dailyDrawdownPct && l.dailyDrawdownPct > policy.dailyDrawdownPct) throw fail(400, 'daily_limit_looser_than_policy')
  if (policy.maxDrawdownPct && l.maxDrawdownPct > policy.maxDrawdownPct) throw fail(400, 'max_limit_looser_than_policy')
  if (!(l.maxLeverage >= 1 && l.maxLeverage <= 150)) throw fail(400, 'invalid_max_leverage')
  if (!D(l.maxExposureUsd || 0).gt(0)) throw fail(400, 'invalid_max_exposure')
  if (l.maxOpenPositions != null && !(Number.isInteger(l.maxOpenPositions) && l.maxOpenPositions >= 1)) throw fail(400, 'invalid_max_open_positions')
  return l
}

/* ------------------------------------------------------------------ */
/* Finalization and settlement                                         */
/* ------------------------------------------------------------------ */
/**
 * Records a VERIFIED close result exactly once: realized PnL on the trade,
 * allocation equity/circuit breaker, and — only when distributable profit
 * is positive — one profit-share allocation plus trader/coach settlements.
 */
export async function finalizeTrade(pool, tradeId, result, actor = 'system') {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: [t] } = await client.query(`SELECT * FROM live_trades WHERE id=$1 FOR UPDATE`, [tradeId])
    if (!t) throw fail(404, 'trade_not_found')
    if (t.finalized_at) { await client.query('COMMIT'); return { duplicate: true } }
    if (!['open', 'closing', 'reconcile_required'].includes(t.status)) throw fail(409, `trade_${t.status}_not_closable`)
    for (const k of ['realizedPnlUsd', 'tradingFeesUsd', 'executionCostsUsd']) if (!D(result[k] ?? 'x').isFinite()) throw fail(400, 'unverified_close_result')
    const { rows: [alloc] } = await client.query(`SELECT * FROM capital_allocations WHERE id=$1 FOR UPDATE`, [t.allocation_id])
    const { rows: [approval] } = await client.query(`SELECT * FROM live_funding_approvals WHERE id=$1`, [alloc.approval_id])
    await client.query(
      `UPDATE live_trades SET status='closed', exit_price=$2, realized_pnl_usd=$3, trading_fees_usd=$4, execution_costs_usd=$5, close_tx_hash=$6, closed_at=now(), finalized_at=now() WHERE id=$1`,
      [t.id, result.exitPrice ?? null, usd(result.realizedPnlUsd), usd(result.tradingFeesUsd), usd(result.executionCostsUsd), result.txHash ?? null])
    const net = D(result.realizedPnlUsd).minus(D(result.tradingFeesUsd).abs()).minus(D(result.executionCostsUsd).abs())
    const today = new Date().toISOString().slice(0, 10)
    const next = applyRealized({
      allocation: { amountUsd: alloc.amount_usd, realizedPnlUsd: alloc.realized_pnl_usd, peakEquityUsd: alloc.peak_equity_usd, dayStartEquityUsd: alloc.day_start_equity_usd, day: alloc.day.toISOString?.().slice(0, 10) ?? String(alloc.day) },
      limits: alloc.risk_limits, realizedNetUsd: usd(net), today,
    })
    await client.query(
      `UPDATE capital_allocations SET realized_pnl_usd=$2, peak_equity_usd=$3, day_start_equity_usd=$4, day=$5,
              status=CASE WHEN $6::text IS NOT NULL AND status='active' THEN 'halted' ELSE status END, halt_reason=coalesce($6, halt_reason) WHERE id=$1`,
      [alloc.id, next.realizedPnlUsd, next.peakEquityUsd, next.dayStartEquityUsd, next.day, next.halt])
    await client.query(`INSERT INTO live_trade_events (live_trade_id, kind, detail) VALUES ($1,'finalized',$2)`, [t.id, JSON.stringify({ ...result, net: usd(net), halt: next.halt, actor })])
    let share = null
    const split = { trader: Number(approval.trader_pct), coach: Number(approval.coach_pct), openfund: Number(approval.openfund_pct) }
    const d = distributeProfit({ realizedPnlUsd: result.realizedPnlUsd, tradingFeesUsd: result.tradingFeesUsd, executionCostsUsd: result.executionCostsUsd, split })
    if (d.shares) {
      const { rows: [s] } = await client.query(
        `INSERT INTO profit_share_allocations (live_trade_id, approval_id, trader_user_id, coach_user_id, realized_pnl_usd, eligible_costs_usd, distributable_usd,
                trader_pct, coach_pct, openfund_pct, trader_amount_usd, coach_amount_usd, openfund_amount_usd)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [t.id, approval.id, t.trader_user_id, approval.coach_user_id, usd(result.realizedPnlUsd), d.costs, d.distributable, split.trader, split.coach, split.openfund, d.shares.trader, d.shares.coach, d.shares.openfund])
      for (const [role, uid, amount] of [['trader', t.trader_user_id, d.shares.trader], ['coach', approval.coach_user_id, d.shares.coach]])
        if (D(amount).gt(0)) await client.query(`INSERT INTO settlement_records (profit_share_id, beneficiary_role, beneficiary_user_id, amount_usd) VALUES ($1,$2,$3,$4)`, [s.id, role, uid, amount])
      await financialAudit(client, actor, 'profit_share_allocated', 'profit_share_allocation', s.id, null, { tradeId: t.id, ...d })
      share = { id: s.id, ...d }
    }
    await client.query('COMMIT')
    return { duplicate: false, net: usd(net), halt: next.halt, share }
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
}

/** Claims pending settlements (SKIP LOCKED) and pays them through the adapter. */
export async function processSettlements(pool, adapter) {
  if (!adapter) return { processed: 0, reason: 'settlement_adapter_not_configured' }
  /* a row stuck in 'processing' is never auto-retried: the transfer may have happened */
  await pool.query(`UPDATE settlement_records SET status='reconcile_required', last_error='processing_timeout', updated_at=now()
                     WHERE status='processing' AND updated_at < now() - interval '10 minutes'`)
  const { rows } = await pool.query(
    `UPDATE settlement_records SET status='processing', attempts=attempts+1, adapter=$1, updated_at=now()
      WHERE id IN (SELECT id FROM settlement_records WHERE status IN ('pending','failed') AND attempts < $2 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 20)
      RETURNING *`, [adapter.name, MAX_SETTLEMENT_ATTEMPTS])
  let processed = 0
  for (const s of rows) {
    try {
      const r = await adapter.pay(s)
      if (!r?.ok) throw new Error(r?.error || 'payment_failed')
      await pool.query(`UPDATE settlement_records SET status='completed', tx_hash=$2, settlement_reference=$3, completed_at=now(), updated_at=now(), last_error=NULL WHERE id=$1 AND status='processing'`,
        [s.id, r.txHash || null, r.reference || null])
      await financialAudit(pool, 'system', 'settlement_completed', 'settlement_record', s.id, null, { txHash: r.txHash || null, reference: r.reference || null, adapter: adapter.name })
      processed++
    } catch (e) {
      const status = s.attempts >= MAX_SETTLEMENT_ATTEMPTS ? 'reconcile_required' : 'failed'
      await pool.query(`UPDATE settlement_records SET status=$2, last_error=$3, updated_at=now() WHERE id=$1`, [s.id, status, String(e.message).slice(0, 300)])
    }
  }
  return { processed, claimed: rows.length }
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */
export function liveRoutes({ pool, requireAuth, treasury, marketData, limit, config = liveConfig() }) {
  const router = Router()
  const exec = () => executionAdapter(config.execution, { marketData })
  const capacity = async () => programCapacity(await computeFinancialPosition(pool, await treasury.view()))

  router.get('/live/status', wrap(async (req, res) => {
    res.json({ capacity: await capacity(), executionAdapter: config.execution, executionMonetary: config.execution === 'gains', settlementAdapter: config.settlement, sandboxRefusedInProduction: config.sandboxRefusedInProduction })
  }))

  router.get('/live/me', requireAuth, wrap(async (req, res) => {
    const uid = req.user.user_id
    const eligibility = await liveEligibility(pool, uid)
    const approval = (await pool.query(`SELECT id, status, tier, trader_pct, coach_pct, openfund_pct, requested_at, decided_at FROM live_funding_approvals WHERE trader_user_id=$1 ORDER BY requested_at DESC LIMIT 1`, [uid])).rows[0] || null
    const allocation = (await pool.query(`SELECT id, amount_usd, realized_pnl_usd, peak_equity_usd, day_start_equity_usd, risk_limits, status, halt_reason, adapter, created_at FROM capital_allocations WHERE trader_user_id=$1 ORDER BY created_at DESC LIMIT 1`, [uid])).rows[0] || null
    const trades = allocation ? (await pool.query(`SELECT id, market, side, collateral_usd, leverage, status, reject_reason, entry_price, exit_price, realized_pnl_usd, trading_fees_usd, execution_costs_usd, open_tx_hash, close_tx_hash, created_at, closed_at FROM live_trades WHERE allocation_id=$1 ORDER BY created_at DESC LIMIT 100`, [allocation.id])).rows : []
    const settlements = (await pool.query(`SELECT s.id, s.amount_usd, s.status, s.tx_hash, s.settlement_reference, s.created_at, s.completed_at, p.live_trade_id FROM settlement_records s JOIN profit_share_allocations p ON p.id=s.profit_share_id WHERE s.beneficiary_user_id=$1 AND s.beneficiary_role='trader' ORDER BY s.created_at DESC LIMIT 100`, [uid])).rows
    res.json({ eligibility: { eligible: eligibility.eligible, checks: eligibility.checks, fundedDefinition: eligibility.fundedDefinition }, approval, allocation, trades, settlements, executionAdapter: config.execution })
  }))

  router.post('/live/apply', requireAuth, limit(5), wrap(async (req, res) => {
    const e = await liveEligibility(pool, req.user.user_id)
    if (!e.eligible) throw fail(409, 'not_eligible')
    try {
      const { rows: [a] } = await pool.query(
        `INSERT INTO live_funding_approvals (trader_user_id, coach_user_id, eligibility) VALUES ($1,$2,$3) RETURNING id, status`,
        [req.user.user_id, e.coach.coachUserId, JSON.stringify(e)])
      await financialAudit(pool, `user:${req.user.user_id}`, 'live_access_requested', 'live_funding_approval', a.id, null, { checks: e.checks })
      res.status(201).json(a)
    } catch (err) { if (err.code === '23505') throw fail(409, 'request_already_open'); throw err }
  }))

  router.post('/live/orders', requireAuth, limit(30), wrap(async (req, res) => {
    const adapter = exec()
    if (!adapter) throw fail(403, 'live_execution_disabled')
    const { market, side, collateralUsd, leverage, idempotencyKey } = req.body || {}
    if (typeof market !== 'string' || !/^[A-Z0-9]{1,12}\/[A-Z0-9]{1,12}$/.test(market) || !['long', 'short'].includes(side)) throw fail(400, 'invalid_order')
    if (typeof idempotencyKey !== 'string' || !/^[\w-]{8,80}$/.test(idempotencyKey)) throw fail(400, 'idempotency_key_required')
    const client = await pool.connect()
    let trade
    try {
      await client.query('BEGIN')
      const { rows: [alloc] } = await client.query(
        `SELECT a.* FROM capital_allocations a JOIN live_funding_approvals p ON p.id=a.approval_id
          WHERE a.trader_user_id=$1 AND a.status IN ('active','halted') AND p.status='approved' FOR UPDATE OF a`, [req.user.user_id])
      if (!alloc) throw fail(403, 'no_active_allocation')
      const dup = (await client.query(`SELECT * FROM live_trades WHERE allocation_id=$1 AND idempotency_key=$2`, [alloc.id, idempotencyKey])).rows[0]
      if (dup) { await client.query('COMMIT'); return res.json({ trade: dup, duplicate: true }) }
      if (alloc.adapter !== adapter.name) throw fail(409, 'allocation_adapter_mismatch')
      const today = new Date().toISOString().slice(0, 10)
      const allocDay = alloc.day.toISOString?.().slice(0, 10) ?? String(alloc.day)
      if (allocDay !== today) {
        const equity = usd(D(alloc.amount_usd).plus(alloc.realized_pnl_usd))
        await client.query(`UPDATE capital_allocations SET day=$2, day_start_equity_usd=$3 WHERE id=$1`, [alloc.id, today, equity])
        alloc.day_start_equity_usd = equity
      }
      const open = (await client.query(`SELECT collateral_usd, leverage FROM live_trades WHERE allocation_id=$1 AND status IN ('submitted','open','closing','reconcile_required')`, [alloc.id])).rows
      const check = checkLiveOrder({
        allocation: { amountUsd: alloc.amount_usd, realizedPnlUsd: alloc.realized_pnl_usd, peakEquityUsd: alloc.peak_equity_usd, dayStartEquityUsd: alloc.day_start_equity_usd, status: alloc.status },
        limits: alloc.risk_limits, openTrades: open.map(o => ({ collateralUsd: o.collateral_usd, leverage: o.leverage })),
        order: { collateralUsd, leverage },
        feeEstimateUsd: usd(D(collateralUsd || 0).mul(leverage || 0).mul('0.002')),
      })
      if (!check.ok) {
        await financialAudit(client, `user:${req.user.user_id}`, 'live_order_rejected', 'capital_allocation', alloc.id, null, { reasons: check.reasons, market, side, collateralUsd, leverage })
        await client.query('COMMIT')
        throw fail(422, check.reasons[0])
      }
      trade = (await client.query(
        `INSERT INTO live_trades (allocation_id, trader_user_id, adapter, idempotency_key, market, side, collateral_usd, leverage) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [alloc.id, req.user.user_id, adapter.name, idempotencyKey, market, side, usd(collateralUsd), String(leverage)])).rows[0]
      await client.query(`INSERT INTO live_trade_events (live_trade_id, kind, detail) VALUES ($1,'submitted',$2)`, [trade.id, JSON.stringify({ check })])
      await client.query('COMMIT')
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }

    /* external call OUTSIDE the transaction; outcome recorded afterwards */
    let r
    try { r = await adapter.open({ market, side, collateralUsd: trade.collateral_usd, leverage: trade.leverage }) } catch (e) { r = { status: 'unknown', reason: e.message } }
    const status = r.status === 'open' ? 'open' : r.status === 'rejected' ? 'rejected' : 'reconcile_required'
    const { rows: [updated] } = await pool.query(
      `UPDATE live_trades SET status=$2, reject_reason=$3, entry_price=$4, external_order_id=$5, open_tx_hash=$6, opened_at=CASE WHEN $2='open' THEN now() END WHERE id=$1 RETURNING *`,
      [trade.id, status, r.reason || null, r.entryPrice || null, r.externalOrderId || null, r.txHash || null])
    await pool.query(`INSERT INTO live_trade_events (live_trade_id, kind, detail) VALUES ($1,$2,$3)`, [trade.id, status, JSON.stringify(r)])
    if (r.openFeeUsd) await pool.query(`INSERT INTO live_trade_events (live_trade_id, kind, detail) VALUES ($1,'open_fee',$2)`, [trade.id, JSON.stringify({ feeUsd: r.openFeeUsd })])
    res.status(status === 'rejected' ? 422 : 200).json({ trade: updated, adapter: adapter.name, monetary: adapter.monetary })
  }))

  router.post('/live/trades/:id/close', requireAuth, limit(30), wrap(async (req, res) => {
    const adapter = exec()
    if (!adapter) throw fail(403, 'live_execution_disabled')
    if (!uuid.test(req.params.id)) throw fail(404, 'trade_not_found')
    const { rows: [t] } = await pool.query(
      `UPDATE live_trades SET status='closing' WHERE id=$1 AND trader_user_id=$2 AND status='open' RETURNING *`, [req.params.id, req.user.user_id])
    if (!t) throw fail(409, 'trade_not_open')
    const fee = (await pool.query(`SELECT detail->>'feeUsd' AS fee FROM live_trade_events WHERE live_trade_id=$1 AND kind='open_fee'`, [t.id])).rows[0]?.fee || '0'
    let r
    try { r = await adapter.close({ ...t, open_fee: fee }) } catch (e) { r = { status: 'retry', reason: e.message } }
    if (r.status !== 'closed') {
      await pool.query(`UPDATE live_trades SET status=$2 WHERE id=$1`, [t.id, r.status === 'retry' ? 'open' : 'reconcile_required'])
      await pool.query(`INSERT INTO live_trade_events (live_trade_id, kind, detail) VALUES ($1,'close_failed',$2)`, [t.id, JSON.stringify(r)])
      throw fail(409, r.reason || 'close_failed')
    }
    const result = await finalizeTrade(pool, t.id, r, `user:${req.user.user_id}`)
    void processSettlements(pool, settlementAdapter(config.settlement)).catch(() => {})
    res.json({ ok: true, ...result })
  }))

  return router
}

export function liveAdminRoutes({ pool, treasury, config = liveConfig() }) {
  const router = Router()
  router.use(adminAuth)

  router.get('/approvals', wrap(async (req, res) => {
    res.json({ approvals: (await pool.query(`SELECT a.*, u.wallet_address FROM live_funding_approvals a JOIN openfund_users u ON u.id=a.trader_user_id ORDER BY requested_at DESC LIMIT 200`)).rows })
  }))

  router.post('/approvals/:id/decision', wrap(async (req, res) => {
    const actor = adminActor(req)
    if (!uuid.test(req.params.id)) throw fail(404, 'approval_not_found')
    const { action, tier, note } = req.body || {}
    if (!['approve', 'reject', 'revoke'].includes(action)) throw fail(400, 'invalid_action')
    if (typeof note !== 'string' || !note.trim()) throw fail(400, 'note_required')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: [a] } = await client.query(`SELECT * FROM live_funding_approvals WHERE id=$1 FOR UPDATE`, [req.params.id])
      if (!a) throw fail(404, 'approval_not_found')
      const from = { approve: 'pending_review', reject: 'pending_review', revoke: 'approved' }[action]
      if (a.status !== from) throw fail(409, `approval_${a.status}_cannot_${action}`)
      let split = null
      if (action === 'approve') {
        /* the tier is an explicit management choice; there is no default */
        split = PROFIT_SHARE_TIERS[tier]
        if (!split) throw fail(400, 'tier_selection_required')
        const now = await liveEligibility(client, a.trader_user_id)
        if (!now.eligible) throw fail(409, 'trader_no_longer_eligible')
        if (String(now.coach.coachUserId) !== String(a.coach_user_id)) throw fail(409, 'coach_changed')
      }
      const status = { approve: 'approved', reject: 'rejected', revoke: 'revoked' }[action]
      await client.query(
        `UPDATE live_funding_approvals SET status=$2, tier=coalesce($3,tier), trader_pct=coalesce($4,trader_pct), coach_pct=coalesce($5,coach_pct), openfund_pct=coalesce($6,openfund_pct), decided_at=now(), decided_by=$7, note=$8 WHERE id=$1`,
        [a.id, status, split ? tier : null, split?.trader ?? null, split?.coach ?? null, split?.openfund ?? null, actor, note.trim()])
      if (action === 'revoke') await client.query(`UPDATE capital_allocations SET status='halted', halt_reason='approval_revoked' WHERE approval_id=$1 AND status='active'`, [a.id])
      await financialAudit(client, actor, `live_approval_${status}`, 'live_funding_approval', a.id, { status: a.status }, { status, tier: split ? tier : a.tier, split })
      await client.query('COMMIT')
      res.json({ ok: true, status })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))

  router.post('/allocations', wrap(async (req, res) => {
    const actor = adminActor(req)
    if (config.execution === 'none') throw fail(409, 'live_execution_disabled')
    const { approvalId, amountUsd, riskLimits } = req.body || {}
    if (!uuid.test(approvalId || '')) throw fail(400, 'invalid_approval')
    const amount = D(amountUsd)
    if (!amount.isFinite() || amount.lte(0) || amount.decimalPlaces() > 2) throw fail(400, 'invalid_amount')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('capital_allocation'))`)
      const { rows: [a] } = await client.query(`SELECT * FROM live_funding_approvals WHERE id=$1 FOR UPDATE`, [approvalId])
      if (!a || a.status !== 'approved') throw fail(409, 'approval_not_approved')
      /* capital gate: verified allocatable capital ≥ threshold AND ≥ this allocation */
      const position = await computeFinancialPosition(client, await treasury.view())
      const cap = programCapacity(position)
      if (cap.state !== 'capacity_available') throw fail(409, cap.state === 'unknown' ? 'capital_not_verified' : 'capital_below_threshold')
      if (amount.gt(position.availableAllocatableUsd)) throw fail(409, 'allocation_exceeds_available_capital')
      const eligibility = await liveEligibility(client, a.trader_user_id)
      const limits = validateLimits(riskLimits, await policyLimits(client, eligibility))
      const { rows: [al] } = await client.query(
        `INSERT INTO capital_allocations (approval_id, trader_user_id, amount_usd, peak_equity_usd, day_start_equity_usd, risk_limits, adapter, created_by)
         VALUES ($1,$2,$3,$3,$3,$4,$5,$6) RETURNING *`, [a.id, a.trader_user_id, usd(amount), JSON.stringify(limits), config.execution, actor])
      await financialAudit(client, actor, 'capital_allocated', 'capital_allocation', al.id, { availableUsd: position.availableAllocatableUsd }, { amount: usd(amount), limits, adapter: config.execution })
      await client.query('COMMIT')
      res.json({ allocation: al })
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      if (e.code === '23505') throw fail(409, 'allocation_already_open')
      throw e
    } finally { client.release() }
  }))

  const allocationTransition = (action, from, to) => router.post(`/allocations/:id/${action}`, wrap(async (req, res) => {
    const actor = adminActor(req)
    if (!uuid.test(req.params.id)) throw fail(404, 'allocation_not_found')
    if (to === 'closed') {
      const open = await pool.query(`SELECT 1 FROM live_trades WHERE allocation_id=$1 AND status IN ('submitted','open','closing','reconcile_required') LIMIT 1`, [req.params.id])
      if (open.rowCount) throw fail(409, 'allocation_has_open_trades')
    }
    const { rows: [al] } = await pool.query(
      `UPDATE capital_allocations SET status=$3, halt_reason=CASE WHEN $3='halted' THEN $4 WHEN $3='active' THEN NULL ELSE halt_reason END, closed_at=CASE WHEN $3='closed' THEN now() END
        WHERE id=$1 AND status = ANY($2) RETURNING *`, [req.params.id, from, to, String(req.body?.reason || 'manual').slice(0, 200)])
    if (!al) throw fail(409, `allocation_cannot_${action}`)
    await financialAudit(pool, actor, `allocation_${action}`, 'capital_allocation', al.id, null, { status: to, reason: req.body?.reason })
    res.json({ allocation: al })
  }))
  allocationTransition('halt', ['active'], 'halted')
  allocationTransition('resume', ['halted'], 'active')
  allocationTransition('close', ['active', 'halted'], 'closed')

  router.get('/settlements', wrap(async (req, res) => res.json({ settlements: (await pool.query(`SELECT * FROM settlement_records ORDER BY created_at DESC LIMIT 500`)).rows })))
  router.post('/settlements/process', wrap(async (req, res) => { adminActor(req); res.json(await processSettlements(pool, settlementAdapter(config.settlement))) }))
  router.post('/settlements/:id/reconcile', wrap(async (req, res) => {
    const actor = adminActor(req)
    if (!uuid.test(req.params.id)) throw fail(404, 'settlement_not_found')
    const { action, txHash, reference } = req.body || {}
    let q
    if (action === 'mark_completed') {
      if (!/^0x[0-9a-f]{64}$/i.test(txHash || '') && !(typeof reference === 'string' && reference.trim())) throw fail(400, 'evidence_required')
      q = await pool.query(`UPDATE settlement_records SET status='completed', tx_hash=$2, settlement_reference=$3, completed_at=now(), updated_at=now() WHERE id=$1 AND status IN ('reconcile_required','failed') RETURNING *`, [req.params.id, txHash || null, reference || null])
    } else if (action === 'retry') {
      q = await pool.query(`UPDATE settlement_records SET status='pending', attempts=0, updated_at=now() WHERE id=$1 AND status IN ('reconcile_required','failed') RETURNING *`, [req.params.id])
    } else throw fail(400, 'invalid_action')
    if (!q.rows[0]) throw fail(409, 'settlement_not_reconcilable')
    await financialAudit(pool, actor, `settlement_${action}`, 'settlement_record', req.params.id, null, { txHash, reference })
    res.json({ settlement: q.rows[0] })
  }))

  /* verified close data for a trade whose outcome could not be confirmed automatically */
  router.post('/trades/:id/reconcile', wrap(async (req, res) => {
    const actor = adminActor(req)
    if (!uuid.test(req.params.id)) throw fail(404, 'trade_not_found')
    const b = req.body || {}
    if (b.outcome === 'not_executed') {
      const { rows: [t] } = await pool.query(`UPDATE live_trades SET status='failed', reject_reason='reconciled_not_executed' WHERE id=$1 AND status='reconcile_required' RETURNING *`, [req.params.id])
      if (!t) throw fail(409, 'trade_not_reconcilable')
      await financialAudit(pool, actor, 'trade_reconciled_not_executed', 'live_trade', t.id, null, b)
      return res.json({ trade: t })
    }
    if (typeof b.evidence !== 'string' || !b.evidence.trim()) throw fail(400, 'evidence_required')
    const result = await finalizeTrade(pool, req.params.id, b, actor)
    res.json(result)
  }))
  return router
}
