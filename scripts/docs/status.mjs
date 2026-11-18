#!/usr/bin/env node
/* Canonical status: docs/status/status.json → docs/status/README.md and the
 * README.md summary block, plus consistency checks for current documents.
 *
 *   node scripts/docs/status.mjs           write the generated outputs
 *   node scripts/docs/status.mjs --check   validate (part of npm run docs:check)
 *
 * Runtime states are never probed here: CI validates that each runtime claim
 * carries a timestamp and evidence, and that current documents do not
 * contradict the recorded state. Re-verify against production to change them. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.env.STATUS_ROOT || join(dirname(fileURLToPath(import.meta.url)), '../..')
const read = path => readFileSync(join(root, path), 'utf8')
const status = JSON.parse(read('docs/status/status.json'))
const errors = []
const fail = message => errors.push(message)

/* ---------- schema ---------- */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/, ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, SHA = /^[0-9a-f]{40}$/
const evidenceOk = value => typeof value === 'string' && (/^https:\/\/\S+$/.test(value) || value.startsWith('Liara API ') || existsSync(join(root, value.split('#')[0])))
if (status.schemaVersion !== 1) fail('status.json: schemaVersion must be 1')
if (!ISO_DATE.test(status.updatedAt ?? '')) fail('status.json: updatedAt must be YYYY-MM-DD')
const latest = status.release?.latestOfficial
if (!latest || !/^\d+\.\d+\.\d+$/.test(latest.version) || latest.tag !== 'v' + latest.version || !SHA.test(latest.commit) || !evidenceOk(latest.evidence))
  fail('status.json: release.latestOfficial needs version, tag v<version>, a 40-character commit and evidence')
for (const [key, env] of Object.entries(status.environments ?? {})) {
  for (const s of env.services ?? []) {
    if (!s.id || !s.provider || !s.role) fail(`status.json: ${key} service needs id, provider and role`)
    if (s.commit !== null && !SHA.test(s.commit ?? '')) fail(`status.json: ${key}/${s.id} commit must be a full SHA or null`)
    if (!ISO_TIME.test(s.verifiedAt ?? '') || !evidenceOk(s.evidence)) fail(`status.json: ${key}/${s.id} needs verifiedAt (UTC ISO) and resolvable evidence`)
  }
}
const ENVS = ['global', 'iran'], FLAGS = ['deployed', 'enabled', 'verified', 'accepted']
for (const f of status.features ?? []) {
  if (!f.name || !['planned', 'in_development', 'implemented', 'merged'].includes(f.source)) fail(`status.json: feature ${f.name ?? '?'} needs a name and a source state`)
  if (f.release !== null && !/^v\d+\.\d+\.\d+$/.test(f.release ?? '')) fail(`status.json: ${f.name} release must be vX.Y.Z or null`)
  for (const env of ENVS) {
    const s = f[env]
    if (!s) { fail(`status.json: ${f.name} has no ${env} state (record every environment separately)`); continue }
    for (const flag of FLAGS) if (typeof s[flag] !== 'boolean') fail(`status.json: ${f.name}/${env}.${flag} must be true or false`)
    if (s.enabled && !s.deployed) fail(`status.json: ${f.name}/${env} cannot be enabled without being deployed`)
    if (s.verified && !s.enabled) fail(`status.json: ${f.name}/${env} cannot be verified while disabled`)
    if (s.accepted && !s.verified) fail(`status.json: ${f.name}/${env} cannot be owner-accepted before operational verification`)
    if (!ISO_TIME.test(s.verifiedAt ?? '') || !evidenceOk(s.evidence)) fail(`status.json: ${f.name}/${env} needs verifiedAt (UTC ISO) and resolvable evidence`)
  }
}

/* invalid status data cannot be rendered: report it and stop */
if (errors.length) { console.error(errors.map(e => '✖ ' + e).join('\n')); process.exit(1) }

/* ---------- Git tags (when the checkout has them; CI shallow clones may not) ---------- */
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const semver = v => v.replace(/^v/, '').split('.').map(Number)
const newer = (a, b) => { const x = semver(a), y = semver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false }
let tags = []
try { tags = execFileSync('git', ['tag', '-l', 'v*'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(t => /^v\d+\.\d+\.\d+$/.test(t)) } catch { /* no git */ }
if (tags.length && latest) {
  if (!tags.includes(latest.tag)) fail(`status.json: ${latest.tag} is not a tag in this checkout`)
  const highest = tags.reduce((a, b) => newer(b, a) ? b : a)
  if (newer(highest, latest.tag)) fail(`status.json: latestOfficial is ${latest.tag} but ${highest} exists; update the canonical status`)
}

/* ---------- generated outputs ---------- */
const yes = v => v ? 'yes' : 'no'
const short = c => c ? '`' + c.slice(0, 7) + '`' : '—'
const cell = v => String(v ?? '—').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const link = e => /^https:/.test(e) ? `[evidence](${e})` : e.startsWith('Liara API') ? e : `[evidence](../../${e})`
function page() {
  const lines = ['# Openfund status', '',
    '<!-- Generated from docs/status/status.json by `node scripts/docs/status.mjs`; edit the JSON, not this page. -->', '',
    `Canonical, per-environment status. Last updated **${status.updatedAt}**. Source states come from Git; every`,
    'runtime state names the time it was verified and its evidence. Older snapshots elsewhere in the',
    'documentation are historical unless they match this page.', '',
    '## Release', '',
    `- **Latest official release:** [${latest.tag}](${latest.evidence}) — commit \`${latest.commit}\`, published ${latest.publishedAt}.`]
  const next = status.release.next
  if (next) lines.push(`- **Next release:** ${next.version ? 'v' + next.version : 'version not yet allocated'} — ${cell(next.state).replace(/_/g, ' ')}; candidate \`${next.candidateCommit}\`. ${next.note} ([evidence](${next.evidence}))`)
  lines.push('', '## Services', '', '| Environment | Service | Role | Version | Commit | Official | Verified | Evidence | Note |', '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |')
  for (const env of Object.values(status.environments)) for (const s of env.services)
    lines.push(`| ${env.label} | \`${s.id}\` | ${s.role} | ${cell(s.version)} | ${short(s.commit)} | ${s.official === null ? '—' : yes(s.official)} | ${s.verifiedAt.slice(0, 16).replace('T', ' ')} UTC | ${link(s.evidence)} | ${cell(s.note)} |`)
  if (status.environments.local?.note) lines.push('', `Local / Test: ${status.environments.local.note}`)
  lines.push('', '## Features', '', 'Each region is recorded separately. *Deployed* means the code runs there; *Enabled* that the runtime turns it on; *Verified* that it was observed working; *Accepted* that the owner accepted it in production.', '',
    '| Feature | Source | Release | Region | Deployed | Enabled | Verified | Accepted | Detail | Remaining blocker | Evidence |',
    '| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |')
  for (const f of status.features) for (const env of ENVS) {
    const s = f[env]
    lines.push(`| ${env === 'global' ? f.name : ''} | ${env === 'global' ? f.source : ''} | ${env === 'global' ? cell(f.release) : ''} | ${env.toUpperCase()} | ${yes(s.deployed)} | ${yes(s.enabled)} | ${yes(s.verified)} | ${yes(s.accepted)} | ${cell(s.detail)} | ${cell(s.blocker)} | ${link(s.evidence)} (${s.verifiedAt.slice(0, 10)}) |`)
  }
  const owner = status.features.flatMap(f => ENVS.filter(e => f[e].enabled && !f[e].accepted).map(e => `${f.name} (${e.toUpperCase()})`))
  lines.push('', '## Awaiting owner acceptance', '', ...owner.map(x => `- ${x}`), '', '## Updating this page', '',
    '1. Re-verify the runtime fact (for example `node scripts/release/regions-status.mjs`, `GET /version`, `/ready`, `/purchases/plans`).',
    '2. Edit `docs/status/status.json`, including `verifiedAt` and `evidence`.',
    '3. Run `node scripts/docs/status.mjs`, then `npm run docs:check`.', '')
  return lines.join('\n')
}
const START = '<!-- status:summary -->', END = '<!-- /status:summary -->'
function summary() {
  const web = status.environments.global.services.find(s => s.role === 'Web/API')
  const iran = status.environments.iran.services.find(s => s.role === 'Web/API')
  const pay = status.features.find(f => f.name.startsWith('Challenge purchases'))
  const live = status.features.find(f => f.name.startsWith('Live order execution'))
  const desk = status.features.find(f => f.name.startsWith('Open Trade desktop'))
  return [START, '',
    `**Current status** (verified ${status.updatedAt}; canonical: [docs/status](docs/status/README.md)):`, '',
    `- Latest official release: **${latest.tag}** (\`${latest.commit.slice(0, 7)}\`, ${latest.publishedAt}).`,
    `- GLOBAL (Render) Web/API runs ${web.version ? 'v' + web.version : 'an unversioned build'} \`${web.commit.slice(0, 7)}\`; IRAN (Liara) web runs ${iran.version ? 'v' + iran.version : 'an unversioned build'} \`${iran.commit.slice(0, 7)}\`${iran.official ? '' : ' (built as unofficial)'}.`,
    `- Purchases: ${pay.global.enabled ? 'enabled' : 'disabled'} in GLOBAL, ${pay.iran.enabled ? 'enabled' : 'disabled'} in IRAN; a real owner purchase is ${pay.global.accepted ? 'accepted' : 'not yet recorded'}.`,
    `- Live execution: ${live.global.enabled ? 'enabled' : 'disabled'} (${String(live.global.blocker).replace(/\.$/, "")}).`,
    `- Desktop: ${desk.global.detail}`, '', END].join('\n')
}

const outputs = { 'docs/status/README.md': page() }
const readme = read('README.md')
const hasBlock = readme.includes(START) && readme.includes(END)
const readmeNext = hasBlock ? readme.slice(0, readme.indexOf(START)) + summary() + readme.slice(readme.indexOf(END) + END.length) : readme
if (!hasBlock) fail('README.md: missing the generated status block (<!-- status:summary --> … <!-- /status:summary -->)')
outputs['README.md'] = readmeNext

/* ---------- consistency of current documents ---------- */
const CURRENT = ['README.md', 'ROADMAP.md', 'docs/README.md', 'docs/product/FEATURE_STATUS.md', 'docs/roadmap/MILESTONES.md',
  'docs/economy/BUSINESS_MODEL.md', 'docs/payments/ACTIVATION.md', 'docs/payments/OWNER_SETUP.md', 'docs/payments/COUPONS.md',
  'docs/deployment/LAUNCH_PARITY_RUNBOOK.md', 'docs/deployment/RELEASES.md', 'docs/deployment/LIARA_IRAN_RUNTIME.md', 'docs/operations/README.md']
const HISTORICAL = /\b(historical|superseded|archive[sd]?)\b/i
/* drops every section (and its subsections) whose heading is marked historical */
function currentText(markdown) {
  const out = []; let skipLevel = 0, fenced = false
  for (const line of markdown.split('\n')) {
    if (/^```/.test(line)) fenced = !fenced
    const h = !fenced && /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length
      if (skipLevel && level <= skipLevel) skipLevel = 0
      if (!skipLevel && HISTORICAL.test(h[2])) { skipLevel = level; continue }
    }
    out.push(skipLevel ? '' : line)
  }
  return out
}
const web = status.environments.global.services.find(s => s.role === 'Web/API')
const iranDeployed = status.environments.iran.services.some(s => s.commit)
const purchases = status.features.find(f => f.name.startsWith('Challenge purchases'))
const rules = [
  /* each rule: the line names the subject AND asserts the contradicted state */
  iranDeployed && [/\b(IRAN|Iran|Liara)\b/, /\bnot deployed\b/i, 'states that IRAN/Liara is not deployed, but the IRAN runtime is live'],
  purchases?.global.enabled && [/\b(sales|purchases?|payments?|checkout)\b/i, /\bdisabled in production\b/i, 'states that purchases are disabled in production, but GLOBAL purchases are enabled'],
  web?.version === latest.version && [new RegExp(`\\bv${escapeRegExp(latest.version)}\\b`), /\b(deployment awaits|awaits (production )?deploy|pending production deploy|not yet deployed)/i, `states that ${latest.tag} awaits deployment, but GLOBAL runs it`],
].filter(Boolean)
const updated = new Date(status.updatedAt + 'T00:00:00Z').getTime()
for (const path of CURRENT) {
  if (!existsSync(join(root, path))) { fail(`${path}: listed as a current document but missing`); continue }
  const lines = currentText(path === 'README.md' ? readmeNext : read(path))
  lines.forEach((line, i) => {
    for (const [subject, claim, why] of rules) if (subject.test(line) && claim.test(line)) fail(`${path}:${i + 1}: ${why}. Correct it, or move it under a "Historical" heading.`)
    const h = /^#{1,6}\s+(.*)$/.exec(line)
    if (h && /\b(production state|live state|snapshot|current state|deployment status)\b/i.test(h[1])) {
      const date = /(\d{4}-\d{2}-\d{2})/.exec(h[1])
      if (!date) fail(`${path}:${i + 1}: operational snapshot heading "${h[1]}" has no date`)
      else if (updated - new Date(date[1] + 'T00:00:00Z').getTime() > 7 * 86_400_000)
        fail(`${path}:${i + 1}: snapshot "${h[1]}" is older than a week; label it "Historical" or refresh it`)
    }
  })
}

/* ---------- CHANGELOG ---------- */
const changelog = read('CHANGELOG.md')
const headings = changelog.split('\n').filter(l => /^## /.test(l))
if (!headings.some(h => new RegExp(`^## v${escapeRegExp(latest.version)}( —|$)`).test(h)))
  fail(`CHANGELOG.md: no "## v${latest.version}" heading for the latest official release`)
for (const h of headings) {
  const v = /^## Unreleased\b.*\bv(\d+\.\d+\.\d+)\b/.exec(h)
  if (v && !newer(v[1], latest.version)) fail(`CHANGELOG.md: "${h}" labels released v${v[1]} as Unreleased`)
}

/* ---------- write or compare ---------- */
if (process.argv.includes('--check')) {
  for (const [path, text] of Object.entries(outputs)) {
    if (!existsSync(join(root, path)) || read(path) !== text) fail(`${path}: out of date with docs/status/status.json; run node scripts/docs/status.mjs`)
  }
  if (errors.length) { console.error(errors.map(e => '✖ ' + e).join('\n')); process.exit(1) }
  console.log(`Status OK: ${latest.tag}, ${status.features.length} features × ${ENVS.length} regions, ${CURRENT.length} current documents checked.`)
} else {
  for (const [path, text] of Object.entries(outputs)) writeFileSync(join(root, path), text)
  if (errors.length) { console.error(errors.map(e => '✖ ' + e).join('\n')); process.exit(1) }
  console.log('Status outputs written.')
}
