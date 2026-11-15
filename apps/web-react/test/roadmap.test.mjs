/* The website roadmap mirrors /ROADMAP.md exactly and invents nothing. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildSync } from 'esbuild'

const load = entry => {
  const output = buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false }).outputFiles[0].text
  const module = { exports: {} }; new Function('module', 'exports', output)(module, module.exports)
  return module.exports
}

test('website phases match the ROADMAP.md register row for row', () => {
  const { ROADMAP_PHASES } = load('src/features/roadmap/roadmapData.ts')
  const rows = readFileSync('../../ROADMAP.md', 'utf8').split('\n').filter(l => /^\| \d — /.test(l))
    .map(l => l.split('|').slice(1, -1).map(c => c.trim()))
  assert.equal(rows.length, 7)
  assert.equal(ROADMAP_PHASES.length, rows.length)
  rows.forEach(([phase, direction, assessment, milestones], i) => {
    const p = ROADMAP_PHASES[i]
    assert.equal(`${p.phase} — ${p.en.name}`, phase)
    assert.equal(p.en.direction, direction)
    assert.equal(p.en.assessment, assessment)
    assert.equal(p.milestones, milestones)
  })
})

test('statuses follow the register wording and nothing is dated or quantified', () => {
  const { ROADMAP_PHASES } = load('src/features/roadmap/roadmapData.ts')
  for (const p of ROADMAP_PHASES) {
    if (p.status === 'completed') assert.match(p.en.assessment, /^Delivered/)
    if (p.status === 'planned') assert.match(p.en.assessment, /^(Planned|Dormant)/)
    assert.doesNotMatch(`${p.en.direction} ${p.en.assessment}`, /\b(20\d\d|Q[1-4]|%)\b/)
  }
})

test('Roadmap is in the website navigation, routes and sitemap', () => {
  assert.match(readFileSync('src/features/information/navigation.ts', 'utf8'), /'apps', 'roadmap',/)
  assert.match(readFileSync('src/main.tsx', 'utf8'), /path: '\/:locale\/roadmap'/)
  assert.match(readFileSync('src/features/loading/seoHead.ts', 'utf8'), /\|roadmap\|/)
  assert.match(readFileSync('../backend/seo.js', 'utf8'), /'apps', 'roadmap'/)
  assert.match(readFileSync('src/features/information/content.ts', 'utf8'), /roadmap: text\('Roadmap', 'نقشه راه'\)/)
})

test('the product roadmap is dated, contiguous, and uses planned milestones', () => {
  const { PRODUCT_ROADMAP } = load('src/features/roadmap/productRoadmap.ts')
  assert.deepEqual(PRODUCT_ROADMAP.map(q => q.quarter), [1, 2, 3, 4])
  assert.equal(PRODUCT_ROADMAP[0].start, '2026-11-15')
  assert.equal(PRODUCT_ROADMAP.at(-1).end, '2027-11-14')
  PRODUCT_ROADMAP.forEach((q, i) => {
    assert.equal(q.status, 'planned')
    assert.ok(Date.parse(q.start) < Date.parse(q.end))
    if (i) assert.equal(Date.parse(q.start) - Date.parse(PRODUCT_ROADMAP[i - 1].end), 86_400_000)
  })
})
