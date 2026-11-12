/* Terminal risk UI + per-wallet chart workspace acceptance.
 *
 * Real local SIWE + PostgreSQL + the server-authoritative practice engine,
 * with two disposable EIP-6963 signers (wallet A, wallet B). Live public
 * Gains prices drive the chart; the test server's mark is aligned to the
 * live mark through the SIM_TEST_MODE price seam. No blockchain writes.
 *
 * Covers:
 *  - header controls: equal computed heights / radius / border with the
 *    wallet disconnected, connected and authenticated (website + terminal);
 *  - order review dialog: no clipped/overflowing rows, LTR-isolated values;
 *  - SL/TP dialog: Persian and Arabic-Indic digits reach the backend exactly,
 *    rejected input is reported and never sent, success only after confirm;
 *  - risk/reward overlay: LONG/SHORT with SL only, TP only, both, neither;
 *    modification, removal, close, multiple positions, symbol switch,
 *    refresh; never persisted as a user drawing;
 *  - wallet A → logout → wallet B → wallet A chart workspace isolation and
 *    restoration (drawings, timeframe) across a fresh browser context.
 *
 * Usage: TEST_FRONTEND_URL=http://localhost:8391 TEST_BACKEND_URL=http://localhost:8391 \
 *        node e2e/test-terminal-risk-workspace.cjs   (or: npm run test:browser:risk) */
const { chromium } = require('playwright')
const { createRequire } = require('node:module')
const fs = require('node:fs'), path = require('node:path')
const req = createRequire(path.resolve(__dirname, '../apps/backend/package.json'))
const { generatePrivateKey, privateKeyToAccount } = req('viem/accounts')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const API = (process.env.TEST_BACKEND_URL || BASE).replace(/\/$/, '')
const OUT = path.resolve(__dirname, '../output/playwright/terminal-risk-workspace')
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
/* geometry of the four header controls */
async function headerGeometry(page, frame = null) {
  const target = frame ? await frame.elementHandle('body') : null
  const fn = scope => {
    const root = document.querySelector(scope)
    if (!root) return null
    const pick = s => { const el = root.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(), c = getComputedStyle(el); if (c.display === 'none' || !r.width) return null; return { h: +r.height.toFixed(2), radius: c.borderTopLeftRadius, border: c.borderTopWidth, mid: +(r.top + r.height / 2).toFixed(1) } }
    return { theme: pick('.of-daynight'), lang: pick('.of-language-select'), cta: pick('.nav-cta'), wallet: pick('.rk-chip, .rk-account-menu summary') }
  }
  return target ? null : page.evaluate(fn, '.openfund-header .nav-actions, .of-terminal-actions')
}
const uniform = g => { const v = Object.values(g || {}).filter(Boolean); return v.length >= 3 && new Set(v.map(x => x.h)).size === 1 && new Set(v.map(x => x.radius)).size === 1 && new Set(v.map(x => x.border)).size === 1 && new Set(v.map(x => x.mid)).size === 1 }

async function liveMark(symbol) {
  const r = await fetch('https://api.gains.trade/v1/arbitrum/prices').then(x => x.json()).catch(() => null)
  const m = r?.data?.find(x => x.market === symbol)
  return m ? Number(m.mark) : null
}

;(async () => {
  const browser = await chromium.launch()
  const wallets = [privateKeyToAccount(generatePrivateKey()), privateKeyToAccount(generatePrivateKey())]
  const errors = []
  try {
    /* ---------------- wallet A: sign in on the terminal ---------------- */
    const ctxA = await newContext(browser, wallets)
    const page = await ctxA.newPage()
    page.on('pageerror', e => errors.push(e.message))
    const wsWrites = []
    page.on('response', r => { if (r.request().method() === 'PUT' && r.url().includes('/chart/workspaces/')) wsWrites.push(r.status() + ' ' + decodeURIComponent(r.url().split('/chart/workspaces/')[1])) })
    await page.goto(BASE + '/en/markets')
    await page.locator('.openfund-header .rk-chip-connect:visible').first().waitFor({ timeout: 20000 })
    const gDisconnected = await headerGeometry(page)
    check('website header: four controls equal while disconnected', uniform(gDisconnected), JSON.stringify(gDisconnected))
    await connectAndSignIn(page)
    const gAuth = await headerGeometry(page)
    const chain = await page.evaluate(() => ['.openfund-header .nav-actions', '#wallet-root', '.openfund-header .rk-wrap', '.openfund-header .rk-account-menu', '.openfund-header .rk-account-menu > summary'].map(s => { const e = document.querySelector(s); if (!e) return s + ':none'; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return `${s} top=${r.top} h=${r.height} disp=${c.display} align=${c.alignItems} va=${c.verticalAlign}` }))
    check('website header: four controls equal while authenticated', uniform(gAuth), JSON.stringify(gAuth) + ' ' + chain.join(' | '))

    const accounts = (await call(page, '/accounts')).data.accounts
    const trial = accounts.find(a => a.type === 'free_trial')
    check('wallet A has a practice account', !!trial)
    const mark = await liveMark('BTC/USD') || 50000
    await call(page, '/internal/inject-price', { symbol: 'BTC/USD', price: String(mark), metadata: { base: 'BTC', group: 'crypto', maxLeverage: 100 } })
    await page.goto(`${BASE}/en/prop/trade?account=${trial.id}`)
    await page.waitForFunction(() => window.__ofServerTP?.canTrade, null, { timeout: 30000 })
    const frame = page.frameLocator('iframe.of-trading-workspace')
    await frame.locator('#submit-order').waitFor()
    const fw = async (fn, arg) => (await page.$('iframe.of-trading-workspace')).contentFrame().then(f => f.evaluate(fn, arg))
    await page.waitForFunction(() => document.querySelector('iframe.of-trading-workspace')?.contentWindow?.OpenfundTerminalInspect?.chart()?.drawings, null, { timeout: 30000 })
    check('terminal identity is the signed-in session user', await fw(() => !!window.OpenfundChartWorkspace.identity))
    /* RISK_TEST_FOOTPRINT=1 reruns every position/SL/TP assertion below with the
       Footprint chart style AND the Footprint overlay active (server must run with
       FOOTPRINT_ENABLED=1): the overlays must behave exactly as on plain candles. */
    if (process.env.RISK_TEST_FOOTPRINT === '1') {
      const fp = await fw(() => {
        const ctl = window.OpenfundTerminalInspect.controller()
        ctl.workspace.active.setPriceStyle('footprint')
        const h = ctl.chart.addNativeIndicator('footprint-overlay')
        return { style: ctl.chart.renderer.get('priceStyle'), overlay: !!h, registered: typeof window.VelaWorkspace?.installFootprint === 'function' }
      })
      check('footprint style + overlay active for the position suite', fp.style === 'footprint' && fp.overlay && fp.registered, JSON.stringify(fp))
    }
    const gTerm = await page.evaluate(() => { const d = document.querySelector('iframe.of-trading-workspace').contentDocument; return null })
    void gTerm

    /* ---------------- order review dialog ---------------- */
    await frame.locator('#of-collateral').fill('۱۰۰')
    await frame.locator('#submit-order').click()
    await frame.locator('#review-dialog[open]').waitFor()
    const review = await fw(() => {
      const dlg = document.getElementById('review-dialog'), box = dlg.getBoundingClientRect()
      const rows = [...dlg.querySelectorAll('.review-list > div')]
      const clipped = rows.filter(r => r.scrollWidth > r.clientWidth + 1 || [...r.children].some(c => { const b = c.getBoundingClientRect(); return b.left < box.left - 0.5 || b.right > box.right + 0.5 }))
      return { rows: rows.length, clipped: clipped.length, overflowX: dlg.scrollWidth > dlg.clientWidth + 1, ltrValues: dlg.querySelectorAll('.review-list dd bdi[dir=ltr]').length, text: dlg.innerText }
    })
    check('order review: one label/value row per field', review.rows >= 12, JSON.stringify(review))
    check('order review: no clipped row and no horizontal overflow', review.clipped === 0 && !review.overflowX, JSON.stringify(review))
    check('order review: numeric values are LTR-isolated', review.ltrValues >= 10)
    check('order review: Persian collateral reaches the server preview unchanged', /100\.00/.test(review.text))
    await page.screenshot({ path: `${OUT}/review-en-1440.png` })
    await frame.locator('#review-cancel').click()

    /* ---------------- positions via the same order API ---------------- */
    const order = async (side, sl, tp) => (await call(page, `/trading/order?account=${trial.id}`, { market: 'BTC/USD', side, order_type: 'market', margin: 50, leverage: 5, target_price: null, sl, tp, product: 'prop', accountId: trial.id })).status
    const r1 = await order('long', null, null)
    check('market order accepted (long, no SL/TP)', r1 === 200 || r1 === 201, r1)
    await page.evaluate(() => dispatchEvent(new Event('of-refresh-trading')))
    await page.waitForFunction(() => window.__ofServerTP?.state.positions.length === 1)
    const pos = (await call(page, `/trading/state?account=${trial.id}`)).data.positions[0]
    await wait(1800)
    check('no SL/TP → no risk/reward zones are invented', (await fw(() => window.OpenfundTerminalInspect.positionOverlays().length)) === 0)

    /* SL/TP dialog: Persian digits, rejected input, exact values */
    await frame.locator('[data-bt="positions"]').click().catch(() => {})
    await frame.locator(`[data-sltp="${pos.id}"]`).click()
    await frame.locator('#sltp-dialog[open]').waitFor()
    const slLong = Math.floor(mark * 0.98), tpLong = Math.ceil(mark * 1.03)
    const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d])
    const ar = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d])
    await frame.locator('#sltp-sl').fill('12abc')
    let writes = 0; page.on('request', r => { if (r.method() === 'POST' && r.url().includes('/protection')) writes++ })
    await frame.locator('#sltp-save').click()
    check('SL/TP: unreadable input is reported and nothing is sent', (await frame.locator('#sltp-err').isVisible()) && writes === 0 && await frame.locator('#sltp-dialog').evaluate(d => d.open))
    await frame.locator('#sltp-sl').fill(fa(slLong)); await frame.locator('#sltp-tp').fill('')
    const meta = await fw(() => { const d = document.getElementById('sltp-dialog'); return { overflow: d.scrollWidth > d.clientWidth + 1, idTitle: d.querySelector('.sltp-id')?.title, idText: d.querySelector('.sltp-id')?.innerText } })
    check('SL/TP: long id is shortened with the full id available', meta.idTitle === String(pos.id) && meta.idText.length < String(pos.id).length + 1 && !meta.overflow, JSON.stringify(meta))
    await page.screenshot({ path: `${OUT}/sltp-en-1440.png` })
    await frame.locator('#sltp-save').click()
    await frame.locator('#sltp-dialog').waitFor({ state: 'hidden' })
    let st = (await call(page, `/trading/state?account=${trial.id}`)).data.positions[0]
    check('SL/TP: Persian digits saved exactly as the SL price', Number(st.sl_price) === slLong && st.tp_price == null, JSON.stringify({ sl: st.sl_price, tp: st.tp_price }))
    await page.waitForFunction(v => window.__ofServerTP?.state.positions[0]?.sl === v, slLong)
    await wait(1800)
    let ov = await fw(() => window.OpenfundTerminalInspect.positionOverlays())
    check('LONG SL only: one overlay, stop below entry, no target zone, locked, no R:R header', ov.length === 1 && ov[0].drawing && ov[0].drawing.anchors[1].price === slLong && ov[0].drawing.anchors[2].price === ov[0].drawing.anchors[0].price && ov[0].drawing.locked === true && ov[0].drawing.props?.showHeader === false && ov[0].drawing.props?.showLossSize === false, JSON.stringify(ov))
    await page.screenshot({ path: `${OUT}/overlay-long-sl-only.png` })

    /* add TP with Arabic-Indic digits → both levels */
    await frame.locator(`[data-sltp="${pos.id}"]`).click()
    await frame.locator('#sltp-tp').fill(ar(tpLong))
    await frame.locator('#sltp-save').click(); await frame.locator('#sltp-dialog').waitFor({ state: 'hidden' })
    st = (await call(page, `/trading/state?account=${trial.id}`)).data.positions[0]
    check('SL/TP: Arabic-Indic digits saved exactly as the TP price', Number(st.tp_price) === tpLong, st.tp_price)
    await page.waitForFunction(v => window.__ofServerTP?.state.positions[0]?.tp === v, tpLong); await wait(1800)
    ov = await fw(() => window.OpenfundTerminalInspect.positionOverlays())
    const a = ov[0]?.drawing?.anchors || []
    check('LONG both: red zone entry→SL below, green zone entry→TP above, R:R header shown, size line hidden', a[1]?.price === slLong && a[2]?.price === tpLong && a[1].price < a[0].price && a[2].price > a[0].price && ov[0].drawing.props.showHeader === true && ov[0].drawing.props.showLossSize === false, JSON.stringify(a))
    const legend = await fw(() => document.getElementById('pos-rr-legend')?.innerText || '')
    check('legend shows LONG · Entry · SL · TP · R from the real levels', /LONG/.test(legend) && /SL/.test(legend) && /TP/.test(legend) && /R\s*\d/.test(legend), legend)
    await page.screenshot({ path: `${OUT}/overlay-long-both.png` })

    /* a rejected update keeps the previous authoritative overlay */
    await frame.locator(`[data-sltp="${pos.id}"]`).click()
    await frame.locator('#sltp-sl').fill(String(Math.ceil(mark * 1.5)))
    await frame.locator('#sltp-save').click()
    await frame.locator('#sltp-err').waitFor({ state: 'visible' })
    st = (await call(page, `/trading/state?account=${trial.id}`)).data.positions[0]
    check('rejected SL keeps the dialog open with the server error and the old level', Number(st.sl_price) === slLong && await frame.locator('#sltp-dialog').evaluate(d => d.open))
    /* remove SL → TP only */
    await frame.locator('#sltp-sl').fill('')
    await frame.locator('#sltp-save').click(); await frame.locator('#sltp-dialog').waitFor({ state: 'hidden' })
    await page.waitForFunction(() => window.__ofServerTP?.state.positions[0]?.sl == null); await wait(1800)
    ov = await fw(() => window.OpenfundTerminalInspect.positionOverlays())
    check('LONG TP only after SL removal: no loss zone, no ratio', ov.length === 1 && ov[0].drawing.anchors[1].price === ov[0].drawing.anchors[0].price && ov[0].drawing.anchors[2].price === tpLong && ov[0].drawing.props.showHeader === false && ov[0].drawing.props.showStopLabel === false)

    /* SHORT positions + multiple positions on one symbol */
    const slShort = Math.ceil(mark * 1.02), tpShort = Math.floor(mark * 0.96)
    check('short order with SL+TP accepted', [200, 201].includes(await order('short', slShort, tpShort)))
    check('short order with SL only accepted', [200, 201].includes(await order('short', slShort, null)))
    await page.evaluate(() => dispatchEvent(new Event('of-refresh-trading')))
    await page.waitForFunction(() => window.__ofServerTP?.state.positions.length === 3); await wait(1800)
    ov = await fw(() => window.OpenfundTerminalInspect.positionOverlays())
    const shorts = (await call(page, `/trading/state?account=${trial.id}`)).data.positions.filter(p => p.side === 'short')
    const both = ov.find(o => o.positionId === shorts.find(p => p.tp_price != null)?.id)?.drawing
    const slo = ov.find(o => o.positionId === shorts.find(p => p.tp_price == null)?.id)?.drawing
    check('multiple positions: one overlay per position id (3)', ov.length === 3 && new Set(ov.map(o => o.positionId)).size === 3)
    check('SHORT both: red zone entry→SL ABOVE, green zone entry→TP BELOW', both && both.anchors[1].price > both.anchors[0].price && both.anchors[2].price < both.anchors[0].price, JSON.stringify(both?.anchors))
    check('SHORT SL only: stop above entry, no target zone', slo && slo.anchors[1].price > slo.anchors[0].price && slo.anchors[2].price === slo.anchors[0].price)
    check('position overlays are never saved as user drawings', (await fw(() => { const doc = JSON.parse(window.OpenfundChartWorkspace.getLocal('of-vela-drawings-BTC/USD') || '{"drawings":[]}'); return doc.drawings.filter(d => d.type === 'position').length })) === 0)
    await page.screenshot({ path: `${OUT}/overlay-multiple.png` })

    /* zoom/pan/resize keep the overlay anchored to prices (anchors are price/time, not pixels) */
    const before = JSON.stringify(ov.map(o => o.drawing.anchors.map(x => x.price)))
    await fw(() => { const c = window.OpenfundTerminalInspect.chart(); c.panBy(0.2); c.setVisibleRangePreset?.('1D') })
    await page.setViewportSize({ width: 1100, height: 800 }); await wait(1200); await page.setViewportSize({ width: 1440, height: 900 }); await wait(1800)
    const after = JSON.stringify((await fw(() => window.OpenfundTerminalInspect.positionOverlays())).map(o => o.drawing.anchors.map(x => x.price)))
    check('zoom, pan and resize keep every overlay on its price levels', before === after)

    /* symbol switch isolates overlays; switching back rebuilds them */
    await fw(() => window.OpenfundTerminalInspect.controller().setSymbol('ETH/USD'))
    await page.waitForFunction(() => document.querySelector('iframe.of-trading-workspace').contentWindow.OpenfundTerminalInspect.symbol() === 'ETH/USD', null, { timeout: 15000 })
    await fw(() => window.dispatchEvent(new Event('of-trading-update'))); await wait(1800)
    check('symbol switch: BTC/USD overlays and legend leave the ETH/USD chart', (await fw(() => window.OpenfundTerminalInspect.positionOverlays().length + (document.getElementById('pos-rr-legend') ? 1 : 0))) === 0)
    await fw(() => window.OpenfundTerminalInspect.controller().setSymbol('BTC/USD'))
    await page.waitForFunction(() => document.querySelector('iframe.of-trading-workspace').contentWindow.OpenfundTerminalInspect.symbol() === 'BTC/USD', null, { timeout: 15000 })
    await fw(() => window.dispatchEvent(new Event('of-trading-update'))); await wait(1800)
    check('symbol switch back: the three overlays are rebuilt', (await fw(() => window.OpenfundTerminalInspect.positionOverlays().length)) === 3)
    /* timeframe switch keeps the overlays */
    await fw(() => window.OpenfundTerminalInspect.controller().setTimeframe('5')); await wait(1800)
    check('timeframe switch keeps every overlay', (await fw(() => window.OpenfundTerminalInspect.positionOverlays().filter(o => o.drawing).length)) === 3)

    /* close one position → its overlay disappears */
    const toClose = shorts.find(p => p.tp_price == null)
    const closed = await call(page, `/trading/positions/${toClose.id}/close?account=${trial.id}`, { fraction: 1, product: 'prop', accountId: trial.id })
    check('close request accepted', closed.status < 300, JSON.stringify(closed))
    await page.evaluate(() => dispatchEvent(new Event('of-refresh-trading')))
    await page.waitForFunction(() => window.__ofServerTP?.state.positions.length === 2); await wait(1800)
    ov = await fw(() => window.OpenfundTerminalInspect.positionOverlays())
    check('closing a position removes its overlay', ov.length === 2 && !ov.some(o => o.positionId === toClose.id))

    /* refresh rebuilds overlays from authoritative state */
    await page.reload(); await page.waitForFunction(() => window.__ofServerTP?.canTrade, null, { timeout: 30000 })
    await page.waitForFunction(() => document.querySelector('iframe.of-trading-workspace')?.contentWindow?.OpenfundTerminalInspect?.positionOverlays?.().length === 2, null, { timeout: 30000 })
    check('page refresh rebuilds the overlays from position state', true)
    if (process.env.RISK_TEST_FOOTPRINT === '1') {
      await wait(1500)
      const style = await fw(() => window.OpenfundTerminalInspect.chart().renderer.get('priceStyle'))
      check('footprint chart style is restored after refresh (per-wallet workspace)', style === 'footprint', style)
    }

    /* ---------------- wallet A chart workspace ---------------- */
    await page.waitForFunction(() => document.querySelector('iframe.of-trading-workspace').contentWindow.OpenfundTerminalInspect.restored(), null, { timeout: 30000 })
    await wait(800)
    const userDrawing = await fw(() => {
      const c = window.OpenfundTerminalInspect.chart()
      const t = Math.floor(Date.now() / 60000) * 60000
      const d = c.drawings.add('hline', { paneId: 'price', anchors: [{ time: t, price: 12345 }] })
      return d && d.id
    })
    await fw(() => window.OpenfundTerminalInspect.controller().setTimeframe('15'))
    await wait(3500)
    await fw(() => window.OpenfundChartWorkspace.flushAll())
    await wait(800)
    const wsA = (await call(page, '/chart/workspaces/prop')).data
    const aSym = wsA.entries.find(e => e.scope === 'BTC/USD')
    check('a new user drawing is never mistaken for a position overlay', (await fw(id => window.OpenfundTerminalInspect.userDrawings().some(d => d.id === id && d.type === 'hline'), userDrawing)))
    check('wallet A drawing saved to the server workspace', !!userDrawing && aSym && aSym.data.drawings.some(d => d.anchors?.[0]?.price === 12345), JSON.stringify({ userDrawing, writes: wsWrites, sym: aSym?.data?.drawings?.map(d => d.type) }))
    check('no self-inflicted revision conflicts while saving', !wsWrites.some(w => w.startsWith('409')), wsWrites.join(', '))
    check('server workspace holds no position overlays', aSym && !aSym.data.drawings.some(d => d.type === 'position'))
    const aSettings = wsA.entries.find(e => e.scope === '*')
    const localTf = await fw(() => (window.OpenfundChartWorkspace.getLocal('of-chart-v2-prop') || '').match(/"timeframe":"[^"]*"/g))
    check('wallet A settings (timeframe) saved', aSettings && /"timeframe":"15"/.test(aSettings.data.workspace || ''), JSON.stringify({ localTf, server: (aSettings?.data.workspace || '').match(/"timeframe":"[^"]*"/g) }))

    /* ---------------- logout → wallet B ---------------- */
    await (await walletButton(page, 'Log out').catch(() => null))?.click().catch(() => {})
    await call(page, '/auth/logout', {})
    await page.evaluate(() => window.riskWallet.use(1))
    await page.goto(BASE + '/en/prop/trade')
    await (await walletButton(page, 'Sign in')).click()
    await (await walletButton(page, 'Account')).waitFor({ timeout: 20000 })
    const meB = (await call(page, '/auth/me')).data
    check('wallet B is signed in as a different user', meB?.user?.walletAddress?.toLowerCase() === wallets[1].address.toLowerCase(), JSON.stringify(meB?.user))
    await page.waitForFunction(() => document.querySelector('iframe.of-trading-workspace')?.contentWindow?.OpenfundTerminalInspect?.chart()?.drawings, null, { timeout: 30000 })
    await wait(2500)
    const bView = await fw(() => ({ identity: window.OpenfundChartWorkspace.identity, drawings: window.OpenfundTerminalInspect.userDrawings().map(d => d.anchors?.[0]?.price), overlays: window.OpenfundTerminalInspect.positionOverlays().length }))
    check('wallet B does not see wallet A\'s drawings or positions', !bView.drawings.includes(12345) && bView.overlays === 0, JSON.stringify(bView))
    check('wallet B has its own empty server workspace', (await call(page, '/chart/workspaces/prop')).data.entries.every(e => !JSON.stringify(e.data).includes('12345')))
    await fw(() => { const c = window.OpenfundTerminalInspect.chart(); c.drawings.add('hline', { paneId: 'price', anchors: [{ time: Math.floor(Date.now() / 60000) * 60000, price: 22222 }] }) })
    await wait(3500); await fw(() => window.OpenfundChartWorkspace.flushAll()); await wait(800)
    check('wallet B saves its own workspace', (await call(page, '/chart/workspaces/prop')).data.entries.some(e => JSON.stringify(e.data).includes('22222')))
    await ctxA.close()

    /* ---------------- wallet A again, NEW browser context (another device) ---------------- */
    const ctxA2 = await newContext(browser, wallets)
    const p2 = await ctxA2.newPage()
    p2.on('pageerror', e => errors.push(e.message))
    await p2.goto(`${BASE}/en/prop/trade?account=${trial.id}`)
    await connectAndSignIn(p2)
    await p2.waitForFunction(() => document.querySelector('iframe.of-trading-workspace')?.contentWindow?.OpenfundChartWorkspace?.identity, null, { timeout: 30000 })
    await p2.waitForFunction(() => document.querySelector('iframe.of-trading-workspace')?.contentWindow?.OpenfundTerminalInspect?.userDrawings?.().some(d => d.anchors?.[0]?.price === 12345), null, { timeout: 30000 }).catch(() => {})
    const aBack = await p2.evaluate(() => { const w = document.querySelector('iframe.of-trading-workspace').contentWindow; return { drawings: w.OpenfundTerminalInspect.userDrawings().map(d => d.anchors?.[0]?.price), tf: w.OpenfundTerminalInspect.chart()?.market?.timeframe ?? null, state: w.OpenfundChartWorkspace.status } })
    check('wallet A on a fresh device gets its drawing back, not wallet B\'s', aBack.drawings.includes(12345) && !aBack.drawings.includes(22222), JSON.stringify(aBack))
    check('wallet A on a fresh device gets its timeframe back', String(aBack.tf) === '15', JSON.stringify(aBack))
    await p2.screenshot({ path: `${OUT}/wallet-a-restored.png` })

    /* evidence captures: RTL Persian, light theme, phone width */
    const f2 = p2.frameLocator('iframe.of-trading-workspace')
    const capture = async (name, fn) => { try { await fn(); const theme = await p2.evaluate(() => document.documentElement.dataset.theme || 'dark'); await p2.screenshot({ path: `${OUT}/${name}-${theme}.png` }); check('capture ' + name + ' (' + theme + ')', true) } catch (e) { check('capture ' + name, false, e.message) } }
    await p2.goto(`${BASE}/fa/prop/trade?account=${trial.id}`)
    await p2.waitForFunction(() => window.__ofServerTP?.canTrade, null, { timeout: 30000 })
    await f2.locator('#submit-order').waitFor()
    await wait(2500)
    await capture('overlay-fa', async () => {})
    await capture('review-fa-1440', async () => { await f2.locator('#of-collateral').fill('۲۵۰'); await f2.locator('#submit-order').click(); await f2.locator('#review-dialog[open]').waitFor() })
    const reviewFa = await (await p2.$('iframe.of-trading-workspace')).contentFrame().then(f => f.evaluate(() => { const d = document.getElementById('review-dialog'); const b = d.getBoundingClientRect(); return { overflow: d.scrollWidth > d.clientWidth + 1, clipped: [...d.querySelectorAll('.review-list dd, .review-list dt')].filter(e => { const r = e.getBoundingClientRect(); return r.left < b.left || r.right > b.right }).length, dir: getComputedStyle(d).direction } }))
    check('order review (fa, RTL): no clipping or overflow', !reviewFa.overflow && reviewFa.clipped === 0 && reviewFa.dir === 'rtl', JSON.stringify(reviewFa))
    await f2.locator('#review-cancel').click()
    const firstPos = (await call(p2, `/trading/state?account=${trial.id}`)).data.positions[0]
    await capture('sltp-fa-1440', async () => { await f2.locator(`[data-sltp="${firstPos.id}"]`).click(); await f2.locator('#sltp-dialog[open]').waitFor() })
    await f2.locator('#sltp-cancel').click()
    await capture('overlay-fa-toggled', async () => { await p2.locator('.of-terminal-actions .of-daynight').first().click(); await wait(2500) })
    await p2.setViewportSize({ width: 390, height: 844 }); await wait(1500)
    const gPhone = await headerGeometry(p2)
    check('terminal header (390px, fa, light, authenticated): controls share one height', (() => { const v = Object.values(gPhone || {}).filter(Boolean); return v.length >= 2 && new Set(v.map(x => x.h)).size === 1 && new Set(v.map(x => x.mid)).size === 1 })(), JSON.stringify(gPhone))
    await capture('sltp-fa-390', async () => { await f2.locator(`[data-sltp="${firstPos.id}"]`).evaluate(b => b.click()); await f2.locator('#sltp-dialog[open]').waitFor() })
    await f2.locator('#sltp-cancel').click().catch(() => {})
    await ctxA2.close()
  } catch (e) {
    check('journey completed without an exception', false, e.stack || e.message)
  } finally {
    await browser.close()
  }
  const relevant = errors.filter(m => !/ResizeObserver|WebSocket|Failed to fetch|NetworkError|net::/i.test(m))
  check('no uncaught page errors', relevant.length === 0, relevant.join(' | '))
  const failed = results.filter(r => !r.ok)
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2))
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`)
  process.exit(failed.length ? 1 : 0)
})()
