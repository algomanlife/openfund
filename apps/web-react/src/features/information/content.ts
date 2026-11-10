import { intlLocale, pickRecord, type AppLocale } from '../../i18n/locales'
import { localizeRecords } from '../../i18n/localize'

/** Page locale — any supported locale (fa, en, ar, ru, zh-CN). */
export type Locale = AppLocale
/** Source languages of bilingual records; added locales are resolved by `tx`. */
export type SourceLocale = 'en' | 'fa'
export type Localized<T = string> = Record<SourceLocale, T>
/** bilingual source record; `record[locale]` also resolves ar / ru / zh-CN (see i18n/localize) */
export const text = (en: string, fa: string): Localized => localizeRecords({ en, fa })
/** `{fa, en}` record → text for `locale` (added locales: reviewed translation of the English source). */
export const tx = (locale: AppLocale, value: Localized | { fa?: string; en?: string } | null | undefined) => pickRecord(locale, value)
export const number = (value: number, locale: Locale, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(intlLocale(locale), options).format(value)
/** Public website pages — one authoritative navigation definition (menu order included). */
export type InfoPage = 'rulebook' | 'transparency' | 'revenue-model' | 'live-market-access' | 'ambassador' | 'coach' | 'markets' | 'challenges' | 'home' | 'faq' | 'referral' | 'tools' | 'learn' | 'whitepaper'
export const labels = {
  home: text('Home', 'خانه'),
  challenges: text('Trading Challenges', 'چلنج‌های معاملاتی'),
  markets: text('Markets', 'بازارها'),
  rulebook: text('Trading Rules', 'قوانین معاملاتی'),
  transparency: text('Transparency', 'شفافیت'),
  economy: text('Economy', 'اقتصاد'),
  'revenue-model': text('Revenue Model', 'مدل درآمدی'),
  'live-market-access': text('Live Market Access', 'اتصال به بازار'),
  ambassador: text('Brand Ambassador', 'سفیر برند'),
  coach: text('Verified Trading Coach', 'کوچ معاملاتی تأییدشده'),
  faq: text('FAQ', 'پرسش‌های متداول'),
  referral: text('Growth Partner', 'همیار رشد'),
  tools: text('Tools', 'ابزارها'),
  learn: text('Learn', 'آموزش'),
  whitepaper: text('Whitepaper', 'وایت‌پیپر'),
  resources: text('Resources', 'منابع'),
  contents: text('On this page', 'در این صفحه'),
  top: text('Back to top ↑', 'بازگشت به بالا ↑'),
  current: text('Current demo', 'دموی فعلی'),
  draft: text('Draft · not active', 'پیش‌نویس · غیرفعال'),
  planned: text('Planned', 'برنامه‌ریزی‌شده'),
  sample: text('Sample data', 'دادهٔ نمونه'),
  updated: text('Reviewed 1 November 2026', 'بازبینی: ۱۰ آبان ۱۴۰۵'),
  skip: text('Skip to content', 'رفتن به محتوا'),
}
