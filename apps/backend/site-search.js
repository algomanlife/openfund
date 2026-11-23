/**
 * Site search (ADR 0052).
 *
 *   GET  /search/index?locale=    per-locale index of published content
 *   POST /search/events           anonymous aggregate counts (search, click)
 *   GET  /admin/search/analytics  owner dashboard data (Backstage)
 *   GET  /admin/search/export.csv the same rows as CSV
 *
 * The index holds published content only: Directus rows read through the
 * CMS snapshot path with fixed `status = published` queries (the public role
 * decides visibility, as for a browser), the bundled routes and developer
 * docs (search-sources.json, generated from the web app), and market
 * symbols. It never contains user, account, wallet or terminal data. Each
 * region builds its own index from its own snapshot, so IRAN serves its own.
 * The index is rebuilt when its inputs change (content hash), checked at
 * most once a minute; clients revalidate with an ETag.
 *
 * Analytics store (day, locale, masked normalized query) → counts of
 * searches, searches with results, and clicks. No IP, wallet, user id,
 * cookie or user agent is read or stored. Rows older than twelve months are
 * removed by `pruneSearchStats`.
 */
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Router } from 'express'
import { adminAuth } from './admin.js'
import { maskQuery, normalizeText } from '../../packages/site-search/index.mjs'

export const SEARCH_LOCALES = ['fa', 'en', 'ar', 'ru', 'zh-CN']
const fail = (status, error) => Object.assign(new Error(error), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const SOURCES = JSON.parse(readFileSync(new URL('./search-sources.json', import.meta.url), 'utf8'))

/* fixed, published-only Directus reads (each also refreshes the snapshot) */
export const CMS_SEARCH_QUERIES = {
  pages: 'items/pages?fields=slug,translations.language_code,translations.title,translations.subtitle,translations.description&filter[status][_eq]=published&limit=-1',
  faqs: 'items/faqs?fields=slug,page,translations.language_code,translations.question,translations.answer&filter[status][_eq]=published&limit=-1',
  glossary_terms: 'items/glossary_terms?fields=slug,translations.language_code,translations.term,translations.short,translations.definition&filter[status][_eq]=published&limit=-1',
  trading_rules: 'items/trading_rules?fields=section_key,translations.language_code,translations.title,translations.explanation_body&filter[status][_eq]=published&limit=-1',
  learning_paths: 'items/learning_paths?fields=slug,translations.language_code,translations.title,translations.summary&filter[status][_eq]=published&limit=-1',
  tools: 'items/tools?fields=slug,translations.language_code,translations.name,translations.tagline,translations.about&filter[status][_eq]=published&limit=-1',
  whitepaper_chapters: 'items/whitepaper_chapters?fields=slug,translations.language_code,translations.title,translations.kicker,translations.summary&filter[status][_eq]=published&limit=-1',
  search_synonyms: 'items/search_synonyms?fields=id,terms&filter[status][_eq]=published&limit=-1',
  search_suggestions: 'items/search_suggestions?fields=id,sort,route,translations.language_code,translations.label&filter[status][_eq]=published&sort=sort&limit=-1',
}

const plain = (v, max = 280) => {
  const s = Array.isArray(v) ? v.join(' ') : typeof v === 'string' ? v : v && typeof v === 'object' ? JSON.stringify(v) : ''
  return s.replace(/<[^>]*>/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*_#>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}
const slugOk = s => typeof s === 'string' && /^[a-z0-9][a-z0-9_-]{0,119}$/i.test(s)
/** a locale's translation row, else English (the web app's fallback) */
function translation(row, locale) {
  const list = Array.isArray(row?.translations) ? row.translations : []
  return list.find(t => t?.language_code === locale) || list.find(t => t?.language_code === 'en') || null
}

/** Pure index builder; `cms` maps collection → Directus rows (or null). */
export function buildSearchIndex(locale, { cms = {}, markets = [], sources = SOURCES } = {}) {
  if (!SEARCH_LOCALES.includes(locale)) throw fail(400, 'invalid_locale')
  const L = `/${locale}`
  const entries = []
  const add = (e) => { if (e.title) entries.push({ ...e, title: plain(e.title, 140), snippet: plain(e.snippet) }) }
  for (const r of sources.routes) {
    add({ id: `page:${r.path}`, kind: 'page', icon: r.icon || 'about', title: r.title?.[locale] || r.title?.en, snippet: r.description?.[locale] || r.description?.en || '', url: `${L}/${r.path}`, keywords: r.path.split(/[/-]/), boost: 3 })
  }
  for (const d of sources.docs) {
    const lang = locale === 'fa' ? 'fa' : 'en'
    add({ id: `docs:${d.slug}`, kind: 'docs', icon: 'developers', title: d.title[lang], snippet: d.text[lang], url: `${L}/developers#doc-${d.slug}` })
  }
  const each = (collection, fn) => { for (const row of Array.isArray(cms[collection]) ? cms[collection] : []) { const t = translation(row, locale); if (t) fn(row, t) } }
  each('pages', (row, t) => slugOk(row.slug) && add({ id: `pages:${row.slug}`, kind: 'content', icon: 'about', title: t.title, snippet: t.subtitle || t.description, url: `${L}/${row.slug}` }))
  each('faqs', (row, t) => slugOk(row.slug) && add({ id: `faqs:${row.slug}`, kind: 'content', icon: 'faq', title: t.question, snippet: t.answer, url: `${L}/faq/q/${row.slug}` }))
  each('glossary_terms', (row, t) => slugOk(row.slug) && add({ id: `glossary:${row.slug}`, kind: 'content', icon: 'glossary', title: t.term, snippet: t.short || t.definition, url: `${L}/learn/glossary/${row.slug}` }))
  each('trading_rules', (row, t) => slugOk(row.section_key) && add({ id: `rules:${row.section_key}`, kind: 'content', icon: 'rulebook', title: t.title, snippet: t.explanation_body, url: `${L}/rulebook#${row.section_key}` }))
  each('learning_paths', (row, t) => slugOk(row.slug) && add({ id: `learn:${row.slug}`, kind: 'content', icon: 'learn', title: t.title, snippet: t.summary, url: `${L}/learn/paths/${row.slug}` }))
  each('tools', (row, t) => slugOk(row.slug) && add({ id: `tools:${row.slug}`, kind: 'content', icon: 'tools', title: t.name, snippet: t.tagline || t.about, url: `${L}/tools/${row.slug}` }))
  each('whitepaper_chapters', (row, t) => slugOk(row.slug) && add({ id: `whitepaper:${row.slug}`, kind: 'whitepaper', icon: 'whitepaper', title: t.title || t.kicker, snippet: t.summary, url: `${L}/whitepaper#${row.slug}` }))
  for (const m of markets) {
    const symbol = typeof m?.symbol === 'string' && /^[A-Za-z0-9._/-]{1,24}$/.test(m.symbol) ? m.symbol : null
    if (!symbol) continue
    const [base] = symbol.split(/[/_-]/)
    add({ id: `market:${symbol}`, kind: 'market', icon: 'markets', title: symbol, snippet: plain([m.base, m.group].filter(v => typeof v === 'string').join(' · '), 80), url: `${L}/markets?symbol=${encodeURIComponent(symbol)}`, keywords: [base, m.group].filter(v => typeof v === 'string' && v) })
  }
  /* de-duplicate by id (first wins: a route beats a page row with the same slug) */
  const seen = new Set()
  const unique = entries.filter(e => (seen.has(e.id) ? false : seen.add(e.id)))
  const synonyms = (Array.isArray(cms.search_synonyms) ? cms.search_synonyms : [])
    .map(r => (Array.isArray(r?.terms) ? r.terms : []).filter(t => typeof t === 'string' && t.trim()).map(t => t.trim().slice(0, 60)).slice(0, 20))
    .filter(g => g.length > 1).slice(0, 500)
  const suggestions = []
  each('search_suggestions', (row, t) => {
    const route = typeof row.route === 'string' && /^[a-z0-9][a-z0-9/-]{0,80}$/.test(row.route) ? row.route : null
    if (route && t.label) suggestions.push({ label: plain(t.label, 80), url: `${L}/${route}` })
  })
  return { locale, entries: unique, synonyms, suggestions: suggestions.slice(0, 12) }
}

/** analytics event validation (pure); returns the row delta or null */
export function searchEvent(body) {
  const b = body && typeof body === 'object' ? body : {}
  if (!SEARCH_LOCALES.includes(b.locale)) return null
  if (!['search', 'click'].includes(b.type)) return null
  const query = maskQuery(b.query)
  if (!query || !normalizeText(query)) return null
  const results = Number.isInteger(b.results) && b.results >= 0 && b.results <= 10_000 ? b.results : null
  if (b.type === 'search' && results === null) return null
  return { locale: b.locale, query, searches: b.type === 'search' ? 1 : 0, results: b.type === 'search' && results > 0 ? 1 : 0, clicks: b.type === 'click' ? 1 : 0 }
}

export function siteSearchRoutes({ pool, cms, marketData, limit, now = () => Date.now() }) {
  const router = Router()
  const cache = new Map() /* locale → { at, etag, body, inputs } */

  async function inputs() {
    const cmsRows = {}
    await Promise.all(Object.entries(CMS_SEARCH_QUERIES).map(async ([c, key]) => {
      const doc = await cms?.read(key).catch(() => null)
      cmsRows[c] = Array.isArray(doc?.data) ? doc.data : null
    }))
    const markets = marketData?.markets instanceof Map ? [...marketData.markets.values()] : []
    return { cms: cmsRows, markets }
  }

  async function indexFor(locale) {
    const hit = cache.get(locale)
    if (hit && now() - hit.at < 60_000) return hit
    const data = await inputs()
    const hash = crypto.createHash('sha256').update(JSON.stringify([data.cms, data.markets.map(m => [m.symbol, m.name])])).digest('hex')
    if (hit && hit.inputs === hash) { hit.at = now(); return hit }
    const body = JSON.stringify({ ...buildSearchIndex(locale, data), builtAt: new Date(now()).toISOString() })
    const next = { at: now(), inputs: hash, body, etag: `"${crypto.createHash('sha256').update(body).digest('base64url').slice(0, 27)}"` }
    cache.set(locale, next)
    return next
  }

  router.get('/search/index', limit(120), wrap(async (req, res) => {
    const locale = String(req.query.locale || '')
    if (!SEARCH_LOCALES.includes(locale)) throw fail(400, 'invalid_locale')
    const idx = await indexFor(locale)
    res.set({ 'Cache-Control': 'public, max-age=60, must-revalidate', ETag: idx.etag, 'X-Robots-Tag': 'noindex' })
    if (req.get('if-none-match') === idx.etag) return res.status(304).end()
    res.type('application/json').send(idx.body)
  }))

  router.post('/search/events', limit(60), wrap(async (req, res) => {
    const e = searchEvent(req.body)
    if (!e) throw fail(400, 'invalid_event')
    await pool.query(`INSERT INTO search_query_stats (day, locale, query, searches, results, clicks)
      VALUES (CURRENT_DATE, $1, $2, $3, $4, $5)
      ON CONFLICT (day, locale, query) DO UPDATE SET searches = search_query_stats.searches + EXCLUDED.searches,
        results = search_query_stats.results + EXCLUDED.results, clicks = search_query_stats.clicks + EXCLUDED.clicks`,
      [e.locale, e.query, e.searches, e.results, e.clicks])
    res.status(204).end()
  }))
  return router
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
/** dashboard filters → SQL (pure; exported for tests) */
export function analyticsFilters(q = {}) {
  const today = new Date().toISOString().slice(0, 10)
  const to = DAY.test(q.to || '') ? q.to : today
  const from = DAY.test(q.from || '') ? q.from : new Date(Date.parse(to) - 29 * 86_400_000).toISOString().slice(0, 10)
  if (Date.parse(from) > Date.parse(to) || Date.parse(to) - Date.parse(from) > 366 * 86_400_000) throw fail(400, 'invalid_range')
  const locale = SEARCH_LOCALES.includes(q.locale) ? q.locale : null
  const contains = typeof q.q === 'string' && q.q.trim() ? normalizeText(q.q).slice(0, 80) : null
  return { from, to, locale, contains }
}

export function siteSearchAdminRoutes({ pool }) {
  const router = Router()
  router.use(adminAuth)
  const where = `day BETWEEN $1::date AND $2::date AND ($3::text IS NULL OR locale = $3) AND ($4::text IS NULL OR strpos(query, $4) > 0)`
  const params = f => [f.from, f.to, f.locale, f.contains]
  const top = (f, order, having = 'TRUE', n = 50) => pool.query(
    `SELECT query, locale, sum(searches)::int AS searches, sum(results)::int AS results, sum(clicks)::int AS clicks,
       (sum(searches) - sum(results))::int AS zero_results
     FROM search_query_stats WHERE ${where} GROUP BY query, locale HAVING ${having} ORDER BY ${order}, query LIMIT ${n}`, params(f))

  router.get('/analytics', wrap(async (req, res) => {
    const f = analyticsFilters(req.query)
    const [totals, trend, topQ, zero, noClick] = await Promise.all([
      pool.query(`SELECT coalesce(sum(searches),0)::int AS searches, coalesce(sum(results),0)::int AS results, coalesce(sum(clicks),0)::int AS clicks, count(DISTINCT query)::int AS queries FROM search_query_stats WHERE ${where}`, params(f)),
      pool.query(`SELECT to_char(day,'YYYY-MM-DD') AS day, sum(searches)::int AS searches, sum(results)::int AS results, sum(clicks)::int AS clicks FROM search_query_stats WHERE ${where} GROUP BY day ORDER BY day`, params(f)),
      top(f, 'sum(searches) DESC'),
      top(f, 'sum(searches) - sum(results) DESC', 'sum(searches) > sum(results)'),
      top(f, 'sum(results) DESC', 'sum(results) > 0 AND sum(clicks) = 0'),
    ])
    res.set('Cache-Control', 'no-store').json({ filters: f, totals: totals.rows[0], trend: trend.rows, top: topQ.rows, zeroResults: zero.rows, noClicks: noClick.rows })
  }))

  router.get('/export.csv', wrap(async (req, res) => {
    const f = analyticsFilters(req.query)
    const { rows } = await pool.query(`SELECT to_char(day,'YYYY-MM-DD') AS day, locale, query, searches, results, clicks FROM search_query_stats WHERE ${where} ORDER BY day, locale, query LIMIT 100000`, params(f))
    const cell = v => { const s = String(v); const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe }
    const csv = ['day,locale,query,searches,results,clicks', ...rows.map(r => [r.day, r.locale, r.query, r.searches, r.results, r.clicks].map(cell).join(','))].join('\n') + '\n'
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="search-${f.from}-${f.to}.csv"`, 'Cache-Control': 'no-store' }).send(csv)
  }))
  return router
}

/** twelve-month retention (aggregate counts only; no financial records) */
export async function pruneSearchStats(pool) {
  const { rowCount } = await pool.query(`DELETE FROM search_query_stats WHERE day < CURRENT_DATE - INTERVAL '12 months'`)
  return rowCount
}
