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
