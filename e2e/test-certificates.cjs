/* Real local API/PostgreSQL + generated disposable signer. Never production. */
const { chromium } = require('playwright')
const { createRequire } = require('node:module')
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto')
const backend = createRequire(path.resolve(__dirname, '../apps/backend/package.json'))
const web = createRequire(path.resolve(__dirname, '../apps/web-react/package.json'))
const { privateKeyToAccount, generatePrivateKey } = backend('viem/accounts')
const { createSiweMessage } = backend('viem/siwe')
const { Pool } = backend('pg')
const { PNG } = web('pngjs')
const BASE = process.env.TEST_FRONTEND_URL || 'http://127.0.0.1:55448'
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE) || !/test|_ci/.test(process.env.DATABASE_URL || '')) throw new Error('Local server and isolated test DATABASE_URL required')
const OUT = path.resolve(__dirname, '../output/playwright/certificates')
fs.mkdirSync(OUT, { recursive: true })
const results = []
const check = (name, condition) => { assert.ok(condition, name); results.push(name); console.log('PASS - ' + name) }
;(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const wallet = privateKeyToAccount(generatePrivateKey())
  const api = async (route, body, cookie) => {
    const r = await fetch(BASE + route, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    return { status: r.status, body: await r.json(), cookie: r.headers.get('set-cookie') }
  }
  const nonce = await api('/auth/nonce', { address: wallet.address })
  const message = createSiweMessage({ domain: new URL(BASE).host, address: wallet.address, uri: BASE + '/', chainId: 42161, nonce: nonce.body.nonce, version: '1' })
  const login = await api('/auth/verify', { message, signature: await wallet.signMessage({ message }) })
  assert.equal(login.status, 200)
  const cookie = login.cookie.split(';')[0], cookieValue = cookie.split('=')[1]
  const user = (await pool.query('SELECT id FROM openfund_users WHERE wallet_address=$1', [wallet.address.toLowerCase()])).rows[0].id
  const plan = (await pool.query('INSERT INTO challenge_plans (slug,name) VALUES ($1,$2) RETURNING id', ['certificate-browser-' + crypto.randomUUID(), 'Acceptance test challenge'])).rows[0].id
  const order = (await pool.query(`INSERT INTO purchase_orders (user_id,challenge_plan_id,account_size_usd,price_usd,status,paid_at) VALUES ($1,$2,10000,100,'paid',now()) RETURNING id`, [user, plan])).rows[0].id
  const challenge = (await pool.query(`INSERT INTO openfund_challenges (user_id,challenge_plan_id,purchase_order_id,account_size_usd,status,completed_at) VALUES ($1,$2,$3,10000,'passed',now()) RETURNING id`, [user, plan, order])).rows[0].id
  const funded = (await pool.query(`INSERT INTO openfund_challenges (user_id,challenge_plan_id,account_size_usd,funded_from_challenge_id) VALUES ($1,$2,10000,$3) RETURNING id`, [user, plan, challenge])).rows[0].id
  await pool.query(`INSERT INTO challenge_reviews (challenge_id,decision,actor,funded_challenge_id) VALUES ($1,'approved','admin:isolated browser test',$2)`, [challenge, funded])
  await pool.query(`INSERT INTO withdrawal_requests (user_id,challenge_id,amount_usd,status,payout_ref,reviewed_at) VALUES ($1,$2,123.45,'paid','isolated-browser-test-only',now())`, [user, challenge])
  const browser = await chromium.launch(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {})
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    await context.addCookies([{ name: 'openfund_session', value: cookieValue, url: BASE, httpOnly: true, sameSite: 'Lax' }])
    await context.addInitScript(address => {
      const events = {}, provider = { isRabby: true, on: (n, f) => (events[n] ||= []).push(f), removeListener: (n, f) => events[n] = (events[n] || []).filter(x => x !== f), request: async ({ method }) => {
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [address]
        if (method === 'eth_chainId') return '0xa4b1'
        if (method === 'net_version') return '42161'
        return null
      } }
      const announce = () => dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { uuid: 'certificate-qa', name: 'Certificate test wallet', rdns: 'io.rabby', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>' }, provider } }))
      addEventListener('eip6963:requestProvider', announce); announce()
    }, wallet.address)
    const page = await context.newPage()
    await page.goto(BASE + '/en/prop/certificates')
    await page.waitForTimeout(1500)
    if (!await page.locator('#certificate-name').count()) {
      await page.screenshot({ path: path.join(OUT, 'before-connect.png') })
      console.log('Before connection:', (await page.locator('main').innerText()).slice(0, 1000))
      await page.getByRole('button', { name: 'Connect Wallet', exact: true }).first().click()
      await page.locator('[data-wallet-picker] [data-wallet-id]').first().click()
    }
    await page.getByLabel('Certificate display name (optional)').waitFor({ timeout: 20000 })
    await page.getByLabel('Certificate display name (optional)').fill('آزمایش‌گر گواهی')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Confirm my permanent choice', exact: true }).click()
    await page.locator('.of-certificate-preview').nth(2).waitFor({ timeout: 20000 })
    check('UI name confirmation creates all three eligible server certificates', await page.locator('.of-certificate-preview').count() === 3)
    check('UI removes name editor after confirmation', await page.locator('#certificate-name').count() === 0)
    await page.reload(); await page.locator('.of-certificate-preview').nth(2).waitFor({ timeout: 20000 })
    check('Confirmed certificates survive reload', true)
    const data = (await api('/certificates', null, cookie)).body.certificates
    const publicPage = await (await browser.newContext()).newPage()
    for (const locale of ['en', 'fa']) for (const theme of ['light', 'dark']) {
      await publicPage.addInitScript(theme => { localStorage.setItem('of-theme', theme); localStorage.setItem('of-theme-choice', theme) }, theme)
      for (const width of [1440, 1024, 768, 390, 360]) {
        await publicPage.setViewportSize({ width, height: 1000 })
        await publicPage.goto(BASE + `/${locale}/certificate-verification?serial=${data.find(c => c.kind === 'completion').serial}`)
        const label = locale === 'fa' ? 'دریافت تصویر' : 'Download image'
        await publicPage.getByRole('button', { name: label, exact: true }).waitFor()
        await publicPage.waitForFunction(() => !document.querySelector('.of-certificate-actions button')?.disabled)
        check(`${locale}/${theme}/${width}: public verified certificate without overflow`, await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
        await publicPage.screenshot({ path: path.join(OUT, `${locale}-${theme}-${width}.png`), fullPage: true })
      }
      const pngName = locale === 'fa' ? 'دریافت تصویر' : 'Download image', pdfName = locale === 'fa' ? 'دریافت PDF' : 'Download PDF'
      const [png] = await Promise.all([publicPage.waitForEvent('download'), publicPage.getByRole('button', { name: pngName, exact: true }).click()])
      const pngPath = path.join(OUT, `${locale}-${theme}.png`); await png.saveAs(pngPath)
      const [pdf] = await Promise.all([publicPage.waitForEvent('download'), publicPage.getByRole('button', { name: pdfName, exact: true }).click()])
      const pdfPath = path.join(OUT, `${locale}-${theme}.pdf`); await pdf.saveAs(pdfPath)
      const image = PNG.sync.read(fs.readFileSync(pngPath))
      const { default: decode } = await import('../apps/web-react/node_modules/qr/decode.js')
      check(`${locale}/${theme}: exported PNG QR resolves to actual serial`, decode({ width: image.width, height: image.height, data: image.data }) === publicPage.url())
      check(`${locale}/${theme}: PNG is 2400 × 1600`, image.width === 2400 && image.height === 1600)
      check(`${locale}/${theme}: PDF is generated`, fs.readFileSync(pdfPath).subarray(0, 8).toString() === '%PDF-1.4')
    }
    for (const c of data) {
      await publicPage.goto(BASE + `/en/certificate-verification?serial=${c.serial}`)
      await publicPage.waitForFunction(() => !document.querySelector('.of-certificate-actions button')?.disabled)
      await publicPage.locator('canvas').screenshot({ path: path.join(OUT, `design-${c.kind}.png`) })
      check(`Public lookup renders ${c.kind} design`, await publicPage.locator('canvas').count() === 1)
    }
    await publicPage.goto(BASE + '/en/certificate-verification?serial=' + 'a'.repeat(32))
    await publicPage.getByRole('heading', { name: 'Certificate not found', exact: true }).waitFor()
    check('Unknown serial shows not found, not a decorative certificate', await publicPage.locator('canvas').count() === 0)
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ source: 'isolated PostgreSQL fixtures + real local API and disposable SIWE', results }, null, 2))
  } finally { await browser.close(); await pool.end() }
})().catch(error => { console.error(error); process.exit(1) })
