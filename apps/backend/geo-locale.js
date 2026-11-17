/* Geo-IP default language policy (ADR 0043, owner decision 3).

   One policy for both regions: the visitor's country chooses the DEFAULT
   locale of a first visit only. An explicit locale in the URL and a saved
   preference (`of-language`) always win; the client applies that order.

     IR → fa · RU → ru · CN → zh-CN · Arab League members → ar · others → en

   The Arabic list is the 22 member states of the League of Arab States
   (ISO 3166-1 alpha-2), not "the Middle East": Iran, Israel and Türkiye are
   not members. Codes that are not countries (Cloudflare's XX unknown, T1 Tor,
   A1/A2/O1 legacy anonymous codes, EU/AP regions) are unknown, never Iran. */

export const GEO_LOCALES = Object.freeze(['fa', 'en', 'ar', 'ru', 'zh-CN'])

/** League of Arab States members: DZ BH KM DJ EG IQ JO KW LB LY MR MA OM PS QA SA SO SD SY TN AE YE */
export const ARAB_LEAGUE_COUNTRIES = Object.freeze([
  'DZ', 'BH', 'KM', 'DJ', 'EG', 'IQ', 'JO', 'KW', 'LB', 'LY', 'MR',
  'MA', 'OM', 'PS', 'QA', 'SA', 'SO', 'SD', 'SY', 'TN', 'AE', 'YE',
])

const COUNTRY_LOCALE = Object.freeze({
  IR: 'fa', RU: 'ru', CN: 'zh-CN',
  ...Object.fromEntries(ARAB_LEAGUE_COUNTRIES.map(c => [c, 'ar'])),
})
const NOT_A_COUNTRY = new Set(['XX', 'T1', 'A1', 'A2', 'O1', 'EU', 'AP'])

/** ISO country code → its default locale; null when the country is unknown */
export function localeForCountry(country) {
  const c = typeof country === 'string' ? country.trim().toUpperCase() : ''
  if (!/^[A-Z]{2}$/.test(c) || NOT_A_COUNTRY.has(c)) return null
  return COUNTRY_LOCALE[c] ?? 'en'
}

/** The locale used when no trusted country is available. Default `en`;
 *  a region whose traffic has no geolocation source (IRAN on Liara is not
 *  behind Cloudflare) may set GEO_FALLBACK_LOCALE. */
export function fallbackLocale(env = process.env) {
  const v = env.GEO_FALLBACK_LOCALE
  if (v == null || v === '') return 'en'
  if (!GEO_LOCALES.includes(v)) throw Error(`GEO_FALLBACK_LOCALE must be one of ${GEO_LOCALES.join(', ')}`)
  return v
}

/** trusted country (or null) → the default locale for a first visit */
export function defaultLocale(country, fallback = 'en') {
  return localeForCountry(country) ?? fallback
}
