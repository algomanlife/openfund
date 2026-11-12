import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as v from '../verify.mjs'

const real = v.ROOT
const scratch = () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'of-verify-'))
  for (const r of v.VENDOR_ROOTS) mkdirSync(path.join(dir, r), { recursive: true })
  return dir
}
const put = (root, file, text) => { mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); writeFileSync(path.join(root, file), text) }
const using = (root, fn) => { v.setRoot(root); try { return fn() } finally { v.setRoot(real) } }

test('the real repository satisfies every upstream isolation check', () => {
  v.setRoot(real)
  const results = v.runAll()
  for (const [name, problems] of Object.entries(results)) assert.deepEqual(problems, [], `${name}: ${problems.join('; ')}`)
})

test('vendor manifest detects modified, added and deleted vendored files', () => {
  const root = scratch()
  try {
    put(root, 'vendor/vela/a.ts', 'one'); put(root, 'vendor/vela/b.ts', 'two')
    using(root, () => {
      put(root, 'infra/upstream/vendor-manifest.json', JSON.stringify(v.buildManifest()))
      assert.deepEqual(v.checkVendor(), [])
      writeFileSync(path.join(root, 'vendor/vela/a.ts'), 'changed')
      put(root, 'vendor/vela/new.ts', 'x')
      rmSync(path.join(root, 'vendor/vela/b.ts'))
      const problems = v.checkVendor().join('\n')
      assert.match(problems, /a\.ts differs/); assert.match(problems, /new\.ts is not in the vendor manifest/); assert.match(problems, /b\.ts is in the vendor manifest but missing/)
    })
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('customization guards flag removed text, missing patterns and forbidden patterns', () => {
  const root = scratch()
  try {
    put(root, 'a.js', 'keep THIS and Bearer token')
    const customizations = { guards: [
      { id: 'ok', file: 'a.js', contains: 'keep THIS' },
      { id: 'gone', file: 'a.js', contains: 'removed text' },
      { id: 'rx', file: 'a.js', regex: 'nothing[\\s\\S]*here' },
      { id: 'forbid', file: 'a.js', absent: 'Bearer ' },
      { id: 'nofile', file: 'missing.js', contains: 'x' },
    ], mirrors: [] }
    const problems = using(root, () => v.checkGuards({ customizations })).join('\n')
    assert.doesNotMatch(problems, /guard:ok/)
    for (const id of ['gone', 'rx', 'forbid', 'nofile']) assert.match(problems, new RegExp(`guard:${id}`))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('mirror copies must be byte-identical to their source', () => {
  const root = scratch()
  try {
    put(root, 's.js', 'source'); put(root, 'c1.js', 'source'); put(root, 'c2.js', 'drifted')
    const customizations = { guards: [], mirrors: [{ id: 'm', source: 's.js', copies: ['c1.js', 'c2.js', 'c3.js'] }] }
    const problems = using(root, () => v.checkMirrors({ customizations }))
    assert.equal(problems.length, 2)
    assert.match(problems.join('\n'), /c2\.js differs/); assert.match(problems.join('\n'), /c3\.js/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('a registered patch stops reverse-applying when upstream content replaces the patched file', () => {
  const root = scratch()
  try {
    const file = 'vendor/vela/src/widget/indicator-picker.ts'
    /* the registered OF-VELA-002 patch file, wherever the current Vela version keeps it */
    const patchRel = JSON.parse(readFileSync(path.join(real, 'infra/upstream/patches.json'), 'utf8')).patches.find((p) => p.id === 'OF-VELA-002').patch_file
    put(root, patchRel, readFileSync(path.join(real, patchRel), 'utf8'))
    put(root, 'package.json', JSON.stringify({ scripts: { 'test:browser:charts': 'x' } }))
    const patches = { patches: [{ id: 'T', kind: 'source', files: [file], patch_file: patchRel, reason: 'r', affected_version: '0.9.3', removal_condition: 'c', regression_tests: ['npm run test:browser:charts'], guard: { file, contains: 'badgeText = r.native ? undefined' } }] }
    const original = readFileSync(path.join(real, file), 'utf8')
    put(root, file, original)
    assert.deepEqual(using(root, () => v.checkPatches({ patches })), [])
    put(root, file, original.replace('r.native ? undefined : r.language', "r.native ? 'vela' : r.language"))   /* what an upstream refresh would restore */
    const problems = using(root, () => v.checkPatches({ patches })).join('\n')
    assert.match(problems, /no longer reverse-applies/); assert.match(problems, /guard string not found/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('registry validation catches version drift against the lockfile', () => {
  const root = scratch()
  try {
    put(root, 'package.json', JSON.stringify({ scripts: {} }))
    put(root, 'lock.json', JSON.stringify({ packages: { 'node_modules/pkg': { version: '2.0.0' } } }))
    const base = { id: 'p', name: 'p', kind: 'npm', layer: 'library', official_source: 'x', license: 'MIT', installed: { version: '1.0.0', lockfile: 'lock.json', package: 'pkg' }, latest_observed: {}, integration_path: [], watch: { type: 'npm' }, policy: {}, compatibility: {}, last_upgrade: 'x', tests: [], upgrade_instructions: 'x', rollback_limits: 'x' }
    const problems = using(root, () => v.checkRegistry({ registry: { providers: [base] } })).join('\n')
    assert.match(problems, /installed 1\.0\.0 but lock\.json locks 2\.0\.0/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
