/**
 * Solana payment verification (non-EVM) — JSON-RPC only, no new dependency.
 *
 * A Solana payment for an order is accepted when, for the signature DePay
 * attested (or the customer submitted):
 *  - the transaction exists at the required commitment and did not fail
 *    (meta.err === null);
 *  - the receiver's balance of the configured SPL settlement mint increased
 *    by at least the order price in base units, measured from the
 *    transaction's own pre/post token balances (owner + mint), so unrelated
 *    accounts, other mints and the payer's source token never count;
 *  - the transaction's block time is not older than the order;
 *  - the commitment is "finalized" (or "confirmed" when the operator sets
 *    minConfirmations to 0 for low-value testing).
 * Signatures are base58 and case-sensitive; the caller keeps them verbatim.
 * DePay's Solana program/account (docs: DePayR1gQfD…ho1Zg) is recorded as the
 * route when present among the transaction's account keys.
 */
import { paymentError, toUnits, SOLANA_CHAIN_ID } from './payment-verification.js'

const DEPAY_SOLANA_ACCOUNT = 'DePayR1gQfDmViCPKctnZXNtUgqRwnEqMax8LX9ho1Zg'
const MEMO_PROGRAMS = new Set(['MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', 'Memo1UhkJRfHyvLMcVucJwxXeuD728EQVDDwQDxFjZgdkx'])

/** every SPL Memo text in the transaction (top-level and inner instructions) */
export function solanaMemos(tx) {
  const out = []
  const visit = ix => {
    if (!ix) return
    const memoProgram = ix.program === 'spl-memo' || MEMO_PROGRAMS.has(String(ix.programId || ''))
    if (memoProgram && typeof ix.parsed === 'string') out.push(ix.parsed)
  }
  for (const ix of tx?.transaction?.message?.instructions || []) visit(ix)
  for (const inner of tx?.meta?.innerInstructions || []) for (const ix of inner.instructions || []) visit(ix)
  return out
}

export function analyzeSolanaPayment(tx, expect) {
  if (!tx) throw paymentError(409, 'tx_pending', { retryable: true })
  if (!tx.meta || tx.meta.err !== null) throw paymentError(400, 'tx_not_successful')
  const keys = (tx.transaction?.message?.accountKeys || []).map(k => (typeof k === 'string' ? k : k.pubkey))
  const feePayer = keys[0] || null
  if (expect.requireSender !== false && feePayer !== expect.from) throw paymentError(400, 'wrong_sender')
  /* a customer-submitted (manual) Solana payment cannot be tied to the
     customer's EVM sign-in wallet, so it must carry the order reference in
     an SPL Memo; without it anyone could claim someone else's transfer */
  if (expect.memo) {
    const want = String(expect.memo).toLowerCase()
    if (!solanaMemos(tx).some(m => m.toLowerCase().includes(want))) throw paymentError(400, 'memo_missing')
  }
  const owned = list => (list || []).filter(b => b.owner === expect.receiver && b.mint === expect.token)
  const sum = list => owned(list).reduce((acc, b) => acc + BigInt(b.uiTokenAmount?.amount || '0'), 0n)
  const received = sum(tx.meta.postTokenBalances) - sum(tx.meta.preTokenBalances)
  if (received <= 0n) {
    const anyToReceiver = (tx.meta.postTokenBalances || []).some(b => b.owner === expect.receiver)
    throw paymentError(400, anyToReceiver ? 'wrong_token' : 'wrong_receiver')
  }
  const min = BigInt(expect.minAmountUnits)
  if (received < min) throw paymentError(400, 'insufficient_amount', { received: received.toString() })
  return {
    txHash: expect.signature, chainId: SOLANA_CHAIN_ID, blockNumber: Number(tx.slot), blockHash: null,
    fromAddress: feePayer, toAddress: expect.receiver, amount: received.toString(), tokenAddress: expect.token,
    route: keys.includes(DEPAY_SOLANA_ACCOUNT) ? 'depay_solana' : 'direct', contract: null,
    overpaymentUnits: received > min ? (received - min).toString() : '0',
    blockTimestamp: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
  }
}

/** `rpc(method, params)` is injectable for tests; production posts JSON-RPC to rpcUrl */
export function createSolanaVerifier({ rpcUrl, rpc: injected } = {}) {
  const rpc = injected || (async (method, params) => {
    if (!rpcUrl) throw paymentError(503, 'payment_misconfigured', { retryable: false, detail: 'rpc_url_missing' })
    let res
    try {
      res = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000),
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
    } catch { throw paymentError(503, 'rpc_unavailable', { retryable: true }) }
    if (!res.ok) throw paymentError(503, 'rpc_unavailable', { retryable: true })
    const body = await res.json().catch(() => null)
    if (!body || body.error) throw paymentError(503, 'rpc_unavailable', { retryable: true, detail: String(body?.error?.message || '').slice(0, 120) })
    return body.result
  })
  const decimalsCache = new Map()

  return async function verify(signature, expect) {
    if (!expect.token) throw paymentError(400, 'native_payment_unsupported')
    const commitment = (expect.minConfirmations ?? 1) > 0 ? 'finalized' : 'confirmed'
    let decimals = expect.tokenDecimals
    if (decimals == null) {
      if (!decimalsCache.has(expect.token)) {
        const supply = await rpc('getTokenSupply', [expect.token])
        decimalsCache.set(expect.token, Number(supply?.value?.decimals))
      }
      decimals = decimalsCache.get(expect.token)
    }
    if (!Number.isInteger(decimals)) throw paymentError(503, 'payment_misconfigured', { retryable: false, detail: 'mint_decimals_unknown' })
    const minAmountUnits = toUnits(expect.priceUsd, decimals)
    const tx = await rpc('getTransaction', [signature, { encoding: 'jsonParsed', commitment, maxSupportedTransactionVersion: 0 }])
    if (!tx) throw paymentError(409, commitment === 'finalized' ? 'tx_not_final' : 'tx_pending', { retryable: true })
    const result = analyzeSolanaPayment(tx, { ...expect, signature, minAmountUnits })
    if (result.blockTimestamp && new Date(result.blockTimestamp).getTime() < expect.notBefore) throw paymentError(400, 'tx_too_old')
    return { ...result, confirmations: commitment === 'finalized' ? 'finalized' : 'confirmed', requiredConfirmations: commitment, tokenDecimals: decimals, minAmountUnits }
  }
}
