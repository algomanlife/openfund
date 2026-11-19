/**
 * Openfund — authentication hygiene helpers (security audit 2026-11).
 *
 *  - internalTokenGuard(): the optional INTERNAL_API_TOKEN check for the
 *    test-only `/internal` seams. Both sides are hashed before the
 *    constant-time comparison, so a supplied token of a different length is
 *    a plain 401 instead of a RangeError (500). The token is read from
 *    `X-Internal-Token` or `Authorization: Bearer`, the two forms the test
 *    harnesses send. The seams themselves still mount only in test mode
 *    (SIM_TEST_MODE=1 + a test database, never production).
 *  - sweepExpiredAuth(): removes SIWE nonces and sessions that can never
 *    validate again. Without it both tables grow without bound (the nonce
 *    endpoint is unauthenticated) and expired sessions keep the visitor IP
 *    and user agent indefinitely.
 */
import crypto from 'node:crypto'

const digest = v => crypto.createHash('sha256').update(String(v)).digest()

/** Express middleware; `env` is injectable for tests. */
export function internalTokenGuard(env = process.env) {
  return (req, res, next) => {
    const token = env.INTERNAL_API_TOKEN
    if (!token) return next()
    const header = req.headers['x-internal-token']
      ?? String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!header || !crypto.timingSafeEqual(digest(header), digest(token)))
      return res.status(401).json({ error: 'internal_unauthorized' })
    next()
  }
}

/* grace periods: a nonce is useless once expired (10 min TTL) and a session
   once past expires_at; the margin keeps rows briefly for incident review */
export const NONCE_RETENTION = '1 hour'
export const SESSION_RETENTION = '1 day'

/** Deletes expired auth rows; returns the number of rows removed per table. */
export async function sweepExpiredAuth(pool) {
  const nonces = await pool.query(`DELETE FROM auth_nonces WHERE expires_at < now() - $1::interval`, [NONCE_RETENTION])
  const sessions = await pool.query(`DELETE FROM auth_sessions WHERE expires_at < now() - $1::interval`, [SESSION_RETENTION])
  return { nonces: nonces.rowCount, sessions: sessions.rowCount }
}
