/* Prop position sizing (legacy/position-sizing.js), loaded the way the
   terminal loads it. Conversions are exact decimals and mirror the engine:
   quantity = margin × leverage / entry rounded DOWN to quantity precision. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const load = (file, name) => { const w = {}; new Function('window', 'globalThis', readFileSync(new URL(file, import.meta.url), 'utf8'))(w, w); return w[name] }
const PS = load('../public/legacy/position-sizing.js', 'OpenfundPositionSizing')

test('collateral → quantity mirrors the engine (ROUND_DOWN to precision)', () => {
  assert.equal(PS.quantityFromCollateral({ collateral: '1000', leverage: 10, price: '50002.5', quantityPrecision: 5 }), '0.19999')
  assert.equal(PS.quantityFromCollateral({ collateral: '100', leverage: 20, price: '50000', quantityPrecision: 5 }), '0.04000')
  /* exact decimals: 0.1 × 3 / 0.3 = 1 with no binary floating-point drift */
  assert.equal(PS.quantityFromCollateral({ collateral: '0.1', leverage: 3, price: '0.3', quantityPrecision: 10 }), '1.0000000000')
})

test('quantity → collateral rounds UP to cents so the order never shrinks before engine rounding', () => {
  assert.equal(PS.collateralFromQuantity({ quantity: '0.05', leverage: 20, price: '50000' }), '125.00')
  assert.equal(PS.collateralFromQuantity({ quantity: '0.123', leverage: 7, price: '1.1' }), '0.02')
  assert.equal(PS.collateralFromQuantity({ quantity: '1', leverage: 3, price: '10' }), '3.34')
  /* round trip through the engine rule stays ≥ the requested quantity at the same price */
  const c = PS.collateralFromQuantity({ quantity: '0.12345', leverage: 15, price: '2345.67' })
  const back = PS.quantityFromCollateral({ collateral: c, leverage: 15, price: '2345.67', quantityPrecision: 5 })
  assert.ok(Number(back) >= 0.12345, back)
})

test('large and small values stay exact', () => {
  assert.equal(PS.collateralFromQuantity({ quantity: '123456789.123456789', leverage: 50, price: '1.0001' }), '2469382.70')
  assert.equal(PS.quantityFromCollateral({ collateral: '0.5', leverage: 1, price: '0.0000001234', quantityPrecision: 2 }), '4051863.85')
  assert.equal(PS.quantityFromCollateral({ collateral: 1e-7, leverage: 1, price: '1', quantityPrecision: 10 }), '0.0000001000')
})

test('invalid inputs return null, never a guessed value', () => {
  for (const bad of [{ collateral: '', leverage: 5, price: '1' }, { collateral: '-1', leverage: 5, price: '1' }, { collateral: '1', leverage: 0, price: '1' }, { collateral: '1', leverage: 5, price: '0' }, { collateral: 'abc', leverage: 5, price: '1' }])
    assert.equal(PS.quantityFromCollateral({ ...bad, quantityPrecision: 4 }), null)
  assert.equal(PS.collateralFromQuantity({ quantity: '0', leverage: 5, price: '1' }), null)
})

test('quantity precision grid', () => {
  assert.equal(PS.quantityOnGrid('0.12345', 5), true)
  assert.equal(PS.quantityOnGrid('0.123456', 5), false)
  assert.equal(PS.quantityOnGrid('10', 0), true)
})

test('every USD-quoted market has an Openfund lot; other quotes have none', () => {
  const spec = meta => PS.lotSpec(meta, meta.symbol)
  const rows = [
    [{ symbol: 'BTC/USD', base: 'BTC', quote: 'USD', group: 'crypto', pricePrecision: 1, sizePrecision: 5 }, '1', 'BTC', '0.01'],
    [{ symbol: 'DOGE/USD', base: 'DOGE', quote: 'USD', group: 'crypto', pricePrecision: 6, sizePrecision: 0 }, '100', 'DOGE', '0.01'],
    [{ symbol: 'PEPE/USD', base: 'PEPE', quote: 'USD', group: 'crypto', pricePrecision: 10, sizePrecision: 0 }, '1000000', 'PEPE', '0.01'],
    [{ symbol: 'AAPL/USD', base: 'AAPL', quote: 'USD', group: 'stocks', sizePrecision: 0 }, '100', 'AAPL', '0.01'],
    [{ symbol: 'SPY/USD', base: 'SPY', quote: 'USD', group: 'indices', sizePrecision: 0 }, '1', 'SPY', '1'],
    [{ symbol: 'SPX/USD', base: 'SPX', quote: 'USD', group: 'indices', sizePrecision: 2 }, '1', 'SPX', '0.01'],
    [{ symbol: 'EUR/USD', base: 'EUR', quote: 'USD', group: 'forex', sizePrecision: 0 }, '100000', 'EUR', '0.01'],
    [{ symbol: 'XAU/USD', base: 'XAU', quote: 'USD', group: 'commodities', sizePrecision: 3 }, '100', 'troy oz', '0.01'],
    [{ symbol: 'XAG/USD', base: 'XAG', quote: 'USD', group: 'commodities', sizePrecision: 2 }, '5000', 'troy oz', '0.01'],
    [{ symbol: 'XPT/USD', base: 'XPT', quote: 'USD', group: 'commodities', sizePrecision: 2 }, '50', 'troy oz', '0.01'],
    [{ symbol: 'WTI/USD', base: 'WTI', quote: 'USD', group: 'commodities', sizePrecision: 2 }, '1000', 'barrels', '0.01'],
    [{ symbol: 'HG/USD', base: 'HG', quote: 'USD', group: 'commodities', sizePrecision: 0 }, '25000', 'lb', '0.01'],
    [{ symbol: 'CORN/USD', base: 'CORN', quote: 'USD', group: 'commodities', sizePrecision: 1 }, '1', 'CORN', '0.1'],
  ]
  for (const [meta, size, unit, step] of rows) {
    const s = spec(meta)
    assert.deepEqual([s.available, s.contractSize, s.baseUnit, s.lotMin, s.lotStep, s.lotMax], [true, size, unit, step, step, null], meta.symbol)
  }
  assert.deepEqual(spec({ symbol: 'USD/JPY', base: 'USD', quote: 'JPY', group: 'forex', sizePrecision: 3 }), { available: false, reason: 'non_usd_quote' })
  assert.deepEqual(spec({ symbol: 'X/USD', base: 'X', quote: 'USD', group: 'bonds' }), { available: false, reason: 'unsupported_instrument' })
  assert.deepEqual(PS.quantityFromLots('1', spec({ symbol: 'USD/JPY', base: 'USD', quote: 'JPY', group: 'forex' })), { ok: false, reason: 'non_usd_quote' })
})

test('lots → exact quantity, and back', () => {
  const fx = PS.lotSpec({ symbol: 'EUR/USD', base: 'EUR', quote: 'USD', group: 'forex' }, 'EUR/USD')
  assert.deepEqual(PS.quantityFromLots('0.25', fx), { ok: true, quantity: '25000' })   /* 0.25 × 100,000 EUR */
  const xau = PS.lotSpec({ symbol: 'XAU/USD', base: 'XAU', quote: 'USD', group: 'commodities' }, 'XAU/USD')
  assert.deepEqual(PS.quantityFromLots('0.1', xau), { ok: true, quantity: '10' })      /* 0.1 lot gold = 10 oz */
  const btc = PS.lotSpec({ symbol: 'BTC/USD', base: 'BTC', quote: 'USD', group: 'crypto', pricePrecision: 1, sizePrecision: 5 }, 'BTC/USD')
  assert.deepEqual(PS.quantityFromLots('0.37', btc), { ok: true, quantity: '0.37' })
  const aapl = PS.lotSpec({ symbol: 'AAPL/USD', base: 'AAPL', quote: 'USD', group: 'stocks', sizePrecision: 0 }, 'AAPL/USD')
  assert.deepEqual(PS.quantityFromLots('0.05', aapl), { ok: true, quantity: '5' })     /* 5 shares */
  assert.equal(PS.lotsFromQuantity('30000', fx), '0.3')
  assert.equal(PS.lotsFloor('26999', fx), '0.26')
  assert.equal(PS.lotsFloor('999', fx), '0')
  assert.equal(PS.lotsFloor('12.349', xau), '0.12')
  /* the collateral estimate covers the exact quantity at the shown price */
  assert.equal(PS.collateralFromQuantity({ quantity: '10', leverage: 50, price: '2411.37' }), '482.28')
})

test('lotage limits: minimum, step and precision are enforced; no float drift', () => {
  const fx = PS.lotSpec({ symbol: 'GBP/USD', base: 'GBP', quote: 'USD', group: 'forex' }, 'GBP/USD')
  assert.equal(PS.quantityFromLots('0.009', fx).reason, 'below_lot_min')
  assert.equal(PS.quantityFromLots('0.015', fx).reason, 'off_lot_step')
  assert.equal(PS.quantityFromLots('0', fx).reason, 'invalid_lots')
  assert.deepEqual(PS.quantityFromLots('0.3', fx), { ok: true, quantity: '30000' })  /* 0.1 + 0.2 style drift impossible */
  const spy = PS.lotSpec({ symbol: 'SPY/USD', base: 'SPY', quote: 'USD', group: 'indices', sizePrecision: 0 }, 'SPY/USD')
  assert.equal(PS.quantityFromLots('0.5', spy).reason, 'below_lot_min')            /* whole index units only */
  assert.deepEqual(PS.quantityFromLots('3', spy), { ok: true, quantity: '3' })
  assert.equal(PS.quantityOnGrid('30000', 0), true)
  assert.equal(PS.quantityOnGrid('30000.5', 0), false)
})
