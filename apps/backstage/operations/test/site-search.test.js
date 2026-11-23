import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createServer, request } from 'node:http'
import { test } from 'node:test'
import { createVerifier } from '../password.js'
import { createBackstage, siteSearchTerm } from '../server.js'

/* Site search in Backstage (ADR 0052): the analytics dashboard proxies the
   backend with validated filters, the CSV passes through as text, and the
   one-click "add synonym or suggestion" writes one validated, published
   Directus item behind session + CSRF + owner password + GLOBAL region. */
const open = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)))

test('siteSearchTerm validates synonym groups and suggestions', () => {
  assert.deepEqual(siteSearchTerm({ kind: 'synonym', terms: [' payout ', 'withdrawal', 'payout', '<b>x</b>'] }),
    ['/items/search_synonyms', { status: 'published', terms: ['payout', 'withdrawal', 'bx/b'], note: null }])
  assert.throws(() => siteSearchTerm({ kind: 'synonym', terms: ['solo'] }), /invalid_terms/)
  assert.throws(() => siteSearchTerm({ kind: 'synonym', terms: Array.from({ length: 21 }, (_, i) => 'w' + i) }), /invalid_terms/)
  assert.deepEqual(siteSearchTerm({ kind: 'suggestion', route: 'learn/glossary', labelFa: 'واژه‌نامه', labelEn: 'Glossary' }),
    ['/items/search_suggestions', { status: 'published', sort: 100, route: 'learn/glossary',
      translations: [{ language_code: 'fa', label: 'واژه‌نامه' }, { language_code: 'en', label: 'Glossary' }] }])
  for (const route of ['https://evil.example', '/challenges', '../admin', 'Challenges', '']) assert.throws(() => siteSearchTerm({ kind: 'suggestion', route, labelFa: 'a', labelEn: 'b' }), /invalid_route/, route)
  assert.throws(() => siteSearchTerm({ kind: 'suggestion', route: 'faq', labelFa: '', labelEn: 'FAQ' }), /invalid_label/)
  assert.throws(() => siteSearchTerm({ kind: 'delete' }), /invalid_request/)
})

test('dashboard reads, CSV export and the owner-gated one-click add', async t => {
  const calls = [], cmsCalls = []
  let region = 'GLOBAL'
  const upstream = createServer(async (req, res) => {
    calls.push({ path: req.url, method: req.method })
    if (req.url === '/runtime/status') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ region, mode: 'GLOBAL_CONNECTED' })) }
    if (req.url.startsWith('/admin/search/export.csv')) { res.setHeader('Content-Type', 'text/csv'); return res.end('day,locale,query,searches,results,clicks\n2026-11-23,en,payout,2,1,1\n') }
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ totals: { searches: 2, results: 1, clicks: 1, queries: 1 }, trend: [], top: [], zeroResults: [], noClicks: [] }))
  })
  const cms = createServer(async (req, res) => {
    const parts = []
    for await (const part of req) parts.push(part)
    cmsCalls.push({ path: req.url, method: req.method, auth: req.headers.authorization, body: JSON.parse(Buffer.concat(parts).toString() || 'null') })
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ data: { id: 7 } }))
  })
  const password = randomBytes(24).toString('base64url')
  const origin = 'https://backstage.example.test'
  const contentToken = randomBytes(24).toString('hex')
  const settings = { origin, backend: await open(upstream), cms: await open(cms), contentToken,
    owner: 'owner-fixture', credential: randomBytes(32).toString('hex'), verifier: await createVerifier(password), realSettlement: false }
  const server = createBackstage(settings, { audit: () => {} })
  const local = await open(server)
  t.after(() => { server.close(); upstream.close(); cms.close() })
  const call = (path, body, headers = {}) => new Promise((resolve, reject) => {
    const req = request(local + path, {
      method: body ? 'POST' : 'GET',
      headers: { Host: new URL(origin).host, ...(body && { Origin: origin, 'Content-Type': 'application/json' }), ...headers },
    }, async res => {
      try {
        const parts = []
        for await (const part of res) parts.push(part)
        const text = Buffer.concat(parts).toString()
        let data = text; try { data = JSON.parse(text) } catch { /* CSV */ }
        resolve({ status: res.statusCode, type: res.headers['content-type'], cookie: res.headers['set-cookie']?.[0], body: data })
      } catch (error) { reject(error) }
    })
    req.on('error', reject)
    req.end(body ? JSON.stringify(body) : undefined)
  })
  const login = await call('/api/login', { username: settings.owner, password })
  const headers = { Cookie: login.cookie.split(';')[0], 'X-CSRF-Token': login.body.csrf }

  assert.equal((await call('/api/siteSearch')).status, 401, 'reads require a session')
  const read = await call('/api/siteSearch?locale=fa&q=payout&from=2026-11-01&to=2026-11-23&evil=1', undefined, headers)
  assert.equal(read.status, 200)
  assert.equal(read.body.totals.searches, 2)
  const proxied = new URL(calls.at(-1).path, settings.backend)
  assert.equal(proxied.pathname, '/admin/search/analytics')
  assert.deepEqual(Object.fromEntries(proxied.searchParams), { from: '2026-11-01', to: '2026-11-23', locale: 'fa', q: 'payout' })

  const csv = await call('/api/siteSearch/export.csv?from=bad&locale=en', undefined, headers)
  assert.equal(csv.status, 200)
  assert.match(csv.type, /text\/csv/)
  assert.match(csv.body, /^day,locale,query/)
  assert.deepEqual(Object.fromEntries(new URL(calls.at(-1).path, settings.backend).searchParams), { locale: 'en' }, 'invalid filters are dropped')
  assert.equal((await call('/api/siteSearch/other', undefined, headers)).status, 404)

  const add = { kind: 'synonym', terms: ['payout', 'withdrawal'], password }
  assert.equal((await call('/api/siteSearchTerms', add, { Cookie: headers.Cookie })).status, 403, 'CSRF required')
  assert.equal((await call('/api/siteSearchTerms', { ...add, password: 'wrong credential!' }, headers)).status, 401)
  assert.equal((await call('/api/siteSearchTerms', { ...add, terms: ['one'] }, headers)).status, 400)
  region = 'IRAN'
  assert.equal((await call('/api/siteSearchTerms', add, headers)).body.error, 'wrong_region')
  region = 'GLOBAL'
  assert.equal(cmsCalls.length, 0, 'nothing reaches the CMS before every gate passes')
  const ok = await call('/api/siteSearchTerms', add, headers)
  assert.equal(ok.status, 200)
  assert.deepEqual(ok.body, { ok: true, id: 7 })
  assert.deepEqual(cmsCalls.at(-1), { path: '/items/search_synonyms', method: 'POST', auth: `Bearer ${contentToken}`, body: { status: 'published', terms: ['payout', 'withdrawal'], note: null } })
  const suggestion = await call('/api/siteSearchTerms', { kind: 'suggestion', route: 'faq', labelFa: 'پرسش‌ها', labelEn: 'FAQ', password }, headers)
  assert.equal(suggestion.status, 200)
  assert.equal(cmsCalls.at(-1).path, '/items/search_suggestions')
})
