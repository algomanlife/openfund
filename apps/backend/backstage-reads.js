import { Router } from 'express'
import { limiter } from './rate-limit-store.js'
import { adminAuth } from './admin.js'

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i

/** Owner inspection over recorded data. This route never samples or runs the engine. */
export function backstageReads({ pool }) {
  const router = Router()
  router.use(adminAuth)
  const challengeReadLimit = limiter('backstage.challenge-read', { windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'rate_limited' } })
  router.get('/challenges/:id', challengeReadLimit, async (req, res, next) => {
    if (!uuid.test(req.params.id)) return res.status(404).json({ error: 'challenge_not_found' })
    try {
      const { rows: [record] } = await pool.query(`
        SELECT c.id,c.user_id,c.stage,c.status,c.account_size_usd,c.started_at,c.expires_at,c.rules_snapshot,
               c.demo_account_id,c.parent_challenge_id,c.funded_from_challenge_id,p.slug AS plan_slug,
               u.wallet_address,o.home_region,a.balance,a.realized_pnl,a.status AS account_status,
               risk.last_equity AS equity,risk.daily_drawdown,risk.maximum_drawdown,risk.updated_at AS observed_at
          FROM openfund_challenges c JOIN challenge_plans p ON p.id=c.challenge_plan_id
          JOIN openfund_users u ON u.id=c.user_id LEFT JOIN demo_accounts a ON a.id=c.demo_account_id
          LEFT JOIN account_ownership o ON o.account_id=a.id
          LEFT JOIN account_equity_risk risk ON risk.account_id=a.id
         WHERE c.id=$1`, [req.params.id])
      if (!record) return res.status(404).json({ error: 'challenge_not_found' })
      const [positions, events, review] = await Promise.all([
        pool.query(`SELECT id,market,side,quantity,entry_price,exit_price,margin,leverage,sl_price,tp_price,
                           status,open_fee,close_fee,realized_pnl,opened_at,closed_at
                      FROM trading_positions WHERE account_id=$1 ORDER BY opened_at DESC,id DESC LIMIT 100`, [record.demo_account_id]),
        pool.query('SELECT kind,detail,ts AS created_at FROM challenge_events WHERE challenge_id=$1 ORDER BY id DESC LIMIT 100', [record.id]),
        pool.query('SELECT decision,actor,note,decided_at,funded_challenge_id FROM challenge_reviews WHERE challenge_id=$1', [record.id]),
      ])
      return res.set('Cache-Control', 'no-store').json({ record, positions: positions.rows, events: events.rows, review: review.rows[0] ?? null })
    } catch (error) { next(error) }
  })
  return router
}
