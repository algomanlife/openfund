#!/usr/bin/env node
/**
 * Controlled update of a vendored upstream (Vela, Gains SDK, Trade Journal core).
 *
 *   node scripts/upstream/update-vendor.mjs --provider vela                 # report for the latest tag (read-only)
 *   node scripts/upstream/update-vendor.mjs --provider vela --to v0.10.4    # report for an exact tag
 *   node scripts/upstream/update-vendor.mjs --provider vela --to v0.10.4 --apply
 *
 * What it does (and never does):
 *  1. Fetches the installed ref and the target ref from the official repository into a scratch directory.
 *  2. PROVES the vendored tree equals "upstream at the installed ref + the registered patches" by
 *     reverse-applying the patches to a copy. If not, an undocumented edit exists: stop.
 *  3. Diffs installed -> target and flags: version bump class, changed licence/NOTICE text (legal review),
 *     package manifest / exports / engines changes, upstream files our patches touch, changelog entries,
 *     and "BREAKING" markers.
 *  4. Re-applies the registered patches to the target tree. Any patch that does not apply cleanly is a
 *     conflict: the run exits 2 and the working tree is NOT modified.
 *  5. With --apply and no conflicts, writes the new vendor tree, regenerated patch files, the updated
 *     registry entry and the vendor manifest into the working tree. It never commits, pushes, builds,
 *     deploys or opens a pull request; a human runs the regression suite and reviews the diff.
 *
 * Exit codes: 0 report/apply ok, 1 error, 2 patch conflict or undocumented local edit, 3 nothing to update.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const here = path.dirname(fileURLToPath(import.meta.url))

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 })
const sha = (b) => createHash('sha256').update(b).digest('hex')

export function parseSemver(tag, prefix = 'v') {
  const m = tag.startsWith(prefix) ? tag.slice(prefix.length).match(/^(\d+)\.(\d+)\.(\d+)$/) : null
  return m ? m.slice(1).map(Number) : null
}
export const cmpSemver = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
export function bumpClass(from, to) {
  if (!from || !to) return 'unknown'
  if (to[0] !== from[0]) return 'major'
  if (to[1] !== from[1]) return 'minor'
  if (to[2] !== from[2]) return 'patch'
  return 'none'
}

function listFiles(dir, base = dir) {
  const out = []
  for (const n of readdirSync(dir).sort()) {
    if (n === '.git' || n === 'node_modules') continue
    const p = path.join(dir, n)
    if (statSync(p).isDirectory()) out.push(...listFiles(p, base))
    else out.push(path.relative(base, p))
  }
  return out
}
const readTree = (dir) => Object.fromEntries(listFiles(dir).map((f) => [f, sha(readFileSync(path.join(dir, f)))]))

function diffTrees(a, b) {
  const added = Object.keys(b).filter((f) => !(f in a))
  const removed = Object.keys(a).filter((f) => !(f in b))
  const modified = Object.keys(a).filter((f) => f in b && a[f] !== b[f])
  return { added, removed, modified }
}

function exportRef(repoDir, ref, subdir, dest) {
  mkdirSync(dest, { recursive: true })
  const spec = subdir ? `${ref}:${subdir}` : ref
  const tar = path.join(path.dirname(dest), `${path.basename(dest)}.tar`)
  execFileSync('git', ['-C', repoDir, 'archive', '--format=tar', '-o', tar, spec])
  execFileSync('tar', ['-xf', tar, '-C', dest])
  rmSync(tar)
}

/** Extract changelog text between two versions (Keep-a-Changelog style headings "## [x.y.z]" or "## x.y.z"). */
export function changelogBetween(text, fromVersion, toVersion) {
  const lines = text.split('\n')
  const idx = (v) => lines.findIndex((l) => /^##\s/.test(l) && l.includes(v))
  const start = idx(toVersion)
  if (start < 0) return ''
  let end = idx(fromVersion)
  if (end < 0 || end < start) end = lines.length
  return lines.slice(start, end).join('\n').trim()
}

function jsonOrNull(p) { try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null } }

function manifestDelta(oldDir, newDir) {
  const a = jsonOrNull(path.join(oldDir, 'package.json')) ?? {}
  const b = jsonOrNull(path.join(newDir, 'package.json')) ?? {}
  const out = []
  for (const k of ['dependencies', 'peerDependencies', 'devDependencies', 'engines', 'exports', 'main', 'module', 'types', 'license']) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(k)
  }
  return { from: a.version, to: b.version, changed: out }
}

export function applyPatchesTo(tree, patchFiles) {
  const conflicts = []
  const applied = []
  for (const pf of patchFiles) {
    try { execFileSync('git', ['apply', '--check', pf], { cwd: tree, stdio: 'pipe' }); execFileSync('git', ['apply', pf], { cwd: tree, stdio: 'pipe' }); applied.push(pf) }
    catch (e) { conflicts.push({ patch: path.basename(pf), reason: String(e.stderr || e.message).trim().split('\n').slice(0, 3).join(' | ') }) }
  }
  return { applied, conflicts }
}

export function regeneratePatches(pristineDir, patchedDir, files, outDir, names) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'of-regen-'))
  try {
    git(tmp, 'init', '-q')
    for (const f of files) { mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); cpSync(path.join(pristineDir, f), path.join(tmp, f)) }
    git(tmp, 'add', '-A'); git(tmp, '-c', 'user.name=u', '-c', 'user.email=u@u', 'commit', '-qm', 'base')
    for (const f of files) cpSync(path.join(patchedDir, f), path.join(tmp, f))
    mkdirSync(outDir, { recursive: true })
    files.forEach((f, i) => writeFileSync(path.join(outDir, names[i]), git(tmp, 'diff', '--', f)))
  } finally { rmSync(tmp, { recursive: true, force: true }) }
}

export async function run(argv, env = {}) {
  const args = {}
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[++i]
  const ROOT = path.resolve(args.root || env.root || path.join(here, '../..'))
  const registryPath = path.join(ROOT, 'infra/upstream/registry.json')
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  const provider = registry.providers.find((p) => p.id === args.provider)
  const log = []
  const say = (s = '') => { log.push(s); console.log(s) }
  if (!provider || provider.kind !== 'vendored-source' || !provider.update) { console.error(`provider "${args.provider}" is not a vendored source with an update recipe`); return { code: 1, log } }
  const u = provider.update
  const url = args['upstream-url'] || u.repo_url
  const scratch = mkdtempSync(path.join(os.tmpdir(), `of-update-${provider.id}-`))
  const keep = Boolean(args.keep)
  try {
    const repo = path.join(scratch, 'upstream')
    execFileSync('git', ['clone', '--quiet', '--no-checkout', url, repo], { stdio: 'pipe' })
    const tags = git(repo, 'tag', '--list').split('\n').filter(Boolean)
    const installedRef = provider.installed.ref
    const installedTag = u.tag_prefix !== undefined ? `${u.tag_prefix}${provider.installed.version}` : null
    let target = args.to
    if (!target) {
      const semver = tags.map((t) => [t, parseSemver(t, u.tag_prefix ?? 'v')]).filter(([, v]) => v).sort((a, b) => cmpSemver(a[1], b[1]))
      target = semver.length ? semver.at(-1)[0] : git(repo, 'rev-parse', 'HEAD').trim()
    }
    const targetSha = git(repo, 'rev-parse', `${target}^{commit}`).trim()
    if (targetSha === installedRef) { say(`${provider.id}: already at ${target} (${targetSha.slice(0, 12)}). Nothing to update.`); return { code: 3, log } }

    const baseDir = path.join(scratch, 'base'); const theirsDir = path.join(scratch, 'theirs')
    exportRef(repo, installedRef, u.subdir, baseDir); exportRef(repo, targetSha, u.subdir, theirsDir)

    /* 2. vendored tree == base + registered patches ? */
    const vendorDir = path.join(ROOT, u.vendor_path)
    const patchDir = path.join(ROOT, u.patch_dir.replace('{version}', provider.installed.version))
    const patchFiles = existsSync(patchDir) ? readdirSync(patchDir).filter((f) => f.endsWith('.patch')).sort().map((f) => path.join(patchDir, f)) : []
    const reconstructed = path.join(scratch, 'reconstructed'); cpSync(baseDir, reconstructed, { recursive: true })
    const reapplied = applyPatchesTo(reconstructed, patchFiles)
    const ours = readTree(vendorDir)
    const mismatch = diffTrees(readTree(reconstructed), ours)
    const undocumented = [...mismatch.added, ...mismatch.removed, ...mismatch.modified].filter((f) => !f.startsWith('node_modules/'))
    say(`# ${provider.name}: ${provider.installed.version} (${installedRef.slice(0, 12)}) -> ${target} (${targetSha.slice(0, 12)})`)
    say()
    say(`Vendored tree vs upstream@installed + ${patchFiles.length} registered patch(es): ${undocumented.length === 0 && reapplied.conflicts.length === 0 ? 'IDENTICAL' : 'MISMATCH'}`)
    if (undocumented.length || reapplied.conflicts.length) {
      for (const f of undocumented.slice(0, 20)) say(`  undocumented difference: ${f}`)
      for (const c of reapplied.conflicts) say(`  patch does not apply to the pristine installed ref: ${c.patch}`)
      say('Resolve (register the edit as a patch or remove it) before updating.')
      return { code: 2, log }
    }

    /* 3. diff + flags */
    const d = diffTrees(readTree(baseDir), readTree(theirsDir))
    const fromV = parseSemver(`${u.tag_prefix ?? 'v'}${provider.installed.version}`, u.tag_prefix ?? 'v')
    const toV = parseSemver(target, u.tag_prefix ?? 'v')
    const bump = bumpClass(fromV, toV)
    const flags = []
    const risk = !fromV || fromV[0] === 0 ? (bump === 'none' ? 'low' : bump === 'patch' ? 'medium' : 'high') : bump === 'major' ? 'high' : bump === 'minor' ? 'medium' : 'low'
    if (bump === 'major' || (fromV?.[0] === 0 && bump === 'minor')) flags.push(`${bump} bump on ${fromV?.[0] === 0 ? '0.x (minor can break)' : 'a stable line'}`)
    for (const legal of ['LICENSE', 'NOTICE']) if (d.modified.includes(legal) || d.added.includes(legal) || d.removed.includes(legal)) flags.push(`${legal} changed: LEGAL REVIEW of attribution/licence handling required`)
    const patchedFiles = [...new Set(patchFiles.flatMap((p) => [...readFileSync(p, 'utf8').matchAll(/^diff --git a\/(\S+)/gm)].map((m) => m[1])))]
    const touchedPatched = patchedFiles.filter((f) => d.modified.includes(f) || d.removed.includes(f))
    if (touchedPatched.length) flags.push(`upstream also changed ${touchedPatched.length} file(s) that Openfund patches: ${touchedPatched.join(', ')}`)
    const md = manifestDelta(baseDir, theirsDir)
    if (md.changed.length) flags.push(`package manifest fields changed: ${md.changed.join(', ')}`)
    const clText = existsSync(path.join(theirsDir, 'CHANGELOG.md')) ? changelogBetween(readFileSync(path.join(theirsDir, 'CHANGELOG.md'), 'utf8'), provider.installed.version, String(toV ? toV.join('.') : '')) : ''
    if (/breaking/i.test(clText)) flags.push('changelog mentions BREAKING')
    say(`Files: ${d.added.length} added, ${d.removed.length} removed, ${d.modified.length} modified`)
    say(`Version class: ${bump}; classified risk: ${risk}`)
    for (const f of flags) say(`FLAG: ${f}`)
    if (clText) { say(); say('Changelog excerpt (first 60 lines):'); say(clText.split('\n').slice(0, 60).join('\n')) }

    /* 4. re-apply registered patches onto the target */
    const candidate = path.join(scratch, 'candidate'); cpSync(theirsDir, candidate, { recursive: true })
    const result = applyPatchesTo(candidate, patchFiles)
    say()
    say(`Patch re-application: ${result.applied.length} clean, ${result.conflicts.length} conflict(s)`)
    for (const c of result.conflicts) say(`CONFLICT ${c.patch}: ${c.reason}`)
    if (result.conflicts.length) { say('Working tree NOT modified. Port the patch by hand against the new upstream, then re-run.'); return { code: 2, log } }

    if (!args.apply) { say(); say('Report only. Re-run with --apply to write the candidate into the working tree (no commit, no build).'); return { code: 0, log, risk, flags } }

    /* 5. write candidate */
    for (const f of readdirSync(vendorDir)) if (f !== 'node_modules') rmSync(path.join(vendorDir, f), { recursive: true, force: true })
    for (const f of readdirSync(candidate)) cpSync(path.join(candidate, f), path.join(vendorDir, f), { recursive: true })
    const newVersion = md.to ?? String(toV?.join('.') ?? target)
    const newPatchDir = path.join(ROOT, u.patch_dir.replace('{version}', newVersion))
    if (patchFiles.length) {
      const files = patchedFiles
      const names = patchFiles.map((p) => path.basename(p))
      /* one patch file per patched file, same order as the original set */
      regeneratePatches(theirsDir, candidate, files, newPatchDir, names)
      if (newPatchDir !== patchDir) rmSync(patchDir, { recursive: true, force: true })
    }
    const oldVersion = provider.installed.version
    provider.installed.version = newVersion; provider.installed.ref = targetSha
    provider.last_upgrade = `${new Date().toISOString().slice(0, 10)} (candidate ${newVersion}; not yet reviewed)`
    provider.compatibility = { status: 'candidate-unreviewed', evidence: 'update-vendor --apply ran; regression suite and review pending' }
    writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n')
    const patchesPath = path.join(ROOT, 'infra/upstream/patches.json')
    const patches = JSON.parse(readFileSync(patchesPath, 'utf8'))
    for (const p of patches.patches) {
      if (p.provider !== provider.id) continue
      p.affected_version = newVersion
      if (p.patch_file) p.patch_file = path.posix.join(u.patch_dir.replace('{version}', newVersion), path.basename(p.patch_file))
    }
    writeFileSync(patchesPath, JSON.stringify(patches, null, 2) + '\n')
    void oldVersion
    say(); say(`Applied to the working tree: ${u.vendor_path}, registry, patches. Next (human): see docs/integrations/VELA_UPGRADE.md steps 5-9.`)
    return { code: 0, log, risk, flags, applied: true }
  } catch (e) {
    console.error(`ERROR: ${String(e.stderr || e.message).split('\n')[0]}`)
    return { code: 1, log }
  } finally { if (!keep) rmSync(scratch, { recursive: true, force: true }) }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { code, log } = await run(process.argv.slice(2))
  if (process.argv.includes('--report')) writeFileSync(process.argv[process.argv.indexOf('--report') + 1], log.join('\n') + '\n')
  process.exit(code)
}
