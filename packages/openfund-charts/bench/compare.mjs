#!/usr/bin/env node
// Compare canonical models of a git revision against the working tree:
//   node packages/openfund-charts/bench/compare.mjs --ref <sha> [--bars 3000] [--only "Open Algo"]
// Prints, per indicator and configuration, whether outputs are identical and,
// if not, which drawing collections differ and by how much.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createCatalog } from '../src/pine-sources.mjs';
import { syntheticBars } from './fixtures.mjs';
import { CONFIGS, KNOWN_BASELINE_FAILURES, canonical, counts, runModel } from './differential.mjs';

const root = new URL('../../../', import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => {
  if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1] ?? 'true']);
  return pairs;
}, []));
const read = (ref, file) => ref
  ? execFileSync('git', ['show', `${ref}:indicators/${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 })
  : readFileSync(new URL(`indicators/${file}`, root), 'utf8');
const load = ref => ({
  catalog: createCatalog(read(ref, 'Open algo v5.pine'), read(ref, 'pac v1.pine'), read(ref, 'smc-v1.pine')),
  libraries: { 'openfund/Overlayslibrary/1': read(ref, 'Overlayslibrary.pine'), 'openfund/sdk/1': read(ref, 'sdk.pine') },
});
const before = load(args.ref), after = load(null);
const bars = syntheticBars(Number(args.bars ?? 3000));
const results = [];
for (const [index, entry] of after.catalog.entries()) {
  if (args.only && !entry.name.includes(args.only)) continue;
  for (const [config, inputs] of Object.entries(CONFIGS[entry.name])) {
    if (args.config && config !== args.config) continue;
    const fetchBefore = [], fetchAfter = [];
    const knownFailure = KNOWN_BASELINE_FAILURES[entry.name]?.[config];
    if (knownFailure && args.ref) {
      const b = await runModel({ script: entry.script, libraries: after.libraries, bars, inputs, fetchCalls: fetchAfter });
      results.push({ indicator: entry.name, config, identical: false, baselineFailure: knownFailure, after: { ...counts(b.model), requests: fetchAfter.length } });
      console.log(`FIXED ${entry.name} / ${config}  baseline: ${knownFailure}; now lines ${b.model.lines.length} labels ${b.model.labels.length} linefills ${b.model.linefills.length}`);
      continue;
    }
    const a = await runModel({ script: before.catalog[index].script, libraries: before.libraries, bars, inputs, fetchCalls: fetchBefore });
    const b = await runModel({ script: entry.script, libraries: after.libraries, bars, inputs, fetchCalls: fetchAfter });
    const dropTables = entry.name === 'Open Algo V5';
    const ca = canonical(a.model, { dropTables }), cb = canonical(b.model, { dropTables });
    const differing = [...new Set([...Object.keys(ca), ...Object.keys(cb)])]
      .filter(key => JSON.stringify(ca[key]) !== JSON.stringify(cb[key]));
    const row = {
      indicator: entry.name, config, identical: differing.length === 0, differing,
      before: { ...counts(a.model), requests: fetchBefore.length }, after: { ...counts(b.model), requests: fetchAfter.length },
    };
    if (differing.length && args.detail) {
      row.detail = Object.fromEntries(differing.map(key => {
        const x = Array.isArray(ca[key]) ? ca[key] : [ca[key]], y = Array.isArray(cb[key]) ? cb[key] : [cb[key]];
        const sx = new Set(x.map(v => JSON.stringify(v))), sy = new Set(y.map(v => JSON.stringify(v)));
        return [key, { onlyBefore: [...sx].filter(v => !sy.has(v)).slice(0, 3), onlyAfter: [...sy].filter(v => !sx.has(v)).slice(0, 3) }];
      }));
    }
    results.push(row);
    console.log(`${row.identical ? 'SAME' : 'DIFF'}  ${entry.name} / ${config}  ${differing.join(',')}  ` +
      `requests ${row.before.requests}->${row.after.requests}  lines ${row.before.lines}->${row.after.lines}  labels ${row.before.labels}->${row.after.labels}  boxes ${row.before.boxes}->${row.after.boxes}  tables ${row.before.tables}->${row.after.tables}`);
  }
}
if (args.out) writeFileSync(args.out, JSON.stringify(results, null, 2) + '\n');
if (args.detail) console.log(JSON.stringify(results.filter(r => !r.identical).map(r => ({ i: r.indicator, c: r.config, d: r.detail })), null, 1).slice(0, 20000));
