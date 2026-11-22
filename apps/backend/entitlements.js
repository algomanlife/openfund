/**
 * Granted entitlements: the controlled-entitlement path generalized.
 *
 * An entitlement is a single-use, internal, 100% coupon bound to exactly one
 * wallet (coupon_allowed_users), one plan (coupon_challenge_plans) and one
 * account size (coupons.account_sizes). The trader redeems it in the normal
 * checkout, so the challenge is created by the one provisioning path
 * (purchases.js provisionOrderTx) with a frozen rules snapshot; nothing here
 * writes balances, positions or trade history.
 *
 * Sources: 'admin' (Backstage "issue a challenge or funded account"),
 * 'tournament' (Premium League account awards) and 'migration' (an approved
 * migration request). start_stage 0 provisions a funded-stage account with
 * the plan's normal funded rules; 1 starts a normal evaluation.
 */
import { randomBytes } from 'node:crypto'
import { FUNDED_PAYOUT_VERSION, FUNDED_PAYOUT_CYCLES } from './funded-policy.js'

const fail = (status, error) => Object.assign(new Error(error), { status })
export const ENTITLEMENT_SOURCES = ['admin', 'tournament', 'migration']

/** Issue one entitlement inside the caller's transaction. */
export async function issueEntitlementTx(client, { walletAddress, userId, planSlug, accountSizeUsd, startStage = 1, source, reference = null, reason, actor, expiresDays = 30 }) {
  if (!ENTITLEMENT_SOURCES.includes(source)) throw fail(400, 'invalid_entitlement_source')
  if (![0, 1].includes(startStage)) throw fail(400, 'invalid_start_stage')
  if (typeof reason !== 'string' || reason.trim().length < 3 || reason.length > 1000) throw fail(400, 'reason_required')
  if (!Number.isInteger(expiresDays) || expiresDays < 1 || expiresDays > 365) throw fail(400, 'invalid_expiry')
  const owner = userId
    ? (await client.query('SELECT id, wallet_address FROM openfund_users WHERE id=$1', [userId])).rows[0]
    : (await client.query('SELECT id, wallet_address FROM openfund_users WHERE wallet_address=$1', [String(walletAddress || '').toLowerCase()])).rows[0]
  if (!owner) throw fail(404, 'wallet_not_registered')
  const { rows: [plan] } = await client.query(`SELECT id, slug, configuration FROM challenge_plans WHERE slug=$1 AND status='active'`, [planSlug])
  if (!plan) throw fail(409, 'plan_not_available')
  const sizes = (plan.configuration?.accountSizesUsd ?? []).map(Number)
  const size = Number(accountSizeUsd)
  if (!sizes.includes(size)) throw fail(400, 'invalid_account_size')
  if (plan.configuration?.free) throw fail(409, 'trial_not_grantable')
  if (startStage === 0 && !(Number(plan.configuration?.phases) >= 1)) throw fail(409, 'plan_has_no_funded_stage')
  const code = 'OFG' + randomBytes(10).toString('hex').toUpperCase()
  await client.query("SELECT set_config('openfund.actor',$1,true)", [actor])
  const { rows: [coupon] } = await client.query(
    `INSERT INTO coupons (code, name, kind, value, status, max_redemptions, per_user_limit, internal, account_sizes, created_by, expires_at)
     VALUES ($1, $2, 'percent', 100, 'active', 1, 1, true, $3, $4, now() + ($5::int * interval '1 day'))
     RETURNING id, code, expires_at`,
    [code, `Entitlement (${source}): ${plan.slug} ${size}`, JSON.stringify([size]), actor, expiresDays])
  await client.query('INSERT INTO coupon_challenge_plans (coupon_id, challenge_plan_id) VALUES ($1,$2)', [coupon.id, plan.id])
  await client.query('INSERT INTO coupon_allowed_users (coupon_id, user_id) VALUES ($1,$2)', [coupon.id, owner.id])
  const { rows: [entitlement] } = await client.query(
    `INSERT INTO granted_entitlements (coupon_id, user_id, challenge_plan_id, account_size_usd, start_stage, source, reference, reason, issued_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [coupon.id, owner.id, plan.id, size, startStage, source, reference, reason.trim(), actor])
  return { ...entitlement, code: coupon.code, expires_at: coupon.expires_at, wallet_address: owner.wallet_address, plan_slug: plan.slug }
}

/** The entitlement behind an order's coupon, if any (read inside provisioning). */
export async function entitlementForOrderTx(client, order) {
  if (!order.coupon_id) return null
  const { rows: [row] } = await client.query('SELECT * FROM granted_entitlements WHERE coupon_id=$1', [order.coupon_id])
  if (!row) return null
  if (row.user_id !== order.user_id || row.challenge_plan_id !== order.challenge_plan_id || Number(row.account_size_usd) !== Number(order.account_size_usd))
    throw fail(409, 'entitlement_order_mismatch')
  return row
}

/** Funded-stage snapshot for a start_stage 0 entitlement: the plan's normal
 *  funded rules, built exactly like the reward review's funded activation
 *  (rewards.js), without an introducing-broker attribution. */
export function fundedEntitlementSnapshot(rules, { orderCreatedAt, fundedPolicyFrom = process.env.FUNDED_PAYOUT_V1_FROM } = {}) {
  const snapshot = { ...rules, funded: true }
  const v3 = Number(rules.rulesVersion) >= 3
  if (v3 && /^\d{4}-\d{2}-\d{2}$/.test(fundedPolicyFrom || '') && orderCreatedAt) {
    const cutoff = new Date(`${fundedPolicyFrom}T00:00:00.000Z`)
    if (Number.isFinite(+cutoff) && +new Date(orderCreatedAt) >= +cutoff) {
      snapshot.fundedPayoutVersion = FUNDED_PAYOUT_VERSION
      snapshot.rewardCycles = FUNDED_PAYOUT_CYCLES
      snapshot.fundedIb = null
    }
  }
  return snapshot
}
