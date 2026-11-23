/* Terminal guide popup (features/guide, ADR 0056) in the production bundle.
 *
 * The CMS is unreachable in this test, so the published-only bundled
 * fallback (the seed guide and its recorded media) is what opens. Checks:
 * it opens on entering the terminal, media/poster/subtitles, step dots and
 * Previous/Next/Start trading, Escape and the focus trap, "Don't show again"
 * (a version-only cookie, SameSite=Lax), the menu's "Guide" entry reopening
 * it, reduced motion (no autoplay), RTL, both themes, full screen on phones,
 * no horizontal scroll and 44 px targets. Screenshots at 390, 768 and 1440.
 *
 * Automated browsers do not get the automatic opening (it would interrupt
 * every other terminal test), so this test opts in with __OF_GUIDE_AUTOOPEN__. */
const { chromium } = require('playwright')
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict')
const BASE = process.env.TEST_FRONTEND_URL || 'http://localhost:8080'
const OUT = path.resolve(__dirname, '../output/playwright/terminal-guide')
fs.mkdirSync(OUT, { recursive: true })
let passed = 0
const check = (name, ok, detail = '') => { assert.ok(ok, `${name} ${detail}`); passed++; console.log('PASS - ' + name) }

;(async () => {
  const browser = await chromium.launch()
  try {
    for (const [w, h] of [[390, 844], [768, 1024], [1440, 900]]) {
      for (const [locale, theme] of [['en', 'dark'], ['fa', 'light']]) {
        const context = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme })
        await context.addInitScript(t => { window.__OF_GUIDE_AUTOOPEN__ = true; try { localStorage.setItem('openfund-theme', t) } catch {} }, theme)
        const page = await context.newPage()
        const errors = []; page.on('pageerror', e => errors.push(e.message))
        /* the CMS is down: the bundled, published-only fallback is used */
        await page.route(/\/(cms\/)?items\//, r => r.abort())
        await page.route(/:8055\//, r => r.abort())
        const id = `${w} ${locale} ${theme}`
        await page.goto(`${BASE}/${locale}/prop/trade`)
        const dialog = page.locator('.of-guide[role=dialog]')
        await dialog.waitFor({ timeout: 20000 })
        check(`${id}: opens on entering the terminal`, await dialog.isVisible())
        check(`${id}: labelled modal`, (await dialog.getAttribute('aria-modal')) === 'true' && Boolean(await dialog.getAttribute('aria-labelledby')))
        check(`${id}: direction`, (await dialog.getAttribute('dir')) === (locale === 'fa' ? 'rtl' : 'ltr'))
        const video = dialog.locator('video')
        check(`${id}: video with WebM, MP4 and a poster`, (await video.locator('source').count()) === 2 && Boolean(await video.getAttribute('poster')))
        await page.waitForFunction(() => document.querySelector('.of-guide video')?.readyState >= 2, null, { timeout: 15000 })
        check(`${id}: the recorded video loads`, true)
        await page.waitForFunction(() => document.querySelectorAll('.of-guide video track').length === 2, null, { timeout: 10000 })
        check(`${id}: fa and en subtitles attached`, true)
        check(`${id}: title in the page language`, (await dialog.locator('h2').innerText()).length > 10)
        const noScroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
        check(`${id}: no horizontal scroll`, noScroll)
        const small = await dialog.locator('button, input[type=checkbox] >> xpath=..').evaluateAll(els => els.filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.width < 43.5 || r.height < 43.5) }).map(e => e.className || e.tagName))
        check(`${id}: targets at least 44 px`, !small.length, small.join(','))
        if (w === 390) {
          await page.waitForTimeout(400) /* after the opening animation */
          const box = await dialog.boundingBox()
          check(`${id}: full screen on phones`, box.width >= 389 && box.height >= h - 1)
        }
        await page.screenshot({ path: path.join(OUT, `guide-${w}-${locale}-${theme}.png`) })
        /* steps */
        const next = dialog.getByRole('button', { name: locale === 'fa' ? 'بعدی' : 'Next' })
        await next.click()
        check(`${id}: Next moves to step 2`, (await dialog.locator('[aria-current=step]').count()) === 1 && (await dialog.locator('.of-guide-dots li').nth(1).locator('[aria-current=step]').count()) === 1)
        check(`${id}: Start trading on the last step`, await dialog.getByRole('button', { name: locale === 'fa' ? 'شروع معامله' : 'Start trading' }).isVisible())
        await dialog.getByRole('button', { name: locale === 'fa' ? 'قبلی' : 'Previous' }).click()
        /* focus trap */
        for (let i = 0; i < 12; i++) await page.keyboard.press('Tab')
        check(`${id}: focus stays in the dialog`, await page.evaluate(() => Boolean(document.activeElement?.closest('.of-guide'))))
        /* Escape closes; it opens again next time */
        await page.keyboard.press('Escape')
        await dialog.waitFor({ state: 'detached' })
        check(`${id}: Escape closes`, true)
        await page.reload()
        await dialog.waitFor({ timeout: 20000 })
        check(`${id}: shows again on the next visit`, true)
        /* Don't show again */
        await dialog.locator('.of-guide-optout input').check()
        await dialog.getByRole('button', { name: locale === 'fa' ? 'بستن راهنما' : 'Close the guide' }).click()
        const cookie = (await context.cookies()).find(c => c.name === 'of_guide_0')
        check(`${id}: "Don't show again" cookie holds only the version`, cookie?.value === '1' && cookie.sameSite === 'Lax' && cookie.expires > Date.now() / 1000 + 300 * 86400)
        await page.reload()
        await page.waitForTimeout(2500)
        check(`${id}: not shown after opting out`, (await dialog.count()) === 0)
        /* the menu reopens it */
        /* phones and tablets: the Menu drawer; desktop: the More menu */
        const trigger = page.locator('.of-terminal-menu-trigger')
        if (await trigger.isVisible()) await trigger.click()
        else await page.locator('.of-terminal-more summary').click()
        await page.getByRole('button', { name: locale === 'fa' ? 'راهنما' : 'Guide', exact: true }).filter({ visible: true }).first().click()
        await dialog.waitFor({ timeout: 10000 })
        check(`${id}: the menu's Guide entry reopens it`, true)
        check(`${id}: the opt-out stays ticked`, await dialog.locator('.of-guide-optout input').isChecked())
        check(`${id}: no page errors`, !errors.length, errors.join(' | '))
        await context.close()
      }
    }
    /* reduced motion: no autoplay, poster and a play button */
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
    await context.addInitScript(() => { window.__OF_GUIDE_AUTOOPEN__ = true })
    const page = await context.newPage()
    await page.route(/\/(cms\/)?items\//, r => r.abort())
    await page.goto(`${BASE}/en/prop/trade`)
    await page.locator('.of-guide[role=dialog]').waitFor({ timeout: 20000 })
    await page.waitForTimeout(1500)
    check('reduced motion: the video does not autoplay', await page.evaluate(() => document.querySelector('.of-guide video').paused))
    check('reduced motion: a play button is offered', await page.getByRole('button', { name: 'Play video' }).isVisible())
    await page.screenshot({ path: path.join(OUT, 'guide-reduced-motion.png') })
    /* automated browsers without the opt-in are not interrupted */
    const plain = await browser.newPage()
    await plain.route(/\/(cms\/)?items\//, r => r.abort())
    await plain.goto(`${BASE}/en/prop/trade`)
    await plain.waitForTimeout(3000)
    check('other automated terminal tests are not interrupted', (await plain.locator('.of-guide[role=dialog]').count()) === 0)
    console.log(`terminal guide: ${passed} checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
