/* ADR 0043: Geo-IP default language, trusted visitor country and canonical
   domain redirects. Pure functions plus a booted Express pipeline; no DB. */
import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'node:http'
import { localeForCountry, defaultLocale, fallbackLocale, ARAB_LEAGUE_COUNTRIES } from '../geo-locale.js'
import { trustedCountry, isCloudflareAddress, trustedCountryMiddleware } from '../geo-trust.js'
import { canonicalConfig, canonicalRedirect, canonicalHostMiddleware, regionChoiceMiddleware } from '../canonical-host.js'
import { runtimeConfigScript } from '../runtime-config.js'
import { sitemapXml } from '../seo.js'

test('country → default locale (owner decision 3)', () => {
  const cases = { IR: 'fa', RU: 'ru', CN: 'zh-CN', SA: 'ar', AE: 'ar', EG: 'ar', MA: 'ar', US: 'en', DE: 'en', GB: 'en',
    TR: 'en', IL: 'en', AF: 'en', TW: 'en', HK: 'en', ir: 'fa', ' ru ': 'ru' }
  for (const [country, locale] of Object.entries(cases)) assert.equal(localeForCountry(country), locale, country)
})

test('the Arabic list is exactly the 22 Arab League members', () => {
  assert.equal(ARAB_LEAGUE_COUNTRIES.length, 22)
  assert.equal(new Set(ARAB_LEAGUE_COUNTRIES).size, 22)
  for (const c of ARAB_LEAGUE_COUNTRIES) assert.equal(localeForCountry(c), 'ar')
})

test('unknown, Tor and non-country codes are unknown, never Iran', () => {
  for (const c of ['XX', 'T1', 'A1', 'A2', 'O1', 'EU', 'AP', '', null, undefined, 'IRN', '12', 'I'])
    assert.equal(localeForCountry(c), null, String(c))
  assert.equal(defaultLocale('XX'), 'en')
  assert.equal(defaultLocale('T1', 'fa'), 'fa', 'a region fallback applies to unknown countries')
  assert.equal(defaultLocale(null), 'en')
})

test('fallback locale: English unless the region configures another supported locale', () => {
  assert.equal(fallbackLocale({}), 'en')
  assert.equal(fallbackLocale({ GEO_FALLBACK_LOCALE: 'fa' }), 'fa')
  assert.throws(() => fallbackLocale({ GEO_FALLBACK_LOCALE: 'de' }), /GEO_FALLBACK_LOCALE/)
})

test('CF-IPCountry is trusted only from a Cloudflare address', () => {
  assert.ok(isCloudflareAddress('104.16.1.1') && isCloudflareAddress('172.70.1.1') && isCloudflareAddress('2606:4700::1') && isCloudflareAddress('::ffff:162.158.1.1'))
  assert.ok(!isCloudflareAddress('8.8.8.8') && !isCloudflareAddress('10.0.0.1') && !isCloudflareAddress('nonsense'))
  /* via Cloudflare: the platform proxy appended the Cloudflare edge as the last hop */
  assert.equal(trustedCountry({ 'cf-ipcountry': 'IR', 'x-forwarded-for': '5.1.2.3, 172.70.10.20' }, '10.0.0.5'), 'IR')
  /* direct to the origin host: the last hop is the client itself */
  assert.equal(trustedCountry({ 'cf-ipcountry': 'IR', 'x-forwarded-for': '203.0.113.9' }, '10.0.0.5'), null)
  /* a client cannot prepend a Cloudflare address: only the last hop counts */
  assert.equal(trustedCountry({ 'cf-ipcountry': 'IR', 'x-forwarded-for': '172.70.10.20, 203.0.113.9' }, '10.0.0.5'), null)
  assert.equal(trustedCountry({ 'cf-ipcountry': 'I<R' , 'x-forwarded-for': '172.70.10.20' }, ''), null)
  assert.equal(trustedCountry({ 'x-forwarded-for': '172.70.10.20' }, ''), null)
})

const ir = canonicalConfig({ PUBLIC_ORIGIN: 'https://openfi.live', CANONICAL_ALIAS_HOSTS: 'www.openfi.live,iran.openfund.cloud,iran.openfi.cloud' })
const nav = (host, url, extra = {}) => canonicalRedirect(ir, { method: 'GET', host, path: url.split('?')[0], url, ...extra })

test('IRAN aliases → https://openfi.live with path and query preserved', () => {
  assert.equal(nav('iran.openfi.cloud', '/fa/challenges?plan=25k'), 'https://openfi.live/fa/challenges?plan=25k')
  assert.equal(nav('www.openfi.live', '/'), 'https://openfi.live/')
  assert.equal(nav('IRAN.OPENFUND.CLOUD:443', '/en/prop/dashboard?x=1&y=%2F'), 'https://openfi.live/en/prop/dashboard?x=1&y=%2F')
  assert.equal(canonicalRedirect(ir, { method: 'HEAD', host: 'iran.openfi.cloud', path: '/fa/home', url: '/fa/home' }), 'https://openfi.live/fa/home')
})

test('the canonical host, other hosts, payloads and machine paths are never redirected', () => {
  assert.equal(nav('openfi.live', '/fa/home'), null, 'no loop on the canonical host')
  assert.equal(nav('openfund-iran.liara.run', '/fa/home'), null)
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
    assert.equal(canonicalRedirect(ir, { method, host: 'iran.openfi.cloud', path: '/products/prop/orders', url: '/products/prop/orders' }), null, method)
  for (const path of ['/sync/v1/batches', '/health', '/ready', '/version', '/runtime/status', '/runtime-config.js', '/.well-known/acme-challenge/x', '/cms/items/pages', '/admin/regional', '/admin',
    '/auth/nonce', '/products/prop/state', '/purchases/depay/configuration', '/api/payments/depay/config', '/invoices/1'])
    assert.equal(nav('iran.openfi.cloud', path), null, path)
  assert.equal(nav('iran.openfi.cloud', '/products/prop/stream', { headers: { accept: 'text/event-stream' } }), null, 'SSE')
  assert.equal(nav('iran.openfi.cloud', '/ws', { headers: { upgrade: 'websocket' } }), null, 'WebSocket')
})

test('canonical configuration is validated', () => {
  assert.equal(canonicalConfig({}), null)
  assert.throws(() => canonicalConfig({ CANONICAL_ALIAS_HOSTS: 'a.example' }), /needs PUBLIC_ORIGIN/)
  assert.throws(() => canonicalConfig({ PUBLIC_ORIGIN: 'http://openfi.live' }), /bare https origin/)
  assert.throws(() => canonicalConfig({ PUBLIC_ORIGIN: 'https://openfi.live/x' }), /bare https origin/)
  assert.throws(() => canonicalConfig({ PUBLIC_ORIGIN: 'https://openfi.live', CANONICAL_ALIAS_HOSTS: 'openfi.live' }), /must not contain/)
})

test('booted pipeline: 301 for alias navigation, POST and sync served, runtime config per visitor', async () => {
  const app = express()
  app.set('trust proxy', 1)
  app.use(canonicalHostMiddleware({ PUBLIC_ORIGIN: 'https://openfi.live', CANONICAL_ALIAS_HOSTS: 'iran.openfi.cloud' }))
  app.use(trustedCountryMiddleware())
  app.use(regionChoiceMiddleware())
  app.get('/runtime-config.js', (req, res) => res.type('js').send(runtimeConfigScript({}, false, { geoLocale: defaultLocale(req.trustedCountry) })))
  app.all('*splat', (req, res) => res.json({ method: req.method, country: req.headers['cf-ipcountry'] ?? null }))
  const server = app.listen(0); const port = server.address().port
  /* node:http, because fetch() does not let a test set the Host header */
  const req = (path, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path, method, headers }, res => {
      let body = ''; res.on('data', d => { body += d }); res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location, cookies: res.headers['set-cookie'] ?? [], body }))
    })
    r.on('error', reject); r.end()
  })
  try {
    const r = await req('/fa/challenges?plan=25k', { host: 'iran.openfi.cloud' })
    assert.equal(r.status, 301)
    assert.equal(r.location, 'https://openfi.live/fa/challenges?plan=25k')
    assert.equal((await req('/products/prop/orders', { host: 'iran.openfi.cloud' }, 'POST')).status, 200)
    assert.equal((await req('/sync/v1/batches', { host: 'iran.openfi.cloud' })).status, 200)
    assert.equal((await req('/fa/home', { host: 'openfi.live' })).status, 200)
    /* the raw country header never reaches a route */
    assert.equal(JSON.parse((await req('/x', { 'cf-ipcountry': 'IR' })).body).country, null)
    /* forged CF-IPCountry from a non-Cloudflare peer → unknown → English */
    assert.match((await req('/runtime-config.js', { 'cf-ipcountry': 'IR', 'x-forwarded-for': '203.0.113.9' })).body, /"geoLocale":"en"/)
    /* through Cloudflare (last hop is a Cloudflare edge) → Persian */
    assert.match((await req('/runtime-config.js', { 'cf-ipcountry': 'IR', 'x-forwarded-for': '172.70.10.20' })).body, /"geoLocale":"fa"/)
    assert.match((await req('/runtime-config.js', { 'cf-ipcountry': 'RU', 'x-forwarded-for': '104.16.0.9' })).body, /"geoLocale":"ru"/)
    /* an explicit region choice is remembered; anything else sets nothing */
    assert.match((await req('/fa/home?region=global')).cookies.join(';'), /of-region=global; Path=\/; Max-Age=2592000; SameSite=Lax; Secure/)
    assert.equal((await req('/fa/home?region=mars')).cookies.length, 0)
  } finally { server.close() }
})

test('sitemap x-default is English (the language fallback)', () => {
  const xml = sitemapXml('https://openfi.cloud')
  assert.ok(xml.includes('hreflang="x-default" href="https://openfi.cloud/en/home"'))
  assert.ok(xml.includes('hreflang="x-default" href="https://openfi.cloud/en/whitepaper"'))
  assert.ok(!xml.includes('hreflang="x-default" href="https://openfi.cloud/fa/'))
})
