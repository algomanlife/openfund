import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GainsAdapter, HyperliquidAdapter, GMXAdapter, MarketRegistry, OracleEngine, CandleEngine, HistoryStore, DEFAULT_CONFIG, backfill } from '../src/index.mjs';
import { PublicTransport } from '../src/transport.mjs';
import { setTimeout as delay } from 'node:timers/promises';
export async function collect({ durationMs = 15000, directory = 'reports/live', config = DEFAULT_CONFIG, equivalences = [] } = {}) {
  if (!Number.isInteger(durationMs) || durationMs < 0 || durationMs > 3600000) throw new Error('invalid_collection_duration');
  directory = resolve(directory); mkdirSync(directory, { recursive: true });
  const startedAt = Date.now(), adapters = [new GainsAdapter(), new HyperliquidAdapter(), new GMXAdapter()];
  // A validation run fails promptly and explicitly when network access is unavailable.
  for (const a of adapters) a.transport = new PublicTransport({ retries: 0, timeoutMs: 10000 });
  const registry = new MarketRegistry({ equivalences }), inventoryStatus = {}, samples = [], history = new HistoryStore(resolve(directory, 'history'));
  const engine = new OracleEngine({ registry, config, history, candles: new CandleEngine({ timeframes: ['1s', '1m'] }) });
  await Promise.all(adapters.map(async adapter => {
    try { for (const market of await adapter.discover()) registry.register(adapter.source, market);
      inventoryStatus[adapter.source] = { complete: adapter.inventoryComplete, collectedAt: Date.now(), markets: adapter.inventory.length }; }
    catch (error) { inventoryStatus[adapter.source] = { complete: false, collectedAt: Date.now(), error: error.code ?? error.message, markets: null }; }
  }));
  const historicalChecks = {};
  await Promise.all(adapters.map(async adapter => {
    const market = adapter.inventory.find(m => m.identityVerified && (m.coin || m.symbol));
    if (!market) { historicalChecks[adapter.source] = { status: 'NO_VERIFIED_MARKET' }; return; }
    try { const result = await backfill(adapter, market.sourceMarketId, { from: Date.now() - 600000, to: Date.now(), interval: '1m', limit: 3 }, history); historicalChecks[adapter.source] = { status: 'SUCCESS', persisted: result.persisted, classification: result.classification }; }
    catch (error) { historicalChecks[adapter.source] = { status: 'FAILED', error: error.code ?? error.message }; }
  }));
  const collectionStart = Date.now(), deadline = collectionStart + durationMs;
  do {
    await Promise.all(adapters.map(async adapter => {
      if (!adapter.inventory.length) return;
      try {
        const observations = await adapter.snapshot(); observations.forEach(o => engine.ingest(o));
        engine.observeExpected(adapter.source, { time: Date.now(), received: true, valid: observations.length > 0, timely: observations.some(o => Date.now() - o.timestamp <= config.maxAgeMs) });
        samples.push({ source: adapter.source, receivedAt: Date.now(), observations: observations.length, receiptTimestampCount: observations.filter(o => o.timestampKind === 'RECEIPT').length });
      } catch (error) { engine.observeExpected(adapter.source, { time: Date.now(), received: false }); samples.push({ source: adapter.source, receivedAt: Date.now(), error: error.code ?? error.message }); }
    }));
    engine.evaluate(Date.now());
    if (!Object.values(inventoryStatus).some(s => s.complete) || Date.now() >= deadline) break;
    await delay(Math.min(2000, Math.max(0, deadline - Date.now())));
  } while (Date.now() <= deadline);
  const coverage = registry.coverage(new Date().toISOString(), inventoryStatus);
  writeFileSync(resolve(directory, 'coverage.json'), JSON.stringify(coverage, null, 2) + '\n');
  const lines = ['# Open Oracle live market coverage', '', `Collected at: ${coverage.collectedAt}`, '',
    `Complete union verified: ${coverage.complete}. Canonical entries observed: ${coverage.canonicalCount}.`, '',
    '| Provider | Inventory complete | Observed markets | Error |', '| --- | --- | --- | --- |',
    ...Object.entries(inventoryStatus).map(([source, s]) => `| ${source} | ${s.complete} | ${s.markets ?? 'Unavailable'} | ${s.error ?? 'None'} |`), '',
    'Unavailable inventories are unknown, not zero-market universes. No complete market-union claim is made for an incomplete collection.', ''];
  writeFileSync(resolve(directory, 'coverage.md'), lines.join('\n'));
  const report = { startedAt: new Date(startedAt).toISOString(), completedAt: new Date().toISOString(), elapsedMs: Date.now() - startedAt,
    historicalChecks, requestedCollectionMs: durationMs, actualCollectionMs: Date.now() - collectionStart, inventoryStatus,
    observations: samples, accepted: engine.metrics.accepted, outputs: [...engine.prices.values()], health: adapters.map(a => a.health()),
    limitations: ['Unverified mappings remain source-scoped or ambiguous.', 'Receipt-only Hyperliquid contexts are default-ineligible.',
      'Polling is the initial transport; upstream WebSocket conformance is not verified.', 'Historical provider OHLC is never native oracle history.'] };
  writeFileSync(resolve(directory, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
  // Only aggregate health/count summaries are eligible for CI artifacts. Raw provider data stays local.
  writeFileSync(resolve(directory, 'validation-summary.json'), JSON.stringify({ startedAt: report.startedAt, completedAt: report.completedAt, elapsedMs: report.elapsedMs, actualCollectionMs: report.actualCollectionMs, inventoryStatus, historicalChecks, sourceHealth: report.health, accepted: report.accepted, samples, pricingModes: [...engine.prices.values()].reduce((counts, p) => { counts[p.pricingMode] = (counts[p.pricingMode] ?? 0) + 1; return counts; }, {}), limitations: report.limitations }, null, 2) + '\n');
  const { markets, ...coverageSummary } = coverage;
  writeFileSync(resolve(directory, 'coverage-summary.json'), JSON.stringify(coverageSummary, null, 2) + '\n');
  return report;
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const report = await collect({ directory: process.argv[2] ?? 'reports/live', durationMs: Number(process.argv[3] ?? 15000) });
  console.log(JSON.stringify({ directory: process.argv[2] ?? 'reports/live', elapsedMs: report.elapsedMs, inventoryStatus: report.inventoryStatus, historicalChecks: report.historicalChecks, sourceHealth: report.health, sampleCounts: report.observations.reduce((counts, s) => { counts[s.source] = (counts[s.source] ?? 0) + (s.observations ?? 0); return counts; }, {}), accepted: report.accepted }, null, 2));
  // Inventory, live prices and provider history are all acceptance conditions.
  if (!Object.values(report.inventoryStatus).every(s => s.complete) || ['gains', 'hyperliquid', 'gmx'].some(source => !report.observations.some(s => s.source === source && s.observations > 0))
    || Object.values(report.historicalChecks).some(check => check.status !== 'SUCCESS')) process.exitCode = 1;
}
