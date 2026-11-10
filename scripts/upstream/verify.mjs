#!/usr/bin/env node
/**
 * Offline verification of Openfund's upstream isolation (no network, no secrets).
 *
 *   node scripts/upstream/verify.mjs                  # check everything
 *   node scripts/upstream/verify.mjs --write-manifest # regenerate infra/upstream/vendor-manifest.json
 *
 * Checks:
 *   1. registry   — schema, installed versions agree with vendored manifests, lockfiles and render.yaml,
 *                   integration paths exist, listed npm scripts exist
 *   2. vendor     — every file under vendor/ and third_party/ matches infra/upstream/vendor-manifest.json
 *                   (an upstream update or a stray edit cannot slip in without a reviewed manifest change)
 *   3. patches    — each patch reverse-applies to the vendored tree and its guard string is present
 *   4. guards     — Openfund customizations (branding, legal attribution, themes, indicators, ...) still present
 *   5. mirrors    — public/dist copies are byte-identical to their single source
 *   6. boundary   — application code does not import from vendor/ or third_party/ directly
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
let CUR = ROOT
export const setRoot = (r) => { CUR = r }   /* tests point the checks at a scratch tree */
const rel = (p) => path.join(CUR, p)
const readJson = (p) => JSON.parse(readFileSync(rel(p), 'utf8'))
const sha = (buf) => createHash('sha256').update(buf).digest('hex')

export const VENDOR_ROOTS = ['vendor/vela', 'vendor/gains-sdk', 'third_party/luxalgo-trade-journal']
const SKIP_DIRS = new Set(['node_modules', '.git'])

export function walk(dir) {
  const out = []
  for (const name of readdirSync(rel(dir)).sort()) {
    if (SKIP_DIRS.has(name)) continue
    const p = path.posix.join(dir, name)
    if (statSync(rel(p)).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

export function buildManifest() {
  const manifest = {}
  for (const root of VENDOR_ROOTS) {
    manifest[root] = Object.fromEntries(walk(root).map((f) => [f.slice(root.length + 1), sha(readFileSync(rel(f)))]))
  }
  return manifest
}

export function loadAll() {
  return {
    registry: readJson('infra/upstream/registry.json'),
    patches: readJson('infra/upstream/patches.json'),
    customizations: readJson('infra/upstream/customizations.json'),
  }
}

const VALID_KINDS = ['vendored-source', 'npm', 'docker-image', 'hosted-api']
const VALID_WATCH = ['github-releases', 'github-head', 'npm', 'none']
const REQUIRED = ['id', 'name', 'kind', 'layer', 'official_source', 'license', 'installed', 'latest_observed', 'integration_path', 'watch', 'policy', 'compatibility', 'last_upgrade', 'tests', 'upgrade_instructions', 'rollback_limits']

export function checkRegistry({ registry }) {
  const problems = []
  const ids = new Set()
  const rootScripts = readJson('package.json').scripts
  for (const p of registry.providers) {
    const where = `registry:${p.id ?? '?'}`
    for (const k of REQUIRED) if (p[k] === undefined) problems.push(`${where} missing field ${k}`)
    if (ids.has(p.id)) problems.push(`${where} duplicated id`)
    ids.add(p.id)
    if (!VALID_KINDS.includes(p.kind)) problems.push(`${where} unknown kind ${p.kind}`)
    if (!VALID_WATCH.includes(p.watch?.type)) problems.push(`${where} unknown watch type ${p.watch?.type}`)
    for (const f of p.integration_path ?? []) if (!existsSync(rel(f))) problems.push(`${where} integration path missing: ${f}`)
    const doc = p.upgrade_instructions?.match(/(docs\/[A-Za-z0-9_./-]+\.md|third_party\/[A-Za-z0-9_./-]+\.md)/)?.[1]
    if (doc && !existsSync(rel(doc))) problems.push(`${where} upgrade instructions point at a missing file: ${doc}`)
    for (const t of p.tests ?? []) {
      const m = t.match(/^npm run ([\w:-]+)$/)
      if (m && !(m[1] in rootScripts)) problems.push(`${where} test script not in root package.json: ${m[1]}`)
      const f = t.match(/^node (?:--test )?([\w./-]+\.(?:mjs|js|cjs))/)?.[1]
      if (f && !existsSync(rel(f))) problems.push(`${where} test file missing: ${f}`)
    }
    const i = p.installed
    if (p.kind === 'vendored-source') {
      const version = readJson(i.manifest).version
      if (version !== i.version) problems.push(`${where} installed ${i.version} but ${i.manifest} says ${version}`)
    } else if (p.kind === 'npm') {
      const lock = readJson(i.lockfile).packages?.[`node_modules/${i.package}`]?.version
      if (lock !== i.version) problems.push(`${where} installed ${i.version} but ${i.lockfile} locks ${lock}`)
    } else if (p.kind === 'docker-image') {
      const text = readFileSync(rel(i.path), 'utf8')
      if (!text.includes(`${i.image_pattern}${i.version}`)) problems.push(`${where} ${i.path} does not pin ${i.image_pattern}${i.version}`)
    }
  }
  return problems
}

export function checkVendor() {
  const problems = []
  const manifestPath = 'infra/upstream/vendor-manifest.json'
  if (!existsSync(rel(manifestPath))) return [`${manifestPath} missing; run with --write-manifest and review`]
  const recorded = readJson(manifestPath)
  const actual = buildManifest()
  for (const root of VENDOR_ROOTS) {
    const a = actual[root] ?? {}
    const r = recorded[root] ?? {}
    for (const f of Object.keys(a)) {
      if (!(f in r)) problems.push(`${root}/${f} is not in the vendor manifest (added)`)
      else if (a[f] !== r[f]) problems.push(`${root}/${f} differs from the vendor manifest (modified outside the patch registry?)`)
    }
    for (const f of Object.keys(r)) if (!(f in a)) problems.push(`${root}/${f} is in the vendor manifest but missing (deleted)`)
  }
  return problems
}

export function checkPatches({ patches }) {
  const problems = []
  const patchedFiles = new Set()
  for (const p of patches.patches) {
    const where = `patch:${p.id}`
    for (const f of p.files) if (!existsSync(rel(f))) problems.push(`${where} file missing: ${f}`)
    if (p.kind === 'source') {
      for (const f of p.files) patchedFiles.add(f)
      if (!p.patch_file || !existsSync(rel(p.patch_file))) problems.push(`${where} patch file missing`)
      else {
        try {
          execFileSync('git', ['apply', '-R', '--check', `--directory=${p.files[0].split('/').slice(0, 2).join('/')}`, rel(p.patch_file)], { cwd: CUR, stdio: 'pipe' })
        } catch (e) {
          problems.push(`${where} patch no longer reverse-applies to the vendored tree: ${String(e.stderr || e.message).trim().split('\n')[0]}`)
        }
      }
    }
    const g = p.guard
    if (!g || !existsSync(rel(g.file)) || !readFileSync(rel(g.file), 'utf8').includes(g.contains)) problems.push(`${where} guard string not found in ${g?.file}`)
    if (!p.regression_tests?.length) problems.push(`${where} has no regression test`)
    for (const t of p.regression_tests ?? []) {
      const m = t.match(/^npm run ([\w:-]+)$/)
      if (m && !(m[1] in readJson('package.json').scripts)) problems.push(`${where} regression script missing: ${m[1]}`)
    }
    for (const f of ['reason', 'affected_version', 'removal_condition']) if (!p[f]) problems.push(`${where} missing ${f}`)
  }
  return problems
}

export function checkGuards({ customizations }) {
  const problems = []
  for (const g of customizations.guards) {
    const where = `guard:${g.id}`
    if (!existsSync(rel(g.file))) { problems.push(`${where} file missing: ${g.file}`); continue }
    const text = readFileSync(rel(g.file), 'utf8')
    if (g.contains !== undefined && !text.includes(g.contains)) problems.push(`${where} expected text not found in ${g.file}: ${g.contains.slice(0, 60)}`)
    if (g.regex !== undefined && !new RegExp(g.regex).test(text)) problems.push(`${where} pattern not found in ${g.file}`)
    if (g.absent !== undefined && new RegExp(g.absent).test(text)) problems.push(`${where} forbidden pattern present in ${g.file}`)
  }
  return problems
}

export function checkMirrors({ customizations }) {
  const problems = []
  for (const m of customizations.mirrors) {
    if (!existsSync(rel(m.source))) { problems.push(`mirror:${m.id} source missing: ${m.source}`); continue }
    const want = sha(readFileSync(rel(m.source)))
    for (const c of m.copies) {
      if (!existsSync(rel(c))) problems.push(`mirror:${m.id} copy missing: ${c}`)
      else if (sha(readFileSync(rel(c))) !== want) problems.push(`mirror:${m.id} ${c} differs from ${m.source}`)
    }
  }
  return problems
}

export function checkBoundary() {
  const problems = []
  const scan = (dir) => {
    for (const name of readdirSync(rel(dir))) {
      if (SKIP_DIRS.has(name) || name === 'dist' || name === 'assets') continue
      const p = path.posix.join(dir, name)
      if (statSync(rel(p)).isDirectory()) { scan(p); continue }
      if (!/\.(m?js|cjs|tsx?)$/.test(name) || /\.min\./.test(name)) continue
      const text = readFileSync(rel(p), 'utf8')
      if (/(?:from|import|require\()\s*['"][^'"]*\b(?:vendor|third_party)\//.test(text)) {
        /* apps/backend/portfolio.js imports the compiled journal-core bundle: the one documented integration seam */
        if (p === 'apps/backend/portfolio.js') continue
        problems.push(`boundary: ${p} imports vendored source directly; route it through packages/`)
      }
    }
  }
  for (const d of ['apps/backend', 'apps/web-react/src']) scan(d)
  return problems
}

export function runAll() {
  const data = loadAll()
  return {
    registry: checkRegistry(data),
    vendor: checkVendor(),
    patches: checkPatches(data),
    guards: checkGuards(data),
    mirrors: checkMirrors(data),
    boundary: checkBoundary(),
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--write-manifest')) {
    writeFileSync(rel('infra/upstream/vendor-manifest.json'), JSON.stringify(buildManifest(), null, 1) + '\n')
    console.log('infra/upstream/vendor-manifest.json written; review the diff before committing')
  } else {
    const results = runAll()
    let failed = 0
    for (const [name, problems] of Object.entries(results)) {
      console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${name}${problems.length ? '' : ''}`)
      for (const p of problems) { console.log(`        ${p}`); failed++ }
    }
    console.log(failed ? `\n${failed} problem(s)` : '\nupstream isolation checks passed')
    process.exit(failed ? 1 : 0)
  }
}
