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
const { runScenario } = load('../src/features/economy/scenario.ts')
const { readFileSync, existsSync } = require('node:fs')
const { ruleSections } = load('../src/features/rulebook/content.ts')

test('scenario arithmetic matches the backend scenario model', () => {
  const r = runScenario({ challengesSold: 1000, mix: { 10000: 50, 100000: 50 }, prices: { 10000: 100, 100000: 500 }, refundRatePct: 0,
    passRatePct: 10, firstPayoutRatePct: 50, avgTotalPayoutUsd: 2000, ambassadorSharePct: 20, operatingCostsUsd: 50000, reservePct: 25 })
  assert.equal(r.gross, 300000)
  assert.equal(r.payouts, 100000)
  assert.equal(r.commissions, 6000)
  assert.equal(r.remaining, 144000)
  assert.equal(r.available, 108000)
  const empty = runScenario({ challengesSold: 10, mix: {}, prices: {}, refundRatePct: 0, passRatePct: 0, firstPayoutRatePct: 0, avgTotalPayoutUsd: 0, ambassadorSharePct: 0, operatingCostsUsd: 0, reservePct: 0 })
  assert.equal(empty.gross, 0)
  assert.ok(Object.values(empty).every(Number.isFinite))
})
test('transparency is wired to the backend report, with no synthetic dataset', () => {
  const src = readFileSync(new URL('../src/features/transparency/Transparency.tsx', import.meta.url), 'utf8')
  assert.ok(src.includes("'/economy/transparency'"))
  assert.ok(!/mock|sample/i.test(src), 'no mock/sample data source')
  assert.equal(existsSync(new URL('../src/features/transparency/data/mockTransparency.ts', import.meta.url)), false)
})
test('every rule section has matching bilingual content and unique anchors', () => {
  assert.equal(ruleSections.length, 23)
  assert.equal(new Set(ruleSections.map(s => s.id)).size, 23)
  const check = value => {
    if (Array.isArray(value)) return value.forEach(check)
    if (value && typeof value === 'object') {
      if ('en' in value) { assert.ok(value.en.trim()); assert.match(value.fa, /[\u0600-\u06ff]/) }
      else Object.values(value).forEach(check)
    }
  }
  ruleSections.forEach(check)
  for (const id of ['configurations', 'stages', 'targets', 'daily-loss', 'maximum-loss', 'violations', 'identity', 'fees', 'free-trial', 'practices']) assert.equal(ruleSections.find(s => s.id === id).status, 'draft')
  /* v0.3.1: the evaluation path (purchase → start → live rules) is operational */
  assert.equal(ruleSections.find(s => s.id === 'how-it-works').status, 'current')
  /* implemented and enforced by the server (owner decisions D1–D8, ADR 0029) */
  for (const id of ['funded', 'payouts', 'conduct']) assert.equal(ruleSections.find(s => s.id === id).status, 'current')
})
