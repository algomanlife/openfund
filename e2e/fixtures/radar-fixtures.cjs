/* Deterministic Trade Radar / Market Heatmap fixtures for browser tests.
 *
 * The responses match the shapes the backend's shared Hyperliquid cache
 * serves under /radar/* (apps/backend/radar.js, consumed by
 * apps/web-react/src/features/radar/radarData.ts). Nothing here is fetched:
 * every value is computed from the market's index, so the same fixture
 * produces the same tiles, grouping and search target on every run.
 *
 * The numbers are synthetic test data, not market observations. */

/** Wall-clock instant the browser sees (Wednesday, inside normal hours). */
const FIXED_NOW = Date.parse('2026-11-18T12:00:00Z')

/* Three leverage groups (50×, 20×, 5×), each a geometric run of volumes so
   the top of every group is large and its tail is too small to label at the
   top level. Names are synthetic except the first few majors. */
const GROUPS = [
  { leverage: 50, names: ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'AVAX', 'LINK', 'LTC', 'ADA', 'DOT', 'TRX', 'BCH', 'NEAR', 'APT', 'ARB', 'OP', 'SUI', 'TIA', 'INJ', 'SEI', 'ATOM'] },
  { leverage: 20, names: ['AAVE', 'UNI', 'MKR', 'LDO', 'CRV', 'SNX', 'COMP', 'DYDX', 'GMX', 'PENDLE', 'ENA', 'JUP', 'PYTH', 'WLD', 'STX', 'RUNE', 'FET', 'RNDR', 'GRT', 'IMX'] },
  { leverage: 5, names: ['FXAA', 'FXAB', 'FXAC', 'FXAD', 'FXAE', 'FXAF', 'FXAG', 'FXAH', 'FXAI', 'FXAJ', 'FXAK', 'FXAL', 'FXAM', 'FXAN', 'FXAO', 'FXAP', 'FXAQ', 'FXAR'] },
]
/** Markets Openfund also lists (for the "Tradable on Openfund" grouping and chart links). */
const OPENFUND = new Map([['BTC', 'BTC/USD'], ['ETH', 'ETH/USD'], ['SOL', 'SOL/USD'], ['XRP', 'XRP/USD'], ['DOGE', 'DOGE/USD'], ['LINK', 'LINK/USD']])

function buildMarkets() {
  const out = []
  GROUPS.forEach((g, gi) => g.names.forEach((coin, i) => {
    const top = [4.2e9, 9.0e8, 2.5e8][gi]
    const dayVolume = Math.round(top * Math.pow(0.72, i))
    const mark = Number((10 + ((i * 37 + gi * 11) % 90) * 1.7).toFixed(4))
    /* alternating, bounded change and funding so colour metrics differ per tile */
    const change = Number((((i % 7) - 3) * 0.013 + (gi - 1) * 0.004).toFixed(5))
    const funding = Number((((i % 5) - 2) * 0.000021 + 0.0000125).toFixed(7))
    out.push({
      coin, mark, prevDay: Number((mark / (1 + change)).toFixed(4)), change, funding,
      openInterest: Math.round(dayVolume * (0.35 + (i % 4) * 0.05)), dayVolume, maxLeverage: g.leverage,
      openfund: OPENFUND.has(coin) ? { symbol: OPENFUND.get(coin), group: 'crypto' } : null,
    })
  }))
  return out
}
const MARKETS = buildMarkets()
/** The smallest market: always grouped into "+N more" at the top level, so the search must drill down to it. */
const SMALLEST = MARKETS.reduce((a, m) => (m.dayVolume < a.dayVolume ? m : a)).coin

const W = '0x1111111111111111111111111111111111111111'
const V = '0x2222222222222222222222222222222222222222'
const wallet = n => '0x' + String(n).padStart(4, '0').repeat(10)
const trade = (i, coin, side, usd, buyer = W, seller = V) =>
  ({ id: `t${i}`, coin, side, price: 100 + i, size: usd / (100 + i), usd, time: FIXED_NOW - i * 1000, buyer, seller })

const side = (traders, notional, entry) => ({ traders, notional, size: notional / entry, entry, leverage: 8, upnl: notional * 0.01 })
const positioning = () => ({
  coins: ['BTC', 'ETH', 'SOL'].map((coin, i) => ({
    coin, mark: 50000 / (i + 1), change: 0.01 * (i - 1), long: side(6 - i, 3e7 / (i + 1), 49000 / (i + 1)), short: side(3 + i, 1.2e7 / (i + 1), 51000 / (i + 1)),
    notional: 4.2e7 / (i + 1), bias: 0.7 - i * 0.1, concentration: 0.31 + i * 0.05, upnl: 2e5,
    holders: [{ wallet: wallet(i + 1), name: `Whale ${i + 1}`, rank: i + 1, side: 'long', value: 9e6 / (i + 1), entry: 49000 / (i + 1) }],
  })),
  tracked: 30, answered: 28, totals: { long: 5.5e7, short: 2.2e7 }, updated: FIXED_NOW - 4000, stale: false,
  positions: ['BTC', 'ETH', 'SOL', 'BTC'].map((coin, i) => ({
    wallet: wallet(i + 1), name: `Whale ${i + 1}`, rank: i + 1, coin, side: i % 2 ? 'short' : 'long', size: 10 + i, entry: 49000, value: 5e6 - i * 1e6,
    mark: 50000, upnl: (i % 2 ? -1 : 1) * 12000, roe: 0.04, liquidation: 31000, leverage: 6, leverageType: 'cross', margin: 8e5,
  })),
})
const board = () => ({
  traders: Array.from({ length: 12 }, (_, i) => ({ rank: i + 1, wallet: wallet(i + 1), name: `Whale ${i + 1}`, accountValue: 2e7 - i * 1e6, pnl: 4e6 - i * 2.5e5, roi: 0.4 - i * 0.02, volume: 6e8 - i * 3e7 })),
  updated: FIXED_NOW - 9000, stale: false,
})
const EMPTY = {
  markets: { markets: [], updated: FIXED_NOW - 4000, stale: false },
  tape: { state: 'live', coins: [], lastMessageAt: FIXED_NOW - 2000, trades: [] },
  positions: { coins: [], tracked: 30, answered: 0, totals: { long: 0, short: 0 }, positions: [], updated: FIXED_NOW - 4000, stale: false },
  board: { traders: [], updated: FIXED_NOW - 4000, stale: false },
}

/**
 * Route every /radar/* request of a context to fixtures. `handlers` may
 * override any endpoint ('markets', 'tape', 'positions', 'board', 'wallet')
 * with a function returning { status, body }. Unknown /radar paths fail
 * loudly (404) instead of reaching the live feed.
 */
async function routeRadar(target, handlers = {}) {
  const defaults = {
    markets: () => ({ status: 200, body: { markets: MARKETS, updated: FIXED_NOW - 4000, stale: false } }),
    tape: () => ({ status: 200, body: { state: 'live', coins: ['BTC', 'ETH'], lastMessageAt: FIXED_NOW - 1000, trades: [trade(1, 'BTC', 'buy', 80_000)] } }),
    positions: () => ({ status: 200, body: positioning() }),
    board: () => ({ status: 200, body: board() }),
    wallet: () => ({ status: 404, body: { error: 'not_in_fixture' } }),
  }
  const h = { ...defaults, ...handlers }
  await target.route(url => url.pathname.startsWith('/radar/'), async route => {
    const url = new URL(route.request().url())
    const name = url.pathname.slice('/radar/'.length).split('/')[0]
    if (!h[name]) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'unknown_fixture_path' }) })
    const { status, body } = h[name](url)
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

module.exports = { FIXED_NOW, MARKETS, SMALLEST, OPENFUND, EMPTY, W, V, trade, routeRadar }
