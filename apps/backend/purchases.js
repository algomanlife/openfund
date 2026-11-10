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
import { createRpcVerifier, DEPAY_BLOCKCHAINS, SOLANA_CHAIN_ID, blockchainOf, isEvmChain, normalizeTxId } from './payment-verification.js'
import { createSolanaVerifier } from './solana-verification.js'
import { evaluateCoupon, applyCoupon, isCouponCode, normalizeCode } from './coupons.js'

/* Wallet AUTHENTICATION is Arbitrum One only (server.js AUTH_CHAINS). PAYMENT
   is independent of the auth chain: every chain configured below is offered
   through DePay (with DePay's token conversion) and verified on its own chain. */

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const csv = v => String(v || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
const isProd = () => process.env.NODE_ENV === 'production'
const parseJson = (raw, name) => {
  if (!raw) return null
  try { return JSON.parse(raw) } catch { console.error(`[purchases] ${name} is not valid JSON — ignored`); return null }
}
const minConfirmationsDefault = () =>
  process.env.PURCHASE_PAYMENT_MIN_CONFIRMATIONS !== undefined && process.env.PURCHASE_PAYMENT_MIN_CONFIRMATIONS !== ''
    ? Number(process.env.PURCHASE_PAYMENT_MIN_CONFIRMATIONS) || 0
    : (isProd() ? 12 : 0)

/**
 * Accepted payment chains. Each entry names where the merchant SETTLES:
 * { blockchain | chainId, token (settlement token / SPL mint), receiver,
 *   tokenDecimals?, routers?, minConfirmations? } — public values, from
 * PURCHASE_PAYMENT_CHAINS (JSON). Dedicated RPC endpoints (secrets) come from
 * PURCHASE_RPC_URLS (JSON keyed by chain id or DePay blockchain name).
 * Without PURCHASE_PAYMENT_CHAINS the legacy single-chain variables
 * (PURCHASE_PAYMENT_RECEIVER / _CHAIN / _TOKEN / _DECIMALS,
 * PURCHASE_RPC_URL, PURCHASE_ROUTER_ADDRESSES) define one chain.
 */
export function paymentChains() {
  const rpcs = parseJson(process.env.PURCHASE_RPC_URLS, 'PURCHASE_RPC_URLS') || {}
  const list = parseJson(process.env.PURCHASE_PAYMENT_CHAINS, 'PURCHASE_PAYMENT_CHAINS')
  const out = []
  if (Array.isArray(list)) {
    for (const c of list) {
      const chainId = Number(c?.chainId ?? DEPAY_BLOCKCHAINS[String(c?.blockchain || '').toLowerCase()])
      const solana = chainId === SOLANA_CHAIN_ID
      if (!isEvmChain(chainId) && !solana) { console.error(`[purchases] unsupported payment chain ${c?.chainId ?? c?.blockchain} — ignored`); continue }
      out.push({
        chainId, blockchain: blockchainOf(chainId), solana,
        /* EVM addresses are case-insensitive; Solana base58 keys are not */
        receiver: c.receiver ? (solana ? String(c.receiver) : String(c.receiver).toLowerCase()) : null,
        token: c.token ? (solana ? String(c.token) : String(c.token).toLowerCase()) : null,
        tokenDecimals: c.tokenDecimals == null || c.tokenDecimals === '' ? null : Number(c.tokenDecimals),
        routers: (Array.isArray(c.routers) ? c.routers : csv(c.routers)).map(r => String(r).toLowerCase()),
        minConfirmations: c.minConfirmations == null ? minConfirmationsDefault() : Number(c.minConfirmations) || 0,
        rpcUrl: rpcs[chainId] || rpcs[blockchainOf(chainId)] || null,
      })
    }
    return out
  }
  const token = (process.env.PURCHASE_PAYMENT_TOKEN || '').toLowerCase() || null
  const chainId = Number(process.env.PURCHASE_PAYMENT_CHAIN || 42161)
  return [{
    chainId, blockchain: blockchainOf(chainId), solana: false,
    receiver: (process.env.PURCHASE_PAYMENT_RECEIVER || '').toLowerCase() || null,
    token,
    /* when unset the token's decimals are read from the contract; when set
       they must MATCH the contract (a mismatch fails closed) */
    tokenDecimals: process.env.PURCHASE_PAYMENT_DECIMALS === undefined || process.env.PURCHASE_PAYMENT_DECIMALS === ''
      ? null : Number(process.env.PURCHASE_PAYMENT_DECIMALS),
    routers: csv(process.env.PURCHASE_ROUTER_ADDRESSES),
    minConfirmations: minConfirmationsDefault(),
    rpcUrl: process.env.PURCHASE_RPC_URL || rpcs[chainId] || null,
  }]
}

/** one chain is usable when its settlement destination is complete and safe */
export const chainReady = c => {
  if (!c || !c.receiver || !(isEvmChain(c.chainId) || c.solana)) return false
  if (c.solana) return !!(c.token && (c.rpcUrl || !isProd()))
  if (isProd()) return !!(c.token && c.rpcUrl)
  return true
}

/** legacy single-chain view (first configured chain) + the full chain list */
export const cfg = () => {
  const chains = paymentChains()
  const primary = chains.find(chainReady) || chains[0] || {}
  return {
    ...primary,
    chains,
    readyChains: chains.filter(chainReady),
    /* late-payment grace: a transaction mined within this many minutes
       after order expiry still pays the order (money received is never
       silently dropped; outside the window → manual reconciliation) */
    lateGraceMinutes: Number(process.env.PURCHASE_LATE_GRACE_MINUTES ?? 60) || 0,
    /* native value is never converted to USD: only non-production test
       chains without an approved token may use it */
    allowNative: !isProd() && !primary.token,
  }
}
export const chainConfig = chainId => paymentChains().find(c => c.chainId === Number(chainId) && chainReady(c)) || null

/** payments are offered when at least one chain is completely configured;
 *  with an argument, reports whether that one chain configuration is usable */
export function paymentsReady(c = null) {
  return c ? chainReady(c) : paymentChains().some(chainReady)
}

const fail = (status, error) => {
  const e = new Error(error)
  e.status = status
  return e
}
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

/* ---------- provisioning: one transaction, exactly once ---------- */
export async function confirmPurchase(pool, args) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await confirmPurchaseTx(client, args)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

/**
 * The provisioning transaction body (caller owns BEGIN/COMMIT). One commit
 * moves the order awaiting → paid → provisioned (lifecycle trigger), writes
 * the payment (absent for a zero-payment coupon order), the challenge, the
 * invoice, the coupon consumption and the commission decision — or nothing.
 * `evidence` is null only for zero-payment orders (payment_required=false).
 */
export async function confirmPurchaseTx(client, { orderId, userId, evidence, source }) {
  {
    await client.query(`SELECT set_config('openfund.actor', $1, true), set_config('openfund.reason', $2, true)`,
      [`system:${source}`, evidence?.txHash ? `payment:${evidence.chainId}:${evidence.txHash}` : source])
    const order = (await client.query('SELECT * FROM purchase_orders WHERE id=$1 FOR UPDATE', [orderId])).rows[0]
    if (!order || order.user_id !== userId) throw fail(404, 'order_not_found')
    if (order.status === 'paid') {
      /* idempotent replay: return the already-provisioned result */
      const payment = (await client.query('SELECT id, tx_hash FROM payments WHERE purchase_order_id=$1', [orderId])).rows[0]
      const invoice = (await client.query('SELECT id, number FROM invoices WHERE purchase_order_id=$1', [orderId])).rows[0]
      const challenge = (await client.query('SELECT id FROM openfund_challenges WHERE purchase_order_id=$1', [orderId])).rows[0]
      return { replayed: true, orderId, paymentId: payment?.id, invoiceId: invoice?.id, invoiceNumber: invoice?.number, challengeId: challenge?.id }
    }
    if (order.status !== 'pending' && order.status !== 'expired') throw fail(409, 'order_not_pending')
    const zeroPayment = order.payment_required === false
    if (zeroPayment !== !evidence) throw fail(409, zeroPayment ? 'zero_payment_order' : 'payment_evidence_required')
    if (zeroPayment && order.status !== 'pending') throw fail(409, 'order_not_pending')
    /* late-payment policy: an expired order still accepts an on-chain
       payment whose block was mined within the grace window AFTER
       expiry — money received is never silently dropped. Outside the
       window → explicit 409 for manual reconciliation (refund path). */
    if (!zeroPayment && (order.status === 'expired' || (order.expires_at && order.expires_at < new Date()))) {
      const graceMs = cfg().lateGraceMinutes * 60_000
      const minedAt = evidence.blockTimestamp ? new Date(evidence.blockTimestamp).getTime() : NaN
      if (!Number.isFinite(minedAt) || minedAt > new Date(order.expires_at).getTime() + graceMs)
        throw fail(409, 'order_expired')
    }

    let payment = null
    if (!zeroPayment) {
    const dup = (await client.query('SELECT purchase_order_id FROM payments WHERE chain_id=$1 AND tx_hash=$2', [evidence.chainId, evidence.txHash])).rows[0]
    if (dup && dup.purchase_order_id !== orderId) throw fail(409, 'tx_already_used')

    payment = (await client.query(
      /* settlement (verified on-chain: chain, token, receiver, amount in base
         units) is kept apart from what DePay reported about the payer's side
         (source token/amount — unverified, accounting reference only) */
      `INSERT INTO payments (purchase_order_id, user_id, tx_hash, chain_id, blockchain, block_number, from_address, to_address, amount, token_address,
                             source_token, source_amount, status, verification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'confirmed',$13) RETURNING id`,
      [orderId, userId, evidence.txHash, evidence.chainId, evidence.blockchain ?? null, evidence.blockNumber ?? null,
        evidence.fromAddress, evidence.toAddress ?? null, evidence.amount ?? null,
        evidence.tokenAddress ?? null, evidence.reported?.token ?? null, evidence.reported?.amount ?? null,
        JSON.stringify({ ...evidence, source })])).rows[0]
    }

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
      /* a zero-payment order has no confirmed payment, so it earns no
         commission (recognizeCommissionTx records 'zero_amount') */
      await recognizeCommissionTx(client, { orderId, userId, paymentId: payment?.id ?? null, payerAddress: evidence?.fromAddress ?? null })
      await client.query('RELEASE SAVEPOINT ambassador_commission')
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT ambassador_commission')
      await client.query(`INSERT INTO financial_audit_log (actor, action, entity, entity_id, after) VALUES ('system','commission_recognition_error','purchase_order',$1,$2)`,
        [orderId, JSON.stringify({ error: String(e.message).slice(0, 200) })])
    }

    await client.query(
      `INSERT INTO trading_events (account_id, kind, detail) SELECT id,'challenge_provisioned',$2 FROM demo_accounts WHERE user_id=$1 AND account_type='free_demo'`,
      [userId, JSON.stringify({ challengeId: challenge.id, orderId, source })]).catch(() => {})

    return { replayed: false, orderId, paymentId: payment?.id ?? null, invoiceId: invoice.id, invoiceNumber: invoice.number, challengeId: challenge.id, zeroPayment }
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

/* one verifier per network family, each with the chain's dedicated RPC */
let defaultVerifier = null
export function defaultPaymentVerifier() {
  if (defaultVerifier) return defaultVerifier
  const chains = paymentChains()
  const rpcUrls = Object.fromEntries(chains.filter(c => c.rpcUrl && !c.solana).map(c => [c.chainId, c.rpcUrl]))
  const evm = createRpcVerifier({ rpcUrl: process.env.PURCHASE_RPC_URL || null, rpcUrls })
  const sol = chains.find(c => c.solana)
  const solana = createSolanaVerifier({ rpcUrl: sol?.rpcUrl || null })
  return (defaultVerifier = (txId, expect) => (expect.chainId === SOLANA_CHAIN_ID ? solana : evm)(txId, expect))
}

async function startAttempt(pool, { orderId, userId, chainId, txHash, attested = false, reported = null }) {
  const { rows: [a] } = await pool.query(
    `INSERT INTO payment_attempts (purchase_order_id, user_id, chain_id, tx_hash, attested, reported)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (purchase_order_id, chain_id, tx_hash)
     DO UPDATE SET attempts = payment_attempts.attempts + 1, last_attempt_at = now(),
                   attested = payment_attempts.attested OR EXCLUDED.attested,
                   reported = coalesce(payment_attempts.reported, EXCLUDED.reported)
       WHERE payment_attempts.status <> 'confirmed'
     RETURNING id`, [orderId, userId, chainId, txHash, attested, reported && JSON.stringify(reported)])
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
 * Verify a payment for an order on ITS chain and provision exactly once.
 * Shared by the customer route, DePay callbacks/events, the recovery sweep
 * and operator re-verify. The chain verifier is authoritative; the frontend
 * never confirms payment.
 *  - chainId: the chain the payment was made on (default: primary chain);
 *  - attested: DePay signed a delivery binding this transaction to this
 *    order id, so the payer may use any wallet (requireSender off); a
 *    customer-submitted hash must come from the customer's own wallet;
 *  - reported: DePay's reported source token/amount/sender — recorded for
 *    settlement accounting, never trusted for the verdict.
 */
export async function verifyAndConfirm({ pool, verifier, order, userId, walletAddress, txHash, source, chainId = null, attested = false, reported = null }) {
  const c = chainConfig(chainId ?? cfg().chainId)
  if (!c) throw Object.assign(fail(400, 'unsupported_chain'), { isPaymentError: true })
  const txId = normalizeTxId(c.chainId, txHash)
  if (!txId) throw fail(400, 'invalid_request')
  const attemptId = await startAttempt(pool, { orderId: order.id, userId, chainId: c.chainId, txHash: txId, attested, reported })
  try {
    const verdict = await verifier(txId, {
      chainId: c.chainId, receiver: c.receiver, token: c.token, tokenDecimals: c.tokenDecimals,
      priceUsd: String(order.price_usd), routers: c.routers, allowNative: !isProd() && !c.token && !c.solana,
      from: walletAddress, requireSender: !attested, notBefore: new Date(order.created_at).getTime() - 5 * 60_000,
      minConfirmations: c.minConfirmations,
    })
    const evidence = { ...verdict, blockchain: c.blockchain, reported: reported || undefined }
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
 * registers the reported transaction as a retryable attempt for the order
 * named in the signed payload. The chain verifier then proves the payment;
 * nothing in the callback body (amount, token, receiver, success) is trusted.
 */
export function verifyDepaySignature(rawBody, signature, publicKeyPem) {
  /* DePay signs with RSA-PSS / SHA-256 / MGF1-SHA-256, salt length 64,
     base64url (https://depay.com/docs/payments/integrate/button/). The
     salt length is recovered from the signature (DePay's own reference
     verifiers accept any salt length); the key and digest are fixed. */
  if (!rawBody || !signature || !publicKeyPem) return false
  try {
    return crypto.verify('sha256', rawBody, { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_AUTO },
      Buffer.from(String(signature), 'base64url'))
  } catch { return false }
}
/** the DePay "Verify" public key (DEPAY_VERIFY_PUBLIC_KEY; the older name
 *  DEPAY_CALLBACK_PUBLIC_KEY is still read for compatibility) */
export const depayVerifyKey = () => pem(process.env.DEPAY_VERIFY_PUBLIC_KEY || process.env.DEPAY_CALLBACK_PUBLIC_KEY || '')
const lower = v => String(v || '').toLowerCase()
const chainOfDelivery = body => DEPAY_BLOCKCHAINS[lower(body?.blockchain)] ?? null

/** Compare a signed DePay delivery with the server configuration. The body is
 *  never trusted for payment; a mismatch is recorded for review. The reported
 *  token is NOT compared: with DePay's conversion it may be the payer's
 *  source token, while the verifier checks the settlement token on-chain. */
export function depayBodyMismatch(body) {
  const chainId = chainOfDelivery(body)
  const c = chainId == null ? null : chainConfig(chainId)
  if (!c) return 'unsupported_chain'
  const rec = c.solana ? String(body?.receiver || '') : lower(body?.receiver)
  if (body?.receiver && rec !== c.receiver) return 'wrong_receiver'
  return null
}

/** append-only record of a signed DePay callback/event (retries dedupe on
 *  the exact body hash); returns false when this delivery was seen before */
export async function recordDepayDelivery(pool, { kind, rawBody, body, orderId = null, outcome }) {
  const solana = lower(body?.blockchain) === 'solana'
  const keep = v => (solana ? String(v || '') : lower(v))
  const { rowCount } = await pool.query(
    `INSERT INTO depay_events (kind, status, body_sha256, blockchain, tx_hash, sender, receiver, token, amount, purchase_order_id, outcome, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (body_sha256) DO NOTHING`,
    [kind, kind === 'event' ? String(body?.status || '').slice(0, 20) || null : null,
      crypto.createHash('sha256').update(rawBody).digest('hex'),
      lower(body?.blockchain).slice(0, 30) || null, keep(body?.transaction).slice(0, 100) || null,
      keep(body?.sender).slice(0, 60) || null, keep(body?.receiver).slice(0, 60) || null,
      keep(body?.token).slice(0, 60) || null, String(body?.amount ?? '').slice(0, 60) || null,
      orderId, outcome, JSON.stringify(body ?? {})])
  return rowCount === 1
}

/**
 * Register a DePay-reported transaction for verification. The order is
 * identified ONLY by the order id in the signed payload (which originated in
 * our signed configuration) — never by the paying wallet, which may be any
 * wallet on any supported chain.
 */
export async function recordPaymentHint(pool, body) {
  const chainId = chainOfDelivery(body)
  const c = chainId == null ? null : chainConfig(chainId)
  if (!c) return { recorded: false, reason: 'unsupported_chain' }
  const tx = normalizeTxId(c.chainId, body?.transaction)
  if (!tx) return { recorded: false, reason: 'invalid_payload' }
  const wanted = body?.payload?.orderId
  if (!uuid.test(String(wanted || ''))) return { recorded: false, reason: 'missing_order_id' }
  const order = (await pool.query(
    `SELECT id, user_id FROM purchase_orders WHERE id=$1 AND status IN ('pending','expired') AND payment_required
        AND created_at > now() - interval '24 hours'`, [wanted])).rows[0]
  if (!order) return { recorded: false, reason: 'no_open_order' }
  const keep = v => (c.solana ? String(v || '') : lower(v))
  const reported = { blockchain: c.blockchain, sender: keep(body?.sender) || null, token: keep(body?.token) || null,
    amount: body?.amount == null ? null : String(body.amount).slice(0, 60), receiver: keep(body?.receiver) || null }
  await pool.query(
    `INSERT INTO payment_attempts (purchase_order_id, user_id, chain_id, tx_hash, status, retryable, attested, reported, detail)
     VALUES ($1,$2,$3,$4,'pending',true,true,$5,$6) ON CONFLICT (purchase_order_id, chain_id, tx_hash) DO NOTHING`,
    [order.id, order.user_id, c.chainId, tx, JSON.stringify(reported), JSON.stringify({ source: body?.status ? 'depay_event' : 'depay_callback' })])
  await markPaymentDetected(pool, order.id, `depay:${c.blockchain}:${tx}`)
  return { recorded: true, orderId: order.id, userId: order.user_id, txHash: tx, chainId: c.chainId, reported }
}

/** awaiting_payment / expired → payment_detected (a hint only: the order is
 *  still unpaid until the chain verifier confirms it) */
export async function markPaymentDetected(pool, orderId, reason) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('openfund.actor','system:payment_hint',true), set_config('openfund.reason',$1,true)`, [String(reason).slice(0, 200)])
    await client.query(`UPDATE purchase_orders SET lifecycle_state='payment_detected'
                         WHERE id=$1 AND lifecycle_state IN ('awaiting_payment','expired')`, [orderId])
    await client.query('COMMIT')
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
}

/**
 * DePay dynamic configuration. DePay POSTs the button payload ({ orderId })
 * to our endpoint and expects the accepted payment back, signed with OUR key,
 * within two seconds: one `accept` entry per configured settlement chain
 * (blockchain, token, receiver, amount). The payer may choose any of these
 * chains and pay with another token there — DePay converts it into the
 * settlement token. Everything comes from the server-held order and
 * configuration; nothing secret is returned (receivers are public).
 */
export async function buildDepayConfiguration(pool, orderId) {
  if (!uuid.test(orderId || '')) throw fail(400, 'invalid_order')
  const chains = cfg().readyChains.filter(c => c.token && c.receiver && c.blockchain)
  if (!chains.length) throw fail(409, 'depay_unsupported_configuration')
  /* the payable amount is the order's server-side NET price (plan price of
     record minus a validated coupon, frozen at order creation); a
     zero-payment order is never sent to DePay */
  const order = (await pool.query(`SELECT status, lifecycle_state, price_usd, payment_required, expires_at FROM purchase_orders WHERE id=$1`, [orderId])).rows[0]
  if (!order) throw fail(404, 'order_not_found')
  if (!order.payment_required || Number(order.price_usd) <= 0) throw fail(409, 'order_not_payable')
  if (order.status !== 'pending' || !['awaiting_payment', 'payment_detected'].includes(order.lifecycle_state)
      || (order.expires_at && new Date(order.expires_at) < new Date())) throw fail(409, 'order_not_payable')
  /* DePay's documented format: human-readable amount (a JSON number) of the
     settlement token, priced 1:1 to USD (approved USD stablecoins only) */
  return { accept: chains.map(c => ({ blockchain: c.blockchain, amount: Number(order.price_usd), token: c.token, receiver: c.receiver })) }
}
export function signDepayConfiguration(json, privateKeyPem) {
  /* RSA-PSS / SHA-256 / salt 64, base64url without padding (DePay docs) */
  return crypto.sign('sha256', Buffer.from(json), { key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 }).toString('base64url')
}
function pem(v) { return String(v || '').replace(/\\n/g, '\n') }

/** background recovery: re-verify attempts stuck on a retryable condition, on their own chain */
export async function recoverPendingPayments({ pool, verifier = defaultPaymentVerifier(), limit = 20, minAgeSeconds = 45, log = () => {} }) {
  const { rows } = await pool.query(
    `SELECT a.tx_hash, a.chain_id, a.attested, a.reported, o.id AS order_id, o.price_usd, o.created_at, o.user_id, u.wallet_address
       FROM payment_attempts a
       JOIN purchase_orders o ON o.id = a.purchase_order_id
       JOIN openfund_users u ON u.id = a.user_id
      WHERE a.status='pending' AND a.retryable
        AND a.first_seen_at > now() - interval '24 hours'
        AND a.last_attempt_at < now() - make_interval(secs => $2)
        AND o.status IN ('pending','expired') AND o.payment_required
      ORDER BY a.last_attempt_at LIMIT $1`, [limit, minAgeSeconds])
  let recovered = 0
  for (const r of rows) {
    try {
      await verifyAndConfirm({ pool, verifier, order: { id: r.order_id, price_usd: r.price_usd, created_at: r.created_at },
        userId: r.user_id, walletAddress: r.wallet_address, txHash: r.tx_hash, source: 'recovery',
        chainId: r.chain_id, attested: r.attested, reported: r.reported })
      recovered++
    } catch (e) { log(r.order_id, e.message) }
  }
  return { checked: rows.length, recovered }
}

/* ---------- routes ---------- */
export function purchaseRoutes({ pool, requireAuth, audit, verifier = null, limit = () => (req, res, next) => next() }) {
  const chainVerifier = () => verifier || defaultPaymentVerifier()
  const router = Router()

  const paymentEnabled = () => paymentsReady()

  const orderView = async (id, userId) => {
    const { rows } = await pool.query(
      `SELECT o.id, o.status, o.lifecycle_state, o.account_size_usd, o.list_price_usd, o.discount_usd, o.price_usd,
              o.payment_required, o.payment_method, o.currency, o.created_at, o.expires_at, o.paid_at,
              p.slug AS plan_slug, p.name AS plan_name, c.code AS coupon_code
         FROM purchase_orders o JOIN challenge_plans p ON p.id=o.challenge_plan_id
         LEFT JOIN coupons c ON c.id=o.coupon_id
        WHERE o.id=$1 AND o.user_id=$2`, [id, userId])
    return rows[0] || null
  }

  const publicChain = c => ({ chainId: c.chainId, blockchain: c.blockchain, receiver: c.receiver, token: c.token, tokenDecimals: c.tokenDecimals, routers: c.routers })
  const paymentInstructions = order => {
    const c = cfg()
    if (!c.receiver || !order || order.payment_required === false) return null
    return {
      chainId: c.chainId,
      receiver: c.receiver,
      token: c.token,
      amount: String(order.price_usd),
      reference: order.id,
      /* every settlement chain DePay may offer (payment is NOT tied to the
         Arbitrum authentication chain) */
      chains: c.readyChains.map(publicChain),
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
        /* per-locale display names (the catalog `name` is the bilingual "fa — en" label) */
        names: c.name && typeof c.name === 'object' ? { en: c.name.en || null, fa: c.name.fa || null } : null,
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
        ? { ...publicChain(c), chains: c.readyChains.map(publicChain) }
        : null,
    })
  }))

  /* server-side pricing of record for one plan + size (never the browser's) */
  const planPrice = async (q, planSlug, accountSize) => {
    if (typeof planSlug !== 'string' || !Number.isFinite(Number(accountSize))) throw fail(400, 'invalid_request')
    const { rows: [plan] } = await q.query(
      `SELECT id, slug, configuration FROM challenge_plans WHERE slug=$1 AND status='active'`, [planSlug])
    if (!plan) throw fail(404, 'plan_not_found')
    const c = plan.configuration || {}
    if (c.free) throw fail(400, 'not_purchasable')
    const size = Number(accountSize)
    if (!(c.accountSizesUsd || []).includes(size)) throw fail(400, 'invalid_account_size')
    const price = c.priceUsd && c.priceUsd[size]
    if (!Number.isFinite(Number(price)) || Number(price) <= 0) throw fail(400, 'not_purchasable')
    return { plan, size, listPrice: Number(price).toFixed(2) }
  }
  const couponArg = v => {
    if (v == null || v === '') return null
    if (!isCouponCode(v)) throw fail(400, 'coupon_invalid')
    return normalizeCode(v)
  }

  /* 2a — authoritative quote (plan price + optional coupon); creates nothing */
  router.post('/purchases/quote', requireAuth, limit(30), wrap(async (req, res) => {
    const { planSlug, accountSize, couponCode } = req.body || {}
    const { plan, size, listPrice } = await planPrice(pool, planSlug, accountSize)
    const code = couponArg(couponCode)
    const pricing = code
      ? (await evaluateCoupon(pool, { code, userId: req.user.user_id, planId: plan.id, accountSize: size, listPriceUsd: listPrice })).pricing
      : applyCoupon(listPrice, null)
    res.json({ planSlug, accountSize: size, listPriceUsd: pricing.list, discountUsd: pricing.discount, priceUsd: pricing.net,
      couponCode: code, paymentRequired: Number(pricing.net) > 0, paymentsEnabled: paymentEnabled() })
  }))

  /* 2 — create an order (server-priced snapshot; idempotent; coupon
     reservation race-safe under the coupon row lock). A 100% discount is
     provisioned here, in the same transaction, without any payment. */
  router.post('/purchases/orders', requireAuth, limit(30), wrap(async (req, res) => {
    const { planSlug, accountSize, idempotencyKey, couponCode } = req.body || {}
    const key = typeof idempotencyKey === 'string' && idempotencyKey.length <= 120 ? idempotencyKey : null
    const code = couponArg(couponCode)

    const replay = async () => {
      if (!key) return null
      const existing = (await pool.query(
        `SELECT o.id FROM purchase_orders o WHERE o.user_id=$1 AND o.idempotency_key=$2`, [req.user.user_id, key])).rows[0]
      if (!existing) return null
      const view = await orderView(existing.id, req.user.user_id)
      const result = view.lifecycle_state === 'provisioned' && view.payment_required === false
        ? await confirmPurchase(pool, { orderId: view.id, userId: req.user.user_id, evidence: null, source: 'zero_payment' }) : undefined
      return { order: view, payment: paymentInstructions(view), ...(result ? { result } : {}) }
    }
    const prior = await replay()
    if (prior) return res.json(prior)

    /* an un-attributed account that has never paid may be attributed to an
       approved ambassador's link before its first order is created */
    await attributeAtFirstOrder(pool, req, req.user.user_id)

    const client = await pool.connect()
    let orderId, result = null, created = null, conflict = false
    try {
      await client.query('BEGIN')
      const { plan, size, listPrice } = await planPrice(client, planSlug, accountSize)
      let coupon = null, pricing = applyCoupon(listPrice, null)
      if (code) ({ coupon, pricing } = await evaluateCoupon(client, {
        code, userId: req.user.user_id, planId: plan.id, accountSize: size, listPriceUsd: listPrice, lock: true }))
      const zero = Number(pricing.net) === 0
      /* paid orders need a complete payment configuration; zero-payment
         orders need only a valid coupon */
      if (!zero && !paymentEnabled()) throw fail(403, 'purchases_disabled')
      await client.query(`SELECT set_config('openfund.actor', $1, true), set_config('openfund.reason', $2, true)`,
        [`user:${req.user.user_id}`, coupon ? `coupon:${coupon.code}` : 'order_created'])
      const ins = await client.query(
        `INSERT INTO purchase_orders (user_id, challenge_plan_id, account_size_usd, list_price_usd, discount_usd, price_usd,
                                      coupon_id, payment_required, payment_method, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (user_id, idempotency_key) DO NOTHING RETURNING id`,
        [req.user.user_id, plan.id, size.toFixed(2), pricing.list, pricing.discount, pricing.net, coupon?.id ?? null, !zero,
          /* payment method of record: a 100% coupon order has no payment; an
             internal test coupon is recorded as such */
          zero ? (coupon.internal ? 'internal_coupon' : 'coupon') : 'crypto', key])
      if (!ins.rows[0]) conflict = true /* same idempotency key committed concurrently */
      else {
      orderId = ins.rows[0].id
      if (coupon) await client.query(
        `INSERT INTO coupon_redemptions (coupon_id, user_id, purchase_order_id, list_price_usd, discount_usd, net_price_usd)
         VALUES ($1,$2,$3,$4,$5,$6)`, [coupon.id, req.user.user_id, orderId, pricing.list, pricing.discount, pricing.net])
      if (zero) result = await confirmPurchaseTx(client, { orderId, userId: req.user.user_id, evidence: null, source: 'zero_payment' })
      created = { planSlug, size, listPrice: pricing.list, discount: pricing.discount, price: pricing.net, coupon: coupon?.code ?? null }
      }
      await client.query(conflict ? 'ROLLBACK' : 'COMMIT')
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      throw e
    } finally { client.release() }
    if (conflict) return res.json(await replay())
    await audit('purchase_order_created', req.user.user_id, req, { orderId, ...created })
    if (result) await audit('purchase_zero_payment_provisioned', req.user.user_id, req, { orderId, challengeId: result.challengeId, coupon: created.coupon })
    const view = await orderView(orderId, req.user.user_id)
    res.json({ order: view, payment: paymentInstructions(view), ...(result ? { result } : {}) })
  }))

  /* 2c — explicit lifecycle history of one order (customer-scoped) */
  router.get('/purchases/orders/:id/events', requireAuth, wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'order_not_found')
    const { rows } = await pool.query(
      `SELECT e.from_state, e.to_state, e.created_at FROM purchase_order_events e JOIN purchase_orders o ON o.id=e.purchase_order_id
        WHERE e.purchase_order_id=$1 AND o.user_id=$2 ORDER BY e.id`, [req.params.id, req.user.user_id])
    res.json({ events: rows })
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
    const chainId = req.body?.chainId == null ? cfg().chainId : Number(req.body.chainId)
    /* a customer-submitted hash is checked against the customer's own wallet,
       so only EVM chains apply here; other payments arrive via DePay */
    if (!isEvmChain(chainId) || !chainConfig(chainId)) throw fail(400, 'unsupported_chain')
    if (!uuid.test(orderId || '') || !normalizeTxId(chainId, txHash)) throw fail(400, 'invalid_request')
    const order = await orderView(orderId, req.user.user_id)
    if (!order) throw fail(404, 'order_not_found')
    if (order.payment_required === false) throw fail(409, 'zero_payment_order')
    if (order.status === 'paid') return res.json(await confirmPurchase(pool, { orderId, userId: req.user.user_id, evidence: { txHash: normalizeTxId(chainId, txHash), chainId }, source: 'replay' }))
    if (order.status !== 'pending' && order.status !== 'expired') throw fail(409, 'order_not_pending')
    /* NOTE: expiry is NOT rejected here — the on-chain evidence is
       verified first, then confirmPurchase applies the late-payment
       grace policy (money received inside the window is never dropped) */
    const raw = (await pool.query('SELECT price_usd, created_at FROM purchase_orders WHERE id=$1', [orderId])).rows[0]
    try {
      const result = await verifyAndConfirm({
        pool, verifier: chainVerifier(), order: { id: orderId, price_usd: raw.price_usd, created_at: raw.created_at },
        userId: req.user.user_id, walletAddress: req.user.wallet_address, txHash, source: 'onchain', chainId,
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

  /* 4c — DePay dynamic configuration (called by DePay when the widget opens) */
  router.post('/purchases/depay/configuration', wrap(async (req, res) => {
    const key = pem(process.env.DEPAY_CONFIG_PRIVATE_KEY)
    const verifyKey = depayVerifyKey()
    if (!key || !verifyKey || !paymentEnabled()) throw fail(404, 'not_found')
    /* DePay signs every request it sends (x-signature over the raw body) */
    if (!verifyDepaySignature(req.rawBody, req.headers['x-signature'], verifyKey)) throw fail(401, 'invalid_signature')
    const orderId = req.body?.orderId ?? req.body?.payload?.orderId
    const json = JSON.stringify(await buildDepayConfiguration(pool, orderId))
    res.set('Content-Type', 'application/json; charset=utf-8').set('x-signature', signDepayConfiguration(json, key)).set('Cache-Control', 'no-store').send(json)
  }))

  /* 4d — DePay server callback. The signature proves the call is DePay's;
     the body is still only a HINT (which order, which hash). Blockchain,
     receiver and token are compared with the server configuration and a
     mismatch is recorded; the on-chain verifier then decides — immediately
     here, and again from the recovery sweep if the chain is not ready.
     200 is returned once the delivery is durably recorded (DePay retries any
     non-200, so a database failure → 500 → retry). Duplicate deliveries are
     harmless: the attempt and the payment are unique per transaction. */
  router.post('/purchases/depay/callback', wrap(async (req, res) => {
    const key = depayVerifyKey()
    if (!key || !paymentEnabled()) throw fail(404, 'not_found')
    if (!req.rawBody || !verifyDepaySignature(req.rawBody, req.headers['x-signature'], key)) throw fail(401, 'invalid_signature')
    const mismatch = depayBodyMismatch(req.body)
    const out = mismatch === 'unsupported_chain' ? { recorded: false, reason: mismatch } : await recordPaymentHint(pool, req.body)
    await recordDepayDelivery(pool, { kind: 'callback', rawBody: req.rawBody, body: req.body, orderId: out.orderId ?? null,
      outcome: out.recorded ? (mismatch ? `hint_registered:${mismatch}` : 'hint_registered') : `ignored:${out.reason}` })
    res.json({ ok: true, recorded: out.recorded })
    if (!out.recorded) return
    setImmediate(async () => {
      try {
        const order = (await pool.query('SELECT id, price_usd, created_at FROM purchase_orders WHERE id=$1', [out.orderId])).rows[0]
        await verifyAndConfirm({ pool, verifier: chainVerifier(), order, userId: out.userId, txHash: out.txHash, source: 'depay_callback',
          chainId: out.chainId, attested: true, reported: out.reported })
        await audit('purchase_verified', out.userId, req, { orderId: out.orderId, txHash: out.txHash, via: 'depay_callback' })
      } catch (e) { /* recorded on the attempt; the sweep retries retryable conditions */ }
    })
  }))

  /* 4e — DePay events (attempt | processing | failed | succeeded). Signed
     like callbacks; recorded once per delivery and correlated to the order.
     Events may arrive out of order or repeatedly: 'attempt'/'processing'
     only move an awaiting order to payment_detected, 'succeeded' registers
     the transaction for on-chain verification exactly like a callback, and
     'failed' is recorded only. NO event ever marks an order paid. */
  router.post('/purchases/depay/events', wrap(async (req, res) => {
    const key = depayVerifyKey()
    if (!key || !paymentEnabled()) throw fail(404, 'not_found')
    if (!req.rawBody || !verifyDepaySignature(req.rawBody, req.headers['x-signature'], key)) throw fail(401, 'invalid_signature')
    const status = String(req.body?.status || '')
    if (!['attempt', 'processing', 'failed', 'succeeded'].includes(status)) {
      await recordDepayDelivery(pool, { kind: 'event', rawBody: req.rawBody, body: req.body, outcome: 'ignored:unknown_status' })
      return res.json({ ok: true, recorded: false })
    }
    const mismatch = depayBodyMismatch(req.body)
    let out = { recorded: false, reason: mismatch || 'status_recorded' }
    if (mismatch !== 'unsupported_chain' && ['processing', 'succeeded'].includes(status) && req.body?.transaction)
      out = await recordPaymentHint(pool, req.body)
    await recordDepayDelivery(pool, { kind: 'event', rawBody: req.rawBody, body: req.body, orderId: out.orderId ?? null,
      outcome: out.recorded ? (mismatch ? `hint_registered:${mismatch}` : 'hint_registered') : `recorded:${out.reason}` })
    res.json({ ok: true, recorded: out.recorded })
    if (!out.recorded || status !== 'succeeded') return
    setImmediate(async () => {
      try {
        const order = (await pool.query('SELECT id, price_usd, created_at FROM purchase_orders WHERE id=$1', [out.orderId])).rows[0]
        await verifyAndConfirm({ pool, verifier: chainVerifier(), order, userId: out.userId, txHash: out.txHash, source: 'depay_event',
          chainId: out.chainId, attested: true, reported: out.reported })
      } catch (e) { /* the attempt records the outcome; the sweep retries */ }
    })
  }))

  /* 5 — cancel a pending order */
  router.post('/purchases/orders/:id/cancel', requireAuth, wrap(async (req, res) => {
    if (!uuid.test(req.params.id)) throw fail(404, 'order_not_found')
    const { rows } = await pool.query(
      /* only an order with no detected payment can be cancelled by its owner:
         money that may be in flight is never silently dropped */
      `UPDATE purchase_orders SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status='pending' AND lifecycle_state='awaiting_payment' RETURNING id`,
      [req.params.id, req.user.user_id])
    if (!rows[0]) throw fail(409, 'order_not_cancellable')
    await audit('purchase_order_cancelled', req.user.user_id, req, { orderId: req.params.id })
    res.json({ ok: true })
  }))

  /* 6 — purchase + payment history + invoices (session-scoped) */
  router.get('/purchases/history', requireAuth, wrap(async (req, res) => {
    const orders = (await pool.query(
      `SELECT o.id, o.status, o.lifecycle_state, o.account_size_usd, o.list_price_usd, o.discount_usd, o.price_usd,
              o.payment_required, o.payment_method, o.currency, o.created_at, o.paid_at,
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
