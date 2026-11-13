/* Terminal risk UI — pure helpers loaded exactly as the terminal loads them
   (plain browser scripts evaluated against a window object):
   - legacy/numeric-input.js: price fields accept English, Persian and
     Arabic-Indic digits without changing the decimal text;
   - legacy/position-overlay.js: the live risk/reward overlay model for
     LONG/SHORT with SL only, TP only, both or neither;
   - the shared header-control geometry contract in styles/header-controls.css. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const load = (file, name) => { const w = {}; new Function('window', 'globalThis', readFileSync(new URL(file, import.meta.url), 'utf8'))(w, w); return w[name] }
const NI = load('../public/legacy/numeric-input.js', 'OpenfundNumericInput')
const PO = load('../public/legacy/position-overlay.js', 'OpenfundPositionOverlay')

test('price input: English, Persian and Arabic-Indic digits give the same exact decimal text', () => {
  for (const raw of ['3995', '۳۹۹۵', '٣٩٩٥', ' 3995 ', '‏۳۹۹۵‎']) assert.deepEqual(NI.parseDecimal(raw, { lang: 'fa' }), { ok: true, text: '3995', value: 3995 }, raw)
  for (const raw of ['3995.25', '۳۹۹۵٫۲۵', '٣٩٩٥٫٢٥', '۳۹۹۵.۲۵']) assert.equal(NI.parseDecimal(raw, { lang: 'fa' }).text, '3995.25', raw)
  /* digits are kept verbatim — no float round trip in the text */
  assert.equal(NI.parseDecimal('0.000012345678901234', { lang: 'en' }).text, '0.000012345678901234')
  assert.equal(NI.parseDecimal('۰٫۱', { lang: 'fa' }).text, '0.1')
  assert.equal(NI.parseDecimal('.5', { lang: 'en' }).text, '0.5')
})

test('price input: grouping marks only between integer digits; locale decimal comma for ru', () => {
  assert.equal(NI.parseDecimal('3,995.5', { lang: 'en' }).text, '3995.5')
  assert.equal(NI.parseDecimal('۳٬۹۹۵', { lang: 'fa' }).text, '3995')
  assert.equal(NI.parseDecimal('3 995,5', { lang: 'ru' }).text, '3995.5')
  assert.equal(NI.parseDecimal('3995,5', { lang: 'ru' }).text, '3995.5')
  assert.equal(NI.parseDecimal('', {}).empty, true)
  assert.equal(NI.parseDecimal('   ', {}).empty, true)
})

test('price input: unreadable text is rejected, never silently changed', () => {
  for (const raw of ['abc', '12a', '1.2.3', '۱٫۲٫۳', '-5', '+5', '1e5', ',5', '5,', '3,,995', '٫', 'Infinity', 'NaN', '$100'])
    assert.equal(NI.parseDecimal(raw, { lang: 'en' }).ok, false, raw)
  assert.equal(NI.parseDecimal('3995,5,1', { lang: 'ru' }).ok, false)
})

test('overlay LONG: loss zone below entry (to SL), profit zone above (to TP), R from both', () => {
  const m = PO.model({ id: 'p1', side: 'long', entry: 100, sl: 95, tp: 110 })
  assert.deepEqual(m.lossZone, { from: 95, to: 100 }); assert.deepEqual(m.profitZone, { from: 100, to: 110 })
  assert.equal(m.stopPct, 5); assert.equal(m.targetPct, 10); assert.equal(m.ratio, 2)
})

test('overlay SHORT: loss zone above entry (to SL), profit zone below (to TP)', () => {
  const m = PO.model({ id: 'p2', side: 'short', entry: 100, sl: 104, tp: 88 })
  assert.deepEqual(m.lossZone, { from: 100, to: 104 }); assert.deepEqual(m.profitZone, { from: 88, to: 100 })
  assert.equal(m.ratio, 3)
})

test('overlay one-sided and empty: no invented level and no fake ratio', () => {
  for (const side of ['long', 'short']) {
    const slOnly = PO.model({ id: 1, side, entry: 100, sl: side === 'long' ? 90 : 110, tp: null })
    assert.equal(slOnly.target, null); assert.equal(slOnly.profitZone, null); assert.equal(slOnly.ratio, null); assert.ok(slOnly.lossZone)
    const tpOnly = PO.model({ id: 2, side, entry: 100, sl: '', tp: side === 'long' ? 120 : 80 })
    assert.equal(tpOnly.stop, null); assert.equal(tpOnly.lossZone, null); assert.equal(tpOnly.ratio, null); assert.ok(tpOnly.profitZone)
    assert.equal(PO.model({ id: 3, side, entry: 100, sl: null, tp: null }), null)
    assert.equal(PO.model({ id: 4, side, entry: 100, sl: 0, tp: 0 }), null)
  }
  assert.equal(PO.model({ id: 5, side: 'long', entry: 0, sl: 1, tp: 2 }), null)
  /* SL exactly at entry: zero risk → no ratio */
  assert.equal(PO.model({ id: 6, side: 'long', entry: 100, sl: 100, tp: 120 }).ratio, null)
})

test('overlay keeps one model per position (no merging) and a size change does not move levels', () => {
  const a = PO.model({ id: 'a', side: 'long', entry: 100, sl: 95, tp: 110, size: 1 })
  const b = PO.model({ id: 'b', side: 'long', entry: 101, sl: 96, tp: 111, size: 3 })
  assert.notEqual(a.id, b.id); assert.notDeepEqual(a.lossZone, b.lossZone)
  assert.deepEqual(PO.model({ id: 'a', side: 'long', entry: 100, sl: 95, tp: 110, size: 9 }).lossZone, a.lossZone)
})

test('header controls share one height, radius and border; the theme switch is a real box', () => {
  const css = readFileSync(new URL('../src/styles/header-controls.css', import.meta.url), 'utf8')
  assert.match(css, /\.nav-cta, \.rk-chip, \.of-language-select, \.of-mobile-menu\s*\)\s*\{[^}]*height: var\(--hc-h\)[^}]*border-radius: var\(--hc-r\)/)
  const theme = css.match(/\.of-daynight \{([^}]*)\}/)[1]
  assert.match(theme, /height: var\(--hc-h\) !important/)
  assert.match(theme, /border: 1px solid var\(--hc-line\) !important; border-radius: var\(--hc-r\)/)
  assert.doesNotMatch(theme, /outline-offset/, 'the old outline ring is gone')
})

/* ---------- confirmed-fill BUY/SELL markers and entry-anchored zones ---------- */
const MIN = 60000, H = 60 * MIN, DAY = 24 * H
const T0 = Date.UTC(2026, 10, 12, 10, 7, 30)   /* 10:07:30 UTC */

test('markers: only confirmed fills of the chart market; partial closes count once', () => {
  const records = [
    { id: 'a', market: 'BTC/USD', side: 'long', entry: 100, openedAt: T0 },
    { id: 'a-part', rootId: 'a', market: 'BTC/USD', side: 'long', entry: 100, openedAt: T0 },   /* partial-close remainder */
    { id: 'b', market: 'ETH/USD', side: 'short', entry: 5, openedAt: T0 },                       /* other symbol */
    { id: 'c', market: 'BTC/USD', side: 'short', entry: 0, openedAt: T0 },                       /* no fill price */
    { id: 'd', market: 'BTC/USD', side: 'short', entry: 101, openedAt: null },                   /* no fill time */
  ]
  const fills = PO.executionFills(records, 'BTC/USD')
  assert.deepEqual(fills, [{ id: 'a', side: 'long', time: T0, price: 100 }])
  assert.deepEqual(PO.executionFills([], 'BTC/USD'), [])
})

test('markers: long = BUY below the candle, short = SELL above it', () => {
  const fills = [{ id: '1', side: 'long', time: T0, price: 100 }, { id: '2', side: 'short', time: T0 + 10000, price: 102 }]
  const g = PO.executionGroups(fills, MIN)
  const buy = g.get(Date.UTC(2026, 10, 12, 10, 7) + '|long'), sell = g.get(Date.UTC(2026, 10, 12, 10, 7) + '|short')
  assert.equal(buy.label, 'BUY'); assert.equal(buy.placement, 'below')
  assert.equal(sell.label, 'SELL'); assert.equal(sell.placement, 'above')
  assert.equal(PO.markerPrice(buy, { high: 105, low: 95 }), 95)
  assert.equal(PO.markerPrice(sell, { high: 105, low: 95 }), 105)
  /* without candle data the fill price anchors the marker */
  assert.equal(PO.markerPrice(buy, null), 100)
  assert.equal(PO.markerPrice(sell, null), 102)
})

test('markers: the fill maps to the right candle on every timeframe', () => {
  const f = [{ id: '1', side: 'long', time: T0, price: 100 }]
  const at = (barMs) => [...PO.executionGroups(f, barMs).values()][0].bucket
  assert.equal(at(MIN), Date.UTC(2026, 10, 12, 10, 7))
  assert.equal(at(5 * MIN), Date.UTC(2026, 10, 12, 10, 5))
  assert.equal(at(15 * MIN), Date.UTC(2026, 10, 12, 10, 0))
  assert.equal(at(H), Date.UTC(2026, 10, 12, 10, 0))
  assert.equal(at(4 * H), Date.UTC(2026, 10, 12, 8, 0))
  assert.equal(at(DAY), Date.UTC(2026, 10, 12))
  /* a fill exactly on a boundary belongs to the candle that opens there */
  assert.equal(PO.bucket(Date.UTC(2026, 10, 12, 11, 0), H), Date.UTC(2026, 10, 12, 11, 0))
  assert.equal(PO.bucket(Date.UTC(2026, 10, 12, 11, 0) - 1, H), Date.UTC(2026, 10, 12, 10, 0))
})

test('markers: several fills in one candle group with a count, separate candles stay separate', () => {
  const fills = [
    { id: '1', side: 'long', time: T0, price: 100 },
    { id: '2', side: 'long', time: T0 + 20000, price: 100.5 },
    { id: '3', side: 'long', time: T0 + 5 * MIN, price: 101 },
  ]
  const m1 = PO.executionGroups(fills, MIN)
  assert.equal(m1.size, 2)
  const first = m1.get(Date.UTC(2026, 10, 12, 10, 7) + '|long')
  assert.equal(first.label, 'BUY ×2')
  assert.deepEqual(first.fills.map(x => x.id), ['1', '2'])        /* individual fills kept */
  const m15 = PO.executionGroups(fills, 15 * MIN)
  assert.equal(m15.size, 1)
  assert.equal([...m15.values()][0].label, 'BUY ×3')
})

test('zones: start at the entry candle and extend past the latest candle', () => {
  const now = T0 + 3 * H
  assert.deepEqual(PO.span(T0, now, MIN, 12), { start: Date.UTC(2026, 10, 12, 10, 7), end: Date.UTC(2026, 10, 12, 13, 7) + 12 * MIN })
  assert.deepEqual(PO.span(T0, now, H, 12), { start: Date.UTC(2026, 10, 12, 10), end: Date.UTC(2026, 10, 12, 13) + 12 * H })
  /* a just-opened position still starts on its own candle */
  const fresh = PO.span(now, now, MIN, 12)
  assert.equal(fresh.start, PO.bucket(now, MIN))
  assert.ok(fresh.end > fresh.start)
})

test('SL/TP drag: only existing levels, each on its own side of the immutable entry', () => {
  const long = { side: 'long', entry: 100, sl: 95, tp: 110 }
  assert.deepEqual(PO.riskEdit(long, { sl: 96.123, tp: 112 }, 2), { sl: 96.12, tp: 112, changed: true })
  assert.deepEqual(PO.riskEdit(long, { sl: 95, tp: 110 }, 2), { sl: 95, tp: 110, changed: false })
  assert.equal(PO.riskEdit(long, { sl: 101, tp: 110 }, 2).error, 'sl_wrong_side')
  assert.equal(PO.riskEdit(long, { sl: 95, tp: 99 }, 2).error, 'tp_wrong_side')
  const short = { side: 'short', entry: 100, sl: 105, tp: 90 }
  assert.deepEqual(PO.riskEdit(short, { sl: 104, tp: 88 }, 2), { sl: 104, tp: 88, changed: true })
  assert.equal(PO.riskEdit(short, { sl: 99, tp: 90 }, 2).error, 'sl_wrong_side')
  assert.equal(PO.riskEdit(short, { sl: 105, tp: 101 }, 2).error, 'tp_wrong_side')
  /* a missing level is never invented, whatever the drawing reports */
  assert.deepEqual(PO.riskEdit({ side: 'long', entry: 100, sl: 95, tp: null }, { sl: 97, tp: 130 }, 2), { sl: 97, tp: null, changed: true })
  assert.deepEqual(PO.riskEdit({ side: 'short', entry: 100, sl: null, tp: 90 }, { sl: 140, tp: 91 }, 2), { sl: null, tp: 91, changed: true })
  assert.equal(PO.riskEdit({ side: 'long', entry: 0, sl: 1 }, { sl: 1 }, 2).error, 'no_entry')
})

test('information labels: price order kept, no overlap, kept inside the pane', () => {
  const h = 22, gap = 4
  const overlap = rows => rows.slice().sort((a, b) => a.top - b.top).some((r, i, a) => i && r.top < a[i - 1].top + h + gap)
  /* three positions with almost the same entry row */
  const out = PO.stackLabels([{ id: 'a', y: 200, h }, { id: 'b', y: 202, h }, { id: 'c', y: 205, h }], { top: 6, bottom: 500, gap })
  assert.equal(overlap(out), false)
  assert.deepEqual(out.map(r => r.id), ['a', 'b', 'c'])
  assert.ok(out[0].top < out[1].top && out[1].top < out[2].top)
  /* near the bottom edge the stack moves up instead of leaving the pane */
  const low = PO.stackLabels([{ id: 'a', y: 495, h }, { id: 'b', y: 498, h }], { top: 6, bottom: 500, gap })
  assert.ok(low.every(r => r.top >= 6 && r.top + h <= 500), JSON.stringify(low))
  assert.equal(overlap(low), false)
  /* entry off-screen (no row): labels are still placed, in order, without overlap */
  const none = PO.stackLabels([{ id: 'a', y: null, h }, { id: 'b', y: null, h }], { top: 6, bottom: 500, gap })
  assert.deepEqual(none.map(r => r.top), [6, 32])
})

test('markers: BUY ×2 / SELL ×2 aggregate per candle and side without merging opposite sides', () => {
  const bar = 60_000, t0 = 1_700_000_040_000
  const fills = [
    { id: '1', side: 'long', time: t0 + 1000, price: 100 }, { id: '2', side: 'long', time: t0 + 2000, price: 101 },
    { id: '3', side: 'short', time: t0 + 3000, price: 102 }, { id: '4', side: 'short', time: t0 + 4000, price: 103 },
  ]
  const g = PO.executionGroups(fills, bar)
  assert.deepEqual([...g.values()].map(x => [x.label, x.placement]).sort(), [['BUY ×2', 'below'], ['SELL ×2', 'above']])
  const range = { high: 105, low: 98 }
  for (const x of g.values()) assert.equal(PO.markerPrice(x, range), x.side === 'long' ? 98 : 105)
})

/* ---------- SL/TP created on the chart (drag from the entry line) ---------- */
test('SL/TP drag-to-create: a position without SL/TP gets an editable zero-height box, never invented zones', () => {
  assert.equal(PO.model({ id: 1, side: 'long', entry: 100 }), null)          /* read-only accounts: unchanged, no box */
  const m = PO.model({ id: 1, side: 'long', entry: 100 }, { allowEmpty: true })
  assert.deepEqual([m.entry, m.stop, m.target, m.lossZone, m.profitZone, m.ratio], [100, null, null, null, null, null])
})

test('SL/TP drag-to-create: all four states, LONG and SHORT, each level on its own side of the entry', () => {
  const create = { allowCreate: true }
  for (const side of ['long', 'short']) {
    const L = side === 'long', below = 95, above = 105
    const sl = L ? below : above, tp = L ? above : below
    /* 1. no SL/TP → create SL only, TP only, or both */
    assert.deepEqual(PO.riskEdit({ side, entry: 100 }, { sl, tp: 100 }, 2, create), { sl, tp: null, changed: true, created: true })
    assert.deepEqual(PO.riskEdit({ side, entry: 100 }, { sl: 100, tp }, 2, create), { sl: null, tp, changed: true, created: true })
    assert.deepEqual(PO.riskEdit({ side, entry: 100 }, { sl, tp }, 2, create), { sl, tp, changed: true, created: true })
    /* untouched: both still on the entry → nothing to submit */
    assert.deepEqual(PO.riskEdit({ side, entry: 100 }, { sl: 100, tp: 100 }, 2, create), { sl: null, tp: null, changed: false, created: false })
    /* 2. SL only → add TP / move SL */
    assert.deepEqual(PO.riskEdit({ side, entry: 100, sl }, { sl, tp }, 2, create), { sl, tp, changed: true, created: true })
    assert.deepEqual(PO.riskEdit({ side, entry: 100, sl }, { sl: L ? 96 : 104, tp: 100 }, 2, create), { sl: L ? 96 : 104, tp: null, changed: true, created: false })
    /* 3. TP only → add SL */
    assert.deepEqual(PO.riskEdit({ side, entry: 100, tp }, { sl, tp }, 2, create), { sl, tp, changed: true, created: true })
    /* 4. both → move both */
    assert.deepEqual(PO.riskEdit({ side, entry: 100, sl, tp }, { sl: L ? 94 : 106, tp: L ? 107 : 93 }, 2, create), { sl: L ? 94 : 106, tp: L ? 107 : 93, changed: true, created: false })
    /* invalid: a created level on the wrong side is refused (the drag is reverted) */
    assert.equal(PO.riskEdit({ side, entry: 100 }, { sl: tp, tp: 100 }, 2, create).error, 'sl_wrong_side')
    assert.equal(PO.riskEdit({ side, entry: 100 }, { sl: 100, tp: sl }, 2, create).error, 'tp_wrong_side')
  }
})

test('SL/TP drag-to-create: market price precision; a drag that rounds back onto the entry creates nothing', () => {
  const create = { allowCreate: true }
  assert.deepEqual(PO.riskEdit({ side: 'long', entry: 1.08345 }, { sl: 1.0812349, tp: 1.08345 }, 5, create), { sl: 1.08123, tp: null, changed: true, created: true })
  assert.deepEqual(PO.riskEdit({ side: 'long', entry: 100 }, { sl: 99.999, tp: 100 }, 2, create), { sl: null, tp: null, changed: false, created: false })
  /* without allowCreate the previous contract holds: a missing level is never created */
  assert.deepEqual(PO.riskEdit({ side: 'long', entry: 100 }, { sl: 95, tp: 110 }, 2), { sl: null, tp: null, changed: false })
})

test('SL/TP drag-to-create: the terminal makes both levels draggable only on tradable accounts and submits through the position API', () => {
  const term = readFileSync(new URL('../public/legacy/terminal.js', import.meta.url), 'utf8')
  const drawings = readFileSync(new URL('../../../packages/openfund-charts/src/openfund-drawings.ts', import.meta.url), 'utf8')
  assert.match(term, /positionOverlayModel\(p, \{ allowEmpty: !!window\.__ofServerTP\?\.canTrade \}\)/)
  assert.match(term, /const editable = window\.__ofServerTP\?\.canTrade \? \['stop', 'target'\] : \[\];/)
  assert.match(term, /ofMissing: missing/)
  assert.match(term, /riskEdit\(p, \{ sl: d\.anchors\[1\]\?\.price, tp: d\.anchors\[2\]\?\.price \}, precision, \{ allowCreate: true \}\)/)
  /* still the one existing position-update service, serialized per position */
  assert.match(term, /await srv\.modifyRisk\(posId, intent\.sl, intent\.tp\)/)
  assert.match(term, /positionRiskQueues\.get\(posId\)/)
  /* the drawing picks stop/target by drag direction and keeps an untouched missing level on the entry */
  assert.match(drawings, /private dragTarget\(index: number, price: number\): 1 \| 2/)
  assert.match(drawings, /if \(i !== target && this\.missing\(i\) && this\.editable\(i\) && entry != null && this\.anchors\[i\]\) this\.anchors\[i\]\.price = entry;/)
})

/* ---------- Vela chart UI: English only, LTR always ---------- */
test('Vela chart layer is English-only and LTR in every Openfund locale', () => {
  const term = readFileSync(new URL('../public/legacy/terminal.js', import.meta.url), 'utf8')
  const body = readFileSync(new URL('../src/pages/terminal-body.html', import.meta.url), 'utf8')
  const entry = readFileSync(new URL('../../../packages/openfund-charts/src/workspace-entry.ts', import.meta.url), 'utf8')
  const bridge = readFileSync(new URL('../../../packages/openfund-charts/src/vela-bridge.js', import.meta.url), 'utf8')
  const footprint = readFileSync(new URL('../../../packages/openfund-charts/src/footprint/plugin.ts', import.meta.url), 'utf8')
  const PERSIAN = /[؀-ۿ]/
  /* no Persian chart strings are registered with Vela and no other locale can be chosen */
  assert.doesNotMatch(entry, PERSIAN)
  assert.doesNotMatch(entry, /registerLocale\(/)
  assert.match(bridge, /locale: 'en',/)
  assert.match(bridge, /setLocale\(\)\{ try \{ return ws\.setLocale\('en'\); \}/)
  assert.match(term, /locale: CHART_LOCALE/)
  assert.match(term, /const CHART_LOCALE = 'en';/)
  assert.match(body, /id="chart-host" role="tabpanel" aria-labelledby="tab-chart" dir="ltr" lang="en"/)
  /* the static translator never rewrites Vela tooltips, menus or dialogs */
  assert.match(term, /if \(inChartLayer\(node\)\) continue;/)
  assert.match(term, /\|\| inChartLayer\(el\)\) continue;/)
  /* chart-layer strings resolve to English (CL) — Settings → Trading, executions, position labels, drag notices */
  const CL = (fa, en) => en
  for (const [fa, en] of [...term.matchAll(/CL\('([^']*)', '([^']*)'\)/g)].map(m => [m[1], m[2]])) {
    assert.ok(PERSIAN.test(fa) && !PERSIAN.test(CL(fa, en)) && en.length > 0, en)
  }
  for (const label of ["CL('معاملات', 'Trading')", "CL('نمایش روی نمودار', 'Display on Chart')",
    "CL('نمایش نشانگرهای خرید و فروش', 'Show Buy/Sell Markers')", "CL('نمایش اطلاعات موقعیت', 'Show Position Information')"]) assert.ok(term.includes(label), label)
  assert.doesNotMatch(term, /(?<![A-Za-z_])L\('(معاملات|نمایش روی نمودار|نمایش نشانگرهای خرید و فروش)'/)
  /* chart overlay messages use the English dictionary */
  assert.match(term, /chartOverlay\(`<b>\$\{ct\('chart\.loading'\)\}<\/b>`\)/)
  assert.match(footprint, /'Footprint \(Order Flow Overlay\)'/)
})

test('Vela bundle (built) carries no Persian chart strings', { skip: !existsSync(new URL('../public/assets/vela-workspace.global.min.js', import.meta.url)) }, () => {
  const bundle = readFileSync(new URL('../public/assets/vela-workspace.global.min.js', import.meta.url), 'utf8')
  for (const fa of ['فوت‌پرینت', 'لایه جریان سفارش', 'نمایش راهنمای اندیکاتورها', 'تنظیمات']) assert.ok(!bundle.includes(fa), fa)
  assert.ok(bundle.includes('Footprint (Order Flow Overlay)'))
})
