/**
 * Openfund Economy — public transparency aggregates, financial position
 * and the administrative financial records behind them.
 *
 * Every public figure is computed from operational tables at request time
 * (cached for CACHE_MS) and returned with its source and definition. No
 * figure is entered by hand except verified expenses, reserves and other
 * liabilities, which are admin records with references and an audit trail.
 *
 * Privacy: only aggregates are public. No wallet address, user id or
 * per-trader outcome is exposed; payout transaction links are listed with
 * date and amount only.
 */
import { Router } from 'express'
import { adminAuth, adminActor } from './admin.js'
import { financialAudit } from './financial-audit.js'
import { reverseCommissionTx } from './partners.js'
import { financialPosition, programCapacity, D, usd } from './economy-math.js'
import { explorerTxUrl } from './treasury.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail = (status, error) => Object.assign(new Error(error), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const CACHE_MS = 5 * 60_000
const ratio = (a, b) => (D(b).gt(0) ? D(a).div(b).toDecimalPlaces(4).toNumber() : null)
const EXPENSE_CATEGORIES = ['render_infrastructure', 'database', 'cms', 'market_data', 'operational_services', 'marketing', 'ambassador_commissions', 'salaries_administration', 'other']

/** Obligations, reserves and allocations from their single source tables. */
export async function financialInputs(db) {
  const one = async (sql) => (await db.query(sql)).rows[0]
  const o = await one(`SELECT
      (SELECT coalesce(sum(amount_usd),0) FROM withdrawal_requests WHERE status='approved') AS trader_rewards,
      (SELECT coalesce(sum(p),0) FROM (SELECT sum(amount_usd) p FROM referral_commissions GROUP BY ambassador_user_id) x WHERE p > 0) AS commissions,
      (SELECT coalesce(sum(amount_usd),0) FROM settlement_records WHERE status <> 'completed') AS live_shares,
      (SELECT coalesce(sum(amount_usd),0) FROM verified_expenses WHERE status='verified' AND payment_status='unpaid') AS expenses,
      (SELECT coalesce(sum(amount_usd),0) FROM financial_obligations WHERE status='open') AS other`)
  const reserves = { operational: null, risk: null, other: null }
  for (const r of (await db.query(`SELECT DISTINCT ON (kind) kind, amount_usd, created_at, set_by FROM capital_reserves ORDER BY kind, id DESC`)).rows)
    reserves[r.kind] = r.amount_usd
  const a = await one(`SELECT
      (SELECT coalesce(sum(amount_usd),0) FROM capital_allocations WHERE status IN ('active','halted')) AS allocated,
      (SELECT coalesce(sum(collateral_usd),0) FROM live_trades WHERE status IN ('submitted','open','closing','reconcile_required')) AS open_margin`)
  return {
    obligations: { traderRewardsApprovedUnpaid: o.trader_rewards, ambassadorCommissionsUnpaid: o.commissions, liveProfitSharesUnsettled: o.live_shares, expensesPayable: o.expenses, otherLiabilities: o.other },
    reserves,
    allocations: { allocatedUsd: a.allocated, openMarginUsd: a.open_margin },
  }
}

export async function computeFinancialPosition(db, treasuryView) {
  const inputs = await financialInputs(db)
  const t = treasuryView?.snapshot
    ? { status: 'ok', stale: treasuryView.stale, fullyPriced: treasuryView.snapshot.fullyPriced, totalUsd: treasuryView.snapshot.totalUsd }
    : null
  return { ...financialPosition({ treasury: t, ...inputs }), calculatedAt: new Date().toISOString() }
}

async function transparencyReport(pool, treasury) {
  const q = async (sql, params = []) => (await pool.query(sql, params)).rows
  const [sales] = await q(`SELECT count(*)::int AS orders, coalesce(sum(price_usd),0) AS gross, count(DISTINCT user_id)::int AS customers
                             FROM purchase_orders WHERE status='paid'`)
  const [adj] = await q(`SELECT coalesce(sum(amount_usd) FILTER (WHERE kind='refund'),0) AS refunds, coalesce(sum(amount_usd) FILTER (WHERE kind='chargeback'),0) AS chargebacks,
                                count(*) FILTER (WHERE kind='refund')::int AS refund_count, count(*) FILTER (WHERE kind='chargeback')::int AS chargeback_count FROM payment_adjustments`)
  const [states] = await q(`SELECT count(*) FILTER (WHERE status='paid')::int AS paid, count(*) FILTER (WHERE status='expired')::int AS expired,
                                   count(*) FILTER (WHERE status='cancelled')::int AS cancelled, count(*) FILTER (WHERE status='pending')::int AS pending FROM purchase_orders`)
  const [pay] = await q(`SELECT count(*) FILTER (WHERE status='confirmed')::int AS confirmed, count(*) FILTER (WHERE status='failed')::int AS failed FROM payments`)
  const bySize = await q(`SELECT p.slug AS plan, o.account_size_usd AS size, count(*)::int AS orders, sum(o.price_usd) AS gross
                            FROM purchase_orders o JOIN challenge_plans p ON p.id=o.challenge_plan_id WHERE o.status='paid' GROUP BY 1,2 ORDER BY 1,2`)
  const periods = (await q(`SELECT
      count(*) FILTER (WHERE paid_at > now() - interval '7 days')::int AS d7, coalesce(sum(price_usd) FILTER (WHERE paid_at > now() - interval '7 days'),0) AS g7,
      count(*) FILTER (WHERE paid_at > now() - interval '30 days')::int AS d30, coalesce(sum(price_usd) FILTER (WHERE paid_at > now() - interval '30 days'),0) AS g30,
      count(*) FILTER (WHERE paid_at > now() - interval '90 days')::int AS d90, coalesce(sum(price_usd) FILTER (WHERE paid_at > now() - interval '90 days'),0) AS g90
      FROM purchase_orders WHERE status='paid'`))[0]
  const monthly = await q(`SELECT to_char(date_trunc('month', paid_at),'YYYY-MM') AS month, count(*)::int AS orders, sum(price_usd) AS gross
                             FROM purchase_orders WHERE status='paid' AND paid_at > now() - interval '12 months' GROUP BY 1 ORDER BY 1`)
  const net = D(sales.gross).minus(adj.refunds).minus(adj.chargebacks)
  const finalOrders = states.paid + states.expired + states.cancelled

  /* ---- challenge statistics (read-only over the evaluation engine's state) ---- */
  const [ch] = await q(`SELECT
      count(*) FILTER (WHERE purchase_order_id IS NOT NULL)::int AS accounts,
      count(*) FILTER (WHERE status='started')::int AS active,
      count(*) FILTER (WHERE status='failed')::int AS failed,
      count(*) FILTER (WHERE status='expired')::int AS expired,
      count(*) FILTER (WHERE stage=1 AND status='passed')::int AS s1_passed,
      count(*) FILTER (WHERE stage=1 AND status IN ('passed','failed','expired'))::int AS s1_done,
      count(*) FILTER (WHERE stage=2 AND status='passed')::int AS s2_passed,
      count(*) FILTER (WHERE stage=2 AND status IN ('passed','failed','expired'))::int AS s2_done,
      count(*) FILTER (WHERE stage=0)::int AS instant
      FROM openfund_challenges`)
  /* final stage of record: stage = number of phases (1-phase → 1, 2-phase → 2);
     the same definition live-funding.js uses for eligibility */
  const FINAL_PASSED = `c.status='passed' AND c.stage >= 1 AND c.stage = coalesce((c.rules_snapshot->>'phases')::int, 0)`
  const [ev] = await q(`SELECT count(*)::int AS final_passed FROM openfund_challenges c WHERE ${FINAL_PASSED}`)
  const [wd] = await q(`SELECT
      count(*) FILTER (WHERE status='paid')::int AS paid_count, coalesce(sum(amount_usd) FILTER (WHERE status='paid'),0) AS paid_sum,
      count(*) FILTER (WHERE status='approved')::int AS approved_count, coalesce(sum(amount_usd) FILTER (WHERE status='approved'),0) AS approved_sum,
      count(*) FILTER (WHERE status='requested')::int AS requested_count, coalesce(sum(amount_usd) FILTER (WHERE status='requested'),0) AS requested_sum,
      count(DISTINCT user_id) FILTER (WHERE status='paid')::int AS recipients,
      count(DISTINCT challenge_id) FILTER (WHERE status='paid')::int AS accounts_with_payout
      FROM withdrawal_requests`)
  const [funded] = await q(`SELECT count(DISTINCT c.id)::int AS n,
        count(DISTINCT c.id) FILTER (WHERE EXISTS (SELECT 1 FROM withdrawal_requests w WHERE w.challenge_id=c.id AND w.status='paid'))::int AS with_payout
      FROM openfund_challenges c
     WHERE c.stage=0 OR (${FINAL_PASSED})`)
  const payoutMonthly = await q(`SELECT to_char(date_trunc('month', reviewed_at),'YYYY-MM') AS month, count(*)::int AS payouts, sum(amount_usd) AS total
                                   FROM withdrawal_requests WHERE status='paid' AND reviewed_at > now() - interval '12 months' GROUP BY 1 ORDER BY 1`)
  const payoutTx = await q(`SELECT reviewed_at, amount_usd, payout_ref FROM withdrawal_requests WHERE status='paid' AND payout_ref ~* '^0x[0-9a-f]{64}$' ORDER BY reviewed_at DESC LIMIT 25`)
  const chain = Number(process.env.PURCHASE_PAYMENT_CHAIN || 11155111)

  const tv = await treasury.view()
  const position = await computeFinancialPosition(pool, tv)
  const flowsIn = tv.address ? (await q(`SELECT count(*)::int AS n, coalesce(sum(o.price_usd),0) AS usd FROM payments p JOIN purchase_orders o ON o.id=p.purchase_order_id
                                            WHERE p.status='confirmed' AND lower(coalesce(p.to_address,''))=$1`, [tv.address]))[0] : null
  const [flowsOut] = await q(`SELECT
      (SELECT coalesce(sum(amount_usd),0) FROM withdrawal_requests WHERE status='paid') AS trader_rewards,
      (SELECT coalesce(-sum(amount_usd),0) FROM referral_commissions WHERE entry_type='payout') AS ambassador_commissions,
      (SELECT coalesce(sum(amount_usd),0) FROM settlement_records WHERE status='completed') AS live_settlements,
      (SELECT coalesce(sum(amount_usd),0) FROM verified_expenses WHERE status='verified' AND payment_status='paid') AS expenses,
      (SELECT coalesce(sum(amount_usd),0) FROM payment_adjustments) AS refunds`)
  const expenses = await q(`SELECT category, coalesce(sum(amount_usd),0) AS total, count(*)::int AS records FROM verified_expenses WHERE status='verified' GROUP BY category`)
  const expenseRows = await q(`SELECT category, description, amount, currency, amount_usd, incurred_on, period_start, period_end, source, invoice_reference, payment_status
                                 FROM verified_expenses WHERE status='verified' ORDER BY incurred_on DESC LIMIT 100`)
  const [pendingExpenses] = await q(`SELECT count(*)::int AS n FROM verified_expenses WHERE status='recorded'`)

  return {
    generatedAt: new Date().toISOString(),
    cacheSeconds: CACHE_MS / 1000,
    sales: {
      source: 'purchase_orders (status=paid, set only by verified on-chain payment), payment_adjustments',
      challengesSold: sales.orders, uniqueCustomers: sales.customers,
      grossRevenueUsd: usd(sales.gross), refundsUsd: usd(adj.refunds), chargebacksUsd: usd(adj.chargebacks),
      refundCount: adj.refund_count, chargebackCount: adj.chargeback_count,
      netRevenueUsd: usd(net), confirmedPayments: pay.confirmed, failedPaymentRecords: pay.failed,
      averageOrderUsd: sales.orders ? usd(D(sales.gross).div(sales.orders)) : null,
      paymentSuccessRate: finalOrders ? ratio(states.paid, finalOrders) : null,
      paymentSuccessDefinition: 'paid ÷ (paid + expired + cancelled orders); pending orders excluded',
      pendingOrders: states.pending,
      byAccount: bySize.map(r => ({ plan: r.plan, sizeUsd: r.size, orders: r.orders, grossUsd: usd(r.gross) })),
      periods: { d7: { orders: periods.d7, grossUsd: usd(periods.g7) }, d30: { orders: periods.d30, grossUsd: usd(periods.g30) }, d90: { orders: periods.d90, grossUsd: usd(periods.g90) } },
      monthly: monthly.map(m => ({ month: m.month, orders: m.orders, grossUsd: usd(m.gross) })),
    },
    challenges: {
      source: 'openfund_challenges, challenge_events (evaluation engine state of record, read-only), withdrawal_requests',
      accountsCreated: ch.accounts, active: ch.active, failed: ch.failed, expired: ch.expired,
      finalEvaluationsPassed: ev.final_passed, instantAccounts: ch.instant,
      fundedSimulated: funded.n,
      fundedDefinition: 'Instant (stage 0) accounts plus accounts whose final evaluation stage passed',
      accountsWithPayout: wd.accounts_with_payout,
      paidWithdrawals: { count: wd.paid_count, totalUsd: usd(wd.paid_sum) },
      phase1PassRate: ratio(ch.s1_passed, ch.s1_done), phase1Completed: ch.s1_done,
      phase2PassRate: ratio(ch.s2_passed, ch.s2_done), phase2Completed: ch.s2_done,
      firstPayoutRate: ratio(funded.with_payout, funded.n),
      rateDefinitions: 'Pass rate = passed ÷ (passed + failed + expired) for that stage. First payout rate = funded accounts with ≥1 paid withdrawal ÷ funded accounts.',
    },
    payouts: {
      source: 'withdrawal_requests (approved = reviewed obligation; paid = transfer recorded with payout reference)',
      paid: { count: wd.paid_count, totalUsd: usd(wd.paid_sum) },
      approvedAwaitingTransfer: { count: wd.approved_count, totalUsd: usd(wd.approved_sum) },
      requestedUnderReview: { count: wd.requested_count, totalUsd: usd(wd.requested_sum) },
      uniqueRecipients: wd.recipients,
      averagePerRecipientUsd: wd.recipients ? usd(D(wd.paid_sum).div(wd.recipients)) : null,
      payoutToNetRevenue: ratio(wd.paid_sum, net),
      monthly: payoutMonthly.map(m => ({ month: m.month, payouts: m.payouts, totalUsd: usd(m.total) })),
      transactions: payoutTx.map(t => ({ at: t.reviewed_at, amountUsd: t.amount_usd, explorerUrl: explorerTxUrl(chain, t.payout_ref) })),
    },
    treasury: tv,
    flows: {
      inflows: flowsIn ? { verifiedPayments: flowsIn.n, totalUsd: usd(flowsIn.usd), definition: 'Confirmed challenge payments whose on-chain receiver is the treasury address' } : null,
      outflows: { traderRewardsUsd: usd(flowsOut.trader_rewards), ambassadorCommissionsUsd: usd(flowsOut.ambassador_commissions), liveSettlementsUsd: usd(flowsOut.live_settlements), expensesUsd: usd(flowsOut.expenses), refundsUsd: usd(flowsOut.refunds),
        definition: 'Transfers recorded with an operator payout/settlement reference; not inferred from chain traffic' },
    },
    position,
    liveProgram: programCapacity(position),
    expenses: {
      source: 'verified_expenses (status=verified; each row cites a provider API, invoice, receipt or contract reference)',
      categories: EXPENSE_CATEGORIES.map(c => { const r = expenses.find(e => e.category === c); return { category: c, totalUsd: usd(r?.total || 0), records: r?.records || 0 } }),
      totalUsd: usd(expenses.reduce((s, e) => s.plus(e.total), D(0))),
      awaitingVerification: pendingExpenses.n,
      records: expenseRows.map(r => ({ category: r.category, description: r.description, amount: r.amount, currency: r.currency, amountUsd: r.amount_usd, incurredOn: r.incurred_on, periodStart: r.period_start, periodEnd: r.period_end, source: r.source, reference: r.invoice_reference, paymentStatus: r.payment_status })),
    },
  }
}

export function economyRoutes({ pool, treasury }) {
  const router = Router()
  let cache = null
  router.get('/economy/transparency', wrap(async (req, res) => {
    if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), data: await transparencyReport(pool, treasury) }
    res.set('Cache-Control', 'public, max-age=60').json(cache.data)
  }))
  router.get('/economy/treasury', wrap(async (req, res) => res.set('Cache-Control', 'public, max-age=60').json(await treasury.view())))
  router.invalidate = () => { cache = null }
  return router
}

/* ================================================================== */
export function economyAdminRoutes({ pool, treasury, onChange = () => {} }) {
  const router = Router()
  router.use(adminAuth)
  const money = v => { const d = D(v); if (!d.isFinite() || d.lte(0) || d.decimalPlaces() > 2) throw fail(400, 'invalid_amount'); return usd(d) }
  const text = (v, max, req = true) => { if (v == null || v === '') { if (req) throw fail(400, 'missing_field'); return null } if (typeof v !== 'string' || v.length > max) throw fail(400, 'invalid_field'); return v.trim() }
  const date = (v, req = true) => { if (v == null || v === '') { if (req) throw fail(400, 'missing_date'); return null } if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw fail(400, 'invalid_date'); return v }
  const done = (res, body) => { onChange(); res.json(body) }

  router.post('/treasury/refresh', wrap(async (req, res) => { adminActor(req); done(res, await treasury.refresh()) }))

  router.get('/expenses', wrap(async (req, res) => res.json({ expenses: (await pool.query(`SELECT * FROM verified_expenses ORDER BY incurred_on DESC LIMIT 500`)).rows })))
  router.post('/expenses', wrap(async (req, res) => {
    const actor = adminActor(req), b = req.body || {}
    if (!EXPENSE_CATEGORIES.includes(b.category)) throw fail(400, 'invalid_category')
    if (!['provider_api', 'invoice', 'receipt', 'contract'].includes(b.source)) throw fail(400, 'invalid_source')
    const currency = text(b.currency, 8).toUpperCase()
    const amountUsd = money(b.amountUsd)
    if (currency !== 'USD' && !b.fxReference) throw fail(400, 'fx_reference_required')
    try {
      const { rows: [e] } = await pool.query(
        `INSERT INTO verified_expenses (category, description, amount, currency, amount_usd, fx_reference, incurred_on, period_start, period_end, source, invoice_reference, document_url, recorded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [b.category, text(b.description, 300), money(b.amount), currency, amountUsd, text(b.fxReference, 200, false), date(b.incurredOn), date(b.periodStart, false), date(b.periodEnd, false),
          b.source, text(b.invoiceReference, 200), text(b.documentUrl, 500, false), actor])
      await financialAudit(pool, actor, 'expense_recorded', 'verified_expense', e.id, null, e)
      done(res, { expense: e })
    } catch (e) { if (e.code === '23505') throw fail(409, 'duplicate_invoice_reference'); throw e }
  }))
  const expenseTransition = (action, set, where) => router.post(`/expenses/:id/${action}`, wrap(async (req, res) => {
    const actor = adminActor(req)
    if (!uuid.test(req.params.id)) throw fail(404, 'expense_not_found')
    const ref = action === 'paid' ? text(req.body?.paymentReference, 200) : null
    const { rows: [before] } = await pool.query(`SELECT * FROM verified_expenses WHERE id=$1`, [req.params.id])
    if (!before) throw fail(404, 'expense_not_found')
    const { rows: [after] } = await pool.query(`UPDATE verified_expenses SET ${set} WHERE id=$1 AND ${where} RETURNING *`, [req.params.id, actor, ref])
    if (!after) throw fail(409, `expense_cannot_${action}`)
    await financialAudit(pool, actor, `expense_${action}`, 'verified_expense', after.id, before, after)
    done(res, { expense: after })
  }))
  /* the verifier must differ from the recorder (four-eyes) */
  expenseTransition('verify', `status='verified', verified_by=$2, verified_at=now(), payment_reference=coalesce($3, payment_reference)`, `status='recorded' AND recorded_by <> $2`)
  expenseTransition('void', `status='void', verified_by=$2, payment_reference=coalesce($3, payment_reference)`, `status <> 'void'`)
  expenseTransition('paid', `payment_status='paid', payment_reference=$3, verified_by=coalesce(verified_by,$2)`, `status='verified' AND payment_status='unpaid'`)

  router.post('/reserves', wrap(async (req, res) => {
    const actor = adminActor(req), b = req.body || {}
    if (!['operational', 'risk', 'other'].includes(b.kind)) throw fail(400, 'invalid_kind')
    const d = D(b.amountUsd)
    if (!d.isFinite() || d.lt(0) || d.decimalPlaces() > 2) throw fail(400, 'invalid_amount')
    const { rows: [r] } = await pool.query(`INSERT INTO capital_reserves (kind, amount_usd, note, set_by) VALUES ($1,$2,$3,$4) RETURNING *`, [b.kind, usd(d), text(b.note, 500), actor])
    await financialAudit(pool, actor, 'reserve_set', 'capital_reserve', r.id, null, r)
    done(res, { reserve: r })
  }))

  router.post('/obligations', wrap(async (req, res) => {
    const actor = adminActor(req), b = req.body || {}
    if (!['liability', 'payable', 'other'].includes(b.kind)) throw fail(400, 'invalid_kind')
    const { rows: [o] } = await pool.query(
      `INSERT INTO financial_obligations (kind, description, amount_usd, due_on, reference, recorded_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [b.kind, text(b.description, 300), money(b.amountUsd), date(b.dueOn, false), text(b.reference, 200), actor])
    await financialAudit(pool, actor, 'obligation_recorded', 'financial_obligation', o.id, null, o)
    done(res, { obligation: o })
  }))
  router.post('/obligations/:id/close', wrap(async (req, res) => {
    const actor = adminActor(req)
    if (!uuid.test(req.params.id)) throw fail(404, 'obligation_not_found')
    if (!['settled', 'void'].includes(req.body?.status)) throw fail(400, 'invalid_status')
    const { rows: [o] } = await pool.query(`UPDATE financial_obligations SET status=$2, closed_at=now() WHERE id=$1 AND status='open' RETURNING *`, [req.params.id, req.body.status])
    if (!o) throw fail(409, 'obligation_not_open')
    await financialAudit(pool, actor, `obligation_${req.body.status}`, 'financial_obligation', o.id, { status: 'open' }, o)
    done(res, { obligation: o })
  }))

  /* refund / chargeback: appended, never edits the payment; reverses commission atomically */
  router.post('/payments/:id/adjustments', wrap(async (req, res) => {
    const actor = adminActor(req), b = req.body || {}
    if (!uuid.test(req.params.id)) throw fail(404, 'payment_not_found')
    if (!['refund', 'chargeback'].includes(b.kind)) throw fail(400, 'invalid_kind')
    const amount = money(b.amountUsd), reference = text(b.reference, 200)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: [p] } = await client.query(
        `SELECT p.id, p.purchase_order_id, o.price_usd FROM payments p JOIN purchase_orders o ON o.id=p.purchase_order_id WHERE p.id=$1 AND p.status='confirmed' FOR UPDATE OF o`, [req.params.id])
      if (!p) throw fail(404, 'payment_not_found')
      const dup = (await client.query(`SELECT * FROM payment_adjustments WHERE payment_id=$1 AND kind=$2 AND reference=$3`, [p.id, b.kind, reference])).rows[0]
      if (dup) { await client.query('COMMIT'); return res.json({ ok: true, duplicate: true, adjustment: dup }) }
      const { rows: [{ total }] } = await client.query(`SELECT coalesce(sum(amount_usd),0) AS total FROM payment_adjustments WHERE payment_id=$1`, [p.id])
      if (D(total).plus(amount).gt(p.price_usd)) throw fail(409, 'adjustment_exceeds_payment')
      const { rows: [a] } = await client.query(
        `INSERT INTO payment_adjustments (payment_id, purchase_order_id, kind, amount_usd, reference, reason, recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [p.id, p.purchase_order_id, b.kind, amount, reference, text(b.reason, 500, false), actor])
      await financialAudit(client, actor, `payment_${b.kind}`, 'payment_adjustment', a.id, null, a)
      const reversal = await reverseCommissionTx(client, a, actor)
      await client.query('COMMIT')
      done(res, { ok: true, adjustment: a, commissionReversal: reversal })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))

  router.get('/payments-lookup', wrap(async (req, res) => {
    if (!/^0x[0-9a-f]{64}$/i.test(String(req.query.tx || ''))) throw fail(400, 'invalid_tx')
    const { rows: [p] } = await pool.query(`SELECT id, purchase_order_id, status, chain_id FROM payments WHERE lower(tx_hash)=lower($1)`, [req.query.tx])
    if (!p) throw fail(404, 'payment_not_found')
    res.json({ paymentId: p.id, purchaseOrderId: p.purchase_order_id, status: p.status, chainId: p.chain_id })
  }))
  router.get('/position', wrap(async (req, res) => res.json(await computeFinancialPosition(pool, await treasury.view()))))
  router.get('/audit', wrap(async (req, res) => {
    const params = [], where = []
    if (req.query.entity) { params.push(String(req.query.entity)); where.push(`entity=$${params.length}`) }
    if (req.query.entity_id) { params.push(String(req.query.entity_id)); where.push(`entity_id=$${params.length}`) }
    res.json({ entries: (await pool.query(`SELECT * FROM financial_audit_log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 500`, params)).rows })
  }))
  return router
}
