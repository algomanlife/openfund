/* Terminal risk UI — pure helpers loaded exactly as the terminal loads them
   (plain browser scripts evaluated against a window object):
   - legacy/numeric-input.js: price fields accept English, Persian and
     Arabic-Indic digits without changing the decimal text;
   - legacy/position-overlay.js: the live risk/reward overlay model for
     LONG/SHORT with SL only, TP only, both or neither;
   - the shared header-control geometry contract in styles/header-controls.css. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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
