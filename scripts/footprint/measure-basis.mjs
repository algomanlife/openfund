#!/usr/bin/env node
/*
 * Measures the price basis between Gains (chart price source) and Hyperliquid
 * (footprint trade source) for each candidate market, so the footprint price
 * compatibility thresholds come from observed data, not one arbitrary constant.
 *
 * Read-only: polls the public Gains prices REST endpoint and the public
 * Hyperliquid `allMids` info request. Writes a JSON summary (per market:
 * sample count, median/p05/p95/p99 basis in bps, MAD, max |bps|).
 *
 * usage: node scripts/footprint/measure-basis.mjs --minutes 30 --every 5 --out <file>
 */
import { writeFile } from 'node:fs/promises';
import { CANDIDATE_MARKETS } from '../../packages/openfund-footprint/src/markets.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const minutes = Number(arg('minutes', 30)), every = Number(arg('every', 5)), out = arg('out', 'basis.json');
const HL = 'https://api.hyperliquid.xyz/info', GAINS = 'https://api.gains.trade/v1/arbitrum/prices';
const post = (body) => fetch(HL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }).then(r => r.json());
const dexes = [...new Set(CANDIDATE_MARKETS.map(m => m.dex))];
const samples = Object.fromEntries(CANDIDATE_MARKETS.map(m => [m.gains, []]));
const started = Date.now();
let rounds = 0, failures = 0;
while (Date.now() - started < minutes * 60000) {
  const t0 = Date.now();
  try {
    const [g, ...mids] = await Promise.all([
      fetch(GAINS, { signal: AbortSignal.timeout(8000) }).then(r => r.json()),
      ...dexes.map(dex => post(dex ? { type: 'allMids', dex } : { type: 'allMids' })),
    ]);
    const gains = new Map((g.data || g).map(x => [x.market, x]));
    const hl = Object.assign({}, ...mids);
    for (const m of CANDIDATE_MARKETS) {
      const gq = gains.get(m.gains), h = Number(hl[m.coin]);
      if (!gq || !(h > 0)) continue;
      const gm = Number(gq.mark), at = Number(gq.updatedAt);
      if (!(gm > 0) || t0 - at > 15000) continue;       // skip stale Gains marks
      samples[m.gains].push((h - gm) / gm * 1e4);
    }
    rounds++;
  } catch { failures++; }
  await new Promise(r => setTimeout(r, Math.max(0, every * 1000 - (Date.now() - t0))));
}
const q = (s, p) => s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
const summary = {};
for (const [k, v] of Object.entries(samples)) {
  const s = [...v].sort((a, b) => a - b);
  if (!s.length) { summary[k] = { n: 0 }; continue; }
  const med = q(s, 0.5), mad = q(s.map(x => Math.abs(x - med)).sort((a, b) => a - b), 0.5);
  const r = x => Math.round(x * 100) / 100;
  summary[k] = { n: s.length, medianBps: r(med), madBps: r(mad), p05Bps: r(q(s, 0.05)), p95Bps: r(q(s, 0.95)), p99Bps: r(q(s, 0.99)), maxAbsBps: r(Math.max(...s.map(Math.abs))) };
}
const doc = { measuredAt: new Date(started).toISOString(), durationMin: minutes, intervalSec: every, rounds, failures,
  method: 'Hyperliquid allMids vs Gains /prices mark, Gains marks older than 15 s skipped', markets: summary };
await writeFile(out, JSON.stringify(doc, null, 2) + '\n');
console.log(JSON.stringify(doc, null, 1));
