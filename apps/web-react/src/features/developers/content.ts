/* Developer documentation: the bundled, published-only fallback is built from
 * the repository source of truth (docs/developer-portal/sections.json, English)
 * and the Persian text in ./sections.fa.json. Directus rows in developer_docs
 * override it per section once an editor publishes them. */
import source from '../../../../../docs/developer-portal/sections.json'
import persian from './sections.fa.json'
import { getCmsJson } from '../../cms/client'

export type DocLocale = 'fa' | 'en' | 'ar' | 'ru' | 'zh-CN'
export interface DevDocSection {
  slug: string; section: string; sort: number; sourcePath: string; lastVerifiedCommit: string; lastVerifiedAt: string
  title: Partial<Record<DocLocale, string>> & { en: string }; body: Partial<Record<DocLocale, string>> & { en: string }
}
export const REPO_BLOB = 'https://github.com/algomanlife/openfund/blob/main/'
const fa = persian as Record<string, { title: string; body: string }>

export const bundledDeveloperDocs: DevDocSection[] = source.sections
  .filter(s => s.status === 'published')
  .map(s => ({
    slug: s.slug, section: s.section, sort: s.sort, sourcePath: s.source_path, lastVerifiedCommit: s.last_verified_commit, lastVerifiedAt: s.last_verified_at,
    title: { en: s.title, ...(fa[s.slug] ? { fa: fa[s.slug].title } : {}) }, body: { en: s.body, ...(fa[s.slug] ? { fa: fa[s.slug].body } : {}) },
  }))
  .sort((a, b) => a.sort - b.sort)

type Row = { slug: string; section?: string; sort?: number; source_path?: string; last_verified_commit?: string; last_verified_at?: string
  translations?: { language_code: string; title?: string; body?: string }[] }
const LOCALES: DocLocale[] = ['fa', 'en', 'ar', 'ru', 'zh-CN']
const SAFE_PATH = /^[\w./-]+$/

/** Published Directus rows merged over the bundled copy (null when Directus is unreachable). */
export async function fetchDeveloperDocs(): Promise<DevDocSection[] | null> {
  const rows = await getCmsJson<Row[]>('/items/developer_docs?fields=slug,section,sort,source_path,last_verified_commit,last_verified_at,translations.language_code,translations.title,translations.body&filter[status][_eq]=published&sort=sort&limit=-1')
  if (!rows) return null
  const bySlug = new Map(bundledDeveloperDocs.map(s => [s.slug, s]))
  for (const row of rows) {
    if (!row?.slug || !/^[a-z0-9-]{1,64}$/.test(row.slug)) continue
    const base = bySlug.get(row.slug)
    const title: DevDocSection['title'] = { ...(base?.title || { en: '' }) }, body: DevDocSection['body'] = { ...(base?.body || { en: '' }) }
    for (const t of row.translations || []) {
      if (!LOCALES.includes(t.language_code as DocLocale)) continue
      if (typeof t.title === 'string' && t.title.trim()) title[t.language_code as DocLocale] = t.title.trim()
      if (typeof t.body === 'string' && t.body.trim() && t.body.length < 40000) body[t.language_code as DocLocale] = t.body
    }
    if (!title.en || !body.en) continue
    bySlug.set(row.slug, {
      slug: row.slug, section: row.section || base?.section || 'getting-started', sort: Number(row.sort ?? base?.sort ?? 0),
      sourcePath: row.source_path && SAFE_PATH.test(row.source_path) ? row.source_path : base?.sourcePath || 'docs/README.md',
      lastVerifiedCommit: (row.last_verified_commit || base?.lastVerifiedCommit || '').slice(0, 40), lastVerifiedAt: (row.last_verified_at || base?.lastVerifiedAt || '').slice(0, 10),
      title, body,
    })
  }
  return [...bySlug.values()].sort((a, b) => a.sort - b.sort)
}
