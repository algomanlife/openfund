/* Backstage Content workspace — browser acceptance against a DISPOSABLE
 * Directus 11.17.4 (seeded with bootstrap-cms.sh + seed_interface_content.py,
 * plus register_backstage_editor.py) and a local Openfund site whose
 * CSP_EXTRA_FRAME_ANCESTORS includes the Backstage origin used here.
 *
 *   DIRECTUS_URL=http://localhost:8055 BACKSTAGE_DIRECTUS_TOKEN=<editor user token> \
 *   TEST_BACKEND_URL=http://localhost:8080 ADMIN_API_TOKEN=<local admin token> \
 *   node e2e/test-backstage-content.mjs
 *
 * Every edit is reverted at the end. Loopback origins only. */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createBackstage } from '../apps/backstage/operations/server.js'
import { createVerifier } from '../apps/backstage/operations/password.js'

const cms = new URL(process.env.DIRECTUS_URL || 'http://localhost:8055')
const site = new URL(process.env.TEST_BACKEND_URL || 'http://localhost:8080')
const loopback = url => ['localhost', '127.0.0.1'].includes(url.hostname)
const editorToken = process.env.BACKSTAGE_DIRECTUS_TOKEN
if (!loopback(cms) || !loopback(site) || !editorToken || !process.env.ADMIN_API_TOKEN)
  throw new Error('Content workspace acceptance requires a disposable local Directus, a local site and test tokens')
const port = Number(process.env.BACKSTAGE_TEST_PORT || 8400)
const origin = 'http://localhost:' + port
const owner = 'content-owner'
const password = randomBytes(20).toString('base64url')
const server = createBackstage({ origin, backend: site.origin, cms: cms.origin, owner, realSettlement: false,
  verifier: await createVerifier(password), credential: process.env.ADMIN_API_TOKEN, contentToken: editorToken })
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))

const directus = async (path, init = {}) => {
  const response = await fetch(new URL(path, cms), { ...init, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + editorToken, ...init.headers } })
  return response.status === 204 ? null : response.json()
}
const publicRead = async path => (await (await fetch(new URL(path, cms))).json()).data
let browser, restore = []
try {
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const capture = async name => {
    if (!process.env.OUTPUT_DIR) return
    await mkdir(process.env.OUTPUT_DIR, { recursive: true })
    await page.screenshot({ path: join(process.env.OUTPUT_DIR, name + '.png'), fullPage: false })
  }
  const confirm = async ({ expectClose = true } = {}) => {
    await page.getByRole('dialog').getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('dialog').getByRole('button', { name: /^(Save|Confirm decision)$/ }).click()
    if (expectClose) await page.getByRole('dialog').waitFor({ state: 'hidden' })
  }
  const rowWith = text => page.locator('table tbody tr').filter({ hasText: text })

  await page.goto(origin)
  await page.getByLabel('Owner identity').fill(owner)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.locator('aside').getByRole('link', { name: 'Content workspace' }).click()
  await page.getByRole('heading', { name: 'Content workspace', level: 1 }).waitFor()

  /* step 1-2: page and language; the preview frames the public site read-only */
  await page.getByRole('combobox', { name: '1. Page' }).selectOption('home')
  await page.getByRole('combobox', { name: '2. Language' }).selectOption('en')
  const preview = page.frameLocator('.content-preview iframe')
  await preview.locator('body').waitFor({ timeout: 30000 })
  await page.waitForTimeout(3000)
  assert.equal(await preview.locator('[data-directus]').count(), 0, 'the Backstage preview never receives editing attributes')
  const visual = await page.getByRole('link', { name: 'Visual mode in Directus Studio' }).getAttribute('href')
  assert.ok(visual.startsWith(cms.origin + '/admin/visual/' + site.origin + '/en/home'))
  await capture('backstage-content-en')

  /* step 3: interface copy row with Directus state */
  const firstRow = page.locator('table tbody tr').filter({ has: page.getByRole('button', { name: 'Edit' }) }).first()
  await firstRow.waitFor()
  const english = (await firstRow.locator('td').first().innerText()).trim()
  const message = (await directus(`/items/ui_messages?fields=id,key,status,translations.id,translations.language_code,translations.value&filter=${encodeURIComponent(JSON.stringify({ translations: { value: { _eq: english } } }))}&limit=1`)).data[0]
  assert.ok(message, 'row maps to a Directus ui_messages record')
  const translation = message.translations.find(t => t.language_code === 'en')
  restore.push(() => directus(`/items/ui_message_translations/${translation.id}`, { method: 'PATCH', body: JSON.stringify({ value: translation.value }) }))
  restore.push(() => directus(`/items/ui_messages/${message.id}`, { method: 'PATCH', body: JSON.stringify({ status: message.status }) }))

  /* plain text is enforced server-side */
  await firstRow.getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('dialog').getByLabel('Value in this language').fill('<b>bold</b>')
  await confirm({ expectClose: false })
  await page.getByRole('dialog').getByText('Use plain text without HTML.').waitFor()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

  /* step 4: save, then publish, then move back to draft */
  const edited = `${english} (launch rehearsal)`
  await firstRow.getByRole('button', { name: 'Edit' }).click()
  await page.getByRole('dialog').getByLabel('Value in this language').fill(edited)
  await confirm()
  await rowWith(edited).waitFor()
  assert.equal((await directus(`/items/ui_message_translations/${translation.id}?fields=value`)).data.value, edited)
  if (message.status !== 'published') {
    assert.equal((await publicRead(`/items/ui_messages?filter[id][_eq]=${message.id}&fields=id`)).length, 0, 'saved draft stays off the public API')
    await rowWith(edited).getByRole('button', { name: 'Publish' }).click()
    await confirm()
    await rowWith(edited).getByRole('button', { name: 'Move to draft' }).waitFor()
    const published = await publicRead(`/items/ui_messages?filter[id][_eq]=${message.id}&fields=id,translations.language_code,translations.value`)
    assert.equal(published[0]?.translations.find(t => t.language_code === 'en')?.value, edited, 'published value is public on the next fetch')
    await rowWith(edited).getByRole('button', { name: 'Move to draft' }).click()
    await confirm()
    await rowWith(edited).getByRole('button', { name: 'Publish' }).waitFor()
    assert.equal((await publicRead(`/items/ui_messages?filter[id][_eq]=${message.id}&fields=id`)).length, 0)
  }

  /* structured surface: home_content text fields only, no destinations */
  await page.getByRole('button', { name: 'home_content' }).click()
  await page.getByRole('cell', { name: 'headline', exact: true }).waitFor()
  assert.equal(await page.getByRole('cell', { name: /destination/ }).count(), 0, 'destination fields are not listed')

  /* Persian UI renders RTL with technical values LTR */
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('fa')
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl')
  await page.getByRole('heading', { name: 'میز کار محتوا', level: 1 }).waitFor()
  await capture('backstage-content-fa')
  assert.deepEqual(errors, [])
  console.log('Backstage Content workspace browser acceptance passed.')
} finally {
  for (const undo of restore.reverse()) await undo().catch(() => {})
  await browser?.close()
  server.close()
}
