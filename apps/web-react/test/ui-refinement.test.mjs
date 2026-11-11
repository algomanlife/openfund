// Regression tests for the final frontend UI refinement: Bitpin ticker data
// handling and polling lifecycle, the Persian-only additions, the Challenges
// wallet panel state mapping, shared terminal popover dismissal and the
// width-aware public header.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const src = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
function load(path, define = {}) {
  const result = buildSync({
    entryPoints: [fileURLToPath(new URL(`../src/${path}`, import.meta.url))], bundle: true, write: false,
    platform: 'node', format: 'cjs', packages: 'external', loader: { '.css': 'empty' }, jsx: 'automatic',
    define: { 'import.meta.env.DEV': 'false', 'import.meta.env.BASE_URL': '"/"', ...define },
  })
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, mod, mod.exports)
  return mod.exports
}

/* ---------------- Bitpin ticker ---------------- */
const sample = [
  { symbol: 'BTC_IRT', price: '19224361671', daily_change_price: -1.56, timestamp: 1794390461.4 },
  { symbol: 'BTC_USDT', price: '73694.05', daily_change_price: -0.99, timestamp: 1794390472.1 },
  { symbol: 'ETH_IRT', price: 'not-a-number', daily_change_price: 1, timestamp: 1794390382.4 },
  { symbol: 'USDT_IRT', price: '261353', daily_change_price: 0.36, timestamp: 1794390472.2 },
  { symbol: 'SOL_IRT', price: '0', daily_change_price: 1, timestamp: 1794390463.1 },
  { symbol: 'XRP_IRT', price: '276699', timestamp: 1794390387.8 },
]

test('Bitpin rows are validated and mapped to Toman quotes without inventing any value', () => {
  const bitpin = load('features/ticker/bitpin.ts')
  assert.equal(bitpin.BITPIN_TICKERS_URL, 'https://api.bitpin.ir/api/v1/mkt/tickers/')
  assert.equal(bitpin.QUOTE, 'IRT')
  assert.equal(bitpin.QUOTE_LABEL_FA, 'تومان')
  const quotes = bitpin.parseTickers(sample)
  // only valid *_IRT rows survive: malformed, zero and change-less rows are dropped
  assert.deepEqual(quotes.map(q => q.symbol), ['BTC_IRT', 'USDT_IRT'])
  assert.equal(quotes[0].price, 19224361671)
  assert.equal(quotes[0].change, -1.56)
  assert.equal(quotes[0].name, 'بیت‌کوین')
  assert.deepEqual(bitpin.parseTickers(null), [])
  assert.deepEqual(bitpin.parseTickers({ symbol: 'BTC_IRT' }), [])
  assert.match(bitpin.formatPrice(19224361671), /^[۰-۹٬]+$/)
  assert.match(bitpin.formatChange(-1.56), /۱٫۵۶/)
})

test('ticker status is live only while data is fresh and withdraws prices after a long outage', () => {
  const { statusFor, WITHDRAW_AFTER_MS } = load('features/ticker/bitpin.ts')
  const now = 10_000_000
  assert.equal(statusFor(null, false, now), 'loading')
  assert.equal(statusFor(null, true, now), 'unavailable')
  assert.equal(statusFor(now - 1000, false, now), 'live')
  assert.equal(statusFor(now - 1000, true, now), 'delayed')
  assert.equal(statusFor(now - WITHDRAW_AFTER_MS - 1, true, now), 'unavailable')
})

test('one shared poller: remounts never duplicate the loop, unmount cancels, data is never faked on failure', async () => {
  const dom = new JSDOM('', { pretendToBeVisual: true })
  const saved = { document: globalThis.document, fetch: globalThis.fetch }
  globalThis.document = dom.window.document
  const calls = []
  let fail = false
  globalThis.fetch = (url, init) => {
    calls.push(url)
    return new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      setTimeout(() => fail ? resolve({ ok: false, status: 429 }) : resolve({ ok: true, json: async () => sample }), 5)
    })
  }
  try {
    const { subscribeTicker } = load('features/ticker/bitpin.ts')
    const states = []
    // StrictMode-style mount → unmount → mount must still load data
    const first = subscribeTicker(() => {})
    first()
    const second = subscribeTicker(state => states.push(state))
    const third = subscribeTicker(() => {})
    await new Promise(resolve => setTimeout(resolve, 30))
    assert.equal(calls.length, 2, 'the aborted request plus exactly one live request')
    assert.equal(states.at(-1).status, 'live')
    assert.deepEqual(states.at(-1).quotes.map(q => q.symbol), ['BTC_IRT', 'USDT_IRT'])
    second(); third()
    fail = true
    const after = calls.length
    await new Promise(resolve => setTimeout(resolve, 30))
    assert.equal(calls.length, after, 'no polling without subscribers')
  } finally {
    globalThis.document = saved.document
    globalThis.fetch = saved.fetch
  }
})

test('the ticker and the Iran notice are Persian-only and never mounted in the terminal', () => {
  const shell = src('features/information/InformationShell.tsx')
  assert.match(shell, /\{locale === 'fa' && <IranAccessNotice \/>\}/)
  assert.match(shell, /\{locale === 'fa' && <BitpinTicker \/>\}/)
  const landing = src('pages/Landing.tsx')
  assert.match(landing, /communityLocale === 'fa' && createPortal\(<IranAccessNotice \/>/)
  assert.match(landing, /\{communityLocale === 'fa' && <BitpinTicker \/>\}/)
  for (const file of ['features/terminal/TerminalShell.tsx', 'features/terminal/TradingPages.tsx']) {
    assert.doesNotMatch(src(file), /BitpinTicker|IranAccessNotice/)
  }
  assert.match(src('features/ticker/ticker.css'), /prefers-reduced-motion: reduce/)
  assert.match(src('features/ticker/ticker.css'), /safe-area-inset-bottom/)
})

test('the Iran access notice is owner-approved for production and renders the approved copy', () => {
  const React = require('react'), server = require('react-dom/server')
  const on = load('features/notice/IranAccessNotice.tsx', { 'import.meta.env.DEV': 'false' }).default
  const doc = new JSDOM(server.renderToStaticMarkup(React.createElement(on))).window.document
  assert.equal(doc.querySelector('strong').textContent, 'دسترسی پایدار به اوپن‌فاند')
  const link = doc.querySelector('a[href="https://iran.openfund.cloud"]')
  assert.equal(link.getAttribute('dir'), 'ltr')
  assert.equal(link.textContent, 'iran.openfund.cloud')
  assert.match(src('config/iranAccess.ts'), /IRAN_ACCESS_NOTICE_APPROVED = true/)
})

/* ---------------- Challenges wallet panel ---------------- */
test('the wallet panel never treats a connected wallet as signed in and never asks a restoring session to connect', () => {
  const { walletPanelState } = load('wallet/walletPanelState.ts')
  assert.equal(walletPanelState('disconnected', false, 'anonymous'), 'disconnected')
  assert.equal(walletPanelState('reconnecting', false, 'anonymous'), 'restoring')
  assert.equal(walletPanelState('connecting', false, 'anonymous'), 'restoring')
  assert.equal(walletPanelState('connected', true, 'anonymous'), 'restoring')
  assert.equal(walletPanelState('connected', true, 'unauthenticated'), 'connected')
  assert.equal(walletPanelState('connected', true, 'error'), 'connected')
  assert.equal(walletPanelState('connected', true, 'signing'), 'signing')
  assert.equal(walletPanelState('connected', true, 'authenticated'), 'authenticated')
  assert.equal(walletPanelState('connected', true, 'suspended'), 'suspended')
  // a wallet that disconnected while the session still says authenticated is disconnected
  assert.equal(walletPanelState('disconnected', false, 'authenticated'), 'disconnected')
  const panel = src('wallet/ChallengeWalletPanel.tsx')
  assert.match(panel, /useSession\(\)/)
  assert.match(panel, /session\.signIn\(\)/)
  assert.match(panel, /<bdi dir="ltr" title=\{address\}>/)
})

/* ---------------- terminal popovers ---------------- */
test('popovers close on outside pointerdown in either document, on Escape, and when another opens', () => {
  const shell = new JSDOM('<details id="more"><summary>More</summary><a href="#">x</a></details><button id="out">o</button>')
  const frame = new JSDOM('<details id="stats"><summary>Stats</summary><p id="in">v</p></details><button id="chart">c</button>')
  const saved = globalThis.document
  globalThis.document = shell.window.document
  try {
    const { registerPopover, detailsPopover, watchDocument } = load('features/terminal/popovers.ts')
    const more = shell.window.document.getElementById('more')
    const stats = frame.window.document.getElementById('stats')
    const offMore = registerPopover(detailsPopover(more))
    const offStats = registerPopover(detailsPopover(stats))
    const unwatch = watchDocument(frame.window.document)
    const down = (doc, id) => doc.getElementById(id).dispatchEvent(new doc.defaultView.Event('pointerdown', { bubbles: true }))
    more.open = true
    down(shell.window.document, 'more')
    assert.equal(more.open, true, 'pointerdown inside keeps it open')
    down(frame.window.document, 'chart')
    assert.equal(more.open, false, 'a click in the workspace iframe closes the shell menu')
    stats.open = true
    down(shell.window.document, 'out')
    assert.equal(stats.open, false, 'a click in the shell closes the workspace popover')
    stats.open = true
    frame.window.document.dispatchEvent(new frame.window.KeyboardEvent('keydown', { key: 'Escape' }))
    assert.equal(stats.open, false, 'Escape closes')
    unwatch(); offMore(); offStats()
  } finally { globalThis.document = saved }
  const terminal = readFileSync(new URL('../public/legacy/terminal.js', import.meta.url), 'utf8')
  assert.match(terminal, /if \(ddOpen\) paintDropdown\(false\);/, 'live ticks patch the open market list in place')
  assert.doesNotMatch(terminal, /if \(ddOpen\) renderDropdown\(\$\('market-search'\)\.value\);/)
  assert.match(terminal, /ddOpen && e\.target\.isConnected && !e\.target\.closest/)
})

/* ---------------- header, home and footer ---------------- */
test('the public header measures real widths instead of a fixed English-length breakpoint', () => {
  const css = src('features/information/information.css')
  assert.doesNotMatch(css, /@media\(max-width:1400px\)/)
  assert.match(css, /\.openfund-header\.nav-overflow \.navlinks \{ display:none; \}/)
  assert.match(src('features/information/navigation.ts'), /export function fitNavigation/)
  assert.match(src('styles/header-controls.css'), /--hc-h: 36px/)
})

test('Home drops the proposal label and labels Perpetual as inactive in every locale', () => {
  assert.doesNotMatch(src('features/home/TechnicalFeatureStrip.tsx'), /طرح پیشنهادی · نیازمند تأیید محصول/)
  assert.match(src('features/home/Home.tsx'), /'غیرفعال \/ در حال توسعه', 'Inactive \/ In Development'/)
  for (const locale of ['ar', 'ru', 'zh-CN']) assert.match(src(`i18n/messages/${locale}.ts`), /'Inactive \/ In Development':/, locale)
})

test('the terminal status bar has no Vela label while the website keeps its Vela credit', () => {
  const terminal = src('pages/terminal-body.html')
  assert.doesNotMatch(terminal, /chart-notice|velacharts\.dev|>Vela</)
  assert.match(src('pages/landing-body.html'), /<b dir="ltr">Vela<\/b>/)
})
