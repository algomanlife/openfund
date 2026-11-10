/**
 * Openfund coupon engine (docs/payments/COUPONS.md).
 *
 * Server-authoritative discounts for challenge purchases:
 *  - kinds: percentage (0 < value ≤ 100) and fixed USD amount; a 100%
 *    (or fixed ≥ price) coupon produces a ZERO-PAYMENT order, provisioned
 *    through a dedicated flow — never an on-chain zero-value payment;
 *  - restrictions: plans, account sizes, wallets (user restriction), start
 *    and expiry time, total usage limit and per-user limit;
 *  - internal testing coupons are bound to at most two named test wallets
 *    and a finite usage limit (enforced by a database CHECK) and are
 *    reported as "not found" to anyone else;
 *  - redemption is race-safe: the coupon row is locked (SELECT … FOR UPDATE)
 *    inside the order-creation transaction, usage is counted from the
 *    redemption ledger under that lock, and the reservation is written in
 *    the same transaction. Concurrent requests serialize on the lock, so
 *    limits cannot be bypassed by parallel or repeated API calls;
 *  - a reservation is consumed when the order is paid and released when it
 *    is cancelled or expires unpaid (database trigger, see schema.sql);
 *  - every administrative change is written to the append-only coupon_audit.
 */
import { Router } from 'express'
import { adminAuth, adminActor } from './admin.js'
import { cents, usd } from './economy-math.js'

const fail = (status, error) => Object.assign(new Error(error), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,39}$/
const WALLET_RE = /^0x[0-9a-f]{40}$/

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

/**
 * Validate a coupon for one user + plan + size. With `lock`, the coupon row
 * is locked FOR UPDATE (call inside the order transaction). Throws a 4xx
 * error with a stable code; never reveals restricted coupons to other users.
 */
export async function evaluateCoupon(q, { code, userId, walletAddress, planSlug, accountSize, listPriceUsd, lock = false }) {
  const c = normalizeCode(code)
  if (!CODE_RE.test(c)) throw fail(400, 'coupon_invalid')
  const { rows: [coupon] } = await q.query(`SELECT * FROM coupons WHERE code=$1 ${lock ? 'FOR UPDATE' : ''}`, [c])
  if (!coupon) throw fail(404, 'coupon_not_found')
  const wallet = String(walletAddress || '').toLowerCase()
  /* user-restricted (and every internal) coupon is invisible to others */
  if (coupon.allowed_wallets && !coupon.allowed_wallets.includes(wallet)) throw fail(404, 'coupon_not_found')
  if (coupon.status !== 'active') throw fail(409, 'coupon_disabled')
  const now = Date.now()
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) throw fail(409, 'coupon_not_started')
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now) throw fail(409, 'coupon_expired')
  if (coupon.plan_slugs && !coupon.plan_slugs.includes(planSlug)) throw fail(409, 'coupon_not_applicable')
  if (coupon.account_sizes && !coupon.account_sizes.map(Number).includes(Number(accountSize))) throw fail(409, 'coupon_not_applicable')
  const { rows: [use] } = await q.query(
    `SELECT count(*)::int AS total, count(*) FILTER (WHERE user_id=$2)::int AS mine
       FROM coupon_redemptions WHERE coupon_id=$1 AND status IN ('reserved','consumed')`, [coupon.id, userId])
  if (coupon.max_redemptions != null && use.total >= coupon.max_redemptions) throw fail(409, 'coupon_exhausted')
  if (use.mine >= coupon.per_user_limit) throw fail(409, 'coupon_already_used')
  return { coupon, pricing: applyCoupon(listPriceUsd, coupon) }
}

/* ---------------- admin ---------------- */
const view = c => c && ({
  id: c.id, code: c.code, description: c.description, kind: c.kind, value: usd(c.value), status: c.status,
  maxRedemptions: c.max_redemptions, perUserLimit: c.per_user_limit, planSlugs: c.plan_slugs,
  accountSizes: c.account_sizes?.map(Number) ?? null, allowedWallets: c.allowed_wallets, internal: c.internal,
  startsAt: c.starts_at, expiresAt: c.expires_at, createdBy: c.created_by, createdAt: c.created_at, updatedAt: c.updated_at,
})

/** validated admin input → column values (only the fields present) */
function parseCouponInput(b, { creating }) {
  const out = {}
  if (creating || b.code !== undefined) {
    const code = normalizeCode(b.code)
    if (!CODE_RE.test(code)) throw fail(400, 'invalid_code')
    if (!creating) throw fail(400, 'code_immutable')
    out.code = code
  }
  if (creating || b.kind !== undefined) {
    if (!['percent', 'fixed'].includes(b.kind)) throw fail(400, 'invalid_kind')
    if (!creating) throw fail(400, 'kind_immutable')
    out.kind = b.kind
  }
  if (creating || b.value !== undefined) {
    const v = Number(b.value)
    if (!Number.isFinite(v) || v <= 0 || v > 1_000_000) throw fail(400, 'invalid_value')
    if (!creating) throw fail(400, 'value_immutable')
    out.value = cents(v).toFixed(2)
  }
  if (b.description !== undefined) {
    if (b.description !== null && (typeof b.description !== 'string' || b.description.length > 300)) throw fail(400, 'invalid_description')
    out.description = b.description
  }
  if (b.maxRedemptions !== undefined) {
    if (b.maxRedemptions !== null && !(Number.isInteger(b.maxRedemptions) && b.maxRedemptions > 0 && b.maxRedemptions <= 1_000_000)) throw fail(400, 'invalid_max_redemptions')
    out.max_redemptions = b.maxRedemptions
  }
  if (b.perUserLimit !== undefined) {
    if (!(Number.isInteger(b.perUserLimit) && b.perUserLimit > 0 && b.perUserLimit <= 100)) throw fail(400, 'invalid_per_user_limit')
    out.per_user_limit = b.perUserLimit
  }
  if (b.planSlugs !== undefined) {
    if (b.planSlugs !== null && !(Array.isArray(b.planSlugs) && b.planSlugs.length && b.planSlugs.length <= 50 && b.planSlugs.every(s => typeof s === 'string' && /^[a-z0-9-]{1,60}$/.test(s)))) throw fail(400, 'invalid_plan_slugs')
    out.plan_slugs = b.planSlugs
  }
  if (b.accountSizes !== undefined) {
    if (b.accountSizes !== null && !(Array.isArray(b.accountSizes) && b.accountSizes.length && b.accountSizes.length <= 50 && b.accountSizes.every(n => Number.isFinite(Number(n)) && Number(n) > 0))) throw fail(400, 'invalid_account_sizes')
    out.account_sizes = b.accountSizes === null ? null : b.accountSizes.map(n => Number(n).toFixed(2))
  }
  if (b.allowedWallets !== undefined) {
    if (b.allowedWallets !== null) {
      if (!(Array.isArray(b.allowedWallets) && b.allowedWallets.length && b.allowedWallets.length <= 500)) throw fail(400, 'invalid_allowed_wallets')
      const w = [...new Set(b.allowedWallets.map(x => String(x).toLowerCase()))]
      if (!w.every(x => WALLET_RE.test(x))) throw fail(400, 'invalid_allowed_wallets')
      out.allowed_wallets = w
    } else out.allowed_wallets = null
  }
  if (b.internal !== undefined) {
    if (typeof b.internal !== 'boolean') throw fail(400, 'invalid_internal')
    out.internal = b.internal
  }
  for (const [k, col] of [['startsAt', 'starts_at'], ['expiresAt', 'expires_at']]) {
    if (b[k] === undefined) continue
    if (b[k] === null) { out[col] = null; continue }
    const t = new Date(b[k])
    if (Number.isNaN(t.getTime())) throw fail(400, `invalid_${col}`)
    out[col] = t.toISOString()
  }
  if (b.status !== undefined) {
    if (!['active', 'disabled'].includes(b.status)) throw fail(400, 'invalid_status')
    out.status = b.status
  }
  return out
}

/** maps the database CHECK constraint names to stable API errors */
const constraintError = e => {
  if (e.code === '23505') return fail(409, 'code_exists')
  if (e.code === '23514') return fail(400, ({
    coupons_percent_range: 'percent_out_of_range', coupons_window: 'invalid_window',
    coupons_internal_bounded: 'internal_coupon_requires_test_wallets_and_limit',
  })[e.constraint] || 'invalid_coupon')
  return e
}

export function couponAdminRoutes({ pool }) {
  const router = Router()
  router.use(adminAuth)

  router.get('/', wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT c.*, (SELECT count(*)::int FROM coupon_redemptions r WHERE r.coupon_id=c.id AND r.status='consumed') AS consumed,
              (SELECT count(*)::int FROM coupon_redemptions r WHERE r.coupon_id=c.id AND r.status='reserved') AS reserved
         FROM coupons c ORDER BY c.created_at DESC LIMIT 500`)
    res.json({ coupons: rows.map(c => ({ ...view(c), consumed: c.consumed, reserved: c.reserved })) })
  }))

  router.post('/', wrap(async (req, res) => {
    const actor = adminActor(req)
    const v = parseCouponInput(req.body || {}, { creating: true })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const cols = Object.keys(v)
      const { rows: [c] } = await client.query(
        `INSERT INTO coupons (${cols.join(',')}, created_by) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')}, $${cols.length + 1}) RETURNING *`,
        [...cols.map(k => v[k]), actor])
      await client.query(`INSERT INTO coupon_audit (coupon_id, actor, action, after) VALUES ($1,$2,'created',$3)`, [c.id, actor, JSON.stringify(view(c))])
      await client.query('COMMIT')
      res.status(201).json({ coupon: view(c) })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw constraintError(e) } finally { client.release() }
  }))

  const update = async (req, res, v) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'coupon_not_found')
    if (!Object.keys(v).length) throw fail(400, 'no_changes')
    const actor = adminActor(req)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows: [before] } = await client.query('SELECT * FROM coupons WHERE id=$1 FOR UPDATE', [req.params.id])
      if (!before) throw fail(404, 'coupon_not_found')
      const cols = Object.keys(v)
      const { rows: [after] } = await client.query(
        `UPDATE coupons SET ${cols.map((k, i) => `${k}=$${i + 2}`).join(', ')}, updated_at=now() WHERE id=$1 RETURNING *`,
        [req.params.id, ...cols.map(k => v[k])])
      const action = cols.length === 1 && v.status === 'disabled' ? 'disabled' : cols.length === 1 && v.status === 'active' ? 'enabled' : 'updated'
      await client.query(`INSERT INTO coupon_audit (coupon_id, actor, action, before, after) VALUES ($1,$2,$3,$4,$5)`,
        [after.id, actor, action, JSON.stringify(view(before)), JSON.stringify(view(after))])
      await client.query('COMMIT')
      res.json({ coupon: view(after) })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw constraintError(e) } finally { client.release() }
  }

  /* edit restrictions / limits / window / status. Code, kind and value are
     immutable once created (orders already reference the pricing), so a
     changed discount is a NEW coupon — history never silently changes. */
  router.patch('/:id', wrap((req, res) => { adminActor(req); return update(req, res, parseCouponInput(req.body || {}, { creating: false })) }))
  router.post('/:id/disable', wrap((req, res) => update(req, res, { status: 'disabled' })))

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
      `SELECT o.id, o.status, o.lifecycle_state, o.list_price_usd, o.discount_usd, o.price_usd, o.payment_required,
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

