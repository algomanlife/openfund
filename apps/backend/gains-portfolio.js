/** Read-only, wallet-scoped gTrade records. No signing, balances or execution.
 * Sources verified 2026-11-02; conversions match vendored SDK converter.ts.
 * Raw history events stay events: partial closes are never invented round trips.
 */
import Decimal from "decimal.js";
const CORE = "https://backend-arbitrum.gains.trade",
  GLOBAL = "https://backend-global.gains.trade";
const cache = new Map();
async function get(url, ttl = 20000) {
  const old = cache.get(url);
  if (old && Date.now() - old.at < ttl) return old.value;
  const value = (async () => {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error("gains_read_failed");
    return r.json();
  })();
  if (cache.size >= 512) cache.delete(cache.keys().next().value);
  cache.set(url, { at: Date.now(), value });
  try {
    return await value;
  } catch (e) {
    cache.delete(url);
    throw Object.assign(e, { status: 502 });
  }
}
const number = (v) =>
  v === undefined || v === null || !Number.isFinite(Number(v))
    ? null
    : Number(v);
export const gainsKey = (e) => `42161:${e.tx}:${e.tradeIndex}:${e.action}`;
export async function gainsPortfolio(address, query = {}, read = get) {
  const wallet = String(address).toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(wallet))
    throw Object.assign(new Error("invalid_wallet"), { status: 400 });
  const q = new URLSearchParams({ chainId: "42161", limit: "100" });
  if (query.cursor) {
    if (!/^\d+$/.test(query.cursor))
      throw Object.assign(new Error("invalid_cursor"), { status: 400 });
    q.set("cursor", query.cursor);
  }
  if (query.from) q.set("startDate", query.from);
  if (query.to) q.set("endDate", query.to);
  if (query.market) q.set("pair", query.market);
  const [raw, meta, events, stats] = await Promise.all([
    read(`${CORE}/open-trades/${wallet}`),
    read(`${CORE}/trading-variables`, 60000),
    read(`${GLOBAL}/api/personal-trading-history/${wallet}?${q}`),
    read(
      `${GLOBAL}/api/personal-trading-history/${wallet}/stats?chainId=42161`,
    ),
  ]);
  if (
    !Array.isArray(raw) ||
    !Array.isArray(meta.pairs) ||
    !Array.isArray(meta.collaterals) ||
    !Array.isArray(events.data) ||
    !events.pagination ||
    !Number.isFinite(stats.totalTrades)
  )
    throw Object.assign(new Error("gains_schema_changed"), { status: 502 });
  const collaterals = meta.collaterals.map((c) => ({
    index: c.collateralIndex,
    symbol: c.symbol,
    decimals: c.collateralConfig.decimals,
  }));
  const trades = raw.flatMap((row) => {
    const p = row.trade;
    if (!p || p.user?.toLowerCase() !== wallet || !p.isOpen) return [];
    const collateral = collaterals.find(
        (c) => c.index === Number(p.collateralIndex),
      ),
      pair = meta.pairs[Number(p.pairIndex)];
    if (!collateral || !pair)
      throw Object.assign(new Error("gains_schema_changed"), { status: 502 });
    const scaled = (v, n) =>
      new Decimal(v).div(new Decimal(10).pow(n)).toString();
    return [
      {
        id: `42161:${wallet}:${p.index}`,
        index: String(p.index),
        market: `${pair.from}/${pair.to}`,
        side: p.long ? "long" : "short",
        type: Number(p.tradeType),
        entry: scaled(p.openPrice, 10),
        margin: scaled(p.collateralAmount, collateral.decimals),
        leverage: scaled(p.leverage, 3),
        sl: scaled(p.sl, 10),
        tp: scaled(p.tp, 10),
        currency: collateral.symbol,
        collateralIndex: collateral.index,
      },
    ];
  });
  const history = events.data
    .filter((e) => e.address?.toLowerCase() === wallet)
    .map((e) => ({
      key: gainsKey(e),
      date: e.date,
      market: e.pair,
      action: e.action,
      side: e.long ? "long" : "short",
      price: number(e.price),
      margin: number(e.size),
      leverage: number(e.leverage),
      pnl: number(e.pnl_net),
      currency:
        collaterals.find((c) => c.index === Number(e.collateralIndex))
          ?.symbol || null,
      tx: e.tx,
      tradeIndex: e.tradeIndex,
    }));
  return {
    source: "gains:arbitrum",
    wallet,
    asOf: new Date().toISOString(),
    positions: trades.filter((t) => t.type === 0),
    orders: trades.filter((t) => t.type !== 0),
    history,
    pagination: events.pagination,
    stats,
    collaterals,
  };
}
