/** Read-only, wallet-scoped gTrade records. No signing, balances or execution.
 * Sources verified 2026-11-02 and re-inspected 2026-11-20 (public empty-address
 * reads); conversions match vendored SDK converter.ts and backend.types.ts.
 * Raw history events stay events: partial closes are never invented round trips.
 *
 * Ownership: this module is the Perpetual product's only account-read adapter.
 * It never imports the Prop engine, ledger or database, and it never writes.
 * Every snapshot states its provenance, network, read-only capabilities and
 * freshness; malformed upstream data fails closed with 502 instead of 500 or a
 * fabricated empty account.
 */
import Decimal from "decimal.js";
const CORE = "https://backend-arbitrum.gains.trade",
  GLOBAL = "https://backend-global.gains.trade";
export const GAINS_CHAIN = Object.freeze({ chainId: 42161, name: "Arbitrum One" });
/* upstream-declared timestamps older than this are labelled stale */
export const GAINS_STALE_MS = 5 * 60_000;
/* a cached read older than this (TTL is 20 s / 60 s) is labelled stale */
const CACHE_STALE_MS = 60_000;
/* tolerated clock skew before an upstream timestamp counts as inconsistent */
const FUTURE_SKEW_MS = 60_000;
const ORDER_TYPES = ["market", "limit", "stop"]; // SDK TradeType: TRADE, LIMIT, STOP
const TX = /^0x[0-9a-f]{64}$/i;

const fail = (status, message) => Object.assign(new Error(message), { status });
const schema = () => fail(502, "gains_schema_changed");

/** Bounded-timeout reader with a short in-memory cache. Resolves to
 * `{ body, fetchedAt }`; a cache hit keeps its original fetch time so cached
 * data can never be presented as newer than it is. Error messages are fixed
 * codes and never contain the URL (which holds the wallet address). */
export function createGainsReader({ fetch: doFetch = fetch, now = Date.now, timeoutMs = 12000 } = {}) {
  const cache = new Map();
  return async function read(url, ttl = 20000) {
    const old = cache.get(url);
    if (old && now() - old.at < ttl) return old.value;
    const at = now();
    const value = (async () => {
      let r;
      try {
        r = await doFetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      } catch (e) {
        throw e?.name === "TimeoutError" || e?.name === "AbortError"
          ? fail(504, "gains_timeout")
          : fail(502, "gains_unavailable");
      }
      if (!r.ok) throw fail(502, "gains_read_failed");
      let body;
      try {
        body = await r.json();
      } catch {
        throw schema();
      }
      return { body, fetchedAt: at };
    })();
    if (cache.size >= 512) cache.delete(cache.keys().next().value);
    cache.set(url, { at, value });
    try {
      return await value;
    } catch (e) {
      cache.delete(url);
      throw e.status ? e : fail(502, "gains_unavailable");
    }
  };
}
const defaultRead = createGainsReader();

const number = (v) =>
  v === undefined || v === null || v === "" || !Number.isFinite(Number(v))
    ? null
    : Number(v);
const integerString = (v) =>
  (typeof v === "string" || typeof v === "number") && /^\d+$/.test(String(v));
const scaled = (v, n) => {
  if (!integerString(v)) throw schema();
  return new Decimal(String(v)).div(new Decimal(10).pow(n)).toString();
};
/* Gains encodes an unset TP/SL as 0; absence is not a price */
const optionalPrice = (v) =>
  v === undefined || v === null || v === "" || String(v) === "0" ? null : scaled(v, 10);
const timestamp = (v) => {
  const t = typeof v === "number" ? v : typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
};

export const gainsKey = (e) => `42161:${e.tx}:${e.tradeIndex}:${e.action}`;

function freshnessOf(reads, upstream, now) {
  const warnings = [];
  let status = "fresh";
  const fetchedAt = Math.min(...Object.values(reads).map((r) => r.fetchedAt));
  if (now - fetchedAt > CACHE_STALE_MS) {
    warnings.push("cached_read_stale");
    status = "stale";
  }
  for (const [name, at] of Object.entries(upstream)) {
    if (at === null) continue;
    if (at - now > FUTURE_SKEW_MS) {
      warnings.push(`${name}_future_timestamp`);
      status = "inconsistent";
    } else if (now - at > GAINS_STALE_MS) {
      warnings.push(`${name}_stale`);
      if (status === "fresh") status = "stale";
    }
  }
  const iso = (t) => (t === null ? null : new Date(t).toISOString());
  return {
    status,
    checkedAt: iso(now),
    fetchedAt: iso(fetchedAt),
    staleAfterMs: GAINS_STALE_MS,
    warnings,
    sources: {
      openTrades: { fetchedAt: iso(reads.openTrades.fetchedAt), upstreamAt: null },
      tradingVariables: { fetchedAt: iso(reads.tradingVariables.fetchedAt), upstreamAt: iso(upstream.trading_variables) },
      history: { fetchedAt: iso(reads.history.fetchedAt), upstreamAt: null },
      stats: { fetchedAt: iso(reads.stats.fetchedAt), upstreamAt: iso(upstream.stats) },
    },
  };
}

export async function gainsPortfolio(address, query = {}, read = defaultRead, { now = Date.now } = {}) {
  const wallet = String(address).toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(wallet)) throw fail(400, "invalid_wallet");
  const q = new URLSearchParams({ chainId: "42161", limit: "100" });
  if (query.cursor) {
    if (!/^\d+$/.test(query.cursor)) throw fail(400, "invalid_cursor");
    q.set("cursor", query.cursor);
  }
  if (query.from) q.set("startDate", query.from);
  if (query.to) q.set("endDate", query.to);
  if (query.market) q.set("pair", query.market);
  const [openTrades, tradingVariables, history, statsRead] = await Promise.all([
    read(`${CORE}/open-trades/${wallet}`),
    read(`${CORE}/trading-variables`, 60000),
    read(`${GLOBAL}/api/personal-trading-history/${wallet}?${q}`),
    read(`${GLOBAL}/api/personal-trading-history/${wallet}/stats?chainId=42161`),
  ]);
  const reads = { openTrades, tradingVariables, history, stats: statsRead };
  for (const r of Object.values(reads))
    if (!r || typeof r !== "object" || !Number.isFinite(r.fetchedAt)) throw schema();
  const raw = openTrades.body,
    meta = tradingVariables.body,
    events = history.body,
    stats = statsRead.body;
  if (
    !Array.isArray(raw) ||
    !Array.isArray(meta?.pairs) ||
    !Array.isArray(meta?.collaterals) ||
    !Array.isArray(events?.data) ||
    !events.pagination ||
    typeof events.pagination !== "object" ||
    !Number.isFinite(stats?.totalTrades)
  )
    throw schema();
  try {
    const collaterals = meta.collaterals.map((c) => {
      const decimals = c?.collateralConfig?.decimals;
      if (
        !Number.isInteger(Number(c?.collateralIndex)) ||
        typeof c?.symbol !== "string" ||
        !Number.isInteger(Number(decimals)) ||
        Number(decimals) < 0 ||
        Number(decimals) > 36
      )
        throw schema();
      return { index: Number(c.collateralIndex), symbol: c.symbol, decimals: Number(decimals) };
    });
    const trades = raw.flatMap((row) => {
      const p = row?.trade;
      if (!p || typeof p.user !== "string" || p.user.toLowerCase() !== wallet || p.isOpen !== true) return [];
      const collateral = collaterals.find((c) => c.index === Number(p.collateralIndex)),
        pair = meta.pairs[Number(p.pairIndex)],
        type = Number(p.tradeType);
      if (!collateral || !pair?.from || !pair?.to || !ORDER_TYPES[type] || typeof p.long !== "boolean")
        throw schema();
      return [
        {
          id: `42161:${wallet}:${p.index}`,
          index: String(p.index),
          market: `${pair.from}/${pair.to}`,
          side: p.long ? "long" : "short",
          type,
          orderType: ORDER_TYPES[type],
          entry: scaled(p.openPrice, 10),
          margin: scaled(p.collateralAmount, collateral.decimals),
          leverage: scaled(p.leverage, 3),
          sl: optionalPrice(p.sl),
          tp: optionalPrice(p.tp),
          currency: collateral.symbol,
          collateralIndex: collateral.index,
          contractsVersion:
            typeof row.tradeInfo?.contractsVersion === "string" ? row.tradeInfo.contractsVersion : null,
        },
      ];
    });
    const historyRows = events.data
      .filter((e) => typeof e?.address === "string" && e.address.toLowerCase() === wallet)
      .map((e) => {
        if (typeof e.action !== "string" || timestamp(e.date) === null) throw schema();
        const tx = typeof e.tx === "string" && TX.test(e.tx) ? e.tx : null;
        return {
          key: gainsKey({ ...e, tx }),
          date: e.date,
          market: typeof e.pair === "string" ? e.pair : null,
          action: e.action,
          side: e.long ? "long" : "short",
          price: number(e.price),
          margin: number(e.size),
          leverage: number(e.leverage),
          pnl: number(e.pnl_net),
          currency: collaterals.find((c) => c.index === Number(e.collateralIndex))?.symbol || null,
          tx,
          tradeIndex: e.tradeIndex,
        };
      });
    const checked = now();
    return {
      source: "gains:arbitrum",
      wallet,
      network: { ...GAINS_CHAIN },
      capabilities: { readOnly: true, canTrade: false, execution: "disabled" },
      provenance: {
        positions: "gains:backend-arbitrum/open-trades",
        orders: "gains:backend-arbitrum/open-trades",
        collaterals: "gains:backend-arbitrum/trading-variables",
        history: "gains:backend-global/personal-trading-history",
        stats: "gains:backend-global/personal-trading-history/stats",
      },
      asOf: new Date(checked).toISOString(),
      freshness: freshnessOf(
        reads,
        { trading_variables: timestamp(meta.lastRefreshed), stats: timestamp(stats.updatedAt) },
        checked,
      ),
      positions: trades.filter((t) => t.type === 0),
      orders: trades.filter((t) => t.type !== 0),
      history: historyRows,
      pagination: events.pagination,
      stats,
      collaterals,
    };
  } catch (e) {
    /* any decode failure (DecimalError, TypeError, ...) is an upstream schema
       change, reported explicitly instead of a 500 or a partial account */
    throw e?.status ? e : schema();
  }
}
