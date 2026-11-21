// Deterministic OHLC fixtures for Pine benchmarks and differential tests.
// Synthetic, seeded data: these test calculation behaviour and runtime cost,
// never market accuracy. Volume is deliberately absent (Gains supplies none).

const MINUTE = 60_000;
// 2026-01-05T00:00:00Z, a Monday at a UTC day boundary.
export const FIXTURE_EPOCH = Date.UTC(2026, 0, 5);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = value => Math.round(value * 10) / 10;

/**
 * Random-walk 1-minute bars with alternating regimes (uptrend, downtrend,
 * volatile, flat with zero-range candles). Same seed + length → same bars.
 */
export function syntheticBars(length, { seed = 7, start = FIXTURE_EPOCH, price = 60_000, stepMinutes = 1 } = {}) {
  const random = mulberry32(seed);
  const regimes = [
    { drift: 0.00012, vol: 0.0009 },
    { drift: -0.00014, vol: 0.0011 },
    { drift: 0, vol: 0.0032 },
    { drift: 0, vol: 0, flat: true },
  ];
  const bars = [];
  let close = price;
  for (let i = 0; i < length; i++) {
    const regime = regimes[Math.floor(i / 400) % regimes.length];
    const open = close;
    if (regime.flat && i % 400 < 60) {
      bars.push({ time: start + i * stepMinutes * MINUTE, open, high: open, low: open, close: open });
      continue;
    }
    const vol = regime.flat ? 0.0004 : regime.vol;
    close = round(open * (1 + regime.drift + (random() - 0.5) * 2 * vol));
    const high = round(Math.max(open, close) * (1 + random() * vol * 0.6));
    const low = round(Math.min(open, close) * (1 - random() * vol * 0.6));
    bars.push({ time: start + i * stepMinutes * MINUTE, open, high, low, close });
  }
  return bars;
}

export function timeframeMinutes(tf) {
  if (/^\d+$/.test(tf)) return Number(tf);
  if (/^1?D$/i.test(tf)) return 1440;
  if (/^1?W$/i.test(tf)) return 10080;
  throw new Error(`Unsupported fixture timeframe ${tf}`);
}

/** UTC-aligned aggregation of genuine fixture bars; never invents candles. */
export function bucketStart(time, tf) {
  if (/^1?M$/.test(tf)) {
    const date = new Date(time);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  }
  if (/^1?W$/i.test(tf)) {
    // Pine weeks open on Monday 00:00 UTC; the Unix epoch was a Thursday.
    const span = 10080 * MINUTE, monday = 4 * 1440 * MINUTE;
    return Math.floor((time - monday) / span) * span + monday;
  }
  const span = timeframeMinutes(tf) * MINUTE;
  return Math.floor(time / span) * span;
}

export function aggregate(bars, tf) {
  const out = [];
  for (const bar of bars) {
    const bucket = bucketStart(bar.time, tf);
    const last = out.at(-1);
    if (last && last.time === bucket) {
      last.high = Math.max(last.high, bar.high);
      last.low = Math.min(last.low, bar.low);
      last.close = bar.close;
    } else {
      out.push({ time: bucket, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
    }
  }
  return out;
}

export const fixtureInfo = {
  ticker: 'BTC/USD', tickerid: 'BTC/USD', main_tickerid: 'BTC/USD', root: 'BTC', basecurrency: 'BTC',
  currency: 'USD', timezone: 'UTC', prefix: 'gains', mintick: 0.1, minmove: 1, pricescale: 10,
  description: 'BTC / USD (synthetic fixture)', volume: false,
};

/** fetchSeries for secondary requests, built from the same base bars. */
export function seriesFetcher(baseBars, calls = []) {
  return async (symbol, tf, range = {}) => {
    calls.push({ symbol, tf });
    let bars = aggregate(baseBars, tf);
    if (range.to != null) bars = bars.filter(bar => bar.time <= range.to);
    if (range.limit) bars = bars.slice(-range.limit);
    return bars;
  };
}
