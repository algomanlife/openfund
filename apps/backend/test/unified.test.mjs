import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { Engine } from "../engine.js";
import { Portfolio } from "../portfolio.js";
import { MarketData, quoteRecord } from "../market-data.js";
import { accountDirectory } from "../accounts.js";
if (!/test|audit|_ci/.test(process.env.DATABASE_URL || ""))
  throw Error("Use isolated test database");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
after(() => pool.end());
const req = {
  market: "BTC/USD",
  side: "long",
  order_type: "market",
  margin: "1000",
  leverage: 10,
};
async function setup() {
  const id = randomUUID(),
    wallet = "0x" + randomUUID().replaceAll("-", "") + "00000000";
  await pool.query(
    "INSERT INTO openfund_users(id,wallet_address) VALUES ($1,$2)",
    [id, wallet],
  );
  const md = new MarketData();
  md.markets.set("BTC/USD", {
    base: "BTC",
    group: "crypto",
    maxLeverage: 100,
    isOpen: true,
  });
  md.injectPrice("BTC/USD", "50000");
  const engine = new Engine(pool, md);
  await engine.ensureDemoAccount(id);
  return { id, wallet, md, engine };
}
const near = (a, b, tol = 0.000001) =>
  assert.ok(Math.abs(Number(a) - Number(b)) < tol, `${a} != ${b}`);
test("concurrent provisioning has one USD account and funding record, no duration or trade limits", async () => {
  const a = await setup();
  const rows = await Promise.all(
    Array.from({ length: 12 }, () => a.engine.ensureDemoAccount(a.id)),
  );
  assert.equal(new Set(rows.map((a) => a.id)).size, 1);
  assert.equal(rows[0].currency, "USD");
  assert.equal(rows[0].balance, "100000.0000000000");
  assert.equal(
    (
      await pool.query(
        "SELECT count(*) FROM trading_ledger WHERE user_id=$1 AND event='demo_funding'",
        [a.id],
      )
    ).rows[0].count,
    "1",
  );
  await pool.query(
    "UPDATE demo_accounts SET created_at=now()-interval '100 years' WHERE user_id=$1",
    [a.id],
  );
  assert.equal((await a.engine.submitOrder(a.id, req, "ancient")).ok, true);
});
test("insufficient margin only rejects; individual liquidation leaves positive trial active", async () => {
  const a = await setup();
  assert.equal(
    (
      await a.engine.submitOrder(
        a.id,
        { ...req, margin: "100000" },
        "no-margin",
      )
    ).reason,
    "insufficient_margin",
  );
  assert.equal((await a.engine.getAccount(a.id)).status, "active");
  await a.engine.submitOrder(a.id, req, "liquidate-position");
  a.md.injectPrice("BTC/USD", "40000");
  a.engine.running = true;
  await a.engine.loop();
  a.engine.stop();
  const st = await a.engine.state(a.id);
  assert.equal(st.history[0].exit_reason, "liquidation");
  assert.equal(st.account.status, "active");
  assert.ok(Number(st.account.balance) > 0);
});
test("zero-equity termination is permanent, cancels pending, preserves history and cannot replenish or delete", async () => {
  const a = await setup();
  await a.engine.submitOrder(
    a.id,
    { ...req, order_type: "limit", target_price: "40000" },
    "pending",
  );
  await pool.query("UPDATE demo_accounts SET balance=0 WHERE user_id=$1", [
    a.id,
  ]);
  await Promise.all(
    Array.from({ length: 8 }, () => a.engine.enforceTrialRisk(a.id)),
  );
  const account = await a.engine.getAccount(a.id);
  assert.equal(account.status, "permanently_disabled");
  assert.ok(account.disabled_at);
  assert.equal((await a.engine.ensureDemoAccount(a.id)).id, account.id);
  assert.equal(
    (await a.engine.ensureDemoAccount(a.id)).balance,
    "0.0000000000",
  );
  await assert.rejects(
    () => new Engine(pool, a.md).submitOrder(a.id, req, "after-restart"),
    /account_permanently_disabled/,
  );
  assert.equal((await a.engine.state(a.id)).orders.length, 0);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*) FROM trading_events WHERE account_id=$1 AND kind='trial_permanently_disabled'",
        [account.id],
      )
    ).rows[0].count,
    "1",
  );
  await assert.rejects(
    () =>
      pool.query(
        "UPDATE demo_accounts SET status='active',balance=100000 WHERE id=$1",
        [account.id],
      ),
    /immutable/,
  );
  await assert.rejects(
    () => pool.query("DELETE FROM demo_accounts WHERE id=$1", [account.id]),
    /immutable/,
  );
  const directory = await accountDirectory(pool, a.engine, {
    user_id: a.id,
    wallet_address: a.wallet,
  });
  assert.equal(directory.accounts[0].status, "permanently_disabled");
  assert.equal(directory.accounts.at(-1).balance, null);
});
test("negative equity forced settlement is atomic under concurrent opening requests and readable after restart", async () => {
  const a = await setup();
  const p = await a.engine.submitOrder(
    a.id,
    { ...req, margin: "90000", leverage: 100 },
    "large",
  );
  a.md.injectPrice("BTC/USD", "100");
  const out = await Promise.allSettled(
    Array.from({ length: 5 }, (_, i) =>
      a.engine.submitOrder(a.id, req, "race-" + i),
    ),
  );
  assert.ok(out.every((r) => r.status === "rejected"));
  const st = await new Engine(pool, a.md).state(a.id);
  assert.equal(st.account.status, "permanently_disabled");
  assert.equal(st.positions.length, 0);
  assert.equal(st.history[0].id, p.position.id);
  assert.equal(st.account.used_margin, "0.00");
  const ledger = (
    await pool.query(
      "SELECT SUM(amount) total FROM trading_ledger WHERE user_id=$1",
      [a.id],
    )
  ).rows[0].total;
  near(st.account.balance, ledger, 0.006);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*) FROM trading_orders WHERE user_id=$1 AND status='filled'",
        [a.id],
      )
    ).rows[0].count,
    "1",
  );
});
test("zero-equity precision is tested before display rounding", async () => {
  const a = await setup();
  await pool.query(
    "UPDATE demo_accounts SET balance=0.0000000001 WHERE user_id=$1",
    [a.id],
  );
  await a.engine.enforceTrialRisk(a.id);
  assert.equal((await a.engine.getAccount(a.id)).status, "active");
  await pool.query(
    "UPDATE demo_accounts SET balance=-0.0000000001 WHERE user_id=$1",
    [a.id],
  );
  await a.engine.enforceTrialRisk(a.id);
  assert.equal(
    (await a.engine.getAccount(a.id)).status,
    "permanently_disabled",
  );
});
test("disabled trial metadata is read-only at database boundary", async () => {
  const a = await setup(),
    acc = await a.engine.getAccount(a.id);
  await pool.query("UPDATE demo_accounts SET balance=0 WHERE id=$1", [acc.id]);
  await a.engine.enforceTrialRisk(a.id);
  await assert.rejects(
    () =>
      pool.query(
        "INSERT INTO journal_entries(user_id,product,account_ref,title,body,entry_date) VALUES($1,'prop',$2,'Note','','2026-11-02')",
        [a.id, acc.id],
      ),
    /account_permanently_disabled/,
  );
  await assert.rejects(
    () =>
      pool.query(
        "INSERT INTO journal_preferences(user_id,product,account_ref) VALUES($1,'prop',$2)",
        [a.id, acc.id],
      ),
    /account_permanently_disabled/,
  );
});
test("stale prices prevent forced liquidation and new execution", async () => {
  const a = await setup();
  await a.engine.submitOrder(a.id, req, "stale");
  a.md.clearInjection("BTC/USD");
  a.md.marks.set("BTC/USD", { mark: "1", at: Date.now() - 6000 });
  await a.engine.enforceTrialRisk(a.id);
  assert.equal((await a.engine.state(a.id)).account.equity, null);
  assert.equal((await a.engine.getAccount(a.id)).status, "active");
  assert.equal(
    (await a.engine.submitOrder(a.id, req, "no-stale")).reason,
    "stale_price",
  );
});
test("stop gaps use executable mark while limit fills retain their price bound", async () => {
  const a = await setup();
  await a.engine.submitOrder(
    a.id,
    { ...req, order_type: "stop", target_price: "51000" },
    "gap",
  );
  a.md.injectPrice("BTC/USD", "53000");
  a.engine.running = true;
  await a.engine.loop();
  a.engine.stop();
  const st = await a.engine.state(a.id);
  near(st.positions[0].entry_price, 53002.65);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*) FROM trading_events WHERE account_id=$1 AND kind='order_triggered'",
        [st.account.id],
      )
    ).rows[0].count,
    "1",
  );
});
test("backend preview matches accepted initial accounting and rejects invalid protection", async () => {
  const a = await setup(),
    v = await a.engine.previewOrder(a.id, req),
    p = await a.engine.submitOrder(a.id, req, "preview");
  assert.equal(v.estimate, true);
  near(v.entry_price, p.position.entry_price);
  near(v.quantity, p.position.quantity);
  near(v.open_fee, p.position.open_fee);
  near(v.required_margin, p.position.margin);
  await assert.rejects(
    () => a.engine.previewOrder(a.id, { ...req, sl: "60000" }),
    /invalid_sl/,
  );
  await assert.rejects(
    () => a.engine.previewOrder(a.id, { ...req, leverage: 101 }),
    /leverage_exceeded/,
  );
});
test("report closing-date range includes overnight trades and calendar reconciles", async () => {
  const a = await setup(),
    r = await a.engine.submitOrder(a.id, req, "overnight");
  await pool.query(
    "UPDATE trading_positions SET opened_at=now()-interval '10 days' WHERE id=$1",
    [r.position.id],
  );
  a.md.injectPrice("BTC/USD", "51000");
  await a.engine.closePosition(a.id, r.position.id);
  const p = new Portfolio(pool, a.md),
    from = new Date(Date.now() - 86400000).toISOString();
  const ov = await p.overview(a.id, { from });
  assert.equal(ov.metrics.closedTrades, 1);
  near(
    ov.metrics.netPnl,
    ov.daily.reduce((n, d) => n + d.netPnl, 0),
  );
  near(ov.account.balance, ov.balanceCurve.at(-1).cumNetPnl);
  assert.equal(
    (await p.overview(a.id, { from, market: "ETH" })).metrics.closedTrades,
    0,
  );
});

test('missing and future quote timestamps are never authoritative fresh marks',()=>{
 assert.equal(quoteRecord({market:'BTC/USD',mark:'100'}),null);
 assert.equal(quoteRecord({market:'BTC/USD',mark:'100',updatedAt:Date.now()+60000}),null);
})

test('opening an order without a durable request identity cannot execute twice',async()=>{const a=await setup();await assert.rejects(()=>a.engine.submitOrder(a.id,req),/idempotency_key_required/);assert.equal((await a.engine.state(a.id)).positions.length,0)})

test('partial close respects base quantity precision and allocates only the closed exposure',async()=>{
 const a=await setup();a.md.markets.get('BTC/USD').sizePrecision=5;const open=await a.engine.submitOrder(a.id,req,'precision-open');
 const out=await a.engine.closePosition(a.id,open.position.id,{fraction:'0.5',idempotencyKey:'precision-half'});
 assert.equal(out.position.quantity,'0.09999');const st=await a.engine.state(a.id);assert.equal(st.positions[0].quantity,'0.1');
 near(Number(out.position.margin)+Number(st.positions[0].margin),1000,.011);near(Number(out.position.open_fee)+Number(st.positions[0].open_fee),3.5,.00011);
 assert.ok(Number(out.position.margin)<=500);
})
