/* Applications page browser acceptance: hero window with real capture and
 * immediately painted hero text, sequence steps as real tabs (auto-advance,
 * click holds, arrow keys, no blank frame between frames), depth scene inside
 * its card, real web-terminal capture, platform cards without the leaked
 * sticky-header surface, RTL/LTR, dark/light, reduced motion, no horizontal
 * overflow and 44 px step targets on touch layouts. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/applications'))
fs.mkdirSync(OUT, { recursive: true })
const results = []
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); results.push(name); console.log('PASS - ' + name) }

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const open = async (route, { width = 1440, height = 900, theme = 'dark', reducedMotion = 'no-preference', touch = false } = {}) => {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion, hasTouch: touch, isMobile: touch })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(String(e)))
    await page.goto(BASE + route, { waitUntil: 'load' })
    await page.locator('#seq-focus-panel').waitFor({ state: 'attached', timeout: 30000 })
    return { context, page }
  }
  const scrollThrough = async page => {
    const h = await page.evaluate(() => innerHeight)
    for (let y = 0; y < 9000; y += h * 0.8) { await page.evaluate(v => scrollTo(0, v), y); await page.waitForTimeout(100) }
    await page.waitForTimeout(500)
  }
  try {
    for (const [route, opts, shot] of [
      ['/en/apps', { width: 1440, theme: 'dark' }, 'apps-en-dark-1440'],
      ['/fa/apps', { width: 1440, theme: 'light' }, 'apps-fa-light-1440'],
      ['/fa/apps', { width: 768, height: 1024, theme: 'dark' }, 'apps-fa-dark-768'],
      ['/en/apps', { width: 390, height: 844, theme: 'light', touch: true }, 'apps-en-light-390'],
      ['/ar/apps', { width: 390, height: 844, theme: 'dark', touch: true }, 'apps-ar-dark-390'],
    ]) {
      const { context, page } = await open(route, opts)
      await page.waitForTimeout(150)
      const text = await page.evaluate(() => ({ h1: getComputedStyle(document.querySelector('.of-apps-hero h1')).opacity, intro: getComputedStyle(document.querySelector('.of-apps-hero .hero-intro')).opacity }))
      ok(`${shot}: hero text is painted at full opacity immediately (LCP not delayed)`, text.h1 === '1' && text.intro === '1', JSON.stringify(text))
      await scrollThrough(page)
      const m = await page.evaluate(() => {
        const tabs = [...document.querySelectorAll('[role=tablist] [role=tab]')]
        const depth = document.querySelector('.of-apps-depth').getBoundingClientRect(), main = document.querySelector('.of-depth-main').getBoundingClientRect()
        const header = getComputedStyle(document.querySelector('.of-app-card-head'))
        return {
          overflow: document.documentElement.scrollWidth - innerWidth, dir: document.documentElement.dir || document.querySelector('[dir]')?.dir,
          tabs: tabs.length, selected: tabs.filter(t => t.getAttribute('aria-selected') === 'true').length, panels: document.querySelectorAll('[role=tabpanel]').length,
          controls: tabs.every(t => document.getElementById(t.getAttribute('aria-controls'))), minTab: Math.min(...tabs.map(t => t.getBoundingClientRect().height)),
          depthFits: main.bottom <= depth.bottom + 1, headerBg: header.backgroundColor, headerBlur: header.backdropFilter,
          heroImg: document.querySelector('.of-apps-hero-window img').naturalWidth, web: document.querySelector('.of-apps-webshot img').currentSrc,
          broken: [...document.querySelectorAll('.of-apps-hero img, .of-apps-depth img, .of-seq-stage img, .of-apps-webshot img')].filter(i => i.complete && i.naturalWidth === 0).length,
        }
      })
      ok(`${shot}: no horizontal overflow; 7 step tabs in 2 tablists with panels; depth scene inside its box; real captures load`,
        m.overflow <= 0 && m.tabs === 7 && m.selected === 2 && m.panels === 2 && m.controls && m.depthFits && m.heroImg === 1440 && m.broken === 0, JSON.stringify(m))
      ok(`${shot}: platform card headers do not inherit the sticky header surface`, /rgba\(0, 0, 0, 0\)|transparent/.test(m.headerBg) && m.headerBlur === 'none', JSON.stringify(m))
      ok(`${shot}: web card shows the real ${route.startsWith('/fa') ? 'Persian' : 'English'} web-terminal capture`, m.web.endsWith(route.startsWith('/fa') ? 'terminal-fa.jpg' : 'terminal-en.jpg'), m.web)
      if (opts.touch) ok(`${shot}: step tabs are at least 44 px tall on touch layouts`, m.minTab >= 44, String(m.minTab))
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300)
      await page.screenshot({ path: path.join(OUT, shot + '.png'), fullPage: true })
      await context.close()
    }
    /* sequence behaviour */
    {
      const { context, page } = await open('/en/apps')
      await page.locator('#seq-focus-panel').scrollIntoViewIfNeeded(); await page.waitForTimeout(400)
      const selected = () => page.evaluate(() => [...document.querySelectorAll('[aria-controls=seq-focus-panel]')].findIndex(t => t.getAttribute('aria-selected') === 'true'))
      const visible = () => page.evaluate(() => [...document.querySelectorAll('#seq-focus-panel img')].filter(i => getComputedStyle(i).opacity !== '0').length)
      let blank = 0
      for (let t = 0; t < 30; t++) { if (await visible() === 0) blank++; await page.waitForTimeout(300) }
      ok('a frame is visible at every sample across several transitions (no blank gap)', blank === 0, String(blank))
      const first = await selected(); await page.waitForTimeout(4200)
      ok('steps advance automatically', (await selected()) !== first)
      ok('the first focused-analysis frame is the watchlist capture, not the empty start screen', await page.evaluate(() => document.querySelector('#seq-focus-panel img').getAttribute('src').endsWith('watchlist-ticket.webp')))
      await page.click('#seq-focus-tab-2'); await page.waitForTimeout(5000)
      ok('clicking a step shows that frame and holds auto-advance', (await selected()) === 2 && await page.evaluate(() => document.querySelector('#seq-focus-panel img.is-active').alt.length > 0))
      await page.focus('#seq-focus-tab-2'); await page.keyboard.press('ArrowRight')
      ok('arrow keys move between steps with roving focus', (await selected()) === 0 && await page.evaluate(() => document.activeElement.id === 'seq-focus-tab-0' && document.activeElement.tabIndex === 0))
      await page.locator('#seq-layout-panel').scrollIntoViewIfNeeded(); await page.click('#seq-layout-tab-0'); await page.waitForTimeout(1200); await page.click('#seq-layout-tab-1'); await page.waitForTimeout(250)
      const clip = await page.evaluate(() => { const i = document.querySelector('#seq-layout-panel img.is-active'); return { reveal: i.dataset.reveal, anim: getComputedStyle(i).animationName } })
      ok('one → two charts is revealed by a split clip-path wipe', clip.reveal === 'split' && clip.anim === 'of-seq-split', JSON.stringify(clip))
      await page.screenshot({ path: path.join(OUT, 'apps-sequence-split.png'), clip: await page.locator('#seq-layout-panel').boundingBox() })
      await context.close()
    }
    /* published downloads: one labelled button per file, details collapsed, per-OS instructions, OS detection */
    {
      const { context, page } = await open('/en/apps', { width: 1440 })
      await page.locator('#desktop-builds').scrollIntoViewIfNeeded(); await page.waitForTimeout(400)
      const d = await page.evaluate(() => ({
        labels: [...document.querySelectorAll('.of-app-download')].map(a => a.textContent.trim()),
        hrefs: [...document.querySelectorAll('.of-app-download')].map(a => a.getAttribute('href')),
        openDetails: document.querySelectorAll('.of-app-details[open]').length,
        unsigned: [...document.querySelectorAll('.of-app-unsigned')].map(p => p.textContent),
        detected: [...document.querySelectorAll('.of-app-card.is-detected h3')].map(h => h.textContent),
      }))
      ok('five download buttons labelled with platform and architecture, pointing at the GitHub pre-release',
        d.labels.length === 5 && d.labels.includes('Download for macOS (Apple Silicon)') && d.labels.includes('Download for Windows (x64)') && d.labels.includes('Download for Linux (AppImage)')
        && d.hrefs.every(h => /^https:\/\/github\.com\/algomanlife\/openfund\/releases\/download\/open-trade-v[\w.-]+\/[\w.-]+$/.test(h)), JSON.stringify(d.labels))
      ok('hash and file details start collapsed; each OS has its own unsigned-build instruction', d.openDetails === 0 && /Gatekeeper/.test(d.unsigned[0]) && /SmartScreen/.test(d.unsigned[1]) && /chmod \+x/.test(d.unsigned[2]), JSON.stringify(d.unsigned))
      ok('the visitor\'s operating system is highlighted (headless Linux runner or macOS)', d.detected.length === 1, JSON.stringify(d.detected))
      await page.locator('.of-app-details summary').first().click()
      const sha = await page.locator('.of-app-details[open] .of-app-sha').first().textContent()
      ok('opening details shows the 64-character SHA-256 and a copy button', /^[a-f0-9]{64}$/.test(sha.trim()) && await page.locator('.of-app-details[open] .of-app-copy').count() === 1)
      await page.screenshot({ path: path.join(OUT, 'apps-downloads-en.png'), clip: await page.locator('#desktop-builds').boundingBox() })
      await context.close()
    }
    /* reduced motion */
    {
      const { context, page } = await open('/en/apps', { reducedMotion: 'reduce' })
      await page.locator('#seq-focus-panel').scrollIntoViewIfNeeded()
      const a = await page.evaluate(() => document.querySelector('[aria-controls=seq-focus-panel][aria-selected=true]').id)
      await page.waitForTimeout(4500)
      const r = await page.evaluate(() => ({ same: document.querySelector('[aria-controls=seq-focus-panel][aria-selected=true]').id, anim: getComputedStyle(document.querySelector('.of-apps-hero-float')).animationName, pan: getComputedStyle(document.querySelector('.of-apps-webshot img')).animationName }))
      await page.click('#seq-focus-tab-1')
      ok('reduced motion: no auto-advance or ambient motion, steps still switch frames', r.same === a && r.anim === 'none' && r.pan === 'none' && await page.evaluate(() => document.querySelector('#seq-focus-tab-1').getAttribute('aria-selected') === 'true'), JSON.stringify(r))
      await context.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${results.length} applications page checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
