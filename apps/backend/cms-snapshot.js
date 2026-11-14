/**
 * Same-origin, read-only CMS content path with a last-known-good snapshot
 * (ADR 0033 §5, content availability).
 *
 *   GET /cms/items/<collection>?<Directus query>   published public content
 *   GET /cms/assets/<uuid>                           public CMS file
 *
 * The backend reads the configured CMS origin server-to-server (no token: the
 * Directus public role decides what is visible, exactly as for a browser) and
 * keeps the newest successful answer per request in `cms_snapshot`. When the
 * CMS cannot be reached, the stored answer is served with
 * `X-Openfund-Content: snapshot` and its fetch time. Nothing is ever invented:
 * no snapshot and no CMS → 503 `content_unavailable`, and the page shows its
 * explicit unavailable state.
 *
 * Why: the browser otherwise loads content directly from the CMS origin. From
 * Iranian networks that foreign origin may be slow or unreachable, and during
 * an international outage it is unreachable. The Iran runtime therefore uses
 * this path as its primary content source; GLOBAL uses it as a fallback.
 *
 * Safety: fixed origin (no caller-supplied host), allowlisted collections and
 * query parameters, GET only, size limits, short timeouts.
 */
import crypto from 'node:crypto'
import { Router } from 'express'

export const CMS_COLLECTIONS = new Set([
  'challenge_plans', 'faq_categories', 'faqs', 'footer_links', 'glossary_terms', 'governance_content_blocks',
  'governance_milestones', 'home_content', 'learning_paths', 'legal_documents', 'navigation_items', 'pages',
  'referral_content', 'site_settings', 'terminal_sections', 'tools', 'trading_rules', 'ui_messages',
  'whitepaper_chapters', 'whitepaper_datasets', 'whitepaper_documents', 'whitepaper_references',
])
const PARAM = /^(fields|sort|limit|offset|search|filter(\[[\w-]+\])+|deep(\[[\w-]+\])+)$/
const ASSET_PARAM = /^(width|height|fit|quality|format|key)$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ITEMS_BYTES = 4 * 1024 * 1024, MAX_ASSET_BYTES = 6 * 1024 * 1024

export function cmsSnapshotOrigin(env) {
  const raw = env.CMS_SNAPSHOT_ORIGIN || env.CMS_PUBLIC_URL || (env.VITE_DIRECTUS_HOST ? `https://${env.VITE_DIRECTUS_HOST}` : '')
  if (!raw) return null
  const u = new URL(raw)
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) throw new Error('CMS_SNAPSHOT_ORIGIN must be a credential-free http(s) origin')
  return u.origin
}

/** canonical request key: path + params in a stable order (no other input reaches the CMS) */
export function canonicalQuery(search, allowed) {
  const params = new URLSearchParams(search)
  const pairs = []
  for (const [k, v] of params) {
    if (!allowed.test(k) || v.length > 1500) return null
    pairs.push([k, v])
  }
  if (pairs.length > 40) return null
  pairs.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
  return new URLSearchParams(pairs).toString()
}

export function cmsSnapshotRoutes({ pool, origin, fetchImpl = (...a) => fetch(...a), timeoutMs = 3000, now = () => Date.now() }) {
  const router = Router()
  const memo = new Map() /* key → {at, hash}: avoids rewriting unchanged content */

  async function fetchLive(path, max) {
    if (!origin) return null
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const r = await fetchImpl(origin + path, { signal: ctrl.signal, headers: { accept: '*/*' } })
      if (!r.ok) return null
      const buf = Buffer.from(await r.arrayBuffer())
      if (buf.length > max) return null
      return { buf, type: r.headers.get('content-type') || 'application/octet-stream' }
    } catch { return null } finally { clearTimeout(timer) }
  }

  async function serve(req, res, key, collection, max, validate) {
    const live = await fetchLive('/' + key, max)
    if (live && validate(live)) {
      const hash = crypto.createHash('sha256').update(live.buf).digest('hex')
      if (memo.get(key)?.hash !== hash) {
        await pool.query(
          `INSERT INTO cms_snapshot (key, collection, content_type, body, sha256, fetched_at) VALUES ($1,$2,$3,$4,$5,now())
           ON CONFLICT (key) DO UPDATE SET content_type=EXCLUDED.content_type, body=EXCLUDED.body, sha256=EXCLUDED.sha256, fetched_at=now()
             WHERE cms_snapshot.sha256 IS DISTINCT FROM EXCLUDED.sha256`,
          [key, collection, live.type, live.buf, hash]).catch(e => console.warn('[cms-snapshot] store failed', e.message))
        memo.set(key, { at: now(), hash })
      }
      res.set({ 'Content-Type': live.type, 'Cache-Control': 'no-store', 'X-Openfund-Content': 'live' }).send(live.buf)
      return
    }
    const snap = (await pool.query(`SELECT content_type, body, fetched_at, sha256 FROM cms_snapshot WHERE key=$1`, [key])).rows[0]
    if (!snap) return res.status(503).set('Cache-Control', 'no-store').json({ error: 'content_unavailable' })
    res.set({ 'Content-Type': snap.content_type, 'Cache-Control': 'no-store', 'X-Openfund-Content': 'snapshot',
      'X-Openfund-Content-Fetched-At': new Date(snap.fetched_at).toISOString(), 'X-Openfund-Content-Sha256': snap.sha256 }).send(snap.body)
  }

  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
  const search = req => req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?') + 1) : ''
  router.get('/items/:collection', wrap(async (req, res) => {
    const c = req.params.collection
    if (!CMS_COLLECTIONS.has(c)) return res.status(404).json({ error: 'not_found' })
    const q = canonicalQuery(search(req), PARAM)
    if (q === null) return res.status(400).json({ error: 'invalid_query' })
    /* only a Directus `{data: …}` document is stored: an error page never replaces good content */
    const isData = live => { try { return JSON.parse(live.buf.toString('utf8'))?.data != null } catch { return false } }
    await serve(req, res, `items/${c}${q ? '?' + q : ''}`, c, MAX_ITEMS_BYTES, isData)
  }))
  router.get('/assets/:id', wrap(async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'not_found' })
    const q = canonicalQuery(search(req), ASSET_PARAM)
    if (q === null) return res.status(400).json({ error: 'invalid_query' })
    await serve(req, res, `assets/${req.params.id.toLowerCase()}${q ? '?' + q : ''}`, 'directus_files', MAX_ASSET_BYTES, () => true)
  }))
  return router
}
