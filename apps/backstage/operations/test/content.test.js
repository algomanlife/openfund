import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createServer, request } from 'node:http'
import { test } from 'node:test'
import { createContentApi, PROTECTED_FIELD } from '../content.js'
import { createVerifier } from '../password.js'
import { createBackstage } from '../server.js'

const registry = JSON.parse(readFileSync(new URL('../../content-registry.json', import.meta.url), 'utf8'))
const homeRecord = registry.records.find(r => r.locations.some(l => l.page === 'home'))
const CMS = 'http://cms.example.test'

/* in-memory Directus: one ui_messages row for the home record, one home_content singleton */
function fakeDirectus() {
  const calls = []
  const state = {
    message: { id: 7, key: homeRecord.key, status: 'draft', translations: [{ id: 70, language_code: 'en', value: homeRecord.en }] },
    home: { id: 1, translations: [{ id: 11, language_code: 'en', headline: 'All markets, {count} platform' }, { id: 12, language_code: 'fa', headline: 'همه بازارها' }] },
  }
  const fetchImpl = async (url, init = {}) => {
    const target = new URL(url)
    const body = init.body ? JSON.parse(init.body) : undefined
    calls.push({ path: target.pathname, search: decodeURIComponent(target.search), method: init.method || 'GET', body, auth: init.headers?.Authorization })
    const json = data => ({ ok: true, status: 200, json: async () => ({ data }), body: null })
    if (target.pathname === '/items/ui_messages') return json([state.message])
    if (target.pathname === '/items/home_content') return json(state.home)
    return json({ ok: true })
  }
  return { calls, fetchImpl, state }
}

test('catalog comes from the generated registry and excludes forbidden collections', async () => {
  const api = createContentApi({ cms: CMS, token: null, fetchImpl: fakeDirectus().fetchImpl })
  const catalog = await api.catalog()
  assert.equal(catalog.routes.length, registry.editorial.routes.length)
  assert.ok(catalog.forbidden.includes('challenge_plans'))
  assert.ok(!catalog.surfaces.some(s => catalog.forbidden.includes(s.collection)))
  for (const surface of catalog.surfaces)
    for (const field of surface.textFields)
      assert.ok(!PROTECTED_FIELD.test(field), `${surface.collection}.${field} is a text field that the guard would hide`)
})

test('fields lists route copy with Directus state; without a token reads are public and writes refused', async () => {
  const directus = fakeDirectus()
  const readOnly = createContentApi({ cms: CMS, token: null, fetchImpl: directus.fetchImpl })
  const page = await readOnly.fields({ view: 'home', locale: 'en' })
  assert.equal(page.writable, false)
  assert.ok(page.fields.some(f => f.key === homeRecord.key && f.status === 'draft' && f.translationId === 70))
  assert.equal(directus.calls[0].auth, undefined, 'no token is sent when none is configured')
  await assert.rejects(readOnly.prepareSave({ kind: 'message', key: homeRecord.key, locale: 'en', value: 'x' }), /content_writes_disabled/)
  await assert.rejects(readOnly.fields({ view: 'home', locale: 'de' }), /invalid_locale/)
  await assert.rejects(readOnly.fields({ view: 'nope', locale: 'en' }), /route_not_found/)
})

test('message saves update or create the locale translation and enforce plain text and placeholders', async () => {
  const directus = fakeDirectus()
  const api = createContentApi({ cms: CMS, token: 'directus-static-token-0123', fetchImpl: directus.fetchImpl })
  const update = await api.prepareSave({ kind: 'message', key: homeRecord.key, locale: 'en', value: ` ${homeRecord.en} (edited) ` })
  assert.deepEqual(update.body, { value: `${homeRecord.en} (edited)` })
  assert.equal(update.path, '/items/ui_message_translations/70')
  const create = await api.prepareSave({ kind: 'message', key: homeRecord.key, locale: 'ar', value: 'نص' })
  assert.equal(create.path, '/items/ui_messages/7')
  assert.deepEqual(create.body, { translations: { create: [{ language_code: 'ar', value: 'نص' }] } })
  await assert.rejects(api.prepareSave({ kind: 'message', key: homeRecord.key, locale: 'en', value: '<b>bold</b>' }), /markup_not_allowed/)
  await assert.rejects(api.prepareSave({ kind: 'message', key: homeRecord.key, locale: 'en', value: 'Hello {name}' }), /placeholder_mismatch/)
  await assert.rejects(api.prepareSave({ kind: 'message', key: 'react.0000000000000000', locale: 'en', value: 'x' }), /key_not_registered/)
  await assert.rejects(api.prepareSave({ kind: 'message', key: '../../x', locale: 'en', value: 'x' }), /invalid_key/)
})

test('surface saves are limited to registered text fields; financial collections and protected fields are refused', async () => {
  const directus = fakeDirectus()
  const api = createContentApi({ cms: CMS, token: 'directus-static-token-0123', fetchImpl: directus.fetchImpl })
  const write = await api.prepareSave({ kind: 'surface', collection: 'home_content', field: 'headline', locale: 'fa', value: 'همه بازارها، {count} پلتفرم' })
  assert.deepEqual([write.path, write.body], ['/items/home_content_translations/12', { headline: 'همه بازارها، {count} پلتفرم' }])
  await assert.rejects(api.prepareSave({ kind: 'surface', collection: 'home_content', field: 'headline', locale: 'fa', value: 'بدون جای‌خالی' }), /placeholder_mismatch/)
  await assert.rejects(api.prepareSave({ kind: 'surface', collection: 'challenge_plans', field: 'name', locale: 'en', value: 'x' }), /collection_forbidden/)
  await assert.rejects(api.prepareSave({ kind: 'surface', collection: 'coupons', field: 'name', locale: 'en', value: 'x' }), /collection_forbidden/)
  await assert.rejects(api.prepareSave({ kind: 'surface', collection: 'home_content', field: 'prop_cta_destination', locale: 'en', value: 'https://evil.example' }), /field_protected/)
  await assert.rejects(api.prepareSave({ kind: 'surface', collection: 'home_content', field: 'prop_image', locale: 'en', value: 'x' }), /field_not_editable/)
  await assert.rejects(api.prepareSave({ kind: 'surface', collection: 'support_messages', field: 'subject', locale: 'en', value: 'x' }), /collection_not_editorial/)
  await assert.rejects(api.prepareStatus({ collection: 'home_content', status: 'published' }), /singleton_has_no_status/)
  const status = await api.prepareStatus({ collection: 'ui_messages', key: homeRecord.key, status: 'published' })
  assert.deepEqual([status.path, status.body], ['/items/ui_messages/7', { status: 'published' }])
  await assert.rejects(api.prepareStatus({ collection: 'ui_messages', key: homeRecord.key, status: 'archived' }), /invalid_status/)
})

test('Backstage content routes: session, CSRF, password re-entry and region gate guard every write', async t => {
  const directus = fakeDirectus()
  let region = 'GLOBAL'
  const upstream = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(req.url === '/runtime/status' ? { region, mode: 'GLOBAL_CONNECTED' } : {}))
  })
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
  const password = randomBytes(18).toString('base64url')
  const origin = 'https://backstage.example.test'
  const server = createBackstage({ origin, backend: 'http://127.0.0.1:' + upstream.address().port, cms: CMS, owner: 'owner-fixture',
    credential: randomBytes(32).toString('hex'), verifier: await createVerifier(password), contentToken: 'directus-static-token-0123' },
  { audit: () => {}, contentFetch: directus.fetchImpl })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { server.close(); upstream.close() })
  const local = 'http://127.0.0.1:' + server.address().port
  const call = (path, body, headers = {}) => new Promise((resolve, reject) => {
    const req = request(local + path, { method: body ? 'POST' : 'GET',
      headers: { Host: new URL(origin).host, ...(body && { Origin: origin, 'Content-Type': 'application/json' }), ...headers } }, async res => {
      const parts = []; for await (const part of res) parts.push(part)
      resolve({ status: res.statusCode, csp: res.headers['content-security-policy'], cookie: res.headers['set-cookie']?.[0], body: JSON.parse(Buffer.concat(parts)) })
    })
    req.on('error', reject); req.end(body ? JSON.stringify(body) : undefined)
  })
  assert.equal((await call('/api/content/catalog')).status, 401)
  const login = await call('/api/login', { username: 'owner-fixture', password })
  const headers = { Cookie: login.cookie.split(';')[0], 'X-CSRF-Token': login.body.csrf }
  const catalog = await call('/api/content/catalog', undefined, headers)
  assert.equal(catalog.body.writable, true)
  assert.match(catalog.csp, /frame-src http:\/\/127\.0\.0\.1:\d+;/)
  assert.match(catalog.csp, /frame-ancestors 'none'/)
  const save = { kind: 'message', key: homeRecord.key, locale: 'en', value: homeRecord.en + ' (edited)', password }
  assert.equal((await call('/api/content/save', save, { Cookie: headers.Cookie })).status, 403, 'CSRF token required')
  assert.equal((await call('/api/content/save', { ...save, password: 'wrong-password-xx' }, headers)).status, 401)
  assert.equal((await call('/api/content/save', { ...save, value: '<script>x</script>' }, headers)).body.error, 'markup_not_allowed')
  region = 'IRAN'
  assert.equal((await call('/api/content/save', save, headers)).body.error, 'wrong_region')
  region = 'GLOBAL'
  const before = directus.calls.filter(c => c.method === 'PATCH').length
  assert.equal((await call('/api/content/save', save, headers)).status, 200)
  const patch = directus.calls.filter(c => c.method === 'PATCH').at(-1)
  assert.equal(directus.calls.filter(c => c.method === 'PATCH').length, before + 1)
  assert.deepEqual([patch.path, patch.body], ['/items/ui_message_translations/70', { value: homeRecord.en + ' (edited)' }])
  assert.equal(patch.auth, 'Bearer directus-static-token-0123')
  assert.equal((await call('/api/content/status', { collection: 'ui_messages', key: homeRecord.key, status: 'published', password }, headers)).status, 200)
  assert.equal((await call('/api/content/save', { kind: 'surface', collection: 'payments', field: 'note', locale: 'en', value: 'x', password }, headers)).status, 403)
})

test('content lifecycle: create drafts, archive, reorder, mailbox editor and media validation', async () => {
  const registryPath = new URL('../../content-registry.json', import.meta.url)
  const writes = []
  const api = createContentApi({ cms: 'https://cms.example.test', token: 'x'.repeat(32), registryPath, fetchImpl: async (url, init = {}) => {
    writes.push({ url: String(url), method: init.method })
    return { ok: true, status: 200, json: async () => ({ data: String(url).includes('/folders') ? [{ id: 'f0' }] : String(url).includes('/files') ? { id: 'file-1' } : {} }) }
  } })
  const created = await api.prepareCreate({ collection: 'faqs', slug: 'new-question', copy: { fa: { question: 'پرسش تازه', answer: 'پاسخ' }, en: { question: 'A new question', answer: 'Answer' } } })
  assert.deepEqual([created.method, created.path, created.body.status, created.body.slug], ['POST', '/items/faqs', 'draft', 'new-question'])
  assert.equal(created.body.translations.length, 2)
  await assert.rejects(api.prepareCreate({ collection: 'faqs', copy: { fa: { question: 'x' }, en: {} } }), /copy_required/)
  await assert.rejects(api.prepareCreate({ collection: 'faqs', slug: 'Bad Slug', copy: {} }), /invalid_slug/)
  await assert.rejects(api.prepareCreate({ collection: 'home_content', copy: {} }), /singleton_has_no_items/)
  await assert.rejects(api.prepareCreate({ collection: 'purchase_orders', copy: {} }), /collection_forbidden|collection_not_editorial/)
  await assert.rejects(api.prepareCreate({ collection: 'faqs', copy: { fa: { question: '<b>x</b>' }, en: { question: 'y' } } }), /markup_not_allowed/)
  const archived = await api.prepareStatus({ collection: 'faqs', item: '12', status: 'archived' })
  assert.deepEqual(archived.body, { status: 'archived' })
  const moved = await api.prepareReorder({ collection: 'faqs', item: '12', to: '3' })
  assert.deepEqual([moved.method, moved.path, moved.body], ['POST', '/utils/sort/faqs', { item: '12', to: '3' }])
  await assert.rejects(api.prepareReorder({ collection: 'faqs', item: '1', to: '1' }), /invalid_item/)
  const mail = await api.prepareProtected({ field: 'support_email', value: ' Support@Openfi.cloud ' })
  assert.deepEqual(mail.body, { support_email: 'support@openfi.cloud' })
  assert.deepEqual((await api.prepareProtected({ field: 'legal_email', value: '' })).body, { legal_email: null }, 'clearing unpublishes the address')
  await assert.rejects(api.prepareProtected({ field: 'support_email', value: 'not an address' }), /invalid_email/)
  await assert.rejects(api.prepareProtected({ field: 'payment_receiver', value: 'a@b.co' }), /field_protected/)
  await assert.rejects(api.upload({ filename: 'x.png', contentType: 'image/svg+xml', data: Buffer.from('<svg/>').toString('base64') }), /invalid_image/)
  await assert.rejects(api.upload({ filename: 'x.png', contentType: 'image/png', data: Buffer.from('GIF89a').toString('base64') }), /invalid_image/)
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)])
  assert.equal((await api.upload({ filename: 'chart.png', contentType: 'image/png', data: png.toString('base64') })).id, 'file-1')
})
