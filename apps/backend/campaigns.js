/**
 * Promotional campaigns and announcement bars — backend side.
 *
 * The campaigns themselves are editorial content in Directus (`site_campaigns`,
 * apps/backstage/scripts/apply_schema.py), published through the same
 * `/cms` snapshot as every other public content collection, so IRAN serves
 * them from its own runtime. The backend only adds what Directus must not own:
 *
 *  - privacy-conscious counters: POST /campaigns/events increments one daily
 *    row per (campaign, placement, event). No IP address, wallet, user id,
 *    cookie or user agent is stored; the rate limiter keeps per-IP counts in
 *    memory only, as it does for every public route;
 *  - GET /campaigns/coupons/:code — whether a PUBLIC coupon is currently
 *    promotable, so a campaign never advertises a disabled, expired, exhausted
 *    or restricted code. It returns only the public discount of a coupon that
 *    anyone may redeem; the authoritative price is still the server quote;
 *  - GET /admin/campaigns/stats — impressions, clicks, closes and CTR.
 */
import { Router } from 'express'
import { adminAuth } from './admin.js'
import { isCouponCode, normalizeCode } from './coupons.js'

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const fail = (status, error) => Object.assign(new Error(error), { status })
export const CAMPAIGN_ID = /^(?:[1-9]\d{0,9}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
export const PLACEMENTS = ['modal', 'announcement_bar']
export const EVENTS = ['impression', 'click', 'close']

/** A coupon a campaign may advertise: public (not internal, no customer
 *  allow-list), active, inside its window and not used up. */
export async function promotableCoupon(q, code) {
  const c = normalizeCode(code)
  if (!isCouponCode(c)) return null
  const { rows: [row] } = await q.query(
    `SELECT c.code, c.kind, c.value FROM coupons c
      WHERE c.code=$1 AND c.status='active' AND NOT c.internal
        AND (c.starts_at IS NULL OR c.starts_at <= now()) AND (c.expires_at IS NULL OR c.expires_at > now())
        AND (c.max_redemptions IS NULL OR c.uses_consumed + c.uses_reserved < c.max_redemptions)
        AND NOT EXISTS (SELECT 1 FROM coupon_allowed_users a WHERE a.coupon_id=c.id)
        AND NOT EXISTS (SELECT 1 FROM controlled_challenge_coupons t WHERE t.coupon_id=c.id)`, [c])
  return row ? { code: row.code, kind: row.kind, value: Number(row.value).toFixed(2) } : null
}

export function campaignRoutes({ pool, limit }) {
  const router = Router()

  router.post('/campaigns/events', limit(60), wrap(async (req, res) => {
    const { campaignId, placement, event } = req.body || {}
    if (!CAMPAIGN_ID.test(String(campaignId ?? '')) || !PLACEMENTS.includes(placement) || !EVENTS.includes(event))
      throw fail(400, 'invalid_event')
    const column = { impression: 'impressions', click: 'clicks', close: 'closes' }[event]
    await pool.query(
      `INSERT INTO campaign_daily_stats (campaign_id, placement, day, ${column})
       VALUES ($1, $2, (now() AT TIME ZONE 'UTC')::date, 1)
       ON CONFLICT (campaign_id, placement, day) DO UPDATE SET ${column} = campaign_daily_stats.${column} + 1, updated_at = now()`,
      [String(campaignId), placement])
    res.status(204).end()
  }))

  router.get('/campaigns/coupons/:code', limit(60), wrap(async (req, res) => {
    const coupon = await promotableCoupon(pool, req.params.code)
    res.set('Cache-Control', 'public, max-age=60')
    res.json(coupon ? { promotable: true, ...coupon } : { promotable: false })
  }))

  const admin = Router()
  admin.use(adminAuth)
  admin.get('/stats', wrap(async (req, res) => {
    const days = Math.min(366, Math.max(1, Number(req.query.days) || 30))
    const { rows } = await pool.query(
      `SELECT campaign_id, placement, sum(impressions)::int AS impressions, sum(clicks)::int AS clicks, sum(closes)::int AS closes,
              min(day) AS first_day, max(day) AS last_day
         FROM campaign_daily_stats WHERE day > (now() AT TIME ZONE 'UTC')::date - $1::int
        GROUP BY campaign_id, placement ORDER BY campaign_id`, [days])
    res.json({ days, stats: rows.map(r => ({ ...r, ctr: r.impressions ? Number((r.clicks / r.impressions).toFixed(4)) : null })) })
  }))
  admin.get('/coupons/:code', wrap(async (req, res) => {
    const coupon = await promotableCoupon(pool, req.params.code)
    res.json(coupon ? { promotable: true, ...coupon } : { promotable: false })
  }))
  router.use('/admin/campaigns', admin)
  return router
}
