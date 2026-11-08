import { useEffect, useMemo, useState } from 'react'
import {
  fetchCmsFaqHub, fetchCmsLearningLibrary, fetchCmsReferral, fetchCmsToolCopy,
  type CmsFaqHub, type CmsLearningLibrary,
} from './client'
import { faqCategories, faqItems } from './seed/faqSiteContent'
import { pathA } from './seed/learning/pathA'
import { pathB } from './seed/learning/pathB'
import { pathC } from './seed/learning/pathC'
import { pathD } from './seed/learning/pathD'
import { pathE } from './seed/learning/pathE'
import { glossaryTerms } from './seed/learning/glossary'
import { referralContent } from './seed/referralContent'
import { toolsCopy } from './seed/toolsCopy'
import { buildToolSpecs } from '../data/toolCatalog'
import type {
  FaqCategoryContent, FaqItemContent, GlossaryTermContent, LearningPathContent,
  LessonContent, LinkTarget, ReferralContent, ToolCopy, ToolSpec,
} from './contentTypes'

/**
 * The website content layer.
 *
 * Every section renders from the CMS when Directus is reachable and has
 * published the section, and otherwise from the repository seeds — the same
 * source that `seed_website_content.mjs` uploads. The `source` map records
 * which is in play per section so the UI can say so honestly instead of
 * pretending a bundled copy is live editorial content.
 */
export interface SiteLibrary {
  faqCategories: FaqCategoryContent[]
  faqItems: FaqItemContent[]
  paths: LearningPathContent[]
  glossary: GlossaryTermContent[]
  tools: ToolSpec[]
  referral: ReferralContent
  referralProgramState: 'prelaunch' | 'live'
  source: { faq: 'cms' | 'bundled'; learn: 'cms' | 'bundled'; tools: 'cms' | 'bundled'; referral: 'cms' | 'bundled' }
}

export const bundledLibrary: SiteLibrary = {
  faqCategories,
  faqItems,
  paths: [pathA, pathB, pathC, pathD, pathE].sort((a, b) => a.sort - b.sort),
  glossary: glossaryTerms,
  tools: buildToolSpecs(toolsCopy),
  referral: referralContent,
  referralProgramState: 'prelaunch',
  source: { faq: 'bundled', learn: 'bundled', tools: 'bundled', referral: 'bundled' },
}

/** the union of a CMS response and the bundled seeds, with source flags */
function mergeLibrary(faq: CmsFaqHub | null, learn: CmsLearningLibrary | null, tools: Record<string, ToolCopy> | null, referral: { programState: 'prelaunch' | 'live'; content: ReferralContent } | null): SiteLibrary {
  const cmsTools = tools
  return {
    faqCategories: faq?.categories ?? bundledLibrary.faqCategories,
    faqItems: faq?.items ?? bundledLibrary.faqItems,
    paths: learn?.paths ?? bundledLibrary.paths,
    glossary: learn?.glossary ?? bundledLibrary.glossary,
    tools: cmsTools ? buildToolSpecs(cmsTools) : bundledLibrary.tools,
    referral: referral?.content ?? bundledLibrary.referral,
    referralProgramState: referral?.programState ?? 'prelaunch',
    source: {
      faq: faq ? 'cms' : 'bundled',
      learn: learn ? 'cms' : 'bundled',
      tools: cmsTools ? 'cms' : 'bundled',
      referral: referral ? 'cms' : 'bundled',
    },
  }
}

let cached: Promise<SiteLibrary> | null = null

/** one-shot loader; shares a promise across components on the same page */
export function loadSiteLibrary(refresh = false): Promise<SiteLibrary> {
  if (refresh) cached = null
  if (!cached) {
    cached = Promise.all([
      fetchCmsFaqHub().catch(() => null),
      fetchCmsLearningLibrary().catch(() => null),
      fetchCmsToolCopy().catch(() => null),
      fetchCmsReferral().catch(() => null),
    ]).then(([faq, learn, tools, referral]) => mergeLibrary(faq, learn, tools, referral))
  }
  return cached
}

export interface SiteLibraryState {
  loading: boolean
  library: SiteLibrary
}

/** React hook: bundled content renders instantly, CMS upgrades arrive once */
export function useSiteLibrary(): SiteLibraryState {
  const [library, setLibrary] = useState<SiteLibrary>(bundledLibrary)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    void loadSiteLibrary().then(merged => { if (active) { setLibrary(merged); setLoading(false) } })
    return () => { active = false }
  }, [])
  return { loading, library }
}

/* ---------------------------- selectors ---------------------------- */

export function pathBySlug(library: SiteLibrary, slug: string | undefined): LearningPathContent | null {
  return library.paths.find(path => path.slug === slug) || null
}

export interface LessonContext {
  path: LearningPathContent
  lesson: LessonContent
  prev: LessonContent | null
  next: LessonContent | null
}

export function lessonBySlug(library: SiteLibrary, slug: string | undefined): LessonContext | null {
  for (const path of library.paths) {
    const index = path.lessons.findIndex(lesson => lesson.slug === slug)
    if (index === -1) continue
    return {
      path,
      lesson: path.lessons[index],
      prev: index > 0 ? path.lessons[index - 1] : null,
      next: index < path.lessons.length - 1 ? path.lessons[index + 1] : null,
    }
  }
  return null
}

export function glossaryBySlug(library: SiteLibrary, slug: string | undefined): GlossaryTermContent | null {
  return library.glossary.find(term => term.slug === slug) || null
}

export function toolBySlug(library: SiteLibrary, slug: string | undefined): ToolSpec | null {
  return library.tools.find(tool => tool.slug === slug) || null
}

export function faqCountByCategory(library: SiteLibrary): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of library.faqItems) counts.set(item.category, (counts.get(item.category) || 0) + 1)
  return counts
}

/** resolve a LinkTarget to a hash route for the current locale */
export function targetHref(target: LinkTarget, locale: 'fa' | 'en'): string | null {
  switch (target.kind) {
    case 'tool': return `/${locale}/tools/${target.slug}`
    case 'lesson': return `/${locale}/learn/lessons/${target.slug}`
    case 'path': return `/${locale}/learn/paths/${target.slug}`
    case 'glossary': return `/${locale}/learn/glossary/${target.slug}`
    case 'page': return `/${locale}/${target.slug}`
    case 'terminal': return `/${locale}/${target.product}/trade`
    default: return null
  }
}

/** link target lookup used by "related" sidebars */
export function findTargetLabel(library: SiteLibrary, target: LinkTarget): Record<'fa' | 'en', string> | null {
  if (target.kind === 'tool') return toolBySlug(library, target.slug)?.name ?? null
  if (target.kind === 'lesson') {
    const lesson = lessonBySlug(library, target.slug)?.lesson
    return lesson ? lesson.title : null
  }
  if (target.kind === 'glossary') return glossaryBySlug(library, target.slug)?.term ?? null
  if (target.kind === 'path') return pathBySlug(library, target.slug)?.title ?? null
  return null
}

/** total lesson minutes across paths, for the landing hero */
export function lessonMinutes(library: SiteLibrary): number {
  return useMemoTotal(library)
}

function useMemoTotal(library: SiteLibrary): number {
  return library.paths.reduce((sum, path) => sum + path.lessons.reduce((s, l) => s + l.minutes, 0), 0)
}
