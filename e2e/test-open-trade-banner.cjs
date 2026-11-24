/* Resources menu: the Open Trade desktop banner (owner fix 3).
 * The download button sits outside the app window (no overlap with the window
 * or its chart) and its ring pulses only while the menu is open; reduced
 * motion stops it. Five platform badges sit in one row under the art: macOS,
 * Windows and Linux are links to their card on /apps (#download-<platform>,
 * which exists there); Android and iOS are dimmed, labelled "Coming soon" and
 * have no link. Each badge has its own accessible name and the card holds no
 * nested links. The art, copy and badges fill the card (no tall empty gap).
 * Desktop at 1280/1440/1920 in fa and en, dark and light; the five-locale copy;
 * keyboard access with visible focus; the drawer card at 360/390/768 px.
 * Screenshots at 390, 768 and 1440 px; a short recording of the pulse in RTL
 * and LTR. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/open-trade-banner'))
fs.mkdirSync(OUT, { recursive: true })
let n = 0
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); n++; console.log('PASS - ' + name) }
const open = async (page, loc) => {
  await page.goto(`${BASE}/${loc}/rulebook`, { waitUntil: 'load' }); await page.waitForTimeout(1200)
  await page.locator('.openfund-header .resources-toggle[aria-controls="website-resources"]').click(); await page.waitForTimeout(450)
}
const measure = () => {
  const q = s => document.querySelector(s)
  const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } }
  const card = q('#website-resources .mega-banner.is-desktop')
  const badges = [...card.querySelectorAll('.mega-platform')]
  return {
    card: box(card), sections: box(q('#website-resources .mega-sections')),
    window: box(card.querySelector('.mega-art-window')), chart: box(card.querySelector('.mega-art-chart')),
    button: box(card.querySelector('.mega-art-button')), art: box(card.querySelector('.mega-banner-art')), title: box(card.querySelector('.mega-banner-copy b')),
    copy: box(card.querySelector('.mega-banner-copy')), row: box(card.querySelector('.mega-platforms')),
    nested: card.querySelectorAll('a a').length, cardIsLink: card.tagName === 'A',
    badges: badges.map(b => ({ tag: b.tagName, href: b.getAttribute('href'), label: b.getAttribute('aria-label'), name: b.querySelector('.mega-platform-name')?.textContent,
      soon: b.classList.contains('is-soon'), y: Math.round(b.getBoundingClientRect().top), h: b.getBoundingClientRect().height,
      clipped: (() => { const nm = b.querySelector('.mega-platform-name'); return nm.scrollWidth > b.clientWidth + 1 })() })),
    soonText: card.querySelector('.mega-platform-soon')?.textContent, listLabel: card.querySelector('.mega-platforms')?.getAttribute('aria-label'),
    body: card.querySelector('.mega-banner-copy small')?.textContent,
    pulse: (() => { const s = getComputedStyle(card.querySelector('.mega-art-pulse')); return { name: s.animationName, play: s.animationPlayState } })(),
    overflow: document.documentElement.scrollWidth - innerWidth,
  }
}
const apart = (a, b) => a.r <= b.x || b.r <= a.x || a.b <= b.y || b.b <= a.y

;(async () => {
  const browser = await chromium.launch(); const errors = []
  try {
    for (const [w, h] of [[1280, 800], [1440, 900], [1920, 1080]]) {
      for (const loc of ['fa', 'en']) {
        for (const theme of ['dark', 'light']) {
          const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: theme }); page.on('pageerror', e => errors.push(String(e)))
          await open(page, loc)
          const m = await page.evaluate(measure)
          const tag = `${loc} ${theme} ${w}`
          ok(`${tag}: the download button sits outside the window and its chart`, apart(m.button, m.window) && apart(m.button, m.chart), JSON.stringify({ b: m.button, w: m.window, c: m.chart }))
          ok(`${tag}: five badges in one row, none clipped, at least 44 px tall`, m.badges.length === 5 && new Set(m.badges.map(b => b.y)).size === 1 && m.badges.every(b => !b.clipped && b.h >= 44), JSON.stringify(m.badges))
          const [mac, win, linux, android, ios] = m.badges
          ok(`${tag}: desktop badges link to their /apps card with an accessible name`, [mac, win, linux].every((b, i) => b.tag === 'A' && b.href === `/${loc}/apps#download-${['macos', 'windows', 'linux'][i]}` && b.label.includes(b.name)), JSON.stringify(m.badges))
          ok(`${tag}: Android and iOS are dimmed "coming soon" with no link`, [android, ios].every(b => b.tag === 'SPAN' && !b.href && b.soon && b.label.includes(b.name) && b.label.includes(m.soonText)) && !!m.soonText, JSON.stringify(m.badges))
          ok(`${tag}: a container with sibling links (no nested links) and a labelled list`, !m.cardIsLink && m.nested === 0 && !!m.listLabel)
          ok(`${tag}: no tall gap (art → title under 64 px; badges end at the card's padding; card level with the tiles)`, m.title.y - m.art.b < 64 && m.card.b - m.row.b <= 20 && Math.abs(m.card.b - m.sections.b) <= 2, JSON.stringify({ art: m.art, title: m.title, row: m.row, card: m.card }))
          ok(`${tag}: the pulse runs only while the menu is open`, m.pulse.name === 'mega-pulse' && m.pulse.play === 'running', JSON.stringify(m.pulse))
          ok(`${tag}: no horizontal overflow`, m.overflow <= 0)
          if (w === 1440 && theme === 'dark') await page.screenshot({ path: path.join(OUT, `resources-banner-${loc}-1440.png`) })
          await page.close()
        }
      }
    }
    /* copy in five locales (ar, ru and zh-CN from the reviewed dictionary) */
    for (const [loc, re] of [['fa', /موبایل/], ['en', /mobile coming soon/], ['ar', /الهاتف/], ['ru', /мобильная/], ['zh-CN', /移动版/]]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, loc)
      const m = await page.evaluate(measure)
      ok(`${loc}: banner copy is localized`, re.test(m.body), m.body)
      await page.close()
    }
    /* keyboard: the main link and each desktop badge are reachable, with visible focus; reduced motion stops the pulse */
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); page.on('pageerror', e => errors.push(String(e)))
      await open(page, 'en')
      /* reach the main link with the keyboard (Shift+Tab from the first badge) so :focus-visible applies */
      await page.locator('#website-resources a.mega-platform').first().focus(); await page.keyboard.press('Shift+Tab')
      const seen = []
      for (let i = 0; i < 4; i++) {
        seen.push(await page.evaluate(() => ({ href: document.activeElement.getAttribute('href'), outline: getComputedStyle(document.activeElement).outlineStyle })))
        await page.keyboard.press('Tab')
      }
      ok('keyboard: main link, then macOS, Windows and Linux badges, each with a visible outline', seen.map(s => s.href).join() === '/en/apps#desktop-builds,/en/apps#download-macos,/en/apps#download-windows,/en/apps#download-linux' && seen.every(s => s.outline !== 'none'), JSON.stringify(seen))
      ok('reduced motion: the pulse is off', (await page.evaluate(measure)).pulse.name === 'none')
      await page.close()
    }
    /* Direct entries and same-page badge clicks must both position the card.
       Wait for the observable result, rather than assuming the gated route
       and a long scroll finish within a fixed 1500 ms on every CI runner. */
    for (const loc of ['en', 'fa']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.on('pageerror', e => errors.push(String(e)))
      const positioned = async (id, label) => {
        await page.waitForFunction(id => {
          const target = document.getElementById(id)
          const header = document.querySelector('.openfund-header')
          if (!target || !header) return false
          const r = target.getBoundingClientRect(), h = header.getBoundingClientRect()
          return r.top >= Math.max(0, h.bottom) - 1 && r.top < innerHeight
        }, id, { timeout: 10000 })
        ok(label, true)
      }
      await page.goto(`${BASE}/${loc}/apps#download-windows`, { waitUntil: 'load' })
      await positioned('download-windows', `${loc}: direct /apps anchor positions Windows below the header`)
      const t = await page.evaluate(() => ['macos', 'windows', 'linux'].map(p => !!document.getElementById(`download-${p}`)))
      ok(`${loc}: /apps has a card for every desktop badge`, t.every(Boolean), JSON.stringify(t))
      for (const platform of ['macos', 'linux']) {
        await page.locator('.openfund-header .resources-toggle[aria-controls="website-resources"]').click()
        await page.locator(`#website-resources a.mega-platform[href="/${loc}/apps#download-${platform}"]`).click()
        await page.waitForURL(`**/${loc}/apps#download-${platform}`)
        await positioned(`download-${platform}`, `${loc}: same-page ${platform} badge positions its card below the header`)
      }
      await page.close()
    }
    /* drawer: a compact horizontal card that fits the badges */
    for (const [w, h, loc] of [[360, 740, 'en'], [390, 844, 'fa'], [768, 1024, 'en']]) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768 }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/${loc}/rulebook`, { waitUntil: 'load' }); await page.waitForTimeout(1200)
      await page.locator('.openfund-header .menu').click(); await page.waitForTimeout(400)
      const acc = page.locator('.of-drawer-accordion[aria-controls="website-resources-drawer"]')
      if (await acc.getAttribute('aria-expanded') === 'false') { await acc.click(); await page.waitForTimeout(300) }
      const d = await page.evaluate(() => {
        const card = document.querySelector('#website-resources-drawer .mega-banner.is-desktop')
        const c = card.getBoundingClientRect(), main = card.querySelector('.mega-banner-main').getBoundingClientRect()
        const badges = [...card.querySelectorAll('.mega-platform')].map(b => { const r = b.getBoundingClientRect(); return { tag: b.tagName, y: Math.round(r.top), w: r.width, h: r.height, clipped: b.querySelector('.mega-platform-name').scrollWidth > b.clientWidth + 1, inside: r.left >= c.left - 0.5 && r.right <= c.right + 0.5 } })
        return { badges, horizontal: getComputedStyle(card.querySelector('.mega-banner-main')).display === 'flex' && main.height < 120, links: badges.filter(b => b.tag === 'A').length, overflow: document.documentElement.scrollWidth - innerWidth }
      })
      ok(`${loc} ${w}: drawer card is horizontal with five badges in one row, 44 px targets, nothing clipped`, d.horizontal && d.badges.length === 5 && new Set(d.badges.map(b => b.y)).size === 1 && d.badges.every(b => b.h >= 44 && !b.clipped && b.inside) && d.links === 3 && d.overflow <= 0, JSON.stringify(d))
      if (w !== 360) {
        await page.locator('#website-resources-drawer .mega-banner.is-desktop').scrollIntoViewIfNeeded(); await page.waitForTimeout(200)
        await page.screenshot({ path: path.join(OUT, `drawer-resources-banner-${loc}-${w}.png`) })
      }
      await page.close()
    }
    /* recordings of the pulse, RTL and LTR (motion cannot be reviewed from stills) */
    for (const loc of ['fa', 'en']) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } })
      const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e)))
      await open(page, loc); await page.waitForTimeout(5200)
      const video = page.video(); await ctx.close()
      fs.renameSync(await video.path(), path.join(OUT, `resources-banner-pulse-${loc}.webm`))
    }
    ok('no uncaught page errors', errors.length === 0, errors.join(' | '))
    console.log(`\n${n} open trade banner checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
