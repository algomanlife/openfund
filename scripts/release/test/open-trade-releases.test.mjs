import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
const { buildSync } = createRequire(new URL('../../../apps/web-react/package.json', import.meta.url))('esbuild')
import { releaseEntries } from '../open-trade-releases.mjs'

const builds = JSON.parse(fs.readFileSync(new URL('../../../apps/web-react/src/features/applications/builds.json', import.meta.url), 'utf8'))
const load = () => {
  const out = buildSync({ entryPoints: [new URL('../../../apps/web-react/src/features/applications/releases.ts', import.meta.url).pathname], bundle: true, platform: 'node', format: 'cjs', write: false, loader: { '.json': 'json' } }).outputFiles[0].text
  const m = { exports: {} }; new Function('module', 'exports', out)(m, m.exports); return m.exports
}

test('verified Open Trade 0.0.2 builds carry real sizes and SHA-256 values for all five installers', () => {
  assert.equal(builds.version, '0.0.2'); assert.equal(builds.signed, false)
  assert.deepEqual(builds.files.map(f => `${f.platform}/${f.architecture}/${f.format}`).sort(), ['linux/x64/AppImage', 'linux/x64/deb', 'macos/arm64/dmg', 'macos/x64/dmg', 'windows/x64/exe'])
  for (const f of builds.files) { assert.match(f.sha256, /^[a-f0-9]{64}$/); assert.ok(f.bytes > 50e6); assert.match(f.file, /^Open-Trade-0\.0\.2-beta-unsigned-/) }
})

test('generated download entries pass the website validator only for a published tag', () => {
  const { validatedRelease } = load()
  const entries = releaseEntries(builds, 'open-trade-v0.0.2', '2026-11-15')
  assert.equal(entries.length, 5)
  for (const e of entries) {
    assert.deepEqual(validatedRelease(e), e)
    assert.equal(e.downloadUrl, `https://github.com/algomanlife/openfund/releases/download/open-trade-v0.0.2/${e.file}`)
    assert.equal(e.signed, false)
  }
  assert.throws(() => releaseEntries(builds, '', '2026-11-15'))
  assert.equal(validatedRelease({ ...entries[0], downloadUrl: 'https://example.com/x.dmg' }), null)
})

test('the site shows no download button until releases.json is filled from a published release', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../../../apps/web-react/src/features/applications/releases.json', import.meta.url), 'utf8'))
  assert.deepEqual(manifest.releases, [])
})
