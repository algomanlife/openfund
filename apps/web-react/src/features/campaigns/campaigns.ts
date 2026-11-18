/* Promotional popups and announcement bars: selection, frequency and
 * anonymous counters. Content is published Directus copy (`site_campaigns`,
 * managed in Backstage → Marketing) read through the same CMS client as the
 * rest of the site, so IRAN serves it from its own `/cms` snapshot.
 *
 * Rules the site enforces itself:
 *  - locale ELIGIBILITY is the campaign's explicit `locales` list, and the
 *    copy must exist in the visitor's language: no fallback to another
 *    language (an fa-only bar never appears in English);
 *  - the selected route language decides, never IP or Geo-IP;
 *  - region, page and schedule must match; the highest priority wins;
 *  - a campaign that names a coupon is shown only while the backend reports
 *    that coupon as promotable, and its same-site CTA carries ?coupon=. */
import { getCmsJson, directusUrl } from '../../cms/client'
import { publicRuntimeConfig } from '../../config/runtime'
import type { AppLocale } from '../../i18n/locales'

export type Placement = 'modal' | 'announcement_bar'
export type CampaignPage = 'home' | 'challenges' | 'information'
interface RawTranslation { language_code: string; headline: string; body?: string | null; cta_label?: string | null; image_alt?: string | null }
interface RawCampaign {
  id: number; placement: Placement; template?: 'image' | 'split' | null; style?: 'mint' | 'neutral' | 'notice' | null; priority?: number | null
  starts_at?: string | null; ends_at?: string | null; locales?: string[] | null; regions?: string[] | null; pages?: string[] | null
  image_desktop?: string | null; image_mobile?: string | null; cta_url?: string | null; coupon_code?: string | null
  delay_seconds?: number | null; frequency?: 'session' | 'interval' | null; frequency_days?: number | null; translations?: RawTranslation[] | null
}
export interface Campaign {
  id: string; placement: Placement; template: 'image' | 'split'; style: 'mint' | 'neutral' | 'notice'
  headline: string; body: string; ctaLabel: string | null; ctaUrl: string | null; external: boolean; imageAlt: string
  imageDesktop: string | null; imageMobile: string | null; coupon: { code: string; kind: 'percent' | 'fixed'; value: string } | null
  delayMs: number; frequency: 'session' | 'interval'; frequencyDays: number
}

const FIELDS = 'id,placement,template,style,priority,starts_at,ends_at,locales,regions,pages,image_desktop,image_mobile,cta_url,coupon_code,delay_seconds,frequency,frequency_days,translations.language_code,translations.headline,translations.body,translations.cta_label,translations.image_alt'
const PATH = `/items/site_campaigns?fields=${FIELDS}&filter[status][_eq]=published&filter[active][_eq]=true&sort=-priority&limit=50`

/* The Persian Iran-access bar, used only when no content source answers at
   all (Directus and the /cms snapshot both down). It mirrors the published
   seed in apps/backstage/scripts/apply_schema.py; an empty published list
   means editors removed it, and then nothing is shown. */
const OFFLINE_FALLBACK: RawCampaign[] = [{
  id: 0, placement: 'announcement_bar', style: 'mint', priority: 100, locales: ['fa'], regions: ['GLOBAL'], pages: ['all'],
  cta_url: 'https://openfi.live/', frequency: 'session',
  translations: [{ language_code: 'fa', headline: 'از داخل ایران وصل می‌شوید؟ نسخهٔ ایرانی اوپن‌فاند روی زیرساخت داخلی در دسترس است.', cta_label: 'ورود به اوپن‌فاند ایران' }],
}]

/** Public pages only: checkout, purchases, sign-in, profile and trading never show campaigns. */
export function campaignPage(pathname: string): CampaignPage | null {
  if (/\/(checkout|purchases|profile|inbox|auth|signin|terminal|trade|perpetual|prop\/|account|withdraw|certificates\/verify)/i.test(pathname)) return null
  const segment = pathname.split('/').filter(Boolean)[1] ?? 'home'
  if (segment === 'home') return 'home'
  if (segment === 'challenges') return 'challenges'
  return 'information'
}

export function safeHref(url: string | null | undefined): { href: string; external: boolean } | null {
  if (!url) return null
  if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) return { href: url, external: false }
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && !u.username && !u.password ? { href: u.href, external: u.origin !== location.origin } : null
  } catch { return null }
}

const promoCache = new Map<string, Promise<Campaign['coupon']>>()
function promotable(code: string): Promise<Campaign['coupon']> {
  const key = code.toUpperCase()
  if (!promoCache.has(key)) promoCache.set(key, fetch(`/campaigns/coupons/${encodeURIComponent(key)}`, { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .then(d => (d?.promotable ? { code: d.code as string, kind: d.kind as 'percent' | 'fixed', value: String(d.value) } : null))
    .catch(() => null))
  return promoCache.get(key)!
}

export async function selectCampaign(placement: Placement, locale: AppLocale, page: CampaignPage, now = Date.now()): Promise<Campaign | null> {
  const fetched = await getCmsJson<RawCampaign[]>(PATH)
  const list = fetched ?? (placement === 'announcement_bar' ? OFFLINE_FALLBACK : [])
  const region = publicRuntimeConfig().region === 'IRAN' ? 'IRAN' : 'GLOBAL'
  const eligible = list
    .filter(c => c.placement === placement)
    .filter(c => (c.locales ?? []).includes(locale))
    .filter(c => (c.regions ?? []).includes(region))
    .filter(c => (c.pages ?? []).includes('all') || (c.pages ?? []).includes(page))
    .filter(c => (!c.starts_at || Date.parse(c.starts_at) <= now) && (!c.ends_at || Date.parse(c.ends_at) > now))
    .map(c => ({ c, t: (c.translations ?? []).find(t => t.language_code === locale && t.headline) }))
    .filter((x): x is { c: RawCampaign; t: RawTranslation } => Boolean(x.t))
    .sort((a, b) => (b.c.priority ?? 0) - (a.c.priority ?? 0))
  for (const { c, t } of eligible) {
    if (!isEligibleByFrequency(c)) continue
    const coupon = c.coupon_code ? await promotable(c.coupon_code) : null
    if (c.coupon_code && !coupon) continue /* never promise an invalid discount */
    const link = safeHref(c.cta_url)
    let ctaUrl = link?.href ?? null
    if (link && !link.external && coupon) {
      const u = new URL(link.href, location.origin)
      u.searchParams.set('coupon', coupon.code)
      ctaUrl = u.pathname + u.search + u.hash
    }
    return {
      id: String(c.id), placement: c.placement, template: c.template === 'image' ? 'image' : 'split', style: c.style ?? 'mint',
      headline: t.headline, body: t.body ?? '', ctaLabel: link ? (t.cta_label ?? null) : null, ctaUrl: t.cta_label ? ctaUrl : null,
      external: Boolean(link?.external), imageAlt: t.image_alt ?? '',
      imageDesktop: c.image_desktop ? assetUrl(c.image_desktop, 1200) : null, imageMobile: c.image_mobile ? assetUrl(c.image_mobile, 720) : null,
      coupon, delayMs: Math.min(120, Math.max(3, c.delay_seconds ?? 12)) * 1000,
      frequency: c.frequency === 'interval' ? 'interval' : 'session', frequencyDays: Math.min(90, Math.max(1, c.frequency_days ?? 7)),
    }
  }
  return null
}

const assetUrl = (id: string, width: number) => `${directusUrl()}/assets/${encodeURIComponent(id)}?width=${width}&fit=inside&format=webp&quality=82`

/* ---------- frequency (per campaign, per browser; no identifiers) ---------- */
const storageKey = (c: { id: number | string; placement: string }) => `of-campaign:${c.placement}:${c.id}`
function read(store: 'local' | 'session', key: string): string | null {
  try { return (store === 'local' ? localStorage : sessionStorage).getItem(key) } catch { return null }
}
function write(store: 'local' | 'session', key: string, value: string) {
  try { (store === 'local' ? localStorage : sessionStorage).setItem(key, value) } catch { /* private mode: show again next time */ }
}
function isEligibleByFrequency(c: RawCampaign): boolean {
  const key = storageKey(c)
  if (read('session', key)) return false
  if (c.placement === 'modal' && c.frequency === 'interval') {
    const last = Number(read('local', key) || 0)
    if (last && Date.now() - last < Math.min(90, Math.max(1, c.frequency_days ?? 7)) * 86_400_000) return false
  }
  return true
}
/** Record that a campaign was shown or dismissed, so it is not repeated. */
export function markSeen(c: Campaign) {
  write('session', storageKey(c), '1')
  if (c.frequency === 'interval') write('local', storageKey(c), String(Date.now()))
}

/* ---------- counters: once per campaign, event and page view ---------- */
const reported = new Set<string>()
export function report(c: Campaign, event: 'impression' | 'click' | 'close') {
  if (c.id === '0') return /* offline fallback: nothing to attribute */
  const key = `${c.placement}:${c.id}:${event}`
  if (reported.has(key)) return
  reported.add(key)
  const body = JSON.stringify({ campaignId: c.id, placement: c.placement, event })
  try {
    if (navigator.sendBeacon?.('/campaigns/events', new Blob([body], { type: 'application/json' }))) return
  } catch { /* fall through */ }
  void fetch('/campaigns/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
}
