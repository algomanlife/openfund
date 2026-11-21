#!/usr/bin/env node
/* README gate (part of `npm run docs:check`, therefore of CI on every commit
 * and every pull request). Contract: scripts/docs/lib/readme-contract.mjs and
 * docs/readme/sections.json, explained in docs/development/README_STRUCTURE.md.
 * Fails when the README:
 *   - deviates from the exact ordered `##` section set, or a section loses its
 *     anchor and icon heading, or a heading skips a level;
 *   - drops below the minimums (title banner and badges, image count, content
 *     in every section) — the README may grow, never shrink below the floor;
 *   - is out of sync with its data: any generated block or generated graphic
 *     under docs/assets/readme/ differs from what docs/readme/*.json,
 *     docs/status/status.json, docs/README.md and the manifests produce;
 *   - misses a tracked top-level directory, app or package in the repository
 *     map (docs/readme/structure.json), or lists one that no longer exists;
 *   - puts a topic outside its owning section, carries a stale platform
 *     version or a dated gallery heading;
 *   - drops a required single-source link, or has a broken local link/image.
 *
 *   node scripts/docs/check-readme.mjs           check (CI)
 *   node scripts/docs/check-readme.mjs --write   regenerate headings, blocks and graphics
 * `npm run docs:write` runs every README writer in order. */
import fs from 'node:fs'
import path from 'node:path'
import { root, read, report, repoFiles } from './lib/repo.mjs'
import { SECTIONS, README_SECTIONS, MINIMUMS, TITLE_IMAGES, BLOCKS, REQUIRED_LINKS, OWNERSHIP } from './lib/readme-contract.mjs'
import { renderBlocks, syncAssets, headingLine, anchorLine, loadData } from './lib/readme-render.mjs'

const problems = []
const fail = m => problems.push(m)
const write = process.argv.includes('--write')
let readme = read('README.md')
const status = JSON.parse(read('docs/status/status.json'))

/* ---------- generated blocks owned by this script ---------- */
const cell = s => String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim()
/* strip tags until stable, so nested or split tags cannot survive one pass */
const stripTags = (s, by = '') => { let prev; do { prev = s; s = s.replace(/<[^<>]*>/g, by) } while (s !== prev); return s.replace(/[<>]/g, by) }
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

let OWN
try { OWN = { gallery: galleryBlock(), 'license:summary': licenseBlock(), ...renderBlocks() } }
catch (e) { fail(`README data: ${e.message}`); OWN = {} }

let expected = readme
for (const [name, text] of Object.entries(OWN)) {
  const s = `<!-- ${name} -->`, e = `<!-- /${name} -->`
  if (expected.includes(s) && expected.includes(e)) expected = expected.slice(0, expected.indexOf(s)) + text + expected.slice(expected.indexOf(e) + e.length)
}
/* canonical section headings: `<a name>` anchor line, then `## <icon> Title` */
{
  const byTitle = new Map(SECTIONS.map(s => [s.title.toLowerCase(), s]))
  const out = []
  let fenced = false
  for (const line of expected.split('\n')) {
    if (/^```/.test(line)) fenced = !fenced
    const m = !fenced && /^##\s+(.+?)\s*$/.exec(line)
    const s = m && byTitle.get(stripTags(m[1]).replace(/&nbsp;/g, ' ').trim().toLowerCase())
    if (s) {
      while (out.length && (out.at(-1).trim() === '' || /^<a name="[^"]*"><\/a>$/.test(out.at(-1).trim()))) out.pop()
      out.push('', anchorLine(s), '', headingLine(s))
    } else out.push(line)
  }
  expected = out.join('\n')
}
if (write) {
  fs.writeFileSync(path.join(root, 'README.md'), expected); readme = expected
  const changed = syncAssets(true)
  console.log(`README headings, generated blocks and ${changed.length} graphic(s) written.`)
} else {
  if (expected !== readme) fail('README.md: a heading or generated block is out of date with docs/readme/*.json and its sources; run npm run docs:write')
  try { for (const f of syncAssets(false)) fail(`${f}: generated README graphic is out of date; run npm run docs:write`) } catch (e) { fail(`README graphics: ${e.message}`) }
}

/* ---------- structure ---------- */
const lines = readme.split('\n')
let fenced = false
const headings = []
lines.forEach((line, i) => {
  if (/^```/.test(line)) fenced = !fenced
  const m = !fenced && /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
  if (m) headings.push({ level: m[1].length, raw: m[2], text: stripTags(m[2]).replace(/&nbsp;/g, ' ').trim(), line: i + 1 })
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
for (const h of headings.filter(x => x.level === 2)) {
  const s = SECTIONS.find(x => x.title === h.text)
  if (!s) continue
  if (lines[h.line - 1] !== headingLine(s)) fail(`README.md:${h.line}: section "${s.title}" must use its icon heading: ${headingLine(s)}`)
  if (lines[h.line - 3]?.trim() !== anchorLine(s)) fail(`README.md:${h.line}: section "${s.title}" must be preceded by ${anchorLine(s)}`)
}

/* sections (by ## boundaries) with generated blocks blanked for authored-text rules */
const GENERATED = /<!-- ([a-z:-]+) -->[\s\S]*?<!-- \/\1 -->/g
const authored = readme.replace(GENERATED, m => m.replace(/[^\n]/g, '')).split('\n')
const bounds = headings.filter(h => h.level === 2).map((h, i, all) => ({ name: h.text, start: h.line, end: (all[i + 1]?.line ?? lines.length + 1) - 1 }))
const sectionOf = n => bounds.find(b => n >= b.start && n <= b.end)?.name ?? '(title)'

/* ---------- minimums: complete and graphical ---------- */
const title = lines.slice(0, bounds[0] ? bounds[0].start - 1 : lines.length).join('\n')
for (const img of TITLE_IMAGES) if (!title.includes(img)) fail(`README.md: the title block must show ${img}`)
const badges = (title.match(/img\.shields\.io|\/badge\.svg/g) || []).length
if (badges < MINIMUMS.badges) fail(`README.md: the title block needs at least ${MINIMUMS.badges} badges (found ${badges})`)
const images = (readme.match(/<img\s|!\[[^\]]*\]\(/g) || []).length
if (images < MINIMUMS.images) fail(`README.md: ${images} images; the README must stay graphical (minimum ${MINIMUMS.images}). Add graphics, do not remove them`)
for (const b of bounds) {
  const body = lines.slice(b.start, b.end).filter(l => l.trim() && !/^<a name=/.test(l) && !/^<!-- /.test(l))
  if (body.length < MINIMUMS.sectionLines) fail(`README.md: section "${b.name}" is nearly empty (${body.length} lines); every section must carry content`)
}

/* ---------- repository map covers the repository ---------- */
try {
  const listed = loadData().structure.flatMap(g => g.entries.map(e => e.path.replace(/\/$/, '')))
  let tracked = null
  try { tracked = repoFiles() } catch { console.warn('check-readme: not a git checkout; repository-map coverage skipped') }
  if (tracked) {
  const tops = new Set(tracked.filter(f => f.includes('/')).map(f => f.split('/')[0]).filter(d => (!d.startsWith('.') || d === '.github') && d !== 'apps' && d !== 'packages'))
  const units = new Set(tracked.filter(f => /^(apps|packages)\/[^/]+\//.test(f)).map(f => f.split('/').slice(0, 2).join('/')))
  for (const d of [...tops, ...units]) if (!listed.includes(d)) fail(`docs/readme/structure.json: "${d}/" exists but is not in the repository map; add it in the same pull request`)
  for (const p of listed) if (!fs.existsSync(path.join(root, p))) fail(`docs/readme/structure.json: "${p}/" is listed but does not exist`)
  }
} catch (e) { fail(`docs/readme/structure.json: ${e.message}`) }

/* ---------- one responsibility per section ---------- */
authored.forEach((line, i) => {
  const n = i + 1, section = sectionOf(n)
  for (const rule of OWNERSHIP) if (rule.pattern.test(line) && section !== rule.section && section !== '(title)')
    fail(`README.md:${n}: ${rule.what} belong in "## ${rule.section}", not "## ${section}"`)
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
  if (at < 0 || !readme.includes(`<!-- /${name} -->`)) { fail(`README.md: missing generated block <!-- ${name} --> in "## ${meta.section}" (${meta.by})`); continue }
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
const slug = s => stripTags(s.toLowerCase()).replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/ /g, '-')
const anchorsOf = file => {
  const t = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '')
  return new Set([...t.split('\n').map(l => /^#{1,6}\s+(.+?)\s*#*$/.exec(l)?.[1]).filter(Boolean).map(slug), ...[...t.matchAll(/\b(?:id|name)="([^"]+)"/g)].map(m => m[1])])
}
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
  if (JSON.stringify(listed) !== JSON.stringify(README_SECTIONS)) fail(`${contractDoc}: the numbered section list must match docs/readme/sections.json`)
}
const agents = read('AGENTS.md')
if (!agents.includes('docs/development/README_STRUCTURE.md')) fail('AGENTS.md: must reference docs/development/README_STRUCTURE.md')
if (!agents.includes('npm run docs:write')) fail('AGENTS.md: must carry the merge rule (update docs/readme data, run npm run docs:write)')

report('check-readme', problems, `README OK — ${h2.length} sections with icons in contract order, ${images} images (minimum ${MINIMUMS.images}), ${badges} badges, blocks and graphics in sync with docs/readme, versions fresh (${latest}${next ? ', next ' + next : ''}), ${targets.length} links resolved.`)
