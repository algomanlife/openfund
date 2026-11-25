import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculatePrice, DEFAULT_CONFIG } from '../src/pricing.ts';
import { decimal, format, divRound, SCALE, median } from '../src/decimal.ts';
const now = 1795500000000;
const scenarios = [
  ['agreement', ['95000', '95100', '94950'], [0, 0, 0]],
  ['source_age', ['95000', '95100', '94950'], [0, 1500, 1000]],
  ['outlier', ['95000', '95100', '150000'], [0, 0, 0]],
  ['near_tolerance', ['95000', '95900', '95020'], [0, 0, 0]],
];
const rows = scenarios.map(([name, prices, ages]) => {
  const inputs = ['gains', 'hyperliquid', 'gmx'].map((source, i) => ({ source, sourceMarketId: source, marketId: 'TEST/USD', price: prices[i],
    timestamp: now - ages[i], receivedAt: now, timestampKind: 'PROVIDER', mappingVerified: true, quoteValid: true, semantics: 'UNDERLYING_REFERENCE' }));
  const robust = calculatePrice('TEST/USD', inputs, now);
  const equal = { price: format(divRound(prices.reduce((sum, price) => sum + decimal(price), 0n), BigInt(prices.length))) };
  const base = { price: format(divRound(prices.reduce((sum, price, i) => sum + decimal(price) * [4n, 3n, 3n][i], 0n), 10n)) };
  const fresh = calculatePrice('TEST/USD', inputs, now, { ...DEFAULT_CONFIG, version: 'fresh-research', huberK: '1000000', hardDeviation: '10' });
  const leaveOneOut = inputs.map((source, i) => ({ omitted: source.source, result: calculatePrice('TEST/USD', inputs.filter((_, j) => i !== j), now) }));
  const concentration = robust.sources.reduce((n, s) => n + Number(s.weight) ** 2, 0);
  return { name, inputs, base: base.price, equal: equal.price, median: format(median(prices.map(decimal))), freshness: fresh.price,
    robust, leaveOneOut, concentration, availability: robust.price !== null, dispersion: robust.dispersion,
    maxAgeMs: Math.max(...ages), sourceLossDiscontinuity: leaveOneOut.map(v => ({ omitted: v.omitted, absolute: v.result.price && robust.price ? format(decimal(v.result.price) > decimal(robust.price) ? decimal(v.result.price) - decimal(robust.price) : decimal(robust.price) - decimal(v.result.price)) : null })) };
});
const directory = resolve(process.argv[2] ?? 'benchmarks'); mkdirSync(directory, { recursive: true });
const report = { generatedAt: new Date().toISOString(), dataset: 'Explicit synthetic scenarios; no independently justified accuracy ground truth or live calibration dataset is available.',
  parametersChanged: false, rows, conclusion: 'Retain research defaults. No absolute accuracy, statistical probability or production calibration claim is supported.' };
writeFileSync(resolve(directory, 'calibration.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(resolve(directory, 'calibration.md'), ['# Methodology sensitivity experiment', '', report.dataset, '',
  '| Scenario | Base | Equal | Median | Freshness | Robust | State | HHI |', '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows.map(r => `| ${r.name} | ${r.base ?? 'Unavailable'} | ${r.equal ?? 'Unavailable'} | ${r.median} | ${r.freshness ?? 'Unavailable'} | ${r.robust.price ?? 'Unavailable'} | ${r.robust.pricingMode} | ${r.concentration.toFixed(4)} |`), '', report.conclusion, ''].join('\n'));
console.log(JSON.stringify({ scenarios: rows.length, conclusion: report.conclusion }));
