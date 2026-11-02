import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { Engine } from "../engine.js";
import { MarketData } from "../market-data.js";
import { instrumentSpec } from "../instruments.js";
if (!/test|audit|_ci/.test(process.env.DATABASE_URL || ""))
  throw Error("Use isolated test database");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
after(() => pool.end());
const fixtures = JSON.parse(
  readFileSync(new URL("./instrument-fixtures.json", import.meta.url)),
);
const near = (a, b) =>
  assert.ok(Math.abs(Number(a) - Number(b)) < 0.000001, `${a} != ${b}`);
for (const f of fixtures)
  test(`${f.group}: ${f.market} ${f.side} settlement matches independently derived decimal constants`, async () => {
    const id = randomUUID();
    await pool.query(
      "INSERT INTO openfund_users(id,wallet_address) VALUES($1,$2)",
      [id, "0x" + randomUUID().replaceAll("-", "") + "00000000"],
    );
    const md = new MarketData();
    md.markets.set(f.market, {
      group: f.group,
      base: f.market.split("/")[0],
      quote: "USD",
      maxLeverage: 100,
      sizePrecision: f.precision,
      isOpen: true,
    });
    md.injectPrice(f.market, f.start);
    const e = new Engine(pool, md);
    await e.ensureDemoAccount(id);
    const r = await e.submitOrder(
      id,
      { market: f.market, side: f.side, margin: "1000", leverage: 10 },
      randomUUID(),
    );
    near(r.position.entry_price, f.entry);
    near(r.position.quantity, f.quantity);
    near(r.position.open_fee, f.fee);
    md.injectPrice(f.market, f.end);
    const closed = await e.closePosition(id, r.position.id);
    near(closed.position.net_pnl, f.net);
    const st = await e.state(id);
    near(st.account.balance, Number(f.balance).toFixed(2));
    assert.equal(st.account.used_margin, "0.00");
    assert.equal(st.account.equity, st.account.balance);
  });
test("instrument model fails explicitly for unsupported conversion or contract size", () => {
  assert.throws(
    () => instrumentSpec({ group: "forex", quote: "JPY" }, "USD/JPY"),
    /unsupported_quote_conversion/,
  );
  assert.throws(
    () =>
      instrumentSpec(
        { group: "stocks", quote: "USD", contractSize: "100" },
        "AAPL/USD",
      ),
    /unsupported_contract_size/,
  );
  assert.throws(
    () => instrumentSpec({ group: "options", quote: "USD" }, "X/USD"),
    /unsupported_instrument/,
  );
});
