import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.TEST_FRONTEND_URL || 'http://127.0.0.1:5197';
const live = process.env.CHART_TEST_LIVE === '1';
const output = 'output/playwright/chart-indicators';
fs.mkdirSync(output, { recursive: true });
const fixture = JSON.parse(fs.readFileSync('packages/openfund-charts/test/fixtures/gains-btc-usd.json'));
const names = ['Open Algo V5', 'Price Action Concepts', 'Smart Money Concepts'];
const browser = await chromium.launch({ headless: true });
const results = [], pageErrors = [];
const record = name => { results.push(name); console.log(`PASS ${name}`); };
const waitIndicators = async child => {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const states = await child.evaluate(async () => Promise.all(
      (window.__openfundChart?.chart?.indicators() || []).filter(h => h.source).map(async h => ({
        inputs: h.inputs.length, context: await h.context(['meta']),
      }))));
    if (states.length === 3 && states.every(h => h.inputs > 0 && h.context?.barIndex >= 0)) return;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Original indicators did not produce computed contexts within 60 seconds');
};
const checkBranding = async frame => {
  assert.equal(await frame.locator('.vela-ip-badge').filter({ hasText: /^vela$/i }).count(), 0);
  assert.equal(await frame.locator('.vela-bb-credit:visible,.vela-attribution:visible').count(), 0);
  // The terminal status-bar Vela label was removed at the owner's direction.
  assert.equal(await frame.locator('.chart-notice').count(), 0);
};

let page;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  if (!live) {
    await context.route('https://api.gains.trade/v1/arbitrum/**', async route => {
      const url = route.request().url();
      const data = url.includes('/candles') ? fixture.bars : url.endsWith('/markets')
        ? ['BTC','ETH'].map(base => ({ ...fixture.info, symbol: `${base}/USD`, base, quote: 'USD', group: 'crypto', isOpen: true }))
        : ['BTC','ETH'].map(base => ({ market: `${base}/USD`, mark: fixture.bars.at(-1).close, index: fixture.bars.at(-1).close, updatedAt: Date.now() }));
      await route.fulfill({ json: { data } });
    });
    await context.routeWebSocket('wss://api.gains.trade/**', socket => socket.close());
  }
  page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  for (const product of ['prop','perpetual']) {
    const requests = [];
    const captureRequest = request => { if (request.url().includes('/candles')) requests.push(request.url()); };
    page.on('request', captureRequest);
    await page.goto(`${base}/${product === "perpetual" ? "fa" : "en"}/${product}/trade`);
    let frame = page.frameLocator('iframe.of-trading-workspace');
    await frame.locator('.vela-widget-indicators').waitFor();
    await frame.locator('.vela-widget-indicators').click();
    const rows = frame.locator('[data-library] .vela-ip-name');
    assert.deepEqual((await rows.allTextContents()).slice(0,3), names);
    /* the server's FOOTPRINT_ENABLED flag adds exactly one library row, the
       Footprint overlay; the 80 catalog rows are unchanged either way */
    const footprintOn = await page.evaluate(() => !!(window.__OPENFUND_RUNTIME_CONFIG__ || {}).footprint);
    const rowNames = await rows.allTextContents();
    if (product === 'prop') /* English page; the Persian page localizes the label */
      assert.equal(rowNames.filter(n => n === 'Footprint (Order Flow Overlay)').length, footprintOn ? 1 : 0);
    assert.equal(rowNames.length, 80 + (footprintOn ? 1 : 0));
    await checkBranding(frame);
    record(`${product}: exact catalog order, 77 built-ins and branding`);
    if (live) await page.screenshot({ path: path.join(output, `${product}-catalog.png`) });
    // The manifest offset must not change which built-in a picker index adds.
    await frame.locator('[data-library="3"]').click();
    assert.equal(await frame.locator('[data-instance]').filter({ hasText: '52-Week High/Low' }).count(), 1);
    await frame.locator('[data-instance]').filter({ hasText: '52-Week High/Low' }).locator('.vela-ip-trash').click();
    for (const name of names) {
      const search = frame.locator('.vela-ip-search');
      await search.fill(name);
      assert.equal(await frame.locator('[data-library]').count(), 1);
      await frame.locator('[data-library]').click();
      await search.fill('');
    }
    await frame.getByRole('dialog').press('Escape');
    const getFrame = () => page.frames().find(f => f.parentFrame());
    let child = getFrame();
    await waitIndicators(child);
    assert.deepEqual(await child.evaluate(() => window.__openfundChart.chart.indicators().filter(h => h.source).map(h => h.inputs.length)), [79,49,52]);
    record(`${product}: all three original scripts calculated with complete input schemas`);

    await frame.getByText('Open Algo V5', { exact: true }).filter({ visible: true }).dblclick();
    const settings = frame.getByRole('dialog');
    await settings.waitFor();
    // A real Pine input edit through the existing settings dialog.
    // Numeric Pine inputs are spinbuttons: a native number input on Vela 0.9,
    // Zag's text-based number input with role="spinbutton" on Vela 0.10+.
    const sensitivity = settings.getByRole('spinbutton').first();
    const before = await sensitivity.inputValue();
    await sensitivity.fill(String(Number(before) + 1));
    await sensitivity.press('Tab');
    await settings.press('Escape');
    await child.waitForFunction(() => window.__openfundChart.chart.indicators().filter(h => h.source)[0].inputValues().sigsensiviti === 6);
    record(`${product}: indicator settings input updated through dialog`);

    await child.evaluate(() => {
      window.__chartCommittedInterval = null;
      window.__openfundChart.chart.on('market:changed', event => { window.__chartCommittedInterval = event.timeframe; });
    });

    for (const [tf, interval] of [['5','5m'],['60','1h'],['15','15m'],['1','1m'],['D','1d'],['240','4h'],['30','30m']]) {
      await frame.getByRole('button', { name: /^Timeframe —/ }).click();
      await frame.locator(`[data-vei-id="${tf}"]`).click();
      await child.waitForFunction(tf => window.__chartCommittedInterval === tf, tf);
      await waitIndicators(child);
      assert(requests.some(url => new URL(url).searchParams.get('interval') === interval));
      await frame.getByRole('button', { name: /^Timeframe —/ }).waitFor();
      await checkBranding(frame);
    }
    record(`${product}: seven interval transitions use actual menu clicks and correct candle requests`);
    // Race: rapid API transitions must settle on the final market without remounting.
    await child.evaluate(() => Promise.all(['5','60','1'].map(timeframe => window.__openfundChart.setTimeframe(timeframe))));
    assert.equal(await child.evaluate(() => window.__openfundChart.chart.market.timeframe), '1');
    await frame.locator('.vela-widget-style').click();
    await frame.locator('[data-vei-id="line"]').click();
    await frame.locator('.vela-widget-style').click();
    await frame.locator('[data-vei-id="candles"]').click();
    await frame.getByRole('button', { name: 'Chart settings', exact: true }).first().click();
    await frame.getByRole('dialog').waitFor();
    await frame.getByRole('dialog').press('Escape');
    await frame.locator('#chart-full').click();
    await checkBranding(frame);
    await frame.locator('#chart-full').click();
    record(`${product}: rapid switching, chart style, fullscreen notice and chart settings remain interactive`);

    await frame.locator('#market-select-btn').click();
    await frame.locator('#market-search').fill('ETH/USD');
    await frame.locator('#market-dd-list li').filter({ hasText: 'ETH/USD' }).first().click();
    await child.waitForFunction(() => window.__openfundChart.chart.market.symbol === 'gains:ETH/USD');
    assert.equal(await frame.locator('#cur-pair').textContent(), 'ETH/USD');
    record(`${product}: symbol picker changes both chart and terminal state`);

    await page.reload();
    await frame.locator('.vela-widget-indicators').waitFor();
    child = getFrame();
    await waitIndicators(child);
    assert.equal(await child.evaluate(() => window.__openfundChart.chart.indicators().filter(h => h.source)[0].inputValues().sigsensiviti), 6);
    assert.equal(await child.evaluate(() => window.__openfundChart.chart.market.symbol), 'gains:ETH/USD');
    assert.equal(await frame.locator('#cur-pair').textContent(), 'ETH/USD');
    await checkBranding(frame);
    if (live) await page.screenshot({ path: path.join(output, `${product}-active.png`) });
    record(`${product}: source indicators, edited settings and branding survive reload`);

    await frame.locator('.vela-widget-indicators').click();
    await frame.locator('[data-instance]').filter({ hasText: 'Price Action Concepts' }).locator('.vela-ip-trash').click();
    assert.equal(await child.evaluate(() => window.__openfundChart.chart.indicators().filter(h => h.source).length), 2);
    await checkBranding(frame);
    await frame.getByRole('dialog').press('Escape');
    record(`${product}: remove proprietary indicator through dialog`);
    page.off('request', captureRequest);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const frame = page.frameLocator('iframe.of-trading-workspace');
  await frame.locator('.vela-mobilebar').waitFor();
  const mobileChild = page.frames().find(f => f.parentFrame());
  await mobileChild.evaluate(() => {
    window.__chartCommittedInterval = null;
    window.__openfundChart.chart.on('market:changed', event => { window.__chartCommittedInterval = event.timeframe; });
  });
  await frame.getByRole('button', { name: 'Timeframe', exact: true }).filter({ visible: true }).click();
  await frame.locator('.vela-tfd-grid button').filter({ hasText: /^5m$/ }).click();
  await mobileChild.waitForFunction(() => window.__chartCommittedInterval === '5');
  await frame.locator('#chart-msg').waitFor({ state: 'hidden' });
  await frame.getByRole('button', { name: 'Indicators', exact: true }).filter({ visible: true }).click();
  assert.deepEqual((await frame.locator('[data-library] .vela-ip-name').allTextContents()).slice(0,3), names);
  await frame.getByRole('dialog').press('Escape');
  await frame.getByRole('button', { name: 'Chart settings', exact: true }).filter({ visible: true }).click();
  await frame.getByRole('dialog').waitFor();
  await frame.getByRole('dialog').press('Escape');
  await frame.locator('.workspace').evaluate(el => { el.scrollTop = 0; });
  if (live) await page.screenshot({ path: path.join(output, 'mobile.png') });
  assert.equal(pageErrors.length, 0, pageErrors.join('\n'));
  record('responsive indicator/settings dialogs and no uncaught page errors');
} catch (error) {
  await page?.screenshot({ path: path.join(output, 'failure.png') });
  if (page) fs.writeFileSync(path.join(output, 'failure.txt'), JSON.stringify({frames: page.frames().map(f => f.url()), pageErrors, body: await page.locator('body').innerText(), child: await page.frames().find(f => f.parentFrame())?.locator('body').innerText()},null,2));
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ live, base, capturedAt: new Date().toISOString(), results, pageErrors }, null, 2));
  await browser.close();
}
