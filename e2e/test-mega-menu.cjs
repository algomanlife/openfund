/* Header mega menu: desktop panel opens on hover after a short intent delay
 * (fine pointers), on click and from the keyboard; a page scrim sits behind
 * it; icon tiles with descriptions, Resources sub-groups and a featured
 * banner per group; the panel stays inside the viewport (LTR and RTL);
 * Escape returns focus to the trigger. Narrow layouts use the drawer: an
 * accordion per group, two-column icon tiles of at least 44 px, a compact
 * banner. The terminal menu uses the same tiles.
 * Trading challenges (item C): a group with five tiles (compare, buy,
 * migration, the tournament with a New badge and countdown, rules) and the
 * flamingo migration banner, animated only while the panel is open and static
 * under reduced motion; the drawer shows a compact card with fewer birds. */
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
          banner: document.querySelector('.resources-open .mega-banner')?.getAttribute('href'), inView: r && r.left >= 0 && r.right <= innerWidth, belowHeader: r && r.top >= document.querySelector('.openfund-header').getBoundingClientRect().bottom - 1 }
      })
      ok('hover opens only after the intent delay', !early && m.open && m.expanded === 'true', JSON.stringify({ early, open: m.open }))
      ok('panel: sub-groups Learn / Product / Company, tiles with icon and description, banner to the desktop downloads', m.sections.join() === 'Learn,Product,Company' && m.tiles.length >= 10 && m.tiles.every(t => t[1] && t[2]) && m.tiles.some(t => t[0] === '/en/developers') && m.banner === '/en/apps#desktop-builds', JSON.stringify(m))
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
      ok(`${loc}: Trading challenges opens a group of five tiles (compare, buy, migration, tournament, rules)`, c.active === 'true' && c.tiles.join() === 'challenges,checkout,migrate,tournament,rulebook' && c.icons && c.inView, JSON.stringify(c))
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
      ok(`${loc} ${w}: drawer Challenges group has five tiles and a compact flamingo card with fewer birds`, f.tiles === 5 && f.birds === 3 && f.h >= 44, JSON.stringify(f))
      ok(`${loc} ${w}: drawer accordion expands; two-column tiles at least 44 px; compact banner`, before === 'false' && d.expanded === 'true' && d.tiles >= 10 && d.minH >= 44 && d.cols === 2 && d.banner, JSON.stringify(d))
      await page.screenshot({ path: path.join(OUT, `drawer-${loc}-${w}.png`) })
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/en/prop/trade`, { waitUntil: 'load' }); await page.waitForTimeout(2500)
      await page.locator('.of-terminal-menu-trigger').click(); await page.waitForTimeout(400)
      ok('terminal menu uses the same icon tiles', await page.evaluate(() => { const t = [...document.querySelectorAll('.of-terminal-drawer .mega-tile')]; return t.length >= 8 && t.every(a => a.querySelector('svg')) }))
      ok('terminal menu shows the Trading challenges tiles and the compact flamingo card', await page.evaluate(() => document.querySelectorAll('.of-terminal-challenges .mega-tile').length === 5 && document.querySelectorAll('.of-terminal-challenges .fl-bird').length === 3))
      await page.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${results.length} mega menu checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
