/**
 * Named admin operators and access levels (security assessment 2026-11-27, OF-2026-11-22).
 *
 * `ADMIN_API_TOKEN` is a SERVICE credential held only by the Backstage
 * operations console and the backend. People never hold it. Each person signs
 * in to Backstage with their own operator account; Backstage forwards the
 * authenticated operator name in `X-Admin-Actor`, and the backend resolves
 * that name against `admin_operators` and applies the operator's role. An
 * unknown or disabled operator is refused, so a decision can no longer be
 * attributed to an arbitrary self-declared name.
 *
 * Bootstrap: while `admin_operators` is empty, the service token keeps its
 * previous single-owner behaviour (the Backstage owner from BACKSTAGE_OWNER).
 * Creating the first operator (it must be an owner) switches enforcement on
 * for good; the last active owner cannot be disabled or demoted.
 *
 * Roles (least privilege; every role may read):
 *   owner    everything, including operators, runtime/regional controls,
 *            the admin console (plans) and migrations of firms
 *   finance  payments, withdrawals, economy, live funding, coupons,
 *            certificates, partners, rewards (not payment settings or
 *            manual deposit association)
 *   support  support threads, user status
 *   content  guides, campaigns, site search, calendar
 *   viewer   read-only
 * Tournaments (prizes issue funded accounts and coupons) and migration
 * decisions (funded starts) are owner-only, like the admin console.
 */
import { promisify } from 'node:util'
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

export const ROLES = ['owner', 'finance', 'support', 'content', 'viewer']
export const OPERATOR_NAME = /^[A-Za-z0-9._@-]{2,50}$/

/* write scopes per role, by admin path prefix */
const WRITE_SCOPES = {
  finance: ['/admin/payments', '/admin/withdrawals', '/admin/economy', '/admin/live', '/admin/coupons',
    '/admin/certificates', '/admin/partners', '/admin/rewards'],
  support: ['/admin/support', '/admin/users'],
  content: ['/admin/guides', '/admin/campaigns', '/admin/search', '/admin/calendar'],
  viewer: [],
}
/* owner-only even for reads */
const OWNER_ONLY = ['/admin/operators', '/admin/runtime', '/admin/regional']
/* owner-only changes inside a role's write scope */
const OWNER_ONLY_WRITES = [/^\/admin\/payments\/settings(\/|$)/, /^\/admin\/payments\/transactions\/[^/]+\/associate$/]
const READ = new Set(['GET', 'HEAD'])
const under = (path, prefix) => path === prefix || path.startsWith(prefix + '/')

export function roleAllows(role, method, path) {
  if (role === 'owner') return true
  if (!ROLES.includes(role)) return false
  path = String(path).toLowerCase()
  if (OWNER_ONLY.some(p => under(path, p))) return false
  if (READ.has(method)) return true
  if (OWNER_ONLY_WRITES.some(pattern => pattern.test(path))) return false
  return (WRITE_SCOPES[role] || []).some(p => under(path, p))
}

const derive = promisify(scrypt)
const KDF = { N: 65536, r: 8, p: 1, maxmem: 96 * 1024 * 1024 }
const validPassword = p => typeof p === 'string' && p.length >= 16 && Buffer.byteLength(p) <= 256
/* same verifier format as apps/backstage/operations/password.js */
export async function createVerifier(password) {
  if (!validPassword(password)) throw Object.assign(new Error('weak_password'), { status: 400 })
  const salt = randomBytes(16)
  return salt.toString('hex') + ':' + (await derive(password, salt, 32, KDF)).toString('hex')
}
/* a fixed verifier so unknown names cost the same as known ones */
const DUMMY = '00'.repeat(16) + ':' + '00'.repeat(32)
export async function verifyOperatorPassword(password, verifier) {
  if (!validPassword(password)) return false
  const [salt, digest] = (verifier || DUMMY).split(':').map(part => Buffer.from(part, 'hex'))
  const ok = timingSafeEqual(await derive(password, salt, 32, KDF), digest)
  return ok && Boolean(verifier)
}

let pool = null
export function configureAdminOperators(p) { pool = p }

/* true while no operator exists (cached briefly; cleared on every change) */
let bootstrapCache = { until: 0, value: true }
export async function operatorsBootstrap() {
  if (!pool) return true
  if (bootstrapCache.until > Date.now()) return bootstrapCache.value
  const { rows: [{ empty }] } = await pool.query('SELECT NOT EXISTS (SELECT 1 FROM admin_operators) AS empty')
  bootstrapCache = { until: Date.now() + 5_000, value: empty }
  return empty
}

/**
 * The operator for a service-token request: `{ username, role }`, or null
 * when the named operator is unknown or disabled. `bootstrap` is true while no
 * operator exists (single-owner mode).
 */
export async function resolveOperator(name) {
  if (!pool) return { username: name, role: 'owner', bootstrap: true }
  const { rows } = await pool.query(
    `SELECT username, role, status, (SELECT count(*)::int FROM admin_operators) AS total
       FROM (SELECT 1) one LEFT JOIN admin_operators ON lower(username) = lower($1)`, [name])
  const row = rows[0]
  if (!row || row.total === 0) return { username: name, role: 'owner', bootstrap: true }
  if (!row.username || row.status !== 'active') return null
  return { username: row.username, role: row.role, bootstrap: false }
}

export async function authenticateOperator(username, password) {
  if (!pool || !OPERATOR_NAME.test(String(username || ''))) { await verifyOperatorPassword(password, null); return null }
  const { rows: [row] } = await pool.query(
    `SELECT username, role, status, password_verifier FROM admin_operators WHERE lower(username) = lower($1)`, [username])
  const ok = await verifyOperatorPassword(password, row?.status === 'active' ? row.password_verifier : null)
  if (!ok) return null
  await pool.query('UPDATE admin_operators SET last_login_at = now() WHERE username = $1', [row.username])
  return { username: row.username, role: row.role }
}

export async function upsertOperator({ username, role, status = 'active', password }, actor) {
  if (!OPERATOR_NAME.test(String(username || ''))) throw Object.assign(new Error('invalid_username'), { status: 400 })
  if (!ROLES.includes(role)) throw Object.assign(new Error('invalid_role'), { status: 400 })
  if (!['active', 'disabled'].includes(status)) throw Object.assign(new Error('invalid_status'), { status: 400 })
  const verifier = password === undefined ? null : await createVerifier(password)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    /* serialize changes so two owners cannot remove each other at once */
    await client.query("SELECT pg_advisory_xact_lock(hashtext('admin_operators'))")
    const { rows: [current] } = await client.query('SELECT username FROM admin_operators WHERE lower(username) = lower($1) FOR UPDATE', [username])
    const name = current?.username ?? username
    const { rows: [owners] } = await client.query(
      `SELECT count(*) FILTER (WHERE role = 'owner' AND status = 'active')::int AS owners,
              count(*) FILTER (WHERE role = 'owner' AND status = 'active' AND username <> $1)::int AS others
         FROM admin_operators`, [name])
    /* there is always at least one active owner once operators exist */
    if ((role !== 'owner' || status !== 'active') && owners.others === 0)
      throw Object.assign(new Error(owners.owners === 0 ? 'first_operator_must_be_owner' : 'last_owner'), { status: 400 })
    /* an existing operator is updated in place: the CHECK on an INSERT
       ... ON CONFLICT row would apply before the conflict, so a change
       without a new password must not go through INSERT */
    const { rows: [row] } = current
      ? await client.query(
        `UPDATE admin_operators SET role = $2, status = $3, password_verifier = COALESCE($4, password_verifier), updated_at = now()
          WHERE username = $1 RETURNING username, role, status, created_at, updated_at, last_login_at`,
        [name, role, status, verifier])
      : await client.query(
        `INSERT INTO admin_operators (username, role, status, password_verifier, created_by)
           VALUES ($1, $2, $3, $4, $5) RETURNING username, role, status, created_at, updated_at, last_login_at`,
        [name, role, status, verifier, actor])
    await client.query('COMMIT')
    bootstrapCache = { until: 0, value: true }
    return row
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error.code === '23514') throw Object.assign(new Error('password_required'), { status: 400 })
    throw error
  } finally { client.release() }
}

export async function listOperators() {
  const { rows } = await pool.query(
    `SELECT username, role, status, created_at, updated_at, last_login_at, created_by FROM admin_operators ORDER BY username`)
  return rows
}

/** /admin/operators — owner-only management, plus the Backstage sign-in check. */
export function operatorAdminRoutes({ Router, adminAuth, adminActor, audit, limiter }) {
  const router = Router()
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
  const signIn = limiter('admin.operators-authenticate', { windowMs: 5 * 60_000, limit: 20 })
  router.use(adminAuth)
  router.post('/authenticate', signIn, wrap(async (req, res) => {
    const operator = await authenticateOperator(req.body?.username, req.body?.password)
    audit?.('admin_operator_sign_in', null, req, { operator: String(req.body?.username || '').slice(0, 50), outcome: operator ? 'success' : 'denied' })
    if (!operator) return res.status(401).json({ error: 'invalid_credentials' })
    res.json(operator)
  }))
  router.get('/', wrap(async (req, res) => res.json({ operators: await listOperators() })))
  router.post('/', wrap(async (req, res) => {
    const actor = adminActor(req)
    const { username, role, status, password } = req.body || {}
    const operator = await upsertOperator({ username, role, status, password }, actor)
    audit?.('admin_operator_changed', null, req, { actor, operator: operator.username, role: operator.role, status: operator.status })
    res.json({ operator })
  }))
  router.use((err, req, res, next) => {
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message })
    next(err)
  })
  return router
}
