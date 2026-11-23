/* Header controls (owner fix 5): every visible control in the website and
 * terminal headers (search, theme, language, "Enter terminal", "Connect
 * wallet", menu) shares one height (--hc-h) and one vertical centre; the
 * search trigger is a square of that height with the same radius. On coarse
 * pointers each control keeps its visual box and gains an invisible hit area
 * of at least 44 × 44 px (a ::after pseudo-element). Checked at seven widths,
 * RTL (fa, ar) and LTR (en, ru, zh-CN), dark and light, plus the compact
 * terminal header. Screenshots at 390, 768 and 1440 px. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/header-controls'))
fs.mkdirSync(OUT, { recursive: true })
let n = 0
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); n++; console.log('PASS - ' + name) }
const WIDTHS = [[360, 740], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080]]
const SHOTS = [390, 768, 1440]

/* Collects every visible header control with its box and, on touch, the
 * size of its hit area (the larger of the box and its ::after). */
const measure = (scope) => {
  const sel = '.of-search-trigger, .of-daynight, .of-language-select, .nav-cta, .rk-chip, .of-mobile-menu, .menu'
  const root = document.querySelector(scope)
  if (!root) return null
  const items = [...root.querySelectorAll(sel)].filter(e => {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e)
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
  }).map(e => {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e), after = getComputedStyle(e, '::after')
    const hitH = after.content && after.content !== 'none' && after.position === 'absolute' ? Math.max(r.height, parseFloat(after.height) || 0) : r.height
    const hitW = after.content && after.content !== 'none' && after.position === 'absolute' ? Math.max(r.width, parseFloat(after.width) || 0) : r.width
    return { cls: e.className.baseVal ?? String(e.className).split(' ')[0], h: Math.round(r.height * 10) / 10, w: Math.round(r.width * 10) / 10,
      cy: Math.round((r.top + r.height / 2) * 10) / 10, radius: cs.borderTopLeftRadius, hitH, hitW }
  })
  return { items, overflow: document.documentElement.scrollWidth - innerWidth }
}

const check = (label, m, touch) => {
  ok(`${label}: header found with controls`, m && m.items.length >= 3, JSON.stringify(m))
  const hs = m.items.map(i => i.h), cys = m.items.map(i => i.cy)
  ok(`${label}: equal heights`, Math.max(...hs) - Math.min(...hs) <= 1, JSON.stringify(m.items))
  ok(`${label}: one vertical centre`, Math.max(...cys) - Math.min(...cys) <= 1, JSON.stringify(m.items))
  const s = m.items.find(i => /of-search-trigger/.test(i.cls))
  const theme = m.items.find(i => /of-daynight/.test(i.cls))
  ok(`${label}: search is a square of the shared height and radius`, s && Math.abs(s.w - s.h) <= 1 && (!theme || s.radius === theme.radius), JSON.stringify({ s, theme }))
  if (touch) ok(`${label}: 44 px hit area on touch for every control`, m.items.every(i => i.hitH >= 44 && i.hitW >= 44), JSON.stringify(m.items))
  ok(`${label}: no horizontal overflow`, m.overflow <= 0, String(m.overflow))
}

;(async () => {
  const browser = await chromium.launch(); const errors = []
  try {
    for (const [locale, route] of [['fa', '/fa/rulebook'], ['en', '/en/rulebook'], ['ar', '/ar/markets'], ['ru', '/ru/markets'], ['zh-CN', '/zh-CN/rulebook']]) {
      for (const theme of ['dark', 'light']) {
        for (const [w, h] of WIDTHS) {
          const touch = w < 1024
          const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce' })
          const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e)))
          await page.goto(BASE + route, { waitUntil: 'domcontentloaded' })
          await page.waitForSelector('.openfund-header [data-site-search]', { timeout: 20000 })
          await page.evaluate(t => { document.documentElement.dataset.theme = t }, theme)
          await page.waitForTimeout(400)
          check(`website ${locale} ${theme} ${w}px`, await page.evaluate(measure, '.openfund-header .nav-actions'), touch)
          if (theme === 'dark' && SHOTS.includes(w) && ['fa', 'en'].includes(locale))
            await page.locator('.openfund-header').screenshot({ path: path.join(OUT, `header-website-${locale}-${w}.png`) })
          await ctx.close()
        }
      }
    }
    /* terminal header, including the compact state and touch */
    for (const locale of ['fa', 'en']) {
      for (const theme of ['dark', 'light']) {
        for (const [w, h] of WIDTHS) {
          const touch = w < 1024
          const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce' })
          const page = await ctx.newPage(); page.on('pageerror', e => errors.push(String(e)))
          await page.goto(`${BASE}/${locale}/prop/dashboard`, { waitUntil: 'domcontentloaded' })
          await page.locator('.of-terminal-actions [data-site-search]').waitFor({ timeout: 30000 })
          await page.evaluate(t => { document.documentElement.dataset.theme = t }, theme)
          await page.waitForTimeout(500)
          const m = await page.evaluate(measure, '.of-terminal-actions')
          const compact = await page.evaluate(() => !!document.querySelector('.of-terminal-compact'))
          check(`terminal ${locale} ${theme} ${w}px${compact ? ' (compact)' : ''}`, m, touch)
          if (theme === 'dark' && SHOTS.includes(w))
            await page.locator('.of-terminal-header').first().screenshot({ path: path.join(OUT, `header-terminal-${locale}-${w}.png`) })
          await ctx.close()
        }
      }
    }
    ok('no page errors', errors.length === 0, errors.join('\n'))
    console.log(`\n${n} checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
