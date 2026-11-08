/* ============================================================
   Openfund locales — one definition for routing, direction and the
   language selector. The application's established convention is a
   Persian/English pair at every call site (`t(fa, en)`); the three added
   locales extend that convention instead of replacing it: their strings
   are looked up by the English source text in ./messages, and any string
   without a reviewed translation falls back to English (never to Persian
   and never to an invented text).
   ============================================================ */
import { lookup } from './messages'

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

/** Editorial (CMS/seed) content exists in Persian and English only. The
 *  added locales display the English editorial version, labelled as such. */
export const contentLocale = (locale: AppLocale): 'fa' | 'en' => (locale === 'fa' ? 'fa' : 'en')
export const hasEditorialTranslation = (locale: AppLocale) => locale === 'fa' || locale === 'en'

/** Interface string for `locale` from the existing Persian/English pair. */
export function pick(locale: AppLocale, fa: string, en: string): string {
  if (locale === 'fa') return fa
  if (locale === 'en') return en
  return lookup(locale, en) ?? en
}
/** `{fa, en}` record (CMS rows, labels) → string for `locale` */
export function pickRecord(locale: AppLocale, value: { fa?: string; en?: string } | null | undefined): string {
  if (!value) return ''
  return pick(locale, value.fa ?? value.en ?? '', value.en ?? value.fa ?? '')
}

/** Current UI locale as published by the shells on `window.ofLang`. */
export function currentLocale(): AppLocale {
  return normalizeLocale(typeof window !== 'undefined' ? (window as Window & { ofLang?: string }).ofLang : undefined, 'fa')
}

/** Same page in another locale: replaces the leading `/:locale/` segment. */
export function switchLocalePath(pathname: string, to: AppLocale): string {
  const parts = pathname.split('/')
  if (isLocale(parts[1])) { parts[1] = to; return parts.join('/') }
  return `/${to}/home`
}

/** Persisted preference (existing `of-language` key) — any supported locale. */
export function storedLocale(): AppLocale {
  try { return normalizeLocale(localStorage.getItem('of-language'), 'fa') } catch { return 'fa' }
}

/** Localized notice shown when editorial content is displayed in English. */
export function fallbackNotice(locale: AppLocale): string | null {
  if (hasEditorialTranslation(locale)) return null
  return pick(locale, '', `This page is not yet available in ${{ ar: 'Arabic', ru: 'Russian', 'zh-CN': 'Simplified Chinese' }[locale as AddedLocale]}. The English version is shown.`)
}

/** Intl locale tag for number/date formatting of interface text. */
export const intlLocale = (locale: AppLocale) => ({ fa: 'fa-IR', en: 'en-US', ar: 'ar', ru: 'ru-RU', 'zh-CN': 'zh-CN' }[locale])
