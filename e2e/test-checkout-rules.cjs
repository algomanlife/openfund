/* Checkout model banners and conditions: one animated SVG banner per model;
 * every condition on the page equals the server's public rules
 * (GET /purchases/plans → rules) × the selected account size; changing the
 * size or model updates the amounts; "More conditions" links the Rulebook;
 * banners animate only while visible; reduced motion is static; RTL and LTR
 * fit from 360 to 1920 px without horizontal overflow. */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const OUT = path.resolve(process.env.OUTPUT_DIR || path.join(__dirname, '../output/playwright/checkout-rules'))
fs.mkdirSync(OUT, { recursive: true })
let n = 0
const ok = (name, value, info = '') => { assert.ok(value, `${name} ${info}`); n++; console.log('PASS - ' + name) }
const usd = v => '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 })
const pct = v => `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`

;(async () => {
  const api = await (await fetch(`${BASE}/purchases/plans`)).json()
  const plans = api.plans || api
  const browser = await chromium.launch(); const errors = []
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' }); page.on('pageerror', e => errors.push(String(e)))
    await page.goto(`${BASE}/en/checkout`, { waitUntil: 'load' })
    await page.locator('.of-co-models').waitFor({ timeout: 20000 })
    const banners = await page.evaluate(() => [...document.querySelectorAll('.of-co-models label')].map(l => ({ value: l.querySelector('input')?.value, banner: l.querySelector('svg.of-co-banner')?.getAttribute('class') || '', hidden: l.querySelector('svg.of-co-banner')?.getAttribute('aria-hidden') })))
    ok('one decorative banner per model, shaped by its phases', banners.length >= 3 && banners.filter(b => b.banner).every(b => b.hidden === 'true')
      && banners.some(b => /is-standard/.test(b.banner)) && banners.some(b => /is-one-step/.test(b.banner)) && banners.some(b => /is-instant/.test(b.banner)), JSON.stringify(banners))
    await page.waitForTimeout(400)
    ok('banners animate while on screen', await page.evaluate(() => document.querySelectorAll('svg.of-co-banner.is-live').length > 0))

    const readRows = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.of-co-conditions dl > div')].map(d => [d.querySelector('dt').firstChild.textContent.trim(), d.querySelector('dd').textContent.trim()])))
    const check = async slug => {
      const plan = plans.find(p => p.slug === slug), r = plan.rules
      await page.locator(`.of-co-models label:has(input[value="${slug}"])`).click(); await page.waitForFunction(v => document.querySelector('input[name=of-co-model]:checked')?.value === v, slug); await page.waitForTimeout(300)
      const size = Number(await page.locator('input[name="of-co-size"]:checked').getAttribute('value'))
      const rows = await readRows(), amount = p => `${pct(p)} = ${usd(size * p / 100)}`
      const want = { 'Daily loss': amount(r.dailyLossPct), 'Maximum loss': amount(r.maxTotalLossPct) }
      if (r.phases === 1) want['Profit target'] = amount(r.phaseTargetsPct[0])
      if (r.phases === 2) { want['Phase 1 target'] = amount(r.phaseTargetsPct[0]); want['Phase 2 target'] = amount(r.phaseTargetsPct[1]) }
      if (r.profitSplitPct != null) want['Trader share'] = pct(r.profitSplitPct)
      if (r.minTradingDays) want['Minimum trading days'] = String(r.minTradingDays)
      ok(`${slug}: every condition equals the server rules × ${usd(size)}`, Object.entries(want).every(([k, v]) => rows[k] === v), JSON.stringify({ rows, want }))
      return size
    }
    for (const slug of ['standard', 'one-phase', 'instant']) await check(slug)
    const sizes = await page.locator('input[name="of-co-size"]').evaluateAll(els => els.map(e => e.value))
    if (sizes.length > 1) {
      const last = sizes[sizes.length - 1]; await page.locator(`.of-co-sizes label:has(input[value="${last}"])`).click(); await page.waitForFunction(v => document.querySelector('input[name=of-co-size]:checked')?.value === v, last); await page.waitForTimeout(300)
      await check('instant')
    }
    await page.locator('.of-co-more summary').click()
    ok('"More conditions" opens with the Rulebook link', await page.evaluate(() => document.querySelector('.of-co-more').open && /\/en\/rulebook$/.test(document.querySelector('.of-co-rulebook').getAttribute('href'))))
    await page.screenshot({ path: path.join(OUT, 'checkout-en-dark-1440.png'), fullPage: true })
    await page.close()

    const rm = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); rm.on('pageerror', e => errors.push(String(e)))
    await rm.goto(`${BASE}/en/checkout`, { waitUntil: 'load' }); await rm.locator('.of-co-models').waitFor(); await rm.waitForTimeout(500)
    ok('reduced motion: banners static', await rm.evaluate(() => document.querySelectorAll('svg.of-co-banner.is-live').length === 0 && document.getAnimations().filter(a => a.effect?.target?.closest?.('.of-co-banner') && a.playState === 'running').length === 0))
    await rm.close()

    for (const [w, loc] of [[360, 'fa'], [390, 'ar'], [768, 'en'], [1024, 'fa'], [1920, 'en']]) {
      const p = await browser.newPage({ viewport: { width: w, height: 900 }, isMobile: w < 768 }); p.on('pageerror', e => errors.push(String(e)))
      await p.goto(`${BASE}/${loc}/checkout`, { waitUntil: 'load' }); await p.locator('.of-co-conditions').waitFor({ timeout: 20000 })
      const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      ok(`${loc} ${w} px: conditions shown, no horizontal overflow`, o <= 0, String(o))
      await p.close()
    }
    ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
    console.log(`${n} checkout rules checks passed`)
  } finally { await browser.close() }
})().catch(e => { console.error(e); process.exit(1) })
