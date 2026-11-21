/* Home hero "trader journey" card: hero text paints at full opacity at once;
 * the card loops eval → target → verified → funded → reset; the sparkline
 * draws (mask wipe + head), the rules face flips in, the funded metal shows;
 * the "conceptual illustration" label and the OpenFi wordmark stay; mobile has
 * no particles; reduced motion shows the static Funded frame; no overflow. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/hero-journey'))
fs.mkdirSync(OUT, { recursive: true })
const results = []
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); results.push(name); console.log('PASS - ' + name) }

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  try {
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/en/challenges`, { waitUntil: 'load' })
      await page.locator('.hero-product').waitFor()
      ok('hero heading is painted at full opacity immediately', await page.evaluate(() => getComputedStyle(document.querySelector('.hero h1')).opacity === '1'))
      const seen = new Set(); let drew = false, flipped = false, metal = false
      const t0 = Date.now()
      while (Date.now() - t0 < 16000 && seen.size < 5) {
        const s = await page.evaluate(() => {
          const root = document.querySelector('.hero-product'), st = getComputedStyle(root)
          return { stage: root.dataset.stage, spark: Number(st.getPropertyValue('--spark') || 1), flip: st.getPropertyValue('--flip').trim(), metal: Number(getComputedStyle(document.querySelector('.hero-metal')).opacity) }
        })
        if (s.stage) seen.add(s.stage)
        if (s.stage === 'eval' && s.spark > 0.05 && s.spark < 0.95) drew = true
        if (s.stage === 'verified' && s.flip === '180deg') flipped = true
        if (s.stage === 'funded' && s.metal > 0.3) metal = true
        if (s.stage === 'funded' && !fs.existsSync(path.join(OUT, 'hero-funded.png'))) { await page.waitForTimeout(1200); await page.locator('.hero-product').screenshot({ path: path.join(OUT, 'hero-funded.png') }) }
        await page.waitForTimeout(200)
      }
      ok('the card loops through every stage', ['eval', 'target', 'verified', 'funded', 'reset'].every(s => seen.has(s)), [...seen].join())
      ok('evaluation draws the sparkline; verification flips to the rules; funded shows the metal', drew && flipped && metal, JSON.stringify({ drew, flipped, metal }))
      const r = await page.evaluate(() => ({ label: !!document.querySelector('.hero-account .account-bottom span:last-child')?.textContent.trim(), word: document.querySelector('.hero-account .brand-wordmark')?.textContent, canvas: !!document.querySelector('.hero-particles'), overflow: document.documentElement.scrollWidth - innerWidth }))
      ok('illustration label and OpenFi wordmark kept; particles on desktop; no overflow', r.label && r.word === 'OpenFi' && r.canvas && r.overflow <= 0, JSON.stringify(r))
      await page.close()
    }
    for (const [w, h, loc, rm] of [[390, 844, 'fa', 'no-preference'], [1440, 900, 'en', 'reduce']]) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: rm, isMobile: w < 768, hasTouch: w < 768 }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/${loc}/challenges`, { waitUntil: 'load' }); await page.locator('.hero-product').waitFor(); await page.waitForTimeout(1500)
      const r = await page.evaluate(() => ({ stage: document.querySelector('.hero-product').dataset.stage, canvas: !!document.querySelector('.hero-particles'), overflow: document.documentElement.scrollWidth - innerWidth }))
      if (rm === 'reduce') ok('reduced motion: static Funded frame, no particles', r.stage === 'funded' && !r.canvas, JSON.stringify(r))
      else ok(`${loc} ${w}: lighter mobile version without particles, no overflow`, !r.canvas && r.overflow <= 0, JSON.stringify(r))
      await page.locator('.hero-product').screenshot({ path: path.join(OUT, `hero-${loc}-${w}${rm === 'reduce' ? '-reduced' : ''}.png`) })
      await page.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${results.length} hero journey checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
