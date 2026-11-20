// Drive an indicator through vela-pinets' live (streaming) mode — the path the
// browser worker uses — with mark updates inside the forming candle and new
// candles, then return the last streamed model.
import { PineEngine } from '../../../apps/web-react/node_modules/@luxalgo/vela-pinets/dist/index.js';
import { createLibraryResolver } from '../src/pine-sources.mjs';
import { preserveUnknownVolume } from '../src/pine-data.mjs';
import { fixtureInfo, seriesFetcher } from './fixtures.mjs';

export async function runLive({ script, libraries, bars: allBars, start, inputs = {}, updates }) {
  const engine = preserveUnknownVolume(new PineEngine({ importResolver: createLibraryResolver(libraries) }));
  const prepared = await engine.prepare(script, 'live');
  const bars = allBars.slice(0, start).map(bar => ({ ...bar }));
  let latest = null, waiter = null, models = 0;
  const fetches = [];
  const session = engine.execute({
    prepared, inputs, mode: 'live', getBars: () => bars, bars,
    market: { symbol: 'BTC/USD', timeframe: '1', symbolInfo: fixtureInfo },
    // Secondary series are aggregated from the bars visible so far, never from
    // the future part of the fixture.
    fetchSeries: (...args) => seriesFetcher(bars, fetches)(...args),
  }, {
    onModel: model => { latest = model; models++; waiter?.(); },
    onError: error => { throw error; },
  });
  const nextModel = () => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no live model')), 60_000);
    waiter = () => { clearTimeout(timer); waiter = null; resolve(latest); };
  });
  await nextModel();
  for (const update of updates) {
    if (update.type === 'tick') {
      const last = bars.at(-1);
      Object.assign(last, { close: update.price, high: Math.max(last.high, update.price), low: Math.min(last.low, update.price) });
    } else {
      bars.push({ ...allBars[bars.length] });
    }
    const pending = nextModel();
    session.notifyBars?.('update');
    await pending;
  }
  session.stop();
  return { model: latest, bars: bars.map(bar => ({ ...bar })), models, fetches };
}

/** Deterministic tick/candle schedule: `candles` new bars, `ticks` marks each. */
export function schedule(allBars, start, candles, ticks) {
  const updates = [];
  for (let c = 0; c < candles; c++) {
    const forming = allBars[start + c - 1], next = allBars[start + c];
    for (let t = 1; t <= ticks; t++) {
      updates.push({ type: 'tick', price: Math.round((forming.close + (next.open - forming.close) * t / (ticks + 1)) * 10) / 10 });
    }
    updates.push({ type: 'candle' });
  }
  return updates;
}
