/**
 * Openfund — operator read surfaces for Backstage (service token only).
 *
 * Strictly read-only: a unified audit viewer over `audit_log` and
 * `financial_audit_log`, a cross-entity global search (wallet, support
 * reference, challenge/order/withdrawal id, transaction hash), and the
 * live risk board aggregated from recorded engine state. Nothing here
 * runs, samples or mutates the engine or any financial record.
 */
import { Router } from 'express'
import { limiter } from './rate-limit-store.js'
import { adminAuth } from './admin.js'
import { metricsSnapshot } from './observability.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const walletRe = /^0x[0-9a-f]{40}$/i
const txRe = /^0x[0-9a-f]{64}$/i
const supportRe = /^OF-[0-9]{6}-[A-Z2-9]{6}$/
const fail = (status, error) => Object.assign(new Error(error), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const PAGE = (v, def, max) => {
  if (v === undefined) return def
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0 || n > max) throw fail(400, 'invalid_pagination')
  return n
}

export function operationsAdminRoutes({ pool, engine = null, marketData = null }) {
  const router = Router()
  router.use(adminAuth)
  const readLimit = limiter('admin-operations.read', { windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'rate_limited' } })

  /* ---------- unified audit viewer (operational + financial trails) ---------- */
  router.get('/audit', readLimit, wrap(async (req, res) => {
    const limit = PAGE(req.query.limit, 50, 200), offset = PAGE(req.query.offset, 0, 100000)
    const source = req.query.source
    if (source !== undefined && !['operational', 'financial'].includes(source)) throw fail(400, 'invalid_source')
    const action = typeof req.query.action === 'string' ? req.query.action.slice(0, 80) : null
    const entityId = typeof req.query.entity_id === 'string' ? req.query.entity_id.slice(0, 80) : null
    const actor = typeof req.query.actor === 'string' ? req.query.actor.slice(0, 80) : null
    const operational = source === 'financial' ? null : pool.query(
      `SELECT 'operational' AS source, id, ts, action, null AS actor, user_id::text AS subject, null AS entity, null AS entity_id, details AS detail
         FROM audit_log
        WHERE ($1::text IS NULL OR action ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR user_id::text = $2)
        ORDER BY id DESC LIMIT $3 OFFSET $4`,
      [action, entityId && uuid.test(entityId) ? entityId : null, limit, offset])
    const financial = source === 'operational' ? null : pool.query(
      `SELECT 'financial' AS source, id, ts, action, actor, null AS subject, entity, entity_id, jsonb_build_object('before', before, 'after', after) AS detail
         FROM financial_audit_log
        WHERE ($1::text IS NULL OR action ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR entity_id = $2)
          AND ($3::text IS NULL OR actor ILIKE '%' || $3 || '%')
        ORDER BY id DESC LIMIT $4 OFFSET $5`,
      [action, entityId, actor, limit, offset])
    const [ops, fin] = await Promise.all([operational, financial])
    const entries = [...(ops?.rows || []), ...(fin?.rows || [])]
      .sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, limit)
    res.set('Cache-Control', 'no-store').json({ entries, total: null })
  }))

  /* ---------- global search (wallet / support reference / ids / tx hash) ---------- */
  router.get('/search', readLimit, wrap(async (req, res) => {
    const q = String(req.query.q || '').trim()
    if (!q || q.length > 100) throw fail(400, 'invalid_query')
    const results = []
    const push = (kind, rows) => { for (const row of rows) results.push({ kind, ...row }) }
    if (walletRe.test(q)) {
      push('user', (await pool.query(
        `SELECT id, wallet_address, display_name, status FROM openfund_users WHERE lower(wallet_address)=lower($1)`, [q])).rows)
    } else if (txRe.test(q)) {
      push('payment', (await pool.query(
        `SELECT p.id, p.purchase_order_id, p.status, p.tx_hash FROM payments p WHERE lower(p.tx_hash)=lower($1)`, [q])).rows)
      push('payout', (await pool.query(
        `SELECT w.id, w.user_id, w.status, w.amount_usd, w.payout_ref FROM withdrawal_requests w WHERE lower(w.payout_ref)=lower($1)`, [q])).rows)
    } else if (supportRe.test(q)) {
      push('support', (await pool.query(
        `SELECT reference, subject, status, department, created_at FROM support_messages WHERE reference=$1`, [q])).rows)
    } else if (uuid.test(q)) {
      push('challenge', (await pool.query(
        `SELECT c.id, c.status, c.stage, c.user_id, p.slug AS plan_slug FROM openfund_challenges c
           JOIN challenge_plans p ON p.id=c.challenge_plan_id WHERE c.id=$1`, [q])).rows)
      push('user', (await pool.query(
        `SELECT id, wallet_address, display_name, status FROM openfund_users WHERE id=$1`, [q])).rows)
      push('order', (await pool.query(
        `SELECT o.id, o.status, o.price_usd, o.user_id FROM purchase_orders o WHERE o.id=$1`, [q])).rows)
      push('payout', (await pool.query(
        `SELECT w.id, w.user_id, w.status, w.amount_usd FROM withdrawal_requests w WHERE w.id=$1`, [q])).rows)
    } else {
      push('user', (await pool.query(
        `SELECT id, wallet_address, display_name, status FROM openfund_users
          WHERE lower(coalesce(display_name,'')) LIKE '%' || lower($1) || '%' LIMIT 10`, [q.slice(0, 80)])).rows)
    }
    res.set('Cache-Control', 'no-store').json({ query: q, results })
  }))

  /* ---------- notification management (read-only; delivery records) ---------- */
  router.get('/notifications', readLimit, wrap(async (req, res) => {
    const limit = PAGE(req.query.limit, 50, 200), offset = PAGE(req.query.offset, 0, 100000)
    const params = [limit, offset]
    let where = 'TRUE'
    if (req.query.user_id !== undefined) {
      if (!uuid.test(req.query.user_id)) throw fail(400, 'invalid_user')
      params.push(req.query.user_id); where = `n.user_id = $${params.length}`
    }
    const { rows } = await pool.query(
      `SELECT n.id, n.user_id, u.wallet_address, n.kind, n.payload, n.read_at, n.created_at
         FROM notifications n JOIN openfund_users u ON u.id = n.user_id
        WHERE ${where} ORDER BY n.created_at DESC LIMIT $1 OFFSET $2`, params)
    res.set('Cache-Control', 'no-store').json({ notifications: rows, total: null })
  }))

  /* ---------- operational metrics (engine lag, feed staleness, failure counters) ---------- */
  router.get('/metrics', readLimit, wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store').json(metricsSnapshot({ engine, marketData }))
  }))

  /* ---------- live risk board (recorded state only; never runs the engine) ---------- */
  router.get('/risk', readLimit, wrap(async (req, res) => {
    const accounts = (await pool.query(
      `SELECT c.id AS challenge_id, c.user_id, c.stage, c.status AS challenge_status, c.account_size_usd,
              u.wallet_address, p.slug AS plan_slug,
              r.last_equity, r.day_start_equity, r.daily_drawdown, r.maximum_drawdown, r.updated_at AS observed_at,
              (c.rules_snapshot->>'dailyLossPct')::numeric AS daily_loss_pct,
              (c.rules_snapshot->>'maxTotalLossPct')::numeric AS max_total_loss_pct,
              (SELECT count(*)::int FROM trading_positions t WHERE t.account_id=c.demo_account_id AND t.status='open') AS open_positions
         FROM openfund_challenges c
         JOIN openfund_users u ON u.id=c.user_id
         JOIN challenge_plans p ON p.id=c.challenge_plan_id
         JOIN account_equity_risk r ON r.account_id=c.demo_account_id
        WHERE c.status='started' AND c.demo_account_id IS NOT NULL
        ORDER BY r.updated_at DESC LIMIT 200`)).rows
    for (const a of accounts) {
      const dailyLimit = a.daily_loss_pct != null && a.day_start_equity != null
        ? Number(a.day_start_equity) * Number(a.daily_loss_pct) / 100 : null
      const maxLimit = a.max_total_loss_pct != null && a.account_size_usd != null
        ? Number(a.account_size_usd) * Number(a.max_total_loss_pct) / 100 : null
      a.daily_breach_distance_usd = dailyLimit != null ? (dailyLimit - Number(a.daily_drawdown)).toFixed(2) : null
      a.max_breach_distance_usd = maxLimit != null ? (maxLimit - Number(a.maximum_drawdown)).toFixed(2) : null
    }
    const exposure = (await pool.query(
      `SELECT t.market, count(*)::int AS positions, sum(t.margin * t.leverage) AS notional_usd, sum(t.margin) AS margin_usd,
              count(*) FILTER (WHERE t.side='long')::int AS long_positions,
              count(*) FILTER (WHERE t.side='short')::int AS short_positions
         FROM trading_positions t WHERE t.status='open' GROUP BY t.market ORDER BY sum(t.margin * t.leverage) DESC NULLS LAST LIMIT 100`)).rows
    const now = Date.now()
    let fresh = 0, total = 0, newest = null
    if (marketData?.marks) for (const [, m] of marketData.marks) { total++; if (now - m.at < 5000) fresh++; newest = Math.max(newest ?? 0, m.at) }
    const lastPassAt = engine?.lastPassAt ?? null
    res.set('Cache-Control', 'no-store').json({
      generatedAt: new Date(now).toISOString(),
      accounts, exposure,
      feed: { markets: total, fresh, newestMarkAgeMs: newest ? now - newest : null },
      engineLoop: { lastPassAt: lastPassAt ? new Date(lastPassAt).toISOString() : null, lagMs: lastPassAt ? now - lastPassAt : null },
    })
  }))

  return router
}
