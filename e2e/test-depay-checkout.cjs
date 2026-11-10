/* DePay → Openfund → Challenge activation: full checkout acceptance in a real browser.
 *
 * What is REAL: the Openfund backend (spawned here), PostgreSQL, SIWE sign-in,
 * the React checkout panel, the Subresource-Integrity-pinned widget loader, the
 * dynamic-configuration endpoint and its RSA-PSS signature, the signed callback
 * endpoint, and the backend's on-chain verifier talking JSON-RPC over HTTP.
 *
 * What is SIMULATED (and therefore NOT real-network acceptance):
 *  - the DePay widget bundle (a stub that records the call) and DePay's servers
 *    (this script plays them: it asks our server for the signed configuration
 *    and delivers signed callbacks with a locally generated key);
 *  - the blockchain (an in-memory JSON-RPC, e2e/helpers/mock-evm-rpc.cjs);
 *  - the customer's wallet payment (a transaction added to that mock chain).
 *
 * Needs: a built frontend (react/), DATABASE_URL pointing at a disposable
 * database whose name contains "test", and Playwright chromium.
 */
const { chromium } = require('playwright')
const { createRequire } = require('node:module')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const crypto = require('node:crypto'), net = require('node:net')
const { spawn } = require('node:child_process')
const { createMockChain } = require('./helpers/mock-evm-rpc.cjs')
const { walletInitScript, connect, signIn, makeCall, DIRECTUS_PLAN_FIXTURE } = require('./helpers/wallet-ui.cjs')
const req = createRequire(path.resolve(__dirname, '../apps/backend/package.json'))
const { generatePrivateKey, privateKeyToAccount } = req('viem/accounts')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'output/playwright/depay-checkout')
fs.mkdirSync(OUT, { recursive: true })
if (!/test|audit|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Set DATABASE_URL to a disposable database whose name contains "test"')

const results = []
const check = (name, value, extra) => { assert.ok(value, name + (extra ? ' :: ' + extra : '')); results.push(name); console.log('PASS - ' + name) }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const freePort = () => new Promise(r => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)) }) })

/* ---- keys: DePay's callback key (public half configured on our server) and our dynamic-configuration key ---- */
const depay = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const ours = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const pemOf = (k, type) => k.export({ type, format: 'pem' }).toString()
const oneLine = pem => pem.replace(/\n/g, '\\n')
const sign = (data, key) => crypto.sign('sha256', Buffer.from(data), { key, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 }).toString('base64url')
const verifySig = (data, sig, pubKey) => crypto.verify('sha256', Buffer.from(data), { key: pubKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 }, Buffer.from(sig, 'base64url'))

/* ---- the stub widget bundle (what the browser would download from DePay) ---- */
const WIDGET_BODY = `window.DePayWidgets = { Payment: function (opts) {
  window.__depayOpts = opts;
  var d = document.createElement('div'); d.id = 'mock-depay-widget'; d.textContent = 'DePay payment widget (test stub)';
  document.body.appendChild(d);
  return window.__depayOpened(JSON.stringify(opts));
} };`
const WIDGET_URL = 'https://integrate.depay.com/widgets/v13.js'
const sri = 'sha384-' + crypto.createHash('sha384').update(WIDGET_BODY).digest('base64')

const TOKEN = '0x' + 'a1'.repeat(20), RECEIVER = '0x' + 'c3'.repeat(20), ROUTER = '0x' + 'd4'.repeat(20)
const INTEGRATION = 'test-integration-id'
const usdc = n => BigInt(Math.round(n * 1e6))

async function main() {
  const chain = createMockChain({ chainId: 42161, decimals: 6 })
  const rpcUrl = await chain.listen()
  const port = await freePort()
  const BASE = `http://localhost:${port}`
  const env = {
    ...process.env, NODE_ENV: 'test', SIM_TEST_MODE: '1', PORT: String(port), ALLOWED_DOMAINS: `localhost:${port}`,
    CSP_EXTRA_CONNECT: 'http://localhost:8055',
    PURCHASE_PAYMENT_RECEIVER: RECEIVER, PURCHASE_PAYMENT_CHAIN: '42161', PURCHASE_PAYMENT_TOKEN: TOKEN, PURCHASE_PAYMENT_DECIMALS: '6',
    PURCHASE_RPC_URL: rpcUrl, PURCHASE_ROUTER_ADDRESSES: ROUTER, PURCHASE_PAYMENT_MIN_CONFIRMATIONS: '2',
    VITE_DEPAY_WIDGET: '1', VITE_DEPAY_WIDGET_URL: WIDGET_URL, VITE_DEPAY_WIDGET_INTEGRITY: sri, VITE_DEPAY_INTEGRATION_ID: INTEGRATION,
    CSP_EXTRA_SCRIPT_SRC: 'https://integrate.depay.com',
    DEPAY_CALLBACK_PUBLIC_KEY: oneLine(pemOf(depay.publicKey, 'spki')), DEPAY_CONFIG_PRIVATE_KEY: oneLine(pemOf(ours.privateKey, 'pkcs8')),
    PAYMENT_RECOVERY_INTERVAL_MS: '1000', PAYMENT_RECOVERY_MIN_AGE_S: '1',
  }
  for (const k of Object.keys(env)) if (k.startsWith('VITE_') && !['VITE_DEPAY_WIDGET', 'VITE_DEPAY_WIDGET_URL', 'VITE_DEPAY_WIDGET_INTEGRITY', 'VITE_DEPAY_INTEGRATION_ID'].includes(k)) delete env[k]
  const logFile = path.join(OUT, 'server.log')
  const server = spawn(process.execPath, ['apps/backend/server.js'], { cwd: ROOT, env, stdio: ['ignore', fs.openSync(logFile, 'w'), fs.openSync(logFile, 'a')] })
  const stop = async () => { server.kill('SIGTERM'); await chain.close() }
  try {
    for (let i = 0; ; i++) {
      try { if ((await fetch(BASE + '/health')).ok) break } catch { /* booting */ }
      if (i > 60) throw new Error('server did not start; see ' + logFile)
      await sleep(500)
    }
    await run({ BASE, chain })
  } finally { await stop() }
  console.log(`\n${results.length} passed`)
}

/* DePay's side of the protocol, played by this script */
const dePayAskConfiguration = async (BASE, orderId) => {
  const t0 = Date.now()
  const r = await fetch(BASE + '/purchases/depay/configuration', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ orderId }) })
  const text = await r.text()
  return { status: r.status, text, ms: Date.now() - t0, signature: r.headers.get('x-signature') }
}
const dePayDeliverCallback = async (BASE, body, { badSignature = false } = {}) => {
  const raw = JSON.stringify(body)
  const sig = badSignature ? sign(raw, ours.privateKey) : sign(raw, depay.privateKey) // wrong key = forged
  const r = await fetch(BASE + '/purchases/depay/callback', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-signature': sig }, body: raw })
  return { status: r.status, data: await r.json().catch(() => null) }
}
const callbackBody = (hash, sender) => ({ blockchain: 'arbitrum', transaction: hash, sender, receiver: RECEIVER, token: TOKEN, amount: '80', payload: null, after_block: 1, commitment: 'confirmed', confirmations: 1, created_at: new Date().toISOString(), confirmed_at: new Date().toISOString() })

async function run({ BASE, chain }) {
  const API = BASE
  const browser = await chromium.launch()
  const wallet = privateKeyToAccount(generatePrivateKey())
  const payer = wallet.address.toLowerCase()
  const errors = []
  let opened = null // resolves when the stub widget is opened
  let openedResolve = null
  const waitOpened = () => { opened = new Promise(r => { openedResolve = r }); return opened }

  async function newPage(context, { tamper = false } = {}) {
    const page = await context.newPage()
    page.on('pageerror', e => { errors.push(e.stack || e.message); console.error('BROWSER ERROR', e.stack || e.message) })
    await page.exposeFunction('purchaseSign', ({ raw }) => wallet.signMessage({ message: { raw } }))
    await page.exposeFunction('__depayOpened', optsJson => { openedResolve?.(JSON.parse(optsJson)); return null })
    await page.addInitScript(walletInitScript, wallet.address)
    return page
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.route('http://localhost:8055/**', route => route.abort())
  await context.route('http://localhost:8055/items/challenge_plans**', route => route.fulfill({ json: DIRECTUS_PLAN_FIXTURE }))
  await context.route(WIDGET_URL, route => route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: WIDGET_BODY }))
  const page = await newPage(context)
  const call = makeCall(page, API)

  const openCheckout = async (sizeIndex) => {
    await page.goto(BASE + '/en/challenges')
    await page.waitForTimeout(3000)
    await connect(page); await signIn(page)
    const sizes = page.locator('#builder-sizes button')
    await sizes.first().waitFor({ state: 'attached' })
    await sizes.nth(sizeIndex).click()
    await page.locator('#review-selection').click()
    await page.locator('#selection-dialog[open], dialog[open]').first().waitFor()
    await page.locator('#dialog-done').click()
    await page.getByRole('heading', { name: 'Challenge Checkout' }).waitFor({ timeout: 8000 })
  }
  const shot = name => page.screenshot({ path: path.join(OUT, name + '.png') }).catch(() => {})
  const challengesOf = async () => (await call('/auth/me')).data?.challenges || []
  const pendingOrder = async () => ((await call('/purchases/history')).data?.orders || []).find(o => o.status === 'pending')

  try {
    /* ===== 1. Buy Challenge: order is created server-side and the official widget opens ===== */
    await openCheckout(1)
    const buy = page.getByRole('button', { name: 'Buy Challenge', exact: true })
    await buy.waitFor({ timeout: 8000 })
    check('checkout offers a single "Buy Challenge" action when DePay is configured', true)
    const before = (await challengesOf()).length
    const widgetOpened = waitOpened()
    await buy.click()
    const opts = await Promise.race([widgetOpened, sleep(15000).then(() => null)])
    check('the DePay widget opens through the SRI-pinned official bundle', !!opts)
    await page.locator('#mock-depay-widget').waitFor({ timeout: 5000 })
    check('widget is called with the integration id and ONLY the order id as payload', opts.integration === INTEGRATION && Object.keys(opts.payload).join() === 'orderId' && !('accept' in opts))
    const order = await pendingOrder()
    check('the order exists server-side with the catalog price', !!order && order.id === opts.payload.orderId && Number(order.price_usd) === 80, JSON.stringify(order))
    await shot('1-widget-opened')

    /* ===== 2. DePay asks OUR server for the payment configuration ===== */
    const conf = await dePayAskConfiguration(BASE, order.id)
    check('dynamic configuration answers well inside the 2 s limit', conf.status === 200 && conf.ms < 2000, `${conf.status} ${conf.ms}ms`)
    check('dynamic configuration is signed with our key (RSA-PSS, SHA-256, base64url)', !!conf.signature && verifySig(conf.text, conf.signature, ours.publicKey))
    const accept = JSON.parse(conf.text).accept?.[0]
    check('configuration comes from the server order: chain, token, receiver and exact amount', accept && accept.blockchain === 'arbitrum' && accept.token === TOKEN && accept.receiver === RECEIVER && accept.amount === '80', conf.text)
    check('configuration is refused for an unknown order', (await dePayAskConfiguration(BASE, crypto.randomUUID())).status === 404)
    check('configuration is refused for a malformed order id', (await dePayAskConfiguration(BASE, 'nope')).status === 400)

    /* ===== 3. payment failure: underpayment is rejected, nothing is provisioned ===== */
    const shortTx = chain.addTx({ from: payer, to: ROUTER, logs: [chain.transferLog(TOKEN, payer, ROUTER, usdc(70)), chain.transferLog(TOKEN, ROUTER, RECEIVER, usdc(70))] })
    chain.mine(3)
    check('a forged callback (wrong signature) is rejected', (await dePayDeliverCallback(BASE, callbackBody(shortTx, payer), { badSignature: true })).status === 401)
    const cbShort = await dePayDeliverCallback(BASE, callbackBody(shortTx, payer))
    check('the signed callback is acknowledged with 200 at once', cbShort.status === 200 && cbShort.data?.recorded === true)
    await page.getByRole('alert').filter({ hasText: 'below the order price' }).waitFor({ timeout: 15000 })
    check('the checkout shows the payment failure (underpayment) in plain words', true)
    check('with DePay the customer never sees an address or a transaction-hash field', (await page.locator('.of-checkout-tx').count()) === 0 && (await page.locator('.of-checkout-addr').count()) === 0)
    await shot('2-underpayment')
    check('no challenge was created for the underpayment', (await challengesOf()).length === before)
    const attempts = (await call(`/purchases/orders/${order.id}/attempts`)).data.attempts
    check('the attempt is recorded as rejected / underpayment', attempts[0]?.status === 'rejected' && attempts[0]?.classification === 'underpayment')

    /* ===== 4. correct payment while the chain RPC is down + page refresh ===== */
    const goodTx = chain.addTx({ from: payer, to: ROUTER, logs: [chain.transferLog(TOKEN, payer, ROUTER, usdc(80)), chain.transferLog(TOKEN, ROUTER, RECEIVER, usdc(80))] })
    chain.mine(3)
    chain.state.down = true
    const cbGood = await dePayDeliverCallback(BASE, callbackBody(goodTx, payer))
    check('callback is still acknowledged while the RPC is unavailable (DePay will not retry blindly)', cbGood.status === 200 && cbGood.data?.recorded === true)
    await sleep(1500)
    check('the order stays unpaid while the chain cannot be read', (await pendingOrder())?.id === order.id)
    await page.reload()               // ---- the customer refreshes the page mid-payment ----
    await openCheckout(1)
    await page.getByText('temporarily unreachable', { exact: false }).waitFor({ timeout: 15000 })
    check('after a refresh the checkout resumes the same order and explains the wait (payment not lost)', true)
    await shot('3-resumed-after-refresh')
    check('still exactly the same single pending order after the refresh', (await pendingOrder())?.id === order.id)

    chain.state.down = false          // ---- the RPC recovers; the recovery sweep proves the payment ----
    await page.getByText('Payment successful', { exact: false }).waitFor({ timeout: 30000 })
    check('Payment Successful is shown once the backend has verified the payment on-chain', true)
    await shot('4-payment-successful')
    const after = await challengesOf()
    check('exactly one challenge account was created', after.length === before + 1)
    const history = (await call('/purchases/history')).data.orders.find(o => o.id === order.id)
    check('order is paid with the verified payment and an invoice', history.status === 'paid' && history.payment?.txHash === goodTx && !!history.invoice?.number)
    check('the challenge belongs to this order', history.challenge_id === after.find(c => c.id === history.challenge_id)?.id)

    /* ===== 5. idempotency: DePay redelivers the callback ===== */
    const dup1 = await dePayDeliverCallback(BASE, callbackBody(goodTx, payer))
    const dup2 = await dePayDeliverCallback(BASE, callbackBody(goodTx, payer))
    await sleep(1500)
    check('callback redelivery returns 200 and changes nothing', dup1.status === 200 && dup2.status === 200)
    check('still exactly one challenge, one payment and one invoice after redelivery',
      (await challengesOf()).length === before + 1 &&
      ((await call('/purchases/history')).data.orders.filter(o => o.id === order.id && o.invoice).length === 1))
    check('the paid order is no longer payable (configuration refused)', (await dePayAskConfiguration(BASE, order.id)).status === 409)

    /* ===== 6. a tampered widget bundle never executes (Subresource Integrity) ===== */
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx2.route('http://localhost:8055/**', route => route.abort())
    await ctx2.route('http://localhost:8055/items/challenge_plans**', route => route.fulfill({ json: DIRECTUS_PLAN_FIXTURE }))
    await ctx2.route(WIDGET_URL, route => route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: WIDGET_BODY + '\nwindow.__pwned = true;' }))
    const page2 = await newPage(ctx2)
    const call2 = makeCall(page2, API)
    await page2.goto(BASE + '/en/challenges'); await page2.waitForTimeout(3000)
    await connect(page2); await signIn(page2)
    const sizes2 = page2.locator('#builder-sizes button')
    await sizes2.first().waitFor({ state: 'attached' }); await sizes2.nth(2).click()
    await page2.locator('#review-selection').click(); await page2.locator('#selection-dialog[open], dialog[open]').first().waitFor(); await page2.locator('#dialog-done').click()
    await page2.getByRole('button', { name: 'Buy Challenge', exact: true }).click()
    await page2.getByRole('alert').filter({ hasText: 'could not be loaded' }).waitFor({ timeout: 15000 })
    check('a tampered widget bundle is blocked and the checkout falls back safely', !(await page2.evaluate(() => window.__pwned === true || !!window.DePayWidgets)))
    check('the manual payment fallback (receiver address) stays available', await page2.locator('.of-checkout-addr code').count() === 1)
    await page2.screenshot({ path: path.join(OUT, '5-tampered-bundle.png') }).catch(() => {})
    await ctx2.close()

    check('no unexpected browser errors during the whole journey', errors.length === 0, errors.join('\n'))
  } finally {
    await context.close()
    await browser.close()
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
