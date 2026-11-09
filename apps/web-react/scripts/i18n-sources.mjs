#!/usr/bin/env node
/* ============================================================
   English source inventory for the added locales (ar, ru, zh-CN).

   Collects every English string the website can display:
   - `en` side of every bilingual `{fa, en}` record exported by the content
     modules (repository seeds = the same rows seed_website_content.mjs
     uploads to Directus);
   - literal Persian/English pairs at call sites (`pick`, `t`, `text`, `tr`);
   - English values of the landing dictionary (public/translations.json).

   Writes src/i18n/content/source.json. `--check` fails when a locale file
   lacks a translation for any source string (used by the unit tests).
   Usage: node scripts/i18n-sources.mjs [--check]
   ============================================================ */
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const PERSIAN = /[؀-ۿ]/
const LETTERS = /[A-Za-z]/

function load(path) {
  const { outputFiles } = buildSync({
    entryPoints: [join(root, path)], bundle: true, platform: 'node', format: 'cjs', packages: 'external',
    write: false, loader: { '.json': 'json', '.html': 'text', '.svg': 'text', '.css': 'empty' }, logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports)
  return module.exports
}

const sources = new Set()
const add = value => {
  if (typeof value !== 'string') return
  const v = value.trim()
  if (v && LETTERS.test(v) && !PERSIAN.test(v)) sources.add(v)
}
const collectTree = value => {
  if (typeof value === 'string') return add(value)
  if (Array.isArray(value)) return value.forEach(collectTree)
  if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) if (!NON_TEXT.has(k)) collectTree(v)
}
const NON_TEXT = new Set(['slug', 'id', 'key', 'kind', 'href', 'url', 'icon', 'image', 'type', 'variant', 'tone', 'status', 'format', 'symbol', 'ticker', 'code', 'target', 'anchor', 'unit'])
const seen = new WeakSet()
const walk = value => {
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) return value.forEach(walk)
  if (Object.prototype.hasOwnProperty.call(value, 'fa') && Object.prototype.hasOwnProperty.call(value, 'en')) collectTree(value.en)
  for (const v of Object.values(value)) walk(v)
}

/* 1 — content modules (seeds, catalogs, editorial constants) */
const MODULES = [
  'src/cms/siteContent.ts', 'src/cms/seed/homeContent.ts', 'src/cms/seed/legalContent.ts', 'src/cms/seed/faqContent.ts',
  'src/cms/seed/marketsContent.ts', 'src/features/rulebook/content.ts', 'src/features/information/content.ts',
  'src/features/tools/messages.ts', 'src/data/toolCatalog.ts', 'src/data/challengePlans.ts', 'src/features/markets/marketsData.ts',
]
for (const path of MODULES) {
  const exports = load(path)
  for (const value of Object.values(exports)) {
    if (typeof value === 'function') continue
    walk(value)
  }
}

/* 2 — literal pairs at call sites: (Persian, English) in either order */
const STR = String.raw`'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|\x60((?:[^\x60\\]|\\.)*)\x60`
const PAIR = new RegExp(String.raw`\b(?:pick|t|text|tr|label|L)\(\s*(?:\w+(?:\.\w+)?,\s*)?(?:${STR})\s*,\s*(?:${STR})\s*[,)]`, 'g')
const unescape = s => s.replace(/\\n/g, '\n').replace(/\\(['"\\\x60])/g, '$1')
/* template literals keep `${expr}` placeholders; normalise to `${0}` style names */
const normaliseTemplate = s => s.replace(/\$\{[^}]+\}/g, m => '${' + m.slice(2, -1).replace(/[^\w.]/g, '').slice(0, 24) + '}')
function files(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === 'i18n' ? [] : files(p)
    return /\.(tsx?|js)$/.test(name) ? [p] : []
  })
}
for (const file of files(join(root, 'src'))) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(PAIR)) {
    const a = m[1] ?? m[2] ?? (m[3] !== undefined ? normaliseTemplate(m[3]) : undefined)
    const b = m[4] ?? m[5] ?? (m[6] !== undefined ? normaliseTemplate(m[6]) : undefined)
    if (a === undefined || b === undefined) continue
    const en = PERSIAN.test(a) && !PERSIAN.test(b) ? b : PERSIAN.test(b) && !PERSIAN.test(a) ? a : null
    if (en) add(unescape(en))
  }
}

/* 3 — landing / shared chrome dictionary (Persian source → English) */
for (const en of Object.values(JSON.parse(readFileSync(join(root, 'public/translations.json'), 'utf8')))) add(en)

/* 4 — optional: English rows of a public Directus snapshot (read-only GET
   responses saved as <dir>/<collection>.json), so live editorial text that
   differs from the seeds is inventoried too: --cms-snapshot <dir> */
const snapshotArg = process.argv.indexOf('--cms-snapshot')
if (snapshotArg > 0) {
  const dir = process.argv[snapshotArg + 1]
  const fromRow = row => {
    if (!row || typeof row !== 'object') return
    if (Array.isArray(row)) return row.forEach(fromRow)
    for (const [k, v] of Object.entries(row)) {
      if (k === 'translations' && Array.isArray(v)) {
        for (const t of v) if (t && t.language_code === 'en') for (const [field, value] of Object.entries(t)) if (!['id', 'language_code'].includes(field) && !NON_TEXT.has(field) && !/_id$/.test(field)) collectTree(value)
      } else if (v && typeof v === 'object') fromRow(v)
    }
  }
  for (const name of readdirSync(dir).filter(n => n.endsWith('.json'))) fromRow(JSON.parse(readFileSync(join(dir, name), 'utf8')).data)
  /* ui_messages store the fa→en landing dictionary: Persian keys, English values */
}

const list = [...sources].sort()
const LOCALES = ['ar', 'ru', 'zh-CN']
if (process.argv.includes('--check')) {
  const ui = Object.fromEntries(LOCALES.map(l => [l, readFileSync(join(root, `src/i18n/messages/${l}.ts`), 'utf8')]))
  let failed = false
  for (const locale of LOCALES) {
    const dict = JSON.parse(readFileSync(join(root, `src/i18n/content/${locale}.json`), 'utf8'))
    const missing = list.filter(s => dict[s] === undefined && !ui[locale].includes(JSON.stringify(s).slice(1, -1)) && !ui[locale].includes(`'${s.replace(/'/g, "\\'")}'`))
    const empty = Object.entries(dict).filter(([, v]) => typeof v !== 'string' || !v.trim()).map(([k]) => k)
    if (missing.length || empty.length) { failed = true; console.error(`${locale}: ${missing.length} missing, ${empty.length} empty`); missing.slice(0, 20).forEach(s => console.error('  - ' + s.slice(0, 120))) }
  }
  process.exit(failed ? 1 : 0)
}
writeFileSync(join(root, 'src/i18n/content/source.json'), JSON.stringify(list, null, 0).replace(/","/g, '",\n"') + '\n')
console.log(`${list.length} English source strings, ${list.reduce((n, s) => n + s.length, 0)} characters`)
