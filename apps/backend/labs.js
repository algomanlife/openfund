/**
 * Labs: limited challenge drops (ADR 0055).
 *
 * A drop is a challenge plan published from Backstage plan administration
 * whose configuration carries a `lab` block: { number, inventory,
 * perWalletCap (1-5), saleStartsAt, saleEndsAt? }. Everything else (sizes,
 * prices, rules) is an ordinary plan, validated by packages/plan-validation,
 * so the rules shown are the rules the evaluation engine enforces, and a
 * purchased account keeps its drop's frozen rules snapshot.
 *
 * Inventory is never a counter that can drift: it is the number of paid
 * orders plus live reservations, computed under a lock on the plan row in
 * the order-creating transaction, so two buyers can never take the last
 * unit. A reservation is a pending order, or an expired order still inside
 * the late-payment grace, part-paid or under payment review (it can still be paid);
 * once that window passes the unit returns to the drop by itself.
 */
import { Router } from 'express'
import { labStatus } from '../../packages/plan-validation/index.mjs'
import { publicPlanRules } from './purchases.js'

const fail = (status, error) => Object.assign(new Error(error), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

/** The lab block of a plan configuration, or null for an ordinary plan. */
export const labOf = configuration => {
  const lab = configuration?.lab
  return lab && typeof lab === 'object' && !Array.isArray(lab) ? lab : null
}

const COUNTS = `SELECT
    count(*) FILTER (WHERE status='paid')::int AS sold,
    count(*) FILTER (WHERE status IN ('pending','expired') AND (
      lifecycle_state IN ('payment_detected','partially_paid','manual_review')
      OR expires_at IS NULL OR expires_at + make_interval(mins => $2::int) > now()))::int AS reserved,
    count(*) FILTER (WHERE $3::uuid IS NOT NULL AND user_id=$3::uuid AND (status='paid' OR (status IN ('pending','expired') AND (
      lifecycle_state IN ('payment_detected','partially_paid','manual_review')
      OR expires_at IS NULL OR expires_at + make_interval(mins => $2::int) > now()))))::int AS mine
  FROM purchase_orders WHERE challenge_plan_id=$1`

/** Sold units, live reservations and (with a user) that wallet's units. */
export async function labCounts(q, planId, { graceMinutes = 0, userId = null } = {}) {
  const { rows: [r] } = await q.query(COUNTS, [planId, Math.max(0, Math.round(Number(graceMinutes) || 0)), userId])
  return { sold: r.sold, reserved: r.reserved, mine: r.mine }
}

/**
 * Reserve one unit of a drop for a new order. Call inside the order's
 * transaction, before the order row is inserted: the plan row lock
 * serializes every order for this drop until that transaction ends.
 */
export async function labReserveTx(client, { plan, userId, graceMinutes = 0, now = Date.now() }) {
  const lab = labOf(plan.configuration)
  if (!lab) return null
  const { rows: [locked] } = await client.query(`SELECT status FROM challenge_plans WHERE id=$1 FOR UPDATE`, [plan.id])
  const counts = await labCounts(client, plan.id, { graceMinutes, userId })
  const status = labStatus(lab, { sold: counts.sold, active: locked?.status === 'active', now })
  if (status === 'coming_soon') throw fail(409, 'lab_not_open')
  if (status !== 'open') throw fail(409, status === 'sold_out' ? 'lab_sold_out' : 'lab_closed')
  if (counts.sold + counts.reserved >= lab.inventory) throw fail(409, 'lab_sold_out')
  if (counts.mine >= lab.perWalletCap) throw fail(409, 'lab_wallet_cap')
  return { ...counts, remaining: lab.inventory - counts.sold - counts.reserved - 1 }
}

/** Whether a drop can be quoted right now (no reservation). */
export async function labQuoteCheck(q, { plan, userId, graceMinutes = 0, now = Date.now() }) {
  const lab = labOf(plan.configuration)
  if (!lab) return
  const counts = await labCounts(q, plan.id, { graceMinutes, userId })
  const status = labStatus(lab, { sold: counts.sold, now })
  if (status === 'coming_soon') throw fail(409, 'lab_not_open')
  if (status !== 'open') throw fail(409, status === 'sold_out' ? 'lab_sold_out' : 'lab_closed')
  if (counts.sold + counts.reserved >= lab.inventory) throw fail(409, 'lab_sold_out')
  if (counts.mine >= lab.perWalletCap) throw fail(409, 'lab_wallet_cap')
}

/** Public drop view: no buyer identities, only counts. */
export function dropView(row, counts, now = Date.now()) {
  const c = row.configuration || {}
  const lab = labOf(c)
  const status = labStatus(lab, { sold: counts.sold, active: row.status === 'active', now })
  return {
    slug: row.slug, name: row.name, number: lab.number, status,
    inventory: lab.inventory, sold: counts.sold, reserved: counts.reserved,
    available: Math.max(0, lab.inventory - counts.sold - counts.reserved),
    perWalletCap: lab.perWalletCap, saleStartsAt: lab.saleStartsAt, saleEndsAt: lab.saleEndsAt ?? null,
    accountSizesUsd: c.accountSizesUsd || [], priceUsd: c.priceUsd || {},
    rules: publicPlanRules(c),
  }
}

/** The figures the tightness gauges compare a drop against. */
const referenceOf = row => {
  const r = publicPlanRules(row.configuration || {})
  return { slug: row.slug, name: row.name, dailyLossPct: r.dailyLossPct, maxTotalLossPct: r.maxTotalLossPct,
    phase1TargetPct: r.phaseTargetsPct?.[0] ?? null, profitSplitPct: r.profitSplitPct, consistencyPct: r.consistencyPct }
}

export function labRoutes({ pool, graceMinutes = () => 0, now = () => Date.now() }) {
  const router = Router()
  /* GET /labs: current drops (open or coming soon), previous drops (sold
     out or closed, with the real number sold) and the standard plans the
     gauges compare against. Counts only; cached briefly. */
  router.get('/labs', wrap(async (_req, res) => {
    const { rows } = await pool.query(`SELECT id, slug, name, status, configuration FROM challenge_plans ORDER BY created_at`)
    const t = now()
    const drops = []
    for (const row of rows) {
      if (!labOf(row.configuration)) continue
      drops.push(dropView(row, await labCounts(pool, row.id, { graceMinutes: graceMinutes() }), t))
    }
    const current = drops.filter(d => d.status === 'open' || d.status === 'coming_soon')
      .sort((a, b) => (a.status === b.status ? Date.parse(a.saleStartsAt) - Date.parse(b.saleStartsAt) : a.status === 'open' ? -1 : 1))
    /* the archive shows drops that actually sold (a retired drop with no sales is not history) */
    const previous = drops.filter(d => (d.status === 'sold_out' || d.status === 'closed') && d.sold > 0).sort((a, b) => b.number - a.number)
    const reference = rows.filter(r => r.status === 'active' && !labOf(r.configuration) && !r.configuration?.free).map(referenceOf)
    res.set('Cache-Control', 'public, max-age=15').json({ current, previous, reference, serverTime: new Date(t).toISOString() })
  }))
  return router
}
