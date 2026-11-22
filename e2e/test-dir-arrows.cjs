/* Direction-aware arrows across every public route and all five locales.
 *
 * For each locale (fa, ar = RTL; en, ru, zh-CN = LTR) and public route it
 * opens the page and checks, in the document and same-origin frames:
 *  - every rendered `svg.of-arrow` (DirArrow / arrowSvg) is mirrored exactly
 *    when it is a horizontal kind inside a right-to-left context, so
 *    forward/back/external/forward-down point along the reading direction of
 *    the element itself (ru and zh-CN behave like en; ar behaves like fa);
 *  - `up` and `down` are never mirrored;
 *  - no visible text node contains an arrow glyph (copy never carries one;
 *    keyboard-key hints in <kbd> or aria-hidden key legends are exempt).
 * It also opens the Challenges mega menu once per locale so the banner arrow
 * (a CSS mask) is checked on the open panel.
 *
 * Usage: TEST_FRONTEND_URL=http://127.0.0.1:8091 node e2e/test-dir-arrows.cjs
 *        DIR_ARROWS_ONLY=ru,zh-CN  (optional locale filter)
 *        DIR_ARROWS_WIDTHS=360,390,768,1024,1280,1440,1920 (optional; default 1366)
 *        DIR_ARROWS_THEMES=dark,light (optional; default dark) */
const { chromium } = require('playwright')
const fs = require('node:fs')

const BASE = (process.env.TEST_FRONTEND_URL || 'http://127.0.0.1:8080').replace(/\/$/, '')
const OUT = process.env.DIR_ARROWS_OUT || 'output/playwright/dir-arrows'
const LOCALES = (process.env.DIR_ARROWS_ONLY || 'fa,en,ar,ru,zh-CN').split(',')
const RTL = new Set(['fa', 'ar'])
const WIDTHS = (process.env.DIR_ARROWS_WIDTHS || '1366').split(',').map(Number)
const THEMES = (process.env.DIR_ARROWS_THEMES || 'dark').split(',')
const HEIGHT = { 360: 740, 390: 844, 768: 1024, 1024: 768, 1280: 800, 1440: 900, 1920: 1080 }
const ROUTES = (process.env.DIR_ARROWS_ROUTES || [
  'home', 'challenges', 'markets', 'rulebook', 'transparency', 'revenue-model', 'live-market-access', 'economy',
  'ambassador', 'coach', 'referral', 'faq', 'tools', 'tools/position-size', 'learn', 'learn/glossary',
  'learn/paths/perpetual-futures-mechanics', 'learn/lessons/trading-journal-that-works', 'whitepaper', 'governance',
  'roadmap', 'about', 'contact', 'apps', 'developers', 'campaign', 'checkout', 'certificate-verification',
].join(',')).split(',')

function inspect() {
  const GLYPHS = /[←→↙↘↖↗‹›↓↑]/
  const HORIZONTAL = new Set(['forward', 'back', 'forward-down', 'external'])
  const docs = [document]
  document.querySelectorAll('iframe').forEach(f => { try { if (f.contentDocument) docs.push(f.contentDocument) } catch {} })
  const arrows = []
  const glyphs = []
  for (const doc of docs) {
    const view = doc.defaultView
    for (const svg of doc.querySelectorAll('svg.of-arrow')) {
      const box = svg.getBoundingClientRect()
      if (!box.width || !box.height || view.getComputedStyle(svg).visibility === 'hidden') continue
      const kind = svg.getAttribute('data-arrow')
      const dir = view.getComputedStyle(svg).direction
      const t = view.getComputedStyle(svg).transform
      const a = t && t !== 'none' ? new view.DOMMatrix(t).a : 1
      const mirrored = a < 0
      const expected = HORIZONTAL.has(kind) && dir === 'rtl'
      arrows.push({ kind, dir, mirrored, ok: mirrored === expected, where: (svg.closest('a,button,[class]')?.className?.baseVal ?? svg.closest('a,button,[class]')?.className ?? '').toString().slice(0, 60) })
    }
    const walker = doc.createTreeWalker(doc.body || doc.documentElement, view.NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      const el = node.parentElement
      if (!el || !GLYPHS.test(node.nodeValue)) continue
      const glyphHost = el.closest('[data-arrow-glyph]')
      if (glyphHost) {
        /* a text fallback chosen by direction at render time (SVG <text>) */
        const want = { forward: ['→', '←'], back: ['←', '→'], external: ['↗', '↖'], 'forward-down': ['↘', '↙'], down: ['↓', '↓'], up: ['↑', '↑'] }[glyphHost.getAttribute('data-arrow-glyph')]
        const rtl = view.getComputedStyle(glyphHost.closest('svg') || glyphHost).direction === 'rtl'
        if (!want || node.nodeValue.trim() !== want[rtl ? 1 : 0]) glyphs.push(`fallback glyph ${node.nodeValue.trim()} in ${rtl ? 'rtl' : 'ltr'}`)
        continue
      }
      if (el.closest('script,style,noscript,kbd,[aria-hidden="true"],.dd-kbd,[data-key-legend]')) continue
      const box = el.getBoundingClientRect()
      if (!box.width && !box.height) continue
      if (/(?:Alt|Shift|Ctrl|Cmd|⌘|⌥)\s*\+\s*[←→↑↓]/.test(node.nodeValue)) continue
      glyphs.push(node.nodeValue.trim().slice(0, 80))
    }
  }
  return { arrows, glyphs, dir: document.documentElement.dir, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const failures = []
  let checked = 0
  for (const locale of LOCALES) for (const width of WIDTHS) for (const theme of THEMES) {
    const context = await browser.newContext({ viewport: { width, height: HEIGHT[width] || 900 }, reducedMotion: 'reduce', colorScheme: theme })
    await context.addInitScript(t => { try { localStorage.setItem('openfund-theme', t) } catch {} }, theme)
    const page = await context.newPage()
    const tag = WIDTHS.length > 1 || THEMES.length > 1 ? `@${width}/${theme}` : ''
    for (const route of ROUTES) {
      const url = `${BASE}/${locale}/${route}`
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
        /* live market feeds keep the network busy: wait for rendered content instead */
        await page.waitForFunction(() => document.querySelector('main, #root > *')?.textContent?.trim().length > 40, null, { timeout: 20000 }).catch(() => {})
        await page.waitForTimeout(900)
        const r = await page.evaluate(inspect)
        /* some pages are published in fewer locales and redirect (campaign: fa/en) */
        const landed = new URL(page.url()).pathname.split('/')[1]
        const expectDir = RTL.has(landed) ? 'rtl' : 'ltr'
        if (landed !== locale && !(route === 'campaign' && landed === 'en')) failures.push(`${locale}/${route}: redirected to /${landed}/`)
        if (r.dir !== expectDir) failures.push(`${locale}/${route}: html dir ${r.dir}, expected ${expectDir}`)
        for (const a of r.arrows.filter(x => !x.ok)) failures.push(`${locale}/${route}${tag}: ${a.kind} arrow in ${a.dir} context ${a.mirrored ? 'mirrored' : 'not mirrored'} (${a.where})`)
        for (const g of r.glyphs) failures.push(`${locale}/${route}: arrow glyph in visible text: "${g}"`)
        if (r.overflow > 1) failures.push(`${locale}/${route}${tag}: horizontal page scroll ${r.overflow}px`)
        checked += r.arrows.length
      } catch (error) {
        failures.push(`${locale}/${route}: ${error.message.split('\n')[0]}`)
      }
    }
    /* the Challenges mega-menu banner arrow is a CSS mask on ::after */
    await page.goto(`${BASE}/${locale}/home`, { waitUntil: 'domcontentloaded' })
    const trigger = page.locator('.openfund-header [aria-haspopup="true"], .openfund-header [aria-expanded]').first()
    if (await trigger.count()) {
      await trigger.click().catch(() => {})
      await page.waitForTimeout(300)
      const banner = await page.evaluate(() => {
        const em = document.querySelector('.mega-banner-copy em')
        if (!em || !em.getClientRects().length) return null
        const s = getComputedStyle(em, '::after')
        const t = s.transform
        return { dir: getComputedStyle(em).direction, mirrored: t && t !== 'none' ? new DOMMatrix(t).a < 0 : false, mask: s.maskImage || s.webkitMaskImage }
      })
      if (banner && banner.mirrored !== (banner.dir === 'rtl')) failures.push(`${locale}: mega-menu banner arrow ${banner.mirrored ? 'mirrored' : 'not mirrored'} in ${banner.dir}`)
      if (banner && !/url\(/.test(banner.mask || '')) failures.push(`${locale}: mega-menu banner arrow has no mask image`)
      await page.screenshot({ path: `${OUT}/${locale}-${width}-${theme}-mega-menu.png` })
    }
    await context.close()
  }
  await browser.close()
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify({ checked, failures }, null, 2))
  if (failures.length) {
    console.error(`Direction-aware arrows: ${failures.length} failure(s)`)
    for (const f of failures) console.error(`  ${f}`)
    process.exit(1)
  }
  console.log(`Direction-aware arrows: ${checked} arrows on ${ROUTES.length} routes × ${LOCALES.length} locales × ${WIDTHS.length} widths × ${THEMES.length} themes point in the reading direction`)
})().catch(error => { console.error(error); process.exit(1) })
