/**
 * Openfund — in-app notifications (operational records, never financial).
 *
 * One additive table feeds three consumers:
 *  - trader API: list / unread count / mark read (session auth, poll
 *    delivery; the terminal polls alongside its existing streams);
 *  - emitters: payout decisions (admin review flow) and operator support
 *    replies call `notify` directly; every insert carries a dedupe key, so
 *    retries and replays cannot double-notify;
 *  - challenge relay: a read-only poller translates recorded
 *    `challenge_events` (passed / violation / expired / stage_passed, and
 *    account_provisioned of a paid purchase order → purchase_paid) into
 *    notifications. It reads the append-only event table and a cursor row;
 *    it never calls, samples or mutates the engine or evaluation state.
 *
 * Outbound delivery is an abstraction: the built-in adapter is this in-app
 * store. External channels (email/SMS) are owner-configured infrastructure
 * that does not exist in this repository; an adapter receives the same
 * payload and MUST tolerate being absent (no-op default).
 */
import { Router } from 'express'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const fail = (status, error) => Object.assign(new Error(error), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

export const NOTIFICATION_KINDS = [
  'payout_approved', 'payout_rejected', 'payout_paid', 'payout_simulated',
  'support_reply', 'challenge_passed', 'challenge_failed', 'challenge_expired', 'challenge_stage_passed',
  'purchase_paid', 'tournament_registered', 'tournament_started',
]

/** Idempotent insert; `db` may be a pool or an open transaction client.
 * Returns the row, or null when the dedupe key already delivered it. */
export async function notify(db, { userId, kind, payload = {}, dedupeKey = null, adapters = [] }) {
  if (!NOTIFICATION_KINDS.includes(kind)) throw Error(`unknown notification kind: ${kind}`)
  const { rows: [row] } = await db.query(
    `INSERT INTO notifications (user_id, kind, payload, dedupe_key) VALUES ($1,$2,$3,$4)
     ON CONFLICT (dedupe_key) DO NOTHING RETURNING *`,
    [userId, kind, JSON.stringify(payload), dedupeKey])
  if (row) for (const adapter of adapters) {
    try { await adapter.deliver(row) } catch { /* outbound adapters must never break the operation */ }
  }
  return row ?? null
}

/** Local/no-op outbound adapter: in-app rows ARE the delivery. External
 * providers implement { name, deliver(row) } and are owner-configured. */
export const localNotificationAdapter = { name: 'in-app', deliver: async () => {} }

const EVENT_KINDS = {
  passed: 'challenge_passed',
  violation: 'challenge_failed',
  expired: 'challenge_expired',
  stage_passed: 'challenge_stage_passed',
  /* recorded when a paid purchase order provisions its challenge account */
  account_provisioned: 'purchase_paid',
}

/** One relay pass: translate new recorded challenge events into
 * notifications. Reads only `challenge_events` + the cursor row. */
export async function relayChallengeEvents(pool, { adapters = [] } = {}) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: [cursor] } = await client.query(
      `INSERT INTO notification_relay_state (relay) VALUES ('challenge_events')
       ON CONFLICT (relay) DO UPDATE SET relay=EXCLUDED.relay
       RETURNING last_event`)
    const { rows: events } = await client.query(
      `SELECT e.id, e.challenge_id, e.kind, e.ts, c.user_id, c.stage, p.slug AS plan_slug,
              o.id AS order_id, o.price_usd, o.payment_required
         FROM challenge_events e
         JOIN openfund_challenges c ON c.id = e.challenge_id
         JOIN challenge_plans p ON p.id = c.challenge_plan_id
         LEFT JOIN purchase_orders o ON o.id = c.purchase_order_id AND o.status = 'paid'
        WHERE e.id > $1
          AND (e.kind IN ('passed','violation','expired','stage_passed') OR (e.kind = 'account_provisioned' AND o.id IS NOT NULL))
          AND NOT coalesce(c.rules_snapshot ? 'controlledTest', false)
        ORDER BY e.id LIMIT 500`, [cursor.last_event])
    let last = cursor.last_event
    for (const event of events) {
      await notify(client, {
        userId: event.user_id,
        kind: EVENT_KINDS[event.kind],
        payload: { challengeId: event.challenge_id, planSlug: event.plan_slug, stage: event.stage, at: event.ts,
          ...(event.order_id ? { orderId: event.order_id, priceUsd: event.price_usd, paymentRequired: event.payment_required } : {}) },
        dedupeKey: `challenge_event:${event.id}`,
        adapters,
      })
      last = event.id
    }
    const { rows: [tip] } = await client.query(`SELECT coalesce(max(id),0) AS id FROM challenge_events`)
    last = Math.max(last, events.length ? last : Number(tip.id))
    await client.query(`UPDATE notification_relay_state SET last_event=$1, updated_at=now() WHERE relay='challenge_events'`, [last])
    await client.query('COMMIT')
    return events.length
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally { client.release() }
}

export function startNotificationRelay(pool, { intervalMs = 30_000, adapters = [] } = {}) {
  const timer = setInterval(() => relayChallengeEvents(pool, { adapters }).catch(error => console.error('[notifications]', error.message)), intervalMs)
  timer.unref?.()
  return () => clearInterval(timer)
}

/** Trader-facing API (session auth): poll list + read receipts. */
export function notificationRoutes({ pool, requireAuth, limit = () => (req, res, next) => next() }) {
  const router = Router()
  router.get('/notifications', requireAuth, limit(60), wrap(async (req, res) => {
    const before = uuid.test(String(req.query.before || '')) ? req.query.before : null
    const { rows } = await pool.query(
      `SELECT id, kind, payload, read_at, created_at FROM notifications
        WHERE user_id=$1 AND ($2::uuid IS NULL OR created_at < (SELECT created_at FROM notifications WHERE id=$2 AND user_id=$1))
        ORDER BY created_at DESC, id DESC LIMIT 30`, [req.user.user_id, before])
    const { rows: [{ unread }] } = await pool.query(
      `SELECT count(*)::int AS unread FROM notifications WHERE user_id=$1 AND read_at IS NULL`, [req.user.user_id])
    res.set('Cache-Control', 'no-store').json({ notifications: rows, unread })
  }))
  router.post('/notifications/read', requireAuth, limit(60), wrap(async (req, res) => {
    const ids = req.body?.ids
    if (ids !== undefined && (!Array.isArray(ids) || ids.length > 100 || ids.some(id => !uuid.test(String(id)))))
      throw fail(400, 'invalid_ids')
    const { rowCount } = ids
      ? await pool.query(`UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL AND id = ANY($2::uuid[])`, [req.user.user_id, ids])
      : await pool.query(`UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL`, [req.user.user_id])
    res.set('Cache-Control', 'no-store').json({ ok: true, marked: rowCount })
  }))
  return router
}
