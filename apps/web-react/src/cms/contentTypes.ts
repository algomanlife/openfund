/**
 * Shared content contracts for the website expansion (FAQ, Growth Partner,
 * Tools Center, Learning Center).
 *
 * These types are the single source of truth for repo-authored content
 * (`src/cms/seed/**`) and for the Directus payload shapes produced by
 * `apps/backstage/scripts/seed_website_content.mjs`. Every content field is
 * bilingual by construction: a `Localized` value always carries `fa` and `en`.
 *
 * Validation rules (enforced by the CMS client and the content tests):
 *  - `key` / `slug` values are stable, lowercase ASCII and never change,
 *    because they are used for URLs, anchors and CMS natural-key matching
 *  - paired list fields (`items`, `rows`, `blocks`) must be the same length
 *    in both locales, matched by index
 *  - `formula` / `expr` values are locale-neutral ASCII math
 */
export type { Locale, Localized } from '../features/information/content'

/** Where an internal link points. Renderers resolve the locale prefix. */
export type LinkTarget =
  | { kind: 'tool'; slug: string }
  | { kind: 'lesson'; slug: string }
  | { kind: 'path'; slug: string }
  | { kind: 'glossary'; slug: string }
  | { kind: 'page'; slug: 'home' | 'challenges' | 'markets' | 'rulebook' | 'transparency' | 'faq' | 'referral' | 'tools' | 'learn' }
  | { kind: 'terminal'; product: 'prop' | 'perpetual' }

export interface LinkRef {
  target: LinkTarget
  /** Repeated per locale because Directus translation rows cannot share it. */
  label: Record<'fa' | 'en', string>
}

/* ------------------------------------------------------------------ FAQ -- */

export interface FaqCategoryContent {
  key: string
  sort: number
  /** short ASCII glyph token resolved by the FAQ renderer's icon map */
  icon: 'start' | 'payout' | 'rules' | 'partner' | 'terminal' | 'verify' | 'general'
  label: Record<'fa' | 'en', string>
  description: Record<'fa' | 'en', string>
}

export interface FaqItemContent {
  key: string
  category: string
  sort: number
  question: Record<'fa' | 'en', string>
  answer: Record<'fa' | 'en', string>
  links?: LinkRef[]
}

/* ------------------------------------------------------- Learning Center -- */

export type LessonBlock =
  | { type: 'p'; text: Record<'fa' | 'en', string> }
  | { type: 'h2'; text: Record<'fa' | 'en', string> }
  | { type: 'h3'; text: Record<'fa' | 'en', string> }
  | { type: 'ul'; items: Array<Record<'fa' | 'en', string>> }
  | { type: 'ol'; items: Array<Record<'fa' | 'en', string>> }
  | { type: 'note'; text: Record<'fa' | 'en', string> }
  | { type: 'formula'; expr: string; text?: Record<'fa' | 'en', string> }
  | { type: 'terms'; items: Array<{ term: Record<'fa' | 'en', string>; text: Record<'fa' | 'en', string> }> }
  | { type: 'table'; caption: Record<'fa' | 'en', string>; head: Array<Record<'fa' | 'en', string>>; rows: Array<Array<Record<'fa' | 'en', string>>> }

export interface LessonContent {
  slug: string
  path: string
  sort: number
  minutes: number
  status: 'published' | 'draft'
  title: Record<'fa' | 'en', string>
  summary: Record<'fa' | 'en', string>
  /** what the reader can do after this lesson */
  takeaways: Array<Record<'fa' | 'en', string>>
  /** glossary term slugs referenced by the lesson */
  glossary: string[]
  /** tool slugs that put the lesson into practice */
  tools: string[]
  blocks: LessonBlock[]
}

export interface LearningPathContent {
  key: string
  slug: string
  sort: number
  level: 'foundation' | 'practitioner' | 'advanced'
  eyebrow: Record<'fa' | 'en', string>
  title: Record<'fa' | 'en', string>
  summary: Record<'fa' | 'en', string>
  outcomes: Array<Record<'fa' | 'en', string>>
  lessons: LessonContent[]
}

export interface GlossaryTermContent {
  slug: string
  sort: number
  term: Record<'fa' | 'en', string>
  /** one-line definition used in cards and search results */
  short: Record<'fa' | 'en', string>
  definition: Record<'fa' | 'en', string>
  lessons: string[]
  tool?: string
}

/* ------------------------------------------------------------ Tools Center -- */

export type ToolFieldKind = 'number' | 'integer' | 'percent' | 'currency' | 'select' | 'list' | 'text' | 'file'

export interface ToolFieldSpec {
  key: string
  kind: ToolFieldKind
  label: Record<'fa' | 'en', string>
  unit?: Record<'fa' | 'en', string>
  help?: Record<'fa' | 'en', string>
  min?: number
  max?: number
  step?: number
  default?: number
  options?: Array<{ value: string; label: Record<'fa' | 'en', string> }>
}

export type ToolResultFormat = 'currency' | 'percent' | 'number' | 'ratio' | 'signed' | 'text'

export interface ToolResultSpec {
  key: string
  label: Record<'fa' | 'en', string>
  format: ToolResultFormat
  /** decimals for `number` / `ratio`, defaults to 2 */
  precision?: number
  note?: Record<'fa' | 'en', string>
  /** secondary results are rendered in a subdued list */
  emphasis?: boolean
}

export interface ToolSpec {
  slug: string
  category: 'sizing' | 'risk' | 'analysis'
  sort: number
  name: Record<'fa' | 'en', string>
  tagline: Record<'fa' | 'en', string>
  about: Record<'fa' | 'en', string>
  inputs: ToolFieldSpec[]
  results: ToolResultSpec[]
  /** ASCII math, identical in both locales */
  formula: string
  method: Record<'fa' | 'en', string>
  assumptions: Array<Record<'fa' | 'en', string>>
  limitations: Record<'fa' | 'en', string>
  glossary: string[]
  lessons: string[]
}

/** Bilingual prose only — the numeric contract of a tool stays in code. */
export interface ToolCopy {
  name: Record<'fa' | 'en', string>
  tagline: Record<'fa' | 'en', string>
  about: Record<'fa' | 'en', string>
  method: Record<'fa' | 'en', string>
  assumptions: Array<Record<'fa' | 'en', string>>
  limitations: Record<'fa' | 'en', string>
}

/* ------------------------------------------- calculation engine contracts -- */

export type ToolErrorCode = 'required' | 'invalid' | 'positive' | 'non_negative' | 'min' | 'max' | 'range' | 'order' | 'empty' | 'unbalanced'

export interface ToolError {
  /** input field key, or undefined for a whole-form problem */
  field?: string
  code: ToolErrorCode
  params?: Record<string, string | number>
}

export interface ToolSuccess {
  ok: true
  values: Record<string, number | string | null>
  /** optional extra lines rendered under the results (e.g. CSV warnings) */
  notes?: string[]
}

export interface ToolFailure {
  ok: false
  errors: ToolError[]
}

export type ToolOutcome = ToolSuccess | ToolFailure

/* --------------------------------------------------------- Growth Partner -- */

export interface ReferralBenefit {
  icon: 'link' | 'chart' | 'wallet' | 'shield' | 'school' | 'handshake'
  title: Record<'fa' | 'en', string>
  text: Record<'fa' | 'en', string>
}

export interface ReferralStage {
  title: Record<'fa' | 'en', string>
  text: Record<'fa' | 'en', string>
}

export interface ReferralSection {
  key: string
  title: Record<'fa' | 'en', string>
  body: Array<Record<'fa' | 'en', string>>
  items?: Array<Record<'fa' | 'en', string>>
  note?: Record<'fa' | 'en', string>
}

export interface ReferralContent {
  hero: {
    eyebrow: Record<'fa' | 'en', string>
    title: Record<'fa' | 'en', string>
    accent: Record<'fa' | 'en', string>
    intro: Record<'fa' | 'en', string>
  }
  statusNotice: Record<'fa' | 'en', string>
  benefits: ReferralBenefit[]
  stages: ReferralStage[]
  sections: ReferralSection[]
  dashboard: {
    title: Record<'fa' | 'en', string>
    intro: Record<'fa' | 'en', string>
    /** capability cards: live now vs pending, never implied */
    columns: Array<{ state: 'live' | 'pending'; title: Record<'fa' | 'en', string>; text: Record<'fa' | 'en', string> }>
  }
  faq: FaqItemContent[]
  /** commercial terms that need an owner decision before the program can go live */
  pendingDecisions: Array<{ title: Record<'fa' | 'en', string>; text: Record<'fa' | 'en', string> }>
  cta: {
    title: Record<'fa' | 'en', string>
    text: Record<'fa' | 'en', string>
    primary: Record<'fa' | 'en', string>
    secondary: Record<'fa' | 'en', string>
  }
}
