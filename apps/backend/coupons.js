/**
 * Openfund coupon engine (docs/payments/COUPONS.md).
 *
 * Administration happens in Directus (Data Studio, role "Commerce Admin" —
 * apps/backstage/scripts/register_commerce_tables.py) on the shared tables
 * coupons, coupon_challenge_plans and coupon_allowed_users. Database
 * triggers (schema.sql) normalize codes, keep revocation final, lock pricing
 * after the first redemption, bound internal test coupons and write the
 * append-only coupon_audit for every writer, Directus included.
 *
 * This module is the ONLY authority for validation, pricing and redemption:
 *  - kinds: percentage (0 < value ≤ 100) and fixed USD; a 100% (or fixed ≥
 *    price) coupon produces a ZERO-PAYMENT order provisioned through a
 *    dedicated flow — never an on-chain or DePay payment;
 *  - restrictions: products, challenge models (M2M), account sizes, allowed
 *    customers (M2M), start/expiry, total and per-customer usage limits;
 *  - internal test coupons need 1–2 allowed customers and a finite limit and
 *    are reported as "not found" to anyone else (fails closed otherwise);
 *  - race-safe: the coupon row is locked (SELECT … FOR UPDATE) inside the
 *    order transaction and usage is counted from coupon_redemptions under
 *    that lock, so parallel or repeated requests cannot exceed a limit.
 * Directus edits therefore cannot bypass checkout logic: the CMS only
 * changes the rules this module evaluates.
 */
import { Router } from 'express'
import { adminAuth } from './admin.js'
import { cents } from './economy-math.js'

const fail = (status, error) => Object.assign(new Error(error), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/

export const normalizeCode = v => (typeof v === 'string' ? v.trim().toUpperCase() : '')
export const isCouponCode = v => CODE_RE.test(normalizeCode(v))

/** Pure pricing: list price + coupon → { list, discount, net } (2-dp strings). */
export function applyCoupon(listPriceUsd, coupon) {
  const list = cents(listPriceUsd)
  if (!coupon) return { list: list.toFixed(2), discount: '0.00', net: list.toFixed(2) }
  let discount = coupon.kind === 'percent'
    ? cents(list.mul(coupon.value).div(100))
    : cents(coupon.value)
  if (discount.gt(list)) discount = list
  return { list: list.toFixed(2), discount: discount.toFixed(2), net: list.minus(discount).toFixed(2) }
}

const jsonList = v => (Array.isArray(v) ? v : null)

/**
 * Validate a coupon for one customer + plan + size. With `lock`, the coupon
 * row is locked FOR UPDATE (call inside the order transaction). Throws a 4xx
 * error with a stable code; never reveals restricted coupons to others.
 */
export async function evaluateCoupon(q, { code, userId, planId, accountSize, listPriceUsd, product = 'prop', lock = false }) {
  const c = normalizeCode(code)
  if (!CODE_RE.test(c)) throw fail(400, 'coupon_invalid')
  const { rows: [coupon] } = await q.query(`SELECT * FROM coupons WHERE code=$1 ${lock ? 'FOR UPDATE' : ''}`, [c])
  if (!coupon) throw fail(404, 'coupon_not_found')
  const allowed = (await q.query('SELECT user_id FROM coupon_allowed_users WHERE coupon_id=$1', [coupon.id])).rows.map(r => String(r.user_id))
  /* customer-restricted (and every internal) coupon is invisible to others;
     an internal coupon without 1–2 named test accounts is unusable */
  if (allowed.length && !allowed.includes(String(userId))) throw fail(404, 'coupon_not_found')
  if (coupon.internal && (allowed.length < 1 || allowed.length > 2 || coupon.max_redemptions == null)) throw fail(404, 'coupon_not_found')
  if (coupon.status === 'revoked') throw fail(409, 'coupon_revoked')
  if (coupon.status !== 'active') throw fail(409, 'coupon_disabled')
  const now = Date.now()
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) throw fail(409, 'coupon_not_started')
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now) throw fail(409, 'coupon_expired')
  const products = jsonList(coupon.products)
  if (products && products.length && !products.map(String).includes(product)) throw fail(409, 'coupon_not_applicable')
  const plans = (await q.query('SELECT challenge_plan_id FROM coupon_challenge_plans WHERE coupon_id=$1', [coupon.id])).rows.map(r => String(r.challenge_plan_id))
  if (plans.length && !plans.includes(String(planId))) throw fail(409, 'coupon_not_applicable')
  const sizes = jsonList(coupon.account_sizes)
  if (sizes && sizes.length && !sizes.map(Number).includes(Number(accountSize))) throw fail(409, 'coupon_not_applicable')
  const { rows: [use] } = await q.query(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE user_id=$2)::int AS mine
       FROM coupon_redemptions WHERE coupon_id=$1 AND status IN ('reserved','consumed')`, [coupon.id, userId])
  if (coupon.max_redemptions != null && use.total >= coupon.max_redemptions) throw fail(409, 'coupon_exhausted')
  if (use.mine >= coupon.per_user_limit) throw fail(409, 'coupon_already_used')
  return { coupon, pricing: applyCoupon(listPriceUsd, coupon) }
}

/* ---------------- operator read API (reporting; edits happen in Directus) ---------------- */
export function couponAdminRoutes({ pool }) {
  const router = Router()
  router.use(adminAuth)

  router.get('/', wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, code, name, kind, value, status, internal, max_redemptions, per_user_limit, starts_at, expires_at,
              uses_reserved, uses_consumed, created_by, user_created, user_updated, created_at, updated_at
         FROM coupons ORDER BY created_at DESC LIMIT 500`)
    res.json({ coupons: rows })
  }))
  router.get('/:id/redemptions', wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'coupon_not_found')
    const { rows } = await pool.query(
      `SELECT r.id, r.status, r.list_price_usd, r.discount_usd, r.net_price_usd, r.created_at, r.consumed_at, r.released_at,
              r.purchase_order_id, u.wallet_address
         FROM coupon_redemptions r JOIN openfund_users u ON u.id=r.user_id
        WHERE r.coupon_id=$1 ORDER BY r.created_at DESC LIMIT 1000`, [req.params.id])
    res.json({ redemptions: rows })
  }))
  router.get('/:id/orders', wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'coupon_not_found')
    const { rows } = await pool.query(
      `SELECT o.id, o.status, o.lifecycle_state, o.list_price_usd, o.discount_usd, o.price_usd, o.payment_required, o.payment_method,
              o.created_at, o.paid_at, p.slug AS plan_slug, o.account_size_usd, u.wallet_address
         FROM purchase_orders o JOIN challenge_plans p ON p.id=o.challenge_plan_id JOIN openfund_users u ON u.id=o.user_id
        WHERE o.coupon_id=$1 ORDER BY o.created_at DESC LIMIT 1000`, [req.params.id])
    res.json({ orders: rows })
  }))
  router.get('/:id/audit', wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'coupon_not_found')
    const { rows } = await pool.query(`SELECT id, actor, action, before, after, created_at FROM coupon_audit WHERE coupon_id=$1 ORDER BY id`, [req.params.id])
    res.json({ audit: rows })
  }))
  return router
}
