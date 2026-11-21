/* Wallet showcase browser acceptance: placement after Market Pulse, a
 * full-bleed strip with a seamless constant-speed loop that always covers the
 * viewport (also after a resize), RTL entering from the right and LTR
 * mirrored, pause only on a hovered card or keyboard focus (arrows step one
 * card), the scanner beam with the card/data layers on either side, no data
 * layer below 768 px, pause off screen, reduced motion, deterministic demo
 * data with labels, dark/light, mobile without overflow, layout shift,
 * terminal routes untouched, and a short video of the motion. */
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
          /* Chrome lists at most five sources per shift and picks the largest
             nodes, so the full-width section can be listed instead of its
             host; a moved node that precedes the host also means a push */
          const pushed = host && e.sources.some(s => s.node === host || (s.node && s.node.nodeType === 1 && !host.contains(s.node) && !s.node.contains(host) && (s.node.compareDocumentPosition(host) & Node.DOCUMENT_POSITION_FOLLOWING)))
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
      ok('LTR: cards enter from the left and move right continuously', b > a && c > b, `${a.toFixed(1)} → ${b.toFixed(1)} → ${c.toFixed(1)}`)
      /* steadiness is a property of the animation, not of a busy runner's timer */
      const loopAnim = await page.evaluate(() => {
        const a = document.querySelector('.ws-track').getAnimations().find(x => x.animationName === 'ws-loop')
        return a && { state: a.playState, easing: a.effect.getKeyframes()[0].easing, iterations: a.effect.getTiming().iterations }
      })
      ok('speed is steady: one linear, infinite, running loop animation', loopAnim && loopAnim.state === 'running' && loopAnim.easing === 'linear' && loopAnim.iterations === Infinity, JSON.stringify(loopAnim))
      const loop = await page.evaluate(() => {
        const lists = document.querySelectorAll('.ws-layer-cards .ws-list'), track = document.querySelector('.ws-track')
        const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap)
        const anim = track.getAnimations().find(x => x.animationName === 'ws-loop'), duration = anim.effect.getComputedTiming().duration
        const at = t => { anim.currentTime = t; return new DOMMatrixReadOnly(getComputedStyle(track).transform).m41 }
        const saved = anim.currentTime, travel = Math.abs(at(0) - at(duration - 0.001)); anim.currentTime = saved
        const vp = document.querySelector('.ws-viewport')
        return { copies: lists.length, first: lists[0].getBoundingClientRect().width, clone: lists[1].getBoundingClientRect().width, gap, travel,
          track: track.getBoundingClientRect().width, viewport: vp.getBoundingClientRect().width, page: document.documentElement.clientWidth }
      })
      ok('the loop is seamless: copies are identical and the travel equals one copy plus the gap', Math.abs(loop.first - loop.clone) < 0.5 && Math.abs(loop.travel - loop.first - loop.gap) < 1, JSON.stringify(loop))
      ok('the strip is full-bleed and the track always covers the viewport plus one copy', Math.abs(loop.viewport - loop.page) < 1 && loop.track >= loop.viewport + loop.first, JSON.stringify(loop))
      const beam = await page.evaluate(() => {
        const b = document.querySelector('.ws-beam').getBoundingClientRect(), v = document.querySelector('.ws-viewport').getBoundingClientRect()
        const clip = s => getComputedStyle(document.querySelector(s)).clipPath
        return { center: b.left + b.width / 2 - (v.left + v.width / 2), cards: clip('.ws-layer-cards'), data: clip('.ws-layer-data'),
          dataShown: getComputedStyle(document.querySelector('.ws-layer-data')).display !== 'none', dataHidden: document.querySelector('.ws-layer-data').getAttribute('aria-hidden'),
          synced: [...document.querySelectorAll('.ws-track')].map(t => t.getAnimations()[0]?.currentTime) }
      })
      ok('a fixed scanner beam sits at the centre; LTR cards are clipped to the left and the data layer to the right, in sync', Math.abs(beam.center) < 2 && /inset\(-40px 50% -40px 0/.test(beam.cards) && /inset\(-40px 0px -40px 50%/.test(beam.data) && beam.dataShown && beam.dataHidden === 'true' && beam.synced[0] === beam.synced[1], JSON.stringify(beam))
      /* pointer over the section but not over a card keeps it moving */
      const heading = await page.locator('#ws-title').boundingBox()
      await page.mouse.move(heading.x + 4, heading.y + 4); await page.waitForTimeout(150)
      const s1 = await translateX(page); await page.waitForTimeout(700); const s2 = await translateX(page)
      ok('hovering the section outside a card does not pause it', s2 > s1 + 5, `${s1} → ${s2}`)
      /* a moving card is never "stable" for Playwright's hover: point at one on the card side (left of the beam in LTR) */
      const box = await page.evaluate(() => {
        const mid = innerWidth / 2
        const r = [...document.querySelectorAll('.ws-layer-cards .ws-card')].map(c => c.getBoundingClientRect()).find(r => r.left > 60 && r.right < mid - 60)
        return r && { x: r.x, y: r.y, width: r.width, height: r.height }
      })
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(150)
      const h1 = await translateX(page); await page.waitForTimeout(700); const h2 = await translateX(page)
      ok('hovering one card pauses the movement', Math.abs(h1 - h2) < 0.5)
      await page.mouse.move(5, 5); await page.waitForTimeout(300)
      const r1 = await translateX(page); await page.waitForTimeout(500)
      ok('leaving the card resumes it', (await translateX(page)) > r1 + 3)
      /* keyboard: focus pauses and reveals the cards; arrows step one card */
      await page.keyboard.press('Shift'); await page.focus('.ws-viewport'); await page.waitForTimeout(200)
      const k1 = await translateX(page); await page.waitForTimeout(600); const k2 = await translateX(page)
      const revealed = await page.evaluate(() => getComputedStyle(document.querySelector('.ws-layer-cards')).clipPath === 'none' && getComputedStyle(document.querySelector('.ws-viewport')).boxShadow !== 'none')
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(100); const k3 = await translateX(page)
      ok('keyboard focus pauses the strip, shows every card with a visible focus ring, and ArrowRight steps one card', Math.abs(k1 - k2) < 0.5 && revealed && Math.abs(Math.abs(k3 - k2) - 264) < 2, `${k1} ${k2} ${k3} ${revealed}`)
      await page.evaluate(() => document.activeElement.blur())
      /* resize: still covered and seamless at a very wide viewport */
      await page.setViewportSize({ width: 3840, height: 1000 }); await page.waitForTimeout(500)
      const wide = await page.evaluate(() => ({ copies: document.querySelectorAll('.ws-layer-cards .ws-list').length, dataCopies: document.querySelectorAll('.ws-data-list').length,
        track: document.querySelector('.ws-track').getBoundingClientRect().width, first: document.querySelector('.ws-list').getBoundingClientRect().width, viewport: document.querySelector('.ws-viewport').clientWidth }))
      ok('after resizing to 3840 px more copies are added and the track still covers the viewport plus one copy', wide.copies >= 3 && wide.copies === wide.dataCopies && wide.track >= wide.viewport + wide.first, JSON.stringify(wide))
      await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(300)
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
      await page.mouse.move(2, 2)
      const d1 = await translateX(page); await page.waitForTimeout(900); const d2 = await translateX(page)
      const layers = await page.evaluate(() => ({ data: getComputedStyle(document.querySelector('.ws-layer-data')).display, beam: getComputedStyle(document.querySelector('.ws-beam')).display, cards: getComputedStyle(document.querySelector('.ws-layer-cards')).clipPath }))
      const narrow = (opts.width ?? 1440) < 768
      ok(`${shot}: ${rtl ? 'enters from the right (moves left)' : 'enters from the left (moves right)'}; ${narrow ? 'no data layer, beam glow only' : 'data layer on the exit side'}`,
        (rtl ? d2 < d1 : d2 > d1) && layers.beam !== 'none' && (narrow ? layers.data === 'none' && layers.cards === 'none' : layers.data !== 'none' && (rtl ? /inset\(-40px 0px -40px 50%/ : /inset\(-40px 50% -40px 0/).test(layers.cards)), JSON.stringify({ d1, d2, ...layers }))
      await page.screenshot({ path: path.join(OUT, shot + '.png'), clip: await page.locator('.ws-section').boundingBox() })
      await context.close()
    }
    /* reduced motion: static, scrollable, single list */
    {
      const { context, page } = await open('/en/challenges', { reducedMotion: 'reduce' })
      await page.locator('.ws-section').scrollIntoViewIfNeeded(); await page.waitForTimeout(300)
      const a = await translateX(page); await page.waitForTimeout(1000); const b = await translateX(page)
      const r = await page.evaluate(() => ({ clone: getComputedStyle(document.querySelector('.ws-clone')).display, scroll: getComputedStyle(document.querySelector('.ws-viewport')).overflowX,
        beam: getComputedStyle(document.querySelector('.ws-beam')).display, data: getComputedStyle(document.querySelector('.ws-layer-data')).display }))
      ok('reduced motion: no movement, no duplicate list, no beam or data layer, horizontally scrollable', a === b && r.clone === 'none' && r.scroll === 'auto' && r.beam === 'none' && r.data === 'none', JSON.stringify(r))
      await page.screenshot({ path: path.join(OUT, 'showcase-en-reduced-motion.png'), clip: await page.locator('.ws-section').boundingBox() })
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
