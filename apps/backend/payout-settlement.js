import { createPublicClient, http, isAddress, parseAbiItem, parseEventLogs, parseUnits, zeroAddress } from 'viem'
import { arbitrum } from 'viem/chains'
import { treasuryConfig } from './treasury.js'

const DAI = '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1'
const transfer = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
export const payoutHash = /^0x[0-9a-f]{64}$/i
const fail = (status, message) => Object.assign(new Error(message), { status })

export function payoutVerifier(config = treasuryConfig(), reader = null) {
  const sender = config.address?.toLowerCase()
  const client = reader ?? createPublicClient({ chain: arbitrum, transport: http(config.rpcUrl, { timeout: 5000, retryCount: 0 }) })
  return async ({ hash, recipient, amount, approvedAt }) => {
    if (!payoutHash.test(hash)) throw fail(400, 'payout_transaction_hash_required')
    if (config.chainId !== arbitrum.id || !isAddress(sender || '') || sender === zeroAddress) throw fail(503, 'payout_treasury_unavailable')
    const destination = recipient?.toLowerCase()
    if (!isAddress(destination || '') || destination === sender || destination === zeroAddress) throw fail(409, 'payout_recipient_invalid')
    if (!/^\d+\.\d{2}$/.test(amount) || !approvedAt) throw fail(409, 'payout_approval_invalid')
    const units = parseUnits(amount, 18)
    if (units <= 0n) throw fail(409, 'payout_amount_invalid')
    let chainId, receipt, finalized, block
    try {
      [chainId, receipt] = await Promise.all([client.getChainId(), client.getTransactionReceipt({ hash })])
      ;[finalized, block] = await Promise.all([
        client.getBlock({ blockTag: 'finalized' }),
        client.getBlock({ blockNumber: receipt.blockNumber }),
      ])
    } catch {
      throw fail(503, 'payout_evidence_unavailable')
    }
    if (chainId !== arbitrum.id || receipt.transactionHash?.toLowerCase() !== hash.toLowerCase()
        || receipt.status !== 'success' || block.hash !== receipt.blockHash) throw fail(409, 'payout_receipt_invalid')
    if (finalized.number < receipt.blockNumber) throw fail(409, 'payout_not_finalized')
    const timestamp = new Date(Number(block.timestamp) * 1000)
    if (timestamp <= new Date(approvedAt)) throw fail(409, 'payout_precedes_approval')
    const matches = parseEventLogs({ abi: [transfer], logs: receipt.logs.filter(log => log.address.toLowerCase() === DAI) })
      .filter(({ args }) => args.from.toLowerCase() === sender && args.to.toLowerCase() === destination && args.value === units)
    if (matches.length !== 1) throw fail(409, 'payout_transfer_mismatch')
    return { chainId, token: DAI, transactionHash: hash.toLowerCase(), sender, recipient: destination,
      amount, amountUnits: units.toString(), blockNumber: receipt.blockNumber.toString(), blockHash: block.hash,
      logIndex: matches[0].logIndex, transactionAt: timestamp.toISOString(), finality: 'finalized' }
  }
}
