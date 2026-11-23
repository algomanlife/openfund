/* Backstage → Marketing → Terminal guide (ADR 0056).
 *
 * A guide is an ordered list of steps shown on the trading terminal. It is
 * educational only: promotional popups stay banned on the terminal
 * (campaigns.js refuses them). Written to Directus (`site_guides`,
 * `site_guide_steps`) through the server-held token behind the owner
 * session, CSRF and password re-entry (server.js). Validated here,
 * independent of the UI:
 *  - plain text only, bounded lengths, fa and en title required per step;
 *  - media: a video step needs MP4 or WebM (both recommended) and a poster;
 *    an image step needs an image; subtitles are WebVTT;
 *  - uploads are checked by signature and size (video 8 MB, image 3 MB,
 *    subtitles 200 KB) and stored in the publicly readable campaign-media
 *    folder;
 *  - "delete" archives a step (the editor role never deletes);
 *  - "publish new version" raises `version`, so visitors who chose
 *    "Don't show again" for the previous version see the guide again. */
const fail = (status, code) => Object.assign(new Error(code), { status })
const MARKUP = /<\/?[a-z!][^>]*>|javascript:/i
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const STATUSES = ['draft', 'published', 'archived'], REGIONS = ['GLOBAL', 'IRAN'], PAGES = ['terminal']
const STEP_FIELDS = 'id,sort,status,media_kind,video_mp4,video_webm,image,poster,subtitles_fa,subtitles_en,title_fa,title_en,body_fa,body_en'
const FIELDS = `*,steps.${STEP_FIELDS.split(',').join(',steps.')}`
const LIMITS = { title_fa: 140, title_en: 140, body_fa: 600, body_en: 600 }
export const MAX_STEPS = 8
export const UPLOAD_KINDS = {
  'video/mp4': { max: 8 * 1024 * 1024, check: b => b.subarray(4, 8).toString('latin1') === 'ftyp' },
  'video/webm': { max: 8 * 1024 * 1024, check: b => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  'image/png': { max: 3 * 1024 * 1024, check: b => b[0] === 0x89 && b.subarray(1, 4).toString('latin1') === 'PNG' },
  'image/jpeg': { max: 3 * 1024 * 1024, check: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/webp': { max: 3 * 1024 * 1024, check: b => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  'text/vtt': { max: 200 * 1024, check: b => /^(﻿)?WEBVTT(\s|$)/.test(b.subarray(0, 16).toString('utf8')) && !MARKUP.test(b.toString('utf8').replace(/<\/?[biuc](\.[\w.-]+)?>|<v [^>]{1,40}>|<\/v>/g, '')) },
}

const text = (value, max, required) => {
  if (value == null || value === '') { if (required) throw fail(400, 'missing_copy'); return null }
  if (typeof value !== 'string' || value.length > max || MARKUP.test(value)) throw fail(400, 'invalid_copy')
  return value.trim()
}
const file = value => {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !uuid.test(value)) throw fail(400, 'invalid_media')
  return value
}
const subset = (value, allowed, code) => {
  if (!Array.isArray(value) || !value.length || value.some(v => !allowed.includes(v))) throw fail(400, code)
  return [...new Set(value)]
}

export function normalizeStep(s, index) {
  if (!s || typeof s !== 'object') throw fail(400, 'invalid_request')
  const kind = s.media_kind === 'image' ? 'image' : 'video'
  const step = {
    sort: index + 1, status: 'published', media_kind: kind,
    video_mp4: kind === 'video' ? file(s.video_mp4) : null, video_webm: kind === 'video' ? file(s.video_webm) : null,
    image: kind === 'image' ? file(s.image) : null, poster: file(s.poster),
    subtitles_fa: file(s.subtitles_fa), subtitles_en: file(s.subtitles_en),
  }
  for (const [field, max] of Object.entries(LIMITS)) step[field] = text(s[field], max, field.startsWith('title'))
  if (s.id != null) { const id = Number(s.id); if (!Number.isInteger(id) || id <= 0) throw fail(400, 'invalid_request'); step.id = id }
  return step
}

/** Validates and normalizes a guide as submitted by the owner (steps in display order). */
export function normalizeGuide(b) {
  if (!b || typeof b !== 'object') throw fail(400, 'invalid_request')
  if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(b.internal_name ?? '')) throw fail(400, 'invalid_name')
  const steps = Array.isArray(b.steps) ? b.steps : []
  if (steps.length > MAX_STEPS) throw fail(400, 'too_many_steps')
  const cookieDays = b.cookie_days == null || b.cookie_days === '' ? 365 : Number(b.cookie_days)
  if (!Number.isInteger(cookieDays) || cookieDays < 1 || cookieDays > 730) throw fail(400, 'invalid_cookie_days')
  return {
    internal_name: b.internal_name, pages: subset(b.pages ?? PAGES, PAGES, 'invalid_pages'),
    regions: subset(b.regions, REGIONS, 'invalid_regions'), cookie_days: cookieDays,
    steps: steps.map(normalizeStep),
  }
}

/** Publication rules: at least one step, and every step's media complete. */
export function publishProblems(guide) {
  const problems = []
  if (!guide.steps.length) problems.push('no_steps')
  guide.steps.forEach((s, i) => {
    const n = i + 1
    if (s.media_kind === 'video' && !s.video_mp4 && !s.video_webm) problems.push(`missing_video:${n}`)
    if (s.media_kind === 'video' && !s.poster) problems.push(`missing_poster:${n}`)
    if (s.media_kind === 'image' && !s.image) problems.push(`missing_image:${n}`)
  })
  return problems
}

export function createGuidesApi({ cms, token, backend, fetchImpl = fetch }) {
  async function directus(path, { method = 'GET', body } = {}) {
    if (!token) throw fail(503, 'cms_unavailable')
    const target = new URL(cms)
    const q = path.indexOf('?')
    target.pathname = q === -1 ? path : path.slice(0, q)
    if (q !== -1) target.search = path.slice(q)
    let response
    try {
      response = await fetchImpl(target, {
        method, redirect: 'error', signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch { throw fail(502, 'cms_unavailable') }
    if (!response.ok) { await response.body?.cancel(); throw fail(response.status === 404 ? 404 : 502, 'cms_rejected') }
    return response.status === 204 ? null : (await response.json()).data
  }
  const publishedSteps = guide => ({ ...guide, steps: (guide.steps ?? []).filter(s => s.status !== 'archived').sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)) })

  return {
    async list() {
      return (await directus(`/items/site_guides?fields=${FIELDS}&sort=-id&limit=50`)).map(publishedSteps)
    },
    async stats(correlationId) { return backend('/admin/guides/stats?days=366', 'GET', undefined, correlationId) },
    /* validate first; the returned closure writes after the owner's password */
    async prepareSave(body) {
      const id = body.id == null ? null : Number(body.id)
      if (id !== null && (!Number.isInteger(id) || id <= 0)) throw fail(400, 'invalid_request')
      const guide = normalizeGuide(body.guide)
      const status = STATUSES.includes(body.status) ? body.status : 'draft'
      if (status === 'published') {
        const problems = publishProblems(guide)
        if (problems.length) throw Object.assign(fail(409, 'publish_blocked'), { details: problems })
      }
      return {
        target: id ?? guide.internal_name,
        apply: async () => {
          const { steps, ...fields } = guide
          if (id === null) {
            const created = await directus('/items/site_guides', { method: 'POST', body: { ...fields, status, active: false, version: 1, steps: steps.map(({ id: _, ...s }) => s) } })
            return created.id
          }
          const current = await directus(`/items/site_guides/${id}?fields=id,steps.id,steps.status`)
          const owned = new Set(current.steps.map(s => s.id))
          if (steps.some(s => s.id && !owned.has(s.id))) throw fail(400, 'invalid_request')
          const kept = new Set(steps.filter(s => s.id).map(s => s.id))
          /* a step left out of the list is archived, never deleted */
          const archive = current.steps.filter(s => !kept.has(s.id) && s.status !== 'archived').map(s => ({ id: s.id, status: 'archived' }))
          await directus(`/items/site_guides/${id}`, { method: 'PATCH', body: { ...fields, status,
            steps: { create: steps.filter(s => !s.id), update: [...steps.filter(s => s.id), ...archive] } } })
          return id
        },
      }
    },
    /* status, active, or "publish new version" */
    async prepareState(body) {
      const id = Number(body.id)
      if (!Number.isInteger(id) || id <= 0) throw fail(400, 'invalid_request')
      const patch = {}
      if (body.status !== undefined) { if (!STATUSES.includes(body.status)) throw fail(400, 'invalid_request'); patch.status = body.status }
      if (body.active !== undefined) { if (typeof body.active !== 'boolean') throw fail(400, 'invalid_request'); patch.active = body.active }
      const bump = body.newVersion === true
      if (!Object.keys(patch).length && !bump) throw fail(400, 'invalid_request')
      const current = publishedSteps(await directus(`/items/site_guides/${id}?fields=${FIELDS}`))
      if (patch.status === 'published' || patch.active === true || bump) {
        const problems = publishProblems({ steps: current.steps })
        if (problems.length) throw Object.assign(fail(409, 'publish_blocked'), { details: problems })
      }
      if (bump) Object.assign(patch, { version: Math.min(100000, (Number(current.version) || 1) + 1), status: 'published' })
      return { target: id, apply: async () => { await directus(`/items/site_guides/${id}`, { method: 'PATCH', body: patch }); return id } }
    },
    async upload({ filename, contentType, data }) {
      const kind = UPLOAD_KINDS[contentType]
      if (!kind || typeof data !== 'string' || typeof filename !== 'string' || !/^[\w .()-]{1,80}$/.test(filename)) throw fail(400, 'invalid_media')
      const bytes = Buffer.from(data, 'base64')
      if (!bytes.length || bytes.length > kind.max || !kind.check(bytes)) throw fail(400, 'invalid_media')
      const folder = (await directus('/folders?filter[name][_eq]=campaign-media&fields=id&limit=1'))?.[0]?.id
      if (!folder) throw fail(503, 'media_folder_missing')
      const form = new FormData()
      form.append('folder', folder)
      form.append('title', filename)
      form.append('file', new Blob([bytes], { type: contentType }), filename)
      const target = new URL(cms); target.pathname = '/files'
      let response
      try {
        response = await fetchImpl(target, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60_000), headers: { Authorization: `Bearer ${token}` }, body: form })
      } catch { throw fail(502, 'cms_unavailable') }
      if (!response.ok) { await response.body?.cancel(); throw fail(502, 'cms_rejected') }
      return { id: (await response.json()).data.id }
    },
  }
}
