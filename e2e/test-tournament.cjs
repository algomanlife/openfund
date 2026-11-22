/* Openfund Premium League page (ADR 0050): renders in five locales with the
 * right direction and both themes; no horizontal overflow from 360 to
 * 1920 px; the count shown is the API's real count of verified registrations
 * (never invented); registration is closed ("opens soon") unless the API says
 * it is open; motion runs only while a section is on screen and the tab is
 * visible, animates transform/opacity only, and stops under reduced motion;
 * the terms page shows only a published document. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/tournament'))
fs.mkdirSync(OUT, { recursive: true })
let n = 0
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); n++; console.log('PASS - ' + name) }
const open = async (page, route) => {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.tl-title', { timeout: 20000 })
  await page.waitForTimeout(800)
}

;(async () => {
  const browser = await chromium.launch(); const errors = []
  const api = await (await fetch(`${BASE}/tournaments/premium-league-2027`)).json().catch(() => null)
  try {
    for (const [locale, dir] of [['en', 'ltr'], ['fa', 'rtl'], ['ar', 'rtl'], ['ru', 'ltr'], ['zh-CN', 'ltr']]) {
      for (const theme of ['dark', 'light']) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: theme, isMobile: true })
        page.on('pageerror', e => errors.push(String(e)))
        await page.addInitScript(t => { try { localStorage.setItem('openfund-theme', t); localStorage.setItem('of-theme', t) } catch {} }, theme)
        await open(page, `/${locale}/tournament`)
        const r = await page.evaluate(() => ({ dir: document.documentElement.dir, overflow: document.documentElement.scrollWidth - innerWidth,
          title: document.querySelector('.tl-title')?.textContent, badges: document.querySelectorAll('.tl-badges li').length, digits: document.querySelectorAll('.tl-digit').length }))
        ok(`${locale} ${theme}: ${dir}, title, eleven badges, no overflow`, r.dir === dir && r.title && r.badges === 11 && r.overflow <= 0, JSON.stringify(r))
        if (theme === 'dark') await page.screenshot({ path: path.join(OUT, `tournament-${locale}-390.png`) })
        await page.close()
      }
    }
    for (const w of [360, 768, 1024, 1280, 1440, 1920]) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, '/en/tournament')
      const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      ok(`${w} px: no horizontal overflow`, o <= 0, String(o))
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, '/en/tournament')
      if (api?.registration) {
        const text = await page.locator('#register').textContent()
        ok('registration state follows the API', api.registration.open ? /Connect wallet|Sign in with your wallet/.test(text) : /Registration opens soon|Registration is closed/.test(text), text.slice(0, 120))
        if (!api.leaderboard && !api.standings) ok('the count shown is the real count from the API', (await page.locator('.tl-section .tl-big').last().textContent()).trim() === new Intl.NumberFormat('en-US').format(api.registered))
      }
      ok('the podium is not live while off screen', !(await page.evaluate(() => { const b = document.querySelector('.tl-podium').getBoundingClientRect(); return b.top > innerHeight && !!document.querySelector('.tl-podium[data-live]') })))
      await page.locator('.tl-podium').evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(400)
      ok('the podium is live on screen', await page.evaluate(() => !!document.querySelector('.tl-podium[data-live]')))
      const props = await page.evaluate(() => [...new Set(document.getAnimations().flatMap(a => a.effect.getKeyframes().flatMap(k => Object.keys(k).filter(p => !['offset', 'easing', 'composite', 'computedOffset'].includes(p)))))])
      ok('animations use transform and opacity only', props.length > 0 && props.every(p => p === 'transform' || p === 'opacity'), props.join(','))
      await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')) })
      await page.waitForTimeout(200)
      ok('a hidden tab stops every live section', await page.evaluate(() => document.querySelectorAll('[data-live]').length === 0))
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, '/en/tournament')
      for (const sel of ['.tl-podium', '.tl-ranks4']) { await page.locator(sel).evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(250) }
      ok('reduced motion: no running animations', await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length === 0))
      await page.goto(`${BASE}/en/tournament/terms`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.tl-terms h1', { timeout: 20000 }); await page.waitForTimeout(1500)
      const terms = await page.locator('.tl-terms').textContent()
      ok('terms page renders a published document or says none is published', /Premium League/.test(terms) && (/not been published/.test(terms) || /1\. /.test(terms)), terms.slice(0, 160))
      await page.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${n} tournament page checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
