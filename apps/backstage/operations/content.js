import { readFile } from 'node:fs/promises'

/* Backstage Content workspace: reads and writes editorial copy in Directus
 * through one server-held token, behind the owner session. The catalog
 * (routes, surfaces, forbidden collections) is generated from the website
 * sources into content-registry.json, so Backstage cannot drift from what
 * the site renders. Every write is validated here, independent of the UI:
 *  - only ui_messages translations and the text fields of registered
 *    editorial surfaces; forbidden (financial) collections are refused;
 *  - field names that look like links, destinations, contact or money
 *    values are refused even if a surface ever lists them;
 *  - values are plain text with the same placeholders as the English source.
 * Lifecycle (2026-11-22): create a draft item with fa and en copy, archive
 * (status 'archived'; nothing is ever deleted), reorder by the collection's
 * sort field, and upload media to the public media folder. Protected values
 * stay out of the text editor; the four department mailboxes in
 * site_settings have their own owner-gated, validated editor.
 */
const fail = (status, code) => Object.assign(new Error(code), { status })
const PLACEHOLDERS = /\$\{[^}]+\}|\{\{[^}]+\}\}|\{[A-Za-z_][\w.]*\}/g
const placeholders = value => (String(value ?? '').match(PLACEHOLDERS) || []).sort()
const MARKUP = /<\/?[a-z!][^>]*>/i
export const PROTECTED_FIELD = /(url|href|link|destination|email|wallet|address|price|amount|fee|pct|percent|leverage|payment|receiver|token|chain|support_)/i
const PAGE = 30

export function createContentApi({ cms, token, registryPath = new URL('../content-registry.json', import.meta.url), fetchImpl = fetch }) {
  let registry
  const load = async () => (registry ??= JSON.parse(await readFile(registryPath, 'utf8')))
  const catalog = async () => {
    const { editorial } = await load()
    return editorial
  }

  async function directus(path, { method = 'GET', body, auth = true } = {}) {
    const target = new URL(cms)
    const queryStart = path.indexOf('?')
    target.pathname = queryStart === -1 ? path : path.slice(0, queryStart)
    if (queryStart !== -1) target.search = path.slice(queryStart)
    let response
    try {
      response = await fetchImpl(target, {
        method, redirect: 'error', signal: AbortSignal.timeout(12_000),
        headers: { ...(auth && token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch { throw fail(502, 'cms_unavailable') }
    if (!response.ok) { await response.body?.cancel(); throw fail(response.status === 404 ? 404 : 502, 'cms_rejected') }
    return response.status === 204 ? null : response.json()
  }

  const surfaceOf = async collection => {
    const { surfaces, forbidden } = await catalog()
    if (forbidden.includes(collection)) throw fail(403, 'collection_forbidden')
    const surface = surfaces.find(s => s.collection === collection)
    if (!surface) throw fail(400, 'collection_not_editorial')
    return surface
  }
  const editableFields = surface => ({
    translated: surface.textFields.filter(f => !PROTECTED_FIELD.test(f)),
    shared: (surface.sharedTextFields || []).filter(f => !PROTECTED_FIELD.test(f)),
  })
  const routeOf = async view => {
    const { routes } = await catalog()
    const route = routes.find(r => r.view === view)
    if (!route) throw fail(404, 'route_not_found')
    return route
  }

  /* interface copy (ui_messages) for one route, with live Directus state */
  async function fields({ view, locale, q = '', offset = 0, shared = false }) {
    const { locales, sharedAreas } = await catalog()
    if (!locales.includes(locale)) throw fail(400, 'invalid_locale')
    const route = await routeOf(view)
    const areas = new Set([...route.areas, ...(shared ? sharedAreas : [])])
    const needle = String(q).trim().toLowerCase().slice(0, 80)
    const matches = (await load()).records.filter(r => r.locations.some(l => areas.has(l.page)) &&
      (!needle || r.fa.toLowerCase().includes(needle) || r.en.toLowerCase().includes(needle)))
    const start = Math.max(0, Math.min(Number(offset) || 0, matches.length))
    const page = matches.slice(start, start + PAGE)
    const state = new Map()
    if (page.length) {
      const filter = JSON.stringify({ key: { _in: page.map(r => r.key) } })
      const query = `/items/ui_messages?fields=id,key,status,translations.id,translations.language_code,translations.value&limit=-1&filter=${encodeURIComponent(filter)}`
      const rows = (await directus(query, { auth: Boolean(token) })).data || []
      for (const row of rows) state.set(row.key, row)
    }
    return { total: matches.length, offset: start, pageSize: PAGE, writable: Boolean(token), fields: page.map(r => {
      const row = state.get(r.key)
      const translation = row?.translations?.find(t => t.language_code === locale)
      return { key: r.key, fa: r.fa, en: r.en, area: r.area, status: row?.status ?? 'not_seeded', messageId: row?.id ?? null,
        translationId: translation?.id ?? null, value: translation?.value ?? null,
        components: [...new Set(r.locations.map(l => `${l.component.split('/src/')[1] ?? l.component}:${l.line}`))].slice(0, 3) }
    }) }
  }

  /* structured surface items (text fields only; JSON blocks stay in Studio) */
  async function surface({ collection, locale }) {
    const { locales } = await catalog()
    if (!locales.includes(locale)) throw fail(400, 'invalid_locale')
    const spec = await surfaceOf(collection)
    const { translated, shared } = editableFields(spec)
    const fieldList = ['id', ...(spec.singleton ? [] : ['status']), ...shared,
      ...(translated.length ? ['translations.id', 'translations.language_code', ...translated.map(f => `translations.${f}`)] : [])]
    const data = (await directus(`/items/${encodeURIComponent(collection)}?fields=${fieldList.join(',')}&limit=200`, { auth: Boolean(token) })).data
    const rows = Array.isArray(data) ? data : data ? [data] : []
    return { collection, singleton: Boolean(spec.singleton), writable: Boolean(token), translatedFields: translated, sharedFields: shared,
      readOnlyFields: spec.jsonTextFields || [], items: rows.map(row => {
        const translations = Array.isArray(row.translations) ? row.translations : []
        const current = translations.find(t => t.language_code === locale) || null
        const english = translations.find(t => t.language_code === 'en') || null
        return { id: row.id, status: row.status ?? null, translationId: current?.id ?? null,
          values: Object.fromEntries([...translated.map(f => [f, current?.[f] ?? null]), ...shared.map(f => [f, row[f] ?? null])]),
          english: Object.fromEntries(translated.map(f => [f, english?.[f] ?? null])) }
      }) }
  }

  function cleanValue(value, englishSource) {
    if (typeof value !== 'string') throw fail(400, 'invalid_value')
    const text = value.trim()
    if (!text || text.length > 20000) throw fail(400, 'invalid_value')
    if (MARKUP.test(text)) throw fail(400, 'markup_not_allowed')
    if (englishSource != null && JSON.stringify(placeholders(text)) !== JSON.stringify(placeholders(englishSource)))
      throw fail(400, 'placeholder_mismatch')
    return text
  }

  /* validate a save request; returns the Directus write to perform */
  async function prepareSave(body) {
    if (!token) throw fail(409, 'content_writes_disabled')
    const { locales } = await catalog()
    const { kind, collection, item, field, locale, value } = body || {}
    if (!locales.includes(locale)) throw fail(400, 'invalid_locale')
    if (kind === 'message') {
      if (typeof body.key !== 'string' || !/^react\.[a-f0-9]{16}$/.test(body.key)) throw fail(400, 'invalid_key')
      const record = (await load()).records.find(r => r.key === body.key)
      if (!record) throw fail(404, 'key_not_registered')
      const filter = JSON.stringify({ key: { _eq: body.key } })
      const row = ((await directus(`/items/ui_messages?fields=id,translations.id,translations.language_code&limit=1&filter=${encodeURIComponent(filter)}`)).data || [])[0]
      if (!row) throw fail(409, 'message_not_seeded')
      const text = cleanValue(value, record.en)
      const existing = row.translations?.find(t => t.language_code === locale)
      return existing
        ? { path: `/items/ui_message_translations/${existing.id}`, body: { value: text }, target: `ui_messages:${row.id}:${locale}` }
        : { path: `/items/ui_messages/${row.id}`, body: { translations: { create: [{ language_code: locale, value: text }] } }, target: `ui_messages:${row.id}:${locale}` }
    }
    if (kind === 'surface') {
      if (typeof collection !== 'string' || typeof field !== 'string') throw fail(400, 'invalid_request')
      const spec = await surfaceOf(collection)
      const { translated, shared } = editableFields(spec)
      if (PROTECTED_FIELD.test(field)) throw fail(403, 'field_protected')
      const id = spec.singleton ? null : String(item ?? '')
      if (!spec.singleton && !/^[A-Za-z0-9-]{1,64}$/.test(id)) throw fail(400, 'invalid_item')
      const itemPath = spec.singleton ? `/items/${collection}` : `/items/${collection}/${encodeURIComponent(id)}`
      if (shared.includes(field)) return { path: itemPath, body: { [field]: cleanValue(value, null) }, target: `${collection}:${id ?? 'singleton'}:${field}` }
      if (!translated.includes(field)) throw fail(403, 'field_not_editable')
      const fieldsQuery = `translations.id,translations.language_code,translations.${field}`
      const parent = (await directus(`${itemPath}?fields=${fieldsQuery}`)).data
      if (!parent) throw fail(404, 'item_not_found')
      const english = parent.translations?.find(t => t.language_code === 'en')?.[field] ?? null
      const text = cleanValue(value, english)
      const existing = parent.translations?.find(t => t.language_code === locale)
      return existing
        ? { path: `/items/${spec.translationCollection}/${existing.id}`, body: { [field]: text }, target: `${collection}:${id ?? 'singleton'}:${locale}:${field}` }
        : { path: itemPath, body: { translations: { create: [{ language_code: locale, [field]: text }] } }, target: `${collection}:${id ?? 'singleton'}:${locale}:${field}` }
    }
    throw fail(400, 'invalid_request')
  }

  async function prepareStatus(body) {
    if (!token) throw fail(409, 'content_writes_disabled')
    const { collection, item, status } = body || {}
    if (!['draft', 'published', 'archived'].includes(status)) throw fail(400, 'invalid_status')
    /* interface strings are drafts or published; only editorial items archive */
    if (status === 'archived' && collection === 'ui_messages') throw fail(400, 'invalid_status')
    if (collection === 'ui_messages') {
      if (typeof body.key !== 'string' || !/^react\.[a-f0-9]{16}$/.test(body.key)) throw fail(400, 'invalid_key')
      const filter = JSON.stringify({ key: { _eq: body.key } })
      const row = ((await directus(`/items/ui_messages?fields=id&limit=1&filter=${encodeURIComponent(filter)}`)).data || [])[0]
      if (!row) throw fail(409, 'message_not_seeded')
      return { path: `/items/ui_messages/${row.id}`, body: { status }, target: `ui_messages:${row.id}` }
    }
    const spec = await surfaceOf(String(collection))
    if (spec.singleton) throw fail(400, 'singleton_has_no_status')
    if (!/^[A-Za-z0-9-]{1,64}$/.test(String(item ?? ''))) throw fail(400, 'invalid_item')
    return { path: `/items/${collection}/${encodeURIComponent(String(item))}`, body: { status }, target: `${collection}:${item}` }
  }

  /* new draft item: fa and en copy of the first text field are required; the
     editor publishes it after review. Only text and identity fields. */
  async function prepareCreate(body) {
    if (!token) throw fail(409, 'content_writes_disabled')
    const spec = await surfaceOf(String(body?.collection ?? ''))
    if (spec.singleton) throw fail(400, 'singleton_has_no_items')
    const { translated, shared } = editableFields(spec)
    const slug = body.slug == null || body.slug === '' ? null : String(body.slug)
    if (slug !== null && !/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug)) throw fail(400, 'invalid_slug')
    const copy = body.copy && typeof body.copy === 'object' ? body.copy : {}
    const translations = []
    for (const locale of ['fa', 'en']) {
      const values = copy[locale] && typeof copy[locale] === 'object' ? copy[locale] : {}
      const row = { language_code: locale }
      for (const f of translated) if (values[f] != null && values[f] !== '') row[f] = cleanValue(values[f], null)
      if (translated.length && !row[translated[0]]) throw fail(400, 'copy_required')
      translations.push(row)
    }
    const item = { status: 'draft', ...(slug ? { slug } : {}) }
    for (const f of shared) if (body.shared?.[f]) item[f] = cleanValue(body.shared[f], null)
    if (translated.length) item.translations = translations
    return { method: 'POST', path: `/items/${spec.collection}`, body: item, target: `${spec.collection}:new:${slug ?? ''}` }
  }

  /* move one item to a new position (Directus sorts by the collection's sort field) */
  async function prepareReorder(body) {
    if (!token) throw fail(409, 'content_writes_disabled')
    const spec = await surfaceOf(String(body?.collection ?? ''))
    if (spec.singleton) throw fail(400, 'singleton_has_no_items')
    const item = String(body.item ?? ''), to = String(body.to ?? '')
    if (!/^[A-Za-z0-9-]{1,64}$/.test(item) || !/^[A-Za-z0-9-]{1,64}$/.test(to) || item === to) throw fail(400, 'invalid_item')
    return { method: 'POST', path: `/utils/sort/${spec.collection}`, body: { item, to }, target: `${spec.collection}:${item}>${to}` }
  }

  /* owner-gated protected values: department mailboxes only, validated */
  const MAILBOXES = ['support_email', 'legal_email', 'technical_email', 'community_email']
  const MAILBOX = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/
  async function protectedSettings() {
    const row = (await directus(`/items/site_settings?fields=${MAILBOXES.join(',')}`, { auth: Boolean(token) })).data || {}
    return { writable: Boolean(token), fields: MAILBOXES.map(field => ({ field, value: row[field] ?? null })) }
  }
  async function prepareProtected(body) {
    if (!token) throw fail(409, 'content_writes_disabled')
    if (!MAILBOXES.includes(body?.field)) throw fail(403, 'field_protected')
    const value = body.value == null ? '' : String(body.value).trim().toLowerCase()
    if (value && (value.length > 254 || !MAILBOX.test(value))) throw fail(400, 'invalid_email')
    return { method: 'PATCH', path: '/items/site_settings', body: { [body.field]: value || null }, target: `site_settings:${body.field}` }
  }

  /* media library: PNG, JPEG or WebP images up to 3 MB into the public folder */
  const IMAGE_TYPES = { 'image/png': [0x89, 0x50, 0x4e, 0x47], 'image/jpeg': [0xff, 0xd8, 0xff], 'image/webp': [0x52, 0x49, 0x46, 0x46] }
  async function upload({ filename, contentType, data }) {
    if (!token) throw fail(409, 'content_writes_disabled')
    const signature = IMAGE_TYPES[contentType]
    if (!signature || typeof data !== 'string' || typeof filename !== 'string' || !/^[\w .()-]{1,80}$/.test(filename)) throw fail(400, 'invalid_image')
    const bytes = Buffer.from(data, 'base64')
    if (!bytes.length || bytes.length > 3 * 1024 * 1024 || signature.some((b, i) => bytes[i] !== b)) throw fail(400, 'invalid_image')
    if (contentType === 'image/webp' && bytes.subarray(8, 12).toString('latin1') !== 'WEBP') throw fail(400, 'invalid_image')
    const folder = ((await directus('/folders?filter[name][_eq]=campaign-media&fields=id&limit=1')).data || [])[0]?.id
    if (!folder) throw fail(503, 'media_folder_missing')
    const form = new FormData()
    form.append('folder', folder); form.append('title', filename)
    form.append('file', new Blob([bytes], { type: contentType }), filename)
    const target = new URL(cms); target.pathname = '/files'
    let response
    try { response = await fetchImpl(target, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${token}` }, body: form }) }
    catch { throw fail(502, 'cms_unavailable') }
    if (!response.ok) { await response.body?.cancel(); throw fail(502, 'cms_rejected') }
    const id = (await response.json()).data.id
    return { id, url: `${cms}/assets/${id}` }
  }
  async function media() {
    const folder = ((await directus('/folders?filter[name][_eq]=campaign-media&fields=id&limit=1', { auth: Boolean(token) })).data || [])[0]?.id
    if (!folder) return { files: [] }
    const files = (await directus(`/files?filter[folder][_eq]=${folder}&fields=id,title,type,filesize,uploaded_on&sort=-uploaded_on&limit=50`, { auth: Boolean(token) })).data || []
    return { files: files.map(f => ({ ...f, url: `${cms}/assets/${f.id}` })) }
  }

  const apply = async ({ method = 'PATCH', path, body }) => { await directus(path, { method, body }); return { ok: true } }
  return { catalog, fields, surface, prepareSave, prepareStatus, prepareCreate, prepareReorder, protectedSettings, prepareProtected, upload, media, apply, writable: Boolean(token) }
}
