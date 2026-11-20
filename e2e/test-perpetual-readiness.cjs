/* Openfund Perpetual (Gains) integration-readiness acceptance.
 *
 * One wallet / one SIWE session across Prop and Perpetual, wallet change and
 * disconnect invalidation, refresh restoration, explicit freshness states and
 * product identity across five locales and three viewports.
 *
 * Gains account responses are served from deterministic local fixtures through
 * request interception, so the test never depends on a live wallet's data. The
 * test wallet is a disposable generated signer whose provider rejects every
 * transaction method: nothing is ever sent to a chain or trading provider.
 *
 * Requires the backend on TEST_BACKEND_URL serving the built frontend
 * (npm run build:web), with an isolated database.
 * Usage: TEST_BACKEND_URL=http://localhost:18180 node e2e/test-perpetual-readiness.cjs
 */
const { createRequire } = require("node:module");
const path = require("node:path");
const fs = require("node:fs");
const backendRequire = createRequire(path.resolve(__dirname, "../apps/backend/package.json"));
const { privateKeyToAccount, generatePrivateKey } = backendRequire("viem/accounts");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright-core");
const { connect, signIn } = require("./helpers/wallet-ui.cjs");

const BASE = (process.env.TEST_FRONTEND_URL || process.env.TEST_BACKEND_URL || "http://localhost:8080").replace(/\/$/, "");
const OUT = path.resolve(__dirname, "../output/playwright/perpetual-readiness");
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${ok || !detail ? "" : " :: " + detail}`);
};

const walletA = privateKeyToAccount(generatePrivateKey());
const walletB = privateKeyToAccount(generatePrivateKey());
const signers = { [walletA.address.toLowerCase()]: walletA, [walletB.address.toLowerCase()]: walletB };

/* Mutable EIP-6963 test wallet: window.__ofTestWallet.switchTo(address) and
   .disconnect() emit the standard events. Every write method throws. */
function mutableWallet(initial) {
  const events = {};
  let address = sessionStorage.getItem("of-test-wallet") || initial;
  let permitted = sessionStorage.getItem("of-test-wallet-approved") === "yes";
  const emit = (n, v) => (events[n] || []).forEach((fn) => fn(v));
  const provider = {
    isRabby: true,
    on: (n, fn) => (events[n] ||= []).push(fn),
    removeListener: (n, fn) => (events[n] = (events[n] || []).filter((x) => x !== fn)),
    request: async ({ method, params }) => {
      if (method === "eth_accounts") return permitted && address ? [address] : [];
      if (method === "eth_requestAccounts") {
        permitted = true;
        sessionStorage.setItem("of-test-wallet-approved", "yes");
        emit("accountsChanged", [address]);
        return [address];
      }
      if (method === "eth_chainId") return "0xa4b1";
      if (method === "net_version") return "42161";
      if (method === "personal_sign") return window.ofTestSign(address, params[0]);
      if (method === "eth_getBalance") return "0x0";
      if (method === "eth_blockNumber") return "0x1";
      if (["wallet_requestPermissions", "wallet_getPermissions"].includes(method)) return [{ parentCapability: "eth_accounts" }];
      if (/^eth_(send|sign)(Raw)?Transaction$|^eth_signTypedData/.test(method) || method === "wallet_switchEthereumChain" && params?.[0]?.chainId !== "0xa4b1") {
        window.__ofForbidden = (window.__ofForbidden || 0) + 1;
        throw new Error("Blockchain writes forbidden in this test");
      }
      return null;
    },
  };
  window.__ofTestWallet = {
    switchTo(next) { address = next; sessionStorage.setItem("of-test-wallet", next); emit("accountsChanged", [next]); },
    disconnect() { permitted = false; sessionStorage.removeItem("of-test-wallet-approved"); emit("accountsChanged", []); },
  };
  const announce = () => dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "2f1f3c55-6a1e-4f0e-9d0c-0e1f5f2a7a11", name: "Rabby test signer", rdns: "io.rabby", icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>' }, provider } }));
  addEventListener("eip6963:requestProvider", announce);
  announce();
}

/* ---------- deterministic Gains snapshots (shape of gains-portfolio.js) ---------- */
const nowIso = () => new Date().toISOString();
const snapshot = (wallet, status = "fresh", positions = 1) => ({
  source: "gains:arbitrum",
  wallet: wallet.toLowerCase(),
  network: { chainId: 42161, name: "Arbitrum One" },
  capabilities: { readOnly: true, canTrade: false, execution: "disabled" },
  provenance: { positions: "fixture" },
  asOf: nowIso(),
  freshness: { status, checkedAt: nowIso(), fetchedAt: nowIso(), staleAfterMs: 300000, warnings: status === "fresh" ? [] : ["trading_variables_stale"], sources: {} },
  positions: Array.from({ length: positions }, (_, i) => ({ id: `42161:${wallet.toLowerCase()}:${i}`, index: String(i), market: i ? "ETH/USD" : "BTC/USD", side: i ? "short" : "long", type: 0, orderType: "market", entry: i ? "3100" : "39612", margin: i ? "2500" : "843", leverage: i ? "5.5" : "12", sl: null, tp: i ? "2800" : null, currency: i ? "USDC" : "DAI", collateralIndex: i ? 3 : 1, contractsVersion: "10" })),
  orders: [{ id: `42161:${wallet.toLowerCase()}:10`, index: "10", market: "BTC/USD", side: "long", type: 1, orderType: "limit", entry: "38000", margin: "100", leverage: "10", sl: null, tp: null, currency: "DAI", collateralIndex: 1, contractsVersion: "10" }],
  history: [
    { key: "k1", date: "2026-11-19T10:00:00.000Z", market: "BTC/USD", action: "PositionSizeDecrease", side: "long", price: 50000, margin: 4, leverage: 2, pnl: 0.5, currency: "DAI", tx: "0x" + "c".repeat(64), tradeIndex: 7 },
    { key: "k2", date: "2026-11-19T11:00:00.000Z", market: "BTC/USD", action: "TradeClosedMarket", side: "long", price: 50100, margin: 6, leverage: 2, pnl: 0.75, currency: "DAI", tx: "0x" + "d".repeat(64), tradeIndex: 7 },
  ],
  pagination: { hasMore: false, nextCursor: null },
  stats: { totalTrades: 3, winRate: 66.67 },
  collaterals: [{ index: 1, symbol: "DAI", decimals: 18 }, { index: 3, symbol: "USDC", decimals: 6 }],
});

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  let gainsMode = "fresh";
  const gainsRequests = [];
  const mutations = [];
  await context.route("**/products/perpetual/gains**", async (route) => {
    gainsRequests.push({ at: Date.now(), mode: gainsMode });
    if (gainsMode === "down") return route.fulfill({ status: 502, contentType: "application/json", body: '{"error":"gains_unavailable"}' });
    if (gainsMode === "timeout") return route.fulfill({ status: 504, contentType: "application/json", body: '{"error":"gains_timeout"}' });
    /* the real backend still authorizes: forward and replace only the provider body */
    const real = await route.fetch();
    if (real.status() !== 200 && real.status() !== 502 && real.status() !== 504) return route.fulfill({ response: real });
    const me = await (await context.request.get(BASE + "/auth/me")).json().catch(() => null);
    const wallet = me?.user?.walletAddress || walletA.address;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(snapshot(wallet, gainsMode === "stale" ? "stale" : "fresh", 2)) });
  });
  context.on("request", (r) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(r.method()) && /\/(trading|challenges|purchases|products\/[a-z]+\/(trades|orders))/.test(r.url())) mutations.push(r.method() + " " + r.url());
  });
  await context.exposeFunction("ofTestSign", (address, raw) => signers[address.toLowerCase()].signMessage({ message: { raw } }));
  await context.addInitScript(mutableWallet, walletA.address);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  try {
    /* ---------- one wallet / one session across products ---------- */
    await page.goto(`${BASE}/fa/prop/dashboard`, { waitUntil: "domcontentloaded" });
    await connect(page);
    await signIn(page);
    const meA = await page.evaluate(async () => (await fetch("/auth/me", { credentials: "include" })).json());
    check("signed in with wallet A", meA?.user?.walletAddress?.toLowerCase() === walletA.address.toLowerCase());
    await page.locator(".of-product-identity[data-product=prop]").waitFor({ timeout: 15000 });
    check("Prop identity: simulated evaluation", (await page.locator(".of-product-identity b").innerText()).includes("ارزیابی شبیه‌سازی‌شده"));
    await page.screenshot({ path: path.join(OUT, "fa-prop-dashboard-desktop.png") });

    await page.locator("select[aria-label=محصول]").selectOption("perpetual");
    await page.waitForURL(/\/fa\/perpetual\/dashboard/);
    await page.locator(".of-product-identity[data-product=perpetual]").waitFor();
    const meAfterSwitch = await page.evaluate(async () => (await fetch("/auth/me", { credentials: "include" })).json());
    check("switching to Perpetual keeps the same SIWE session", meAfterSwitch?.user?.id === meA.user.id);
    check("no sign-in prompt after product switch", (await page.getByRole("button", { name: /^(Sign in|ورود به اوپن‌فاند)$/ }).count()) === 0);
    await page.locator(".of-source-bar[data-feed=live]").waitFor({ timeout: 20000 });
    check("Perpetual dashboard shows source, network and read-only badge",
      (await page.locator(".of-source-bar").innerText()).includes("Arbitrum One · 42161") && (await page.locator(".of-readonly-badge").count()) > 0);
    check("wallet address renders LTR", (await page.locator(".of-dashboard-grid p[dir=ltr]").first().getAttribute("dir")) === "ltr");
    await page.screenshot({ path: path.join(OUT, "fa-perpetual-dashboard-desktop.png") });

    /* ---------- portfolio: native records, order type, partial closes ---------- */
    await page.goto(`${BASE}/fa/perpetual/portfolio`, { waitUntil: "domcontentloaded" });
    await page.locator("#gains-records table tbody tr").first().waitFor({ timeout: 20000 });
    check("two native positions with their own collateral", (await page.locator("#gains-records tbody tr").count()) === 2 && (await page.locator("#gains-records tbody").innerText()).includes("USDC"));
    check("unset TP/SL displayed as unavailable", (await page.locator("#gains-records tbody tr").first().innerText()).includes("—"));
    await page.getByRole("tab", { name: "سفارش‌ها" }).click();
    check("pending order shows its Gains order type", (await page.locator("#gains-records tbody").innerText()).includes("لیمیت"));
    check("tabs are wired to their panel", (await page.getByRole("tab", { name: "سفارش‌ها" }).getAttribute("aria-selected")) === "true" && (await page.locator("#gains-records").getAttribute("aria-labelledby")) === "gains-tab-orders");
    await page.getByRole("tab", { name: "تاریخچه" }).click();
    check("partial-close events stay separate native events", (await page.locator("#gains-records tbody tr").count()) === 2 && (await page.locator("#gains-records tbody").innerText()).includes("PositionSizeDecrease"));
    await page.screenshot({ path: path.join(OUT, "fa-perpetual-portfolio-desktop.png") });

    /* ---------- stale, outdated (retained) and unavailable states ---------- */
    gainsMode = "stale";
    await page.getByRole("button", { name: "به‌روزرسانی" }).first().click();
    await page.locator(".of-source-bar[data-feed=stale]").waitFor({ timeout: 10000 });
    check("stale upstream snapshot labelled stale", true);
    gainsMode = "fresh";
    await page.getByRole("button", { name: "به‌روزرسانی" }).first().click();
    await page.locator(".of-source-bar[data-feed=live]").waitFor({ timeout: 10000 });
    gainsMode = "down";
    await page.evaluate(() => dispatchEvent(new Event("of-trading-update")));
    await page.waitForTimeout(2500);
    await page.evaluate(() => dispatchEvent(new Event("of-trading-update")));
    await page.locator(".of-source-bar[data-feed=outdated]").waitFor({ timeout: 20000 });
    check("failed refresh keeps last snapshot, labelled outdated", (await page.locator(".of-source-bar [role=alert]").count()) > 0);
    await page.screenshot({ path: path.join(OUT, "fa-perpetual-outdated.png") });
    gainsMode = "timeout";
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".of-source-bar[data-feed=unavailable]").waitFor({ timeout: 20000 });
    check("timeout with no prior snapshot shows provider unavailable, no fabricated rows", (await page.locator("#gains-records tbody tr").count()) === 0);
    gainsMode = "fresh";

    /* ---------- refresh restores the product route ---------- */
    await page.goto(`${BASE}/fa/perpetual/journal`, { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".of-product-identity[data-product=perpetual]").waitFor();
    check("browser refresh restores the Perpetual product", page.url().includes("/fa/perpetual/journal"));
    const meReload = await page.evaluate(async () => (await fetch("/auth/me", { credentials: "include" })).json());
    check("session restored after refresh", meReload?.user?.id === meA.user.id);

    /* ---------- Perpetual trade workspace is read-only ---------- */
    await page.goto(`${BASE}/fa/perpetual/trade`, { waitUntil: "domcontentloaded" });
    const frame = page.frameLocator("iframe.of-trading-workspace");
    await frame.locator("#submit-order").waitFor({ state: "attached", timeout: 30000 });
    await page.waitForTimeout(3000);
    check("order submit disabled in Perpetual", await frame.locator("#submit-order").isDisabled());
    const feed = await frame.locator("#account-feed-state").innerText().catch(() => "");
    check("trade workspace states Gains is read-only", /فقط خواندنی|read-only/i.test(feed), feed);
    /* Details/Share are view-only; close, SL/TP and cancel must be disabled */
    const tradingActs = await frame.locator(".act-btn[data-close]:not([disabled]),.act-btn[data-sltp]:not([disabled]),.act-btn[data-cancel]:not([disabled])").count();
    const viewActs = await frame.locator(".act-btn[data-detail],.act-btn[data-share]").count();
    check("no executable close/SL-TP/cancel actions; only view actions enabled", tradingActs === 0 && viewActs > 0, `trading=${tradingActs} view=${viewActs}`);
    await page.screenshot({ path: path.join(OUT, "fa-perpetual-trade-desktop.png") });

    /* ---------- switching to Prop keeps Gains data available ---------- */
    await page.goto(`${BASE}/fa/prop/portfolio`, { waitUntil: "domcontentloaded" });
    await page.locator(".of-product-identity[data-product=prop]").waitFor();
    await page.goto(`${BASE}/fa/perpetual/portfolio`, { waitUntil: "domcontentloaded" });
    await page.locator("#gains-records tbody tr").first().waitFor({ timeout: 20000 });
    check("returning to Perpetual still shows Gains records", true);

    /* ---------- wallet change invalidates wallet-scoped data ---------- */
    const before = gainsRequests.length;
    await page.evaluate((b) => window.__ofTestWallet.switchTo(b), walletB.address);
    await page.waitForTimeout(2500);
    const meB = await page.evaluate(async () => (await fetch("/auth/me", { credentials: "include" })).json());
    check("wallet change revokes the previous session", !meB?.user);
    check("previous wallet's records removed from view", (await page.locator("#gains-records tbody tr").count()) === 0);
    await signIn(page);
    const meB2 = await page.evaluate(async () => (await fetch("/auth/me", { credentials: "include" })).json());
    check("new wallet signs in to its own identity", meB2?.user?.walletAddress?.toLowerCase() === walletB.address.toLowerCase() && meB2.user.id !== meA.user.id);
    await page.locator("#gains-records tbody tr").first().waitFor({ timeout: 20000 });
    check("records reload for the new wallet only", gainsRequests.length > before);

    /* ---------- disconnect updates both products ---------- */
    await page.evaluate(() => window.__ofTestWallet.disconnect());
    await page.waitForTimeout(2500);
    check("disconnect clears Perpetual records", (await page.locator("#gains-records tbody tr").count()) === 0);
    await page.goto(`${BASE}/fa/prop/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const meGone = await page.evaluate(async () => (await fetch("/auth/me", { credentials: "include" })).json());
    check("disconnect ends the shared session for Prop too", !meGone?.user);

    /* ---------- locale × viewport matrix (signed out: identity + layout) ---------- */
    const viewports = { mobile: { width: 375, height: 812 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1440, height: 1000 } };
    for (const locale of ["fa", "en", "ar", "ru", "zh-CN"])
      for (const [vp, size] of Object.entries(viewports)) {
        await page.setViewportSize(size);
        for (const product of ["prop", "perpetual"]) {
          await page.goto(`${BASE}/${locale}/${product}/dashboard`, { waitUntil: "domcontentloaded" });
          const strip = page.locator(`.of-product-identity[data-product=${product}]`);
          const visible = await strip.waitFor({ timeout: 15000 }).then(() => true, () => false);
          const dir = await page.locator(".of-terminal").getAttribute("dir");
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          const wantDir = locale === "fa" || locale === "ar" ? "rtl" : "ltr";
          check(`${locale} ${vp} ${product}: identity visible, ${wantDir}, no horizontal overflow`, visible && dir === wantDir && overflow <= 1, `visible=${visible} dir=${dir} overflow=${overflow}`);
          if (product === "perpetual" && (vp === "mobile" || locale === "en" || locale === "ar"))
            await page.screenshot({ path: path.join(OUT, `${locale}-perpetual-dashboard-${vp}.png`) });
        }
      }

    check("no transaction or signing write was attempted", (await page.evaluate(() => window.__ofForbidden || 0)) === 0);
    check("no Prop/trading mutations were issued", mutations.length === 0, mutations.join(", "));
    check("no uncaught page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  } catch (e) {
    check("unexpected failure: " + e.message.split("\n")[0], false);
    await page.screenshot({ path: path.join(OUT, "failure.png") }).catch(() => {});
  } finally {
    await browser.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  process.exit(failed.length ? 1 : 0);
})();
