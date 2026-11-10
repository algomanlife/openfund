/**
 * Brand Ambassador / Verified Coach / Economy HTTP integration suite.
 *
 * Runs against an isolated test backend (SIM_TEST_MODE=1, test-named
 * database, CI placeholder PURCHASE_PAYMENT_RECEIVER, ADMIN_API_TOKEN set).
 * Purchases are confirmed through the existing /internal/confirm-order
 * seam, which drives the real confirmPurchase transaction.
 *
 * Run: TEST_BACKEND_URL=http://localhost:8297 TEST_ADMIN_TOKEN=... node --test test/partners.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createSiweMessage } from 'viem/siwe'

const BASE = process.env.TEST_BACKEND_URL || 'http://localhost:8080'
const ADMIN = process.env.TEST_ADMIN_TOKEN || process.env.ADMIN_API_TOKEN
const j = async (method, path, body, cookie, headers = {}) => {
  const res = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173', ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await res.json() } catch { /* empty */ }
  return { status: res.status, data, cookie: (res.headers.get('set-cookie') || '').split(';')[0] }
}
const admin = (method, path, body, actor = 'test-operator') => j(method, path, body, null, { Authorization: `Bearer ${ADMIN}`, 'X-Admin-Actor': actor })

async function signIn(extraCookie) {
  const wallet = privateKeyToAccount(generatePrivateKey())
  const n = (await j('POST', '/auth/nonce', { address: wallet.address })).data
  const message = createSiweMessage({ domain: 'localhost:5173', address: wallet.address, uri: 'http://localhost:5173/', chainId: 42161, nonce: n.nonce, version: '1' })
  const r = await j('POST', '/auth/verify', { message, signature: await wallet.signMessage({ message }) }, extraCookie)
  assert.equal(r.status, 200, JSON.stringify(r.data))
  return { wallet, cookie: r.cookie, userId: r.data?.user?.id }
}
async function buy(cookie, size = 5000, plan = 'standard') {
  const o = await j('POST', '/purchases/orders', { planSlug: plan, accountSize: size, idempotencyKey: crypto.randomUUID() }, cookie)
  assert.equal(o.status, 200, JSON.stringify(o.data))
  const tx = '0x' + crypto.randomBytes(32).toString('hex')
  const c = await j('POST', '/internal/confirm-order', { orderId: o.data.order.id, txHash: tx }, cookie)
  assert.equal(c.status, 200, JSON.stringify(c.data))
  return { orderId: o.data.order.id, price: o.data.order.price_usd, tx }
}
const ambassadorForm = {
  role: 'ambassador', displayName: 'Test Creator', contactEmail: 'creator@example.test', instagramUrl: 'https://instagram.com/testcreator',
  youtubeUrl: 'https://youtube.com/@testcreator', instagramFollowers: 82000, youtubeSubscribers: 9000, audienceLocation: 'EU',
  contentCategory: 'Futures education', marketingExperience: 'Three years of sponsored content.', promotionStrategy: 'Weekly educational videos.', acceptTerms: true,
}
const verification = { audience: [{ platform: 'instagram', count: 81500, evidence: 'Reviewed profile insights export 2026-11-09', verifiedAt: '2026-11-09' }], secondPlatformActive: true, marketsContent: true, engagementReviewed: true }

const ctx = {}

test('admin API refuses decisions without a named actor', { skip: !ADMIN }, async () => {
  const r = await j('POST', '/admin/partners/applications/00000000-0000-4000-8000-000000000000/decision', { action: 'review' }, null, { Authorization: `Bearer ${ADMIN}` })
  assert.equal(r.status, 400)
  assert.equal(r.data.error, 'admin_actor_required')
  assert.equal((await j('GET', '/admin/partners/applications')).status, 403)
})

test('ambassador application: validation, no code before approval', { skip: !ADMIN }, async () => {
  ctx.amb = await signIn()
  assert.equal((await j('POST', '/partners/applications', { ...ambassadorForm, acceptTerms: false }, ctx.amb.cookie)).data.error, 'terms_not_accepted')
  assert.equal((await j('POST', '/partners/applications', { ...ambassadorForm, instagramUrl: 'https://evil.example/x', youtubeUrl: null }, ctx.amb.cookie)).data.error, 'invalid_platform_url')
  const a = await j('POST', '/partners/applications', ambassadorForm, ctx.amb.cookie)
  assert.equal(a.status, 201)
  ctx.ambApp = a.data.id
  assert.equal((await j('POST', '/partners/applications', ambassadorForm, ctx.amb.cookie)).status, 409)
  const me = await j('GET', '/partners/me', null, ctx.amb.cookie)
  assert.equal(me.data.applications.ambassador.status, 'submitted')
  assert.equal(me.data.ambassador, null)
  assert.equal((await j('GET', '/ambassador/dashboard', null, ctx.amb.cookie)).status, 403)
})

test('approval requires verified audience evidence, then issues a code', { skip: !ADMIN }, async () => {
  const path = `/admin/partners/applications/${ctx.ambApp}/decision`
  assert.equal((await admin('POST', path, { action: 'review' })).data.status, 'under_review')
  const weak = await admin('POST', path, { action: 'approve', note: 'ok', verification: { ...verification, audience: [{ platform: 'instagram', count: 49999, evidence: 'insights' }] } })
  assert.equal(weak.data.error, 'audience_threshold_not_verified')
  const noSecond = await admin('POST', path, { action: 'approve', note: 'ok', verification: { ...verification, secondPlatformActive: false } })
  assert.equal(noSecond.data.error, 'second_platform_not_verified')
  const ok = await admin('POST', path, { action: 'approve', note: 'Audience verified', verification })
  assert.equal(ok.status, 200, JSON.stringify(ok.data))
  assert.match(ok.data.code, /^A[A-HJ-NP-Z2-9]{9}$/)
  ctx.code = ok.data.code
  const dup = await admin('POST', path, { action: 'approve', note: 'again', verification })
  assert.equal(dup.data.duplicate, true)
  const d = await j('GET', '/ambassador/dashboard', null, ctx.amb.cookie)
  assert.equal(d.status, 200)
  assert.equal(d.data.code, ctx.code)
  assert.equal(d.data.earnedUsd, '0.00')
})

test('coach role is independent: ambassador approval grants no coach access', { skip: !ADMIN }, async () => {
  assert.equal((await j('GET', '/coach/dashboard', null, ctx.amb.cookie)).data.error, 'coach_not_approved')
  const me = await j('GET', '/partners/me', null, ctx.amb.cookie)
  assert.equal(me.data.coach, null)
  assert.equal(me.data.applications.coach, null)
})

test('commission: 10% of the first confirmed purchase only, idempotent', { skip: !ADMIN }, async () => {
  await j('POST', '/ambassador/visit', { code: ctx.code, campaign: 'launch' })
  ctx.buyer = await signIn(`of_ref=${ctx.code}; of_cmp=launch`)
  const first = await buy(ctx.buyer.cookie, 25000)                 // $216
  const replay = await j('POST', '/internal/confirm-order', { orderId: first.orderId, txHash: first.tx }, ctx.buyer.cookie)
  assert.equal(replay.data.replayed, true)
  await buy(ctx.buyer.cookie, 5000)                                // second purchase: no commission
  const d = (await j('GET', '/ambassador/dashboard', null, ctx.amb.cookie)).data
  assert.equal(d.referredSignups, 1)
  assert.equal(d.confirmedFirstPurchases, 1)
  assert.equal(d.eligibleRevenueUsd, '216.00')
  assert.equal(d.earnedUsd, '21.60')
  assert.equal(d.pendingSettlementUsd, '21.60')
  assert.equal(d.traffic.uniqueVisitorDays >= 1, true)
  assert.equal(d.campaigns.find(c => c.campaign === 'launch')?.purchases, 1)
  ctx.firstOrder = first.orderId
})

test('self-referral never earns a commission', { skip: !ADMIN }, async () => {
  const before = (await j('GET', '/ambassador/dashboard', null, ctx.amb.cookie)).data.earnedUsd
  /* the ambassador's own wallet carries its own code into a purchase */
  const selfOrder = await j('POST', '/purchases/orders', { planSlug: 'standard', accountSize: 5000 }, `${ctx.amb.cookie}; of_ref=${ctx.code}`)
  assert.equal(selfOrder.status, 200)
  await j('POST', '/internal/confirm-order', { orderId: selfOrder.data.order.id, txHash: '0x' + crypto.randomBytes(32).toString('hex') }, ctx.amb.cookie)
  assert.equal((await j('GET', '/ambassador/dashboard', null, ctx.amb.cookie)).data.earnedUsd, before)
})

test('existing account that never paid is attributed at its first order', { skip: !ADMIN }, async () => {
  const late = await signIn()
  await buy(`${late.cookie}; of_ref=${ctx.code}`, 5000)           // $44 → 4.40
  const d = (await j('GET', '/ambassador/dashboard', null, ctx.amb.cookie)).data
  assert.equal(d.confirmedFirstPurchases, 2)
  assert.equal(d.earnedUsd, '26.00')
})

test('refund appends a proportional reversal; payout cannot exceed pending', { skip: !ADMIN }, async () => {
  const users = await admin('GET', `/admin/users/${ctx.buyer.userId}`)
  const payment = users.data.purchases.find(p => p.id === ctx.firstOrder)
  assert.ok(payment?.payment?.txHash)
  const pid = (await admin('GET', `/admin/economy/payments-lookup?tx=${payment.payment.txHash}`)).data?.paymentId
  assert.ok(pid, 'payment lookup')
  const tooMuch = await admin('POST', `/admin/economy/payments/${pid}/adjustments`, { kind: 'refund', amountUsd: '216.01', reference: 'ref-over' })
  assert.equal(tooMuch.data.error, 'adjustment_exceeds_payment')
  const half = await admin('POST', `/admin/economy/payments/${pid}/adjustments`, { kind: 'refund', amountUsd: '108.00', reference: 'refund-1', reason: 'partial' })
  assert.equal(half.status, 200, JSON.stringify(half.data))
  assert.equal(half.data.commissionReversal.amount, '-10.80')
  const again = await admin('POST', `/admin/economy/payments/${pid}/adjustments`, { kind: 'refund', amountUsd: '108.00', reference: 'refund-1' })
  assert.equal(again.data.duplicate, true)
  let d = (await j('GET', '/ambassador/dashboard', null, ctx.amb.cookie)).data
  assert.equal(d.reversedUsd, '-10.80')
  assert.equal(d.pendingSettlementUsd, '15.20')
  const over = await admin('POST', '/admin/partners/commissions/payout', { ambassadorUserId: ctx.amb.userId, amountUsd: '15.21', payoutReference: 'p-1' })
  assert.equal(over.data.error, 'payout_exceeds_pending_balance')
  const paid = await admin('POST', '/admin/partners/commissions/payout', { ambassadorUserId: ctx.amb.userId, amountUsd: '15.20', payoutReference: '0x' + 'a'.repeat(64) })
  assert.equal(paid.status, 200)
  const replay = await admin('POST', '/admin/partners/commissions/payout', { ambassadorUserId: ctx.amb.userId, amountUsd: '15.20', payoutReference: '0x' + 'a'.repeat(64) })
  assert.equal(replay.data.duplicate, true)
  d = (await j('GET', '/ambassador/dashboard', null, ctx.amb.cookie)).data
  assert.equal(d.paidUsd, '15.20')
  assert.equal(d.pendingSettlementUsd, '0.00')
})

test('suspended ambassador earns nothing on new referrals', { skip: !ADMIN }, async () => {
  assert.equal((await admin('POST', `/admin/partners/applications/${ctx.ambApp}/decision`, { action: 'suspend', note: 'policy review' })).data.status, 'suspended')
  const after = await signIn(`of_ref=${ctx.code}`)
  await buy(after.cookie, 5000)
  assert.equal((await j('GET', '/ambassador/dashboard', null, ctx.amb.cookie)).data.confirmedFirstPurchases, 2)
})

test('coach: approval, trader link, qualification and data isolation', { skip: !ADMIN }, async () => {
  const coach = await signIn()
  const app = await j('POST', '/partners/applications', { role: 'coach', displayName: 'Coach', contactEmail: 'coach@example.test', tradingExperience: '8 years', marketsTraded: 'BTC, ETH', trackRecord: 'Audited statement', riskManagement: 'Fixed fractional', mentoringExperience: 'Mentored 20 traders', motivation: 'Teach risk', acceptTerms: true }, coach.cookie)
  assert.equal(app.status, 201)
  const noEvidence = await admin('POST', `/admin/partners/applications/${app.data.id}/decision`, { action: 'approve', note: 'x', verification: {} })
  assert.equal(noEvidence.data.error, 'track_record_not_verified')
  const ok = await admin('POST', `/admin/partners/applications/${app.data.id}/decision`, { action: 'approve', note: 'Verified statement', verification: { trackRecordReviewed: true, evidence: 'Broker statement 2024–2026' } })
  assert.match(ok.data.code, /^C/)
  assert.equal((await j('GET', '/ambassador/dashboard', null, coach.cookie)).data.error, 'ambassador_not_approved')
  const trader = await signIn()
  assert.equal((await j('POST', '/coach/link', { coachCode: ok.data.code }, coach.cookie)).data.error, 'self_coaching_not_allowed')
  const link = await j('POST', '/coach/link', { coachCode: ok.data.code }, trader.cookie)
  assert.equal(link.status, 201)
  /* another user cannot act on the link */
  const outsider = await signIn()
  assert.equal((await j('POST', `/coach/links/${link.data.id}/respond`, { accept: true }, outsider.cookie)).data.error, 'coach_not_approved')
  assert.equal((await j('POST', `/coach/links/${link.data.id}/respond`, { accept: true }, coach.cookie)).data.status, 'active')
  const q = await j('POST', `/coach/links/${link.data.id}/qualification`, { decision: 'verified', note: 'Reviewed journal' }, coach.cookie)
  assert.equal(q.data.qualification, 'verified')
  const dash = (await j('GET', '/coach/dashboard', null, coach.cookie)).data
  assert.equal(dash.linkedTraders, 1)
  assert.equal(dash.revenueSharePct, 10)
  assert.equal(dash.coachShareUsd, '0.00')     // no live trades → no coach revenue from simulated accounts
  assert.ok(dash.traders[0].trader.wallet.includes('…'))
  assert.ok(Array.isArray(dash.traders[0].eligibility))
  const me = await j('GET', '/live/me', null, trader.cookie)
  assert.equal(me.data.eligibility.eligible, false)
  assert.equal(me.data.eligibility.checks.find(c => c.key === 'coach_verified_trader').ok, true)
  assert.equal((await j('POST', '/live/apply', {}, trader.cookie)).data.error, 'not_eligible')
  /* default deployments keep live execution disabled; with an adapter the trader still has no allocation */
  const mode = (await j('GET', '/live/status')).data.executionAdapter
  assert.equal((await j('POST', '/live/orders', { market: 'BTC/USD', side: 'long', collateralUsd: 10, leverage: 2, idempotencyKey: 'abcdefgh1' }, trader.cookie)).data.error,
    mode === 'none' ? 'live_execution_disabled' : 'no_active_allocation')
})

test('transparency aggregates confirmed sales and refunds without identities', { skip: !ADMIN }, async () => {
  const t = (await j('GET', '/economy/transparency')).data
  assert.ok(t.sales.challengesSold >= 5)
  assert.equal(Number(t.sales.refundsUsd) >= 108, true)
  assert.equal(t.sales.netRevenueUsd, (Number(t.sales.grossRevenueUsd) - Number(t.sales.refundsUsd) - Number(t.sales.chargebacksUsd)).toFixed(2))
  const body = JSON.stringify(t)
  assert.ok(!/0x[0-9a-f]{40}(?![0-9a-f])/i.test(body.replace(/"address":"0x[0-9a-f]{40}"/gi, '')), 'no wallet addresses outside treasury config')
  assert.equal(t.position.status, 'unknown')
  assert.equal(t.liveProgram.state, 'unknown')
})
