import { performance } from 'node:perf_hooks';
import { cpus, platform, arch } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculatePrice, MarketRegistry, OracleEngine, CandleEngine, replay } from '../src/index.mjs';
const time = 1795500000000;
const observation = (source, i = 0) => ({ source, sourceMarketId: source, marketId: 'TEST/USD', price: String(100 + i % 3),
  timestamp: time + i, receivedAt: time + i, timestampKind: 'PROVIDER', mappingVerified: true, quoteValid: true, semantics: 'UNDERLYING_REFERENCE' });
function measure(name, count, fn) {
  global.gc?.(); const memoryBefore = process.memoryUsage(), cpu = process.cpuUsage(), start = performance.now(); fn();
  const durationMs = performance.now() - start, usage = process.cpuUsage(cpu), memoryAfter = process.memoryUsage();
  return { name, count, durationMs, operationsPerSecond: count / durationMs * 1000,
    heapDeltaBytes: memoryAfter.heapUsed - memoryBefore.heapUsed, rssBytes: memoryAfter.rss, cpuUserMs: usage.user / 1000, cpuSystemMs: usage.system / 1000 };
}
const results = [];
const r = new MarketRegistry();
results.push(measure('synthetic_inventory_registration', 10000, () => { for (let i = 0; i < 10000; i++) r.register('gains', { sourceMarketId: `TEST${i}`, symbol: `TEST${i}`, quoteAsset: 'USD', identityVerified: true, semantics: 'UNDERLYING_REFERENCE' }); }));
const inputs = ['gains', 'hyperliquid', 'gmx'].map(s => observation(s));
results.push(measure('triple_composite', 20000, () => { for (let i = 0; i < 20000; i++) calculatePrice('TEST/USD', inputs, time + i % 1000); }));
const registered = new MarketRegistry(); registered.register('gains', { sourceMarketId: 'gains', quoteAsset: 'USD', identityVerified: true, semantics: 'UNDERLYING_REFERENCE' });
results.push(measure('normalization', 100000, () => { for (let i = 0; i < 100000; i++) registered.normalize(observation('gains', i)); }));
const c = new CandleEngine({ timeframes: ['1s', '1m', '1h'], maxCandles: 100 });
results.push(measure('three_timeframe_candle_generation', 20000, () => { for (let i = 0; i < 20000; i++) c.ingest({ ...calculatePrice('TEST/USD', [observation('gains', i)], time + i), marketId: 'TEST/USD' }); }));
const e = new OracleEngine({ registry: registered, candles: new CandleEngine({ timeframes: ['1s'], maxCandles: 100 }) });
const events = Array.from({ length: 3000 }, (_, i) => observation('gains', i));
results.push(measure('causal_replay', events.length, () => replay(e, events, events.map(o => o.receivedAt))));
const many = new OracleEngine({ registry: r, candles: new CandleEngine({ timeframes: ['1s'], maxSeries: 20000 }) });
for (let i = 0; i < 10000; i++) many.ingest({ ...observation('gains'), sourceMarketId: `TEST${i}` });
results.push(measure('10000_single_source_markets_batch_evaluation', 10000, () => many.evaluate(time)));
const retainedHeap = [];
for (let round = 0; round < 5; round++) {
  for (let i = 0; i < 2000; i++) { const n = 4000 + round * 2000 + i; e.ingest(observation('gains', n)); e.evaluate(time + n); }
  global.gc?.(); retainedHeap.push({ round, heapUsed: process.memoryUsage().heapUsed, retainedObservations: [...e.events.values()].reduce((n, v) => n + v.length, 0), retainedCandles: [...e.candles.series.values()].reduce((n, v) => n + v.length, 0) });
}
const report = { generatedAt: new Date().toISOString(), retainedHeap, environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
  workload: 'Synthetic offline workload; not provider throughput, network latency, production capacity or absolute price accuracy.', results };
const directory = resolve(process.argv[2] ?? 'benchmarks'); mkdirSync(directory, { recursive: true });
writeFileSync(resolve(directory, 'results.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(resolve(directory, 'results.md'), ['# Open Oracle local benchmark', '', report.workload, '', `Node ${process.version}; ${platform()} ${arch()}; ${cpus()[0]?.model}.`, '',
  '| Workload | Operations | Duration ms | Operations/s | Heap delta bytes |', '| --- | --- | --- | --- | --- |', ...results.map(r => `| ${r.name} | ${r.count} | ${r.durationMs.toFixed(2)} | ${r.operationsPerSecond.toFixed(0)} | ${r.heapDeltaBytes} |`), ''].join('\n'));
console.log(JSON.stringify(report, null, 2));
