/**
 * Real-browser chart rendering probe (Playwright / Chromium).
 * A small number of real signed-in terminals measure what virtual users
 * cannot: page-load timing, chart readiness, frame rate under live
 * streaming + interaction, long tasks and JS heap. Run it while k6/SSE
 * hold the backend at a given stage to see whether backend load degrades
 * the browser experience. Never 1,500 browsers: rendering cost is per
 * client device, not per server.
 *
 * Gains (candles + live WS prices) is answered by the synthetic server via
 * browser/isolate.mjs. Uses already-seeded synthetic users.
 * Usage: node chart-render.mjs <users.json> <out.json> [browsers=4] [seconds=60] [userOffset=1400]
 */
import fs from 'node:fs'
import { chromium } from 'playwright'
import { isolate } from './isolate.mjs'

const TARGET = process.env.TARGET || 'http://127.0.0.1:18080'
const [USERS, OUT, NB = '4', SECS = '60', OFF = '1400'] = process.argv.slice(2)
const users = JSON.parse(fs.readFileSync(USERS, 'utf8'))
const SYMS = ['BTC/USD', 'ETH/USD', 'LT/USD', 'EUR/USD']
const TFS = ['1', '5', '15', '60', '240']
const browser = await chromium.launch({ args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] })

async function one(k) {
  const u = users[(Number(OFF) + k) % users.length]
  const blocked = []
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { 'x-forwarded-for': u.xff } })
  await isolate(ctx, TARGET, blocked)
  const [name, value] = u.cookie.split('=')
  await ctx.addCookies([{ name, value, url: TARGET }])
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page); await cdp.send('Performance.enable')
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  const t0 = Date.now()
  await page.goto(`${TARGET}/en/prop/trade`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd } })
  const fw = async (fn, arg) => (await (await page.$('iframe.of-trading-workspace')).contentFrame()).evaluate(fn, arg)
  let chartReadyMs = null, restoredMs = null
  try {
    await page.waitForFunction(() => document.querySelector('iframe.of-trading-workspace')?.contentWindow?.OpenfundTerminalInspect?.chart?.(), null, { timeout: 60000 })
    chartReadyMs = Date.now() - t0
    await page.waitForFunction(() => document.querySelector('iframe.of-trading-workspace').contentWindow.OpenfundTerminalInspect.restored(), null, { timeout: 30000 })
    restoredMs = Date.now() - t0
  } catch (e) { errors.push('chart not ready: ' + e.message.split('\n')[0]) }
  if (!chartReadyMs) { await ctx.close(); return { user: u.i, nav, chartReadyMs, restoredMs, errors, blocked: [...new Set(blocked)] } }
  /* frame + long-task counters inside the terminal document */
  await fw(() => {
    window.__cap = { frames: 0, long: 0, longMs: 0 }
    const tick = () => { window.__cap.frames++; requestAnimationFrame(tick) }; requestAnimationFrame(tick)
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__cap.long++; window.__cap.longMs += e.duration } }).observe({ type: 'longtask', buffered: false }) } catch {}
  })
  const box = await (await page.$('iframe.of-trading-workspace')).boundingBox()
  const samples = [], end = Date.now() + Number(SECS) * 1000
  let i = 0, last = await fw(() => ({ ...window.__cap })), lastT = Date.now()
  while (Date.now() < end) {
    /* 5 s of crosshair movement + a zoom, then a symbol or timeframe change */
    for (let s = 0; s < 25; s++) { await page.mouse.move(box.x + box.width * (0.2 + 0.5 * Math.random()), box.y + box.height * (0.25 + 0.4 * Math.random())); await page.waitForTimeout(200) }
    await page.mouse.wheel(0, i % 2 ? 240 : -240)
    if (i % 2 === 0) await fw(s => window.OpenfundTerminalInspect.controller().setSymbol(s), SYMS[i / 2 % SYMS.length]).catch(e => errors.push('setSymbol ' + e.message))
    else await fw(tf => window.__openfundChart?.setTimeframe?.(tf), TFS[i % TFS.length]).catch(e => errors.push('setTimeframe ' + e.message))
    i++
    const cur = await fw(() => ({ ...window.__cap, overlays: window.OpenfundTerminalInspect.positionOverlays().length }))
    const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]))
    const now = Date.now()
    samples.push({ t: now, fps: +((cur.frames - last.frames) / ((now - lastT) / 1000)).toFixed(1), longTasks: cur.long - last.long, longMs: Math.round(cur.longMs - last.longMs),
      heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), nodes: m.Nodes, overlays: cur.overlays })
    last = cur; lastT = now
  }
  await ctx.close()
  const fps = samples.map(s => s.fps).sort((a, b) => a - b)
  return { user: u.i, nav, chartReadyMs, restoredMs, fpsMedian: fps[Math.floor(fps.length / 2)], fpsMin: fps[0], heapMBMax: Math.max(...samples.map(s => s.heapMB)),
    heapMBFirst: samples[0]?.heapMB, heapMBLast: samples.at(-1)?.heapMB, longTaskMs: samples.reduce((a, s) => a + s.longMs, 0), samples, errors: errors.slice(0, 10), blocked: [...new Set(blocked)] }
}
const res = await Promise.all(Array.from({ length: Number(NB) }, (_, k) => one(k)))
await browser.close()
fs.writeFileSync(OUT, JSON.stringify({ t: Date.now(), browsers: Number(NB), seconds: Number(SECS), results: res }, null, 1))
for (const r of res) console.log(`user ${r.user}: ttfb ${r.nav?.ttfb?.toFixed(0)}ms dcl ${r.nav?.dcl?.toFixed(0)}ms chart ${r.chartReadyMs}ms restored ${r.restoredMs}ms fps med ${r.fpsMedian} min ${r.fpsMin} heap ${r.heapMBFirst}→${r.heapMBLast}MB longTasks ${r.longTaskMs}ms errors ${r.errors?.length}`)
