/* E2E: product gateway + markets + unified navigation (built app on :4173) */
const { chromium } = require('playwright-core')
const results = []
const R = (n, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} - ${n}${extra ? '  [' + extra + ']' : ''}`)
const SHOTS = '/Users/algoman/.qwenwork/workspace/mvw61rrm1ic7idr4/shots3'
const BASE = 'http://127.0.0.1:4173/react'
const fs = require('fs')
fs.mkdirSync(SHOTS, { recursive: true })

;(async () => {
  const browser = await chromium.launch({
    executablePath: `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
    headless: true
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errs = []
  page.on('pageerror', e => errs.push(e.message.slice(0, 160)))

  /* ============ HOME (fa) ============ */
  await page.goto(`${BASE}/#/`, { waitUntil: 'load' })
  await page.waitForTimeout(1800)
  R('home: root redirects to fa gateway', page.url().includes('#/fa/home'), page.url())
  const homeFa = await page.evaluate(() => ({
    h1: document.querySelector('.home-stage h1')?.textContent.trim(),
    panels: document.querySelectorAll('.home-panel').length,
    imgs: [...document.querySelectorAll('.home-panel img')].map(i => i.getAttribute('src')),
    ctas: [...document.querySelectorAll('.home-panel .button')].map(a => a.getAttribute('href')),
    nav: [...document.querySelectorAll('.navlinks a')].map(a => a.textContent.trim()),
    footer: !!document.querySelector('.information-page footer, footer'),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    slack: document.documentElement.scrollHeight - window.innerHeight
  }))
  R('home fa: headline', homeFa.h1?.includes('همه بازارها') && homeFa.h1.includes('پلتفرم معاملاتی'), homeFa.h1)
  R('home fa: two product panels', homeFa.panels === 2)
  R('home fa: two illustrations', homeFa.imgs.length === 2 && homeFa.imgs.every(s => /assets\/home\/(prop-trading|perpetual-trading)\.svg/.test(s || '')), JSON.stringify(homeFa.imgs))
  R('home fa: CTA1 → challenges', homeFa.ctas[0] === '#/fa/challenges', homeFa.ctas.join(','))
  R('home fa: CTA2 → terminal', homeFa.ctas[1] === '#/terminal')
  R('home fa: 4 nav items in order', JSON.stringify(homeFa.nav) === JSON.stringify(['چلنج‌های معاملاتی', 'بازارها', 'قوانین معاملاتی', 'شفافیت']), JSON.stringify(homeFa.nav))
  R('home fa: no footer (one-screen gateway)', homeFa.footer === false)
  R('home fa: fits one screen', homeFa.slack <= 40, `scrollHeight-innerHeight=${homeFa.slack}`)
  R('home fa: no horizontal overflow', homeFa.overflow <= 0, String(homeFa.overflow))
  await page.screenshot({ path: `${SHOTS}/home-fa-1440.png` })

  /* logo → home */
  await page.evaluate(() => document.querySelector('.openfund-header .brand')?.click())
  await page.waitForTimeout(700)
  R('home: logo click stays on gateway', page.url().includes('#/fa/home'), page.url())

  /* language switch preserves page */
  await page.click('#language-toggle')
  await page.waitForTimeout(900)
  R('home: fa→en preserves page', page.url().includes('#/en/home'), page.url())
  const homeEn = await page.evaluate(() => document.querySelector('.home-stage h1')?.textContent.trim())
  R('home en: headline', homeEn === 'All MarketsOne Trading Platform', homeEn)
  const navEn = await page.evaluate(() => [...document.querySelectorAll('.navlinks a')].map(a => a.textContent.trim()))
  R('home en: nav localized', JSON.stringify(navEn) === JSON.stringify(['Trading Challenges', 'Markets', 'Trading Rules', 'Transparency']), JSON.stringify(navEn))
  await page.screenshot({ path: `${SHOTS}/home-en-1440.png` })

  /* variant A preview */
  await page.goto(`${BASE}/#/en/home?variant=a`, { waitUntil: 'load' })
  await page.waitForTimeout(900)
  R('home: variant=a editorial preview renders', !!(await page.$('.home-variant-a')))
  await page.screenshot({ path: `${SHOTS}/home-en-variant-a.png` })

  /* mobile home */
  await page.setViewportSize({ width: 375, height: 760 })
  await page.goto(`${BASE}/#/fa/home`, { waitUntil: 'load' })
  await page.waitForTimeout(900)
  const mob = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, panels: document.querySelectorAll('.home-panel').length }))
  R('home fa mobile: no horizontal overflow', mob.overflow <= 0, String(mob.overflow))
  R('home fa mobile: both products accessible', mob.panels === 2)
  await page.screenshot({ path: `${SHOTS}/home-fa-375.png`, fullPage: false })
  /* mobile menu shows the 4 items */
  await page.click('.menu')
  await page.waitForTimeout(400)
  const mobNav = await page.evaluate(() => {
    const nav = document.querySelector('#navigation')
    return nav && nav.classList.contains('open') ? [...nav.querySelectorAll('a')].map(a => a.textContent.trim()) : null
  })
  R('home fa mobile: menu opens with 4 items', Array.isArray(mobNav) && mobNav.length === 4, JSON.stringify(mobNav))
  await page.screenshot({ path: `${SHOTS}/home-fa-375-menu.png` })
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 1440, height: 900 })

  /* ============ CHALLENGES (existing landing preserved) ============ */
  await page.goto(`${BASE}/#/fa/challenges`, { waitUntil: 'load' })
  await page.waitForTimeout(2600)
  const landing = await page.evaluate(() => ({
    h1: document.querySelector('.hero h1')?.textContent.trim(),
    navActive: [...document.querySelectorAll('.navlinks a')].filter(a => a.classList.contains('active')).map(a => a.textContent.trim()),
    marketsSection: !!document.querySelector('#markets #live-rows'),
    accounts: !!document.querySelector('#accounts'),
    how: !!document.querySelector('#how'),
    team: !!document.querySelector('#team'),
    nav: [...document.querySelectorAll('.navlinks a')].map(a => a.getAttribute('href'))
  }))
  R('challenges fa: landing hero intact', landing.h1?.includes('مهارت تو'), landing.h1)
  R('challenges fa: markets section (Gains table) intact', landing.marketsSection)
  R('challenges fa: accounts/how/team sections intact', landing.accounts && landing.how && landing.team)
  R('challenges fa: challenges nav item active', JSON.stringify(landing.navActive) === JSON.stringify(['چلنج‌های معاملاتی']), JSON.stringify(landing.navActive))
  R('challenges fa: nav hrefs are routes not anchors', landing.nav.every(h => /^#\/(fa|en)\//.test(h || '')), JSON.stringify(landing.nav))
  await page.screenshot({ path: `${SHOTS}/challenges-fa-1440.png` })

  /* language toggle on landing keeps page + syncs URL */
  await page.click('#language-toggle')
  await page.waitForTimeout(1400)
  const enLanding = await page.evaluate(() => ({ url: location.hash, h1: document.querySelector('.hero h1')?.textContent.trim() }))
  R('challenges: fa→en preserves page + URL', enLanding.url.includes('#/en/challenges'), enLanding.url)
  R('challenges: en headline translated', enLanding.h1?.includes('skill'), enLanding.h1)

  /* ============ MARKETS ============ */
  await page.goto(`${BASE}/#/fa/markets`, { waitUntil: 'load' })
  await page.waitForTimeout(5000) /* Gains REST + WS */
  const mk = await page.evaluate(() => ({
    h1: document.querySelector('.info-hero h1')?.textContent.trim(),
    tabs: [...document.querySelectorAll('.mk-toolbar .market-tabs button')].map(b => b.textContent.trim()),
    cards: document.querySelectorAll('.mk-card').length,
    stream: document.querySelector('.mk-stream')?.textContent.trim(),
    nav: [...document.querySelectorAll('.navlinks a')].map(a => a.textContent.trim()),
    active: [...document.querySelectorAll('.navlinks a')].filter(a => a.getAttribute('aria-current') === 'page').map(a => a.textContent.trim()),
    total: document.querySelector('.mk-hero-meta span:nth-child(2)')?.textContent.trim()
  }))
  R('markets fa: hero headline', (mk.h1 || '').includes('بازارهای جهانی'), mk.h1)
  R('markets fa: category tabs derived from Gains', mk.tabs.length >= 5, JSON.stringify(mk.tabs.slice(0, 6)))
  R('markets fa: market cards rendered', mk.cards > 20, String(mk.cards))
  R('markets fa: Gains instrument count shown', /۴۸۸|488|[0-9۰-۹]{2,}/.test(mk.total || ''), mk.total)
  R('markets fa: nav consistent 4 items', JSON.stringify(mk.nav) === JSON.stringify(['چلنج‌های معاملاتی', 'بازارها', 'قوانین معاملاتی', 'شفافیت']))
  R('markets fa: markets nav active', JSON.stringify(mk.active) === JSON.stringify(['بازارها']), JSON.stringify(mk.active))
  R('markets fa: stream status shown', !!mk.stream, mk.stream)
  await page.screenshot({ path: `${SHOTS}/markets-fa-1440.png` })

  /* search: english symbols work in fa */
  await page.fill('.mk-search input', 'BTC')
  await page.waitForTimeout(700)
  const btcCards = await page.evaluate(() => [...document.querySelectorAll('.mk-card .mk-symbol b')].map(b => b.textContent.trim()))
  R('markets fa: english search works (substring match)', btcCards.length >= 1 && btcCards.every(b => b.toLowerCase().includes('btc')), JSON.stringify(btcCards.slice(0, 5)))
  await page.fill('.mk-search input', '')
  await page.waitForTimeout(500)

  /* category filtering without reload */
  const urlBefore = page.url()
  await page.evaluate(() => [...document.querySelectorAll('.mk-toolbar .market-tabs button')].find(b => b.textContent.includes('رمزارز'))?.click())
  await page.waitForTimeout(700)
  const cryptoCats = await page.evaluate(() => [...new Set([...document.querySelectorAll('.mk-card .mk-cat')].map(e => e.textContent.trim()))])
  R('markets fa: category filter (crypto only, no reload)', page.url() === urlBefore && cryptoCats.length === 1 && cryptoCats[0] === 'رمزارز', JSON.stringify(cryptoCats))
  await page.screenshot({ path: `${SHOTS}/markets-fa-crypto.png` })

  /* language switch on markets */
  await page.click('#language-toggle')
  await page.waitForTimeout(1200)
  R('markets: fa→en preserves page', page.url().includes('#/en/markets'), page.url())
  const mkEn = await page.evaluate(() => ({ h1: document.querySelector('.info-hero h1')?.textContent.trim(), tabs: [...document.querySelectorAll('.mk-toolbar .market-tabs button')].map(b => b.textContent.trim()) }))
  R('markets en: hero localized', mkEn.h1 === 'Explore OpenfundMarkets', mkEn.h1)
  R('markets en: tabs localized', mkEn.tabs.some(t => t.includes('Crypto')), JSON.stringify(mkEn.tabs.slice(0, 3)))
  await page.screenshot({ path: `${SHOTS}/markets-en-1440.png` })

  /* markets mobile */
  await page.setViewportSize({ width: 375, height: 760 })
  await page.goto(`${BASE}/#/fa/markets`, { waitUntil: 'load' })
  await page.waitForTimeout(4000)
  const mobMk = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, cards: document.querySelectorAll('.mk-card').length }))
  R('markets fa mobile: no horizontal overflow', mobMk.overflow <= 0, String(mobMk.overflow))
  R('markets fa mobile: cards render', mobMk.cards > 10, String(mobMk.cards))
  await page.screenshot({ path: `${SHOTS}/markets-fa-375.png` })
  await page.setViewportSize({ width: 1440, height: 900 })

  /* deep-link a market into the terminal */
  await page.goto(`${BASE}/#/fa/markets`, { waitUntil: 'load' })
  await page.waitForTimeout(4000)
  const target = await page.evaluate(() => document.querySelector('.mk-card .mk-symbol b')?.textContent.trim())
  await page.evaluate(() => document.querySelector('.mk-card')?.click())
  await page.waitForTimeout(9000) /* reload + terminal boot */
  const term = await page.evaluate(() => ({
    url: location.hash, pair: document.querySelector('#cur-pair')?.textContent.trim(),
    btn: document.querySelector('#market-select-btn[disabled]') ? 'disabled' : 'ready'
  }))
  R('markets → terminal: route', term.url.includes('#/terminal'), term.url)
  R('markets → terminal: deep-linked symbol selected', term.pair && term.pair.startsWith(target + '/'), `${target} → ${term.pair}`)
  R('markets → terminal: boot completed', term.btn === 'ready', term.btn)
  await page.screenshot({ path: `${SHOTS}/terminal-deeplink.png` })

  /* ============ RULEBOOK + TRANSPARENCY regression ============ */
  await page.goto(`${BASE}/#/fa/rulebook`, { waitUntil: 'load' })
  await page.waitForTimeout(1600)
  const rb = await page.evaluate(() => ({
    h1: document.querySelector('.info-hero h1')?.textContent.trim(),
    sections: document.querySelectorAll('.rule-section').length,
    nav: [...document.querySelectorAll('.navlinks a')].map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href') })),
    active: [...document.querySelectorAll('.navlinks a')].filter(a => a.getAttribute('aria-current') === 'page').map(a => a.textContent.trim())
  }))
  R('rulebook fa: content preserved', rb.sections >= 15 && !!rb.h1, `sections=${rb.sections}`)
  R('rulebook fa: nav links route to pages', rb.nav.every(n => /^#\/fa\/(challenges|markets|rulebook|transparency)$/.test(n.href || '')), JSON.stringify(rb.nav))
  R('rulebook fa: rulebook nav active', JSON.stringify(rb.active) === JSON.stringify(['قوانین معاملاتی']), JSON.stringify(rb.active))
  await page.click('#language-toggle')
  await page.waitForTimeout(900)
  R('rulebook: fa→en preserves page', page.url().includes('#/en/rulebook'), page.url())

  await page.goto(`${BASE}/#/fa/transparency`, { waitUntil: 'load' })
  await page.waitForTimeout(1800)
  const tr = await page.evaluate(() => ({
    h1: document.querySelector('.info-hero h1')?.textContent.trim(),
    metrics: document.querySelectorAll('.metric-card').length,
    active: [...document.querySelectorAll('.navlinks a')].filter(a => a.getAttribute('aria-current') === 'page').map(a => a.textContent.trim())
  }))
  R('transparency fa: dashboard preserved', tr.metrics > 0 && !!tr.h1, `metrics=${tr.metrics}`)
  R('transparency fa: transparency nav active', JSON.stringify(tr.active) === JSON.stringify(['شفافیت']), JSON.stringify(tr.active))
  await page.screenshot({ path: `${SHOTS}/transparency-fa-1440.png` })

  /* ============ legacy deep-link migration ============ */
  await page.goto(`${BASE}/#/markets`, { waitUntil: 'load' })
  await page.waitForTimeout(1500)
  R('legacy hash #/markets migrates to markets page', page.url().includes('#/fa/markets') || page.url().includes('#/en/markets'), page.url())
  await page.goto(`${BASE}/#/accounts`, { waitUntil: 'load' })
  await page.waitForTimeout(3200)
  R('legacy hash #/accounts migrates to challenges', page.url().includes('challenges'), page.url())

  /* terminal nav Markets link goes to the markets page */
  await page.goto(`${BASE}/#/terminal`, { waitUntil: 'load' })
  await page.waitForTimeout(7000)
  const termNav = await page.evaluate(() => [...document.querySelectorAll('.nav-links a')].map(a => ({ text: a.textContent.trim(), href: a.getAttribute('href') })))
  R('terminal: nav intact (Trade/Markets/Portfolio/More)', termNav.length === 4 && termNav.some(n => (n.text === 'Markets' || n.text === 'بازارها') && (n.href || '').includes('#/#markets')), JSON.stringify(termNav))
  await page.evaluate(() => [...document.querySelectorAll('.nav-links a')].find(a => a.textContent.trim() === 'Markets' || a.textContent.trim() === 'بازارها')?.click())
  await page.waitForTimeout(3500)
  R('terminal → Markets nav opens markets page', /#\/(fa|en)\/markets/.test(page.url()), page.url())

  R('no page errors', errs.length === 0, errs.slice(0, 4).join(' | '))

  console.log(results.join('\n'))
  const failed = results.filter(r => r.startsWith('FAIL')).length
  console.log(`\n${failed === 0 ? 'ALL PASS' : failed + ' FAILURES'} (${results.length} checks)`)
  await browser.close()
  process.exit(failed === 0 ? 0 : 1)
})().catch(e => { console.error(e); process.exit(1) })
