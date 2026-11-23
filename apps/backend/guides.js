/**
 * Terminal guide (educational popup, ADR 0056): backend side.
 *
 * The guide and its steps are editorial content in Directus (`site_guides`,
 * `site_guide_steps`), published through the `/cms` snapshot like every other
 * public collection, so IRAN serves them from its own runtime. The backend
 * only keeps anonymous counters:
 *
 *  - POST /guides/events increments one daily row per (guide, version) for
 *    `shown`, `completed` or `opted_out` ("Don't show again"). No IP address,
 *    wallet, user id, cookie or user agent is stored; the rate limiter keeps
 *    per-IP counts in memory only, as for every public route;
 *  - GET /admin/guides/stats returns the totals for Backstage.
 */
import { Router } from 'express'
import { adminAuth } from './admin.js'

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const fail = (status, error) => Object.assign(new Error(error), { status })
export const GUIDE_ID = /^(?:[1-9]\d{0,9}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i
export const GUIDE_EVENTS = { shown: 'shown', completed: 'completed', opted_out: 'opted_out' }

export function guideRoutes({ pool, limit }) {
  const router = Router()

  router.post('/guides/events', limit(60), wrap(async (req, res) => {
    const { guideId, version, event } = req.body || {}
    const column = Object.hasOwn(GUIDE_EVENTS, event) ? GUIDE_EVENTS[event] : null
    if (!GUIDE_ID.test(String(guideId ?? '')) || !Number.isInteger(version) || version < 1 || version > 100000 || !column)
      throw fail(400, 'invalid_event')
    await pool.query(
      `INSERT INTO guide_daily_stats (guide_id, version, day, ${column})
       VALUES ($1, $2, (now() AT TIME ZONE 'UTC')::date, 1)
       ON CONFLICT (guide_id, version, day) DO UPDATE SET ${column} = guide_daily_stats.${column} + 1, updated_at = now()`,
      [String(guideId), version])
    res.status(204).end()
  }))

  const admin = Router()
  admin.use(adminAuth)
  admin.get('/stats', wrap(async (req, res) => {
    const days = Math.min(366, Math.max(1, Number(req.query.days) || 90))
    const { rows } = await pool.query(
      `SELECT guide_id, version, sum(shown)::int AS shown, sum(completed)::int AS completed, sum(opted_out)::int AS opted_out,
              min(day) AS first_day, max(day) AS last_day
         FROM guide_daily_stats WHERE day > (now() AT TIME ZONE 'UTC')::date - $1::int
        GROUP BY guide_id, version ORDER BY guide_id, version`, [days])
    res.json({ days, stats: rows.map(r => ({ ...r, completionRate: r.shown ? Number((r.completed / r.shown).toFixed(4)) : null })) })
  }))
  router.use('/admin/guides', admin)
  return router
}
