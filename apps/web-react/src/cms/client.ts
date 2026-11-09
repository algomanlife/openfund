/**
 * Openfund CMS client — the runtime content layer (Directus, public read-only).
 *
 * The public website renders CONTENT from here and MARKET DATA from Gains
 * Network; the two never mix (see docs/backstage/README.md).
 *
 * Contract:
 *  - every fetch is typed and validated on arrival; invalid content is
 *    treated as unavailable (null) — never rendered and never replaced by
 *    fictional fallback content
 *  - only PUBLISHED/ACTIVE records are requested; drafts never reach the
 *    public API responses used here
 *  - results are cached for 60s (shared per browser tab) so ordinary
 *    navigation does not re-query Directus; content edits therefore appear
 *    on the next load/refetch WITHOUT a frontend rebuild
 *  - NO admin tokens ever live here — public endpoints only
 */
import type { ChallengePlan, LegacyPreset } from '../data/challengePlans'
import { assertPlansValid, serializeForLegacy } from '../data/challengePlans'
import { ADDED_LOCALES, attachCmsTranslation, localizeRecords } from '../i18n/localize'
import type { AddedLocale } from '../i18n/locales'
import type {
  FaqCategoryContent, FaqItemContent, GlossaryTermContent, LearningPathContent, LessonBlock,
  LessonContent, ReferralBenefit, ReferralContent, ReferralStage, ReferralSection, ToolCopy,
} from './contentTypes'
import type { LinkTarget } from './contentTypes'
import { publicRuntimeConfig } from '../config/runtime'

export interface CmsTranslations {
  landing: Record<string, string>
  landingFa: Record<string, string>
  terminal: Record<string, { fa: string; en: string }>
}

/* import.meta.env exists under Vite; plain Node (tests, seeds) must still load this module */
const ENV = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
function configuredCmsUrl(): string {
  const runtime = publicRuntimeConfig().cmsUrl
  const raw = runtime || (ENV?.PROD ? '' : ENV?.VITE_DIRECTUS_URL || 'http://localhost:8055')
  try {
    const url = new URL(raw)
    const localTest = typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname) && ['localhost', '127.0.0.1'].includes(url.hostname)
    if (!['http:', 'https:'].includes(url.protocol) || (ENV?.PROD && url.protocol !== 'https:' && !localTest) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('invalid origin')
    return url.origin
  } catch {
    if (ENV?.PROD) console.error('Openfund CMS configuration is missing or invalid: /react/runtime-config.js')
    return ''
  }
}
const TIMEOUT_MS = 4000
const CACHE_TTL = 20_000

export function directusUrl(): string {
  return configuredCmsUrl()
}

/* ---------------- tiny fetch + cache core ---------------- */
const cache = new Map<string, { at: number; value: unknown }>()

async function getJson<T>(path: string, timeout = TIMEOUT_MS): Promise<T | null> {
  const cached = cache.get(path)
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.value as T
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const origin = configuredCmsUrl()
    if (!origin) return null
    const res = await fetch(`${origin}${path}`, { signal: ctrl.signal })
    if (!res.ok) return null
    const json = await res.json() as { data: T }
    if (json?.data == null) return null
    cache.set(path, { at: Date.now(), value: json.data })
    return json.data
  } catch {
    return null /* Directus unavailable — caller renders an explicit error state */
  } finally {
    clearTimeout(timer)
  }
}

export function invalidateCmsCache(): void {
  cache.clear()
}

type Locale = 'fa' | 'en'
interface TranslatedRow { translations?: ReadonlyArray<{ language_code: string } & Record<string, unknown>> | null }

/* Directus rows for ar / ru / zh-CN (when editors add them) override the
   reviewed bundled translation of the English source; see i18n/localize. */
const ADDED_CODES = new Set<string>(ADDED_LOCALES)
const addedRows = new WeakMap<object, Partial<Record<AddedLocale, Record<string, unknown>>>>()
function attachAdded(record: object, rows: Partial<Record<AddedLocale, Record<string, unknown>>>, pickField?: string) {
  for (const [locale, values] of Object.entries(rows) as [AddedLocale, Record<string, unknown>][]) {
    attachCmsTranslation(record, locale, pickField === undefined ? values : values[pickField])
  }
}

/** flatten a Directus translations array into { fa, en } string records */
function localized(row: TranslatedRow): Record<Locale, Record<string, string>> {
  const out: Record<Locale, Record<string, string>> = { fa: {}, en: {} }
  const added: Partial<Record<AddedLocale, Record<string, unknown>>> = {}
  for (const t of row.translations || []) {
    const code = t.language_code
    const target = code === 'en' || code === 'fa' ? out[code] : ADDED_CODES.has(code) ? (added[code as AddedLocale] ||= {}) : null
    if (!target) continue
    for (const [k, v] of Object.entries(t)) {
      if (k === 'language_code') continue
      if (typeof v === 'string') target[k] = v
    }
  }
  attachAdded(out, added)
  addedRows.set(out, added)
  return localizeRecords(out)
}

/* ---------------- ui_messages (existing ofT contract) ---------------- */
interface RawMessage {
  key: string
  namespace: string
  translations: { language_code: string; value: string }[] | null
}

async function fetchCmsTranslationsRaw(timeout = 2500): Promise<CmsTranslations | null> {
  const fields = 'key,namespace,translations.language_code,translations.value'
  const data = await getJson<RawMessage[]>(`/items/ui_messages?fields=${fields}&filter[status][_eq]=published&limit=-1`, timeout)
  if (!data) return null
  const out: CmsTranslations = { landing: {}, landingFa: {}, terminal: {} }
  let count = 0
  for (const m of data) {
    const tr = { fa: '', en: '' }
    for (const t of m.translations || []) {
      if (t.language_code === 'fa') tr.fa = t.value
      else if (t.language_code === 'en') tr.en = t.value
    }
    if (m.namespace === 'landing') {
      if (tr.fa && tr.en) out.landing[m.key] = tr.en
      if (tr.fa && tr.fa !== m.key) out.landingFa[m.key] = tr.fa
      count++
    } else if (m.namespace === 'terminal' || m.namespace === 'common') {
      out.terminal[m.key] = { fa: tr.fa || tr.en, en: tr.en || tr.fa }
      count++
    }
  }
  return count ? out : null
}

/* ---------------- challenge plans (commercial catalog of record) --------
   The same table the backend reads; Directus is the editing surface.
   Fetched rows are VALIDATED — an invalid catalog is never rendered.     */
interface RawPlan { slug: string; name: string; status: string; configuration: Record<string, unknown> }
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null /* Number(null) is 0 — keep JSON nulls null */
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function planFromRow(row: RawPlan): ChallengePlan | null {
  const c = row.configuration || {}
  const name = c.name as { fa?: string; en?: string } | undefined
  const tagline = c.tagline as { fa?: string; en?: string } | undefined
  const splitName = (row.name || '').split(' — ')
  const plan: ChallengePlan = {
    slug: row.slug,
    name: { fa: name?.fa || splitName[0] || row.slug, en: name?.en || splitName[1] || splitName[0] || row.slug },
    tagline: { fa: tagline?.fa || '', en: tagline?.en || '' },
    status: 'published',
    accountSizesUsd: (c.accountSizesUsd as number[]) || [],
    priceUsd: (c.priceUsd as Record<number, number>) || {},
    phases: (num(c.phases) ?? 1) as 0 | 1 | 2,
    phase1TargetPct: num(c.phase1TargetPct),
    phase2TargetPct: num(c.phase2TargetPct),
    dailyLossPct: num(c.dailyLossPct) ?? 0,
    dailyLossPctAlt: num(c.dailyLossPctAlt),
    maxTotalLossPct: num(c.maxTotalLossPct) ?? 0,
    drawdownMode: (c.drawdownMode as 'static' | 'trailing') || 'static',
    trailingLockAtProfitPct: num(c.trailingLockAtProfitPct),
    minTradingDays: num(c.minTradingDays) ?? 0,
    profitableDaysPer30: num(c.profitableDaysPer30),
    consistencyPct: num(c.consistencyPct),
    profitSplitPct: num(c.profitSplitPct) ?? 0,
    profitSplitMonthlyPct: num(c.profitSplitMonthlyPct),
    payoutCapPct: num(c.payoutCapPct) ?? 0,
    firstPayoutDays: num(c.firstPayoutDays),
    minPayoutPct: num(c.minPayoutPct),
    timeLimitDays: num(c.timeLimitDays),
    trialDaysPerPhase: num(c.trialDaysPerPhase),
    refundPolicy: (c.refundPolicy as 'none' | 'fourth-reward') || 'none',
    referenceLeverageX: num(c.referenceLeverageX) ?? 5,
    free: c.free === true || row.slug === 'free-trial',
  }
  try { assertPlansValid([plan]) } catch { return null }
  return plan
}

/* canonical display order (matches the landing preset buttons and every
   table that renders the catalog) */
const PLAN_ORDER = ['standard', 'one-phase', 'instant', 'free-trial']

async function fetchCmsPlansRaw(): Promise<ChallengePlan[] | null> {
  const data = await getJson<RawPlan[]>('/items/challenge_plans?fields=slug,name,status,configuration&filter[status][_eq]=active&limit=-1')
  if (!data || !data.length) return null
  const plans = data.map(planFromRow).filter((p): p is ChallengePlan => !!p)
  plans.sort((a, b) => {
    const ia = PLAN_ORDER.indexOf(a.slug), ib = PLAN_ORDER.indexOf(b.slug)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
  return plans.length ? plans : null
}

/** plans in the legacy landing-builder shape (window.__ofPlans contract) */
async function fetchCmsLegacyPlansRaw(): Promise<Record<string, LegacyPreset> | null> {
  const plans = await fetchCmsPlans()
  if (!plans) return null
  const legacy = serializeForLegacy(plans)
  return Object.keys(legacy).length ? legacy : null
}

/* ---------------- home_content (product gateway) ---------------- */
export interface CmsHome {
  propCtaDestination: 'challenges' | 'terminal'
  perpetualCtaDestination: 'challenges' | 'terminal'
  propImage: string | null      /* directus file id */
  perpetualImage: string | null
  translations: Record<Locale, {
    headline: string; sub: string; note: string
    propTitle: string; propDescription: string; propCta: string
    perpetualTitle: string; perpetualDescription: string; perpetualCta: string
    seoTitle: string; seoDescription: string
  }>
}

async function fetchCmsHomeRaw(): Promise<CmsHome | null> {
  interface Raw extends TranslatedRow { prop_cta_destination?: string; perpetual_cta_destination?: string; prop_image?: string | null; perpetual_image?: string | null }
  const data = await getJson<Raw>('/items/home_content?fields=*,translations.*')
  if (!data) return null
  const fa = localized(data).fa, en = localized(data).en
  const valid = (x: Record<string, string>) => !!(x.headline && x.prop_title && x.prop_cta && x.perpetual_title && x.perpetual_cta)
  if (!valid(fa) || !valid(en)) return null
  return {
    propCtaDestination: data.prop_cta_destination === 'terminal' ? 'terminal' : 'challenges',
    perpetualCtaDestination: data.perpetual_cta_destination === 'challenges' ? 'challenges' : 'terminal',
    propImage: data.prop_image || null,
    perpetualImage: data.perpetual_image || null,
    translations: {
      fa: { headline: fa.headline, sub: fa.sub, note: fa.note, propTitle: fa.prop_title, propDescription: fa.prop_description, propCta: fa.prop_cta, perpetualTitle: fa.perpetual_title, perpetualDescription: fa.perpetual_description, perpetualCta: fa.perpetual_cta, seoTitle: fa.seo_title, seoDescription: fa.seo_description },
      en: { headline: en.headline, sub: en.sub, note: en.note, propTitle: en.prop_title, propDescription: en.prop_description, propCta: en.prop_cta, perpetualTitle: en.perpetual_title, perpetualDescription: en.perpetual_description, perpetualCta: en.perpetual_cta, seoTitle: en.seo_title, seoDescription: en.seo_description },
    },
  }
}

/* ---------------- faqs ---------------- */
export interface CmsFaq { question: { fa: string; en: string }; answer: { fa: string; en: string } }

async function fetchCmsFaqsRaw(page = 'challenges'): Promise<CmsFaq[] | null> {
  interface Raw { page: string; translations?: Array<{ language_code: string; question?: string; answer?: string }> | null }
  const data = await getJson<Raw[]>(`/items/faqs?fields=page,translations.language_code,translations.question,translations.answer&filter[status][_eq]=published&filter[page][_eq]=${page}&sort=sort&limit=-1`)
  if (!data) return null
  const out: CmsFaq[] = []
  for (const row of data) {
    const l = localized(row)
    if (!l.fa.question || !l.en.question) continue
    out.push({ question: { fa: l.fa.question, en: l.en.question }, answer: { fa: l.fa.answer || '', en: l.en.answer || '' } })
  }
  return out.length ? out : null
}

/* ---------------- trading_rules (rulebook) ---------------- */
export interface CmsRuleTable { caption: { fa: string; en: string }; columns: Array<{ fa: string; en: string }>; rows: Array<Array<{ fa: string; en: string }>> }
export interface CmsRuleSection {
  id: string
  title: { fa: string; en: string }
  status: 'current' | 'draft' | 'planned'
  paragraphs: Array<{ fa: string; en: string }>
  formula?: string
  explanation?: { title: { fa: string; en: string }; body: { fa: string; en: string } }
  table?: CmsRuleTable
}

async function fetchCmsRulesRaw(): Promise<CmsRuleSection[] | null> {
  interface RawTable { caption?: string; columns?: string[]; rows?: string[][] }
  interface RawTr { language_code: string; title?: string; paragraphs?: string[]; formula?: string | null; explanation_title?: string | null; explanation_body?: string | null; table?: RawTable | null }
  interface Raw { section_key: string; review_status: string; translations?: RawTr[] | null }
  const data = await getJson<Raw[]>('/items/trading_rules?fields=section_key,review_status,translations.*&filter[status][_eq]=published&sort=sort&limit=-1')
  if (!data) return null
  const out: CmsRuleSection[] = []
  for (const row of data) {
    const fa = (row.translations || []).find(t => t.language_code === 'fa')
    const en = (row.translations || []).find(t => t.language_code === 'en')
    if (!fa?.title || !en?.title) continue
    const parasFa = Array.isArray(fa.paragraphs) ? fa.paragraphs.filter(Boolean) : []
    const parasEn = Array.isArray(en.paragraphs) ? en.paragraphs.filter(Boolean) : []
    if (!parasFa.length || !parasEn.length || parasFa.length !== parasEn.length) continue
    const section: CmsRuleSection = {
      id: row.section_key,
      title: { fa: fa.title, en: en.title },
      status: row.review_status === 'current' || row.review_status === 'planned' ? row.review_status : 'draft',
      paragraphs: parasFa.map((p, i) => ({ fa: p, en: parasEn[i] })),
    }
    if (fa.formula && en.formula && fa.formula === en.formula) section.formula = fa.formula
    if (fa.explanation_title && en.explanation_title && fa.explanation_body && en.explanation_body) {
      section.explanation = { title: { fa: fa.explanation_title, en: en.explanation_title }, body: { fa: fa.explanation_body, en: en.explanation_body } }
    }
    const tFa = fa.table, tEn = en.table
    if (tFa?.caption && tEn?.caption && Array.isArray(tFa.columns) && Array.isArray(tEn.columns)) {
      /* per-locale rows hold PLAIN STRINGS (each translation is one locale) */
      const cols = tFa.columns.map((c, i) => ({ fa: String(c ?? ''), en: String(tEn.columns?.[i] ?? '') }))
      const rows = (tFa.rows || []).map((r, i) => (r || []).map((cell, j) => ({ fa: String(cell ?? ''), en: String(tEn.rows?.[i]?.[j] ?? '') })))
      section.table = { caption: { fa: String(tFa.caption), en: String(tEn.caption) }, columns: cols, rows }
    }
    out.push(section)
  }
  return out.length ? out : null
}

/* ---------------- legal documents ---------------- */
export interface CmsLegalDoc { docType: string; title: { fa: string; en: string }; paragraphs: Array<{ fa: string; en: string }> }

async function fetchCmsLegalRaw(): Promise<CmsLegalDoc[] | null> {
  interface RawTr { language_code: string; title?: string; paragraphs?: string[] }
  interface Raw { doc_type: string; translations?: RawTr[] | null }
  const data = await getJson<Raw[]>('/items/legal_documents?fields=doc_type,translations.*&filter[status][_eq]=published&sort=sort&limit=-1')
  if (!data) return null
  const out: CmsLegalDoc[] = []
  for (const row of data) {
    const fa = (row.translations || []).find(t => t.language_code === 'fa')
    const en = (row.translations || []).find(t => t.language_code === 'en')
    if (!fa?.title || !en?.title) continue
    const parasFa = Array.isArray(fa.paragraphs) ? fa.paragraphs.filter(Boolean) : []
    const parasEn = Array.isArray(en.paragraphs) ? en.paragraphs.filter(Boolean) : []
    if (!parasFa.length || !parasEn.length) continue
    out.push({ docType: row.doc_type, title: { fa: fa.title, en: en.title }, paragraphs: parasFa.map((p, i) => ({ fa: p, en: parasEn[i] })) })
  }
  return out.length ? out : null
}

/* ---------------- footer links (destination whitelist) ---------------- */
export type FooterDestination =
  | 'challenges' | 'markets' | 'rulebook' | 'transparency'
  | 'faq' | 'referral' | 'tools' | 'learn'
  | 'accounts-section' | 'team-section' | 'faq-section' | 'github'
export interface CmsFooterLink { destination: FooterDestination; label: { fa: string; en: string } }

const FOOTER_DESTINATIONS = new Set(['challenges', 'markets', 'rulebook', 'transparency', 'faq', 'referral', 'tools', 'learn', 'accounts-section', 'team-section', 'faq-section', 'github'])

async function fetchCmsFooterLinksRaw(): Promise<CmsFooterLink[] | null> {
  interface Raw extends TranslatedRow { destination: string }
  const data = await getJson<Raw[]>('/items/footer_links?fields=destination,translations.language_code,translations.label&filter[status][_eq]=published&sort=sort&limit=-1')
  if (!data) return null
  const out: CmsFooterLink[] = []
  for (const row of data) {
    if (!FOOTER_DESTINATIONS.has(row.destination)) continue /* unknown destination → never rendered */
    const l = localized(row)
    if (!l.fa.label || !l.en.label) continue
    out.push({ destination: row.destination as FooterDestination, label: { fa: l.fa.label, en: l.en.label } })
  }
  return out.length ? out : null
}

/* ---------------- navigation (public_header, whitelist) ---------------- */
export type NavRoute = 'challenges' | 'markets' | 'rulebook' | 'transparency' | 'faq' | 'referral' | 'tools' | 'learn'
export interface CmsNavItem { route: NavRoute; label: { fa: string; en: string } }
const NAV_ROUTES = new Set(['challenges', 'markets', 'rulebook', 'transparency', 'faq', 'referral', 'tools', 'learn'])

async function fetchCmsNavigationRaw(): Promise<CmsNavItem[] | null> {
  interface Raw extends TranslatedRow { route: string; visible: boolean }
  const data = await getJson<Raw[]>('/items/navigation_items?fields=route,visible,translations.language_code,translations.label&filter[status][_eq]=published&filter[location][_eq]=public_header&filter[visible][_eq]=true&sort=sort&limit=-1')
  if (!data) return null
  const out: CmsNavItem[] = []
  for (const row of data) {
    const route = (row.route || '').replace(/^#?\/?/, '')
    if (!NAV_ROUTES.has(route)) continue
    const l = localized(row)
    if (!l.fa.label || !l.en.label) continue
    out.push({ route: route as NavRoute, label: { fa: l.fa.label, en: l.en.label } })
  }
  return out.length ? out : null
}

/* ---------------- pages (SEO/meta) ---------------- */
export interface CmsPageMeta {
  title: { fa: string; en: string }
  subtitle: { fa: string; en: string }
  description: { fa: string; en: string }
  seoTitle: { fa: string; en: string }
  seoDescription: { fa: string; en: string }
}

async function fetchCmsPageMetaRaw(slug: string): Promise<CmsPageMeta | null> {
  interface RawTr { language_code: string; title?: string; subtitle?: string; description?: string; seo_title?: string; seo_description?: string }
  interface Raw { slug: string; translations?: RawTr[] | null }
  const data = await getJson<Raw[]>(`/items/pages?fields=slug,translations.*&filter[slug][_eq]=${slug}&filter[status][_eq]=published&limit=1`)
  const row = data?.[0]
  if (!row) return null
  const fa = (row.translations || []).find(t => t.language_code === 'fa')
  const en = (row.translations || []).find(t => t.language_code === 'en')
  if (!fa?.title && !en?.title) return null
  return {
    title: { fa: fa?.title || en?.title || '', en: en?.title || fa?.title || '' },
    subtitle: { fa: fa?.subtitle || '', en: en?.subtitle || '' },
    description: { fa: fa?.description || '', en: en?.description || '' },
    seoTitle: { fa: fa?.seo_title || fa?.title || '', en: en?.seo_title || en?.title || '' },
    seoDescription: { fa: fa?.seo_description || fa?.description || '', en: en?.seo_description || en?.description || '' },
  }
}

/** Product editorial sections: CMS-only, never a financial source. */
async function fetchTerminalSectionsRaw(product: 'prop' | 'perpetual', page: string) {
  interface Raw extends TranslatedRow { id: string; illustration?: string; support_url?: string }
  const rows = await getJson<Raw[]>(`/items/terminal_sections?fields=id,illustration,support_url,translations.*&filter[status][_eq]=published&filter[product][_eq]=${product}&filter[page][_eq]=${encodeURIComponent(page)}&sort=sort&limit=-1`)
  if (!rows) return null
  return rows.flatMap(row => {
    const l = localized(row)
    if (!l.fa.title || !l.en.title) return []
    const url = row.support_url && /^https:\/\//.test(row.support_url) ? row.support_url : null
    return [{ id: row.id, title: { fa: l.fa.title, en: l.en.title }, body: { fa: l.fa.body || '', en: l.en.body || '' }, illustration: row.illustration && /^[0-9a-f-]{36}$/i.test(row.illustration) ? row.illustration : null, supportUrl: url }]
  })
}

/* ===================== website expansion ===============================
   FAQ hub, Learning Center, Tools Center prose and the Growth Partner page.
   Same contract as above: published rows only, both locales or nothing.    */

type Bi = Record<Locale, string>
const bi = (fa: string, en: string): Bi => ({ fa, en })
const isBi = (a?: string, b?: string): a is string => !!(a && b && a.trim() && b.trim())
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/**
 * Same flattening as `localized()` but JSON columns (lesson blocks, referral
 * benefits, outcomes…) are kept as-is instead of being dropped.
 */
function flat(row: TranslatedRow): Record<Locale, Record<string, unknown>> {
  const out: Record<Locale, Record<string, unknown>> = { fa: {}, en: {} }
  const added: Partial<Record<AddedLocale, Record<string, unknown>>> = {}
  for (const t of row.translations || []) {
    const code = t.language_code
    const target = code === 'en' || code === 'fa' ? out[code] : ADDED_CODES.has(code) ? (added[code as AddedLocale] ||= {}) : null
    if (!target) continue
    for (const [k, v] of Object.entries(t)) if (k !== 'language_code') target[k] = v
  }
  addedRows.set(out, added)
  return out
}

const pairOf = (rec: Record<Locale, Record<string, unknown>>, key: string): Bi => {
  const pair = { fa: str(rec.fa[key]), en: str(rec.en[key]) }
  const added = addedRows.get(rec)
  if (added) attachAdded(pair, added, key)
  return pair
}

/* ---------------- FAQ hub (categories + questions) ---------------- */
export interface CmsFaqHub { categories: FaqCategoryContent[]; items: FaqItemContent[] }

async function fetchCmsFaqHubRaw(): Promise<CmsFaqHub | null> {
  interface RawCat extends TranslatedRow { id: number | string; slug: string; sort: number; icon?: string }
  interface RawLink { target?: { kind?: string; slug?: string }; label?: Partial<Bi> }
  interface RawFaq extends TranslatedRow { slug: string | null; sort: number; category?: number | string | null }
  const [cats, rows] = await Promise.all([
    getJson<RawCat[]>('/items/faq_categories?fields=id,slug,sort,icon,translations.language_code,translations.label,translations.description&filter[status][_eq]=published&sort=sort&limit=-1'),
    getJson<RawFaq[]>('/items/faqs?fields=slug,sort,category,page,translations.language_code,translations.question,translations.answer,translations.links&filter[status][_eq]=published&filter[page][_eq]=faq&sort=sort&limit=-1'),
  ])
  if (!cats || !rows) return null
  /* faqs.category stores the category ROW ID — resolve it back to the slug key */
  const categoryIdToKey = new Map(cats.map(row => [String(row.id), row.slug]))
  const categories: FaqCategoryContent[] = []
  for (const row of cats) {
    const l = flat(row)
    const label = pairOf(l, 'label')
    if (!isBi(label.fa, label.en)) continue
    categories.push({
      key: row.slug, sort: Number(row.sort) || 0,
      icon: (row.icon || 'general') as FaqCategoryContent['icon'],
      label, description: pairOf(l, 'description'),
    })
  }
  const items: FaqItemContent[] = []
  for (const row of rows) {
    const l = flat(row)
    const question = pairOf(l, 'question'), answer = pairOf(l, 'answer')
    if (!isBi(question.fa, question.en) || !isBi(answer.fa, answer.en) || !row.slug) continue
    const links = pairLinks(l.fa.links, l.en.links)
    const categoryKey = categoryIdToKey.get(String(row.category ?? '')) ?? ''
    items.push({
      key: row.slug, sort: Number(row.sort) || 0,
      category: categoryKey,
      question, answer,
      links: links.length ? links : undefined,
    })
  }
  if (!categories.length || !items.length) return null
  /* drop questions pointing at a retired category */
  const keys = new Set(categories.map(c => c.key))
  return { categories, items: items.filter(i => keys.has(i.category)) }
}

/** `[{ target: { kind, slug }, label: { fa, en } }]`, paired across locales */
function pairLinks(faRaw: unknown, enRaw: unknown): Array<{ target: LinkTarget; label: Bi }> {
  const fa = asArray(faRaw), en = asArray(enRaw)
  if (!fa.length || fa.length !== en.length) return []
  const out: Array<{ target: LinkTarget; label: Bi }> = []
  for (let i = 0; i < fa.length; i++) {
    const a = fa[i] as { target?: { kind?: string; slug?: string }; label?: Partial<Bi> }
    const b = en[i] as { target?: { kind?: string; slug?: string }; label?: Partial<Bi> }
    const kind = a?.target?.kind, slug = a?.target?.slug
    if (!kind || !slug || kind !== b?.target?.kind || slug !== b?.target?.slug) continue
    if (!a.label?.fa || !b.label?.en) continue
    out.push({ target: { kind, slug } as LinkTarget, label: bi(a.label.fa, b.label.en) })
  }
  return out
}

/* ---------------- Learning Center library ---------------- */
export interface CmsLearningLibrary { paths: LearningPathContent[]; glossary: GlossaryTermContent[] }

async function fetchCmsLearningLibraryRaw(): Promise<CmsLearningLibrary | null> {
  interface RawPath extends TranslatedRow { slug: string; path_key: string; sort: number; level?: string; lessons?: RawLesson[] | null }
  interface RawLesson extends TranslatedRow { slug: string; sort: number; minutes?: number; status?: string; glossary?: unknown; tools?: unknown }
  interface RawTerm extends TranslatedRow { slug: string; sort: number; lessons?: unknown; tool?: string }
  const pathsFields = 'slug,path_key,sort,level,'
    + 'translations.language_code,translations.eyebrow,translations.title,translations.summary,translations.outcomes,'
    + 'lessons.id,lessons.slug,lessons.sort,lessons.minutes,lessons.glossary,lessons.tools,'
    + 'lessons.translations.language_code,lessons.translations.title,lessons.translations.summary,'
    + 'lessons.translations.takeaways,lessons.translations.blocks'
  const [rawPaths, rawTerms] = await Promise.all([
    getJson<RawPath[]>(`/items/learning_paths?fields=${pathsFields}&filter[status][_eq]=published&filter[lessons][status][_eq]=published&sort=sort&limit=-1`),
    getJson<RawTerm[]>('/items/glossary_terms?fields=slug,sort,tool,lessons,translations.language_code,translations.term,translations.short,translations.definition&filter[status][_eq]=published&sort=sort&limit=-1'),
  ])
  if (!rawPaths || !rawTerms) return null

  const paths: LearningPathContent[] = []
  for (const row of rawPaths) {
    const l = flat(row)
    const title = pairOf(l, 'title')
    if (!isBi(title.fa, title.en)) continue
    const lessons: LessonContent[] = []
    for (const item of row.lessons || []) {
      const tl = flat(item)
      const lessonTitle = pairOf(tl, 'title')
      if (!isBi(lessonTitle.fa, lessonTitle.en)) continue
      const blocks = pairBlocks(tl.fa.blocks, tl.en.blocks)
      const takeaways = pairStrings(tl.fa.takeaways, tl.en.takeaways)
      if (!blocks.length) continue
      lessons.push({
        slug: item.slug, path: row.slug, sort: Number(item.sort) || 0, minutes: Number(item.minutes) || 8,
        status: 'published', title: lessonTitle, summary: pairOf(tl, 'summary'),
        takeaways, glossary: stringList(item.glossary), tools: stringList(item.tools), blocks,
      })
    }
    lessons.sort((a, b) => a.sort - b.sort)
    paths.push({
      key: row.path_key || row.slug, slug: row.slug, sort: Number(row.sort) || 0,
      level: (row.level === 'practitioner' || row.level === 'advanced') ? row.level : 'foundation',
      eyebrow: pairOf(l, 'eyebrow'), title, summary: pairOf(l, 'summary'),
      outcomes: pairStrings(l.fa.outcomes, l.en.outcomes),
      lessons,
    })
  }

  const glossary: GlossaryTermContent[] = []
  for (const row of rawTerms) {
    const l = flat(row)
    const term = pairOf(l, 'term'), definition = pairOf(l, 'definition')
    if (!isBi(term.fa, term.en) || !isBi(definition.fa, definition.en)) continue
    glossary.push({
      slug: row.slug, sort: Number(row.sort) || 0,
      term, short: pairOf(l, 'short'), definition,
      lessons: stringList(row.lessons), tool: row.tool || undefined,
    })
  }
  glossary.sort((a, b) => a.sort - b.sort)
  if (!paths.length || !glossary.length) return null
  return { paths, glossary }
}

/** lesson blocks are stored per locale and paired by index (trading_rules precedent) */
function pairBlocks(faRaw: unknown, enRaw: unknown): LessonBlock[] {
  const fa = asArray(faRaw), en = asArray(enRaw)
  if (!fa.length || fa.length !== en.length) return []
  const out: LessonBlock[] = []
  for (let i = 0; i < fa.length; i++) {
    const a = fa[i] as Record<string, unknown>, b = en[i] as Record<string, unknown>
    if (a?.type !== b?.type) return []
    const block = mergeBlock(a, b)
    if (block) out.push(block)
  }
  return out
}

function mergeBlock(a: Record<string, unknown>, b: Record<string, unknown>): LessonBlock | null {
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const pair = (x: unknown, y: unknown): Bi => bi(str(x), str(y))
  const list = (v: unknown) => (Array.isArray(v) ? v as unknown[] : [])
  switch (a.type) {
    case 'p': case 'h2': case 'h3': case 'note':
      return { type: a.type as 'p', text: pair(a.text, b.text) }
    case 'ul': case 'ol': {
      const fa = list(a.items), en = list(b.items)
      if (!fa.length || fa.length !== en.length) return null
      return { type: a.type as 'ul', items: fa.map((x, i) => pair(x, en[i])) }
    }
    case 'formula': {
      if (str(a.expr) !== str(b.expr)) return null /* ASCII math must not diverge */
      return { type: 'formula', expr: str(a.expr), text: a.text || b.text ? pair(a.text, b.text) : undefined }
    }
    case 'terms': {
      const fa = list(a.items) as Array<Record<string, unknown>>, en = list(b.items) as Array<Record<string, unknown>>
      if (!fa.length || fa.length !== en.length) return null
      return { type: 'terms', items: fa.map((x, i) => ({ term: pair(x.term, en[i]?.term), text: pair(x.text, en[i]?.text) })) }
    }
    case 'table': {
      const faHead = list(a.head), enHead = list(b.head)
      const faRows = list(a.rows) as unknown[][], enRows = list(b.rows) as unknown[][]
      if (!faHead.length || faHead.length !== enHead.length || faRows.length !== enRows.length) return null
      return {
        type: 'table', caption: pair(a.caption, b.caption),
        head: faHead.map((x, i) => pair(x, enHead[i])),
        rows: faRows.map((r, i) => (r || []).map((cell, j) => pair(cell, enRows[i]?.[j]))),
      }
    }
    default:
      return null
  }
}

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] } }
  return []
}

/** two per-locale string arrays of equal length → one bilingual array */
function pairStrings(faRaw: unknown, enRaw: unknown): Array<Record<Locale, string>> {
  const fa = asArray(faRaw), en = asArray(enRaw)
  if (!fa.length || fa.length !== en.length) return []
  return fa.map((x, i) => bi(typeof x === 'string' ? x : '', typeof en[i] === 'string' ? en[i] : ''))
}

function stringList(v: unknown): string[] {
  return asArray(v).filter((x): x is string => typeof x === 'string' && !!x)
}

/* ---------------- Tools Center prose ---------------- */
async function fetchCmsToolCopyRaw(): Promise<Record<string, ToolCopy> | null> {
  interface Raw extends TranslatedRow { slug: string }
  const rows = await getJson<Raw[]>('/items/tools?fields=slug,category,translations.language_code,translations.name,translations.tagline,translations.about,translations.method,translations.assumptions,translations.limitations&filter[status][_eq]=published&sort=sort&limit=-1')
  if (!rows) return null
  const out: Record<string, ToolCopy> = {}
  for (const row of rows) {
    const l = flat(row)
    const name = pairOf(l, 'name')
    if (!isBi(name.fa, name.en)) continue
    const assumptions = pairStrings(l.fa.assumptions, l.en.assumptions)
    if (!assumptions.length) continue
    out[row.slug] = {
      name, tagline: pairOf(l, 'tagline'), about: pairOf(l, 'about'),
      method: pairOf(l, 'method'), assumptions, limitations: pairOf(l, 'limitations'),
    }
  }
  return Object.keys(out).length ? out : null
}

/* ---------------- Growth Partner (singleton) ---------------- */
async function fetchCmsReferralRaw(): Promise<{ programState: 'prelaunch' | 'live'; content: ReferralContent } | null> {
  interface Raw extends TranslatedRow { program_state?: string }
  const data = await getJson<Raw>('/items/referral_content?fields=program_state,translations.*')
  if (!data) return null
  const l = flat(data)
  const heroTitle = pairOf(l, 'hero_title'), heroIntro = pairOf(l, 'hero_intro')
  if (!isBi(heroTitle.fa, heroTitle.en) || !isBi(heroIntro.fa, heroIntro.en)) return null
  const benefits = pairObjects<ReferralBenefit>(l.fa.benefits, l.en.benefits)
  const stages = pairObjects<ReferralStage>(l.fa.stages, l.en.stages)
  const sections = pairObjects<ReferralSection>(l.fa.sections, l.en.sections)
  const columns = pairObjects<ReferralContent['dashboard']['columns'][number]>(l.fa.dashboard_columns, l.en.dashboard_columns)
  const pending = pairObjects<ReferralContent['pendingDecisions'][number]>(l.fa.pending_decisions, l.en.pending_decisions)
  const faq = pairObjects<FaqItemContent>(l.fa.faq, l.en.faq)
  if (!benefits.length || !stages.length || !sections.length || !columns.length || !pending.length || !faq.length) return null
  const content: ReferralContent = {
    hero: { eyebrow: pairOf(l, 'hero_eyebrow'), title: heroTitle, accent: pairOf(l, 'hero_accent'), intro: heroIntro },
    statusNotice: pairOf(l, 'status_notice'),
    benefits, stages, sections,
    dashboard: { title: pairOf(l, 'dashboard_title'), intro: pairOf(l, 'dashboard_intro'), columns },
    faq, pendingDecisions: pending,
    cta: {
      title: pairOf(l, 'cta_title'), text: pairOf(l, 'cta_text'),
      primary: pairOf(l, 'cta_primary'), secondary: pairOf(l, 'cta_secondary'),
    },
  }
  return { programState: data.program_state === 'live' ? 'live' : 'prelaunch', content }
}

/**
 * Structured JSON stored per locale: the `fa` row holds the Persian strings and
 * the `en` row the English ones, item by item, so arrays must match in length.
 */
function pairObjects<T>(faRaw: unknown, enRaw: unknown): T[] {
  const fa = asArray(faRaw), en = asArray(enRaw)
  if (!fa.length || fa.length !== en.length) return []
  const out: T[] = []
  for (let i = 0; i < fa.length; i++) {
    const a = fa[i] as Record<string, unknown>, b = en[i] as Record<string, unknown>
    const merged = mergeLocaleObject(a, b)
    if (!merged) return []
    out.push(merged as T)
  }
  return out
}

function mergeLocaleObject(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(a)) {
    const other = b[key]
    if (typeof value === 'string') {
      if (typeof other !== 'string') return null
      out[key] = { fa: value, en: other }
    } else if (Array.isArray(value)) {
      if (!Array.isArray(other) || other.length !== value.length) return null
      const items: unknown[] = []
      for (let i = 0; i < value.length; i++) {
        const x = value[i], y = other[i]
        if (x && typeof x === 'object' && !Array.isArray(x) && y && typeof y === 'object') {
          const nested = mergeLocaleObject(x as Record<string, unknown>, y as Record<string, unknown>)
          if (!nested) return null
          items.push(nested)
        } else if (typeof x === 'string' && typeof y === 'string') {
          items.push({ fa: x, en: y })
        } else if (typeof x === typeof y) {
          items.push(x)
        } else return null
      }
      out[key] = items
    } else if (value && typeof value === 'object') {
      if (!other || typeof other !== 'object') return null
      const nested = mergeLocaleObject(value as Record<string, unknown>, other as Record<string, unknown>)
      if (!nested) return null
      out[key] = nested
    } else {
      out[key] = value
    }
  }
  return out
}

/* Every bilingual record a fetcher returns also resolves ar / ru / zh-CN. */
const localizing = <A extends unknown[], R>(fn: (...args: A) => Promise<R>) => async (...args: A): Promise<R> => localizeRecords(await fn(...args))
export const fetchCmsTranslations = localizing(fetchCmsTranslationsRaw)
export const fetchCmsPlans = localizing(fetchCmsPlansRaw)
export const fetchCmsLegacyPlans = localizing(fetchCmsLegacyPlansRaw)
export const fetchCmsHome = localizing(fetchCmsHomeRaw)
export const fetchCmsFaqs = localizing(fetchCmsFaqsRaw)
export const fetchCmsRules = localizing(fetchCmsRulesRaw)
export const fetchCmsLegal = localizing(fetchCmsLegalRaw)
export const fetchCmsFooterLinks = localizing(fetchCmsFooterLinksRaw)
export const fetchCmsNavigation = localizing(fetchCmsNavigationRaw)
export const fetchCmsPageMeta = localizing(fetchCmsPageMetaRaw)
export const fetchTerminalSections = localizing(fetchTerminalSectionsRaw)
export const fetchCmsFaqHub = localizing(fetchCmsFaqHubRaw)
export const fetchCmsLearningLibrary = localizing(fetchCmsLearningLibraryRaw)
export const fetchCmsToolCopy = localizing(fetchCmsToolCopyRaw)
export const fetchCmsReferral = localizing(fetchCmsReferralRaw)
