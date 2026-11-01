import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
const require = createRequire(import.meta.url)

function load(path) {
  const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports)
  return module.exports
}
const { normalizeQuery, filterMarkets, groupCounts, formatPrice, usablePrice, isStale, isValidMarket, CATEGORY_ORDER, CATEGORY_LABELS } = load('../src/features/markets/marketsData.ts')

const markets = [
  { symbol: 'BTC/USD', base: 'BTC', quote: 'USD', group: 'crypto', pricePrecision: 2, maxLeverage: 200, isOpen: true },
  { symbol: 'ETH/USD', base: 'ETH', quote: 'USD', group: 'crypto', pricePrecision: 2, maxLeverage: 100, isOpen: true },
  { symbol: 'EUR/USD', base: 'EUR', quote: 'USD', group: 'forex', pricePrecision: 5, maxLeverage: 50, isOpen: true },
  { symbol: 'XAU/USD', base: 'XAU', quote: 'USD', group: 'commodities', pricePrecision: 3, maxLeverage: 4, isOpen: true },
  { symbol: 'SPY/USD', base: 'SPY', quote: 'USD', group: 'indices', pricePrecision: 2, maxLeverage: 20, isOpen: false },
]

test('category filtering keeps group order stable and counts derive from data', () => {
  assert.deepEqual(groupCounts(markets), { crypto: 2, forex: 1, commodities: 1, indices: 1 })
  assert.deepEqual(filterMarkets(markets, { category: 'crypto', query: '' }).map(m => m.symbol), ['BTC/USD', 'ETH/USD'])
  assert.equal(filterMarkets(markets, { category: 'forex', query: '' }).length, 1)
  assert.equal(filterMarkets(markets, { category: 'all', query: '' }).length, 5)
  assert.deepEqual(CATEGORY_ORDER, ['crypto', 'forex', 'stocks', 'indices', 'commodities'])
  assert.equal(CATEGORY_LABELS.commodities.fa, 'کالا')
})

test('search is normalized: persian digits, case, and english symbols in fa interface', () => {
  assert.equal(normalizeQuery('  BTC '), 'btc')
  assert.equal(normalizeQuery('۲۰۰'), '200')
  assert.equal(normalizeQuery('اTH'), 'اth') /* persian letters are not transliterated */
  assert.deepEqual(filterMarkets(markets, { category: 'all', query: 'btc' }).map(m => m.symbol), ['BTC/USD'])
  assert.deepEqual(filterMarkets(markets, { category: 'all', query: 'xau' }).map(m => m.symbol), ['XAU/USD'])
  /* search across symbol, base, quote and category aliases */
  assert.deepEqual(filterMarkets(markets, { category: 'all', query: 'eur/usd' }).map(m => m.symbol), ['EUR/USD'])
  assert.deepEqual(filterMarkets(markets, { category: 'all', query: 'indices' }).map(m => m.symbol), ['SPY/USD'])
  assert.deepEqual(filterMarkets(markets, { category: 'all', query: 'zzz' }), [])
})

test('search composes with category filtering', () => {
  assert.deepEqual(filterMarkets(markets, { category: 'crypto', query: 'eth' }).map(m => m.symbol), ['ETH/USD'])
  assert.deepEqual(filterMarkets(markets, { category: 'crypto', query: 'eur' }), [])
})

test('price formatting stays Latin LTR with source precision, clamped', () => {
  assert.equal(formatPrice(43250.5, 2), '43,250.50')
  assert.equal(formatPrice(1.23456, 5), '1.23456')
  assert.equal(formatPrice(1.23456, 99), '1.23456') /* clamped to 8 */
  assert.equal(formatPrice(0.5, 0), '0.50') /* min 2 fraction digits */
  assert.equal(formatPrice(12, undefined), '12.00') /* default precision */
})

test('price validity and staleness rules match the landing contract', () => {
  const now = Date.now()
  assert.equal(usablePrice(undefined), false)
  assert.equal(usablePrice({ mark: 0, updatedAt: now, direction: 0 }), false)
  assert.equal(usablePrice({ mark: NaN, updatedAt: now, direction: 0 }), false)
  assert.equal(usablePrice({ mark: 10, updatedAt: now, direction: 0 }), true)
  assert.equal(isStale({ mark: 10, updatedAt: now - 91_000, direction: 0 }, now), true)
  assert.equal(isStale({ mark: 10, updatedAt: now - 89_000, direction: 0 }, now), false)
})

test('market validation rejects malformed entries from the source envelope', () => {
  assert.equal(isValidMarket(markets[0]), true)
  assert.equal(isValidMarket({ symbol: '', base: 'X' }), false)
  assert.equal(isValidMarket({ base: 'X' }), false)
  assert.equal(isValidMarket(null), false)
})
