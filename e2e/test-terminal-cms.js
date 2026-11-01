/* Existing Directus integration: temporary editorial records only; always cleaned up. */
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE || "playwright-core",
);
const fs = require("node:fs"),
  path = require("node:path");
const CMS = process.env.DIRECTUS_URL || "http://localhost:8055",
  BASE = process.env.TEST_FRONTEND_URL || "http://localhost:5186/react";
let token, section, browser;
const results = [],
  check = (name, ok) => {
    results.push({ name, ok });
    console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
    if (!ok) throw new Error(name);
  };
async function cms(method, route, body, admin = true) {
  const r = await fetch(CMS + route, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(admin && token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
}
(async () => {
  token = (
    await cms("POST", "/auth/login", {
      email: process.env.DIRECTUS_ADMIN_EMAIL || "admin@openfund.dev",
      password: process.env.DIRECTUS_ADMIN_PASSWORD || "openfund-admin-2026",
    })
  ).data.access_token;
  const suffix = Date.now().toString(),
    key = "verify-terminal-" + suffix;
  section = (
    await cms("POST", "/items/terminal_sections", {
      product: "prop",
      page: "portfolio",
      section_key: key,
      status: "draft",
      sort: -1,
      support_url: "https://github.com/algomanlife/openfund",
      translations: [
        {
          language_code: "fa",
          title: "بررسی انتشار " + suffix,
          body: "محتوای موقت آزمون.",
        },
        {
          language_code: "en",
          title: "Publication check " + suffix,
          body: "Temporary verification content.",
        },
      ],
    })
  ).data;
  check("editor can create bilingual draft", !!section.id);
  check(
    "draft section not publicly readable",
    (
      await cms(
        "GET",
        `/items/terminal_sections?filter[id][_eq]=${section.id}`,
        undefined,
        false,
      )
    ).data.length === 0,
  );
  check(
    "draft translations not publicly readable",
    (
      await cms(
        "GET",
        `/items/terminal_section_translations?filter[section_id][_eq]=${section.id}`,
        undefined,
        false,
      )
    ).data.length === 0,
  );
  check(
    "anonymous editorial writes denied",
    (
      await cms(
        "POST",
        "/items/terminal_sections",
        { status: "published" },
        false,
      )
    ).status === 403,
  );
  check(
    "private financial table not publicly readable",
    (await cms("GET", "/items/demo_accounts", undefined, false)).status === 403,
  );
  check(
    "private journal not publicly readable",
    (await cms("GET", "/items/journal_entries", undefined, false)).status ===
      403,
  );
  await cms("PATCH", "/items/terminal_sections/" + section.id, {
    status: "published",
  });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
  });
  const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    }),
    authHeaders = [];
  page.on("request", (r) => {
    if (r.url().startsWith(CMS) && r.headers().authorization)
      authHeaders.push(r.url());
  });
  await page.goto(BASE + "/#/en/prop/portfolio");
  await page
    .getByRole("heading", { name: "Publication check " + suffix, exact: true })
    .waitFor({ timeout: 15000 });
  check("published terminal content renders", true);
  await page.evaluate(() => (window.cmsSentinel = "same-document"));
  const full = (
    await cms(
      "GET",
      `/items/terminal_sections/${section.id}?fields=translations.id,translations.language_code`,
    )
  ).data;
  const tr = full.translations.find((t) => t.language_code === "en");
  await cms("PATCH", "/items/terminal_section_translations/" + tr.id, {
    title: "Live CMS update " + suffix,
    body: "Updated without rebuilding the frontend.",
  });
  await page
    .getByRole("heading", { name: "Live CMS update " + suffix, exact: true })
    .waitFor({ timeout: 45000 });
  check(
    "CMS edit appears on open page without rebuild",
    await page.evaluate(() => window.cmsSentinel === "same-document"),
  );
  await cms("PATCH", "/items/terminal_sections/" + section.id, {
    status: "draft",
  });
  await page
    .getByRole("heading", { name: "Live CMS update " + suffix, exact: true })
    .waitFor({ state: "detached", timeout: 45000 });
  check("unpublishing removes content on open page", true);
  check("frontend never sends admin token", authHeaders.length === 0);
  await page.screenshot({
    path: path.resolve(__dirname, "../output/playwright/cms-unpublished.png"),
  });
  fs.writeFileSync(
    path.resolve(__dirname, "../output/playwright/cms-results.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(`${results.length} CMS checks passed`);
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (section) {
      const full = (
        await cms(
          "GET",
          `/items/terminal_sections/${section.id}?fields=translations.id`,
        )
      ).data;
      for (const tr of full?.translations || [])
        await cms("DELETE", "/items/terminal_section_translations/" + tr.id);
      await cms("DELETE", "/items/terminal_sections/" + section.id);
    }
    await browser?.close();
  });
