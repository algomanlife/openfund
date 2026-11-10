import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8')
const terminal = read('../public/legacy/terminal.js')
const locales = (() => { const ctx = { window: {} }; ctx.global = ctx.window; vm.runInNewContext(read('../public/legacy/terminal-locales.js').replace(/\}\)\(window\);?\s*$/, '})(window);'), { window: ctx.window }); return ctx.window.OpenfundTerminalLocales })()
const quickSection = terminal.slice(terminal.lastIndexOf('/*', terminal.indexOf('QUICK TRADE (Chart tab)')), terminal.lastIndexOf('/*', terminal.indexOf('VELA POSITION OVERLAYS')))
const keys = [...terminal.matchAll(/'(qt\.[A-Za-z]+)'/g)].map(m => m[1]).filter((k, i, a) => a.indexOf(k) === i)

test('Chart tab sits next to Trading and shares the Trading workspace element', () => {
  const model = read('../src/features/terminal/model.ts')
  assert.match(model, /\["trade", "ترمینال پراپ", "Prop Terminal"\],\s*\["chart", "چارت", "Chart"\]/)
  assert.match(model, /\["trade", "ترمینال پرپچوال", "Perpetual Terminal"\],\s*\["chart", "چارت", "Chart"\]/)
  const main = read('../src/main.tsx')
  assert.match(main, /path: 'trade', element: <SharedTradingTerminal \/>/)
  assert.match(main, /path: 'chart', element: <SharedTradingTerminal \/>/)
  const shell = read('../src/features/terminal/TerminalShell.tsx')
  assert.match(shell, /\["dashboard", "trade", "chart", "portfolio"\]/)
  assert.match(shell, /page !== "trade" && page !== "chart" && <Editorial/)
})

test('layout switches by message into the same iframe document, never by rebuilding it', () => {
  const pages = read('../src/features/terminal/TradingPages.tsx')
  assert.match(pages, /type: "openfund-layout"/)
  assert.doesNotMatch(pages.slice(pages.indexOf('const source = useMemo')), /\[cms, product, layout\]/)
  assert.match(read('../public/legacy/react-boot.js'), /openfund-layout/)
  const css = read('../src/features/terminal/workspace.css')
  for (const panel of ['.book-panel', '.trade-panel', '.bottom-panel']) assert.ok(css.includes(`body[data-layout="chart"] ${panel}`))
})

test('Quick Trade uses only the existing account adapter pipeline', () => {
  assert.match(quickSection, /tp\.validate\(/)
  assert.match(quickSection, /previewAsync/)
  assert.match(quickSection, /submitAsync/)
  assert.doesNotMatch(quickSection, /fetch\(|WebSocket|XMLHttpRequest|new TradingProvider|EventSource/)
  assert.doesNotMatch(quickSection.replace(/\/\*[\s\S]*?\*\//g, ''), /\b(bid|ask)\b/i, 'no invented bid/ask prices')
  assert.match(quickSection, /qtMaxLev\(\)/)
  assert.match(quickSection, /Number\(m\.maxLeverage\)/, 'leverage limit comes from the market metadata')
  assert.match(quickSection, /if \(QT\.busy\) return/, 'duplicate-submission guard')
  assert.match(quickSection, /marketClosed\(\)/)
})

test('Quick Trade strings exist in all five interface locales', () => {
  assert.ok(keys.length >= 12)
  const fa = terminal.slice(terminal.indexOf('  fa: {'), terminal.indexOf('const EN = {'))
  const en = terminal.slice(terminal.indexOf('const EN = {'), terminal.indexOf('Object.assign(I18N.en, EN)'))
  for (const key of keys) {
    assert.ok(fa.includes(`"${key}"`), `fa ${key}`)
    assert.ok(en.includes(`"${key}"`), `en ${key}`)
    for (const locale of ['ar', 'ru', 'zh-CN']) assert.ok(locales[locale][key], `${locale} ${key}`)
  }
})
