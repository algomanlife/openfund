import { calculatePrice, DEFAULT_CONFIG } from './pricing.ts';
import { decimal, format, divRound, SCALE, mul } from './decimal.ts';
import { CandleEngine } from './candles.mjs';
/** Rolling counters include expected-but-missing samples; scheduled closures are excluded. */
export class SourceQuality {
  constructor(windowMs = 300000, maxSamples = 10000) { this.windowMs = windowMs; this.maxSamples = maxSamples; this.samples = new Map(); }
  record(source, { time, received = true, valid = true, timely = true, closed = false }) {
    if (closed) return;
    const a = this.samples.get(source) ?? []; a.push({ time, received, valid, timely });
    const kept = a.filter(x => x.time >= time - this.windowMs).slice(-this.maxSamples); this.samples.set(source, kept);
  }
  score(source, time) {
    const a = (this.samples.get(source) ?? []).filter(x => x.time <= time && x.time >= time - this.windowMs);
    if (!a.length) return { reliability: '1', calibrated: false, expected: 0 };
    const received = a.filter(x => x.received), ratio = (n, d) => d ? divRound(BigInt(n) * SCALE, BigInt(d)) : 0n;
    const A = ratio(received.length, a.length), V = ratio(received.filter(x => x.valid).length, received.length), T = ratio(received.filter(x => x.timely).length, received.length);
    return { reliability: format(mul(decimal('0.5'), A) + mul(decimal('0.3'), V) + mul(decimal('0.2'), T)), calibrated: true, expected: a.length };
  }
}
export class OracleEngine {
  constructor({ registry, config = DEFAULT_CONFIG, history = null, candles = new CandleEngine(), maxEventsPerSource = 256, marketConfigurations = {} } = {}) {
    if (!registry || !Number.isInteger(maxEventsPerSource) || maxEventsPerSource < 2) throw new Error('invalid_engine_configuration');
    Object.assign(this, { registry, config, history, candles, maxEventsPerSource, marketConfigurations });
    this.fingerprints = new Map(); this.events = new Map(); this.prices = new Map(); this.lastEvaluation = 0;
    this.quality = new SourceQuality(config.reliabilityWindowMs); this.listeners = new Set(); this.metrics = { accepted: 0, duplicates: 0, lateDropped: 0, queueDropped: 0 };
    history?.append('CONFIGURATION', config, { configurationVersion: config.version });
  }
  ingest(raw) {
    const o = this.registry.normalize(raw);
    const historyOptions = { configurationVersion: this.config.version, algorithmVersion: this.config.algorithmVersion, recordedAt: raw.receivedAt };
    this.history?.append('RAW', raw, historyOptions); this.history?.append('NORMALIZED', o, historyOptions);
    if (!this.registry.entries.has(o.marketId)) return { accepted: false, reason: 'UNREGISTERED' };
    const key = `${o.marketId}/${o.source}`, list = this.events.get(key) ?? [];
    if (!Number.isSafeInteger(o.timestamp) || o.timestamp <= 0 || !Number.isSafeInteger(o.receivedAt) || o.receivedAt <= 0) return { accepted: false, reason: 'INVALID_TIMESTAMP' };
    if (o.timestamp < this.lastEvaluation - this.config.watermarkMs) { this.metrics.lateDropped++; return { accepted: false, reason: 'LATE' }; }
    if (list.some(p => p.timestamp === o.timestamp && p.price === o.price)) { this.metrics.duplicates++; return { accepted: false, reason: 'DUPLICATE' }; }
    list.push(o); list.sort((a, b) => a.timestamp - b.timestamp || a.receivedAt - b.receivedAt);
    while (list.length > this.maxEventsPerSource) { list.shift(); this.metrics.queueDropped++; }
    this.events.set(key, list); this.metrics.accepted++; return { accepted: true, observation: o };
  }
  observeExpected(source, result) { this.quality.record(source, result); this.history?.append('HEALTH', { source, sample: result }, { recordedAt: result.time, configurationVersion: this.config.version, algorithmVersion: this.config.algorithmVersion }); }
  evaluate(time, { dataKind = 'NATIVE' } = {}) {
    if (time < this.lastEvaluation) throw new Error('evaluation_time_regression');
    if (time === this.lastEvaluation) return [];
    const outputs = [];
    for (const market of this.registry.list()) {
      const observations = [];
      for (const source of market.supportedSources) {
        const selected = (this.events.get(`${market.id}/${source}`) ?? []).filter(o => o.timestamp <= time && o.receivedAt <= time).at(-1);
        if (selected) observations.push({ ...selected, ...this.quality.score(source, time) });
      }
      const states = market.sourceMappings.map(m => m.metadata.session);
      const session = states.length && states.every(s => s === 'CLOSED') ? 'CLOSED' : states.some(s => s === 'OPEN') ? 'OPEN' : 'UNKNOWN';
      const policy = this.marketConfigurations[market.id] ?? this.config;
      const price = calculatePrice(market.id, observations, time, policy, this.prices.get(market.id) ?? null, session, market.supportedSources.length);
      this.prices.set(market.id, price); outputs.push(price);
      const options = { dataKind, algorithmVersion: policy.algorithmVersion, configurationVersion: policy.version, recordedAt: time };
      this.history?.append('COMPOSITE', price, options); this.history?.append('QUALITY', price.sources, options);
      const fingerprint = JSON.stringify(observations.map(o => [o.source, o.timestamp, o.price]));
      const changed = this.fingerprints.get(market.id) !== fingerprint;
      this.fingerprints.set(market.id, fingerprint);
      const candles = changed ? this.candles.ingest(price, { dataKind }) : [];
      for (const candle of candles) this.history?.append('CANDLE', candle, options);
      for (const fn of this.listeners) fn({ type: 'price', data: price });
      for (const candle of candles) for (const fn of this.listeners) fn({ type: 'candle', data: candle });
    }
    for (const candle of this.candles.advance(Math.max(0, time - this.config.watermarkMs))) {
      this.history?.append('CANDLE', candle, { dataKind: candle.dataKind, recordedAt: time });
      for (const fn of this.listeners) fn({ type: 'candle', data: candle });
    }
    this.lastEvaluation = time; return outputs;
  }
  subscribe(fn) { if (this.listeners.size >= 100) throw new Error('subscriber_capacity'); this.listeners.add(fn); return () => this.listeners.delete(fn); }
  correctCandle(...args) { const result = this.candles.correct(...args); this.history?.append('CORRECTION', result); return result; }
}
/** Replay uses receipt-time ordering, not hindsight-sorted provider timestamps. */
export function replay(engine, observations, evaluationTimes) {
  const events = observations.map((o, i) => ({ o, i })).sort((a, b) => a.o.receivedAt - b.o.receivedAt || a.i - b.i);
  let index = 0; const output = [];
  for (const time of evaluationTimes) {
    while (index < events.length && events[index].o.receivedAt <= time) engine.ingest(events[index++].o);
    output.push(...engine.evaluate(time, { dataKind: 'RECONSTRUCTED' }));
  }
  return output;
}
/** Rebuild from recorded arrival order and expected-health samples, without looking ahead. */
export async function replayHistory(engine, history) {
  const outputs = [];
  for await (const record of history.read()) {
    if (record.kind === 'CONFIGURATION' && record.data.version !== engine.config.version) throw new Error('replay_configuration_mismatch');
    if (record.kind === 'RAW') engine.ingest(record.data);
    else if (record.kind === 'HEALTH') engine.observeExpected(record.data.source, record.data.sample);
    else if (record.kind === 'COMPOSITE' && record.data.timestamp > engine.lastEvaluation)
      outputs.push(...engine.evaluate(record.data.timestamp, { dataKind: 'RECONSTRUCTED' }));
  }
  return outputs;
}
export async function backfill(adapter, sourceMarketId, request, history) {
  const records = await adapter.historical(sourceMarketId, request);
  let persisted = 0;
  for (const record of records) {
    if (record.dataKind !== 'PROVIDER_REFERENCE' || !Number.isSafeInteger(record.timestamp) || record.timestamp <= 0) throw new Error('invalid_historical_provenance');
    history.append('PROVIDER_REFERENCE', record, { dataKind: 'PROVIDER_REFERENCE' }); persisted++;
  }
  return { source: adapter.source, sourceMarketId, persisted, classification: 'PROVIDER_REFERENCE',
    reconstructedCompositeCandles: false, limitation: 'Provider OHLC cannot recover within-bar multi-source event order.' };
}
