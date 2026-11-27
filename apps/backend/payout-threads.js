import { limiter } from './rate-limit-store.js'
import { adminActor } from './admin.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const fail = (status, message) => Object.assign(new Error(message), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

function readThread(w, isOperator, before) {
  const events = w.thread_events
  const end = Math.min(before, events.length)
  const start = Math.max(0, end - 30)
  const read = isOperator ? w.operator_read_count : w.trader_read_count
  const unread = events.slice(read).filter(e => e.role !== (isOperator ? 'operator' : 'trader')).length
  return { status: w.status, rejectionReason: w.status === 'rejected' ? w.note : null, unread,
    appealPending: pendingAppeal(events), nextBefore: start || null, total: events.length,
    messages: events.slice(start, end).map((e, i) => ({
      sequence: start + i + 1, role: e.role, kind: e.kind, message: e.message, at: e.at,
      ...(isOperator ? { actor: e.actor } : {}),
    })),
  }
}

const pendingAppeal = events => events.findLast(e => e.kind === 'appeal' || e.kind === 'appeal_resolved')?.kind === 'appeal'

export function mountPayoutThreads(router, { pool, requireAuth, operator = false }) {
  const throttle = limiter('payout-threads', { windowMs: 60_000, limit: 45 })
  const auth = requireAuth ? [requireAuth] : []
  const owned = (db, req, lock = false) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'withdrawal_not_found')
    return db.query(`SELECT w.*, c.demo_account_id FROM withdrawal_requests w
      JOIN openfund_challenges c ON c.id=w.challenge_id
      WHERE w.id=$1 AND w.kind='reward' AND ($2::uuid IS NULL OR w.user_id=$2)
      ${lock ? 'FOR UPDATE OF w' : ''}`, [req.params.id, operator ? null : req.user.user_id])
      .then(({ rows: [w] }) => {
        if (!w) throw fail(404, 'withdrawal_not_found')
        return w
      })
  }
  router.get('/withdrawals/:id/thread', ...auth, throttle, wrap(async (req, res) => {
    const before = req.query.before == null ? Number.MAX_SAFE_INTEGER : Number(req.query.before)
    if (!Number.isSafeInteger(before) || before < 0) throw fail(400, 'invalid_pagination')
    res.set('Cache-Control', 'no-store').json(readThread(await owned(pool, req), operator, before))
  }))

  router.post('/withdrawals/:id/thread', ...auth, throttle, wrap(async (req, res) => {
    const { action = 'reply', message: raw, through } = req.body || {}
    if (!['read', 'reply', operator ? 'resolve_appeal' : 'appeal'].includes(action)) throw fail(400, 'invalid_action')
    const message = typeof raw === 'string' ? raw.trim() : ''
    if (action !== 'read' && (!message || message.length > 1000)) throw fail(400, 'invalid_message')
    if (action === 'read' && (!Number.isSafeInteger(through) || through < 0)) throw fail(400, 'invalid_pagination')
    const actor = operator ? adminActor(req) : `user:${req.user.user_id}`
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const w = await owned(client, req, true)
      if (!w.demo_account_id) throw fail(409, 'account_not_provisioned')
      await client.query('SELECT openfund_assert_account_writable($1)', [w.demo_account_id])
      const field = operator ? 'operator_read_count' : 'trader_read_count'
      const events = w.thread_events
      if (action === 'read') {
        w[field] = Math.max(w[field], Math.min(through, events.length))
      } else {
        if (action === 'appeal' && (w.status !== 'rejected' || pendingAppeal(events))) throw fail(409, 'appeal_not_available')
        if (action === 'resolve_appeal' && !pendingAppeal(events)) throw fail(409, 'appeal_not_pending')
        if (events.length >= 500) throw fail(409, 'thread_capacity_reached')
        events.push({ role: operator ? 'operator' : 'trader', actor, kind: action === 'resolve_appeal' ? 'appeal_resolved' : action,
          message, at: new Date().toISOString() })
      }
      await client.query(`UPDATE withdrawal_requests SET thread_events=$2, ${field}=$3 WHERE id=$1`,
        [w.id, JSON.stringify(events), w[field]])
      await client.query('COMMIT')
      res.set('Cache-Control', 'no-store').json(readThread(w, operator, events.length))
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
  }))
}
