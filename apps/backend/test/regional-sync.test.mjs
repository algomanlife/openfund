/* Two-region integration and fault injection (ADR 0033).

   Runs two real `server.js` processes, GLOBAL and IRAN, each on its own
   disposable PostgreSQL database. They synchronize over signed HTTP through
   a fault-injecting proxy, so the test can drop the link, cut a batch in
   half, restart a region and hold events for a simulated 120 days. Trading
   activity is produced by the real Engine in-process against each region's
   database, with a deterministic test price source (never live data).

   Needs two FRESH databases (migrated, sync never enabled):
     REGION_SYNC_TEST_GLOBAL_URL=postgres://…/openfund_rsync_global_test
     REGION_SYNC_TEST_IRAN_URL=postgres://…/openfund_rsync_iran_test
   and the built frontend (react/), like every server-booting suite. */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { Engine } from '../engine.js'
import { signedHeaders, syncConfig } from '../regional-sync.js'

const GLOBAL_URL = process.env.REGION_SYNC_TEST_GLOBAL_URL
const IRAN_URL = process.env.REGION_SYNC_TEST_IRAN_URL
const skip = !(GLOBAL_URL && IRAN_URL) && 'set REGION_SYNC_TEST_GLOBAL_URL and REGION_SYNC_TEST_IRAN_URL'
for (const u of [GLOBAL_URL, IRAN_URL].filter(Boolean)) assert.match(new URL(u).pathname, /_test$/, 'only databases whose name ends in _test')

const backendDir = fileURLToPath(new URL('..', import.meta.url))
const KEYS = JSON.stringify({ k2026a: 'a'.repeat(48), k2026b: 'b'.repeat(48) })
const ADMIN = 'r'.repeat(40)
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function waitFor(fn, { timeout = 20000, every = 100, what = 'condition' } = {}) {
  const end = Date.now() + timeout
  for (;;) {
    const v = await fn().catch(() => null)
    if (v) return v
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`)
    await sleep(every)
  }
}

/* ---------- fault-injecting HTTP proxy between the regions ---------- */
function faultProxy(targetPort) {
  const state = { mode: 'up', requests: 0 }
  const server = http.createServer((req, res) => {
    state.requests++
    if (state.mode === 'down') return req.socket.destroy()
    const up = http.request({ host: '127.0.0.1', port: state.port ?? targetPort, method: req.method, path: req.url, headers: req.headers }, r => {
      /* the peer applied the batch, but the acknowledgment never arrives */
      if (state.mode === 'drop-response' && req.url.endsWith('/events')) { r.resume(); r.on('end', () => req.socket.destroy()); return }
      res.writeHead(r.statusCode, r.headers); r.pipe(res)
    })
    up.on('error', () => req.socket.destroy())
    req.pipe(up)
  })
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ state, port: server.address().port, close: () => new Promise(c => server.close(c)) })))
}

const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)) }) })

function startServer(name, env) {
  const child = spawn(process.execPath, ['server.js'], { cwd: backendDir, stdio: ['ignore', 'pipe', 'pipe'], env: {
    PATH: process.env.PATH, ADMIN_API_TOKEN: ADMIN, REGION_SYNC_KEYS: KEYS, REGION_SYNC_INTERVAL_MS: '150', REGION_SYNC_MAX_BACKOFF_MS: '1000', ...env } })
  let log = ''
  child.stdout.on('data', d => { log += d }); child.stderr.on('data', d => { log += d })
  const base = `http://127.0.0.1:${env.PORT}`
  return {
    name, child, base, log: () => log,
    ready: () => waitFor(async () => (await fetch(base + '/health')).ok, { what: `${name} health` }),
    stop: (signal = 'SIGTERM') => new Promise(r => { if (child.exitCode !== null) return r(); child.once('exit', r); child.kill(signal) }),
  }
}

const admin = (srv, method, path, body) => fetch(srv.base + path, { method, headers: { authorization: `Bearer ${ADMIN}`, 'x-admin-actor': 'ops-test', 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => null) }))

/* deterministic price source for the in-process engines */
const md = () => ({
  price: '50000', at: Date.now(), markets: new Map([['BTC/USD', { base: 'BTC', group: 'crypto', maxLeverage: 100 }]]),
  marketMeta(m) { return this.markets.get(m) }, mark(m) { return this.marketMeta(m) ? { mark: this.price, at: this.at } : null },
  tradeable(m) { return !this.marketMeta(m) ? { ok: false, reason: 'unknown_market' } : Date.now() - this.at > 5000 ? { ok: false, reason: 'stale_price' } : { ok: true, mark: this.price, meta: this.marketMeta(m) } },
})
const order = { market: 'BTC/USD', side: 'long', order_type: 'market', margin: 500, leverage: 10 }
const wallet = () => '0x' + randomUUID().replaceAll('-', '') + '00000000'

let G, I, gPool, iPool, gEngine, iEngine, gMd, iMd, toIran, toGlobal, ports
async function newUser(pool, engine) {
  const id = randomUUID(), w = wallet()
  await pool.query('INSERT INTO openfund_users (id, wallet_address) VALUES ($1,$2)', [id, w])
  await engine.ensureDemoAccount(id)
  const acc = (await pool.query(`SELECT * FROM demo_accounts WHERE user_id=$1`, [id])).rows[0]
  return { id, wallet: w, account: acc.id }
}
const trade = async (engine, m, u) => {
  m.at = Date.now()
  const r = await engine.submitOrder(u.id, order, randomUUID())
  assert.equal(r.ok, true, JSON.stringify(r))
  await engine.closePosition(u.id, r.position.id, { idempotencyKey: randomUUID() })
}
const one = async (pool, sql, p = []) => (await pool.query(sql, p)).rows[0]
const pending = pool => one(pool, `SELECT count(*)::int AS n FROM region_outbox WHERE acked_at IS NULL`).then(r => r.n)
const drained = (pool, what) => waitFor(async () => (await pending(pool)) === 0, { what: `${what} outbox drained`, timeout: 60000 })
const remoteLedger = (pool, account) => one(pool, `SELECT count(*)::int AS n FROM region_remote_entries WHERE entity='ledger' AND account_id=$1`, [account]).then(r => r.n)
const localLedger = (pool, account) => one(pool, `SELECT count(*)::int AS n FROM trading_ledger WHERE account_id=$1`, [account]).then(r => r.n)

before(async () => {
  if (skip) return
  gPool = new pg.Pool({ connectionString: GLOBAL_URL }); iPool = new pg.Pool({ connectionString: IRAN_URL })
  for (const [p, region] of [[gPool, 'GLOBAL'], [iPool, 'IRAN']]) {
    assert.equal((await one(p, `SELECT region FROM runtime_region`))?.region, region, `${region} test database must be migrated with OPENFUND_REGION=${region}`)
    assert.equal((await one(p, `SELECT openfund_sync_enabled() AS e`)).e, false, 'sync test databases must be fresh (recreate them)')
  }
  gMd = md(); iMd = md(); gEngine = new Engine(gPool, gMd); iEngine = new Engine(iPool, iMd)
  ports = { g: await freePort(), i: await freePort() }
  toIran = await faultProxy(ports.i); toGlobal = await faultProxy(ports.g)
  G = startServer('GLOBAL', { PORT: String(ports.g), DATABASE_URL: GLOBAL_URL, OPENFUND_ROLES: 'http,sync', RENDER_GIT_COMMIT: 'a'.repeat(40),
    REGION_SYNC_PEER_URL: `http://127.0.0.1:${toIran.port}`, REGION_SYNC_ACTIVE_KID: 'k2026a' })
  I = startServer('IRAN', { PORT: String(ports.i), DATABASE_URL: IRAN_URL, OPENFUND_REGION: 'IRAN', OPENFUND_ROLES: 'http,sync', RENDER_GIT_COMMIT: 'b'.repeat(40),
    REGION_SYNC_PEER_URL: `http://127.0.0.1:${toGlobal.port}`, REGION_SYNC_ACTIVE_KID: 'k2026b' })
  await G.ready(); await I.ready()
})
after(async () => {
  if (skip) return
  await G?.stop(); await I?.stop(); await toIran?.close(); await toGlobal?.close()
  await gPool?.end(); await iPool?.end()
})

/* ---------------------------------------------------------------- */

test('17. IRAN boots and serves with GLOBAL unreachable', { skip }, async () => {
  toGlobal.state.mode = 'down'
  await I.stop(); I = startServer('IRAN', { ...envOf('IRAN') }); await I.ready()
  const ready = await (await fetch(I.base + '/ready')).json()
  assert.equal(ready.ok, true); assert.equal(ready.region, 'IRAN'); assert.equal(ready.database.ok, true)
  assert.equal(ready.marketData.execution, 'suspended_no_authoritative_marks')
  assert.equal((await fetch(I.base + '/runtime/status')).status, 200)
  toGlobal.state.mode = 'up'
})

test('1. initial state transfer and continuous synchronization', { skip }, async () => {
  const gu = await newUser(gPool, gEngine)              // existed before sync was enabled
  await trade(gEngine, gMd, gu)
  assert.equal(await pending(gPool), 0, 'nothing is captured before sync is enabled')
  for (const s of [G, I]) {
    const r = await admin(s, 'POST', '/admin/regional/sync/enable', { confirm: 'ENABLE-REGIONAL-SYNC', reason: 'integration test initial transfer' })
    assert.equal(r.status, 200, JSON.stringify(r.body))
  }
  await drained(gPool, 'GLOBAL')
  assert.equal(await remoteLedger(iPool, gu.account), await localLedger(gPool, gu.account), 'snapshot carried the full ledger')
  /* continuous: a new trade after enabling arrives by itself */
  await trade(gEngine, gMd, gu)
  await drained(gPool, 'GLOBAL')
  assert.equal(await remoteLedger(iPool, gu.account), await localLedger(gPool, gu.account))
  const acc = await one(iPool, `SELECT data FROM region_remote_rows WHERE source_region='GLOBAL' AND entity='account' AND entity_id=$1`, [gu.account])
  const src = await one(gPool, `SELECT balance FROM demo_accounts WHERE id=$1`, [gu.account])
  assert.equal(Number(acc.data.balance), Number(src.balance))
  /* the IRAN engine cannot see the GLOBAL account: it is only a read model */
  assert.equal((await one(iPool, `SELECT count(*)::int AS n FROM demo_accounts WHERE id=$1`, [gu.account])).n, 0)
  /* and the other direction */
  const iu = await newUser(iPool, iEngine); await trade(iEngine, iMd, iu)
  await drained(iPool, 'IRAN')
  assert.equal(await remoteLedger(gPool, iu.account), await localLedger(iPool, iu.account))
  const hello = await one(gPool, `SELECT * FROM region_peer_status`)
  assert.equal(hello.compatible, true); assert.equal(hello.peer_release, 'b'.repeat(40), '15. different compatible releases synchronize')
})

function envOf(name) {
  return name === 'IRAN'
    ? { PORT: String(ports.i), DATABASE_URL: IRAN_URL, OPENFUND_REGION: 'IRAN', OPENFUND_ROLES: 'http,sync', RENDER_GIT_COMMIT: 'b'.repeat(40), REGION_SYNC_PEER_URL: `http://127.0.0.1:${toGlobal.port}`, REGION_SYNC_ACTIVE_KID: 'k2026b' }
    : { PORT: String(ports.g), DATABASE_URL: GLOBAL_URL, OPENFUND_ROLES: 'http,sync', RENDER_GIT_COMMIT: 'a'.repeat(40), REGION_SYNC_PEER_URL: `http://127.0.0.1:${toIran.port}`, REGION_SYNC_ACTIVE_KID: 'k2026a' }
}

/* signed direct request to a region, as its peer would send it */
async function peerPost(srv, fromRegion, path, payload, { mutate = h => h, body: rawBody } = {}) {
  const cfg = syncConfig({ REGION_SYNC_KEYS: KEYS, REGION_SYNC_ACTIVE_KID: 'k2026a' }, fromRegion)
  const body = Buffer.from(rawBody ?? JSON.stringify(payload))
  const headers = mutate(signedHeaders(cfg, 'POST', path, body))
  const r = await fetch(srv.base + path, { method: 'POST', headers, body })
  return { status: r.status, body: await r.json().catch(() => null), headers }
}
const fakeEvent = (stream, seq, row, extra = {}) => ({ event_id: randomUUID(), stream, stream_seq: seq, type: 'user.v1', schema_version: 1, account_id: null, epoch: null,
  payload: { row, wallet: row.wallet_address, op: 'insert', table: 'openfund_users', home_region: 'GLOBAL' }, ...extra })

test('5–6. duplicate and out-of-order delivery have exactly-once effects', { skip }, async () => {
  const stream = 'user:' + randomUUID(), base = { id: randomUUID(), wallet_address: wallet(), status: 'active' }
  const e1 = fakeEvent(stream, 1, base), e2 = fakeEvent(stream, 2, { ...base, status: 'disabled' }), e3 = fakeEvent(stream, 3, { ...base, status: 'active', display_name: 'third' })
  let r = await peerPost(I, 'GLOBAL', '/sync/v1/events', { events: [e3] })
  assert.equal(r.body.results[0].status, 'held')
  r = await peerPost(I, 'GLOBAL', '/sync/v1/events', { events: [e1] })
  assert.equal(r.body.results[0].status, 'applied')
  r = await peerPost(I, 'GLOBAL', '/sync/v1/events', { events: [e2, e2] })
  assert.deepEqual(r.body.results.map(x => x.status).sort(), ['applied', 'duplicate'])
  r = await peerPost(I, 'GLOBAL', '/sync/v1/events', { events: [e1, e3] })
  assert.deepEqual(r.body.results.map(x => x.status), ['duplicate', 'duplicate'])
  const row = await one(iPool, `SELECT data FROM region_remote_rows WHERE source_region='GLOBAL' AND entity='user' AND entity_id=$1`, [base.id])
  assert.equal(row.data.display_name, 'third', 'held successor applied after the gap closed, in order')
  assert.equal((await one(iPool, `SELECT applied_seq::int FROM region_stream_checkpoints WHERE stream=$1`, [stream])).applied_seq, 3)
  /* a different event at a used position is never silently accepted */
  r = await peerPost(I, 'GLOBAL', '/sync/v1/events', { events: [fakeEvent(stream, 2, base)] })
  assert.equal(r.body.results[0].error, 'sequence_conflict')
  const d = await one(iPool, `SELECT id FROM region_discrepancies WHERE kind='sequence_conflict' AND status='open'`)
  await admin(I, 'POST', `/admin/regional/discrepancies/${d.id}/acknowledge`, { confirm: `ACKNOWLEDGE-${d.id}`, reason: 'test-crafted conflicting event, no business data' })
})

test('transport security: tampering, replay, stale timestamps, wrong source, key rotation', { skip }, async () => {
  const ev = { events: [fakeEvent('user:' + randomUUID(), 1, { id: randomUUID(), wallet_address: wallet(), status: 'active' })] }
  assert.equal((await peerPost(I, 'GLOBAL', '/sync/v1/events', ev, { body: JSON.stringify(ev).replace('active', 'banned') + ' ' })).status, 200, 'sanity: body signed as sent')
  const tampered = await peerPost(I, 'GLOBAL', '/sync/v1/events', ev, { mutate: h => ({ ...h, 'x-openfund-sync-signature': h['x-openfund-sync-signature'].replace(/^./, c => c === '0' ? '1' : '0') }) })
  assert.equal(tampered.status, 401); assert.equal(tampered.body.error, 'invalid_signature')
  const first = await peerPost(I, 'GLOBAL', '/sync/v1/events', ev)
  const replay = await fetch(I.base + '/sync/v1/events', { method: 'POST', headers: first.headers, body: JSON.stringify(ev) })
  assert.equal(replay.status, 401); assert.equal((await replay.json()).error, 'replayed_request')
  const stale = await peerPost(I, 'GLOBAL', '/sync/v1/events', ev, { mutate: h => ({ ...h, 'x-openfund-sync-ts': String(Date.now() - 10 * 60_000) }) })
  assert.equal(stale.status, 401)
  const wrongRegion = await peerPost(I, 'IRAN', '/sync/v1/events', ev)
  assert.equal(wrongRegion.status, 403)
  const unknownKid = await peerPost(I, 'GLOBAL', '/sync/v1/events', ev, { mutate: h => ({ ...h, 'x-openfund-sync-kid': 'retired' }) })
  assert.equal(unknownKid.status, 401)
  /* GLOBAL signs with k2026a, IRAN with k2026b: both keys accepted during rotation */
  assert.equal((await one(gPool, `SELECT compatible FROM region_peer_status`)).compatible, true)
})

test('4. a batch cut mid-response is redelivered without duplicate effects', { skip }, async () => {
  const gu = await newUser(gPool, gEngine)
  toIran.state.mode = 'drop-response'
  await trade(gEngine, gMd, gu)
  await waitFor(async () => (await remoteLedger(iPool, gu.account)) === (await localLedger(gPool, gu.account)), { what: 'applied despite lost ack' })
  assert.ok(await pending(gPool) > 0, 'sender has not seen the acknowledgment')
  toIran.state.mode = 'up'
  await drained(gPool, 'GLOBAL')
  assert.equal(await remoteLedger(iPool, gu.account), await localLedger(gPool, gu.account), 'redelivery did not duplicate ledger entries')
})

test('7. fencing: a foreign-owned or fenced account cannot be written, and a stale writer cannot commit', { skip }, async () => {
  const gu = await newUser(gPool, gEngine)
  /* stale worker: a transaction that began writing before the fence */
  const stale = await gPool.connect()
  await stale.query('BEGIN')
  await stale.query(`UPDATE demo_accounts SET updated_at=now() WHERE id=$1`, [gu.account])   // holds the ownership row FOR SHARE
  const fencing = gPool.query(`UPDATE account_ownership SET state='fenced', epoch=epoch+1 WHERE account_id=$1`, [gu.account])
  await sleep(200)
  let fenced = false; fencing.then(() => { fenced = true })
  await sleep(100)
  assert.equal(fenced, false, 'the fence waits for the in-flight writer')
  await stale.query('COMMIT'); stale.release()
  await fencing
  /* every writer after the fence is rejected: API path, engine path, raw SQL */
  await assert.rejects(gEngine.submitOrder(gu.id, order, randomUUID()), /account_not_writable_in_region/)
  await assert.rejects(gPool.query(`INSERT INTO trading_ledger (account_id, user_id, event, amount, balance_after) VALUES ($1,$2,'demo_funding',1,1)`, [gu.account, gu.id]), /account_not_writable_in_region/)
  /* the engine loop skips it */
  assert.equal((await one(gPool, `SELECT openfund_account_writable($1) AS w`, [gu.account])).w, false)
  await gPool.query(`UPDATE account_ownership SET state='active', epoch=epoch+1 WHERE account_id=$1`, [gu.account])
})

test('8/10. both regions claiming one account: quarantine, fence and human review', { skip }, async () => {
  const iu = await newUser(iPool, iEngine)
  await drained(iPool, 'IRAN')
  const own = await one(iPool, `SELECT epoch::int FROM account_ownership WHERE account_id=$1`, [iu.account])
  const claim = { event_id: randomUUID(), stream: 'user:' + randomUUID(), stream_seq: 1, type: 'ownership.v1', schema_version: 1, account_id: iu.account, epoch: own.epoch,
    payload: { row: { account_id: iu.account, home_region: 'GLOBAL', epoch: own.epoch, state: 'active' }, wallet: iu.wallet, op: 'insert', table: 'account_ownership', home_region: 'GLOBAL' } }
  const r = await peerPost(I, 'GLOBAL', '/sync/v1/events', { events: [claim] })
  assert.equal(r.body.results[0].error, 'ownership_conflict')
  assert.equal((await one(iPool, `SELECT state FROM account_ownership WHERE account_id=$1`, [iu.account])).state, 'quarantined')
  iMd.at = Date.now()
  await assert.rejects(iEngine.submitOrder(iu.id, order, randomUUID()), /account_not_writable_in_region/, 'quarantine blocks the local engine')
  let un = await admin(I, 'POST', `/admin/regional/accounts/${iu.account}/unquarantine`, { confirm: `UNQUARANTINE-${iu.account.slice(0, 8)}`, reason: 'reviewed: GLOBAL never owned it' })
  assert.equal(un.body.error, 'open_discrepancies_for_account')
  const d = await one(iPool, `SELECT id FROM region_discrepancies WHERE account_id=$1 AND kind='ownership_conflict' AND status='open'`, [iu.account])
  await admin(I, 'POST', `/admin/regional/discrepancies/${d.id}/acknowledge`, { confirm: `ACKNOWLEDGE-${d.id}`, reason: 'reviewed: GLOBAL never owned this account' })
  un = await admin(I, 'POST', `/admin/regional/accounts/${iu.account}/unquarantine`, { confirm: `UNQUARANTINE-${iu.account.slice(0, 8)}`, reason: 'reviewed: GLOBAL never owned it' })
  assert.equal(un.status, 200)
  /* 11. the conflicting epoch is now stale */
  const late = { ...claim, event_id: randomUUID(), stream_seq: 2 }
  const r2 = await peerPost(I, 'GLOBAL', '/sync/v1/events', { events: [late] })
  assert.equal(r2.body.results[0].status, 'superseded')
  await trade(iEngine, iMd, iu)
})

test('14/16. unsupported schema or protocol suspends instead of corrupting', { skip }, async () => {
  const ev = fakeEvent('user:' + randomUUID(), 1, { id: randomUUID(), wallet_address: wallet(), status: 'active' }, { schema_version: 2 })
  const r = await peerPost(I, 'GLOBAL', '/sync/v1/events', { events: [ev] })
  assert.equal(r.body.results[0].error, 'unsupported_schema_version'); assert.equal(r.body.results[0].retryable, true)
  const incompatible = await peerPost(I, 'GLOBAL', '/sync/v1/events', { events: [] }, { mutate: h => ({ ...h, 'x-openfund-sync-protocol': '2' }) })
  assert.equal(incompatible.status, 409); assert.equal(incompatible.body.error, 'incompatible_protocol')
  const invalid = await peerPost(I, 'GLOBAL', '/sync/v1/events', { events: [{ ...ev, schema_version: 1, payload: { row: { id: 'x' } } }] })
  assert.match(invalid.body.results[0].error, /invalid_field/)
  for (const row of (await iPool.query(`SELECT id FROM region_discrepancies WHERE kind='schema_unsupported' AND status='open'`)).rows)
    await admin(I, 'POST', `/admin/regional/discrepancies/${row.id}/acknowledge`, { confirm: `ACKNOWLEDGE-${row.id}`, reason: 'test-crafted schema version 2 event' })
})

test('18/2/3/10/11/12. isolation for a simulated 120 days, restart, recovery and supervised reopening', { skip }, async () => {
  const iu = await newUser(iPool, iEngine)
  await drained(iPool, 'IRAN')
  /* the international link goes down in both directions */
  toGlobal.state.mode = 'down'; toIran.state.mode = 'down'
  let st = await admin(I, 'GET', '/admin/runtime')
  let t = await admin(I, 'POST', '/admin/runtime/mode', { to: 'IRAN_ISOLATED', expectedEpoch: st.body.epoch, confirm: 'CONFIRM-IRAN_ISOLATED', reason: 'international link lost (test)' })
  assert.equal(t.status, 200)
  /* trading execution is refused by the server in isolation */
  assert.equal((await fetch(I.base + '/trading/order', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 503)
  /* 18. authoritative prices lost: the engine refuses stale marks, positions stay untouched */
  iMd.at = Date.now()
  const open = await iEngine.submitOrder(iu.id, order, randomUUID())
  iMd.at = Date.now() - 60_000
  await assert.rejects(iEngine.closePosition(iu.id, open.position.id, { idempotencyKey: randomUUID() }), e => /stale|market|price/i.test(e.message), 'no execution on a stale mark')
  assert.equal((await one(iPool, `SELECT status FROM trading_positions WHERE id=$1`, [open.position.id])).status, 'open')
  /* local financial activity keeps accumulating durable events (100 accounts × trades) */
  iMd.at = Date.now()
  await iEngine.closePosition(iu.id, open.position.id, { idempotencyKey: randomUUID() })
  const users = []
  for (let n = 0; n < 40; n++) { const u = await newUser(iPool, iEngine); await trade(iEngine, iMd, u); users.push(u) }
  /* time manipulation: everything pending is 120 days old */
  await iPool.query(`UPDATE region_outbox SET created_at = now() - interval '120 days' WHERE acked_at IS NULL`)
  const backlog = await pending(iPool)
  assert.ok(backlog > 200, `backlog ${backlog}`)
  /* 10. IRAN restarts while isolated: the backlog and the mode survive */
  await I.stop('SIGKILL'); I = startServer('IRAN', envOf('IRAN')); await I.ready()
  assert.equal(await pending(iPool), backlog)
  const dash = await admin(I, 'GET', '/admin/regional')
  assert.equal(dash.body.mode, 'IRAN_ISOLATED')
  assert.ok(dash.body.sync.outbox.oldest_pending_s >= 120 * 86400 - 60, 'oldest pending ≈ 120 days, nothing expired')
  /* connectivity returns; reopening is NOT automatic */
  toGlobal.state.mode = 'up'; toIran.state.mode = 'up'
  st = await admin(I, 'GET', '/admin/runtime')
  t = await admin(I, 'POST', '/admin/runtime/mode', { to: 'RECOVERY', expectedEpoch: st.body.epoch, confirm: 'CONFIRM-RECOVERY', reason: 'link restored, start reconciliation' })
  assert.equal(t.status, 200)
  /* 12. reopening is refused while events are unacknowledged / not reconciled */
  t = await admin(I, 'POST', '/admin/runtime/mode', { to: 'GLOBAL_CONNECTED', expectedEpoch: st.body.epoch + 1, confirm: 'CONFIRM-GLOBAL_CONNECTED', reason: 'try to reopen too early' })
  assert.equal(t.status, 409); assert.equal(t.body.error, 'gates_failed')
  assert.ok(t.body.reasons.some(g => g.gate === 'reconciliation_complete' && !g.ok))
  await drained(iPool, 'IRAN')
  for (const u of users) assert.equal(await remoteLedger(gPool, u.account), await localLedger(iPool, u.account))
  /* reconciliation in both directions */
  const rec = await admin(I, 'POST', '/admin/regional/reconcile', { reason: 'post-outage reconciliation (test)' })
  assert.equal(rec.status, 200, JSON.stringify(rec.body))
  const run = await waitFor(async () => { const r = await admin(I, 'GET', `/admin/regional/reconciliation/${rec.body.run}`); return r.body.run.status === 'complete' && r.body }, { what: 'reconciliation run', timeout: 60000 })
  assert.equal(run.run.mismatched, 0, JSON.stringify(run.discrepancies))
  await drained(iPool, 'IRAN'); await drained(gPool, 'GLOBAL')
  t = await admin(I, 'POST', '/admin/runtime/mode', { to: 'GLOBAL_CONNECTED', expectedEpoch: st.body.epoch + 1, confirm: 'CONFIRM-GLOBAL_CONNECTED', reason: 'all reopening gates should pass now' })
  assert.equal(t.status, 200, JSON.stringify(t.body))
})

test('13. a financial discrepancy blocks reopening until reviewed and re-reconciled', { skip }, async () => {
  const gu = await newUser(gPool, gEngine); await trade(gEngine, gMd, gu)
  await drained(gPool, 'GLOBAL')
  /* corrupt IRAN's projection of a GLOBAL account */
  await iPool.query(`UPDATE region_remote_rows SET data = jsonb_set(data, '{balance}', '"1"') WHERE source_region='GLOBAL' AND entity='account' AND entity_id=$1`, [gu.account])
  let st = await admin(I, 'GET', '/admin/runtime')
  await admin(I, 'POST', '/admin/runtime/mode', { to: 'IRAN_ISOLATED', expectedEpoch: st.body.epoch, confirm: 'CONFIRM-IRAN_ISOLATED', reason: 'drill: isolate before reconciliation' })
  await admin(I, 'POST', '/admin/runtime/mode', { to: 'RECOVERY', expectedEpoch: st.body.epoch + 1, confirm: 'CONFIRM-RECOVERY', reason: 'drill: recovery with a corrupted projection' })
  const rec = await admin(I, 'POST', '/admin/regional/reconcile', { reason: 'drill reconciliation with corruption' })
  const run = await waitFor(async () => { const r = await admin(I, 'GET', `/admin/regional/reconciliation/${rec.body.run}`); return r.body.run.status === 'complete' && r.body }, { what: 'run', timeout: 60000 })
  assert.equal(run.run.mismatched, 1)
  const disc = run.discrepancies.find(d => d.kind === 'balance_mismatch' && d.account_id === gu.account)
  assert.ok(disc)
  const blocked = await admin(I, 'POST', '/admin/runtime/mode', { to: 'GLOBAL_CONNECTED', expectedEpoch: st.body.epoch + 2, confirm: 'CONFIRM-GLOBAL_CONNECTED', reason: 'must be blocked by the discrepancy' })
  assert.equal(blocked.status, 409)
  assert.ok(blocked.body.reasons.some(g => g.gate === 'no_open_discrepancies' && !g.ok))
  /* repair: the projection is rebuilt from the authoritative event (next account event re-projects it) */
  await trade(gEngine, gMd, gu); await drained(gPool, 'GLOBAL')
  await admin(I, 'POST', `/admin/regional/discrepancies/${disc.id}/acknowledge`, { confirm: `ACKNOWLEDGE-${disc.id}`, reason: 'projection rebuilt from later authoritative events' })
  const rec2 = await admin(I, 'POST', '/admin/regional/reconcile', { reason: 'clean reconciliation after repair' })
  const run2 = await waitFor(async () => { const r = await admin(I, 'GET', `/admin/regional/reconciliation/${rec2.body.run}`); return r.body.run.status === 'complete' && r.body }, { what: 'run 2', timeout: 60000 })
  assert.equal(run2.run.mismatched, 0)
  await drained(iPool, 'IRAN'); await drained(gPool, 'GLOBAL')
  const ok = await admin(I, 'POST', '/admin/runtime/mode', { to: 'GLOBAL_CONNECTED', expectedEpoch: st.body.epoch + 2, confirm: 'CONFIRM-GLOBAL_CONNECTED', reason: 'reopen after a clean reconciliation' })
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
})

test('ownership handoff GLOBAL → IRAN: fenced, imported, verified, transferred', { skip }, async () => {
  const gu = await newUser(gPool, gEngine); await trade(gEngine, gMd, gu)
  /* not flat: refused */
  gMd.at = Date.now()
  const open = await gEngine.submitOrder(gu.id, order, randomUUID())
  let r = await admin(G, 'POST', `/admin/regional/accounts/${gu.account}/release`, { to: 'IRAN', confirm: `RELEASE-${gu.account.slice(0, 8)}-TO-IRAN`, reason: 'owner-approved test handoff' })
  assert.equal(r.body.error, 'account_not_flat')
  await gEngine.closePosition(gu.id, open.position.id, { idempotencyKey: randomUUID() })
  r = await admin(G, 'POST', `/admin/regional/accounts/${gu.account}/release`, { to: 'IRAN', confirm: `RELEASE-${gu.account.slice(0, 8)}-TO-IRAN`, reason: 'owner-approved test handoff' })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  const epoch = r.body.epoch
  /* GLOBAL can no longer write it */
  await assert.rejects(gEngine.submitOrder(gu.id, order, randomUUID()), /account_not_writable_in_region/)
  await drained(gPool, 'GLOBAL')
  /* a wrong confirmation or epoch is refused */
  assert.equal((await admin(I, 'POST', `/admin/regional/accounts/${gu.account}/accept`, { epoch, confirm: 'yes', reason: 'accept the handoff in IRAN' })).status, 400)
  assert.equal((await admin(I, 'POST', `/admin/regional/accounts/${gu.account}/accept`, { epoch: epoch + 5, confirm: `ACCEPT-${gu.account.slice(0, 8)}-EPOCH-${epoch + 5}`, reason: 'accept the handoff in IRAN' })).status, 404)
  r = await admin(I, 'POST', `/admin/regional/accounts/${gu.account}/accept`, { epoch, confirm: `ACCEPT-${gu.account.slice(0, 8)}-EPOCH-${epoch}`, reason: 'accept the handoff in IRAN' })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  const srcBal = (await one(gPool, `SELECT balance FROM demo_accounts WHERE id=$1`, [gu.account])).balance
  assert.equal(Number((await one(iPool, `SELECT balance FROM demo_accounts WHERE id=$1`, [gu.account])).balance), Number(srcBal))
  assert.equal(await localLedger(iPool, gu.account), await localLedger(gPool, gu.account))
  /* IRAN's engine now owns and executes it */
  const iuser = (await one(iPool, `SELECT user_id FROM demo_accounts WHERE id=$1`, [gu.account])).user_id
  await trade(iEngine, iMd, { id: iuser, account: gu.account })
  /* GLOBAL marks its copy transferred when IRAN's ownership event arrives */
  await waitFor(async () => (await one(gPool, `SELECT state, home_region FROM account_ownership WHERE account_id=$1`, [gu.account])).state === 'transferred', { what: 'transferred' })
  await drained(iPool, 'IRAN')
  assert.equal(await remoteLedger(gPool, gu.account), await localLedger(iPool, gu.account), 'GLOBAL read model rebuilt from IRAN')
  /* the accepted offer cannot be replayed */
  r = await admin(I, 'POST', `/admin/regional/accounts/${gu.account}/accept`, { epoch, confirm: `ACCEPT-${gu.account.slice(0, 8)}-EPOCH-${epoch}`, reason: 'accept the handoff again' })
  assert.equal(r.status, 409)
  /* GLOBAL engine loop skips the transferred account */
  assert.equal((await one(gPool, `SELECT openfund_account_writable($1) AS w`, [gu.account])).w, false)
})

test('certificates (#118): issued in GLOBAL, verifiable on IRAN; revocation follows', { skip }, async () => {
  const gu = await newUser(gPool, gEngine)
  const serial = (await one(gPool, `INSERT INTO certificates (user_id, kind, source_id, holder, plan, amount, event_at)
    VALUES ($1,'purchase',$2,'Test Holder','Test plan',100,now()) RETURNING serial`, [gu.id, randomUUID()])).serial
  await drained(gPool, 'GLOBAL')
  const verify = srv => fetch(srv.base + '/certificates/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ serial }) }).then(r => r.json())
  assert.equal((await verify(I)).status, 'valid', 'the IRAN runtime verifies a GLOBAL certificate from its read model')
  assert.equal((await verify(I)).certificate.holder, 'Test Holder')
  await gPool.query(`UPDATE certificates SET status='revoked', revoked_at=now() WHERE serial=$1`, [serial])
  await drained(gPool, 'GLOBAL')
  assert.equal((await verify(I)).status, 'revoked')
})

test('9. a region process killed during delivery loses nothing', { skip }, async () => {
  const before = await one(iPool, `SELECT count(*)::int AS n FROM region_inbox WHERE status = 'rejected'`)
  const users = []
  for (let n = 0; n < 60; n++) { const u = await newUser(gPool, gEngine); await trade(gEngine, gMd, u); users.push(u) }
  const streams = users.map(u => 'user:' + u.id)
  /* kill IRAN once part of this backlog is applied and part is still unacknowledged */
  await waitFor(async () => (await one(iPool, `SELECT count(*)::int AS n FROM region_inbox WHERE stream = ANY($1)`, [streams])).n > 0, { what: 'delivery started', every: 5 })
  await I.stop('SIGKILL')
  assert.ok(await pending(gPool) > 0, 'killed mid-delivery: events still unacknowledged')
  I = startServer('IRAN', envOf('IRAN')); await I.ready()
  await drained(gPool, 'GLOBAL')
  for (const u of users) assert.equal(await remoteLedger(iPool, u.account), await localLedger(gPool, u.account))
  assert.equal((await one(iPool, `SELECT count(*)::int AS n FROM region_inbox WHERE status = 'held'`)).n, 0, 'no gap left behind')
  assert.equal((await one(iPool, `SELECT count(*)::int AS n FROM region_inbox WHERE status = 'rejected'`)).n, before.n, 'nothing rejected by the crash')
})
