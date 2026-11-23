/* Site search (ADR 0052): the header trigger beside the theme toggle opens
 * the command palette, and so do Ctrl/⌘+K and "/" (not inside a text
 * field); combobox/listbox ARIA with keyboard navigation and focus return;
 * Arabic letters find Persian text; grouped, highlighted results; full
 * screen on phones; the /:locale/search results page with filter tabs is
 * noindex; five locales, both themes, no horizontal overflow from 360 to
 * 1920 px, 44 px targets; motion is transform/opacity only and off under
 * reduced motion. Screenshots at 390, 768 and 1440 px. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/site-search'))
fs.mkdirSync(OUT, { recursive: true })
let n = 0
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); n++; console.log('PASS - ' + name) }
const ready = async (page, route) => {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-site-search]', { timeout: 20000 })
  await page.waitForTimeout(600)
}
const dialog = page => page.locator('.of-search-dialog')

;(async () => {
  const browser = await chromium.launch(); const errors = []
  const track = page => page.on('pageerror', e => errors.push(String(e)))
  try {
    /* trigger, ARIA, Arabic → Persian, keyboard, focus return (desktop, fa) */
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); track(page)
      await ready(page, '/fa/rulebook')
      const trigger = page.locator('.openfund-header [data-site-search]').first()
      const box = await trigger.boundingBox()
      /* owner fix 5: the trigger matches the theme toggle's height (44 px touch target via ::after on coarse pointers) */
      const themeBox = await page.locator('.openfund-header .of-daynight').first().boundingBox()
      ok('fa: header trigger sits beside the theme toggle, same height, labelled', box && themeBox && Math.abs(box.height - themeBox.height) <= 1 && await trigger.getAttribute('aria-label') === 'جستجو'
        && await page.evaluate(() => document.querySelector('.openfund-header [data-site-search]')?.nextElementSibling?.id === 'theme-toggle'))
      await trigger.click()
      await dialog(page).waitFor()
      const input = page.locator('.of-search-dialog input[role=combobox]')
      ok('fa: dialog is modal, rtl, input focused', await dialog(page).getAttribute('aria-modal') === 'true' && await dialog(page).getAttribute('dir') === 'rtl'
        && await page.evaluate(() => document.activeElement?.getAttribute('role') === 'combobox'))
      await input.fill('قوانين') /* Arabic yeh */
      await page.waitForSelector('.of-search-option mark')
      const r = await page.evaluate(() => ({ expanded: document.querySelector('[role=combobox]').getAttribute('aria-expanded'),
        listbox: !!document.querySelector('[role=listbox]'), groups: document.querySelectorAll('[role=listbox] [role=group]').length,
        first: document.querySelector('[role=option]')?.textContent, active: document.querySelector('[role=combobox]').getAttribute('aria-activedescendant'),
        selected: document.querySelector('[role=option][aria-selected=true]')?.id }))
      ok('fa: Arabic letters find Persian text; grouped listbox; active descendant', r.expanded === 'true' && r.listbox && r.groups >= 1 && /قوانین/.test(r.first) && r.active === r.selected, JSON.stringify(r))
      await page.keyboard.press('ArrowDown')
      ok('ArrowDown moves the active option', await page.evaluate(() => document.querySelector('[role=combobox]').getAttribute('aria-activedescendant')) !== r.active)
      await page.screenshot({ path: path.join(OUT, 'site-search-palette-fa-1440.png') })
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
      ok('Escape closes and returns focus to the trigger', await dialog(page).count() === 0 && await page.evaluate(() => document.activeElement?.hasAttribute('data-site-search')))
      await page.keyboard.press('Control+k')
      await dialog(page).waitFor()
      ok('Ctrl+K opens the palette', await dialog(page).count() === 1)
      await page.locator('.of-search-dialog input').fill('markets')
      await page.waitForSelector('[role=option]')
      await page.keyboard.press('Enter')
      await page.waitForURL(/\/fa\/markets/)
      ok('Enter opens the active result (an English route name finds the Persian page)', /\/fa\/markets$/.test(new URL(page.url()).pathname) && await dialog(page).count() === 0)
      await page.close()
    }
    /* "/" shortcut, not inside a text field; phone full screen; five locales and both themes */
    for (const [locale, dir] of [['en', 'ltr'], ['fa', 'rtl'], ['ar', 'rtl'], ['ru', 'ltr'], ['zh-CN', 'ltr']]) {
      for (const theme of ['dark', 'light']) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: theme, isMobile: true, hasTouch: true }); track(page)
        await page.addInitScript(t => { try { localStorage.setItem('openfund-theme', t); localStorage.setItem('of-theme', t) } catch {} }, theme)
        await ready(page, `/${locale}/faq`)
        await page.keyboard.press('/')
        await dialog(page).waitFor()
        await page.locator('.of-search-dialog input').fill('btc')
        await page.waitForSelector('[role=option]', { timeout: 15000 })
        const m = await page.evaluate(() => { const d = document.querySelector('.of-search-dialog'); return { w: d.offsetWidth, h: d.offsetHeight, dir: document.querySelector('.of-search-dialog').dir, overflow: document.documentElement.scrollWidth - innerWidth } })
        ok(`${locale} ${theme} 390: "/" opens a full-screen ${dir} palette`, m.w === 390 && m.h >= 800 && m.dir === dir && m.overflow <= 0, JSON.stringify(m))
        if (locale === 'en' || locale === 'fa') await page.screenshot({ path: path.join(OUT, `site-search-palette-${locale}-${theme}-390.png`) })
        await page.close()
      }
    }
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); track(page)
      await ready(page, '/en/contact')
      const field = page.locator('main input, main textarea').first()
      if (await field.count()) {
        await field.focus(); await page.keyboard.press('/')
        ok('"/" inside a text field types a slash and does not open search', await dialog(page).count() === 0)
      }
      await page.close()
    }
    /* results page: tabs, noindex, widths, 44 px targets */
    for (const w of [360, 390, 768, 1024, 1280, 1440, 1920]) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 } }); track(page)
      await page.goto(`${BASE}/en/search?q=rules`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.of-search-result', { timeout: 20000 })
      const r = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, robots: document.querySelector('meta[name=robots]')?.content,
        tabs: document.querySelectorAll('[role=tablist] [role=tab]').length, selected: document.querySelector('[role=tab][aria-selected=true]')?.textContent,
        /* the header trigger is sized with its neighbours; test-header-controls.cjs checks its touch target */
        small: [...document.querySelectorAll('.of-search-tab, .of-search-result, .of-search-submit')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).length }))
      ok(`results ${w} px: noindex, tabs, no overflow, 44 px targets`, r.overflow <= 0 && r.robots === 'noindex' && r.tabs >= 2 && /All/.test(r.selected) && r.small === 0, JSON.stringify(r))
      if ([390, 768, 1440].includes(w)) await page.screenshot({ path: path.join(OUT, `site-search-results-en-${w}.png`), fullPage: false })
      if (w === 1440) {
        await page.locator('[role=tab]').nth(1).click()
        await page.waitForTimeout(200)
        ok('a filter tab narrows the results and is selected', await page.evaluate(() => document.querySelector('[role=tab][aria-selected=true]') !== document.querySelector('[role=tab]'))
          && new URL(page.url()).searchParams.has('type'))
      }
      await page.close()
    }
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); track(page)
      await page.goto(`${BASE}/en/search?q=zzqxqq`, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.of-search-empty', { timeout: 20000 })
      ok('nothing found shows suggestions', await page.locator('.of-search-suggestions a').count() >= 1)
      await page.close()
    }
    /* terminal header: beside the theme switch; dense on desktop, 44 px on touch */
    for (const [w, touch] of [[1440, false], [390, true]]) {
      const page = await browser.newPage({ viewport: { width: w, height: 900 }, isMobile: touch, hasTouch: touch }); track(page)
      await page.goto(`${BASE}/en/prop/dashboard`, { waitUntil: 'domcontentloaded' })
      const t = page.locator('.of-terminal-actions [data-site-search]')
      await t.waitFor({ timeout: 20000 })
      /* the visual box matches its neighbours (test-header-controls.cjs); on touch the 44 px target is the ::after hit area */
      const r = await t.evaluate(el => ({ h: Math.max(el.getBoundingClientRect().height, parseFloat(getComputedStyle(el, '::after').height) || 0), next: el.nextElementSibling?.classList.contains('of-daynight') }))
      ok(`terminal ${w} px: trigger beside the theme switch${touch ? ', 44 px target on touch' : ''}`, r.next && (!touch || r.h >= 44), JSON.stringify(r))
      await t.click()
      await dialog(page).waitFor()
      if (w === 1440) await page.screenshot({ path: path.join(OUT, 'site-search-terminal-1440.png') })
      await page.close()
    }
    /* motion: transform/opacity only, none under reduced motion */
    {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); track(page)
      await ready(page, '/en/rulebook')
      await page.locator('.openfund-header [data-site-search]').first().click()
      await dialog(page).waitFor()
      ok('reduced motion: the palette does not animate', await page.evaluate(() => getComputedStyle(document.querySelector('.of-search-dialog')).animationName === 'none'))
      await page.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.join(' | '))
    console.log(`${n} site search checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
