/* Openfund contract specifications (ADR 0064): the engine module and the
   browser ticket (legacy/position-sizing.js) must define the same lot for
   every market. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contractSpec, quantityFromLots, lotsFromQuantity } from '../contract-specs.js'

const browser = (() => {
  const w = {}
  new Function('window', 'globalThis', readFileSync(new URL('../../web-react/public/legacy/position-sizing.js', import.meta.url), 'utf8'))(w, w)
  return w.OpenfundPositionSizing
})()
const catalog = JSON.parse(readFileSync(new URL('./fixtures/gains/markets.json', import.meta.url), 'utf8')).data

const metas = [
  ...catalog,
  ...['crypto', 'forex', 'stocks', 'indices', 'commodities', 'bonds'].flatMap(group =>
    ['BTC', 'PEPE', 'EUR', 'XAU', 'XAG', 'XPT', 'XPD', 'WTI', 'BRENT', 'NG', 'HG', 'CORN', 'SPX', 'AAPL'].flatMap(base =>
      [0, 2, 5, 10].flatMap(sizePrecision => [1, 4, 6, 10].map(pricePrecision => ({ symbol: `${base}/USD`, base, quote: 'USD', group, sizePrecision, pricePrecision }))))),
  { symbol: 'USD/JPY', base: 'USD', quote: 'JPY', group: 'forex', sizePrecision: 3 },
  { symbol: 'GBP/USD', base: 'GBP', quote: 'USD', group: 'forex-minor' },
]

test('the engine and the ticket define the same lot for every market', () => {
  for (const meta of metas) {
    const server = contractSpec(meta, meta.symbol), client = browser.lotSpec(meta, meta.symbol)
    const pick = s => s.available ? [true, s.contractSize, s.unit, s.lotMin, s.lotStep, s.lotMax, s.quantityPrecision, s.source] : [false, s.reason]
    assert.deepEqual(pick(client), pick(server), JSON.stringify(meta))
    if (server.available) for (const lots of ['0.01', '0.15', '1', '2.5', '0.015', '0.001']) {
      const a = quantityFromLots(lots, server), b = browser.quantityFromLots(lots, client)
      assert.deepEqual(a, b, `${meta.symbol} ${lots}`)
    }
  }
})

test('Openfund lot definitions', () => {
  const spec = (group, base, extra = {}) => contractSpec({ group, base, quote: 'USD', sizePrecision: 4, ...extra }, `${base}/USD`)
  assert.equal(spec('forex', 'EUR').contractSize, '100000')
  assert.deepEqual([spec('commodities', 'XAU').contractSize, spec('commodities', 'XAU').unit], ['100', 'troy oz'])
  assert.equal(spec('commodities', 'XAG').contractSize, '5000')
  assert.equal(spec('commodities', 'WTI').contractSize, '1000')
  assert.equal(spec('commodities', 'NG').contractSize, '10000')
  assert.equal(spec('commodities', 'HG').contractSize, '25000')
  assert.equal(spec('stocks', 'AAPL').contractSize, '100')
  assert.equal(spec('indices', 'SPX').contractSize, '1')
  assert.equal(spec('crypto', 'BTC', { pricePrecision: 1 }).contractSize, '1')
  assert.equal(spec('crypto', 'DOGE', { pricePrecision: 6 }).contractSize, '100')
  assert.equal(spec('crypto', 'PEPE', { pricePrecision: 10 }).contractSize, '1000000')
  assert.deepEqual(contractSpec({ group: 'forex', base: 'USD', quote: 'JPY' }, 'USD/JPY'), { available: false, reason: 'non_usd_quote' })
})

test('lot grid follows the market quantity precision', () => {
  const idx = contractSpec({ group: 'indices', base: 'SPY', quote: 'USD', sizePrecision: 0 }, 'SPY/USD')
  assert.deepEqual([idx.lotMin, idx.lotStep], ['1', '1'])
  assert.equal(quantityFromLots('0.5', idx).reason, 'below_lot_min')
  const stock = contractSpec({ group: 'stocks', base: 'AAPL', quote: 'USD', sizePrecision: 0 }, 'AAPL/USD')
  assert.deepEqual(quantityFromLots('0.03', stock), { ok: true, quantity: '3' })
  const fx = contractSpec({ group: 'forex', base: 'EUR', quote: 'USD', sizePrecision: 0 }, 'EUR/USD')
  assert.equal(quantityFromLots('0.015', fx).reason, 'off_lot_step')
  assert.equal(lotsFromQuantity('25000', fx), '0.25')
})
