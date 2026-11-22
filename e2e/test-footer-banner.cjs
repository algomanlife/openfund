/* Footer "alien trader" banner: placed in the shared site footer between the
 * documents row and the credits; lazy (nothing rendered until near view);
 * decorative (aria-hidden); animates only while visible; one screen shows the
 * real Open Trade capture; stays a dark band in the light theme; mobile focal
 * crop keeps the alien and the centre monitors; reduced motion is static; no
 * horizontal overflow from 360 to 1920 px. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/footer-banner'))
fs.mkdirSync(OUT, { recursive: true })
let n = 0
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); n++; console.log('PASS - ' + name) }
const toBanner = async page => { await page.locator('[data-alien-banner]').first().scrollIntoViewIfNeeded(); await page.waitForSelector('.ab-root[data-live="true"], .ab-root', { timeout: 15000 }); await page.waitForTimeout(1200) }

;(async () => {
  const browser = await chromium.launch(); const errors = []
  try {
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/en/rulebook`, { waitUntil: 'load' })
      ok('banner is lazy: no scene before the footer is near', await page.evaluate(() => !document.querySelector('.ab-root')))
      await toBanner(page)
      const r = await page.evaluate(() => {
        const slot = document.querySelector('[data-alien-banner]')
        return { prev: slot.previousElementSibling?.className, next: slot.nextElementSibling?.className, hidden: slot.getAttribute('aria-hidden'), inFooter: !!slot.closest('footer'),
          live: document.querySelector('.ab-root').dataset.live, capture: document.querySelector('.ab-capture')?.getAttribute('href'), monitors: document.querySelectorAll('.ab-monitor').length,
          width: Math.round(slot.getBoundingClientRect().width), vw: document.documentElement.clientWidth, focusables: slot.querySelectorAll('a,button,[tabindex]').length }
      })
      ok('placed in the site footer between the documents row and the credits', r.inFooter && r.prev === 'document-links' && r.next === 'footer-credits', JSON.stringify(r))
      ok('decorative: aria-hidden, nothing focusable', r.hidden === 'true' && r.focusables === 0)
      ok('six monitors; one shows the real Open Trade capture', r.monitors === 6 && /assets\/apps\/open-trade\/chart\.webp$/.test(r.capture || ''), JSON.stringify(r))
      ok('full-bleed band', r.width >= r.vw - 1, JSON.stringify(r))
      ok('animates while visible', r.live === 'true')
      await page.locator('.of-alien-frame').screenshot({ path: path.join(OUT, 'banner-en-dark-1440.png') })
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(600)
      ok('pauses when scrolled out of view', await page.evaluate(() => document.querySelector('.ab-root').dataset.live === 'false'))
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/fa/about`, { waitUntil: 'load' }); await page.evaluate(() => { document.documentElement.dataset.theme = 'light' })
      await toBanner(page)
      const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.of-alien-frame')).backgroundColor)
      const [rr, gg, bb] = bg.match(/\d+/g).map(Number)
      ok('light theme keeps a dark band', rr + gg + bb < 60, bg)
      await page.locator('.of-alien-frame').screenshot({ path: path.join(OUT, 'banner-fa-light-1440.png') })
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/fa/challenges`, { waitUntil: 'load' }); await toBanner(page)
      const r = await page.evaluate(() => {
        const f = document.querySelector('.of-alien-frame').getBoundingClientRect(), head = document.querySelector('.ab-headshape').getBoundingClientRect(), tc = document.querySelectorAll('.ab-screen')[1].getBoundingClientRect()
        return { head: head.left >= f.left && head.right <= f.right, centre: tc.left >= f.left - 2 && tc.right <= f.right + 2, tall: f.height > f.width }
      })
      ok('mobile focal crop: alien and centre monitors in frame', r.head && r.centre && r.tall, JSON.stringify(r))
      await page.locator('.of-alien-frame').screenshot({ path: path.join(OUT, 'banner-fa-dark-390.png') })
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/en/faq`, { waitUntil: 'load' }); await toBanner(page)
      const running = await page.evaluate(() => document.getAnimations().filter(a => a.effect?.target?.closest?.('.of-alien-slot') && a.playState === 'running').length)
      ok('reduced motion: static frame, no running animations', running === 0, String(running))
      await page.close()
    }
    for (const w of [360, 768, 1024, 1280, 1920]) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 }, isMobile: w < 768 }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/en/rulebook`, { waitUntil: 'load' }); await toBanner(page)
      const o = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      ok(`${w} px: no horizontal overflow`, o <= 0, String(o))
      await page.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${n} footer banner checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
