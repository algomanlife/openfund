#!/usr/bin/env node
/**
 * Openfund backstage — WHITEPAPER v1.0 CONTENT SEED (idempotent).
 *
 * Uploads the repository edition (apps/web-react/src/cms/seed/whitepaper)
 * into the whitepaper_* collections created by apply_schema.py:
 *   whitepaper_documents (+ translations)  ← document.ts
 *   whitepaper_chapters  (+ translations)  ← chapters-*.ts (typed blocks per locale)
 *   whitepaper_datasets  (+ translations)  ← datasets.ts
 *   whitepaper_references(+ translations)  ← references.ts
 *   pages row 'whitepaper' (SEO, template 'website')
 *
 * Every payload is first converted with the same functions the tests use
 * (src/cms/whitepaper/directus.ts) and parsed back with the public client's
 * validators — the script refuses to upload an edition the website would
 * reject.
 *
 * Idempotency: rows are matched by natural key (document slug, chapter slug,
 * dataset key, reference key, page slug). Existing rows are kept unless
 * --refresh is passed, so editorial changes made in Directus survive re-runs.
 *
 * Usage (credentials from the environment, never from shell history):
 *   DIRECTUS_URL=... DIRECTUS_ADMIN_EMAIL=... DIRECTUS_ADMIN_PASSWORD=... \
 *     node seed_whitepaper_content.mjs [--refresh] [--draft] [--dry-run]
 *   --draft    create new rows as draft (review in Data Studio, then publish)
 *   --dry-run  validate and print the plan without contacting Directus
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const requireWeb = createRequire(pathToFileURL(path.resolve(import.meta.dirname, '../../web-react/package.json')))
const { buildSync } = requireWeb('esbuild')
const WEB = path.resolve(import.meta.dirname, '../../web-react')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : fallback
}
const BASE = (arg('url', process.env.DIRECTUS_URL || 'http://localhost:8055')).replace(/\/+$/, '')
const EMAIL = arg('email', process.env.DIRECTUS_ADMIN_EMAIL)
const PASSWORD = arg('password', process.env.DIRECTUS_ADMIN_PASSWORD)
const REFRESH = process.argv.includes('--refresh')
const DRY = process.argv.includes('--dry-run')
const STATUS = process.argv.includes('--draft') ? 'draft' : 'published'

function load(rel) {
  const { outputFiles } = buildSync({
    entryPoints: [path.resolve(WEB, rel)], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, logLevel: 'silent',
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(requireWeb, module, module.exports)
  return module.exports
}

const { bundledWhitepaper: paper } = load('src/cms/seed/whitepaper/index.ts')
const { documentRow, chapterRow, datasetRow, referenceRow } = load('src/cms/whitepaper/directus.ts')
const { parseDocument, parseChapters, parseDatasets, parseReferences, datasetKeys, referenceKeys } = load('src/cms/whitepaper/client.ts')

/* ---- offline validation: the exact rows we upload must parse back ---- */
function validate() {
  const problems = []
  if (!parseDocument(documentRow(paper.document))) problems.push('document')
  const chapters = parseChapters(paper.chapters.map(c => chapterRow(c, 1)))
  if (!chapters || chapters.length !== paper.chapters.length) problems.push('chapters')
  const datasets = parseDatasets(paper.datasets.map((d, i) => datasetRow(d, i)))
  if (!datasets) problems.push('datasets')
  const references = parseReferences(paper.references.map(r => referenceRow(r)))
  if (!references) problems.push('references')
  for (const key of datasetKeys(paper.chapters)) if (!paper.datasets.some(d => d.key === key)) problems.push(`missing dataset ${key}`)
  for (const key of referenceKeys(paper.chapters, paper.datasets)) if (!paper.references.some(r => r.key === key)) problems.push(`missing reference ${key}`)
  if (problems.length) throw new Error(`Whitepaper edition failed validation: ${problems.join(', ')}`)
}

async function req(method, url, token, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${method} ${url}\n${(await res.text()).slice(0, 400)}`)
  const text = await res.text()
  return text ? JSON.parse(text) : {}
}

let TOKEN
const stats = {}
const note = (name, action) => { stats[name] ||= { created: 0, updated: 0, kept: 0 }; stats[name][action]++ }
const all = async (collection, fields) => (await req('GET', `${BASE}/items/${collection}?fields=${fields}&limit=-1`, TOKEN)).data || []

/** create, keep, or (with --refresh) update a row; translation rows are matched by language */
async function upsert(collection, match, payload, existing) {
  const hit = existing.find(row => Object.entries(match).every(([k, v]) => String(row[k]) === String(v)))
  if (!hit) {
    const created = await req('POST', `${BASE}/items/${collection}`, TOKEN, { ...payload, status: STATUS })
    note(collection, 'created')
    return created.data?.id
  }
  if (!REFRESH) { note(collection, 'kept'); return hit.id }
  const current = (await req('GET', `${BASE}/items/${collection}/${hit.id}?fields=translations.id,translations.language_code`, TOKEN)).data
  const byLang = new Map((current.translations || []).map(t => [t.language_code, t.id]))
  const translations = payload.translations.map(t => (byLang.has(t.language_code) ? { ...t, id: byLang.get(t.language_code) } : t))
  const { status: _keepEditorialStatus, ...rest } = payload
  await req('PATCH', `${BASE}/items/${collection}/${hit.id}`, TOKEN, { ...rest, translations })
  note(collection, 'updated')
  return hit.id
}

async function main() {
  validate()
  console.log(`whitepaper edition v${paper.document.version}: ${paper.chapters.length} chapters, ${paper.datasets.length} datasets, ${paper.references.length} references — validated`)
  if (DRY) { console.log('dry run: nothing sent'); return }
  if (!EMAIL || !PASSWORD) throw new Error('Set DIRECTUS_ADMIN_EMAIL and DIRECTUS_ADMIN_PASSWORD in the environment')
  TOKEN = (await req('POST', `${BASE}/auth/login`, null, { email: EMAIL, password: PASSWORD })).data.access_token
  console.log(`login OK (refresh: ${REFRESH}, new rows: ${STATUS})`)

  const documentId = await upsert('whitepaper_documents', { slug: paper.document.slug }, documentRow(paper.document), await all('whitepaper_documents', 'id,slug'))

  const chapterRows = await all('whitepaper_chapters', 'id,slug')
  for (const chapter of paper.chapters) await upsert('whitepaper_chapters', { slug: chapter.slug }, chapterRow(chapter, documentId), chapterRows)

  const datasetRows = await all('whitepaper_datasets', 'id,key')
  for (const [i, dataset] of paper.datasets.entries()) await upsert('whitepaper_datasets', { key: dataset.key }, datasetRow(dataset, i + 1), datasetRows)

  const referenceRows = await all('whitepaper_references', 'id,key')
  for (const reference of paper.references) await upsert('whitepaper_references', { key: reference.key }, referenceRow(reference), referenceRows)

  const doc = paper.document
  await upsert('pages', { slug: 'whitepaper' }, {
    slug: 'whitepaper', template: 'website',
    translations: ['fa', 'en'].map(l => ({ language_code: l, title: doc.title[l], subtitle: doc.subtitle[l], description: doc.seoDescription[l], seo_title: doc.seoTitle[l], seo_description: doc.seoDescription[l] })),
  }, await all('pages', 'id,slug'))

  console.log('\nwhitepaper seed summary:')
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: created ${v.created} · updated ${v.updated} · kept ${v.kept}`)
  console.log('\nNOTE: re-run with --refresh to overwrite Directus edits from the repository edition.')
}

main().catch(e => { console.error(e.message || e); process.exit(1) })
