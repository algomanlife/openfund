/**
 * Openfund Pay — treasury transaction watcher, status escalation and
 * partial-balance deadlines (ADR 0046, docs/payments/OPENFUND_PAY.md).
 *
 * DISCOVERY. Payments are found even when the customer never submits a
 * transaction hash:
 *  - EVM: eth_getLogs for Transfer(token → treasury) of every configured
 *    settlement token, from a persisted block cursor. Each run rescans a
 *    reorg window behind the cursor, so a reorganized block is seen again;
 *    unverified observations that disappear are marked `reorged`.
 *  - Solana: getSignaturesForAddress on the configured treasury token
 *    account (chain option `receiverTokenAccount`), from a persisted
 *    signature cursor; the order is named by the SPL Memo.
 * Every inbound transaction is recorded in payment_transactions (unique per
 * chain + hash) BEFORE any attribution decision, so funds are never lost.
 *
 * ATTRIBUTION (never guessed):
 *  1. a payment intent that captured this hash (Openfund Pay wallet flow);
 *  2. payment attempts naming this hash (customer TXID, DePay attestation);
 *  3. Solana: the order id in an SPL Memo;
 *  4. EVM sender rule: the sender is the SIWE wallet of EXACTLY ONE open
 *     order. Two or more open orders → `ambiguous`; none → `unmatched`.
 * Matched transactions go through the same chain verifier and ledger as
 * every other payment; ambiguous/unmatched ones wait in the Backstage
 * review queue. A shared treasury cannot prove more than this — per-order
 * deposit addresses or a reference-emitting payment contract are the
 * documented prerequisites for stronger automatic attribution.
 *
 * CONCURRENCY. One lease row per (chain, receiver, token): only the worker
 * holding an unexpired lease scans. Allocation is additionally protected by
 * row locks and unique constraints in the ledger, so even two scanners
 * could never credit a transaction twice.
 */
import os from 'node:os'
import crypto from 'node:crypto'
import { createPublicClient } from 'viem'
import { TRANSFER_TOPIC, SUPPORTED_CHAINS, SOLANA_CHAIN_ID, rpcTransport, padAddress } from './payment-verification.js'
import { solanaMemos } from './solana-verification.js'
import { paymentEvent, formatMicros } from './payment-ledger.js'

const uuidIn = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const lc = v => String(v || '').toLowerCase()
const hex = n => '0x' + BigInt(n).toString(16)
const topicAddress = t => ('0x' + String(t || '').slice(26)).toLowerCase()
const OPEN_LIFECYCLES = ['awaiting_payment', 'payment_detected', 'partially_paid', 'manual_review', 'expired']

export const watcherSettings = (env = process.env) => ({
  enabled: env.PAYMENT_WATCHER_ENABLED !== 'false',
  reorgBlocks: Math.max(Number(env.PAYMENT_WATCHER_REORG_BLOCKS) || 64, 1),
  maxRange: Math.max(Number(env.PAYMENT_WATCHER_MAX_RANGE) || 2000, 10),
  backfillBlocks: Math.max(Number(env.PAYMENT_WATCHER_BACKFILL_BLOCKS) || 20000, 1),
  leaseSeconds: Math.max(Number(env.PAYMENT_WATCHER_LEASE_SECONDS) || 120, 10),
})

/**
 * @param {object} o
 *  pool, chains (paymentChains() entries), settle(tx, match) → verifies and
 *  settles a matched transaction (verifyAndConfirm wrapper),
 *  clientFactory(chain) → { request, getBlockNumber, getBlock } (tests),
 *  solanaRpc(chain) → (method, params) (tests), owner, now, log
 */
export function createPaymentWatcher({ pool, chains, settle, clientFactory = null, solanaRpc = null, owner = `${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`, settings = watcherSettings(), lateGraceMinutes = 60, log = () => {} }) {
  const clients = new Map()
  const evmClient = c => {
    if (clients.has(c.chainId)) return clients.get(c.chainId)
    const client = clientFactory ? clientFactory(c) : createPublicClient({ chain: SUPPORTED_CHAINS.get(c.chainId), transport: rpcTransport(c.rpcUrl) })
    clients.set(c.chainId, client)
    return client
  }
  const solRpc = c => solanaRpc ? solanaRpc(c) : async (method, params) => {
    for (const url of (Array.isArray(c.rpcUrl) ? c.rpcUrl : [c.rpcUrl]).filter(Boolean)) {
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
        const body = res.ok ? await res.json() : null
        if (body && !body.error) return body.result
      } catch { /* next endpoint */ }
    }
    throw Object.assign(new Error('rpc_unavailable'), { retryable: true })
  }

  /* single-owner lease per cursor; returns the cursor row or null */
  async function lease(key, initial) {
    await pool.query(
      `INSERT INTO payment_monitor_cursors (chain_id, receiver, token_address, last_block, last_signature) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [...key, initial.block ?? null, initial.signature ?? null])
    const { rows: [row] } = await pool.query(
      `UPDATE payment_monitor_cursors SET lease_owner=$4, lease_until=now() + make_interval(secs => $5), updated_at=now()
        WHERE chain_id=$1 AND receiver=$2 AND token_address=$3 AND (lease_owner IS NULL OR lease_owner=$4 OR lease_until < now())
        RETURNING *`, [...key, owner, settings.leaseSeconds])
    return row || null
  }
  const cursorError = (key, e) => pool.query(
    `UPDATE payment_monitor_cursors SET last_error=$4, last_error_at=now(), updated_at=now() WHERE chain_id=$1 AND receiver=$2 AND token_address=$3`,
    [...key, String(e?.message || e).slice(0, 200)]).catch(() => {})

  /** record (or refresh) one observed inbound transaction; returns { row, inserted } */
  async function observe({ chainId, txHash, token, from, to, units, blockNumber, blockHash, blockTime = null, detail = {} }) {
    const { rows: [row] } = await pool.query(
      `INSERT INTO payment_transactions (chain_id, tx_hash, token_address, from_address, to_address, amount_units, block_number, block_hash, block_time, status, source, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'observed','watcher',$10)
       ON CONFLICT (chain_id, tx_hash) DO UPDATE SET
         block_number = CASE WHEN payment_transactions.status IN ('observed','reorged','pending') THEN EXCLUDED.block_number ELSE payment_transactions.block_number END,
         block_hash   = CASE WHEN payment_transactions.status IN ('observed','reorged','pending') THEN EXCLUDED.block_hash ELSE payment_transactions.block_hash END,
         status       = CASE WHEN payment_transactions.status = 'reorged' THEN 'observed' ELSE payment_transactions.status END,
         from_address = coalesce(payment_transactions.from_address, EXCLUDED.from_address),
         token_address = coalesce(payment_transactions.token_address, EXCLUDED.token_address),
         amount_units = coalesce(payment_transactions.amount_units, EXCLUDED.amount_units)
       RETURNING *, (xmax = 0) AS inserted`,
      [chainId, txHash, token, from, to, units?.toString() ?? null, blockNumber ?? null, blockHash ?? null, blockTime, JSON.stringify(detail)])
    if (row.inserted) await paymentEvent(pool, { transactionId: row.id, kind: 'transaction_observed', detail: { chainId, txHash, source: 'watcher' } })
    return row
  }

  /** attribution decision for an observed, unmatched transaction */
  async function correlate(c, tx, { memo = null } = {}) {
    if (tx.match_status !== 'unmatched' || tx.review_status !== 'none' || tx.status === 'verified') return { decision: 'skipped' }
    const viaIntent = (await pool.query(`SELECT DISTINCT purchase_order_id FROM payment_intents WHERE chain_id=$1 AND tx_hash=$2`, [tx.chain_id, tx.tx_hash])).rows
    if (viaIntent.length === 1) return finish(c, tx, viaIntent[0].purchase_order_id, 'intent', false)
    const viaAttempt = (await pool.query(
      `SELECT purchase_order_id, bool_or(attested) AS attested FROM payment_attempts WHERE chain_id=$1 AND tx_hash=$2 GROUP BY 1`, [tx.chain_id, tx.tx_hash])).rows
    if (viaAttempt.length === 1) return finish(c, tx, viaAttempt[0].purchase_order_id, viaAttempt[0].attested ? 'depay_attested' : 'attempt', viaAttempt[0].attested)
    if (viaAttempt.length > 1) return hold(tx, 'ambiguous', 'several orders claim this transaction', viaAttempt.map(a => a.purchase_order_id))
    if (c.solana) {
      const id = memo && memo.match(uuidIn)?.[0]
      const order = id && (await pool.query(`SELECT id FROM purchase_orders WHERE id=$1 AND payment_required`, [id.toLowerCase()])).rows[0]
      return order ? finish(c, tx, order.id, 'memo', false) : hold(tx, 'unmatched', memo ? 'memo names no order' : 'no order memo')
    }
    if (!tx.from_address) return hold(tx, 'unmatched', 'sender unknown')
    const at = tx.block_time ? new Date(tx.block_time) : new Date()
    const candidates = (await pool.query(
      `SELECT o.id FROM purchase_orders o JOIN openfund_users u ON u.id=o.user_id
        WHERE lower(u.wallet_address)=$1 AND o.payment_required AND o.lifecycle_state = ANY($2)
          AND o.created_at <= $3::timestamptz + interval '5 minutes'
          AND (o.status='pending' OR o.expires_at + make_interval(mins => $4) >= $3::timestamptz)`,
      [lc(tx.from_address), OPEN_LIFECYCLES, at.toISOString(), lateGraceMinutes])).rows
    if (candidates.length === 1) return finish(c, tx, candidates[0].id, 'sender_unique', false)
    if (candidates.length > 1) return hold(tx, 'ambiguous', 'sender has several open orders', candidates.map(o => o.id))
    return hold(tx, 'unmatched', 'no open order for this sender')
  }
  async function hold(tx, status, note, candidates = []) {
    await pool.query(`UPDATE payment_transactions SET match_status=$2, review_status='open', review_note=$3, detail = detail || $4::jsonb WHERE id=$1 AND match_status='unmatched'`,
      [tx.id, status, note, JSON.stringify({ candidates })])
    await paymentEvent(pool, { transactionId: tx.id, kind: status === 'ambiguous' ? 'attribution_ambiguous' : 'attribution_unmatched', detail: { note, candidates: candidates.length } })
    return { decision: status }
  }
  async function finish(c, tx, orderId, method, attested) {
    try {
      const out = await settle({ chain: c, tx, orderId, matchMethod: method, attested })
      return { decision: 'matched', orderId, outcome: out?.outcome ?? null }
    } catch (e) {
      /* retryable chain conditions are retried by the recovery sweep through
         the attempt; a definitive rejection is held for review */
      if (!e.retryable) {
        await pool.query(`UPDATE payment_transactions SET review_status='open', verification_code=$2, detail = detail || $3::jsonb WHERE id=$1 AND match_status='unmatched'`,
          [tx.id, String(e.message).slice(0, 60), JSON.stringify({ candidateOrderId: orderId, matchMethod: method })])
        await paymentEvent(pool, { orderId, transactionId: tx.id, kind: 'attribution_rejected', detail: { code: e.message, matchMethod: method } })
      }
      return { decision: e.retryable ? 'retry' : 'rejected', orderId, code: e.message }
    }
  }

  async function scanEvm(c) {
    const key = [c.chainId, c.receiver, c.token]
    const client = evmClient(c)
    const head = BigInt(await client.getBlockNumber({ cacheTime: 0 }))
    const start = c.watchFromBlock != null ? BigInt(c.watchFromBlock) - 1n : head - BigInt(settings.backfillBlocks)
    const cur = await lease(key, { block: (start < 0n ? 0n : start).toString() })
    if (!cur) return { chainId: c.chainId, skipped: 'lease_held' }
    let last = BigInt(cur.last_block), scanned = 0, observed = 0, matched = 0
    for (let i = 0; i < 20 && last < head; i++) {
      const from = last + 1n - BigInt(settings.reorgBlocks) > 0n ? last + 1n - BigInt(settings.reorgBlocks) : 0n
      const to = last + BigInt(settings.maxRange) < head ? last + BigInt(settings.maxRange) : head
      const logs = await client.request({ method: 'eth_getLogs', params: [{ address: c.token, fromBlock: hex(from), toBlock: hex(to),
        topics: [TRANSFER_TOPIC, null, padAddress(c.receiver)] }] })
      const byTx = new Map()
      for (const l of logs || []) {
        if (l.removed || lc(l.address) !== lc(c.token)) continue
        const h = lc(l.transactionHash), e = byTx.get(h) || { units: 0n, from: topicAddress(l.topics[1]), blockNumber: BigInt(l.blockNumber), blockHash: lc(l.blockHash) }
        e.units += BigInt(l.data)
        byTx.set(h, e)
      }
      const blockTimes = new Map()
      for (const [txHash, e] of byTx) {
        if (!blockTimes.has(e.blockNumber)) {
          const b = await client.getBlock({ blockNumber: e.blockNumber }).catch(() => null)
          blockTimes.set(e.blockNumber, b ? new Date(Number(b.timestamp) * 1000).toISOString() : null)
        }
        const row = await observe({ chainId: c.chainId, txHash, token: lc(c.token), from: e.from, to: lc(c.receiver), units: e.units,
          blockNumber: e.blockNumber.toString(), blockHash: e.blockHash, blockTime: blockTimes.get(e.blockNumber) })
        observed++
        const r = await correlate(c, row)
        if (r.decision === 'matched') matched++
      }
      /* reorg: an observation inside the rescanned window that is no longer
         in the canonical logs. Unsettled → `reorged`; settled → alert. */
      const gone = (await pool.query(
        `SELECT id, tx_hash, status, purchase_order_id FROM payment_transactions
          WHERE chain_id=$1 AND lower(to_address)=$2 AND lower(token_address)=$3 AND block_number BETWEEN $4 AND $5 AND status IN ('observed','verified')`,
        [c.chainId, lc(c.receiver), lc(c.token), from.toString(), to.toString()])).rows.filter(r => !byTx.has(lc(r.tx_hash)))
      for (const g of gone) {
        if (g.status === 'observed') {
          await pool.query(`UPDATE payment_transactions SET status='reorged' WHERE id=$1 AND status='observed'`, [g.id])
          await paymentEvent(pool, { transactionId: g.id, kind: 'transaction_reorged', detail: { chainId: c.chainId } })
        } else {
          await pool.query(`UPDATE payment_transactions SET review_status='open', review_note='settled transaction missing from canonical logs' WHERE id=$1`, [g.id])
          await paymentEvent(pool, { orderId: g.purchase_order_id, transactionId: g.id, kind: 'settled_transaction_missing', detail: { chainId: c.chainId } })
          log('alert', 'settled_transaction_missing', c.chainId)
        }
      }
      scanned += Number(to - from + 1n)
      last = to
      await pool.query(
        `UPDATE payment_monitor_cursors SET last_block=$4, head_block=$5, last_success_at=now(), last_error=NULL, updated_at=now()
          WHERE chain_id=$1 AND receiver=$2 AND token_address=$3 AND lease_owner=$6`, [...key, last.toString(), head.toString(), owner])
    }
    return { chainId: c.chainId, head: head.toString(), cursor: last.toString(), scanned, observed, matched }
  }

  async function scanSolana(c) {
    if (!c.receiverTokenAccount) return { chainId: c.chainId, skipped: 'receiver_token_account_unconfigured' }
    const key = [c.chainId, c.receiver, c.token]
    const cur = await lease(key, {})
    if (!cur) return { chainId: c.chainId, skipped: 'lease_held' }
    const rpc = solRpc(c)
    const sigs = (await rpc('getSignaturesForAddress', [c.receiverTokenAccount, { limit: 100, commitment: 'finalized', ...(cur.last_signature ? { until: cur.last_signature } : {}) }])) || []
    let observed = 0, matched = 0
    for (const s of [...sigs].reverse()) {
      if (s.err) continue
      const tx = await rpc('getTransaction', [s.signature, { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 }])
      if (!tx || tx.meta?.err) continue
      const owned = list => (list || []).filter(b => b.owner === c.receiver && b.mint === c.token).reduce((a, b) => a + BigInt(b.uiTokenAmount?.amount || '0'), 0n)
      const units = owned(tx.meta.postTokenBalances) - owned(tx.meta.preTokenBalances)
      if (units <= 0n) continue
      const keys = (tx.transaction?.message?.accountKeys || []).map(k => (typeof k === 'string' ? k : k.pubkey))
      const memo = solanaMemos(tx).join(' ')
      const row = await observe({ chainId: SOLANA_CHAIN_ID, txHash: s.signature, token: c.token, from: keys[0] || null, to: c.receiver, units,
        blockNumber: String(tx.slot), blockHash: null, blockTime: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null, detail: { memo: memo.slice(0, 200) } })
      observed++
      const r = await correlate(c, row, { memo })
      if (r.decision === 'matched') matched++
    }
    if (sigs.length) await pool.query(
      `UPDATE payment_monitor_cursors SET last_signature=$4, last_success_at=now(), last_error=NULL, updated_at=now() WHERE chain_id=$1 AND receiver=$2 AND token_address=$3 AND lease_owner=$5`,
      [...key, sigs[0].signature, owner])
    return { chainId: c.chainId, observed, matched }
  }

  async function runOnce() {
    const results = []
    for (const c of chains()) {
      if (!c.receiver || !c.token || (!c.rpcUrl && !clientFactory && !solanaRpc)) continue
      const key = [c.chainId, c.receiver, c.token]
      try { results.push(await (c.solana ? scanSolana(c) : scanEvm(c))) } catch (e) {
        await cursorError(key, e)
        log('error', c.chainId, e.message)
        results.push({ chainId: c.chainId, error: String(e.message).slice(0, 120) })
      }
    }
    return results
  }
  return { runOnce, correlate, owner }
}

/**
 * Status escalation (the 15–20 minute promise): a payment attempt still
 * unresolved after 15 minutes records `status_delayed`; after 20 minutes
 * `escalated_review` and opens a review case. Nothing is rejected — the
 * recovery sweep keeps verifying in the background and the customer is
 * updated automatically when the chain answers.
 */
export async function escalatePendingPayments(pool, { delayMinutes = 15, reviewMinutes = 20 } = {}) {
  const delayed = await pool.query(
    `INSERT INTO payment_events (purchase_order_id, attempt_id, kind, detail)
     SELECT a.purchase_order_id, a.id, 'status_delayed', jsonb_build_object('code', a.error_code)
       FROM payment_attempts a WHERE a.status='pending' AND a.first_seen_at < now() - make_interval(mins => $1)
     ON CONFLICT (attempt_id, kind) WHERE kind IN ('status_delayed','escalated_review') AND attempt_id IS NOT NULL DO NOTHING`, [delayMinutes])
  const review = await pool.query(
    `INSERT INTO payment_events (purchase_order_id, attempt_id, kind, detail)
     SELECT a.purchase_order_id, a.id, 'escalated_review', jsonb_build_object('code', a.error_code)
       FROM payment_attempts a WHERE a.status='pending' AND a.first_seen_at < now() - make_interval(mins => $1)
     ON CONFLICT (attempt_id, kind) WHERE kind IN ('status_delayed','escalated_review') AND attempt_id IS NOT NULL DO NOTHING
     RETURNING attempt_id`, [reviewMinutes])
  if (review.rows.length)
    await pool.query(`UPDATE payment_attempts SET review_status='open' WHERE id = ANY($1) AND review_status='none'`, [review.rows.map(r => r.attempt_id)])
  return { delayed: delayed.rowCount, escalated: review.rowCount }
}

/** a partially paid order past its balance deadline goes to operator
 *  review (received funds are never dropped and the order never expires) */
export async function reviewOverduePartialOrders(pool) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('openfund.actor','system:partial_deadline',true), set_config('openfund.reason','partial_balance_overdue',true)`)
    const { rows } = await client.query(
      `UPDATE purchase_orders SET lifecycle_state='manual_review'
        WHERE lifecycle_state='partially_paid' AND partial_deadline_at < now() RETURNING id`)
    for (const r of rows) await paymentEvent(client, { orderId: r.id, kind: 'partial_balance_overdue' })
    await client.query('COMMIT')
    return { overdue: rows.length }
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e } finally { client.release() }
}

/** operational payment metrics (counts and ages only — no wallets, no hashes) */
export async function paymentMetrics(q) {
  const one = async (sql, p = []) => (await q.query(sql, p)).rows[0]
  const [orders, tx, refunds, attempts, cursors] = await Promise.all([
    one(`SELECT count(*) FILTER (WHERE payment_required)::int AS intents_total,
                count(*) FILTER (WHERE status='paid' AND payment_required)::int AS settled,
                count(*) FILTER (WHERE lifecycle_state='partially_paid')::int AS partially_paid,
                count(*) FILTER (WHERE lifecycle_state='manual_review')::int AS manual_review,
                count(*) FILTER (WHERE lifecycle_state='paid')::int AS provisioning_pending
           FROM purchase_orders`),
    one(`SELECT count(*) FILTER (WHERE match_status='unmatched' AND review_status='open')::int AS unmatched,
                count(*) FILTER (WHERE match_status='ambiguous' AND review_status='open')::int AS ambiguous,
                count(*) FILTER (WHERE status IN ('observed','pending'))::int AS pending,
                count(*) FILTER (WHERE status='reorged')::int AS reorged,
                count(*) FILTER (WHERE review_status='open')::int AS review_open
           FROM payment_transactions`),
    one(`SELECT count(*) FILTER (WHERE status IN ('refund_due','refund_review','refund_approved','refund_sent','refund_failed'))::int AS open,
                count(*) FILTER (WHERE status='refund_review')::int AS awaiting_review,
                coalesce(sum(usd_micros) FILTER (WHERE status IN ('refund_due','refund_review','refund_approved','refund_sent','refund_failed')),0)::text AS open_micros,
                coalesce(sum(usd_micros) FILTER (WHERE reason='overpayment' AND status NOT IN ('refund_confirmed','refund_rejected')),0)::text AS overpayment_micros
           FROM payment_refund_liabilities`),
    one(`SELECT count(*) FILTER (WHERE status='pending')::int AS pending,
                count(*) FILTER (WHERE status='pending' AND first_seen_at < now() - interval '20 minutes')::int AS pending_over_20m,
                count(*) FILTER (WHERE status='rejected' AND last_attempt_at > now() - interval '24 hours')::int AS rejected_24h,
                count(*) FILTER (WHERE status='confirmed' AND last_attempt_at > now() - interval '24 hours')::int AS confirmed_24h,
                count(*) FILTER (WHERE status='pending' AND error_code='provisioning_retry')::int AS provisioning_failures,
                count(*) FILTER (WHERE status='pending' AND error_code='rpc_unavailable')::int AS rpc_failures,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM last_attempt_at - first_seen_at))
                  FILTER (WHERE status='confirmed' AND last_attempt_at > now() - interval '7 days') AS confirm_latency_p50_s
           FROM payment_attempts`),
    q.query(`SELECT chain_id, last_block::text, head_block::text, last_success_at, last_error IS NOT NULL AS failing,
                    extract(epoch FROM now() - last_success_at)::int AS seconds_since_success
               FROM payment_monitor_cursors ORDER BY chain_id`).then(r => r.rows),
  ])
  const watcher = cursors.map(c => ({ chainId: c.chain_id, lagBlocks: c.head_block && c.last_block ? Number(BigInt(c.head_block) - BigInt(c.last_block)) : null,
    secondsSinceSuccess: c.seconds_since_success, failing: c.failing }))
  const alerts = []
  if (attempts.pending_over_20m > 0) alerts.push('payments_pending_over_20m')
  if (attempts.provisioning_failures > 0) alerts.push('provisioning_failed_after_settlement')
  if (attempts.rpc_failures > 2) alerts.push('payment_rpc_unavailable')
  if (watcher.some(w => w.failing || (w.secondsSinceSuccess ?? 0) > 900 || (w.lagBlocks ?? 0) > 5000)) alerts.push('payment_watcher_behind')
  if (tx.reorged > 0) alerts.push('payment_reorg_observed')
  if (tx.unmatched + tx.ambiguous > 0) alerts.push('unattributed_deposits')
  return {
    orders, transactions: tx, attempts: { ...attempts, confirm_latency_p50_s: attempts.confirm_latency_p50_s == null ? null : Math.round(attempts.confirm_latency_p50_s) },
    refunds: { ...refunds, open_usd: formatMicros(refunds.open_micros), overpayment_usd: formatMicros(refunds.overpayment_micros) },
    watcher, alerts,
  }
}
