/* Visual-editing protocol rehearsal against a DISPOSABLE Directus 11.17.4 and a
 * local Openfund site (ADR 0038). Loopback origins only; never production.
 *   DIRECTUS_URL=http://localhost:8055 SITE_URL=http://localhost:8080 \
 *   DIRECTUS_ADMIN_EMAIL=... DIRECTUS_ADMIN_PASSWORD=... [OUTPUT_DIR=...] \
 *   node apps/backstage/upgrade/visual-editing-check.mjs
 * Requires the site's CMS_PUBLIC_URL to be the Directus origin, Directus
 * CONTENT_SECURITY_POLICY_DIRECTIVES__CHILD_SRC to include the site origin, and
 * the site origin listed in Directus Settings -> Visual Editor URLs. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const { chromium } = createRequire(new URL('../../../package.json', import.meta.url))('playwright')
const CMS = new URL(process.env.DIRECTUS_URL || 'http://localhost:8055').origin
const SITE = new URL(process.env.SITE_URL || 'http://localhost:8080').origin
for (const origin of [CMS, SITE]) if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  throw new Error('The visual-editing rehearsal runs against disposable loopback instances only')
const EMAIL = process.env.DIRECTUS_ADMIN_EMAIL, PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD
if (!EMAIL || !PASSWORD) throw new Error('DIRECTUS_ADMIN_EMAIL and DIRECTUS_ADMIN_PASSWORD are required')
const OUT = process.env.OUTPUT_DIR
if (OUT) mkdirSync(OUT, { recursive: true })
const shot = (page, name) => OUT ? page.screenshot({ path: OUT + '/' + name + '.png' }) : null
const results = []
const ok = (name, value) => { assert.ok(value, name); results.push(name); console.log('PASS -', name) }

const login = await (await fetch(CMS + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })).json()
const admin = { Authorization: 'Bearer ' + login.data.access_token, 'Content-Type': 'application/json' }
const browser = await chromium.launch()
try {
  /* 1. anonymous visitors: no editing attributes, no editor chrome */
  const visitor = await browser.newPage()
  await visitor.goto(SITE + '/en/home')
  await visitor.waitForTimeout(4000)
  ok('anonymous visitor page has no data-directus attributes', await visitor.locator('[data-directus]').count() === 0)
  ok('anonymous visitor page has no editing style', await visitor.locator('#of-visual-editing-style').count() === 0)

  /* 2. Studio visual editor: connect → confirm → attributes in the framed site */
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const studio = await context.newPage()
  await studio.goto(CMS + '/admin/login')
  await studio.getByPlaceholder('Email').fill(EMAIL)
  await studio.getByPlaceholder('Password').fill(PASSWORD)
  await studio.keyboard.press('Enter')
  await studio.waitForURL(url => !String(url).includes("/login"), { timeout: 30000 })
  await studio.goto(CMS + '/admin/visual/' + SITE + '/en/')
  let frame
  for (let i = 0; i < 40 && !frame; i++) { frame = studio.frames().find(f => f.url().startsWith(SITE)); if (!frame) await studio.waitForTimeout(500) }
  ok('Studio frames the site origin (CSP child-src/frame-src + site frame-ancestors)', !!frame)
  await frame.waitForSelector('[data-directus]', { timeout: 30000 })
  const attrs = await frame.locator('[data-directus]').evaluateAll(els => els.map(e => e.getAttribute('data-directus')))
  ok('confirm from the CMS origin attached data-directus attributes in the framed site', attrs.length > 0)
  ok('every attribute references an allowed editorial collection', attrs.every(a => !/collection:(challenge_plans|orders|payments|payment_events|wallets|positions|coupons|directus_users|gov_proposals|gov_votes|payouts|ledger_entries);/.test(a)))
  await shot(studio, 'studio-visual-editor')

  /* 3. edit: clicking an activated element sends `edit`; Studio opens its editor */
  await studio.evaluate(site => {
    window.__ofEdits = []
    window.addEventListener('message', event => {
      if (event.origin === site) window.__ofEdits.push({ action: event.data?.action, data: event.data?.data })
    })
  }, SITE)
  const target = frame.locator('[data-of-activated][data-directus*="collection:ui_message_translations"]').filter({ visible: true }).nth(3)
  await target.waitFor({ timeout: 20000 })
  await target.scrollIntoViewIfNeeded()
  await target.click()
  await studio.waitForTimeout(2500)
  const all = await studio.evaluate(() => window.__ofEdits)
  const edits = all.filter(m => m.action === 'edit').map(m => m.data)
  ok('clicking an activated element posts `edit` to Studio with its collection/item/field', edits.length > 0 &&
    edits[0].editConfig?.collection === 'ui_message_translations' && edits[0].editConfig?.fields?.includes('value'))
  const popover = await studio.locator('.v-form, input, textarea').filter({ visible: true }).count()
  ok('Studio renders an edit form for the clicked field', popover > 0)
  await shot(studio, 'studio-edit-popover')

  /* 4. draft stays off the public API; publish appears on the next fetch without a rebuild */
  const marker = 'Launch rehearsal ' + Date.now()
  const draft = await (await fetch(CMS + '/items/ui_messages', { method: 'POST', headers: admin, body: JSON.stringify({
    key: 'rehearsal.' + Date.now(), namespace: 'react', status: 'draft', translations: [{ language_code: 'en', value: marker }, { language_code: 'fa', value: marker }] }) })).json()
  const publicDraft = await (await fetch(`${CMS}/items/ui_messages?filter[id][_eq]=${draft.data.id}&fields=id`)).json()
  ok('a draft ui_message is invisible to the public API', publicDraft.data.length === 0)
  const translation = (await (await fetch(`${CMS}/items/ui_message_translations?filter[language_code][_eq]=en&filter[value][_eq]=Choose%20your%20path&fields=id,value`, { headers: admin })).json()).data[0]
  if (translation) {
    await fetch(`${CMS}/items/ui_message_translations/${translation.id}`, { method: 'PATCH', headers: admin, body: JSON.stringify({ value: 'Choose your path now' }) })
    const live = await (await fetch(`${CMS}/items/ui_message_translations/${translation.id}?fields=value`)).json()
    ok('a published edit is returned by the next public fetch (no rebuild)', live.data?.value === 'Choose your path now')
    await fetch(`${CMS}/items/ui_message_translations/${translation.id}`, { method: 'PATCH', headers: admin, body: JSON.stringify({ value: translation.value }) })
  }
  await fetch(`${CMS}/items/ui_messages/${draft.data.id}`, { method: 'DELETE', headers: admin })

  /* 5. financial collections refuse anonymous writes */
  const write = await fetch(CMS + '/items/challenge_plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: 'x' }) })
  ok('anonymous challenge_plans write is refused', [401, 403].includes(write.status))
  console.log(`Visual editing rehearsal on Directus 11.17.4: ${results.length} checks passed`)
} finally { await browser.close() }
