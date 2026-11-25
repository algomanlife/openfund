import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePrice, DEFAULT_CONFIG } from '../src/pricing.ts';
import { decimal, format, SCALE, ln, exp, LN2, abs } from '../src/decimal.ts';
import { TIME, sources, observation as o } from './helpers.mjs';
for (let mask = 0; mask < 8; mask++) test(`all source availability combinations: ${mask}`, () => {
  const observations = sources.filter((_, i) => mask & 1 << i).map(s => o(s));
  const result = calculatePrice('BTC/USD', observations, TIME);
  assert.equal(result.price, mask ? '100' : null);
  assert.equal(result.eligibleSourceCount, observations.length);
  assert.equal(result.pricingMode, ['UNAVAILABLE', 'SINGLE_SOURCE', 'DUAL_SOURCE', 'TRIPLE_SOURCE'][observations.length]);
  if (mask) assert.equal(result.sources.reduce((sum, s) => sum + decimal(s.weight), 0n), SCALE);
});
test('40/30/30 example and automatic dual renormalization', () => {
  const r = calculatePrice('BTC/USD', [o('gains', '95000'), o('hyperliquid', '95100'), o('gmx', '94950')], TIME);
  assert.equal(r.price, '95015'); assert.deepEqual(r.sources.map(x => x.weight).sort(), ['0.3', '0.3', '0.4']);
  const dual = calculatePrice('BTC/USD', [o('gains', '95000'), o('hyperliquid', '95100')], TIME);
  assert.equal(dual.sources.reduce((sum, s) => sum + decimal(s.weight), 0n), SCALE);
  assert(dual.price.startsWith('95042.857142857142857142857'));
});
test('divergent dual prices retain provenance and only an explicitly stale prior', () => {
  const previous = calculatePrice('BTC/USD', [o()], TIME);
  const r = calculatePrice('BTC/USD', [o('gains', '100'), o('gmx', '150')], TIME + 1, DEFAULT_CONFIG, previous);
  assert.equal(r.pricingMode, 'DIVERGENT'); assert.equal(r.price, '100'); assert.equal(r.stale, true); assert.equal(r.confidence, 0);
  assert.equal(calculatePrice('BTC/USD', [o('gains', '100'), o('gmx', '150')], TIME).price, null);
});
test('unverified independence cannot authorize exclusion of a hard outlier', () => {
  const r = calculatePrice('BTC/USD', [o('gains'), o('hyperliquid'), o('gmx', '1000')], TIME);
  assert.equal(r.pricingMode, 'DIVERGENT'); assert.equal(r.price, null); assert.equal(r.sources.filter(s => s.eligible).length, 3);
});
test('independent agreeing pair permits hard outlier exclusion and recalculation', () => {
  const r = calculatePrice('BTC/USD', [o('gains', '100', TIME, { independentEvidence: 'test independent A' }),
    o('hyperliquid', '100', TIME, { independentEvidence: 'test independent B' }), o('gmx', '1000')], TIME);
  assert.equal(r.pricingMode, 'DUAL_SOURCE'); assert.equal(r.price, '100'); assert.equal(r.sources.find(s => s.source === 'gmx').exclusionReason, 'independently_confirmed_outlier');
});
for (const value of ['0', '-1', 'NaN', 'Infinity', '1e99', '0x40', '9'.repeat(200)]) test(`invalid price: ${value.slice(0, 25)}`, () => {
  assert.equal(calculatePrice('BTC/USD', [o('gains', value)], TIME).price, null);
});
for (const [name, patch] of Object.entries({ stale: { timestamp: TIME - 10001 }, future: { timestamp: TIME + 1 },
  futureReceipt: { receivedAt: TIME + 1 }, wrongMarket: { marketId: 'ETH/USD' }, invalidQuote: { quoteValid: false },
  wrongSemantics: { semantics: 'LAST_TRADE' }, unverifiedMapping: { mappingVerified: false },
  timestampMissing: { timestamp: NaN }, receiptOnly: { timestampKind: 'RECEIPT' } })) test(`eligibility: ${name}`, () => {
  assert.equal(calculatePrice('BTC/USD', [o('gains', '100', TIME, patch)], TIME).price, null);
});
test('freshness half-life, alignment, zero weights, closures, reliability and dependency adjustment', () => {
  const r = calculatePrice('BTC/USD', [o()], TIME + 2000); assert.equal(r.sources[0].freshness.slice(0, 15), '0.5'); assert(r.confidence <= 25.000001);
  const misaligned = calculatePrice('BTC/USD', [o(), o('gmx', '100', TIME - 3000)], TIME); assert.equal(misaligned.eligibleSourceCount, 1);
  const zero = calculatePrice('BTC/USD', [o()], TIME, { ...DEFAULT_CONFIG, baseWeights: { gains: '0', hyperliquid: '0', gmx: '0' } }); assert.equal(zero.price, null);
  const closed = calculatePrice('BTC/USD', [o()], TIME, DEFAULT_CONFIG, null, 'CLOSED'); assert.equal(closed.pricingMode, 'MARKET_CLOSED'); assert.equal(closed.confidence, 0);
  const dep = calculatePrice('BTC/USD', sources.map(s => o(s, '100', TIME, { dependencyGroup: s === 'gmx' ? 'B' : 'A', dependencyEvidence: 'fixture dependency only' })), TIME);
  assert.equal(dep.sources.find(s => s.source === 'gains').independence, '0.5'); assert(dep.confidence < 100);
  assert.equal(calculatePrice('BTC/USD', [o('gains', '100', TIME, { reliability: '0' })], TIME).price, null);
});
test('integer log and exponential round trips across scales', () => {
  assert(abs(ln(2n * SCALE) - LN2) < 10n);
  for (const value of ['0.00000001', '0.1', '1', '1.5', '2', '100000', '999999999999999999999999999999999999']) {
    const x = decimal(value), log = ln(x);
    assert(Math.abs(Number(format(log)) - Math.log(Number(value))) < 1e-12);
    if (abs(log) < 60n * SCALE) { const round = exp(log); assert(Number(format(abs(round - x))) / Number(value) < 1e-12); }
  }
  assert.doesNotThrow(() => calculatePrice('BTC/USD', [o('gains', '0.000000000000000000000001'), o('gmx', '999999999999999999999999999999999999')], TIME));
});
test('seeded property tests: convexity, exact weight sum, determinism and equal-price identity', () => {
  let state = 987654321; const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
  for (let i = 0; i < 1000; i++) {
    const base = BigInt(random() + 100000), inputs = sources.map(s => o(s, format(base * SCALE + BigInt(random() % 100) * SCALE)));
    const r = calculatePrice('BTC/USD', inputs, TIME), reverse = calculatePrice('BTC/USD', [...inputs].reverse(), TIME);
    assert.deepEqual(r, reverse);
    if (r.price) {
      const prices = inputs.map(x => decimal(x.price)); const p = decimal(r.price);
      assert(prices.every(x => x <= p) || prices.some(x => x <= p)); assert(prices.some(x => x >= p));
      assert.equal(r.sources.reduce((sum, s) => sum + decimal(s.weight), 0n), SCALE);
    }
    assert.equal(calculatePrice('BTC/USD', sources.map(s => o(s, base.toString())), TIME).price, base.toString());
  }
});
test('per-source publication policies and clock-skew validation', () => {
  const config = { ...DEFAULT_CONFIG, version: 'slower-publication-test', sourcePolicies: { gains: { halfLifeMs: 10000, maxAgeMs: 30000 } } };
  assert.equal(calculatePrice('BTC/USD', [o()], TIME + 15000, config).pricingMode, 'SINGLE_SOURCE');
  assert.equal(calculatePrice('BTC/USD', [o('gains', '100', TIME, { receivedAt: TIME - 2000 })], TIME).sources[0].exclusionReason, 'clock_skew');
});
