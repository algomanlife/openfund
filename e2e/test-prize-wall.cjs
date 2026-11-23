/* Premium League neon prize wall (owner fix 4).
 * Ranks 4–10: a neon "OpenFi Premium League" sign over a bento grid of six
 * tiles (console, controller, football, city, trading, account) that fills
 * the card width with no empty cell; an iconed prize list ($50,000 account,
 * PlayStation 5 Pro, GTA VI, EA SPORTS FC 27 as plain text); a short note.
 * Ranks 11–100: a neon coupon with a large 35%, a perforated stub and the
 * terms with the 90-day validity. Both cards are the same height. The podium
 * glows gold, silver and bronze. No platform button symbols appear; the
 * "illustration" label and the not-affiliated line stay. Motion runs only
 * while live, is transform/opacity only, and reduced motion leaves the signs
 * lit and steady. Tiles reflow to two columns, then one, and stay legible.
 * Seven widths, RTL and LTR, dark and light; screenshots at 390, 768 and
 * 1440 px; recordings in RTL and LTR. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/prize-wall'))
fs.mkdirSync(OUT, { recursive: true })
let n = 0
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); n++; console.log('PASS - ' + name) }
const open = async (page, loc) => {
  await page.goto(`${BASE}/${loc}/tournament`, { waitUntil: 'load' })
  await page.waitForSelector('.pw-wall', { timeout: 20000 })
  await page.locator('.tl-ranks4').evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(500)
}
const measure = () => {
  const box = e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom } }
  const tiles = [...document.querySelectorAll('.pw-tile')].map(t => ({ kind: t.className.replace('pw-tile is-', ''), ...box(t) }))
  const grid = box(document.querySelector('.pw-grid'))
  const cols = getComputedStyle(document.querySelector('.pw-grid')).gridTemplateColumns.split(' ').length
  /* empty cells: the tiles' area must fill the grid (minus gaps) */
  const area = tiles.reduce((s, t) => s + t.w * t.h, 0)
  const cards = [...document.querySelectorAll('.tl-prize-grid > .tl-card')].map(box)
  const section = document.querySelector('section[aria-labelledby="tl-prizes"]')
  return { tiles, cols, fill: area / (grid.w * grid.h), wall: box(document.querySelector('.pw-wall')), card4: cards[0], card11: cards[1],
    sign: document.querySelector('.pw-sign-board span').textContent, prizes: [...document.querySelectorAll('.pw-prizes li')].map(l => ({ text: l.textContent, icon: !!l.querySelector('svg'), h: l.getBoundingClientRect().height })),
    coupon: document.querySelector('.pw-coupon-main b').textContent, stub: !!document.querySelector('.pw-coupon-stub'), terms: [...document.querySelectorAll('.pw-terms li')].map(l => l.textContent),
    illustrative: !!document.querySelector('.pw-wall .tl-illustrative')?.textContent, symbols: /[△○✕□]/.test(section.textContent),
    notAffiliated: /Sony/.test(section.textContent), steps: [...document.querySelectorAll('.tl-step')].map(s => getComputedStyle(s).boxShadow !== 'none'),
    overflow: document.documentElement.scrollWidth - innerWidth, minTile: Math.min(...tiles.map(t => t.w)) }
}

;(async () => {
  const browser = await chromium.launch(); const errors = []
  try {
    for (const [w, h] of [[360, 740], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080]]) {
      for (const [loc, theme] of [['fa', 'dark'], ['en', 'light'], ['ar', 'dark'], ['ru', 'light'], ['zh-CN', 'dark']]) {
        const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: theme, isMobile: w < 768, hasTouch: w < 768 }); page.on('pageerror', e => errors.push(String(e)))
        await open(page, loc)
        const m = await page.evaluate(measure)
        const tag = `${loc} ${theme} ${w}`
        ok(`${tag}: six tiles fill the grid with no empty cell (${m.cols} columns)`, m.tiles.length === 6 && m.fill > 0.84 && m.cols === (w <= 480 ? 1 : w <= 900 ? 2 : 4), JSON.stringify({ fill: m.fill, cols: m.cols }))
        ok(`${tag}: the wall fills the card width; tiles stay legible`, m.wall.w > m.card4.w - 70 && m.minTile >= (w <= 480 ? 240 : 120), JSON.stringify({ wall: m.wall.w, card: m.card4.w, min: m.minTile }))
        ok(`${tag}: neon sign, iconed prize list with the four prizes as plain text`, /OpenFi/.test(m.sign) && m.prizes.length === 4 && m.prizes.every(p => p.icon && p.h >= 44)
          && ['PlayStation 5 Pro', 'GTA VI', 'EA SPORTS FC 27'].every(name => m.prizes.some(p => p.text.includes(name))) && /50|۵۰|٥٠/.test(m.prizes[0].text), JSON.stringify(m.prizes))
        ok(`${tag}: neon coupon with 35%, a perforated stub, three terms including 90 days`, /35|۳۵/.test(m.coupon) && m.stub && m.terms.length === 3, JSON.stringify(m.terms))
        if (w > 900) ok(`${tag}: both prize cards are the same height`, Math.abs(m.card4.h - m.card11.h) <= 1, JSON.stringify({ a: m.card4.h, b: m.card11.h }))
        ok(`${tag}: illustration label, not-affiliated line, glowing podium, no platform button symbols`, m.illustrative && m.notAffiliated && m.steps.every(Boolean) && !m.symbols)
        ok(`${tag}: no horizontal overflow`, m.overflow <= 0, String(m.overflow))
        if ([390, 768, 1440].includes(w) && ['fa', 'en'].includes(loc)) {
          const s = page.locator('section[aria-labelledby="tl-prizes"]')
          await s.screenshot({ path: path.join(OUT, `prize-wall-${loc}-${w}-${theme}.png`) })
        }
        await page.close()
      }
    }
    /* motion: live only, signs flicker on start-up, controller buttons light in sequence */
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/en/tournament`, { waitUntil: 'load' }); await page.waitForSelector('.pw-wall'); await page.waitForTimeout(400)
      ok('off screen: the wall is not live and nothing in it animates', await page.evaluate(() => !document.querySelector('.tl-ranks4[data-live]') && document.querySelector('.pw-wall').getAnimations({ subtree: true }).length === 0))
      await page.locator('.tl-ranks4').evaluate(e => e.scrollIntoView({ block: 'center', behavior: 'instant' })); await page.waitForTimeout(400)
      const a = await page.evaluate(() => {
        const names = new Set(document.querySelector('.tl-ranks4').getAnimations({ subtree: true }).map(x => x.animationName))
        const buttons = [...document.querySelectorAll('.pw-button')].map(b => getComputedStyle(b).animationDelay)
        return { names: [...names], buttons, stub: document.querySelector('.pw-coupon-stub').getAnimations().length }
      })
      ok('on screen: sign flicker, controller sequence, shot, city, candles and coupon tear run', ['pw-flicker', 'pw-blink', 'pw-shot', 'pw-drive', 'pw-rise'].every(x => a.names.includes(x)) && new Set(a.buttons).size === 4 && a.stub === 1, JSON.stringify(a))
      await page.close()
    }
    for (const loc of ['en', 'fa']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, loc)
      const r = await page.evaluate(() => ({ anims: document.querySelector('section[aria-labelledby="tl-prizes"]').getAnimations({ subtree: true }).length,
        sign: getComputedStyle(document.querySelector('.pw-sign-board span')).opacity, buttons: [...document.querySelectorAll('.pw-button')].map(b => getComputedStyle(b).opacity) }))
      ok(`reduced motion ${loc}: signs lit and steady, nothing animates`, r.anims === 0 && r.sign === '1' && r.buttons.every(o => o === '1'), JSON.stringify(r))
      await page.close()
    }
    for (const loc of ['fa', 'en']) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } })
      const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/${loc}/tournament`, { waitUntil: 'load' }); await page.waitForSelector('.pw-wall')
      await page.locator('.tl-prize-grid').evaluate(e => e.scrollIntoView({ block: 'start', behavior: 'instant' })); await page.waitForTimeout(8000)
      const video = page.video(); await ctx.close()
      fs.renameSync(await video.path(), path.join(OUT, `prize-wall-${loc}.webm`))
    }
    ok('no uncaught page errors', errors.length === 0, errors.join(' | '))
    console.log(`\n${n} prize wall checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
