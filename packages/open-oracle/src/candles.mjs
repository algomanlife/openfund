import { decimal } from './decimal.ts';
export const TIMEFRAMES = Object.freeze({ '1s': 1000, '5s': 5000, '15s': 15000, '30s': 30000,
  '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000, '30m': 1800000,
  '1h': 3600000, '2h': 7200000, '4h': 14400000, '8h': 28800000, '12h': 43200000,
  '1d': 86400000, '1w': 604800000, '1M': null });
export function bucket(timestamp, timeframe) {
  if (!(timeframe in TIMEFRAMES) || !Number.isSafeInteger(timestamp) || timestamp <= 0) throw new Error('invalid_bucket');
  if (timeframe === '1M') { const d = new Date(timestamp), start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); return [start, Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)]; }
  const ms = TIMEFRAMES[timeframe], offset = timeframe === '1w' ? 4 * 86400000 : 0;
  const start = Math.floor((timestamp - offset) / ms) * ms + offset;
  return [start, start + ms];
}
export class CandleEngine {
  constructor({ timeframes = Object.keys(TIMEFRAMES), maxCandles = 2000, maxSeries = 10000 } = {}) {
    for (const tf of timeframes) if (!(tf in TIMEFRAMES)) throw new Error('invalid_timeframe');
    if (!Number.isInteger(maxCandles) || maxCandles < 1 || !Number.isInteger(maxSeries) || maxSeries < 1) throw new Error('invalid_candle_limits');
    Object.assign(this, { timeframes, maxCandles, maxSeries }); this.series = new Map(); this.watermark = 0; this.lateDropped = 0;
  }
  advance(watermark) {
    if (watermark < this.watermark) throw new Error('watermark_regression');
    this.watermark = watermark;
    const finalized = [];
    for (const candles of this.series.values()) for (const c of candles) if (!c.finalized && c.end <= watermark) { c.finalized = true; finalized.push(structuredClone(c)); }
    return finalized;
  }
  ingest(price, { dataKind = 'NATIVE' } = {}) {
    if (!price.price || price.stale || !['SINGLE_SOURCE', 'DUAL_SOURCE', 'TRIPLE_SOURCE'].includes(price.pricingMode) || price.marketSession === 'CLOSED') return [];
    if (decimal(price.price) <= 0n) throw new Error('invalid_candle_price');
    const updates = [];
    for (const timeframe of this.timeframes) {
      const [start, end] = bucket(price.timestamp, timeframe), key = `${price.marketId}/${timeframe}`;
      if (end <= this.watermark) { this.lateDropped++; continue; }
      if (!this.series.has(key)) { if (this.series.size >= this.maxSeries) throw new Error('candle_series_capacity'); this.series.set(key, []); }
      const list = this.series.get(key); let c = list.find(c => c.start === start);
      if (c?.finalized) { this.lateDropped++; continue; }
      if (!c) {
        const previous = list.filter(c => c.end <= start).at(-1);
        c = { marketId: price.marketId, timeframe, start, end, open: price.price, high: price.price, low: price.price, close: price.price,
          firstTime: price.timestamp, lastTime: price.timestamp, count: 0, minConfidence: price.confidence,
          gapBefore: previous && previous.end < start ? { from: previous.end, to: start, reason: 'NO_VALID_OBSERVATIONS' } : null,
          finalized: false, revision: 0, dataKind, algorithmVersion: price.algorithmVersion, configurationVersion: price.configurationVersion,
          marketSession: price.marketSession };
        list.push(c); list.sort((a, b) => a.start - b.start); if (list.length > this.maxCandles) list.shift();
      }
      if (c.dataKind !== dataKind || c.configurationVersion !== price.configurationVersion || c.algorithmVersion !== price.algorithmVersion) throw new Error('mixed_candle_provenance');
      if (price.timestamp < c.firstTime) { c.open = price.price; c.firstTime = price.timestamp; }
      if (price.timestamp >= c.lastTime) { c.close = price.price; c.lastTime = price.timestamp; }
      if (decimal(price.price) > decimal(c.high)) c.high = price.price;
      if (decimal(price.price) < decimal(c.low)) c.low = price.price;
      c.count++; c.minConfidence = Math.min(c.minConfidence, price.confidence); updates.push(structuredClone(c));
    }
    return updates;
  }
  correct(marketId, timeframe, start, replacement, evidence) {
    const c = this.series.get(`${marketId}/${timeframe}`)?.find(c => c.start === start);
    if (!c?.finalized || !evidence) throw new Error('correction_requires_finalized_evidence');
    if (!['open', 'high', 'low', 'close'].every(k => decimal(replacement[k]) > 0n) ||
      decimal(replacement.high) < decimal(replacement.low) ||
      ['open', 'close'].some(k => decimal(replacement[k]) > decimal(replacement.high) || decimal(replacement[k]) < decimal(replacement.low))) throw new Error('invalid_correction');
    const previous = structuredClone(c);
    Object.assign(c, Object.fromEntries(['open', 'high', 'low', 'close'].map(k => [k, replacement[k]])), { revision: c.revision + 1, correctionEvidence: evidence });
    return { previous, corrected: structuredClone(c), evidence };
  }
  list(marketId, timeframe = '1m') { return structuredClone(this.series.get(`${marketId}/${timeframe}`) ?? []); }
}
