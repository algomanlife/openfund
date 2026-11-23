/* Labs page (item M): numbers only from GET /labs, no drop defined in code,
   motion limited to transform/opacity and gated by visibility, the route and
   menu tile, and the open drop's badge. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'

const require = createRequire(import.meta.url)
const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
function load(path) {
  const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false, loader: { '.css': 'empty', '.zip': 'text', '.html': 'text' }, jsx: 'automatic' })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports)
  return module.exports
}

test('every drop figure comes from GET /labs; no drop is defined in code', () => {
  const page = read('../src/features/labs/LabsPage.tsx')
  assert.match(page, /apiFetch\('\/labs'\)/)
  const logic = page.replace(/text\('(?:[^'\\]|\\.)*', '(?:[^'\\]|\\.)*'\)/g, '')
  assert.ok(!/\b(?:priceUsd|inventory|perWalletCap)\s*:\s*\d/.test(logic), 'no literal drop prices, inventory or caps')
  assert.ok(!/\$\d/.test(logic), 'no literal dollar amounts')
  assert.match(page, /No drop is published yet/, 'an honest coming-soon state')
  assert.match(page, /simulated demo accounts/i, 'the FAQ carries the disclaimer')
})

test('Labs motion animates only transform and opacity, gated and stopped under reduced motion', () => {
  const css = read('../src/features/labs/labs.css')
  const blocks = css.match(/@keyframes [\w-]+\{.*?\}\}/gs) || []
  assert.ok(blocks.length >= 3)
  for (const block of blocks) for (const prop of block.replace(/^@keyframes [\w-]+\{/, '').match(/[a-z-]+(?=:)/g)) assert.ok(['transform', 'opacity'].includes(prop), `${prop} in ${block.slice(0, 40)}`)
  assert.match(css, /\.lb-hero\[data-live\]/)
  assert.match(css, /\.lb-capsule\[data-live\]/)
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.lb-hero \*,\.lb-capsule \*,\.lb-capsule \*::before,\.lb-capsule \*::after\{animation:none!important\}/, "pseudo-elements stop too")
})

test('the page is routed and in the Challenges menu, with the open drop as its badge', () => {
  assert.match(read('../src/main.tsx'), /'\/:locale\/labs'/)
  assert.match(read('../src/cms/editorialRoutes.ts'), /'\/:locale\/labs'/)
  const { navigationModel } = load('../src/features/information/navigation.ts')
  const status = load('../src/features/labs/labsStatus.ts')
  for (const locale of ['fa', 'en', 'ar', 'ru', 'zh-CN']) {
    const tile = navigationModel(locale, `/${locale}/home`, null).groups[0].links.find(l => l.route === 'labs')
    assert.equal(tile.href, `/${locale}/labs`); assert.ok(tile.label && tile.description); assert.equal(tile.badge, undefined, 'no badge without an open drop')
  }
  /* navigation.ts bundles its own copy of labsStatus, so drive the badge through a fresh bundle */
  const { navigationModel: model2, __setDrop } = load('./fixtures/labs-badge.ts')
  __setDrop(7)
  assert.match(model2('en', '/en/home', null).groups[0].links.find(l => l.route === 'labs').badge, /Drop #7/)
  assert.equal(typeof status.loadLabsStatus, 'function')
})
