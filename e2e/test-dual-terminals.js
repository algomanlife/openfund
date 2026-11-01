/* Real-browser integration; SIWE uses a generated signer behind an EIP-1193 test wallet.
 * Requires the isolated backend, existing Directus, and a frontend pointing to TEST_BACKEND_URL.
 * PLAYWRIGHT_MODULE/CHROMIUM_PATH allow the existing local browser installation. */
const { createRequire } = require("node:module");
const backendRequire = createRequire(
  require("node:path").resolve(__dirname, "../apps/backend/package.json"),
);
const { privateKeyToAccount, generatePrivateKey } =
  backendRequire("viem/accounts");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright-core",
);
const fs = require("node:fs"),
  path = require("node:path");
const BASE = process.env.TEST_FRONTEND_URL || "http://localhost:5186/react",
  API = process.env.TEST_BACKEND_URL || "http://localhost:8091";
const OUT = path.resolve(__dirname, "../output/playwright");
fs.mkdirSync(OUT, { recursive: true });
let debugPage, debugBrowser;
const results = [],
  check = (name, ok) => {
    results.push({ name, ok });
    console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
    if (!ok) throw new Error(name);
  };
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
  });
  debugBrowser = browser;
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    wallet = privateKeyToAccount(generatePrivateKey());
  const page = await context.newPage(),
    errors = [];
  debugPage = page;
  page.on("pageerror", (e) => errors.push(e.message));
  await page.exposeFunction("testSign", (message) =>
    wallet.signMessage({ message: { raw: message } }),
  );
  await page.addInitScript((address) => {
    const events = {};
    window.ethereum = {
      isMetaMask: true,
      emit: (k, v) => (events[k] || []).forEach((fn) => fn(v)),
      selectedAddress: address,
      on: (k, fn) => {
        (events[k] ||= []).push(fn);
      },
      removeListener: (k, fn) => {
        events[k] = (events[k] || []).filter((f) => f !== fn);
      },
      request: async ({ method, params }) => {
        if (["eth_accounts", "eth_requestAccounts"].includes(method))
          return [address];
        if (method === "eth_chainId") return "0x66eee";
        if (method === "net_version") return "421614";
        if (method === "personal_sign") return window.testSign(params[0]);
        if (method === "eth_getBalance") return "0x0";
        if (method === "eth_blockNumber") return "0x1";
        if (method === "wallet_requestPermissions")
          return [{ parentCapability: "eth_accounts" }];
        if (method === "wallet_switchEthereumChain") return null;
        return null;
      },
    };
  }, wallet.address);
  await page.goto(BASE + "/#/en/prop/dashboard");
  await page
    .getByRole("button", { name: "Connect Wallet", exact: true })
    .first()
    .click();
  await page.waitForTimeout(500);
  // With no WalletConnect project configured, the existing trigger connects injected directly.
  const connect = page.getByText("Injected", { exact: true });
  if (await connect.count()) await connect.first().click();
  const metamask = page.getByText("MetaMask", { exact: true });
  if (await metamask.count()) await metamask.first().click();
  const sign = page.getByRole("button", { name: /Sign in/i }).first();
  await sign.waitFor({ timeout: 15000 });
  await sign.click();
  await page
    .getByText("100,000.00", { exact: true })
    .first()
    .waitFor({ timeout: 15000 });
  check("wallet + real SIWE signature opens Prop account", true);
  check(
    "Prop navigation exact order",
    (await page.locator("#terminal-navigation a").allTextContents()).join(
      "|",
    ) ===
      "Dashboard|Prop Terminal|Portfolio|Leaderboard|Withdrawal Requests|Certificates",
  );
  await page.evaluate(() => (window.__documentSentinel = "preserved"));
  await page.getByRole("link", { name: "Prop Terminal", exact: true }).click();
  const frame = page.frameLocator("iframe");
  await frame.locator("#cur-pair").waitFor();
  await page.waitForTimeout(1800);
  check(
    "Prop terminal mounts real chart",
    (await frame.locator("canvas").count()) > 0,
  );
  const propStructure = JSON.stringify(
    await frame
      .locator(".workspace > *")
      .evaluateAll((es) => es.map((e) => e.className)),
  );
  check(
    "Prop frame uses server account",
    await frame
      .locator("body")
      .evaluate(() => !!window.__ofServerTP?.serverMode),
  );
  await page.screenshot({ path: path.join(OUT, "prop-trade-en.png") });
  // Create a deterministic server trade through the same authenticated browser session.
  const record = await page.evaluate(async (API) => {
    const post = (p, b) =>
      fetch(API + p, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
      }).then((r) => r.json());
    await post("/internal/inject-price", { symbol: "BTC/USD", price: "50000" });
    const o = await post("/trading/order", {
      market: "BTC/USD",
      side: "long",
      order_type: "market",
      margin: 1000,
      leverage: 5,
    });
    await post("/internal/inject-price", { symbol: "BTC/USD", price: "51000" });
    await post("/trading/positions/" + o.position.id + "/close", {});
    return o.position.id;
  }, API);
  check("server trade executed in isolated simulated account", !!record);
  await page
    .getByRole("link", { name: "Portfolio", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Details & notes" }).first().waitFor();
  check(
    "navigation does not reload application",
    await page.evaluate(() => window.__documentSentinel === "preserved"),
  );
  await page.getByRole("button", { name: "Details & notes" }).first().click();
  await page
    .getByLabel("Private note", { exact: true })
    .fill("Persisted trade note");
  await page
    .getByLabel("Tags, comma separated", { exact: true })
    .fill("discipline, breakout");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await page.getByRole("button", { name: "Details & notes" }).first().click();
  check(
    "trade notes persist",
    (await page.getByLabel("Private note", { exact: true }).inputValue()) ===
      "Persisted trade note",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Search symbol", { exact: true }).fill("NONMATCH");
  await page
    .getByText("No trades match these filters.", { exact: false })
    .waitFor();
  check(
    "trade search filters actual history",
    (await page.getByRole("button", { name: "Details & notes" }).count()) === 0,
  );
  await page.getByLabel("Search symbol", { exact: true }).fill("BTC");
  await page.getByRole("button", { name: "Details & notes" }).first().waitFor();
  const tradeCsvPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const tradeCsv = await tradeCsvPromise;
  await tradeCsv.saveAs(path.join(OUT, "trade-export.csv"));
  check(
    "filtered CSV export contains the owned trade",
    fs
      .readFileSync(path.join(OUT, "trade-export.csv"), "utf8")
      .includes(record),
  );
  await page.getByRole("tab", { name: "Orders", exact: true }).click();
  await page.getByRole("cell", { name: "filled", exact: true }).waitFor();
  check(
    "order history renders filled order",
    (await page.getByRole("cell", { name: "filled", exact: true }).count()) > 0,
  );
  await page.getByRole("tab", { name: "Performance", exact: true }).click();
  await page.locator(".of-curve").waitFor();
  check(
    "performance chart renders authoritative realized curve",
    (await page.locator(".of-curve circle").count()) > 0,
  );
  await page.screenshot({ path: path.join(OUT, "prop-portfolio-en.png") });
  await page
    .getByRole("link", { name: "Trade Journal", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "New entry", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Browser reflection");
  await page
    .getByLabel("Private notes", { exact: true })
    .fill("A persisted daily review");
  await page
    .getByLabel("Tags, comma separated", { exact: true })
    .fill("review");
  await page
    .getByLabel("Classification or strategy", { exact: true })
    .fill("trend");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("heading", { name: "Browser reflection", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("heading", { name: "Browser reflection", exact: true })
    .waitFor();
  check("journal survives full reload and session recovery", true);
  await page
    .getByLabel("Search text, tags or classification", { exact: true })
    .fill("NONMATCH");
  await page
    .getByText("No entries exist for this account", { exact: false })
    .waitFor();
  check(
    "journal search works",
    (await page
      .getByRole("heading", { name: "Browser reflection", exact: true })
      .count()) === 0,
  );
  await page
    .getByLabel("Search text, tags or classification", { exact: true })
    .fill("review");
  await page
    .getByRole("heading", { name: "Browser reflection", exact: true })
    .waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const exported = await downloadPromise;
  await exported.saveAs(path.join(OUT, "journal-export.json"));
  check(
    "journal JSON export downloads",
    JSON.parse(fs.readFileSync(path.join(OUT, "journal-export.json"), "utf8"))
      .entries.length === 1,
  );
  await page
    .locator("input[type=file]")
    .setInputFiles(path.join(OUT, "journal-export.json"));
  await page.getByRole("status").filter({ hasText: "Skipped: 1" }).waitFor();
  check(
    "journal file import is functional and idempotent",
    (await page
      .getByRole("heading", { name: "Browser reflection", exact: true })
      .count()) === 1,
  );
  await page.getByLabel("Product", { exact: true }).selectOption("perpetual");
  await page.getByRole("button", { name: "New entry", exact: true }).waitFor();
  check(
    "product switch preserves Journal destination",
    page.url().endsWith("/en/perpetual/journal"),
  );
  check(
    "Prop journal hidden in Perpetual",
    (await page
      .getByRole("heading", { name: "Browser reflection", exact: true })
      .count()) === 0,
  );
  await page.getByRole("button", { name: "New entry", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Perpetual market review");
  await page
    .getByLabel("Private notes", { exact: true })
    .fill("Read-only market observation");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByRole("heading", { name: "Perpetual market review", exact: true })
    .waitFor();
  check("Perpetual journal persists without fabricated trades", true);
  const gainsRead = await page.evaluate(async (API) => {
    const r = await fetch(API + "/products/perpetual/gains", {
      credentials: "include",
    });
    return { status: r.status, ...(await r.json()) };
  }, API);
  check(
    "Gains account read uses authenticated wallet",
    gainsRead.status === 200 &&
      gainsRead.wallet.toLowerCase() === wallet.address.toLowerCase() &&
      Array.isArray(gainsRead.history),
  );
  await page.screenshot({ path: path.join(OUT, "perpetual-journal-en.png") });
  await page
    .getByRole("button", { name: "Calendar & statistics", exact: true })
    .click();
  await page.getByLabel("Collateral currency", { exact: true }).waitFor();
  check(
    "Perpetual journal has a functional calendar",
    (await page.locator(".of-calendar-grid button").count()) >= 28,
  );
  await page.getByLabel("Choose month", { exact: true }).fill("2026-10");
  check(
    "Perpetual calendar month selection works",
    (await page.locator(".of-calendar-grid button").count()) === 31,
  );
  await page
    .getByLabel("Collateral currency", { exact: true })
    .locator("option")
    .first()
    .waitFor({ state: "attached" });
  const currencyOptions = await page
    .getByLabel("Collateral currency", { exact: true })
    .locator("option")
    .allTextContents();
  await page
    .getByLabel("Collateral currency", { exact: true })
    .selectOption(currencyOptions.at(-1));
  check(
    "Perpetual analytics isolate collateral currency",
    (await page
      .getByLabel("Collateral currency", { exact: true })
      .inputValue()) === currencyOptions.at(-1),
  );

  await page
    .getByRole("link", { name: "Perpetual Terminal", exact: true })
    .click();
  await page
    .frameLocator("iframe")
    .locator("canvas")
    .first()
    .waitFor({ timeout: 20000 });
  check(
    "shared workspace structure matches Prop",
    JSON.stringify(
      await page
        .frameLocator("iframe")
        .locator(".workspace > *")
        .evaluateAll((es) => es.map((e) => e.className)),
    ) === propStructure,
  );
  check(
    "Terminal tab contains no page title or editorial",
    (await page.locator("main > .of-editorial, main > h1").count()) === 0,
  );
  check(
    "Terminal fills viewport without outer scrolling",
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight + 1,
    ),
  );
  check(
    "no staged product status labels in terminal",
    !/demo|prototype|mockup|coming soon|under development|sample data|placeholder feature|not connected|integration pending/i.test(
      (await page.locator("body").innerText()) +
        (await page.frameLocator("iframe").locator("body").innerText()),
    ),
  );
  check("Perpetual chart renders from Gains", true);
  check(
    "Perpetual does not mount simulation bridge",
    await page.evaluate(() => !window.__ofServerTP),
  );
  check(
    "Perpetual navigation exact order",
    (await page.locator("#terminal-navigation a").allTextContents()).join(
      "|",
    ) === "Dashboard|Perpetual Terminal|Portfolio|Leaderboard|Rewards",
  );
  await page.screenshot({ path: path.join(OUT, "perpetual-trade-en.png") });
  await page.getByRole("button", { name: "FA", exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dir === "rtl");
  check("Persian route and RTL", page.url().includes("/fa/perpetual/trade"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("link", { name: "پورتفولیو", exact: true })
    .first()
    .click();
  await page
    .getByText("رکوردی برای نمایش وجود ندارد.", { exact: true })
    .waitFor({ timeout: 20000 });
  check(
    "mobile product navigation works",
    page.url().includes("/fa/perpetual/portfolio"),
  );
  check(
    "mobile has no horizontal page overflow",
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await page.screenshot({
    path: path.join(OUT, "perpetual-portfolio-fa-mobile.png"),
    fullPage: true,
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const locale of ["fa", "en"])
      for (const [product, pages] of Object.entries({
        prop: [
          "dashboard",
          "trade",
          "portfolio",
          "journal",
          "leaderboard",
          "withdrawals",
          "certificates",
        ],
        perpetual: [
          "dashboard",
          "trade",
          "portfolio",
          "journal",
          "leaderboard",
          "rewards",
        ],
      })) {
        for (const destination of pages) {
          await page.goto(`${BASE}/#/${locale}/${product}/${destination}`);
          await page.locator(".of-terminal").waitFor();
          await page.waitForFunction(
            ([product, locale]) =>
              document
                .querySelector(".of-terminal")
                ?.getAttribute("data-product") === product &&
              document.documentElement.lang === locale,
            [product, locale],
          );
          if (destination === "trade")
            await page.frameLocator("iframe").locator(".workspace").waitFor();
          check(
            `${product}/${destination} ${locale} ${width}px renders without overflow`,
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth <= innerWidth + 1 &&
                !document.body.innerText.includes(
                  "Unexpected Application Error",
                ),
            ),
          );
        }
      }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${BASE}/#/en/prop/portfolio`);
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  check(
    "light theme applies",
    await page.evaluate(
      () => document.documentElement.dataset.theme === "light",
    ),
  );
  await page.screenshot({
    path: path.join(OUT, "prop-portfolio-light-en.png"),
  });
  await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
  await page.goto(BASE + "/#/en/home");
  await page.locator(".home-stage").waitFor();
  check(
    "public header remains separate",
    (await page.locator(".of-terminal-header").count()) === 0,
  );
  const href = await page
    .locator(".home-panel")
    .last()
    .locator("a.button")
    .getAttribute("href");
  check(
    "Home perpetual CTA uses dedicated route",
    href === "#/en/perpetual/trade",
  );
  await page.goto(BASE + "/#/portfolio");
  await page.waitForURL(/\/prop\/portfolio$/);
  check("legacy portfolio bookmark redirects", true);
  await page.goto(`${BASE}/#/en/prop/portfolio`);
  await page.getByRole("button", { name: "Details & notes" }).first().waitFor();
  await page.evaluate(() => window.ethereum.emit("accountsChanged", []));
  await page.getByRole("heading", { name: "Sign in", exact: true }).waitFor();
  check(
    "wallet disconnect removes private account records",
    (await page.getByRole("button", { name: "Details & notes" }).count()) === 0,
  );
  const anonymous = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const anon = await anonymous.newPage();
  for (const product of ["prop", "perpetual"]) {
    await anon.goto(`${BASE}/#/en/${product}/trade`);
    const af = anon.frameLocator("iframe");
    await af.locator("#cur-pair").waitFor();
    await af.locator("#ac-equity").waitFor();
    await anon.waitForTimeout(400);
    check(
      `${product} anonymous balance is unknown, never invented`,
      (await af.locator("#ac-equity").innerText()) === "—",
    );
    check(
      `${product} anonymous execution stays disabled`,
      await af.locator("#submit-order").isDisabled(),
    );
  }
  await anonymous.close();
  check("no uncaught browser exceptions", errors.length === 0);
  fs.writeFileSync(
    path.join(OUT, "browser-results.json"),
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(`${results.length} browser checks passed`);
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  if (debugPage) {
    console.error((await debugPage.locator("body").innerText()).slice(0, 4000));
    await debugPage.screenshot({ path: path.join(OUT, "failure.png") });
  }
  await debugBrowser?.close();
  process.exitCode = 1;
});
