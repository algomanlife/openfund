/**
 * Regional runtime: which region this process serves, which background
 * roles it runs, which operational mode the region is in, and which
 * state-changing operations that combination permits (ADR 0032).
 *
 * Safety model:
 *  - GLOBAL (Render) is the default. With no new environment variables the
 *    process runs every role it ran before and permits every operation it
 *    permitted before: this module changes nothing for Render.
 *  - IRAN is opt-in (OPENFUND_REGION=IRAN). It runs only the roles it is
 *    given, never the global financial jobs, and DENIES every state-changing
 *    request that is not on an explicit allowlist. The backend refuses; the
 *    frontend hiding a button is not the control.
 *  - The database records which region owns it (runtime_region). A process
 *    whose region differs from its database's refuses to start, so an Iran
 *    runtime can never be pointed at the Render database by mistake.
 *  - The mode (GLOBAL_CONNECTED / IRAN_ISOLATED / RECOVERY) is durable state
 *    in the region's own database, changed only by a named operator through
 *    the admin API, with an expected epoch, a typed confirmation, a reason,
 *    passing health gates and an append-only audit event. Health checks never
 *    change the mode by themselves.
 */

export const REGIONS = Object.freeze(['GLOBAL', 'IRAN'])
export const MODES = Object.freeze(['GLOBAL_CONNECTED', 'IRAN_ISOLATED', 'RECOVERY'])

/* Background roles a process may run. `http` is the public API surface. */
export const ROLES = Object.freeze([
  'http',             // public API + web application
  'market-data',      // Gains Network marks (authoritative engine prices)
  'engine',           // prop trading engine loop (SL/TP, liquidation, risk)
  'purchase-expiry',  // pending purchase orders → expired
  'payment-recovery', // on-chain payment re-verification (provisions challenges)
  'settlement',       // live-settlement retries
  'treasury',         // treasury snapshots (external RPC)
  'footprint',        // Hyperliquid order-flow ingestion
])

/* Roles that move or provision money or depend on global payment rails.
   They belong to the GLOBAL region only. `engine` is refused in IRAN until
   regional account ownership (ADR 0032 §4) and an execution price policy
   are implemented and signed off. */
const GLOBAL_ONLY_ROLES = new Set(['engine', 'purchase-expiry', 'payment-recovery', 'settlement', 'treasury'])
const IRAN_DEFAULT_ROLES = ['http']

const fail = (status, error, extra = {}) => Object.assign(new Error(error), { status, ...extra })

export function regionConfig(env = process.env) {
  const region = String(env.OPENFUND_REGION || 'GLOBAL').trim().toUpperCase()
  if (!REGIONS.includes(region)) throw new Error(`OPENFUND_REGION must be one of ${REGIONS.join(', ')}`)
  let roles
  if (env.OPENFUND_ROLES == null || String(env.OPENFUND_ROLES).trim() === '') {
    roles = region === 'GLOBAL' ? [...ROLES] : [...IRAN_DEFAULT_ROLES]
  } else {
    roles = String(env.OPENFUND_ROLES).split(',').map(r => r.trim().toLowerCase()).filter(Boolean)
    const unknown = roles.filter(r => !ROLES.includes(r))
    if (unknown.length) throw new Error(`OPENFUND_ROLES has unknown role(s): ${unknown.join(', ')}`)
  }
  if (region === 'IRAN') {
    const refused = roles.filter(r => GLOBAL_ONLY_ROLES.has(r))
    if (refused.length) throw new Error(`OPENFUND_ROLES: role(s) ${refused.join(', ')} are not permitted in region IRAN (ADR 0032)`)
  }
  return Object.freeze({ region, roles: Object.freeze([...new Set(roles)]) })
}

export const hasRole = (config, role) => config.roles.includes(role)

/* ---------------------------------------------------------------------
 * Operation policy
 * ------------------------------------------------------------------- */

/* State-changing requests the IRAN region permits in every mode. Everything
   else that is not GET/HEAD/OPTIONS is denied in IRAN (default deny). None of
   these writes a financial record. */
const IRAN_ALLOWED_MUTATIONS = [
  ['POST', /^\/auth\/(nonce|verify|logout)$/],
  ['PATCH', /^\/auth\/profile$/],
  ['PUT', /^\/chart\/workspaces\/[^/]+\/[^/]+$/],
  ['PUT', /^\/portfolio\/notes$/],
  ['PUT', /^\/products\/[^/]+\/preferences$/],
  ['POST', /^\/support\/messages$/],
  ['POST', /^\/trading\/preview$/],  // computes a quote; writes nothing
  ['POST', /^\/admin\/runtime\/mode$/], // the operator control plane itself
]

/* Named operations, for the status endpoint and audit messages. The request
   classifier maps a mutating request onto one of these. */
export const OPERATIONS = Object.freeze({
  'purchase': 'Challenge purchases and payment verification',
  'challenge.provision': 'Starting or provisioning a challenge account',
  'trading.execute': 'Order placement, closing, protection changes, cancellation',
  'withdrawal.request': 'Reward (withdrawal) requests and cancellation',
  'withdrawal.review': 'Staff review of withdrawal requests',
  'live': 'Live market access and perpetual execution',
  'admin.financial': 'Other operator financial actions',
  'account.profile': 'Sign-in, profile, chart workspaces, notes, support',
})

export function classifyRequest(method, path) {
  if (/^\/(purchases|depay)(\/|$)/.test(path)) return 'purchase'
  if (/^\/challenges\/[^/]+\/start$/.test(path)) return 'challenge.provision'
  if (/^\/trading\/preview$/.test(path)) return 'account.profile'
  if (/^\/(trading|products\/[^/]+\/(orders|positions|trade))(\/|$)/.test(path)) return 'trading.execute'
  if (/^\/(withdrawals|rewards)(\/|$)/.test(path)) return 'withdrawal.request'
  if (/^\/admin\/(withdrawals|rewards)(\/|$)/.test(path)) return 'withdrawal.review'
  if (/^\/(live|admin\/live)(\/|$)/.test(path)) return 'live'
  if (/^\/admin\/runtime(\/|$)/.test(path)) return 'account.profile'
  if (/^\/admin(\/|$)/.test(path)) return 'admin.financial'
  if (/^\/(auth|chart|portfolio\/notes|support)(\/|$)/.test(path) || /^\/products\/[^/]+\/preferences$/.test(path)) return 'account.profile'
  return 'other'
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * May this request run? Pure function of region, mode and the request line.
 * GLOBAL: always yes (unchanged behaviour). IRAN: reads yes; writes only when
 * explicitly allowlisted.
 */
export function permits({ region, mode }, method, path) {
  method = String(method).toUpperCase()
  if (region === 'GLOBAL') return { allowed: true }
  if (SAFE_METHODS.has(method)) return { allowed: true }
  if (IRAN_ALLOWED_MUTATIONS.some(([m, re]) => m === method && re.test(path))) return { allowed: true }
  return { allowed: false, operation: classifyRequest(method, path), reason: denialReason(classifyRequest(method, path), mode) }
}

function denialReason(operation, mode) {
  switch (operation) {
    case 'purchase':
    case 'challenge.provision': return 'purchases_global_region_only'
    case 'trading.execute': return mode === 'IRAN_ISOLATED' ? 'execution_suspended_isolated' : 'regional_execution_not_signed_off'
    case 'withdrawal.request':
    case 'withdrawal.review': return 'regional_withdrawals_not_enabled'
    case 'live': return 'live_markets_global_region_only'
    default: return 'operation_not_enabled_in_region'
  }
}

/* Human-readable operation table for the status endpoint. */
export function operationTable(state) {
  const probe = {
    'purchase': ['POST', '/purchases/orders'],
    'challenge.provision': ['POST', '/challenges/x/start'],
    'trading.execute': ['POST', '/trading/order'],
    'withdrawal.request': ['POST', '/withdrawals'],
    'withdrawal.review': ['POST', '/admin/withdrawals/x/review'],
    'live': ['POST', '/live/orders'],
    'admin.financial': ['POST', '/admin/economy/expenses'],
    'account.profile': ['POST', '/auth/verify'],
  }
  return Object.fromEntries(Object.entries(probe).map(([op, [m, p]]) => {
    const r = permits(state, m, p)
    return [op, { allowed: r.allowed, ...(r.allowed ? {} : { reason: r.reason }), description: OPERATIONS[op] }]
  }))
}

/* ---------------------------------------------------------------------
 * Mode state machine
 * ------------------------------------------------------------------- */

/* Allowed transitions per region. GLOBAL has a single mode: Render's
   behaviour is not governed by the Iran outage modes. */
const TRANSITIONS = {
  GLOBAL: {},
  IRAN: {
    GLOBAL_CONNECTED: ['IRAN_ISOLATED'],          // restrictive direction: always allowed
    IRAN_ISOLATED: ['RECOVERY'],                  // connectivity back: reconcile first
    RECOVERY: ['IRAN_ISOLATED', 'GLOBAL_CONNECTED'], // fall back, or reopen after gates pass
  },
}

export function allowedTransitions(region, from) { return TRANSITIONS[region]?.[from] ?? [] }

export const confirmationFor = to => `CONFIRM-${to}`

export function validateTransition({ region, from, to, expectedEpoch, epoch, confirm, reason }) {
  if (!MODES.includes(to)) throw fail(400, 'invalid_mode')
  if (region === 'GLOBAL') throw fail(409, 'mode_fixed_in_global_region')
  if (!Number.isInteger(expectedEpoch)) throw fail(400, 'expected_epoch_required')
  if (expectedEpoch !== epoch) throw fail(409, 'stale_epoch', { current: epoch })
  if (from === to) throw fail(409, 'already_in_mode')
  if (!allowedTransitions(region, from).includes(to)) throw fail(409, 'transition_not_allowed', { from, to, allowed: allowedTransitions(region, from) })
  if (confirm !== confirmationFor(to)) throw fail(400, 'confirmation_mismatch', { expected: confirmationFor(to) })
  if (typeof reason !== 'string' || reason.trim().length < 10 || reason.length > 500) throw fail(400, 'reason_required')
}

/**
 * Gates evaluated before a transition. Each returns {ok, detail}. Entering
 * IRAN_ISOLATED (more restrictive) needs only a healthy database; leaving
 * RECOVERY for GLOBAL_CONNECTED needs every reopening gate to pass.
 */
export async function evaluateGates({ pool, to, probes = {} }) {
  const gates = []
  try { await pool.query('SELECT 1'); gates.push({ gate: 'database', ok: true }) }
  catch (e) { gates.push({ gate: 'database', ok: false, detail: 'database_unreachable' }) }
  if (to === 'GLOBAL_CONNECTED') {
    const reach = probes.globalReachable ? await probes.globalReachable().catch(() => false) : false
    gates.push({ gate: 'global_origin_reachable', ok: !!reach, ...(reach ? {} : { detail: 'global_origin_unreachable_or_unprobed' }) })
    /* Reconciliation: this release writes no regional financial records in
       IRAN (every financial mutation is denied above), so there is nothing to
       replay. When the outbox lands (ADR 0032 §6) this gate checks it is
       drained and the reconciliation report has no open discrepancy. */
    const { rows } = await pool.query(`SELECT to_regclass('public.region_outbox') IS NOT NULL AS present`)
    if (rows[0].present) {
      const pending = (await pool.query(`SELECT count(*)::int AS n FROM region_outbox WHERE acked_at IS NULL`)).rows[0].n
      gates.push({ gate: 'outbox_drained', ok: pending === 0, ...(pending ? { detail: `${pending}_events_pending` } : {}) })
    } else {
      gates.push({ gate: 'outbox_drained', ok: true, detail: 'no_regional_financial_events_in_this_release' })
    }
  }
  return { ok: gates.every(g => g.ok), gates }
}

/* ---------------------------------------------------------------------
 * Durable state (runtime_region, runtime_mode, runtime_mode_events)
 * ------------------------------------------------------------------- */

/** migrate.js: claim the database for a region once; refuse a mismatch. */
export async function claimDatabaseRegion(pool, region) {
  await pool.query(`INSERT INTO runtime_region (singleton, region) VALUES (true, $1) ON CONFLICT (singleton) DO NOTHING`, [region])
  await pool.query(`INSERT INTO runtime_mode (singleton, mode, epoch, changed_by, reason) VALUES (true, 'GLOBAL_CONNECTED', 0, 'system:migrate', 'initial state')
                    ON CONFLICT (singleton) DO NOTHING`)
  const owner = (await pool.query(`SELECT region FROM runtime_region WHERE singleton`)).rows[0].region
  if (owner !== region) throw new Error(`database belongs to region ${owner}; this process is configured for ${region} — refusing (ADR 0032)`)
  return owner
}

/** server.js start-up fence. GLOBAL tolerates a database migrated before
    this release (no row yet); IRAN never does. */
export async function assertDatabaseRegion(pool, region) {
  const { rows } = await pool.query(`SELECT to_regclass('public.runtime_region') IS NOT NULL AS present`)
  const owner = rows[0].present ? (await pool.query(`SELECT region FROM runtime_region WHERE singleton`)).rows[0]?.region ?? null : null
  if (owner === null) {
    if (region === 'GLOBAL') return null
    throw new Error('database has no region claim; run migrate with OPENFUND_REGION=IRAN on a dedicated Iran database (ADR 0032)')
  }
  if (owner !== region) throw new Error(`database belongs to region ${owner}; this process is configured for ${region} — refusing to start (ADR 0032)`)
  return owner
}

export class RuntimeState {
  constructor({ pool, config, cacheMs = 2000, now = () => Date.now(), probes = {} }) {
    this.pool = pool; this.config = config; this.cacheMs = cacheMs; this.now = now; this.probes = probes
    this.cached = null; this.cachedAt = 0
  }

  async current() {
    if (this.config.region === 'GLOBAL') return { region: 'GLOBAL', mode: 'GLOBAL_CONNECTED', epoch: 0, fixed: true }
    if (this.cached && this.now() - this.cachedAt < this.cacheMs) return this.cached
    const row = (await this.pool.query(`SELECT mode, epoch::int AS epoch, changed_at, changed_by, reason FROM runtime_mode WHERE singleton`)).rows[0]
    /* no row = not migrated: fail closed to the most restrictive mode */
    const state = row ? { region: this.config.region, ...row } : { region: this.config.region, mode: 'IRAN_ISOLATED', epoch: -1, unmigrated: true }
    this.cached = state; this.cachedAt = this.now()
    return state
  }

  async transition({ to, expectedEpoch, confirm, reason, actor }) {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const row = (await client.query(`SELECT mode, epoch::int AS epoch FROM runtime_mode WHERE singleton FOR UPDATE`)).rows[0]
      if (!row) throw fail(409, 'runtime_mode_not_migrated')
      validateTransition({ region: this.config.region, from: row.mode, to, expectedEpoch, epoch: row.epoch, confirm, reason })
      const gates = await evaluateGates({ pool: client, to, probes: this.probes })
      if (!gates.ok) {
        await client.query('ROLLBACK')
        await this.pool.query(
          `INSERT INTO runtime_mode_events (epoch, from_mode, to_mode, actor, reason, outcome, gates) VALUES ($1,$2,$3,$4,$5,'refused',$6)`,
          [row.epoch, row.mode, to, actor, reason, JSON.stringify(gates.gates)])
        /* `reasons` is the field the server's error handler returns to the caller */
        throw fail(409, 'gates_failed', { reasons: gates.gates })
      }
      const epoch = row.epoch + 1
      await client.query(`UPDATE runtime_mode SET mode=$1, epoch=$2, changed_at=now(), changed_by=$3, reason=$4 WHERE singleton`, [to, epoch, actor, reason])
      await client.query(
        `INSERT INTO runtime_mode_events (epoch, from_mode, to_mode, actor, reason, outcome, gates) VALUES ($1,$2,$3,$4,$5,'applied',$6)`,
        [epoch, row.mode, to, actor, reason, JSON.stringify(gates.gates)])
      await client.query('COMMIT')
      this.cached = null
      return { from: row.mode, to, epoch, gates: gates.gates }
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally { client.release() }
  }

  async history(limit = 50) {
    return (await this.pool.query(
      `SELECT id::int, epoch::int, from_mode, to_mode, actor, reason, outcome, gates, at FROM runtime_mode_events ORDER BY id DESC LIMIT $1`, [limit])).rows
  }
}

/* ---------------------------------------------------------------------
 * Express wiring
 * ------------------------------------------------------------------- */

/** Rejects every request the region/mode does not permit. Mount before routes. */
export function regionGuard(runtime) {
  return (req, res, next) => {
    if (runtime.config.region === 'GLOBAL') return next()
    if (SAFE_METHODS.has(req.method)) return next()
    runtime.current().then(state => {
      const r = permits(state, req.method, req.path)
      if (r.allowed) return next()
      res.status(503).set('Cache-Control', 'no-store').json({ error: 'operation_unavailable', operation: r.operation, reason: r.reason, region: state.region, mode: state.mode })
    }, next)
  }
}

/** `http` role off: only liveness and status stay reachable (worker process). */
export function httpRoleGate(config) {
  const open = new Set(['/health', '/version', '/runtime/status'])
  return (req, res, next) => hasRole(config, 'http') || open.has(req.path) ? next() : res.status(404).json({ error: 'not_found' })
}

export async function statusBody(runtime) {
  const state = await runtime.current()
  return {
    region: state.region,
    mode: state.mode,
    epoch: state.epoch,
    ...(state.changed_at ? { changedAt: state.changed_at } : {}),
    roles: runtime.config.roles,
    operations: operationTable(state),
  }
}

/**
 * Operator control plane (mounted at /admin/runtime). Authorization reuses
 * the admin service token and the named actor header; every applied or
 * refused transition is an append-only runtime_mode_events row.
 *   GET  /admin/runtime        status, allowed next modes, gate dry-run, history
 *   POST /admin/runtime/mode   { to, expectedEpoch, confirm: "CONFIRM-<to>", reason }
 */
export function runtimeAdminRoutes({ Router, runtime, adminAuth, adminActor, audit = async () => {} }) {
  const router = Router()
  router.use(adminAuth)
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
  router.get('/', wrap(async (req, res) => {
    const status = await statusBody(runtime)
    const next = allowedTransitions(status.region, status.mode)
    const dryRun = {}
    for (const to of next) dryRun[to] = await evaluateGates({ pool: runtime.pool, to, probes: runtime.probes })
    const history = status.region === 'GLOBAL' ? [] : await runtime.history()
    res.set('Cache-Control', 'no-store').json({ ...status, next: next.map(to => ({ to, confirm: confirmationFor(to), gates: dryRun[to] })), history })
  }))
  router.post('/mode', wrap(async (req, res) => {
    const actor = adminActor(req)
    const { to, expectedEpoch, confirm, reason } = req.body || {}
    const result = await runtime.transition({ to, expectedEpoch, confirm, reason, actor })
    await audit('runtime_mode_changed', null, req, { ...result, actor })
    res.json(result)
  }))
  return router
}
