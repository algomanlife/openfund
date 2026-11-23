/* Trading objectives page (item L): five locales with the right direction and
 * both themes; no horizontal overflow from 360 to 1920 px; the numbers equal
 * the published catalog the API serves; plan tabs and the size selector
 * update the cards; every card links to its rulebook section; motion is
 * gated by visibility and stops under reduced motion. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/trading-objectives'))
fs.mkdirSync(OUT, { recursive: true })
let n = 0
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); n++; console.log('PASS - ' + name) }
const open = async (page, route) => {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ob-hero h1', { timeout: 20000 })
  await page.waitForSelector('.ob-card, [role=alert]', { timeout: 20000 })
  await page.waitForTimeout(600)
}

;(async () => {
  const browser = await chromium.launch(); const errors = []
  const catalog = await (await fetch(`${BASE}/purchases/plans`)).json()
  const plans = catalog.plans.filter(p => !p.free && p.rules)
  try {
    for (const [locale, dir] of [['en', 'ltr'], ['fa', 'rtl'], ['ar', 'rtl'], ['ru', 'ltr'], ['zh-CN', 'ltr']]) {
      for (const theme of ['dark', 'light']) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: theme, isMobile: true })
        page.on('pageerror', e => errors.push(String(e)))
        await page.addInitScript(t => { try { localStorage.setItem('openfund-theme', t); localStorage.setItem('of-theme', t) } catch {} }, theme)
        await open(page, `/${locale}/trading-objectives`)
        const r = await page.evaluate(() => ({ dir: document.documentElement.dir, overflow: document.documentElement.scrollWidth - innerWidth,
          tabs: document.querySelectorAll('.ob-tabs [role=tab]').length, cards: document.querySelectorAll('.ob-card').length,
          links: [...document.querySelectorAll('.ob-card a')].map(a => a.getAttribute('href')) }))
        ok(`${locale} ${theme}: ${dir}, one tab per plan, cards linking to the rulebook, no overflow`,
          r.dir === dir && r.tabs === plans.length && r.cards >= 7 && r.links.every(h => h.startsWith(`/${locale}/rulebook#`)) && r.overflow <= 0, JSON.stringify(r))
        if (theme === 'dark') await page.screenshot({ path: path.join(OUT, `objectives-${locale}-390.png`) })
        await page.close()
      }
    }
    for (const w of [360, 768, 1024, 1280, 1440, 1920]) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, '/en/trading-objectives')
      ok(`${w} px: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 0))
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, '/en/trading-objectives')
      for (const plan of plans) {
        await page.locator('.ob-tabs [role=tab]').nth(plans.indexOf(plan)).click()
        await page.waitForTimeout(150)
        const size = Number(await page.locator('.ob-size select').inputValue())
        const daily = await page.locator('.ob-card.is-daily').textContent()
        const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(size * plan.rules.dailyLossPct / 100)
        ok(`${plan.slug}: the daily loss card shows the catalog's ${plan.rules.dailyLossPct}% as ${usd}`, daily.includes(`${plan.rules.dailyLossPct}%`) && daily.includes(usd), daily)
        const stages = await page.locator('.ob-stage').count()
        ok(`${plan.slug}: the progression has ${plan.rules.phases >= 2 ? 5 : plan.rules.phases === 1 ? 4 : 3} stages`, stages === (plan.rules.phases >= 2 ? 5 : plan.rules.phases === 1 ? 4 : 3), String(stages))
      }
      const first = plans[0]
      const other = first.accountSizesUsd.find(s => s !== Number(first.accountSizesUsd[0])) ?? first.accountSizesUsd[0]
      await page.locator('.ob-tabs [role=tab]').first().click()
      await page.locator('.ob-size select').selectOption(String(other))
      const max = await page.locator('.ob-card.is-max, .ob-card.is-trailing').first().textContent()
      const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(other * first.rules.maxTotalLossPct / 100)
      ok('the size selector recomputes dollar amounts', max.includes(usd), max)
      ok('the buy button carries the plan and size to checkout', (await page.locator('.ob-buy a').getAttribute('href')) === `/en/checkout?plan=${first.slug}&size=${other}`)
      await page.locator('.ob-card').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(300)
      ok('cards animate only while on screen', await page.evaluate(() => !!document.querySelector('.ob-card[data-live]')))
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, '/en/trading-objectives')
      ok('reduced motion: no running animations', await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length === 0))
      await page.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${n} trading objectives checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
