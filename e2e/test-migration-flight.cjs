/* /migrate flamingo flight (owner fix 2), checked on the rendered page.
 * The scene's CSS animations are scrubbed to every second of the 48-second
 * loop (Web Animations currentTime) and measured in screen coordinates:
 *   - every visible bird's head leads its movement, in RTL (fa, ar) and LTR
 *     (en, ru, zh-CN);
 *   - no bird touches a line of the copy or a call to action at desktop
 *     widths; at 1180 px and below the scene sits above the copy;
 *   - at least four birds are visible at every second (three on phones);
 *   - motion runs only while the hero is on screen; reduced motion shows the
 *     composed still (one flying, one landing, two standing).
 * Screenshots at 390, 768 and 1440 px; recordings in RTL and LTR. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/migration-flight'))
fs.mkdirSync(OUT, { recursive: true })
let n = 0
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); n++; console.log('PASS - ' + name) }
const MASTER = 48

/* scrub every scene animation to `sec` and measure the visible birds */
const measureAt = (sec) => {
  const root = document.querySelector('.mh-root')
  for (const a of root.getAnimations({ subtree: true })) { a.pause(); a.currentTime = sec * 1000 }
  const view = root.getBoundingClientRect()
  return [...root.querySelectorAll('.mh-bird')].filter(b => getComputedStyle(b).display !== 'none').map(b => {
    const pose = [...b.querySelectorAll('.mh-pose')].map(p => [p, +getComputedStyle(p).opacity]).sort((x, y) => y[1] - x[1])[0]
    const visiblePose = pose && pose[1] > 0.5 ? pose[0] : null
    const o = +getComputedStyle(b).opacity
    const r = (visiblePose || b).getBoundingClientRect()
    const head = visiblePose?.querySelector('.mh-head')?.getBoundingClientRect()
    const ctm = b.getScreenCTM()
    const inView = r.right > view.left + 4 && r.left < view.right - 4 && r.bottom > view.top + 4 && r.top < view.bottom - 4 && r.width > 2
    return { id: b.dataset.track, o, pose: visiblePose?.classList[1]?.replace('is-', ''), box: { l: r.left, r: r.right, t: r.top, b: r.bottom }, cx: (r.left + r.right) / 2,
      head: head ? (head.left + head.right) / 2 : null, ex: ctm.e, ey: ctm.f, seen: o > 0.3 && !!visiblePose && inView }
  })
}
const copyRects = () => {
  const rects = []
  const walker = document.createTreeWalker(document.querySelector('.mg-hero-copy'), NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) { if (!walker.currentNode.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(walker.currentNode); rects.push(...[...r.getClientRects()].map(x => ({ l: x.left, r: x.right, t: x.top, b: x.bottom }))) }
  rects.push(...[...document.querySelectorAll('.mg-hero-copy :is(a, button)')].map(e => { const x = e.getBoundingClientRect(); return { l: x.left, r: x.right, t: x.top, b: x.bottom } }))
  return rects.filter(r => r.r - r.l > 0)
}
const overlap = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b

;(async () => {
  const browser = await chromium.launch(); const errors = []
  try {
    for (const [loc, w, h] of [['en', 1440, 900], ['fa', 1440, 900], ['ar', 1280, 800], ['ru', 1280, 800], ['zh-CN', 1920, 1080], ['fa', 1920, 1080], ['en', 1366, 768], ['fa', 390, 844], ['en', 768, 1024], ['ru', 1024, 768]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: 'dark', isMobile: w < 768, hasTouch: w < 768 }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/${loc}/migrate`, { waitUntil: 'load' }); await page.waitForSelector('.mh-root .mh-bird', { state: 'attached' }); await page.waitForTimeout(800)
      const tag = `${loc} ${w}`
      const rtl = await page.evaluate(() => document.documentElement.dir === 'rtl')
      ok(`${tag}: ${rtl ? 'RTL' : 'LTR'} page, scene live while on screen`, rtl === ['fa', 'ar'].includes(loc) && await page.evaluate(() => document.querySelector('.mh-root').hasAttribute('data-live')))
      const stacked = await page.evaluate(() => document.querySelector('.mh-root').getBoundingClientRect().bottom <= document.querySelector('.mg-hero-copy h1').getBoundingClientRect().top + 1)
      if (w <= 1180) ok(`${tag}: the scene sits above the copy (≤1180 px)`, stacked)
      const copy = await page.evaluate(copyRects)
      let minSeen = 99, facingChecks = 0, wrong = [], crossings = []
      for (let sec = 0; sec < MASTER; sec += 1) {
        const a = await page.evaluate(measureAt, sec), b = await page.evaluate(measureAt, sec + 0.15)
        minSeen = Math.min(minSeen, a.filter(x => x.seen).length)
        for (const bird of a) {
          if (!bird.seen) continue
          if (!stacked) for (const c of copy) if (overlap(bird.box, c)) crossings.push(`${sec}s ${bird.id} ${JSON.stringify(bird.box)} × ${JSON.stringify(c)}`)
          const next = b.find(x => x.id === bird.id)
          const dx = next.ex - bird.ex
          if (!bird.head || Math.abs(dx) < 1.5 || !next.seen || next.pose !== bird.pose) continue
          facingChecks++
          if (Math.sign(bird.head - bird.cx) !== Math.sign(dx)) wrong.push(`${sec}s ${bird.id} ${bird.pose} dx=${dx.toFixed(1)} head-centre=${(bird.head - bird.cx).toFixed(1)}`)
        }
      }
      ok(`${tag}: heads lead the movement (${facingChecks} bird-seconds checked)`, wrong.length === 0 && facingChecks > 40, wrong.slice(0, 5).join(' | '))
      if (!stacked) ok(`${tag}: no bird crosses a line of copy or a call to action`, crossings.length === 0, crossings.slice(0, 3).join(' | '))
      ok(`${tag}: at least ${w < 768 ? 3 : 4} birds visible at every second (min ${minSeen})`, minSeen >= (w < 768 ? 3 : 4))
      ok(`${tag}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      if ([390, 768, 1440].includes(w) && ['en', 'fa'].includes(loc)) {
        await page.evaluate(sec => { for (const a of document.querySelector('.mh-root').getAnimations({ subtree: true })) a.currentTime = sec * 1000 }, 21)
        await page.screenshot({ path: path.join(OUT, `migrate-flight-${loc}-${w}.png`) })
      }
      /* off screen: paused */
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(600)
      ok(`${tag}: motion pauses when the hero leaves the screen`, await page.evaluate(() => !document.querySelector('.mh-root').hasAttribute('data-live') && getComputedStyle(document.querySelector('.mh-bird')).animationPlayState === 'paused'))
      await page.close()
    }
    /* reduced motion: the composed still */
    for (const [loc, w, h] of [['en', 1440, 900], ['fa', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/${loc}/migrate`, { waitUntil: 'load' }); await page.waitForSelector('.mh-root .mh-bird', { state: 'attached' }); await page.waitForTimeout(600)
      const s = await page.evaluate(() => {
        const birds = [...document.querySelectorAll('.mh-bird')].filter(b => getComputedStyle(b).display !== 'none')
        return { anims: document.querySelector('.mh-root').getAnimations({ subtree: true }).length, poses: birds.map(b => [...b.querySelectorAll('.mh-pose')].find(p => getComputedStyle(p).opacity === '1')?.classList[1]) }
      })
      const count = p => s.poses.filter(x => p.includes(x)).length
      ok(`reduced motion ${loc} ${w}: a still with one flying, one landing, two standing, no animation`, s.anims === 0 && s.poses.length === 4 && count(['is-fly']) === 1 && count(['is-flare', 'is-glide']) === 1 && count(['is-stand', 'is-wade', 'is-feed']) === 2, JSON.stringify(s))
      await page.screenshot({ path: path.join(OUT, `migrate-still-${loc}-${w}.png`) })
      await page.close()
    }
    /* recordings: RTL and LTR */
    for (const loc of ['fa', 'en']) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } })
      const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/${loc}/migrate`, { waitUntil: 'load' }); await page.waitForTimeout(12000)
      const video = page.video(); await ctx.close()
      fs.renameSync(await video.path(), path.join(OUT, `migrate-flight-${loc}.webm`))
    }
    ok('no uncaught page errors', errors.length === 0, errors.join(' | '))
    console.log(`\n${n} migration flight checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
