/**
 * Pure economy policy checks (no database). Expected values are computed
 * by hand from the published policy, never by the code under test.
 * Run: node --test test/economy-math.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  commissionFor, commissionReversal, validateSplit, distributeProfit, financialPosition, programCapacity,
  evaluateLiveEligibility, checkLiveOrder, applyRealized, scenario, PROFIT_SHARE_TIERS,
} from '../economy-math.js'

test('ambassador commission is exactly 10% of the confirmed net amount', () => {
  assert.deepEqual(commissionFor('299.00'), { base: '299.00', rate: '0.1000', amount: '29.90' })
  assert.equal(commissionFor('44.45').amount, '4.45')     // 4.445 → half-up
  assert.equal(commissionFor('0'), null)
  assert.equal(commissionFor('-5'), null)
})

test('refund reversal is proportional and never exceeds the remaining commission', () => {
  assert.equal(commissionReversal({ earnedUsd: '29.90', baseUsd: '299.00', adjustmentUsd: '299.00' }), '29.90')
  assert.equal(commissionReversal({ earnedUsd: '29.90', baseUsd: '299.00', adjustmentUsd: '149.50' }), '14.95')
  assert.equal(commissionReversal({ earnedUsd: '29.90', baseUsd: '299.00', adjustmentUsd: '299.00', alreadyReversedUsd: '-14.95' }), '14.95')
  assert.equal(commissionReversal({ earnedUsd: '29.90', baseUsd: '299.00', adjustmentUsd: '10', alreadyReversedUsd: '-29.90' }), '0.00')
})

test('profit split: coach fixed at 10, total must be 100', () => {
  for (const t of Object.values(PROFIT_SHARE_TIERS)) assert.equal(validateSplit(t), null)
  assert.equal(validateSplit({ trader: 75, coach: 5, openfund: 20 }), 'coach_share_must_be_10')
  assert.equal(validateSplit({ trader: 70, coach: 10, openfund: 15 }), 'split_must_total_100')
})

test('distributable = realized PnL − fees − execution costs; shares sum exactly', () => {
  const d = distributeProfit({ realizedPnlUsd: '1000.00', tradingFeesUsd: '12.50', executionCostsUsd: '2.50', split: PROFIT_SHARE_TIERS.standard })
  assert.equal(d.distributable, '985.00')
  assert.deepEqual(d.shares, { trader: '689.50', coach: '98.50', openfund: '197.00' })
  const odd = distributeProfit({ realizedPnlUsd: '0.07', split: PROFIT_SHARE_TIERS.elite })
  assert.equal((Number(odd.shares.trader) * 100 + Number(odd.shares.coach) * 100 + Number(odd.shares.openfund) * 100) / 100, 0.07)
})

test('no profit share on losses or when costs consume the profit', () => {
  assert.equal(distributeProfit({ realizedPnlUsd: '-500', split: PROFIT_SHARE_TIERS.standard }).shares, null)
  assert.equal(distributeProfit({ realizedPnlUsd: '10', tradingFeesUsd: '10', split: PROFIT_SHARE_TIERS.standard }).shares, null)
})

const okTreasury = { status: 'ok', stale: false, fullyPriced: true, totalUsd: '1000000.00' }
const zeroObl = { traderRewardsApprovedUnpaid: 0, ambassadorCommissionsUnpaid: 0, liveProfitSharesUnsettled: 0, expensesPayable: 0, otherLiabilities: 0 }

test('available capital subtracts obligations, reserves and allocations once each', () => {
  const p = financialPosition({
    treasury: okTreasury,
    obligations: { traderRewardsApprovedUnpaid: '50000', ambassadorCommissionsUnpaid: '2500', liveProfitSharesUnsettled: '1500', expensesPayable: '6000', otherLiabilities: '0' },
    reserves: { operational: '100000', risk: '150000', other: null },
    allocations: { allocatedUsd: '100000', openMarginUsd: '40000' },
  })
  // 1,000,000 − 60,000 − 250,000 − 100,000 (margin inside allocation is not double counted)
  assert.equal(p.availableAllocatableUsd, '590000.00')
  assert.equal(p.status, 'verified')
  assert.equal(programCapacity(p).state, 'capacity_available')
})

test('open margin beyond the allocation is counted only for the excess', () => {
  const p = financialPosition({ treasury: okTreasury, obligations: zeroObl, reserves: { operational: 0, risk: 0 }, allocations: { allocatedUsd: '100', openMarginUsd: '150' } })
  assert.equal(p.allocatedCapitalUsd, '150.00')
})

test('missing or stale data makes capital Unknown and blocks the program', () => {
  const base = { obligations: zeroObl, reserves: { operational: 0, risk: 0 }, allocations: {} }
  assert.equal(programCapacity(financialPosition({ ...base, treasury: null })).state, 'unknown')
  assert.equal(programCapacity(financialPosition({ ...base, treasury: { ...okTreasury, stale: true } })).state, 'unknown')
  assert.equal(programCapacity(financialPosition({ ...base, treasury: { ...okTreasury, fullyPriced: false } })).state, 'unknown')
  assert.deepEqual(financialPosition({ ...base, treasury: okTreasury, reserves: { operational: 0 } }).missing, ['risk_reserve'])
  const below = financialPosition({ ...base, treasury: { ...okTreasury, totalUsd: '499999.99' } })
  assert.equal(programCapacity(below).state, 'below_threshold')
})

const acct = (o) => ({ orderId: 'x', sizeUsd: '10000.00', phases: 2, evaluationPassed: true, fundedChallengeId: 'f', paidWithdrawals: 10, ...o })
const coach = { linkActive: true, coachActive: true, qualificationVerified: true }

test('live eligibility: 10 paid withdrawals, exact 2× second account with 5, verified coach', () => {
  assert.equal(evaluateLiveEligibility({ accounts: [acct(), acct({ sizeUsd: '20000.00', paidWithdrawals: 5 })], coach }).eligible, true)
  const fails = (accounts, c = coach) => evaluateLiveEligibility({ accounts, coach: c }).checks.filter(x => !x.ok).map(x => x.key)
  assert.deepEqual(fails([acct({ paidWithdrawals: 9 }), acct({ sizeUsd: '20000', paidWithdrawals: 5 })]), ['first_account_paid_withdrawals'])
  assert.deepEqual(fails([acct(), acct({ sizeUsd: '25000', paidWithdrawals: 5 })]), ['second_account_double_size', 'second_account_evaluation_passed', 'second_account_paid_withdrawals'])
  assert.deepEqual(fails([acct(), acct({ sizeUsd: '20000', paidWithdrawals: 4 })]), ['second_account_paid_withdrawals'])
  assert.deepEqual(fails([acct(), acct({ sizeUsd: '20000', paidWithdrawals: 5 })], { ...coach, qualificationVerified: false }), ['coach_verified_trader'])
  assert.deepEqual(fails([acct({ evaluationPassed: false, fundedChallengeId: null, paidWithdrawals: 0 })], null).slice(0, 3),
    ['first_account_evaluation_passed', 'first_account_funded', 'first_account_paid_withdrawals'])
})

const alloc = { amountUsd: '100000', realizedPnlUsd: '0', peakEquityUsd: '100000', dayStartEquityUsd: '100000', status: 'active' }
const limits = { dailyDrawdownPct: 5, maxDrawdownPct: 10, maxLeverage: 20, maxExposureUsd: '500000', maxOpenPositions: 5 }

test('worst-case loss is the full collateral, not the drawdown percentage', () => {
  /* 10x leverage on $4,000: a 5% move does not bound the loss — collateral does */
  assert.equal(checkLiveOrder({ allocation: alloc, limits, order: { collateralUsd: '4000', leverage: 10 } }).ok, true)
  const r = checkLiveOrder({ allocation: alloc, limits, order: { collateralUsd: '6000', leverage: 10 } })
  assert.deepEqual(r.reasons, ['worst_case_loss_exceeds_drawdown_budget'])
  assert.deepEqual(checkLiveOrder({ allocation: alloc, limits, order: { collateralUsd: '100', leverage: 25 } }).reasons, ['leverage_above_limit'])
  assert.deepEqual(checkLiveOrder({ allocation: { ...alloc, status: 'halted' }, limits, order: { collateralUsd: '100', leverage: 2 } }).reasons, ['allocation_halted'])
  assert.ok(checkLiveOrder({ allocation: alloc, limits: { ...limits, maxExposureUsd: '1000' }, order: { collateralUsd: '100', leverage: 20 } }).reasons.includes('exposure_above_limit'))
})

test('circuit breaker halts the allocation on drawdown breach', () => {
  assert.equal(applyRealized({ allocation: { ...alloc, day: '2026-11-09' }, limits, realizedNetUsd: '-5000', today: '2026-11-09' }).halt, 'daily_drawdown_breached')
  assert.equal(applyRealized({ allocation: { ...alloc, realizedPnlUsd: '-6000', dayStartEquityUsd: '94000', day: '2026-11-08' }, limits, realizedNetUsd: '-4000', today: '2026-11-09' }).halt, 'max_drawdown_breached')
  assert.equal(applyRealized({ allocation: { ...alloc, day: '2026-11-09' }, limits, realizedNetUsd: '2000', today: '2026-11-09' }).halt, null)
})

test('scenario model is arithmetic over inputs only', () => {
  const s = scenario({ challengesSold: 1000, mix: { '10000': 50, '100000': 50 }, prices: { '10000': 100, '100000': 500 }, refundRatePct: 0,
    passRatePct: 10, firstPayoutRatePct: 50, avgTotalPayoutUsd: 2000, ambassadorSharePct: 20, operatingCostsUsd: 50000, reservePct: 25 })
  assert.equal(s.grossRevenue, '300000.00')
  assert.equal(s.traderPayouts, '100000.00')          // 1000 × 10% × 50% × 2000
  assert.equal(s.ambassadorCommissions, '6000.00')    // 300000 × 20% × 10%
  assert.equal(s.remainingCapital, '144000.00')
  assert.equal(s.availableAllocatable, '108000.00')
})
