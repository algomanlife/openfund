import { backendUrl } from '../../session/useOpenfundSession'
import type { AppLocale } from '../../i18n/locales'
import { labels, tx } from '../information/content'
import { MEGA_DESCRIPTIONS } from '../navigation/megaMenu'
import { EDITORIAL_ROUTES } from '../../cms/editorialRoutes'
import { maskQuery, normalizeText, synonymLookup, type SearchEntry } from '../../../../../packages/site-search/index.mjs'

/* Site search data (ADR 0052). The index is loaded lazily, the first time
   the palette or the results page opens, from GET /search/index (published
   content only, built per region). When the backend cannot answer, the
   bundled fallback holds the public pages only (menu labels and
   descriptions from the web app itself), never invented content. */

export interface SearchIndex {
  locale: AppLocale
  entries: SearchEntry[]
  synonyms: Map<string, Set<string>>
  suggestions: { label: string; url: string }[]
  fallback: boolean
}

const cache = new Map<AppLocale, Promise<SearchIndex>>()

/** pages only, from the bundled menu labels: the offline fallback */
export function bundledIndex(locale: AppLocale): SearchIndex {
  const entries: SearchEntry[] = []
  const table = labels as Record<string, { fa: string; en: string }>
  const descriptions = MEGA_DESCRIPTIONS as Record<string, { fa: string; en: string }>
  for (const route of EDITORIAL_ROUTES) {
    const m = /^\/:locale\/([a-z0-9/-]+)$/.exec(route.path)
    const key = m?.[1]
    if (!key || key === 'search') continue
    const label = table[key] || (route.view === key ? table[route.view] : undefined)
    if (!label) continue
    entries.push({ id: `page:${key}`, kind: 'page', icon: key, title: tx(locale, label), snippet: descriptions[key] ? tx(locale, descriptions[key]) : '', url: `/${locale}/${key}`, keywords: key.split(/[/-]/), boost: 3 })
  }
  const suggest = ['challenges', 'faq', 'rulebook', 'learn'].filter(k => table[k]).map(k => ({ label: tx(locale, table[k]), url: `/${locale}/${k}` }))
  return { locale, entries, synonyms: new Map(), suggestions: suggest, fallback: true }
}

export function loadSearchIndex(locale: AppLocale): Promise<SearchIndex> {
  const hit = cache.get(locale)
  if (hit) return hit
  const bundled = bundledIndex(locale)
  const request = fetch(`${backendUrl()}/search/index?locale=${encodeURIComponent(locale)}`, { credentials: 'omit' })
    .then(async r => {
      if (!r.ok) throw new Error(`search index ${r.status}`)
      const data = await r.json() as { entries?: SearchEntry[]; synonyms?: string[][]; suggestions?: { label: string; url: string }[] }
      const entries = Array.isArray(data.entries) ? data.entries.filter(e => e && typeof e.url === 'string' && e.url.startsWith(`/${locale}/`)) : []
      if (!entries.length) throw new Error('empty search index')
      const suggestions = Array.isArray(data.suggestions) && data.suggestions.length ? data.suggestions.filter(s => s.url?.startsWith(`/${locale}/`)) : bundled.suggestions
      return { locale, entries, synonyms: synonymLookup(data.synonyms), suggestions, fallback: false }
    })
    .catch(() => { cache.delete(locale); return bundled })
  cache.set(locale, request)
  return request
}

/* ---- recent searches (this browser only; storage may be unavailable) ---- */
const RECENT_KEY = 'of.search.recent'
export function recentSearches(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(0, 6) : []
  } catch { return [] }
}
export function rememberSearch(query: string) {
  const q = query.trim().slice(0, 80)
  if (!q || maskQuery(q) !== normalizeText(q)) return /* never keep e-mails, wallets or phone numbers */
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...recentSearches().filter(r => r !== q)].slice(0, 6))) } catch { /* optional */ }
}
export function clearRecentSearches() { try { localStorage.removeItem(RECENT_KEY) } catch { /* optional */ } }

/* ---- anonymous aggregate counts: locale, masked query, result count ---- */
const reported = new Set<string>()
export function reportSearch(locale: AppLocale, query: string, results: number) {
  const key = `${locale}:${normalizeText(query)}`
  if (!normalizeText(query) || reported.has(key)) return
  reported.add(key)
  send({ locale, type: 'search', query: query.slice(0, 200), results })
}
export function reportClick(locale: AppLocale, query: string) {
  if (normalizeText(query)) send({ locale, type: 'click', query: query.slice(0, 200) })
}
function send(body: Record<string, unknown>) {
  try {
    void fetch(`${backendUrl()}/search/events`, { method: 'POST', credentials: 'omit', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {})
  } catch { /* counts are optional */ }
}
