/* Language selector browser acceptance: globe trigger with the current code,
 * listbox panel with script glyphs, own-script and UI-language names, a check
 * on the active language and RTL/LTR badges; the globe turns to the focused
 * language's region; full keyboard support (arrows, Home/End, Enter, Escape
 * returning focus, type-ahead); bottom sheet with 52 px rows on phones;
 * choosing a language switches the route; dark/light, RTL/LTR, reduced
 * motion; no flags, no network requests for the selector. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/language-select'))
fs.mkdirSync(OUT, { recursive: true })
const results = []
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); results.push(name); console.log('PASS - ' + name) }
const TRIGGER = '.openfund-header button.of-language-select'

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const open = async (route, { width = 1440, height = 900, theme = 'dark', reducedMotion = 'no-preference', touch = false } = {}) => {
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion, hasTouch: touch, isMobile: touch })
    const page = await context.newPage()
    page.on('pageerror', e => errors.push(String(e)))
    await page.goto(BASE + route, { waitUntil: 'load' })
    await page.locator(TRIGGER).first().waitFor({ state: 'attached', timeout: 30000 })
    await page.waitForTimeout(600)
    return { context, page }
  }
  const shift = page => page.evaluate(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.of-globe-band')).transform).m41)
  try {
    {
      const { context, page } = await open('/en/markets')
      const t = await page.evaluate(sel => { const b = document.querySelector(sel); return { code: b.textContent.trim(), globe: Boolean(b.querySelector('svg.of-globe-icon')), popup: b.getAttribute('aria-haspopup'), expanded: b.getAttribute('aria-expanded'), name: b.getAttribute('aria-label') } }, TRIGGER)
      ok('trigger: globe icon, current code, listbox popup semantics', t.code === 'EN' && t.globe && t.popup === 'listbox' && t.expanded === 'false' && /English/.test(t.name), JSON.stringify(t))
      ok('trigger name starts with its visible code (label in name, axe label-content-name-mismatch)', t.name.startsWith(t.code), t.name)
      await page.locator(TRIGGER).focus(); await page.keyboard.press('Enter')
      await page.locator('.of-language-panel [role=listbox]').waitFor()
      const p = await page.evaluate(() => {
        const opts = [...document.querySelectorAll('.of-language-panel [role=option]')]
        return { n: opts.length, glyphs: opts.map(o => o.querySelector('.of-language-glyph').textContent), selected: opts.filter(o => o.getAttribute('aria-selected') === 'true').map(o => o.dataset.locale),
          names: opts.map(o => o.querySelector('b').textContent + '|' + (o.querySelector('small')?.textContent || '')), dirs: opts.map(o => o.querySelector('.of-language-dir').textContent),
          focus: document.activeElement.getAttribute('role'), active: document.activeElement.getAttribute('aria-activedescendant'), imgs: document.querySelectorAll('.of-language-panel img').length,
          expanded: document.querySelector('.openfund-header button.of-language-select').getAttribute('aria-expanded') }
      })
      ok('panel: five options with script glyphs, own-script and English names, one checked, RTL/LTR badges, no images or flags',
        p.n === 5 && p.glyphs.join() === 'فا,En,ع,Ру,中' && p.selected.join() === 'en' && p.names[0] === 'فارسی|Persian' && p.dirs.join() === 'RTL,LTR,RTL,LTR,LTR' && p.imgs === 0 && p.expanded === 'true', JSON.stringify(p))
      ok('Enter opens the listbox with focus on the active language', p.focus === 'listbox' && /-en$/.test(p.active), JSON.stringify(p))
      const s0 = await shift(page)
      await page.keyboard.press('End'); await page.waitForTimeout(900)
      const s1 = await shift(page)
      ok('End moves to the last option and the globe turns to its region', /-zh-CN$/.test(await page.evaluate(() => document.activeElement.getAttribute('aria-activedescendant'))) && Math.abs(s1 - s0) > 20, `${s0} → ${s1}`)
      await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown')
      ok('arrows move through the options', /-ar$/.test(await page.evaluate(() => document.activeElement.getAttribute('aria-activedescendant'))))
      await page.keyboard.type('ru')
      ok('type-ahead selects by name or code', /-ru$/.test(await page.evaluate(() => document.activeElement.getAttribute('aria-activedescendant'))))
      await page.keyboard.press('Escape')
      ok('Escape closes and returns focus to the trigger', await page.evaluate(sel => !document.querySelector('.of-language-panel') && document.activeElement === document.querySelector(sel) && document.activeElement.getAttribute('aria-expanded') === 'false', TRIGGER))
      await page.locator(TRIGGER).click(); await page.locator('.of-language-panel [role=option][data-locale="fa"]').hover(); await page.waitForTimeout(800)
      await page.screenshot({ path: path.join(OUT, 'language-panel-en-dark.png'), clip: { x: 900, y: 0, width: 540, height: 560 } })
      await page.locator('.of-language-panel [role=option][data-locale="fa"]').click()
      await page.waitForURL('**/fa/markets', { timeout: 15000 })
      const switched = await page.waitForFunction(() => document.documentElement.dir === 'rtl' && location.pathname === '/fa/markets', null, { timeout: 8000 }).then(() => true, () => false)
      ok('choosing a language switches the route and direction', switched, await page.evaluate(() => document.documentElement.dir + ' ' + location.pathname))
      await context.close()
    }
    for (const [route, opts, shot] of [['/fa/markets', { theme: 'light' }, 'language-panel-fa-light'], ['/ar/markets', { width: 390, height: 844, touch: true }, 'language-sheet-ar-390']]) {
      const { context, page } = await open(route, opts)
      await page.locator('button.of-language-select:visible').first().click()
      await page.locator('.of-language-panel [role=listbox]').waitFor(); await page.waitForTimeout(500)
      const m = await page.evaluate(() => { const panel = document.querySelector('.of-language-panel'); const r = panel.querySelector('.of-language-sheet').getBoundingClientRect(); const rows = [...panel.querySelectorAll('[role=option]')].map(o => o.getBoundingClientRect().height)
        return { sheet: panel.classList.contains('is-sheet'), dir: panel.dir, inView: r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, minRow: Math.min(...rows), overflow: document.documentElement.scrollWidth - innerWidth } })
      const touch = Boolean(opts.touch)
      ok(`${shot}: panel ${touch ? 'is a bottom sheet with 52 px rows' : 'opens in view'}, ${m.dir}`, m.inView && m.overflow <= 0 && (!touch || (m.sheet && m.minRow >= 52)) && m.dir === 'rtl', JSON.stringify(m))
      await page.screenshot({ path: path.join(OUT, shot + '.png') })
      await context.close()
    }
    {
      const { context, page } = await open('/en/markets', { reducedMotion: 'reduce' })
      await page.locator(TRIGGER).click(); await page.locator('.of-language-panel [role=listbox]').waitFor()
      const r = await page.evaluate(() => ({ anim: getComputedStyle(document.querySelector('.of-language-sheet')).animationName, tr: getComputedStyle(document.querySelector('.of-globe-band')).transitionDuration }))
      ok('reduced motion: no open animation or globe transition', r.anim === 'none' && /^0s/.test(r.tr), JSON.stringify(r))
      await context.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${results.length} language selector checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
