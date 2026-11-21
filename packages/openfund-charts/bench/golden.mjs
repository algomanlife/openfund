#!/usr/bin/env node
// Regenerate the committed regression snapshot of every indicator/config:
//   node packages/openfund-charts/bench/golden.mjs --write
// The snapshot holds a digest of each canonical model plus its drawing counts.
// Regenerate only for an intended, reviewed behaviour change, and record why
// in docs/reviews/pine-optimization/ACCURACY.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { createCatalog } from '../src/pine-sources.mjs';
import { syntheticBars } from './fixtures.mjs';
import { CONFIGS, canonical, counts, digest, runModel } from './differential.mjs';

export const GOLDEN_BARS = 1500;
const root = new URL('../../../', import.meta.url);
const read = file => readFileSync(new URL(`indicators/${file}`, root), 'utf8');

export async function snapshot() {
  const catalog = createCatalog(read('Open algo v5.pine'), read('pac v1.pine'), read('smc-v1.pine'));
  const libraries = { 'openfund/Overlayslibrary/1': read('Overlayslibrary.pine'), 'openfund/sdk/1': read('sdk.pine') };
  const bars = syntheticBars(GOLDEN_BARS);
  const out = {};
  for (const entry of catalog) {
    out[entry.name] = {};
    for (const [config, inputs] of Object.entries(CONFIGS[entry.name])) {
      const fetchCalls = [];
      const { model } = await runModel({ script: entry.script, libraries, bars, inputs, fetchCalls });
      out[entry.name][config] = { digest: digest(canonical(model)), counts: counts(model), secondaryRequests: fetchCalls.length };
    }
  }
  return out;
}

if (process.argv.includes('--write')) {
  const file = new URL('../test/fixtures/indicator-golden.json', import.meta.url);
  writeFileSync(file, JSON.stringify({ bars: GOLDEN_BARS, fixture: 'syntheticBars(seed=7)', indicators: await snapshot() }, null, 2) + '\n');
  console.log(`wrote ${file.pathname}`);
}
