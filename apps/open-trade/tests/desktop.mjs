import { _electron as electron } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
await mkdir("artifacts", { recursive: true });
const started = Date.now();
const userData = await mkdtemp(path.join(tmpdir(), "open-trade-test-"));
const app = await electron.launch({
  args: [".", `--user-data-dir=${userData}`],
  env: {
    ...process.env,
    OPEN_TRADE_BACKEND:
      process.env.OPEN_TRADE_BACKEND || "https://openfi.cloud",
  },
});
const page = await app.firstWindow();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.log("renderer:", m.text().slice(0, 400));
});
try {
  await page
    .getByRole("button", { name: "Explore charts", exact: true })
    .waitFor();
  const startupMs = Date.now() - started;
  await page.screenshot({ path: "artifacts/startup.png" });
  assert.equal(await page.evaluate(() => typeof window.require), "undefined");
  const prefs = await app.evaluate(({ BrowserWindow }) => {
    const p =
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      sandbox: p.sandbox,
      nodeIntegration: p.nodeIntegration,
      contextIsolation: p.contextIsolation,
    };
  });
  assert.deepEqual(prefs, {
    sandbox: true,
    nodeIntegration: false,
    contextIsolation: true,
  });
  await page
    .getByRole("button", { name: "Explore charts", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector(".chart-cell")?.getAttribute("data-loaded-bars"),
      ) > 100,
    null,
    { timeout: 45000 },
  );
  await page.waitForTimeout(350);
  assert.ok((await page.locator(".titlebar").boundingBox()).height <= 40);
  assert.ok((await page.locator(".positions").boundingBox()).height <= 36);
  await page.screenshot({ path: "artifacts/chart.png" });
  await page
    .getByRole("button", { name: "2 chart layout", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll(".chart-cell")].length === 2 &&
      [...document.querySelectorAll(".chart-cell")].every(
        (c) => Number(c.getAttribute("data-loaded-bars")) > 100,
      ),
    null,
    { timeout: 45000 },
  );
  await page.screenshot({ path: "artifacts/two-charts.png" });
  await page
    .getByRole("button", { name: "4 chart layout", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll(".chart-cell")].length === 4 &&
      [...document.querySelectorAll(".chart-cell")].every(
        (c) => Number(c.getAttribute("data-loaded-bars")) > 100,
      ),
    null,
    { timeout: 45000 },
  );
  await page.screenshot({ path: "artifacts/four-charts.png" });
  await page.getByRole("button", { name: "3 chart layout", exact: true }).click();
  await page.locator(".layout-3").waitFor();
  assert.equal(await page.locator(".layout-3 .chart-cell").count(), 3);
  await page.screenshot({ path: "artifacts/three-charts.png" });
  await page.getByRole("button", { name: "Capture chart" }).click();
  const capture = page.getByRole("dialog", { name: "Chart capture preview" });
  await capture.getByRole("img").waitFor();
  assert.ok((await capture.getByRole("img").getAttribute("src")).startsWith("data:image/png;"));
  await capture.getByRole("button", { name: "Close preview" }).click();
  await page
    .getByRole("button", { name: "1 chart layout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle watchlist", exact: true })
    .click();
  await page.screenshot({ path: "artifacts/watchlist-ticket.png" });
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .first()
    .click();
  await page.screenshot({ path: "artifacts/settings-glass.png" });
  await page.getByRole("dialog").locator("select").first().selectOption("light");
  await page.screenshot({ path: "artifacts/settings-light.png" });
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1000, 720),
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.getByRole("dialog").locator("select").first().selectOption("dark");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "×", exact: true })
    .click();
  if (process.env.TEST_BACKEND_URL) {
    await page.reload();
    await page
      .getByRole("button", { name: "Explore charts", exact: true })
      .waitFor();
    await (
      await import("./account-acceptance.mjs")
    ).accountAcceptance(page, process.env.TEST_BACKEND_URL);
  }
  await page.screenshot({ path: "artifacts/resized.png" });
  await page.getByRole('button', {name:'Toggle positions',exact:true}).click();
  assert.ok((await page.locator('.positions').boundingBox()).height > 100);
  await page.getByRole('button', {name:'Toggle positions',exact:true}).click();
  await page.getByRole('button', {name:'Dock order ticket',exact:true}).click();
  assert.equal(await page.locator('.ticket.docked').count(),1);
  await page.getByRole('button', {name:'Dock order ticket',exact:true}).click();
  await page.keyboard.press('Alt+t');
  assert.equal(await page.locator('.ticket').count(),0);
  await page.keyboard.press('Alt+t');
  assert.equal(await page.locator('.ticket.floating').count(),1);
  await page.locator('.workspace-bar').click({button:'right'});
  await page.getByRole('menu').waitFor();await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('menu').count(),0);
  const metrics = await app.evaluate(({ app }) =>
    app
      .getAppMetrics()
      .map((p) => ({
        type: p.type,
        cpu: p.cpu.percentCPUUsage,
        memory: p.memory.workingSetSize,
      })),
  );
  await writeFile(
    "artifacts/measurements.json",
    JSON.stringify({ startupMs, metrics, errors }, null, 2),
  );
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ startupMs, metrics, errors }));
} finally {
  await app.close();
}
