/* Regression coverage for the approved terminal and ticker copy (v0.6.5). */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { buildSync } from 'esbuild'

const load = entry => {
  const output = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text
  const module = { exports: {} }; new Function('module', 'exports', output)(module, module.exports)
  return module.exports
}
const PROHIBITED = 'انتری'
const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name)
  return statSync(path).isDirectory() ? walk(path) : ['.ts', '.tsx', '.js', '.mjs', '.html', '.json'].includes(extname(path)) ? [path] : []
})

test('no user-facing source or dictionary contains the prohibited Persian label', () => {
  const files = [...walk('src'), ...walk('public/legacy'), 'public/translations.json']
  const hits = files.filter(file => readFileSync(file, 'utf8').includes(PROHIBITED) && !file.endsWith('terminology.ts'))
  assert.deepEqual(hits, [])
})

test('CMS-published Persian text is normalised to the approved term', () => {
  const { normalizePersianTerms, normalizeDictionary } = load('src/i18n/terminology.ts')
  assert.equal(normalizePersianTerms('قیمت انتری'), 'قیمت نقطه ورود')
  const out = normalizeDictionary({ 'th.entry': { fa: 'انتری', en: 'Entry' }, other: 'x' })
  assert.deepEqual(out['th.entry'], { fa: 'نقطه ورود', en: 'Entry' })
  assert.equal(out.other, 'x')
  const { interfaceKey, installInterfaceContent, interfaceOverride } = load('src/i18n/interfaceContent.ts')
  installInterfaceContent([{ key: interfaceKey('ورود', 'Entry'), namespace: 'react', status: 'published', translations: [{ language_code: 'fa', value: 'انتری' }] }])
  assert.equal(interfaceOverride('fa', 'ورود', 'Entry'), 'نقطه ورود')
})

test('the terminal workspace normalises CMS translations and uses the exact order-book copy', () => {
  const pages = readFileSync('src/features/terminal/TradingPages.tsx', 'utf8')
  assert.match(pages, /\.\.\.normalizeDictionary\(cms\)/)
  assert.ok(pages.includes('دفتر سفارش مجازی Open Oracle؛ نقدینگی شبیه‌سازی‌شده بر پایهٔ مخزن و بدون سفارش ثابت.'))
  assert.ok(!/Gains|hyperliquid/i.test(pages.slice(pages.indexOf('"book.simulated"'), pages.indexOf('"trades.note"') + 200)))
  assert.ok(!pages.includes('نقدینگی مجازی Gains؛ دفتر سفارش متمرکز نیست.'))
  const depth = readFileSync('public/legacy/market-depth.js', 'utf8')
  assert.ok(depth.includes('"نقدینگی مجازی مبتنی بر مخزن"'))
  assert.ok(!depth.includes('Gains VOB · نقدینگی'))
  /* the source mark is the Open Oracle badge, never a venue logo */
  assert.match(depth, /of-oracle-badge/); assert.doesNotMatch(depth, /gains-logo\.svg|hyperliquid-mark\.svg/)
})

test('terminal footer shows live status with the Open Oracle mark and a localized support link', () => {
  const body = readFileSync('src/pages/terminal-body.html', 'utf8')
  const footer = body.slice(body.indexOf('<footer class="status-bar">'), body.indexOf('</footer>'))
  assert.ok(!footer.includes('api.gains.trade'))
  assert.match(footer, /of-oracle-badge/); assert.doesNotMatch(footer, /gains-logo\.svg|hyperliquid-mark\.svg/)
  const terminal = readFileSync('public/legacy/terminal.js', 'utf8')
  assert.match(terminal, /support\.href = '\/' \+ encodeURIComponent\(window\.ofLang\) \+ '\/contact'; support\.target = '_top'/)
})

test('Persian market ticker shows only the owner-specified live label, without the provider name', () => {
  const ticker = readFileSync('src/features/ticker/BitpinTicker.tsx', 'utf8')
  assert.match(ticker, /status === 'live' \? 'زنده از بازار'/)
  assert.ok(!/>بیت‌پین</.test(ticker))
  /* the legacy static translator must not freeze the label at its first text */
  assert.match(ticker, /<aside className="bitpin-ticker" data-locale-owned/)
  assert.match(readFileSync('src/features/ticker/ticker.css', 'utf8'), /\[data-status="live"\] \.bitpin-ticker-status \{ display: inline; \}/)
})

test('a bare locale URL keeps its language', () => {
  const main = readFileSync('src/main.tsx', 'utf8')
  assert.match(main, /const locale = LOCALES\.find\(l => l\.toLowerCase\(\) === segment\)/)
  assert.match(main, /const lang = locale \?\? preferredLocale\(\)/)
})
