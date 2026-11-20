/* Dastkhat typography acceptance in a real browser.
 *
 * For each surface (site header, body, buttons, inputs, the terminal iframe,
 * Backstage) it asserts that:
 *   - the computed font-family puts Dastkhat ahead of every other face that
 *     can draw Persian (Ubuntu, which has no Arabic script, may lead);
 *   - Chrome actually rendered the Persian text with Dastkhat
 *     (CSS.getPlatformFontsForNode, not just the declared stack);
 *   - every Dastkhat font request succeeded with font/woff2;
 *   - no Content-Security-Policy violation was reported for a font.
 * It also checks that technical numbers stay isolated LTR with tabular digits.
 *
 * TEST_FRONTEND_URL: a built Openfund served by the backend (default
 * http://localhost:8080), so the production CSP is in force. Backstage is
 * started in-process on BACKSTAGE_TYPOGRAPHY_PORT with throwaway credentials;
 * only its static pages and login screen are used (no database, no sign-in).
 * OUTPUT_DIR: optional folder for screenshots. */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createBackstage } from '../apps/backstage/operations/server.js'
import { createVerifier } from '../apps/backstage/operations/password.js'

const BASE = (process.env.TEST_FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '')
const BACKSTAGE_PORT = Number(process.env.BACKSTAGE_TYPOGRAPHY_PORT || 8316)
const OUT = process.env.OUTPUT_DIR
const PERSIAN = /[؀-ۿ]/
/* faces that cannot draw Arabic script and may therefore precede Dastkhat */
const LATIN_ONLY = new Set(['ubuntu'])
const checks = []
const ok = (name, detail = '') => { checks.push(name); console.log(`ok - ${name}${detail ? ` (${detail})` : ''}`) }

const backstage = createBackstage({ origin: `http://127.0.0.1:${BACKSTAGE_PORT}`, backend: BASE, cms: 'http://127.0.0.1:8055',
  owner: 'typography-check', realSettlement: false, verifier: await createVerifier(randomBytes(20).toString('base64url')),
  credential: randomBytes(16).toString('hex') })
await new Promise(resolve => backstage.listen(BACKSTAGE_PORT, '127.0.0.1', resolve))

const browser = await chromium.launch()
try {
  const fontResponses = []
  const violations = []
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, colorScheme: 'dark' })
  context.on('response', response => {
    if (/\/assets\/fonts\/dastkhat\/.+\.woff2$/.test(new URL(response.url()).pathname))
      fontResponses.push({ url: response.url(), status: response.status(), type: response.headers()['content-type'] })
  })
  context.on('requestfailed', request => {
    if (/dastkhat/i.test(request.url())) violations.push(`font request failed: ${request.url()} ${request.failure()?.errorText}`)
  })
  /* Report CSP violations from every frame, the srcdoc terminal included. */
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => {
      (window.top.__cspViolations ||= []).push(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })

  const page = await context.newPage()
  /* only font loads matter here; other directives have their own suites */
  const fontViolation = text => /font-src|\.(woff2?|ttf|otf)\b|dastkhat/i.test(text)
  page.on('console', message => { const text = message.text(); if (/Content Security Policy/i.test(text) && fontViolation(text)) violations.push(text) })
  const cdp = await context.newCDPSession(page)
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
  const capture = async name => {
    if (!OUT) return
    await mkdir(OUT, { recursive: true })
    await page.waitForTimeout(2500) /* let entrance animations settle */
    await page.screenshot({ path: join(OUT, `${name}.png`) })
  }

  /* Fonts Chrome used to draw the text nodes of the first visible element
     matching `selector` (or its first descendant) that directly holds Persian
     text. `root` is a JS expression for the document to search (the page or
     an iframe document). */
  async function renderedFonts(root, selector, { text = PERSIAN.source } = {}) {
    await cdp.send('DOM.getDocument', { depth: 0 })
    const expression = `(() => {
      const doc = ${root}; const pattern = new RegExp(${JSON.stringify(text)});
      const own = el => [...el.childNodes].some(n => n.nodeType === 3 && pattern.test(n.textContent));
      const visible = el => { const box = el.getBoundingClientRect(); return box.width > 0 && box.height > 0 };
      for (const el of doc.querySelectorAll(${JSON.stringify(selector)})) {
        if (!visible(el) || !pattern.test(el.textContent)) continue;
        const hit = own(el) ? el : [...el.querySelectorAll('*')].find(child => visible(child) && own(child));
        if (hit) return hit;
      }
      return null })()`
    /* A re-render between resolving the element and asking for its platform
       fonts invalidates the DevTools node id ("Could not find node with given
       id"). Resolve the element again in that case; any other error, or a
       DOM that keeps changing, still fails the test. */
    let fonts
    for (let attempt = 1; ; attempt++) {
      if (attempt > 1) await cdp.send('DOM.getDocument', { depth: 0 })
      const { result } = await cdp.send('Runtime.evaluate', { expression })
      assert.ok(result.objectId, `no visible element with matching text for ${selector}`)
      try {
        const { nodeId } = await cdp.send('DOM.requestNode', { objectId: result.objectId })
        ;({ fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId }))
        break
      } catch (error) {
        if (attempt >= 5 || !/Could not find node/.test(String(error?.message))) throw error
      }
    }
    const { result: family } = await cdp.send('Runtime.evaluate', { expression: `getComputedStyle(${expression}).fontFamily`, returnByValue: true })
    return { fonts: fonts.map(font => font.familyName), family: family.value }
  }
  const stack = family => family.split(',').map(part => part.trim().replace(/^['"]|['"]$/g, ''))
  function assertDastkhatFirst(label, family, face = 'Dastkhat') {
    const families = stack(family)
    const index = families.findIndex(name => name === face)
    assert.ok(index >= 0, `${label}: ${face} missing from ${family}`)
    for (const name of families.slice(0, index)) assert.ok(LATIN_ONLY.has(name.toLowerCase()), `${label}: ${name} precedes ${face} in ${family}`)
  }
  async function assertSurface(label, root, selector, face = 'Dastkhat') {
    const { fonts, family } = await renderedFonts(root, selector)
    assertDastkhatFirst(label, family, face)
    assert.ok(fonts.includes(face), `${label}: rendered with ${fonts.join(', ')} (stack ${family})`)
    ok(label, `rendered ${fonts.join(' + ')}`)
  }
  async function assertInput(label, root, selector, face = 'Dastkhat') {
    const family = await page.evaluate(([root, selector]) => {
      const doc = new Function(`return ${root}`)()
      const input = [...doc.querySelectorAll(selector)].find(el => el.getBoundingClientRect().width > 0)
      return input && getComputedStyle(input).fontFamily
    }, [root, selector])
    assert.ok(family, `${label}: no visible ${selector}`)
    assertDastkhatFirst(label, family, face)
    ok(label, family)
  }
  const fontLoaded = (root, face) => page.evaluate(async ([root, face]) => {
    const doc = new Function(`return ${root}`)()
    await doc.fonts.ready
    return [...doc.fonts].some(font => font.family.replace(/['"]/g, '') === face && font.status === 'loaded')
  }, [root, face])

  /* --- site: Persian home ------------------------------------------------ */
  await page.goto(`${BASE}/fa/challenges`, { waitUntil: 'load' })
  await page.waitForFunction(() => document.documentElement.lang === 'fa' && document.querySelector('header'))
  await page.evaluate(() => document.fonts.ready)
  const csp = (await page.request.get(`${BASE}/fa/challenges`, { headers: { accept: 'text/html' } })).headers()['content-security-policy'] || ''
  assert.match(csp, /default-src 'self'/, 'site CSP present')
  assert.doesNotMatch(csp, /font-src/, 'no narrower font-src than default-src self')
  await assertSurface('site header (fa)', 'document', 'header a, header span, header button, header b')
  await assertSurface('site body copy (fa)', 'document', 'main p, main h1, main h2, main li, main span')
  await assertSurface('site buttons (fa)', 'document', 'button:not(header *), a.button:not(header *)')
  await assertInput('site inputs and selects (fa)', 'document', 'input, select')
  assert.ok(await fontLoaded('document', 'Dastkhat'), 'Dastkhat loaded in the site document')
  await capture('typography-site-fa')

  /* technical numbers: isolated LTR, tabular digits, Latin glyphs */
  const numeric = await page.evaluate(() => {
    const probe = Object.assign(document.createElement('span'), { className: 'ds-num', textContent: '0x1f2e…9a 12,345.67' })
    document.body.append(probe)
    const style = getComputedStyle(probe)
    const result = { direction: style.direction, bidi: style.unicodeBidi, numeric: style.fontVariantNumeric, text: probe.textContent }
    probe.remove(); return result
  })
  assert.deepEqual(numeric, { direction: 'ltr', bidi: 'isolate', numeric: 'tabular-nums', text: '0x1f2e…9a 12,345.67' })
  ok('technical numbers are LTR-isolated, tabular and unchanged')

  /* --- Arabic: Dastkhat Arabic for Arabic letters ------------------------ */
  await page.goto(`${BASE}/ar/challenges`, { waitUntil: 'load' })
  await page.waitForFunction(() => document.documentElement.lang === 'ar' && document.querySelector('main'))
  await page.evaluate(() => document.fonts.ready)
  await assertSurface('site body copy (ar)', 'document', 'main p, main h1, main h2, main li, main span', 'Dastkhat Arabic')
  await capture('typography-site-ar')

  /* --- terminal iframe --------------------------------------------------- */
  await page.goto(`${BASE}/fa/prop/trade`, { waitUntil: 'domcontentloaded' })
  const frameRoot = "document.querySelector('iframe[srcdoc]').contentDocument"
  await page.waitForFunction(root => { try { const doc = new Function(`return ${root}`)(); return doc && doc.readyState === 'complete' && doc.querySelector('button') } catch { return false } }, frameRoot, { timeout: 30000 })
  await page.waitForFunction(root => new Function(`return ${root}`)().fonts.ready.then(() => true), frameRoot)
  assert.equal(await page.evaluate(root => new Function(`return ${root}`)().documentElement.lang, frameRoot), 'fa')
  await assertSurface('terminal iframe text (fa)', frameRoot, 'span, b, strong, label, h2, h3, div, p')
  await assertSurface('terminal iframe buttons (fa)', frameRoot, 'button')
  await assertInput('terminal iframe inputs (fa)', frameRoot, 'input, select')
  assert.ok(await fontLoaded(frameRoot, 'Dastkhat'), 'Dastkhat loaded inside the terminal iframe')
  await capture('typography-terminal-fa')

  /* --- Backstage --------------------------------------------------------- */
  const backstageUrl = `http://127.0.0.1:${BACKSTAGE_PORT}`
  await page.goto(backstageUrl)
  await page.evaluate(() => localStorage.setItem('backstage-language', 'fa'))
  await page.reload({ waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'fa')
  assert.match((await page.request.get(backstageUrl)).headers()['content-security-policy'] || '', /font-src 'self'/)
  await assertSurface('Backstage text (fa)', 'document', 'h1, h2, p, label, span, strong, a')
  await assertSurface('Backstage buttons (fa)', 'document', 'button')
  await assertInput('Backstage inputs (fa)', 'document', 'input, select')
  assert.ok(await fontLoaded('document', 'Dastkhat'), 'Dastkhat loaded in Backstage')
  await capture('typography-backstage-fa')

  /* --- requests and policy ---------------------------------------------- */
  const cspViolations = (await page.evaluate(() => window.__cspViolations || [])).filter(fontViolation)
  assert.deepEqual([...violations, ...cspViolations], [], 'no font CSP violations or failed font requests')
  assert.ok(fontResponses.length >= 3, `Dastkhat requests observed: ${fontResponses.length}`)
  for (const response of fontResponses) {
    assert.ok([200, 304].includes(response.status), `${response.url} -> ${response.status}`)
    if (response.status === 200) assert.equal(response.type, 'font/woff2', response.url)
  }
  const origins = new Set(fontResponses.map(response => new URL(response.url).origin))
  assert.ok(origins.has(new URL(BASE).origin) && origins.has(backstageUrl), `font origins: ${[...origins].join(', ')}`)
  ok('font requests succeeded from the site and Backstage origins', `${fontResponses.length} responses`)
  process.stdout.write(`\n${checks.length} typography checks passed\n`)
} finally {
  await browser.close()
  await new Promise(resolve => backstage.close(resolve))
}
