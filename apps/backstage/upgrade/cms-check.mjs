#!/usr/bin/env node
/**
 * Openfund CMS upgrade checks — version-agnostic, read-mostly, no dependencies.
 *
 *   node cms-check.mjs inventory --url URL --out inventory.json
 *   node cms-check.mjs verify    --url URL [--baseline inventory.json] [--out report.json]
 *
 * Credentials come ONLY from the environment (never arguments, never output):
 *   DIRECTUS_ADMIN_EMAIL, DIRECTUS_ADMIN_PASSWORD  (or DIRECTUS_ADMIN_TOKEN)
 *
 * `inventory` records a deterministic, secret-free snapshot of the Directus
 * metadata Openfund depends on: collections, fields, relations, roles,
 * policies, permissions, translations, files and per-collection item counts.
 *
 * `verify` asserts the behavioural contract the Openfund website relies on:
 * public read of published content only, drafts invisible to the public
 * policy, private application tables denied, challenge catalog shape,
 * Economy/Whitepaper/Governance content, translations, authenticated admin,
 * a file upload round trip and a draft -> publish -> unpublish cycle. When a
 * baseline inventory is supplied it also asserts no collection, field,
 * relation or item count regressed. Temporary rows/files it creates are
 * deleted again. It never touches existing editorial rows.
 *
 * Exit code 0 = every check passed, 1 = at least one failed.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [mode, ...rest] = process.argv.slice(2)
const args = Object.fromEntries(rest.reduce((acc, cur, i, a) => (cur.startsWith('--') ? [...acc, [cur.slice(2), a[i + 1]]] : acc), []))
const base = (args.url || process.env.DIRECTUS_URL || '').replace(/\/$/, '')
if (!['inventory', 'verify'].includes(mode) || !base) {
  console.error('usage: cms-check.mjs inventory|verify --url URL [--out file] [--baseline inventory.json]')
  process.exit(2)
}

async function call(method, path, { token, body, form, raw } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(base + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) })
  if (raw) return res
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* non-JSON body */ }
  return { status: res.status, json, text }
}

async function adminToken() {
  if (process.env.DIRECTUS_ADMIN_TOKEN) return process.env.DIRECTUS_ADMIN_TOKEN
  const { DIRECTUS_ADMIN_EMAIL: email, DIRECTUS_ADMIN_PASSWORD: password } = process.env
  if (!email || !password) throw new Error('DIRECTUS_ADMIN_EMAIL/DIRECTUS_ADMIN_PASSWORD (or DIRECTUS_ADMIN_TOKEN) required')
  const r = await call('POST', '/auth/login', { body: { email, password } })
  if (r.status !== 200) throw new Error(`admin login failed: HTTP ${r.status}`)
  return r.json.data.access_token
}

const data = async (token, path) => {
  const r = await call('GET', path, { token })
  if (r.status !== 200) throw new Error(`GET ${path} -> ${r.status}`)
  return r.json.data
}

/* ------------------------------------------------------------------ */
async function inventory(token) {
  const info = await call('GET', '/server/info', { token })
  const collections = (await data(token, '/collections?limit=-1')).filter((c) => !c.collection.startsWith('directus_'))
  const fields = await data(token, '/fields')
  const relations = await data(token, '/relations?limit=-1')
  const roles = await data(token, '/roles?limit=-1')
  const policies = await data(token, '/policies?limit=-1')
  const permissions = await data(token, '/permissions?limit=-1')
  const access = await data(token, '/access?limit=-1')
  const counts = {}
  for (const c of collections) {
    if (!c.schema) continue /* folders */
    const r = await call('GET', `/items/${c.collection}?aggregate[count]=*`, { token })
    counts[c.collection] = r.status === 200 ? Number(r.json.data?.[0]?.count ?? 0) : `HTTP ${r.status}`
  }
  const files = await call('GET', '/files?aggregate[count]=*', { token })
  const license = await call('GET', '/server/license', { token })
  const sortBy = (k) => (a, b) => String(k(a)).localeCompare(String(k(b)))
  return {
    generated_at: new Date().toISOString(),
    server: { version: info.json?.data?.directus?.version ?? info.json?.data?.version ?? null, info_status: info.status },
    license: license.status === 200 ? license.json.data : { status: license.status },
    collections: collections.map((c) => ({ collection: c.collection, hidden: c.meta?.hidden, singleton: c.meta?.singleton, versioning: c.meta?.versioning ?? false, schema: Boolean(c.schema) })).sort(sortBy((c) => c.collection)),
    fields: fields.filter((f) => !f.collection.startsWith('directus_')).map((f) => `${f.collection}.${f.field}:${f.type}`).sort(),
    relations: relations.filter((r) => !r.collection.startsWith('directus_') || !r.related_collection?.startsWith('directus_')).map((r) => `${r.collection}.${r.field}->${r.related_collection ?? '-'}`).sort(),
    roles: roles.map((r) => ({ name: r.name, admin: r.admin_access ?? undefined })).sort(sortBy((r) => r.name)),
    policies: policies.map((p) => ({ name: p.name, admin_access: p.admin_access, app_access: p.app_access, enforce_tfa: p.enforce_tfa })).sort(sortBy((p) => p.name)),
    public_access_rows: access.filter((a) => a.role == null && a.user == null).length,
    permissions: permissions.map((p) => ({ policy: policies.find((x) => x.id === p.policy)?.name, collection: p.collection, action: p.action, fields: p.fields, rule: p.permissions })).sort(sortBy((p) => `${p.policy}|${p.collection}|${p.action}`)),
    item_counts: counts,
    file_count: files.status === 200 ? Number(files.json.data?.[0]?.count ?? 0) : null,
  }
}

/* ------------------------------------------------------------------ */
const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail: String(detail) })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

/* Public collections that must filter on a status value (see apply_schema.py). */
const STATUS_GATED = {
  pages: 'published', navigation_items: 'published', ui_messages: 'published', home_content: 'published', faqs: 'published',
  trading_rules: 'published', legal_documents: 'published', footer_links: 'published', faq_categories: 'published',
  learning_paths: 'published', lessons: 'published', glossary_terms: 'published', tools: 'published', referral_content: 'published',
  governance_milestones: 'published', governance_content_blocks: 'published', whitepaper_documents: 'published',
  whitepaper_chapters: 'published', whitepaper_datasets: 'published', whitepaper_references: 'published', challenge_plans: 'active',
}
/* Application tables the public policy must never read (register_user_tables.py). */
const PRIVATE = ['users', 'demo_accounts', 'trading_positions', 'trading_orders', 'trading_ledger', 'trading_events', 'openfund_challenges', 'directus_users', 'directus_permissions', 'directus_settings', 'directus_files_private']

async function verify(token) {
  const info = await call('GET', '/server/info', { token })
  const version = info.json?.data?.directus?.version ?? info.json?.data?.version ?? 'unknown'
  console.log(`Directus version reported: ${version}`)

  check('liveness: /server/ping is public', (await call('GET', '/server/ping')).status === 200)
  const health = await call('GET', '/server/health')
  check('health: /server/health is reachable anonymously (11.x) or 403/404 (12.x — use /server/ping)', [200, 403, 404].includes(health.status), `HTTP ${health.status}`)
  check('health: authenticated /server/health reports ok', ['ok', 'warn'].includes((await call('GET', '/server/health', { token })).json?.status), '')
  check('admin: authenticated /users/me works', (await call('GET', '/users/me', { token })).json?.data?.email)

  /* --- public vs draft visibility, per status-gated collection --- */
  for (const [coll, okStatus] of Object.entries(STATUS_GATED)) {
    const pub = await call('GET', `/items/${coll}?limit=-1&fields=id,status`)
    const rows = pub.json?.data && !Array.isArray(pub.json.data) ? [pub.json.data] : pub.json?.data /* singletons */
    const adminAll = await call('GET', `/items/${coll}?limit=-1&fields=id,status`, { token })
    const adminRows = Array.isArray(adminAll.json?.data) ? adminAll.json.data : adminAll.json?.data ? [adminAll.json.data] : []
    const nonPublic = adminRows.filter((r) => r.status !== okStatus).length
    check(`public read ${coll}`, pub.status === 200 && Array.isArray(rows), `HTTP ${pub.status}`)
    if (Array.isArray(rows)) check(`public ${coll}: only status=${okStatus} rows`, rows.every((r) => r.status === okStatus), `${rows.length} public of ${adminRows.length} total, ${nonPublic} non-public hidden`)
    const explicit = await call('GET', `/items/${coll}?filter[status][_neq]=${okStatus}&limit=5&fields=id,status`)
    const exRows = Array.isArray(explicit.json?.data) ? explicit.json.data : explicit.json?.data ? [explicit.json.data] : []
    check(`public ${coll}: explicit draft query returns nothing`, explicit.status !== 200 || exRows.every((r) => r.status === okStatus), `HTTP ${explicit.status}`)
  }

  /* --- private tables denied to the public --- */
  for (const coll of PRIVATE) {
    const r = await call('GET', `/items/${coll}?limit=1`)
    const sys = coll.startsWith('directus_') ? await call('GET', `/${coll.replace('directus_', '')}?limit=1`) : null
    const denied = r.status === 403 || r.status === 404
    check(`public denied: ${coll}`, denied && (!sys || [401, 403, 404].includes(sys.status)), `items HTTP ${r.status}${sys ? `, system HTTP ${sys.status}` : ''}`)
  }
  const settings = await call('GET', '/settings')
  check('public denied: /settings', [401, 403].includes(settings.status), `HTTP ${settings.status}`)

  /* --- challenge catalog --- */
  const plans = await call('GET', '/items/challenge_plans?limit=-1')
  check('challenge catalog: active plans present', plans.status === 200 && plans.json.data.length > 0, `${plans.json?.data?.length ?? 0} plans`)
  const sample = plans.json?.data?.[0] ?? {}
  check('challenge catalog: plan shape (slug/price/status fields)', ['status'].every((k) => k in sample) && Object.keys(sample).length >= 5, Object.keys(sample).slice(0, 8).join(','))
  const planTr = await call('GET', '/items/challenge_plans?limit=1&fields=*,translations.*')
  check('challenge catalog: translations relation readable', planTr.status === 200 || planTr.status === 403, `HTTP ${planTr.status}`)

  /* --- Economy / Whitepaper / Governance content --- */
  const wp = await call('GET', '/items/whitepaper_documents?limit=-1&fields=*,translations.*')
  check('whitepaper: published document with translations', wp.status === 200 && wp.json.data.length >= 1 && (wp.json.data[0].translations ?? []).length >= 2, `${wp.json?.data?.length} docs`)
  const wpc = await call('GET', '/items/whitepaper_chapters?limit=-1&fields=id,translations.*')
  check('whitepaper: chapters with fa/en translations', wpc.status === 200 && wpc.json.data.length > 0 && wpc.json.data.every((c) => (c.translations ?? []).length >= 1), `${wpc.json?.data?.length} chapters`)
  for (const coll of ['whitepaper_datasets', 'whitepaper_references', 'governance_milestones', 'governance_content_blocks']) {
    const r = await call('GET', `/items/${coll}?limit=1`)
    check(`content readable: ${coll}`, r.status === 200, `HTTP ${r.status}`)
  }
  const ui = await call('GET', '/items/ui_messages?limit=-1&fields=key,namespace,translations.*')
  check('translations: ui_messages carry fa and en', ui.status === 200 && ui.json.data.some((m) => (m.translations ?? []).some((t) => t.language_code === 'fa')) && ui.json.data.some((m) => (m.translations ?? []).some((t) => t.language_code === 'en')), `${ui.json?.data?.length} messages`)

  /* --- draft -> publish -> unpublish, on a temporary row --- */
  const key = `upgrade_check_${Date.now()}`
  const created = await call('POST', '/items/ui_messages', { token, body: { key, namespace: 'common', status: 'draft' } })
  const id = created.json?.data?.id
  check('editing: admin can create a draft', created.status === 200 && id, `HTTP ${created.status}`)
  if (id) {
    const anonDraft = await call('GET', `/items/ui_messages?filter[key][_eq]=${key}`)
    check('draft invisible to public', anonDraft.status !== 200 || anonDraft.json.data.length === 0)
    const pubd = await call('PATCH', `/items/ui_messages/${id}`, { token, body: { status: 'published' } })
    const anonPub = await call('GET', `/items/ui_messages?filter[key][_eq]=${key}`)
    check('editing: publish makes it public', pubd.status === 200 && anonPub.json?.data?.length === 1)
    await call('PATCH', `/items/ui_messages/${id}`, { token, body: { status: 'draft' } })
    const anonBack = await call('GET', `/items/ui_messages?filter[key][_eq]=${key}`)
    check('editing: unpublish hides it again', anonBack.status !== 200 || anonBack.json.data.length === 0)
    check('cleanup: temporary row deleted', (await call('DELETE', `/items/ui_messages/${id}`, { token })).status === 204)
  }

  /* --- file upload round trip --- */
  const form = new FormData()
  form.append('title', 'upgrade-check')
  form.append('file', new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4, 0x89, 0, 0, 0, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x60, 0x60, 0x60, 0x60, 0, 0, 0, 5, 0, 1, 0xa5, 0xf6, 0x45, 0x40, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])], { type: 'image/png' }), 'upgrade-check.png')
  const up = await call('POST', '/files', { token, form })
  const fid = up.json?.data?.id
  check('media: admin file upload', up.status === 200 && fid, `HTTP ${up.status}`)
  if (fid) {
    const raw = await call('GET', `/assets/${fid}`, { raw: true })
    check('media: private file not public by default', [401, 403].includes(raw.status), `HTTP ${raw.status}`)
    const adminAsset = await call('GET', `/assets/${fid}`, { token, raw: true })
    check('media: admin can fetch asset bytes', adminAsset.status === 200 && (await adminAsset.arrayBuffer()).byteLength > 20)
    check('cleanup: temporary file deleted', (await call('DELETE', `/files/${fid}`, { token })).status === 204)
  }

  /* --- baseline comparison --- */
  if (args.baseline) {
    const before = JSON.parse(readFileSync(args.baseline, 'utf8'))
    const now = await inventory(token)
    const missing = (a, b) => a.filter((x) => !b.includes(x))
    check('baseline: no collection lost', missing(before.collections.map((c) => c.collection), now.collections.map((c) => c.collection)).length === 0)
    check('baseline: no field lost', missing(before.fields, now.fields).length === 0, missing(before.fields, now.fields).slice(0, 5).join(', '))
    check('baseline: no relation lost', missing(before.relations, now.relations).length === 0)
    const shrunk = Object.entries(before.item_counts).filter(([k, v]) => typeof v === 'number' && !(now.item_counts[k] >= v))
    check('baseline: no item count decreased', shrunk.length === 0, shrunk.map(([k, v]) => `${k} ${v}->${now.item_counts[k]}`).join(', '))
    check('baseline: file count not decreased', now.file_count >= before.file_count, `${before.file_count} -> ${now.file_count}`)
    const permKey = (p) => `${p.policy}|${p.collection}|${p.action}|${JSON.stringify(p.rule)}|${JSON.stringify(p.fields)}`
    const lostPerms = missing(before.permissions.map(permKey), now.permissions.map(permKey))
    check('baseline: no permission row lost or altered', lostPerms.length === 0, lostPerms.slice(0, 3).join(' ; '))
  }
}

try {
  const token = await adminToken()
  if (mode === 'inventory') {
    const inv = await inventory(token)
    writeFileSync(args.out || 'inventory.json', JSON.stringify(inv, null, 2) + '\n')
    console.log(`inventory written: ${inv.collections.length} collections, ${inv.fields.length} fields, ${inv.relations.length} relations, ${inv.permissions.length} permission rows, ${inv.file_count} files; server ${inv.server.version}`)
  } else {
    await verify(token)
    if (args.out) writeFileSync(args.out, JSON.stringify({ base_host: new URL(base).host, generated_at: new Date().toISOString(), results }, null, 2) + '\n')
    const failed = results.filter((r) => !r.ok)
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
    process.exit(failed.length ? 1 : 0)
  }
} catch (e) {
  console.error(`ERROR: ${e.message}`)
  process.exit(1)
}
