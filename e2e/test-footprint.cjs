/* Footprint chart acceptance (guest terminal; live Gains chart + live Hyperliquid
 * order flow through the local footprint service).
 *
 * Covers: style-menu entry, all five display modes painting real rows, overlay
 * mode, both modes sharing ONE stream, return to candlesticks (layer blank, stream
 * released), Gains bars identical with footprint on/off, unsupported market,
 * footprint-service outage (chart keeps working), RTL (bid column stays LEFT),
 * mobile layout, frame timing while panning (footprint vs candles), and the
 * feature flag OFF path (no footprint request, no menu entry).
 *
 * Usage (server with FOOTPRINT_ENABLED=1 unless FOOTPRINT_EXPECT_OFF=1):
 *   TEST_FRONTEND_URL=http://localhost:8181 node e2e/test-footprint.cjs
 * Screenshots: output/playwright/footprint/ */
const { chromium } = require('playwright')
const fs = require('node:fs'), path = require('node:path')
const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const EXPECT_OFF = process.env.FOOTPRINT_EXPECT_OFF === '1'
const OUT = path.resolve(__dirname, '../output/playwright/footprint' + (EXPECT_OFF ? '-off' : ''))
fs.mkdirSync(OUT, { recursive: true })
const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS - ' : 'FAIL - ') + name + (ok || !detail ? '' : ' :: ' + String(detail).slice(0, 500))) }
const wait = ms => new Promise(r => setTimeout(r, ms))

async function open(page, locale = 'en') {
  await page.goto(`${BASE}/${locale}/prop/trade`)
  /* chart ready = the price pane holds bars (read through the footprint layer's own args
     when installed; Vela has no public bar accessor) or, flag off, the chart exists */
  await page.waitForFunction(() => { const w = document.querySelector('iframe.of-trading-workspace')?.contentWindow; const d = w?.VelaWorkspace?.footprintDiagnostics?.(); return d && d.installed ? (d.paints.type?.barsRef?.length || 0) > 20 : !!w?.OpenfundTerminalInspect?.chart()?.renderer }, null, { timeout: 45000 })
  const handle = await page.$('iframe.of-trading-workspace')
  return handle.contentFrame()
}
const ev = (f, fn, arg) => f.evaluate(fn, arg)
const diag = f => ev(f, () => window.VelaWorkspace.footprintDiagnostics?.() && JSON.parse(JSON.stringify(window.VelaWorkspace.footprintDiagnostics(), (k, v) => (k === 'canvas' || k === 'barsRef' ? undefined : v))))
const setStyle = (f, s) => ev(f, s => window.OpenfundTerminalInspect.controller().workspace.active.setPriceStyle(s), s)
const setFp = (f, values) => ev(f, v => window.OpenfundTerminalInspect.chart().renderer.applyConfig({ chartTypes: { footprint: v } }), values)
const bars = f => ev(f, () => (window.VelaWorkspace.footprintDiagnostics().paints.type?.barsRef || []).map(b => [b.time, b.open, b.high, b.low, b.close]))
/* the renderer's intro animation interpolates the painted bars after a load: a
   comparison snapshot is taken only once two reads 1.5 s apart agree on closed bars */
async function settledBars(f) {
  let prev = await bars(f)
  for (let i = 0; i < 20; i++) {
    await wait(1500)
    const cur = await bars(f)
    if (cur.length === prev.length && cur.slice(0, -2).every((x, k) => x.join() === prev[k].join())) return cur
    prev = cur
  }
  return prev
}
/* zoom so ~n bars fill the plot (Vela: setVisibleRange in ms) */
const zoomBars = (f, n) => ev(f, n => { const c = window.OpenfundTerminalInspect.chart(); const b = window.VelaWorkspace.footprintDiagnostics().paints.type.barsRef; const last = b[b.length - 1].time, step = b[b.length - 1].time - b[b.length - 2].time; c.setVisibleRange({ from: last - n * step, to: last + 2 * step }) }, n)
async function waitPaint(f, kind, pred = d => d && d.bars > 0, ms = 45000) {
  const end = Date.now() + ms
  let d
  while (Date.now() < end) { d = (await diag(f))?.paints?.[kind]; if (pred(d)) return d; await wait(400) }
  return d
}

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const pageErrors = []
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.route('http://localhost:8055/**', r => r.abort())
    const fpRequests = []
    const page = await ctx.newPage()
    page.on('pageerror', e => pageErrors.push(e.message))
    page.on('request', r => { if (r.url().includes('/api/footprint/')) fpRequests.push(r.url()) })
    let f = await open(page)

    if (EXPECT_OFF) {
      await wait(3000)
      const off = await ev(f, () => ({ installed: typeof window.VelaWorkspace.footprintDiagnostics === 'function' ? window.VelaWorkspace.footprintDiagnostics().installed : false }))
      check('flag off: plugin not installed', off.installed === false, JSON.stringify(off))
      check('flag off: no footprint request at all', fpRequests.length === 0, fpRequests.join(' '))
      await f.locator('.vela-widget-style, [data-topbar="style"], .vela-tb-style').first().click().catch(() => {})
      await wait(400)
      check('flag off: style menu has no Footprint entry', (await f.locator('text=Footprint').count()) === 0)
      check('flag off: no page errors', pageErrors.length === 0, pageErrors.join(' | '))
      return
    }

    /* ---------- baseline Gains bars (candles) ---------- */
    const before = await settledBars(f)
    check('plugin installed and registered', (await diag(f))?.installed === true)
    check('no footprint stream while candlesticks are shown', (await diag(f)).streams.length === 0, JSON.stringify(await diag(f)))

    /* ---------- Mode A ---------- */
    await setStyle(f, 'footprint')
    let p = await waitPaint(f, 'type')
    check('chart style Footprint paints real rows from the service', p && p.bars > 0 && ['ok', 'warn', 'calibrating'].includes(p.state), JSON.stringify(p))
    check('one stream for the symbol', JSON.stringify((await diag(f)).streams) === '["BTC/USD"]', JSON.stringify(await diag(f)))
    await zoomBars(f, 7)   /* wide bars: cell numbers legible, as in the Vela reference */
    await wait(1200)
    for (const mode of ['bidAskLadder', 'bidAskProfile', 'volumeProfile', 'deltaProfile', 'absoluteDelta']) {
      await setFp(f, { f1Mode: mode })
      await wait(900)
      const d = (await diag(f)).paints.type
      check(`mode ${mode} paints`, d && d.bars > 0, JSON.stringify(d))
      await page.screenshot({ path: `${OUT}/style-${mode}-1440.png` })
    }
    await setFp(f, { f1Mode: 'bidAskLadder', f2Enabled: true, f2Mode: 'deltaProfile', f2Position: 'left', statCvd: true, nakedPoc: true })
    await wait(900)
    await page.screenshot({ path: `${OUT}/style-multi-instance-1440.png` })
    await setFp(f, { f2Enabled: false, statCvd: false, nakedPoc: false })

    /* ladder columns: bid (sell color) LEFT, ask (buy color) RIGHT — read from the real pixels */
    const columnOrder = (frame) => frame.evaluate(() => {
      const d = window.VelaWorkspace.footprintDiagnostics().paints.type
      const c = d && d.canvas, smp = d && d.sample
      if (!c || !smp) return null
      const g = c.getContext('2d'), k = c.width / c.clientWidth
      const px = x => Array.from(g.getImageData(Math.round(x * k), Math.round(smp.cy * k), 1, 1).data)
      const bid = px(smp.bidCx), ask = px(smp.askCx)
      return { bid, ask, bidIsSell: bid[0] > bid[1], askIsBuy: ask[1] > ask[0] }
    })
    await setFp(f, { f1Mode: 'bidAskLadder', f1Position: 'within' }); await wait(900)
    const lo = await columnOrder(f)
    check('LTR ladder: sell (bid) column left, buy (ask) column right on screen', lo && lo.bidIsSell && lo.askIsBuy, JSON.stringify(lo))

    /* ---------- Gains integrity ---------- */
    const during = await settledBars(f)
    /* compare CLOSED bars by open time (the window slides as new minutes form) */
    const cmp = (a, b) => {
      const m = new Map(a.slice(0, -2).map(x => [x[0], x.join()]))
      let common = 0; const diff = []
      for (const x of b.slice(0, -2)) { const y = m.get(x[0]); if (y == null) continue; common++; if (y !== x.join()) diff.push([y, x.join()]) }
      return { common, diff }
    }
    const ohlc = cmp(before, during)
    check('Gains OHLC bars unchanged while Footprint is active', ohlc.common > 100 && ohlc.diff.length === 0, JSON.stringify({ common: ohlc.common, diff: ohlc.diff.slice(0, 3) }))

    /* ---------- Mode B: overlay together with Mode A → still one stream ---------- */
    await ev(f, () => { window.__fpOverlay = window.OpenfundTerminalInspect.chart().addNativeIndicator('footprint-overlay') })
    await wait(1500)
    check('style + overlay together share ONE stream', JSON.stringify((await diag(f)).streams) === '["BTC/USD"]', JSON.stringify(await diag(f)))

    /* ---------- back to candles ---------- */
    await setStyle(f, 'candles')
    await wait(1200)
    let d = await diag(f)
    check('back to candlesticks: chart-type layer blank', !d.paints.type || !d.paints.type.bars, JSON.stringify(d.paints.type))
    const o = await waitPaint(f, 'overlay')
    check('overlay on candlesticks paints footprint beside Gains candles', o && o.bars > 0, JSON.stringify(o))
    await page.screenshot({ path: `${OUT}/overlay-on-candles-1440.png` })
    await ev(f, () => window.__fpOverlay.remove())
    await wait(1200)
    d = await diag(f)
    check('overlay removed + candles: stream released', d.streams.length === 0, JSON.stringify(d))

    /* ---------- timeframe + symbol switching ---------- */
    await setStyle(f, 'footprint')
    await ev(f, () => window.OpenfundTerminalInspect.controller().setTimeframe('5'))
    await wait(2500); await zoomBars(f, 12)
    p = await waitPaint(f, 'type')
    check('timeframe switch (5m) rebuilds the footprint', p && p.bars > 0, JSON.stringify(p))
    await ev(f, () => window.OpenfundTerminalInspect.controller().setSymbol('ETH/USD'))
    await page.waitForFunction(() => document.querySelector('iframe.of-trading-workspace').contentWindow.OpenfundTerminalInspect.symbol() === 'ETH/USD', null, { timeout: 20000 })
    p = await waitPaint(f, 'type', x => x && x.bars > 0)
    d = await diag(f)
    check('symbol switch: ETH/USD footprint, previous stream closed', p && p.bars > 0 && JSON.stringify(d.streams) === '["ETH/USD"]', JSON.stringify({ p, streams: d.streams }))
    await ev(f, () => window.OpenfundTerminalInspect.controller().setSymbol('XAU/USD'))
    /* Gains closes metals during the daily break while Hyperliquid HIP-3 trades on: the
       footprint only paints on bars Gains actually has, so "ok" with nothing visible is
       correct then. Painted bars are required only while Gains reports the market open. */
    const xauOpen = await fetch('https://api.gains.trade/v1/arbitrum/markets').then(r => r.json()).then(j => j.data.find(m => m.symbol === 'XAU/USD')?.isOpen).catch(() => null)
    p = await waitPaint(f, 'type', x => x && (x.bars > 0 || ['unsupported', 'hide'].includes(x.state) || (xauOpen === false && ['ok', 'warn', 'calibrating'].includes(x.state))))
    check(`XAU/USD (xyz:GOLD) footprint resolves to a verified state (Gains market open: ${xauOpen})`, p && (p.bars > 0 || ['unsupported', 'hide'].includes(p.state) || (xauOpen === false && ['ok', 'warn', 'calibrating'].includes(p.state))), JSON.stringify(p))
    await page.screenshot({ path: `${OUT}/style-xau-1440.png` })
    await ev(f, () => window.OpenfundTerminalInspect.controller().setSymbol('DOGE/USD'))
    p = await waitPaint(f, 'type', x => x && x.state === 'unsupported')
    const dogeBars = await bars(f)
    check('unmapped market (DOGE/USD): unsupported, Gains candles still load', p && p.state === 'unsupported' && dogeBars.length > 10, JSON.stringify(p))
    await ev(f, () => window.OpenfundTerminalInspect.controller().setSymbol('BTC/USD'))
    await ev(f, () => window.OpenfundTerminalInspect.controller().setTimeframe('1'))
    await waitPaint(f, 'type')

    /* ---------- frame timing: pan with footprint vs candles ---------- */
    const panTiming = () => ev(f, async () => {
      const c = window.OpenfundTerminalInspect.chart()
      const times = []
      let last = performance.now()
      await new Promise(res => {
        let n = 0
        const step = () => { const t = performance.now(); times.push(t - last); last = t; c.panBy?.(n % 40 < 20 ? 0.01 : -0.01); if (++n < 120) requestAnimationFrame(step); else res() }
        requestAnimationFrame(step)
      })
      times.shift()
      const s = [...times].sort((a, b) => a - b)
      return { frames: times.length, p50: +s[Math.floor(s.length * 0.5)].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), over33ms: times.filter(x => x > 33.4).length }
    })
    const fpTiming = await panTiming()
    await setStyle(f, 'candles'); await wait(800)
    const candleTiming = await panTiming()
    check('frame timing recorded (footprint vs candles, headless)', true, '')
    console.log('TIMING footprint', JSON.stringify(fpTiming), 'candles', JSON.stringify(candleTiming))
    fs.writeFileSync(`${OUT}/timing.json`, JSON.stringify({ footprint: fpTiming, candles: candleTiming }, null, 2))

    /* ---------- service outage: chart keeps working ---------- */
    await page.route('**/api/footprint/**', r => r.abort())
    const p2 = await ctx.newPage()
    p2.on('pageerror', e => pageErrors.push('outage: ' + e.message))
    await p2.route('**/api/footprint/**', r => r.abort())
    const f2 = await open(p2)
    await setStyle(f2, 'footprint')
    const out = await (async () => { const end = Date.now() + 20000; let x; while (Date.now() < end) { x = (await f2.evaluate(() => JSON.parse(JSON.stringify(window.VelaWorkspace.footprintDiagnostics().paints.type || null, (k, v) => (k === 'canvas' ? undefined : v))))); if (x && x.state === 'error') return x; await wait(400) } return x })()
    const outBars = (await bars(f2)).length
    check('footprint service down: footprint reports error, Gains chart keeps its bars', out && out.state === 'error' && outBars > 20, JSON.stringify({ out, outBars }))
    await settledBars(f2)   /* after the intro animation: the candles must be fully painted */
    await p2.screenshot({ path: `${OUT}/outage-1440.png` })
    await p2.close()
    await page.unroute('**/api/footprint/**')

    /* ---------- RTL (fa) + mobile ---------- */
    const fa = await ctx.newPage()
    fa.on('pageerror', e => pageErrors.push('fa: ' + e.message))
    const ff = await open(fa, 'fa')
    await setStyle(ff, 'footprint')
    await zoomBars(ff, 14)
    const pf = await (async () => { const end = Date.now() + 30000; let x; while (Date.now() < end) { x = await ff.evaluate(() => { const d = window.VelaWorkspace.footprintDiagnostics().paints.type; return d ? { bars: d.bars, state: d.state } : null }); if (x && x.bars > 0) return x; await wait(400) } return x })()
    check('fa (RTL) locale: footprint paints', pf && pf.bars > 0, JSON.stringify(pf))
    const dir = await ff.evaluate(() => document.documentElement.dir)
    check('fa document is RTL', dir === 'rtl')
    await ff.evaluate(() => window.OpenfundTerminalInspect.chart().renderer.applyConfig({ chartTypes: { footprint: { f1Mode: 'bidAskLadder', f1Position: 'within' } } }))
    await wait(900)
    const ro = await columnOrder(ff)
    check('RTL ladder: bid column still LEFT, ask RIGHT (coordinates not mirrored)', ro && ro.bidIsSell && ro.askIsBuy, JSON.stringify(ro))
    await fa.screenshot({ path: `${OUT}/style-fa-rtl-1440.png` })
    await fa.close()

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    await mobile.route('http://localhost:8055/**', r => r.abort())
    const mp = await mobile.newPage()
    mp.on('pageerror', e => pageErrors.push('mobile: ' + e.message))
    const mf = await open(mp)
    await setStyle(mf, 'footprint')
    await wait(5000)
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    check('mobile 390px: no horizontal overflow with Footprint', !overflow)
    await mp.screenshot({ path: `${OUT}/style-mobile-390.png` })
    await mobile.close()

    check('no page errors', pageErrors.length === 0, pageErrors.join(' | '))
  } catch (e) {
    check('test run completed', false, e.stack)
  } finally {
    await browser.close()
    const failed = results.filter(r => !r.ok)
    console.log(`\n${results.length - failed.length}/${results.length} passed`)
    fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2))
    process.exit(failed.length ? 1 : 0)
  }
})()
