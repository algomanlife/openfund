/* Iran regional runtime in a browser with NO international network (ADR 0033).
 *
 * Every request to a host other than the runtime under test is aborted, as
 * during an international outage. The website, FA/RTL and EN pages, the
 * terminal shell and the regional status must still load from the Iran
 * runtime alone. Blocked foreign hosts are recorded, so a page that needs one
 * for essential content is visible in the report.
 *
 * With EXPECT_CONTENT=1 the CMS failure state must not appear: essential
 * content comes from the runtime's same-origin /cms path (live, or its
 * last-known-good snapshot while the CMS is unreachable).
 *
 * Usage: TEST_FRONTEND_URL=http://127.0.0.1:18591 [EXPECT_CONTENT=1] node e2e/test-iran-isolation.cjs */
const { chromium } = require('playwright')
const fs = require('node:fs')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://127.0.0.1:8080').replace(/\/$/, '')
const OUT = 'output/playwright/iran-isolation'
const EXPECT_CONTENT = process.env.EXPECT_CONTENT === '1'
const CMS_FAILURE = /محتوای این بخش در دسترس نیست|This section’s content is unavailable|اتصال به سامانهٔ مدیریت محتوا برقرار نشد/
const pages = ['/fa/home', '/en/home', '/fa/challenges', '/en/faq', '/en/markets', '/fa/prop/trade', '/en/prop/dashboard']
const results = []
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' — ' + detail : ''}`) }

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const local = new URL(BASE).host
  const blocked = new Map()
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url())
    if (u.host === local || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue()
    blocked.set(u.host, (blocked.get(u.host) || 0) + 1)
    return route.abort('internetdisconnected')
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)))
  const status = await (await page.request.get(BASE + '/runtime/status')).json()
  ok('regional status served locally', status.region === 'IRAN', `mode ${status.mode}`)
  for (const p of pages) {
    const res = await page.goto(BASE + p, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    const text = (await page.locator('body').innerText()).trim()
    const dir = await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction)
    ok(`${p} loads without international network`, res.status() === 200 && text.length > 200, `${text.length} chars, status ${res.status()}`)
    if (p.startsWith('/fa/')) ok(`${p} is right-to-left`, dir === 'rtl', dir)
    if (EXPECT_CONTENT && /\/home$/.test(p)) ok(`${p} shows CMS content, not the failure state`, !CMS_FAILURE.test(text), text.slice(0, 80).replace(/\s+/g, ' '))
    if (/\/home$/.test(p)) {
      const links = await page.locator('.iran-access-domains a').evaluateAll(as => as.map(a => a.href))
      ok(`${p} notice links the three Iran addresses once`, (await page.locator('.iran-access-notice').count()) === 1 && links.join() === 'https://iran.openfund.cloud/,https://iran.openfi.cloud/,https://openfi.live/', links.join(' '))
    }
    if (p === '/fa/home') ok('notice states the Iran runtime (region IRAN)', (await page.locator('.iran-access-notice[data-region="IRAN"]').count()) === 1)
    await page.screenshot({ path: `${OUT}/${p.replaceAll('/', '_')}.png` })
  }
  ok('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
  const hosts = [...blocked.entries()].map(([h, n]) => `${h}×${n}`)
  console.log('blocked foreign hosts (informational):', hosts.join(', ') || 'none')
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify({ base: BASE, results, blockedForeignHosts: Object.fromEntries(blocked) }, null, 2))
  await browser.close()
  const failed = results.filter(r => !r.pass).length
  console.log(`iran isolation: ${results.length - failed}/${results.length} checks passed`)
  process.exit(failed ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
