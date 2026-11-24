import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MarketRegistry, convertQuote, OracleEngine, SourceQuality, replay, CandleEngine, bucket, TIMEFRAMES, HistoryStore, createOracleServer, DEFAULT_CONFIG } from '../src/index.mjs';
import { TIME, registry, sources, observation as o } from './helpers.mjs';
test('registry retains ambiguous, synthetic, wrapped and depegged quote identities', () => {
  const r = new MarketRegistry();
  for (const [source, quote, unit] of [['gains', 'USD', 'BTC'], ['hyperliquid', 'USDC', 'BTC'], ['gmx', 'USD', 'WBTC']]) r.register(source, { sourceMarketId: 'BTC', quoteAsset: quote, unit, symbol: 'BTC', identityVerified: true });
  r.register('gains', { symbol: 'AMBIGUOUS' }); assert.equal(r.list().length, 4);
  assert.equal(r.coverage(TIME).ambiguousMappings.length, 1); assert.equal(r.coverage(TIME).complete, false);
  const converted = convertQuote({ quoteAsset: 'USDC', price: '100' }, { from: 'USDC', to: 'USD', rate: '0.95', evidence: 'test independent FX', timestamp: TIME, receivedAt: TIME }, TIME);
  assert.equal(converted.price, '95'); assert.throws(() => convertQuote({ quoteAsset: 'USDC', price: '100' }, { rate: '1' }, TIME));
});
test('explicit equivalence requires matching quote and unit, with registry capacity enforced', () => {
  const r = registry(); assert.equal(r.list().length, 1); assert.equal(r.list()[0].supportedSources.length, 3);
  r.register('gains', { sourceMarketId: 'gains', quoteAsset: 'USDC', unit: 'BTC', semantics: 'UNDERLYING_REFERENCE' });
  assert.equal(r.resolve('gains', 'gains').mappingStatus, 'AMBIGUOUS');
  const bounded = new MarketRegistry({ maxMarkets: 1 }); bounded.register('gains', { sourceMarketId: '1' }); assert.throws(() => bounded.register('gains', { sourceMarketId: '2' }), /capacity/);
});
test('rolling health handles cold start, missing observations and market closures', () => {
  const q = new SourceQuality(300000); assert.equal(q.score('gains', TIME).calibrated, false);
  q.record('gains', { time: TIME, received: false, valid: false, timely: false }); assert.equal(q.score('gains', TIME).reliability, '0');
  q.record('gains', { time: TIME + 1, closed: true }); assert.equal(q.score('gains', TIME + 1).expected, 1);
  assert.equal(q.score('gains', TIME + 300001).calibrated, false);
});
test('event ingestion deduplicates, bounds queues, handles out of order and future receipts', () => {
  const engine = new OracleEngine({ registry: registry(), maxEventsPerSource: 2, candles: new CandleEngine({ timeframes: ['1s'] }) });
  engine.ingest(o()); assert.equal(engine.ingest(o()).reason, 'DUPLICATE');
  engine.ingest(o('gmx', '100', TIME + 1000, { receivedAt: TIME + 2000 }));
  assert.equal(engine.evaluate(TIME)[0].eligibleSourceCount, 1);
  engine.ingest(o('gains', '101', TIME + 2)); engine.ingest(o('gains', '102', TIME + 1));
  assert.equal(engine.metrics.queueDropped, 1); assert.equal(engine.evaluate(TIME + 2)[0].price, '101');
  assert.throws(() => engine.evaluate(TIME), /regression/);
  assert.equal(engine.ingest(o('gains', '1', TIME - 10000)).reason, 'LATE');
});
test('deterministic causal replay excludes late-known prices and does not fabricate candle observations', () => {
  const events = [o(), o('gmx', '101', TIME, { receivedAt: TIME + 1000 }), o('gains', '100.1', TIME + 500)];
  const run = () => { const e = new OracleEngine({ registry: registry(), candles: new CandleEngine({ timeframes: ['1s'] }) }); return { values: replay(e, events, [TIME, TIME + 500, TIME + 1000, TIME + 1500]), candles: e.candles.list('BTC/USD', '1s') }; };
  const a = run(); assert.deepEqual(a, run()); assert.equal(a.values[0].eligibleSourceCount, 1); assert.equal(a.values[2].eligibleSourceCount, 2);
  assert.equal(a.candles.reduce((n, c) => n + c.count, 0), 3); assert(a.candles.every(c => c.dataKind === 'RECONSTRUCTED'));
});
test('source loss, stale reference, recovery and closed/reopened sessions', () => {
  const r = registry(), e = new OracleEngine({ registry: r, candles: new CandleEngine({ timeframes: ['1s'] }) });
  sources.forEach(s => e.ingest(o(s))); assert.equal(e.evaluate(TIME)[0].pricingMode, 'TRIPLE_SOURCE');
  const stale = e.evaluate(TIME + 11000)[0]; assert.equal(stale.pricingMode, 'STALE'); assert.equal(stale.confidence, 0);
  e.ingest(o('gains', '100', TIME + 12000)); assert.equal(e.evaluate(TIME + 12000)[0].pricingMode, 'SINGLE_SOURCE');
  r.list()[0].sourceMappings.forEach(m => { m.metadata.session = 'CLOSED'; }); assert.equal(e.evaluate(TIME + 12001)[0].pricingMode, 'MARKET_CLOSED');
  r.list()[0].sourceMappings.forEach(m => { m.metadata.session = 'OPEN'; }); assert.equal(e.evaluate(TIME + 12002)[0].pricingMode, 'SINGLE_SOURCE');
});
test('candle OHLC, calendar buckets, gaps, late finalization and explicit revisions', () => {
  const c = new CandleEngine({ timeframes: ['1s', '1M', '1w'] });
  const p = (price, timestamp) => ({ marketId: 'BTC/USD', price, timestamp, pricingMode: 'SINGLE_SOURCE', confidence: 50, algorithmVersion: 'GAACP-v1', configurationVersion: DEFAULT_CONFIG.version });
  c.ingest(p('100', TIME + 200)); c.ingest(p('102', TIME + 300)); c.ingest(p('99', TIME + 100));
  let [bar] = c.list('BTC/USD', '1s'); assert.deepEqual([bar.open, bar.high, bar.low, bar.close], ['99', '102', '99', '102']);
  c.advance(TIME + 1000); c.ingest(p('50', TIME)); assert(c.lateDropped > 0); assert.equal(c.list('BTC/USD', '1s')[0].low, '99');
  c.ingest(p('101', TIME + 3000)); assert.equal(c.list('BTC/USD', '1s').length, 2); assert(c.list('BTC/USD', '1s')[1].gapBefore);
  const revision = c.correct('BTC/USD', '1s', TIME, { open: '100', high: '102', low: '99', close: '101' }, 'test correction evidence'); assert.equal(revision.corrected.revision, 1); assert.equal(revision.previous.open, '99');
  assert.throws(() => c.correct('BTC/USD', '1s', TIME, {}, ''), /evidence/);
  const feb = Date.UTC(2024, 1, 20); assert.deepEqual(bucket(feb, '1M'), [Date.UTC(2024, 1, 1), Date.UTC(2024, 2, 1)]);
  assert.equal(new Date(bucket(feb, '1w')[0]).getUTCDay(), 1); for (const tf of Object.keys(TIMEFRAMES)) assert(bucket(TIME, tf)[1] > bucket(TIME, tf)[0]);
});
test('append-only history survives reopen, classifies provider history and rejects tampering', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'open-oracle-history-'));
  try {
    const h = new HistoryStore(dir); h.append('RAW', { test: true }, { recordedAt: TIME }); h.append('PROVIDER_REFERENCE', { close: '100' }, { dataKind: 'PROVIDER_REFERENCE', recordedAt: TIME });
    assert.throws(() => h.append('PROVIDER_REFERENCE', {}), /mislabelled/);
    const reopened = new HistoryStore(dir); const records = []; for await (const record of reopened.read()) records.push(record);
    assert.equal(records.length, 2); assert.equal(records[1].previousHash, records[0].hash);
    const file = join(dir, h.files()[0]); writeFileSync(file, readFileSync(file, 'utf8').replace('true', 'false')); assert.throws(() => new HistoryStore(dir), /integrity/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('memory bounds remain enforced across long event/candle streams', () => {
  const e = new OracleEngine({ registry: registry(), maxEventsPerSource: 8, candles: new CandleEngine({ timeframes: ['1s'], maxCandles: 5 }) });
  for (let i = 0; i < 1000; i++) { e.ingest(o('gains', String(100 + i), TIME + i * 1000)); e.evaluate(TIME + i * 1000); }
  assert.equal(e.events.get('BTC/USD/gains').length, 8); assert.equal(e.candles.list('BTC/USD', '1s').length, 5); assert.equal(e.fingerprints.size, 1);
});
test('read-only HTTP handlers and SSE publish/cleanup without socket permissions', async () => {
  const { EventEmitter } = await import('node:events');
  const e = new OracleEngine({ registry: registry(), candles: new CandleEngine({ timeframes: ['1s'] }) });
  const api = createOracleServer(e);
  const request = (path, method = 'GET', headers = {}) => {
    const response = new EventEmitter(); response.status = null; response.body = '';
    response.writeHead = (status, headers) => { response.status = status; response.headers = headers; };
    response.write = chunk => { response.body += chunk; return true; };
    response.end = chunk => { response.body += chunk ?? ''; response.emit('close'); };
    response.destroy = () => response.emit('close');
    api.server.emit('request', { url: path, method, headers }, response); return response;
  };
  for (const path of ['markets', 'sources', 'health', 'methodology']) assert.equal(request(`/v1/${path}`).status, 200);
  assert.equal(request('/v1/prices', 'POST').status, 405);
  assert.equal(request('/v1/prices', 'GET', { origin: 'https://untrusted.invalid' }).status, 403);
  assert.equal(request('/v1/markets/missing').status, 404);
  const stream = request('/v1/stream'); e.ingest(o()); e.evaluate(TIME);
  assert(stream.body.includes('event: price')); assert(stream.body.includes('event: candle'));
  assert.equal(JSON.parse(request('/v1/prices/BTC%2FUSD').body).price, '100');
  stream.destroy(); assert.equal(e.listeners.size, 0);
});
test('persisted raw/health history replays exactly and backfill stays provider-reference', async () => {
  const { replayHistory, backfill } = await import('../src/index.mjs');
  const directory = mkdtempSync(join(tmpdir(), 'open-oracle-replay-'));
  try {
    const history = new HistoryStore(directory), first = new OracleEngine({ registry: registry(), history, candles: new CandleEngine({ timeframes: ['1s'] }) });
    first.observeExpected('gains', { time: TIME, received: true, valid: true, timely: true }); first.ingest(o());
    const before = first.evaluate(TIME);
    first.observeExpected('gains', { time: TIME + 1000, received: false }); first.ingest(o('gains', '101', TIME + 1000));
    const after = first.evaluate(TIME + 1000);
    const second = new OracleEngine({ registry: registry(), candles: new CandleEngine({ timeframes: ['1s'] }) });
    assert.deepEqual(await replayHistory(second, history), [...before, ...after]);
    const result = await backfill({ source: 'gains', historical: async () => [{ dataKind: 'PROVIDER_REFERENCE', timestamp: TIME, raw: { close: '100' } }] }, 'TEST', {}, history);
    assert.equal(result.persisted, 1); assert.equal(result.reconstructedCompositeCandles, false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
