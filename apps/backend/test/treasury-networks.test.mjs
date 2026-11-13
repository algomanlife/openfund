/**
 * Treasury wallets by network (transparency page) — injected readers, no
 * network. Verifies the per-network split, the configured addresses, exact
 * decimals, RPC failure isolation, cache/freshness and that no balance is
 * ever shown without a successful read.
 * Run: node --test test/treasury-networks.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { TreasuryNetworks, treasuryNetworksConfig } from '../treasury.js'

const EVM = '0x2bb7c512bb3badfcc543d5e5309d98872b10e6b9'
const SOL = '9U7cmxeHzLYBRh5gWxgzsteP8hTfZSQMfoHKSN6SQSpM'
const USDC_ARB = '0xaf88d065e77c8cc2239327c5edb3a432268e5831' // gitleaks:allow — public token contract
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' // gitleaks:allow — public token contract
const USDC_SOL = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' // gitleaks:allow — public mint
const chains = [
  { chainId: 42161, blockchain: 'arbitrum', receiver: EVM, token: USDC_ARB, tokenSymbol: 'USDC', rpcUrl: 'https://rpc.invalid/arb' },
  { chainId: 8453, blockchain: 'base', receiver: EVM, token: USDC_BASE, rpcUrl: 'https://rpc.invalid/base' },
  { chainId: 501, blockchain: 'solana', receiver: SOL, token: USDC_SOL, tokenSymbol: 'USDC', rpcUrl: 'https://rpc.invalid/sol' },
  { chainId: 56, blockchain: 'bsc', receiver: null, token: null },           /* incomplete: not shown */
]
const reader = (balances, fail = new Set()) => n => ({
  native: async () => { if (fail.has(n.chainId)) throw new Error('rpc down'); return balances[n.chainId].native },
  token: async () => { if (fail.has(n.chainId)) throw new Error('rpc down'); return balances[n.chainId].token },
})
const BAL = {
  42161: { native: { raw: 1_500_000_000_000_000_000n, decimals: 18, symbol: 'ETH', name: 'Ether' }, token: { raw: 1_234_567_891n, decimals: 6, symbol: 'USDC' } },
  8453: { native: { raw: 1n, decimals: 18, symbol: 'ETH', name: 'Ether' }, token: { raw: 0n, decimals: 6, symbol: 'USDC' } },
  501: { native: { raw: 2_000_000_001n, decimals: 9, symbol: 'SOL', name: 'Solana' }, token: { raw: 49_000_000n, decimals: 6, symbol: null } },
}

test('networks come from the settlement configuration: one entry per chain, same EVM address on each', () => {
  const n = treasuryNetworksConfig(chains)
  assert.deepEqual(n.map(x => [x.blockchain, x.address, x.family]), [['arbitrum', EVM, 'evm'], ['base', EVM, 'evm'], ['solana', SOL, 'solana']])
  assert.equal(n[2].symbols[USDC_SOL], 'USDC')
})

test('balances are reported per network with exact decimals and explorer links (never summed)', async () => {
  const t = new TreasuryNetworks({ networks: treasuryNetworksConfig(chains), readerFor: reader(BAL) })
  const v = await t.view()
  const arb = v.networks.find(n => n.blockchain === 'arbitrum'), sol = v.networks.find(n => n.blockchain === 'solana')
  assert.equal(arb.status, 'ok'); assert.match(arb.explorerUrl, /arbiscan\.io\/address\/0x2bb7/)
  assert.deepEqual(arb.balances.map(b => [b.symbol, b.balance, b.decimals]), [['ETH', '1.5', 18], ['USDC', '1234.567891', 6]])
  assert.deepEqual(sol.balances.map(b => [b.symbol, b.balance]), [['SOL', '2.000000001'], ['USDC', '49']])
  assert.match(sol.explorerUrl, /solscan\.io\/account\/9U7c/)
  assert.ok(!('totalUsd' in v) && v.networks.every(n => !('totalUsd' in n)))
  assert.ok(arb.readAt)
})

test('an RPC failure on one network does not hide the others and shows no invented number', async () => {
  const t = new TreasuryNetworks({ networks: treasuryNetworksConfig(chains), readerFor: reader(BAL, new Set([8453])) })
  const v = await t.view()
  const base = v.networks.find(n => n.blockchain === 'base')
  assert.equal(base.status, 'error'); assert.deepEqual(base.balances, []); assert.equal(base.readAt, null); assert.ok(base.error)
  assert.equal(v.networks.find(n => n.blockchain === 'arbitrum').status, 'ok')
})

test('a network without an RPC endpoint reports an error, not a balance', async () => {
  const t = new TreasuryNetworks({ networks: treasuryNetworksConfig([{ ...chains[0], rpcUrl: null }]) })
  const [n] = (await t.view()).networks
  assert.equal(n.status, 'error'); assert.equal(n.error, 'rpc_not_configured'); assert.deepEqual(n.balances, [])
})

test('cache: reads at most once per TTL; a later failure keeps the last good read flagged stale with its time', async () => {
  let now = 1_000_000, calls = 0
  const fail = new Set()
  const counting = n => { const r = reader(BAL, fail)(n); return { native: async () => { calls++; return r.native() }, token: r.token } }
  const t = new TreasuryNetworks({ networks: treasuryNetworksConfig([chains[0]]), readerFor: counting, ttlMs: 60_000, now: () => now })
  await t.view(); await t.view(); await Promise.all([t.view(), t.view()])
  assert.equal(calls, 1)
  const firstRead = (await t.view()).networks[0].readAt
  now += 61_000; fail.add(42161)
  const [n] = (await t.view()).networks
  assert.equal(calls, 2); assert.equal(n.status, 'stale'); assert.equal(n.readAt, firstRead)
  assert.notEqual(n.attemptedAt, n.readAt); assert.equal(n.balances[1].balance, '1234.567891')
})
