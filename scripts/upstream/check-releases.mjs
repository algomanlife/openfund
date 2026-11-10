#!/usr/bin/env node
/**
 * Upstream release watcher (read-only, no repository changes).
 *
 *   node scripts/upstream/check-releases.mjs [--json out.json] [--md out.md] [--write-registry]
 *
 * For every registry provider with a `watch` entry it: reads the installed version from the registry,
 * finds the newest upstream release (GitHub releases, GitHub default-branch head, or npm `latest`),
 * collects the release notes of every release newer than the installed one, classifies the
 * compatibility risk by the provider's own versioning policy, and reports. With --write-registry it
 * refreshes ONLY `latest_observed` (marked reviewed:false). It never edits vendored source, lockfiles,
 * the Blueprint or any pinned version, and it never merges or deploys anything.
 *
 * GITHUB_TOKEN (optional) raises GitHub API limits. No other secret is read.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export const semver = (s) => {
  const m = String(s).replace(/^[^\d]*/, '').match(/^(\d+)\.(\d+)\.(\d+)(-[\w.]+)?/)
  return m ? { n: [Number(m[1]), Number(m[2]), Number(m[3])], pre: Boolean(m[4]) } : null
}
export const cmp = (a, b) => a.n[0] - b.n[0] || a.n[1] - b.n[1] || a.n[2] - b.n[2]
const bump = (from, to) => (to.n[0] !== from.n[0] ? 'major' : to.n[1] !== from.n[1] ? 'minor' : to.n[2] !== from.n[2] ? 'patch' : 'none')

/** Markers of an upstream-declared breaking change or a requirement change inside release notes. */
export function breakingSignals(notes) {
  const text = notes.join('\n')
  const out = []
  if (/potential breaking changes|^#+\s*breaking|\*\*breaking\b|breaking change/im.test(text)) out.push('release notes declare breaking changes')
  if (/minimum required node\.?js version|requires? node(\.js)?\s*(>=?\s*)?\d+|node\.js \d+ (is )?required/i.test(text)) out.push('runtime requirement changed (Node.js)')
  if (/licen[cs]e (enforcement|changed|tier)|relicensed|changed license/i.test(text)) out.push('licensing terms changed')
  if (/security|advisory|GHSA-|CVE-/i.test(text)) out.push('mentions a security fix')
  return out
}

/**
 * Pure classification by the provider's versioning policy (registry `policy.scheme`).
 * risk: none | low | medium | high.  action: none | proposal | manual-review | blocked-owner-decision.
 * Nothing here ever yields an automatic merge or deployment.
 */
export function classify({ scheme, installed, latest, notes = [] }) {
  const from = semver(installed), to = semver(latest)
  const reasons = []
  if (scheme === 'source-head') {
    if (installed === latest) return { risk: 'none', action: 'none', reasons: ['at head'] }
    return { risk: 'medium', action: 'manual-review', reasons: ['new upstream commits on the default branch; review the diff, licence and notice files'] }
  }
  if (!from || !to) return { risk: 'high', action: 'manual-review', reasons: [`cannot compare versions "${installed}" and "${latest}"`] }
  const kind = bump(from, to)
  if (kind === 'none' || cmp(to, from) <= 0) return { risk: 'none', action: 'none', reasons: ['up to date'] }
  const signals = breakingSignals(notes)
  let risk, action = 'proposal'
  if (scheme === 'semver-0x' && from.n[0] === 0) {
    risk = kind === 'patch' ? 'medium' : 'high'
    reasons.push(`0.x line: ${kind} release can break (provider does not promise semver compatibility)`)
  } else if (scheme === 'directus') {
    risk = kind === 'major' ? 'high' : kind === 'minor' ? 'medium' : 'low'
    if (kind === 'major') { action = 'blocked-owner-decision'; reasons.push('Directus major: licence tier, Node.js and API changes need an owner decision and the staged migration runbook') }
    if (signals.some((s) => /breaking|runtime|licens/.test(s))) { risk = 'high'; reasons.push('Directus minors carry "Potential Breaking Changes" sections; this range does') }
  } else {
    risk = kind === 'major' ? 'high' : kind === 'minor' ? 'medium' : 'low'
    if (kind === 'major') { action = 'blocked-owner-decision'; reasons.push('major release: deliberate migration, never automatic') }
  }
  if (signals.length && risk !== 'high' && signals.some((s) => /breaking|runtime|licens/.test(s))) { risk = 'high'; reasons.push(...signals.filter((s) => /breaking|runtime|licens/.test(s))) }
  else reasons.push(...signals)
  if (risk === 'high' && action === 'proposal') action = 'manual-review'
  reasons.unshift(`${kind} update ${installed} -> ${latest}`)
  return { risk, action, reasons: [...new Set(reasons)] }
}

async function getJson(fetchImpl, url, token) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'openfund-upstream-watch' }
  if (token && url.startsWith('https://api.github.com')) headers.Authorization = `Bearer ${token}`
  const res = await fetchImpl(url, { headers })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.json()
}

/** Newest upstream state plus the notes of every release newer than `installed`. */
export async function fetchUpstream(provider, { fetchImpl = fetch, token = process.env.GITHUB_TOKEN } = {}) {
  const w = provider.watch
  if (w.type === 'github-releases') {
    const releases = await getJson(fetchImpl, `https://api.github.com/repos/${w.repo}/releases?per_page=100`, token)
    const prefix = w.tag_prefix ?? ''
    const stable = releases.filter((r) => !r.draft && !r.prerelease && r.tag_name.startsWith(prefix) && semver(r.tag_name.slice(prefix.length)))
      .map((r) => ({ r, v: semver(r.tag_name.slice(prefix.length)) })).sort((a, b) => cmp(b.v, a.v))
    if (!stable.length) throw new Error(`no stable releases for ${w.repo}`)
    const installed = semver(provider.installed.version)
    const newer = stable.filter((x) => installed && cmp(x.v, installed) > 0)
    return { version: stable[0].r.tag_name.slice(prefix.length), date: stable[0].r.published_at?.slice(0, 10), url: stable[0].r.html_url, notes: newer.map((x) => `#### ${x.r.tag_name}\n${x.r.body ?? ''}`) }
  }
  if (w.type === 'github-head') {
    const c = await getJson(fetchImpl, `https://api.github.com/repos/${w.repo}/commits/${w.branch}`, token)
    return { version: c.sha, date: c.commit?.committer?.date?.slice(0, 10), url: c.html_url, notes: [c.commit?.message ?? ''] }
  }
  if (w.type === 'npm') {
    const doc = await getJson(fetchImpl, `https://registry.npmjs.org/${w.package.replace('/', '%2F')}`)
    const latest = doc['dist-tags']?.latest
    return { version: latest, date: doc.time?.[latest]?.slice(0, 10), url: `https://www.npmjs.com/package/${w.package}/v/${latest}`, notes: [] }
  }
  return null
}

export async function checkAll(registry, opts = {}) {
  const results = []
  for (const p of registry.providers) {
    const row = { id: p.id, name: p.name, installed: p.installed.version, scheme: p.policy?.scheme, watch: p.watch.type }
    if (p.watch.type === 'none') { results.push({ ...row, status: 'not-watched', reasons: [p.watch.reason] }); continue }
    try {
      const up = await fetchUpstream(p, opts)
      const installedForCompare = p.watch.type === 'github-head' ? p.installed.ref : p.installed.version
      const c = classify({ scheme: p.policy.scheme, installed: installedForCompare, latest: up.version, notes: up.notes })
      results.push({ ...row, latest: up.version, date: up.date, url: up.url, ...c, status: c.action === 'none' ? 'up-to-date' : 'update-available', notes_excerpt: up.notes.join('\n').slice(0, 1500) })
    } catch (e) { results.push({ ...row, status: 'error', reasons: [e.message] }) }
  }
  return results
}

export function toMarkdown(results, generated = new Date().toISOString().slice(0, 10)) {
  const lines = [`# Upstream release watch (${generated})`, '', 'Read-only report. No dependency, vendored source or deployment was changed. Every update below is a **proposal that needs human review**; majors need an owner decision.', '', '| Provider | Installed | Latest | Risk | Action | Why |', '| :--- | :--- | :--- | :--- | :--- | :--- |']
  for (const r of results) {
    if (r.status === 'not-watched') lines.push(`| ${r.name} | ${r.installed} | n/a | n/a | contract tests | ${r.reasons[0]} |`)
    else if (r.status === 'error') lines.push(`| ${r.name} | ${r.installed} | ? | ? | check failed | ${r.reasons[0]} |`)
    else lines.push(`| ${r.name} | ${r.installed} | ${String(r.latest).slice(0, 12)} | ${r.risk} | ${r.action} | ${(r.reasons ?? []).join('; ')} |`)
  }
  return lines.join('\n') + '\n'
}

export function refreshRegistry(registry, results) {
  for (const r of results) {
    if (r.status !== 'update-available' && r.status !== 'up-to-date') continue
    const p = registry.providers.find((x) => x.id === r.id)
    const same = String(p.latest_observed?.version) === String(r.latest).slice(0, p.watch.type === 'github-head' ? 40 : 99)
    if (r.status === 'up-to-date') { if (!same && p.watch.type !== 'github-head') p.latest_observed = { ...p.latest_observed, version: r.latest, date: r.date, reviewed: true }; continue }
    if (!same) p.latest_observed = { version: p.watch.type === 'github-head' ? String(r.latest).slice(0, 12) : r.latest, date: r.date, reviewed: false, ...(p.latest_observed?.note ? { note: p.latest_observed.note } : {}) }
  }
  return registry
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2)
  const arg = (n) => (a.includes(n) ? a[a.indexOf(n) + 1] : null)
  const registryPath = path.join(ROOT, 'infra/upstream/registry.json')
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  const results = await checkAll(registry)
  const md = toMarkdown(results)
  console.log(md)
  if (arg('--json')) writeFileSync(arg('--json'), JSON.stringify(results, null, 2) + '\n')
  if (arg('--md')) writeFileSync(arg('--md'), md)
  if (a.includes('--write-registry')) writeFileSync(registryPath, JSON.stringify(refreshRegistry(registry, results), null, 2) + '\n')
  const errors = results.filter((r) => r.status === 'error')
  process.exit(errors.length === results.length ? 1 : 0)
}
