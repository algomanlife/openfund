/* The canonical status validator fails on each inconsistency it guards
 * against, and passes on the repository itself. Each case copies the real
 * inputs into a temporary root and introduces one defect. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const script = join(repo, 'scripts/docs/status.mjs')
const INPUTS = ['docs/status/status.json', 'docs/status/README.md', 'README.md', 'CHANGELOG.md', 'ROADMAP.md', 'docs/README.md',
  'docs/product/FEATURE_STATUS.md', 'docs/roadmap/MILESTONES.md', 'docs/economy/BUSINESS_MODEL.md', 'docs/payments/ACTIVATION.md',
  'docs/payments/OWNER_SETUP.md', 'docs/payments/COUPONS.md', 'docs/deployment/LAUNCH_PARITY_RUNBOOK.md', 'docs/deployment/RELEASES.md',
  'docs/deployment/LIARA_IRAN_RUNTIME.md', 'docs/operations/README.md', 'docs/backstage/README.md']

function fixture(mutate) {
  const root = mkdtempSync(join(tmpdir(), 'openfund-status-'))
  for (const path of INPUTS) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    if (existsSync(join(repo, path))) cpSync(join(repo, path), join(root, path))
  }
  const edit = (path, fn) => writeFileSync(join(root, path), fn(readFileSync(join(root, path), 'utf8')))
  mutate?.(edit, root)
  const run = spawnSync(process.execPath, [script, '--check'], { env: { ...process.env, STATUS_ROOT: root }, encoding: 'utf8' })
  rmSync(root, { recursive: true, force: true })
  return { code: run.status, out: run.stdout + run.stderr }
}
/* the cases follow the recorded latest release, so a release update cannot break them */
const LATEST = JSON.parse(readFileSync(join(repo, 'docs/status/status.json'), 'utf8')).release.latestOfficial.version
/* full regex escape (every metacharacter, including backslash), and the
   recorded version must be plain SemVer before it is used in a pattern */
assert.match(LATEST, /^\d+\.\d+\.\d+$/, 'status.json latestOfficial.version is plain SemVer')
const esc = v => v.replace(/[\\^$.*+?()[\]{}|\/-]/g, '\\$&')
const NEXT = LATEST.replace(/^(\d+)\.(\d+)\.\d+$/, (_, major, minor) => `${major}.${Number(minor) + 1}.0`)
const json = (path, fn) => text => { const v = JSON.parse(text); fn(v); return JSON.stringify(v, null, 2) + '\n' }

test('the repository passes', () => {
  const { code, out } = fixture()
  assert.equal(code, 0, out)
  assert.match(out, /Status OK/)
})

test('a released version still labelled Unreleased in the CHANGELOG fails', () => {
  const heading = new RegExp(`^## v${esc(LATEST)} — \\d{4}-\\d{2}-\\d{2}$`, 'm')
  const { code, out } = fixture(edit => edit('CHANGELOG.md', t => { assert.match(t, heading); return t.replace(heading, `## Unreleased — v${LATEST}`) }))
  assert.equal(code, 1)
  assert.match(out, new RegExp(`labels released v${esc(LATEST)} as Unreleased`))
  assert.match(out, new RegExp(`no "## v${esc(LATEST)}" heading`))
})

test('a current document that contradicts the recorded runtime state fails', () => {
  const { code, out } = fixture(edit => {
    edit('docs/economy/BUSINESS_MODEL.md', t => t + '\nChallenge purchases are disabled in production.\n')
    edit('docs/operations/README.md', t => t + '\nThe Liara runtime is not deployed.\n')
  })
  assert.equal(code, 1)
  assert.match(out, /BUSINESS_MODEL\.md:\d+: states that purchases are disabled in production/)
  assert.match(out, /operations\/README\.md:\d+: states that IRAN\/Liara is not deployed/)
})

test('the same statement under a Historical heading is allowed', () => {
  const { code, out } = fixture(edit => edit('docs/operations/README.md', t => t + '\n## Historical snapshot — 2026-11-01\n\nThe Liara runtime is not deployed.\n'))
  assert.equal(code, 0, out)
})

test('an undated or week-old operational snapshot in a current document fails', () => {
  const { code, out } = fixture(edit => edit('ROADMAP.md', t => t + '\n## Production state\n\nAll good.\n\n## Live state — 2026-10-01\n\nOld.\n'))
  assert.equal(code, 1)
  assert.match(out, /snapshot heading "Production state" has no date/)
  assert.match(out, /snapshot "Live state — 2026-10-01" is older than a week/)
})

test('a runtime claim without a timestamp or evidence, or an impossible state, fails', () => {
  const { code, out } = fixture(edit => edit('docs/status/status.json', json('', v => {
    delete v.features[0].global.verifiedAt
    v.features[1].iran.accepted = true
    v.features[2].global.evidence = 'docs/missing-evidence.md'
  })))
  assert.equal(code, 1)
  assert.match(out, /needs verifiedAt \(UTC ISO\) and resolvable evidence/)
  assert.match(out, /cannot be owner-accepted before operational verification/)
})

test('one shared state for both regions is refused', () => {
  const { code, out } = fixture(edit => edit('docs/status/status.json', json('', v => { delete v.features[0].iran })))
  assert.equal(code, 1)
  assert.match(out, /has no iran state \(record every environment separately\)/)
})

test('a hand-edited README status block or generated page fails', () => {
  const block = `Latest official release: **v${LATEST}**`
  const { code, out } = fixture(edit => edit('README.md', t => { assert.ok(t.includes(block), block); return t.replace(block, 'Latest official release: **v0.0.1**') }))
  assert.equal(code, 1)
  assert.match(out, /README\.md: out of date with docs\/status\/status\.json/)
})

test('a newer tag than the recorded latest release fails when tags are available', () => {
  const { code, out } = fixture((edit, root) => {
    execFileSync('git', ['init', '-q'], { cwd: root })
    execFileSync('git', ['-c', 'user.email=t@example.test', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'x'], { cwd: root })
    for (const tag of [`v${LATEST}`, `v${NEXT}`]) execFileSync('git', ['tag', tag], { cwd: root })
  })
  assert.equal(code, 1)
  assert.match(out, new RegExp(`latestOfficial is v${esc(LATEST)} but v${esc(NEXT)} exists`))
})
