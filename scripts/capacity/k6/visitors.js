/**
 * Openfund — anonymous website visitor workload.
 *
 * Replays the asset graph and public API calls that the shipped bundle
 * actually makes per route (k6/route-assets.json, recorded by
 * browser/capture-routes.mjs), with browser- and CDN-cache behaviour:
 *   - HTML documents: always reach the origin (no-cache, must-revalidate)
 *   - content-hashed /assets/*: immutable; served by Cloudflare with
 *     probability ASSET_CDN_HIT (default 0.95; set 0 for the no-CDN worst case),
 *     and never re-requested by a returning browser
 *   - unhashed legacy/*, translations.json: no-cache → conditional request
 *     (If-None-Match → 304) for returning visitors
 *   - /runtime-config.js: no-store → always 200
 * Sessions: landing route (weighted), 1–5 SPA transitions with think time,
 * 15 % locale switches. Never calls /health.
 */
import http from 'k6/http'
import { sleep } from 'k6'
import { Counter } from 'k6/metrics'
import { TARGET, k6Stages, stageNow, stageThresholds, stopThresholds, summaryTrendStats } from './lib.js'

const routes = JSON.parse(open('./route-assets.json'))
const CDN_HIT = Number(__ENV.ASSET_CDN_HIT ?? 0.95)
const RETURNING = Number(__ENV.RETURNING_SHARE ?? 0.4)
const integrity = new Counter('integrity_violations') /* declared for the shared stop threshold */
const bytesOrigin = new Counter('origin_bytes')
const EP = ['document', 'asset', 'legacy', 'runtime', 'api_public']

export const options = {
  scenarios: { visitors: { executor: 'ramping-vus', startVUs: 0, stages: k6Stages('visitors'), gracefulRampDown: '5s', gracefulStop: '10s' } },
  thresholds: { ...stopThresholds, ...stageThresholds(EP) },
  summaryTrendStats,
  discardResponseBodies: true,
}
const LANDING = [['home', 35], ['challenges', 25], ['markets', 15], ['transparency', 5], ['governance', 5], ['faq', 5], ['rulebook', 4], ['learn', 3], ['whitepaper', 2], ['tools', 1]]
const NAV = ['challenges', 'markets', 'home', 'rulebook', 'faq', 'transparency', 'governance', 'learn', 'tools', 'whitepaper']
const wpick = list => { let x = Math.random() * list.reduce((a, [, w]) => a + w, 0); for (const [v, w] of list) { if ((x -= w) < 0) return v } return list[0][0] }
const pick = a => a[Math.floor(Math.random() * a.length)]
const listFor = (locale, page) => routes[`/${locale}/${page}`] || routes[`/${locale === 'fa' ? 'en' : 'fa'}/${page}`] || routes['/fa/home']
const classify = p => p.path.startsWith('/runtime-config') ? 'runtime'
  : ['fetch', 'xhr'].includes(p.type) && !p.path.startsWith('/legacy') && !p.path.startsWith('/translations') ? 'api_public'
  : /^\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/i.test(p.path) ? 'asset' : 'legacy'

export function setup() {
  /* ETags for unhashed files (returning-visitor revalidation) */
  const etags = {}
  for (const list of Object.values(routes)) for (const r of list) if (classify(r) === 'legacy' && r.type !== 'document' && !etags[r.path]) {
    const res = http.get(TARGET + r.path, { tags: { ep: 'setup' } })
    if (res.headers.Etag) etags[r.path] = res.headers.Etag
  }
  return { etags }
}

function get(path, ep, headers = {}) {
  const r = http.get(TARGET + path, { headers: { 'x-forwarded-for': ip, 'accept-language': locale === 'fa' ? 'fa-IR,fa;q=0.9' : 'en-US,en;q=0.9', ...headers },
    tags: { ep, stage: stageNow() }, responseCallback: http.expectedStatuses({ min: 200, max: 399 }) })
  bytesOrigin.add(r.body ? r.body.length : Number(r.headers['Content-Length'] || 0), { ep })
  return r
}
let ip, locale
function loadPage(page, seen, returning, etags, full) {
  const list = listFor(locale, page)
  if (full) get(`/${locale}/${page}`, 'document', { accept: 'text/html,application/xhtml+xml' })
  for (const r of list) {
    if (r.type === 'document') continue
    const kind = classify(r)
    if (kind === 'api_public') { get(r.path, 'api_public', { accept: 'application/json' }); continue }
    if (seen.has(r.path)) continue
    seen.add(r.path)
    if (kind === 'runtime') { if (full) get(r.path, 'runtime'); continue }
    if (kind === 'asset') { if (returning || Math.random() < CDN_HIT) continue; get(r.path, 'asset'); continue }
    /* legacy / translations: no-cache → conditional for returning browsers */
    if (returning && etags[r.path]) get(r.path, 'legacy', { 'if-none-match': etags[r.path] })
    else get(r.path, 'legacy')
  }
}
export default function (data) {
  ip = `172.${16 + (__VU % 16)}.${(__ITER >> 8) & 255}.${(__VU * 7 + __ITER) & 255}`
  locale = Math.random() < 0.65 ? 'fa' : 'en'
  const returning = Math.random() < RETURNING
  const seen = new Set()
  let page = wpick(LANDING)
  loadPage(page, seen, returning, data.etags, true)
  const navs = 1 + Math.floor(Math.random() * 5)
  for (let n = 0; n < navs; n++) {
    sleep(4 + Math.random() * 8)
    if (Math.random() < 0.15) locale = locale === 'fa' ? 'en' : 'fa'   /* locale switch (client-side) */
    page = pick(NAV)
    loadPage(page, seen, returning, data.etags, false)                  /* SPA transition: new chunks + API only */
  }
  if (Math.random() < 0.02) { get('/sitemap.xml', 'legacy'); get('/robots.txt', 'legacy') }
  sleep(2 + Math.random() * 6)
}
export function handleSummary(data) {
  return { [`${__ENV.RUN_DIR || '.'}/k6-visitors-summary.json`]: JSON.stringify(data, null, 1), stdout: `visitors: ${data.metrics.http_reqs?.values.count} req, failed ${(100 * (data.metrics.http_req_failed?.values.rate || 0)).toFixed(2)}%\n` }
}
