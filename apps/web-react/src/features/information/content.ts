export type Locale = 'en' | 'fa'
export type Localized<T = string> = Record<Locale, T>
export const text = (en: string, fa: string): Localized => ({ en, fa })
export const number = (value: number, locale: Locale, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', options).format(value)
/** Public website pages — one authoritative navigation definition (menu order included). */
export type InfoPage = 'rulebook' | 'transparency' | 'revenue-model' | 'live-market-access' | 'ambassador' | 'coach' | 'markets' | 'challenges' | 'home' | 'faq' | 'referral' | 'tools' | 'learn'
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
