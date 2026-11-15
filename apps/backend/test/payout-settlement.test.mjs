import assert from 'node:assert/strict'
import { test } from 'node:test'
import { encodeAbiParameters, encodeEventTopics, parseAbiItem } from 'viem'
import { payoutVerifier } from '../payout-settlement.js'

const hash = '0x' + 'ab'.repeat(32)
const blockHash = '0x' + 'cd'.repeat(32)
const sender = '0x' + '12'.repeat(20)
const recipient = '0x' + '34'.repeat(20)
const dai = '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1'
const timestamp = 1_800_000_000n
const request = { hash, recipient, amount: '123.45', approvedAt: new Date(Number(timestamp - 1n) * 1000) }
const transfer = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const log = { address: dai, logIndex: 0, topics: encodeEventTopics({ abi: [transfer], eventName: 'Transfer', args: { from: sender, to: recipient } }),
  data: encodeAbiParameters([{ type: 'uint256' }], [123450000000000000000n]) }
const receipt = { transactionHash: hash, blockNumber: 5n, blockHash, status: 'success', logs: [log] }
const reader = {
  getChainId: async () => 42161,
  getTransactionReceipt: async () => receipt,
  getBlock: async () => ({ number: 5n, hash: blockHash, timestamp }),
}
const verify = (overrides = {}) => payoutVerifier({ address: sender, chainId: 42161 }, { ...reader, ...overrides })

test('accepts exactly one canonical finalized DAI transfer matching the approved amount', async () => {
  const result = await verify()(request)
  assert.equal(result.amountUnits, '123450000000000000000')
  assert.equal(result.transactionHash, hash)
  assert.equal(result.finality, 'finalized')
})

test('rejects wrong recipient, amount, token, and ambiguous duplicate transfer logs', async () => {
  await assert.rejects(verify()({ ...request, recipient: '0x' + '56'.repeat(20) }), /payout_transfer_mismatch/)
  await assert.rejects(verify()({ ...request, amount: '123.44' }), /payout_transfer_mismatch/)
  await assert.rejects(verify({ getTransactionReceipt: async () => ({ ...receipt, logs: [{ ...log, address: sender }] }) })(request), /payout_transfer_mismatch/)
  await assert.rejects(verify({ getTransactionReceipt: async () => ({ ...receipt, logs: [log, log] }) })(request), /payout_transfer_mismatch/)
})

test('rejects evidence from the wrong network, unfinalized blocks, and transfers preceding approval', async () => {
  await assert.rejects(verify({ getChainId: async () => 1 })(request), /payout_receipt_invalid/)
  await assert.rejects(verify({ getBlock: async () => ({ number: 4n, hash: blockHash, timestamp }) })(request), /payout_not_finalized/)
  await assert.rejects(verify()({ ...request, approvedAt: new Date(Number(timestamp + 1n) * 1000) }), /payout_precedes_approval/)
})
