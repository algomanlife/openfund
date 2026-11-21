/* Developer documentation page: every section from docs/developer-portal
 * renders (bundled fallback without Directus), en/fa own text, ar/ru/zh-CN show
 * the English text with a note, each section links to its GitHub source, code
 * blocks have copy buttons, the search filters sections, the index is sticky on
 * desktop and collapsible on narrow screens, the page is reachable from the
 * Resources menu, and nothing is laid out outside the viewport. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/developers'))
fs.mkdirSync(OUT, { recursive: true })
const source = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/developer-portal/sections.json'), 'utf8')).sections.filter(s => s.status === 'published')
const results = []
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); results.push(name); console.log('PASS - ' + name) }

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  try {
    for (const [locale, width, height, theme] of [['en', 1440, 900, 'dark'], ['fa', 1440, 900, 'light'], ['ar', 390, 844, 'dark'], ['zh-CN', 768, 1024, 'light'], ['ru', 360, 740, 'dark']]) {
      const touch = width < 768
      const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, hasTouch: touch, isMobile: touch })
      const page = await context.newPage(); page.on('pageerror', e => errors.push(String(e)))
      await page.goto(`${BASE}/${locale}/developers`, { waitUntil: 'load' })
      await page.locator('.dd-section').first().waitFor({ timeout: 30000 }); await page.waitForTimeout(500)
      const m = await page.evaluate(() => {
        const inView = [...document.querySelectorAll('.dd-layout, .dd-aside, .dd-main, .dd-section, .dd-note')].every(e => { const r = e.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= innerWidth + 1) })
        return { sections: [...document.querySelectorAll('.dd-section')].map(s => s.id), lang: document.querySelector('.dd-section').lang, note: !!document.querySelector('.dd-note'),
          sources: [...document.querySelectorAll('.dd-meta a')].map(a => a.getAttribute('href')), copies: document.querySelectorAll('.dd-code .dd-copy').length, codes: document.querySelectorAll('.dd-code').length,
          inView, overflow: document.documentElement.scrollWidth - innerWidth, mobileIndex: getComputedStyle(document.querySelector('.dd-index-mobile')).display,
          sticky: getComputedStyle(document.querySelector('.dd-aside')).position, menu: !!document.querySelector(`a[href="/${document.documentElement.lang}/developers"], a[href$="/developers"]`) }
      })
      const own = locale === 'en' || locale === 'fa'
      ok(`${locale} ${width}: every published section renders and links to its source file`, m.sections.length === source.length && source.every((s, i) => m.sections[i] === `doc-${s.slug}` && m.sources[i] === `https://github.com/algomanlife/openfund/blob/main/${s.source_path}`), JSON.stringify(m.sections))
      ok(`${locale} ${width}: ${own ? 'own text' : 'English text with a note'}; code blocks have copy buttons; nothing outside the viewport`, (own ? m.lang === locale && !m.note : m.lang === 'en' && m.note) && m.codes > 0 && m.copies === m.codes && m.inView && m.overflow <= 0, JSON.stringify(m))
      ok(`${locale} ${width}: ${width < 900 ? 'collapsible index' : 'sticky index'}; linked from the site navigation`, (width < 900 ? m.mobileIndex === 'block' : m.mobileIndex === 'none') && m.sticky === 'sticky' && m.menu, JSON.stringify(m))
      await page.fill('.dd-search input', 'gitleaks'); await page.waitForTimeout(200)
      const hits = await page.locator('.dd-section').count()
      await page.fill('.dd-search input', 'zz-no-such-term'); await page.waitForTimeout(200)
      ok(`${locale} ${width}: the search filters sections and says when nothing matches`, hits >= 1 && hits < source.length && await page.locator('.dd-section').count() === 0 && await page.locator('.dd-empty').count() === 1)
      await page.fill('.dd-search input', ''); await page.waitForTimeout(200)
      await page.screenshot({ path: path.join(OUT, `developers-${locale}-${width}-${theme}.png`) })
      await context.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${results.length} developer documentation checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
