/* Same-origin CMS content path with last-known-good snapshots (cms-snapshot.js).
   Real Express app and a real local "CMS" server; a disposable database. */
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import express from 'express'
import pg from 'pg'
import { cmsSnapshotRoutes, canonicalQuery, cmsSnapshotOrigin } from '../cms-snapshot.js'

const url = process.env.DATABASE_URL || ''
const skip = !/test|_ci/.test(url) && 'needs a disposable test DATABASE_URL'
let pool, cms, app, base, state
const listen = srv => new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv.address().port)))

before(async () => {
  if (skip) return
  pool = new pg.Pool({ connectionString: url })
  await pool.query(`DELETE FROM cms_snapshot`)
  state = { up: true, calls: [], home: { headline: 'first' } }
  cms = http.createServer((req, res) => {
    state.calls.push(req.url)
    if (!state.up) { res.writeHead(502); return res.end('bad gateway') }
    if (req.url.startsWith('/items/home_content')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ data: state.home })) }
    if (req.url.startsWith('/items/faqs')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ errors: [{ message: 'forbidden' }] })) }
    if (req.url.startsWith('/assets/')) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(Buffer.from([137, 80, 78, 71])) }
    res.writeHead(404); res.end()
  })
  const cmsPort = await listen(cms)
  app = express().use('/cms', cmsSnapshotRoutes({ pool, origin: `http://127.0.0.1:${cmsPort}`, timeoutMs: 1000 }))
  const srv = http.createServer(app); base = `http://127.0.0.1:${await listen(srv)}`; app.srv = srv
})
after(async () => { if (skip) return; cms.close(); app.srv.close(); await pool.end() })

const get = p => fetch(base + p).then(async r => ({ status: r.status, source: r.headers.get('x-openfund-content'), fetchedAt: r.headers.get('x-openfund-content-fetched-at'), type: r.headers.get('content-type'), body: Buffer.from(await r.arrayBuffer()) }))

test('canonical query: allowlisted Directus parameters only, stable order', () => {
  assert.equal(canonicalQuery('limit=-1&fields=*,translations.*', /^(fields|limit)$/), 'fields=*%2Ctranslations.*&limit=-1')
  assert.equal(canonicalQuery('access_token=x', /^(fields|limit)$/), null)
  assert.equal(cmsSnapshotOrigin({ CMS_SNAPSHOT_ORIGIN: 'https://cms.example/' }), 'https://cms.example')
  assert.throws(() => cmsSnapshotOrigin({ CMS_SNAPSHOT_ORIGIN: 'https://u:p@cms.example' }))
})

test('live content is served and stored; with the CMS down the last-known-good snapshot is served, labelled', { skip }, async () => {
  let r = await get('/cms/items/home_content?fields=*,translations.*')
  assert.equal(r.status, 200); assert.equal(r.source, 'live'); assert.equal(JSON.parse(r.body).data.headline, 'first')
  state.home = { headline: 'second' }
  r = await get('/cms/items/home_content?fields=*,translations.*')
  assert.equal(JSON.parse(r.body).data.headline, 'second')
  state.up = false
  r = await get('/cms/items/home_content?fields=*,translations.*')
  assert.equal(r.status, 200); assert.equal(r.source, 'snapshot'); assert.ok(r.fetchedAt)
  assert.equal(JSON.parse(r.body).data.headline, 'second', 'the newest successful answer, never invented content')
  /* the same request with parameters in another order hits the same snapshot */
  assert.equal((await get('/cms/items/home_content?fields=*%2Ctranslations.*')).source, 'snapshot')
  state.up = true
})

test('nothing to fall back on → explicit 503, never fabricated content', { skip }, async () => {
  state.up = false
  const r = await get('/cms/items/legal_documents?limit=-1')
  assert.equal(r.status, 503); assert.equal(JSON.parse(r.body).error, 'content_unavailable')
  state.up = true
})

test('an error document from the CMS never replaces good content', { skip }, async () => {
  const r = await get('/cms/items/faqs?limit=-1')
  assert.equal(r.status, 503)
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM cms_snapshot WHERE collection='faqs'`)).rows[0].n, 0)
})

test('only allowlisted collections and parameters reach the CMS; assets are snapshotted too', { skip }, async () => {
  const before = state.calls.length
  assert.equal((await get('/cms/items/directus_users')).status, 404)
  assert.equal((await get('/cms/items/home_content?access_token=abc')).status, 400)
  assert.equal((await get('/cms/assets/not-a-uuid')).status, 404)
  assert.equal(state.calls.length, before, 'refused requests never reach the CMS')
  const id = '3f2a1b4c-0000-4000-8000-00000000abcd'
  let r = await get(`/cms/assets/${id}?width=200`)
  assert.equal(r.status, 200); assert.equal(r.type, 'image/png')
  state.up = false
  r = await get(`/cms/assets/${id}?width=200`)
  assert.equal(r.source, 'snapshot'); assert.equal(r.body.length, 4)
  state.up = true
})

test('unchanged content is not rewritten', { skip }, async () => {
  const at = async () => (await pool.query(`SELECT fetched_at FROM cms_snapshot WHERE key LIKE 'items/home_content%'`)).rows[0].fetched_at.getTime()
  const t1 = await at()
  await get('/cms/items/home_content?fields=*,translations.*')
  assert.equal(await at(), t1)
})
