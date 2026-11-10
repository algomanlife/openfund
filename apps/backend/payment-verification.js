/**
 * Openfund — on-chain payment verification (ADR 0009, amended by ADR 0018).
 *
 * Two layers, deliberately separated so the security-critical rules are
 * testable with deterministic receipt fixtures and no network:
 *
 *  1. analyzePayment(): a PURE function. Given a transaction, its receipt
 *     and the order expectation it either returns the evidence of record
 *     or throws a coded error. No I/O.
 *  2. createRpcVerifier(): fetches the chain facts through a dedicated RPC
 *     endpoint (never the public fallback), checks finality and reorg
 *     safety, then delegates to analyzePayment().
 *
 * PAYMENT-CORRELATION POLICY (documented in docs/payments/VERIFICATION.md)
 *  - The transaction must be SIGNED BY the authenticated wallet
 *    (tx.from === wallet). Another account's payment can never satisfy an
 *    order, and neither can a smart-contract wallet (unsupported, explicit).
 *  - Only the single approved ERC-20 (a USD stablecoin) counts. Native
 *    value is never converted to USD: native payments are refused in
 *    production and only exist on non-production test chains.
 *  - The transaction must target the token contract itself (direct
 *    transfer) or an operator-approved router (PURCHASE_ROUTER_ADDRESSES,
 *    e.g. the DePay Payment Router). Anything else is refused.
 *  - The amount is the SUM of Transfer logs emitted by the approved token
 *    contract whose recipient is the merchant receiver AND whose sender is
 *    the payer or an approved router. Unrelated transfers (other tokens,
 *    other recipients, third-party senders) never count, and the first log
 *    is never assumed to be "the" payment.
 *  - A transaction hash is single-use across the system (payments UNIQUE
 *    chain_id+tx_hash) and must be mined after the order was created.
 */
import { createPublicClient, http, erc20Abi, TransactionReceiptNotFoundError } from 'viem'
import { sepolia, arbitrum, mainnet, base } from 'viem/chains'

export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

/** Chains an operator may configure. DePay itself serves mainnets only. */
export const SUPPORTED_CHAINS = new Map([sepolia, arbitrum, mainnet, base].map(c => [c.id, c]))
export const MAINNET_CHAIN_IDS = new Set([mainnet.id, arbitrum.id, base.id])

export const paymentError = (status, error, extra = {}) =>
  Object.assign(new Error(error), { status, ...extra })

const lc = v => String(v || '').toLowerCase()
const padAddress = a => '0x' + '0'.repeat(24) + lc(a).slice(2)
const topicAddress = t => ('0x' + String(t || '').slice(26)).toLowerCase()

/** exact USD-decimal-string → smallest unit (float math would lose precision) */
export function toUnits(usd, decimals) {
  const [i, f = ''] = String(usd).split('.')
  if (!/^\d+$/.test(i) || !/^\d*$/.test(f)) throw paymentError(400, 'invalid_price')
  if (f.length > decimals) {
    if (/[^0]/.test(f.slice(decimals))) throw paymentError(400, 'price_precision')
  }
  return (BigInt(i) * 10n ** BigInt(decimals) + BigInt((f + '0'.repeat(decimals)).slice(0, decimals) || '0')).toString()
}

/**
 * Pure verification of a mined payment.
 * @param {{tx:object, receipt:object}} chain   transaction + receipt facts
 * @param {object} expect
 *   chainId, receiver, token|null, from, routers:string[], minAmountUnits (string),
 *   allowNative:boolean
 */
export function analyzePayment({ tx, receipt }, expect) {
  if (!receipt || receipt.status !== 'success') throw paymentError(400, 'tx_not_successful')
  if (!tx || !tx.from) throw paymentError(400, 'tx_not_found')
  const payer = lc(expect.from), receiver = lc(expect.receiver)
  if (lc(tx.from) !== payer) throw paymentError(400, 'wrong_sender')
  const routers = new Set((expect.routers || []).map(lc))
  const min = BigInt(expect.minAmountUnits)

  /* ---- native value path (test chains only) ---- */
  if (!expect.token) {
    if (!expect.allowNative) throw paymentError(400, 'native_payment_unsupported')
    if (lc(tx.to) !== receiver) throw paymentError(400, 'wrong_receiver')
    const amount = BigInt(tx.value || 0n)
    if (amount < min) throw paymentError(400, 'insufficient_amount', { received: amount.toString() })
    return evidence({ tx, receipt, expect, amount, toAddress: receiver, route: 'native' })
  }

  /* ---- ERC-20 path ---- */
  const token = lc(expect.token)
  const target = lc(tx.to)
  const direct = target === token
  if (!direct && !routers.has(target)) throw paymentError(400, 'unapproved_contract', { target })

  const allowedSenders = new Set([payer, ...routers])
  let received = 0n, anyToReceiver = false, tokenToReceiver = false
  for (const log of receipt.logs || []) {
    if (log.removed) continue
    if (lc(log.topics?.[0]) !== TRANSFER_TOPIC || log.topics.length !== 3) continue
    if (topicAddress(log.topics[2]) !== receiver) continue
    anyToReceiver = true
    if (lc(log.address) !== token) continue
    tokenToReceiver = true
    if (!allowedSenders.has(topicAddress(log.topics[1]))) continue
    received += BigInt(log.data)
  }
  if (received === 0n) {
    /* approved token reached the receiver but not from the payer/router →
       an unrelated third-party transfer must never satisfy the order */
    throw paymentError(400, tokenToReceiver ? 'transfer_not_from_payer' : anyToReceiver ? 'wrong_token' : 'wrong_receiver')
  }
  if (received < min) throw paymentError(400, 'insufficient_amount', { received: received.toString() })
  return evidence({ tx, receipt, expect, amount: received, toAddress: receiver, route: direct ? 'direct' : 'router' })
}

function evidence({ tx, receipt, expect, amount, toAddress, route }) {
  const min = BigInt(expect.minAmountUnits)
  return {
    txHash: lc(receipt.transactionHash || tx.hash),
    chainId: expect.chainId,
    blockNumber: Number(receipt.blockNumber),
    blockHash: receipt.blockHash ?? null,
    fromAddress: lc(tx.from),
    toAddress,
    amount: amount.toString(),
    tokenAddress: expect.token ? lc(expect.token) : null,
    route,
    contract: lc(tx.to),
    overpaymentUnits: amount > min ? (amount - min).toString() : '0',
  }
}

/* ---------------------------------------------------------------- RPC --- */

const isNotFound = e =>
  e instanceof TransactionReceiptNotFoundError || e?.name === 'TransactionReceiptNotFoundError' ||
  e?.name === 'TransactionNotFoundError'

/**
 * Chain access boundary. `client` is injectable for tests; production
 * builds a client from the dedicated PURCHASE_RPC_URL.
 */
export function createRpcVerifier({ rpcUrl, clientFactory } = {}) {
  const clients = new Map()
  const decimalsCache = new Map()
  const chainChecked = new Set()

  const clientFor = chainId => {
    if (clients.has(chainId)) return clients.get(chainId)
    const chain = SUPPORTED_CHAINS.get(chainId)
    if (!chain) throw paymentError(400, 'unsupported_chain')
    if (!rpcUrl && !clientFactory) throw paymentError(503, 'payment_misconfigured', { retryable: false, detail: 'rpc_url_missing' })
    const client = clientFactory
      ? clientFactory(chain)
      : createPublicClient({ chain, transport: http(rpcUrl, { timeout: 8000, retryCount: 1 }) })
    clients.set(chainId, client)
    return client
  }

  const rpc = async fn => {
    try { return await fn() } catch (e) {
      if (e?.status) throw e
      if (isNotFound(e)) throw paymentError(409, 'tx_pending', { retryable: true })
      throw paymentError(503, 'rpc_unavailable', { retryable: true })
    }
  }

  /** token decimals are read from the contract and cross-checked */
  async function resolveDecimals(client, chainId, token, configured) {
    const key = `${chainId}:${lc(token)}`
    if (!decimalsCache.has(key)) {
      const d = await rpc(() => client.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }))
      decimalsCache.set(key, Number(d))
    }
    const onchain = decimalsCache.get(key)
    if (configured != null && Number(configured) !== onchain)
      throw paymentError(503, 'payment_misconfigured', { retryable: false, detail: `decimals_mismatch:${onchain}` })
    return onchain
  }

  /**
   * @param {string} txHash
   * @param {object} expect  chainId, receiver, token|null, tokenDecimals?, priceUsd (string),
   *                         from, routers, allowNative, notBefore (ms), minConfirmations
   */
  return async function verify(txHash, expect) {
    const client = clientFor(expect.chainId)
    if (!chainChecked.has(expect.chainId)) {
      const id = await rpc(() => client.getChainId())
      if (Number(id) !== expect.chainId) throw paymentError(503, 'payment_misconfigured', { retryable: false, detail: 'rpc_chain_mismatch' })
      chainChecked.add(expect.chainId)
    }
    const decimals = expect.token
      ? await resolveDecimals(client, expect.chainId, expect.token, expect.tokenDecimals)
      : 18
    const minAmountUnits = toUnits(expect.priceUsd, decimals)

    const receipt = await rpc(() => client.getTransactionReceipt({ hash: txHash }))
    const tx = await rpc(() => client.getTransaction({ hash: txHash }))
    const result = analyzePayment({ tx, receipt }, { ...expect, minAmountUnits })

    /* reorg safety: the receipt's block must still be canonical */
    const block = await rpc(() => client.getBlock({ blockNumber: receipt.blockNumber }))
    if (lc(block.hash) !== lc(receipt.blockHash)) throw paymentError(409, 'tx_reorged', { retryable: true })
    if (Number(block.timestamp) * 1000 < expect.notBefore) throw paymentError(400, 'tx_too_old')
    const head = await rpc(() => client.getBlockNumber())
    const confirmations = Number(head - receipt.blockNumber) + 1
    if (confirmations < (expect.minConfirmations || 0))
      throw paymentError(409, 'tx_not_final', { retryable: true, confirmations, required: expect.minConfirmations })

    return {
      ...result,
      blockTimestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
      confirmations,
      requiredConfirmations: expect.minConfirmations || 0,
      tokenDecimals: expect.token ? decimals : 18,
      minAmountUnits,
    }
  }
}

export { padAddress }
