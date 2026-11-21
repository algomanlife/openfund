#!/usr/bin/env node
/* README structure gate (part of `npm run docs:check`, therefore of CI on
 * every commit). Contract: scripts/docs/lib/readme-contract.mjs, explained in
 * docs/development/README_STRUCTURE.md. Fails when the README:
 *   - deviates from the exact ordered `##` section set, has an orphan or
 *     skipped heading level, or a duplicate section;
 *   - puts a topic outside its owning section (one responsibility per section);
 *   - exceeds the line/word budgets;
 *   - is stale: a hand-written platform version that is not the latest official
 *     release (or the declared next release), or a dated gallery/capture heading;
 *   - drops a required single-source link, or has a broken local link/image;
 *   - has a missing, misplaced or out-of-date generated block.
 * Also checks that README_STRUCTURE.md documents the same section list and
 * that AGENTS.md references it.
 *
 *   node scripts/docs/check-readme.mjs           check (CI)
 *   node scripts/docs/check-readme.mjs --write   regenerate the gallery and license blocks */
import fs from 'node:fs'
import path from 'node:path'
import { root, read, report } from './lib/repo.mjs'
import { README_SECTIONS, BUDGET, BLOCKS, REQUIRED_LINKS, OWNERSHIP } from './lib/readme-contract.mjs'

const problems = []
const fail = m => problems.push(m)
let readme = read('README.md')
const status = JSON.parse(read('docs/status/status.json'))

/* ---------- generated blocks owned by this script ---------- */
const cell = s => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim()
function galleryBlock() {
  const g = JSON.parse(read('docs/assets/gallery/gallery.json'))
  const lines = ['<!-- gallery -->', '']
  for (const row of g.rows) {
    if (!row.items?.length) { fail(`gallery.json: "${row.surface}" has no items`); continue }
    for (const it of row.items) if (!fs.existsSync(path.join(root, it.path))) fail(`gallery.json: missing image ${it.path}`)
    lines.push(`| ${row.items.map(it => `${cell(row.surface)} — ${cell(it.label)}`).join(' | ')} |`, `| ${row.items.map(() => '---').join(' | ')} |`)
    lines.push(`| ${row.items.map(it => it.width ? `<img src="${it.path}" alt="${cell(it.alt).replace(/"/g, '&quot;')}" width="${it.width}" />` : `![${cell(it.alt)}](${it.path})`).join(' | ')} |`, '')
  }
  lines.push('Curated from [docs/assets/gallery/gallery.json](docs/assets/gallery/gallery.json); provenance per image in the', '[screenshot manifest](docs/assets/screenshots/manifest.json); older capture sets are [archived](docs/reviews/_archive/readme-galleries/README.md).', '', '<!-- /gallery -->')
  return lines.join('\n')
}
function licenseBlock() {
  const rows = read('THIRD_PARTY_NOTICES.md').split('\n').filter(l => /^\|/.test(l) && !/^\|\s*-/.test(l) && !/^\|\s*Component\s*\|/.test(l))
  const short = s => s.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`/g, '').split(/ \(|;|, Canonical|, LuxAlgo|, ConsenSys|, Hamzeh| — /)[0].trim()
  const out = ['<!-- license:summary -->', '', '| Component | License |', '| --- | --- |']
  for (const r of rows) { const c = r.split('|').map(x => x.trim()); out.push(`| ${cell(short(c[1]))} | ${cell(short(c[2]))} |`) }
  out.push('', 'Generated from [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), the authoritative list with license texts.', '', '<!-- /license:summary -->')
  return out.join('\n')
}
const OWN = { gallery: galleryBlock(), 'license:summary': licenseBlock() }
let expected = readme
for (const [name, text] of Object.entries(OWN)) {
  const s = `<!-- ${name} -->`, e = `<!-- /${name} -->`
  if (expected.includes(s) && expected.includes(e)) expected = expected.slice(0, expected.indexOf(s)) + text + expected.slice(expected.indexOf(e) + e.length)
}
if (process.argv.includes('--write')) { fs.writeFileSync(path.join(root, 'README.md'), expected); readme = expected; console.log('README gallery and license blocks written.') }
else if (expected !== readme) fail('README.md: gallery or license block is out of date; run node scripts/docs/check-readme.mjs --write')

/* ---------- structure ---------- */
const lines = readme.split('\n')
let fenced = false
const headings = []
lines.forEach((line, i) => {
  if (/^```/.test(line)) fenced = !fenced
  const m = !fenced && /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
  if (m) headings.push({ level: m[1].length, text: m[2].trim(), line: i + 1 })
})
const h1 = headings.filter(h => h.level === 1)
if (h1.length !== 1) fail(`README.md: exactly one "# " title is required (found ${h1.length})`)
const firstH2 = headings.findIndex(h => h.level === 2)
headings.slice(0, firstH2 < 0 ? headings.length : firstH2).filter(h => h.level > 1).forEach(h => fail(`README.md:${h.line}: orphan heading "${h.text}" before the first section`))
let prev = 1
for (const h of headings) { if (h.level > prev + 1) fail(`README.md:${h.line}: heading "${h.text}" skips from level ${prev} to ${h.level}`); prev = h.level }
const h2 = headings.filter(h => h.level === 2).map(h => h.text)
const dupes = h2.filter((t, i) => h2.indexOf(t) !== i)
for (const d of new Set(dupes)) fail(`README.md: duplicate section "## ${d}"`)
if (JSON.stringify(h2) !== JSON.stringify(README_SECTIONS)) fail(`README.md: sections must be exactly, in order:\n    ${README_SECTIONS.join(' → ')}\n  found:\n    ${h2.join(' → ')}`)

/* sections (by ## boundaries) with generated blocks blanked for authored-text rules */
const GENERATED = /<!-- ([a-z:-]+) -->[\s\S]*?<!-- \/\1 -->/g
const authored = readme.replace(GENERATED, m => m.replace(/[^\n]/g, '')).split('\n')
const bounds = headings.filter(h => h.level === 2).map((h, i, all) => ({ name: h.text, start: h.line, end: (all[i + 1]?.line ?? lines.length + 1) - 1 }))
const sectionOf = n => bounds.find(b => n >= b.start && n <= b.end)?.name ?? '(title)'
for (const b of bounds) if (b.end - b.start + 1 > BUDGET.sectionLines) fail(`README.md: section "${b.name}" has ${b.end - b.start + 1} lines (budget ${BUDGET.sectionLines}); move detail into docs/`)

/* ---------- budgets ---------- */
const words = readme.replace(/<!--[\s\S]*?-->/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\]\([^)]*\)/g, ']')
  .replace(/https?:\/\/\S+/g, ' ').replace(/[|`*_#>[\]-]/g, ' ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length
if (lines.length > BUDGET.lines) fail(`README.md: ${lines.length} lines (budget ${BUDGET.lines})`)
if (words > BUDGET.words) fail(`README.md: ${words} words (budget ${BUDGET.words})`)

/* ---------- one responsibility per section ---------- */
authored.forEach((line, i) => {
  const n = i + 1, section = sectionOf(n)
  for (const rule of OWNERSHIP) if (rule.pattern.test(line) && section !== rule.section && section !== '(title)')
    fail(`README.md:${n}: ${rule.what} belong in "## ${rule.section}", not "## ${section}"`)
  if (/!\[[^\]]*\]\(|<img\s/i.test(line) && !['(title)', 'Product gallery'].includes(section)) fail(`README.md:${n}: images belong in the title or "## Product gallery"`)
})

/* ---------- freshness ---------- */
const latest = status.release.latestOfficial.tag
const next = status.release.next?.version ? 'v' + status.release.next.version : null
authored.forEach((line, i) => {
  for (const m of line.matchAll(/\bv(\d+\.\d+\.\d+)\b/g)) if (m[0] !== latest && m[0] !== next)
    fail(`README.md:${i + 1}: version ${m[0]} is not the latest official release ${latest}${next ? ` or the declared next release ${next}` : ''}`)
})
headings.forEach(h => { if (/\b\d{4}-\d{2}-\d{2}\b/.test(h.text) || /\b(gallery|captures?|screenshots?)\b.*\b(recorded|recent|v\d)/i.test(h.text)) fail(`README.md:${h.line}: dated heading "${h.text}" — galleries are curated in docs/assets/gallery/gallery.json`) })

/* ---------- generated blocks present and in their owning section ---------- */
for (const [name, meta] of Object.entries(BLOCKS)) {
  const at = lines.findIndex(l => l.trim() === `<!-- ${name} -->`)
  if (at < 0 || !readme.includes(`<!-- /${name} -->`)) { fail(`README.md: missing generated block <!-- ${name} --> (${meta.by})`); continue }
  if (sectionOf(at + 1) !== meta.section) fail(`README.md:${at + 1}: block <!-- ${name} --> must be in "## ${meta.section}"`)
}

/* ---------- single-source links ---------- */
for (const [section, targets] of Object.entries(REQUIRED_LINKS)) {
  const b = bounds.find(x => x.name === section)
  if (!b) continue
  const text = lines.slice(b.start - 1, b.end).join('\n')
  for (const t of targets) if (!text.includes(`](${t})`) && !text.includes(`](${t}#`) && !text.includes(`="${t}"`)) fail(`README.md: "## ${section}" must link ${t} (the single source for its detail)`)
}

/* ---------- local links and images resolve ---------- */
const slug = s => s.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/ /g, '-')
const anchorsOf = file => new Set(fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '').split('\n').map(l => /^#{1,6}\s+(.+?)\s*#*$/.exec(l)?.[1]).filter(Boolean).map(slug))
const targets = [...readme.matchAll(/!?\[[^\]\n]*\]\(([^)\s]+)\)/g)].map(m => m[1]).concat([...readme.matchAll(/<(?:img|a)\b[^>]*?(?:src|href)="([^"]+)"/g)].map(m => m[1]))
for (const t of targets) {
  if (/^([a-z]+:|\/\/)/i.test(t)) continue
  const [p, frag] = t.split('#')
  const abs = path.join(root, decodeURIComponent(p || 'README.md'))
  if (!fs.existsSync(abs)) { fail(`README.md: broken link or image ${t}`); continue }
  if (frag && /\.md$/.test(abs) && !anchorsOf(abs).has(frag)) fail(`README.md: missing heading #${frag} in ${p || 'README.md'}`)
}

/* ---------- the contract is documented and referenced ---------- */
const contractDoc = 'docs/development/README_STRUCTURE.md'
if (!fs.existsSync(path.join(root, contractDoc))) fail(`${contractDoc}: missing`)
else {
  const doc = read(contractDoc)
  const listed = [...doc.matchAll(/^\d+\.\s+`## ([^`]+)`/gm)].map(m => m[1])
  if (JSON.stringify(listed) !== JSON.stringify(README_SECTIONS)) fail(`${contractDoc}: the numbered section list must match scripts/docs/lib/readme-contract.mjs`)
}
if (!read('AGENTS.md').includes('docs/development/README_STRUCTURE.md')) fail('AGENTS.md: must reference docs/development/README_STRUCTURE.md')

report('check-readme', problems, `README OK — ${h2.length} sections in contract order, ${lines.length}/${BUDGET.lines} lines, ${words}/${BUDGET.words} words, versions fresh (${latest}${next ? ', next ' + next : ''}), ${targets.length} links resolved.`)
