/* Markets directory — pure, locale-independent data logic.
 * The Gains Network public API is the authoritative market source (verified
 * 2026-10-31: GET /markets 488 symbols, /prices, WS prices channel). Fields
 * not provided by Gains (volume, 24h change, market cap) are never invented. */

export type GainsMarket = {
  symbol: string
  base: string
  quote?: string
  group?: string
  pricePrecision?: number | string
  maxLeverage?: number | string
  spreadRate?: number | string
  isOpen?: boolean
  [key: string]: unknown
}

export type PricePoint = {
  mark: number
  index?: number | null
  updatedAt: number
  direction: number
  tickAt?: number
}

export type CategoryKey = 'crypto' | 'forex' | 'stocks' | 'indices' | 'commodities'

export const CATEGORY_ORDER: CategoryKey[] = ['crypto', 'forex', 'stocks', 'indices', 'commodities']

export const CATEGORY_LABELS: Record<CategoryKey, { en: string; fa: string }> = {
  crypto: { en: 'Crypto', fa: 'رمزارز' },
  forex: { en: 'Forex', fa: 'فارکس' },
  stocks: { en: 'Stocks', fa: 'سهام' },
  indices: { en: 'Indices', fa: 'شاخص‌ها' },
  commodities: { en: 'Commodities', fa: 'کالا' },
}

/* Persian/Arabic digits and stray spacing are normalised so English symbols
   can be typed even in the Persian interface. */
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/[۰-۹٠-٩]/g, (c) => {
    const i = FA_DIGITS.indexOf(c)
    return String(i >= 0 ? i : AR_DIGITS.indexOf(c))
  })
}

export function isValidMarket(m: unknown): m is GainsMarket {
  return !!m && typeof (m as GainsMarket).symbol === 'string'
    && typeof (m as GainsMarket).base === 'string' && !!(m as GainsMarket).symbol
}

export function groupCounts(markets: GainsMarket[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const m of markets) {
    const g = m.group || 'other'
    counts[g] = (counts[g] || 0) + 1
  }
  return counts
}

export type FilterOptions = { category: CategoryKey | 'all'; query: string }

export function filterMarkets(markets: GainsMarket[], { category, query }: FilterOptions): GainsMarket[] {
  const q = normalizeQuery(query)
  return markets.filter(m => {
    if (category !== 'all' && (m.group || 'other') !== category) return false
    if (!q) return true
    return (m.symbol + ' ' + m.base + ' ' + (m.quote || '') + ' ' + (m.group || '')).toLowerCase().includes(q)
  })
}

/* Trading figures stay Latin LTR in both locales (terminal-wide rule). */
export function formatPrice(value: number, precision: number | string | undefined): string {
  const p = Math.max(0, Math.min(8, Number(precision) || 4))
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: Math.min(2, p), maximumFractionDigits: p })
}

export function usablePrice(p: PricePoint | undefined): p is PricePoint {
  return !!p && Number.isFinite(p.mark) && p.mark > 0 && Number.isFinite(p.updatedAt)
}

export function isStale(p: PricePoint, now = Date.now()): boolean {
  return now - p.updatedAt > 90_000
}
