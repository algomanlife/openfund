#!/usr/bin/env node
// Reproducible Pine indicator benchmark (Node, in-process PineTS — the same
// engine code the browser runs inside openfund-pine-worker).
//
//   node --expose-gc packages/openfund-charts/bench/pine-bench.mjs \
//     [--ref <git-ref>] [--sizes 500,2000,5000,10000] [--live-sizes 2000] \
//     [--runs 3] [--ticks 30] [--out file.json]
//
// --ref reads the three indicators and two libraries from a git revision
// (for before/after comparisons in one environment); default: working tree.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { PineEngine } from '../../../apps/web-react/node_modules/@luxalgo/vela-pinets/dist/index.js';
import { Indicator, PineTS, MapImportResolver } from '../../../apps/web-react/node_modules/pinets/dist/pinets.min.es.js';
import { createCatalog, createLibraryResolver } from '../src/pine-sources.mjs';
import { installPineCompatibility } from '../src/pine-compatibility.mjs';
import { preserveUnknownVolume } from '../src/pine-data.mjs';
import { fixtureInfo, seriesFetcher, syntheticBars } from './fixtures.mjs';

const root = new URL('../../../', import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => {
  if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]?.startsWith('--') ? 'true' : all[i + 1] ?? 'true']);
  return pairs;
}, []));
const ref = args.ref;
const sizes = (args.sizes ?? '500,2000,5000,10000').split(',').map(Number);
const liveSizes = (args['live-sizes'] ?? '2000').split(',').filter(Boolean).map(Number);
const runs = Number(args.runs ?? 3);
const ticks = Number(args.ticks ?? 30);
const only = args.only ? args.only.split(',') : null;

function readSource(file) {
  if (!ref) return readFileSync(new URL(`indicators/${file}`, root), 'utf8');
  return execFileSync('git', ['show', `${ref}:indicators/${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
}

installPineCompatibility(Indicator);
const libraries = { 'openfund/Overlayslibrary/1': readSource('Overlayslibrary.pine'), 'openfund/sdk/1': readSource('sdk.pine') };
const catalog = createCatalog(readSource('Open algo v5.pine'), readSource('pac v1.pine'), readSource('smc-v1.pine'))
  .filter(entry => !only || only.some(name => entry.name.toLowerCase().includes(name.toLowerCase())));
const importResolver = createLibraryResolver(libraries);

const quantile = (values, q) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const median = values => quantile(values, 0.5);
const gc = () => globalThis.gc?.();
const counts = model => ({
  series: model.series?.length ?? 0, lines: model.lines?.length ?? 0, boxes: model.boxes?.length ?? 0,
  labels: model.labels?.length ?? 0, fills: model.fills?.length ?? 0, tables: model.tables?.length ?? 0,
  linefills: model.linefills?.length ?? 0,
});

function heapSampler() {
  let peak = process.memoryUsage().heapUsed;
  const timer = setInterval(() => { peak = Math.max(peak, process.memoryUsage().heapUsed); }, 2);
  return () => { clearInterval(timer); return Math.max(peak, process.memoryUsage().heapUsed); };
}

function runStatic(engine, prepared, bars, fetchSeries) {
  return new Promise((resolve, reject) => {
    let model, session;
    const timeout = setTimeout(() => { session?.stop(); reject(new Error('static run timed out')); }, 300_000);
    session = engine.execute({ prepared, market: { symbol: 'BTC/USD', timeframe: '1', symbolInfo: fixtureInfo }, bars, mode: 'static', fetchSeries }, {
      onModel: value => { model = value; },
      onDone: () => { clearTimeout(timeout); session.stop(); resolve(model); },
      onError: error => { clearTimeout(timeout); session?.stop(); reject(error); },
    });
  });
}

async function measureStatic(entry, length) {
  const bars = syntheticBars(length);
  const engine = preserveUnknownVolume(new PineEngine({ importResolver }));
  let t = performance.now();
  const prepared = await engine.prepare(entry.script, `bench-${entry.name}`);
  const prepareMs = performance.now() - t;
  const samples = [], cpu = [];
  let model, calls = [], peakHeap = 0, baseHeap;
  for (let i = 0; i < runs; i++) {
    calls = [];
    gc();
    baseHeap = process.memoryUsage().heapUsed;
    const stopSampler = heapSampler();
    const c0 = process.cpuUsage();
    t = performance.now();
    model = await runStatic(engine, prepared, bars, seriesFetcher(bars, calls));
    samples.push(performance.now() - t);
    const c1 = process.cpuUsage(c0);
    cpu.push((c1.user + c1.system) / 1000);
    peakHeap = Math.max(peakHeap, stopSampler() - baseHeap);
  }
  gc();
  return {
    bars: length, inputs: prepared.inputs.length, prepareMs, initMs: median(samples), initSamplesMs: samples,
    cpuMs: median(cpu), peakHeapDeltaMB: peakHeap / 2 ** 20, secondaryRequests: calls.length,
    secondaryTimeframes: [...new Set(calls.map(call => call.tf))], drawings: counts(model),
  };
}

// Live: PineTS stream over a mutable bar array, the same provider contract
// vela-pinets' makeLiveProvider implements, polled at 5 ms so latency is
// dominated by computation rather than the browser's 1 s poll interval.
async function measureLive(entry, length) {
  const base = syntheticBars(length + ticks);
  const bars = base.slice(0, length).map(bar => ({ ...bar }));
  const engine = new PineEngine({ importResolver });
  const prepared = await engine.prepare(entry.script, `live-${entry.name}`);
  const calls = [];
  const fetchSeries = seriesFetcher(base, calls);
  let lastSig = '', dirty = true;
  const kline = bar => ({ openTime: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: NaN });
  const provider = {
    getMarketData: async (ticker, tf, limit, sDate) => {
      if (ticker !== 'BTC/USD' || tf !== '1') {
        return (await fetchSeries(ticker, tf, { limit })).map(kline);
      }
      const all = bars.map(kline);
      if (sDate == null) return all;
      const tail = all.filter(k => k.openTime >= sDate);
      const last = tail.at(-1);
      const sig = last ? `${tail.length}|${last.openTime}|${last.close}|${last.high}|${last.low}` : '';
      if (!dirty && sig === lastSig) return [];
      dirty = false; lastSig = sig;
      return tail;
    },
    getSymbolInfo: async () => fixtureInfo,
  };
  const pine = new PineTS(provider, 'BTC/USD', '1', length);
  if (prepared.token.libraries) pine.setImportResolver(new MapImportResolver({ libraries: prepared.token.libraries }));
  const indicator = new Indicator(prepared.token.source, {});
  let waiting = null, events = 0;
  const t0 = performance.now();
  const stream = pine.stream(indicator, { live: true, interval: 5, pageSize: length });
  stream.on('data', () => { events++; waiting?.(); });
  stream.on('error', error => { console.error(entry.name, error); });
  const next = () => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('live update timed out')), 120_000);
    waiting = () => { clearTimeout(timer); waiting = null; resolve(); };
  });
  await next();
  const initialMs = performance.now() - t0;
  gc();
  const heapStart = process.memoryUsage().heapUsed;
  const tickMs = [], candleMs = [], tickCpu = [];
  for (let i = 0; i < ticks; i++) {
    const nextBar = base[length + i];
    const last = bars.at(-1);
    // A mark update inside the forming candle.
    const mark = Math.round((last.close + (nextBar.close - last.close) / 2) * 10) / 10;
    Object.assign(last, { close: mark, high: Math.max(last.high, mark), low: Math.min(last.low, mark) });
    let pending = next(); dirty = true;
    let c0 = process.cpuUsage(), t = performance.now();
    await pending;
    tickMs.push(performance.now() - t);
    const c1 = process.cpuUsage(c0); tickCpu.push((c1.user + c1.system) / 1000);
    // Candle boundary: a new bar opens.
    bars.push({ ...nextBar, open: mark, high: Math.max(mark, nextBar.high), low: Math.min(mark, nextBar.low) });
    pending = next(); dirty = true; t = performance.now();
    await pending;
    candleMs.push(performance.now() - t);
  }
  stream.stop();
  gc();
  const heapGrowthMB = (process.memoryUsage().heapUsed - heapStart) / 2 ** 20;
  const pick = values => ({ p50: quantile(values, 0.5), p95: quantile(values, 0.95), p99: quantile(values, 0.99), max: Math.max(...values) });
  return { bars: length, initialMs, events, tick: pick(tickMs), tickCpuMs: pick(tickCpu), candle: pick(candleMs), heapGrowthAfterUpdatesMB: heapGrowthMB };
}

async function measureTogether(length) {
  const bars = syntheticBars(length);
  const calls = [];
  const engines = catalog.map(() => preserveUnknownVolume(new PineEngine({ importResolver })));
  const prepared = await Promise.all(catalog.map((entry, i) => engines[i].prepare(entry.script, `together-${i}`)));
  gc();
  const stop = heapSampler(), base = process.memoryUsage().heapUsed, c0 = process.cpuUsage(), t = performance.now();
  await Promise.all(prepared.map((p, i) => runStatic(engines[i], p, bars, seriesFetcher(bars, calls))));
  const wall = performance.now() - t, c1 = process.cpuUsage(c0);
  return { bars: length, wallMs: wall, cpuMs: (c1.user + c1.system) / 1000, peakHeapDeltaMB: (stop() - base) / 2 ** 20, secondaryRequests: calls.length };
}

const report = {
  generatedAt: new Date().toISOString(), ref: ref ?? 'working-tree',
  environment: { node: process.version, platform: `${os.platform()} ${os.arch()}`, cpu: os.cpus()[0]?.model, cores: os.cpus().length, gcExposed: typeof globalThis.gc === 'function' },
  method: { fixture: 'syntheticBars(seed=7), 1m, regimes up/down/volatile/flat', runs, ticks, sizes, liveSizes },
  indicators: {}, together: [],
};
for (const entry of catalog) {
  const result = report.indicators[entry.name] = { static: [], live: [] };
  for (const size of sizes) {
    const row = await measureStatic(entry, size);
    result.static.push(row);
    console.error(`${entry.name} static ${size}: ${row.initMs.toFixed(1)} ms, ${row.secondaryRequests} secondary`);
  }
  for (const size of liveSizes) {
    const row = await measureLive(entry, size);
    result.live.push(row);
    console.error(`${entry.name} live ${size}: tick p50 ${row.tick.p50.toFixed(1)} ms, candle p50 ${row.candle.p50.toFixed(1)} ms`);
  }
}
if (!only) for (const size of sizes.filter(size => size <= 5000)) report.together.push(await measureTogether(size));
const json = JSON.stringify(report, null, 2);
if (args.out) writeFileSync(args.out, json + '\n');
else console.log(json);
