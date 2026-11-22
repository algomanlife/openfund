#!/usr/bin/env node
/* ============================================================
   Arrow glyphs never live in copy.

   Arrows are rendered by the direction-aware primitive (src/ui/DirArrow.tsx,
   src/ui/arrows.ts, public/legacy/dir-arrow.js and the Backstage and Open
   Trade copies), which mirrors by the element's direction. A glyph typed into
   copy or a translation points the wrong way in half of the locales, so this
   check fails when one appears in:
   - website, terminal, Backstage and Open Trade UI source (string literals,
     JSX text, HTML text, CSS `content`);
   - translation dictionaries and the landing dictionary;
   - CMS seed content.

   Comments and developer log lines are ignored; Directus schema scripts (*.py)
   hold editor metadata, not copy. Keyboard-key labels (Alt+Shift+→, ↑↓ Navigate) name
   physical keys and are allowed. A line that must hold a glyph as data (the
   primitive's own glyph table, a normalizer's character class) carries the
   marker `arrow-glyphs: allow`.
   Usage: node scripts/check-arrow-glyphs.mjs [--list]
   ============================================================ */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const GLYPHS = /[←→↙↘↖↗‹›↓↑]/
const ROOTS = [
  'apps/web-react/src',
  'apps/web-react/public/legacy',
  'apps/web-react/public/translations.json',
  'apps/backstage/operations/public',
  'apps/backstage/scripts',
  'apps/open-trade/src',
]
const EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".html", ".css"])
/* generated inventories mirror their sources; checking the sources is enough */
const SKIP = [/\/i18n\/content\/source\.json$/, /\/vendor\//, /\.min\.js$/]
/* physical key names: shortcut hints, not navigation */
const KEY_LABEL = /(?:Alt|Shift|Ctrl|Cmd|Option|⌘|⌥)\s*\+\s*[←→↑↓]|<span>↑↓<\/span>|[←→↑↓]\s*\/\s*[←→↑↓]\s*(?:keys?|کلید)/g

function* walk(path) {
  const abs = join(repo, path)
  if (!existsSync(abs)) return
  if (statSync(abs).isFile()) { yield abs; return }
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    yield* walk(join(path, name))
  }
}

/** Blank out comments while keeping line numbers. */
function stripComments(src, ext) {
  if (ext === '.json') return src
  if (ext === '.py') return src.split('\n').map(l => l.replace(/(^|\s)#.*$/, '$1')).join('\n')
  let out = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  if (ext === '.html') out = out.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '))
  if (ext !== '.css' && ext !== '.html') out = out.split('\n').map(l => l.replace(/(^|[\s;{}(,])\/\/.*$/, '$1')).join('\n')
  return out
}

export function findGlyphs() {
  const hits = []
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const ext = extname(file)
      if (!EXT.has(ext) || SKIP.some(re => re.test(file))) continue
      const raw = readFileSync(file, 'utf8')
      if (!GLYPHS.test(raw)) continue
      const rawLines = raw.split('\n')
      stripComments(raw, ext).split('\n').forEach((line, i) => {
        if (rawLines[i].includes('arrow-glyphs: allow')) return
        /* developer log output is not copy */
        if (/\bconsole\.(?:log|warn|error)\(/.test(line)) return
        const rest = line.replace(KEY_LABEL, '')
        if (GLYPHS.test(rest)) hits.push(`${relative(repo, file)}:${i + 1}: ${rest.trim().slice(0, 140)}`)
      })
    }
  }
  return hits
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const hits = findGlyphs()
  if (hits.length) {
    console.error(`Arrow glyphs found in copy (${hits.length}). Render DirArrow / arrowSvg instead:`)
    for (const h of hits) console.error(`  ${h}`)
    process.exit(1)
  }
  console.log('arrow glyphs: none in copy')
}
