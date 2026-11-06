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
import { createClient, http } from 'viem'
import { sepolia, arbitrum } from 'viem/chains'
import { invoicePdf } from './invoice-pdf.js'
import { ChallengeService, normalizeRules } from './evaluation.js'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const txHashRe = /^0x[0-9a-f]{64}$/i
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

const cfg = () => ({
  receiver: (process.env.PURCHASE_PAYMENT_RECEIVER || '').toLowerCase() || null,
  chainId: Number(process.env.PURCHASE_PAYMENT_CHAIN || 11155111),
  token: (process.env.PURCHASE_PAYMENT_TOKEN || '').toLowerCase() || null,
  tokenDecimals: Number(process.env.PURCHASE_PAYMENT_DECIMALS ?? 18),
  /* finality policy: minimum confirmations before a payment is accepted
     (default 0 = single receipt, documented; reorg-depth configurable) */
  minConfirmations: Number(process.env.PURCHASE_PAYMENT_MIN_CONFIRMATIONS ?? 0) || 0,
  /* late-payment grace: a transaction mined within this many minutes
     after order expiry still pays the order (money received is never
     silently dropped; outside the window → manual reconciliation) */
  lateGraceMinutes: Number(process.env.PURCHASE_LATE_GRACE_MINUTES ?? 60) || 0,
})

const fail = (status, error) => {
  const e = new Error(error)
  e.status = status
  return e
}
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

const chainById = new Map([[sepolia.id, sepolia], [arbitrum.id, arbitrum]])

/* ---------- default on-chain verifier (injectable for tests) ---------- */
const clients = new Map()
async function defaultVerifier(txHash, expect) {
  const chain = chainById.get(expect.chainId)
  if (!chain) throw fail(400, 'unsupported_chain')
  if (!clients.has(chain.id)) clients.set(chain.id, createClient({ chain, transport: http(undefined, { timeout: 8000, retryCount: 0 }) }))
  const client = clients.get(chain.id)
  const receipt = await client.getTransactionReceipt({ hash: txHash })
  if (!receipt || receipt.status !== 'success') throw fail(400, 'tx_not_successful')
  const tx = await client.getTransaction({ hash: txHash })
  if (!tx || !tx.from) throw fail(400, 'tx_not_found')
  if (tx.from.toLowerCase() !== expect.from) throw fail(400, 'wrong_sender')
  let amount = null
  let toAddress = null
  if (expect.token) {
    /* ERC-20 transfer: match the Transfer event from payer to receiver */
    const transfer = (receipt.logs || []).find(l => (l.topics?.[0] || '').toLowerCase() === TRANSFER_TOPIC)
    if (!transfer || (transfer.topics?.[1] || '').toLowerCase() !== '0x' + '0'.repeat(24) + expect.from.slice(2)) throw fail(400, 'transfer_not_from_payer')
    if ((transfer.address || '').toLowerCase() !== expect.token) throw fail(400, 'wrong_token')
    toAddress = '0x' + (transfer.topics?.[2] || '').slice(26)
    if (toAddress.toLowerCase() !== expect.receiver) throw fail(400, 'wrong_receiver')
    amount = BigInt(transfer.data).toString()
    const min = BigInt(expect.minAmountUnits)
    if (amount < min) throw fail(400, 'insufficient_amount')
  } else {
    /* native transfer */
    if ((tx.to || '').toLowerCase() !== expect.receiver) throw fail(400, 'wrong_receiver')
    toAddress = (tx.to || '').toLowerCase()
    amount = (tx.value || 0n).toString()
    if (amount < expect.minAmountUnits) throw fail(400, 'insufficient_amount')
  }
  const block = await client.getBlock({ blockNumber: receipt.blockNumber })
  if (Number(block.timestamp) * 1000 < expect.notBefore) throw fail(400, 'tx_too_old')
  /* finality policy: wait for the configured confirmation depth so a
     reorged transaction can never provision a challenge (retryable) */
  if (expect.minConfirmations > 0) {
    const head = await client.getBlockNumber()
    if (head - receipt.blockNumber < BigInt(expect.minConfirmations))
      throw Object.assign(new Error('tx_not_final'), { status: 409, retryable: true })
  }
  return {
    txHash, chainId: expect.chainId, blockNumber: Number(receipt.blockNumber),
    fromAddress: tx.from.toLowerCase(), toAddress, amount, tokenAddress: expect.token,
    blockTimestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
    confirmations: expect.minConfirmations,
  }
}

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
    if (order.status !== 'pending') throw fail(409, 'order_not_pending')
    /* late-payment policy: an expired order still accepts an on-chain
       payment whose block was mined within the grace window AFTER
       expiry — money received is never silently dropped. Outside the
       window → explicit 409 for manual reconciliation (refund path). */
    if (order.expires_at && order.expires_at < new Date()) {
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
      `UPDATE purchase_orders SET status='paid', paid_at=now() WHERE id=$1 AND status='pending' RETURNING paid_at`,
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

/* ---------- routes ---------- */
export function purchaseRoutes({ pool, requireAuth, audit, verifier = defaultVerifier }) {
  const router = Router()

  const paymentEnabled = () => !!cfg().receiver

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
        ? { chainId: c.chainId, receiver: c.receiver, token: c.token }
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
    if (order.status !== 'pending') throw fail(409, 'order_not_pending')
    /* NOTE: expiry is NOT rejected here — the on-chain evidence is
       verified first, then confirmPurchase applies the late-payment
       grace policy (money received inside the window is never dropped) */

    const c = cfg()
    /* exact decimal-string → smallest-unit conversion (float math would lose
       precision above 2^53, e.g. $44 × 10^18) */
    const toUnits = (usd, decimals) => {
      const [i, f = ''] = String(usd).split('.')
      if (f.length > decimals) throw fail(400, 'price_precision')
      return (BigInt(i) * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals))).toString()
    }
    const minUnits = c.token ? toUnits(order.price_usd, c.tokenDecimals) : toUnits(order.price_usd, 18)
    const evidence = await verifier(txHash, {
      chainId: c.chainId, receiver: c.receiver, token: c.token, minAmountUnits: minUnits,
      from: req.user.wallet_address, notBefore: new Date(order.created_at).getTime() - 5 * 60_000,
      minConfirmations: c.minConfirmations,
    })
    const result = await confirmPurchase(pool, { orderId, userId: req.user.user_id, evidence, source: 'onchain' })
    await audit('purchase_verified', req.user.user_id, req, { orderId, txHash, challengeId: result.challengeId })
    res.json(result)
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
