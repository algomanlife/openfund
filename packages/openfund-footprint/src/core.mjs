/*
 * Openfund footprint core — pure, dependency-free, shared by the backend
 * ingestion service and the browser chart plugin.
 *
 * Data model
 *   Every value is derived from Hyperliquid EXECUTED trades only.
 *   - Prices are kept EXACT as integer "price units" (pu) = price × 10^priceDecimals,
 *     parsed from Hyperliquid's decimal strings. Nothing is ever shifted or
 *     re-priced; row grouping only floors pu to a multiple of the row height.
 *   - Sizes are kept EXACT as integer "lots" = size × 10^szDecimals, so sums
 *     never accumulate floating-point error.
 *   - Side follows the aggressor: Hyperliquid trade `side` "B" = the taker
 *     bought (lifted the ask), "A" = the taker sold (hit the bid). In footprint
 *     vocabulary aggressive SELLS print in the BID column, aggressive BUYS in the
 *     ASK column. Side is never inferred from price movement or candle color.
 *
 * Minute slice (storage + wire format)
 *   { t, levels: [[pu, bidLots, askLots, bidCount, askCount], …] (pu ascending),
 *     lastPu, lastTime, n }
 *   One slice per coin per UTC minute — the base aggregation every chart
 *   timeframe is re-bucketed from (sum of per-level values, never OHLCV).
 */

export const MINUTE_MS = 60_000;

/* ---------- exact decimal parsing ---------- */

/** "74643.5" → integer units at `decimals` (7464350 at 2). null when invalid
 *  or when the string carries more precision than `decimals` allows. */
export function toUnits(str, decimals) {
  const s = String(str ?? '').trim();
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) return null;
  const frac = (m[2] || '').replace(/0+$/, '');
  if (frac.length > decimals) return null;
  const v = Number(m[1] + frac.padEnd(decimals, '0'));
  return Number.isSafeInteger(v) ? v : null;
}

/** Inverse of {@link toUnits} for display: integer units → number. */
export const fromUnits = (units, decimals) => units / 10 ** decimals;

/* ---------- trade normalization ---------- */

/**
 * Normalize one Hyperliquid WsTrade into the footprint trade record.
 * `spec` = { coin, priceDecimals, szDecimals }. Returns null (and never
 * guesses) when any field is missing or malformed. Counterparty addresses
 * (`users`) and the tx hash are dropped — the footprint never stores them.
 */
export function normalizeTrade(raw, spec) {
  if (!raw || raw.coin !== spec.coin) return null;
  const aggressor = raw.side === 'B' ? 'buy' : raw.side === 'A' ? 'sell' : null;
  if (!aggressor) return null;
  const time = Number(raw.time), tid = Number(raw.tid);
  if (!Number.isSafeInteger(time) || time <= 0 || !Number.isSafeInteger(tid) || tid < 0) return null;
  const pu = toUnits(raw.px, spec.priceDecimals), lots = toUnits(raw.sz, spec.szDecimals);
  if (!(pu > 0) || !(lots > 0)) return null;
  return { coin: spec.coin, tid, time, pu, lots, aggressor };
}

/** Globally unique trade identity per Hyperliquid docs: (block time, coin, tid). */
export const tradeKey = (t) => `${t.time}:${t.tid}`;

/* ---------- minute accumulation ---------- */

/**
 * Per-coin minute accumulator with exact deduplication. Trades may arrive out of
 * order (a reconnect snapshot replays recent trades); a trade lands in its own
 * minute regardless of arrival order, and a repeated (time, tid) is ignored.
 */
export class MinuteBook {
  constructor({ retainMinutes = 180 } = {}) {
    this.retainMinutes = retainMinutes;
    this.minutes = new Map();   /* t → { levels: Map(pu → [bid, ask, bidN, askN]), seen: Set, lastPu, lastTime, n } */
    this.duplicates = 0;
  }

  /** Add a normalized trade. Returns the minute start it changed, or null for a duplicate. */
  add(trade) {
    const t = Math.floor(trade.time / MINUTE_MS) * MINUTE_MS;
    let m = this.minutes.get(t);
    if (!m) { m = { levels: new Map(), seen: new Set(), lastPu: 0, lastTime: 0, n: 0 }; this.minutes.set(t, m); }
    const key = tradeKey(trade);
    if (m.seen.has(key)) { this.duplicates++; return null; }
    m.seen.add(key);
    let lv = m.levels.get(trade.pu);
    if (!lv) { lv = [0, 0, 0, 0]; m.levels.set(trade.pu, lv); }
    if (trade.aggressor === 'sell') { lv[0] += trade.lots; lv[2]++; } else { lv[1] += trade.lots; lv[3]++; }
    /* last trade of the minute by exchange time (tid breaks ties deterministically) */
    if (trade.time > m.lastTime || (trade.time === m.lastTime && trade.tid >= (m.lastTid ?? -1))) {
      m.lastTime = trade.time; m.lastTid = trade.tid; m.lastPu = trade.pu;
    }
    m.n++;
    return t;
  }

  slice(t) {
    const m = this.minutes.get(t);
    if (!m) return null;
    const levels = [...m.levels].map(([pu, v]) => [pu, v[0], v[1], v[2], v[3]]).sort((a, b) => a[0] - b[0]);
    return { t, levels, lastPu: m.lastPu, lastTime: m.lastTime, n: m.n };
  }

  /** Drop minutes older than the retention window (relative to `now`). */
  prune(now) {
    const floor = now - this.retainMinutes * MINUTE_MS;
    for (const t of this.minutes.keys()) if (t < floor) this.minutes.delete(t);
  }
}

/** Merge two slices of the SAME minute (stored + late live arrivals are never
 *  merged this way — dedup lives in MinuteBook; this is for re-bucketing). */
function addLevels(into, levels) {
  for (const [pu, b, a, bn, an] of levels) {
    const lv = into.get(pu);
    if (lv) { lv[0] += b; lv[1] += a; lv[2] += bn; lv[3] += an; } else into.set(pu, [b, a, bn, an]);
  }
}

/* ---------- re-bucketing to chart bars ---------- */

/**
 * Timeframe → bucket width in ms. Chart timeframes are minute counts ('1', '60')
 * or 'D'. Calendar timeframes (W, M) are not supported by the Gains chart and
 * are rejected here too.
 */
export function timeframeMs(tf) {
  if (tf === 'D' || tf === '1D') return 1440 * MINUTE_MS;
  const n = Number(tf);
  if (Number.isInteger(n) && n > 0 && 1440 % n === 0) return n * MINUTE_MS;
  return null;
}

/**
 * Re-bucket minute slices into chart bars at `rowUnits` price units per row.
 * Returns Map(barStart → bar) where bar = { t, rows: [[rowPu, bid, ask, bidN, askN]]
 * ascending, lastPu, lastTime, minutes }. Per-level sums are exact, so POC,
 * delta and imbalance survive aggregation.
 */
export function bucketBars(slices, tfMs, rowUnits = 1) {
  const acc = new Map();
  for (const s of slices) {
    const bt = Math.floor(s.t / tfMs) * tfMs;
    let b = acc.get(bt);
    if (!b) { b = { t: bt, levels: new Map(), lastPu: 0, lastTime: 0, minutes: 0 }; acc.set(bt, b); }
    addLevels(b.levels, rowUnits > 1 ? groupLevels(s.levels, rowUnits) : s.levels);
    if (s.lastTime >= b.lastTime) { b.lastTime = s.lastTime; b.lastPu = s.lastPu; }
    b.minutes++;
  }
  const out = new Map();
  for (const [bt, b] of acc) {
    out.set(bt, { t: bt, rows: [...b.levels].map(([pu, v]) => [pu, v[0], v[1], v[2], v[3]]).sort((x, y) => x[0] - y[0]), lastPu: b.lastPu, lastTime: b.lastTime, minutes: b.minutes });
  }
  return out;
}

/** Group exact levels into rows of `rowUnits` (row key = floor to the row). */
export function groupLevels(levels, rowUnits) {
  if (!(rowUnits > 1)) return levels;
  const m = new Map();
  for (const [pu, b, a, bn, an] of levels) {
    const r = Math.floor(pu / rowUnits) * rowUnits;
    const lv = m.get(r);
    if (lv) { lv[0] += b; lv[1] += a; lv[2] += bn; lv[3] += an; } else m.set(r, [b, a, bn, an]);
  }
  return [...m].map(([pu, v]) => [pu, v[0], v[1], v[2], v[3]]).sort((x, y) => x[0] - y[0]);
}

/* ---------- bar statistics ---------- */

/**
 * Footprint statistics for one bar (rows ascending, values in lots).
 * opts: { valueAreaPct = 70, imbalanceRatioPct = 300, stackedMin = 3, rowUnits = 1 }
 *
 * Imbalance is DIAGONAL (the convention the Vela reference documents): buying
 * at row i is compared with selling one row BELOW (i-1); selling at row i with
 * buying one row ABOVE (i+1). A side is imbalanced when it is ≥ ratio × the
 * diagonal opposite. An untraded diagonal inside the bar counts as zero
 * (the conventional "x / 0" rule); the bar's top/bottom edge has no diagonal.
 */
export function barStats(rows, opts = {}) {
  const vaPct = opts.valueAreaPct ?? 70;
  const ratio = (opts.imbalanceRatioPct ?? 300) / 100;
  const stackedMin = Math.max(2, opts.stackedMin ?? 3);
  let buy = 0, sell = 0, buyN = 0, sellN = 0, pocIdx = -1, pocVol = -1;
  for (let i = 0; i < rows.length; i++) {
    const [, b, a, bn, an] = rows[i];
    sell += b; buy += a; sellN += bn; buyN += an;
    const v = a + b;
    if (v > pocVol) { pocVol = v; pocIdx = i; }
  }
  const volume = buy + sell;
  const delta = buy - sell;

  /* value area: expand from the POC toward the larger neighbour until vaPct of volume */
  let vaLo = pocIdx, vaHi = pocIdx;
  if (pocIdx >= 0 && volume > 0) {
    let inside = pocVol;
    const target = volume * vaPct / 100;
    while (inside < target && (vaLo > 0 || vaHi < rows.length - 1)) {
      const down = vaLo > 0 ? rows[vaLo - 1][1] + rows[vaLo - 1][2] : -1;
      const up = vaHi < rows.length - 1 ? rows[vaHi + 1][1] + rows[vaHi + 1][2] : -1;
      if (up >= down) { vaHi++; inside += up; } else { vaLo--; inside += down; }
    }
  }

  /* diagonal imbalance per row: bit 1 = ask (buy) imbalance, bit 2 = bid (sell) imbalance.
     Rows are sparse (only traded rows exist), so the diagonal is looked up by
     price: an untraded row inside the bar's range counts as 0 volume, while the
     bar's own top/bottom edge has no diagonal at all and never flags. */
  const step = opts.rowUnits ?? 1;
  const byPu = new Map(rows.map((r, i) => [r[0], i]));
  const lo = rows.length ? rows[0][0] : 0, hi = rows.length ? rows[rows.length - 1][0] : 0;
  const imb = new Uint8Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const pu = rows[i][0], bid = rows[i][1], ask = rows[i][2];
    if (ask > 0 && pu - step >= lo) {
      const j = byPu.get(pu - step), bidBelow = j == null ? 0 : rows[j][1];
      if (ask >= ratio * bidBelow) imb[i] |= 1;
    }
    if (bid > 0 && pu + step <= hi) {
      const j = byPu.get(pu + step), askAbove = j == null ? 0 : rows[j][2];
      if (bid >= ratio * askAbove) imb[i] |= 2;
    }
  }

  /* stacked imbalances: ≥ stackedMin price-adjacent rows imbalanced on the same side */
  const stacked = [];
  for (const bit of [1, 2]) {
    let start = -1;
    for (let i = 0; i <= rows.length; i++) {
      const on = i < rows.length && (imb[i] & bit) !== 0;
      const adjacent = on && start >= 0 && rows[i][0] - rows[i - 1][0] === step;
      if (start >= 0 && !adjacent) {
        if (i - start >= stackedMin) stacked.push({ side: bit === 1 ? 'buy' : 'sell', fromIdx: start, toIdx: i - 1 });
        start = -1;
      }
      if (on && start < 0) start = i;
    }
  }

  return {
    volume, buy, sell, delta, buyN, sellN, trades: buyN + sellN,
    deltaPct: volume > 0 ? delta / volume * 100 : 0,
    buyPct: volume > 0 ? buy / volume * 100 : 0,
    sellPct: volume > 0 ? sell / volume * 100 : 0,
    pocIdx, vaLoIdx: vaLo, vaHiIdx: vaHi, imbalance: imb, stacked,
    lowPu: rows.length ? rows[0][0] : null, highPu: rows.length ? rows[rows.length - 1][0] : null,
  };
}

/**
 * Naked POCs: a bar's POC stays "naked" until a LATER bar trades through that
 * row. Input: bars ascending with { t, rows, stats }. Returns [{ t, pu, untilT|null }].
 */
export function nakedPocs(bars, rowUnits = 1) {
  const out = [];
  for (let i = 0; i < bars.length; i++) {
    const s = bars[i].stats;
    if (!s || s.pocIdx < 0) continue;
    const pu = bars[i].rows[s.pocIdx][0];
    let until = null;
    for (let j = i + 1; j < bars.length; j++) {
      const sj = bars[j].stats;
      if (sj && sj.lowPu != null && sj.lowPu <= pu && sj.highPu + rowUnits - 1 >= pu) { until = bars[j].t; break; }
    }
    out.push({ t: bars[i].t, pu, untilT: until });
  }
  return out;
}

/** Cumulative volume delta over bars ascending (lots). */
export function cumulativeDelta(bars) {
  let c = 0;
  return bars.map(b => (c += b.stats ? b.stats.delta : 0));
}

/* ---------- volume filters ---------- */

/** Apply Vela-style volume filters: rows outside a range are blanked but keep their slot.
 *  f = { volMin, volMax, bidMin, bidMax, askMin, askMax } in lots; 0 = off. */
export function rowPassesFilter(row, f) {
  if (!f) return true;
  const [, b, a] = row, v = a + b;
  const out = (x, lo, hi) => (lo > 0 && x < lo) || (hi > 0 && x > hi);
  return !(out(v, f.volMin, f.volMax) || out(b, f.bidMin, f.bidMax) || out(a, f.askMin, f.askMax));
}

/* ---------- row sizing ---------- */

/**
 * Auto row height in price units: the smallest "nice" multiple (1,2,5×10^k) of
 * one price unit whose pixel height reaches `minRowPx`. `pxPerUnit` is the
 * vertical pixels per price unit at the current zoom.
 */
export function autoRowUnits(pxPerUnit, minRowPx = 14) {
  if (!(pxPerUnit > 0)) return 1;
  const need = minRowPx / pxPerUnit;
  if (need <= 1) return 1;
  const k = 10 ** Math.floor(Math.log10(need));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * k >= need) return Math.max(1, Math.round(m * k));
  return Math.max(1, Math.round(10 * k));
}
