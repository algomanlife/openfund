#!/usr/bin/env node
/**
 * Openfund backstage — DEVELOPER DOCUMENTATION SEED (idempotent).
 *
 * Creates the developer_docs rows and their en/fa translations from the
 * repository source of truth:
 *   - docs/developer-portal/sections.json            (English, all metadata)
 *   - apps/web-react/src/features/developers/sections.fa.json (Persian)
 *
 * Idempotency: rows are matched by slug and translations by language code.
 * Only MISSING rows and MISSING translations are created; existing values are
 * never updated, so edits made in Directus are always preserved. New rows are
 * created with the status from the source file.
 *
 * Usage:
 *   DIRECTUS_ADMIN_EMAIL=… DIRECTUS_ADMIN_PASSWORD=… node seed_developer_docs.mjs [--url http://localhost:8055] [--dry-run]
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

const HERE = import.meta.dirname
const ROOT = path.resolve(HERE, '../../..')
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback }
const BASE = arg('url', process.env.DIRECTUS_URL || 'http://localhost:8055').replace(/\/+$/, '')
const EMAIL = arg('email', process.env.DIRECTUS_ADMIN_EMAIL)
const PASSWORD = arg('password', process.env.DIRECTUS_ADMIN_PASSWORD)
const DRY = process.argv.includes('--dry-run')

export function loadSource(root = ROOT) {
  const en = JSON.parse(readFileSync(path.join(root, 'docs/developer-portal/sections.json'), 'utf8'))
  const fa = JSON.parse(readFileSync(path.join(root, 'apps/web-react/src/features/developers/sections.fa.json'), 'utf8'))
  return en.sections.map(s => ({
    row: { slug: s.slug, section: s.section, sort: s.sort, status: s.status, source_path: s.source_path, last_verified_commit: s.last_verified_commit, last_verified_at: s.last_verified_at },
    translations: [{ language_code: 'en', title: s.title, body: s.body }, ...(fa[s.slug] ? [{ language_code: 'fa', title: fa[s.slug].title, body: fa[s.slug].body }] : [])],
  }))
}

/** what to create, given the existing rows ({slug, id, translations:[{language_code}]}) */
export function plan(source, existing) {
  const bySlug = new Map(existing.map(r => [r.slug, r]))
  const out = { createRows: [], createTranslations: [] }
  for (const s of source) {
    const have = bySlug.get(s.row.slug)
    if (!have) { out.createRows.push({ ...s.row, translations: s.translations }); continue }
    const langs = new Set((have.translations || []).map(t => t.language_code))
    for (const t of s.translations) if (!langs.has(t.language_code)) out.createTranslations.push({ ...t, developer_doc_id: have.id })
  }
  return out
}

async function req(method, url, token, body) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${method} ${url}\n${(await res.text()).slice(0, 300)}`)
  const text = await res.text()
  return text ? JSON.parse(text) : {}
}

async function main() {
  const source = loadSource()
  if (DRY) { console.log(`dry run: ${source.length} sections, ${source.reduce((n, s) => n + s.translations.length, 0)} translations in the source`); return }
  if (!EMAIL || !PASSWORD) throw new Error('Set DIRECTUS_ADMIN_EMAIL and DIRECTUS_ADMIN_PASSWORD (or --email/--password).')
  const token = (await req('POST', `${BASE}/auth/login`, null, { email: EMAIL, password: PASSWORD })).data.access_token
  const existing = (await req('GET', `${BASE}/items/developer_docs?fields=id,slug,translations.language_code&limit=-1`, token)).data || []
  const todo = plan(source, existing)
  for (const row of todo.createRows) await req('POST', `${BASE}/items/developer_docs`, token, { ...row, translations: { create: row.translations } })
  for (const t of todo.createTranslations) await req('POST', `${BASE}/items/developer_doc_translations`, token, t)
  console.log(`developer_docs: ${todo.createRows.length} rows and ${todo.createTranslations.length} translations created; existing values untouched`)
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1) })
