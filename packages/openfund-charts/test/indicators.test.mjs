// Behavioural tests for the three catalog indicators: regression snapshots,
// Open Algo dashboard removal and saved-setting migration, lookahead and
// repainting corrections, independent calculation checks and live updates.
// Fixtures are seeded synthetic OHLC (no volume): they test calculation and
// runtime behaviour, not market accuracy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createCatalog, migrateWorkspaceState, RETIRED_INPUTS } from '../src/pine-sources.mjs';
import { aggregate, syntheticBars } from '../bench/fixtures.mjs';
import { CONFIGS, canonical, digest, runModel } from '../bench/differential.mjs';
import { GOLDEN_BARS } from '../bench/golden.mjs';
import { runLive, schedule } from '../bench/live.mjs';

const read = file => readFileSync(new URL(`../../../indicators/${file}`, import.meta.url), 'utf8');
const libraries = { 'openfund/Overlayslibrary/1': read('Overlayslibrary.pine'), 'openfund/sdk/1': read('sdk.pine') };
const sources = { openAlgo: read('Open algo v5.pine'), pac: read('pac v1.pine'), smc: read('smc-v1.pine') };
const [openAlgo, pac, smc] = createCatalog(sources.openAlgo, sources.pac, sources.smc);
const golden = JSON.parse(readFileSync(new URL('./fixtures/indicator-golden.json', import.meta.url)));
const goldenBars = syntheticBars(GOLDEN_BARS);
const MINUTE = 60_000;

for (const entry of [openAlgo, pac, smc]) {
  test(`${entry.name}: every configuration matches the reviewed regression snapshot`, async () => {
    assert.equal(golden.bars, GOLDEN_BARS);
    assert.deepEqual(Object.keys(golden.indicators[entry.name]), Object.keys(CONFIGS[entry.name]));
    for (const [config, inputs] of Object.entries(CONFIGS[entry.name])) {
      const fetchCalls = [];
      const { model } = await runModel({ script: entry.script, libraries, bars: goldenBars, inputs, fetchCalls });
      const expected = golden.indicators[entry.name][config];
      assert.equal(fetchCalls.length, expected.secondaryRequests, `${config}: secondary requests`);
      assert.equal(digest(canonical(model)), expected.digest, `${config}: model changed (see bench/golden.mjs)`);
    }
  });
}

test('Open Algo: the SMRT Algo dashboard is gone from source, schema, output and requests', async () => {
  for (const retired of ['enableDashboard', 'locationDashboard', 'sizeDashboard', 'securityNoRep', 'TF60Bull',
    'TF120Bull', 'TF240Bull', 'TF720Bull', 'TFDBull', 'dashboard_cell', 'SMRT Algo', 'DASHBOARD']) {
    assert(!sources.openAlgo.includes(retired), `source still mentions ${retired}`);
  }
  assert.doesNotMatch(sources.openAlgo, /\brequest\.|\btable\./);
  const everything = CONFIGS['Open Algo V5'].everything;
  for (const inputs of [{}, everything]) {
    const fetchCalls = [];
    const { prepared, model } = await runModel({ script: openAlgo.script, libraries, bars: syntheticBars(600), inputs, fetchCalls });
    assert.equal(prepared.inputs.length, 76);
    assert(!prepared.inputs.some(input => RETIRED_INPUTS['Open Algo V5'].includes(input.key)));
    assert.equal(model.tables.length, 0);
    assert.equal(fetchCalls.length, 0);
  }
});

test('Open Algo: independent features still produce their output after the removal', async () => {
  const { model } = await runModel({ script: openAlgo.script, libraries, bars: goldenBars, inputs: { riskmanage: true } });
  assert(model.labels.some(label => /^buy|^sell/.test(label.text)), 'Buy/Sell signals');
  assert(model.series.some(series => series.title === 'Smart Trail' && series.points.some(p => Number.isFinite(p.value))), 'Smart Trail');
  for (const level of ['Entry', 'SL', 'TP 1', 'TP 2', 'TP 3']) {
    assert.equal(model.labels.filter(label => label.text.startsWith(`${level} :`)).length, 1, level);
  }
  assert.equal(model.lines.length, 5, 'one line per TP/SL level');
});

test('saved Open Algo instances with retired dashboard inputs still load and are migrated', async () => {
  const stale = { enableDashboard: false, locationDashboard: 'Top left', sizeDashboard: 'Normal' };
  const bars = syntheticBars(600);
  const withStale = await runModel({ script: openAlgo.script, libraries, bars, inputs: { ...stale, riskmanage: true } });
  const clean = await runModel({ script: openAlgo.script, libraries, bars, inputs: { riskmanage: true } });
  assert.deepEqual(canonical(withStale.model), canonical(clean.model));

  const saved = { charts: [{ indicators: [
    'Price Action Concepts',
    { name: 'Open Algo V5', inputs: { ...stale, riskmanage: true } },
    { name: 'Open Algo V5', inputs: { ...stale }, hidden: true },
    { name: 'Smart Money Concepts', inputs: { enableDashboard: true } },
  ] }] };
  const { state, changed } = migrateWorkspaceState(structuredClone(saved));
  assert(changed);
  assert.deepEqual(state.charts[0].indicators, [
    'Price Action Concepts',
    { name: 'Open Algo V5', inputs: { riskmanage: true } },
    { name: 'Open Algo V5', hidden: true },
    // Another indicator's identically named input is not touched.
    { name: 'Smart Money Concepts', inputs: { enableDashboard: true } },
  ]);
  assert.equal(migrateWorkspaceState({ charts: [{ indicators: ['Open Algo V5'] }] }).changed, false);
  assert.equal(migrateWorkspaceState(null).changed, false);

  // The bridge applies the migration to the stored document it hands Vela.
  const window = { OpenfundGains: {}, VelaWorkspace: { VelaWorkspace: function VelaWorkspace() {}, migrateWorkspaceState } };
  vm.runInNewContext(readFileSync(new URL('../src/vela-bridge.js', import.meta.url), 'utf8'), { window, JSON });
  const migrated = JSON.parse(window.OpenfundCharts.migrateStored(JSON.stringify(saved)));
  assert.deepEqual(migrated.charts[0].indicators[1], { name: 'Open Algo V5', inputs: { riskmanage: true } });
  const current = JSON.stringify({ charts: [{ indicators: ['Open Algo V5'] }] });
  assert.equal(window.OpenfundCharts.migrateStored(current), current);
  assert.equal(window.OpenfundCharts.migrateStored('{not json'), '{not json');
  assert.equal(window.OpenfundCharts.migrateStored(null), null);
});

test('Open Algo trend lines equal an independent least-squares channel over the last 150 closes', async () => {
  const bars = goldenBars, period = 150;
  const { model } = await runModel({ script: openAlgo.script, libraries, bars, inputs: { autoTL: true } });
  const tail = bars.slice(-period).reverse(); // tail[j] = bar j bars back
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  tail.forEach((bar, i) => { const x = i + 1; sx += x; sy += bar.close; sxx += x * x; sxy += x * bar.close; });
  const slope = (period * sxy - sx * sy) / (period * sxx - sx * sx);
  const latest = sy / period - slope * sx / period + slope;
  let up = 0, dn = 0;
  tail.forEach((bar, j) => { up = Math.max(up, bar.high - (latest + slope * j)); dn = Math.max(dn, latest + slope * j - bar.low); });
  const lines = model.lines.filter(line => line.x2 === bars.length - 1 && line.x1 === bars.length - period);
  assert.equal(lines.length, 3);
  const close = (a, b) => Math.abs(a - b) <= 1e-6 * Math.abs(b);
  for (const offset of [up, 0, -dn]) {
    assert(lines.some(line => close(line.y2, latest + offset) && close(line.y1, latest + slope * (period - 1) + offset)), `offset ${offset}`);
  }
});

test('PAC previous-day high/low are the last completed UTC day, anchored at the bar that set them', async () => {
  const all = syntheticBars(2600);
  const inputs = { show_pdhl: true, structureScannerOn: false, timeframe1Enabled: false, timeframe2Enabled: false };
  const day1 = all.slice(0, 1440);
  const highBar = day1.reduce((best, bar) => bar.high >= best.high ? bar : best);
  const lowBar = day1.reduce((best, bar) => bar.low <= best.low ? bar : best);
  // Several cut points inside day 2: a "previous day" level must never move
  // while the current day develops (it did when it was read with lookahead).
  for (const cut of [1450, 1700, 2100, 2600]) {
    const bars = all.slice(0, cut);
    assert.equal(aggregate(bars, 'D')[0].high, highBar.high);
    const { model } = await runModel({ script: pac.script, libraries, bars, inputs });
    const label = text => model.labels.find(item => item.text === text);
    assert.equal(label('PDH')?.y, highBar.high, `PDH at ${cut}`);
    assert.equal(label('PDL')?.y, lowBar.low, `PDL at ${cut}`);
    assert(model.lines.some(line => line.x1 === highBar.time && line.y1 === highBar.high), `PDH anchor at ${cut}`);
    assert(model.lines.some(line => line.x1 === lowBar.time && line.y1 === lowBar.low), `PDL anchor at ${cut}`);
  }
  // Without a completed previous week there is no weekly level.
  const { model } = await runModel({ script: pac.script, libraries, bars: all, inputs: { ...inputs, show_pwhl: true } });
  assert(!model.lines.some(line => line.color?.startsWith('#2157f3') && line.y1 > highBar.high));
});

test('SMC higher-timeframe fair value gaps use completed candles only', async () => {
  const inputs = { showFairValueGapsInput: true, fairValueGapsTimeframeInput: '5', fairValueGapsThresholdInput: false,
    showInternalOrderBlocksInput: false, showEqualHighsLowsInput: false, showHighLowSwingsInput: false };
  let checked = 0;
  for (const cut of [1203, 1307, 1411, 1499]) { // all inside a forming 5-minute candle
    const bars = goldenBars.slice(0, cut);
    const lastBarClose = bars.at(-1).time + MINUTE;
    const { model } = await runModel({ script: smc.script, libraries, bars, inputs });
    for (const box of model.boxes.filter(item => item.xloc === 'bar_time')) {
      const candleOpen = box.right - MINUTE; // right = third candle's open + one chart bar
      assert(candleOpen + 5 * MINUTE <= lastBarClose, `gap at ${new Date(candleOpen).toISOString()} used an unfinished candle`);
      checked++;
    }
  }
  assert(checked > 0, 'fixture produced gaps');
});

test('PAC Trendline Liquidity runs together with the higher-timeframe order blocks', async () => {
  const fetchCalls = [];
  const { model } = await runModel({ script: pac.script, libraries, bars: syntheticBars(2000), inputs: { activateLiq: true }, fetchCalls });
  assert(fetchCalls.some(call => call.tf === '240') && fetchCalls.some(call => call.tf === '15'));
  assert(model.linefills.length > 0);
});

test('Open Algo live updates converge on the static result without stale drawings', async () => {
  const all = syntheticBars(1300), inputs = { riskmanage: true, autoTL: true, enableSR: true };
  const live = await runLive({ script: openAlgo.script, libraries, bars: all, start: 1200, inputs, updates: schedule(all, 1200, 3, 2) });
  const fresh = await runModel({ script: openAlgo.script, libraries, bars: live.bars, inputs });
  assert(live.models >= 10);
  assert.deepEqual(canonical(live.model), canonical(fresh.model));
});
