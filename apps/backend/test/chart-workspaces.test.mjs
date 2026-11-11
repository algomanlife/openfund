/**
 * Per-wallet chart workspaces — HTTP surface on real PostgreSQL.
 * The real router is mounted on an ephemeral Express app; only the session
 * lookup is stubbed (x-test-user header → req.user), exactly like the
 * governance HTTP suite. Covers wallet isolation, the A → B → A round trip,
 * optimistic concurrency (stale tabs), validation and payload limits.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import pg from 'pg'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { chartWorkspaceRoutes, MAX_ENTRY_BYTES } from '../chart-workspaces.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
let server, base, walletA, walletB

const requireAuth = async (req, res, next) => {
  const id = req.headers['x-test-user']
  if (!id) return res.status(401).json({ error: 'unauthenticated' })
  req.user = { user_id: id, status: 'active' }; next()
}
const call = async (method, path, { user, body, claimed } = {}) => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}), ...(claimed ? { 'x-openfund-chart-user': claimed } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, data: await r.json().catch(() => null) }
}
const newUser = async () => (await pool.query('INSERT INTO openfund_users (wallet_address) VALUES ($1) RETURNING id', [privateKeyToAccount(generatePrivateKey()).address.toLowerCase()])).rows[0].id
const W = '/chart/workspaces/perpetual'
const drawingsDoc = label => ({ drawings: [{ id: 'd1', type: 'trend-line', paneId: 'price', anchors: [{ time: 1, price: 100 }, { time: 2, price: 110 }], text: { content: label } }] })

before(async () => {
  const app = express()
  app.use('/chart/workspaces', express.json({ limit: '256kb' }))
  app.use(chartWorkspaceRoutes({ pool, requireAuth }))
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.status ? err.message : 'internal' }))
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
  walletA = await newUser(); walletB = await newUser()
})
after(async () => { server?.close(); await pool.query('DELETE FROM chart_workspaces WHERE user_id = ANY($1)', [[walletA, walletB]]); await pool.end() })

test('W1 an anonymous request can neither read nor write a workspace', async () => {
  assert.equal((await call('GET', W)).status, 401)
  assert.equal((await call('PUT', W + '/BTC%2FUSD', { body: { data: {}, baseRevision: 0 } })).status, 401)
})

test('W2 wallet A saves drawings and settings; wallet B sees none of it and keeps its own', async () => {
  const a1 = await call('PUT', W + '/BTC%2FUSD', { user: walletA, body: { data: drawingsDoc('A'), baseRevision: 0 } })
  assert.equal(a1.status, 200); assert.equal(a1.data.revision, 1)
  const a2 = await call('PUT', W + '/*', { user: walletA, body: { data: { timeframe: '15', indicators: [{ id: 'rsi', inputs: { length: 21 } }] }, baseRevision: 0 } })
  assert.equal(a2.status, 200)
  const b0 = await call('GET', W, { user: walletB })
  assert.deepEqual(b0.data.entries, [], 'wallet B must not see wallet A\'s private workspace')
  const b1 = await call('PUT', W + '/BTC%2FUSD', { user: walletB, body: { data: drawingsDoc('B'), baseRevision: 0 } })
  assert.equal(b1.status, 200); assert.equal(b1.data.revision, 1, 'same scope, separate row per wallet')
  const a = await call('GET', W, { user: walletA })
  const byScope = Object.fromEntries(a.data.entries.map(e => [e.scope, e]))
  assert.equal(byScope['BTC/USD'].data.drawings[0].text.content, 'A', 'wallet A gets its original workspace back')
  assert.equal(byScope['*'].data.timeframe, '15')
  assert.equal(byScope['*'].data.indicators[0].inputs.length, 21)
  const b = await call('GET', W, { user: walletB })
  assert.equal(b.data.entries.length, 1); assert.equal(b.data.entries[0].data.drawings[0].text.content, 'B')
})

test('W3 a stale tab cannot overwrite a newer save (optimistic revision)', async () => {
  const scope = W + '/ETH%2FUSD'
  assert.equal((await call('PUT', scope, { user: walletA, body: { data: drawingsDoc('v1'), baseRevision: 0 } })).data.revision, 1)
  const tab1 = await call('PUT', scope, { user: walletA, body: { data: drawingsDoc('tab1'), baseRevision: 1 } })
  assert.equal(tab1.status, 200); assert.equal(tab1.data.revision, 2)
  const tab2 = await call('PUT', scope, { user: walletA, body: { data: drawingsDoc('tab2-stale'), baseRevision: 1 } })
  assert.equal(tab2.status, 409); assert.equal(tab2.data.error, 'stale_revision')
  assert.equal(tab2.data.current.revision, 2); assert.equal(tab2.data.current.data.drawings[0].text.content, 'tab1')
  const dup = await call('PUT', scope, { user: walletA, body: { data: drawingsDoc('again'), baseRevision: 0 } })
  assert.equal(dup.status, 409, 'creating an existing entry is a conflict, not an overwrite')
  /* concurrent writers from the same base: exactly one wins */
  const racers = await Promise.all([0, 1, 2, 3, 4].map(i => call('PUT', scope, { user: walletA, body: { data: drawingsDoc('race' + i), baseRevision: 2 } })))
  assert.equal(racers.filter(r => r.status === 200).length, 1)
  assert.equal(racers.filter(r => r.status === 409).length, 4)
})

test('W4 another wallet cannot update an entry by guessing its revision', async () => {
  const r = await call('PUT', W + '/BTC%2FUSD', { user: walletB, body: { data: drawingsDoc('hijack'), baseRevision: 1 } })
  assert.equal(r.status, 200, 'B updates B\'s own row (revision 1)')
  const a = await call('GET', W, { user: walletA })
  assert.equal(a.data.entries.find(e => e.scope === 'BTC/USD').data.drawings[0].text.content, 'A')
})

test('W5 validation: workspace, scope, data shape, schema version, revision and size', async () => {
  const put = (path, body) => call('PUT', path, { user: walletA, body })
  assert.equal((await call('GET', '/chart/workspaces/Bad%20Name', { user: walletA })).status, 400)
  assert.equal((await put(W + '/' + encodeURIComponent('x'.repeat(65)), { data: {}, baseRevision: 0 })).status, 400)
  assert.equal((await put(W + '/' + encodeURIComponent('<script>'), { data: {}, baseRevision: 0 })).status, 400)
  assert.equal((await put(W + '/SOL%2FUSD', { data: [], baseRevision: 0 })).status, 400)
  assert.equal((await put(W + '/SOL%2FUSD', { data: 'x', baseRevision: 0 })).status, 400)
  assert.equal((await put(W + '/SOL%2FUSD', { data: {}, schemaVersion: 0, baseRevision: 0 })).status, 400)
  assert.equal((await put(W + '/SOL%2FUSD', { data: {}, baseRevision: -1 })).status, 400)
  assert.equal((await put(W + '/SOL%2FUSD', { data: {} })).status, 400, 'a revision is required')
  const big = { blob: 'x'.repeat(MAX_ENTRY_BYTES) }
  const tooBig = await put(W + '/SOL%2FUSD', { data: big, baseRevision: 0 })
  assert.equal(tooBig.status, 413)
  const huge = await put(W + '/SOL%2FUSD', { data: { blob: 'x'.repeat(300 * 1024) }, baseRevision: 0 })
  assert.equal(huge.status, 413, 'the body parser refuses oversized requests')
})

test('W6 a document bound to wallet A can never write into wallet B\'s workspace after a session switch', async () => {
  const put = await call('PUT', W + '/XRP%2FUSD', { user: walletB, claimed: walletA, body: { data: drawingsDoc('A-leak'), baseRevision: 0 } })
  assert.equal(put.status, 409); assert.equal(put.data.error, 'identity_mismatch')
  const get = await call('GET', W, { user: walletB, claimed: walletA })
  assert.equal(get.status, 409)
  const b = await call('GET', W, { user: walletB })
  assert.ok(!JSON.stringify(b.data).includes('A-leak'))
  assert.equal((await call('PUT', W + '/XRP%2FUSD', { user: walletB, claimed: walletB, body: { data: drawingsDoc('B-own'), baseRevision: 0 } })).status, 200)
})
