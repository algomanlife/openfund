/* ============================================================
   Openfund locales — one definition for routing, direction and the
   language selector. The application's established convention is a
   Persian/English pair at every call site (`t(fa, en)`); the three added
   locales extend that convention instead of replacing it: their strings
   are looked up by the English source text in ./messages (interface) and
   ./content (editorial). A string without a translation is never replaced
   silently: it is reported as a miss (window.__ofI18nMisses), the page shows
   a visible notice, and the locale acceptance tests fail.
   ============================================================ */
import { translateSource } from './messages'
import { interfaceOverride, interfaceSource } from './interfaceContent'

export const LOCALES = ['fa', 'en', 'ar', 'ru', 'zh-CN'] as const
export type AppLocale = typeof LOCALES[number]
/** locales whose strings come from ./messages (keyed by English source) */
export type AddedLocale = Exclude<AppLocale, 'fa' | 'en'>

export const LOCALE_NAMES: Record<AppLocale, string> = {
  fa: 'فارسی', en: 'English', ar: 'العربية', ru: 'Русский', 'zh-CN': '简体中文',
}
/** short code shown on compact selector buttons */
export const LOCALE_CODES: Record<AppLocale, string> = {
  fa: 'FA', en: 'EN', ar: 'AR', ru: 'RU', 'zh-CN': '中文',
}

export function isLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}
/** route/storage value → supported locale, or the given fallback */
export function normalizeLocale(value: unknown, fallback: AppLocale = 'fa'): AppLocale {
  return isLocale(value) ? value : fallback
}
export const isRtl = (locale: AppLocale) => locale === 'fa' || locale === 'ar'
export const dirOf = (locale: AppLocale): 'rtl' | 'ltr' => (isRtl(locale) ? 'rtl' : 'ltr')


/** Interface string for `locale` from the existing Persian/English pair. */
export function pick(locale: AppLocale, fa: string, en: string): string {
  const published = interfaceOverride(locale, fa, en)
  if (published !== undefined) return published
  if (locale === 'fa') return fa
  if (locale === 'en') return en
  return translateSource(locale, en)
}
/** Interpolated interface string. `fa` and `en` are literal templates with
 * `${name}` placeholders, so the registry records one stable editable key and
 * a published Directus value must keep exactly the same placeholders (the
 * interfaceOverride guard). Values are inserted after the editorial lookup,
 * so editors change wording and order, never the dynamic values. */
export function pickFormat(locale: AppLocale, fa: string, en: string, values: Record<string, string | number>): string {
  return pick(locale, fa, en).replace(/\$\{([^}]+)\}/g, (match, name: string) => Object.hasOwn(values, name) ? String(values[name]) : match)
}
/** `{fa, en}` record (CMS rows, labels) → string for `locale` */
export function pickRecord(locale: AppLocale, value: { fa?: string; en?: string } | null | undefined): string {
  if (!value) return ''
  const source = interfaceSource(value)
  const published = interfaceOverride(locale, source?.fa ?? value.fa ?? '', source?.en ?? value.en ?? '')
  if (published !== undefined) return published
  if (locale !== 'fa' && locale !== 'en') {
    const own = (value as Record<string, unknown>)[locale] /* CMS row or localizeRecords getter */
    if (typeof own === 'string') return own
  }
  return pick(locale, source?.fa ?? value.fa ?? value.en ?? '', source?.en ?? value.en ?? value.fa ?? '')
}

/** Current UI locale as published by the shells on `window.ofLang`. */
export function currentLocale(): AppLocale {
  const published = typeof window !== 'undefined' ? (window as Window & { ofLang?: string }).ofLang : undefined
  return isLocale(published) ? published : storedLocale()
}

/** Same page in another locale: replaces the leading `/:locale/` segment. */
export function switchLocalePath(pathname: string, to: AppLocale): string {
  const parts = pathname.split('/')
  if (isLocale(parts[1])) { parts[1] = to; return parts.join('/') }
  return `/${to}/home`
}

/** First-visit default chosen by the server from the visitor's trusted
 * country (runtime-config.js `geoLocale`, ADR 0043); English when absent. */
export function geoDefaultLocale(): AppLocale {
  const config = typeof window !== 'undefined' ? (window as Window & { __OPENFUND_RUNTIME_CONFIG__?: { geoLocale?: string } }).__OPENFUND_RUNTIME_CONFIG__ : undefined
  return normalizeLocale(config?.geoLocale, 'en')
}

/** Storage key of the visitor's EXPLICIT language choice (ADR 0043). It is
 * written only when the visitor picks a language in a LanguageSelect —
 * never because a page rendered in some locale. The older `of-language` key
 * is still written on every render for the classic scripts, but it records
 * the last displayed locale (a Geo-IP default, a shared /fa/ link, the
 * pre-0.7 Persian default), so it must never decide a first visit. */
export const LANGUAGE_CHOICE_KEY = 'of-language-choice'

/** Persist an explicit language choice; storage is optional. */
export function saveLocaleChoice(locale: AppLocale): void {
  try {
    localStorage.setItem(LANGUAGE_CHOICE_KEY, locale)
    localStorage.setItem('of-language', locale)
  } catch { /* Storage unavailable: the URL locale still applies. */ }
}

/** Locale for a route without one. Priority (ADR 0043): the URL locale (the
 * router handles it before this is consulted and it is never overridden),
 * then an explicit saved choice, then the Geo-IP default, then English. */
export function storedLocale(): AppLocale {
  try { return normalizeLocale(localStorage.getItem(LANGUAGE_CHOICE_KEY), geoDefaultLocale()) } catch { return geoDefaultLocale() }
}

/** Visible notice when some text on the page has no translation (see reportMiss). */
export function untranslatedNotice(locale: AppLocale): string {
  return pick(locale, 'بخشی از متن این صفحه هنوز ترجمه نشده و به انگلیسی نمایش داده می‌شود.', 'Some text on this page is not yet translated and is shown in English.')
}

/** Intl locale tag for number/date formatting of interface text. */
export const intlLocale = (locale: AppLocale) => ({ fa: 'fa-IR', en: 'en-US', ar: 'ar', ru: 'ru-RU', 'zh-CN': 'zh-CN' }[locale])
