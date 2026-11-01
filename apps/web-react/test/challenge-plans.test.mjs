import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'
const require = createRequire(import.meta.url)

function load(path) {
  const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports)
  return module.exports
}
const { challengePlans, publishedPlans, serializeForLegacy, assertPlansValid, planBySlug } = load('../src/data/challengePlans.ts')

test('published catalog is complete, unique and render-safe', () => {
  const plans = publishedPlans()
  assert.equal(plans.length, 4)
  assert.deepEqual(plans.map(p => p.slug).sort(), ['free-trial', 'instant', 'one-phase', 'standard'])
  assert.ok(plans.every(p => p.status === 'published'))
  assert.ok(plans.every(p => p.accountSizesUsd.length >= 5))
  assert.ok(plans.every(p => p.accountSizesUsd.every(s => p.priceUsd[s] >= 0)))
  /* invalid/incomplete plans fail loudly instead of rendering */
  const base = { slug: 'broken', name: { fa: 'x', en: 'x' }, accountSizesUsd: [1000], priceUsd: { 1000: 9 }, phases: 2, phase1TargetPct: 8, phase2TargetPct: 5, dailyLossPct: 3, maxTotalLossPct: 10, drawdownMode: 'static', minTradingDays: 0, profitSplitPct: 80, payoutCapPct: 0, timeLimitDays: null, refundPolicy: 'none', referenceLeverageX: 5, free: false }
  assert.throws(() => assertPlansValid([{ ...base, priceUsd: {} }]))
  assert.throws(() => assertPlansValid([{ ...base, phases: 2, phase2TargetPct: null }]))
  assert.throws(() => assertPlansValid([{ ...base, slug: 'free-trial', free: false }]))
  assert.throws(() => assertPlansValid([{ ...base, drawdownMode: 'trailing' }]))
})

test('standard plan carries the adopted two-phase specification', () => {
  const p = planBySlug('standard')
  assert.deepEqual(p.accountSizesUsd, [5000, 10000, 25000, 50000, 100000])
  assert.deepEqual(Object.values(p.priceUsd), [44, 80, 216, 349, 652])
  assert.equal(p.phases, 2)
  assert.equal(p.phase1TargetPct, 8)
  assert.equal(p.phase2TargetPct, 5)
  assert.equal(p.dailyLossPct, 5)
  assert.equal(p.dailyLossPctAlt, 3)
  assert.equal(p.maxTotalLossPct, 10)
  assert.equal(p.drawdownMode, 'static')
  assert.equal(p.minTradingDays, 3)
  assert.equal(p.profitSplitPct, 80)
  assert.equal(p.profitSplitMonthlyPct, 100)
  assert.equal(p.firstPayoutDays, 14)
  assert.equal(p.minPayoutPct, 1)
  assert.equal(p.refundPolicy, 'fourth-reward')
  assert.equal(p.timeLimitDays, null)
})

test('one-phase, instant and free-trial carry their adopted specifications', () => {
  const one = planBySlug('one-phase')
  assert.equal(one.phases, 1)
  assert.equal(one.phase1TargetPct, 12)
  assert.equal(one.maxTotalLossPct, 12)
  assert.equal(one.dailyLossPct, 3)
  assert.equal(one.dailyLossPctAlt, 2)
  assert.equal(one.minTradingDays, 0)
  assert.deepEqual(Object.values(one.priceUsd), [74, 111, 255, 353, 666])

  const instant = planBySlug('instant')
  assert.equal(instant.phases, 0)
  assert.equal(instant.phase1TargetPct, null)
  assert.equal(instant.maxTotalLossPct, 5)
  assert.equal(instant.drawdownMode, 'trailing')
  assert.equal(instant.trailingLockAtProfitPct, 5)
  assert.equal(instant.dailyLossPct, 3)
  assert.equal(instant.profitSplitPct, 95)
  assert.equal(instant.profitableDaysPer30, 7)
  assert.equal(instant.consistencyPct, 15)
  assert.deepEqual(instant.accountSizesUsd, [5000, 10000, 25000, 50000, 100000, 200000])
  assert.deepEqual(Object.values(instant.priceUsd), [60, 88, 188, 244, 444, 888])

  const trial = planBySlug('free-trial')
  assert.equal(trial.free, true)
  assert.equal(trial.timeLimitDays, 14)
  assert.equal(trial.trialDaysPerPhase, 14)
  assert.ok(trial.accountSizesUsd.every(s => trial.priceUsd[s] === 0))
  assert.equal(trial.firstPayoutDays, null)   /* a trial never promises payouts */
  assert.equal(trial.profitSplitPct, 0)
})

test('legacy bridge shape matches the app.js/features.js contract', () => {
  const legacy = serializeForLegacy(publishedPlans())
  /* the landing builder keys presets standard | one-phase | instant (trial is a banner) */
  assert.deepEqual(Object.keys(legacy).sort(), ['instant', 'one-phase', 'standard'])
  for (const key of Object.keys(legacy)) {
    const p = legacy[key]
    assert.ok(Array.isArray(p.name) && p.name.length === 2)
    assert.deepEqual(p.sizes, [...p.sizes].sort((a, b) => a - b))
    for (const s of p.sizes) assert.ok(p.prices[s] > 0)
    assert.ok(p.split > 0 && p.split <= 100)
    assert.ok(p.dailyLoss > 0 && p.loss > 0)
    assert.ok([0, 1, 2].includes(p.phases))
    if (p.phases === 2) assert.ok(p.phase2Pct > 0)
    else assert.equal(p.phase2Pct, null)
    if (p.phases === 0) assert.equal(p.phase1Pct, null)
    assert.equal(typeof p.leverage, 'number')
    assert.equal(typeof p.tagline[0], 'string')
    assert.ok(['static', 'trailing'].includes(p.lossMode))
    assert.ok(['none', 'fourth-reward'].includes(p.refund))
  }
  /* values must equal the React catalog exactly */
  assert.equal(legacy.standard.prices[100000], 652)
  assert.equal(legacy['one-phase'].prices[5000], 74)
  assert.equal(legacy.instant.prices[200000], 888)
  assert.equal(legacy.instant.lossMode, 'trailing')
  assert.equal(legacy.standard.minDays, 3)
})

test('backend seed stays in sync with the catalog (contract compatibility)', () => {
  /* apps/backend/seed-plans.js seeds the same catalog: slugs, sizes, prices,
     losses, phases, splits and flags must match the React source of truth. */
  const fs = require('node:fs')
  const seed = fs.readFileSync(fileURLToPath(new URL('../../backend/seed-plans.js', import.meta.url)), 'utf8')
  for (const slug of ['standard', 'one-phase', 'instant', 'free-trial']) assert.ok(seed.includes(`slug: '${slug}'`), slug)
  for (const sizes of ['[5000, 10000, 25000, 50000, 100000]', '[5000, 10000, 25000, 50000, 100000, 200000]']) assert.ok(seed.includes(sizes), sizes)
  /* prices */
  for (const price of ['5000: 44', '10000: 80', '25000: 216', '50000: 349', '100000: 652',
                       '5000: 74', '10000: 111', '25000: 255', '50000: 353', '100000: 666',
                       '5000: 60', '10000: 88', '25000: 188', '50000: 244', '100000: 444', '200000: 888']) {
    assert.ok(seed.includes(price), price)
  }
  /* structure */
  assert.ok(seed.includes('phases: 0') && seed.includes('phases: 1') && seed.includes('phases: 2'))
  assert.ok(seed.includes("drawdownMode: 'trailing'") && seed.includes("drawdownMode: 'static'"))
  assert.ok(seed.includes('profitSplitPct: 95') && seed.includes('profitSplitPct: 80'))
  assert.ok(seed.includes('trialDaysPerPhase: 14'))
})
