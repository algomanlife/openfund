/* Terminal guide (educational popup, ADR 0056): selection, the
 * "Don't show again" cookie and anonymous counters.
 *
 * Content is published Directus copy (`site_guides`, `site_guide_steps`,
 * managed in Backstage → Marketing → Terminal guide) read through the same
 * CMS client as the rest of the site, so IRAN serves it from its own `/cms`
 * snapshot. When no content source answers at all, the bundled fallback
 * below (the published seed, media under /assets/guides/) is used.
 *
 * Rules:
 *  - guides are educational only; promotional popups stay banned on the
 *    terminal (campaigns.ts) and this module never shows a campaign;
 *  - the guide opens every time the terminal is entered, unless the visitor
 *    ticked "Don't show again" for this guide id AND version;
 *  - that choice is a first-party cookie holding only the version number:
 *    no identifier, SameSite=Lax, Secure on https, lifetime from Backstage;
 *  - titles and bodies exist in fa and en; other locales read en. */
import { getCmsJson, directusUrl } from '../../cms/client'
import { publicRuntimeConfig } from '../../config/runtime'
import type { AppLocale } from '../../i18n/locales'

interface RawStep {
  id: number | string; sort?: number | null; status?: string | null; media_kind?: 'video' | 'image' | null
  video_mp4?: string | null; video_webm?: string | null; image?: string | null; poster?: string | null
  subtitles_fa?: string | null; subtitles_en?: string | null
  title_fa?: string | null; title_en?: string | null; body_fa?: string | null; body_en?: string | null
}
interface RawGuide {
  id: number | string; version?: number | null; cookie_days?: number | null; pages?: string[] | null; regions?: string[] | null; steps?: RawStep[] | null
}
export interface GuideStep {
  id: string; kind: 'video' | 'image'; mp4: string | null; webm: string | null; image: string | null; poster: string | null
  subtitles: { fa: string | null; en: string | null }; title: string; body: string
}
export interface Guide { id: string; version: number; cookieDays: number; steps: GuideStep[] }

const STEP_FIELDS = ['id', 'sort', 'status', 'media_kind', 'video_mp4', 'video_webm', 'image', 'poster', 'subtitles_fa', 'subtitles_en', 'title_fa', 'title_en', 'body_fa', 'body_en']
const FIELDS = ['id', 'version', 'cookie_days', 'pages', 'regions', ...STEP_FIELDS.map(f => `steps.${f}`)].join(',')
export const GUIDE_PATH = `/items/site_guides?fields=${FIELDS}&filter[status][_eq]=published&filter[active][_eq]=true&sort=-id&limit=10`

const LOCAL = `${import.meta.env?.BASE_URL ?? '/'}assets/guides/`
/* The published seed (apps/backstage/scripts/apply_schema.py reads the same
   guide.json and media). Used only when Directus and the /cms snapshot both
   fail; an empty published list means editors removed the guide. */
export const OFFLINE_GUIDE: RawGuide & { local: true } = {
  id: 0, version: 1, cookie_days: 365, pages: ['terminal'], regions: ['GLOBAL', 'IRAN'], local: true,
  steps: [
    { id: 'l1', sort: 1, status: 'published', media_kind: 'video', video_mp4: 'connect-wallet.mp4', video_webm: 'connect-wallet.webm', poster: 'connect-wallet.jpg',
      subtitles_fa: 'connect-wallet.fa.vtt', subtitles_en: 'connect-wallet.en.vtt',
      title_en: 'Connect your wallet and activate your account for trading', title_fa: 'کیف پول را وصل کنید و حسابتان را برای معامله فعال کنید',
      body_en: 'Connect your wallet, sign in with a signature (no transaction, no fee), then choose or activate your Prop or Perpetual account.',
      body_fa: 'کیف پول را وصل کنید، با یک امضا وارد شوید (بدون تراکنش و بدون کارمزد) و سپس حساب پراپ یا پرپچوال خود را انتخاب یا فعال کنید.' },
    { id: 'l2', sort: 2, status: 'published', media_kind: 'video', video_mp4: 'open-position.mp4', video_webm: 'open-position.webm', poster: 'open-position.jpg',
      subtitles_fa: 'open-position.fa.vtt', subtitles_en: 'open-position.en.vtt',
      title_en: 'Find a market and open a position', title_fa: 'بازار را پیدا کنید و موقعیت باز کنید',
      body_en: 'Search for a market, select the pair, set the size and leverage, and open the position on your demo account.',
      body_fa: 'بازار را جست‌وجو کنید، جفت‌ارز را انتخاب کنید، حجم و اهرم را تنظیم کنید و موقعیت را روی حساب دموی خود باز کنید.' },
  ],
}

const asset = (id: string | null | undefined, local: boolean) =>
  !id ? null : local ? LOCAL + id : `${directusUrl()}/assets/${encodeURIComponent(id)}`

export function normalizeGuide(raw: RawGuide & { local?: boolean }, locale: AppLocale): Guide | null {
  const local = Boolean(raw.local)
  const fa = locale === 'fa'
  const steps = (raw.steps ?? [])
    .filter(s => (s.status ?? 'published') === 'published' && s.title_en && s.title_fa)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((s): GuideStep | null => {
      const kind = s.media_kind === 'image' ? 'image' : 'video'
      const step: GuideStep = {
        id: String(s.id), kind,
        mp4: kind === 'video' ? asset(s.video_mp4, local) : null, webm: kind === 'video' ? asset(s.video_webm, local) : null,
        image: kind === 'image' ? asset(s.image, local) : null, poster: asset(s.poster, local),
        subtitles: { fa: asset(s.subtitles_fa, local), en: asset(s.subtitles_en, local) },
        title: (fa ? s.title_fa : s.title_en) ?? '', body: (fa ? s.body_fa : s.body_en) ?? '',
      }
      return (kind === 'video' ? step.mp4 || step.webm : step.image) ? step : null
    })
    .filter((s): s is GuideStep => Boolean(s))
  if (!steps.length) return null
  return {
    id: String(raw.id), version: Math.max(1, Math.trunc(raw.version ?? 1)),
    cookieDays: Math.min(730, Math.max(1, Math.trunc(raw.cookie_days ?? 365))), steps,
  }
}

/** The active terminal guide for this region, or null. */
export async function selectGuide(locale: AppLocale, fetchList: (path: string) => Promise<RawGuide[] | null> = getCmsJson): Promise<Guide | null> {
  const fetched = await fetchList(GUIDE_PATH)
  const list: (RawGuide & { local?: boolean })[] = fetched ?? [OFFLINE_GUIDE]
  const region = publicRuntimeConfig().region === 'IRAN' ? 'IRAN' : 'GLOBAL'
  for (const raw of list) {
    if (!(raw.pages ?? []).includes('terminal') || !(raw.regions ?? []).includes(region)) continue
    const guide = normalizeGuide(raw, locale)
    if (guide) return guide
  }
  return null
}

/* ---------- "Don't show again": a cookie with the version only ---------- */
export const cookieName = (guideId: string) => `of_guide_${guideId.replace(/[^0-9a-z-]/gi, '')}`
export function optedOut(guide: Guide, cookies = typeof document === 'undefined' ? '' : document.cookie): boolean {
  const name = cookieName(guide.id) + '='
  const value = cookies.split(/;\s*/).find(c => c.startsWith(name))?.slice(name.length)
  return value === String(guide.version)
}
export function cookieString(guide: Guide, optOut: boolean, secure: boolean): string {
  const base = `${cookieName(guide.id)}=${optOut ? guide.version : ''}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`
  return optOut ? `${base}; Max-Age=${guide.cookieDays * 86_400}` : `${base}; Max-Age=0`
}
export function setOptOut(guide: Guide, optOut: boolean) {
  try { document.cookie = cookieString(guide, optOut, location.protocol === 'https:') } catch { /* cookies blocked: shows again next time */ }
}

/* ---------- counters: once per guide, version and event per page view ---------- */
const reported = new Set<string>()
export function reportGuide(guide: Guide, event: 'shown' | 'completed' | 'opted_out') {
  if (guide.id === '0') return /* offline fallback: nothing to attribute */
  const key = `${guide.id}:${guide.version}:${event}`
  if (reported.has(key)) return
  reported.add(key)
  const body = JSON.stringify({ guideId: guide.id, version: guide.version, event })
  try {
    if (navigator.sendBeacon?.('/guides/events', new Blob([body], { type: 'application/json' }))) return
  } catch { /* fall through */ }
  void fetch('/guides/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
}

/** Opens the guide from anywhere in the terminal (the menu's "Guide" entry). */
export const GUIDE_OPEN_EVENT = 'openfund:guide-open'
export const openGuide = () => window.dispatchEvent(new Event(GUIDE_OPEN_EVENT))
