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

test('lotage is unavailable where no industry-standard lot exists (Gains itself has no lots)', () => {
  /* the verified Gains metadata carries no lot fields; crypto, stocks, indices and
     non-standard commodities get an explained "unavailable", never a guessed size */
  for (const [meta, reason] of [
    [{ symbol: 'BTC/USD', base: 'BTC', quote: 'USD', group: 'crypto', sizePrecision: 5 }, 'no_lot_standard_crypto'],
    [{ symbol: 'AAPL/USD', base: 'AAPL', quote: 'USD', group: 'stocks', sizePrecision: 3 }, 'no_lot_standard_stocks'],
    [{ symbol: 'SPY/USD', base: 'SPY', quote: 'USD', group: 'indices', sizePrecision: 3 }, 'no_lot_standard_indices'],
    [{ symbol: 'XPT/USD', base: 'XPT', quote: 'USD', group: 'commodities', sizePrecision: 3 }, 'no_lot_standard_commodity'],
    [{ symbol: 'HG/USD', base: 'HG', quote: 'USD', group: 'commodities', sizePrecision: 3 }, 'no_lot_standard_commodity'],
  ]) {
    const spec = PS.lotSpec(meta, meta.symbol)
    assert.equal(spec.available, false, meta.symbol)
    assert.equal(spec.reason, reason, meta.symbol)
    assert.deepEqual(PS.quantityFromLots('1', spec), { ok: false, reason: 'no_approved_contract_spec' })
    assert.equal(PS.lotsFromQuantity('100', spec), null)
  }
  assert.deepEqual(Object.keys(PS.APPROVED_LOT_SPECS), [])
  /* unapproved contract metadata is ignored */
  assert.equal(PS.lotSpec({ base: 'BTC', group: 'crypto', contractSpec: { contractSize: 100, lotStep: '0.01', lotMin: '0.01' } }, 'BTC/USD').available, false)
})

test('lotage conventions: FX standard lot and the CME contract units for gold, silver and WTI', () => {
  const fx = PS.lotSpec({ symbol: 'EUR/USD', base: 'EUR', quote: 'USD', group: 'forex', sizePrecision: 0 }, 'EUR/USD')
  assert.deepEqual([fx.available, fx.contractSize, fx.baseUnit, fx.lotMin, fx.lotStep], [true, '100000', 'EUR', '0.01', '0.01'])
  assert.equal(PS.lotSpec({ symbol: 'GBP/USD', base: 'GBP', quote: 'USD', group: 'forex-minor' }, 'GBP/USD').baseUnit, 'GBP')
  /* the engine values positions in USD only: non-USD quotes get no lotage */
  assert.deepEqual(PS.lotSpec({ symbol: 'USD/JPY', base: 'USD', quote: 'JPY', group: 'forex', sizePrecision: 3 }, 'USD/JPY'), { available: false, reason: 'non_usd_quote' })
  const unit = (base) => PS.lotSpec({ symbol: base + '/USD', base, quote: 'USD', group: 'commodities', sizePrecision: 3 }, base + '/USD')
  assert.deepEqual([unit('XAU').contractSize, unit('XAU').baseUnit], ['100', 'troy oz'])
  assert.deepEqual([unit('XAG').contractSize, unit('XAG').baseUnit], ['5000', 'troy oz'])
  assert.deepEqual([unit('WTI').contractSize, unit('WTI').baseUnit], ['1000', 'barrels'])
  /* an explicitly approved per-market specification wins over the convention */
  assert.equal(PS.lotSpec({ base: 'XAU', group: 'commodities', contractSpec: { approved: true, contractSize: '10', lotStep: '0.1', lotMin: '0.1' } }, 'XAU/USD').contractSize, '10')
})

test('lotage round trip keeps the economic size: lots → quantity → collateral → engine quantity → lots', () => {
  const fx = PS.lotSpec({ symbol: 'EUR/USD', base: 'EUR', quote: 'USD', group: 'forex' }, 'EUR/USD')
  const q = PS.quantityFromLots('0.25', fx)
  assert.deepEqual(q, { ok: true, quantity: '25000' })                       /* 0.25 × 100,000 EUR */
  const coll = PS.collateralFromQuantity({ quantity: q.quantity, leverage: 100, price: '1.08345' })
  assert.equal(coll, '270.87')                                               /* 25,000 × 1.08345 / 100, rounded UP to cents */
  const engineQty = PS.quantityFromCollateral({ collateral: coll, leverage: 100, price: '1.08345', quantityPrecision: 0 })
  assert.ok(Number(engineQty) >= 25000 && Number(engineQty) < 25001, engineQty)  /* never smaller than requested */
  assert.equal(PS.lotsFloor(engineQty, fx), '0.25')
  /* gold: 0.1 lot = 10 oz; the notional is quantity × price exactly */
  const xau = PS.lotSpec({ symbol: 'XAU/USD', base: 'XAU', quote: 'USD', group: 'commodities' }, 'XAU/USD')
  assert.deepEqual(PS.quantityFromLots('0.1', xau), { ok: true, quantity: '10' })
  assert.equal(PS.collateralFromQuantity({ quantity: '10', leverage: 50, price: '2411.37' }), '482.28')
  /* budget buttons round DOWN to the lot step */
  assert.equal(PS.lotsFloor('26999', fx), '0.26')
  assert.equal(PS.lotsFloor('999', fx), '0')
  assert.equal(PS.lotsFloor('12.349', xau), '0.12')
})

test('lotage limits: minimum, step and precision are enforced; no float drift', () => {
  const fx = PS.lotSpec({ symbol: 'GBP/USD', base: 'GBP', quote: 'USD', group: 'forex' }, 'GBP/USD')
  assert.equal(PS.quantityFromLots('0.009', fx).reason, 'below_lot_min')
  assert.equal(PS.quantityFromLots('0.015', fx).reason, 'off_lot_step')
  assert.equal(PS.quantityFromLots('0', fx).reason, 'invalid_lots')
  assert.deepEqual(PS.quantityFromLots('0.3', fx), { ok: true, quantity: '30000' })  /* 0.1 + 0.2 style drift impossible */
  assert.equal(PS.lotsFromQuantity('30000', fx), '0.3')
  assert.equal(PS.quantityOnGrid('30000', 0), true)
  assert.equal(PS.quantityOnGrid('30000.5', 0), false)
})

test('lot conversion with an approved specification (illustrative XAU 100 oz)', () => {
  const spec = PS.lotSpec({ base: 'XAU', contractSpec: { approved: true, contractSize: '100', lotStep: '0.01', lotMin: '0.01', lotMax: '50', baseUnit: 'oz' } }, 'XAU/USD')
  assert.equal(spec.available, true)
  assert.deepEqual(PS.quantityFromLots('1', spec), { ok: true, quantity: '100' })
  assert.deepEqual(PS.quantityFromLots('0.25', spec), { ok: true, quantity: '25' })
  assert.equal(PS.quantityFromLots('0.005', spec).reason, 'below_lot_min')
  assert.equal(PS.quantityFromLots('0.015', spec).reason, 'off_lot_step')
  assert.equal(PS.quantityFromLots('51', spec).reason, 'above_lot_max')
  assert.equal(PS.lotsFromQuantity('250', spec), '2.5')
})
