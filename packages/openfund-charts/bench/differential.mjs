// Differential harness: run an indicator over a fixture with given inputs and
// reduce the Vela model to a canonical, order-independent form so two source
// revisions can be compared exactly (ids are process counters; drawing arrays
// are compared as multisets; floats are rounded to 10 significant digits).
import { createHash } from 'node:crypto';
import { PineEngine } from '../../../apps/web-react/node_modules/@luxalgo/vela-pinets/dist/index.js';
import { Indicator } from '../../../apps/web-react/node_modules/pinets/dist/pinets.min.es.js';
import { installPineCompatibility } from '../src/pine-compatibility.mjs';
import { preserveUnknownVolume } from '../src/pine-data.mjs';
import { createLibraryResolver } from '../src/pine-sources.mjs';
import { fixtureInfo, seriesFetcher } from './fixtures.mjs';

installPineCompatibility(Indicator);

const round = value => typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)
  ? Number(value.toPrecision(10)) : value;

// A color attached to a point with no value (or a fill between such points)
// is never painted; comparisons treat those colors as unset so that skipping
// work for a disabled overlay is not reported as an output change.
function visibleOnly(model) {
  const byId = new Map((model.series ?? []).map(series => [series.id, series.points ?? []]));
  const finite = (points, i) => points?.[i] && points[i].value != null && Number.isFinite(points[i].value);
  return {
    ...model,
    series: (model.series ?? []).map(series => ({
      ...series,
      points: (series.points ?? []).map(point => finite([point], 0) ? point : { time: point.time, value: null }),
    })),
    fills: (model.fills ?? []).map(fill => {
      const from = byId.get(fill.fromSeriesId), to = byId.get(fill.toSeriesId);
      // A constant fill colour is reported as `color`, a varying one as `colors`.
      const { color: constant, colors = [], ...rest } = fill;
      const length = Math.max(colors.length, from?.length ?? 0);
      return { ...rest, colors: Array.from({ length }, (_, i) => finite(from, i) && finite(to, i) ? (colors.length ? colors[i] : constant) ?? null : null) };
    }),
  };
}

export function canonical(model, { dropTables = false } = {}) {
  const clean = JSON.parse(JSON.stringify(visibleOnly(model), (key, value) => {
    if (key === 'fromSeriesId' || key === 'toSeriesId') return String(value).replace(/^[^:]*:/, '');
    if (key === 'id' || key === 'inputs' || key === 'inputValues' || key === 'anchorTime') return undefined;
    return round(value);
  }));
  for (const key of ['lines', 'labels', 'boxes', 'linefills', 'polylines', 'tables']) {
    if (Array.isArray(clean[key])) clean[key] = clean[key].map(item => JSON.stringify(item)).sort();
  }
  if (dropTables) delete clean.tables;
  return clean;
}

export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

export function counts(model) {
  return Object.fromEntries(['series', 'lines', 'labels', 'boxes', 'linefills', 'fills', 'tables', 'shapes']
    .map(key => [key, Array.isArray(model?.[key]) ? model[key].length : 0]));
}

export async function runModel({ script, libraries, bars, inputs = {}, timeframe = '1', fetchCalls = [] }) {
  const engine = preserveUnknownVolume(new PineEngine({ importResolver: createLibraryResolver(libraries) }));
  const prepared = await engine.prepare(script, 'differential');
  const model = await new Promise((resolve, reject) => {
    let result, session;
    const timeout = setTimeout(() => { session?.stop(); reject(new Error('Pine execution timed out')); }, 240_000);
    session = engine.execute({
      prepared, inputs, bars, mode: 'static', fetchSeries: seriesFetcher(bars, fetchCalls),
      market: { symbol: 'BTC/USD', timeframe, symbolInfo: fixtureInfo },
    }, {
      onModel: value => { result = value; },
      onDone: () => { clearTimeout(timeout); session.stop(); resolve(result); },
      onError: error => { clearTimeout(timeout); session?.stop(); reject(error); },
    });
  });
  return { prepared, model };
}

/** Input configurations exercised per indicator: defaults, each optional
 *  feature on its own, and everything on together. */
export const CONFIGS = {
  'Open Algo V5': {
    defaults: {},
    tpsl: { riskmanage: true },
    strongOnly: { signalMode: 'Strong', signalStyle: 'Pro V4', maFilter: true, maType: 'HMA' },
    trailingStop: { trailing_stop_enabled: true },
    supplyDemand: { POIswitch: true },
    powerMA: { powers_ema: true },
    marketStructure: { marketStructure: true, bosConfType: 'Wicks' },
    supportResistance: { enableSR: true },
    reversals: { reversal: true, reversalBandsEnabled: true },
    trendLines: { autoTL: true, expandTrend: true },
    ribbonRetest: { LongTrendAverage: true, CirrusCloud: true },
    smartTrailOff: { smartTrailEnabled: false },
    everything: {
      riskmanage: true, trailing_stop_enabled: true, POIswitch: true, powers_ema: true, marketStructure: true,
      enableSR: true, reversal: true, reversalBandsEnabled: true, autoTL: true, LongTrendAverage: true, CirrusCloud: true,
    },
  },
  'Price Action Concepts': {
    defaults: {},
    present: { mode: 'Present', show_trend: true },
    swings: { show_swings: true, show_hl_swings: true, showEntryZones: true },
    liquiditySweeps: { activateliquidity: true },
    // Baseline (main @ 1b05a2b9) throws here: see KNOWN_BASELINE_FAILURES.
    trendlineLiquidity: { activateLiq: true },
    trendlineLiquidityChartOnly: { activateLiq: true, timeframe1Enabled: false, timeframe2Enabled: false },
    equalHL: { show_eq: true },
    levels: { show_pdhl: true, show_pwhl: true, show_pmhl: true },
    scannerOff: { structureScannerOn: false, timeframe1Enabled: false, timeframe2Enabled: false, timeframe3Enabled: false },
  },
  'Smart Money Concepts': {
    defaults: {},
    present: { modeInput: 'Present', showTrendInput: true, styleInput: 'Monochrome' },
    swings: { showSwingsInput: true, showSwingOrderBlocksInput: true, orderBlockMitigationInput: 'Close' },
    gaps: { showFairValueGapsInput: true },
    gapsHigherTimeframe: { showFairValueGapsInput: true, fairValueGapsTimeframeInput: '15' },
    levels: { showDailyLevelsInput: true, showWeeklyLevelsInput: true, showMonthlyLevelsInput: true },
    zones: { showPremiumDiscountZonesInput: true },
  },
};

/** Configurations the pre-optimization sources cannot execute at all. */
export const KNOWN_BASELINE_FAILURES = {
  'Price Action Concepts': {
    trendlineLiquidity: 'TypeError: method call on an na line inside the higher-timeframe order-block request',
  },
};
