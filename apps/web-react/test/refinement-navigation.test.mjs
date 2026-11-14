import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
function load(path) {
  const result = buildSync({ entryPoints: [fileURLToPath(new URL(`../src/${path}`, import.meta.url))], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', loader: { '.zip': 'empty' }, define: { 'import.meta.env.DEV': 'false' } })
  const mod = { exports: {} }; new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, mod, mod.exports); return mod.exports
}
test('navigation disclosures keep one menu open and support Escape, arrows and outside clicks', () => {
  const dom = new JSDOM('<nav id="navigation"></nav>'); globalThis.document = dom.window.document
  const n = load('features/information/navigation.ts')
  n.renderNavigation(document, 'en', '/en/checkout', null, null)
  const dispose = n.bindNavigation(document)
  const buttons = [...document.querySelectorAll('.resources-toggle')]
  n.navigationClick({ target: buttons[0] }, document)
  assert.equal(buttons[0].getAttribute('aria-expanded'), 'true')
  n.navigationClick({ target: buttons[1] }, document)
  assert.equal(buttons[0].getAttribute('aria-expanded'), 'false')
  assert.equal(buttons[1].getAttribute('aria-expanded'), 'true')
  const key = (target, key) => n.navigationKeyDown({ target, key, preventDefault() {}, stopPropagation() {} }, document)
  key(buttons[1], 'ArrowDown')
  assert.equal(document.activeElement.tagName, 'A')
  key(document.activeElement, 'Escape')
  assert.equal(document.activeElement, buttons[1]); assert.equal(buttons[1].getAttribute('aria-expanded'), 'false')
  n.navigationClick({ target: buttons[0] }, document)
  document.body.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }))
  assert.equal(buttons[0].getAttribute('aria-expanded'), 'false')
  const model = n.navigationModel('fa', '/fa/apps', null)
  assert.ok(model.groups.flatMap(x => x.links).some(x => x.href === '/fa/apps'))
  assert.ok(model.groups.flatMap(x => x.links).some(x => x.href === '/fa/certificate-verification'))
  dispose(); dom.window.close(); delete globalThis.document
})
test('application downloads reject arbitrary hosts, source archives and unsigned stable installers', () => {
  const { validatedRelease, applicationReleases } = load('features/applications/releases.ts')
  assert.deepEqual(applicationReleases, [])
  const release = { platform: 'macos', version: '1.0.0', channel: 'stable', architecture: 'arm64', format: 'dmg', bytes: 1000, releasedAt: '2026-11-14', tag: 'v1.0.0', file: 'Openfund.dmg', sha256: 'a'.repeat(64), downloadUrl: 'https://github.com/algomanlife/openfund/releases/download/v1.0.0/Openfund.dmg', notesUrl: 'https://github.com/algomanlife/openfund/releases/tag/v1.0.0', guideUrl: 'https://github.com/algomanlife/openfund/blob/v1.0.0/docs/install.md', verified: true, signed: true }
  assert.ok(validatedRelease(release))
  for (const mutation of [{ signed: false }, { verified: false }, { downloadUrl: 'https://evil.example/Openfund.dmg' }, { file: 'source.tar.gz', format: 'tar.gz' }, { bytes: 0 }, { sha256: '' }, { guideUrl: 'javascript:alert(1)' }]) assert.equal(validatedRelease({ ...release, ...mutation }), null)
})
