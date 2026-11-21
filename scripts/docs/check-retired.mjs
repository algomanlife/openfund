#!/usr/bin/env node
/* Retired gate (part of `npm run docs:check`, therefore of CI on every commit).
 *
 * Source of truth: docs/development/RETIRED.json. This script
 *   - validates the registry schema;
 *   - counts the remaining references of every item (tracked files matching
 *     `gate.files`, text matching `gate.text`, entries inside archives);
 *   - FAILS when an item with status `retired` still has an active reference
 *     (text under the registry's `historical` paths may still name it;
 *     scope `readme` checks only the README's hand-written text);
 *   - FAILS when THIRD_PARTY_NOTICES.md's active table still lists a retired
 *     component;
 *   - renders docs/development/RETIRED.md and the README block between
 *     <!-- retired:summary --> markers, and fails when either is stale.
 *
 *   node scripts/docs/check-retired.mjs           check (CI)
 *   node scripts/docs/check-retired.mjs --write   regenerate outputs */
import fs from 'node:fs'
import path from 'node:path'
import { root, repoFiles, upstream, TEXT_EXT, ARCHIVE_EXT, read, readBytes, zipEntries, lineOf, report } from './lib/repo.mjs'

const REGISTRY = 'docs/development/RETIRED.json', PAGE = 'docs/development/RETIRED.md'
const START = '<!-- retired:summary -->', END = '<!-- /retired:summary -->'
const STATUSES = ['retired', 'legacy-only pending removal', 'dormant']
const KINDS = ['font', 'release', 'documentation', 'code', 'asset', 'service', 'dependency']
const problems = []
const registry = JSON.parse(read(REGISTRY))

/* ---------- schema ---------- */
if (registry.schemaVersion !== 1) problems.push(`${REGISTRY}: schemaVersion must be 1`)
if (!/^\d{4}-\d{2}-\d{2}$/.test(registry.updatedAt ?? '')) problems.push(`${REGISTRY}: updatedAt must be YYYY-MM-DD`)
const ids = new Set()
for (const it of registry.items ?? []) {
  const where = `${REGISTRY}: ${it.id ?? '?'}`
  if (!/^[a-z0-9-]+$/.test(it.id ?? '') || ids.has(it.id)) problems.push(`${where}: id must be unique kebab-case`)
  ids.add(it.id)
  if (!it.item) problems.push(`${where}: item is required`)
  if (!KINDS.includes(it.kind)) problems.push(`${where}: kind must be one of ${KINDS.join(', ')}`)
  if (!STATUSES.includes(it.status)) problems.push(`${where}: status must be one of ${STATUSES.join(' | ')}`)
  if (it.status !== 'dormant' && !/^\d{4}-\d{2}-\d{2}$/.test(it.retiredSince ?? '')) problems.push(`${where}: retiredSince must be YYYY-MM-DD`)
  if (!it.replacement) problems.push(`${where}: replacement is required (write "None — …" when there is none)`)
  if (!it.gate || !Array.isArray(it.gate.files) || !Array.isArray(it.gate.text) || !['active', 'readme'].includes(it.gate.scope)) problems.push(`${where}: gate needs files[], text[] and scope active|readme`)
  if (it.status === 'retired' && it.gate && !it.gate.files.length && !it.gate.text.length) problems.push(`${where}: a retired item needs at least one gate pattern`)
}
if (problems.length) report('check-retired', problems, '')

/* ---------- reference counting ---------- */
const historical = (registry.historical?.paths ?? []).map(p => new RegExp(p))
const isHistorical = f => historical.some(re => re.test(f))
const GENERATED = /<!-- ([a-z:-]+) -->[\s\S]*?<!-- \/\1 -->/g
const readmeAuthored = () => read('README.md').replace(GENERATED, m => m.replace(/[^\n]/g, ''))
const files = repoFiles()
const textFiles = files.filter(f => TEXT_EXT.test(f) && !upstream(f))
const archives = files.filter(f => ARCHIVE_EXT.test(f) && !upstream(f) && !isHistorical(f))
const archiveText = new Map(archives.map(f => [f, zipEntries(readBytes(f)).map(e => ({ name: e.name, text: /\.(xml|rels|html?|css|py|js|md|txt)$/i.test(e.name) ? e.data().toString('utf8') : '' }))]))

const results = []
for (const it of registry.items) {
  const fileRes = it.gate.files.map(p => new RegExp(p))
  const textRes = it.gate.text.map(p => new RegExp(p, 'gim'))
  const hits = []
  for (const f of files) if (fileRes.some(re => re.test(f))) hits.push(`${f}: file present`)
  const scan = (label, text) => { for (const re of textRes) for (const m of text.matchAll(re)) hits.push(`${label}:${lineOf(text, m.index)}: "${m[0].slice(0, 60)}"`) }
  if (it.gate.scope === 'readme') scan('README.md', readmeAuthored())
  else {
    for (const f of textFiles) if (!isHistorical(f) && f !== 'README.md') scan(f, read(f))
    scan('README.md', readmeAuthored())
    for (const [f, entries] of archiveText) for (const e of entries) {
      if (fileRes.some(re => re.test(e.name))) hits.push(`${f}!${e.name}: file present in archive`)
      if (e.text) scan(`${f}!${e.name}`, e.text)
    }
  }
  if (it.status === 'retired') for (const h of hits) problems.push(`retired "${it.id}" is still referenced — ${h}`)
  const fileCount = files.filter(f => fileRes.some(re => re.test(f))).length
  results.push({ ...it, remaining: it.status === 'retired' ? hits.length : fileCount, remainingLabel: it.status === 'retired' ? String(hits.length) : `${fileCount} files` })
}

/* ---------- active license table ---------- */
const notices = read('THIRD_PARTY_NOTICES.md').split('\n').filter(l => /^\|/.test(l) && !/^\|\s*-/.test(l) && !/^\|\s*Component\s*\|/.test(l))
for (const it of registry.items.filter(i => i.status === 'retired' && i.gate.notice)) {
  const re = new RegExp(it.gate.notice, 'i')
  for (const row of notices) {
    const component = row.split('|')[1].trim()
    if (re.test(component)) problems.push(`THIRD_PARTY_NOTICES.md: active license table lists retired "${it.id}": ${component.slice(0, 80)}`)
  }
}

/* ---------- generated outputs ---------- */
/* links in the registry are relative to docs/development/; rebase them for other pages */
const rebase = (md, toDir) => md.replace(/\]\(([^)\s]+)\)/g, (all, target) => {
  if (/^([a-z]+:|#|\/)/i.test(target)) return all
  const abs = path.posix.normalize(path.posix.join('docs/development', target))
  return `](${path.posix.relative(toDir, abs) || '.'})`
})
const cell = s => String(s ?? '—').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ')
function page() {
  const rows = results.map(r => `| ${cell(r.item)} | ${r.kind} | ${r.status} | ${r.retiredSince ?? '—'} | ${cell(r.replacement)} | ${r.remainingLabel} |`)
  return ['# Retired and no longer used', '',
    '<!-- Generated from docs/development/RETIRED.json by `node scripts/docs/check-retired.mjs --write`; edit the JSON, not this page. -->', '',
    `Registry updated **${registry.updatedAt}**. Status meanings:`, '',
    ...STATUSES.map(s => `- **${s}** — ${registry.statuses[s]}`), '',
    '| Item | Kind | Status | Retired since | Replacement | Remaining refs |', '| --- | --- | --- | --- | --- | --- |', ...rows, '',
    '`Remaining refs` for a `retired` item counts active references and must be 0 (CI fails otherwise);',
    'for other statuses it counts the files still in the tree.', '',
    '## Notes', '', ...results.filter(r => r.note).map(r => `- **${r.id}** — ${cell(r.note)}`), '',
    '## Historical paths', '', 'Text under these paths may still name retired items:', '',
    ...registry.historical.paths.map(p => `- \`${p}\``), ''].join('\n')
}
function block() {
  const rows = results.map(r => `| ${cell(rebase(r.item, '.'))} | ${r.status} | ${cell(rebase(r.replacement, '.'))} |`)
  return [START, '', '| Item | Status | Replacement |', '| --- | --- | --- |', ...rows, '',
    'Generated from [docs/development/RETIRED.json](docs/development/RETIRED.json); details and reference counts in [RETIRED.md](docs/development/RETIRED.md).', '', END].join('\n')
}
const outputs = { [PAGE]: rebase(page(), 'docs/development') }
const readme = read('README.md')
if (!readme.includes(START) || !readme.includes(END)) problems.push(`README.md: missing the generated retired block (${START} … ${END})`)
else outputs['README.md'] = readme.slice(0, readme.indexOf(START)) + block() + readme.slice(readme.indexOf(END) + END.length)

if (process.argv.includes('--write')) {
  for (const [f, text] of Object.entries(outputs)) fs.writeFileSync(path.join(root, f), text)
  console.log('Retired outputs written.')
} else {
  for (const [f, text] of Object.entries(outputs)) if (!fs.existsSync(path.join(root, f)) || read(f) !== text) problems.push(`${f}: out of date with ${REGISTRY}; run node scripts/docs/check-retired.mjs --write`)
}
const retired = results.filter(r => r.status === 'retired').length
report('check-retired', problems, `Retired OK — ${results.length} registry items (${retired} retired with 0 active references), license table and README block in sync.`)
