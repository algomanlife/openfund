import pg from "pg";
/** Product API integration. Use an isolated backend/database. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
const base = process.env.TEST_BACKEND_URL || "http://localhost:8080";
let passed = 0;
const ok = (name, condition) => {
  assert.ok(condition, name);
  console.log("PASS - " + name);
  passed++;
};
async function call(path, method = "GET", body, cookie = "") {
  const r = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: (r.headers.get("set-cookie") || "").split(";")[0],
  };
}
async function login() {
  const wallet = privateKeyToAccount(generatePrivateKey()),
    n = await call("/auth/nonce", "POST", { address: wallet.address });
  const message = createSiweMessage({
    domain: "localhost:5173",
    uri: "http://localhost:5173",
    address: wallet.address,
    chainId: 421614,
    nonce: n.data.nonce,
    version: "1",
  });
  return {
    ...(await call("/auth/verify", "POST", {
      message,
      signature: await wallet.signMessage({ message }),
    })),
    wallet,
  };
}
const a = await login(),
  b = await login(),
  get = (path, c = a.cookie) => call(path, "GET", undefined, c),
  put = (path, body, c = a.cookie) => call(path, "PUT", body, c);
const prop = (await get("/products/prop/context")).data,
  perp = (await get("/products/perpetual/context")).data;
ok(
  "authentication required",
  (await get("/products/prop/context", "")).status === 401,
);
ok(
  "separate contexts/capabilities",
  prop.accountRef !== perp.accountRef &&
    prop.capabilities.simulatedTrading &&
    perp.capabilities.positions &&
    perp.capabilities.execution === "unavailable",
);
ok(
  "perpetual has no simulated state",
  perp.state === null && perp.accounts[0].currency === null,
);
for (const [path, status] of [
  ["/products/wrong/context", 404],
  ["/products/prop/context?account=" + randomUUID(), 404],
  ["/products/prop/trades?limit=-2", 400],
  ["/products/prop/trades?offset=2.4", 400],
  ["/products/prop/trades?from=bad", 400],
  ["/products/prop/trades?from=2026-10-03&to=2026-10-01", 400],
])
  ok(path, (await get(path)).status === status);
ok(
  "no fabricated perpetual account",
  (await get("/products/perpetual/overview")).status === 409,
);
ok(
  "Perpetual history requires native Gains endpoint",
  (await get("/products/perpetual/trades")).status === 409,
);
await call("/internal/inject-price", "POST", {
  symbol: "BTC/USD",
  price: "50000",
});
const order = await call(
  "/trading/order",
  "POST",
  {
    market: "BTC/USD",
    side: "long",
    order_type: "market",
    margin: 1000,
    leverage: 5,
  },
  a.cookie,
);
assert.equal(order.status, 200);
const tradeId = order.data.position.id;
await call("/internal/inject-price", "POST", {
  symbol: "BTC/USD",
  price: "51000",
});
await call(`/trading/positions/${tradeId}/close`, "POST", {}, a.cookie);
const overview = (await get("/products/prop/overview")).data;
ok(
  "finite authoritative realized PnL",
  Number.isFinite(overview.account.realizedPnl) &&
    overview.account.realizedPnl > 0,
);
ok(
  "date filters analytical results",
  (await get("/products/prop/overview?from=2000-01-01&to=2000-01-02")).data
    .metrics.closedTrades === 0,
);
ok(
  "owned order history",
  (await get("/products/prop/orders")).data.orders.some(
    (x) => x.id === order.data.order.id,
  ),
);
ok(
  "cross-user details hidden",
  (await get("/products/prop/trades/" + tradeId, b.cookie)).status === 404,
);
ok(
  "cross-product details hidden",
  (await get("/products/perpetual/trades/" + tradeId)).status === 404,
);
const detail = (await get("/products/prop/trades/" + tradeId)).data;
ok(
  "forged annotation rejected",
  (
    await put("/portfolio/notes", {
      tradeKey: "forged|key",
      notes: "x",
      tags: [],
    })
  ).status === 404,
);
ok(
  "foreign annotation rejected",
  (
    await put(
      "/products/prop/notes",
      { tradeKey: detail.trade.key, notes: "x", tags: [] },
      b.cookie,
    )
  ).status === 404,
);
ok(
  "invalid annotation tags rejected",
  (
    await put("/products/prop/notes", {
      tradeKey: detail.trade.key,
      notes: "x",
      tags: [{}],
    })
  ).status === 400,
);
if (process.env.DATABASE_URL) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const legacyKey = `${prop.accountRef}|BTC/USD|long|${detail.trade.openedAt}`;
  await pool.query(
    "INSERT INTO trade_notes (user_id,trade_key,notes,tags) VALUES ($1,$2,$3,$4)",
    [
      a.data.user.id,
      legacyKey,
      "Preserved legacy note",
      JSON.stringify(["legacy"]),
    ],
  );
  ok(
    "legacy timestamp annotations remain readable",
    (await get("/products/prop/trades/" + tradeId)).data.note.notes ===
      "Preserved legacy note",
  );
  ok(
    "legacy annotation keys remain editable",
    (
      await put("/products/prop/notes", {
        tradeKey: legacyKey,
        notes: "Edited legacy note",
        tags: ["legacy"],
      })
    ).status === 200,
  );
  ok(
    "canonical annotation takes precedence after edit",
    (await get("/products/prop/trades/" + tradeId)).data.note.notes ===
      "Edited legacy note",
  );
  await pool.end();
}
for (const product of ["prop", "perpetual"]) {
  const path = "/products/" + product + "/journal",
    ctx = product === "prop" ? prop : perp,
    id = randomUUID(),
    entry = {
      id,
      title: "Day review",
      body: "Risk review",
      date: "2026-11-02",
      tags: ["breakout"],
      classification: "trend",
      tradeId: product === "prop" ? tradeId : null,
    };
  ok(product + " save", (await put(path, entry)).status === 200);
  const saved = (await get(path + "?search=breakout")).data.entries[0];
  ok(
    product + " persisted metadata",
    saved.id === id &&
      saved.tags[0] === "breakout" &&
      saved.classification === "trend",
  );
  ok(
    product + " private journal",
    (await get(path, b.cookie)).data.total === 0,
  );
  ok(
    product + " foreign edit denied",
    (await put(path, { ...entry, version: 1 }, b.cookie)).status === 404,
  );
  ok(
    product + " foreign delete denied",
    (await call(path + "/" + id + "?version=1", "DELETE", undefined, b.cookie))
      .status === 409,
  );
  ok(
    product + " invalid trade link",
    (await put(path, { ...entry, id: randomUUID(), tradeId: randomUUID() }))
      .status === (product === "prop" ? 404 : 400),
  );
  ok(
    product + " stale edit conflict",
    (await put(path, { ...entry, version: 0 })).status === 409,
  );
  ok(
    product + " current revision accepted",
    (await put(path, { ...entry, body: "Updated", version: 1 })).data
      .version === 2,
  );
  ok(
    product + " date filter",
    (await get(path + "?from=2026-11-03")).data.total === 0,
  );
  ok(
    product + " invalid date",
    (await put(path, { ...entry, id: randomUUID(), date: "2026-99-99" }))
      .status === 400,
  );
  const payload = {
    format: "openfund-journal-v1",
    product,
    accountRef: ctx.accountRef,
    entries: [entry],
  };
  ok(
    product + " idempotent import",
    (await call(path + "/import", "POST", payload, a.cookie)).data.skipped ===
      1,
  );
  ok(
    product + " wrong account import",
    (
      await call(
        path + "/import",
        "POST",
        { ...payload, accountRef: "other" },
        a.cookie,
      )
    ).status === 400,
  );
  ok(
    product + " valid import",
    (
      await call(
        path + "/import",
        "POST",
        { ...payload, entries: [{ ...entry, id: randomUUID() }] },
        a.cookie,
      )
    ).data.imported === 1,
  );
  const rollbackId = randomUUID();
  ok(
    product + " invalid batch rejected",
    (
      await call(
        path + "/import",
        "POST",
        {
          ...payload,
          entries: [
            { ...entry, id: rollbackId },
            { ...entry, id: randomUUID(), date: "bad" },
          ],
        },
        a.cookie,
      )
    ).status === 400,
  );
  ok(
    product + " atomic import",
    !(await get(path)).data.entries.some((x) => x.id === rollbackId),
  );
  ok(
    product + " stale delete conflict",
    (await call(path + "/" + id + "?version=1", "DELETE", undefined, a.cookie))
      .status === 409,
  );
  ok(
    product + " owned delete",
    (await call(path + "/" + id + "?version=2", "DELETE", undefined, a.cookie))
      .status === 200,
  );
}
ok(
  "product journal isolation",
  (await get("/products/prop/journal")).data.entries.every(
    (e) => e.tradeId === tradeId,
  ),
);
ok(
  "journal does not mutate financial balance",
  (await get("/products/prop/overview")).data.account.balance ===
    overview.account.balance,
);
console.log(`\n${passed} passed, 0 failed`);
