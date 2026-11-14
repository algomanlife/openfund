/* Real SIWE, isolated test database and pointer-driven chart protection acceptance. */
const { chromium } = require('playwright')
const { createRequire } = require('node:module')
const fs = require('node:fs'), path = require('node:path')
const req = createRequire(path.resolve(__dirname, '../apps/backend/package.json'))
const { generatePrivateKey, privateKeyToAccount } = req('viem/accounts')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const API = (process.env.TEST_BACKEND_URL || BASE).replace(/\/$/, '')
if (!process.env.TEST_FRONTEND_URL || !process.env.TEST_BACKEND_URL || !['localhost', '127.0.0.1'].includes(new URL(BASE).hostname) || !['localhost', '127.0.0.1'].includes(new URL(API).hostname)) throw new Error('Explicit isolated localhost test URLs are required')
const OUT = path.resolve(__dirname, '../output/playwright/chart-protection')
fs.mkdirSync(OUT, { recursive: true })
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS - ' : 'FAIL - ') + name + (ok || !detail ? '' : ' :: ' + String(detail).slice(0, 400))) }
const wait = ms => new Promise(r => setTimeout(r, ms))

function installWallet(addresses) {
  const events = {}; let index = Number(sessionStorage.getItem('risk-wallet-index') || 0)
  let chain = sessionStorage.getItem('risk-wallet-chain') || '0xa4b1'
  let permitted = sessionStorage.getItem('risk-wallet-approved') === 'yes'
  const emit = (n, v) => (events[n] || []).forEach(fn => fn(v))
  const provider = { isRabby: true, on: (n, fn) => (events[n] ||= []).push(fn), removeListener: (n, fn) => events[n] = (events[n] || []).filter(x => x !== fn),
    request: async ({ method, params }) => {
      if (method === 'eth_accounts') return permitted ? [addresses[index]] : []
      if (method === 'eth_requestAccounts') { permitted = true; sessionStorage.setItem('risk-wallet-approved', 'yes'); return [addresses[index]] }
      if (method === 'eth_chainId') return chain
      if (method === 'net_version') return String(parseInt(chain, 16))
      if (method === 'wallet_switchEthereumChain') { chain = params[0].chainId; sessionStorage.setItem('risk-wallet-chain', chain); emit('chainChanged', chain); return null }
      if (method === 'personal_sign') return window.riskSign({ raw: params[0], index })
      if (method === 'eth_getBalance') return '0x0'
      if (method === 'eth_blockNumber') return '0x1'
      if (['wallet_requestPermissions', 'wallet_getPermissions'].includes(method)) return [{ parentCapability: 'eth_accounts' }]
      if (/^eth_(send|sign)Transaction$|^eth_sendRawTransaction$/.test(method)) throw new Error('Blockchain writes are forbidden in this test')
      return null
    } }
  window.riskWallet = { use: i => { index = i; sessionStorage.setItem('risk-wallet-index', String(i)); emit('accountsChanged', [addresses[i]]) } }
  const announce = () => dispatchEvent(new CustomEvent('eip6963:announceProvider', { detail: { info: { uuid: '7d1c0c52-2f1e-4f0e-9a3c-0b6f1e7d9a11', name: 'Rabby test signer', rdns: 'io.rabby', icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>' }, provider } }))
  addEventListener('eip6963:requestProvider', announce); announce()
}

async function newContext(browser, wallets, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport })
  await context.exposeFunction('riskSign', ({ raw, index }) => wallets[index].signMessage({ message: { raw } }))
  await context.addInitScript(installWallet, wallets.map(w => w.address))
  await context.route('http://localhost:8055/**', route => route.abort())
  return context
}
async function call(page, url, body, method) {
  return page.evaluate(async ({ url, body, method }) => {
    const r = await fetch(url, { method: method || (body ? 'POST' : 'GET'), credentials: 'include', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: body ? JSON.stringify(body) : undefined })
    return { status: r.status, data: await r.json().catch(() => null) }
  }, { url: API + url, body, method })
}
async function walletButton(page, name) {
  const button = page.getByRole('button', { name, exact: true, includeHidden: true }).first()
  await button.waitFor({ state: 'attached', timeout: 20000 })
  const menu = button.locator('xpath=ancestor::details[contains(@class,"rk-account-menu")]')
  if (await menu.count() && !await menu.evaluate(el => el.open)) await menu.locator('summary').click()
  return button
}
async function connectAndSignIn(page) {
  if (!await page.locator('[data-wallet-picker]').count()) await page.getByRole('button', { name: 'Connect Wallet', exact: true }).first().click()
  await page.locator('[data-wallet-picker] [data-wallet-id]').first().click()
  await (await walletButton(page, 'Sign in')).click()
  await (await walletButton(page, 'Account')).waitFor({ timeout: 20000 })
  await page.keyboard.press('Escape').catch(() => {})
}
async function liveMark(symbol) {
  const r = await fetch('https://api.gains.trade/v1/arbitrum/prices').then(x => x.json()).catch(() => null)
  const m = r?.data?.find(x => x.market === symbol)
  return m ? Number(m.mark) : null
}

;(async () => {
  const browser = await chromium.launch()
  const wallets = [privateKeyToAccount(generatePrivateKey())]
  const context = await newContext(browser, wallets)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  let pulse
  try {
    const gate = await fetch(API + '/internal/inject-price', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: 'BTC/USD', price: '65000', metadata: { base: 'BTC', group: 'crypto' } }) })
    if (!gate.ok) throw new Error('Isolated SIM_TEST_MODE database required before creating any test user')
    await page.goto(BASE + '/en/markets')
    await connectAndSignIn(page)
    const accounts = (await call(page, '/accounts')).data.accounts
    const trial = accounts.find(a => a.type === 'free_trial')
    if (!trial) throw new Error('Disposable practice account unavailable')
    const mark = await liveMark('BTC/USD')
    if (!mark) throw new Error('Live Gains reference price unavailable')
    const inject = () => call(page, '/internal/inject-price', { symbol: 'BTC/USD', price: String(mark), metadata: { base: 'BTC', group: 'crypto', maxLeverage: 100, pricePrecision: 2 } })
    await inject(); pulse = setInterval(() => inject().catch(() => {}), 1500)
    await page.goto(`${BASE}/en/prop/chart?account=${trial.id}`)
    await page.waitForFunction(() => window.__ofServerTP?.canTrade, null, { timeout: 30000 })
    const frame = page.frameLocator('iframe.of-trading-workspace')
    const state = async () => (await call(page, `/trading/state?account=${trial.id}`)).data.positions
    const waitFor = async fn => { for (let i = 0; i < 80; i++){ const s = await state(); if (fn(s)) return s; await wait(250) } throw new Error('Confirmed position state timed out') }
    const refresh = () => page.evaluate(() => dispatchEvent(new Event('of-refresh-trading')))
    const pointer = async (id, level, delta) => {
      const button = frame.locator(`[data-risk-drag="${id}"][data-level="${level}"]`)
      const b = await button.boundingBox()
      if (!b) throw new Error('Protection handle is not visible')
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
      await page.mouse.down()
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + delta, { steps: 12 })
      await frame.locator('#pos-risk-preview').waitFor({ timeout: 5000 })
      await page.mouse.up()
    }
    for (const side of ['long', 'short']) {
      const result = await call(page, `/trading/order?account=${trial.id}`, { market: 'BTC/USD', side, order_type: 'market', margin: 50, leverage: 5, target_price: null, sl: null, tp: null, product: 'prop', accountId: trial.id })
      if (![200,201].includes(result.status)) throw new Error('Order failed: ' + JSON.stringify(result.data))
      const p = (await state()).find(p => p.side === side && p.status === 'open')
      if (!p) throw new Error('Open position missing')
      await refresh()
      await frame.locator(`[data-risk-drag="${p.id}"][data-level="sl"]`).waitFor()
      await wait(1800)
      await pointer(p.id, 'sl', side === 'long' ? 65 : -65)
      let rows = await waitFor(rows => rows.find(r => r.id === p.id)?.sl_price != null)
      check(`${side}: create SL by pointer with no initial protection`, rows.find(r => r.id === p.id)?.tp_price == null)
      await pointer(p.id, 'tp', side === 'long' ? -90 : 90)
      rows = await waitFor(rows => rows.find(r => r.id === p.id)?.tp_price != null)
      const both = rows.find(r => r.id === p.id)
      check(`${side}: create TP while SL exists`, both.sl_price != null && both.tp_price != null)
      await pointer(p.id, 'sl', side === 'long' ? 15 : -15)
      await waitFor(rows => rows.find(r => r.id === p.id)?.sl_price !== both.sl_price)
      await pointer(p.id, 'tp', side === 'long' ? -15 : 15)
      await waitFor(rows => rows.find(r => r.id === p.id)?.tp_price !== both.tp_price)
      check(`${side}: move SL and TP`, true)
      await page.screenshot({ path: `${OUT}/${side}-both-en-light-1440.png` })
      if (side === 'long') {
        const baseline = (await state()).find(r => r.id === p.id).sl_price
        const handle = await frame.locator(`[data-risk-drag="${p.id}"][data-level="sl"]`).boundingBox()
        await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
        await page.mouse.down()
        await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 20, { steps: 5 })
        await page.keyboard.press('Escape'); await page.mouse.up(); await wait(400)
        check('Escape cancels pointer preview without changing server protection', (await state()).find(r => r.id === p.id).sl_price === baseline)
        await frame.getByRole('button', { name: 'Chart style — Candles', exact: true }).click()
        check('Footprint picker displays Beta badge', await frame.locator('[data-vei-id="footprint"] .of-chart-beta').textContent() === 'Beta')
        await frame.locator('[data-vei-id="footprint"]').click()
        check('Footprint remains selectable', await frame.getByRole('button', { name: 'Chart style — Footprint · Beta', exact: true }).count() === 1)
        await frame.getByRole('button', { name: 'Chart style — Footprint · Beta', exact: true }).click()
        await frame.locator('[data-vei-id="candles"]').click()
        for (const locale of ['en', 'fa']) for (const theme of ['light', 'dark']) {
          await page.evaluate(theme => { localStorage.setItem('of-theme', theme); localStorage.setItem('of-theme-choice', theme) }, theme)
          await page.goto(`${BASE}/${locale}/prop/chart?account=${trial.id}`)
          for (const width of [1440, 1024, 768, 390, 360]) {
            await page.setViewportSize({ width, height: 900 })
            await frame.locator(`[data-pos-rr-toggle="${p.id}"]`).waitFor()
            const toggle = frame.locator(`[data-pos-rr-toggle="${p.id}"]`)
            if (width < 650 && await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
            await wait(350)
            const box = await frame.locator(`[data-pos-rr="${p.id}"]`).boundingBox()
            check(`${locale}/${theme}/${width}: protection controls fit viewport`, box && box.x >= 0 && box.x + box.width <= width + 1, JSON.stringify(box))
            await page.screenshot({ path: `${OUT}/protection-${locale}-${theme}-${width}.png` })
          }
        }
        await page.setViewportSize({ width: 390, height: 900 })
        const toggle = frame.locator(`[data-pos-rr-toggle="${p.id}"]`)
        if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
        const touch = await context.newCDPSession(page)
        await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
        const button = frame.locator(`[data-risk-drag="${p.id}"][data-level="sl"]`)
        const box = await button.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2
        const previous = (await state()).find(r => r.id === p.id).sl_price
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
        await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 20 }] })
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await waitFor(rows => rows.find(r => r.id === p.id)?.sl_price !== previous)
        check('mobile: native touch drag updates only SL', true)
        await touch.send('Emulation.setTouchEmulationEnabled', { enabled: false })
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto(`${BASE}/en/prop/chart?account=${trial.id}`)
        await frame.locator(`[data-risk-remove="${p.id}"][data-level="sl"]`).waitFor()
      }
      await frame.locator(`[data-risk-remove="${p.id}"][data-level="sl"]`).click()
      rows = await waitFor(rows => rows.find(r => r.id === p.id)?.sl_price == null)
      check(`${side}: remove only SL`, rows.find(r => r.id === p.id)?.tp_price != null)
      await pointer(p.id, 'sl', side === 'long' ? 65 : -65)
      rows = await waitFor(rows => rows.find(r => r.id === p.id)?.sl_price != null)
      check(`${side}: recreate SL from TP-only state`, rows.find(r => r.id === p.id)?.tp_price != null)
      await frame.locator(`[data-risk-remove="${p.id}"][data-level="sl"]`).click()
      await waitFor(rows => rows.find(r => r.id === p.id)?.sl_price == null)
      await frame.locator(`[data-risk-remove="${p.id}"][data-level="tp"]`).click()
      rows = await waitFor(rows => rows.find(r => r.id === p.id)?.tp_price == null)
      check(`${side}: remove TP without closing position`, rows.some(r => r.id === p.id && r.sl_price == null && r.tp_price == null))
      await page.reload()
      await frame.locator(`[data-risk-drag="${p.id}"][data-level="sl"]`).waitFor()
      check(`${side}: reload restores confirmed empty levels`, await frame.locator(`[data-risk-remove="${p.id}"]`).count() === 0)
      await call(page, `/trading/positions/${p.id}/close?account=${trial.id}`, { fraction: 1, accountId: trial.id, product: 'prop' })
      await refresh()
    }
    check('no browser runtime errors', errors.length === 0, errors.join('; '))
  } catch(error) { check('browser chart protection acceptance', false, error.stack); await page.screenshot({ path: `${OUT}/failure.png` }).catch(() => {}) }
  finally {
    clearInterval(pulse); fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2)); await browser.close()
    if (results.some(r => !r.ok)) process.exitCode = 1
  }
})()
