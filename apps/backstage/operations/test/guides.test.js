/* Backstage terminal guide (guides.js, ADR 0056): plain text, media rules,
 * publication checks, upload signatures, ordering, archive-not-delete, and
 * "publish new version" (with a recorded fake Directus). */
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeGuide, publishProblems, createGuidesApi, MAX_STEPS } from '../guides.js'

const F = n => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n.repeat(12)}`
const step = (extra = {}) => ({ media_kind: 'video', video_mp4: F('1'), video_webm: F('2'), poster: F('3'), subtitles_fa: F('4'), subtitles_en: F('5'),
  title_fa: 'کیف پول را وصل کنید', title_en: 'Connect your wallet', body_fa: 'متن', body_en: 'Body', ...extra })
const base = (extra = {}) => ({ internal_name: 'terminal-basics', regions: ['GLOBAL', 'IRAN'], cookie_days: 365, steps: [step(), step({ title_en: 'Open a position' })], ...extra })

test('normalization: order becomes sort, plain text only, fa and en titles required, bounded lifetime', () => {
  const g = normalizeGuide(base())
  assert.deepEqual(g.steps.map(s => s.sort), [1, 2])
  assert.deepEqual(g.pages, ['terminal'])
  assert.equal(g.cookie_days, 365)
  assert.throws(() => normalizeGuide(base({ steps: [step({ title_fa: '' })] })), /missing_copy/)
  assert.throws(() => normalizeGuide(base({ steps: [step({ body_en: '<img src=x onerror=1>' })] })), /invalid_copy/)
  assert.throws(() => normalizeGuide(base({ steps: [step({ poster: 'https://evil.test/x.jpg' })] })), /invalid_media/)
  assert.throws(() => normalizeGuide(base({ cookie_days: 0 })), /invalid_cookie_days/)
  assert.throws(() => normalizeGuide(base({ cookie_days: 731 })), /invalid_cookie_days/)
  assert.throws(() => normalizeGuide(base({ regions: ['MARS'] })), /invalid_regions/)
  assert.throws(() => normalizeGuide(base({ pages: ['home'] })), /invalid_pages/, 'a guide never leaves the terminal')
  assert.throws(() => normalizeGuide(base({ steps: Array.from({ length: MAX_STEPS + 1 }, () => step()) })), /too_many_steps/)
  const image = normalizeGuide(base({ steps: [step({ media_kind: 'image', image: F('6') })] })).steps[0]
  assert.equal(image.video_mp4, null, 'an image step keeps no video')
})

test('publication needs at least one step and complete media', () => {
  assert.deepEqual(publishProblems(normalizeGuide(base())), [])
  assert.deepEqual(publishProblems(normalizeGuide(base({ steps: [] }))), ['no_steps'])
  assert.deepEqual(publishProblems(normalizeGuide(base({ steps: [step({ video_mp4: null, video_webm: null, poster: null })] }))), ['missing_video:1', 'missing_poster:1'])
  assert.deepEqual(publishProblems(normalizeGuide(base({ steps: [step({ media_kind: 'image' })] }))), ['missing_image:1'])
})

function fakeDirectus() {
  const calls = []
  const guide = { id: 5, version: 3, status: 'published', active: true, steps: [{ id: 50, sort: 1, status: 'published', ...step() }, { id: 51, sort: 2, status: 'published', ...step() }] }
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url), body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
    calls.push({ method: init.method ?? 'GET', path: u.pathname, body })
    const ok = data => ({ ok: true, status: 200, json: async () => ({ data }) })
    if (u.pathname === '/folders') return ok([{ id: F('9') }])
    if (u.pathname === '/files') return ok({ id: F('7') })
    if (init.method === 'POST') return ok({ id: 6 })
    if (init.method === 'PATCH') return ok({ id: 5 })
    return ok(u.pathname === '/items/site_guides/5' ? guide : [guide])
  }
  return { calls, fetchImpl }
}

test('save: new guides start inactive; reordering updates sort; a step left out is archived, never deleted', async () => {
  const d = fakeDirectus()
  const api = createGuidesApi({ cms: 'https://cms.example.test', token: 'directus-token-for-tests', fetchImpl: d.fetchImpl, backend: async () => ({}) })
  await (await api.prepareSave({ status: 'draft', guide: base() })).apply()
  const created = d.calls.find(c => c.method === 'POST')
  assert.equal(created.body.active, false, 'activation is a separate, confirmed step')
  assert.equal(created.body.version, 1)
  /* reorder: 51 first, drop 50, add a new step */
  const update = await api.prepareSave({ id: 5, status: 'published', guide: base({ steps: [step({ id: 51 }), step({ title_en: 'New' })] }) })
  await update.apply()
  const patch = d.calls.find(c => c.method === 'PATCH')
  assert.deepEqual(patch.body.steps.update.map(s => [s.id, s.sort ?? null, s.status]), [[51, 1, 'published'], [50, null, 'archived']])
  assert.equal(patch.body.steps.create.length, 1)
  assert.equal(patch.body.steps.create[0].sort, 2)
  assert.equal(patch.body.steps.delete, undefined, 'no deletes')
  await assert.rejects((await api.prepareSave({ id: 5, guide: base({ steps: [step({ id: 999 })] }) })).apply(), /invalid_request/, 'a step of another guide')
})

test('state: "publish new version" raises the version; publication is refused without steps', async () => {
  const d = fakeDirectus()
  const api = createGuidesApi({ cms: 'https://cms.example.test', token: 'directus-token-for-tests', fetchImpl: d.fetchImpl, backend: async () => ({}) })
  await (await api.prepareState({ id: 5, newVersion: true })).apply()
  assert.deepEqual(d.calls.at(-1).body, { version: 4, status: 'published' })
  await assert.rejects(api.prepareState({ id: 5 }), /invalid_request/)
  await assert.rejects(api.prepareState({ id: 5, active: 'yes' }), /invalid_request/)
})

test('uploads: MP4, WebM, images and WebVTT by signature and size only', async () => {
  const d = fakeDirectus()
  const api = createGuidesApi({ cms: 'https://cms.example.test', token: 'directus-token-for-tests', fetchImpl: d.fetchImpl, backend: async () => ({}) })
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(16)])
  const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0])
  const vtt = Buffer.from('WEBVTT\n\n00:00.000 --> 00:02.000\n<v Openfund>Connect your wallet</v>\n')
  const up = (contentType, buf, filename = 'x') => api.upload({ filename, contentType, data: buf.toString('base64') })
  assert.deepEqual(await up('video/mp4', mp4, 'a.mp4'), { id: F('7') })
  assert.deepEqual(await up('video/webm', webm, 'a.webm'), { id: F('7') })
  assert.deepEqual(await up('text/vtt', vtt, 'a.vtt'), { id: F('7') })
  await assert.rejects(up('video/mp4', webm, 'a.mp4'), /invalid_media/, 'signature mismatch')
  await assert.rejects(up('video/mp4', Buffer.concat([mp4, Buffer.alloc(8 * 1024 * 1024)]), 'big.mp4'), /invalid_media/, 'over 8 MB')
  await assert.rejects(up('text/vtt', Buffer.from('WEBVTT\n\n00:00.000 --> 00:01.000\n<script>alert(1)</script>'), 'x.vtt'), /invalid_media/, 'markup in subtitles')
  await assert.rejects(up('text/html', vtt, 'x.html'), /invalid_media/)
  await assert.rejects(up('video/mp4', mp4, '../a.mp4'), /invalid_media/)
})
