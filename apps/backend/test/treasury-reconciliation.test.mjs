import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import pg from 'pg'
import { reconcileTreasuryTransfers } from '../treasury-reconciliation.js'

const url = process.env.DATABASE_URL
const address = () => '0x' + randomUUID().replaceAll('-', '') + 'abcdef01'
test('treasury cursors reconcile balances, deduplicate logs, and exclude internal revenue', { skip: !url }, async () => {
  assert.match(new URL(url).pathname, /test|audit|_ci/)
  const pool = new pg.Pool({ connectionString: url })
  try {
    const treasury = address(), receiver = address(), external = address(), token = address()
    await pool.query(`INSERT INTO treasury_transfer_cursors
      (chain_id,treasury_address,token_address,next_block) VALUES (42161,$1,$2,10)`, [treasury, token])
    const event = (index, from, to, value) => ({
      transactionHash: '0x' + randomUUID().replaceAll('-', '').padStart(64, '0'), logIndex: index, blockNumber: 10n,
      args: { from, to, value },
    })
    const internal = event(0, receiver, treasury, 5n)
    const externalTransfer = event(1, treasury, external, 2n)
    const rpc = {
      getChainId: async () => 42161,
      getBlock: async () => ({ number: 10n }),
      getLogs: async ({ args }) => args.from ? [externalTransfer] : [internal, internal],
      balance: async (_token, _wallet, block) => block === 9n ? 100n : 103n,
    }
    const config = { chainId: 42161, address: treasury, assets: [{ address: token }] }
    await Promise.all([reconcileTreasuryTransfers(pool, config, rpc, [receiver]), reconcileTreasuryTransfers(pool, config, rpc, [receiver])])
    const { rows: [cursor] } = await pool.query('SELECT * FROM treasury_transfer_cursors WHERE treasury_address=$1', [treasury])
    assert.equal(cursor.next_block, '11')
    assert.equal(cursor.status, 'current')
    assert.equal(cursor.balance_units, '103')
    assert.deepEqual((await pool.query('SELECT direction FROM treasury_token_movements WHERE treasury_address=$1 ORDER BY log_index', [treasury])).rows,
      [{ direction: 'internal' }, { direction: 'outbound' }])
    await reconcileTreasuryTransfers(pool, config, { ...rpc, getBlock: async () => ({ number: 11n }), getLogs: async () => [],
      balance: async (_token, _wallet, block) => block === 10n ? 103n : 200n }, [receiver])
    const { rows: [mismatch] } = await pool.query('SELECT * FROM treasury_transfer_cursors WHERE treasury_address=$1', [treasury])
    assert.equal(mismatch.next_block, '11')
    assert.equal(mismatch.status, 'unreconciled')
    assert.equal(mismatch.difference_units, '97')
  } finally { await pool.end() }
})
