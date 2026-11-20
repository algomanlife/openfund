/* Deterministic Gains read-model scenarios (no network, no chain writes).
 * Covers the integration-readiness matrix: empty account, positions, pending
 * orders, collateral assets, partial closes, missing optional values, stale
 * and inconsistent timestamps, malformed responses, timeouts and outages. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { gainsPortfolio, createGainsReader, GAINS_STALE_MS } from "../gains-portfolio.js";
import { WALLET, NOW, mockReader, failingReader } from "./fixtures/gains-scenarios.mjs";

const run = (name, opts = {}) =>
  gainsPortfolio(WALLET, opts.query || {}, mockReader(name, opts), { now: () => NOW });

test("every snapshot declares read-only provenance and Arbitrum One identity", async () => {
  const s = await run("onePosition");
  assert.equal(s.source, "gains:arbitrum");
  assert.deepEqual(s.network, { chainId: 42161, name: "Arbitrum One" });
  assert.deepEqual(s.capabilities, { readOnly: true, canTrade: false, execution: "disabled" });
  assert.equal(s.provenance.positions, "gains:backend-arbitrum/open-trades");
  assert.equal(s.provenance.history, "gains:backend-global/personal-trading-history");
  for (const field of ["balance", "available", "equity", "liquidationPrice", "unrealizedPnl", "fees"])
    assert.equal(field in s, false, `no fabricated ${field}`);
  for (const field of ["liq", "liquidationPrice", "upnl", "fee", "funding", "borrowing"])
    assert.equal(field in s.positions[0], false, `no fabricated position ${field}`);
});

test("empty account is an explicit empty native read, not an error", async () => {
  const s = await run("empty");
  assert.deepEqual([s.positions.length, s.orders.length, s.history.length], [0, 0, 0]);
  assert.equal(s.stats.totalTrades, 0);
  assert.equal(s.freshness.status, "fresh");
});

test("multiple positions keep their own collateral denomination and wallet scope", async () => {
  const s = await run("multiplePositions");
  assert.equal(s.positions.length, 3, "other wallet's trade excluded");
  assert.deepEqual(s.positions.map((p) => p.currency), ["DAI", "USDC", "WETH"]);
  const usdc = s.positions[1];
  assert.equal(usdc.margin, "2500");
  assert.equal(usdc.leverage, "5.5");
  assert.equal(usdc.side, "short");
  assert.equal(usdc.sl, "3300");
  assert.equal(usdc.tp, "2800");
  assert.equal(s.positions[2].margin, "0.25");
  assert.equal(s.positions[2].entry, "1.085");
  assert.equal(s.positions[0].contractsVersion, "10");
});

test("unset TP/SL are null, never a zero price", async () => {
  const s = await run("onePosition");
  assert.equal(s.positions[0].sl, null);
  assert.equal(s.positions[0].tp, null);
  assert.equal((await run("missingOptional")).positions[0].sl, null);
});

test("pending orders carry the SDK order type and stay out of positions", async () => {
  const s = await run("pendingOrders");
  assert.equal(s.positions.length, 0);
  assert.deepEqual(s.orders.map((o) => o.orderType), ["limit", "stop"]);
  assert.equal(s.orders[0].entry, "38000");
});

test("partial-close events remain individual native events", async () => {
  const s = await run("partialClose");
  assert.deepEqual(s.history.map((e) => e.action), ["TradeOpenedMarket", "PositionSizeDecrease", "TradeClosedMarket"]);
  assert.equal(new Set(s.history.map((e) => e.key)).size, 3);
  assert.equal(s.history[1].margin, 4);
});

test("missing optional values are null, unknown collateral stays unknown", async () => {
  const s = await run("missingOptional");
  const e = s.history[0];
  assert.equal(e.pnl, null);
  assert.equal(e.leverage, null);
  assert.equal(e.price, null);
  assert.equal(e.currency, null);
  assert.equal(s.stats.winRate, undefined);
});

test("fresh, stale and inconsistent upstream timestamps are labelled", async () => {
  const fresh = await run("onePosition");
  assert.equal(fresh.freshness.status, "fresh");
  assert.equal(fresh.freshness.staleAfterMs, GAINS_STALE_MS);
  assert.equal(fresh.freshness.sources.tradingVariables.upstreamAt, new Date(NOW - 5000).toISOString());
  const stale = await run("staleUpstream");
  assert.equal(stale.freshness.status, "stale");
  assert.ok(stale.freshness.warnings.includes("trading_variables_stale"));
  assert.ok(stale.freshness.warnings.includes("stats_stale"));
  const odd = await run("inconsistentTimestamps");
  assert.equal(odd.freshness.status, "inconsistent");
  assert.ok(odd.freshness.warnings.includes("trading_variables_future_timestamp"));
});

test("cached reads report their original fetch time, not response time", async () => {
  const s = await run("onePosition", { fetchedAt: NOW - 90_000 });
  assert.equal(s.freshness.fetchedAt, new Date(NOW - 90_000).toISOString());
  assert.equal(s.freshness.status, "stale");
  assert.ok(s.freshness.warnings.includes("cached_read_stale"));
});

for (const name of ["malformedCollateral", "malformedAmount", "unknownTradeType", "malformedEvent"])
  test(`malformed upstream (${name}) fails safely with 502`, async () => {
    await assert.rejects(() => run(name), { status: 502, message: "gains_schema_changed" });
  });

test("unsafe transaction identifiers are dropped, not linked", async () => {
  const s = await run("unsafeTx");
  assert.equal(s.history[0].tx, null);
});

test("provider unavailable and timeout are distinct explicit errors", async () => {
  await assert.rejects(() => gainsPortfolio(WALLET, {}, failingReader("down")), { status: 502, message: "gains_unavailable" });
  await assert.rejects(() => gainsPortfolio(WALLET, {}, failingReader("timeout")), { status: 504, message: "gains_timeout" });
});

test("default reader maps transport failures and records fetch time", async () => {
  let clock = 1_000;
  const make = (impl) => createGainsReader({ fetch: impl, now: () => clock });
  const ok = make(async () => new Response('{"a":1}', { status: 200 }));
  assert.deepEqual(await ok("https://x/1"), { body: { a: 1 }, fetchedAt: 1_000 });
  clock = 5_000;
  assert.equal((await ok("https://x/1")).fetchedAt, 1_000, "cache hit keeps original fetch time");
  await assert.rejects(() => make(async () => new Response("", { status: 503 }))("https://x/2"), { status: 502, message: "gains_read_failed" });
  await assert.rejects(() => make(async () => { throw new TypeError("fetch failed"); })("https://x/3"), { status: 502, message: "gains_unavailable" });
  await assert.rejects(() => make(async () => { throw new DOMException("t", "TimeoutError"); })("https://x/4"), { status: 504, message: "gains_timeout" });
  await assert.rejects(() => make(async () => new Response("<html>", { status: 200 }))("https://x/5"), { status: 502, message: "gains_schema_changed" });
});

test("no request leaves the read-only allowlist", async () => {
  const calls = [];
  await run("onePosition", { calls, query: { market: "BTC/USD", cursor: "12" } });
  assert.equal(calls.length, 4);
  for (const url of calls) {
    const u = new URL(url);
    assert.ok(["backend-arbitrum.gains.trade", "backend-global.gains.trade"].includes(u.host));
    assert.ok(!u.search.includes("0x") || u.pathname.includes(WALLET));
  }
});
