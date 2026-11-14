/* Regional runtime (ADR 0032): roles, policy, mode state machine, database
   region fence and the real server's behaviour in each region.

   Pure tests always run. Database and server tests need two disposable
   databases (never production) and run when REGION_TEST_IRAN_URL and
   REGION_TEST_GLOBAL_URL are set, e.g.:
     REGION_TEST_IRAN_URL=postgres://…/openfund_region_iran_test
     REGION_TEST_GLOBAL_URL=postgres://…/openfund_region_global_test */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import express from 'express'
import pg from 'pg'
import {
  regionConfig, ROLES, permits, classifyRequest, operationTable, validateTransition, allowedTransitions,
  confirmationFor, claimDatabaseRegion, assertDatabaseRegion, RuntimeState, regionGuard, runtimeAdminRoutes, payoutGuard,
} from '../region.js'

const backendDir = fileURLToPath(new URL('..', import.meta.url))
const IRAN_URL = process.env.REGION_TEST_IRAN_URL
const GLOBAL_URL = process.env.REGION_TEST_GLOBAL_URL
const withDb = { skip: !(IRAN_URL && GLOBAL_URL) && 'set REGION_TEST_IRAN_URL and REGION_TEST_GLOBAL_URL' }
for (const u of [IRAN_URL, GLOBAL_URL].filter(Boolean))
  assert.match(new URL(u).pathname, /_test$/, 'region tests only run against databases whose name ends in _test')

/* ---------------- configuration ---------------- */

test('GLOBAL is the default and runs every role (unchanged Render behaviour)', () => {
  const c = regionConfig({})
  assert.equal(c.region, 'GLOBAL')
  assert.deepEqual([...c.roles], [...ROLES])
})

test('IRAN defaults to the http role only', () => {
  assert.deepEqual([...regionConfig({ OPENFUND_REGION: 'iran' }).roles], ['http'])
})

test('IRAN refuses every global payment/settlement role; the fenced engine is allowed', () => {
  for (const role of ['purchase-expiry', 'payment-recovery', 'settlement', 'treasury'])
    assert.throws(() => regionConfig({ OPENFUND_REGION: 'IRAN', OPENFUND_ROLES: `http,${role}` }), /not permitted in region IRAN/)
  assert.deepEqual([...regionConfig({ OPENFUND_REGION: 'IRAN', OPENFUND_ROLES: 'http,footprint,market-data' }).roles], ['http', 'footprint', 'market-data'])
  assert.deepEqual([...regionConfig({ OPENFUND_REGION: 'IRAN', OPENFUND_ROLES: 'http,engine,market-data,sync' }).roles], ['http', 'engine', 'market-data', 'sync'])
})

test('unknown regions and roles are configuration errors', () => {
  assert.throws(() => regionConfig({ OPENFUND_REGION: 'EU' }), /OPENFUND_REGION/)
  assert.throws(() => regionConfig({ OPENFUND_ROLES: 'http,mining' }), /unknown role/)
})

/* ---------------- policy ---------------- */

const financialWrites = [
  ['POST', '/purchases/orders'], ['POST', '/purchases/quote'], ['POST', '/purchases/verify'], ['POST', '/depay/callback'],
  ['POST', '/challenges/abc/start'],
  ['POST', '/trading/order'], ['POST', '/trading/positions/p1/close'], ['POST', '/trading/positions/p1/protection'], ['POST', '/trading/orders/o1/cancel'],
  ['POST', '/withdrawals'], ['POST', '/withdrawals/w1/cancel'], ['POST', '/rewards/accounts/a1/cycle'],
  ['POST', '/admin/withdrawals/w1/review'], ['POST', '/admin/economy/expenses'], ['POST', '/live/orders'], ['POST', '/live/apply'],
  ['POST', '/internal/inject-price'], ['DELETE', '/anything'], ['POST', '/a-route-added-later'],
]

test('GLOBAL permits every request, in every mode', () => {
  for (const mode of ['GLOBAL_CONNECTED', 'IRAN_ISOLATED', 'RECOVERY'])
    for (const [m, p] of financialWrites) assert.equal(permits({ region: 'GLOBAL', mode }, m, p).allowed, true, `${m} ${p}`)
})

/* ADR 0033 policy matrix for IRAN */
const alwaysDenied = [
  ['POST', '/purchases/orders'], ['POST', '/purchases/quote'], ['POST', '/purchases/verify'], ['POST', '/depay/callback'],
  ['POST', '/admin/economy/expenses'], ['POST', '/admin/payments/x/adjustments'], ['POST', '/live/orders'], ['POST', '/live/apply'],
  ['POST', '/admin/rewards/fee-refunds/x/paid'], ['POST', '/internal/inject-price'], ['DELETE', '/anything'], ['POST', '/a-route-added-later'],
]
const connectedOnly = [
  ['POST', '/challenges/abc/start'], ['POST', '/admin/rewards/reviews/c1'],
  ['POST', '/trading/order'], ['POST', '/trading/positions/p1/close'], ['POST', '/trading/positions/p1/protection'], ['POST', '/trading/orders/o1/cancel'],
]
/* account writes: additionally limited to IRAN-owned accounts by the database fence */
const everyMode = [['POST', '/withdrawals'], ['POST', '/withdrawals/w1/cancel'], ['POST', '/rewards/accounts/a1/cycle'], ['POST', '/admin/withdrawals/w1/review'],
  ['POST', '/admin/regional/reconcile'], ['POST', '/sync/v1/events']]

test('IRAN: purchases, live markets and other financial admin are denied in every mode (default deny)', () => {
  for (const mode of ['GLOBAL_CONNECTED', 'IRAN_ISOLATED', 'RECOVERY'])
    for (const [m, p] of alwaysDenied) {
      const r = permits({ region: 'IRAN', mode }, m, p)
      assert.equal(r.allowed, false, `${mode} ${m} ${p}`)
      assert.ok(r.reason)
    }
})

test('IRAN: execution and provisioning only while GLOBAL_CONNECTED', () => {
  for (const [m, p] of connectedOnly) {
    assert.equal(permits({ region: 'IRAN', mode: 'GLOBAL_CONNECTED' }, m, p).allowed, true, `${m} ${p}`)
    for (const mode of ['IRAN_ISOLATED', 'RECOVERY']) assert.equal(permits({ region: 'IRAN', mode }, m, p).allowed, false, `${mode} ${m} ${p}`)
  }
})

test('IRAN: withdrawal requests and staff review stay available in every mode', () => {
  for (const mode of ['GLOBAL_CONNECTED', 'IRAN_ISOLATED', 'RECOVERY'])
    for (const [m, p] of everyMode) assert.equal(permits({ region: 'IRAN', mode }, m, p).allowed, true, `${mode} ${m} ${p}`)
})

test('IRAN allows reads and the non-financial allowlist', () => {
  const s = { region: 'IRAN', mode: 'IRAN_ISOLATED' }
  for (const [m, p] of [['GET', '/trading/state'], ['GET', '/purchases/plans'], ['HEAD', '/'], ['POST', '/auth/nonce'], ['POST', '/auth/verify'],
    ['POST', '/auth/logout'], ['PATCH', '/auth/profile'], ['PUT', '/chart/workspaces/w/s'], ['PUT', '/portfolio/notes'],
    ['POST', '/support/messages'], ['POST', '/trading/preview'], ['POST', '/admin/runtime/mode']])
    assert.equal(permits(s, m, p).allowed, true, `${m} ${p}`)
})

test('denials name the operation and an explicit reason', () => {
  assert.equal(classifyRequest('POST', '/purchases/orders'), 'purchase')
  assert.deepEqual(permits({ region: 'IRAN', mode: 'IRAN_ISOLATED' }, 'POST', '/trading/order'),
    { allowed: false, operation: 'trading.execute', reason: 'execution_suspended_no_authoritative_market_data' })
  const table = operationTable({ region: 'IRAN', mode: 'IRAN_ISOLATED' })
  assert.equal(table.purchase.allowed, false)
  assert.equal(table['account.profile'].allowed, true)
  assert.ok(Object.values(regionConfig({}).roles).length)
})

test('IRAN records a payout as paid only while connected; approve/reject stay available', async () => {
  const fake = mode => ({ config: { region: 'IRAN' }, current: async () => ({ region: 'IRAN', mode }) })
  for (const [mode, body, path, expected] of [
    ['IRAN_ISOLATED', { action: 'paid' }, '/admin/withdrawals/w1/review', 503],
    ['RECOVERY', { action: 'paid' }, '/admin/withdrawals/w1/review', 503],
    ['IRAN_ISOLATED', { action: 'approve' }, '/admin/withdrawals/w1/review', 200],
    ['IRAN_ISOLATED', { action: 'reject' }, '/admin/withdrawals/w1/review', 200],
    ['GLOBAL_CONNECTED', { action: 'paid' }, '/admin/withdrawals/w1/review', 200],
    ['IRAN_ISOLATED', {}, '/admin/rewards/fee-refunds/f1/paid', 503],
  ]) {
    let status = 200
    const res = { status(c) { status = c; return this }, set() { return this }, json() { return this } }
    await new Promise(done => { payoutGuard(fake(mode))({ method: 'POST', path, body }, res, done); setTimeout(done, 20) })
    assert.equal(status, expected, `${mode} ${path} ${JSON.stringify(body)}`)
  }
})

/* ---------------- state machine ---------------- */

const ok = { region: 'IRAN', expectedEpoch: 3, epoch: 3, reason: 'international link down since 08:00' }

test('allowed transitions: restrictive anytime, reopening only through RECOVERY', () => {
  assert.deepEqual(allowedTransitions('IRAN', 'GLOBAL_CONNECTED'), ['IRAN_ISOLATED'])
  assert.deepEqual(allowedTransitions('IRAN', 'IRAN_ISOLATED'), ['RECOVERY'])
  assert.deepEqual(allowedTransitions('IRAN', 'RECOVERY'), ['IRAN_ISOLATED', 'GLOBAL_CONNECTED'])
  assert.deepEqual(allowedTransitions('GLOBAL', 'GLOBAL_CONNECTED'), [])
})

test('transition validation rejects every unsafe request', () => {
  const v = o => validateTransition({ ...ok, from: 'GLOBAL_CONNECTED', to: 'IRAN_ISOLATED', confirm: confirmationFor('IRAN_ISOLATED'), ...o })
  v({})
  const code = o => { try { v(o); return null } catch (e) { return e.message } }
  assert.equal(code({ region: 'GLOBAL' }), 'mode_fixed_in_global_region')
  assert.equal(code({ expectedEpoch: 2 }), 'stale_epoch')
  assert.equal(code({ expectedEpoch: undefined }), 'expected_epoch_required')
  assert.equal(code({ confirm: 'yes' }), 'confirmation_mismatch')
  assert.equal(code({ reason: 'short' }), 'reason_required')
  assert.equal(code({ to: 'RECOVERY', confirm: confirmationFor('RECOVERY') }), 'transition_not_allowed')
  assert.equal(code({ from: 'IRAN_ISOLATED', to: 'GLOBAL_CONNECTED', confirm: confirmationFor('GLOBAL_CONNECTED') }), 'transition_not_allowed')
  assert.equal(code({ to: 'OFFLINE' }), 'invalid_mode')
})

/* ---------------- database ---------------- */

test('database region fence', withDb, async () => {
  const iran = new pg.Pool({ connectionString: IRAN_URL }), global = new pg.Pool({ connectionString: GLOBAL_URL })
  try {
    assert.equal(await claimDatabaseRegion(iran, 'IRAN'), 'IRAN')
    await assert.rejects(claimDatabaseRegion(iran, 'GLOBAL'), /belongs to region IRAN/)
    await assert.rejects(assertDatabaseRegion(iran, 'GLOBAL'), /belongs to region IRAN/)
    await assert.rejects(assertDatabaseRegion(global, 'IRAN'), /belongs to region GLOBAL/)
    assert.equal(await assertDatabaseRegion(iran, 'IRAN'), 'IRAN')
  } finally { await iran.end(); await global.end() }
})

async function resetMode(pool) {
  /* events are append-only by trigger; the test database is disposable */
  await pool.query(`ALTER TABLE runtime_mode_events DISABLE TRIGGER trg_runtime_mode_events_immutable`)
  await pool.query(`TRUNCATE runtime_mode_events`)
  await pool.query(`ALTER TABLE runtime_mode_events ENABLE TRIGGER trg_runtime_mode_events_immutable`)
  await pool.query(`UPDATE runtime_mode SET mode='GLOBAL_CONNECTED', epoch=0`)
  await pool.query(`DELETE FROM region_reconciliation_runs`)
}

test('durable transitions: epochs, gates, audit, concurrency', withDb, async () => {
  const pool = new pg.Pool({ connectionString: IRAN_URL })
  try {
    await resetMode(pool)
    let reachable = false
    const peer = async () => reachable
      ? { ok: true, compatible: true, protocol: 1, outboxPending: 0, outboxDead: 0, inboxHeld: 0, inboxRejected: 0, openDiscrepancies: 0, quarantined: 0 }
      : { ok: false, error: 'connect ECONNREFUSED' }
    const rt = new RuntimeState({ pool, config: regionConfig({ OPENFUND_REGION: 'IRAN' }), cacheMs: 0, probes: { peer } })
    const go = (to, expectedEpoch) => rt.transition({ to, expectedEpoch, confirm: confirmationFor(to), reason: 'integration test transition', actor: 'admin:test' })

    assert.equal((await rt.current()).mode, 'GLOBAL_CONNECTED')
    /* two operators race on the same epoch: exactly one wins */
    const race = await Promise.allSettled([go('IRAN_ISOLATED', 0), go('IRAN_ISOLATED', 0)])
    assert.equal(race.filter(r => r.status === 'fulfilled').length, 1)
    assert.match(race.find(r => r.status === 'rejected').reason.message, /stale_epoch|already_in_mode/)
    assert.deepEqual(await rt.current().then(s => [s.mode, s.epoch]), ['IRAN_ISOLATED', 1])

    await assert.rejects(go('GLOBAL_CONNECTED', 1), /transition_not_allowed/)
    await go('RECOVERY', 1)
    /* reopening is gated: global origin unreachable → refused and audited */
    await assert.rejects(go('GLOBAL_CONNECTED', 2), e => e.message === 'gates_failed' && e.reasons.some(g => g.gate === 'peer_reachable' && !g.ok))
    /* reachable is not enough: no reconciliation since RECOVERY began */
    reachable = true
    await assert.rejects(go('GLOBAL_CONNECTED', 2), e => e.message === 'gates_failed' && e.reasons.some(g => g.gate === 'reconciliation_complete' && !g.ok) && e.reasons.find(g => g.gate === 'peer_reachable').ok)
    await pool.query(`INSERT INTO region_reconciliation_runs (started_by, status, expected, compared, mismatched, completed_at) VALUES ('admin:test','complete',0,0,0,now())`)
    assert.equal((await rt.current()).mode, 'RECOVERY')
    const done = await go('GLOBAL_CONNECTED', 2)
    assert.equal(done.epoch, 3)

    const history = await rt.history()
    assert.deepEqual(history.map(h => [h.to_mode, h.outcome]).reverse(),
      [['IRAN_ISOLATED', 'applied'], ['RECOVERY', 'applied'], ['GLOBAL_CONNECTED', 'refused'], ['GLOBAL_CONNECTED', 'refused'], ['GLOBAL_CONNECTED', 'applied']])
    await assert.rejects(pool.query(`UPDATE runtime_mode_events SET actor='x'`), /append-only/)
    await assert.rejects(pool.query(`DELETE FROM runtime_mode_events`), /append-only/)
  } finally { await pool.end() }
})

test('guard and operator API over HTTP', withDb, async () => {
  const pool = new pg.Pool({ connectionString: IRAN_URL })
  const prev = process.env.ADMIN_API_TOKEN
  process.env.ADMIN_API_TOKEN = 't'.repeat(40)
  const { adminAuth, adminActor } = await import('../admin.js')
  const rt = new RuntimeState({ pool, config: regionConfig({ OPENFUND_REGION: 'IRAN' }), cacheMs: 0 })
  const app = express()
  app.use(express.json())
  app.use(regionGuard(rt))
  app.use('/admin/runtime', runtimeAdminRoutes({ Router: express.Router, runtime: rt, adminAuth, adminActor }))
  app.post('/purchases/orders', (req, res) => res.json({ reached: true }))
  app.post('/auth/verify', (req, res) => res.json({ reached: true }))
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }))
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)) })
  const base = `http://127.0.0.1:${server.address().port}`
  const post = (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body ?? {}) })
  try {
    await resetMode(pool)
    const denied = await post('/purchases/orders')
    assert.equal(denied.status, 503)
    assert.deepEqual(await denied.json(), { error: 'operation_unavailable', operation: 'purchase', reason: 'purchases_global_region_only', region: 'IRAN', mode: 'GLOBAL_CONNECTED' })
    assert.equal((await post('/auth/verify')).status, 200)

    const auth = { authorization: `Bearer ${'t'.repeat(40)}`, 'x-admin-actor': 'ops-test' }
    const body = { to: 'IRAN_ISOLATED', expectedEpoch: 0, confirm: 'CONFIRM-IRAN_ISOLATED', reason: 'operator HTTP test transition' }
    assert.equal((await post('/admin/runtime/mode', body)).status, 403)
    assert.equal((await post('/admin/runtime/mode', body, { authorization: auth.authorization })).status, 400) // no named actor
    const r = await post('/admin/runtime/mode', body, auth)
    assert.equal(r.status, 200)
    assert.equal((await r.json()).epoch, 1)
    const view = await (await fetch(base + '/admin/runtime', { headers: auth })).json()
    assert.equal(view.mode, 'IRAN_ISOLATED')
    assert.deepEqual(view.next.map(n => n.to), ['RECOVERY'])
    assert.equal(view.history[0].actor, 'admin:ops-test')
  } finally {
    server.close(); await pool.end()
    if (prev === undefined) delete process.env.ADMIN_API_TOKEN; else process.env.ADMIN_API_TOKEN = prev
  }
})

/* ---------------- the real server ---------------- */

async function boot(env) {
  const port = 20000 + Math.floor(Math.random() * 20000)
  const child = spawn(process.execPath, ['server.js'], { cwd: backendDir, env: { PATH: process.env.PATH, PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  child.stdout.on('data', d => { log += d }); child.stderr.on('data', d => { log += d })
  const base = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) return { exited: child.exitCode, log }
    try { if ((await fetch(base + '/health')).ok) break } catch {}
    await new Promise(r => setTimeout(r, 100))
  }
  return { base, log: () => log, stop: () => new Promise(r => { child.once('exit', r); child.kill('SIGTERM') }) }
}

test('server: an IRAN process refuses a GLOBAL database', withDb, async () => {
  const r = spawnSync(process.execPath, ['server.js'], { cwd: backendDir, env: { PATH: process.env.PATH, PORT: '0', DATABASE_URL: GLOBAL_URL, OPENFUND_REGION: 'IRAN' }, encoding: 'utf8', timeout: 15000 })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /belongs to region GLOBAL/)
})

test('server: IRAN runs only its roles and refuses financial writes', withDb, async () => {
  const pool = new pg.Pool({ connectionString: IRAN_URL }); await resetMode(pool); await pool.end()
  const s = await boot({ DATABASE_URL: IRAN_URL, OPENFUND_REGION: 'IRAN' })
  assert.ok(s.base, s.log)
  try {
    const status = await (await fetch(s.base + '/runtime/status')).json()
    assert.equal(status.region, 'IRAN'); assert.equal(status.mode, 'GLOBAL_CONNECTED'); assert.deepEqual(status.roles, ['http'])
    assert.equal(status.operations.purchase.allowed, false)
    const post = p => fetch(s.base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then(r => r.status)
    for (const p of ['/purchases/orders', '/live/orders', '/admin/economy/expenses', '/a-route-added-later'])
      assert.equal(await post(p), 503, p)
    /* connected: execution and withdrawal routes reach their handlers (which then require a session) */
    for (const p of ['/trading/order', '/withdrawals']) assert.equal(await post(p), 401, p)
    /* reads and sign-in still reach their handlers */
    assert.equal((await fetch(s.base + '/auth/nonce', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: '0x' + '1'.repeat(40) }) })).status, 200)
    assert.match(s.log(), /\[region\] IRAN, roles: http/)
    assert.doesNotMatch(s.log(), /\[market-data\]|\[footprint\]|\[treasury\]/)
  } finally { await s.stop() }
})

test('server: GLOBAL defaults are unchanged', withDb, async () => {
  const s = await boot({ DATABASE_URL: GLOBAL_URL, ADMIN_API_TOKEN: 'a'.repeat(40) })
  assert.ok(s.base, s.log)
  try {
    const status = await (await fetch(s.base + '/runtime/status')).json()
    assert.equal(status.region, 'GLOBAL'); assert.deepEqual(status.roles, [...ROLES])
    assert.ok(Object.values(status.operations).every(o => o.allowed))
    /* the guard passes through: the purchase route answers (auth), not 503 */
    assert.equal((await fetch(s.base + '/purchases/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 401)
    /* GLOBAL mode is fixed */
    const r = await fetch(s.base + '/admin/runtime/mode', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + 'a'.repeat(40), 'x-admin-actor': 'ops' },
      body: JSON.stringify({ to: 'IRAN_ISOLATED', expectedEpoch: 0, confirm: 'CONFIRM-IRAN_ISOLATED', reason: 'must be refused in GLOBAL' }) })
    assert.equal(r.status, 409)
    assert.equal((await r.json()).error, 'mode_fixed_in_global_region')
    assert.match(s.log(), /\[region\] GLOBAL, roles: http, market-data, engine/)
  } finally { await s.stop() }
})

/* ---------------- wallet sign-in on the Iran domains, offline ---------------- */

test('server: SIWE on all three Iran domains with the Arbitrum RPC unreachable (EOA, local ecrecover)', withDb, async () => {
  const { generatePrivateKey, privateKeyToAccount } = await import('viem/accounts')
  const { createSiweMessage } = await import('viem/siwe')
  const http = await import('node:http')
  const domains = ['iran.openfund.cloud', 'iran.openfi.cloud', 'openfi.live']
  /* AUTH_RPC_URL points at a closed local port: every chain call fails */
  const s = await boot({ DATABASE_URL: IRAN_URL, OPENFUND_REGION: 'IRAN', ALLOWED_DOMAINS: domains.join(','), AUTH_RPC_URL: 'http://127.0.0.1:9', CORS_ORIGINS: domains.map(d => `https://${d}`).join(',') })
  assert.ok(s.base, s.log)
  const port = new URL(s.base).port
  /* a browser request: Host and Origin are the Iran domain */
  const call = (host, method, path, body, cookie) => new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const req = http.request({ host: '127.0.0.1', port, method, path, headers: { host, origin: `http://${host}`, 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) } }, res => {
      let t = ''; res.on('data', d => { t += d }); res.on('end', () => resolve({ status: res.statusCode, json: (() => { try { return JSON.parse(t) } catch { return null } })(), cookie: (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; '), setCookie: res.headers['set-cookie'] || [] }))
    })
    req.on('error', reject); if (data) req.write(data); req.end()
  })
  try {
    for (const domain of domains) {
      const wallet = privateKeyToAccount(generatePrivateKey())
      const n = await call(domain, 'POST', '/auth/nonce', { address: wallet.address })
      assert.equal(n.status, 200, domain)
      const message = createSiweMessage({ domain, address: wallet.address, uri: `http://${domain}/`, chainId: 42161, nonce: n.json.nonce, version: '1' })
      const signature = await wallet.signMessage({ message })
      const v = await call(domain, 'POST', '/auth/verify', { message, signature })
      assert.equal(v.status, 200, `${domain}: ${JSON.stringify(v.json)}`)
      assert.ok(v.setCookie.some(c => /^openfund_session=/.test(c) && /HttpOnly/i.test(c) && !/Domain=/i.test(c)), `${domain}: host-only HttpOnly session cookie`)
      const me = await call(domain, 'GET', '/auth/me', null, v.cookie)
      assert.equal(me.status, 200); assert.equal(me.json.user.walletAddress, wallet.address.toLowerCase())
      /* nonce is single-use */
      assert.equal((await call(domain, 'POST', '/auth/verify', { message, signature })).status, 400)
    }
    /* a global domain, or another chain, is refused by the Iran runtime */
    const w = privateKeyToAccount(generatePrivateKey())
    for (const [domain, chainId, error] of [['openfund.cloud', 42161, 'invalid_domain'], ['openfi.live', 1, 'invalid_chain']]) {
      const n = await call('openfi.live', 'POST', '/auth/nonce', { address: w.address })
      const message = createSiweMessage({ domain, address: w.address, uri: `http://${domain}/`, chainId, nonce: n.json.nonce, version: '1' })
      const v = await call('openfi.live', 'POST', '/auth/verify', { message, signature: await w.signMessage({ message }) })
      assert.equal(v.json.error, error)
    }
    /* a cross-site origin cannot use a session (CSRF) */
    const x = await new Promise(r => { const req = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/auth/logout', headers: { host: 'openfi.live', origin: 'https://evil.example' } }, res => { res.resume(); r(res.statusCode) }); req.end() })
    assert.equal(x, 403)
  } finally { await s.stop() }
})
