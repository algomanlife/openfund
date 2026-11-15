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
  const { ROADMAP_PHASES, OWNER_ROADMAP } = load('src/features/roadmap/roadmapData.ts')
  for (const p of ROADMAP_PHASES) {
    if (p.status === 'completed') assert.match(p.en.assessment, /^Delivered/)
    if (p.status === 'planned') assert.match(p.en.assessment, /^(Planned|Dormant)/)
    assert.doesNotMatch(`${p.en.direction} ${p.en.assessment}`, /\b(20\d\d|Q[1-4]|%)\b/)
  }
  /* owner content is supplied separately; until then the slot stays empty */
  assert.deepEqual(OWNER_ROADMAP, [])
})

test('Roadmap is in the website navigation, routes and sitemap', () => {
  assert.match(readFileSync('src/features/information/navigation.ts', 'utf8'), /'apps', 'roadmap',/)
  assert.match(readFileSync('src/main.tsx', 'utf8'), /path: '\/:locale\/roadmap'/)
  assert.match(readFileSync('src/features/loading/seoHead.ts', 'utf8'), /\|roadmap\|/)
  assert.match(readFileSync('../backend/seo.js', 'utf8'), /'apps', 'roadmap'/)
  assert.match(readFileSync('src/features/information/content.ts', 'utf8'), /roadmap: text\('Roadmap', 'نقشه راه'\)/)
})
