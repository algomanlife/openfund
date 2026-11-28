/* Migration to Openfund page (ADR 0051): five locales with the right
 * direction and both themes; no horizontal overflow from 360 to 1920 px;
 * the flamingo hero, the comparison, the steps and the accepted evidence;
 * firm names in text with the not-affiliated disclaimer; the request panel
 * follows the API ("opening soon" until storage is configured); reduced
 * motion stops every animation; the challenges page links to it. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/migration'))
fs.mkdirSync(OUT, { recursive: true })
let n = 0
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); n++; console.log('PASS - ' + name) }
const open = async (page, route) => {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.mg-hero h1', { timeout: 20000 })
  await page.waitForTimeout(800)
}

;(async () => {
  const browser = await chromium.launch(); const errors = []
  const config = await (await fetch(`${BASE}/migration/config`)).json().catch(() => null)
  try {
    for (const [locale, dir] of [['en', 'ltr'], ['fa', 'rtl'], ['ar', 'rtl'], ['ru', 'ltr'], ['zh-CN', 'ltr']]) {
      for (const theme of ['dark', 'light']) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: theme, isMobile: true })
        page.on('pageerror', e => errors.push(String(e)))
        await page.addInitScript(t => { try { localStorage.setItem('openfund-theme', t); localStorage.setItem('of-theme', t) } catch {} }, theme)
        await open(page, `/${locale}/migrate`)
        const r = await page.evaluate(() => ({ dir: document.documentElement.dir, overflow: document.documentElement.scrollWidth - innerWidth,
          hero: !!document.querySelector('.mg-hero .mh-root svg') && !document.querySelector('.mg-hero .flamingo-scene'), rows: document.querySelectorAll('.mg-compare tbody tr').length,
          steps: document.querySelectorAll('.mg-steps li').length, evidence: document.querySelectorAll('.mg-evidence li').length }))
        ok(`${locale} ${theme}: ${dir}, flamingo hero, comparison, steps, evidence, no overflow`,
          r.dir === dir && r.hero && r.rows === 5 && r.steps === 5 && r.evidence === 4 && r.overflow <= 0, JSON.stringify(r))
        if (theme === 'dark') await page.screenshot({ path: path.join(OUT, `migrate-${locale}-390.png`) })
        await page.close()
      }
    }
    for (const w of [360, 768, 1024, 1280, 1440, 1920]) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, '/en/migrate')
      ok(`${w} px: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 0))
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, '/en/migrate')
      const text = await page.locator('main').textContent()
      ok('firm names appear in text with the not-affiliated disclaimer', /not affiliated/.test(text) && (!config?.firms?.length || config.firms.every(f => text.includes(f.name))))
      const firms = await page.evaluate(() => [...document.querySelectorAll('.mg-firm')].map(f => ({ name: f.querySelector('h3')?.textContent,
        badge: !!f.querySelector('.mg-monogram, .mg-firm-logo'), site: f.querySelector('a[target=_blank]')?.getAttribute('rel') || '' })))
      ok('each firm shows a logo or monogram, its name and an official-site link that opens safely',
        firms.length === (config?.firms?.length ?? 0) && firms.every(f => f.name && f.badge && (!f.site || /noopener/.test(f.site) && /noreferrer/.test(f.site))), JSON.stringify(firms))
      ok('only uploaded logos are shown as images; the rest are original monograms',
        await page.locator('.mg-firm-logo').count() === (config?.firms ?? []).filter(f => f.logoUrl).length)
      const birds = await page.evaluate(() => { const ctas = [...document.querySelectorAll('.mg-hero .hero-actions a')].map(a => a.getBoundingClientRect())
        /* the standing poses of the landers (owner fix 2: one group per pose); at least one must exist so the check is not vacuous */
        const standing = [...document.querySelectorAll('.mh-bird .mh-pose:is(.is-stand,.is-wade,.is-feed)')]
        return { count: standing.length, overlap: standing.map(b => b.getBoundingClientRect()).filter(r => r.width).some(r => ctas.some(cta => !(r.right < cta.left || r.left > cta.right || r.bottom < cta.top || r.top > cta.bottom))) } })
      ok('standing birds never overlap the call to action', birds.count > 0 && !birds.overlap, JSON.stringify(birds))
      const panel = await page.locator('#mg-request').textContent()
      ok('the request panel follows the API', config?.open ? /Connect wallet|Sign in with your wallet/.test(panel) : /opening soon/i.test(panel), panel.slice(0, 120))
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, '/en/migrate')
      ok('reduced motion: no running animations', await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length === 0))
      await page.goto(`${BASE}/en/challenges`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.migration-banner a[data-info-page="migrate"]', { timeout: 20000 })
      await page.waitForTimeout(800)
      ok('the challenges page links to the migration page', /\/en\/migrate$/.test(await page.locator('.migration-banner a').getAttribute('href')))
      await page.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${n} migration page checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
