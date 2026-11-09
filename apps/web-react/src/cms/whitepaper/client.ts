/* ============================================================
   Whitepaper content layer — Directus first, repository edition second.

   Public reads only (no token): the public policy exposes published rows
   of whitepaper_documents / _chapters / _datasets / _references and the
   translation rows of published parents. Each part is validated by
   ./schema.ts. An invalid or incomplete CMS edition is never mixed into
   the page: the document text falls back to the bundled edition as a
   whole, and the source of each part is reported to the page.
   ============================================================ */
import { useEffect, useState } from 'react'
import { getCmsJson } from '../client'
import { bundledWhitepaper } from '../seed/whitepaper'
import { asArray, pair, pairBlocks, referencedKeys, InvalidContent } from './schema'
import type { Bi, WpChapter, WpDataset, WpDatasetPoint, WpDocument, WpReference, Whitepaper } from './types'

export const WHITEPAPER_SLUG = 'openfund-whitepaper'
/** chapters an edition must keep: the disclosures may never silently disappear */
export const REQUIRED_CHAPTERS = ['disclosures', 'references'] as const

type Row = { translations?: Array<{ language_code: string } & Record<string, unknown>> | null } & Record<string, unknown>
type Locale = 'fa' | 'en'

function byLocale(row: Row): Record<Locale, Record<string, unknown>> {
  const out: Record<Locale, Record<string, unknown>> = { fa: {}, en: {} }
  for (const t of row.translations || []) {
    if (t.language_code === 'fa' || t.language_code === 'en') out[t.language_code] = t
  }
  return out
}
const bi = (l: Record<Locale, Record<string, unknown>>, key: string, optional = false): Bi | undefined =>
  pair(optional ? 'bi?' : 'bi', l.fa[key], l.en[key], key) as Bi | undefined
const ISO = /^\d{4}-\d{2}-\d{2}$/
const isoDay = (v: unknown) => (typeof v === 'string' && ISO.test(v.slice(0, 10)) ? v.slice(0, 10) : null)
const KEY = /^[a-z0-9][a-z0-9-]{0,63}$/

export function parseDocument(row: Row | null | undefined): WpDocument | null {
  if (!row) return null
  try {
    const l = byLocale(row)
    const publishedOn = isoDay(row.published_on), updatedOn = isoDay(row.updated_on) || publishedOn
    if (!publishedOn || typeof row.version !== 'string' || !row.version.trim()) return null
    return {
      slug: String(row.slug), version: row.version.trim(), publishedOn, updatedOn: updatedOn!,
      title: bi(l, 'title')!, subtitle: bi(l, 'subtitle')!, abstract: bi(l, 'abstract')!,
      revisionNote: bi(l, 'revision_note', true) || { fa: '', en: '' },
      seoTitle: bi(l, 'seo_title', true) || bi(l, 'title')!, seoDescription: bi(l, 'seo_description', true) || bi(l, 'abstract')!,
    }
  } catch (e) { if (e instanceof InvalidContent) return null; throw e }
}

export function parseChapters(rows: Row[] | null | undefined): WpChapter[] | null {
  if (!rows?.length) return null
  const chapters: WpChapter[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const slug = String(row.slug || '')
    if (!KEY.test(slug) || seen.has(slug)) return null
    seen.add(slug)
    const l = byLocale(row)
    const blocks = pairBlocks(l.fa.blocks, l.en.blocks)
    if (!blocks) return null
    try {
      chapters.push({ slug, sort: Number(row.sort) || 0, kicker: bi(l, 'kicker')!, title: bi(l, 'title')!, summary: bi(l, 'summary')!, blocks })
    } catch (e) { if (e instanceof InvalidContent) return null; throw e }
  }
  if (REQUIRED_CHAPTERS.some(slug => !seen.has(slug))) return null
  return chapters.sort((a, b) => a.sort - b.sort)
}

export function parseDatasets(rows: Row[] | null | undefined): WpDataset[] | null {
  if (!rows?.length) return null
  const out: WpDataset[] = []
  try {
    for (const row of rows) {
      const key = String(row.key || ''), kind = row.kind, unit = row.unit
      if (!KEY.test(key) || !['waterfall', 'bars', 'stacked'].includes(String(kind)) || !['usd', 'pct'].includes(String(unit))) return null
      const data = (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) as { segments?: unknown; points?: unknown } | null
      const l = byLocale(row)
      const labels = { fa: (l.fa.labels || {}) as Record<string, Record<string, string>>, en: (l.en.labels || {}) as Record<string, Record<string, string>> }
      const label = (group: 'points' | 'segments', k: string) => pair('bi', labels.fa?.[group]?.[k], labels.en?.[group]?.[k], `${key}.${group}.${k}`) as Bi
      const segmentKeys = asArray(data?.segments).map(String)
      const points: WpDatasetPoint[] = asArray(data?.points).map(raw => {
        const p = raw as Record<string, unknown>
        const pk = String(p.key || '')
        if (!KEY.test(pk)) throw new InvalidContent(`${key}.point`)
        const point: WpDatasetPoint = { key: pk, label: label('points', pk) }
        if (kind === 'stacked') {
          const values = asArray(p.values).map(Number)
          if (values.length !== segmentKeys.length || values.some(v => !Number.isFinite(v))) throw new InvalidContent(`${key}.${pk}.values`)
          point.values = values
        } else {
          const value = Number(p.value)
          if (!Number.isFinite(value)) throw new InvalidContent(`${key}.${pk}.value`)
          point.value = value
          if (kind === 'waterfall') {
            if (!['start', 'delta', 'subtotal'].includes(String(p.role))) throw new InvalidContent(`${key}.${pk}.role`)
            point.role = p.role as WpDatasetPoint['role']
          }
        }
        return point
      })
      if (!points.length || (kind === 'stacked' && !segmentKeys.length)) return null
      out.push({
        key, kind: kind as WpDataset['kind'], unit: unit as WpDataset['unit'],
        title: bi(l, 'title')!, caption: bi(l, 'caption')!, note: bi(l, 'note')!,
        segments: kind === 'stacked' ? segmentKeys.map(k => ({ key: k, label: label('segments', k) })) : undefined,
        points, sources: asArray(row.sources).map(String).filter(s => KEY.test(s)),
      })
    }
  } catch (e) { if (e instanceof InvalidContent || e instanceof SyntaxError) return null; throw e }
  return out
}

export function parseReferences(rows: Row[] | null | undefined): WpReference[] | null {
  if (!rows?.length) return null
  const out: WpReference[] = []
  try {
    for (const row of rows) {
      const key = String(row.key || ''), url = String(row.url || '')
      let https = false
      try { https = new URL(url).protocol === 'https:' } catch { /* invalid */ }
      const accessed = isoDay(row.accessed_on)
      if (!KEY.test(key) || !https || !accessed || !['repository', 'documentation', 'release', 'provider', 'industry'].includes(String(row.kind))) return null
      const l = byLocale(row)
      out.push({
        key, sort: Number(row.sort) || 0, kind: row.kind as WpReference['kind'],
        title: String(row.title || '').trim() || url, publisher: String(row.publisher || '').trim(), url,
        published: typeof row.published_on === 'string' && row.published_on.trim() ? row.published_on.trim() : undefined,
        accessed, note: bi(l, 'note')!,
      })
    }
  } catch (e) { if (e instanceof InvalidContent) return null; throw e }
  return out.sort((a, b) => a.sort - b.sort)
}

/** the datasets/references that chapters point at must all exist */
export function datasetKeys(chapters: WpChapter[]): string[] {
  return chapters.flatMap(c => c.blocks.flatMap(b => b.type === 'chart' ? [b.dataset] : []))
}
export function referenceKeys(chapters: WpChapter[], datasets: WpDataset[]): string[] {
  return [...chapters.flatMap(c => referencedKeys(c.blocks)), ...datasets.flatMap(d => d.sources || [])]
}

const DOC_FIELDS = 'slug,version,published_on,updated_on,translations.language_code,translations.title,translations.subtitle,'
  + 'translations.abstract,translations.revision_note,translations.seo_title,translations.seo_description'
const CHAPTER_FIELDS = 'slug,sort,translations.language_code,translations.kicker,translations.title,translations.summary,translations.blocks'
const DATASET_FIELDS = 'key,kind,unit,data,sources,translations.language_code,translations.title,translations.caption,translations.note,translations.labels'
const REFERENCE_FIELDS = 'key,sort,kind,title,publisher,url,published_on,accessed_on,translations.language_code,translations.note'

export async function fetchCmsWhitepaper(): Promise<Whitepaper> {
  const bundled = bundledWhitepaper
  const [docRows, chapterRows, datasetRows, referenceRows] = await Promise.all([
    getCmsJson<Row[]>(`/items/whitepaper_documents?fields=${DOC_FIELDS}&filter[slug][_eq]=${WHITEPAPER_SLUG}&filter[status][_eq]=published&limit=1`),
    getCmsJson<Row[]>(`/items/whitepaper_chapters?fields=${CHAPTER_FIELDS}&filter[status][_eq]=published&filter[document][slug][_eq]=${WHITEPAPER_SLUG}&sort=sort&limit=-1`),
    getCmsJson<Row[]>(`/items/whitepaper_datasets?fields=${DATASET_FIELDS}&filter[status][_eq]=published&limit=-1`),
    getCmsJson<Row[]>(`/items/whitepaper_references?fields=${REFERENCE_FIELDS}&filter[status][_eq]=published&sort=sort&limit=-1`),
  ]).catch(() => [null, null, null, null] as const)

  const document = parseDocument(docRows?.[0])
  const chapters = document ? parseChapters(chapterRows) : null
  const text = document && chapters ? { document, chapters, source: 'cms' as const } : { document: bundled.document, chapters: bundled.chapters, source: 'bundled' as const }

  const cmsDatasets = parseDatasets(datasetRows)
  const datasetsOk = cmsDatasets && datasetKeys(text.chapters).every(k => cmsDatasets.some(d => d.key === k))
  const datasets = datasetsOk ? cmsDatasets : bundled.datasets

  const cmsReferences = parseReferences(referenceRows)
  const referencesOk = cmsReferences && referenceKeys(text.chapters, datasets).every(k => cmsReferences.some(r => r.key === k))
  const references = referencesOk ? cmsReferences : bundled.references

  if (import.meta.env?.DEV && (docRows || chapterRows) && text.source === 'bundled') console.warn('Whitepaper CMS edition rejected by validation; showing the repository edition.')
  return {
    document: text.document, chapters: text.chapters, datasets, references,
    source: { document: text.source, datasets: datasetsOk ? 'cms' : 'bundled', references: referencesOk ? 'cms' : 'bundled' },
  }
}

let cached: Promise<Whitepaper> | null = null
/** bundled edition renders immediately (SEO-readable, no layout jump); a valid CMS edition replaces it once */
export function useWhitepaper(): Whitepaper {
  const [paper, setPaper] = useState<Whitepaper>(bundledWhitepaper)
  useEffect(() => {
    let active = true
    cached ||= fetchCmsWhitepaper().catch(() => bundledWhitepaper)
    void cached.then(next => { if (active) setPaper(next) })
    return () => { active = false }
  }, [])
  return paper
}
