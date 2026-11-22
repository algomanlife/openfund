/* Governance hero council chamber (illustration): ten seats; seats light one by
 * one; the tally and quorum bar follow; a stamp shows the outcome by the
 * council rules (quorum 7 participating, 6 approvals); it pauses off screen;
 * reduced motion shows the final frame; text is translated (ar/ru/zh-CN);
 * RTL/LTR fit without overflow from 360 to 1920 px. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/council-chamber'))
fs.mkdirSync(OUT, { recursive: true })
let n = 0
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); n++; console.log('PASS - ' + name) }
const state = page => page.evaluate(() => {
  const c = document.querySelector('.gv-chamber'), b = s => Number(c.querySelector(s)?.textContent)
  return { seats: c.querySelectorAll('.gv-ch-seat').length, cast: c.querySelectorAll('.gv-ch-seat[class*="is-"]').length, approve: b('.is-approve b'), reject: b('.is-reject b'), abstain: b('.is-abstain b'),
    stamp: c.querySelector('.gv-ch-stamp')?.getAttribute('class') || '', hidden: c.querySelector('svg').getAttribute('aria-hidden'), desc: c.querySelector('.sr-only')?.textContent || '', card: c.querySelector('.gv-ch-card-title')?.textContent || '' }
})

;(async () => {
  const browser = await chromium.launch(); const errors = []
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' }); page.on('pageerror', e => errors.push(String(e)))
    await page.goto(`${BASE}/en/governance`, { waitUntil: 'load' }); await page.locator('.gv-chamber').waitFor({ timeout: 20000 })
    let s = await state(page)
    ok('ten seats; decorative SVG with a text description that says it is an example', s.seats === 10 && s.hidden === 'true' && /example/i.test(s.desc), JSON.stringify(s))
    const t0 = Date.now(); let grew = false, last = s.cast
    while (Date.now() - t0 < 9000) { await page.waitForTimeout(300); s = await state(page); if (s.cast > last) grew = true; last = s.cast; if (s.stamp) break }
    ok('seats light one by one and the tally follows', grew && s.approve + s.reject + s.abstain === s.cast, JSON.stringify(s))
    ok('a stamp shows the outcome by the council rules', s.cast === 10 && /is-(approved|rejected)/.test(s.stamp)
      && (/is-approved/.test(s.stamp) === (s.approve + s.reject + s.abstain >= 7 && s.approve >= 6)), JSON.stringify(s))
    await page.locator('.gv-chamber').screenshot({ path: path.join(OUT, 'chamber-en-dark.png') })
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(400)
    const a = (await state(page)).cast; await page.waitForTimeout(1600); const b = (await state(page)).cast
    ok('pauses while off screen', a === b, `${a} → ${b}`)
    await page.close()

    const rm = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); rm.on('pageerror', e => errors.push(String(e)))
    await rm.goto(`${BASE}/en/governance`, { waitUntil: 'load' }); await rm.locator('.gv-chamber').waitFor()
    s = await state(rm); ok('reduced motion: final frame with the stamp', s.cast >= 9 && !!s.stamp, JSON.stringify(s)); await rm.close()

    for (const [loc, w, word] of [['ru', 1024, 'Кворум'], ['zh-CN', 390, '法定人数'], ['ar', 360, 'النصاب'], ['fa', 768, 'حد نصاب'], ['en', 1920, 'Quorum']]) {
      const p = await browser.newPage({ viewport: { width: w, height: 900 }, isMobile: w < 768 }); p.on('pageerror', e => errors.push(String(e)))
      await p.goto(`${BASE}/${loc}/governance`, { waitUntil: 'load' }); await p.locator('.gv-chamber').waitFor({ timeout: 20000 }); await p.waitForTimeout(500)
      const r = await p.evaluate(() => ({ quorum: document.querySelector('.gv-ch-quorum span').textContent, overflow: document.documentElement.scrollWidth - innerWidth, inside: (() => { const c = document.querySelector('.gv-chamber').getBoundingClientRect(); return c.left >= -1 && c.right <= innerWidth + 1 })() }))
      ok(`${loc} ${w} px: translated, inside the viewport, no overflow`, r.quorum.includes(word) && r.inside && r.overflow <= 0, JSON.stringify(r))
      await p.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${n} council chamber checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
