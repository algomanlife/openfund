/* Public plan rules served by GET /purchases/plans: a whitelisted
 * projection of the evaluation engine's normalized rules, with no prices,
 * credentials or internal fields, for every catalog plan. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { PLAN_SEEDS } from '../plan-catalog.js'
import { normalizeRules } from '../evaluation.js'
import { publicPlanRules } from '../purchases.js'

const KEYS = ['rulesVersion', 'catalogVersion', 'model', 'phases', 'phaseTargetsPct', 'dailyLossPct', 'maxTotalLossPct', 'drawdownMode', 'trailingLockAtProfitPct',
  'minTradingDays', 'consistencyPct', 'profitableDaysPer30', 'profitSplitPct', 'rewardCycles', 'inactivityDays', 'timeLimitDays', 'trialDaysPerPhase', 'refundPolicy', 'conduct', 'dailyLossVariant',
  'referenceLeverageX', 'payoutCapPct']

test('every catalog plan exposes exactly the whitelisted rule fields', () => {
  for (const { slug, configuration } of PLAN_SEEDS) {
    const rules = publicPlanRules(configuration)
    assert.deepEqual(Object.keys(rules).sort(), [...KEYS].sort(), slug)
    assert.ok(!JSON.stringify(rules).match(/price|receiver|secret|token|address/i), slug)
  }
})

test('the rules are what the evaluation engine enforces', () => {
  for (const { slug, configuration } of PLAN_SEEDS) {
    const enforced = normalizeRules(configuration), rules = publicPlanRules(configuration)
    for (const k of ['phases', 'dailyLossPct', 'maxTotalLossPct', 'drawdownMode', 'trailingLockAtProfitPct', 'minTradingDays', 'consistencyPct', 'profitableDaysPer30', 'profitSplitPct', 'inactivityDays', 'timeLimitDays', 'refundPolicy', 'model'])
      assert.deepEqual(rules[k], enforced[k], `${slug}.${k}`)
    assert.deepEqual(rules.rewardCycles, enforced.rewardCycles, slug)
    assert.deepEqual(rules.conduct.news, enforced.conduct.news, slug)
    assert.deepEqual(rules.conduct.holding, enforced.conduct.holding, slug)
    assert.equal(rules.phaseTargetsPct.length, enforced.phases, slug)
    assert.equal(rules.catalogVersion, configuration.catalogVersion, slug)
  }
})

test('catalog values come through unchanged (standard, one-phase, instant)', () => {
  const by = Object.fromEntries(PLAN_SEEDS.map(p => [p.slug, publicPlanRules(p.configuration)]))
  assert.deepEqual(by.standard.phaseTargetsPct, [8, 5]); assert.equal(by.standard.dailyLossPct, 5); assert.equal(by.standard.maxTotalLossPct, 10)
  assert.deepEqual(by.standard.dailyLossVariant, { dailyLossPct: 3, minTradingDays: 0 })
  assert.deepEqual(by['one-phase'].phaseTargetsPct, [12]); assert.equal(by['one-phase'].dailyLossPct, 3)
  assert.deepEqual(by.instant.phaseTargetsPct, []); assert.equal(by.instant.drawdownMode, 'trailing'); assert.equal(by.instant.conduct.holding.mode, 'prohibit_weekend')
  assert.equal(by.instant.dailyLossVariant, null)
})
