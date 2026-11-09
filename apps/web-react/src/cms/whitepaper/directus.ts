/* Repository edition → Directus rows (one translation row per locale).
   Shared by apps/backstage/scripts/seed_whitepaper_content.mjs and the
   tests, which prove that seeded rows parse back to the same edition. */
import { localizeBlock } from './schema'
import type { WpChapter, WpDataset, WpDocument, WpReference } from './types'

const LOCALES = ['fa', 'en'] as const

export function documentRow(doc: WpDocument, status = 'published') {
  return {
    slug: doc.slug, version: doc.version, published_on: doc.publishedOn, updated_on: doc.updatedOn, status,
    translations: LOCALES.map(l => ({
      language_code: l, title: doc.title[l], subtitle: doc.subtitle[l], abstract: doc.abstract[l],
      revision_note: doc.revisionNote[l], seo_title: doc.seoTitle[l], seo_description: doc.seoDescription[l],
    })),
  }
}

export function chapterRow(chapter: WpChapter, documentId: number | string | null, status = 'published') {
  return {
    slug: chapter.slug, sort: chapter.sort, status, document: documentId,
    translations: LOCALES.map(l => ({
      language_code: l, kicker: chapter.kicker[l], title: chapter.title[l], summary: chapter.summary[l],
      blocks: chapter.blocks.map(b => localizeBlock(b, l)),
    })),
  }
}

export function datasetRow(dataset: WpDataset, sort: number, status = 'published') {
  return {
    key: dataset.key, kind: dataset.kind, unit: dataset.unit, sort, status,
    data: {
      segments: (dataset.segments || []).map(s => s.key),
      points: dataset.points.map(p => ({ key: p.key, ...(p.value !== undefined ? { value: p.value } : {}), ...(p.values ? { values: p.values } : {}), ...(p.role ? { role: p.role } : {}) })),
    },
    sources: dataset.sources || [],
    translations: LOCALES.map(l => ({
      language_code: l, title: dataset.title[l], caption: dataset.caption[l], note: dataset.note[l],
      labels: {
        points: Object.fromEntries(dataset.points.map(p => [p.key, p.label[l]])),
        segments: Object.fromEntries((dataset.segments || []).map(s => [s.key, s.label[l]])),
      },
    })),
  }
}

export function referenceRow(ref: WpReference, status = 'published') {
  return {
    key: ref.key, sort: ref.sort, kind: ref.kind, title: ref.title, publisher: ref.publisher, url: ref.url,
    published_on: ref.published || null, accessed_on: ref.accessed, status,
    translations: LOCALES.map(l => ({ language_code: l, note: ref.note[l] })),
  }
}
