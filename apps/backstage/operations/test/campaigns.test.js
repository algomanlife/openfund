/* Backstage Marketing validation (campaigns.js): safe destinations, plain
 * text, enums, publication rules, the coupon reference, image signatures,
 * and the Directus writes it performs (with a recorded fake Directus). */
import test from 'node:test'
import assert from 'node:assert/strict'
import { safeCtaUrl, normalizeCampaign, publishProblems, createCampaignsApi } from '../campaigns.js'

const base = () => ({ internal_name: 'spring-promo', placement: 'modal', template: 'split', locales: ['fa', 'en'], regions: ['GLOBAL'], pages: ['home'],
  cta_url: '/en/checkout', coupon_code: 'openfund20', translations: [
    { language_code: 'en', headline: '20% off', body: 'Limited time', cta_label: 'Buy' },
    { language_code: 'fa', headline: '۲۰٪ تخفیف', cta_label: 'خرید' }] })

test('destinations: https without credentials or a same-site path; nothing else', () => {
  assert.equal(safeCtaUrl('https://openfi.live/'), 'https://openfi.live/')
  assert.equal(safeCtaUrl('/fa/checkout?plan=standard'), '/fa/checkout?plan=standard')
  assert.equal(safeCtaUrl(''), null)
  for (const bad of ['javascript:alert(1)', 'http://openfi.live', '//evil.test', '/\\evil.test', 'https://u:p@x.test', 'data:text/html,x', 'https://x.test/a b', 'ftp://x.test'])
    assert.throws(() => safeCtaUrl(bad), /invalid_cta_url/, bad)
})

test('normalization: enums, plain text, coupon reference and schedule', () => {
  const c = normalizeCampaign(base())
  assert.equal(c.coupon_code, 'OPENFUND20')
  assert.equal(c.delay_seconds, 12)
  assert.equal(c.style, null)
  assert.throws(() => normalizeCampaign({ ...base(), placement: 'popup' }), /invalid_placement/)
  assert.throws(() => normalizeCampaign({ ...base(), locales: ['de'] }), /invalid_locales/)
  assert.throws(() => normalizeCampaign({ ...base(), regions: [] }), /invalid_regions/)
  assert.throws(() => normalizeCampaign({ ...base(), internal_name: 'Bad Name' }), /invalid_name/)
  assert.throws(() => normalizeCampaign({ ...base(), translations: [{ language_code: 'en', headline: '<b>hi</b>' }] }), /invalid_copy/)
  assert.throws(() => normalizeCampaign({ ...base(), translations: [{ language_code: 'en', headline: 'x'.repeat(141) }] }), /invalid_copy/)
  assert.throws(() => normalizeCampaign({ ...base(), coupon_code: 'no spaces!' }), /invalid_coupon_code/)
  assert.throws(() => normalizeCampaign({ ...base(), starts_at: '2030-01-02', ends_at: '2030-01-01' }), /invalid_schedule/)
  assert.throws(() => normalizeCampaign({ ...base(), delay_seconds: 0 }), /invalid_delay/)
  assert.throws(() => normalizeCampaign({ ...base(), cta_url: null }), /cta_needs_url/)
})

test('publication needs copy and a button label in every eligible locale and a promotable coupon', () => {
  const c = normalizeCampaign(base())
  assert.deepEqual(publishProblems(c, true), [])
  assert.deepEqual(publishProblems(c, false), ['coupon_not_promotable'])
  const missing = normalizeCampaign({ ...base(), locales: ['fa', 'en', 'ar'] })
  assert.deepEqual(publishProblems(missing, true), ['missing_copy:ar'])
  const noLabel = normalizeCampaign({ ...base(), translations: [{ language_code: 'en', headline: 'x', cta_label: 'Buy' }, { language_code: 'fa', headline: 'y' }] })
  assert.deepEqual(publishProblems(noLabel, true), ['missing_cta_label:fa'])
})

function fakeDirectus() {
  const calls = [], items = new Map([[5, { id: 5, translations: [{ id: 50, language_code: 'en' }, { id: 51, language_code: 'ar' }] }]])
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url), body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
    calls.push({ method: init.method ?? 'GET', path: u.pathname, search: u.search, body, auth: init.headers?.Authorization })
    const ok = data => ({ ok: true, status: 200, json: async () => ({ data }) })
    if (u.pathname === '/folders') return ok([{ id: '22222222-2222-4222-8222-222222222222' }])
    if (u.pathname === '/files') return ok({ id: '11111111-1111-4111-8111-111111111111' })
    if (init.method === 'POST') return ok({ id: 6 })
    if (init.method === 'PATCH') return ok({ id: 5 })
    return ok(items.get(Number(u.pathname.split('/').pop())) ?? [])
  }
  return { calls, fetchImpl }
}

test('save: refuses publication with an invalid coupon before touching Directus; drafts and updates write exactly the changed translations', async () => {
  const d = fakeDirectus()
  let promotable = false
  const api = createCampaignsApi({ cms: 'https://cms.example.test', token: 'directus-token-for-tests', fetchImpl: d.fetchImpl,
    backend: async path => (path.startsWith('/admin/campaigns/coupons/') ? { promotable } : {}) })
  await assert.rejects(api.prepareSave({ status: 'published', campaign: base() }), e => e.message === 'publish_blocked' && e.details.includes('coupon_not_promotable'))
  assert.equal(d.calls.length, 0)
  const draft = await api.prepareSave({ status: 'draft', campaign: base() })
  assert.equal(await draft.apply(), 6)
  assert.equal(d.calls[0].method, 'POST'); assert.equal(d.calls[0].body.status, 'draft'); assert.equal(d.calls[0].auth, 'Bearer directus-token-for-tests')
  promotable = true
  const update = await api.prepareSave({ id: 5, status: 'published', campaign: base() })
  await update.apply()
  const patch = d.calls.find(c => c.method === 'PATCH')
  assert.equal(patch.path, '/items/site_campaigns/5')
  assert.deepEqual(patch.body.translations.update.map(t => [t.id, t.language_code, t.headline]), [[50, undefined, '20% off']], 'existing rows: id and copy only')
  assert.deepEqual(patch.body.translations.create.map(t => t.language_code), ['fa'])
  assert.equal(patch.body.translations.delete, undefined, 'no deletes: the ar copy stays stored but is not eligible')
})

test('uploads: PNG, JPEG or WebP by signature, at most 3 MB', async () => {
  const d = fakeDirectus()
  const api = createCampaignsApi({ cms: 'https://cms.example.test', token: 'directus-token-for-tests', fetchImpl: d.fetchImpl, backend: async () => ({}) })
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
  assert.deepEqual(await api.upload({ filename: 'hero.png', contentType: 'image/png', data: png.toString('base64') }), { id: '11111111-1111-4111-8111-111111111111' })
  await assert.rejects(api.upload({ filename: 'x.png', contentType: 'image/png', data: Buffer.from('<svg/>').toString('base64') }), /invalid_image/)
  await assert.rejects(api.upload({ filename: 'x.svg', contentType: 'image/svg+xml', data: png.toString('base64') }), /invalid_image/)
  await assert.rejects(api.upload({ filename: '../x.png', contentType: 'image/png', data: png.toString('base64') }), /invalid_image/)
  await assert.rejects(api.upload({ filename: 'big.png', contentType: 'image/png', data: Buffer.concat([png, Buffer.alloc(3 * 1024 * 1024)]).toString('base64') }), /invalid_image/)
})
