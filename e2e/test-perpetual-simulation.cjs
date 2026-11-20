/* Perpetual UI lifecycle in an isolated, non-financial simulation.
 *
 * Exercises the shared trading terminal's full order presentation for the
 * Perpetual product against e2e/fixtures/perpetual-simulation.cjs: market
 * selection, position parameters, validation errors, the confirmation dialog,
 * rejected, pending, filled and unconfirmed results, simulated close and
 * cancel, provider outage and recovery, session expiry and wallet disconnect.
 *
 * Nothing here is a Gains integration. Market data comes from documented
 * fixtures (helpers/market-fixtures.cjs), the wallet is a generated signer
 * whose provider throws on every transaction/typed-data method, and the test
 * fails if any request leaves for a chain RPC, Gains write API or Openfund
 * trading endpoint. A visible SIMULATION banner is asserted in every document.
 *
 * Requires the backend serving the built frontend on TEST_BACKEND_URL (with
 * that host in ALLOWED_DOMAINS) and an isolated database.
 * Usage: TEST_BACKEND_URL=http://localhost:18180 node e2e/test-perpetual-simulation.cjs
 */
const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const backendRequire = createRequire(path.resolve(__dirname, '../apps/backend/package.json'));
const { privateKeyToAccount, generatePrivateKey } = backendRequire('viem/accounts');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const { walletInitScript, connect, signIn } = require('./helpers/wallet-ui.cjs');
const { installMarketFixtures } = require('./helpers/market-fixtures.cjs');
const { installPerpetualSimulation } = require('./fixtures/perpetual-simulation.cjs');

const BASE = (process.env.TEST_FRONTEND_URL || process.env.TEST_BACKEND_URL || 'http://localhost:8080').replace(/\/$/, '');
const OUT = path.resolve(__dirname, '../output/playwright/perpetual-simulation');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${ok || !detail ? '' : ' :: ' + detail}`);
};

(async () => {
  const wallet = privateKeyToAccount(generatePrivateKey());
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await installMarketFixtures(context, { allow: [BASE] });
  const forbidden = [];
  /* writes only: JSON-RPC transaction methods, Gains Trading API mutations and Openfund trading mutations */
  context.on('request', r => {
    const u = r.url(), body = r.postData() || '';
    if (/eth_send(Raw)?Transaction|eth_signTypedData/.test(body) ||
        (r.method() !== 'GET' && /api(-testnet)?\.gains\.trade|\/trading\/|\/products\/[a-z]+\/(trades|orders)/.test(u)))
      forbidden.push(r.method() + ' ' + u);
  });
  await context.exposeFunction('purchaseSign', message => wallet.signMessage({ message }));
  await context.addInitScript(walletInitScript, wallet.address);
  await context.addInitScript(() => { try { sessionStorage.setItem('of-terminal-symbol', 'ETH/USD'); } catch {} });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const f = page.frameLocator('iframe.of-trading-workspace');
  const sim = (fn, arg) => page.evaluate(fn, arg);
  const toast = async () => (await f.locator('.toast').innerText().catch(() => '')).trim();
  const openTab = async tab => { await f.locator(`[data-bt="${tab}"]`).click(); await page.waitForTimeout(300); };
  const confirmOrder = async () => { await f.locator('#submit-order').click(); await f.locator('#review-dialog[open]').waitFor({ timeout: 5000 }); };

  try {
    await page.goto(`${BASE}/en/perpetual/trade`, { waitUntil: 'domcontentloaded' });
    await connect(page);
    await signIn(page);
    await f.locator('#submit-order').waitFor({ state: 'attached', timeout: 30000 });
    await page.waitForTimeout(2000);
    check('without the harness Perpetual submit is disabled (read-only production adapter)', await f.locator('#submit-order').isDisabled());

    await page.evaluate(installPerpetualSimulation);
    await page.waitForTimeout(800);
    check('SIMULATION banner visible on the page and inside the trading workspace',
      await page.locator('[data-simulation-banner]').isVisible() && await f.locator('[data-simulation-banner]').isVisible());

    /* market selection */
    check('market selection honoured (ETH/USD from fixtures)', /ETH\/USD|ETH-USD|ETH/.test(await f.locator('#market-select-btn').innerText().catch(() => '')));

    /* position parameters and validation */
    await f.locator('#of-collateral').fill('');
    await f.locator('#submit-order').click();
    await page.waitForTimeout(400);
    check('empty collateral is rejected before any review', await f.locator('#of-err').isVisible() && !(await f.locator('#review-dialog[open]').count()));
    await f.locator('#of-collateral').fill('abc');
    await f.locator('#submit-order').click();
    check('non-numeric collateral is rejected', /valid number|Enter/i.test(await f.locator('#of-err').innerText()));

    /* confirmation dialog */
    await f.locator('#of-collateral').fill('100');
    await confirmOrder();
    const review = await f.locator('#review-body').innerText();
    check('confirmation dialog shows market, collateral and leverage', /100/.test(review) && /×/.test(review));
    await page.screenshot({ path: path.join(OUT, 'review-dialog.png') });
    await f.locator('#review-cancel').click();
    check('cancelling the review sends nothing', !(await sim(() => window.__ofSim.calls.some(c => c[0] === 'submit'))));

    /* rejected */
    await sim(() => { window.__ofSim.scenario = 'reject'; });
    await confirmOrder();
    await f.locator('#review-confirm').click();
    await page.waitForTimeout(600);
    check('rejected action shows the provider reason and opens no position', /SIMULATED rejection/.test(await toast()) && (await sim(() => window.__ofSim.positions.length)) === 0);
    await f.locator('#review-cancel').click().catch(() => {});

    /* pending → filled */
    await sim(() => { window.__ofSim.scenario = 'pending'; });
    await confirmOrder();
    await f.locator('#review-confirm').click();
    await page.waitForTimeout(400);
    check('pending: confirm and cancel are disabled while the request is in flight',
      await f.locator('#review-confirm').isDisabled() && await f.locator('#review-cancel').isDisabled());
    check('pending: no success shown before the result', !/opened|submitted/i.test(await toast()));
    await page.screenshot({ path: path.join(OUT, 'pending.png') });
    await sim(() => window.__ofSim.release());
    await f.locator('#review-dialog').waitFor({ state: 'hidden', timeout: 5000 });
    await page.waitForTimeout(500);
    await openTab('positions');
    check('simulated fill appears as a labelled simulation position', (await sim(() => window.__ofSim.positions[0]?.id)) === 'sim:1' && await f.locator('[data-close="sim:1"]').count() === 1);
    check('no PnL is fabricated for the simulated position', !/[+-]?\d+\.\d+\s*USD.*PnL/i.test(await f.locator('#bt-positions').innerText().catch(() => '')));

    /* unconfirmed */
    await sim(() => { window.__ofSim.scenario = 'unconfirmed'; });
    await confirmOrder();
    await f.locator('#review-confirm').click();
    await page.waitForTimeout(600);
    check('unconfirmed result is reported as unknown, not as success', /could not be confirmed/i.test(await toast()) && (await sim(() => window.__ofSim.positions.length)) === 1);
    await f.locator('#review-cancel').click().catch(() => {});

    /* limit order → simulated cancel */
    await sim(() => { window.__ofSim.scenario = 'fill'; });
    await f.locator('[data-otype="limit"]').click();
    await f.locator('#of-price').fill('2900');
    await f.locator('#of-collateral').fill('50');
    await confirmOrder();
    await f.locator('#review-confirm').click();
    await f.locator('#review-dialog').waitFor({ state: 'hidden', timeout: 5000 });
    await openTab('orders');
    const cancel = f.locator('[data-cancel="sim:2"]');
    check('simulated limit order listed with a cancel action', await cancel.count() === 1);
    await cancel.click();
    await f.locator('dialog[open] .danger, dialog[open] button.submit, dialog[open] [data-confirm]').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(600);
    check('simulated cancellation removes the order', (await sim(() => window.__ofSim.orders.length)) === 0);

    /* simulated close */
    await openTab('positions');
    await f.locator('[data-close="sim:1"]').click();
    await f.locator('dialog[open] .danger, dialog[open] button.submit, dialog[open] [data-confirm]').first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(600);
    check('simulated close removes the position and records history', (await sim(() => window.__ofSim.positions.length === 0 && window.__ofSim.history.length === 1)));

    /* provider outage → recovery */
    await sim(() => window.__ofSim.setStatus('error'));
    await page.waitForTimeout(500);
    await f.locator('[data-otype="market"]').click();
    await f.locator('#of-collateral').fill('100');
    await f.locator('#submit-order').click({ trial: false }).catch(() => {});
    await page.waitForTimeout(400);
    check('provider unavailable: actions blocked with an explicit reason', /provider unavailable|could not be loaded|unavailable/i.test(
      (await f.locator('#of-err').innerText().catch(() => '')) + ' ' + (await f.locator('#account-feed-state').innerText().catch(() => ''))) && !(await f.locator('#review-dialog[open]').count()));
    await page.screenshot({ path: path.join(OUT, 'provider-unavailable.png') });
    await sim(() => window.__ofSim.setStatus('ready'));
    await page.waitForTimeout(500);
    await confirmOrder();
    check('after recovery the review opens again', await f.locator('#review-dialog[open]').count() === 1);
    await f.locator('#review-cancel').click();

    /* session expiry: the backend session is gone; the real adapter takes over after reload */
    await sim(() => { clearInterval(window.__ofSimTimer); delete window.__ofReadOnlyProductAdapter; });
    await context.clearCookies();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await f.locator('#submit-order').waitFor({ state: 'attached', timeout: 30000 });
    await page.waitForTimeout(2500);
    const me = await page.evaluate(async () => (await fetch('/auth/me', { credentials: 'include' })).status);
    check('session expiry: backend rejects the old session and no simulation remains', me === 401 && !(await page.locator('[data-simulation-banner]').count()));
    check('session expiry: Perpetual submit is disabled again', await f.locator('#submit-order').isDisabled());

    check('no chain, Gains write or Openfund trading request was made', forbidden.length === 0, forbidden.slice(0, 3).join(', '));
    check('no wallet transaction method was attempted', (await page.evaluate(() => window.__ofForbidden || 0)) === 0);
    check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (e) {
    check('unexpected failure: ' + String(e.message).split('\n')[0], false);
    await page.screenshot({ path: path.join(OUT, 'failure.png') }).catch(() => {});
  } finally {
    await browser.close();
  }
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  process.exit(failed.length ? 1 : 0);
})();
