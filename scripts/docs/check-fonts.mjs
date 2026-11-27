#!/usr/bin/env node
/* Font gate (part of `npm run docs:check`, therefore of CI on every commit).
 *
 * Owner policy (2026-11-21, docs/design/DESIGN_SYSTEM.md#typography-and-font-tokens):
 * the project uses exactly two faces — Ubuntu (general/Latin) and Dastkhat
 * (the only Persian/Arabic face; 'Dastkhat', 'Dastkhat Arabic',
 * 'Dastkhat FaNum'). This gate fails when:
 *   1. a retired font file exists anywhere in the tree (any path, any archive);
 *   2. code, stylesheets, markup, manifests, archives or PDFs reference a
 *      retired face (Irancell, the renamed "Openfund Persian" copies,
 *      standalone Vazirmatn) in a font context: @font-face, font-family,
 *      the font shorthand, canvas `font =`, fontFamily, FontFace, Office
 *      `typeface`, Google Fonts `family=`, or a retired file name/route;
 *   3. an @font-face or FontFace declares a family other than Ubuntu… or Dastkhat…;
 *   4. a Persian/Arabic @font-face is declared outside the one shared file
 *      apps/web-react/public/assets/fonts/dastkhat/dastkhat.css.
 * Prose may still *name* a retired face (for example "based on Vazirmatn" or
 * "Irancell was removed"); this gate only looks at font contexts. Historical
 * evidence under docs/reviews/ and the release notes are exempt from rule 2.
 * Upstream/vendored code is exempt from rules 2–4. */
import { repoFiles, upstream, TEXT_EXT, ARCHIVE_EXT, read, readBytes, zipEntries, lineOf, report } from './lib/repo.mjs'

const RETIRED_FILE = /(^|\/)(irancell-\d+[\w-]*\.ttf|openfund-[1-5]\.ttf|openfund-persian-[\w-]+\.woff2?|Vazirmatn[\w-]*\.(ttf|otf|woff2?)|Vazirmatn-LICENSE\.txt)$/i
const RETIRED_REF = /irancell-\d+[\w-]*\.ttf|openfund-[1-5]\.ttf|openfund-persian-[\w-]+\.woff2?|Vazirmatn[\w-]*\.(ttf|otf|woff2?)|Vazirmatn-LICENSE\.txt|\/persian\.woff2|OpenfundCertificateFa/gi
const RETIRED_FACE = /\b(Irancell|Vazirmatn|Openfund ?Persian)\b/i
/* font contexts: each yields the text that names families */
const CONTEXTS = [
  /font-family\s*:\s*([^;{}<>]+)/gi,
  /(?:[{;]|^)\s*font\s*:\s*([^;{}<>]+)/gim,     // CSS shorthand in declaration position
  /\.font\s*=\s*([^;\n]+)/g,                      // canvas ctx.font = ...
  /\bFONT\s*=\s*([^;\n]+)/g,                      // shared canvas font constants
  /fontFamily\s*:\s*([^,}\n]+)/g,
  /new FontFace\(\s*(['"`][^'"`]+['"`])/g,
  /\btypeface="([^"]+)"/g,                        // Office XML
  /\bw:(?:ascii|hAnsi|cs|eastAsia)="([^"]+)"/g,   // Word run fonts
  /[?&]family=([^&"'\s>]+)/g,                     // Google Fonts URLs
]
const ALLOWED_FAMILY = /^(Ubuntu|Dastkhat)( |$)/
const ONE_FILE = new Set(['apps/web-react/public/assets/fonts/dastkhat/dastkhat.css'])
/* rule-2 exemptions: dated evidence and records of the removal itself */
const HISTORICAL = /^(docs\/reviews\/|docs\/releases\/|CHANGELOG\.md$|docs\/development\/RETIRED\.(json|md)$)/
/* files that must mention the retired patterns to forbid them */
const SELF = new Set(['scripts/docs/check-fonts.mjs', 'scripts/docs/test/gates.test.mjs', 'apps/web-react/test/typography.test.mjs'])

const problems = []
const unquote = s => s.trim().replace(/^['"`]|['"`]$/g, '')
let scanned = 0, archives = 0

function scanText(label, text, { historical = false, owned = true } = {}) {
  scanned++
  if (!historical) {
    for (const m of text.matchAll(RETIRED_REF)) problems.push(`${label}:${lineOf(text, m.index)}: references retired font asset "${m[0]}"`)
    for (const re of CONTEXTS) for (const m of text.matchAll(re)) {
      if (RETIRED_FACE.test(m[1])) problems.push(`${label}:${lineOf(text, m.index)}: retired face in a font context: ${m[0].slice(0, 120)}`)
    }
  }
  if (!owned) return
  for (const m of text.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const family = unquote((m[1].match(/font-family\s*:\s*([^;]+)/) || [, ''])[1])
    if (!ALLOWED_FAMILY.test(family)) problems.push(`${label}:${lineOf(text, m.index)}: @font-face "${family}" — only Ubuntu and Dastkhat faces are allowed`)
    else if (/^Dastkhat/.test(family) && !ONE_FILE.has(label) && !label.includes('!')) problems.push(`${label}:${lineOf(text, m.index)}: Persian/Arabic @font-face outside dastkhat.css — import the shared file instead`)
  }
  for (const m of text.matchAll(/new FontFace\(\s*['"`]([^'"`]+)['"`]/g))
    if (!ALLOWED_FAMILY.test(m[1])) problems.push(`${label}:${lineOf(text, m.index)}: FontFace "${m[1]}" — only Ubuntu* and Dastkhat* names are allowed`)
}

for (const f of repoFiles()) {
  if (RETIRED_FILE.test(f)) problems.push(`${f}: retired font file is present`)
  if (SELF.has(f)) continue
  const vendored = upstream(f)
  /* Markdown/plain text is prose: it may name a removed file; check-retired.mjs
     polices prose against the registry with its own historical allowlist. */
  if (TEXT_EXT.test(f) && !vendored) { const prose = /\.(md|txt)$/i.test(f); scanText(f, read(f), { historical: prose || HISTORICAL.test(f), owned: !HISTORICAL.test(f) }); continue }
  if (ARCHIVE_EXT.test(f) && !HISTORICAL.test(f)) {
    archives++
    for (const e of zipEntries(readBytes(f))) {
      if (RETIRED_FILE.test(e.name)) problems.push(`${f}!${e.name}: retired font file inside archive`)
      if (/\.(xml|rels|html?|css|py|js)$/i.test(e.name)) scanText(`${f}!${e.name}`, e.data().toString('utf8'))
    }
    continue
  }
  if (/\.pdf$/i.test(f) && !vendored && !HISTORICAL.test(f)) {
    const names = readBytes(f).toString('latin1').match(/\/(?:BaseFont|FontName)\s*\/[A-Z]{6}\+[^\s/\]>]+|\/(?:BaseFont|FontName)\s*\/[^\s/\]>]+/g) || []
    for (const n of names) if (RETIRED_FACE.test(n)) problems.push(`${f}: PDF embeds retired face ${n.split('/').pop()}`)
  }
}

report('check-fonts', problems, `Fonts OK — only Ubuntu + Dastkhat faces; ${scanned} text files and ${archives} archives/Office documents scanned, no retired font files or references.`)
