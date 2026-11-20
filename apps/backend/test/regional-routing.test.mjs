/* ADR 0043 workstream B: regional routing regression matrix.

   Every public website host of both regions, evaluated with the configuration
   that is actually deployed (render.yaml for GLOBAL, the Liara manifest for
   IRAN) and the exact Cloudflare rule trees. Covers canonical redirects
   (path and query kept), machine paths that must never be redirected as
   pages, the region-choice cookie, redirect-loop impossibility and the rule
   that only a trusted IR country (never a language signal) qualifies for the
   geographic redirect. Pure functions plus booted Express pipelines; no DB,
   no network. The geographic rule is evaluated here as if enabled; in
   production it stays disabled until the ADR 0043 gates pass. */
import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { canonicalConfig, canonicalRedirect, canonicalHostMiddleware, regionChoiceMiddleware, REGION_COOKIE } from '../canonical-host.js'
import { canonicalCondition, geoCondition, evaluate, toCloudflare } from '../redirect-policy.js'
import { trustedCountryMiddleware, countryResolver } from '../geo-trust.js'
import { parseIpCsv } from '../geo-ipdb.js'
import { defaultLocale, fallbackLocale } from '../geo-locale.js'
import { DEPAY_PATHS } from '../purchases.js'
import { canonicalRule, geoRule, DNS, CANONICAL } from '../../../infra/cloudflare/policy.mjs'

/* ---------- the deployed configuration, read from the repository ---------- */
const root = new URL('../../../', import.meta.url)
const renderYaml = readFileSync(new URL('render.yaml', root), 'utf8')
const renderValue = key => renderYaml.match(new RegExp(`- key: ${key}\\n\\s+value: "([^"]*)"`))?.[1]
const stack = JSON.parse(readFileSync(new URL('infra/liara-iran-runtime/stack.json', root), 'utf8'))
const iranWeb = stack.environments.production.apps.find(a => a.role === 'web')

const GLOBAL_ENV = { PUBLIC_ORIGIN: renderValue('PUBLIC_ORIGIN'), CANONICAL_ALIAS_HOSTS: renderValue('CANONICAL_ALIAS_HOSTS') }
const IRAN_ENV = { PUBLIC_ORIGIN: iranWeb.env.PUBLIC_ORIGIN, CANONICAL_ALIAS_HOSTS: iranWeb.env.CANONICAL_ALIAS_HOSTS, GEO_FALLBACK_LOCALE: iranWeb.env.GEO_FALLBACK_LOCALE }
const GLOBAL = canonicalConfig(GLOBAL_ENV)
const IRAN = canonicalConfig(IRAN_ENV)

/* Cloudflare's rule per proxied zone (policy.mjs), as the tree it was serialized from */
const CF_CANONICAL = { 'openfi.cloud': canonicalCondition(['www.openfi.cloud']), 'openfund.cloud': canonicalCondition(['openfund.cloud', 'www.openfund.cloud']) }
const zoneOf = host => (host === 'openfi.cloud' || host.endsWith('.openfi.cloud') ? 'openfi.cloud' : host === 'openfund.cloud' || host.endsWith('.openfund.cloud') ? 'openfund.cloud' : null)

/* Every public website host: who serves it, whether Cloudflare sees it, where it ends */
const HOSTS = {
  'openfi.cloud': { region: 'GLOBAL', cloudflare: true, canonical: 'https://openfi.cloud' },
  'www.openfi.cloud': { region: 'GLOBAL', cloudflare: true, canonical: 'https://openfi.cloud' },
  'openfund.cloud': { region: 'GLOBAL', cloudflare: true, canonical: 'https://openfi.cloud' },
  'www.openfund.cloud': { region: 'GLOBAL', cloudflare: true, canonical: 'https://openfi.cloud' },
  'openfi.live': { region: 'IRAN', cloudflare: false, canonical: 'https://openfi.live' },
  /* Liara's own domain redirect answers it first; the app repeats it */
  'www.openfi.live': { region: 'IRAN', cloudflare: false, canonical: 'https://openfi.live' },
  'iran.openfi.cloud': { region: 'IRAN', cloudflare: false, canonical: 'https://openfi.live' },
  'iran.openfund.cloud': { region: 'IRAN', cloudflare: false, canonical: 'https://openfi.live' },
}
const originOf = region => (region === 'GLOBAL' ? GLOBAL : IRAN)

/* a top-level browser navigation (bookmark, typed URL, link) */
const DOC = { 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'none', accept: 'text/html,application/xhtml+xml,*/*;q=0.8' }
const FETCH = { 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', accept: 'application/json' }
const SSE = { 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', accept: 'text/event-stream' }
const WS = { 'sec-fetch-dest': 'websocket', 'sec-fetch-mode': 'websocket', upgrade: 'websocket', connection: 'Upgrade', 'sec-websocket-version': '13', 'sec-websocket-key': Buffer.from('the sample nonce').toString('base64') /* RFC 6455 §1.3 example */ }
const SERVER = { accept: '*/*', 'user-agent': 'probe' } /* health checks, sync peers, payment providers */

/**
 * One request through the whole path a visitor's browser meets:
 * Cloudflare (proxied hosts only; geo rule optional), then the origin.
 * Returns { status, location } or { status: 200 } when served where it arrived.
 */
function hop({ method = 'GET', host, url, headers = DOC, country = null, cookie = '', geoEnabled = false }) {
  const [path, query = ''] = url.split('?')
  const meta = HOSTS[host]
  if (meta?.cloudflare) {
    const zone = zoneOf(host)
    const req = { method, host, path, query, headers: { ...headers, cookie }, cookie, country }
    if (zone && evaluate(CF_CANONICAL[zone], req)) return { status: 301, location: CANONICAL.GLOBAL + url, by: 'cloudflare' }
    if (geoEnabled && evaluate(geoCondition(), req)) return { status: 302, location: CANONICAL.IRAN + url, by: 'cloudflare-geo' }
  }
  const target = canonicalRedirect(originOf(meta?.region), { method, host, path, url, headers })
  return target ? { status: 301, location: target, by: 'origin' } : { status: 200 }
}
/** follows redirects like a browser; throws on a loop or more than `max` hops */
function follow(start, { max = 4, ...opts } = {}) {
  const seen = [], chain = []
  let { host, url } = start
  for (let i = 0; i <= max; i++) {
    const key = `${host}${url}`
    if (seen.includes(key)) throw Error(`redirect loop: ${[...seen, key].join(' → ')}`)
    seen.push(key)
    const r = hop({ ...opts, host, url })
    if (r.status === 200) return { host, url, chain }
    chain.push(r)
    const next = new URL(r.location)
    host = next.hostname; url = next.pathname + next.search
  }
  throw Error(`more than ${max} redirects from ${start.host}${start.url}`)
}

/* ---------- configuration sanity ---------- */

test('deployed configuration: one canonical origin per region, aliases never include either canonical host', () => {
  assert.equal(GLOBAL.origin, 'https://openfi.cloud')
  assert.equal(IRAN.origin, 'https://openfi.live')
  assert.deepEqual([...GLOBAL.aliases].sort(), ['openfund.cloud', 'www.openfi.cloud', 'www.openfund.cloud'])
  assert.deepEqual([...IRAN.aliases].sort(), ['iran.openfi.cloud', 'iran.openfund.cloud', 'www.openfi.live'])
  for (const cfg of [GLOBAL, IRAN]) for (const canonical of ['openfi.cloud', 'openfi.live']) assert.ok(!cfg.aliases.has(canonical), `${canonical} is an alias`)
  /* Cloudflare rule sources never contain a canonical host */
  for (const zone of ['openfi.cloud', 'openfund.cloud']) {
    const r = canonicalRule(zone)
    assert.ok(!r.expression.includes('"openfi.cloud"') && !r.expression.includes('"openfi.live"'), zone)
  }
  /* IRAN aliases are DNS-only: Cloudflare cannot see them, so only the Liara app redirects them */
  for (const h of ['iran.openfi.cloud', 'iran.openfund.cloud']) assert.equal(DNS[h].proxied, false, h)
  for (const h of ['openfi.cloud', 'www.openfi.cloud', 'openfund.cloud', 'www.openfund.cloud']) assert.equal(DNS[h].proxied, true, h)
})

/* ---------- canonical redirects on every host ---------- */

const PAGE_URLS = ['/', '/fa/challenges?plan=25k&ref=a%2Fb', '/en/home?utm_source=x&utm_medium=y', '/ar/whitepaper', '/zh-CN/markets?symbol=BTC%2FUSD', '/terminal?product=prop', '/ru']

test('every host: page navigation ends on its region canonical origin, path and query preserved, one hop', () => {
  for (const [host, meta] of Object.entries(HOSTS)) for (const url of PAGE_URLS) {
    const end = follow({ host, url })
    assert.equal(`https://${end.host}`, meta.canonical, `${host}${url} ended on ${end.host}`)
    assert.equal(end.url, url, `${host}${url}: path and query preserved`)
    const isCanonical = `https://${host}` === meta.canonical
    assert.equal(end.chain.length, isCanonical ? 0 : 1, `${host}${url}: ${JSON.stringify(end.chain)}`)
    if (!isCanonical) assert.equal(end.chain[0].status, 301, 'canonical redirects are permanent')
  }
})

test('GLOBAL aliases: Cloudflare redirects them first and the origin repeats it for a direct request', () => {
  for (const host of ['openfund.cloud', 'www.openfund.cloud', 'www.openfi.cloud']) {
    assert.equal(hop({ host, url: '/fa/home?x=1' }).by, 'cloudflare', host)
    assert.equal(canonicalRedirect(GLOBAL, { method: 'GET', host, path: '/fa/home', url: '/fa/home?x=1', headers: DOC }), 'https://openfi.cloud/fa/home?x=1', `${host} bypassing Cloudflare`)
  }
  /* the Cloudflare rule keeps the query string (preserve_query_string) and builds the path with concat */
  for (const zone of ['openfi.cloud', 'openfund.cloud']) assert.equal(canonicalRule(zone).action_parameters.from_value.preserve_query_string, true)
})

test('a host reaching the other region is served there, never redirected across regions by the origin', () => {
  /* e.g. a stale DNS answer: IRAN aliases arriving at Render, GLOBAL aliases at Liara */
  for (const host of ['iran.openfi.cloud', 'iran.openfund.cloud', 'www.openfi.live', 'openfi.live'])
    assert.equal(canonicalRedirect(GLOBAL, { method: 'GET', host, path: '/fa/home', url: '/fa/home', headers: DOC }), null, `GLOBAL origin, ${host}`)
  for (const host of ['openfund.cloud', 'www.openfund.cloud', 'www.openfi.cloud', 'openfi.cloud'])
    assert.equal(canonicalRedirect(IRAN, { method: 'GET', host, path: '/fa/home', url: '/fa/home', headers: DOC }), null, `IRAN origin, ${host}`)
})

/* ---------- machine paths are never redirected as pages ---------- */

const MACHINE = [
  /* API reads and writes */
  ['GET', '/trading/state', FETCH], ['GET', '/portfolio/overview', FETCH], ['GET', '/accounts', FETCH], ['GET', '/accounts', DOC],
  ['POST', '/products/prop/orders', FETCH], ['POST', '/purchases/orders', FETCH], ['DELETE', '/trading/orders/1', FETCH],
  ['GET', '/trading/state', DOC], /* a typed API URL is not a page */
  /* auth: SIWE nonce, verification and session reads */
  ['GET', '/auth/nonce', FETCH], ['POST', '/auth/verify', FETCH], ['GET', '/auth/me', FETCH], ['POST', '/auth/logout', FETCH], ['GET', '/auth/nonce', DOC],
  /* payment provider callbacks and events (server-to-server; a provider may follow a browser-like Accept) */
  ...DEPAY_PATHS.callback.flatMap(p => [['POST', p, SERVER], ['GET', p, DOC]]),
  ...DEPAY_PATHS.events.map(p => ['POST', p, SERVER]),
  /* signed regional sync */
  ['POST', '/sync/v1/batches', SERVER], ['GET', '/sync/v1/hello', SERVER], ['GET', '/sync/v1/events', SERVER], ['GET', '/sync/v1/hello', DOC],
  /* event streams and WebSocket upgrades */
  ['GET', '/trading/stream', SSE], ['GET', '/api/footprint/stream', SSE], ['GET', '/trading/stream', WS], ['GET', '/fa/home', WS], ['GET', '/', SSE],
  /* health, readiness, identity and runtime probes */
  ['GET', '/health', SERVER], ['HEAD', '/health', SERVER], ['GET', '/ready', SERVER], ['GET', '/version', SERVER], ['GET', '/version', DOC],
  ['GET', '/runtime/status', SERVER], ['GET', '/runtime/ingress', DOC], ['GET', '/runtime-config.js', { accept: '*/*', 'sec-fetch-dest': 'script' }],
  ['GET', '/robots.txt', DOC], ['GET', '/sitemap.xml', DOC],
  /* static assets, including those requested by a page on an alias */
  ['GET', '/assets/index-abc123.js', { accept: '*/*', 'sec-fetch-dest': 'script' }], ['GET', '/assets/index-abc123.css', { accept: 'text/css,*/*;q=0.1', 'sec-fetch-dest': 'style' }],
  ['GET', '/favicon.ico', { accept: 'image/avif,image/webp,*/*', 'sec-fetch-dest': 'image' }], ['GET', '/brand/logo.svg', DOC],
  ['GET', '/fonts/dastkhat.woff2', { accept: '*/*', 'sec-fetch-dest': 'font' }], ['GET', '/react/assets/index.js', DOC], ['GET', '/cms/items/home_content', FETCH],
  /* a page path is still not a navigation when it is not a top-level document */
  ['GET', '/fa/home', { 'sec-fetch-dest': 'iframe', accept: 'text/html' }], ['GET', '/fa/home', { accept: '*/*' }], ['POST', '/fa/home', DOC], ['OPTIONS', '/fa/home', DOC],
]

test('every host: API, auth, payment callbacks, signed sync, streams, WebSocket, probes and assets are served where they arrive', () => {
  for (const host of Object.keys(HOSTS)) for (const [method, url, headers] of MACHINE) {
    /* the geographic rule is evaluated as enabled, with a trusted IR country */
    const r = hop({ method, host, url, headers, country: 'IR', geoEnabled: true })
    assert.equal(r.status, 200, `${method} ${host}${url} ${JSON.stringify(headers)} → ${r.status} ${r.location ?? ''}`)
  }
})

/* ---------- redirect loops are impossible ---------- */

test('no redirect loop on any host, with or without the geographic rule, for any visitor', () => {
  const countries = ['IR', 'RU', 'US', null, 'XX', 'T1']
  const cookies = ['', 'of-region=global', 'of-region=iran', 'openfund_session=abc', 'of-language-choice=fa']
  for (const host of Object.keys(HOSTS)) for (const url of [...PAGE_URLS, '/fa/home?region=global', '/fa/home?region=iran'])
    for (const country of countries) for (const cookie of cookies) for (const geoEnabled of [false, true]) {
      const end = follow({ host, url }, { country, cookie, geoEnabled })
      assert.ok(end.chain.length <= 2, `${host}${url}: ${end.chain.length} hops`)
      /* every chain ends on a canonical host, which never redirects again */
      assert.ok(['openfi.cloud', 'openfi.live'].includes(end.host), `${host}${url} ended on ${end.host}`)
    }
})

test('the destination of every redirect is never itself a redirect source of the same kind', () => {
  /* canonical: targets are canonical hosts, which are not aliases anywhere (checked above);
     geo: the target openfi.live is DNS-only on Liara, so Cloudflare (the only geo rule) never sees it */
  assert.equal(new URL(geoRule().action_parameters.from_value.target_url.expression.match(/"([^"]+)"/)[1]).hostname, 'openfi.live')
  assert.ok(!Object.keys(DNS).includes('openfi.live'), 'openfi.live is not on a Cloudflare zone')
  assert.equal(evaluate(geoCondition(), { method: 'GET', host: 'openfi.live', path: '/fa/home', headers: DOC, country: 'IR' }), false)
  /* there is no reverse (IRAN → GLOBAL) geographic rule anywhere */
  assert.ok(!/openfi\.cloud/.test(geoRule().action_parameters.from_value.target_url.expression))
})

/* ---------- the region-choice cookie ---------- */

const geoReq = extra => ({ method: 'GET', host: 'openfi.cloud', path: '/fa/home', query: '', headers: DOC, country: 'IR', cookie: '', ...extra })

test('region choice is honoured by the geographic rule, wherever the cookie sits among others', () => {
  const g = geoCondition()
  assert.equal(evaluate(g, geoReq()), true, 'baseline: a trusted IR navigation qualifies')
  for (const cookie of ['of-region=global', 'a=1; of-region=global', 'of-region=global; b=2', 'x=y; of-region=global; openfund_theme=dark'])
    assert.equal(evaluate(g, geoReq({ cookie })), false, cookie)
  assert.equal(evaluate(g, geoReq({ query: 'region=global' })), false, 'the choice link itself is never bounced')
  assert.equal(evaluate(g, geoReq({ query: 'plan=25k&region=global' })), false)
  /* the serialized Cloudflare expression tests the same cookie and query */
  const expr = toCloudflare(g)
  assert.ok(expr.includes('not http.cookie contains "of-region=global"') && expr.includes('not http.request.uri.query contains "region=global"'))
})

test('region choice is reversible: choosing IRAN replaces GLOBAL with the same cookie name and path', async () => {
  const app = express()
  app.use(regionChoiceMiddleware({ secure: true }))
  app.all('*splat', (req, res) => res.end('ok'))
  const server = app.listen(0); const port = server.address().port
  const get = (path, method = 'GET') => new Promise((resolve, reject) => {
    http.request({ host: '127.0.0.1', port, path, method }, res => { res.resume(); res.on('end', () => resolve(res.headers['set-cookie'] ?? [])) }).on('error', reject).end()
  })
  try {
    const [global] = await get('/fa/home?region=global')
    const [iran] = await get('/fa/home?region=IRAN')
    const parse = c => Object.fromEntries(c.split('; ').map(p => p.split('=')).map(([k, v]) => [k.toLowerCase(), v ?? true]))
    assert.equal(parse(global)[REGION_COOKIE], 'global')
    assert.equal(parse(iran)[REGION_COOKIE], 'iran', 'case-insensitive choice')
    /* same name + same Path (no Domain) → the browser replaces it */
    for (const attr of ['path', 'max-age', 'samesite', 'secure']) assert.equal(parse(global)[attr], parse(iran)[attr], attr)
    assert.ok(!/domain=/i.test(global) && !/httponly/i.test(global), 'host-only and readable, so a page can show and change the choice')
    /* after the reversal the rule applies again: it is a choice, not a lock */
    assert.equal(evaluate(geoCondition(), geoReq({ cookie: 'of-region=iran' })), true)
    /* only an explicit GET/HEAD choice writes it; anything else is ignored */
    for (const [path, method] of [['/fa/home?region=mars', 'GET'], ['/fa/home', 'GET'], ['/fa/home?region=global', 'POST'], ['/fa/home?region=', 'GET']])
      assert.deepEqual(await get(path, method), [], `${method} ${path}`)
  } finally { server.close() }
})

/* ---------- only a trusted IR country qualifies ---------- */

const LANGUAGE_SIGNALS = [
  { cookie: 'of-language-choice=fa' }, { cookie: 'of-language=fa' }, { headers: { ...DOC, 'accept-language': 'fa-IR,fa;q=0.9' } },
  { path: '/fa/home' }, { query: 'lang=fa' }, { headers: { ...DOC, 'cf-ipcountry': 'IR' } },
]

test('geographic rule: a language choice, a Persian URL or a forged header never qualifies without a trusted IR country', () => {
  const g = geoCondition()
  for (const country of [null, undefined, 'US', 'RU', 'AF', 'TJ', 'XX', 'T1', 'ir'])
    for (const signal of LANGUAGE_SIGNALS) {
      const req = geoReq({ country, ...signal, headers: { ...(signal.headers ?? DOC) } })
      assert.equal(evaluate(g, req), false, `${country} ${JSON.stringify(signal)}`)
    }
  /* the edge's country is the connection's (ip.src.country), never a request header or a cookie */
  const expr = toCloudflare(g)
  assert.match(expr, /ip\.src\.country eq "IR"/)
  for (const forbidden of ['accept-language', 'cf-ipcountry', 'of-language', 'lang='])
    assert.ok(!expr.toLowerCase().includes(forbidden), `the geo rule must not read ${forbidden}`)
  /* and the rule is created disabled */
  assert.equal(geoRule().enabled, false)
})

test('origin: a language choice never becomes a trusted country (both country sources)', async () => {
  const db = parseIpCsv('2.144.0.0,2.147.255.255,IR\n5.8.0.0,5.8.255.255,RU\n')
  const ipdb = countryResolver({ GEO_COUNTRY_SOURCE: 'ip-database', GEO_CLIENT_HOP: '1', GEOIP_DB_PATH: 'fixture' }, { loadDb: async () => db })
  await ipdb.ready
  for (const resolver of [countryResolver({}), ipdb]) {
    const req = { headers: { cookie: 'of-language-choice=fa; of-language=fa', 'accept-language': 'fa-IR', 'cf-ipcountry': 'IR', 'x-forwarded-for': '5.8.1.1' }, socket: { remoteAddress: '10.0.0.1' } }
    let seen
    trustedCountryMiddleware(resolver)(req, {}, () => { seen = req.trustedCountry })
    assert.equal(seen, resolver.source === 'cloudflare' ? null : 'RU', resolver.source)
    assert.equal(req.headers['cf-ipcountry'], undefined, 'the raw header is removed before routing')
  }
})

/* ---------- booted pipelines, one per region ---------- */

test('booted GLOBAL and IRAN pipelines: every host, pages 301, machine paths served', async () => {
  const boot = env => {
    const app = express()
    app.set('trust proxy', 1)
    app.use(canonicalHostMiddleware(env))
    app.use(trustedCountryMiddleware())
    app.use(regionChoiceMiddleware())
    app.all('*splat', (req, res) => res.json({ ok: true }))
    const server = http.createServer(app)
    /* a real WebSocket upgrade is answered by the upgrade handler, never by the redirect middleware */
    server.on('upgrade', (req, socket) => { socket.end('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n') })
    server.listen(0)
    return server
  }
  const servers = { GLOBAL: boot(GLOBAL_ENV), IRAN: boot(IRAN_ENV) }
  const send = (region, { method = 'GET', host, path, headers }) => new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: servers[region].address().port, path, method, headers: { ...headers, host } }, res => {
      res.resume(); res.on('end', () => resolve({ status: res.statusCode, location: res.headers.location }))
    })
    r.on('upgrade', (res, socket) => { socket.destroy(); resolve({ status: res.statusCode }) })
    r.on('error', reject); r.end()
  })
  try {
    for (const [host, meta] of Object.entries(HOSTS)) {
      const isCanonical = `https://${host}` === meta.canonical
      const page = await send(meta.region, { host, path: '/fa/challenges?plan=25k&a=%2F', headers: DOC })
      if (isCanonical) assert.equal(page.status, 200, host)
      else { assert.equal(page.status, 301, host); assert.equal(page.location, `${meta.canonical}/fa/challenges?plan=25k&a=%2F`, host) }
      for (const [method, path, headers] of MACHINE) {
        const r = await send(meta.region, { method, host, path, headers })
        assert.ok(r.status === 200 || r.status === 101, `${meta.region} ${method} ${host}${path} → ${r.status} ${r.location ?? ''}`)
      }
    }
  } finally { for (const s of Object.values(servers)) s.close() }
})

/* ---------- direct openfi.live visit: country-derived locale ---------- */

test('IRAN with an IP database: a direct openfi.live visitor gets a country locale; only unknown addresses get the fallback', async () => {
  assert.equal(fallbackLocale(IRAN_ENV), 'fa', 'the deployed IRAN fallback')
  const db = parseIpCsv([
    '2.144.0.0,2.147.255.255,IR', '5.8.0.0,5.8.255.255,RU', '1.0.1.0,1.0.3.255,CN', '2.88.0.0,2.91.255.255,SA', '3.0.0.0,3.255.255.255,US',
    '2a01:5ec0::,2a01:5ec0:ffff:ffff:ffff:ffff:ffff:ffff,IR', '2a02:6b8::,2a02:6b8:ffff:ffff:ffff:ffff:ffff:ffff,RU',
    '240e::,240e:0fff:ffff:ffff:ffff:ffff:ffff:ffff,CN', '2600::,2600:ffff:ffff:ffff:ffff:ffff:ffff:ffff,US',
  ].join('\n'))
  const r = countryResolver({ GEO_COUNTRY_SOURCE: 'ip-database', GEO_CLIENT_HOP: '1', GEOIP_DB_PATH: 'fixture' }, { loadDb: async () => db })
  await r.ready
  const locale = xff => defaultLocale(r.resolve({ 'x-forwarded-for': xff }, '10.0.0.1'), fallbackLocale(IRAN_ENV))
  const cases = {
    '2.144.1.1': 'fa', '5.8.1.1': 'ru', '1.0.2.3': 'zh-CN', '2.90.0.1': 'ar', '3.4.5.6': 'en',
    '2a01:5ec0::1': 'fa', '2a02:6b8::abcd': 'ru', '240e:3b4::1': 'zh-CN', '2600:1f18::5': 'en', '::ffff:5.8.1.1': 'ru',
    /* unknown: private, reserved, unlisted → the regional fallback */
    '10.1.2.3': 'fa', 'fd00::1': 'fa', '2001:db8::1': 'fa', 'garbage': 'fa',
  }
  for (const [ip, expected] of Object.entries(cases)) assert.equal(locale(ip), expected, ip)
  /* a client-written entry to the left of the platform's hop is never read */
  assert.equal(locale('2.144.1.1, 5.8.1.1'), 'ru')
  assert.equal(locale('2a01:5ec0::1, 2600:1f18::5'), 'en')
})
