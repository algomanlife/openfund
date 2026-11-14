/* Trusted edge client IP: only a request carrying the exact shared key may
   set req.ip, the headers never reach handlers, and the default (no key) is
   the unchanged `trust proxy` behaviour. Uses a real Express app and the real
   express-rate-limit, without a database. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { edgeClientIpMiddleware, edgeKeyDigest, trustedEdgeClientIp } from '../edge-client-ip.js'

const KEY = 'k'.repeat(16) + 'Z9_-'.repeat(5)

async function serve(env) {
  const app = express()
  app.set('trust proxy', 1)
  app.use(edgeClientIpMiddleware(env))
  app.get('/ip', (req, res) => res.json({ ip: req.ip, key: req.headers['x-openfund-edge-key'] ?? null, edgeIp: req.headers['x-openfund-edge-client-ip'] ?? null }))
  app.get('/limited', rateLimit({ windowMs: 60_000, limit: 2, standardHeaders: 'draft-7', legacyHeaders: false }), (req, res) => res.json({ ok: true }))
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  const base = `http://127.0.0.1:${server.address().port}`
  return { base, close: () => new Promise(r => server.close(r)) }
}
const get = (base, path, headers = {}) => fetch(base + path, { headers })

test('the key must be long and header-safe', () => {
  assert.equal(edgeKeyDigest({}), null)
  assert.throws(() => edgeKeyDigest({ EDGE_CLIENT_IP_KEY: 'short' }))
  assert.throws(() => edgeKeyDigest({ EDGE_CLIENT_IP_KEY: 'x'.repeat(40) + '"; evil' }))
  assert.ok(edgeKeyDigest({ EDGE_CLIENT_IP_KEY: KEY }))
})

test('only a valid IP with the exact key is trusted', () => {
  const d = edgeKeyDigest({ EDGE_CLIENT_IP_KEY: KEY })
  assert.equal(trustedEdgeClientIp({ 'x-openfund-edge-key': KEY, 'x-openfund-edge-client-ip': '5.6.7.8' }, d), '5.6.7.8')
  assert.equal(trustedEdgeClientIp({ 'x-openfund-edge-key': KEY, 'x-openfund-edge-client-ip': '2a01:5ec0::1' }, d), '2a01:5ec0::1')
  assert.equal(trustedEdgeClientIp({ 'x-openfund-edge-key': KEY + 'x', 'x-openfund-edge-client-ip': '5.6.7.8' }, d), null)
  assert.equal(trustedEdgeClientIp({ 'x-openfund-edge-key': KEY, 'x-openfund-edge-client-ip': '5.6.7.8, 1.1.1.1' }, d), null)
  assert.equal(trustedEdgeClientIp({ 'x-openfund-edge-key': KEY, 'x-openfund-edge-client-ip': 'evil' }, d), null)
  assert.equal(trustedEdgeClientIp({ 'x-openfund-edge-client-ip': '5.6.7.8' }, d), null)
  assert.equal(trustedEdgeClientIp({ 'x-openfund-edge-key': KEY, 'x-openfund-edge-client-ip': '5.6.7.8' }, null), null)
})

test('with the key configured, edge requests carry the client IP and the headers are stripped', async () => {
  const s = await serve({ EDGE_CLIENT_IP_KEY: KEY })
  try {
    const edge = await (await get(s.base, '/ip', { 'x-openfund-edge-key': KEY, 'x-openfund-edge-client-ip': '5.6.7.8', 'x-forwarded-for': '9.9.9.9' })).json()
    assert.deepEqual(edge, { ip: '5.6.7.8', key: null, edgeIp: null })
    const forged = await (await get(s.base, '/ip', { 'x-openfund-edge-key': 'wrong'.repeat(8), 'x-openfund-edge-client-ip': '5.6.7.8', 'x-forwarded-for': '9.9.9.9' })).json()
    assert.equal(forged.ip, '9.9.9.9', 'a wrong key falls back to the normal trust-proxy address')
    assert.equal(forged.key, null)
  } finally { await s.close() }
})

test('without the key the edge headers are ignored and removed (default behaviour)', async () => {
  const s = await serve({})
  try {
    const r = await (await get(s.base, '/ip', { 'x-openfund-edge-key': KEY, 'x-openfund-edge-client-ip': '5.6.7.8', 'x-forwarded-for': '9.9.9.9' })).json()
    assert.deepEqual(r, { ip: '9.9.9.9', key: null, edgeIp: null })
  } finally { await s.close() }
})

test('express-rate-limit buckets edge visitors separately', async () => {
  const s = await serve({ EDGE_CLIENT_IP_KEY: KEY })
  try {
    const as = ip => get(s.base, '/limited', { 'x-openfund-edge-key': KEY, 'x-openfund-edge-client-ip': ip })
    assert.equal((await as('5.6.7.8')).status, 200)
    assert.equal((await as('5.6.7.8')).status, 200)
    assert.equal((await as('5.6.7.8')).status, 429)
    assert.equal((await as('5.6.7.9')).status, 200, 'another visitor behind the same edge has its own bucket')
  } finally { await s.close() }
})
