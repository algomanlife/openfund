import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
const require = createRequire(import.meta.url)
const { createElement } = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(path) {
  const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports)
  return module.exports
}
const { mockTransparency, summarize, metricDefinitions } = load('../src/features/transparency/data/mockTransparency.ts')
const { ruleSections } = load('../src/features/rulebook/content.ts')
const { TransparencyDashboard } = load('../src/features/transparency/TransparencyDashboard.tsx')

test('sample totals reconcile to history and completed outcomes, excluding in-progress from pass rate', () => {
  assert.deepEqual(summarize(mockTransparency), { accounts: 1248, volume: 31290000, trades: 14990, completed: 280, passRate: .3, pnl: 29300 })
  const changed = structuredClone(mockTransparency)
  changed.outcomes.inProgress += 1000
  assert.equal(summarize(changed).passRate, .3)
  changed.activity[0].pnlVirtualDai -= 500
  assert.equal(summarize(changed).pnl, 28800)
})
test('zero completions and empty history do not fabricate results or divide by zero', () => {
  const empty = { ...mockTransparency, activity: [], outcomes: { passed: 0, failed: 0, inProgress: 3 } }
  assert.deepEqual(summarize(empty), { accounts: 1248, volume: 0, trades: 0, completed: 0, passRate: 0, pnl: 0 })
})
test('fixtures cover consecutive UTC dates and use finite locale-independent numbers', () => {
  assert.equal(mockTransparency.provenance, 'sample')
  assert.equal(mockTransparency.activity.length, 14)
  assert.equal(mockTransparency.activity[0].date, mockTransparency.periodStart)
  assert.equal(mockTransparency.activity.at(-1).date, mockTransparency.periodEnd)
  mockTransparency.activity.forEach((p, i, points) => {
    for (const key of ['activeAccounts', 'trades', 'volumeUsd', 'pnlVirtualDai']) assert.ok(Number.isFinite(p[key]))
    if (i) assert.equal(Date.parse(p.date) - Date.parse(points[i - 1].date), 86400000)
  })
  assert.equal(new Set(metricDefinitions.map(m => m.key)).size, 6)
})
test('every rule section has matching bilingual content and unique anchors', () => {
  assert.equal(ruleSections.length, 22)
  assert.equal(new Set(ruleSections.map(s => s.id)).size, 22)
  const check = value => {
    if (Array.isArray(value)) return value.forEach(check)
    if (value && typeof value === 'object') {
      if ('en' in value) { assert.ok(value.en.trim()); assert.match(value.fa, /[\u0600-\u06ff]/) }
      else Object.values(value).forEach(check)
    }
  }
  ruleSections.forEach(check)
  for (const id of ['configurations', 'stages', 'targets', 'daily-loss', 'maximum-loss', 'violations', 'identity', 'fees', 'free-trial', 'practices']) assert.equal(ruleSections.find(s => s.id === id).status, 'draft')
  for (const id of ['how-it-works', 'funded', 'payouts']) assert.equal(ruleSections.find(s => s.id === id).status, 'planned')
})
test('dashboard renders bilingual sample labels, accessible charts and exact history', () => {
  for (const locale of ['en', 'fa']) {
    const html = renderToStaticMarkup(createElement(TransparencyDashboard, { locale, state: { status: 'ready', snapshot: mockTransparency } }))
    assert.equal((html.match(/class="metric-card model-card"/g) || []).length, 6)
    assert.equal((html.match(/role="img"/g) || []).length, 3)
    assert.ok(html.includes(locale === 'en' ? 'Sample data' : 'دادهٔ نمونه'))
    assert.ok(html.includes('<caption>'))
    assert.ok(html.includes('aria-labelledby='))
    assert.ok(!html.includes('NaN'))
  }
})
test('loading, empty, error and ready-with-empty-history states never show sample metrics', () => {
  for (const locale of ['en', 'fa']) {
    for (const state of [{ status: 'loading' }, { status: 'empty' }, { status: 'error' }, { status: 'ready', snapshot: { ...mockTransparency, activity: [] } }]) {
      const html = renderToStaticMarkup(createElement(TransparencyDashboard, { locale, state }))
      assert.ok(html.includes('role="status"'))
      assert.ok(!html.includes('metric-card'))
      assert.ok(!html.includes('NaN'))
    }
  }
})
