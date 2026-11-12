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

test('lots are unavailable without an approved contract specification', () => {
  /* the verified Gains metadata carries no lot fields */
  const spec = PS.lotSpec({ symbol: 'XAU/USD', base: 'XAU', group: 'commodities', sizePrecision: 4 }, 'XAU/USD')
  assert.equal(spec.available, false)
  assert.equal(spec.reason, 'no_approved_contract_spec')
  assert.deepEqual(PS.quantityFromLots('1', spec), { ok: false, reason: 'no_approved_contract_spec' })
  assert.equal(PS.lotsFromQuantity('100', spec), null)
  assert.deepEqual(Object.keys(PS.APPROVED_LOT_SPECS), [])
  /* unapproved contract metadata is ignored */
  assert.equal(PS.lotSpec({ contractSpec: { contractSize: 100, lotStep: '0.01', lotMin: '0.01' } }, 'XAU/USD').available, false)
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
