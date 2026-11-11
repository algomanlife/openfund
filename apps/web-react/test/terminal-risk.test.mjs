/* Terminal risk UI — pure helpers loaded exactly as the terminal loads them
   (plain browser scripts evaluated against a window object):
   - legacy/numeric-input.js: price fields accept English, Persian and
     Arabic-Indic digits without changing the decimal text;
   - the shared header-control geometry contract in styles/header-controls.css. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const load = (file, name) => { const w = {}; new Function('window', 'globalThis', readFileSync(new URL(file, import.meta.url), 'utf8'))(w, w); return w[name] }
const NI = load('../public/legacy/numeric-input.js', 'OpenfundNumericInput')

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

test('header controls share one height, radius and border; the theme switch is a real box', () => {
  const css = readFileSync(new URL('../src/styles/header-controls.css', import.meta.url), 'utf8')
  assert.match(css, /\.nav-cta, \.rk-chip, \.of-language-select, \.of-mobile-menu\s*\)\s*\{[^}]*height: var\(--hc-h\)[^}]*border-radius: var\(--hc-r\)/)
  const theme = css.match(/\.of-daynight \{([^}]*)\}/)[1]
  assert.match(theme, /height: var\(--hc-h\) !important/)
  assert.match(theme, /border: 1px solid var\(--hc-line\) !important; border-radius: var\(--hc-r\)/)
  assert.doesNotMatch(theme, /outline-offset/, 'the old outline ring is gone')
})
