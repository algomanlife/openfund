/* Deterministic local mock of the four official Gains read endpoints used by
 * gains-portfolio.js. Shapes follow vendor/gains-sdk TradeContainerBackend and
 * the public responses inspected on 2026-11-20 (empty-address reads only).
 * Every scenario is a pure function: no network, no chain, no signer. */
export const WALLET = "0x00000000000000000000000000000000000000a1";
export const OTHER = "0x00000000000000000000000000000000000000b2";
export const NOW = Date.parse("2026-11-20T12:00:00.000Z");
const iso = (offsetMs = 0) => new Date(NOW + offsetMs).toISOString();
const tx = (c) => "0x" + c.repeat(64);

export const tradingVariables = (over = {}) => ({
  lastRefreshed: iso(-5_000),
  tradingState: 0,
  pairs: [
    { from: "BTC", to: "USD" },
    { from: "ETH", to: "USD" },
    { from: "EUR", to: "USD" },
  ],
  collaterals: [
    { collateralIndex: 1, symbol: "DAI", collateralConfig: { decimals: 18 } },
    { collateralIndex: 2, symbol: "WETH", collateralConfig: { decimals: 18 } },
    { collateralIndex: 3, symbol: "USDC", collateralConfig: { decimals: 6 } },
  ],
  ...over,
});

export const trade = (over = {}) => ({
  trade: {
    user: WALLET,
    index: "7",
    pairIndex: "0",
    leverage: "12000",
    long: true,
    isOpen: true,
    collateralIndex: "1",
    tradeType: "0",
    collateralAmount: "843000000000000000000",
    openPrice: "396120000000000",
    tp: "0",
    sl: "0",
    ...over,
  },
  tradeInfo: { createdBlock: "525000000", contractsVersion: "10" },
});

export const event = (over = {}) => ({
  address: WALLET,
  date: iso(-3_600_000),
  pair: "BTC/USD",
  action: "TradeClosedMarket",
  long: 1,
  price: 50000,
  size: 10,
  leverage: 2,
  pnl_net: 1.25,
  tx: tx("a"),
  tradeIndex: 7,
  collateralIndex: 1,
  ...over,
});

export const stats = (over = {}) => ({
  totalTrades: 3,
  winRate: 66.67,
  updatedAt: NOW - 10_000,
  ...over,
});

const page = (data) => ({
  data,
  pagination: { hasMore: false, nextCursor: null, limit: 100 },
});

/** Scenario bodies, keyed by endpoint. */
export const SCENARIOS = {
  empty: { open: [], vars: tradingVariables(), history: page([]), stats: stats({ totalTrades: 0, winRate: 0 }) },
  onePosition: { open: [trade()], vars: tradingVariables(), history: page([]), stats: stats() },
  multiplePositions: {
    open: [
      trade(),
      trade({ index: "8", pairIndex: "1", long: false, collateralIndex: "3", collateralAmount: "2500000000", openPrice: "31000000000000", leverage: "5500", sl: "33000000000000", tp: "28000000000000" }),
      trade({ index: "9", pairIndex: "2", collateralIndex: "2", collateralAmount: "250000000000000000", openPrice: "10850000000", leverage: "50000" }),
      trade({ user: OTHER, index: "1" }),
    ],
    vars: tradingVariables(),
    history: page([]),
    stats: stats(),
  },
  pendingOrders: {
    open: [trade({ index: "10", tradeType: "1", openPrice: "380000000000000" }), trade({ index: "11", tradeType: "2", long: false, openPrice: "410000000000000" })],
    vars: tradingVariables(),
    history: page([]),
    stats: stats(),
  },
  partialClose: {
    open: [trade()],
    vars: tradingVariables(),
    history: page([
      event({ action: "TradeOpenedMarket", date: iso(-7_200_000), pnl_net: 0, tx: tx("b") }),
      event({ action: "PositionSizeDecrease", date: iso(-5_400_000), pnl_net: 0.5, size: 4, tx: tx("c") }),
      event({ action: "TradeClosedMarket", date: iso(-3_600_000), pnl_net: 0.75, size: 6, tx: tx("d") }),
      event({ address: OTHER, tx: tx("e") }),
    ]),
    stats: stats(),
  },
  missingOptional: {
    open: [trade({ sl: undefined, tp: undefined })],
    vars: tradingVariables(),
    history: page([event({ pnl_net: null, leverage: undefined, price: "n/a", collateralIndex: 99 })]),
    stats: { totalTrades: 1 },
  },
  staleUpstream: {
    open: [trade()],
    vars: tradingVariables({ lastRefreshed: iso(-30 * 60_000) }),
    history: page([]),
    stats: stats({ updatedAt: NOW - 45 * 60_000 }),
  },
  inconsistentTimestamps: {
    open: [trade()],
    vars: tradingVariables({ lastRefreshed: iso(10 * 60_000) }),
    history: page([]),
    stats: stats(),
  },
  malformedCollateral: {
    open: [trade()],
    vars: tradingVariables({ collaterals: [{ collateralIndex: 1, symbol: "DAI" }] }),
    history: page([]),
    stats: stats(),
  },
  malformedAmount: { open: [trade({ collateralAmount: "not-a-number" })], vars: tradingVariables(), history: page([]), stats: stats() },
  unknownTradeType: { open: [trade({ tradeType: "7" })], vars: tradingVariables(), history: page([]), stats: stats() },
  malformedEvent: { open: [], vars: tradingVariables(), history: page([event({ date: "yesterday" })]), stats: stats() },
  unsafeTx: { open: [], vars: tradingVariables(), history: page([event({ tx: "javascript:alert(1)" })]), stats: stats() },
};

/** Reader with the gainsPortfolio contract: (url, ttl) => { body, fetchedAt }. */
export function mockReader(name, { fetchedAt = NOW, calls = [] } = {}) {
  const s = SCENARIOS[name];
  if (!s) throw new Error("unknown scenario " + name);
  return async (url) => {
    calls.push(url);
    const body = url.includes("/stats?")
      ? s.stats
      : url.includes("/trading-variables")
        ? s.vars
        : url.includes("/open-trades/")
          ? s.open
          : s.history;
    return { body: structuredClone(body), fetchedAt };
  };
}

/** Upstream failure modes, shaped like the default reader's rejections. */
export const failingReader = (kind) => async () => {
  if (kind === "timeout")
    throw Object.assign(new Error("gains_timeout"), { status: 504 });
  throw Object.assign(new Error("gains_unavailable"), { status: 502 });
};
