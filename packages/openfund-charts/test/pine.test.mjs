import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { PineEngine } from '../../../apps/web-react/node_modules/@luxalgo/vela-pinets/dist/index.js';
import { Indicator } from '../../../apps/web-react/node_modules/pinets/dist/pinets.min.es.js';
import { createCatalog, createLibraryResolver, localizeOpenAlgo } from '../src/pine-sources.mjs';
import { installPineCompatibility } from '../src/pine-compatibility.mjs';
import { preserveUnknownVolume } from '../src/pine-data.mjs';

const read = file => readFileSync(new URL(`../../../indicators/${file}`, import.meta.url), 'utf8');
const libraries = {
  'openfund/Overlayslibrary/1': read('Overlayslibrary.pine'),
  'openfund/sdk/1': read('sdk.pine'),
};
const resolver = createLibraryResolver(libraries);
const original = read('Open algo v5.pine');
const catalog = createCatalog(original, read('pac v1.pine'), read('smc-v1.pine'));
const fixture = JSON.parse(readFileSync(new URL('./fixtures/gains-btc-usd.json', import.meta.url)));

function execute(engine, prepared, extra = {}) {
  return new Promise((resolve, reject) => {
    let model, session;
    const timeout = setTimeout(() => { session?.stop(); reject(new Error('Pine execution timed out')); }, 15000);
    session = engine.execute({ prepared, market: { symbol: 'BTC/USD', timeframe: '1', symbolInfo: fixture.info },
      bars: fixture.bars, mode: 'static', ...extra }, {
      onModel: value => { model = value; },
      onDone: () => { clearTimeout(timeout); session?.stop(); resolve(model); },
      onError: error => { clearTimeout(timeout); session?.stop(); reject(error); },
    });
  });
}

test('catalog contains exactly three source indicators in the required order', () => {
  assert.deepEqual(catalog.map(x => x.name), ['Open Algo V5', 'Price Action Concepts', 'Smart Money Concepts']);
  assert(catalog.every(x => x.enabled === false && x.language === 'pine'));
});

test('localization changes only the two import IDs and rejects source drift', () => {
  const localized = localizeOpenAlgo(original);
  assert.equal(localized.replace('openfund/Overlayslibrary/1', 'ayvaliktrading/EyopsTelegram/1')
    .replace('openfund/sdk/1', 'ayvaliktrading/JoinUsEyopsTelegram/1'), original);
  assert(!localized.includes('ayvaliktrading/'));
  assert.throws(() => localizeOpenAlgo(original.replace(' as LAF', ' as other')), /dependency changed/);
  assert.throws(() => resolver('untrusted/library/1'), /Unknown local Pine library/);
  assert.throws(() => createLibraryResolver({})('openfund/sdk/1'), /Missing local Pine library/);
});

test('the sole used library symbol has its exact local signature and tuple result', async () => {
  assert.match(libraries['openfund/Overlayslibrary/1'], /export getSmartTrail\(int ATRPeriod, int ATRFactor, int smoothing\)/);
  assert.match(libraries['openfund/Overlayslibrary/1'], /\[line1, Fib2, state\]/);
  const engine = new PineEngine({ importResolver: resolver });
  const prepared = await engine.prepare('//@version=5\nindicator("Smart trail",overlay=true)\nimport openfund/Overlayslibrary/1 as LAF\n[a,b,c]=LAF.getSmartTrail(10,4,8)\nplot(a,"Trail")\nplot(b,"Fib2")', 'trail');
  const model = await execute(engine, prepared);
  assert(model.series.every(series => series.points.some(point => Number.isFinite(point.value))));
  for (const name of ['rationalQuadratic', 'gaussian', 'periodic', 'locallyPeriodic']) {
    assert.match(libraries['openfund/sdk/1'], new RegExp(`export ${name}\\(`));
  }
});

test('local import resolution preserves every input and all calculated model output', async () => {
  const oldResolver = path => libraries[path.replace('ayvaliktrading/EyopsTelegram/1', 'openfund/Overlayslibrary/1')
    .replace('ayvaliktrading/JoinUsEyopsTelegram/1', 'openfund/sdk/1')];
  const oldEngine = new PineEngine({ importResolver: oldResolver }), engine = new PineEngine({ importResolver: resolver });
  const before = await oldEngine.prepare(original, 'same'), after = await engine.prepare(catalog[0].script, 'same');
  assert.deepEqual(after.inputs, before.inputs);
  assert.equal(after.inputs.length, 79);
  // Runtime drawing IDs use a process-wide counter; compare every value/style/coordinate.
  const comparable = model => JSON.parse(JSON.stringify(model, (key, value) => key === 'id' ? undefined : value));
  assert.deepEqual(comparable(await execute(engine, after)), comparable(await execute(oldEngine, before)));
  await assert.rejects(new PineEngine({ importResolver: resolver }).prepare('//@version=5\nindicator("Bad")\nimport other/lib/1 as bad\nplot(bad.foo(close))', 'bad'), /Unknown local Pine library/);
});

test('all original scripts produce model geometry and preserve their input counts', async () => {
  installPineCompatibility(Indicator);
  const counts = [79, 49, 52];
  for (const [index, entry] of catalog.entries()) {
    const engine = preserveUnknownVolume(new PineEngine({ importResolver: resolver }));
    const prepared = await engine.prepare(entry.script, `indicator-${index}`);
    assert.equal(prepared.inputs.length, counts[index]);
    const model = await execute(engine, prepared);
    assert(model.series.length + model.lines.length + model.boxes.length + model.labels.length > 0, entry.name);
  }
});

test('PAC nested security call uses full execution and returns real drawing output', async () => {
  installPineCompatibility(Indicator);
  const engine = preserveUnknownVolume(new PineEngine());
  const prepared = await engine.prepare(catalog[1].script, 'pac');
  const requested = [];
  // Controlled secondary-series fixture tests runtime semantics, not market accuracy.
  const model = await execute(engine, prepared, { fetchSeries: async (_symbol, tf) => {
    requested.push(tf); return fixture.bars.filter((_, i) => i % 4 === 0);
  } });
  assert(requested.includes('240'));
  assert(model.lines.length > 0 && model.labels.length > 0);
});

test('missing volume reaches Pine as na and genuine volume remains unchanged', async () => {
  let request;
  const engine = preserveUnknownVolume({ language: 'pine', capabilities: {}, prepare() {}, execute: req => { request = req; return {}; } });
  engine.execute({ bars: [{ close: 1 }, { close: 2, volume: 12 }], fetchSeries: async () => [{ close: 3 }] }, {});
  assert(Number.isNaN(request.bars[0].volume));
  assert.equal(request.bars[1].volume, 12);
  assert(Number.isNaN((await request.fetchSeries())[0].volume));
});

test('Gains provider maps Pine intervals, aggregates genuine OHLC, and rejects unsupported intervals', async () => {
  const calls = [], window = {};
  vm.runInNewContext(readFileSync(new URL('../../openfund-gains-adapter/src/gains-adapter.js', import.meta.url), 'utf8'), {
    window, Date, AbortSignal, setTimeout, clearTimeout,
    fetch: async url => { calls.push(new URL(url)); return { ok: true, json: async () => ({ data: fixture.bars }) }; },
  });
  const provider = window.OpenfundGains.createVelaProvider();
  for (const [tf, expected] of [['1','1m'],['5','5m'],['15','15m'],['60','1h'],['240','4h'],['D','1d'],['120','1h'],['480','4h'],['W','1d'],['M','1d']]) {
    const bars = await provider.getBars('BTC/USD', tf, { limit: 500 });
    assert.equal(calls.at(-1).searchParams.get('interval'), expected);
    assert(bars.length > 0);
    assert(bars.every(bar => !('volume' in bar)));
  }
  const count = calls.length;
  await assert.rejects(provider.getBars('BTC/USD', '7S', {}), /Unsupported/);
  assert.equal(calls.length, count);
});

test('live marks preserve the historical forming candle open and extremes', async () => {
  const window = {}, tail = fixture.bars.at(-1);
  let socket, received;
  class Clock extends Date { static now() { return tail.time + 1000; } }
  class Socket {
    constructor() { socket = this; }
    send() {}
    close() {}
  }
  vm.runInNewContext(readFileSync(new URL('../../openfund-gains-adapter/src/gains-adapter.js', import.meta.url), 'utf8'), {
    window, Date: Clock, AbortSignal, setTimeout, clearTimeout, WebSocket: Socket,
    fetch: async () => ({ ok: true, json: async () => ({ data: [tail] }) }),
  });
  const provider = window.OpenfundGains.createVelaProvider();
  await provider.getBars('BTC/USD', '1', { limit: 1 });
  const stop = provider.subscribe('BTC/USD', '1', bar => { received = bar; });
  const price = (tail.high + tail.low) / 2;
  socket.onmessage({ data: JSON.stringify({ channel: 'prices', snapshot: true, seq: 1, data: [{ market: 'BTC/USD', mark: price }] }) });
  assert.equal(received.open, tail.open);
  assert.equal(received.high, tail.high);
  assert.equal(received.low, tail.low);
  assert.equal(received.close, price);
  stop();
});
