/**
 * Site search (site-search.js, packages/site-search) on real PostgreSQL:
 * normalization (Arabic/Persian letters, ZWNJ, diacritics, digits), typo
 * tolerance and synonyms, the published-only index per locale (no user or
 * account data, snapshot fallback through the CMS reader), query masking,
 * the anonymous analytics counters, the owner dashboard, CSV export and the
 * twelve-month retention.
 */
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import pg from 'pg'
import { normalizeText, tokenize, search, synonymLookup, highlightRanges, maskQuery, editDistance } from '../../../packages/site-search/index.mjs'
import { buildSearchIndex, searchEvent, analyticsFilters, siteSearchRoutes, siteSearchAdminRoutes, pruneSearchStats, CMS_SEARCH_QUERIES, SEARCH_LOCALES } from '../site-search.js'
import { cmsSnapshotRoutes, CMS_COLLECTIONS } from '../cms-snapshot.js'

if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Use an isolated test DATABASE_URL')
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const TOKEN = 'site-search-test-token-0123456789abcdef'
const tr = (code, fields) => ({ language_code: code, ...fields })
const CMS = {
  faqs: [{ slug: 'payout-time', page: 'faq', translations: [tr('en', { question: 'When are payouts paid?', answer: 'Within <b>24 hours</b> of approval.' }), tr('fa', { question: 'برداشت سود کی پرداخت می‌شود؟', answer: 'ظرف ۲۴ ساعت' })] }],
  glossary_terms: [{ slug: 'drawdown', translations: [tr('en', { term: 'Drawdown', short: 'A fall from a peak in equity.' })] }],
  whitepaper_chapters: [{ slug: 'economy', translations: [tr('en', { title: 'Token economy', summary: 'How fees fund the treasury.' }), tr('fa', { title: 'اقتصاد توکن', summary: 'كارمزدها' })] }],
  trading_rules: [{ section_key: 'daily-loss', translations: [tr('en', { title: 'Daily loss limit', explanation_body: 'The limit resets at 00:00 UTC.' })] }],
  search_synonyms: [{ id: 1, terms: ['payout', 'withdrawal', 'برداشت'] }, { id: 2, terms: ['solo'] }],
  search_suggestions: [{ id: 1, sort: 1, route: 'faq', translations: [tr('en', { label: 'Browse the FAQ' }), tr('fa', { label: 'پرسش‌های متداول' })] },
    { id: 2, sort: 2, route: 'https://evil.example', translations: [tr('en', { label: 'Bad link' })] }],
}
const MARKETS = [{ symbol: 'BTC/USD', base: 'BTC', group: 'crypto' }, { symbol: '<script>', base: 'x' }]
let server, base

const call = async (method, path, { body, admin, headers = {} } = {}) => {
  const h = { 'content-type': 'application/json', ...headers }
  if (admin) { h.authorization = `Bearer ${TOKEN}`; h['x-admin-actor'] = 'search owner' }
  const r = await fetch(base + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined })
  const text = await r.text()
  let data = text; try { data = JSON.parse(text) } catch {}
  return { status: r.status, data, headers: r.headers }
}

before(async () => {
  process.env.ADMIN_API_TOKEN = TOKEN
  await pool.query(`DELETE FROM search_query_stats`)
  await pool.query(`DELETE FROM cms_snapshot WHERE collection = ANY($1)`, [Object.keys(CMS_SEARCH_QUERIES)])
  /* a fake Directus origin serving the fixture collections */
  let cmsUp = true
  const fetchImpl = async url => {
    if (!cmsUp) throw new Error('down')
    const c = /\/items\/([a-z_]+)/.exec(url)?.[1]
    const data = CMS[c] || []
    return new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const cms = cmsSnapshotRoutes({ pool, origin: 'https://cms.test', fetchImpl })
  const app = express()
  app.use(express.json())
  const limit = () => (_req, _res, next) => next()
  app.post('/test/cms-down', (_req, res) => { cmsUp = false; res.json({ ok: true }) })
  app.use(siteSearchRoutes({ pool, cms, marketData: { markets: new Map(MARKETS.map(m => [m.symbol, m])) }, limit, now: () => Date.now() + (cmsUp ? 0 : 120_000) }))
  app.use('/admin/search', siteSearchAdminRoutes({ pool }))
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }))
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`
})
after(async () => { server?.close(); await pool.end() })

test('normalization: Arabic letters to Persian, ZWNJ as a space, diacritics stripped, digits unified', () => {
  assert.equal(normalizeText('علي كتاب'), 'علی کتاب')
  assert.equal(normalizeText('می‌خواهم'), 'می خواهم')
  assert.equal(normalizeText('مُعامِلَه'), 'معامله')
  assert.equal(normalizeText('Café NAÏVE'), 'cafe naive')
  assert.equal(normalizeText('۱۲۳ ٤٥٦ 789'), '123 456 789')
  assert.deepEqual(tokenize('  BTC/USD,  ۵۰ '), ['btc', 'usd', '50'])
})

test('matching: every token must match; typos within budget; synonyms both ways; highlight in the original', () => {
  const entries = [{ id: 'a', kind: 'page', title: 'Trading Rules', snippet: 'Every rule before you start', url: '/en/rulebook' },
    { id: 'b', kind: 'content', title: 'When are payouts paid?', snippet: '', url: '/en/faq' },
    { id: 'c', kind: 'market', title: 'BTC/USD', snippet: 'crypto', url: '/en/markets' }]
  assert.deepEqual(search(entries, 'tradng rules').map(e => e.id), ['a'])
  assert.deepEqual(search(entries, 'trading xyzzy'), [])
  assert.deepEqual(search(entries, 'btc', { kinds: ['page'] }), [])
  const syn = synonymLookup([['withdrawal', 'payout']])
  assert.deepEqual(search(entries, 'withdrawal', { synonyms: syn }).map(e => e.id), ['b'])
  assert.equal(editDistance('drawdwon', 'drawdown'), 1)
  assert.deepEqual(highlightRanges('Trading Rules', 'rul'), [[8, 11]])
  assert.deepEqual(highlightRanges('می‌خواهم', 'خواهم'), [[3, 8]])
})

test('masking: e-mails, wallets, hashes and phone numbers never reach storage; length is capped', () => {
  assert.equal(maskQuery('help a.b@example.com'), 'help [email]')
  assert.equal(maskQuery('0x' + 'Ab'.repeat(20)), '[wallet]')
  assert.equal(maskQuery('tx 0x' + 'f'.repeat(64)), 'tx [hash]')
  assert.equal(maskQuery('call +98 912 345 6789'), 'call [phone]')
  assert.equal(maskQuery('call ۰۹۱۲۳۴۵۶۷۸۹'), 'call [phone]')
  assert.equal(maskQuery('5000 account'), '5000 account')
  assert.equal(maskQuery('x'.repeat(500)).length, 80)
})

test('the index: published rows only, five locales, safe links, no user or account data', () => {
  const en = buildSearchIndex('en', { cms: CMS, markets: MARKETS })
  const ids = en.entries.map(e => e.id)
  assert.ok(ids.includes('page:rulebook') && ids.includes('faqs:payout-time') && ids.includes('whitepaper:economy') && ids.includes('docs:quick-start'))
  assert.ok(ids.includes('market:BTC/USD') && !ids.some(i => i.includes('script')))
  assert.equal(en.entries.find(e => e.id === 'faqs:payout-time').snippet, 'Within 24 hours of approval.')
  assert.deepEqual(en.suggestions, [{ label: 'Browse the FAQ', url: '/en/faq' }])
  assert.deepEqual(en.synonyms, [['payout', 'withdrawal', 'برداشت']])
  for (const e of en.entries) assert.match(e.url, /^\/en\//)
  const fa = buildSearchIndex('fa', { cms: CMS, markets: MARKETS })
  assert.equal(fa.entries.find(e => e.id === 'whitepaper:economy').title, 'اقتصاد توکن')
  assert.equal(fa.entries.find(e => e.id === 'rules:daily-loss').title, 'Daily loss limit', 'a missing locale row falls back to English')
  for (const l of SEARCH_LOCALES) assert.ok(buildSearchIndex(l, {}).entries.length > 20)
  assert.throws(() => buildSearchIndex('de', {}), /invalid_locale/)
  const text = JSON.stringify(en)
  for (const forbidden of ['wallet_address', 'user_id', 'account_id', 'balance', '/terminal']) assert.ok(!text.includes(forbidden), forbidden)
  assert.ok(CMS_COLLECTIONS.has('search_synonyms') && CMS_COLLECTIONS.has('search_suggestions'))
})

test('GET /search/index: ETag revalidation, locale validation, snapshot fallback when the CMS is down', async () => {
  const r = await call('GET', '/search/index?locale=fa')
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('x-robots-tag'), 'noindex')
  assert.ok(r.data.entries.some(e => e.id === 'faqs:payout-time'))
  const again = await call('GET', '/search/index?locale=fa', { headers: { 'if-none-match': r.headers.get('etag') } })
  assert.equal(again.status, 304)
  assert.equal((await call('GET', '/search/index?locale=xx')).status, 400)
  await call('POST', '/test/cms-down')
  const down = await call('GET', '/search/index?locale=en')
  assert.equal(down.status, 200)
  assert.ok(down.data.entries.some(e => e.id === 'glossary:drawdown'), 'served from the last-known-good snapshot')
})

test('events: masked anonymous counters; invalid events refused; no client identifiers stored', async () => {
  assert.equal((await call('POST', '/search/events', { body: { locale: 'en', type: 'search', query: 'Payout  a.b@example.com', results: 3 } })).status, 204)
  assert.equal((await call('POST', '/search/events', { body: { locale: 'en', type: 'search', query: 'payout [email]', results: 0 } })).status, 204)
  assert.equal((await call('POST', '/search/events', { body: { locale: 'en', type: 'click', query: 'payout [email]' } })).status, 204)
  assert.equal((await call('POST', '/search/events', { body: { locale: 'en', type: 'search', query: 'zzqx', results: 0 } })).status, 204)
  assert.equal((await call('POST', '/search/events', { body: { locale: 'de', type: 'search', query: 'x', results: 1 } })).status, 400)
  assert.equal((await call('POST', '/search/events', { body: { locale: 'en', type: 'search', query: 'x' } })).status, 400, 'a search needs its result count')
  assert.equal(searchEvent({ locale: 'en', type: 'search', query: '   ', results: 1 }), null)
  const { rows } = await pool.query(`SELECT locale, query, searches, results, clicks FROM search_query_stats ORDER BY query`)
  assert.deepEqual(rows, [{ locale: 'en', query: 'payout [email]', searches: 2, results: 1, clicks: 1 }, { locale: 'en', query: 'zzqx', searches: 1, results: 0, clicks: 0 }])
  const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='search_query_stats'`)).rows.map(r => r.column_name).sort()
  assert.deepEqual(cols, ['clicks', 'day', 'locale', 'query', 'results', 'searches'])
})

test('dashboard: owner only; top, zero-result and no-click queries; trend; filters; CSV export', async () => {
  assert.equal((await call('GET', '/admin/search/analytics')).status, 403)
  await call('POST', '/search/events', { body: { locale: 'fa', type: 'search', query: 'برداشت', results: 2 } })
  const r = await call('GET', '/admin/search/analytics', { admin: true })
  assert.equal(r.status, 200)
  assert.equal(r.data.totals.searches, 4)
  assert.equal(r.data.top[0].query, 'payout [email]')
  assert.deepEqual(r.data.zeroResults.map(q => q.query).sort(), ['payout [email]', 'zzqx'])
  assert.deepEqual(r.data.noClicks.map(q => q.query), ['برداشت'])
  assert.equal(r.data.trend.length, 1)
  const fa = await call('GET', '/admin/search/analytics?locale=fa', { admin: true })
  assert.equal(fa.data.totals.searches, 1)
  const contains = await call('GET', '/admin/search/analytics?q=ZZQ', { admin: true })
  assert.deepEqual(contains.data.top.map(q => q.query), ['zzqx'])
  assert.throws(() => analyticsFilters({ from: '2026-01-10', to: '2026-01-01' }), /invalid_range/)
  const csv = await call('GET', '/admin/search/export.csv', { admin: true })
  assert.equal(csv.status, 200)
  assert.match(csv.headers.get('content-type'), /text\/csv/)
  assert.match(csv.data, /^day,locale,query,searches,results,clicks\n/)
  assert.ok(csv.data.includes(',en,zzqx,1,0,0'))
})

test('retention: rows older than twelve months are removed, newer rows stay', async () => {
  await pool.query(`INSERT INTO search_query_stats (day, locale, query, searches, results, clicks) VALUES (CURRENT_DATE - INTERVAL '13 months', 'en', 'old query', 1, 1, 0), (CURRENT_DATE - INTERVAL '11 months', 'en', 'recent query', 1, 1, 0)`)
  assert.equal(await pruneSearchStats(pool), 1)
  const { rows } = await pool.query(`SELECT query FROM search_query_stats WHERE query IN ('old query','recent query')`)
  assert.deepEqual(rows.map(r => r.query), ['recent query'])
})
