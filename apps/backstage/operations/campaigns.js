/* Backstage Marketing: promotional popups and announcement bars.
 *
 * Campaigns are editorial content in Directus (`site_campaigns`), written
 * here through the server-held Directus token behind the owner session,
 * CSRF and password re-entry (server.js). Everything is validated on this
 * server, independent of the UI:
 *  - fixed enums for placement, template, style, pages, regions, frequency;
 *  - locale ELIGIBILITY is an explicit list; publishing requires copy in
 *    every eligible locale, so the site never falls back to another language;
 *  - plain text only (no markup), bounded lengths;
 *  - CTA: https:// without credentials, or a same-site path (/…);
 *    never javascript:, data:, protocol-relative or other schemes;
 *  - a coupon is a reference: publishing refuses a code the backend does
 *    not report as promotable (public, active, in window, not used up);
 *  - images: PNG, JPEG or WebP up to 3 MB, checked by signature, stored in
 *    Directus files (the existing media library). */
const fail = (status, code) => Object.assign(new Error(code), { status })
export const CAMPAIGN_LOCALES = ['fa', 'en', 'ar', 'ru', 'zh-CN']
const PLACEMENTS = ['modal', 'announcement_bar'], TEMPLATES = ['image', 'split'], STYLES = ['mint', 'neutral', 'notice']
const PAGES = ['all', 'home', 'challenges', 'information'], REGIONS = ['GLOBAL', 'IRAN'], FREQUENCY = ['session', 'interval']
const STATUSES = ['draft', 'published', 'archived']
const MARKUP = /<\/?[a-z!][^>]*>|javascript:/i
const COUPON = /^[A-Z0-9][A-Z0-9_-]{2,39}$/
const FIELDS = 'id,status,active,internal_name,placement,template,style,priority,starts_at,ends_at,locales,regions,pages,image_desktop,image_mobile,cta_url,coupon_code,delay_seconds,frequency,frequency_days,translations.id,translations.language_code,translations.headline,translations.body,translations.cta_label,translations.image_alt'
const LIMITS = { headline: 140, body: 400, cta_label: 40, image_alt: 160 }
const IMAGE_TYPES = { 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff], 'image/webp': [0x52, 0x49, 0x46, 0x46] }

export function safeCtaUrl(value) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || value.length > 500 || /\s/.test(value)) throw fail(400, 'invalid_cta_url')
  if (value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')) return value
  let url
  try { url = new URL(value) } catch { throw fail(400, 'invalid_cta_url') }
  if (url.protocol !== 'https:' || url.username || url.password) throw fail(400, 'invalid_cta_url')
  return url.href
}
const text = (value, max, required) => {
  if (value == null || value === '') { if (required) throw fail(400, 'missing_copy'); return null }
  if (typeof value !== 'string' || value.length > max || MARKUP.test(value)) throw fail(400, 'invalid_copy')
  return value.trim()
}
const subset = (value, allowed, code) => {
  if (!Array.isArray(value) || !value.length || value.length > allowed.length || value.some(v => !allowed.includes(v))) throw fail(400, code)
  return [...new Set(value)]
}
const when = value => {
  if (value == null || value === '') return null
  const t = new Date(value)
  if (Number.isNaN(t.getTime())) throw fail(400, 'invalid_schedule')
  return t.toISOString()
}
const int = (value, min, max, fallback, code) => {
  if (value == null || value === '') return fallback
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) throw fail(400, code)
  return n
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Validates and normalizes a campaign as submitted by the owner. */
export function normalizeCampaign(b) {
  if (!b || typeof b !== 'object') throw fail(400, 'invalid_request')
  if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(b.internal_name ?? '')) throw fail(400, 'invalid_name')
  if (!PLACEMENTS.includes(b.placement)) throw fail(400, 'invalid_placement')
  const locales = subset(b.locales, CAMPAIGN_LOCALES, 'invalid_locales')
  const translations = []
  const seen = new Set()
  for (const t of Array.isArray(b.translations) ? b.translations : []) {
    if (!CAMPAIGN_LOCALES.includes(t?.language_code) || seen.has(t.language_code)) throw fail(400, 'invalid_copy')
    seen.add(t.language_code)
    const row = { language_code: t.language_code }
    for (const [field, max] of Object.entries(LIMITS)) row[field] = text(t[field], max, field === 'headline')
    translations.push(row)
  }
  const campaign = {
    internal_name: b.internal_name,
    placement: b.placement,
    template: b.placement === 'modal' ? (TEMPLATES.includes(b.template) ? b.template : 'split') : null,
    style: b.placement === 'announcement_bar' ? (STYLES.includes(b.style) ? b.style : 'mint') : null,
    priority: int(b.priority, -1000, 1000, 0, 'invalid_priority'),
    starts_at: when(b.starts_at), ends_at: when(b.ends_at),
    locales, regions: subset(b.regions, REGIONS, 'invalid_regions'), pages: subset(b.pages, PAGES, 'invalid_pages'),
    image_desktop: b.image_desktop ? (uuid.test(b.image_desktop) ? b.image_desktop : (() => { throw fail(400, 'invalid_image') })()) : null,
    image_mobile: b.image_mobile ? (uuid.test(b.image_mobile) ? b.image_mobile : (() => { throw fail(400, 'invalid_image') })()) : null,
    cta_url: safeCtaUrl(b.cta_url),
    coupon_code: b.coupon_code ? (COUPON.test(String(b.coupon_code).trim().toUpperCase()) ? String(b.coupon_code).trim().toUpperCase() : (() => { throw fail(400, 'invalid_coupon_code') })()) : null,
    delay_seconds: int(b.delay_seconds, 3, 120, 12, 'invalid_delay'),
    frequency: FREQUENCY.includes(b.frequency) ? b.frequency : 'session',
    frequency_days: int(b.frequency_days, 1, 90, 7, 'invalid_frequency'),
    active: b.active !== false,
    translations,
  }
  if (campaign.starts_at && campaign.ends_at && campaign.ends_at <= campaign.starts_at) throw fail(400, 'invalid_schedule')
  if (campaign.translations.some(t => (t.cta_label == null) !== (campaign.cta_url == null) && t.cta_label != null)) throw fail(400, 'cta_needs_url')
  return campaign
}

/** Publication rules: copy for every eligible locale, a CTA label wherever a
 *  destination exists, and only a coupon the backend reports as promotable. */
export function publishProblems(campaign, couponPromotable) {
  const problems = []
  for (const locale of campaign.locales) {
    const t = campaign.translations.find(x => x.language_code === locale)
    if (!t?.headline) problems.push(`missing_copy:${locale}`)
    else if (campaign.cta_url && !t.cta_label) problems.push(`missing_cta_label:${locale}`)
  }
  if (campaign.coupon_code && couponPromotable === false) problems.push('coupon_not_promotable')
  return problems
}

export function createCampaignsApi({ cms, token, backend, fetchImpl = fetch }) {
  async function directus(path, { method = 'GET', body, raw } = {}) {
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
        body: raw ?? (body ? JSON.stringify(body) : undefined),
      })
    } catch { throw fail(502, 'cms_unavailable') }
    if (!response.ok) { await response.body?.cancel(); throw fail(response.status === 404 ? 404 : 502, 'cms_rejected') }
    return response.status === 204 ? null : (await response.json()).data
  }
  const couponStatus = async (code, correlationId) => code
    ? (await backend('/admin/campaigns/coupons/' + encodeURIComponent(code), 'GET', undefined, correlationId)).promotable === true
    : null

  return {
    async list(placement) {
      if (!PLACEMENTS.includes(placement)) throw fail(400, 'invalid_placement')
      return directus(`/items/site_campaigns?fields=${FIELDS}&filter[placement][_eq]=${placement}&sort=-priority,-id&limit=200`)
    },
    async stats(correlationId) { return backend('/admin/campaigns/stats?days=90', 'GET', undefined, correlationId) },
    couponStatus,
    /* validate first; the returned closure performs the write after the
       caller has confirmed the owner's password */
    async prepareSave(body, correlationId) {
      const id = body.id == null ? null : Number(body.id)
      if (id !== null && (!Number.isInteger(id) || id <= 0)) throw fail(400, 'invalid_request')
      const campaign = normalizeCampaign(body.campaign)
      const status = STATUSES.includes(body.status) ? body.status : 'draft'
      if (status === 'published') {
        const problems = publishProblems(campaign, await couponStatus(campaign.coupon_code, correlationId))
        if (problems.length) throw Object.assign(fail(409, 'publish_blocked'), { details: problems })
      }
      return {
        target: id ?? campaign.internal_name,
        apply: async () => {
          const { translations, ...fields } = campaign
          if (id === null) {
            const created = await directus('/items/site_campaigns', { method: 'POST', body: { ...fields, status, translations } })
            return created.id
          }
          const current = await directus(`/items/site_campaigns/${id}?fields=id,translations.id,translations.language_code`)
          const byLocale = new Map(current.translations.map(t => [t.language_code, t.id]))
          /* existing rows: only the copy changes (the editor role may update
             the four text fields of a translation, not its language) */
          const keep = translations.map(({ language_code, ...copy }) => byLocale.has(language_code)
            ? { id: byLocale.get(language_code), ...copy } : { language_code, ...copy })
          /* copy of a locale that is no longer eligible stays stored but is
             never shown (eligibility is the `locales` list); no deletes */
          await directus(`/items/site_campaigns/${id}`, { method: 'PATCH', body: { ...fields, status,
            translations: { create: keep.filter(t => !t.id), update: keep.filter(t => t.id) } } })
          return id
        },
      }
    },
    async prepareState(body, correlationId) {
      const id = Number(body.id)
      if (!Number.isInteger(id) || id <= 0) throw fail(400, 'invalid_request')
      const patch = {}
      if (body.status !== undefined) { if (!STATUSES.includes(body.status)) throw fail(400, 'invalid_request'); patch.status = body.status }
      if (body.active !== undefined) { if (typeof body.active !== 'boolean') throw fail(400, 'invalid_request'); patch.active = body.active }
      if (!Object.keys(patch).length) throw fail(400, 'invalid_request')
      if (patch.status === 'published' || patch.active === true) {
        const current = await directus(`/items/site_campaigns/${id}?fields=${FIELDS}`)
        const problems = publishProblems(normalizeCampaign(current), await couponStatus(current.coupon_code, correlationId))
        if (problems.length) throw Object.assign(fail(409, 'publish_blocked'), { details: problems })
      }
      return { target: id, apply: async () => { await directus(`/items/site_campaigns/${id}`, { method: 'PATCH', body: patch }); return id } }
    },
    async upload({ filename, contentType, data }) {
      const signature = IMAGE_TYPES[contentType]
      if (!signature || typeof data !== 'string' || typeof filename !== 'string' || !/^[\w .()-]{1,80}$/.test(filename)) throw fail(400, 'invalid_image')
      const bytes = Buffer.from(data, 'base64')
      if (!bytes.length || bytes.length > 3 * 1024 * 1024 || signature.some((b, i) => bytes[i] !== b)) throw fail(400, 'invalid_image')
      if (contentType === 'image/webp' && bytes.subarray(8, 12).toString('latin1') !== 'WEBP') throw fail(400, 'invalid_image')
      /* the only publicly readable folder (apply_schema.py) */
      const folder = (await directus('/folders?filter[name][_eq]=campaign-media&fields=id&limit=1'))?.[0]?.id
      if (!folder) throw fail(503, 'media_folder_missing')
      const form = new FormData()
      form.append('folder', folder)
      form.append('title', filename)
      form.append('file', new Blob([bytes], { type: contentType }), filename)
      const target = new URL(cms); target.pathname = '/files'
      let response
      try {
        response = await fetchImpl(target, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${token}` }, body: form })
      } catch { throw fail(502, 'cms_unavailable') }
      if (!response.ok) { await response.body?.cancel(); throw fail(502, 'cms_rejected') }
      return { id: (await response.json()).data.id }
    },
    async asset(id, width) {
      if (!uuid.test(id)) throw fail(404, 'not_found')
      const target = new URL(cms); target.pathname = `/assets/${id}`
      target.search = `width=${Math.min(1600, Math.max(64, Number(width) || 640))}&fit=inside&format=webp&quality=82`
      const response = await fetchImpl(target, { redirect: 'error', signal: AbortSignal.timeout(15_000), headers: { Authorization: `Bearer ${token}` } })
        .catch(() => { throw fail(502, 'cms_unavailable') })
      if (!response.ok) { await response.body?.cancel(); throw fail(404, 'not_found') }
      return { type: response.headers.get('content-type') || 'image/webp', body: Buffer.from(await response.arrayBuffer()) }
    },
  }
}
