// Price compatibility validator + symbol mapping verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCompatibility, limitsFor, priceDiff, STATUS } from '../src/compat.mjs';
import { CANDIDATE_MARKETS, candidateFor, verifyMarket, tickAt, priceDecimals } from '../src/markets.mjs';

const TF = 60_000;
const CAL = { n: 300, medianBps: 4, madBps: 0.5, p05Bps: 3, p95Bps: 5, p99Bps: 6 };
function series(n, gains, hlBpsFn) {
  const bars = [], last = new Map();
  for (let i = 0; i < n; i++) {
    const time = i * TF;
    bars.push({ time, close: gains });
    last.set(time, { price: gains * (1 + hlBpsFn(i) / 1e4), time: time + TF - 1000 });
  }
  return { bars, last };
}

test('priceDiff reports absolute, percent and bps', () => {
  const d = priceDiff(100025, 100000);
  assert.equal(d.abs, 25);
  assert.ok(Math.abs(d.bps - 2.5) < 1e-9);
});

test('limits come from the measured band of each market, floored by ticks', () => {
  const l = limitsFor(CAL, 0.1);
  assert.equal(l.centerBps, 4);
  assert.equal(l.warnBps, 4);   // band = 2 bps
  assert.equal(l.hideBps, 10);
  assert.equal(limitsFor({ ...CAL, n: 5 }, 0.1), null, 'too few samples is not a calibration');
  assert.equal(limitsFor(CAL, 10).warnBps, 20, 'coarse tick widens the floor');
});

test('a normal basis is ok and nothing is repriced', () => {
  const { bars, last } = series(20, 100000, () => 4.2);
  const before = JSON.stringify(bars);
  const r = assessCompatibility({ gainsBars: bars, hlLast: last, tfMs: TF, calibration: CAL, tickPrice: 1, feed: { connected: true, lastHeartbeat: 1 }, now: 2 });
  assert.equal(r.status, STATUS.OK);
  assert.equal(JSON.stringify(bars), before, 'input bars untouched');
});

test('an unusual basis warns; an incompatible one hides', () => {
  const warn = series(20, 100000, () => 4 + 6);
  assert.equal(assessCompatibility({ gainsBars: warn.bars, hlLast: warn.last, tfMs: TF, calibration: CAL, tickPrice: 1 }).status, STATUS.WARN);
  const hide = series(20, 100000, () => 4 + 50);
  assert.equal(assessCompatibility({ gainsBars: hide.bars, hlLast: hide.last, tfMs: TF, calibration: CAL, tickPrice: 1 }).status, STATUS.HIDE);
});

test('stale or disconnected feed is reported as stale, never live', () => {
  const { bars, last } = series(10, 100000, () => 4);
  assert.equal(assessCompatibility({ gainsBars: bars, hlLast: last, tfMs: TF, calibration: CAL, feed: { connected: false } }).status, STATUS.STALE);
  assert.equal(assessCompatibility({ gainsBars: bars, hlLast: last, tfMs: TF, calibration: CAL, feed: { connected: true, lastHeartbeat: 0 }, now: 60_000 }).status, STATUS.STALE);
});

test('a last trade far from the bar end is not compared', () => {
  const bars = [{ time: 0, close: 100 }];
  const last = new Map([[0, { price: 200, time: 0 }]]);
  const r = assessCompatibility({ gainsBars: bars, hlLast: last, tfMs: 3_600_000, calibration: CAL, tickPrice: 0.01 });
  assert.equal(r.samples, 0);
});

test('without stored calibration the band is estimated from 30+ own samples', () => {
  const few = series(10, 100, () => 3);
  assert.equal(assessCompatibility({ gainsBars: few.bars, hlLast: few.last, tfMs: TF, calibration: null, tickPrice: 0.01 }).status, STATUS.CALIBRATING);
  const many = series(40, 100, (i) => 3 + (i % 3) * 0.5);
  assert.equal(assessCompatibility({ gainsBars: many.bars, hlLast: many.last, tfMs: TF, calibration: null, tickPrice: 0.01 }).status, STATUS.OK);
});

test('candidate mapping covers crypto, gold, silver and forex; lookup strips the provider prefix', () => {
  assert.equal(CANDIDATE_MARKETS.length, 8);
  assert.equal(candidateFor('gains:XAU/USD').coin, 'xyz:GOLD');
  assert.equal(candidateFor('DOGE/USD'), null, 'unmapped market is unsupported');
});

test('verifyMarket requires listing, size precision and a measured compatible basis', () => {
  const c = candidateFor('BTC/USD');
  assert.equal(verifyMarket(c, [], CAL).reasons[0], 'market_not_listed');
  assert.equal(verifyMarket(c, [{ name: 'BTC', szDecimals: 5, isDelisted: true }], CAL).reasons[0], 'market_delisted');
  assert.equal(verifyMarket(c, [{ name: 'BTC', szDecimals: 5 }], null).reasons[0], 'basis_not_measured');
  assert.equal(verifyMarket(c, [{ name: 'BTC', szDecimals: 5 }], { ...CAL, medianBps: 9000 }).reasons[0], 'basis_incompatible');
  const ok = verifyMarket(c, [{ name: 'BTC', szDecimals: 5 }], CAL);
  assert.equal(ok.status, 'supported');
  assert.equal(ok.priceDecimals, 1);
});

test('tick follows the 5-significant-figure and decimal rules', () => {
  assert.equal(priceDecimals(5), 1);
  assert.equal(tickAt(74643, 5), 1);
  assert.equal(tickAt(120000, 5), 1, 'integer prices always valid');
  assert.equal(tickAt(2080.76, 4), 0.1);
  assert.ok(Math.abs(tickAt(1.1092, 1) - 0.0001) < 1e-12);
  assert.ok(Math.abs(tickAt(159.76, 2) - 0.01) < 1e-12);
});
