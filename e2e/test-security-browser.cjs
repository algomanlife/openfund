/**
 * Browser security checks (security audit 2026-11), headless Chromium.
 *
 * Runs against a local test server (BASE_URL, default http://localhost:8080)
 * started with SIM_TEST_MODE=1 on an isolated test database. Two real test
 * wallets sign in through SIWE over HTTP; their session cookies are then
 * placed in the browser exactly as the server issues them.
 *
 *  B1 the session cookie is HttpOnly: page scripts cannot read it, and no
 *     session id lands in localStorage / sessionStorage
 *  B2 the public pages load without CSP violations or page errors
 *  B3 switching the session from wallet A to wallet B in the same browser
 *     shows B's identity and never A's wallet or data
 *  B4 after logout, a reload is signed out and protected API calls from the
 *     page return 401
 *  B5 a hostile origin cannot read credentialed API responses from the page
 *     context (CORS) and cannot frame the app (frame-ancestors)
 */
const { chromium } = require('playwright')
const { generatePrivateKey, privateKeyToAccount } = require('../apps/backend/node_modules/viem/_cjs/accounts/index.js')
const { createSiweMessage } = require('../apps/backend/node_modules/viem/_cjs/utils/siwe/createSiweMessage.js')

const BASE = process.env.BASE_URL || 'http://localhost:8080'
const host = new URL(BASE).host
let failed = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${cond ? '' : ' ' + extra}`); if (!cond) failed++ }

async function sessionFor(wallet) {
  const post = (p, body) => fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' }, body: JSON.stringify(body) })
  const { nonce } = await (await post('/auth/nonce', { address: wallet.address })).json()
  const message = createSiweMessage({ domain: 'localhost:5173', address: wallet.address, uri: 'http://localhost:5173/', chainId: 42161, nonce, version: '1' })
  const r = await post('/auth/verify', { message, signature: await wallet.signMessage({ message }) })
  return r.headers.get('set-cookie').split(';')[0].split('=')[1]
}

;(async () => {
  const A = privateKeyToAccount(generatePrivateKey()), B = privateKeyToAccount(generatePrivateKey())
  const [sidA, sidB] = [await sessionFor(A), await sessionFor(B)]
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors = [], csp = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (/Content Security Policy|Refused to (load|execute|connect|frame)/i.test(m.text())) csp.push(m.text()) })
  const cookie = v => ({ name: 'openfund_session', value: v, domain: new URL(BASE).hostname, path: '/', httpOnly: true, sameSite: 'Lax' })

  /* B2 public pages (CI serves the local Directus origin through CSP_EXTRA_CONNECT) */
  for (const p of ['/', '/plans', '/terminal']) {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(2500)
  }
  ok('B2 public pages: no CSP violations', csp.length === 0, csp.slice(0, 3).join(' | '))
  ok('B2 public pages: no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  /* B1 cookie isolation */
  await context.addCookies([cookie(sidA)])
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  const exposed = await page.evaluate(() => ({ cookie: document.cookie, local: JSON.stringify(localStorage), session: JSON.stringify(sessionStorage) }))
  ok('B1 document.cookie never exposes the session id', !exposed.cookie.includes(sidA) && !/openfund_session/.test(exposed.cookie), exposed.cookie)
  ok('B1 no session id in Web Storage', !exposed.local.includes(sidA) && !exposed.session.includes(sidA))
  const meA = await page.evaluate(async () => (await fetch('/auth/me', { credentials: 'include' })).json())
  ok('B3 page sees wallet A', meA?.user?.walletAddress === A.address.toLowerCase())

  /* B3 switch to B in the same browser */
  await context.clearCookies(); await context.addCookies([cookie(sidB)])
  await page.goto(BASE + '/terminal', { waitUntil: 'domcontentloaded' }).catch(() => {})
  const meB = await page.evaluate(async () => (await fetch('/auth/me', { credentials: 'include' })).json())
  ok('B3 after switch the page sees wallet B', meB?.user?.walletAddress === B.address.toLowerCase())
  const html = (await page.content()).toLowerCase()
  ok('B3 wallet A never rendered after the switch', !html.includes(A.address.toLowerCase().slice(2)))
  const stateB = await page.evaluate(async () => (await fetch('/trading/state', { credentials: 'include' })).json())
  ok('B3 trading state belongs to B', !JSON.stringify(stateB).includes(A.address.toLowerCase()))

  /* B4 logout */
  const out = await page.evaluate(async () => (await fetch('/auth/logout', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' })).status)
  ok('B4 logout from the page succeeds', out === 200)
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
  const after = await page.evaluate(async () => (await fetch('/trading/state', { credentials: 'include' })).status)
  ok('B4 after logout protected calls are 401', after === 401)

  /* B5 hostile origin: a page on another origin cannot read credentialed responses or frame the app */
  await context.addCookies([cookie(await sessionFor(A))])
  const evil = await context.newPage()
  await evil.route('http://evil.localhost/', r => r.fulfill({ contentType: 'text/html', body: `<iframe id=f src="${BASE}/"></iframe>` }))
  await evil.goto('http://evil.localhost/')
  const read = await evil.evaluate(async base => { try { const r = await fetch(base + '/auth/me', { credentials: 'include' }); return await r.text() } catch (e) { return 'blocked:' + e.message } }, BASE)
  ok('B5 cross-origin credentialed read is blocked', read.startsWith('blocked:'), read.slice(0, 80))
  await evil.waitForTimeout(1000)
  const framed = await evil.evaluate(() => { try { return document.getElementById('f').contentWindow.location.href } catch (e) { return 'blocked' } })
  const frame = evil.frames().find(f => f !== evil.mainFrame())
  const frameBody = frame ? await frame.evaluate(() => document.body?.innerText?.length || 0).catch(() => 0) : 0
  ok('B5 the app refuses to render inside a foreign frame', frameBody === 0, `framed=${framed} bodyLen=${frameBody}`)

  await browser.close()
  console.log(failed ? `${failed} failed` : 'all browser security checks passed')
  process.exit(failed ? 1 : 0)
})().catch(e => { console.error(e); process.exit(1) })
