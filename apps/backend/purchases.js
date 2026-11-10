/**
 * Openfund — challenge purchases, on-chain payment verification,
 * invoices, purchase/payment history and withdrawal requests.
 *
 * Reuses the existing identity and account architecture:
 *  - pricing comes ONLY from challenge_plans.configuration (server-controlled);
 *  - a confirmed payment provisions exactly ONE openfund_challenges row —
 *    the record type accountDirectory() and the products router already
 *    consume (type 'challenge', journal-scoped, ownership-checked);
 *  - the demo trading engine / demo_accounts are NOT touched;
 *  - the payment destination is a runtime env var (PURCHASE_PAYMENT_RECEIVER).
 *    While unset, purchases stay disabled — no hardcoded production address,
 *    no production payment activation without explicit approval.
 *
 * Server-side verification (viem, no new dependencies):
 *  - transaction receipt exists and status === 'success';
 *  - sender === the order owner's wallet address;
 *  - receiver === the configured payment address (native value or, when
 *    PURCHASE_PAYMENT_TOKEN is set, an ERC-20 Transfer log from the payer
 *    to the receiver whose value covers the order price);
 *  - the payment block was mined at/after the order was created
 *    (an old transaction can never activate a later order);
 *  - UNIQUE (chain_id, tx_hash) makes every on-chain payment usable
 *    exactly once across the whole system.
 */
import { Router } from 'express'
import crypto from 'node:crypto'
import { invoicePdf } from './invoice-pdf.js'
import { ChallengeService, normalizeRules } from './evaluation.js'
import { recognizeCommissionTx, attributeAtFirstOrder } from './partners.js'
import { createRpcVerifier, SUPPORTED_CHAINS } from './payment-verification.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const txHashRe = /^0x[0-9a-f]{64}$/i

const csv = v => String(v || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
const isProd = () => process.env.NODE_ENV === 'production'
export const cfg = () => {
  const token = (process.env.PURCHASE_PAYMENT_TOKEN || '').toLowerCase() || null
  return {
    receiver: (process.env.PURCHASE_PAYMENT_RECEIVER || '').toLowerCase() || null,
    chainId: Number(process.env.PURCHASE_PAYMENT_CHAIN || 11155111),
    token,
    /* when unset the token's decimals are read from the contract; when set
       they must MATCH the contract (a mismatch fails closed) */
    tokenDecimals: process.env.PURCHASE_PAYMENT_DECIMALS === undefined || process.env.PURCHASE_PAYMENT_DECIMALS === ''
      ? null : Number(process.env.PURCHASE_PAYMENT_DECIMALS),
    /* dedicated RPC endpoint — the public fallback is never used */
    rpcUrl: process.env.PURCHASE_RPC_URL || null,
    /* operator-approved payment routers (e.g. the DePay Payment Router on
       the configured chain). Empty = direct token transfers only. */
    routers: csv(process.env.PURCHASE_ROUTER_ADDRESSES),
    /* finality policy: minimum confirmations before a payment is accepted.
       Production defaults to a conservative depth; an explicit value wins. */
    minConfirmations: process.env.PURCHASE_PAYMENT_MIN_CONFIRMATIONS !== undefined && process.env.PURCHASE_PAYMENT_MIN_CONFIRMATIONS !== ''
      ? Number(process.env.PURCHASE_PAYMENT_MIN_CONFIRMATIONS) || 0
      : (isProd() ? 12 : 0),
    /* late-payment grace: a transaction mined within this many minutes
       after order expiry still pays the order (money received is never
       silently dropped; outside the window → manual reconciliation) */
    lateGraceMinutes: Number(process.env.PURCHASE_LATE_GRACE_MINUTES ?? 60) || 0,
    /* native value is never converted to USD: only non-production test
       chains without an approved token may use it */
    allowNative: !isProd() && !token,
  }
}

/** payments are offered only when the configuration is complete and safe */
export function paymentsReady(c = cfg()) {
  if (!c.receiver || !SUPPORTED_CHAINS.has(c.chainId)) return false
  if (isProd()) return !!(c.token && c.rpcUrl)
  return true
}

const fail = (status, error) => {
  const e = new Error(error)
  e.status = status
  return e
}
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

/* ---------- provisioning: one transaction, exactly once ---------- */
export async function confirmPurchase(pool, { orderId, userId, evidence, source }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const order = (await client.query('SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE', [orderId])).rows[0]
    if (!order || order.user_id !== userId) throw fail(404, 'order_not_found')
    if (order.status === 'paid') {
      /* idempotent replay: return the already-provisioned result */
      const payment = (await client.query('SELECT id, tx_hash FROM payments WHERE purchase_order_id=$1', [orderId])).rows[0]
      const invoice = (await client.query('SELECT id, number FROM invoices WHERE purchase_order_id=$1', [orderId])).rows[0]
      const challenge = (await client.query('SELECT id FROM openfund_challenges WHERE purchase_order_id=$1', [orderId])).rows[0]
      await client.query('COMMIT')
      return { replayed: true, orderId, paymentId: payment?.id, invoiceId: invoice?.id, invoiceNumber: invoice?.number, challengeId: challenge?.id }
    }
    if (order.status !== 'pending' && order.status !== 'expired') throw fail(409, 'order_not_pending')
    /* late-payment policy: an expired order still accepts an on-chain
       payment whose block was mined within the grace window AFTER
       expiry — money received is never silently dropped. Outside the
       window → explicit 409 for manual reconciliation (refund path). */
    if (order.status === 'expired' || (order.expires_at && order.expires_at < new Date())) {
      const graceMs = cfg().lateGraceMinutes * 60_000
      const minedAt = evidence.blockTimestamp ? new Date(evidence.blockTimestamp).getTime() : NaN
      if (!Number.isFinite(minedAt) || minedAt > new Date(order.expires_at).getTime() + graceMs)
        throw fail(409, 'order_expired')
    }

    const dup = (await client.query('SELECT purchase_order_id FROM payments WHERE chain_id=$1 AND tx_hash=$2', [evidence.chainId, evidence.txHash])).rows[0]
    if (dup && dup.purchase_order_id !== orderId) throw fail(409, 'tx_already_used')

    const payment = (await client.query(
      `INSERT INTO payments (purchase_order_id, user_id, tx_hash, chain_id, block_number, from_address, to_address, amount, token_address, status, verification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'confirmed',$10) RETURNING id`,
      [orderId, userId, evidence.txHash, evidence.chainId, evidence.blockNumber ?? null,
        evidence.fromAddress, evidence.toAddress ?? null, evidence.amount ?? null,
        evidence.tokenAddress ?? null, JSON.stringify({ ...evidence, source })])).rows[0]

    const { rows: [paid] } = await client.query(
      `UPDATE purchase_orders SET status='paid', paid_at=now() WHERE id=$1 AND status IN ('pending','expired') RETURNING paid_at`,
      [orderId])
    if (!paid) throw fail(409, 'order_not_pending')

    /* the plan configuration of record is read in the SAME transaction as
       the status flip, then frozen into the challenge's rules_snapshot */
    const planConfiguration = (await client.query(
      'SELECT configuration FROM challenge_plans WHERE id=$1', [order.challenge_plan_id])).rows[0]?.configuration ?? {}

    const challenge = (await client.query(
      `INSERT INTO openfund_challenges (user_id, challenge_plan_id, status, account_size_usd, purchase_order_id, rules_snapshot)
       VALUES ($1,$2,'created',$3,$4,$5) RETURNING *`,
      [userId, order.challenge_plan_id, order.account_size_usd, orderId,
        JSON.stringify(normalizeRules(planConfiguration))])).rows[0]

    /* provision the challenge trading account (challenge_funding ledger
       event, immutable provisioning event, frozen rules snapshot) —
       the user starts the evaluation via POST /challenges/:id/start */
    const challenges = new ChallengeService(client)
    await challenges.provisionTx(client, {
      ...challenge,
      plan_configuration: planConfiguration,
    })

    const invoice = (await client.query(
      `INSERT INTO invoices (purchase_order_id, user_id, number, total_usd)
       VALUES ($1,$2,'OF-' || to_char(now(),'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text,6,'0'),$3) RETURNING id, number`,
      [orderId, userId, order.price_usd])).rows[0]

    /* Brand Ambassador commission: recognized in THIS transaction, so it
       exists exactly when the payment is confirmed. Idempotent (UNIQUE
       indexes); an unexpected error is isolated by a savepoint and audited
       for reconciliation instead of blocking the customer's provisioning. */
    await client.query('SAVEPOINT ambassador_commission')
    try {
      await recognizeCommissionTx(client, { orderId, userId, paymentId: payment.id, payerAddress: evidence.fromAddress })
      await client.query('RELEASE SAVEPOINT ambassador_commission')
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT ambassador_commission')
      await client.query(`INSERT INTO financial_audit_log (actor, action, entity, entity_id, after) VALUES ('system','commission_recognition_error','purchase_order',$1,$2)`,
        [orderId, JSON.stringify({ error: String(e.message).slice(0, 200) })])
    }

    await client.query(
      `INSERT INTO trading_events (account_id, kind, detail) SELECT id,'challenge_provisioned',$2 FROM demo_accounts WHERE user_id=$1 AND account_type='free_demo'`,
      [userId, JSON.stringify({ challengeId: challenge.id, orderId, source })]).catch(() => {})

    await client.query('COMMIT')
    return { replayed: false, orderId, paymentId: payment.id, invoiceId: invoice.id, invoiceNumber: invoice.number, challengeId: challenge.id }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

/* ---------- payment attempts, classification and recovery ---------- */
const RETRYABLE = new Set(['tx_pending', 'tx_not_final', 'rpc_unavailable', 'tx_reorged'])
const CLASSIFY = {
  insufficient_amount: 'underpayment', wrong_token: 'wrong_token', wrong_receiver: 'wrong_receiver',
  wrong_sender: 'wrong_sender', tx_not_successful: 'reverted', order_expired: 'late',
  tx_already_used: 'duplicate', native_payment_unsupported: 'wrong_token', unapproved_contract: 'wrong_receiver',
  unsupported_chain: 'wrong_token', tx_too_old: 'other',
}
/* outcomes a human must look at (money may have moved, or may need returning) */
const NEEDS_REVIEW = new Set(['underpayment', 'wrong_token', 'wrong_receiver', 'late', 'duplicate', 'overpayment'])

let defaultVerifier = null
export function defaultPaymentVerifier() {
  return defaultVerifier ||= createRpcVerifier({ rpcUrl: cfg().rpcUrl })
}

async function startAttempt(pool, { orderId, userId, chainId, txHash }) {
  const { rows: [a] } = await pool.query(
    `INSERT INTO payment_attempts (purchase_order_id, user_id, chain_id, tx_hash)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (purchase_order_id, chain_id, tx_hash)
     DO UPDATE SET attempts = payment_attempts.attempts + 1, last_attempt_at = now()
       WHERE payment_attempts.status <> 'confirmed'
     RETURNING id`, [orderId, userId, chainId, txHash.toLowerCase()])
  return a?.id ?? null
}
async function finishAttempt(pool, id, { status, code = null, retryable = false, classification = null, detail = {} }) {
  if (!id) return
  await pool.query(
    `UPDATE payment_attempts SET status=$2, error_code=$3, retryable=$4, classification=$5, detail=$6,
            last_attempt_at=now(),
            review_status = CASE WHEN review_status='none' AND $7 THEN 'open' ELSE review_status END
      WHERE id=$1`,
    [id, status, code, retryable, classification, JSON.stringify(detail), classification ? NEEDS_REVIEW.has(classification) : false])
}

/**
 * Verify an on-chain payment for an order and provision exactly once.
 * Shared by the customer route, the recovery sweep and operator re-verify.
 * The chain verifier is authoritative; the frontend never confirms payment.
 */
export async function verifyAndConfirm({ pool, verifier, order, userId, walletAddress, txHash, source }) {
  const c = cfg()
  const attemptId = await startAttempt(pool, { orderId: order.id, userId, chainId: c.chainId, txHash })
  try {
    const evidence = await verifier(txHash, {
      chainId: c.chainId, receiver: c.receiver, token: c.token, tokenDecimals: c.tokenDecimals,
      priceUsd: String(order.price_usd), routers: c.routers, allowNative: c.allowNative,
      from: walletAddress, notBefore: new Date(order.created_at).getTime() - 5 * 60_000,
      minConfirmations: c.minConfirmations,
    })
    const result = await confirmPurchase(pool, { orderId: order.id, userId, evidence, source })
    const over = evidence.overpaymentUnits && evidence.overpaymentUnits !== '0'
    await finishAttempt(pool, attemptId, {
      status: 'confirmed', classification: over ? 'overpayment' : null,
      detail: { route: evidence.route, amount: evidence.amount, confirmations: evidence.confirmations, overpaymentUnits: evidence.overpaymentUnits, source },
    })
    return result
  } catch (e) {
    const code = e.message
    const retryable = !!e.retryable || RETRYABLE.has(code)
    await finishAttempt(pool, attemptId, {
      status: retryable ? 'pending' : 'rejected', code, retryable,
      classification: retryable ? null : (CLASSIFY[code] || 'other'),
      detail: { source, ...(e.received ? { received: e.received } : {}), ...(e.confirmations != null ? { confirmations: e.confirmations, required: e.required } : {}), ...(e.detail ? { detail: e.detail } : {}) },
    }).catch(() => {})
    throw e
  }
}

/**
 * DePay server callback → a HINT, never a confirmation.
 * The callback is verified against the operator-configured DePay public key
 * (RSA-PSS, SHA-256 over the raw body, x-signature, base64url) and only
 * registers the reported transaction as a retryable attempt for the sender's
 * order. The recovery sweep then proves the payment on-chain; nothing in the
 * callback body (amount, token, receiver, success) is trusted.
 */
export function verifyDepaySignature(rawBody, signature, publicKeyPem) {
  try {
    return crypto.verify('sha256', rawBody, { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 },
      Buffer.from(String(signature || ''), 'base64url'))
  } catch { return false }
}
const DEPAY_NAME = { 1: 'ethereum', 42161: 'arbitrum', 8453: 'base' }
export async function recordPaymentHint(pool, body) {
  const c = cfg()
  const tx = String(body?.transaction || '').toLowerCase()
  const sender = String(body?.sender || '').toLowerCase()
  if (!txHashRe.test(tx) || !/^0x[0-9a-f]{40}$/.test(sender)) return { recorded: false, reason: 'invalid_payload' }
  if (String(body?.blockchain || '').toLowerCase() !== DEPAY_NAME[c.chainId]) return { recorded: false, reason: 'other_chain' }
  const user = (await pool.query('SELECT id FROM openfund_users WHERE lower(wallet_address)=$1', [sender])).rows[0]
  if (!user) return { recorded: false, reason: 'unknown_sender' }
  const wanted = body?.payload?.orderId
  const order = (await pool.query(
    `SELECT id FROM purchase_orders WHERE user_id=$1 AND status IN ('pending','expired')
        AND ($2::uuid IS NULL OR id=$2::uuid) AND created_at > now() - interval '24 hours'
      ORDER BY created_at DESC LIMIT 1`, [user.id, uuid.test(wanted || '') ? wanted : null])).rows[0]
  if (!order) return { recorded: false, reason: 'no_open_order' }
  await pool.query(
    `INSERT INTO payment_attempts (purchase_order_id, user_id, chain_id, tx_hash, status, retryable, detail)
     VALUES ($1,$2,$3,$4,'pending',true,$5) ON CONFLICT (purchase_order_id, chain_id, tx_hash) DO NOTHING`,
    [order.id, user.id, c.chainId, tx, JSON.stringify({ source: 'depay_callback' })])
  return { recorded: true, orderId: order.id }
}

/** background recovery: re-verify attempts stuck on a retryable condition */
export async function recoverPendingPayments({ pool, verifier = defaultPaymentVerifier(), limit = 20, log = () => {} }) {
  const { rows } = await pool.query(
    `SELECT a.tx_hash, o.id AS order_id, o.price_usd, o.created_at, o.user_id, u.wallet_address
       FROM payment_attempts a
       JOIN purchase_orders o ON o.id = a.purchase_order_id
       JOIN openfund_users u ON u.id = a.user_id
      WHERE a.status='pending' AND a.retryable
        AND a.first_seen_at > now() - interval '24 hours'
        AND a.last_attempt_at < now() - interval '45 seconds'
        AND o.status IN ('pending','expired')
      ORDER BY a.last_attempt_at LIMIT $1`, [limit])
  let recovered = 0
  for (const r of rows) {
    try {
      await verifyAndConfirm({ pool, verifier, order: { id: r.order_id, price_usd: r.price_usd, created_at: r.created_at },
        userId: r.user_id, walletAddress: r.wallet_address, txHash: r.tx_hash, source: 'recovery' })
      recovered++
    } catch (e) { log(r.order_id, e.message) }
  }
  return { checked: rows.length, recovered }
}

/* ---------- routes ---------- */
export function purchaseRoutes({ pool, requireAuth, audit, verifier = null }) {
  const chainVerifier = () => verifier || defaultPaymentVerifier()
  const router = Router()

  const paymentEnabled = () => paymentsReady()

  const orderView = async (id, userId) => {
    const { rows } = await pool.query(
      `SELECT o.id, o.status, o.account_size_usd, o.price_usd, o.currency, o.created_at, o.expires_at, o.paid_at,
              p.slug AS plan_slug, p.name AS plan_name
         FROM purchase_orders o JOIN challenge_plans p ON p.id=o.challenge_plan_id
        WHERE o.id=$1 AND o.user_id=$2`, [id, userId])
    return rows[0] || null
  }

  const paymentInstructions = order => {
    const c = cfg()
    if (!c.receiver) return null
    return {
      chainId: c.chainId,
      receiver: c.receiver,
      token: c.token,
      amount: String(order.price_usd),
      reference: order.id,
    }
  }

  /* 1 — catalog + payment configuration (public: published plan data and a
     public payment address; auth is enforced on order creation/verification) */
  router.get('/purchases/plans', wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT slug, name, configuration FROM challenge_plans WHERE status='active' ORDER BY created_at`)
    const plans = rows.map(p => {
      const c = p.configuration || {}
      return {
        slug: p.slug,
        name: p.name,
        accountSizesUsd: c.accountSizesUsd || [],
        priceUsd: c.priceUsd || {},
        free: !!c.free,
      }
    })
    const c = cfg()
    res.json({
      plans,
      paymentsEnabled: paymentEnabled(),
      payment: paymentEnabled()
        ? { chainId: c.chainId, receiver: c.receiver, token: c.token, tokenDecimals: c.tokenDecimals, routers: c.routers }
        : null,
    })
  }))

  /* 2 — create an order (server-priced snapshot; idempotent) */
  router.post('/purchases/orders', requireAuth, wrap(async (req, res) => {
    if (!paymentEnabled()) throw fail(403, 'purchases_disabled')
    const { planSlug, accountSize, idempotencyKey } = req.body || {}
    if (typeof planSlug !== 'string' || !Number.isFinite(Number(accountSize))) throw fail(400, 'invalid_request')
    const { rows: [plan] } = await pool.query(
      `SELECT id, slug, configuration FROM challenge_plans WHERE slug=$1 AND status='active'`, [planSlug])
    if (!plan) throw fail(404, 'plan_not_found')
    const c = plan.configuration || {}
    if (c.free) throw fail(400, 'not_purchasable')
    const size = Number(accountSize)
    if (!(c.accountSizesUsd || []).includes(size)) throw fail(400, 'invalid_account_size')
    const price = c.priceUsd && c.priceUsd[size]
    if (!Number.isFinite(Number(price)) || Number(price) <= 0) throw fail(400, 'not_purchasable')
    const key = typeof idempotencyKey === 'string' && idempotencyKey.length <= 120 ? idempotencyKey : null

    if (key) {
      const existing = (await pool.query(
        `SELECT o.id FROM purchase_orders o WHERE o.user_id=$1 AND o.idempotency_key=$2`, [req.user.user_id, key])).rows[0]
      if (existing) {
        const view = await orderView(existing.id, req.user.user_id)
        return res.json({ order: view, payment: paymentInstructions(view) })
      }
    }
    /* an un-attributed account that has never paid may be attributed to an
       approved ambassador's link before its first order is created */
    await attributeAtFirstOrder(pool, req, req.user.user_id)
    const { rows: [order] } = await pool.query(
      `INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, price_usd, idempotency_key)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.user.user_id, plan.id, size.toFixed(2), Number(price).toFixed(2), key])
    await audit('purchase_order_created', req.user.user_id, req, { orderId: order.id, planSlug, size, price: Number(price) })
    const view = await orderView(order.id, req.user.user_id)
    res.json({ order: view, payment: paymentInstructions(view) })
  }))

  /* 3 — order status (checkout polling) */
  router.get('/purchases/orders/:id', requireAuth, wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'order_not_found')
    const order = await orderView(req.params.id, req.user.user_id)
    if (!order) throw fail(404, 'order_not_found')
    res.json({ order, payment: order.status === 'pending' ? paymentInstructions(order) : null })
  }))

  /* 4 — verify an on-chain payment and provision exactly once */
  router.post('/purchases/verify', requireAuth, wrap(async (req, res) => {
    if (!paymentEnabled()) throw fail(403, 'purchases_disabled')
    const { orderId, txHash } = req.body || {}
    if (!uuid.test(orderId || '') || !txHashRe.test(txHash || '')) throw fail(400, 'invalid_request')
    const order = await orderView(orderId, req.user.user_id)
    if (!order) throw fail(404, 'order_not_found')
    if (order.status === 'paid') return res.json(await confirmPurchase(pool, { orderId, userId: req.user.user_id, evidence: { txHash, chainId: cfg().chainId }, source: 'replay' }))
    if (order.status !== 'pending' && order.status !== 'expired') throw fail(409, 'order_not_pending')
    /* NOTE: expiry is NOT rejected here — the on-chain evidence is
       verified first, then confirmPurchase applies the late-payment
       grace policy (money received inside the window is never dropped) */
    const raw = (await pool.query('SELECT price_usd, created_at FROM purchase_orders WHERE id=$1', [orderId])).rows[0]
    try {
      const result = await verifyAndConfirm({
        pool, verifier: chainVerifier(), order: { id: orderId, price_usd: raw.price_usd, created_at: raw.created_at },
        userId: req.user.user_id, walletAddress: req.user.wallet_address, txHash, source: 'onchain',
      })
      await audit('purchase_verified', req.user.user_id, req, { orderId, txHash, challengeId: result.challengeId })
      res.json(result)
    } catch (e) {
      if (e.retryable) return res.status(e.status || 409).json({ error: e.message, retryable: true, confirmations: e.confirmations, required: e.required })
      throw e
    }
  }))

  /* 4b — payment attempts for the checkout (page-refresh recovery: a
     wallet transaction that succeeded but whose verification request was
     lost is found again here and can be re-verified) */
  router.get('/purchases/orders/:id/attempts', requireAuth, wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'order_not_found')
    const { rows } = await pool.query(
      `SELECT a.tx_hash, a.chain_id, a.status, a.error_code, a.retryable, a.classification, a.attempts, a.last_attempt_at
         FROM payment_attempts a JOIN purchase_orders o ON o.id=a.purchase_order_id
        WHERE a.purchase_order_id=$1 AND o.user_id=$2 ORDER BY a.first_seen_at DESC LIMIT 20`,
      [req.params.id, req.user.user_id])
    res.json({ attempts: rows })
  }))

  /* 4c — DePay server callback (hint only; see recordPaymentHint) */
  router.post('/purchases/depay/callback', wrap(async (req, res) => {
    const key = process.env.DEPAY_CALLBACK_PUBLIC_KEY
    if (!key || !paymentEnabled()) throw fail(404, 'not_found')
    if (!req.rawBody || !verifyDepaySignature(req.rawBody, req.headers['x-signature'], key.replace(/\\n/g, '\n'))) throw fail(401, 'invalid_signature')
    const out = await recordPaymentHint(pool, req.body)
    res.json({ ok: true, recorded: out.recorded })
  }))

  /* 5 — cancel a pending order */
  router.post('/purchases/orders/:id/cancel', requireAuth, wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'order_not_found')
    const { rows } = await pool.query(
      `UPDATE purchase_orders SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status='pending' RETURNING id`,
      [req.params.id, req.user.user_id])
    if (!rows[0]) throw fail(409, 'order_not_cancellable')
    await audit('purchase_order_cancelled', req.user.user_id, req, { orderId: req.params.id })
    res.json({ ok: true })
  }))

  /* 6 — purchase + payment history + invoices (session-scoped) */
  router.get('/purchases/history', requireAuth, wrap(async (req, res) => {
    const orders = (await pool.query(
      `SELECT o.id, o.status, o.account_size_usd, o.price_usd, o.currency, o.created_at, o.paid_at,
              p.slug AS plan_slug, p.name AS plan_name,
              (SELECT json_build_object('txHash', pm.tx_hash, 'chainId', pm.chain_id, 'verifiedAt', pm.verified_at)
                 FROM payments pm WHERE pm.purchase_order_id=o.id LIMIT 1) AS payment,
              (SELECT json_build_object('id', i.id, 'number', i.number, 'issuedAt', i.issued_at)
                 FROM invoices i WHERE i.purchase_order_id=o.id LIMIT 1) AS invoice,
              (SELECT c.id FROM openfund_challenges c WHERE c.purchase_order_id=o.id LIMIT 1) AS challenge_id
         FROM purchase_orders o JOIN challenge_plans p ON p.id=o.challenge_plan_id
        WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 100`, [req.user.user_id])).rows
    res.json({ orders })
  }))

  /* 7 — invoice (PDF download or JSON) */
  router.get('/invoices/:id', requireAuth, wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'invoice_not_found')
    const { rows: [inv] } = await pool.query(
      `SELECT i.id, i.number, i.total_usd, i.issued_at, i.purchase_order_id,
              u.wallet_address, u.display_name, p.name AS plan_name, o.account_size_usd, o.status AS order_status
         FROM invoices i
         JOIN openfund_users u ON u.id=i.user_id
         JOIN purchase_orders o ON o.id=i.purchase_order_id
         JOIN challenge_plans p ON p.id=o.challenge_plan_id
        WHERE i.id=$1 AND i.user_id=$2`, [req.params.id, req.user.user_id])
    if (!inv) throw fail(404, 'invoice_not_found')
    if (req.query.format === 'json') return res.json({
      id: inv.id, number: inv.number, totalUsd: inv.total_usd, issuedAt: inv.issued_at,
      purchaseOrderId: inv.purchase_order_id, planName: inv.plan_name, accountSizeUsd: inv.account_size_usd,
    })
    const pdf = invoicePdf({
      number: inv.number, issuedAt: inv.issued_at, walletAddress: inv.wallet_address,
      displayName: inv.display_name, planName: inv.plan_name,
      accountSizeUsd: inv.account_size_usd, priceUsd: inv.total_usd, orderId: inv.purchase_order_id,
    })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="openfund-invoice-${inv.number}.pdf"`)
    res.setHeader('Cache-Control', 'no-store')
    res.end(pdf)
  }))

  /* 8 — withdrawals + reward history (requests only; no automatic payout) */
  router.get('/withdrawals', requireAuth, wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT w.id, w.amount_usd, w.status, w.note, w.requested_at, w.reviewed_at, w.payout_ref,
              c.id AS challenge_id, p.name AS plan_name
         FROM withdrawal_requests w
         LEFT JOIN openfund_challenges c ON c.id=w.challenge_id
         LEFT JOIN challenge_plans p ON p.id=c.challenge_plan_id
        WHERE w.user_id=$1 ORDER BY w.requested_at DESC LIMIT 100`, [req.user.user_id])
    res.json({ withdrawals: rows })
  }))

  router.post('/withdrawals', requireAuth, wrap(async (req, res) => {
    const { amountUsd, challengeId, note } = req.body || {}
    const amount = Number(amountUsd)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) throw fail(400, 'invalid_amount')
    if (note != null && (typeof note !== 'string' || note.length > 500)) throw fail(400, 'invalid_note')
    let challenge = null
    if (challengeId) {
      if (!uuid.test(challengeId)) throw fail(400, 'invalid_challenge')
      challenge = (await pool.query(
        `SELECT id FROM openfund_challenges WHERE id=$1 AND user_id=$2`, [challengeId, req.user.user_id])).rows[0]
      if (!challenge) throw fail(404, 'challenge_not_found')
    }
    const { rows: [w] } = await pool.query(
      `INSERT INTO withdrawal_requests (user_id, challenge_id, amount_usd, note)
       VALUES ($1,$2,$3,$4) RETURNING id, requested_at`,
      [req.user.user_id, challenge ? challenge.id : null, amount.toFixed(2), note || null])
    await audit('withdrawal_requested', req.user.user_id, req, { withdrawalId: w.id, amount })
    res.json({ id: w.id, requestedAt: w.requested_at, status: 'requested' })
  }))

  router.post('/withdrawals/:id/cancel', requireAuth, wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'withdrawal_not_found')
    const { rows } = await pool.query(
      `UPDATE withdrawal_requests SET status='cancelled', reviewed_at=now()
        WHERE id=$1 AND user_id=$2 AND status='requested' RETURNING id`, [req.params.id, req.user.user_id])
    if (!rows[0]) throw fail(409, 'withdrawal_not_cancellable')
    await audit('withdrawal_cancelled', req.user.user_id, req, { withdrawalId: req.params.id })
    res.json({ ok: true })
  }))

  return router
}
