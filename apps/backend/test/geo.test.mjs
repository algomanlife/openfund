/* ADR 0043: Geo-IP default language, trusted visitor country and canonical
   domain redirects. Pure functions plus a booted Express pipeline; no DB. */
import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'node:http'
import { localeForCountry, defaultLocale, fallbackLocale, ARAB_LEAGUE_COUNTRIES } from '../geo-locale.js'
import { trustedCountry, isCloudflareAddress, trustedCountryMiddleware } from '../geo-trust.js'
import { canonicalConfig, canonicalRedirect, canonicalHostMiddleware, regionChoiceMiddleware } from '../canonical-host.js'
import { canonicalCondition, geoCondition, evaluate, PAGE_EXACT, PAGE_LOCALES } from '../redirect-policy.js'
import { routeInventory, sample } from './fixtures/route-inventory.mjs'
import { readFileSync } from 'node:fs'
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
/* a top-level browser navigation (what a bookmark or a typed URL sends) */
const DOC = { 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', accept: 'text/html,application/xhtml+xml,*/*;q=0.8' }
const nav = (host, url, extra = {}) => canonicalRedirect(ir, { method: 'GET', host, path: url.split('?')[0], url, headers: DOC, ...extra })

test('IRAN aliases → https://openfi.live with path and query preserved', () => {
  assert.equal(nav('iran.openfi.cloud', '/fa/challenges?plan=25k'), 'https://openfi.live/fa/challenges?plan=25k')
  assert.equal(nav('www.openfi.live', '/'), 'https://openfi.live/')
  assert.equal(nav('IRAN.OPENFUND.CLOUD:443', '/en/prop/dashboard?x=1&y=%2F'), 'https://openfi.live/en/prop/dashboard?x=1&y=%2F')
  assert.equal(canonicalRedirect(ir, { method: 'HEAD', host: 'iran.openfi.cloud', path: '/fa/home', url: '/fa/home', headers: DOC }), 'https://openfi.live/fa/home')
  /* browsers without Sec-Fetch headers: an HTML Accept marks the navigation */
  assert.equal(canonicalRedirect(ir, { method: 'GET', host: 'iran.openfi.cloud', path: '/fa/home', url: '/fa/home', headers: { accept: 'text/html' } }), 'https://openfi.live/fa/home')
})

test('the canonical host, other hosts, payloads and non-document requests are never redirected', () => {
  assert.equal(nav('openfi.live', '/fa/home'), null, 'no loop on the canonical host')
  assert.equal(nav('openfund-iran.liara.run', '/fa/home'), null)
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
    assert.equal(canonicalRedirect(ir, { method, host: 'iran.openfi.cloud', path: '/fa/home', url: '/fa/home', headers: DOC }), null, method)
  /* fetch/XHR, event streams, WebSocket upgrades and tools never look like a document navigation */
  for (const headers of [{ 'sec-fetch-dest': 'empty', accept: 'application/json' }, { 'sec-fetch-dest': 'empty', accept: 'text/event-stream' },
    { upgrade: 'websocket', connection: 'Upgrade', 'sec-fetch-dest': 'websocket' }, { accept: '*/*' }, {}, { 'sec-fetch-dest': 'image', accept: 'text/html' }])
    assert.equal(canonicalRedirect(ir, { method: 'GET', host: 'iran.openfi.cloud', path: '/fa/home', url: '/fa/home', headers }), null, JSON.stringify(headers))
})

const ROUTES = routeInventory()

test('route inventory covers the real API, including the authenticated reads', () => {
  assert.ok(ROUTES.length > 250, `found ${ROUTES.length} routes`)
  for (const path of ['/trading/state', '/trading/health', '/portfolio/overview', '/portfolio/trades', '/auth/me', '/auth/nonce', '/sync/v1/events',
    '/sync/v1/hello', '/admin/regional', '/products/x1/overview', '/health', '/ready', '/version', '/runtime/status', '/runtime-config.js'])
    assert.ok(ROUTES.some(r => sample(r.path) === path), `${path} not in the inventory`)
})

test('no backend route is ever redirected, even with document-navigation headers (app and Cloudflare)', () => {
  const pagesServedByBackend = new Set()
  const cloudflareCanonical = canonicalCondition(['openfund.cloud', 'www.openfund.cloud', 'www.openfi.cloud'])
  const geo = geoCondition()
  for (const route of ROUTES) {
    const path = sample(route.path)
    if (PAGE_EXACT.includes(path)) { pagesServedByBackend.add(`${path}${route.ambiguous ? ' (ambiguous)' : ''}`); continue }
    for (const method of ['GET', 'HEAD']) {
      assert.equal(canonicalRedirect(ir, { method, host: 'iran.openfi.cloud', path, url: path, headers: DOC }), null, `app: ${method} ${path} (${route.file})`)
      assert.equal(evaluate(cloudflareCanonical, { method, host: 'openfund.cloud', path, headers: DOC }), false, `cloudflare canonical: ${method} ${path}`)
      assert.equal(evaluate(geo, { method, host: 'openfi.cloud', path, headers: DOC, country: 'IR' }), false, `cloudflare geo: ${method} ${path}`)
    }
  }
  /* the only backend routes on page paths: the legacy /react document redirects,
     and router roots that are really mounted under a prefix (flagged ambiguous) */
  assert.deepEqual([...pagesServedByBackend].sort(), ['/ (ambiguous)', '/react', '/react/'])
})

test('every client page route is redirected for a document navigation', () => {
  const main = readFileSync(new URL('../../web-react/src/main.tsx', import.meta.url), 'utf8')
  const pages = [...main.matchAll(/path: '(\/[^']*)'/g)].map(m => m[1]).filter(p => p !== '*')
  assert.ok(pages.length > 30)
  for (const pattern of pages) for (const locale of PAGE_LOCALES) {
    const path = pattern.replace(':locale', locale).replace(':section', 'markets').replace(/:[\w]+/g, 'x1')
    assert.ok(nav('iran.openfi.cloud', path), `page ${path} is not redirected`)
    assert.ok(evaluate(geoCondition(), { method: 'GET', host: 'openfi.cloud', path, headers: DOC, country: 'IR' }), `geo ${path}`)
  }
})

test('geographic condition: Iran only, sessions and an explicit GLOBAL choice are respected', () => {
  const req = extra => ({ method: 'GET', host: 'openfi.cloud', path: '/fa/home', headers: DOC, country: 'IR', ...extra })
  const g = geoCondition()
  assert.equal(evaluate(g, req()), true)
  for (const c of ['RU', 'CN', 'SA', 'US', 'XX', 'T1', null]) assert.equal(evaluate(g, req({ country: c })), false, String(c))
  assert.equal(evaluate(g, req({ cookie: 'openfund_session=abc' })), false)
  assert.equal(evaluate(g, req({ cookie: 'of-region=global' })), false)
  assert.equal(evaluate(g, req({ query: 'region=global' })), false)
  assert.equal(evaluate(g, req({ method: 'HEAD' })), false)
  assert.equal(evaluate(g, req({ host: 'openfund.cloud' })), false, 'aliases go to openfi.cloud first')
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
    const r = await req('/fa/challenges?plan=25k', { host: 'iran.openfi.cloud', ...DOC })
    assert.equal(r.status, 301)
    assert.equal(r.location, 'https://openfi.live/fa/challenges?plan=25k')
    assert.equal((await req('/products/prop/orders', { host: 'iran.openfi.cloud' }, 'POST')).status, 200)
    assert.equal((await req('/sync/v1/batches', { host: 'iran.openfi.cloud' })).status, 200)
    assert.equal((await req('/fa/home', { host: 'openfi.live', ...DOC })).status, 200)
    /* an authenticated API read on the alias is served there, never bounced */
    assert.equal((await req('/trading/state', { host: 'iran.openfi.cloud', 'sec-fetch-dest': 'empty', accept: 'application/json' })).status, 200)
    assert.equal((await req('/trading/state', { host: 'iran.openfi.cloud', ...DOC })).status, 200, 'not a page path')
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

/* ---- IRAN (Liara): country from an IP database, never from a header ---- */
import { parseIpv4Csv, lookupIpv4 } from '../geo-ipdb.js'
import { countryResolver, forwardedAddress, ingressReport } from '../geo-trust.js'

const FIXTURE_DB = parseIpv4Csv([
  '2.144.0.0,2.147.255.255,IR', '5.8.0.0,5.8.255.255,RU', '1.0.1.0,1.0.3.255,CN', '2.88.0.0,2.91.255.255,SA',
  '5.30.0.0,5.31.255.255,AE', '41.32.0.0,41.47.255.255,EG', '3.0.0.0,3.255.255.255,US', '2001:db8::,2001:db8::ffff,DE', 'garbage',
].join('\n'))

test('IP database: IPv4 ranges by bisection; IPv6 and unlisted are unknown', () => {
  const cases = { '2.144.1.1': 'IR', '5.8.9.9': 'RU', '1.0.2.3': 'CN', '2.90.0.1': 'SA', '5.31.0.0': 'AE', '41.40.0.1': 'EG', '3.4.5.6': 'US', '::ffff:2.145.0.1': 'IR' }
  for (const [ip, country] of Object.entries(cases)) assert.equal(lookupIpv4(FIXTURE_DB, ip), country, ip)
  for (const ip of ['10.0.0.1', '9.9.9.9', '2001:db8::1', 'nonsense', '', null]) assert.equal(lookupIpv4(FIXTURE_DB, ip), null, String(ip))
  assert.equal(FIXTURE_DB.size, 7, 'IPv6 and malformed rows are skipped')
})

test('country source: cloudflare by default; ip-database needs a measured hop and a database', () => {
  assert.equal(countryResolver({}).source, 'cloudflare')
  assert.throws(() => countryResolver({ GEO_COUNTRY_SOURCE: 'header' }), /cloudflare or ip-database/)
  assert.throws(() => countryResolver({ GEO_COUNTRY_SOURCE: 'ip-database', GEOIP_DB_PATH: '/x' }), /GEO_CLIENT_HOP/)
  assert.throws(() => countryResolver({ GEO_COUNTRY_SOURCE: 'ip-database', GEO_CLIENT_HOP: '0', GEOIP_DB_PATH: '/x' }), /GEO_CLIENT_HOP/)
  assert.throws(() => countryResolver({ GEO_COUNTRY_SOURCE: 'ip-database', GEO_CLIENT_HOP: '1' }), /GEOIP_DB_PATH/)
})

test('ip-database mode: the platform-written hop decides; forged headers and CF-IPCountry do not', async () => {
  /* hop 2: the platform appends the visitor, then its own internal proxy */
  const r = countryResolver({ GEO_COUNTRY_SOURCE: 'ip-database', GEO_CLIENT_HOP: '2', GEOIP_DB_PATH: 'fixture' }, { loadDb: async () => FIXTURE_DB })
  await r.ready
  /* visitor 5.8.1.1 (RU) prepended a forged Iranian address and a CF-IPCountry header */
  assert.equal(r.resolve({ 'x-forwarded-for': '2.144.1.1, 5.8.1.1, 10.42.0.7', 'cf-ipcountry': 'IR' }, '10.42.0.7'), 'RU')
  assert.equal(r.resolve({ 'x-forwarded-for': '41.40.0.1, 10.42.0.7' }, '10.42.0.7'), 'EG')
  assert.equal(r.resolve({ 'x-forwarded-for': '10.42.0.7' }, '10.42.0.7'), null, 'too few hops → unknown, never the forged entry')
  assert.equal(defaultLocale(r.resolve({ 'x-forwarded-for': '1.0.2.3, 10.42.0.7' }, ''), 'fa'), 'zh-CN')
  assert.equal(defaultLocale(r.resolve({ 'x-forwarded-for': '3.4.5.6, 10.42.0.7' }, ''), 'fa'), 'en')
  assert.equal(defaultLocale(r.resolve({ 'x-forwarded-for': '2001:db8::1, 10.42.0.7' }, ''), 'fa'), 'fa', 'IPv6 → regional fallback')
  assert.equal(forwardedAddress({ 'x-forwarded-for': 'a, b, c' }, 's', 1), 'c')
  assert.equal(forwardedAddress({}, 's', 1), 's')
  assert.equal(forwardedAddress({}, 's', 2), null)
})

test('ingress report shows the caller its hops without trusting them', () => {
  const report = ingressReport({ headers: { 'x-forwarded-for': '203.0.113.9, 172.70.10.20' }, socket: { remoteAddress: '10.0.0.5' }, trustedCountry: 'IR' }, { source: 'cloudflare' })
  assert.deepEqual(report, { forwardedHops: 2, hopsFromRight: ['172.70.10.20', '203.0.113.9'], lastHopCloudflare: true, countrySource: 'cloudflare', country: 'IR' })
})
