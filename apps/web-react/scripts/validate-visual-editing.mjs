#!/usr/bin/env node
/** Narrow editorial checks: stable ids, route registration, locale slots,
 * Directus mappings, seed boundaries and visual-editing syntax.
 * Dynamic trading values are not matched. Missing ar/ru/zh-CN CMS rows are
 * reported; fa and en are required.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
import { annotateJsx, contentKey } from './visual-editing-plugin.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = join(root, '../..')
const errors = []
const fail = (message) => errors.push(message)
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : /\.tsx$/.test(entry.name) ? [join(dir, entry.name)] : [])

const registry = JSON.parse(readFileSync(join(repo, 'apps/backstage/content-registry.json'), 'utf8'))
const keys = new Set()
let fa = 0, en = 0
for (const row of registry.records) {
  if (keys.has(row.key)) fail(`Duplicate content id ${row.key}`)
  keys.add(row.key)
  if (!row.fa?.trim() || !row.en?.trim()) fail(`Missing fa/en for ${row.key}`)
  else { fa++; en++ }
  if (row.key !== contentKey(row.fa, row.en)) fail(`Content id does not match source text: ${row.key}`)
  if (row.namespace !== 'react' || !row.locations?.length) fail(`Missing mapping for ${row.key}`)
  for (const location of row.locations || []) {
    if (!location.component || !location.page || !location.route) fail(`Incomplete location for ${row.key}`)
  }
}

let direct = 0, attached = 0, syntax = 0
for (const file of files(join(root, 'src'))) {
  const result = annotateJsx(readFileSync(file, 'utf8'), file)
  direct += result.direct.length
  attached += result.attached.length
  syntax += result.parseDiagnostics
  const rest = [...result.attached]
  for (const key of result.direct) {
    const index = rest.indexOf(key)
    if (index < 0) fail(`Unattached visual editing reference in ${relative(repo, file)}: ${key}`)
    else rest.splice(index, 1)
  }
}
if (syntax) fail(`Visual editing transform produced ${syntax} files with syntax errors`)

function load(entry) {
  const text = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text
  const module = { exports: {} }
  new Function('module', 'exports', text)(module, module.exports)
  return module.exports
}
const routes = load(join(root, 'src/cms/editorialRoutes.ts')).EDITORIAL_ROUTES
const surfaces = load(join(root, 'src/cms/editorialSurfaces.ts'))
const registeredPaths = new Set(routes.map(route => route.path))
const main = readFileSync(join(root, 'src/main.tsx'), 'utf8')
const sourcePaths = [...main.matchAll(/path:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g)].map(match => match[1] ?? match[2] ?? match[3])
for (const path of sourcePaths) if (!registeredPaths.has(path)) fail(`Unregistered route ${path}`)
for (const route of routes) {
  if (!route.view || !route.collections?.length) fail(`Route ${route.path} has no view or collection mapping`)
  for (const collection of route.collections) if (surfaces.FORBIDDEN_EDITORIAL_COLLECTIONS.includes(collection)) fail(`Route ${route.path} maps forbidden collection ${collection}`)
}
for (const surface of surfaces.EDITORIAL_SURFACES) {
  if (surfaces.FORBIDDEN_EDITORIAL_COLLECTIONS.includes(surface.collection)) fail(`Forbidden collection registered: ${surface.collection}`)
  if (!surface.translationCollection || !Array.isArray(surface.textFields)) fail(`Surface ${surface.collection} is incomplete`)
  const joined = [...surface.textFields, ...(surface.jsonTextFields || []), ...(surface.fileFields || []), ...(surface.sharedTextFields || [])].join(',')
  if (/\b(url|href|support_url|external_url|price|leverage)\b/.test(joined)) fail(`Surface ${surface.collection} exposes a non-editorial field`)
}
const seed = readFileSync(join(repo, 'apps/backstage/scripts/seed_interface_content.py'), 'utf8')
if (!seed.includes("for locale in ('fa', 'en')")) fail('Interface seed no longer preserves the fa/en draft pair')
if (seed.includes("'status': 'published'")) fail('Interface seed must not publish over editor content')
const schema = readFileSync(join(repo, 'apps/backstage/scripts/apply_schema.py'), 'utf8')
for (const code of ['fa', 'en', 'ar', 'ru', 'zh-CN']) if (!schema.includes(`'value': '${code}'`)) fail(`Schema is missing language ${code}`)

const summary = {
  registryRecords: registry.records.length,
  fa, en,
  addedLocales: 'ar, ru, zh-CN are independent CMS slots and are not seeded onto published parents',
  registryExceptions: registry.exceptions?.length || 0,
  directVisualReferences: direct,
  attachedVisualReferences: attached,
  routes: routes.length,
  surfaces: surfaces.EDITORIAL_SURFACES.length,
  forbidden: surfaces.FORBIDDEN_EDITORIAL_COLLECTIONS.length,
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
}
console.log(JSON.stringify(summary))
