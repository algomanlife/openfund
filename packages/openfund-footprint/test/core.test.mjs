// Footprint core: trade side, exact aggregation, dedup, ordering, stats.
// Fixtures are hand-built test inputs in the documented Hyperliquid WsTrade
// shape — they are not market data and never ship to the chart.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toUnits, normalizeTrade, MinuteBook, bucketBars, groupLevels, barStats, timeframeMs,
  nakedPocs, cumulativeDelta, rowPassesFilter, autoRowUnits, MINUTE_MS,
} from '../src/core.mjs';

const SPEC = { coin: 'BTC', priceDecimals: 1, szDecimals: 5 };
const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
const tr = (o) => ({ coin: 'BTC', side: 'B', px: '100000.0', sz: '0.10000', time: T0 + 1000, tid: 1, hash: '0xabc', users: ['0x1', '0x2'], ...o });

test('toUnits parses decimal strings exactly and rejects excess precision', () => {
  assert.equal(toUnits('74643.5', 1), 746435);
  assert.equal(toUnits('74643', 1), 746430);
  assert.equal(toUnits('0.00474', 5), 474);
  assert.equal(toUnits('1.23456', 2), null);
  assert.equal(toUnits('-1', 2), null);
  assert.equal(toUnits('1e5', 2), null);
  assert.equal(toUnits('', 2), null);
});

test('aggressor side follows the Hyperliquid trade side, never price movement', () => {
  const b = normalizeTrade(tr({ side: 'B' }), SPEC), a = normalizeTrade(tr({ side: 'A' }), SPEC);
  assert.equal(b.aggressor, 'buy');
  assert.equal(a.aggressor, 'sell');
  assert.equal(normalizeTrade(tr({ side: 'X' }), SPEC), null);
  assert.equal(normalizeTrade(tr({ coin: 'ETH' }), SPEC), null, 'other coin rejected');
  assert.equal(normalizeTrade(tr({ sz: '0' }), SPEC), null);
  assert.equal(normalizeTrade(tr({ tid: 'x' }), SPEC), null);
});

test('normalized trades drop counterparty addresses and tx hash', () => {
  const t = normalizeTrade(tr({}), SPEC);
  assert.deepEqual(Object.keys(t).sort(), ['aggressor', 'coin', 'lots', 'pu', 'tid', 'time']);
});

test('sell aggressors land in the bid column, buy aggressors in the ask column', () => {
  const book = new MinuteBook();
  book.add(normalizeTrade(tr({ side: 'A', sz: '0.30000', tid: 1 }), SPEC));
  book.add(normalizeTrade(tr({ side: 'B', sz: '0.20000', tid: 2 }), SPEC));
  book.add(normalizeTrade(tr({ side: 'B', sz: '0.05000', tid: 3 }), SPEC));
  const s = book.slice(T0);
  assert.deepEqual(s.levels, [[1000000, 30000, 25000, 1, 2]]);
  assert.equal(s.n, 3);
});

test('duplicate (time, tid) trades are ignored; same tid at another time is distinct', () => {
  const book = new MinuteBook();
  assert.equal(book.add(normalizeTrade(tr({ tid: 7 }), SPEC)), T0);
  assert.equal(book.add(normalizeTrade(tr({ tid: 7 }), SPEC)), null);
  assert.equal(book.duplicates, 1);
  assert.equal(book.add(normalizeTrade(tr({ tid: 7, time: T0 + 2000 }), SPEC)), T0);
  assert.equal(book.slice(T0).n, 2);
});

test('out-of-order trades land in their own minute and last price follows exchange time', () => {
  const book = new MinuteBook();
  book.add(normalizeTrade(tr({ time: T0 + 61_000, px: '100010.0', tid: 3 }), SPEC));
  book.add(normalizeTrade(tr({ time: T0 + 50_000, px: '100005.0', tid: 2 }), SPEC));
  book.add(normalizeTrade(tr({ time: T0 + 10_000, px: '100001.0', tid: 1 }), SPEC));
  assert.equal(book.slice(T0).n, 2);
  assert.equal(book.slice(T0).lastPu, 1000050);
  assert.equal(book.slice(T0 + MINUTE_MS).n, 1);
});

test('higher timeframes sum per-level volume exactly (POC/delta survive aggregation)', () => {
  const book = new MinuteBook();
  let tid = 0;
  for (let m = 0; m < 5; m++) {
    book.add(normalizeTrade(tr({ time: T0 + m * MINUTE_MS + 1, px: '100000.0', side: 'B', sz: '0.00001', tid: ++tid }), SPEC));
    book.add(normalizeTrade(tr({ time: T0 + m * MINUTE_MS + 2, px: '100001.0', side: 'A', sz: '0.00003', tid: ++tid }), SPEC));
  }
  const slices = [0, 1, 2, 3, 4].map(m => book.slice(T0 + m * MINUTE_MS));
  const bars = bucketBars(slices, timeframeMs('5'), 1);
  assert.equal(bars.size, 1);
  const bar = bars.get(T0);
  assert.deepEqual(bar.rows, [[1000000, 0, 5, 0, 5], [1000010, 15, 0, 5, 0]]);
  const st = barStats(bar.rows, { rowUnits: 10 });
  assert.equal(st.volume, 20);
  assert.equal(st.delta, -10);
  assert.equal(bar.rows[st.pocIdx][0], 1000010);
  assert.equal(bar.minutes, 5);
});

test('row grouping floors exact prices to the row, never shifts them', () => {
  const rows = groupLevels([[1001, 1, 0, 1, 0], [1009, 0, 2, 0, 1], [1010, 3, 0, 1, 0]], 10);
  assert.deepEqual(rows, [[1000, 1, 2, 1, 1], [1010, 3, 0, 1, 0]]);
});

test('timeframes: minute divisors of a day and D; others rejected', () => {
  assert.equal(timeframeMs('1'), 60_000);
  assert.equal(timeframeMs('240'), 240 * 60_000);
  assert.equal(timeframeMs('D'), 86_400_000);
  assert.equal(timeframeMs('7'), null);
  assert.equal(timeframeMs('W'), null);
});

test('diagonal imbalance: ask vs bid one row below, bid vs ask one row above', () => {
  // price rows 0..3 (rowUnits 1): [pu, bid, ask]
  const rows = [[0, 10, 1, 1, 1], [1, 2, 40, 1, 1], [2, 1, 50, 1, 1], [3, 30, 60, 1, 1]];
  const st = barStats(rows, { rowUnits: 1, imbalanceRatioPct: 300, stackedMin: 3 });
  // ask@1=40 vs bid@0=10 → 4× ⇒ buy imbalance; ask@2=50 vs bid@1=2 ⇒ yes; ask@3=60 vs bid@2=1 ⇒ yes
  assert.equal(st.imbalance[1] & 1, 1);
  assert.equal(st.imbalance[2] & 1, 1);
  assert.equal(st.imbalance[3] & 1, 1);
  assert.equal(st.imbalance[0] & 1, 0, 'bottom edge has no diagonal');
  // bid@0=10 vs ask@1=40 ⇒ no sell imbalance
  assert.equal(st.imbalance[0] & 2, 0);
  assert.equal(st.imbalance[3] & 2, 0, 'top edge has no diagonal');
  assert.deepEqual(st.stacked, [{ side: 'buy', fromIdx: 1, toIdx: 3 }]);
});

test('an untraded diagonal row inside the bar counts as zero', () => {
  const rows = [[0, 5, 0, 1, 0], [2, 0, 9, 0, 1]]; // row 1 untraded
  const st = barStats(rows, { rowUnits: 1 });
  assert.equal(st.imbalance[1] & 1, 1, 'ask@2 vs bid@1 (=0) is an imbalance');
});

test('stacked imbalance requires price-adjacent rows', () => {
  const rows = [[0, 1, 0, 1, 0], [1, 0, 9, 0, 1], [2, 0, 9, 0, 1], [4, 0, 9, 0, 1], [5, 1, 0, 1, 0]];
  const st = barStats(rows, { rowUnits: 1, stackedMin: 3 });
  assert.deepEqual(st.stacked, []);
});

test('value area expands from the POC to the requested share of volume', () => {
  const rows = [[0, 5, 5, 1, 1], [1, 10, 10, 1, 1], [2, 30, 30, 1, 1], [3, 10, 10, 1, 1], [4, 2, 3, 1, 1]];
  const st = barStats(rows, { valueAreaPct: 70 });
  assert.equal(st.pocIdx, 2);
  const inside = rows.slice(st.vaLoIdx, st.vaHiIdx + 1).reduce((s, r) => s + r[1] + r[2], 0);
  assert.ok(inside >= 0.7 * st.volume);
  assert.ok(st.vaLoIdx <= 2 && st.vaHiIdx >= 2);
});

test('delta %, buy/sell %, trade counts', () => {
  const st = barStats([[0, 25, 75, 3, 9]]);
  assert.equal(st.deltaPct, 50);
  assert.equal(st.buyPct, 75);
  assert.equal(st.trades, 12);
  assert.deepEqual(barStats([]).deltaPct, 0);
});

test('naked POC runs until a later bar trades through it; CVD accumulates delta', () => {
  const mk = (t, rows) => ({ t, rows, stats: barStats(rows) });
  const bars = [mk(1, [[10, 0, 9, 0, 1]]), mk(2, [[20, 1, 1, 1, 1], [21, 1, 1, 1, 1]]), mk(3, [[5, 1, 0, 1, 0], [10, 0, 1, 0, 1]])];
  const np = nakedPocs(bars);
  assert.deepEqual(np[0], { t: 1, pu: 10, untilT: 3 });
  assert.equal(np[1].untilT, null);
  assert.deepEqual(cumulativeDelta(bars), [9, 9, 9 + 0]);
});

test('volume filters blank rows outside the range; 0 disables a bound', () => {
  assert.equal(rowPassesFilter([0, 1, 1], { volMin: 3 }), false);
  assert.equal(rowPassesFilter([0, 1, 5], { volMin: 3, askMax: 4 }), false);
  assert.equal(rowPassesFilter([0, 1, 3], { volMin: 0, volMax: 0 }), true);
});

test('auto row size picks a nice multiple reaching the minimum pixel height', () => {
  assert.equal(autoRowUnits(20, 14), 1);
  assert.equal(autoRowUnits(1, 14), 20);
  assert.equal(autoRowUnits(0.1, 14), 200);
  assert.equal(autoRowUnits(0, 14), 1);
});

test('minute book prunes beyond retention', () => {
  const book = new MinuteBook({ retainMinutes: 2 });
  book.add(normalizeTrade(tr({ time: T0 + 1 }), SPEC));
  book.add(normalizeTrade(tr({ time: T0 + 5 * MINUTE_MS, tid: 9 }), SPEC));
  book.prune(T0 + 5 * MINUTE_MS + 1);
  assert.equal(book.slice(T0), null);
  assert.ok(book.slice(T0 + 5 * MINUTE_MS));
});
