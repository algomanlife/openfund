/* Labs page (item M): five locales with the right direction and both themes;
 * no horizontal overflow from 360 to 1920 px; with no published drop, an
 * honest "no drop yet" state and nothing for sale; with a drop, the capsule
 * shows exactly what GET /labs reports; drops stay out of the normal plan
 * catalog; the Challenges menu has the Labs tile; motion is gated and stops
 * under reduced motion. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/labs'))
fs.mkdirSync(OUT, { recursive: true })
let n = 0
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); n++; console.log('PASS - ' + name) }
const open = async (page, route) => {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.lb-hero h1', { timeout: 20000 })
  await page.waitForSelector('.lb-empty, .lb-capsule, [role=alert]', { timeout: 20000 })
  await page.waitForTimeout(500)
}

;(async () => {
  const browser = await chromium.launch(); const errors = []
  const labs = await (await fetch(`${BASE}/labs`)).json()
  const catalog = await (await fetch(`${BASE}/purchases/plans`)).json()
  const active = labs.current[0] ?? null
  try {
    ok('GET /labs answers with current, previous and the comparison plans', Array.isArray(labs.current) && Array.isArray(labs.previous) && labs.reference.length > 0)
    ok('drops never appear in the normal plan catalog', ![...labs.current, ...labs.previous].some(d => catalog.plans.some(p => p.slug === d.slug)))
    for (const [locale, dir] of [['en', 'ltr'], ['fa', 'rtl'], ['ar', 'rtl'], ['ru', 'ltr'], ['zh-CN', 'ltr']]) {
      for (const theme of ['dark', 'light']) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: theme, isMobile: true })
        page.on('pageerror', e => errors.push(String(e)))
        await page.addInitScript(t => { try { localStorage.setItem('openfund-theme', t); localStorage.setItem('of-theme', t) } catch {} }, theme)
        await open(page, `/${locale}/labs`)
        const r = await page.evaluate(() => ({ dir: document.documentElement.dir, overflow: document.documentElement.scrollWidth - innerWidth,
          empty: !!document.querySelector('.lb-empty'), capsule: !!document.querySelector('.lb-capsule'), buy: document.querySelectorAll('.lb-checkout a').length,
          tile: !!document.querySelector(`a.mega-tile[href$="/labs"]`) }))
        ok(`${locale} ${theme}: ${dir}, ${active ? 'the drop capsule' : 'the no-drop state with nothing for sale'}, the menu tile, no overflow`,
          r.dir === dir && r.overflow <= 0 && r.tile && (active ? r.capsule : r.empty && !r.capsule && r.buy === 0), JSON.stringify(r))
        if (theme === 'dark') await page.screenshot({ path: path.join(OUT, `labs-${locale}-390.png`) })
        await page.close()
      }
    }
    for (const w of [360, 768, 1024, 1280, 1440, 1920]) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, '/en/labs')
      ok(`${w} px: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth - innerWidth <= 0))
      await page.close()
    }
    if (active) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, '/en/labs')
      const text = await page.locator('.lb-capsule').textContent()
      ok('the capsule shows the drop number and the real inventory', text.includes(`Drop #${active.number}`) && text.includes(`${active.available} of ${active.inventory} accounts left`) && text.includes(`${active.sold} sold`), text.slice(0, 200))
      if (active.status === 'open' && active.available > 0) {
        const href = await page.locator('.lb-checkout a').getAttribute('href')
        ok('the buy button carries the drop to checkout', href.startsWith(`/en/checkout?plan=${active.slug}&size=`) && href.includes(`&lab=${active.slug}&qty=1`), href)
        ok('the quantity never exceeds the per-wallet cap', await page.locator('.lb-checkout option').count() === Math.min(active.perWalletCap, active.available))
      }
      ok('the drop rules use the objective cards', await page.locator('.lb-rules .ob-card').count() >= 7)
      await page.locator('.lb-capsule').scrollIntoViewIfNeeded(); await page.waitForTimeout(300)
      ok('the capsule animates only while on screen', await page.evaluate(() => !!document.querySelector('.lb-capsule[data-live]')))
      await page.close()
    } else {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, '/en/labs')
      ok('with no drop the page says so and links nowhere to buy', (await page.locator('.lb-empty h2').textContent()).includes('No drop is published yet') && await page.locator('a[href*="lab="]').count() === 0)
      ok('the Labs menu tile has no badge without an open drop', await page.locator('a.mega-tile[href="/en/labs"] .mega-badge').count() === 0)
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, '/en/labs')
      ok('the hero animates only while on screen', await page.evaluate(() => !!document.querySelector('.lb-hero[data-live]')))
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, '/en/labs')
      ok('reduced motion: no running animations', await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length === 0))
      await page.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${n} labs checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
