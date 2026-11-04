/* Native theme paint regression: actual Chromium auto-dark, OS preferences,
 * real theme clicks, renderer persistence and same-origin nested workspace.
 * No financial fixtures, CSS overlays, page recoloring or browser-profile edits. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080/react').replace(/\/$/, '');
const OUT = path.resolve(process.env.AUTO_DARK_OUTPUT || 'output/playwright/auto-dark');
async function runAutoDark() {
  fs.mkdirSync(OUT, { recursive: true });
  const results = [], errors = [];
  const browser = await chromium.launch({ args: ['--enable-features=WebContentsForceDark'] });
  async function paint(page, points) {
    const png = (await page.screenshot({ animations: 'disabled', scale: 'css' })).toString('base64');
    return page.evaluate(async ({ png, points }) => {
      const image = new Image(); image.src = 'data:image/png;base64,' + png; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      return points.map(point => ({ ...point, rgba: [...ctx.getImageData(point.x, point.y, 1, 1).data] }));
    }, { png, points });
  }
  async function capture(page, label, theme, trade = false) {
    await page.waitForTimeout(750);
    const state = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, stored: localStorage.getItem('of-theme'), scheme: getComputedStyle(document.documentElement).colorScheme, body: getComputedStyle(document.body).backgroundColor, height: document.documentElement.scrollHeight }));
    assert.equal(state.theme, theme); assert.equal(state.stored, theme);
    assert.equal(state.body, theme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(6, 8, 8)');
    if (theme === 'light') assert.match(state.scheme, /only/);
    let points = [{ x: 4, y: 200 }, { x: 3355, y: 500 }], chart;
    if (trade) {
      const frame = page.frames().find(frame => frame.parentFrame());
      await frame.waitForFunction(() => !!window.__openfundChart?.chart);
      await frame.evaluate(() => window.__openfundChart.chart.ready());
      await frame.waitForFunction(theme => window.__openfundChart.chart.renderer.getConfig().layout.background.toLowerCase() === (theme === 'light' ? '#ffffff' : '#060808'), theme);
      chart = await frame.evaluate(() => ({ scheme: getComputedStyle(document.documentElement).colorScheme, layout: window.__openfundChart.chart.renderer.getConfig().layout, saved: JSON.parse(localStorage.getItem('of-vela-config') || 'null') }));
      if (theme === 'light') assert.match(chart.scheme, /only/);
      // Real screenshot pixels from the plot, not getImageData on the source canvas.
      const frameRect = await page.locator('iframe').boundingBox();
      const rect = await frame.locator('canvas').first().boundingBox();
      assert.ok(frameRect && rect);
      points = [{ x: Math.round(rect.x + 100), y: Math.round(rect.y + 170) }, { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + 170) }];
    }
    const pixels = await paint(page, points);
    for (const pixel of pixels) {
      if (theme === 'light' || trade) assert.deepEqual(pixel.rgba, [...(theme === 'light' ? [255, 255, 255] : [6, 8, 8]), 255], label + ' screenshot paint');
      else assert.ok(pixel.rgba.slice(0, 3).every(value => value < 30) && pixel.rgba[3] === 255, label + ' preserved dark atmosphere');
    }
    const file = path.join(OUT, label + '.png');
    await page.screenshot({ path: file, fullPage: !trade, animations: 'disabled', scale: 'css' });
    results.push({ label, state, chart, pixels, file });
  }
  try {
    // Prove the emulation actually transforms white paint, avoiding false passes
    // from launch feature names silently ignored by newer browser versions.
    const probe = await browser.newPage({ colorScheme: 'dark' });
    const probeCDP = await probe.context().newCDPSession(probe);
    await probeCDP.send('Emulation.setAutoDarkModeOverride', { enabled: true });
    await probe.setContent('<style>body{margin:0;background:#fff;color:#111}</style>Auto-dark probe');
    const recolored = await paint(probe, [{ x: 4, y: 100 }]);
    assert.equal(await probe.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(255, 255, 255)');
    assert.deepEqual(recolored[0].rgba, [18, 18, 18, 255]);
    await probe.setContent('<style>html{color-scheme:only light}body{margin:0;background:#fff;color:#111}</style>Opt-out probe');
    assert.deepEqual((await paint(probe, [{ x: 4, y: 100 }]))[0].rgba, [255, 255, 255, 255]);
    results.push({ label: 'emulation-proven', computedWhitePaintDark: recolored });
    await probe.close();
    // Auto-dark models a dark browser preference. Forcing CDP auto-dark while
    // independently emulating light OS preference ignores even only-light in a
    // standalone white document; that contradictory override is not UA support.
    for (const [autoDark, os] of [[false, 'light'], [false, 'dark'], [true, 'dark']]) {
      const context = await browser.newContext({ viewport: { width: 3360, height: 1216 }, colorScheme: os });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setAutoDarkModeOverride', { enabled: autoDark });
      // The renderer fixture represents genuine previously saved cosmetics;
      // the user may keep these settings, but they must not pin app-owned colors.
      await context.addInitScript(() => {
        if (!localStorage.getItem('of-vela-config')) localStorage.setItem('of-vela-config', JSON.stringify({ layout: { background: '#111111', textColor: '#eeeeee', fontSize: 13 } }));
      });
      const prefix = `${autoDark ? 'auto-dark' : 'normal'}-os-${os}`;
      const toggle = () => page.locator('#theme-toggle,button[aria-label="Toggle theme"],button[aria-label="تغییر پوسته"]').first();
      for (const route of ['en/home', 'fa/home', 'en/prop/trade', 'fa/perpetual/trade']) {
        const tag = route.replaceAll('/', '-'), trade = route.includes('trade');
        await page.goto(BASE + '/#/' + route); await toggle().waitFor();
        if (await page.locator('html').getAttribute('data-theme') !== 'light') await toggle().click();
        await capture(page, `${prefix}-${tag}-light`, 'light', trade);
        if (route === 'fa/home') assert.equal(await page.locator('footer').count(), 0);
        await page.reload(); await toggle().waitFor();
        await capture(page, `${prefix}-${tag}-reload-light`, 'light', trade);
        await toggle().click();
        await capture(page, `${prefix}-${tag}-dark`, 'dark', trade);
      }
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log(`PASS ${results.length} auto-dark paint scenarios`);
    return results.length;
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ base: BASE, results, errors, capturedAt: new Date().toISOString() }, null, 2));
  }
}
module.exports = { runAutoDark };
if (require.main === module) runAutoDark().catch(e => { console.error(e); process.exitCode = 1; });
