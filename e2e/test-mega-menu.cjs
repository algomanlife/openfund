/* Header mega menu: desktop panel opens on hover after a short intent delay
 * (fine pointers), on click and from the keyboard; a page scrim sits behind
 * it; icon tiles with descriptions, Resources sub-groups and a featured
 * banner per group; the panel stays inside the viewport (LTR and RTL);
 * Escape returns focus to the trigger; Escape (focus anywhere), an outside
 * click and a route change (tile link or Back) close an open panel. Narrow layouts use the drawer: an
 * accordion per group, two-column icon tiles of at least 44 px, a compact
 * banner. The terminal menu uses the same tiles.
 * Trading challenges (items C, L, M): a group with eight tiles (compare, buy, objectives, labs,
 * migration, the tournament with a New badge and countdown, airdrop, rules) and the
 * flamingo migration banner, animated only while the panel is open and static
 * under reduced motion; the drawer shows a compact card with fewer birds.
 * Economy (owner fix 1): the council and whitepaper banners sit side by side
 * in a 520–560 px column as two equal-height cards with aligned titles and
 * CTAs, level with the tile list (no empty gap); single-banner groups keep
 * the 260 px column; in the drawer they are two compact horizontal cards,
 * stacked when the drawer row is narrower than 420 px. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/mega-menu'))
fs.mkdirSync(OUT, { recursive: true })
const results = []
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); results.push(name); console.log('PASS - ' + name) }

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  try {
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/en/rulebook`, { waitUntil: 'load' })
      const trigger = page.locator('.openfund-header .resources-toggle[aria-controls="website-resources"]')
      await trigger.waitFor(); await page.waitForTimeout(1200)
      const box = await trigger.boundingBox()
      await page.mouse.move(box.x + 4, box.y + 4); await page.waitForTimeout(50)
      const early = await page.evaluate(() => !!document.querySelector('.nav-account.resources-open'))
      await page.waitForTimeout(300)
      const m = await page.evaluate(() => {
        const panel = document.querySelector('.resources-open .nav-mega'), r = panel?.getBoundingClientRect()
        return { open: !!panel, expanded: document.querySelector('.resources-toggle[aria-controls="website-resources"]').getAttribute('aria-expanded'), scrim: document.documentElement.classList.contains('mega-open'),
          sections: [...document.querySelectorAll('.resources-open .mega-section h3')].map(h => h.textContent), tiles: [...document.querySelectorAll('.resources-open .mega-tile')].map(a => [a.getAttribute('href'), !!a.querySelector('svg'), !!a.querySelector('small')]),
          /* the desktop banner is a container; its main link carries the href (owner fix 3) */
          banner: (document.querySelector('.resources-open a.mega-banner-main') || document.querySelector('.resources-open a.mega-banner'))?.getAttribute('href'), inView: r && r.left >= 0 && r.right <= innerWidth, belowHeader: r && r.top >= document.querySelector('.openfund-header').getBoundingClientRect().bottom - 1 }
      })
      ok('hover opens only after the intent delay', !early && m.open && m.expanded === 'true', JSON.stringify({ early, open: m.open }))
      ok('panel: sub-groups Learn / Product / Company / Security, tiles with icon and description, banner to the desktop downloads', m.sections.join() === 'Learn,Product,Company,Security' && m.tiles.length >= 10 && m.tiles.every(t => t[1] && t[2]) && m.tiles.some(t => t[0] === '/en/developers') && m.banner === '/en/apps#desktop-builds', JSON.stringify(m))
      ok('panel sits below the header, inside the viewport, with a page scrim behind it', m.inView && m.belowHeader && m.scrim, JSON.stringify(m))
      await page.screenshot({ path: path.join(OUT, 'mega-resources-en-1440.png') })
      await page.mouse.move(700, 880); await page.waitForTimeout(450)
      ok('leaving closes the panel and removes the scrim', await page.evaluate(() => !document.querySelector('.nav-account.resources-open') && !document.documentElement.classList.contains('mega-open')))
      const economy = page.locator('.openfund-header .resources-toggle[aria-controls="website-economy"]')
      await economy.focus(); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(150)
      const k = await page.evaluate(() => ({ focus: document.activeElement.getAttribute('href'), banner: document.querySelector('#website-economy .mega-banner')?.getAttribute('href'), art: !!document.querySelector('#website-economy .mega-banner-art.is-council') }))
      ok('keyboard: ArrowDown opens Economy and focuses its first tile; the council banner links to governance', k.focus === '/en/governance' && k.banner === '/en/governance' && k.art, JSON.stringify(k))
      await page.screenshot({ path: path.join(OUT, 'mega-economy-en-1440.png') })
      await page.keyboard.press('Escape'); await page.waitForTimeout(100)
      ok('Escape closes and returns focus to the trigger', await page.evaluate(() => document.activeElement.getAttribute('aria-controls') === 'website-economy' && document.activeElement.getAttribute('aria-expanded') === 'false'))
      await economy.click(); await page.waitForTimeout(300)
      ok('click opens the panel', await page.evaluate(() => !!document.querySelector('#website-economy').closest('.resources-open')))
      const isOpen = () => page.evaluate(() => !!document.querySelector('.nav-account.resources-open') || document.documentElement.classList.contains('mega-open'))
      /* Escape closes wherever focus is (here: focus moved out of the menu) */
      await page.evaluate(() => { document.activeElement?.blur(); document.body.focus() })
      await page.keyboard.press('Escape'); await page.waitForTimeout(100)
      ok('Escape closes the panel even when focus is outside the menu', !(await isOpen()))
      /* outside click */
      await economy.click(); await page.waitForTimeout(300)
      await page.mouse.click(700, 760); await page.waitForTimeout(150)
      ok('a click outside closes the panel and the scrim', !(await isOpen()))
      /* route change: a tile link, then Back while a panel is open */
      await economy.click(); await page.waitForTimeout(300)
      await page.locator('#website-economy a.mega-tile[href="/en/transparency"]').click()
      await page.waitForURL(/\/en\/transparency$/); await page.waitForTimeout(400)
      ok('following a tile link closes the panel', !(await isOpen()))
      await page.locator('.openfund-header .resources-toggle[aria-controls="website-economy"]').click(); await page.waitForTimeout(300)
      await page.mouse.move(700, 760); await page.waitForTimeout(450) /* pointer off the header: hover cannot reopen it */
      ok('the panel is open before Back (the clicked trigger keeps focus)', await isOpen())
      await page.goBack(); await page.waitForURL(/\/en\/rulebook$/); await page.waitForTimeout(400)
      ok('a route change (Back) closes the panel', !(await isOpen()))
      await page.close()
    }
    for (const [loc, motion] of [['en', 'no-preference'], ['ar', 'reduce']]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: motion }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/${loc}/rulebook`, { waitUntil: 'load' })
      const trigger = page.locator('.openfund-header .resources-toggle[aria-controls="website-challenges"]')
      await trigger.waitFor(); await page.waitForTimeout(1200)
      const state = () => page.evaluate(() => {
        const wing = document.querySelector('#website-challenges .fl-wing')
        const s = wing && getComputedStyle(wing)
        return { play: s?.animationPlayState, name: s?.animationName }
      })
      const closed = await state()
      await trigger.click(); await page.waitForTimeout(400)
      const c = await page.evaluate(() => {
        const tiles = [...document.querySelectorAll('#website-challenges .mega-tile')]
        const t = tiles.find(a => a.getAttribute('href').endsWith('/tournament'))
        const banner = document.querySelector('#website-challenges .mega-banner.is-flamingo')
        const r = document.querySelector('#website-challenges').getBoundingClientRect()
        return { tiles: tiles.map(a => a.getAttribute('href').split('/').slice(2).join('/')), icons: tiles.every(a => a.querySelector('svg')), badge: t?.querySelector('.mega-badge')?.textContent, countdown: t?.querySelector('.mega-countdown')?.textContent,
          banner: banner?.getAttribute('href'), birds: banner?.querySelectorAll('.fl-bird').length, mark: !!banner?.querySelector('image.fl-mark'), reflection: !!banner?.querySelector('.fl-reflection image'),
          described: (banner?.querySelector('.mega-sr')?.textContent || '').length > 40, inView: r.left >= 0 && r.right <= innerWidth, active: document.querySelector('.resources-toggle[aria-controls="website-challenges"]').getAttribute('aria-expanded') }
      })
      const open = await state()
      ok(`${loc}: Trading challenges opens a group of eight tiles (compare, buy, objectives, labs, migration, tournament, airdrop, rules)`, c.active === 'true' && c.tiles.join() === 'challenges,checkout,trading-objectives,labs,migrate,tournament,airdrop,rulebook' && c.icons && c.inView, JSON.stringify(c))
      ok(`${loc}: the tournament tile has a New badge and a compact countdown`, !!c.badge && (Date.now() >= Date.parse('2027-01-04T00:00:00Z') || !!c.countdown), JSON.stringify(c))
      ok(`${loc}: the flamingo banner links to migration with 7 birds, no mark or reflection (owner update), and a hidden description`, c.banner === `/${loc}/migrate` && c.birds === 7 && !c.mark && !c.reflection && c.described, JSON.stringify(c))
      if (motion === 'reduce') ok(`${loc}: reduced motion shows a static frame`, open.name === 'none', JSON.stringify(open))
      else ok(`${loc}: the scene is paused while closed and animates only while the panel is open`, closed.play === 'paused' && open.play === 'running' && open.name === 'fl-flap', JSON.stringify({ closed, open }))
      await page.screenshot({ path: path.join(OUT, `mega-challenges-${loc}-1440.png`) })
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/fa/rulebook`, { waitUntil: 'load' }); await page.waitForTimeout(1200)
      await page.locator('.openfund-header .resources-toggle[aria-controls="website-resources"]').click(); await page.waitForTimeout(350)
      ok('RTL light: the panel stays inside the viewport', await page.evaluate(() => { const r = document.querySelector('.resources-open .nav-mega').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth }))
      await page.screenshot({ path: path.join(OUT, 'mega-resources-fa-1440-light.png') })
      await page.close()
    }
    for (const [w, h, loc] of [[390, 844, 'fa'], [768, 1024, 'en']]) {
      const touch = w < 768
      const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/${loc}/rulebook`, { waitUntil: 'load' }); await page.waitForTimeout(1200)
      await page.locator('.openfund-header .menu').click(); await page.waitForTimeout(400)
      const acc = page.locator('.of-drawer-accordion[aria-controls="website-resources-drawer"]')
      const before = await acc.getAttribute('aria-expanded'); await acc.click(); await page.waitForTimeout(250)
      const d = await page.evaluate(() => {
        const tiles = [...document.querySelectorAll('#website-resources-drawer .mega-tile')]
        return { expanded: document.querySelector('.of-drawer-accordion[aria-controls="website-resources-drawer"]').getAttribute('aria-expanded'), tiles: tiles.length, minH: Math.min(...tiles.map(t => t.getBoundingClientRect().height)),
          cols: new Set(tiles.map(t => Math.round(t.getBoundingClientRect().left))).size, banner: !!document.querySelector('#website-resources-drawer .mega-banner.is-compact') }
      })
      const ch = page.locator('.of-drawer-accordion[aria-controls="website-challenges-drawer"]')
      /* on /rulebook the group holding the current page starts expanded */
      if (await ch.getAttribute('aria-expanded') === 'false') { await ch.click(); await page.waitForTimeout(250) }
      const f = await page.evaluate(() => { const b = document.querySelector('#website-challenges-drawer .mega-banner.is-compact.is-flamingo'); return { birds: b?.querySelectorAll('.fl-bird').length, h: b?.getBoundingClientRect().height, tiles: document.querySelectorAll('#website-challenges-drawer .mega-tile').length } })
      ok(`${loc} ${w}: drawer Challenges group has eight tiles and a compact flamingo card with fewer birds`, f.tiles === 8 && f.birds === 3 && f.h >= 44, JSON.stringify(f))
      ok(`${loc} ${w}: drawer accordion expands; two-column tiles at least 44 px; compact banner`, before === 'false' && d.expanded === 'true' && d.tiles >= 10 && d.minH >= 44 && d.cols === 2 && d.banner, JSON.stringify(d))
      await page.screenshot({ path: path.join(OUT, `drawer-${loc}-${w}.png`) })
      await page.close()
    }
    /* Economy: two banners side by side (owner fix 1) */
    for (const [w, h] of [[1280, 800], [1440, 900], [1920, 1080]]) {
      for (const loc of ['fa', 'en']) {
        for (const theme of ['dark', 'light']) {
          const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: theme, reducedMotion: 'reduce' }); page.on('pageerror', e => errors.push(String(e)))
          await page.goto(`${BASE}/${loc}/rulebook`, { waitUntil: 'load' }); await page.waitForTimeout(1200)
          const economyToggle = page.locator('.openfund-header .resources-toggle[aria-controls="website-economy"]')
          /* fitNavigation moves the labels into the menu when they do not fit
             (English at 1280 after the Openfund link). The side-by-side panel
             is checked wherever that desktop row is actually shown. */
          if (!(await economyToggle.isVisible())) {
            ok(`${loc} ${theme} ${w}: the header uses the menu when the labels do not fit`, await page.locator('.openfund-header.nav-overflow .menu').isVisible())
            await page.close()
            continue
          }
          await economyToggle.click(); await page.waitForTimeout(400)
          const e = await page.evaluate(() => {
            const box = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom } }
            const banners = [...document.querySelectorAll('#website-economy .mega-banner')].map(box)
            const titles = [...document.querySelectorAll('#website-economy .mega-banner-copy b')].map(box)
            const ctas = [...document.querySelectorAll('#website-economy .mega-banner-copy em')].map(box)
            const column = box(document.querySelector('#website-economy .mega-banners'))
            const sections = box(document.querySelector('#website-economy .mega-sections'))
            const panel = document.querySelector('#website-economy').getBoundingClientRect()
            return { banners, titles, ctas, column, sections, pair: document.querySelector('#website-economy .mega-body').classList.contains('has-banner-pair'),
              inView: panel.left >= 0 && panel.right <= innerWidth, overflow: document.documentElement.scrollWidth - innerWidth }
          })
          const [a, b] = e.banners
          ok(`${loc} ${theme} ${w}: Economy banners sit side by side in a 520–560 px column`, e.pair && e.banners.length === 2 && Math.abs(a.y - b.y) <= 1 && Math.abs(a.x - b.x) >= a.w && e.column.w >= 520 && e.column.w <= 561, JSON.stringify(e))
          ok(`${loc} ${theme} ${w}: equal heights and widths; titles and CTAs aligned`, Math.abs(a.h - b.h) <= 1 && Math.abs(a.w - b.w) <= 1 && Math.abs(e.titles[0].y - e.titles[1].y) <= 1 && Math.abs(e.ctas[0].y - e.ctas[1].y) <= 1, JSON.stringify(e))
          ok(`${loc} ${theme} ${w}: the banners are level with the tile list (no empty gap) and the panel fits`, Math.abs(a.b - e.sections.b) <= 24 && e.inView && e.overflow <= 0, JSON.stringify(e))
          if (theme === 'dark' && w === 1440) await page.screenshot({ path: path.join(OUT, `mega-economy-pair-${loc}-1440.png`) })
          await page.close()
        }
      }
    }
    {
      /* single-banner groups keep their 260 px banner column */
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/en/rulebook`, { waitUntil: 'load' }); await page.waitForTimeout(1200)
      await page.locator('.openfund-header .resources-toggle[aria-controls="website-resources"]').click(); await page.waitForTimeout(400)
      const r = await page.evaluate(() => ({ pair: document.querySelector('#website-resources .mega-body').classList.contains('has-banner-pair'), w: document.querySelector('#website-resources .mega-banner').getBoundingClientRect().width }))
      ok('single-banner groups keep the 260 px banner column', !r.pair && Math.abs(r.w - 260) <= 1, JSON.stringify(r))
      await page.close()
    }
    for (const [w, h, loc] of [[768, 1024, 'en'], [430, 932, 'fa'], [390, 844, 'fa'], [360, 740, 'en']]) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: w < 768, hasTouch: w < 768 }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/${loc}/rulebook`, { waitUntil: 'load' }); await page.waitForTimeout(1200)
      await page.locator('.openfund-header .menu').click(); await page.waitForTimeout(400)
      const acc = page.locator('.of-drawer-accordion[aria-controls="website-economy-drawer"]')
      if (await acc.getAttribute('aria-expanded') === 'false') { await acc.click(); await page.waitForTimeout(250) }
      const d = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('#website-economy-drawer .mega-banner.is-compact')].map(el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return { x: r.left, y: r.top, w: r.width, h: r.height, flex: cs.display, dir: cs.flexDirection } })
        return { cards, row: document.querySelector('#website-economy-drawer .mega-banner-row').getBoundingClientRect().width, overflow: document.documentElement.scrollWidth - innerWidth }
      })
      const [a, b] = d.cards
      const horizontal = d.cards.every(c => c.flex === 'flex' && c.dir === 'row' && c.h >= 44)
      /* stacked when the drawer row has less than 420 px */
      const stacked = d.row < 420
      ok(`${loc} ${w}: drawer Economy shows two compact horizontal cards, ${stacked ? 'stacked' : 'side by side'}`, d.cards.length === 2 && horizontal && d.overflow <= 0
        && (stacked ? b.y > a.y + a.h - 1 : Math.abs(a.y - b.y) <= 1 && Math.abs(a.h - b.h) <= 1), JSON.stringify(d))
      if ([390, 768].includes(w)) {
        await page.locator('#website-economy-drawer .mega-banner').last().scrollIntoViewIfNeeded(); await page.waitForTimeout(200)
        await page.screenshot({ path: path.join(OUT, `drawer-economy-${loc}-${w}.png`) })
      }
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/en/prop/trade`, { waitUntil: 'load' }); await page.waitForTimeout(2500)
      await page.locator('.of-terminal-menu-trigger').click(); await page.waitForTimeout(400)
      ok('terminal menu uses the same icon tiles', await page.evaluate(() => { const t = [...document.querySelectorAll('.of-terminal-drawer .mega-tile')]; return t.length >= 8 && t.every(a => a.querySelector('svg')) }))
      ok('terminal menu shows the Trading challenges tiles and the compact flamingo card', await page.evaluate(() => document.querySelectorAll('.of-terminal-challenges .mega-tile').length === 8 && document.querySelectorAll('.of-terminal-challenges .fl-bird').length === 3))
      await page.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${results.length} mega menu checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
