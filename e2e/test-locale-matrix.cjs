/* Five-locale acceptance matrix: fa, en, ar, ru, zh-CN × every public and
 * product route, on desktop and mobile viewports.
 *
 * For each page it checks, from the rendered DOM (including the legacy
 * terminal iframe):
 *  - no redirect: the final path is the requested path (language never
 *    sends a visitor to another product or locale);
 *  - <html lang> and dir (fa/ar rtl, en/ru/zh-CN ltr);
 *  - no untranslated-text report (window.__ofI18nMisses) and no visible
 *    "not yet translated" notice;
 *  - no English sentence fragments on fa/ar/ru/zh-CN pages and no Persian
 *    text on ar/ru/zh-CN/en pages (brand names, tickers and numbers allowed);
 *  - no raw translation keys, no empty main content, no horizontal overflow.
 * It also checks that the chosen language survives navigation, reload, Back
 * and direct URL entry. Content comes from the configured CMS (live public
 * Directus in local runs) with bundled seeds as fallback.
 *
 * Usage: TEST_FRONTEND_URL=http://127.0.0.1:8091 node e2e/test-locale-matrix.cjs
 *        LOCALE_MATRIX_ONLY=ar,ru  LOCALE_MATRIX_VIEWPORTS=desktop  (optional filters) */
const { chromium } = require('playwright')
const fs = require('node:fs')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://127.0.0.1:8080').replace(/\/$/, '')
const OUT = process.env.LOCALE_MATRIX_OUT || 'output/playwright/locale-matrix'
const LOCALES = (process.env.LOCALE_MATRIX_ONLY || 'fa,en,ar,ru,zh-CN').split(',')
const VIEWPORTS = { desktop: { width: 1366, height: 860 }, mobile: { width: 390, height: 844 } }
const VIEWPORT_NAMES = (process.env.LOCALE_MATRIX_VIEWPORTS || 'desktop,mobile').split(',')
/* Sharding (CI): LOCALE_MATRIX_SHARD=i/n runs every n-th viewport×locale
 * combination (1-based i) and the persistence checks only on shard 1, so the
 * union of all shards equals the unsharded run. Shards are independent: each
 * uses its own browser, context and output directory. */
const [SHARD_INDEX, SHARD_COUNT] = (process.env.LOCALE_MATRIX_SHARD || '1/1').split('/').map(Number)
if (!(SHARD_COUNT >= 1 && SHARD_INDEX >= 1 && SHARD_INDEX <= SHARD_COUNT)) throw Error('LOCALE_MATRIX_SHARD must look like i/n with 1 <= i <= n.')
const RTL = new Set(['fa', 'ar'])
const ROUTES = [
  'home', 'challenges', 'markets', 'rulebook', 'transparency', 'revenue-model', 'live-market-access', 'ambassador', 'coach', 'faq', 'tools', 'tools/position-size',
  'learn', 'learn/paths/perpetual-futures-mechanics', 'learn/lessons/trading-journal-that-works', 'learn/glossary', 'referral',
  'prop/dashboard', 'prop/trade', 'prop/portfolio', 'prop/journal', 'prop/purchases', 'prop/withdrawals', 'prop/leaderboard', 'prop/certificates',
  'perpetual/dashboard', 'perpetual/trade', 'perpetual/portfolio', 'perpetual/journal', 'perpetual/leaderboard', 'perpetual/rewards',
]
/* language-neutral words that may appear in Latin script on any page */
const BRANDS = /\b(Openfund(?: (?:Prop|Perpetual|Protocol|Terminal))?|Gains(?: Network)?|gTrade|Vela(?: by LuxAlgo)?|LuxAlgo|WalletConnect|MetaMask|Rabby|RainbowKit|Telegram|Discord|Instagram|GitHub|Directus|PostgreSQL|Arbitrum(?: One)?|Sepolia|Ethereum|Certik|MUX|GPL-2\.0|Render|Sites|REST|WebSocket|Web3|EIP-\d+|SIWE|KYC|CSV|PDF|PNG|JSON|API|USD|USDC|USDT|DAI|ETH|BTC|UTC|P&L|PnL|ROI|SL|TP|A-booked|B-booked|free_demo|Kian Radmanesh|Arman Nikpey|Niloufar Shayan|Raha Mehrayin|Saman Farahmand|Starter|Standard|Instant|One-phase|Brannan St\.?|Suite|San Francisco|CA|Linux|Windows|macOS|iOS|Android|Google|dYdX|Merkle|nonce|walk-forward|high-water mark|date|symbol|side|qty|entry|exit|fees|pnl|profit|net pnl|gross pnl)\b/gi
const ENGLISH_RUN = /\b[A-Za-z][a-z]{2,}(?:[ ,'’-]+[A-Za-z][a-z]{1,}){2,}\b/
const PERSIAN = /[پچژگکی]/ /* letters used in Persian but not Arabic */
const ARABIC_SCRIPT = /[؀-ۿ]/

function collect() {
  /* runs in the page: visible text (and key attributes) of the document and same-origin frames */
  const docs = [document]
  document.querySelectorAll('iframe').forEach(f => { try { if (f.contentDocument) docs.push(f.contentDocument) } catch {} })
  const texts = []
  for (const doc of docs) {
    const walker = doc.createTreeWalker(doc.body || doc.documentElement, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      const el = node.parentElement
      if (!el || el.closest('script,style,noscript,svg,canvas,option,select,[aria-hidden="true"],.of-language-select,[data-wallet-address],code,pre,kbd,.formula,.lesson-formula,[translate="no"]')) continue
      const style = doc.defaultView.getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      const rect = el.getBoundingClientRect()
      if (!rect.width && !rect.height) continue
      const t = node.nodeValue.replace(/\s+/g, ' ').trim()
      if (t) texts.push(t)
    }
    doc.querySelectorAll('[aria-label],[placeholder],[title]').forEach(el => {
      if (el.closest('.of-language-select,svg,[aria-hidden="true"]')) return
      for (const a of ['aria-label', 'placeholder', 'title']) { const v = el.getAttribute(a); if (v && v.trim()) texts.push(v.trim()) }
    })
  }
  const main = document.querySelector('main, #main, .of-terminal-main, [role="main"]')
  const frameText = docs.slice(1).reduce((n, d) => n + ((d.body && d.body.innerText) || '').trim().length, 0)
  return {
    lang: document.documentElement.lang, dir: document.documentElement.dir, path: location.pathname,
    misses: (window.__ofI18nMisses || {}), notice: !!document.querySelector('[data-untranslated-notice], #of-landing-locale-note'),
    mainText: (main ? main.innerText : document.body.innerText).trim().length + frameText,
    overflow: document.documentElement.scrollWidth > innerWidth + 2,
    title: document.title, texts,
  }
}

function leaks(locale, texts) {
  const out = []
  for (const raw of texts) {
    const t = raw.replace(BRANDS, ' ')
    if (locale !== 'en' && ENGLISH_RUN.test(t)) out.push(['english', raw])
    if (locale !== 'fa' && locale !== 'ar' && ARABIC_SCRIPT.test(raw)) out.push(['arabic-script', raw])
    if (locale === 'ar' && PERSIAN.test(raw)) out.push(['persian', raw])
    if (/^[a-z]+(?:\.[a-zA-Z]+)+$/.test(raw.trim()) && !/\.(?:com|org|io|trade|cloud|js|json)$/.test(raw.trim())) out.push(['raw-key', raw])
  }
  return out
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const results = []
  const allMisses = {}, allLeaks = {}
  const check = (name, cond, detail = '') => { results.push({ name, pass: !!cond, detail }); if (!cond) console.error('FAIL', name, String(detail).slice(0, 400)) }

  let combination = -1
  for (const vp of VIEWPORT_NAMES) {
    for (const locale of LOCALES) {
      combination++
      if (combination % SHARD_COUNT !== SHARD_INDEX - 1) continue
      const context = await browser.newContext({ viewport: VIEWPORTS[vp], isMobile: vp === 'mobile', hasTouch: vp === 'mobile' })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', e => errors.push(e.message))
      for (const route of ROUTES) {
        const path = `/${locale}/${route}`
        try {
          await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 })
          await page.waitForFunction(() => !document.getElementById('of-boot-loader'), null, { timeout: 20000 }).catch(() => {})
          await page.waitForTimeout(route.includes('/') && /^(prop|perpetual)\//.test(route) ? 4000 : 2500)
          const s = await page.evaluate(collect)
          const id = `${vp} ${locale} ${route}`
          check(`${id}: no redirect`, s.path === path, s.path)
          check(`${id}: lang`, s.lang === locale, s.lang)
          check(`${id}: dir`, s.dir === (RTL.has(locale) ? 'rtl' : 'ltr'), s.dir)
          check(`${id}: no untranslated strings`, !(s.misses[locale] || []).length, (s.misses[locale] || []).slice(0, 8).join(' | '))
          check(`${id}: no untranslated notice`, !s.notice)
          check(`${id}: content present`, s.mainText > 12, s.mainText)
          check(`${id}: title localized`, locale === 'en' || !ENGLISH_RUN.test(s.title.replace(BRANDS, ' ')), s.title)
          if (vp === 'mobile') check(`${id}: no horizontal overflow`, !s.overflow)
          for (const m of s.misses[locale] || []) (allMisses[locale] ||= new Set()).add(m)
          const found = leaks(locale, s.texts)
          for (const [, v] of found) (allLeaks[locale] ||= new Set()).add(v)
          check(`${id}: no wrong-language text`, !found.length, found.slice(0, 6).map(([k, v]) => `${k}: ${v.slice(0, 90)}`).join(' | '))
          if (route === 'home' || route === 'prop/trade' || route === 'learn/lessons/trading-journal-that-works') {
            await page.screenshot({ path: `${OUT}/${vp}-${locale}-${route.replace(/\//g, '_')}.png` }).catch(() => {})
          }
        } catch (e) {
          check(`${vp} ${locale} ${route}: loads`, false, e.message)
        }
      }
      check(`${vp} ${locale}: no page errors`, !errors.length, errors.slice(0, 3).join(' | '))
      await context.close()
    }
  }

  /* persistence: selector → navigation → reload → Back → direct entry */
  if (SHARD_INDEX === 1) {
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop })
  const page = await context.newPage()
  await page.goto(`${BASE}/fa/markets`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.locator('.of-language-select select').first().selectOption('ar')
  await page.waitForURL('**/ar/markets', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  check('switch fa→ar keeps page', new URL(page.url()).pathname === '/ar/markets', page.url())
  check('switch fa→ar sets rtl Arabic', await page.evaluate(() => document.documentElement.lang === 'ar' && document.documentElement.dir === 'rtl'))
  await page.locator('a[href="/ar/faq"]:visible').first().click()
  await page.waitForURL('**/ar/faq', { timeout: 15000 }).catch(() => {})
  check('navigation keeps Arabic', new URL(page.url()).pathname === '/ar/faq', page.url())
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
  check('reload keeps Arabic', await page.evaluate(() => document.documentElement.lang) === 'ar')
  await page.goBack(); await page.waitForTimeout(2500)
  check('Back returns to Arabic markets', new URL(page.url()).pathname === '/ar/markets' && await page.evaluate(() => document.documentElement.lang) === 'ar', page.url())
  await page.locator('.of-language-select select').first().selectOption('zh-CN')
  await page.waitForURL('**/zh-CN/markets', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  check('switch ar→zh-CN ltr', await page.evaluate(() => document.documentElement.lang === 'zh-CN' && document.documentElement.dir === 'ltr'))
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
  check('root redirect honours stored language', new URL(page.url()).pathname === '/zh-CN/home', page.url())
  await page.goto(`${BASE}/ru/perpetual/trade`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(4000)
  check('direct entry ru Perpetual stays on Perpetual', new URL(page.url()).pathname === '/ru/perpetual/trade', page.url())
  await page.goto(`${BASE}/ru/home`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
  check('ru Home shows the two-product gateway', await page.locator('a[href="/ru/perpetual/trade"]').count() > 0)
  await context.close()
  }

  await browser.close()
  const failed = results.filter(r => !r.pass)
  fs.writeFileSync(`${OUT}/misses.json`, JSON.stringify(Object.fromEntries(Object.entries(allMisses).map(([k, v]) => [k, [...v].sort()])), null, 1))
  fs.writeFileSync(`${OUT}/leaks.json`, JSON.stringify(Object.fromEntries(Object.entries(allLeaks).map(([k, v]) => [k, [...v].sort()])), null, 1))
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ base: BASE, total: results.length, failed: failed.length, results }, null, 1))
  console.log(`locale matrix${SHARD_COUNT > 1 ? ` shard ${SHARD_INDEX}/${SHARD_COUNT}` : ''}: ${results.length - failed.length}/${results.length} checks passed`)
  process.exit(failed.length ? 1 : 0)
})()
