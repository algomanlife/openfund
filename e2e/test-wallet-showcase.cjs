/* Wallet showcase browser acceptance (workstream 3): placement after Market
 * Pulse, real continuous motion with a seamless loop distance, pause on hover
 * and off screen, reduced motion, deterministic demo data with labels,
 * RTL/LTR, dark/light, mobile without overflow, layout shift, terminal
 * routes untouched, and a short video of the motion. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/wallet-showcase'))
fs.mkdirSync(OUT, { recursive: true })
const results = []
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); results.push(name); console.log('PASS - ' + name) }
const translateX = page => page.evaluate(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.ws-track')).transform).m41)

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const open = async (path, { width = 1440, height = 900, reducedMotion = 'no-preference', theme, video } = {}) => {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion, colorScheme: theme === 'dark' ? 'dark' : 'light', ...(video ? { recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } } : {}) })
    await context.addInitScript(() => {
      /* shifts inside the showcase (its own layout). When the live market
         table above it fills in, the whole host is pushed down: that shift
         belongs to the table, not to the showcase, and is not counted */
      window.__cls = 0
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) {
          if (e.hadRecentInput) continue
          const host = document.querySelector('.wallet-showcase-host')
          /* if the host itself moved, the whole block was pushed by content
             above (rects are clipped to the viewport, so a pushed child can
             look resized); only shifts while the host stays put are internal */
          const pushed = host && e.sources.some(s => s.node === host)
          const ours = host && !pushed && e.sources.some(s => s.node && s.node.nodeType === 1 && host.contains(s.node) && !s.node.closest('.ws-track'))
          if (ours) { window.__cls += e.value; (window.__clsLog ||= []).push(e.sources.map(s => `${s.node?.className || s.node?.nodeName} dy=${Math.round(s.currentRect.y - s.previousRect.y)} dh=${Math.round(s.currentRect.height - s.previousRect.height)}`).join(' | ') + ` @${Math.round(e.startTime)}`) }
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(String(e)))
    await page.goto(BASE + path, { waitUntil: 'load' })
    await page.locator('.ws-section').waitFor({ timeout: 30000 })
    if (theme) { await page.evaluate(t => { document.documentElement.dataset.theme = t }, theme); await page.waitForTimeout(150) }
    return { context, page }
  }
  try {
    /* placement and content */
    {
      const { context, page } = await open('/en/challenges', { theme: 'dark' })
      const place = await page.evaluate(() => {
        const host = document.querySelector('.wallet-showcase-host')
        return { prev: host.previousElementSibling?.id, next: host.nextElementSibling?.className }
      })
      ok('placed directly after Market Pulse (#markets) and before the next section', place.prev === 'markets' && /platform-section/.test(place.next), JSON.stringify(place))
      const cards = await page.locator('.ws-list:not(.ws-clone) .ws-card').count()
      const labelled = await page.locator('.ws-list:not(.ws-clone) .ws-badge', { hasText: 'Demo account' }).count()
      ok(`every card is labelled as a demo account (${cards})`, cards >= 10 && labelled === cards)
      ok('the section states that the data is illustrative and not real traders', /not Openfund traders, accounts or verified results/.test(await page.locator('.ws-disclaimer').innerText()))
      const addresses = await page.locator('.ws-list:not(.ws-clone) .ws-address').allInnerTexts()
      ok('addresses are shortened 0x…xxxx and read LTR', addresses.every(a => /^0x[0-9a-fA-F]{4}…[0-9a-fA-F]{4}$/.test(a)) && await page.locator('.ws-address').first().getAttribute('dir') === 'ltr', addresses[0])
      ok('the loop copy is hidden from assistive technology', await page.locator('.ws-clone').getAttribute('aria-hidden') === 'true')
      const render = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.ws-list:not(.ws-clone) .ws-card')]
        return {
          placeholders: cards.some(c => /[{}$]/.test(c.innerText)),
          oneLine: cards.every(c => { const a = c.querySelector('.ws-address'); return a.getBoundingClientRect().height < parseFloat(getComputedStyle(a).lineHeight) * 1.5 }),
          sticky: cards.some(c => [...c.querySelectorAll('*')].some(n => getComputedStyle(n).position === 'sticky')),
          trades: /\d+ demo trades/.test(cards[0].innerText),
        }
      })
      ok('card copy is complete: counts filled in, addresses on one line, no inherited sticky elements', !render.placeholders && render.oneLine && !render.sticky && render.trades, JSON.stringify(render))
      await page.reload({ waitUntil: 'load' }); await page.locator('.ws-section').waitFor()
      ok('demo data is deterministic across loads', JSON.stringify(await page.locator('.ws-list:not(.ws-clone) .ws-address').allInnerTexts()) === JSON.stringify(addresses))

      /* motion */
      await page.locator('.ws-section').scrollIntoViewIfNeeded()
      await page.mouse.move(5, 5)
      await page.waitForFunction(() => document.querySelector('.ws-section').classList.contains('ws-running'))
      const a = await translateX(page); await page.waitForTimeout(1200); const b = await translateX(page); await page.waitForTimeout(1200); const c = await translateX(page)
      ok('cards move continuously in one direction', b < a && c < b, `${a.toFixed(1)} → ${b.toFixed(1)} → ${c.toFixed(1)}`)
      ok('speed is steady (linear)', Math.abs((a - b) - (b - c)) < Math.max(4, Math.abs(a - b) * 0.25), `${(a - b).toFixed(1)} vs ${(b - c).toFixed(1)} px per 1.2 s`)
      const loop = await page.evaluate(() => {
        const lists = document.querySelectorAll('.ws-list'), track = document.querySelector('.ws-track')
        const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap)
        return { first: lists[0].getBoundingClientRect().width, clone: lists[1].getBoundingClientRect().width, gap, track: track.getBoundingClientRect().width }
      })
      ok('the loop is seamless: both copies are identical and the travel equals one copy plus the gap', Math.abs(loop.first - loop.clone) < 0.5 && Math.abs(loop.track / 2 - loop.gap / 2 - loop.first) < 1, JSON.stringify(loop))
      /* a moving card is never "stable" for Playwright's hover: point at it directly */
      const box = await page.locator('.ws-list:not(.ws-clone) .ws-card').nth(2).boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(150)
      const h1 = await translateX(page); await page.waitForTimeout(700); const h2 = await translateX(page)
      ok('hover pauses the movement', Math.abs(h1 - h2) < 0.5)
      await page.mouse.move(5, 5)
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(400)
      ok('off screen the loop stops running', !(await page.evaluate(() => document.querySelector('.ws-section').classList.contains('ws-running'))))
      await page.locator('.ws-section').scrollIntoViewIfNeeded(); await page.waitForTimeout(600)
      await page.screenshot({ path: path.join(OUT, 'showcase-en-dark-desktop.png'), clip: await page.locator('.ws-section').boundingBox() })
      ok(`the showcase's own content does not shift (CLS ${(await page.evaluate(() => window.__cls)).toFixed(3)})`, await page.evaluate(() => window.__cls) < 0.01, JSON.stringify(await page.evaluate(() => window.__clsLog)))
      /* it can only push later content if its own height changes after mount */
      const h1s = await page.evaluate(() => document.querySelector('.wallet-showcase-host').getBoundingClientRect().height)
      await page.waitForTimeout(2500)
      const h2s = await page.evaluate(() => document.querySelector('.wallet-showcase-host').getBoundingClientRect().height)
      ok(`its height is stable after mount, so nothing below is pushed (${h1s.toFixed(0)} px)`, Math.abs(h1s - h2s) < 1, `${h1s} → ${h2s}`)
      await context.close()
    }
    /* Persian RTL, light theme, mobile */
    for (const [route, opts, shot] of [
      ['/fa/challenges', { width: 1440, theme: 'dark' }, 'showcase-fa-dark-desktop'],
      ['/fa/challenges', { width: 1440, theme: 'light' }, 'showcase-fa-light-desktop'],
      ['/en/challenges', { width: 1440, theme: 'light' }, 'showcase-en-light-desktop'],
      ['/fa/challenges', { width: 375, height: 800, theme: 'dark' }, 'showcase-fa-dark-375'],
      ['/en/challenges', { width: 390, height: 844, theme: 'light' }, 'showcase-en-light-390'],
      ['/fa/challenges', { width: 768, height: 1024, theme: 'dark' }, 'showcase-fa-dark-768'],
    ]) {
      const { context, page } = await open(route, opts)
      await page.locator('.ws-section').scrollIntoViewIfNeeded(); await page.waitForTimeout(700)
      const m = await page.evaluate(() => {
        const s = document.querySelector('.ws-section'), card = document.querySelector('.ws-card').getBoundingClientRect()
        return { overflow: document.documentElement.scrollWidth - innerWidth, dir: s.getAttribute('dir'), cardWidth: card.width,
          contrast: getComputedStyle(document.querySelector('.ws-address')).color, height: s.getBoundingClientRect().height, theme: document.documentElement.dataset.theme || 'light' }
      })
      const rtl = route.startsWith('/fa')
      ok(`${shot}: ${rtl ? 'RTL' : 'LTR'}, ${opts.theme ?? 'light'} theme, no horizontal overflow, cards ≥ 200 px, compact section`, m.dir === (rtl ? 'rtl' : 'ltr') && m.overflow <= 0 && m.cardWidth >= 200 && m.height < 520 && m.theme === (opts.theme ?? 'light'), JSON.stringify(m))
      await page.screenshot({ path: path.join(OUT, shot + '.png'), clip: await page.locator('.ws-section').boundingBox() })
      await context.close()
    }
    /* reduced motion: static, scrollable, single list */
    {
      const { context, page } = await open('/en/challenges', { reducedMotion: 'reduce' })
      await page.locator('.ws-section').scrollIntoViewIfNeeded(); await page.waitForTimeout(300)
      const a = await translateX(page); await page.waitForTimeout(1000); const b = await translateX(page)
      const r = await page.evaluate(() => ({ clone: getComputedStyle(document.querySelector('.ws-clone')).display, scroll: getComputedStyle(document.querySelector('.ws-viewport')).overflowX }))
      ok('reduced motion: no movement, no duplicate list, horizontally scrollable', a === b && r.clone === 'none' && r.scroll === 'auto', JSON.stringify(r))
      await context.close()
    }
    /* terminal routes unaffected */
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
      const page = await context.newPage()
      await page.goto(BASE + '/en/prop/dashboard', { waitUntil: 'load' }); await page.waitForTimeout(2500)
      ok('terminal routes do not mount the showcase', await page.locator('.ws-section').count() === 0)
      await context.close()
    }
    /* video evidence of the real motion */
    {
      const { context, page } = await open('/en/challenges', { width: 1280, height: 720, video: true, theme: 'dark' })
      await page.locator('.ws-section').scrollIntoViewIfNeeded(); await page.mouse.move(5, 5); await page.waitForTimeout(7000)
      const video = page.video(); await context.close()
      fs.renameSync(await video.path(), path.join(OUT, 'showcase-motion-en-dark.webm'))
      ok('a 7 s video of the motion is recorded', fs.statSync(path.join(OUT, 'showcase-motion-en-dark.webm')).size > 50_000)
    }
    ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${results.length} wallet showcase checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
