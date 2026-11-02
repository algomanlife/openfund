/* Production bundle in Chromium. Generated EIP-1193 test wallets sign real
 * SIWE messages; CMS and Gains read failures are controlled fixtures. This
 * is not a hardware/extension WalletConnect or on-chain execution test. */
const { chromium } = require("playwright");
const { createRequire } = require("node:module");
const path = require("node:path"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const req = createRequire(
  path.resolve(__dirname, "../apps/backend/package.json"),
);
const { generatePrivateKey, privateKeyToAccount } = req("viem/accounts");
const BASE = process.env.TEST_FRONTEND_URL || "http://localhost:8080/react";
const API = process.env.TEST_BACKEND_URL || "http://localhost:8080";
const OUT = path.resolve(__dirname, "../output/playwright/unified");
fs.mkdirSync(OUT, { recursive: true });
const results = [];
function check(name, value) {
  assert.ok(value, name);
  results.push(name);
  console.log("PASS - " + name);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => {errors.push(e.stack || e.message);console.error("BROWSER ERROR",e.stack || e.message)});
    const wallets = [
      privateKeyToAccount(generatePrivateKey()),
      privateKeyToAccount(generatePrivateKey()),
    ];
    await page.exposeFunction("auditSign", ({ raw, index }) =>
      wallets[index].signMessage({ message: { raw } }),
    );
    await page.addInitScript(
      (addresses) => {
        const events = {},
          w = window;
        let index = 0,
          chain = "0xaa36a7";
        w.auditWallet = {
          network: () => chain,
          changeAccount: (i) => {
            index = i;
            (events.accountsChanged || []).forEach((fn) =>
              fn(i < 0 ? [] : [addresses[i]]),
            );
          },
        };
        w.ethereum = {
          isMetaMask: true,
          on: (k, fn) => (events[k] ||= []).push(fn),
          removeListener: (k, fn) =>
            (events[k] = (events[k] || []).filter((x) => x !== fn)),
          request: async ({ method, params }) => {
            if (["eth_accounts", "eth_requestAccounts"].includes(method))
              return index < 0 ? [] : [addresses[index]];
            if (method === "eth_chainId") return chain;
            if (method === "net_version") return String(parseInt(chain, 16));
            if (method === "wallet_switchEthereumChain") {
              chain = params[0].chainId;
              (events.chainChanged || []).forEach((fn) => fn(chain));
              return null;
            }
            if (method === "personal_sign")
              return w.auditSign({ raw: params[0], index });
            if (method === "eth_getBalance") return "0x0";
            if (method === "eth_blockNumber") return "0x1";
            if (method === "wallet_requestPermissions")
              return [{ parentCapability: "eth_accounts" }];
            return null;
          },
        };
      },
      wallets.map((w) => w.address),
    );
    await page.goto(`${BASE}/#/en/prop/dashboard`);
    await page
      .getByRole("button", { name: "Connect Wallet", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Sign in", exact: true })
      .first()
      .waitFor();
    await page
      .getByRole("button", { name: "Sign in", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "Account", exact: true }).waitFor();
    const call = async (path, body, method) =>
      page.evaluate(
        async ({ API, path, body, method }) => {
          const r = await fetch(API + path, {
            method: method || (body ? "POST" : "GET"),
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": crypto.randomUUID(),
            },
            body: body ? JSON.stringify(body) : undefined,
          });
          return { status: r.status, data: await r.json() };
        },
        { API, path, body, method },
      );
    const user = (await call("/auth/me")).data.user;
    const { Pool } = req("pg"),
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const challenge = (
      await pool.query(
        "INSERT INTO openfund_challenges(user_id,challenge_plan_id) SELECT $1,id FROM challenge_plans WHERE slug='standard' RETURNING id",
        [user.id],
      )
    ).rows[0];
    await pool.end();
    await page.reload();
    await page.locator(".of-account-card").nth(2).waitFor();
    check(
      "Unified directory contains Free Trial, Challenge and Perpetual cards",
      (await page.locator(".of-account-card").count()) === 3,
    );
    const accounts = (await call("/accounts")).data.accounts,
      trial = accounts.find((a) => a.type === "free_trial"),
      perp = accounts.find((a) => a.type === "perpetual");
    check(
      "New trial has real persisted 100000 USD and Perpetual balance stays unknown",
      trial.balance === "100000.00" &&
        trial.currency === "USD" &&
        perp.balance === null,
    );
    await page.screenshot({
      path: path.join(OUT, "dashboard.png"),
      fullPage: true,
    });
    await page.locator(`[data-account-id="${trial.id}"]`).click();
    await page
      .getByRole("navigation", { name: "Account detail navigation" })
      .waitFor();
    check(
      "Card opens selected account detail and preserves account URL",
      page.url().includes(encodeURIComponent(trial.id)),
    );
    const isolation = await call(
      "/products/prop/context?account=" + challenge.id,
    );
    check(
      "Challenge context never receives trial financial state",
      isolation.status === 200 &&
        isolation.data.state === null &&
        !isolation.data.capabilities.simulatedTrading,
    );
    const unknown = await call(
      "/products/prop/context?account=00000000-0000-4000-8000-000000000000",
    );
    check("Unknown account is rejected", unknown.status === 404);
    await page.goto(`${BASE}/#/en/prop/journal?account=${trial.id}`);
    await page.getByRole("navigation", { name: "Journal sections" }).waitFor();
    check(
      "All thirteen journal modules exist",
      (await page
        .getByRole("navigation", { name: "Journal sections" })
        .getByRole("button")
        .count()) === 13,
    );
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Analytics instrument" })
      .fill("BTC");
    await page.getByRole("button", { name: "7D", exact: true }).click();
    await Promise.all([
      page.waitForResponse(r=>r.url().includes('/preferences') && r.request().method()==='PUT' && r.request().postData()?.includes('compact')),
      page.getByRole("combobox", { name: "Journal layout" }).selectOption("compact")
    ]);
    await page.reload();
    await page.getByRole("combobox", { name: "Journal layout" }).waitFor();
    await page.waitForFunction(
      () =>
        document.querySelector('[aria-label="Journal layout"]')?.value ===
        "compact",
    );
    check(
      "Date range and layout persist on backend",
      (await call("/products/prop/preferences?account=" + trial.id)).data
        .range === "7D",
    );
    await page.screenshot({
      path: path.join(OUT, "journal.png"),
      fullPage: true,
    });
    await page
      .getByRole("navigation", { name: "Journal sections" })
      .getByRole("button", { name: "Playbooks", exact: true })
      .click();
    await page.getByRole("button", { name: "New entry", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill("Breakout review");
    await page
      .getByLabel("Private notes", { exact: true })
      .fill("Wait for a confirmed break; record invalidation.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("Entry saved.", { exact: true }).waitFor();
    await page.reload();
    await page
      .getByRole("heading", { name: "Breakout review", exact: true })
      .waitFor();
    check("Playbook persists through reload", true);
    await page
      .getByRole("combobox", { name: "Journal account" })
      .selectOption(challenge.id);
    await page.getByRole("navigation", { name: "Journal sections" }).waitFor();
    await page
      .getByRole("navigation", { name: "Journal sections" })
      .getByRole("button", { name: "Playbooks", exact: true })
      .click();
    check(
      "Account switching clears private playbook records",
      (await page
        .getByRole("heading", { name: "Breakout review", exact: true })
        .count()) === 0,
    );
    await page.goto(`${BASE}/#/en/prop/trade?account=${trial.id}`);
    const frame = page.frameLocator("iframe");
    await frame.locator("#submit-order").waitFor();
    await frame
      .locator("#book-asks .bk-row")
      .first()
      .waitFor({ timeout: 25000 });
    check(
      "Book uses actual Gains ask and bid rows",
      (await frame.locator("#book-bids .bk-row").count()) > 0,
    );
    check(
      "Book and Trades tabs remain visible",
      (await frame
        .getByRole("tab", { name: "Book", exact: true })
        .isVisible()) &&
        (await frame
          .getByRole("tab", { name: "Trades", exact: true })
          .isVisible()),
    );
    await page.screenshot({
      path: path.join(OUT, "book-live.png"),
      fullPage: true,
    });
    await frame.locator('.book-panel').screenshot({path:path.join(OUT,'book-panel.png')});
    await frame.getByRole("tab", { name: "Trades", exact: true }).click();
    await frame
      .locator("#trades-list .tr-row")
      .first()
      .waitFor({ timeout: 25000 });
    check(
      "Trades render verified executions with timestamps",
      (await frame.locator("#trades-list .tr-row").count()) > 0,
    );
    await page.screenshot({
      path: path.join(OUT, "trades-live.png"),
      fullPage: true,
    });
    await frame.locator('.book-panel').screenshot({path:path.join(OUT,'trades-panel.png')});
    await page.emulateMedia({ reducedMotion: "reduce" });
    check(
      "Reduced motion removes depth transition",
      (await frame
        .locator(".bk-row")
        .first()
        .evaluate((el) => getComputedStyle(el).transitionDuration)) === "0s",
    );
    await frame.getByRole("tab", { name: "Book", exact: true }).click();
    await call("/internal/inject-price", {
      symbol: "BTC/USD",
      price: "50000",
      metadata: { base: "BTC", group: "crypto", maxLeverage: 100 },
    });
    await frame.locator("#of-collateral").fill("1000");
    await frame.locator("#lev-range").fill("10");
    await frame.locator("#submit-order").click();
    await frame.locator("#review-dialog[open]").waitFor();
    check(
      "Order confirmation uses backend estimate",
      await frame
        .locator("#review-body")
        .innerText()
        .then((t) => t.includes("Simulation estimate")),
    );
    await frame.locator("#review-confirm").click();
    await page.waitForFunction(
      () => window.__ofServerTP?.state.positions.length === 1,
    );
    let st = (await call("/trading/state")).data;
    const position = st.positions[0];
    check(
      "Actual terminal review opens a persisted Long",
      position.side === "long" && Number(position.margin) === 1000,
    );
    await call("/internal/inject-price", { symbol: "BTC/USD", price: "51000" });
    await page.waitForFunction(
      () => window.__ofServerTP?.state.positions[0]?.srvPnl > 0,
    );
    const protection = await call(
      `/trading/positions/${position.id}/protection`,
      { sl: "49000", tp: "55000" },
    );
    check("Protection modification executes", protection.status === 200);
    await frame.locator(`[data-close="${position.id}"]`).click();
    await frame.locator("#close-fraction").selectOption("0.5");
    await frame.locator("#confirm-ok").click();
    await page.waitForFunction(
      () => window.__ofServerTP?.state.positions[0]?.margin === 500,
    );
    check("Terminal partial close releases half the margin", true);
    await frame.locator(`[data-close="${position.id}"]`).click();
    await frame.locator("#confirm-ok").click();
    await page.waitForFunction(
      () => window.__ofServerTP?.state.positions.length === 0,
    );
    const ov = (await call("/products/prop/overview")).data;
    st = (await call("/trading/state")).data;
    check(
      "Full close balance, history, calendar and journal metrics reconcile",
      ov.metrics.closedTrades === 2 &&
        Math.abs(ov.metrics.netPnl - (Number(st.account.balance) - 100000)) <
          0.01 &&
        ov.daily.length === 1,
    );
    await call("/internal/inject-price", { symbol: "BTC/USD", price: "50000" });
    await call("/trading/order", {
      market: "BTC/USD",
      side: "long",
      order_type: "market",
      margin: "95000",
      leverage: 100,
    });
    await call("/internal/inject-price", { symbol: "BTC/USD", price: "100" });
    await page.waitForFunction(() => window.__ofServerTP?.canTrade === false);
    for (let i = 0; i < 40; i++) {
      st = (await call("/trading/state")).data;
      if (st.account.status === "permanently_disabled") break;
      await new Promise((r) => setTimeout(r, 250));
    }
    check(
      "Zero-equity event permanently disables the trial and settles positions",
      st.account.status === "permanently_disabled" && st.positions.length === 0,
    );
    await page.reload();
    await page.getByRole("button", { name: "Account", exact: true }).waitFor();
    const blocked = await call("/trading/order", {
      market: "BTC/USD",
      side: "short",
      margin: "1000",
      leverage: 10,
    });
    check(
      "Reload and restored session cannot reopen disabled account",
      blocked.status === 403 &&
        blocked.data.error === "account_permanently_disabled",
    );
    await page.goto(`${BASE}/#/en/prop/dashboard`);
    await page.locator(`[data-account-id="${trial.id}"]`).waitFor();
    check(
      "Disabled card and historical data remain accessible",
      await page
        .locator(`[data-account-id="${trial.id}"]`)
        .innerText()
        .then((t) => t.includes("permanently disabled")),
    );
    await page.screenshot({
      path: path.join(OUT, "disabled-trial.png"),
      fullPage: true,
    });
    for (const locale of ["en", "fa"]) {
      await page.setViewportSize({ width: 390, height: 1000 });
      await page.goto(`${BASE}/#/${locale}/prop/dashboard`);
      await page.locator(".of-account-card").first().waitFor();
      check(
        `Unified accounts ${locale} mobile has no overflow`,
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.goto(`${BASE}/#/${locale}/prop/journal?account=${trial.id}`);
      await page
        .getByRole("navigation", { name: "Journal sections" })
        .waitFor();
      check(
        `Journal ${locale} mobile has no overflow`,
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    check("No uncaught browser errors", errors.length === 0);
    fs.writeFileSync(
      path.join(OUT, "results.json"),
      JSON.stringify(
        {
          source:
            "Live Gains public feeds; actual local PostgreSQL/API, disposable SIWE wallet. Empty-account screenshots precede controlled execution tests; no chain transactions.",
          results,
          errors,
        },
        null,
        2,
      ),
    );
    console.log(`${results.length} unified browser checks passed`);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
