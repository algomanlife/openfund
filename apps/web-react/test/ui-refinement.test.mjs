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

test('the Bitpin ticker is Persian-only; the announcement bar sits above the header; the terminal shows only a targeted bar', () => {
  const shell = src('features/information/InformationShell.tsx')
  assert.match(shell, /<AnnouncementBar locale=\{locale\} \/>\s*<Chrome locale=\{locale\} part="header"/)
  assert.match(shell, /<PromoModal locale=\{locale\} \/>/)
  assert.match(shell, /\{locale === 'fa' && <BitpinTicker \/>\}/)
  const landing = src('pages/Landing.tsx')
  assert.match(landing, /<AnnouncementBar locale=\{communityLocale\} \/>[\s\S]*<PromoModal locale=\{communityLocale\} \/>\s*<div dangerouslySetInnerHTML=\{\{ __html: landingMarkup \}\} \/>/)
  assert.match(landing, /\{communityLocale === 'fa' && <BitpinTicker \/>\}/)
  assert.doesNotMatch(landing + shell, /IranAccessNotice/)
  /* owner decision (2026-11-22): the same announcement bar may target the
     terminal and portfolio (pages 'terminal'/'portfolio', never 'all');
     the ticker and popups stay out of trading */
  for (const file of ['features/terminal/TerminalShell.tsx', 'features/terminal/TradingPages.tsx']) {
    assert.doesNotMatch(src(file), /BitpinTicker|PromoModal/)
  }
  assert.match(src('features/terminal/TerminalShell.tsx'), /<AnnouncementBar locale=\{locale\} \/>\s*<header className="of-terminal-header">/)
  assert.doesNotMatch(src('features/terminal/TradingPages.tsx'), /AnnouncementBar/)
  assert.match(src('features/ticker/ticker.css'), /prefers-reduced-motion: reduce/)
  assert.match(src('features/ticker/ticker.css'), /safe-area-inset-bottom/)
  assert.match(src('features/campaigns/campaigns.css'), /prefers-reduced-motion: reduce/)
})

/* ---------------- campaigns: selection, eligibility, coupons, frequency ---------------- */
const IRAN_BAR = { id: 7, placement: 'announcement_bar', style: 'mint', priority: 100, locales: ['fa'], regions: ['GLOBAL'], pages: ['all'],
  cta_url: 'https://openfi.live/', frequency: 'session',
  translations: [{ language_code: 'fa', headline: 'نسخهٔ ایرانی', cta_label: 'ورود به اوپن‌فاند ایران' }] }
const PROMO = { id: 9, placement: 'modal', template: 'split', priority: 5, locales: ['fa', 'en'], regions: ['GLOBAL', 'IRAN'], pages: ['home'],
  cta_url: '/en/checkout?plan=standard', coupon_code: 'OPENFUND20', delay_seconds: 12, frequency: 'interval', frequency_days: 7,
  translations: [{ language_code: 'en', headline: '20% off', body: 'For a limited time', cta_label: 'Buy' }, { language_code: 'fa', headline: '۲۰٪ تخفیف', cta_label: 'خرید' }] }
function memoryStorage() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) } }
async function withCampaigns({ items, region = 'GLOBAL', coupons = { OPENFUND20: { promotable: true, code: 'OPENFUND20', kind: 'percent', value: '20.00' } }, cmsDown = false }, fn) {
  const keys = ['window', 'location', 'fetch', 'sessionStorage', 'localStorage']
  const saved = Object.fromEntries(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]))
  const define = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true })
  define('window', { __OPENFUND_RUNTIME_CONFIG__: { region, cmsPublicUrl: 'https://cms.example.test' } })
  define('location', new URL('https://openfi.cloud/fa/home'))
  define('sessionStorage', memoryStorage()); define('localStorage', memoryStorage())
  const calls = []
  define('fetch', async (url) => {
    const u = String(url); calls.push(u)
    if (u.includes('/items/site_campaigns')) return cmsDown ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => ({ data: items }) }
    const m = /\/campaigns\/coupons\/([^/?]+)/.exec(u)
    if (m) return { ok: true, json: async () => coupons[decodeURIComponent(m[1])] ?? { promotable: false } }
    return { ok: false, json: async () => ({}) }
  })
  try { return await fn(load('features/campaigns/campaigns.ts'), calls) }
  finally { for (const k of keys) { if (saved[k]) Object.defineProperty(globalThis, k, saved[k]); else delete globalThis[k] } }
}

test('locale eligibility: an fa-only bar shows in Persian and never falls back to English or another language', async () => {
  await withCampaigns({ items: [IRAN_BAR] }, async c => {
    const fa = await c.selectCampaign('announcement_bar', 'fa', 'home')
    assert.equal(fa.headline, 'نسخهٔ ایرانی'); assert.equal(fa.ctaUrl, 'https://openfi.live/'); assert.equal(fa.external, true)
    for (const locale of ['en', 'ar', 'ru', 'zh-CN']) assert.equal(await c.selectCampaign('announcement_bar', locale, 'home'), null, locale)
  })
  /* eligible for en but with no English copy: still nothing, never the Persian text */
  await withCampaigns({ items: [{ ...IRAN_BAR, locales: ['fa', 'en'] }] }, async c => {
    assert.equal(await c.selectCampaign('announcement_bar', 'en', 'home'), null)
  })
})

test('region, page and schedule must match; the highest priority wins', async () => {
  const later = { ...IRAN_BAR, id: 8, priority: 1, translations: [{ language_code: 'fa', headline: 'دیگر', cta_label: null }] }
  await withCampaigns({ items: [later, IRAN_BAR], region: 'IRAN' }, async c => {
    assert.equal((await c.selectCampaign('announcement_bar', 'fa', 'home'))?.id ?? null, null, 'GLOBAL-only bars are not shown on IRAN')
  })
  await withCampaigns({ items: [later, IRAN_BAR] }, async c => assert.equal((await c.selectCampaign('announcement_bar', 'fa', 'home')).id, '7'))
  const future = { ...IRAN_BAR, starts_at: new Date(Date.now() + 3600e3).toISOString() }, past = { ...IRAN_BAR, ends_at: new Date(Date.now() - 1).toISOString() }
  await withCampaigns({ items: [future, past] }, async c => assert.equal(await c.selectCampaign('announcement_bar', 'fa', 'home'), null))
  await withCampaigns({ items: [PROMO] }, async c => assert.equal(await c.selectCampaign('modal', 'en', 'challenges'), null, 'home-only campaign'))
  assert.equal(load('features/campaigns/campaigns.ts').campaignPage('/fa/checkout'), null)
  for (const path of ['/en/prop/purchases', '/fa/profile', '/en/terminal', '/fa/prop/inbox']) assert.equal(load('features/campaigns/campaigns.ts').campaignPage(path), null, path)
})

test('announcement bars: tone, dismissible, and the terminal and portfolio only when named', async () => {
  const page = load('features/campaigns/campaigns.ts').campaignPage
  assert.equal(page('/en/prop/trade', 'announcement_bar'), 'terminal')
  assert.equal(page('/fa/perpetual/chart', 'announcement_bar'), 'terminal')
  assert.equal(page('/en/prop/portfolio', 'announcement_bar'), 'portfolio')
  assert.equal(page('/en/prop/dashboard', 'announcement_bar'), 'portfolio')
  assert.equal(page('/en/prop/trade', 'modal'), null, 'popups never reach the trading pages')
  for (const path of ['/en/prop/purchases', '/fa/prop/withdrawals', '/fa/checkout']) assert.equal(page(path, 'announcement_bar'), null, path)
  const urgent = { ...IRAN_BAR, id: 11, style: 'warning', dismissible: false, pages: ['terminal', 'portfolio'] }
  await withCampaigns({ items: [urgent] }, async c => {
    const bar = await c.selectCampaign('announcement_bar', 'fa', 'terminal')
    assert.equal(bar.style, 'warning'); assert.equal(bar.dismissible, false)
    assert.equal(await c.selectCampaign('announcement_bar', 'fa', 'home'), null, 'a trading-only bar stays off public pages')
  })
  await withCampaigns({ items: [IRAN_BAR] }, async c => {
    assert.equal(await c.selectCampaign('announcement_bar', 'fa', 'terminal'), null, "'all' means the public pages only")
    assert.equal((await c.selectCampaign('announcement_bar', 'fa', 'home')).dismissible, true, 'dismissible by default')
  })
  const css = src('features/campaigns/campaigns.css')
  for (const tone of ['info', 'success', 'warning']) assert.match(css, new RegExp(`\\.of-announcement-${tone} \\{`))
  assert.match(css, /\.of-announcement-close \{ flex: none; inline-size: 44px; block-size: 44px;/)
})

test('a coupon campaign shows only while the backend reports the coupon as promotable, and its checkout link carries the code', async () => {
  await withCampaigns({ items: [PROMO] }, async c => {
    const promo = await c.selectCampaign('modal', 'en', 'home')
    assert.deepEqual(promo.coupon, { code: 'OPENFUND20', kind: 'percent', value: '20.00' })
    assert.equal(promo.ctaUrl, '/en/checkout?plan=standard&coupon=OPENFUND20')
    assert.equal(promo.delayMs, 12000)
  })
  await withCampaigns({ items: [PROMO], coupons: {} }, async c => assert.equal(await c.selectCampaign('modal', 'en', 'home'), null, 'expired or disabled coupon'))
})

test('unsafe destinations are dropped; frequency caps hold per campaign; the offline fallback is used only when no source answers', async () => {
  const bad = ['javascript:alert(1)', '//evil.test/x', 'http://insecure.test/', 'https://user:pw@x.test/', 'data:text/html,x']
  await withCampaigns({ items: bad.map((u, i) => ({ ...IRAN_BAR, id: 20 + i, cta_url: u })) }, async c => {
    const bar = await c.selectCampaign('announcement_bar', 'fa', 'home')
    assert.equal(bar.ctaUrl, null); assert.equal(bar.ctaLabel, null)
  })
  await withCampaigns({ items: [PROMO] }, async c => {
    const first = await c.selectCampaign('modal', 'en', 'home')
    c.markSeen(first)
    assert.equal(await c.selectCampaign('modal', 'en', 'home'), null, 'not again in this session')
    sessionStorage.removeItem('of-campaign:modal:9')
    assert.equal(await c.selectCampaign('modal', 'en', 'home'), null, 'not again inside the 7-day interval')
  })
  await withCampaigns({ items: [], cmsDown: false }, async c => assert.equal(await c.selectCampaign('announcement_bar', 'fa', 'home'), null, 'editors removed it'))
  await withCampaigns({ items: [], cmsDown: true }, async c => {
    const fallback = await c.selectCampaign('announcement_bar', 'fa', 'home')
    assert.equal(fallback.ctaUrl, 'https://openfi.live/')
    assert.equal(await c.selectCampaign('announcement_bar', 'en', 'home'), null, 'fallback is Persian-only too')
    assert.equal(await c.selectCampaign('modal', 'fa', 'home'), null, 'no popup without published content')
  })
})

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

test('Home is the one-screen solar gateway with two actions', () => {
  const home = src('features/home/Home.tsx'), css = src('features/home/home.css')
  assert.match(home, /startSolarScene\(element, \{ still: reduced\.matches, theme: current \}\)/)
  assert.match(home, /pick\(locale, 'خرید سریع چلنج', 'Buy a challenge'\)/)
  assert.match(home, /pick\(locale, 'قوانین معاملاتی', 'Trading rules'\)/)
  assert.match(css, /\.home-gateway\.solar-gateway \{\n  position: fixed;/)
  assert.match(css, /top: var\(--gateway-top, 72px\); bottom: var\(--gateway-bottom, 0px\);/)
})

test('the terminal status bar has no Vela label while the website keeps its Vela credit', () => {
  const terminal = src('pages/terminal-body.html')
  assert.doesNotMatch(terminal, /chart-notice|velacharts\.dev|>Vela</)
  assert.match(src('pages/landing-body.html'), /<b dir="ltr">Vela<\/b>/)
})
