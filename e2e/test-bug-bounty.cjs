/* Bug bounty page (/:locale/bug-bounty, ADR 0057) in the production bundle.
 *
 * Five locales (RTL fa/ar, LTR en/ru/zh-CN), dark and light, 390/768/1440:
 * the reward cards (published defaults when the CMS is unreachable; no
 * invented figures), the filterable scope table, the process timeline and
 * report link to the private GitHub advisory, the honest empty hall of fame,
 * no horizontal scroll, no clipped header overlap, 44 px targets, reduced
 * motion (static scan frame), the Resources → Security menu entry, the
 * footer link and /.well-known/security.txt. */
const { chromium } = require('playwright')
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict')
const BASE = process.env.TEST_FRONTEND_URL || 'http://localhost:8080'
const OUT = path.resolve(__dirname, '..', process.env.OUTPUT_DIR || 'output/playwright/bug-bounty')
fs.mkdirSync(OUT, { recursive: true })
let passed = 0
const check = (name, ok, detail = '') => { assert.ok(ok, `${name} ${detail}`); passed++; console.log('PASS - ' + name) }
const RTL = new Set(['fa', 'ar'])
const ADVISORY = 'https://github.com/algomanlife/openfund/security/advisories/new'

;(async () => {
  const browser = await chromium.launch()
  try {
    const matrix = []
    for (const locale of ['fa', 'en', 'ar', 'ru', 'zh-CN']) for (const w of [390, 1440]) matrix.push([locale, w, w === 390 ? 'dark' : 'light'])
    matrix.push(['en', 768, 'dark'], ['fa', 768, 'light'], ['en', 1440, 'dark'])
    for (const [locale, w, theme] of matrix) {
      const context = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : w === 768 ? 1024 : 900 }, colorScheme: theme, reducedMotion: 'reduce' })
      await context.addInitScript(t => { try { localStorage.setItem('openfund-theme', t) } catch {} }, theme)
      const page = await context.newPage()
      const errors = []; page.on('pageerror', e => errors.push(e.message))
      await page.route(/\/(cms\/)?items\//, r => r.abort())
      const id = `${locale} ${w} ${theme}`
      await page.goto(`${BASE}/${locale}/bug-bounty`)
      await page.locator('.bb-tier').first().waitFor({ timeout: 20000 })
      check(`${id}: lang and dir`, await page.evaluate(([l, rtl]) => document.documentElement.lang === l && document.documentElement.dir === (rtl ? 'rtl' : 'ltr'), [locale, RTL.has(locale)]))
      check(`${id}: one h1`, (await page.locator('h1').count()) === 1)
      check(`${id}: four reward tiers`, (await page.locator('.bb-tier').count()) === 4)
      const amounts = await page.locator('.bb-amount').evaluateAll(els => els.map(e => e.getAttribute('aria-label')))
      check(`${id}: published default amounts`, /2[,.\s ٬]?000/.test(amounts[0].replace(/[٠-٩۰-۹]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)] ?? '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])), amounts.join(' | '))
      check(`${id}: exceptional reward line`, await page.locator('.bb-exceptional').isVisible())
      const report = page.locator('a.bb-report').first()
      check(`${id}: report links to the private advisory`, (await report.getAttribute('href')) === ADVISORY && (await report.getAttribute('rel')).includes('noopener'))
      /* scope filter */
      const filters = page.locator('.bb-filters button')
      check(`${id}: all rows`, (await page.locator('.bb-scope tbody tr').count()) === 12)
      await filters.nth(1).click()
      check(`${id}: in-scope filter`, (await page.locator('.bb-scope tbody tr').count()) === 7 && (await filters.nth(1).getAttribute('aria-pressed')) === 'true')
      await filters.nth(2).click()
      check(`${id}: out-of-scope filter`, (await page.locator('.bb-scope tbody tr.is-out').count()) === 5 && (await page.locator('.bb-scope tbody tr.is-in').count()) === 0)
      await filters.nth(0).click()
      check(`${id}: five process steps`, (await page.locator('.bb-timeline li').count()) === 5)
      check(`${id}: honest empty hall of fame`, (await page.locator('.bb-hall').count()) === 0 && (await page.locator('#bb-hall ~ .ob-note').count()) === 1)
      check(`${id}: illustrative label on the scan`, await page.locator('.bb-illustrative').isVisible())
      check(`${id}: reduced motion shows a static reward frame`, await page.evaluate(() => {
        const coin = document.querySelector('.bb-node.n2 .bb-coin'), scan = document.querySelector('.bb-scanline')
        return getComputedStyle(coin).opacity === '1' && getComputedStyle(scan).animationName === 'none'
      }))
      check(`${id}: no horizontal scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      const small = await page.locator('main .bb-filters button, main a.bb-report').evaluateAll(els => els.filter(e => { const r = e.getBoundingClientRect(); return r.height < 43.5 }).length)
      check(`${id}: 44 px targets`, small === 0)
      /* keyboard focus (focus-visible needs a keyboard move) */
      await page.locator('.bb-filters button').nth(1).focus()
      await page.keyboard.press('Shift+Tab')
      check(`${id}: visible focus`, await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none'))
      check(`${id}: footer link`, (await page.locator(`#footer-links a[href="/${locale}/bug-bounty"]`).count()) === 1)
      check(`${id}: no page errors`, !errors.length, errors.join(' | '))
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200)
      if ([390, 768, 1440].includes(w)) await page.screenshot({ path: path.join(OUT, `bug-bounty-${locale}-${w}-${theme}.png`), fullPage: w !== 1440 })
      await context.close()
    }
    /* Resources → Security in the desktop mega menu */
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(`${BASE}/en/rulebook`, { waitUntil: "load" })
    await page.locator('.openfund-header .resources-toggle[aria-controls="website-resources"]').click()
    await page.waitForTimeout(400)
    const menu = await page.evaluate(() => ({
      sections: [...document.querySelectorAll('.resources-open .mega-section h3')].map(h => h.textContent),
      link: [...document.querySelectorAll('.resources-open .mega-section')].find(s => s.querySelector('h3')?.textContent === 'Security')?.querySelector('a.mega-tile')?.getAttribute('href') }))
    check('mega menu: Resources has a Security group with the bounty page', menu.sections.at(-1) === 'Security' && menu.link === '/en/bug-bounty', JSON.stringify(menu))
    /* RFC 9116 */
    const txt = await (await page.request.get(`${BASE}/.well-known/security.txt`)).text()
    check('security.txt: private advisory contact', txt.includes(`Contact: ${ADVISORY}`))
    check('security.txt: policy points at the bounty page', /^Policy: https?:\/\/[^\s]+\/en\/bug-bounty$/m.test(txt))
    check('security.txt: has an expiry', /^Expires: \d{4}-\d\d-\d\dT/m.test(txt))
    console.log(`bug bounty: ${passed} checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
