import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GainsAdapter, HyperliquidAdapter, GMXAdapter, MarketRegistry, OracleEngine, CandleEngine, HistoryStore, createOracleServer, DEFAULT_CONFIG } from '../src/index.mjs';
const configFile = process.argv[2], options = configFile ? JSON.parse(readFileSync(resolve(configFile), 'utf8')) : {};
const config = { ...DEFAULT_CONFIG, ...options.pricing }, registry = new MarketRegistry({ equivalences: options.equivalences ?? [] });
const history = new HistoryStore(resolve(options.historyDirectory ?? 'reports/local-history'));
const engine = new OracleEngine({ registry, config, history, candles: new CandleEngine({ timeframes: options.timeframes ?? ['1s', '1m'] }) });
const adapters = [new GainsAdapter(), new HyperliquidAdapter(), new GMXAdapter()], controller = new AbortController();
const api = createOracleServer(engine, adapters), address = await api.listen(options.port ?? 9091);
console.log(JSON.stringify({ event: 'listening', address, productionIntegrated: false, publicationEnabled: false }));
const evaluationTimer = setInterval(() => engine.evaluate(Date.now()), options.evaluationIntervalMs ?? 1000);
const tasks = adapters.map(async adapter => {
  try {
    for (const market of await adapter.discover(controller.signal)) registry.register(adapter.source, market);
    for await (const observations of adapter.stream({ signal: controller.signal, intervalMs: options.pollIntervalMs ?? 2000, onHealth: sample => engine.observeExpected(adapter.source, sample) })) {
      observations.forEach(o => engine.ingest(o));
      engine.evaluate(Date.now());
    }
  } catch (error) { console.error(JSON.stringify({ source: adapter.source, event: 'source_unavailable', code: error.code ?? error.message })); }
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { clearInterval(evaluationTimer); controller.abort(); await Promise.allSettled(tasks); await api.close(); });
await Promise.allSettled(tasks);
