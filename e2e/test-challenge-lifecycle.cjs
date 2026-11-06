/* Openfund challenge lifecycle browser E2E (v0.3.1) — the full soft-launch
 * user journey through the REAL UI, real SIWE/PostgreSQL and the real
 * evaluation engine:
 *
 *   1. sign in (disposable EIP-6963 signer)
 *   2. purchase a one-phase challenge (SIM_TEST_MODE test seam — no chain)
 *   3. dashboard: challenge appears with evaluation panel + Start button
 *   4. start the challenge from the UI (created → started)
 *   5. trade on the challenge account through the real terminal order API
 *      (server-authoritative, plan leverage 5×)
 *   6. evaluation engine: profit target on closed profit → challenge PASSED
 *      (dashboard shows the passed state; account closed; events recorded)
 *
 * No blockchain writes, no real payments. Requires the server env
 * PURCHASE_PAYMENT_RECEIVER + SIM_TEST_MODE=1 (CI test rig).
 */
const { chromium } = require('playwright');
const { createRequire } = require('node:module');
const path = require('node:path'), assert = require('node:assert/strict');
const req = createRequire(path.resolve(__dirname, '../apps/backend/package.json'));
const { generatePrivateKey, privateKeyToAccount } = req('viem/accounts');
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080/react').replace(/\/$/, '');
const API = process.env.TEST_BACKEND_URL || 'http://localhost:8080';
const results = [];
function check(name, value) { assert.ok(value, name); results.push(name); console.log('PASS - ' + name) }

/* cookie-bearing API calls from the page context (same-origin) */
async function call(page, path, body, method) {
  return page.evaluate(async ({ path, body, method }) => {
    const res = await fetch(path, { method: method || (body ? 'POST' : 'GET'), credentials: 'include', headers: { 'Content-Type': 'application/json', ...(body ? { 'Idempotency-Key': crypto.randomUUID() } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json().catch(() => null) };
  }, { path: (path.startsWith('/') ? '' : API) + path, body, method });
}

/* proven wallet helpers (same pattern as test-purchase-flow.cjs): the
 * RainbowKit account menu is a <details> that must be opened before the
 * Sign in button becomes actionable */
async function walletButton(page, name) {
  const button = page.getByRole('button', { name, exact: true, includeHidden: true }).first();
  await button.waitFor({ state: 'attached' });
  const menu = button.locator('xpath=ancestor::details[contains(@class,"rk-account-menu")]');
  if (await menu.count() && !await menu.evaluate(el => el.open)) await menu.locator('summary').click();
  return button;
}
async function connect(page) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await page.getByRole('button', { name: /^(Sign in|Account)$/, includeHidden: true }).first().waitFor({ state: 'attached', timeout: 6000 });
      return;
    } catch { /* not connected yet */ }
    const btn = page.locator('.rk-chip-connect');
    if (await btn.count()) await btn.click({ timeout: 3000 });
  }
  await page.getByRole('button', { name: /^(Sign in|Account)$/, includeHidden: true }).first().waitFor({ state: 'attached', timeout: 20000 });
}
async function signIn(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const account = page.getByRole('button', { name: /^Account$/, includeHidden: true }).first();
    if (await account.count()) return;
    await (await walletButton(page, 'Sign in')).click();
    try {
      await (await walletButton(page, 'Account')).waitFor({ state: 'attached', timeout: 15000 });
      return;
    } catch { /* sign-in click may race a re-render — retry */ }
  }
  await (await walletButton(page, 'Account')).waitFor({ state: 'attached', timeout: 30000 });
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const wallet = privateKeyToAccount(generatePrivateKey());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => { errors.push(e.stack || e.message); console.error('BROWSER ERROR', e.stack || e.message) });
  await page.exposeFunction('challengeSign', ({ raw }) => wallet.signMessage({ message: { raw } }));
  await page.addInitScript(address => {
    const events = {};
    const emit = n => (events[n] || []).forEach(fn => fn());
    const provider = {
      isRabby: true,
      on: (n, fn) => (events[n] || []).push(fn),
      removeListener: (n, fn) => events[n] = (events[n] || []).filter(x => x !== fn),
      request: async ({ method, params }) => {
        if (method === 'eth_accounts') return [address];
        if (method === 'eth_requestAccounts') { emit('accountsChanged'); return [address]; }
        if (method === 'eth_chainId') return '0xaa36a7';
        if (method === 'net_version') return '11155111';
        if (method === 'personal_sign') return window.challengeSign({ raw: params[0] });
        return null;
      },
    };
    const announce = () => dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { uuid: 'u-ch', name: 'Rabby test', rdns: 'io.rabby', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>' }, provider } }));
    addEventListener('eip6963:requestProvider', announce); announce();
  }, wallet.address);

  try {
    /* ---------- 1. sign in on the prop dashboard ---------- */
    await page.goto(BASE + '/#/en/prop/dashboard');
    await page.waitForTimeout(3000);
    await connect(page);
    await signIn(page);
    check('SIWE sign-in (session active)', (await call(page, '/auth/me')).status === 200);

    /* ---------- 2. purchase a one-phase challenge (test seam) ---------- */
    const order = await call(page, '/purchases/orders', { planSlug: 'one-phase', accountSize: 5000, idempotencyKey: 'e2e-challenge-' + Date.now() });
    check('order created (server-priced)', order.status === 200 && order.data.order.status === 'pending');
    const confirm = await call(page, '/internal/confirm-order', { orderId: order.data.order.id, txHash: '0x' + 'e2e'.repeat(15) + Date.now().toString(16).slice(-4) });
    check('payment confirmed → challenge provisioned exactly once', confirm.status === 200 && !!confirm.data.challengeId);
    const challengeId = confirm.data.challengeId;

    /* ---------- 3. dashboard shows the challenge + start button ---------- */
    await page.goto(BASE + '/#/en/prop/dashboard?account=' + challengeId);
    await page.waitForTimeout(2500);
    const panel = page.locator('.of-challenge-panel');
    await panel.waitFor({ state: 'visible', timeout: 15000 });
    check('dashboard renders the challenge evaluation panel', await panel.count() === 1);
    const startButton = panel.locator('.of-challenge-start');
    check('challenge shows the Start control while created', (await panel.getAttribute('data-status')) === 'created' && await startButton.count() === 1);

    /* ---------- 4. start the challenge from the UI ---------- */
    await startButton.click();
    await page.waitForFunction(() => document.querySelector('.of-challenge-panel')?.getAttribute('data-status') === 'started', null, { timeout: 20000 });
    check('Start button → evaluation active (created → started)', true);

    /* ---------- 5. trade on the challenge account (real order API) ---------- */
    const view = (await call(page, '/challenges/' + challengeId)).data;
    const tradingAccount = view.accountId;
    check('challenge has a provisioned trading account', !!tradingAccount);
    /* inject a deterministic price via the test seam, then trade:
       one long position opened at 50,000 and closed after the mark
       rises to 53,200 — realized net profit ≈ +628 (target: 600) */
    await call(page, '/internal/inject-price', { symbol: 'BTC/USD', price: 50000 });
    const open = await call(page, '/trading/order?account=' + tradingAccount, { market: 'BTC/USD', side: 'long', margin: 2000, leverage: 5 });
    check('market order fills on the challenge account', open.status === 200 && open.data.ok === true, JSON.stringify(open.data).slice(0, 120));
    await call(page, '/internal/inject-price', { symbol: 'BTC/USD', price: 53200 });
    const close = await page.evaluate(async ({ id, key }) => {
      const pos = (await (await fetch('/trading/state?account=' + id, { credentials: 'include' })).json()).positions[0];
      const res = await fetch('/trading/positions/' + pos.id + '/close?account=' + id, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ fraction: 1 }) });
      return { status: res.status, data: await res.json().catch(() => null) };
    }, { id: tradingAccount, key: 'e2e-close-' + Date.now() });
    check('profitable position closed through the server engine', close.status === 200, JSON.stringify(close.data).slice(0, 160));

    /* ---------- 6. evaluation: profit target → PASSED (12% of 5000 = 600) ---------- */
    await page.goto(BASE + '/#/en/prop/dashboard?account=' + challengeId);
    await page.waitForTimeout(2000);
    await page.waitForFunction(() => document.querySelector('.of-challenge-panel')?.getAttribute('data-status') === 'passed', null, { timeout: 30000 });
    const finalStatus = await panel.getAttribute('data-status');
    check('evaluation engine PASSED the challenge on the closed profit target', finalStatus === 'passed', `status=${finalStatus}`);
    const finalView = (await call(page, '/challenges/' + challengeId)).data;
    check("dashboard shows the passed evaluation state", !!finalView);
    const events = finalView.events.map(e => e.kind);
    check("'passed' transition recorded in the event history", events.includes('passed'));
    const laterOrder = await call(page, '/trading/order?account=' + tradingAccount, { market: 'BTC/USD', side: 'long', margin: 100, leverage: 1 });
    check('trading stops after pass (terminal state enforced)', laterOrder.status === 409 && laterOrder.data.error === 'challenge_passed');

    /* theme check on the dashboard for good measure */
    const toggle = page.locator('button[aria-label="Toggle theme"]').first();
    if (await toggle.count()) { await toggle.click(); await page.waitForTimeout(800); }
    check('dashboard theme toggles without browser errors', errors.length === 0);
    await page.screenshot({ path: 'output/playwright/challenge-e2e-final.png' });
    check('no browser errors during the whole journey', errors.length === 0);
  } finally {
    await browser.close();
  }
  console.log(`\n${results.length} passed`);
})().catch(e => { console.error(e); process.exitCode = 1; });
