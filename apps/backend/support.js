/**
 * Openfund — customer support messages (public Contact Us form).
 *
 * PUBLIC  POST /support/messages
 *   Validates and normalizes a submission, applies anti-spam checks
 *   (honeypot field, minimum fill time, per-IP rate limit, per-email
 *   throttle, duplicate suppression) and stores it in `support_messages`.
 *   Returns ONLY the random public reference, status and timestamp. There
 *   is no public read endpoint: a submitter can never list or fetch any
 *   message, including their own (support replies by email).
 *
 * ADMIN   /admin/support/*  (ADMIN_API_TOKEN + X-Admin-Actor)
 *   List, read and update status / assignment / internal notes. Every
 *   change is appended to `support_message_events`. Directus exposes the
 *   same rows to the Support role (register_support_tables.py).
 *
 * Email notification is NOT sent: no verified outbound mail infrastructure
 * exists in this repository. Operators work the queue in Directus or here.
 */
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import crypto from 'node:crypto'
import { adminAuth, adminActor } from './admin.js'
import { notify } from './notifications.js'

export const DEPARTMENTS = ['support', 'legal', 'technical', 'community']
export const STATUSES = ['new', 'in_progress', 'waiting_customer', 'resolved', 'closed']
export const SUPPORT_LOCALES = ['fa', 'en', 'ar', 'ru', 'zh-CN']
/** allowed operator transitions; 'closed' is final */
export const TRANSITIONS = {
  new: ['in_progress', 'waiting_customer', 'resolved', 'closed'],
  in_progress: ['waiting_customer', 'resolved', 'closed'],
  waiting_customer: ['in_progress', 'resolved', 'closed'],
  resolved: ['in_progress', 'closed'],
  closed: [],
}
export const LIMITS = { name: [2, 120], subject: [3, 160], message: [20, 5000], email: 254, ref: 64 }
/** a human cannot complete the form faster than this */
export const MIN_FILL_MS = 3000
/** per-email throttle window */
export const EMAIL_WINDOW_MIN = 60
export const EMAIL_MAX_PER_WINDOW = 3

const fail = (status, error, field) => Object.assign(new Error(error), { status, field })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REF_RE = /^OF-[0-9]{6}-[A-Z2-9]{6}$/
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
/* C0/C1 controls except tab/newline; bidi overrides (spoofing in admin views) */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‪-‮⁦-⁩]/g
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Random public reference: OF-YYMMDD-XXXXXX (no sequence leaks volume). */
export function newReference(now = new Date()) {
  const d = now.toISOString().slice(2, 10).replace(/-/g, '')
  /* crypto.randomInt is uniform (rejection sampling): no modulo bias */
  return `OF-${d}-${Array.from({ length: 6 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('')}`
}

const clean = (v, { multiline = false } = {}) => {
  if (typeof v !== 'string') return null
  let s = v.normalize('NFC').replace(CONTROL, '')
  s = multiline ? s.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim()
    : s.replace(/\s+/g, ' ').trim()
  return s
}
const len = (s, [min, max], field) => {
  if (!s || [...s].length < min) throw fail(400, 'too_short', field)
  if ([...s].length > max) throw fail(400, 'too_long', field)
  return s
}

/**
 * Pure validation + normalization of a public submission.
 * Throws {status:400, message, field}. Returns the row to insert.
 */
export function validateSubmission(body, now = Date.now()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, 'invalid_body')
  /* honeypot: a hidden field real visitors never fill */
  if (body.website != null && String(body.website).trim() !== '') throw fail(400, 'rejected', 'website')
  const started = Number(body.startedAt)
  if (!Number.isFinite(started) || started > now + 60_000 || now - started < MIN_FILL_MS) throw fail(400, 'too_fast', 'startedAt')
  const fullName = len(clean(body.fullName), LIMITS.name, 'fullName')
  const email = clean(body.email)?.toLowerCase() || ''
  if (email.length > LIMITS.email || !EMAIL_RE.test(email)) throw fail(400, 'invalid_email', 'email')
  if (!DEPARTMENTS.includes(body.department)) throw fail(400, 'invalid_department', 'department')
  const subject = len(clean(body.subject), LIMITS.subject, 'subject')
  const message = len(clean(body.message, { multiline: true }), LIMITS.message, 'message')
  const optionalId = (v, field) => {
    if (v == null || v === '') return null
    const s = clean(v)
    if (!s) return null
    if (!ID_RE.test(s)) throw fail(400, 'invalid_reference', field)
    return s
  }
  const orderRef = optionalId(body.orderId, 'orderId')
  const challengeRef = optionalId(body.challengeId, 'challengeId')
  if (body.privacyConsent !== true) throw fail(400, 'consent_required', 'privacyConsent')
  const locale = SUPPORT_LOCALES.includes(body.locale) ? body.locale : 'en'
  return { fullName, email, department: body.department, subject, message, orderRef, challengeRef, locale }
}

/** Public submission router. `limit(max, windowMs)` is the server's per-IP limiter. */
export function supportRoutes({ pool, limit = () => (req, res, next) => next(), optionalUser = async () => null }) {
  const router = Router()
  router.post('/support/messages', limit(5, 10 * 60_000), wrap(async (req, res) => {
    const row = validateSubmission(req.body)
    /* per-email throttle and exact-duplicate suppression (double submit) */
    const recent = (await pool.query(
      `SELECT count(*)::int AS n,
              bool_or(subject = $2 AND message = $3) AS dup
         FROM support_messages
        WHERE email = $1 AND created_at > now() - make_interval(mins => $4)`,
      [row.email, row.subject, row.message, EMAIL_WINDOW_MIN])).rows[0]
    if (recent.dup) throw fail(409, 'duplicate_submission')
    if (recent.n >= EMAIL_MAX_PER_WINDOW) throw fail(429, 'rate_limited')
    const userId = await optionalUser(req).catch(() => null)
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const { rows: [m] } = await pool.query(
          `INSERT INTO support_messages
             (reference, full_name, email, department, subject, message, order_ref, challenge_ref, locale, user_id, privacy_consent_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
           RETURNING reference, status, created_at`,
          [newReference(), row.fullName, row.email, row.department, row.subject, row.message,
            row.orderRef, row.challengeRef, row.locale, userId && uuid.test(userId) ? userId : null])
        res.set('Cache-Control', 'no-store')
        return res.status(201).json({ reference: m.reference, status: m.status, createdAt: m.created_at })
      } catch (e) {
        if (e.code === '23505' && /reference/.test(e.constraint || '')) continue /* reference collision: retry */
        throw e
      }
    }
    throw fail(503, 'reference_unavailable')
  }))
  /* field-level validation errors carry the offending field for the form */
  router.use('/support', (err, req, res, next) => {
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_body' })
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' })
    if (!err?.status || err.status >= 500) return next(err)
    res.set('Cache-Control', 'no-store').status(err.status).json({ error: err.message, ...(err.field ? { field: err.field } : {}) })
  })
  return router
}

const PAGE = (v, def, max) => {
  if (v === undefined) return def
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0 || n > max) throw fail(400, 'invalid_pagination')
  return n
}

/* ---------------- trader-visible reply threads (modeled on payout-threads) ----------------
   thread_events is an append-only JSONB list on support_messages with
   per-side read cursors. Operators write through the admin thread action;
   traders read and reply through their own inbox. Internal notes stay
   operator-only and are never part of the thread. */
const THREAD_CAPACITY = 500
export function readSupportThread(m, isOperator, before = Number.MAX_SAFE_INTEGER) {
  const events = m.thread_events || []
  const end = Math.min(before, events.length)
  const start = Math.max(0, end - 30)
  const read = isOperator ? m.operator_read_count : m.trader_read_count
  const unread = events.slice(read).filter(e => e.role !== (isOperator ? 'operator' : 'trader')).length
  return { reference: m.reference, status: m.status, unread, nextBefore: start || null, total: events.length,
    messages: events.slice(start, end).map((e, i) => ({
      sequence: start + i + 1, role: e.role, message: e.message, at: e.at,
      ...(isOperator ? { actor: e.actor } : {}),
    })) }
}

async function appendSupportThread(client, m, { role, actor, message }) {
  const events = m.thread_events || []
  if (m.status === 'closed') throw fail(409, 'message_closed')
  if (events.length >= THREAD_CAPACITY) throw fail(409, 'thread_capacity_reached')
  events.push({ role, actor, message, at: new Date().toISOString() })
  await client.query(`UPDATE support_messages SET thread_events=$2, updated_at=now() WHERE id=$1`, [m.id, JSON.stringify(events)])
  return events
}

/** Trader inbox (session auth): list own submissions, read a thread, reply.
 * A trader only ever sees messages linked to their own account. */
export function supportInboxRoutes({ pool, requireAuth, limit = () => (req, res, next) => next() }) {
  const router = Router()
  const owned = async (db, req, lock = false) => {
    if (!REF_RE.test(req.params.ref)) throw fail(404, 'message_not_found')
    const { rows: [m] } = await db.query(
      `SELECT * FROM support_messages WHERE reference=$1 AND user_id=$2 ${lock ? 'FOR UPDATE' : ''}`,
      [req.params.ref, req.user.user_id])
    if (!m) throw fail(404, 'message_not_found')
    return m
  }
  router.get('/support/inbox', requireAuth, limit(45), wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT reference, department, subject, status, created_at, updated_at,
              (SELECT count(*)::int FROM jsonb_array_elements(thread_events) WITH ORDINALITY e(value, idx)
                WHERE e.idx > trader_read_count AND e.value->>'role'='operator') AS unread
         FROM support_messages WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`, [req.user.user_id])
    res.set('Cache-Control', 'no-store').json({ messages: rows })
  }))
  router.get('/support/inbox/:ref/thread', requireAuth, limit(45), wrap(async (req, res) => {
    const before = req.query.before == null ? Number.MAX_SAFE_INTEGER : Number(req.query.before)
    if (!Number.isSafeInteger(before) || before < 0) throw fail(400, 'invalid_pagination')
    const m = await owned(pool, req)
    res.set('Cache-Control', 'no-store').json({ subject: m.subject, department: m.department, body: m.message,
      createdAt: m.created_at, ...readSupportThread(m, false, before) })
  }))
  router.post('/support/inbox/:ref/thread', requireAuth, limit(45), wrap(async (req, res) => {
    const { action = 'reply', message: raw, through } = req.body || {}
    if (!['read', 'reply'].includes(action)) throw fail(400, 'invalid_action')
    const message = typeof raw === 'string' ? clean(raw, { multiline: true }) : ''
    if (action === 'reply' && (!message || message.length > 2000)) throw fail(400, 'invalid_message')
    if (action === 'read' && (!Number.isSafeInteger(through) || through < 0)) throw fail(400, 'invalid_pagination')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const m = await owned(client, req, true)
      if (action === 'read') {
        const cursor = Math.max(m.trader_read_count, Math.min(through, (m.thread_events || []).length))
        await client.query(`UPDATE support_messages SET trader_read_count=$2 WHERE id=$1`, [m.id, cursor])
        m.trader_read_count = cursor
      } else {
        m.thread_events = await appendSupportThread(client, m, { role: 'trader', actor: `user:${req.user.user_id}`, message })
      }
      await client.query('COMMIT')
      res.set('Cache-Control', 'no-store').json(readSupportThread(m, false))
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))
  return router
}
const view = r => ({
  reference: r.reference, fullName: r.full_name, email: r.email, department: r.department, subject: r.subject,
  message: r.message, orderRef: r.order_ref, challengeRef: r.challenge_ref, locale: r.locale, status: r.status,
  internalNotes: r.internal_notes, assignedTo: r.assigned_to, createdAt: r.created_at, updatedAt: r.updated_at,
})

/** Operator queue (service token + named actor). */
export function supportAdminRoutes({ pool }) {
  const router = Router()
  router.use(adminAuth)
  router.get('/messages', wrap(async (req, res) => {
    const limit = PAGE(req.query.limit, 50, 200), offset = PAGE(req.query.offset, 0, 100000)
    const where = [], params = []
    if (req.query.status !== undefined) {
      if (!STATUSES.includes(req.query.status)) throw fail(400, 'invalid_status')
      params.push(req.query.status); where.push(`status = $${params.length}`)
    }
    if (req.query.department !== undefined) {
      if (!DEPARTMENTS.includes(req.query.department)) throw fail(400, 'invalid_department')
      params.push(req.query.department); where.push(`department = $${params.length}`)
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total = (await pool.query(`SELECT count(*)::int c FROM support_messages ${clause}`, params)).rows[0].c
    params.push(limit, offset)
    const { rows } = await pool.query(
      `SELECT * FROM support_messages ${clause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params)
    res.set('Cache-Control', 'no-store').json({ total, messages: rows.map(view) })
  }))
  router.get('/messages/:ref', wrap(async (req, res) => {
    if (!REF_RE.test(req.params.ref)) throw fail(404, 'message_not_found')
    const m = (await pool.query('SELECT * FROM support_messages WHERE reference=$1', [req.params.ref])).rows[0]
    if (!m) throw fail(404, 'message_not_found')
    const events = (await pool.query('SELECT actor, from_status, to_status, detail, ts FROM support_message_events WHERE message_id=$1 ORDER BY id', [m.id])).rows
    res.set('Cache-Control', 'no-store').json({ message: view(m), events, thread: readSupportThread(m, true) })
  }))

  /* operator side of the trader-visible thread: reply (delivered to the
     trader's inbox + in-app notification when the message is linked to an
     account) and read-cursor updates. Anonymous submissions (no user_id)
     accept replies too — they are answered by email outside this system,
     so the thread records the outbound text for the audit trail. */
  const threadLimit = rateLimit({ windowMs: 60_000, limit: 45, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'rate_limited' } })
  router.post('/messages/:ref/thread', threadLimit, wrap(async (req, res) => {
    if (!REF_RE.test(req.params.ref)) throw fail(404, 'message_not_found')
    const actor = adminActor(req)
    const { action = 'reply', message: raw, through } = req.body || {}
    if (!['read', 'reply'].includes(action)) throw fail(400, 'invalid_action')
    const message = typeof raw === 'string' ? clean(raw, { multiline: true }) : ''
    if (action === 'reply' && (!message || message.length > 4000)) throw fail(400, 'invalid_message')
    if (action === 'read' && (!Number.isSafeInteger(through) || through < 0)) throw fail(400, 'invalid_pagination')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const m = (await client.query('SELECT * FROM support_messages WHERE reference=$1 FOR UPDATE', [req.params.ref])).rows[0]
      if (!m) throw fail(404, 'message_not_found')
      if (action === 'read') {
        const cursor = Math.max(m.operator_read_count, Math.min(through, (m.thread_events || []).length))
        await client.query(`UPDATE support_messages SET operator_read_count=$2 WHERE id=$1`, [m.id, cursor])
        m.operator_read_count = cursor
      } else {
        m.thread_events = await appendSupportThread(client, m, { role: 'operator', actor, message })
        await client.query(
          `INSERT INTO support_message_events (message_id, actor, from_status, to_status, detail) VALUES ($1,$2,$3,$3,$4)`,
          [m.id, actor, m.status, JSON.stringify({ thread: 'reply' })])
        if (m.user_id) await notify(client, {
          userId: m.user_id, kind: 'support_reply',
          payload: { reference: m.reference, subject: m.subject },
          dedupeKey: `support_reply:${m.id}:${(m.thread_events || []).length}`,
        })
      }
      await client.query('COMMIT')
      res.set('Cache-Control', 'no-store').json(readSupportThread(m, true))
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))
  router.post('/messages/:ref', wrap(async (req, res) => {
    if (!REF_RE.test(req.params.ref)) throw fail(404, 'message_not_found')
    const actor = adminActor(req)
    const { status, assignedTo, internalNote } = req.body || {}
    if (status !== undefined && !STATUSES.includes(status)) throw fail(400, 'invalid_status')
    if (assignedTo !== undefined && assignedTo !== null && (typeof assignedTo !== 'string' || !/^[\w.@ -]{2,60}$/.test(assignedTo))) throw fail(400, 'invalid_assignee')
    if (internalNote !== undefined && (typeof internalNote !== 'string' || !internalNote.trim() || internalNote.length > 4000)) throw fail(400, 'invalid_note')
    if (status === undefined && assignedTo === undefined && internalNote === undefined) throw fail(400, 'nothing_to_update')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const m = (await client.query('SELECT * FROM support_messages WHERE reference=$1 FOR UPDATE', [req.params.ref])).rows[0]
      if (!m) throw fail(404, 'message_not_found')
      if (status !== undefined && status !== m.status && !TRANSITIONS[m.status].includes(status)) throw fail(409, `transition_${m.status}_to_${status}_not_allowed`)
      if (m.status === 'closed') throw fail(409, 'message_closed')
      const note = internalNote ? clean(internalNote, { multiline: true }) : null
      const stamped = note ? `[${new Date().toISOString()} ${actor}] ${note}` : null
      const { rows: [u] } = await client.query(
        `UPDATE support_messages SET
            status = coalesce($2, status),
            assigned_to = CASE WHEN $3::boolean THEN $4 ELSE assigned_to END,
            internal_notes = CASE WHEN $5::text IS NULL THEN internal_notes
                                  WHEN internal_notes IS NULL THEN $5 ELSE internal_notes || E'\n' || $5 END
          WHERE id=$1 RETURNING *`,
        [m.id, status ?? null, assignedTo !== undefined, assignedTo ?? null, stamped])
      await client.query(
        `INSERT INTO support_message_events (message_id, actor, from_status, to_status, detail) VALUES ($1,$2,$3,$4,$5)`,
        [m.id, actor, m.status, u.status, JSON.stringify({ assignedTo: assignedTo !== undefined ? assignedTo : undefined, note: !!note })])
      await client.query('COMMIT')
      res.set('Cache-Control', 'no-store').json({ message: view(u) })
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
  }))
  return router
}
