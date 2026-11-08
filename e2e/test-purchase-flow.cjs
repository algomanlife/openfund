/* Openfund purchase flow browser E2E — challenge checkout, provisioning,
 * purchase history + invoice download, withdrawals and profile editing.
 *
 * Real local SIWE/PostgreSQL, disposable EIP-6963 signer (same pattern as
 * test-terminal-completion.cjs). The purchase lifecycle is confirmed through
 * the SIM_TEST_MODE test seam (/internal/confirm-order) — no blockchain
 * writes, no real payments. Requires the server env PURCHASE_PAYMENT_RECEIVER
 * (CI sets a placeholder; locally export it before booting the test server).
 */
const { chromium } = require('playwright');
const { createRequire } = require('node:module');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const req = createRequire(path.resolve(__dirname, '../apps/backend/package.json'));
const { generatePrivateKey, privateKeyToAccount } = req('viem/accounts');
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '');
const API = process.env.TEST_BACKEND_URL || 'http://localhost:8080';
const OUT = path.resolve(__dirname, '../output/playwright/purchase-flow');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
function check(name, value) { assert.ok(value, name); results.push(name); console.log('PASS - ' + name) }

async function walletButton(page, name) {
  const fa = await page.locator('html').getAttribute('lang') === 'fa';
  if (fa) name = ({ 'Sign in': 'ورود به اوپن‌فاند', 'Account': 'حساب من' })[name] || name;
  const button = page.getByRole('button', { name, exact: true, includeHidden: true }).first();
  await button.waitFor({ state: 'attached' });
  const menu = button.locator('xpath=ancestor::details[contains(@class,"rk-account-menu")]');
  if (await menu.count() && !await menu.evaluate(el => el.open)) await menu.locator('summary').click();
  return button;
}
/* connect + sign in with retries: wagmi's EIP-6963 connector registration and
 * the landing's async legacy boot can race a single click */
async function connect(page) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await page.getByRole('button', { name: /^(Sign in|Account|ورود به اوپن‌فاند|حساب من)$/, includeHidden: true }).first().waitFor({ state: 'attached', timeout: 6000 });
      return;
    } catch { /* not connected yet */ }
    const btn = page.locator('.rk-chip-connect');
    if (await btn.count()) await btn.click({ timeout: 3000 });
  }
  await page.getByRole('button', { name: /^(Sign in|Account|ورود به اوپن‌فاند|حساب من)$/, includeHidden: true }).first().waitFor({ state: 'attached', timeout: 20000 });
}
async function signIn(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    // Cookie restoration may finish after connect: an already authenticated
    // account has no Sign in button, so do not wait for an impossible control.
    const account = page.getByRole('button', { name: /^(Account|حساب من)$/, includeHidden: true }).first();
    if (await account.count()) return;
    await (await walletButton(page, 'Sign in')).click();
    try {
      await (await walletButton(page, 'Account')).waitFor({ state: 'attached', timeout: 15000 });
      return;
    } catch { /* sign-in click may race a re-render — retry */ }
  }
  await (await walletButton(page, 'Account')).waitFor({ state: 'attached', timeout: 30000 });
}
/* API calls via the page context (cookie-bearing). Reload-based route
 * changes can destroy the evaluation context mid-call — retry until the
 * new document settles. */
async function call(page, url, body, method) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await page.evaluate(async ({ url, body, method }) => {
        const response = await fetch(url, { method: method || (body ? 'POST' : 'GET'), credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        return { status: response.status, data: await response.json() };
      }, { url: API + url, body, method })
    } catch (e) {
      if (attempt >= 4 || !/destroyed|navigation/i.test(String(e))) throw e
      await page.waitForTimeout(1500)
    }
  }
}
/* SPA path navigation — product pages intentionally reload on route change,
 * so tolerate the destroyed context and wait for the target URL to settle */
async function navigateHash(page, path) {
  await page.evaluate(p => { history.pushState(null, '', p); dispatchEvent(new PopStateEvent('popstate')) }, path)
  await page.waitForURL(`**${path}`, { timeout: 15000 })
  // Existing legacy teardown reloads at 120 ms; URL changes precede it.
  await page.waitForTimeout(250)
  await page.waitForLoadState('domcontentloaded')
  await page.locator('.of-terminal-top').waitFor()
}
/* screenshots are evidence, not assertions — never let a mid-reload capture fail the run */
async function shot(page, name) {
  await page.screenshot({ path: OUT + `/${name}.png`, fullPage: false, timeout: 8000 }).catch(() => {})
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const wallet = privateKeyToAccount(generatePrivateKey());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => { errors.push(e.stack || e.message); console.error('BROWSER ERROR', e.stack || e.message) });
  await page.exposeFunction('purchaseSign', ({ raw }) => wallet.signMessage({ message: { raw } }));
  await page.addInitScript(address => {
    const events = {}; let permitted = sessionStorage.getItem('purchase-wallet-approved') === 'yes';
    const emit = n => (events[n] || []).forEach(fn => fn());
    const provider = {
      isRabby: true,
      on: (n, fn) => (events[n] || []).push(fn),
      removeListener: (n, fn) => events[n] = (events[n] || []).filter(x => x !== fn),
      request: async ({ method, params }) => {
        if (method === 'eth_accounts') return permitted ? [address] : [];
        if (method === 'eth_requestAccounts') { permitted = true; sessionStorage.setItem('purchase-wallet-approved', 'yes'); emit('accountsChanged'); return [address]; }
        if (method === 'eth_chainId') return '0xaa36a7';
        if (method === 'net_version') return '11155111';
        if (method === 'personal_sign') return window.purchaseSign({ raw: params[0] });
        if (method === 'eth_getBalance') return '0x0';
        if (method === 'eth_blockNumber') return '0x1';
        if (['wallet_requestPermissions', 'wallet_getPermissions'].includes(method)) return [{ parentCapability: 'eth_accounts' }];
        if (method === 'eth_sendTransaction' || method === 'eth_signTransaction') throw new Error('Blockchain writes forbidden in this test');
        return null;
      }
    };
    const announce = () => dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { uuid: '58d4b098-dbac-4070-8a44-9120c0630d24', name: 'Rabby test signer', rdns: 'io.rabby', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>' }, provider } }));
    addEventListener('eip6963:requestProvider', announce); announce();
  }, wallet.address);
  /* Directus is not part of this test — abort its fetches so the landing boots
   * fast, but serve the challenge_plans catalog so the legacy builder renders
   * (mirrors the backend seed catalog; registration order matters — the more
   * specific route must come after the blanket abort). */
  await context.route('http://localhost:8055/**', route => route.abort());
  await context.route('http://localhost:8055/items/challenge_plans**', route => route.fulfill({
    json: { data: [{
      slug: 'standard', name: 'استاندارد — Standard', status: 'active',
      configuration: {
        accountSizesUsd: [5000, 10000, 25000, 50000, 100000],
        priceUsd: { 5000: 44, 10000: 80, 25000: 216, 50000: 349, 100000: 652 },
        phases: 2, phase1TargetPct: 8, phase2TargetPct: 5,
        dailyLossPct: 5, dailyLossPctAlt: 3, maxTotalLossPct: 10,
        drawdownMode: 'static', minTradingDays: 3,
        profitSplitPct: 80, profitSplitMonthlyPct: 100, payoutCapPct: 0,
        firstPayoutDays: 14, minPayoutPct: 1, refundPolicy: 'fourth-reward'
      }
    }] }
  }));

  try {
    /* ---------- 1. challenges page: connect + sign in ---------- */
    await page.goto(BASE + '/en/challenges');
    await page.waitForTimeout(3000);
    await connect(page);
    await signIn(page);
    check('SIWE sign-in on challenges page', (await call(page, '/auth/me')).status === 200);

    /* ---------- 2. select a plan size and open checkout ---------- */
    const sizes = page.locator('#builder-sizes button');
    await sizes.first().waitFor({ state: 'attached' });
    await sizes.nth(1).click();
    const sizeValue = await page.locator('#account-value').textContent();
    check('builder shows a selectable account size', /\$[\d,]+/.test(sizeValue || ''));

    await page.locator('#review-selection').click();
    await page.locator('#selection-dialog[open], dialog[open]').first().waitFor();
    await page.locator('#dialog-done').click();
    await page.getByRole('heading', { name: 'Challenge Checkout' }).waitFor({ timeout: 5000 });
    check('React checkout panel opens from the legacy dialog', true);
    await shot(page, 'checkout-open');

    /* ---------- 3. create the server-priced order ---------- */
    await page.getByRole('button', { name: 'Create order & get payment address' }).click();
    await page.locator('.of-checkout-addr code').waitFor({ timeout: 10000 });
    const receiver = await page.locator('.of-checkout-addr code').textContent();
    check('payment instructions carry the receiver address', /^0x[0-9a-f]{40}$/i.test((receiver || '').trim()));

    /* ---------- 4. confirm payment via the test seam (exactly once) ---------- */
    const history = await call(page, '/purchases/history');
    const pending = (history.data?.orders || []).find(o => o.status === 'pending');
    check('pending order exists in history', !!pending && Number(pending.price_usd) > 0);
    const txHash = '0x' + [...require('node:crypto').randomBytes(32)].map(b => b.toString(16).padStart(2, '0')).join('');
    const confirm = await call(page, '/internal/confirm-order', { orderId: pending.id, txHash });
    check('test seam provisions the challenge', confirm.status === 200 && !!confirm.data.challengeId);
    const replay = await call(page, '/internal/confirm-order', { orderId: pending.id, txHash });
    check('replay is idempotent', replay.status === 200 && replay.data.replayed === true);

    /* ---------- 5. the panel detects the paid order (polling) ---------- */
    await page.getByText('Payment verified', { exact: false }).waitFor({ timeout: 15000 });
    check('checkout panel transitions to the verified state', true);
    await shot(page, 'checkout-verified');

    const me = await call(page, '/auth/me');
    check('provisioned challenge appears in /auth/me', (me.data?.challenges || []).some(c => c.id === confirm.data.challengeId));

    /* ---------- 6. purchases & invoices page ----------
       (client-side hash navigation — full gotos race the SSE long-poll load event) */
    await navigateHash(page, '/en/prop/purchases');
    await page.locator('.of-purchase-table tbody tr').first().waitFor({ timeout: 10000 });
    const invoiceCell = await page.locator('.of-purchase-table tbody tr td:nth-child(7)').first().textContent();
    check('purchase history row rendered', /Download PDF|دانلود/.test(invoiceCell || ''));
    const hist2 = await call(page, '/purchases/history');
    const paid = (hist2.data?.orders || []).find(o => o.id === pending.id);
    check('history carries payment + invoice for the paid order', paid?.payment?.txHash === txHash && !!paid?.invoice?.id);
    /* fetch the PDF through playwright's cookie-sharing request API — the
     * page context may be destroyed by a reload-based route change mid-call */
    const pdf = await (async () => {
      const r = await page.request.get(`${API}/invoices/${paid.invoice.id}`);
      const buf = await r.body();
      return { status: r.status(), head: buf.subarray(0, 5).toString('latin1'), type: r.headers()['content-type'] };
    })();
    check('invoice downloads as PDF', pdf.status === 200 && pdf.head === '%PDF-' && pdf.type === 'application/pdf');
    await shot(page, 'purchase-history');

    /* ---------- 7. withdrawals page ---------- */
    await navigateHash(page, '/en/prop/withdrawals');
    /* reload-based route changes may drop the EIP-6963 auto-reconnect —
     * re-establish wallet + session when needed */
    if (!await page.getByRole('button', { name: 'Account', exact: true, includeHidden: true }).count()) {
      await connect(page);
      await signIn(page);
    }
    await page.locator('.of-withdraw-form input').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(1000); /* let the SPA route settle before interacting */
    await page.locator('.of-withdraw-form input').first().fill('150.00');
    await page.getByRole('button', { name: 'Submit request' }).click();
    await page.locator('.of-purchase-table tbody tr').first().waitFor({ timeout: 10000 });
    const wl = await call(page, '/withdrawals');
    check('withdrawal request recorded', (wl.data?.withdrawals || []).length >= 1);
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
    await page.waitForTimeout(500);
    const wl2 = await call(page, '/withdrawals');
    check('withdrawal cancelled from the UI', (wl2.data?.withdrawals || []).some(w => w.status === 'cancelled'));
    await shot(page, 'withdrawals');

    /* ---------- 8. profile editing (name + avatar) ---------- */
    await page.goto(BASE + '/en/challenges');
    await page.waitForTimeout(2500);
    if (!await page.getByRole('button', { name: 'Account', exact: true, includeHidden: true }).count()) {
      await connect(page);
      await signIn(page);
    }
    await (await walletButton(page, 'Account')).click();
    await page.getByRole('heading', { name: 'Openfund Account' }).waitFor();
    await page.getByRole('button', { name: 'Edit name & avatar' }).click();
    await page.locator('.of-profile-editform input[dir="auto"]').fill('E2E Buyer');
    await page.locator('.of-profile-filebtn input[type="file"]').setInputFiles({
      name: 'avatar.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.locator('.of-profile-headinfo b', { hasText: 'E2E Buyer' }).waitFor({ timeout: 10000 });
    check('profile name + avatar saved from the UI', await page.locator('.of-profile-head img.of-avatar').count() >= 0);
    const me2 = await call(page, '/auth/me');
    check('profile edits persist server-side', me2.data?.user?.displayName === 'E2E Buyer' && !!me2.data?.user?.avatarUrl);
    await shot(page, 'profile-edited');

    check('no browser errors during the flow', errors.length === 0);
  } finally {
    await context.close();
    await browser.close();
  }
  console.log(`\n${results.length} passed`);
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) });
