import { parseAbiItem } from 'viem'

const transfer = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const BLOCK_WINDOW = 2_000n
const MAX_WINDOWS = 24

export function movement(log, treasury, knownAddresses) {
  const from = log.args.from.toLowerCase(), to = log.args.to.toLowerCase()
  return {
    hash: log.transactionHash.toLowerCase(), logIndex: log.logIndex, block: log.blockNumber.toString(), from, to,
    amount: log.args.value.toString(),
    direction: knownAddresses.has(from) && knownAddresses.has(to) ? 'internal' : to === treasury ? 'inbound' : 'outbound',
    net: (to === treasury ? log.args.value : 0n) - (from === treasury ? log.args.value : 0n),
  }
}

export async function reconcileTreasuryTransfers(pool, config, rpc, receivers) {
  const rows = (await pool.query(`SELECT * FROM treasury_transfer_cursors
    WHERE chain_id=$1 AND treasury_address=$2 ORDER BY token_address`, [config.chainId, config.address])).rows
  if (!rows.length) return
  const known = new Set([config.address, ...receivers.map(address => address.toLowerCase())])
  let finalized
  try {
    if (await rpc.getChainId() !== config.chainId) throw new Error('wrong_chain')
    finalized = (await rpc.getBlock({ blockTag: 'finalized' })).number
  } catch {
    await pool.query("UPDATE treasury_transfer_cursors SET status='error' WHERE chain_id=$1 AND treasury_address=$2",
      [config.chainId, config.address])
    return
  }

  for (const row of rows) {
    const token = row.token_address
    const asset = config.assets.find(a => a.address === token)
    if (!asset) continue
    const key = [config.chainId, config.address, token]
    try {
      let next = BigInt(row.next_block)
      for (let batch = 0; batch < MAX_WINDOWS && next <= finalized; batch++) {
        const through = next + BLOCK_WINDOW - 1n > finalized ? finalized : next + BLOCK_WINDOW - 1n
        const filter = { address: token, event: transfer, fromBlock: next, toBlock: through, strict: true }
        const [sent, received, opening, closing] = await Promise.all([
          rpc.getLogs({ ...filter, args: { from: config.address } }),
          rpc.getLogs({ ...filter, args: { to: config.address } }),
          rpc.balance(token, config.address, next - 1n),
          rpc.balance(token, config.address, through),
        ])
        const events = [...new Map([...sent, ...received].map(log => [
          `${log.transactionHash}:${log.logIndex}`, movement(log, config.address, known)
        ])).values()]
        const difference = closing - opening - events.reduce((sum, event) => sum + event.net, 0n)
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const updated = await client.query(`UPDATE treasury_transfer_cursors
            SET next_block=$4, reconciled_block=$5, balance_units=$6, difference_units=$7,
                last_sync_at=now(), status=$8
            WHERE chain_id=$1 AND treasury_address=$2 AND token_address=$3 AND next_block=$9`,
          [...key, (difference === 0n ? through + 1n : next).toString(), through.toString(), closing.toString(), difference.toString(),
            difference !== 0n ? 'unreconciled' : through === finalized ? 'current' : 'catching_up', next.toString()])
          if (!updated.rowCount) { await client.query('ROLLBACK'); break }
          if (difference === 0n && events.length) {
            await client.query(`INSERT INTO treasury_token_movements
              (chain_id,treasury_address,token_address,transaction_hash,log_index,block_number,from_address,to_address,amount_units,direction)
              SELECT $1,$2,$3,e.hash,e."logIndex",e.block::bigint,e."from",e."to",e.amount::numeric,e.direction
              FROM jsonb_to_recordset($4::jsonb)
              AS e(hash text,"logIndex" int,block text,"from" text,"to" text,amount text,direction text)
              ON CONFLICT DO NOTHING`, [...key, JSON.stringify(events.map(({ net, ...event }) => event))])
          }
          await client.query('COMMIT')
        } catch (error) {
          await client.query('ROLLBACK')
          throw error
        } finally { client.release() }
        if (difference !== 0n) break
        next = through + 1n
      }
    } catch {
      await pool.query("UPDATE treasury_transfer_cursors SET status='error' WHERE chain_id=$1 AND treasury_address=$2 AND token_address=$3", key)
    }
  }
}
