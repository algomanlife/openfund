/* Product-rules consistency check.
 *
 * One authoritative source: src/data/challengePlans.ts. This test proves the
 * backend plan mirror (apps/backend/plan-catalog.js, seeded into
 * challenge_plans) and the evaluation engine's normalized rules snapshot
 * (apps/backend/evaluation.js normalizeRules) agree with it, that every
 * catalog field is classified in src/data/planRuleSupport.ts, and that public
 * copy does not contradict the catalog. Advertised rules the backend does not
 * enforce are reported as launch blockers and pinned below, so a new
 * unsupported rule cannot be published silently.
 *
 * Usage: npm run check:product-rules
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildSync } from 'esbuild'

const require = createRequire(import.meta.url)
function load(path) {
  const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputFiles[0].text)(require, module, module.exports)
  return module.exports
}
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

const { publishedPlans, challengePlans } = load('../src/data/challengePlans.ts')
const { planRuleSupport, launchBlockers } = load('../src/data/planRuleSupport.ts')
const { PLAN_SEEDS } = await import('../../backend/plan-catalog.js')
const { normalizeRules } = await import('../../backend/evaluation.js')

/* catalog → the configuration shape the backend stores */
const toConfiguration = plan => Object.fromEntries(Object.entries(plan).filter(([key]) => !['slug', 'name', 'tagline', 'status'].includes(key)))
const SNAPSHOT_META = new Set(['rulesVersion', 'evaluationCapable'])

test('every published plan has exactly one backend plan row and vice versa', () => {
  const front = publishedPlans().map(p => p.slug).sort()
  const back = PLAN_SEEDS.map(p => p.slug).sort()
  assert.deepEqual(back, front)
  assert.equal(new Set(back).size, back.length, 'duplicate backend plan slug')
})

test('backend sizes and server prices equal the catalog', () => {
  for (const plan of publishedPlans()) {
    const seed = PLAN_SEEDS.find(p => p.slug === plan.slug).configuration
    assert.deepEqual(seed.accountSizesUsd, plan.accountSizesUsd, `${plan.slug} sizes`)
    for (const size of plan.accountSizesUsd) assert.equal(Number(seed.priceUsd[size]), plan.priceUsd[size], `${plan.slug} ${size} price`)
    assert.deepEqual(Object.keys(seed.priceUsd).map(Number).sort((a, b) => a - b), [...plan.accountSizesUsd].sort((a, b) => a - b), `${plan.slug} price keys`)
  }
})

test('the evaluation engine normalizes identical rules from the catalog and the backend row', () => {
  for (const plan of publishedPlans()) {
    const seed = PLAN_SEEDS.find(p => p.slug === plan.slug).configuration
    const fromCatalog = normalizeRules(toConfiguration(plan))
    const fromBackend = normalizeRules(seed)
    assert.equal(fromBackend.evaluationCapable, true, `${plan.slug} must be evaluation-capable`)
    for (const key of Object.keys(fromCatalog)) {
      if (SNAPSHOT_META.has(key)) continue
      assert.deepEqual(fromBackend[key], fromCatalog[key], `${plan.slug}.${key}: backend ${JSON.stringify(fromBackend[key])} ≠ catalog ${JSON.stringify(fromCatalog[key])}`)
    }
  }
})

test('every catalog field is classified and every enforced rule reaches the engine snapshot', () => {
  const fields = new Set(challengePlans.flatMap(p => Object.keys(p)))
  for (const field of fields) assert.ok(planRuleSupport[field], `unclassified catalog field: ${field}`)
  const snapshotKeys = new Set(Object.keys(normalizeRules({ dailyLossPct: 1, maxTotalLossPct: 1 })))
  for (const [field, entry] of Object.entries(planRuleSupport)) {
    if (entry.support === 'enforced' || entry.support === 'metric-only') assert.ok(snapshotKeys.has(field), `${field} is classified ${entry.support} but normalizeRules drops it`)
    if (entry.support === 'not-implemented' || entry.support === 'metric-only') assert.ok(entry.blocker, `${field} needs a launch-blocker id`)
  }
})

/* Pinned launch-blocker register. Changing it requires updating
   docs/product/PRODUCT_RULES.md in the same change. */
const KNOWN_BLOCKERS = {
  'PLAN-DAILY-LOSS-VARIANT:dailyLossPctAlt': ['standard', 'one-phase'],
  'PLAN-PAYOUT-CONDITIONS:profitableDaysPer30': ['instant'],
  'PLAN-PAYOUT-CONDITIONS:consistencyPct': ['standard', 'one-phase', 'instant'],
  'PLAN-PAYOUT-CONDITIONS:profitSplitPct': ['standard', 'one-phase', 'instant'],
  'PLAN-PAYOUT-CONDITIONS:profitSplitMonthlyPct': ['standard', 'one-phase'],
  'PLAN-PAYOUT-CONDITIONS:firstPayoutDays': ['standard', 'one-phase', 'instant'],
  'PLAN-PAYOUT-CONDITIONS:minPayoutPct': ['standard', 'one-phase', 'instant'],
  'PLAN-FEE-REFUND:refundPolicy': ['standard'],
}

test('advertised rules without backend support are reported as launch blockers', t => {
  const blockers = launchBlockers(publishedPlans())
  for (const b of blockers) t.diagnostic(`LAUNCH BLOCKER ${b.blocker} — ${b.field} (${b.plans.join(', ')}): ${b.note}`)
  assert.deepEqual(Object.fromEntries(blockers.map(b => [`${b.blocker}:${b.field}`, b.plans])), KNOWN_BLOCKERS)
  const doc = read('../../../docs/product/PRODUCT_RULES.md')
  for (const id of new Set(blockers.map(b => b.blocker))) assert.ok(doc.includes(id), `${id} is not documented in docs/product/PRODUCT_RULES.md`)
})

test('public copy never contradicts the catalog minimum trading days', () => {
  const anyMinimum = publishedPlans().some(p => p.minTradingDays > 0)
  if (!anyMinimum) return
  const sources = [read('../src/pages/landing-body.html'), read('../public/translations.json'), read('../src/cms/seed/faqContent.ts'), read('../src/cms/seed/faqSiteContent.ts')].join('\n')
  for (const claim of ['حداقل روز معاملاتی ندارند', 'no time limit and no minimum trading days', 'no time limit or minimum trading days', 'No time limit, no minimum trading days']) {
    assert.ok(!sources.includes(claim), `public copy claims there are no minimum trading days: "${claim}"`)
  }
})

test('the Rulebook minimum-trading-days row matches the catalog', () => {
  const rulebook = read('../src/features/rulebook/content.ts')
  const standard = publishedPlans().find(p => p.slug === 'standard')
  assert.equal(standard.minTradingDays, 3)
  assert.ok(rulebook.includes(`t('Minimum trading days', 'حداقل روز معاملاتی'), t('3 / phase', '۳ / مرحله'), t('None', 'ندارد')`), 'Rulebook table row drifted from the catalog')
})
