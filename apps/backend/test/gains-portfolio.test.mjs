import { test } from "node:test";
import assert from "node:assert/strict";
import { gainsPortfolio } from "../gains-portfolio.js";
const wallet = "0x0000000000000000000000000000000000000001",
  other = "0x0000000000000000000000000000000000000002";
const position = (user = wallet, type = "0") => ({
  trade: {
    user,
    index: "7",
    pairIndex: "0",
    leverage: "12000",
    long: true,
    isOpen: true,
    collateralIndex: "1",
    tradeType: type,
    collateralAmount: "843000000000000000000",
    openPrice: "396120000000000",
    tp: "0",
    sl: "0",
  },
});
const read = async (url) =>
  url.includes("/stats?")
    ? { totalTrades: 0 }
    : url.includes("/trading-variables")
      ? {
          pairs: [{ from: "BTC", to: "USD" }],
          collaterals: [
            {
              collateralIndex: 1,
              symbol: "DAI",
              collateralConfig: { decimals: 18 },
            },
          ],
        }
      : url.includes("/open-trades/")
        ? [position(), position(other), position(wallet, "1")]
        : {
            data: [
              {
                address: wallet,
                date: "2026-11-02T00:00:00Z",
                pair: "BTC/USD",
                action: "TradeClosedMarket",
                long: 1,
                price: 50000,
                size: 10,
                leverage: 2,
                pnl_net: 0,
                tx: "0x" + "a".repeat(64),
                tradeIndex: 7,
                collateralIndex: 1,
              },
            ],
            pagination: { hasMore: false, nextCursor: null },
          };
test("Gains records isolate wallet and convert official fixed-point fields", async () => {
  const s = await gainsPortfolio(wallet, {}, read);
  assert.equal(s.positions.length, 1);
  assert.equal(s.orders.length, 1);
  assert.equal(s.positions[0].margin, "843");
  assert.equal(s.positions[0].entry, "39612");
  assert.equal(s.positions[0].leverage, "12");
  assert.equal(s.history[0].pnl, 0);
  assert.equal(s.history[0].currency, "DAI");
  assert.equal(s.source, "gains:arbitrum");
});
test("invalid wallet never reaches external service", async () => {
  await assert.rejects(
    () =>
      gainsPortfolio("invalid", {}, () => {
        throw new Error("should not call");
      }),
    { status: 400 },
  );
});
test("invalid cursor rejected", async () => {
  await assert.rejects(
    () => gainsPortfolio(wallet, { cursor: "inject" }, read),
    { status: 400 },
  );
});
test("upstream schema failure is explicit, not an empty portfolio", async () => {
  await assert.rejects(() => gainsPortfolio(wallet, {}, async () => ({})), {
    status: 502,
  });
});

import { toRoundTrip } from "../portfolio.js";
test("position-based keys do not collide at the same timestamp", () => {
  const p = {
    id: "position-one",
    account_id: "account-one",
    market: "BTC/USD",
    side: "long",
    opened_at: new Date("2026-11-02T00:00:00Z"),
    status: "open",
    entry_price: "50000",
    quantity: "1",
    open_fee: "0",
    realized_pnl: "0",
    margin: "100",
    leverage: 5,
  };
  assert.notEqual(
    toRoundTrip(p).key,
    toRoundTrip({ ...p, id: "position-two" }).key,
  );
});
