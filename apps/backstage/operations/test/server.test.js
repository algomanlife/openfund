import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { createServer, request } from 'node:http'
import { test } from 'node:test'
import { createVerifier } from '../password.js'
import { createBackstage, loadConfig } from '../server.js'

const open = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + server.address().port)))

test('login, privilege checks, step-up, expiration, revocation and throttling', async t => {
  const calls = [], events = []
  let region = 'GLOBAL'
  const upstream = createServer(async (req, res) => {
    const parts = []
    for await (const part of req) parts.push(part)
    calls.push({ path: req.url, method: req.method, headers: req.headers, body: Buffer.concat(parts).toString() })
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/admin/runtime') {
      res.writeHead(302, { Location: '/private' }).end()
    } else if (req.url === '/runtime/status') {
      res.end(JSON.stringify({ region, mode: 'GLOBAL_CONNECTED' }))
    } else res.end(JSON.stringify({ users: [], total: 0 }))
  })
  const secret = randomBytes(32).toString('hex')
  const password = randomBytes(24).toString('base64url')
  const settings = { origin: '', backend: await open(upstream), cms: 'http://127.0.0.1:8055',
    owner: 'owner-fixture', credential: secret, verifier: await createVerifier(password) }
  const origin = 'https://backstage.example.test'
  let clock = Date.now()
  const server = createBackstage({ ...settings, origin, realSettlement: true }, { now: () => clock, audit: entry => events.push(entry) })
  const local = await open(server)
  t.after(() => { server.close(); upstream.close() })
  const call = (path, body, headers = {}) => new Promise((resolve, reject) => {
    const req = request(local + path, {
      method: body ? 'POST' : 'GET',
      headers: { Host: new URL(origin).host, ...(body && { Origin: origin, 'Content-Type': 'application/json' }), ...headers },
    }, async res => {
      try {
        const parts = []
        for await (const part of res) parts.push(part)
        resolve({ status: res.statusCode, cookie: res.headers['set-cookie']?.[0], body: JSON.parse(Buffer.concat(parts)) })
      } catch (error) { reject(error) }
    })
    req.on('error', reject)
    req.end(body ? JSON.stringify(body) : undefined)
  })
  assert.equal((await call('/api/users')).status, 401)
  assert.equal((await call('/api/login', { username: settings.owner, password }, { Origin: 'https://example.invalid' })).status, 403)
  assert.equal((await call('/api/login', { username: 'other', password })).status, 401)
  const login = await call('/api/login', { username: settings.owner, password })
  assert.equal(login.status, 200)
  assert.match(login.cookie, /^__Host-openfund-backstage=.*HttpOnly; SameSite=Strict;.*Secure/)
  assert.ok(!JSON.stringify(login.body).includes(secret))
  const headers = { Cookie: login.cookie.split(';')[0], 'X-CSRF-Token': login.body.csrf }
  const search = 'wallet&status=active?#'
  assert.equal((await call('/api/users?' + new URLSearchParams({ search, redirect: 'http://invalid' }), undefined, headers)).status, 200)
  const inspected = new URL(calls[0].path, settings.backend)
  assert.equal(inspected.pathname, '/admin/users')
  assert.deepEqual(Object.fromEntries(inspected.searchParams), { search, limit: '25' })
  assert.equal(calls[0].headers.authorization, 'Bearer ' + secret)
  assert.equal(calls[0].headers.cookie, undefined)
  assert.equal(calls[0].headers['x-admin-actor'], settings.owner)
  assert.match(calls[0].headers['x-request-id'], /^[a-f0-9-]{36}$/)
  assert.equal((await call('/api/system', undefined, headers)).body.backendReady, false)
  assert.equal(calls.length, 4, 'one request to each endpoint and no redirect follow')
  assert.ok(!calls.some(c => c.path === '/private'))
  assert.equal((await call('/api/users/target/path', undefined, headers)).status, 404)
  const record = randomUUID()
  const path = '/api/payouts/' + record
  const decision = { action: 'approve', reason: 'Reviewed evidence', password }
  assert.equal((await call(path, decision, { Cookie: headers.Cookie })).status, 403)
  assert.equal((await call(path, { ...decision, action: 'paid', payoutRef: 'untrusted' }, headers)).status, 400)
  assert.equal((await call(path, { ...decision, password: 'invalid credential' }, headers)).status, 401)
  assert.equal(calls.length, 4)
  assert.equal((await call(path, { ...decision, payoutRef: 'discarded' }, headers)).status, 200)
  assert.deepEqual(JSON.parse(calls.at(-1).body), { action: 'approve', note: 'Reviewed evidence' })
  assert.equal(calls.at(-1).path, '/admin/withdrawals/' + record + '/review')
  region = 'IRAN'
  assert.equal((await call(path, decision, headers)).body.error, 'wrong_region')
  assert.equal(calls.at(-1).path, '/runtime/status')
  const payoutRef = '0x' + randomBytes(32).toString('hex')
  const settle = { ...decision, action: 'settle', payoutRef }
  assert.equal((await call(path, settle, headers)).body.error, 'wrong_region')
  region = 'GLOBAL'
  assert.equal((await call(path, { ...settle, payoutRef: 'placeholder' }, headers)).body.error, 'invalid_payout_hash')
  assert.equal((await call(path, settle)).status, 401)
  assert.equal((await call(path, settle, { Cookie: headers.Cookie })).status, 403)
  assert.equal((await call(path, { ...settle, password: 'invalid credential' }, headers)).status, 401)
  assert.equal((await call(path, { ...settle, amount: 5, recipient: 'discarded' }, headers)).status, 200)
  assert.equal(calls.at(-1).path, '/admin/withdrawals/' + record + '/settle-reward')
  assert.deepEqual(JSON.parse(calls.at(-1).body), { action: 'paid', note: decision.reason, payoutRef })
  assert.ok(events.some(e => e.target === record && e.outcome === 'success' && e.correlationId))
  assert.ok(!JSON.stringify(events).includes(password))
  clock += 31 * 60_000
  assert.equal((await call('/api/users', undefined, headers)).status, 401)
  const again = await call('/api/login', { username: settings.owner, password })
  const next = { Cookie: again.cookie.split(';')[0], 'X-CSRF-Token': again.body.csrf }
  assert.equal((await call('/api/logout', {}, next)).status, 200)
  assert.equal((await call('/api/users', undefined, next)).status, 401)
  for (let i = 0; i < 10; i++) assert.equal((await call('/api/login', { username: settings.owner, password: 'wrong' })).status, 401)
  assert.equal((await call('/api/login', { username: settings.owner, password })).status, 429)
})

test('operations sections: reads, table-driven mutations, validation, step-up and region guard', async t => {
  const calls = []
  let region = 'GLOBAL'
  const upstream = createServer(async (req, res) => {
    const parts = []
    for await (const part of req) parts.push(part)
    calls.push({ path: req.url, method: req.method, headers: req.headers, body: Buffer.concat(parts).toString() })
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/runtime/status') res.end(JSON.stringify({ region, mode: 'GLOBAL_CONNECTED' }))
    else res.end(JSON.stringify({ ok: true, entries: [], results: [], expenses: [], reserves: [], obligations: [], notifications: [], commissions: [], coupons: [], redemptions: [], orders: [], audit: [] }))
  })
  const password = randomBytes(24).toString('base64url')
  const origin = 'https://backstage.example.test'
  const settings = { origin, backend: await open(upstream), cms: 'http://127.0.0.1:8055',
    owner: 'owner-fixture', credential: randomBytes(32).toString('hex'), verifier: await createVerifier(password), realSettlement: false }
  const server = createBackstage(settings, { audit: () => {} })
  const local = await open(server)
  t.after(() => { server.close(); upstream.close() })
  const call = (path, body, headers = {}) => new Promise((resolve, reject) => {
    const req = request(local + path, {
      method: body ? 'POST' : 'GET',
      headers: { Host: new URL(origin).host, ...(body && { Origin: origin, 'Content-Type': 'application/json' }), ...headers },
    }, async res => {
      try {
        const parts = []
        for await (const part of res) parts.push(part)
        resolve({ status: res.statusCode, cookie: res.headers['set-cookie']?.[0], body: JSON.parse(Buffer.concat(parts)) })
      } catch (error) { reject(error) }
    })
    req.on('error', reject)
    req.end(body ? JSON.stringify(body) : undefined)
  })
  const login = await call('/api/login', { username: settings.owner, password })
  const headers = { Cookie: login.cookie.split(';')[0], 'X-CSRF-Token': login.body.csrf }

  /* new read sections proxy to their backend endpoints with filters */
  for (const [path, expected] of [
    ['/api/audit?source=financial&action=expense', '/admin/operations/audit'],
    ['/api/risk', '/admin/operations/risk'],
    ['/api/search?q=0xabc', '/admin/operations/search'],
    ['/api/notifications', '/admin/operations/notifications'],
    ['/api/expenses', '/admin/economy/expenses'],
    ['/api/reserves', '/admin/economy/reserves'],
    ['/api/obligations', '/admin/economy/obligations'],
    ['/api/commissions', '/admin/partners/commissions'],
  ]) {
    assert.equal((await call(path, undefined, headers)).status, 200, path)
    assert.equal(new URL(calls.at(-1).path, settings.backend).pathname, expected, path)
  }
  assert.equal((await call('/api/audit')).status, 401, 'reads require a session')

  /* partner decision: password confirm + region guard + payload shape */
  const application = randomUUID()
  const decision = { action: 'approve', reason: 'Verified identity evidence', password, verification: { identityReviewed: true } }
  assert.equal((await call(`/api/partners/${application}`, decision, { Cookie: headers.Cookie })).status, 403, 'CSRF required')
  assert.equal((await call(`/api/partners/${application}`, { ...decision, password: 'wrong credential!' }, headers)).status, 401)
  assert.equal((await call(`/api/partners/${application}`, { ...decision, action: 'delete' }, headers)).status, 400)
  assert.equal((await call(`/api/partners/not-a-uuid`, decision, headers)).status, 400)
  region = 'IRAN'
  assert.equal((await call(`/api/partners/${application}`, decision, headers)).body.error, 'wrong_region')
  region = 'GLOBAL'
  assert.equal((await call(`/api/partners/${application}`, decision, headers)).status, 200)
  assert.equal(calls.at(-1).path, `/admin/partners/applications/${application}/decision`)
  assert.deepEqual(JSON.parse(calls.at(-1).body), { action: 'approve', note: 'Verified identity evidence', verification: { identityReviewed: true } })

  /* user suspension */
  const trader = randomUUID()
  assert.equal((await call(`/api/users/${trader}`, { action: 'suspend', reason: 'tos violation', password }, headers)).status, 200)
  assert.deepEqual(JSON.parse(calls.at(-1).body), { status: 'suspended', reason: 'tos violation' })
  assert.equal(calls.at(-1).path, `/admin/users/${trader}/status`)
  assert.equal((await call(`/api/users/${trader}`, { action: 'suspend', password }, headers)).status, 400, 'reason required')

  /* finance: expense creation + transition, treasury refresh, obligation close */
  const expense = { action: 'create', password, category: 'cms', description: 'Directus hosting',
    amount: '25.00', currency: 'USD', amountUsd: '25.00', incurredOn: '2026-11-01', source: 'invoice', invoiceReference: 'INV-9' }
  assert.equal((await call('/api/expenses/new', expense, headers)).status, 200)
  assert.equal(calls.at(-1).path, '/admin/economy/expenses')
  assert.equal(JSON.parse(calls.at(-1).body).invoiceReference, 'INV-9')
  const expenseId = randomUUID()
  assert.equal((await call(`/api/expenses/${expenseId}`, { action: 'verify', password }, headers)).status, 200)
  assert.equal(calls.at(-1).path, `/admin/economy/expenses/${expenseId}/verify`)
  assert.equal((await call(`/api/expenses/${expenseId}`, { action: 'paid', password }, headers)).status, 400, 'payment reference required')
  assert.equal((await call('/api/finance/treasury', { action: 'refresh', password }, headers)).status, 200)
  assert.equal(calls.at(-1).path, '/admin/economy/treasury/refresh')
  const obligation = randomUUID()
  assert.equal((await call(`/api/obligations/${obligation}`, { action: 'settled', password }, headers)).status, 200)
  assert.deepEqual(JSON.parse(calls.at(-1).body), { status: 'settled' })

  /* coupons: create requires kind/value; status actions map to the backend update */
  assert.equal((await call('/api/coupons/new', { action: 'create', password, code: 'LAUNCH25', kind: 'percent', value: '25' }, headers)).status, 200)
  assert.equal(calls.at(-1).path, '/admin/coupons')
  assert.equal((await call('/api/coupons/new', { action: 'create', password, code: 'X', kind: 'nope', value: '25' }, headers)).status, 400)
  const coupon = randomUUID()
  assert.equal((await call(`/api/coupons/${coupon}`, { action: 'activate', password }, headers)).status, 200)
  assert.deepEqual(JSON.parse(calls.at(-1).body), { status: 'active' })

  /* support thread reply flows to the thread endpoint, not the status update */
  const reference = 'OF-261117-ABCDEF'
  assert.equal((await call(`/api/support/${reference}`, { action: 'reply', reason: 'We are looking into it.', password }, headers)).status, 200)
  assert.equal(calls.at(-1).path, `/admin/support/messages/${reference}/thread`)
  assert.deepEqual(JSON.parse(calls.at(-1).body), { action: 'reply', message: 'We are looking into it.' })

  /* IB settlement: approval needs a policy; payment needs a hash and real settlement */
  const payout = randomUUID()
  assert.equal((await call(`/api/payouts/${payout}`, { action: 'ib_approve', reason: 'due', password }, headers)).status, 400, 'policy version required')
  assert.equal((await call(`/api/payouts/${payout}`, { action: 'ib_approve', reason: 'due', policyVersion: 'ib-2026-01', password }, headers)).status, 200)
  assert.deepEqual(JSON.parse(calls.at(-1).body), { action: 'approve', policyVersion: 'ib-2026-01' })
  assert.equal((await call(`/api/payouts/${payout}`, { action: 'ib_paid', reason: 'transfer done', payoutRef: '0x' + 'a'.repeat(64), password }, headers)).body.error,
    'settlement_disabled', 'IB payment recording follows the real-settlement switch')
})

test('configuration must be explicitly provisioned and production origins must use HTTPS', async () => {
  assert.throws(() => loadConfig({}))
  assert.throws(() => loadConfig({
    NODE_ENV: 'production',
    BACKSTAGE_ORIGIN: 'http://localhost:8400',
    BACKSTAGE_BACKEND_ORIGIN: 'https://backend.example.test',
    BACKSTAGE_DIRECTUS_ORIGIN: 'https://cms.example.test',
    BACKSTAGE_OWNER: 'example-owner',
    BACKSTAGE_PASSWORD_VERIFIER: '00'.repeat(16) + ':' + '00'.repeat(32),
    BACKSTAGE_BACKEND_TOKEN: randomBytes(24).toString('hex'),
  }), /HTTPS/)
})

test('system view shows both regions from public endpoints, never sending a credential to IRAN (ADR 0043)', async t => {
  const iranCalls = []
  const commit = 'a'.repeat(40)
  const global = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/runtime/status' || req.url === '/admin/runtime') return res.end(JSON.stringify({ region: 'GLOBAL', mode: 'GLOBAL_CONNECTED', epoch: 0 }))
    if (req.url === '/ready') return res.end(JSON.stringify({ ok: true, engine: { running: true }, marketData: { freshMarks: 300, execution: 'available_for_fresh_markets' } }))
    if (req.url === '/version') return res.end(JSON.stringify({ version: '0.6.5', commit }))
    res.end('{}')
  })
  const iran = createServer((req, res) => {
    iranCalls.push({ path: req.url, authorization: req.headers.authorization, cookie: req.headers.cookie, actor: req.headers['x-admin-actor'] })
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/runtime/status') return res.end(JSON.stringify({ region: 'IRAN', mode: 'GLOBAL_CONNECTED', epoch: 0, roles: ['http', 'market-data'] }))
    if (req.url === '/ready') return res.writeHead(302, { Location: '/elsewhere' }).end()
    if (req.url === '/version') return res.end(JSON.stringify({ version: '0.6.5', commit }))
    res.end('{}')
  })
  const password = randomBytes(24).toString('base64url')
  const secret = randomBytes(32).toString('hex')
  const origin = 'https://backstage.example.test'
  const server = createBackstage({ origin, backend: await open(global), iranBackend: await open(iran), cms: 'http://127.0.0.1:8055',
    owner: 'owner-fixture', credential: secret, verifier: await createVerifier(password) })
  const local = await open(server)
  t.after(() => { server.close(); global.close(); iran.close() })
  const call = (path, body, headers = {}) => new Promise((resolve, reject) => {
    const req = request(local + path, { method: body ? 'POST' : 'GET',
      headers: { Host: new URL(origin).host, ...(body && { Origin: origin, 'Content-Type': 'application/json' }), ...headers } }, async res => {
      const parts = []; for await (const part of res) parts.push(part)
      resolve({ status: res.statusCode, cookie: res.headers['set-cookie']?.[0], body: JSON.parse(Buffer.concat(parts)) })
    })
    req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined)
  })
  const login = await call('/api/login', { username: 'owner-fixture', password })
  const system = await call('/api/system', undefined, { Cookie: login.cookie.split(';')[0], 'X-CSRF-Token': login.body.csrf })
  assert.equal(system.status, 200)
  const [g, i] = system.body.regions
  assert.deepEqual([g.name, g.region, g.ready, g.engine, g.freshMarks], ['GLOBAL', 'GLOBAL', true, true, 300])
  assert.deepEqual([i.name, i.region, i.reachable, i.ready, i.commit], ['IRAN', 'IRAN', true, false, commit], 'a redirecting probe is not followed')
  assert.deepEqual(iranCalls.map(c => c.path).sort(), ['/ready', '/runtime/status', '/version'])
  assert.ok(iranCalls.every(c => c.authorization === undefined && c.cookie === undefined && c.actor === undefined), 'no credential reaches the other region')
  assert.ok(!JSON.stringify(system.body).includes(secret))
})

test('BACKSTAGE_IRAN_ORIGIN must be https in production', () => {
  const base = { BACKSTAGE_ORIGIN: 'https://b.example', BACKSTAGE_BACKEND_ORIGIN: 'https://o.example', BACKSTAGE_DIRECTUS_ORIGIN: 'https://c.example',
    BACKSTAGE_OWNER: 'owner', BACKSTAGE_BACKEND_TOKEN: 'x'.repeat(32), NODE_ENV: 'production' }
  assert.throws(() => loadConfig({ ...base, BACKSTAGE_IRAN_ORIGIN: 'ftp://openfi.live' }), /BACKSTAGE_IRAN_ORIGIN|incomplete/)
})
