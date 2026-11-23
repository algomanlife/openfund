/* Terminal Funding and Details tabs (item G): the chart tab bar is
 * Chart | Funding | Details | News & info with arrow, Home and End keys
 * (mirrored in RTL); Funding shows current long/short funding, borrowing,
 * the open-interest bar and skew from the backend (documented Gains
 * endpoints), a history chart or an honest "no samples yet / data
 * available from" state with unavailable ranges disabled, the annualized
 * toggle and the "Market data from Gains Network" label; Details shows the
 * Gains specification and the account limits as two cards; the phone
 * workspace has Funding and Details views; no horizontal overflow; both
 * themes. Screenshots at 390, 768 and 1440 px. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/terminal-funding'))
fs.mkdirSync(OUT, { recursive: true })
let n = 0
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); n++; console.log('PASS - ' + name) }
const open = async (page, locale) => {
  await page.goto(`${BASE}/${locale}/prop/trade`, { waitUntil: 'domcontentloaded' })
  const frame = page.frameLocator('iframe')
  await frame.locator('#tab-funding').waitFor({ state: 'attached', timeout: 30000 })
  await page.waitForTimeout(1500)
  return frame
}

;(async () => {
  const browser = await chromium.launch(); const errors = []
  const track = page => page.on('pageerror', e => errors.push(String(e)))
  try {
    for (const [locale, dir, theme] of [['en', 'ltr', 'dark'], ['fa', 'rtl', 'light']]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: theme }); track(page)
      await page.addInitScript(t => { try { localStorage.setItem('openfund-theme', t); localStorage.setItem('of-theme', t) } catch {} }, theme)
      const frame = await open(page, locale)
      const tabs = await frame.locator('[data-chart-tab]').evaluateAll(els => els.map(e => e.dataset.chartTab))
      ok(`${locale}: tab order Chart | Funding | Details | News`, JSON.stringify(tabs) === '["chart","funding","details","news"]', JSON.stringify(tabs))
      await frame.locator('#tab-chart').focus()
      await page.keyboard.press(dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight')
      ok(`${locale}: the forward arrow (${dir}) moves to Funding`, await frame.locator('#tab-funding').getAttribute('aria-selected') === 'true')
      await page.keyboard.press('End')
      ok(`${locale}: End selects News & info`, await frame.locator('#tab-news').getAttribute('aria-selected') === 'true')
      await page.keyboard.press('Home')
      ok(`${locale}: Home returns to Chart`, await frame.locator('#tab-chart').getAttribute('aria-selected') === 'true' && await frame.locator('#funding-panel').isHidden())
      await frame.locator('#tab-funding').click()
      await frame.locator('.fund-card').first().waitFor({ timeout: 20000 })
      await frame.locator('.fund-v').first().filter({ hasNotText: '—' }).waitFor({ timeout: 20000 })
      const f = await frame.locator('body').evaluate(() => ({
        cards: document.querySelectorAll('.fund-card').length, values: [...document.querySelectorAll('.fund-v')].map(v => v.textContent.trim()),
        bar: !!document.querySelector('.fund-oi-bar[role=img]'), source: document.querySelector('.fund-source')?.textContent || '',
        disabled: [...document.querySelectorAll('[data-fund-range][disabled]')].map(b => b.dataset.fundRange),
        chart: document.querySelector('#fund-chart')?.textContent.trim() || '', svg: !!document.querySelector('#fund-chart svg'),
        panelRole: document.querySelector('#funding-panel')?.getAttribute('role'), overflow: document.documentElement.scrollWidth - innerWidth }))
      ok(`${locale}: funding cards show real values, OI bar and source label`, f.cards === 3 && f.values.slice(0, 2).every(v => /%$/.test(v)) && f.bar && /Gains Network/.test(f.source) && f.panelRole === 'tabpanel', JSON.stringify(f))
      ok(`${locale}: history is a chart or an honest empty state; unavailable ranges are disabled`, f.svg || (f.chart.length > 0 && f.disabled.length >= 1), JSON.stringify(f))
      const hourly = await frame.locator('.fund-v').first().textContent()
      await frame.locator('[data-fund-annual]').check()
      ok(`${locale}: the annualized toggle changes the units`, (await frame.locator('.fund-v').first().textContent()) !== hourly)
      await frame.locator('[data-fund-annual]').uncheck()
      if (locale === 'en') await page.screenshot({ path: path.join(OUT, 'terminal-funding-en-1440.png') })
      await frame.locator('#tab-details').click()
      await frame.locator('.det-card').nth(1).waitFor({ timeout: 20000 })
      const d = await frame.locator('body').evaluate(() => ({ cards: [...document.querySelectorAll('.det-card h3')].map(h => h.textContent), rows: document.querySelectorAll('.det-card .det-row').length }))
      ok(`${locale}: Details has the Gains specification and the account limits as two cards`, d.cards.length === 2 && d.rows >= 10, JSON.stringify(d))
      if (locale === 'en') await page.screenshot({ path: path.join(OUT, 'terminal-details-en-1440.png') })
      if (locale === 'fa') await page.screenshot({ path: path.join(OUT, 'terminal-details-fa-1440-light.png') })
      await page.close()
    }
    for (const w of [390, 768]) {
      const page = await browser.newPage({ viewport: { width: w, height: 844 }, isMobile: w < 768, hasTouch: w < 768 }); track(page)
      const frame = await open(page, 'en')
      const views = await frame.locator('button[data-workspace-view]').evaluateAll(els => els.map(e => e.dataset.workspaceView))
      if (w === 390) ok('390: the phone workspace has Funding and Details views', views.includes('funding') && views.includes('details'), JSON.stringify(views))
      const viewButton = frame.locator('button[data-workspace-view="funding"]')
      if (await viewButton.isVisible()) await viewButton.click(); else await frame.locator('#tab-funding').click()
      await frame.locator('.fund-card').first().waitFor({ timeout: 20000 })
      const r = await frame.locator('body').evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, visible: !document.querySelector('#funding-panel').hidden }))
      ok(`${w} px: Funding visible, no horizontal overflow`, r.visible && r.overflow <= 1, JSON.stringify(r))
      await page.screenshot({ path: path.join(OUT, `terminal-funding-en-${w}.png`) })
      await page.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.join(' | '))
    console.log(`${n} terminal funding checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
