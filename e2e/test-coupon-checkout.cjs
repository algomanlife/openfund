/* Coupon → checkout browser acceptance (local runtime, disposable database,
 * disposable EIP-6963 signer; no blockchain or real payment).
 *
 *  1. a campaign link (?coupon=) prices the challenge on the server after
 *     sign-in: list price, discount and final price are shown;
 *  2. a size change keeps the coupon and re-prices it; a reload keeps it;
 *  3. a typed code that has not been applied blocks every checkout button
 *     (it used to be dropped silently, creating a full-price order);
 *  4. a capped 100 % coupon creates a zero-payment order that provisions the
 *     challenge exactly once with a zero invoice, and the coupon is consumed;
 *  5. the same flow renders RTL in Persian.
 *
 * Requires TEST_FRONTEND_URL (local), DATABASE_URL (*_test or *_ci) and the
 * server's ADMIN_API_TOKEN.
 */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const { randomBytes } = require('node:crypto')
const { chromium } = require('playwright')
const { walletInitScript, connect, signIn } = require('./helpers/wallet-ui.cjs')
const backend = createRequire(path.resolve(__dirname, '../apps/backend/package.json'))
const { generatePrivateKey, privateKeyToAccount } = backend('viem/accounts')
const { Pool } = backend('pg')
const base = new URL(process.env.TEST_FRONTEND_URL || 'http://localhost:8080')
const db = new URL(process.env.DATABASE_URL)
const token = process.env.ADMIN_API_TOKEN
const loopback = u => ['localhost', '127.0.0.1'].includes(u.hostname)
if (!loopback(base) || !loopback(db) || !/(_test|_ci)$/.test(db.pathname) || !token)
  throw new Error('A local runtime, an isolated test database and the test admin token are required')
const OUT = process.env.OUTPUT_DIR || path.resolve(__dirname, '../output/playwright/coupon-checkout')
fs.mkdirSync(OUT, { recursive: true })

const results = []
const check = (name, ok, info = '') => { assert.ok(ok, `${name} ${info}`); results.push(name); console.log('PASS - ' + name) }
const admin = async (endpoint, body) => {
  const response = await fetch(new URL('/admin' + endpoint, base), {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'x-admin-actor': 'coupon-acceptance', 'content-type': 'application/json' },
    body: JSON.stringify(body) })
  const data = await response.json()
  assert.ok(response.ok, JSON.stringify(data))
  return data
}

;(async () => {
  const pool = new Pool({ connectionString: db.href })
  const row = async (sql, args) => (await pool.query(sql, args)).rows[0]
  const tag = randomBytes(3).toString('hex').toUpperCase()
  const plan = await row(`SELECT id, slug, configuration FROM challenge_plans WHERE status='active' AND slug='standard'`)
  assert.ok(plan, 'seeded standard plan')
  const sizes = plan.configuration.accountSizesUsd, prices = plan.configuration.priceUsd
  const [sizeA, sizeB] = [sizes[0], sizes[1]]
  const off = (list, pct) => (Number(list) * (100 - pct) / 100).toFixed(2)
  const money = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const twenty = (await admin('/coupons', { code: `OPENFUND20-${tag}`, kind: 'percent', value: 20, activate: true, challengePlanIds: [plan.id] })).coupon
  const full = (await admin('/coupons', { code: `FREE-${tag}`, kind: 'percent', value: 100, maxRedemptions: 1, activate: true })).coupon
  assert.equal(twenty.status, 'active'); assert.equal(full.status, 'active')

  const browser = await chromium.launch()
  const errors = []
  try {
    const wallet = privateKeyToAccount(generatePrivateKey())
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(String(e)))
    await page.exposeFunction('purchaseSign', ({ raw }) => wallet.signMessage({ message: { raw } }))
    await page.addInitScript(walletInitScript, wallet.address)
    const total = () => page.locator('.of-co-total b').innerText()
    const totalIs = price => page.waitForFunction(text => document.querySelector('.of-co-total b')?.textContent?.trim() === text, money(price), { timeout: 30000 })
    const discountLine = () => page.getByText(`(${twenty.code})`, { exact: false }).first()

    /* 1. campaign link → server quote after sign-in */
    await page.goto(new URL(`/en/checkout?plan=${plan.slug}&size=${sizeA}&coupon=${twenty.code.toLowerCase()}`, base).href)
    await connect(page)
    await signIn(page)
    await discountLine().waitFor({ timeout: 20000 })
    const textA = await page.locator('main').innerText()
    check('campaign link applies the coupon and shows the discount', textA.includes(twenty.code))
    await totalIs(off(prices[sizeA], 20))
    check(`amount due is the server price ${money(off(prices[sizeA], 20))} (list ${money(prices[sizeA])})`, await total() === money(off(prices[sizeA], 20)))
    check('coupon input is prefilled and normalized', await page.locator('#of-coupon').inputValue() === twenty.code)
    await page.screenshot({ path: path.join(OUT, 'checkout-campaign-link.png'), fullPage: true })

    /* 2. size change keeps and re-prices the coupon; reload keeps it */
    await page.locator(`.of-co-sizes label:has(input[value="${sizeB}"])`).click()
    await page.waitForFunction(size => new URL(location.href).searchParams.get('size') === String(size), sizeB)
    await totalIs(off(prices[sizeB], 20))
    check('size change keeps the coupon in the URL', new URL(page.url()).searchParams.get('coupon') === twenty.code)
    check(`size change re-prices on the server: ${money(off(prices[sizeB], 20))}`, await total() === money(off(prices[sizeB], 20)))
    await page.reload({ waitUntil: 'load' })
    await totalIs(off(prices[sizeB], 20))
    check('reload keeps the applied coupon and its price', (await page.locator('main').innerText()).includes(twenty.code))

    /* 3. an unapplied typed code blocks checkout instead of being dropped */
    await page.getByLabel('Email for the receipt').fill('coupon-buyer@example.test')
    await page.locator('.of-co-accept input').check()
    await page.locator('#of-coupon').fill('NOT-APPLIED-' + tag)
    await page.getByText('Apply the coupon code, or clear it, to continue.').waitFor()
    /* every order/payment action in the checkout card (DePay, Manual Payment, activation) */
    const actionButtons = page.locator('main button.button')
    const [present, enabled] = await actionButtons.evaluateAll(list => [list.length, list.filter(b => !b.disabled).length])
    check(`an unapplied code disables every order button (${present} found)`, present > 0 && enabled === 0, `${enabled}/${present}`)
    check('no order was created for the unapplied code', (await row('SELECT count(*)::int AS n FROM purchase_orders o JOIN openfund_users u ON u.id=o.user_id WHERE lower(u.wallet_address)=lower($1)', [wallet.address])).n === 0)

    /* 4. capped 100 % coupon → zero-payment provisioning, exactly once */
    await page.locator('#of-coupon').fill(full.code)
    await page.getByRole('button', { name: 'Apply', exact: true }).click()
    await page.getByText('With this coupon the challenge is activated without payment.').waitFor({ timeout: 15000 })
    await page.screenshot({ path: path.join(OUT, 'checkout-full-discount.png'), fullPage: true })
    const activate = page.getByRole('button', { name: 'Activate challenge' })
    await activate.click()
    await page.locator('.of-co-receipt').waitFor({ timeout: 20000 })
    await page.screenshot({ path: path.join(OUT, 'checkout-zero-payment-receipt.png'), fullPage: true })
    const order = await row(`SELECT o.* FROM purchase_orders o WHERE o.coupon_id=$1`, [full.id])
    check('zero-payment order: price 0, no payment required', order && Number(order.price_usd) === 0 && order.payment_required === false)
    check('order keeps the list price and the full discount', Number(order.list_price_usd) === Number(prices[String(order.account_size_usd)] ?? order.list_price_usd) && Number(order.discount_usd) === Number(order.list_price_usd))
    const challenges = (await row('SELECT count(*)::int AS n FROM openfund_challenges WHERE purchase_order_id=$1', [order.id])).n
    check('exactly one challenge provisioned', challenges === 1, String(challenges))
    const usage = await row('SELECT uses_consumed, uses_reserved FROM coupons WHERE id=$1', [full.id])
    check('coupon consumed once', Number(usage.uses_consumed) === 1 && Number(usage.uses_reserved) === 0, JSON.stringify(usage))
    const payments = (await row(`SELECT count(*)::int AS n FROM depay_events WHERE purchase_order_id=$1`, [order.id]).catch(() => ({ n: 0 }))).n
    check('no DePay or on-chain payment recorded', payments === 0)
    /* the capped coupon is now exhausted for everyone */
    const again = await fetch(new URL('/admin/coupons', base), { headers: { authorization: `Bearer ${token}`, 'x-admin-actor': 'coupon-acceptance' } }).then(r => r.json())
    check('the list reports the coupon as fully used', again.coupons.some(c => c.id === full.id && c.uses_consumed === 1))

    /* 5. Persian RTL with the same campaign link */
    await page.goto(new URL(`/fa/checkout?plan=${plan.slug}&size=${sizeA}&coupon=${twenty.code}`, base).href)
    await page.waitForFunction(code => document.documentElement.dir === 'rtl' && document.querySelector('main')?.innerText.includes(code), twenty.code, { timeout: 30000 })
    check('Persian checkout keeps the coupon and renders RTL', await page.locator('#of-coupon').getAttribute('dir') === 'ltr')
    await page.screenshot({ path: path.join(OUT, 'checkout-campaign-link-fa.png'), fullPage: true })
    await context.close()
    check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${results.length} coupon checkout checks passed`)
  } finally {
    await browser.close()
    await pool.end()
  }
})().catch(error => { console.error(error); process.exit(1) })
