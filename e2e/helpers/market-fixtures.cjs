/* Deterministic external-data fixtures for layout and visual tests.
 *
 * Layout suites (e2e/test-responsive-matrix.cjs) must not depend on third-party
 * availability: a live Gains response without CORS headers once failed every
 * shard of the matrix. installMarketFixtures() makes the browser context fully
 * offline apart from the origins under test:
 *
 *   https://api.gains.trade/v1/arbitrum/markets          → FIXTURE_MARKETS
 *   https://api.gains.trade/v1/arbitrum/prices           → FIXTURE_PRICES
 *   https://api.gains.trade/v1/arbitrum/markets/X/candles → deterministic OHLC
 *   wss://api.gains.trade/**                             → mocked socket, no messages
 *   every other external http(s) origin                  → aborted (recorded)
 *
 * The values are illustrative test data, not market records: prices are round
 * numbers and candles are a fixed deterministic wave. Shapes follow the
 * envelope parsed by packages/openfund-gains-adapter/src/gains-adapter.js
 * (`{ data: [...] }`). Real upstream availability is checked separately and
 * non-blocking by the Upstream guard workflow and `npm run test:browser:live`.
 */

const FIXTURE_MARKETS = [
  { symbol: 'BTC/USD', base: 'BTC', quote: 'USD', group: 'crypto', pairIndex: 0, isOpen: true, minLeverage: '1.1', maxLeverage: '150', pricePrecision: 1, sizePrecision: 5 },
  { symbol: 'ETH/USD', base: 'ETH', quote: 'USD', group: 'crypto', pairIndex: 1, isOpen: true, minLeverage: '1.1', maxLeverage: '150', pricePrecision: 2, sizePrecision: 4 },
  { symbol: 'SOL/USD', base: 'SOL', quote: 'USD', group: 'crypto', pairIndex: 33, isOpen: true, minLeverage: '1.1', maxLeverage: '100', pricePrecision: 3, sizePrecision: 3 },
  { symbol: 'EUR/USD', base: 'EUR', quote: 'USD', group: 'forex', pairIndex: 21, isOpen: true, minLeverage: '2', maxLeverage: '1000', pricePrecision: 5, sizePrecision: 2 },
  { symbol: 'XAU/USD', base: 'XAU', quote: 'USD', group: 'commodities', pairIndex: 90, isOpen: true, minLeverage: '2', maxLeverage: '250', pricePrecision: 2, sizePrecision: 3 },
];
const BASE_PRICE = { 'BTC/USD': 50000, 'ETH/USD': 3000, 'SOL/USD': 150, 'EUR/USD': 1.1, 'XAU/USD': 2000 };
const INTERVAL_MS = { '1m': 60e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3, '1h': 3600e3, '4h': 14400e3, '1d': 86400e3 };

const FIXTURE_PRICES = () =>
  FIXTURE_MARKETS.map(m => ({ market: m.symbol, mark: String(BASE_PRICE[m.symbol]), index: String(BASE_PRICE[m.symbol]), updatedAt: Date.now() }));

/** Deterministic candles: a fixed wave around the base price, aligned to the interval. */
function fixtureCandles(symbol, interval, from, to) {
  const step = INTERVAL_MS[interval];
  const base = BASE_PRICE[symbol];
  if (!step || !base) return [];
  const end = Math.floor((Number.isFinite(to) ? to : Date.now()) / step) * step;
  const start = Math.max(Number.isFinite(from) ? Math.ceil(from / step) * step : end - 300 * step, end - 499 * step);
  const out = [];
  for (let t = start; t <= end; t += step) {
    const k = t / step;
    const open = base * (1 + 0.01 * Math.sin(k / 7));
    const close = base * (1 + 0.01 * Math.sin((k + 1) / 7));
    out.push({ time: t, open, high: Math.max(open, close) * 1.002, low: Math.min(open, close) * 0.998, close });
  }
  return out;
}

/**
 * Route every external request of `context` to fixtures or abort it.
 * @param {import('playwright').BrowserContext} context
 * @param {{ allow?: string[] }} options origins that stay live (the app under test)
 * @returns {{ blocked: Set<string> }} external origins that were aborted
 */
async function installMarketFixtures(context, { allow = [] } = {}) {
  const allowed = new Set(allow.map(u => new URL(u).origin));
  const blocked = new Set();
  /* Playwright tries the most recently registered route first: the catch-all goes first */
  await context.route(url => /^https?:$/.test(url.protocol) && !allowed.has(url.origin) && !/^(localhost|127\.0\.0\.1)$/.test(url.hostname), route => {
    blocked.add(new URL(route.request().url()).origin);
    return route.abort('blockedbyclient');
  });
  await context.route('https://api.gains.trade/v1/arbitrum/**', route => {
    const url = new URL(route.request().url());
    const candles = url.pathname.match(/\/markets\/([^/]+)\/candles$/);
    const data = candles
      ? fixtureCandles(decodeURIComponent(candles[1]).replace('-', '/'), url.searchParams.get('interval'), Number(url.searchParams.get('from')), Number(url.searchParams.get('to')))
      : url.pathname.endsWith('/markets') ? FIXTURE_MARKETS
      : url.pathname.endsWith('/prices') ? FIXTURE_PRICES()
      : [];
    return route.fulfill({ json: { data }, headers: { 'access-control-allow-origin': '*' } });
  });
  /* the same fixtures through this origin's Open Oracle market API (catalog,
     candles, book, trades), which the pages read first */
  await context.route(url => /^\/api\/oracle\/markets(\/|$)/.test(url.pathname), route => {
    const url = new URL(route.request().url());
    const candles = url.pathname.match(/\/markets\/([^/]+)\/candles$/);
    if (/\/(book|trades)$/.test(url.pathname)) return route.fulfill({ status: 503, json: { error: 'market_data_unavailable' } });
    const data = candles
      ? fixtureCandles(decodeURIComponent(candles[1]).replace('-', '/'), url.searchParams.get('interval'), Number(url.searchParams.get('from')), Number(url.searchParams.get('to')))
      : FIXTURE_MARKETS;
    return route.fulfill({ json: { data } });
  });
  /* a mocked socket that never reaches the server and sends nothing */
  await context.routeWebSocket('wss://api.gains.trade/**', () => {});
  return { blocked };
}

module.exports = { installMarketFixtures, fixtureCandles, FIXTURE_MARKETS, FIXTURE_PRICES };
