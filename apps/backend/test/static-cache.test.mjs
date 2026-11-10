/* Regression: production UI rendered unstyled after a deploy because a
   transient 404 for the new hashed stylesheet was cached for 4 hours by
   Cloudflare (no origin Cache-Control → Browser Cache TTL applied), and
   unhashed legacy files could be served stale against a new bundle.
   These tests pin the cache policy that prevents both. No database needed. */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import { staticCacheControl, isHashedAsset, IMMUTABLE, REVALIDATE, NO_STORE } from '../static-cache.js'

test('Vite content-hashed build output is immutable', () => {
  for (const f of ['/srv/react/assets/index-Bv-owoPj.css', '/srv/react/assets/index-NETZtOrP.js', 'assets/Arc-VDBY7LNS-BChRXCXW.js']) {
    assert.equal(isHashedAsset(f), true, f)
    assert.equal(staticCacheControl(f), IMMUTABLE, f)
  }
})

test('unhashed files always revalidate so they cannot drift from the bundle', () => {
  for (const f of ['/srv/react/legacy/terminal.css', '/srv/react/legacy/terminal.js', '/srv/react/translations.json',
    '/srv/react/assets/vela-workspace.global.min.js', '/srv/react/assets/irancell-400.ttf', '/srv/react/assets/mark-mint.svg',
    '/srv/react/assets/instagram-logo-white.svg', '/srv/react/runtime-config.js']) {
    assert.equal(isHashedAsset(f), false, f)
    assert.equal(staticCacheControl(f), REVALIDATE, f)
  }
})

test('HTML documents and the release manifest revalidate', () => {
  assert.equal(staticCacheControl('/srv/react/index.html'), 'no-cache, must-revalidate')
  assert.equal(staticCacheControl('/srv/react/release-manifest.json'), 'no-cache, must-revalidate')
})

test('express.static honours the policy and misses are never cacheable', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'of-static-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  fs.mkdirSync(path.join(dir, 'assets')); fs.mkdirSync(path.join(dir, 'legacy'))
  fs.writeFileSync(path.join(dir, 'assets', 'index-Abc123_-.css'), 'body{}')
  fs.writeFileSync(path.join(dir, 'legacy', 'terminal.css'), 'body{}')
  const app = express()
  app.use(express.static(dir, { setHeaders: (res, file) => res.set('Cache-Control', staticCacheControl(file)) }))
  app.use((req, res) => res.set('Cache-Control', NO_STORE).status(404).json({ error: 'not_found' }))
  const server = app.listen(0)
  t.after(() => server.close())
  const base = `http://127.0.0.1:${server.address().port}`
  const get = async p => { const r = await fetch(base + p); await r.arrayBuffer(); return r }

  const hashed = await get('/assets/index-Abc123_-.css')
  assert.equal(hashed.status, 200)
  assert.equal(hashed.headers.get('cache-control'), IMMUTABLE)

  const legacy = await get('/legacy/terminal.css')
  assert.equal(legacy.status, 200)
  assert.equal(legacy.headers.get('cache-control'), REVALIDATE)
  assert.ok(legacy.headers.get('etag'), 'revalidation relies on ETag')

  const miss = await get('/assets/index-NotThere.css')
  assert.equal(miss.status, 404)
  assert.equal(miss.headers.get('cache-control'), NO_STORE)
})
