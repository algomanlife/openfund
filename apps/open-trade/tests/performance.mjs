/* Performance baseline for Open Trade on a real desktop OS.
 *   npm run build && OPEN_TRADE_PERF_MINUTES=30 npm run test:performance
 * Records (no pass/fail thresholds until a baseline exists — ACCEPTANCE.md):
 *   coldStartMs        launch → startup UI visible (fresh profile)
 *   warmStartMs        second launch with the same profile
 *   firstChartMs       Explore charts → first pane with > 100 real bars
 *   layoutSwitchMs     each 1/2/3/4 layout switch until every pane has bars
 *   memory[]           app.getAppMetrics() working set, sampled every 30 s
 *   idleCpuPercent     mean CPU over the last idle minute (no interaction)
 *   repeatedLayoutMiB  working set after 20 layout cycles
 * Output: artifacts/performance.json. Uses live Gains market data, so run it
 * on a stable network and record the network in the report. */
import { _electron as electron } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir, cpus, totalmem, release, platform, arch } from "node:os";
import path from "node:path";

const minutes = Math.max(1, Number(process.env.OPEN_TRADE_PERF_MINUTES || 5));
await mkdir("artifacts", { recursive: true });
const profile = await mkdtemp(path.join(tmpdir(), "open-trade-perf-"));
const report = {
  version: JSON.parse(await (await import("node:fs/promises")).readFile("package.json", "utf8")).version,
  host: { platform: platform(), arch: arch(), release: release(), cpus: cpus().length, totalMemMiB: Math.round(totalmem() / 2 ** 20) },
  minutes,
  startedAt: new Date().toISOString(),
};
const mib = (metrics) => Math.round(metrics.reduce((s, m) => s + (m.memory?.workingSetSize || 0), 0) / 1024);
const bars = (page, count) =>
  page.waitForFunction(
    (n) => {
      const cells = [...document.querySelectorAll(".chart-cell:not([hidden])")];
      return cells.length >= n && cells.every((c) => Number(c.getAttribute("data-loaded-bars")) > 100);
    },
    count,
    { timeout: 60000 },
  );

async function launch() {
  const t0 = Date.now();
  const app = await electron.launch({ args: [".", `--user-data-dir=${profile}`] });
  const page = await app.firstWindow();
  await page.locator(".launch").waitFor({ timeout: 30000 });
  return { app, page, ms: Date.now() - t0 };
}

let { app, page, ms } = await launch();
report.coldStartMs = ms;
await app.close();
({ app, page, ms } = await launch());
report.warmStartMs = ms;

let t = Date.now();
await page.locator(".launch-actions button").first().click();
await bars(page, 1);
report.firstChartMs = Date.now() - t;

report.layoutSwitchMs = {};
for (const n of [2, 3, 4, 1]) {
  t = Date.now();
  await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+${n}`);
  await bars(page, n);
  report.layoutSwitchMs[n] = Date.now() - t;
}
for (let i = 0; i < 20; i++) {
  await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+${(i % 4) + 1}`);
  await page.waitForTimeout(250);
}
await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+4`);
await bars(page, 4);
report.repeatedLayoutMiB = mib(await app.evaluate(({ app }) => app.getAppMetrics()));

report.memory = [];
const end = Date.now() + minutes * 60_000;
while (Date.now() < end) {
  const metrics = await app.evaluate(({ app }) => app.getAppMetrics());
  report.memory.push({ atSec: Math.round((Date.now() - (end - minutes * 60_000)) / 1000), workingSetMiB: mib(metrics) });
  await page.waitForTimeout(30_000);
}
const cpu = [];
for (let i = 0; i < 12; i++) {
  const metrics = await app.evaluate(({ app }) => app.getAppMetrics());
  cpu.push(metrics.reduce((s, m) => s + (m.cpu?.percentCPUUsage || 0), 0));
  await page.waitForTimeout(5000);
}
report.idleCpuPercent = Math.round((cpu.reduce((a, b) => a + b, 0) / cpu.length) * 10) / 10;
await page.screenshot({ path: "artifacts/performance-four-charts.png" });
await app.close();
report.finishedAt = new Date().toISOString();
await writeFile("artifacts/performance.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
