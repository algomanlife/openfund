/* OF-2026-11-08/-19: client IP for rate limits and audit behind Cloudflare.
 * Uses an Express app wired like server.js (trust proxy 1, Cloudflare
 * middleware, then the Iran edge middleware, then a per-ip+route limiter). */
import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'node:http'
import { randomBytes } from 'node:crypto'
import { cloudflareClientIp, cloudflareClientIpMiddleware } from '../geo-trust.js'
import { edgeClientIpMiddleware } from '../edge-client-ip.js'

const CF_EDGE = '173.245.48.10'          /* inside a published Cloudflare range */
const NOT_CF = '198.51.100.7'            /* TEST-NET-2, not Cloudflare */
const EDGE_KEY = 'edge_' + randomBytes(24).toString('hex')   /* disposable, per run */

test('CF-Connecting-IP is trusted only when the connecting hop is a Cloudflare address', () => {
  assert.equal(cloudflareClientIp({ 'x-forwarded-for': `203.0.113.9, ${CF_EDGE}`, 'cf-connecting-ip': '203.0.113.9' }, '10.0.0.2'), '203.0.113.9')
  assert.equal(cloudflareClientIp({ 'x-forwarded-for': `${CF_EDGE}`, 'cf-connecting-ip': '2001:db8::5' }, '10.0.0.2'), '2001:db8::5')
  /* a direct request to the Render host: the header is client-written */
  assert.equal(cloudflareClientIp({ 'x-forwarded-for': NOT_CF, 'cf-connecting-ip': '203.0.113.9' }, '10.0.0.2'), null)
  /* a client-written Cloudflare address further left in X-Forwarded-For does not count */
  assert.equal(cloudflareClientIp({ 'x-forwarded-for': `${CF_EDGE}, ${NOT_CF}`, 'cf-connecting-ip': '203.0.113.9' }, '10.0.0.2'), null)
  /* malformed values never become the client IP */
  assert.equal(cloudflareClientIp({ 'x-forwarded-for': CF_EDGE, 'cf-connecting-ip': '203.0.113.9, 1.1.1.1' }, '10.0.0.2'), null)
  assert.equal(cloudflareClientIp({ 'x-forwarded-for': CF_EDGE, 'cf-connecting-ip': ['203.0.113.9'] }, '10.0.0.2'), null)
  assert.equal(cloudflareClientIp({ 'x-forwarded-for': CF_EDGE }, '10.0.0.2'), null)
})

async function withApp(fn) {
  const app = express()
  app.set('trust proxy', 1)
  app.use(cloudflareClientIpMiddleware())
  app.use(edgeClientIpMiddleware({ EDGE_CLIENT_IP_KEY: EDGE_KEY }))
  const hits = new Map()
  const limit = max => (req, res, next) => {
    const key = `${req.ip}:${req.path}`
    const n = (hits.get(key) || 0) + 1
    hits.set(key, n)
    if (n > max) return res.status(429).json({ error: 'rate_limited' })
    next()
  }
  app.post('/auth/nonce', limit(3), (req, res) => res.json({ ip: req.ip, leaked: req.headers['cf-connecting-ip'] ?? null }))
  const server = http.createServer(app).listen(0, '127.0.0.1')
  await new Promise(r => server.once('listening', r))
  const base = `http://127.0.0.1:${server.address().port}`
  try { await fn((headers = {}) => fetch(base + '/auth/nonce', { method: 'POST', headers }).then(async r => ({ status: r.status, body: await r.json() }))) }
  finally { server.close() }
}

test('visitors behind the same Cloudflare edge get separate rate-limit buckets', async () => {
  await withApp(async post => {
    const via = ip => ({ 'x-forwarded-for': `${ip}, ${CF_EDGE}`, 'cf-connecting-ip': ip })
    for (let i = 0; i < 3; i++) assert.equal((await post(via('203.0.113.1'))).status, 200)
    assert.equal((await post(via('203.0.113.1'))).status, 429, 'the first visitor is limited')
    const other = await post(via('203.0.113.2'))
    assert.equal(other.status, 200, 'a second visitor on the same edge is not limited by the first')
    assert.equal(other.body.ip, '203.0.113.2')
    assert.equal(other.body.leaked, null, 'the header is removed after use')
  })
})

test('a spoofed CF-Connecting-IP on a direct request cannot pick a fresh bucket', async () => {
  await withApp(async post => {
    for (let i = 0; i < 3; i++) {
      const r = await post({ 'x-forwarded-for': NOT_CF, 'cf-connecting-ip': `203.0.113.${50 + i}` })
      assert.equal(r.status, 200)
      assert.equal(r.body.ip, NOT_CF)
    }
    assert.equal((await post({ 'x-forwarded-for': NOT_CF, 'cf-connecting-ip': '203.0.113.99' })).status, 429)
  })
})

test('the Iran edge key still takes precedence over Cloudflare headers', async () => {
  await withApp(async post => {
    const r = await post({ 'x-forwarded-for': `9.9.9.9, ${CF_EDGE}`, 'cf-connecting-ip': '9.9.9.9', 'x-openfund-edge-key': EDGE_KEY, 'x-openfund-edge-client-ip': '192.0.2.44' })
    assert.equal(r.status, 200)
    assert.equal(r.body.ip, '192.0.2.44')
  })
})
