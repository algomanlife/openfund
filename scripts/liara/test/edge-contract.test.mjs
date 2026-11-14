/* Contract tests for the Iran edge proxy (infra/liara-iran).
   A stub upstream stands in for the Render origin; the edge under test must
   already be running with OPENFUND_UPSTREAM_HOST=127.0.0.1:<STUB_PORT>,
   OPENFUND_UPSTREAM_SCHEME=http, EDGE_ALLOW_HTTP_UPSTREAM=1 and
   EDGE_PUBLIC_SCHEME=http (see the Liara workflow's validate job).

   EDGE_URL   edge base URL (default http://127.0.0.1:18080)
   STUB_PORT  port this test binds for the stub upstream (default 18081) */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

const EDGE = (process.env.EDGE_URL || 'http://127.0.0.1:18080').replace(/\/$/, '')
const STUB_PORT = Number(process.env.STUB_PORT || 18081)
const UPSTREAM_HOST = `127.0.0.1:${STUB_PORT}`
const EDGE_ORIGIN = new URL(EDGE).origin

const seen = []
const hits = new Map()
let stub

before(async () => {
  stub = http.createServer((req, res) => {
    seen.push({ method: req.method, url: req.url, headers: req.headers })
    hits.set(req.url, (hits.get(req.url) || 0) + 1)
    const origin = req.headers.origin
    /* Same rule as apps/backend/server.js: a state-changing request must be same-origin. */
    if (origin && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && origin !== `http://${req.headers.host}`) {
      res.writeHead(403, { 'content-type': 'application/json' }); return res.end('{"error":"invalid_origin"}')
    }
    if (req.url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"ok":true}') }
    if (req.url === '/login') {
      res.writeHead(200, { 'set-cookie': 'of_sid=abc; HttpOnly; Path=/; Max-Age=60; SameSite=Lax', 'content-type': 'application/json' })
      return res.end('{"ok":true}')
    }
    if (req.url === '/react/') { res.writeHead(308, { location: '/' }); return res.end() }
    if (req.url === '/absolute-redirect') { res.writeHead(302, { location: `http://${UPSTREAM_HOST}/target` }); return res.end() }
    if (req.url.startsWith('/assets/')) {
      res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=31536000, immutable' })
      return res.end('export const x = 1\n')
    }
    if (req.url === '/trading/stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
      res.write('event: hello\ndata: 1\n\n')
      setTimeout(() => res.end('event: bye\ndata: 2\n\n'), 1500)
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}')
  })
  await new Promise(resolve => stub.listen(STUB_PORT, '127.0.0.1', resolve))
})
after(() => new Promise(resolve => stub.close(resolve)))

const last = () => seen[seen.length - 1]

test('edge liveness is answered locally', async () => {
  const before = seen.length
  const res = await fetch(`${EDGE}/__edge/live`)
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true, edge: 'liara-iran' })
  assert.equal(seen.length, before, 'liveness must not call the upstream')
})

test('edge release identity is served', async () => {
  const res = await fetch(`${EDGE}/__edge/info`)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.edge, 'liara-iran')
  assert.equal(typeof body.commit, 'string')
})

test('readiness proxies the upstream /health', async () => {
  const res = await fetch(`${EDGE}/__edge/ready`)
  assert.equal(res.status, 200)
  assert.equal(last().url, '/health')
})

test('requests reach the upstream with the upstream Host and forwarding headers', async () => {
  const res = await fetch(`${EDGE}/some/page`, { headers: { accept: 'text/html' } })
  assert.equal(res.status, 200)
  const h = last().headers
  assert.equal(h.host, UPSTREAM_HOST)
  assert.equal(h['x-forwarded-host'], new URL(EDGE).host)
  assert.equal(h['x-openfund-edge'], 'liara-iran')
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow')
})

test("the edge's own Origin is translated to the upstream origin", async () => {
  const res = await fetch(`${EDGE}/auth/logout`, { method: 'POST', headers: { origin: EDGE_ORIGIN } })
  assert.equal(res.status, 200)
  assert.equal(last().headers.origin, `http://${UPSTREAM_HOST}`)
})

test('a foreign Origin is passed through unchanged and still rejected upstream', async () => {
  const res = await fetch(`${EDGE}/auth/logout`, { method: 'POST', headers: { origin: 'https://evil.example' } })
  assert.equal(res.status, 403)
  assert.equal(last().headers.origin, 'https://evil.example')
})

test('a request without Origin gains none', async () => {
  await fetch(`${EDGE}/api/plain`)
  assert.equal(last().headers.origin, undefined)
})

test('session cookies stay host-only on the edge domain', async () => {
  const res = await fetch(`${EDGE}/login`)
  const cookie = res.headers.get('set-cookie')
  assert.match(cookie, /^of_sid=abc;/)
  assert.doesNotMatch(cookie, /domain=/i)
})

test('relative and upstream-absolute redirects stay on the edge', async () => {
  const rel = await fetch(`${EDGE}/react/`, { redirect: 'manual' })
  assert.equal(rel.status, 308)
  assert.equal(rel.headers.get('location'), '/')
  const abs = await fetch(`${EDGE}/absolute-redirect`, { redirect: 'manual' })
  assert.equal(abs.headers.get('location'), '/target')
})

test('hashed assets are cached at the edge', async () => {
  const url = `/assets/index-Ab12Cd34.js?t=${Date.now()}`
  const first = await fetch(EDGE + url); await first.text()
  const second = await fetch(EDGE + url); await second.text()
  assert.equal(second.status, 200)
  assert.equal(second.headers.get('x-edge-cache'), 'HIT')
  assert.equal(hits.get(url), 1, 'the upstream must be hit once')
})

test('SSE events are forwarded before the stream ends (no buffering)', async () => {
  const started = Date.now()
  const res = await fetch(`${EDGE}/trading/stream`)
  assert.equal(res.headers.get('content-type'), 'text/event-stream')
  const reader = res.body.getReader()
  const { value } = await reader.read()
  assert.match(Buffer.from(value).toString(), /event: hello/)
  assert.ok(Date.now() - started < 1200, 'first event must arrive before the upstream closes the stream')
  await reader.cancel()
})

for (const path of ['/admin', '/admin/payments', '/internal/reset', '/purchases/depay/callback',
  '/api/payments/depay/callback', '/purchases/depay/configuration', '/api/payments/depay/config', '/api/payments/depay/events']) {
  test(`${path} is never forwarded by the edge`, async () => {
    const before = seen.length
    const res = await fetch(EDGE + path, { method: 'POST', headers: { origin: EDGE_ORIGIN, 'content-type': 'application/json' }, body: '{}' })
    assert.equal(res.status, 404)
    assert.equal(seen.length, before)
  })
}

test('robots.txt disallows the mirror and sitemap.xml is absent', async () => {
  const robots = await fetch(`${EDGE}/robots.txt`)
  assert.equal(await robots.text(), 'User-agent: *\nDisallow: /\n')
  assert.equal((await fetch(`${EDGE}/sitemap.xml`)).status, 404)
})
