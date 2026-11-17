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
import { rateLimit } from 'express-rate-limit'
import { adminAuth } from './admin.js'
import { mountControlledChallenges } from './controlled-challenges.js'
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
  const { rows: [controlled] } = await q.query(
    `SELECT t.*, u.wallet_address=t.wallet_address AS wallet_matches
       FROM controlled_challenge_coupons t JOIN openfund_users u ON u.id=t.user_id
      WHERE t.coupon_id=$1`, [coupon.id])
  if (controlled && (!controlled.wallet_matches || controlled.user_id !== userId))
    throw fail(404, 'coupon_not_found')
  if (controlled && (controlled.challenge_plan_id !== planId || !coupon.internal ||
      coupon.kind !== 'percent' || Number(coupon.value) !== 100 || product !== 'prop'))
    throw fail(409, 'coupon_not_applicable')
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
  if ((controlled && use.total > 0) || (coupon.max_redemptions != null && use.total >= coupon.max_redemptions)) throw fail(409, 'coupon_exhausted')
  if (use.mine >= coupon.per_user_limit) throw fail(409, 'coupon_already_used')
  return { coupon, pricing: applyCoupon(listPriceUsd, coupon) }
}

/* ---------------- operator API: reporting + commercial coupon administration.
   Directus Data Studio remains a valid editor; both writers share the same
   schema triggers (code normalization, final revocation, price lock after
   first redemption, internal-coupon bounds, append-only coupon_audit). ---------------- */
export function couponAdminRoutes({ pool }) {
  const router = Router()
  router.use(adminAuth)
  mountControlledChallenges(router, pool)

  const str = (v, max, required = false) => {
    if (v == null || v === '') { if (required) throw fail(400, 'missing_field'); return null }
    if (typeof v !== 'string' || v.length > max) throw fail(400, 'invalid_field')
    return v.trim()
  }
  const whenAt = v => {
    if (v == null || v === '') return null
    const t = new Date(v)
    if (Number.isNaN(t.getTime())) throw fail(400, 'invalid_date')
    return t.toISOString()
  }
  const positiveInt = (v, name) => {
    if (v == null || v === '') return null
    const n = Number(v)
    if (!Number.isInteger(n) || n <= 0) throw fail(400, name)
    return n
  }
  const uuidList = v => {
    if (v === undefined) return undefined
    if (v === null) return []
    if (!Array.isArray(v) || v.length > 50 || v.some(x => !uuid.test(String(x)))) throw fail(400, 'invalid_eligibility')
    return v.map(String)
  }
  const numberList = v => {
    if (v === undefined) return undefined
    if (v === null) return null
    if (!Array.isArray(v) || v.length > 50 || v.some(x => !Number.isFinite(Number(x)) || Number(x) <= 0)) throw fail(400, 'invalid_eligibility')
    return JSON.stringify(v.map(Number))
  }
  const actorOf = req => {
    const actor = String(req.headers['x-admin-actor'] || '').trim()
    if (!/^[\w.@ -]{2,60}$/.test(actor)) throw fail(400, 'admin_actor_required')
    return `admin:${actor}`
  }
  const validateValue = (kind, value) => {
    if (!['percent', 'fixed'].includes(kind)) throw fail(400, 'invalid_kind')
    const d = cents(value ?? NaN)
    if (!d.isFinite() || d.lte(0) || (kind === 'percent' && d.gt(100))) throw fail(400, 'invalid_value')
    return d.toFixed(2)
  }
  async function writeEligibility(client, couponId, { planIds, allowedUserIds }) {
    if (planIds !== undefined) {
      await client.query('DELETE FROM coupon_challenge_plans WHERE coupon_id=$1', [couponId])
      for (const planId of planIds) await client.query(
        'INSERT INTO coupon_challenge_plans (coupon_id, challenge_plan_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [couponId, planId])
    }
    if (allowedUserIds !== undefined) {
      await client.query('DELETE FROM coupon_allowed_users WHERE coupon_id=$1', [couponId])
      for (const userId of allowedUserIds) await client.query(
        'INSERT INTO coupon_allowed_users (coupon_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [couponId, userId])
    }
  }

  const couponWriteLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'rate_limited' } })
  /* create a commercial coupon (controlled test coupons keep their own flow) */
  router.post('/', couponWriteLimit, wrap(async (req, res) => {
    const actor = actorOf(req), b = req.body || {}
    const code = normalizeCode(b.code)
    if (!CODE_RE.test(code)) throw fail(400, 'invalid_code')
    if (b.internal) throw fail(400, 'internal_reserved') /* internal test coupons: controlled-challenges flow only */
    const value = validateValue(b.kind, b.value)
    const planIds = uuidList(b.challengePlanIds), allowedUserIds = uuidList(b.allowedUserIds)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SELECT set_config('openfund.actor', $1, true)`, [actor])
      const { rows: [coupon] } = await client.query(
        `INSERT INTO coupons (code, name, description, kind, value, status, max_redemptions, per_user_limit, account_sizes, starts_at, expires_at, created_by)
         VALUES ($1,$2,$3,$4,$5,'inactive',$6,$7,$8,$9,$10,$11) RETURNING *`,
        [code, str(b.name, 200), str(b.description, 1000), b.kind, value, positiveInt(b.maxRedemptions, 'invalid_limit'),
          positiveInt(b.perUserLimit, 'invalid_limit') ?? 1, numberList(b.accountSizes), whenAt(b.startsAt), whenAt(b.expiresAt), actor])
      await writeEligibility(client, coupon.id, { planIds, allowedUserIds })
      await client.query('COMMIT')
      res.status(201).json({ coupon })
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      if (e.code === '23505') throw fail(409, 'coupon_code_exists')
      if (e.code === '23514' || e.code === '23503') throw fail(400, 'invalid_coupon')
      throw e
    } finally { client.release() }
  }))

  /* update: name/description/eligibility/window/limits/status (activate, disable, revoke).
     The schema trigger locks kind/value after the first redemption and keeps
     revocation final; this endpoint relies on those guarantees. */
  router.post('/:id', couponWriteLimit, wrap(async (req, res) => {
    const actor = actorOf(req), b = req.body || {}
    if (!uuid.test(req.params.id)) throw fail(404, 'coupon_not_found')
    if (b.status !== undefined && !['active', 'inactive', 'revoked'].includes(b.status)) throw fail(400, 'invalid_status')
    if (b.internal) throw fail(400, 'internal_reserved')
    const planIds = uuidList(b.challengePlanIds), allowedUserIds = uuidList(b.allowedUserIds)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SELECT set_config('openfund.actor', $1, true)`, [actor])
      const { rows: [existing] } = await client.query('SELECT * FROM coupons WHERE id=$1 FOR UPDATE', [req.params.id])
      if (!existing) throw fail(404, 'coupon_not_found')
      if (existing.internal) throw fail(409, 'internal_reserved')
      if (existing.status === 'revoked') throw fail(409, 'coupon_revoked')
      const value = b.kind !== undefined || b.value !== undefined
        ? validateValue(b.kind ?? existing.kind, b.value ?? existing.value) : null
      const { rows: [coupon] } = await client.query(
        `UPDATE coupons SET
            name=coalesce($2, name), description=coalesce($3, description),
            kind=coalesce($4, kind), value=coalesce($5, value), status=coalesce($6, status),
            max_redemptions=CASE WHEN $7::boolean THEN $8 ELSE max_redemptions END,
            per_user_limit=coalesce($9, per_user_limit),
            account_sizes=CASE WHEN $10::boolean THEN $11::jsonb ELSE account_sizes END,
            starts_at=CASE WHEN $12::boolean THEN $13 ELSE starts_at END,
            expires_at=CASE WHEN $14::boolean THEN $15 ELSE expires_at END,
            updated_at=now()
          WHERE id=$1 RETURNING *`,
        [existing.id, str(b.name, 200), str(b.description, 1000), b.kind ?? null, value, b.status ?? null,
          b.maxRedemptions !== undefined, positiveInt(b.maxRedemptions, 'invalid_limit'),
          positiveInt(b.perUserLimit, 'invalid_limit'),
          b.accountSizes !== undefined, numberList(b.accountSizes) ?? null,
          b.startsAt !== undefined, whenAt(b.startsAt),
          b.expiresAt !== undefined, whenAt(b.expiresAt)])
      await writeEligibility(client, coupon.id, { planIds, allowedUserIds })
      await client.query('COMMIT')
      res.json({ coupon })
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      if (e.code === '23514' || e.code === 'P0001') throw fail(409, 'coupon_locked')
      throw e
    } finally { client.release() }
  }))

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
