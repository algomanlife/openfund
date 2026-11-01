export type Locale = 'en' | 'fa'
export type Localized<T = string> = Record<Locale, T>
export const text = (en: string, fa: string): Localized => ({ en, fa })
export const number = (value: number, locale: Locale, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', options).format(value)
export const labels = {
  rulebook: text('Rulebook', 'قوانین'),
  transparency: text('Transparency', 'شفافیت'),
  contents: text('On this page', 'در این صفحه'),
  top: text('Back to top ↑', 'بازگشت به بالا ↑'),
  current: text('Current demo', 'دموی فعلی'),
  draft: text('Draft · not active', 'پیش‌نویس · غیرفعال'),
  planned: text('Planned', 'برنامه‌ریزی‌شده'),
  sample: text('Sample data', 'دادهٔ نمونه'),
  updated: text('Reviewed 1 November 2026', 'بازبینی: ۱۰ آبان ۱۴۰۵'),
  skip: text('Skip to content', 'رفتن به محتوا'),
}
