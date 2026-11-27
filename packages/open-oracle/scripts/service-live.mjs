import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { GainsAdapter, HyperliquidAdapter, GMXAdapter, OpenOracleService, isUsable } from '../src/index.mjs';
import { PublicTransport } from '../src/transport.mjs';
/**
 * Live acceptance for the Openfund pricing service: runs the production
 * service configuration against the public providers and writes an
 * aggregate-only summary (no raw provider payloads) used to calibrate the
 * service thresholds. Usage: node scripts/service-live.mjs [directory] [durationMs]
 */
const percentile = (values, q) => { if (!values.length) return null; const s = [...values].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
export async function run({ directory = 'reports/live', durationMs = 90000 } = {}) {
  directory = resolve(directory); mkdirSync(directory, { recursive: true });
  const transport = () => new PublicTransport({ retries: 1, timeoutMs: 10000 });
  const adapters = {
    gains: new GainsAdapter({ transport: transport() }),
    hyperliquid: new HyperliquidAdapter({ transport: transport(), includeBuilderDexs: false, includeSpot: false }),
    gmx: new GMXAdapter({ transport: transport(), networks: [{ name: 'arbitrum', oracle: 'https://arbitrum-api.gmxinfra.io', api: 'https://arbitrum.gmxapi.io' }] }),
  };
  const service = new OpenOracleService({ adapters, logger: console }).start();
  const startedAt = Date.now(), ticks = [], spreads = [], divergent = new Map(), exclusions = {};
  await delay(Math.min(20000, durationMs));                     // inventories, first snapshots and the first rebuild
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    await delay(5000);
    const now = Date.now(), records = service.snapshot(), modes = {};
    let usable = 0;
    for (const r of records) {
      modes[r.mode] = (modes[r.mode] ?? 0) + 1; if (isUsable(r, now)) usable++;
      if (r.configuredSources > 1 && r.eligibleSources >= 2) spreads.push(Number(r.spread));
      if (r.mode === 'DIVERGENT') divergent.set(r.market, (divergent.get(r.market) ?? 0) + 1);
      for (const s of r.sources) if (!s.eligible) exclusions[`${s.source}:${s.reason}`] = (exclusions[`${s.source}:${s.reason}`] ?? 0) + 1;
    }
    ticks.push({ at: new Date(now).toISOString(), markets: records.length, usable, modes, joinedModes: records.filter(r => r.configuredSources > 1).reduce((m, r) => (m[r.mode] = (m[r.mode] ?? 0) + 1, m), {}) });
  }
  const status = service.status(); service.stop();
  // Calibration evidence: per-source normalized prices and ages for the most divergent joined markets, and Gains input ages.
  const divergentDetail = [...divergent].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([market]) => {
    const r = service.get(market); return { market, mode: r?.mode, sources: (r?.sources ?? []).map(s => ({ source: s.source, price: s.price, rawPrice: s.rawPrice, ageMs: s.ageMs, eligible: s.eligible, reason: s.reason })) };
  });
  const now = Date.now(), gainsAges = [...service.gainsLatest.values()].map(o => now - o.timestamp);
  const joinedSample = service.rules.slice(0, 15).map(rule => { const r = service.get(rule.canonicalId); return { market: rule.canonicalId, mode: r?.mode, sources: (r?.sources ?? []).map(s => ({ source: s.source, price: s.price, ageMs: s.ageMs, reason: s.reason })) }; });
  const summary = { startedAt: new Date(startedAt).toISOString(), elapsedMs: Date.now() - startedAt, configurationVersion: status.configurationVersion, status,
    rejectedReasons: service.rejected.reduce((m, r) => (m[`${r.source}:${r.reason}`] = (m[`${r.source}:${r.reason}`] ?? 0) + 1, m), {}),
    joined: service.rules.map(r => ({ market: r.canonicalId, members: r.members.map(m => m.source) })),
    ticks, exclusions,
    spread: { samples: spreads.length, p50: percentile(spreads, 0.5), p90: percentile(spreads, 0.9), p99: percentile(spreads, 0.99), max: spreads.length ? Math.max(...spreads) : null },
    divergentDetail, joinedSample, gainsInputAgeMs: { samples: gainsAges.length, p10: percentile(gainsAges, 0.1), p50: percentile(gainsAges, 0.5), p90: percentile(gainsAges, 0.9) },
    divergentMarkets: [...divergent].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([market, samples]) => ({ market, samples })),
    limitations: ['Aggregate service behaviour over a short public window; not absolute accuracy.', 'Hyperliquid timestamps are receipt times.'] };
  writeFileSync(resolve(directory, 'service-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  return summary;
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const summary = await run({ directory: process.argv[2] ?? 'reports/live', durationMs: Number(process.argv[3] ?? 90000) });
  const last = summary.ticks.at(-1) ?? {};
  console.log(JSON.stringify({ joinedMarkets: summary.status.joinedMarkets, members: summary.status.members, last, spread: summary.spread, divergentMarkets: summary.divergentMarkets.slice(0, 10), divergentDetail: summary.divergentDetail, joinedSample: summary.joinedSample, gainsInputAgeMs: summary.gainsInputAgeMs, rejectedReasons: summary.rejectedReasons, exclusions: summary.exclusions }, null, 2));
  if (!summary.status.joinedMarkets || !(last.modes?.TRIPLE_SOURCE > 0)) process.exitCode = 1;
}
