/* Minimal in-memory EVM JSON-RPC used by browser/HTTP acceptance tests.
 *
 * It lets the REAL backend verifier (viem over HTTP, chain-id check, token
 * decimals, receipt/log/reorg/finality logic) run end-to-end without a
 * network. It is a test fixture: results obtained with it are NOT evidence
 * of real payment acceptance. */
const http = require('node:http')
const crypto = require('node:crypto')

const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const hex = n => '0x' + BigInt(n).toString(16)
const word = n => '0x' + BigInt(n).toString(16).padStart(64, '0')
const pad = a => '0x' + '0'.repeat(24) + a.toLowerCase().slice(2)
const sha = s => '0x' + crypto.createHash('sha256').update(String(s)).digest('hex')
const ZERO32 = '0x' + '0'.repeat(64)
const BLOOM = '0x' + '0'.repeat(512)

function createMockChain({ chainId = 42161, decimals = 6, startBlock = 1000 } = {}) {
  const state = { head: startBlock, blocks: new Map(), txs: new Map(), down: false, calls: 0 }
  const block = n => {
    if (!state.blocks.has(n)) state.blocks.set(n, { number: n, hash: sha('block' + n), timestamp: Math.floor(Date.now() / 1000), txs: [] })
    return state.blocks.get(n)
  }
  const blockJson = b => ({
    number: hex(b.number), hash: b.hash, parentHash: n => n, timestamp: hex(b.timestamp),
    nonce: '0x0000000000000000', difficulty: '0x0', totalDifficulty: '0x0', gasLimit: hex(30_000_000), gasUsed: hex(21000),
    miner: '0x' + '0'.repeat(40), sha3Uncles: ZERO32, logsBloom: BLOOM, transactionsRoot: ZERO32, stateRoot: ZERO32, receiptsRoot: ZERO32,
    size: '0x200', extraData: '0x', mixHash: ZERO32, uncles: [], transactions: b.txs.map(t => t.hash),
  })
  const fixBlock = b => { const j = blockJson(b); j.parentHash = sha('block' + (b.number - 1)); return j }

  /** mine a block holding one transaction; returns its hash */
  function addTx({ from, to, logs = [], status = true, value = 0n }) {
    state.head += 1
    const b = block(state.head)
    const hash = sha('tx' + crypto.randomBytes(8).toString('hex'))
    const tx = { hash, from: from.toLowerCase(), to: to.toLowerCase(), value, status, blockNumber: b.number, blockHash: b.hash, index: b.txs.length,
      logs: logs.map((l, i) => ({ address: l.address.toLowerCase(), topics: l.topics, data: l.data, logIndex: i })) }
    b.txs.push(tx); state.txs.set(hash, tx)
    return hash
  }
  /** ERC-20 Transfer log helper */
  const transferLog = (token, from, to, units) => ({ address: token, topics: [TRANSFER, pad(from), pad(to)], data: word(units) })
  function mine(n = 1) { for (let i = 0; i < n; i++) { state.head += 1; block(state.head) } }
  /** replace a block hash (simulates a reorg of that height) */
  function reorg(number) { const b = block(number); b.hash = sha('reorg' + number + Math.random()) }

  const receiptJson = t => ({
    transactionHash: t.hash, transactionIndex: hex(t.index), blockHash: t.blockHash, blockNumber: hex(t.blockNumber),
    from: t.from, to: t.to, cumulativeGasUsed: hex(21000), gasUsed: hex(21000), effectiveGasPrice: hex(1), contractAddress: null,
    logsBloom: BLOOM, type: '0x2', status: t.status ? '0x1' : '0x0',
    logs: t.logs.map(l => ({ address: l.address, topics: l.topics, data: l.data, blockNumber: hex(t.blockNumber), transactionHash: t.hash,
      transactionIndex: hex(t.index), blockHash: t.blockHash, logIndex: hex(l.logIndex), removed: false })),
  })
  const txJson = t => ({
    hash: t.hash, nonce: '0x1', blockHash: t.blockHash, blockNumber: hex(t.blockNumber), transactionIndex: hex(t.index),
    from: t.from, to: t.to, value: hex(t.value), gas: hex(100000), gasPrice: hex(1), maxFeePerGas: hex(1), maxPriorityFeePerGas: hex(1),
    input: '0x', type: '0x2', chainId: hex(chainId), accessList: [], v: '0x0', r: ZERO32, s: ZERO32, yParity: '0x0',
  })

  function handle(method, params) {
    switch (method) {
      case 'eth_chainId': return hex(chainId)
      case 'eth_blockNumber': return hex(state.head)
      case 'eth_getBlockByNumber': {
        const n = params[0] === 'latest' ? state.head : Number(BigInt(params[0]))
        if (n > state.head) return null
        return fixBlock(block(n))
      }
      case 'eth_getTransactionReceipt': { const t = state.txs.get(params[0]); return t ? receiptJson(t) : null }
      case 'eth_getTransactionByHash': { const t = state.txs.get(params[0]); return t ? txJson(t) : null }
      case 'eth_call': return word(decimals) // only decimals() is ever called
      default: throw Object.assign(new Error('method not supported: ' + method), { code: -32601 })
    }
  }

  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      state.calls++
      if (state.down) { res.writeHead(503); return res.end('unavailable') }
      const run = r => {
        try { return { jsonrpc: '2.0', id: r.id, result: handle(r.method, r.params || []) } }
        catch (e) { return { jsonrpc: '2.0', id: r.id, error: { code: e.code || -32000, message: e.message } } }
      }
      let payload; try { payload = JSON.parse(body) } catch { res.writeHead(400); return res.end() }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(Array.isArray(payload) ? payload.map(run) : run(payload)))
    })
  })
  const listen = () => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)))
  return { state, addTx, mine, reorg, transferLog, listen, close: () => new Promise(r => server.close(r)), chainId }
}

module.exports = { createMockChain, TRANSFER }
