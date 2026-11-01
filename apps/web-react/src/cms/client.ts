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

export interface CmsTranslations {
  landing: Record<string, string>
  landingFa: Record<string, string>
  terminal: Record<string, { fa: string; en: string }>
}

const DIRECTUS_URL = ((import.meta.env.VITE_DIRECTUS_URL as string | undefined) || 'http://localhost:8055').replace(/\/+$/, '')
const TIMEOUT_MS = 4000
const CACHE_TTL = 20_000

export function directusUrl(): string {
  return DIRECTUS_URL
}

/* ---------------- tiny fetch + cache core ---------------- */
const cache = new Map<string, { at: number; value: unknown }>()

async function getJson<T>(path: string, timeout = TIMEOUT_MS): Promise<T | null> {
  const cached = cache.get(path)
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.value as T
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(`${DIRECTUS_URL}${path}`, { signal: ctrl.signal })
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

/** flatten a Directus translations array into { fa, en } string records */
function localized(row: TranslatedRow): Record<Locale, Record<string, string>> {
  const out: Record<Locale, Record<string, string>> = { fa: {}, en: {} }
  for (const t of row.translations || []) {
    const lang = t.language_code === 'en' ? 'en' : 'fa'
    for (const [k, v] of Object.entries(t)) {
      if (k === 'language_code') continue
      if (typeof v === 'string') out[lang][k] = v
    }
  }
  return out
}

/* ---------------- ui_messages (existing ofT contract) ---------------- */
interface RawMessage {
  key: string
  namespace: string
  translations: { language_code: string; value: string }[] | null
}

export async function fetchCmsTranslations(timeout = 2500): Promise<CmsTranslations | null> {
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

export async function fetchCmsPlans(): Promise<ChallengePlan[] | null> {
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
export async function fetchCmsLegacyPlans(): Promise<Record<string, LegacyPreset> | null> {
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

export async function fetchCmsHome(): Promise<CmsHome | null> {
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

export async function fetchCmsFaqs(page = 'challenges'): Promise<CmsFaq[] | null> {
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

export async function fetchCmsRules(): Promise<CmsRuleSection[] | null> {
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

export async function fetchCmsLegal(): Promise<CmsLegalDoc[] | null> {
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
  | 'accounts-section' | 'team-section' | 'faq-section' | 'github'
export interface CmsFooterLink { destination: FooterDestination; label: { fa: string; en: string } }

const FOOTER_DESTINATIONS = new Set(['challenges', 'markets', 'rulebook', 'transparency', 'accounts-section', 'team-section', 'faq-section', 'github'])

export async function fetchCmsFooterLinks(): Promise<CmsFooterLink[] | null> {
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
export type NavRoute = 'challenges' | 'markets' | 'rulebook' | 'transparency'
export interface CmsNavItem { route: NavRoute; label: { fa: string; en: string } }
const NAV_ROUTES = new Set(['challenges', 'markets', 'rulebook', 'transparency'])

export async function fetchCmsNavigation(): Promise<CmsNavItem[] | null> {
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

export async function fetchCmsPageMeta(slug: string): Promise<CmsPageMeta | null> {
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
export async function fetchTerminalSections(product: 'prop' | 'perpetual', page: string) {
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
