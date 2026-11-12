/**
 * Coupon administration acceptance — real Directus Data Studio + real
 * Openfund checkout, on disposable local services only.
 *
 *  1. an authorized Commerce Admin logs in to the Directus UI, creates a 100%
 *     internal test coupon restricted to one test customer and one challenge
 *     model, and activates it;
 *  2. the test customer (generated wallet, SIWE) applies it in the checkout;
 *     a zero-cost order is created and the challenge account provisioned;
 *  3. the account appears in the customer's dashboard data (/auth/me);
 *  4. the redemption and the order are visible on the coupon in Directus;
 *  5. reusing the exhausted coupon is rejected;
 *  6. a non-admin Directus user cannot read or create coupons, and anonymous
 *     access is refused.
 *
 * Needs: Directus with the CMS bootstrap applied (incl.
 * register_commerce_tables.py) and the Openfund server on the SAME
 * disposable database. Env: TEST_FRONTEND_URL, DIRECTUS_URL,
 * DIRECTUS_ADMIN_EMAIL, DIRECTUS_ADMIN_PASSWORD, DATABASE_URL (name contains
 * test/ci), OUTPUT_DIR (screenshots). Never point it at production.
 */
const { chromium } = require('playwright')
const crypto = require('node:crypto')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const { walletInitScript, connect, signIn, makeCall } = require('./helpers/wallet-ui.cjs')
const backendRequire = createRequire(path.join(__dirname, '../apps/backend/package.json'))

const BASE = (process.env.TEST_FRONTEND_URL || '').replace(/\/$/, '')
const CMS = (process.env.DIRECTUS_URL || '').replace(/\/$/, '')
const OUT = process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/directus-coupons')
for (const [k, v] of Object.entries({ BASE, CMS, db: process.env.DATABASE_URL }))
  if (!v) throw Error(`missing ${k}`)
if (![BASE, CMS].every(u => ['localhost', '127.0.0.1'].includes(new URL(u).hostname))) throw Error('local services only')
if (!/(?:^|[_-])(test|ci)(?:$|[_-])/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) throw Error('disposable test database only')
fs.mkdirSync(OUT, { recursive: true })

const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${ok ? '' : ' ' + detail}`); assert.ok(ok, name + ' ' + detail) }
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false })

async function cms(method, p, token, body) {
  const r = await fetch(CMS + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const text = await r.text()
  let data = null; try { data = JSON.parse(text) } catch { /* empty */ }
  return { status: r.status, data }
}

async function main() {
  const { privateKeyToAccount, generatePrivateKey } = backendRequire('viem/accounts')
  const pg = backendRequire('pg')
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })

  /* ---- setup (Directus REST as the instance administrator): two Directus
     users only — a Commerce Admin and a non-admin editor. Coupons are NOT
     created here; step 1 creates the coupon in the UI. ---- */
  const admin = (await cms('POST', '/auth/login', null, { email: process.env.DIRECTUS_ADMIN_EMAIL, password: process.env.DIRECTUS_ADMIN_PASSWORD })).data.data.access_token
  const roles = (await cms('GET', '/roles?limit=-1', admin)).data.data
  const commerceRole = roles.find(r => r.name === 'Commerce Admin')
  check('Commerce Admin role exists (register_commerce_tables.py)', !!commerceRole)
  let editorRole = roles.find(r => r.name === 'Acceptance editor (no commerce)')
  if (!editorRole) {
    editorRole = (await cms('POST', '/roles', admin, { name: 'Acceptance editor (no commerce)', icon: 'edit' })).data.data
    const pol = (await cms('POST', '/policies', admin, { name: 'Acceptance editor app access', app_access: true, admin_access: false })).data.data
    await cms('POST', '/access', admin, { role: editorRole.id, policy: pol.id })
  }
  const run = crypto.randomBytes(3).toString('hex')
  const commerceUser = { email: `commerce-${run}@example.com`, password: crypto.randomBytes(12).toString('hex') }
  const editorUser = { email: `editor-${run}@example.com`, password: crypto.randomBytes(12).toString('hex') }
  await cms('POST', '/users', admin, { ...commerceUser, first_name: 'Commerce', last_name: 'Admin', role: commerceRole.id })
  await cms('POST', '/users', admin, { ...editorUser, first_name: 'Content', last_name: 'Editor', role: editorRole.id })

  const browser = await chromium.launch()
  const wallet = privateKeyToAccount(generatePrivateKey())
  const customer = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await customer.exposeFunction('purchaseSign', ({ raw }) => wallet.signMessage({ message: { raw } }))
  await customer.addInitScript(walletInitScript, wallet.address)
  const cpage = await customer.newPage()
  const call = makeCall(cpage, BASE)
  try {
    /* ---- 0. the test customer signs in once (creates the Openfund account) ---- */
    await cpage.goto(BASE + '/en/challenges'); await cpage.waitForTimeout(2500)
    await connect(cpage); await signIn(cpage)
    const me0 = await call('/auth/me')
    check('test customer signed in with SIWE on Arbitrum', me0.status === 200)
    const customerId = me0.data.user.id

    /* ---- 1. Directus UI: Commerce Admin creates + activates the coupon ---- */
    const admCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const apage = await admCtx.newPage()
    await apage.goto(CMS + '/admin/login')
    await apage.locator('input[type="email"]').fill(commerceUser.email)
    await apage.locator('input[type="password"]').fill(commerceUser.password)
    await apage.locator('button[type="submit"]').click()
    await apage.waitForURL(/\/admin\/(content|users|insights)/, { timeout: 30000 })
    check('Commerce Admin logs in to the Directus Data Studio', true)
    await apage.goto(CMS + '/admin/content/coupons'); await apage.waitForTimeout(1500)
    await shot(apage, '01-directus-coupons-list')
    await apage.goto(CMS + '/admin/content/coupons/+'); await apage.waitForTimeout(1500)
    const field = label => apage.locator('.field').filter({ has: apage.locator('.field-label', { hasText: new RegExp(`^\\s*${label}`, 'i') }) }).first()
    const code = `OPENFUND-INTERNAL-TEST-${run.toUpperCase()}`
    await field('Code').locator('.interface input').fill(code)
    await field('Name').locator('.interface input').fill('Internal acceptance test (100%)')
    const pick = async (label, option) => { await field(label).locator('.interface .v-input').first().click(); await apage.locator('.v-menu-content .v-list-item', { hasText: option }).first().click() }
    await pick('Kind', 'Percentage')
    await field('Value').locator('.interface input').fill('100')
    await pick('Status', 'Active')
    await field('Internal').locator('.interface .v-checkbox, .interface button').first().click()
    await field('Max Redemptions').locator('.interface input').fill('1')
    /* M2M: allowed customer + eligible challenge model, chosen from existing rows */
    const addExisting = async (label, rowText) => {
      await field(label).locator('button', { hasText: /add existing/i }).click()
      const drawer = apage.locator('.v-drawer').last()
      await drawer.waitFor()
      /* the drawer search box is collapsed behind its icon until clicked */
      const searchIcon = drawer.locator('.search-input .icon-search').first()
      if (await searchIcon.count()) {
        await searchIcon.click()
        await drawer.locator('.search-input input').first().fill(rowText); await apage.waitForTimeout(900)
      }
      await drawer.locator('.table-row, tr').filter({ hasText: rowText }).first().click()
      await drawer.locator('.header-bar .v-button, button.action-button, [class*="actions"] button').last().click()
      await apage.waitForTimeout(600)
    }
    await addExisting('Allowed Customers', wallet.address.toLowerCase().slice(0, 14))
    await addExisting('Challenge Models', 'standard')
    await shot(apage, '02-directus-coupon-form')
    await apage.locator('.header-bar button:has(i[data-icon="check"])').first().click()
    await apage.waitForTimeout(2000)
    const created = (await db.query('SELECT * FROM coupons WHERE code=$1', [code])).rows[0]
    check('coupon saved through the Directus UI', !!created, code)
    check('coupon is active, 100%, internal, limited to 1', created && created.status === 'active' && created.kind === 'percent' && Number(created.value) === 100 && created.internal && created.max_redemptions === 1)
    const restr = (await db.query('SELECT (SELECT array_agg(user_id::text) FROM coupon_allowed_users WHERE coupon_id=$1) AS users, (SELECT array_agg(p.slug) FROM coupon_challenge_plans j JOIN challenge_plans p ON p.id=j.challenge_plan_id WHERE j.coupon_id=$1) AS plans', [created.id])).rows[0]
    check('restricted to the test customer and the Standard model', JSON.stringify(restr.users) === JSON.stringify([customerId]) && JSON.stringify(restr.plans) === '["standard"]', JSON.stringify(restr))
    const audit = (await db.query('SELECT actor, action FROM coupon_audit WHERE coupon_id=$1 ORDER BY id', [created.id])).rows
    check('creation audited with the Directus user', audit[0]?.action === 'created' && /^directus:/.test(audit[0]?.actor), JSON.stringify(audit))

    /* ---- 2. checkout applies it; zero-cost order + provisioning ---- */
    await cpage.goto(BASE + '/en/challenges'); await cpage.waitForTimeout(2500)
    await connect(cpage); await signIn(cpage)
    const sizes = cpage.locator('#builder-sizes button'); await sizes.first().waitFor({ state: 'attached' })
    await sizes.nth(1).click()
    await cpage.locator('#review-selection').click()
    await cpage.locator('#selection-dialog[open], dialog[open]').first().waitFor()
    await cpage.locator('#dialog-done').click()
    /* the selection hands off to the dedicated checkout page (full navigation) */
    await cpage.waitForURL(/\/en\/checkout\?plan=[^&]+&size=\d+/, { timeout: 10000, waitUntil: 'load' })
    await cpage.getByRole('heading', { name: 'Buy a Challenge', level: 1 }).waitFor({ timeout: 10000 })
    await connect(cpage); await signIn(cpage)
    await cpage.getByLabel('Email for the receipt').fill('coupon-buyer@example.test')
    await cpage.locator('.of-co-accept input').check()
    await cpage.locator('#of-coupon').fill(code.toLowerCase())
    await cpage.getByRole('button', { name: 'Apply', exact: true }).click()
    await cpage.getByText('With this coupon the challenge is activated without payment.').waitFor({ timeout: 8000 })
    await shot(cpage, '03-checkout-coupon-applied')
    check('checkout shows the server quote: $0.00 due', (await cpage.locator('.of-checkout-summary').innerText()).includes('$0'))
    await cpage.getByRole('button', { name: 'Activate challenge' }).click()
    await cpage.locator('.of-co-receipt').waitFor({ timeout: 15000 })
    await shot(cpage, '04-checkout-activated')
    const order = (await db.query('SELECT * FROM purchase_orders WHERE coupon_id=$1', [created.id])).rows[0]
    check('zero-cost order provisioned, recorded as internal coupon, no payment', order && order.lifecycle_state === 'provisioned' && order.payment_method === 'internal_coupon' && order.price_usd === '0.00'
      && (await db.query('SELECT count(*)::int n FROM payments WHERE purchase_order_id=$1', [order.id])).rows[0].n === 0)

    /* ---- 3. dashboard ---- */
    const me = await call('/auth/me')
    check('challenge account appears for the customer', (me.data.challenges || []).some(c => c.purchase_order_id === order.id))
    await cpage.goto(BASE + '/en/prop/dashboard'); await cpage.waitForTimeout(3000)
    await shot(cpage, '05-customer-dashboard')

    /* ---- 4. Directus shows the redemption + order on the coupon ---- */
    await apage.goto(CMS + `/admin/content/coupons/${created.id}`); await apage.waitForTimeout(2500)
    await apage.locator('.field').filter({ hasText: /Redemptions/i }).first().scrollIntoViewIfNeeded()
    await shot(apage, '06-directus-coupon-redemption')
    const redemptionText = await apage.locator('.field').filter({ has: apage.locator('.field-label', { hasText: /^\s*Redemptions/i }) }).first().innerText()
    check('redemption visible on the coupon in Directus', /consumed/i.test(redemptionText), redemptionText.slice(0, 200))
    await apage.goto(CMS + '/admin/content/coupon_redemptions'); await apage.waitForTimeout(1500)
    await shot(apage, '07-directus-redemptions')

    /* ---- 5. reuse rejected ---- */
    const reuse = await call('/purchases/quote', { planSlug: 'standard', accountSize: 10000, couponCode: code })
    check('reusing the exhausted coupon is rejected', reuse.status === 409 && ['coupon_exhausted', 'coupon_already_used'].includes(reuse.data.error), JSON.stringify(reuse.data))

    /* ---- 6. non-admin + anonymous ---- */
    const ed = (await cms('POST', '/auth/login', null, editorUser)).data.data.access_token
    check('non-admin Directus user cannot read coupons', (await cms('GET', '/items/coupons', ed)).status === 403)
    check('non-admin Directus user cannot create coupons', (await cms('POST', '/items/coupons', ed, { code: `NOPE-${run}`, kind: 'percent', value: 100 })).status === 403)
    check('anonymous access to coupons and redemptions is refused', (await cms('GET', '/items/coupons')).status === 403 && (await cms('GET', '/items/coupon_redemptions')).status === 403)
    const edCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const epage = await edCtx.newPage()
    await epage.goto(CMS + '/admin/login')
    await epage.locator('input[type="email"]').fill(editorUser.email)
    await epage.locator('input[type="password"]').fill(editorUser.password)
    await epage.locator('button[type="submit"]').click()
    await epage.waitForTimeout(3000)
    await epage.goto(CMS + '/admin/content/coupons'); await epage.waitForTimeout(2000)
    await shot(epage, '08-directus-non-admin-denied')
    check('non-admin UI shows no coupon data', !(await epage.content()).includes(code))
  } finally {
    await browser.close(); await db.end()
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ results, at: new Date().toISOString(), base: BASE, cms: CMS }, null, 2))
  }
  console.log(`\n${results.length} passed`)
}
main().catch(e => { console.error(e); process.exit(1) })
