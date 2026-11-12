/* Prop-only maximum leverage policy: category mapping, ceilings, strictest
   limit wins, and parity with the browser copy used by the Prop ticket. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { PROP_LEVERAGE_POLICY, propLeverageCategory, propLeverageCap, propMaxLeverage } from "../prop-leverage.js";

/* Shapes copied from the verified Gains /markets metadata (symbol, base,
   group, maxLeverage); only the fields the policy reads are kept. */
const M = {
  "BTC/USD": { symbol: "BTC/USD", base: "BTC", group: "crypto", maxLeverage: "200" },
  "ETH/USD": { symbol: "ETH/USD", base: "ETH", group: "crypto", maxLeverage: "200" },
  "SOL/USD": { symbol: "SOL/USD", base: "SOL", group: "crypto", maxLeverage: "150" },
  "BTCDEGEN/USD": { symbol: "BTCDEGEN/USD", base: "BTCDEGEN", group: "crypto", maxLeverage: "500" },
  "ETHFI/USD": { symbol: "ETHFI/USD", base: "ETHFI", group: "crypto", maxLeverage: "150" },
  "EUR/USD": { symbol: "EUR/USD", base: "EUR", group: "forex", maxLeverage: "1000" },
  "AAPL/USD": { symbol: "AAPL/USD", base: "AAPL", group: "stocks", maxLeverage: "100" },
  "SPY/USD": { symbol: "SPY/USD", base: "SPY", group: "indices", maxLeverage: "100" },
  "XAU/USD": { symbol: "XAU/USD", base: "XAU", group: "commodities", maxLeverage: "250" },
  "LOW/USD": { symbol: "LOW/USD", base: "LOW", group: "stocks", maxLeverage: "10" },
};
const max = (s, plan) => propMaxLeverage(M[s], s, plan);

test("requested ceilings per category", () => {
  assert.equal(max("BTC/USD"), 20);
  assert.equal(max("ETH/USD"), 20);
  assert.equal(max("SOL/USD"), 15);
  assert.equal(max("EUR/USD"), 50);
  assert.equal(max("AAPL/USD"), 50);
  assert.equal(max("SPY/USD"), 50);
  assert.equal(max("XAU/USD"), 50);
});

test("BTC/ETH exception is exact, never a substring match", () => {
  assert.equal(propLeverageCategory(M["BTC/USD"], "BTC/USD"), "btc");
  assert.equal(propLeverageCategory(M["BTCDEGEN/USD"], "BTCDEGEN/USD"), "crypto");
  assert.equal(propLeverageCategory(M["ETHFI/USD"], "ETHFI/USD"), "crypto");
  assert.equal(max("BTCDEGEN/USD"), 15);
  assert.equal(max("ETHFI/USD"), 15);
  /* a mislabelled record (BTC/USD symbol, other base) is not the major */
  assert.equal(propLeverageCap({ ...M["BTC/USD"], base: "WBTC" }, "BTC/USD"), 15);
  /* a non-crypto group never inherits the crypto major exception */
  assert.equal(propLeverageCap({ ...M["BTC/USD"], group: "stocks" }, "BTC/USD"), 50);
});

test("stricter existing limits win", () => {
  assert.equal(max("LOW/USD"), 10, "market maxLeverage below the policy");
  assert.equal(max("BTC/USD", 10), 10, "challenge plan reference leverage");
  assert.equal(max("EUR/USD", 100), 50, "a looser plan limit never widens the policy");
  assert.equal(max("BTC/USD", null), 20);
});

test("unknown categories get no policy ceiling (engine rejects them separately)", () => {
  assert.equal(propLeverageCategory({ group: "bonds", maxLeverage: 30 }, "X/USD"), null);
  assert.equal(propLeverageCap(null, "X/USD"), null);
});

test("browser copy matches the server policy", () => {
  const src = fs.readFileSync(new URL("../../web-react/public/legacy/prop-leverage.js", import.meta.url), "utf8");
  const ctx = { globalThis: {} };
  ctx.window = ctx.globalThis;
  vm.runInNewContext(src, ctx);
  const web = ctx.globalThis.OpenfundPropLeverage;
  assert.deepEqual(JSON.parse(JSON.stringify(web.POLICY)), JSON.parse(JSON.stringify(PROP_LEVERAGE_POLICY)));
  for (const [s, meta] of Object.entries(M))
    for (const plan of [null, 5, 18, 75])
      assert.equal(web.maxLeverage(meta, s, plan), propMaxLeverage(meta, s, plan), `${s} plan ${plan}`);
});
