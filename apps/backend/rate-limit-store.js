/**
 * Shared, persistent rate limiting.
 *
 * Counters live in PostgreSQL (`rate_limit_hits`), so they survive a restart
 * and are shared by every instance of a region (several web instances, the
 * worker). Each limiter has its own key prefix, exactly like the separate
 * in-memory stores it replaces. Fixed windows: a key's window starts with
 * its first hit and resets atomically in the same statement.
 *
 * Availability first: when the database cannot answer, a limiter falls back
 * to a per-process memory window for that request (logged once per
 * outage), so a database incident never turns into a total outage of
 * otherwise healthy routes.
 *
 * Usage: call `configureRateLimitStore(pool)` once at startup, then
 * `limiter('name', { windowMs, limit, ... })` (express-rate-limit options)
 * or `routeLimit(max)` for the per-IP-and-path limiter.
 */
import { rateLimit, MemoryStore } from 'express-rate-limit'

let sharedPool = null
let scale = 1
let outageLogged = false

/**
 * `testMode` (SIM_TEST_MODE on a test database only) widens the route
 * limiter like before and starts every boot with empty counters, as the
 * in-memory stores did.
 */
export async function configureRateLimitStore(pool, { testMode = false } = {}) {
  sharedPool = pool
  scale = testMode ? 50 : 1
  if (testMode) await pool.query('DELETE FROM rate_limit_hits').catch(() => {})
}

/** Removes expired windows; returns the number of deleted rows. */
export async function sweepRateLimits(pool = sharedPool) {
  if (!pool) return 0
  const { rowCount } = await pool.query('DELETE FROM rate_limit_hits WHERE reset_at < now()')
  return rowCount
}

const INCREMENT = `
  INSERT INTO rate_limit_hits (key, hits, reset_at)
  VALUES ($1, 1, now() + ($2::int * interval '1 millisecond'))
  ON CONFLICT (key) DO UPDATE SET
    hits     = CASE WHEN rate_limit_hits.reset_at <= now() THEN 1 ELSE rate_limit_hits.hits + 1 END,
    reset_at = CASE WHEN rate_limit_hits.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limit_hits.reset_at END
  RETURNING hits, reset_at`

/** express-rate-limit Store backed by PostgreSQL, with a memory fallback. */
export class PostgresRateLimitStore {
  constructor({ prefix, pool = null }) {
    this.prefix = `${prefix}:`
    this.pool = pool
    this.localKeys = false
    this.fallback = new MemoryStore()
    this.windowMs = 60_000
  }
  init(options) { this.windowMs = options.windowMs; this.fallback.init(options) }
  get db() { return this.pool ?? sharedPool }
  async increment(key) {
    try {
      if (!this.db) throw new Error('rate_limit_store_unconfigured')
      const { rows } = await this.db.query(INCREMENT, [(this.prefix + key).slice(0, 512), Math.round(this.windowMs)])
      outageLogged = false
      return { totalHits: Number(rows[0].hits), resetTime: new Date(rows[0].reset_at) }
    } catch (error) {
      if (!outageLogged) { outageLogged = true; console.error('[rate-limit] database store unavailable, using process memory', error.message) }
      return this.fallback.increment(key)
    }
  }
  async decrement(key) {
    try { await this.db?.query('UPDATE rate_limit_hits SET hits = GREATEST(hits - 1, 0) WHERE key = $1', [(this.prefix + key).slice(0, 512)]) }
    catch { await this.fallback.decrement(key) }
  }
  async resetKey(key) {
    try { await this.db?.query('DELETE FROM rate_limit_hits WHERE key = $1', [(this.prefix + key).slice(0, 512)]) }
    catch { await this.fallback.resetKey(key) }
  }
  shutdown() { this.fallback.shutdown() }
}

/**
 * A named express-rate-limit middleware on the shared store. The name is the
 * counter namespace: use one name per limiter (a router built twice, as in
 * tests, reuses its own namespace).
 */
export function limiter(name, options = {}) {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) throw new Error(`invalid limiter name: ${name}`)
  const max = options.limit ?? options.max ?? 5
  const { max: _ignored, ...rest } = options
  /* express-rate-limit limiters keep their configured limit in test mode (suites assert them) */
  return rateLimit({ windowMs: 60_000, ...rest, limit: max,
    store: new PostgresRateLimitStore({ prefix: name }) })
}

/* The per-IP-and-path limiter used by route modules: `limit(max)` allows
   `max` requests per minute per client IP and request path. */
const routeStores = new Map()
const routeStore = windowMs => {
  if (!routeStores.has(windowMs)) {
    const store = new PostgresRateLimitStore({ prefix: windowMs === 60_000 ? 'route' : `route-${windowMs}` })
    store.init({ windowMs }); routeStores.set(windowMs, store)
  }
  return routeStores.get(windowMs)
}
export const routeLimit = (max, windowMs = 60_000) => {
  const store = routeStore(windowMs)
  return async (req, res, next) => {
    try {
      const { totalHits } = await store.increment(`${req.ip}:${req.path}`)
      if (totalHits > max * scale) return res.status(429).json({ error: 'rate_limited' })
      next()
    } catch (error) { next(error) }
  }
}
