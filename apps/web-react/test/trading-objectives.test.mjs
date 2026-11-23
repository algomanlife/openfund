/* Trading objectives page (item L): the progression per plan, the published
   catalog as the only number source, motion limited to transform/opacity,
   and the route, menu tile and links. */
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

test('the progression adapts to the plan: two-phase, one-phase and instant', () => {
  const { progression } = load('../src/features/objectives/progression.ts')
  assert.deepEqual(progression({ phases: 2 }), ['evaluation', 'verification', 'wallet', 'agreement', 'funded'])
  assert.deepEqual(progression({ phases: 1 }), ['evaluation', 'wallet', 'agreement', 'funded'], 'One-phase skips skill verification')
  assert.deepEqual(progression({ phases: 0 }), ['wallet', 'agreement', 'funded'], 'Instant starts at wallet verification')
})

test('numbers come only from the published catalog', () => {
  const page = read('../src/features/objectives/TradingObjectivesPage.tsx')
  assert.match(page, /apiFetch\('\/purchases\/plans'\)/)
  /* no hard-coded percentages or prices in the page logic (copy uses ${pct} placeholders) */
  assert.ok(!/\b(?:8|5|10|80|35)%/.test(page.replace(/text\([^)]*\)/g, '')), 'no literal rule percentages outside copy templates')
})

test('objective motion animates only transform and opacity, and stops under reduced motion', () => {
  const css = read('../src/features/objectives/objectives.css')
  const blocks = css.match(/@keyframes [\w-]+\{.*?\}\}/gs) || []
  assert.ok(blocks.length >= 8)
  for (const block of blocks) for (const prop of block.replace(/^@keyframes [\w-]+\{/, '').match(/[a-z-]+(?=:)/g)) assert.ok(['transform', 'opacity'].includes(prop), `${prop} in ${block.slice(0, 40)}`)
  assert.match(css, /prefers-reduced-motion:reduce\)\{\.ob-hero \*,\.ob-card \*\{animation:none!important\}/)
  assert.match(css, /\.ob-card\[data-live\]/, 'motion is gated by visibility')
})

test('the page is routed, in the Challenges menu, and linked from the challenges page and checkout', () => {
  assert.match(read('../src/main.tsx'), /'\/:locale\/trading-objectives'/)
  assert.match(read('../src/cms/editorialRoutes.ts'), /'\/:locale\/trading-objectives'/)
  assert.match(read('../src/pages/landing-body.html'), /data-info-page="trading-objectives"/)
  assert.match(read('../src/features/purchase/CheckoutPage.tsx'), /\/trading-objectives`/)
  const { navigationModel } = load('../src/features/information/navigation.ts')
  for (const locale of ['fa', 'en', 'ar', 'ru', 'zh-CN']) {
    const tile = navigationModel(locale, `/${locale}/home`, null).groups[0].links.find(l => l.route === 'trading-objectives')
    assert.equal(tile.href, `/${locale}/trading-objectives`); assert.ok(tile.label && tile.description)
  }
})
