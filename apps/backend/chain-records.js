/**
 * On-chain certificates and trade records (ADR 0063).
 *
 * schema.sql triggers queue one `chain_records` row per record in the same
 * transaction as the trade or milestone that causes it. This worker sends the
 * queue, oldest first, to the two Openfund contracts on Arbitrum Sepolia:
 *
 *  - OpenfundCertificate.issue / setStatus — soulbound certificates;
 *  - OpenfundTradeLedger.record           — position events.
 *
 * Openfund's operator key pays every transaction; traders never sign or pay.
 * Recording never blocks trading: a failed send stays queued and is retried
 * with backoff. Both contracts treat a repeated record id / token id as a
 * no-op, so a transaction that was mined but not confirmed here (a crash, an
 * RPC timeout) is safe to send again.
 *
 * Disabled unless CHAIN_RECORDS_ENABLED=1 and the key and both contract
 * addresses are set; rows then simply wait in the queue.
 */
import { createPublicClient, createWalletClient, defineChain, http, keccak256, stringToBytes, parseAbi, formatEther, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { Router } from 'express'
import { limiter } from './rate-limit-store.js'

export const CERTIFICATE_KINDS = Object.freeze({ purchase: 1, trial: 2, stage_pass: 3, final_pass: 4, trial_pass: 5, payout: 6 })
export const CERTIFICATE_STATUS = Object.freeze({ active: 0, passed: 1, failed: 2, expired: 3, revoked: 4 })
export const TRADE_ACTIONS = Object.freeze({ open: 1, modify: 2, partial_close: 3, close: 4 })
/* certificates-table kind → chain record key prefix (completion = the final pass) */
export const CERTIFICATE_CHAIN_KEY = Object.freeze({ purchase: 'purchase', trial: 'trial', stage_pass: 'stage_pass', trial_pass: 'trial_pass', payout: 'payout', completion: 'final_pass' })

export const CERTIFICATE_ABI = parseAbi([
  'function issue(address to, uint256 tokenId, uint8 kind, bytes16 challengeId, uint128 amountCents, uint64 eventAt) returns (bool)',
  'function setStatus(uint256 tokenId, uint8 status)',
])
export const LEDGER_ABI = parseAbi([
  'function record((bytes32 recordId, bytes16 challengeId, bytes16 positionId, bytes16 parentPositionId, uint8 action, bool long, uint32 leverage, uint64 at, string market, int256 quantity, int256 entryPrice, int256 exitPrice, int256 stopLoss, int256 takeProfit, int256 realizedPnl, string exitReason) trade) returns (bool)',
])

const ZERO16 = '0x00000000000000000000000000000000'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/* ------------------------------------------------------------------ encoding */

/** keccak256 of the record key: the on-chain record id. */
export const recordId = key => keccak256(stringToBytes(String(key)))
/** the certificate token id for a certificate record key. */
export const tokenIdOf = key => BigInt(recordId(key))
/** uuid → bytes16 (zero for null). */
export function uuidBytes16(uuid) {
  if (uuid == null || uuid === '') return ZERO16
  if (!UUID.test(String(uuid))) throw new Error('invalid_uuid')
  return `0x${String(uuid).replace(/-/g, '').toLowerCase()}`
}
/** exact decimal string → fixed point with `decimals` digits (truncated); null/'' → 0n. */
export function fixedPoint(value, decimals = 10) {
  if (value == null || value === '') return 0n
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(String(value).trim())
  if (!m) throw new Error('invalid_decimal')
  const frac = (m[3] ?? '').slice(0, decimals).padEnd(decimals, '0')
  const n = BigInt(m[2] + frac)
  return m[1] ? -n : n
}
const seconds = iso => BigInt(Math.floor(new Date(iso ?? Date.now()).getTime() / 1000))

/** issue(...) arguments of a certificate row */
export function certificateArgs(row) {
  const p = row.payload
  const kind = CERTIFICATE_KINDS[p.certificateKind]
  if (!kind) throw new Error('unknown_certificate_kind')
  return [p.holder, tokenIdOf(row.record_key), kind, uuidBytes16(p.challengeId), fixedPoint(p.amountUsd, 2), seconds(p.eventAt)]
}

/** setStatus(...) arguments of a certificate_status row */
export function statusArgs(row) {
  const status = CERTIFICATE_STATUS[row.payload.status]
  if (status == null) throw new Error('unknown_certificate_status')
  return [tokenIdOf(row.payload.certificateKey), status]
}

/** record(...) argument of a trade row */
export function tradeArgs(row) {
  const p = row.payload
  const action = TRADE_ACTIONS[p.action]
  if (!action) throw new Error('unknown_trade_action')
  return [{
    recordId: recordId(row.record_key),
    challengeId: uuidBytes16(p.challengeId),
    positionId: uuidBytes16(p.positionId),
    parentPositionId: uuidBytes16(p.parentPositionId),
    action,
    long: p.side === 'long',
    leverage: Number(p.leverage) || 0,
    at: seconds(p.at),
    market: String(p.market ?? ''),
    quantity: fixedPoint(p.quantity),
    entryPrice: fixedPoint(p.entryPrice),
    exitPrice: fixedPoint(p.exitPrice),
    stopLoss: fixedPoint(p.stopLoss),
    takeProfit: fixedPoint(p.takeProfit),
    realizedPnl: fixedPoint(p.realizedPnl),
    exitReason: String(p.exitReason ?? ''),
  }]
}

/* ------------------------------------------------------------------ config */

export function chainRecordsConfig(env = process.env) {
  const chainId = Number(env.CHAIN_RECORDS_CHAIN_ID || 421614)
  const cfg = {
    requested: env.CHAIN_RECORDS_ENABLED === '1',
    chainId,
    network: chainId === 421614 ? 'Arbitrum Sepolia' : `chain ${chainId}`,
    rpcUrl: env.CHAIN_RECORDS_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: (env.CHAIN_RECORDS_EXPLORER_URL || 'https://sepolia.arbiscan.io').replace(/\/+$/, ''),
    certificateAddress: env.CHAIN_RECORDS_CERTIFICATE_ADDRESS || null,
    ledgerAddress: env.CHAIN_RECORDS_LEDGER_ADDRESS || null,
    privateKey: env.CHAIN_RECORDS_PRIVATE_KEY || null,
    minBalanceWei: (() => { try { return parseEther(env.CHAIN_RECORDS_MIN_BALANCE_ETH || '0.01') } catch { return parseEther('0.01') } })(),
    batch: Math.max(1, Math.min(50, Number(env.CHAIN_RECORDS_BATCH || 10))),
    maxAttempts: Math.max(1, Number(env.CHAIN_RECORDS_MAX_ATTEMPTS || 20)),
  }
  const address = v => /^0x[0-9a-fA-F]{40}$/.test(String(v || ''))
  cfg.problems = []
  if (cfg.requested) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(String(cfg.privateKey || ''))) cfg.problems.push('CHAIN_RECORDS_PRIVATE_KEY')
    if (!address(cfg.certificateAddress)) cfg.problems.push('CHAIN_RECORDS_CERTIFICATE_ADDRESS')
    if (!address(cfg.ledgerAddress)) cfg.problems.push('CHAIN_RECORDS_LEDGER_ADDRESS')
    if (!Number.isInteger(chainId) || chainId <= 0) cfg.problems.push('CHAIN_RECORDS_CHAIN_ID')
  }
  cfg.enabled = cfg.requested && cfg.problems.length === 0
  return cfg
}

export const txUrl = (cfg, hash) => (hash ? `${cfg.explorerUrl}/tx/${hash}` : null)
export const tokenUrl = (cfg, tokenId) => (tokenId && cfg.certificateAddress ? `${cfg.explorerUrl}/nft/${cfg.certificateAddress}/${BigInt(tokenId).toString()}` : null)

/* ------------------------------------------------------------------ worker */

export class ChainRecorder {
  constructor({ pool, config = chainRecordsConfig(), clients = null, log = console }) {
    this.pool = pool
    this.cfg = config
    this.log = log
    this.running = false
    this.lastTickAt = null
    this.lastError = null
    this.balanceWei = null
    this.balanceCheckedAt = 0
    if (clients) {
      this.wallet = clients.wallet
      this.public = clients.public
      this.operator = clients.operator ?? null
    } else if (config.enabled) {
      const account = privateKeyToAccount(config.privateKey)
      const chain = defineChain({ id: config.chainId, name: config.network, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: [config.rpcUrl] } }, blockExplorers: { default: { name: 'Arbiscan', url: config.explorerUrl } } })
      this.wallet = createWalletClient({ account, chain, transport: http(config.rpcUrl) })
      this.public = createPublicClient({ chain, transport: http(config.rpcUrl) })
      this.operator = account.address
    }
  }

  get enabled() { return this.cfg.enabled && !!this.wallet }

  /** Claim due rows (oldest first); stale `sending` rows are re-sent (idempotent on chain). */
  async claim(limit = this.cfg.batch) {
    const { rows } = await this.pool.query(
      `UPDATE chain_records SET status='sending', attempts=attempts+1, sent_at=now()
        WHERE id IN (SELECT id FROM chain_records
                      WHERE (status='pending' AND next_attempt_at <= now())
                         OR (status='sending' AND sent_at < now() - interval '10 minutes')
                      ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED)
        RETURNING *`, [limit])
    return rows.sort((a, b) => Number(a.id) - Number(b.id))
  }

  async send(row) {
    const write = (address, abi, functionName, args) => this.wallet.writeContract({ address, abi, functionName, args })
    if (row.kind === 'certificate') return write(this.cfg.certificateAddress, CERTIFICATE_ABI, 'issue', certificateArgs(row))
    if (row.kind === 'certificate_status') return write(this.cfg.certificateAddress, CERTIFICATE_ABI, 'setStatus', statusArgs(row))
    if (row.kind === 'trade') return write(this.cfg.ledgerAddress, LEDGER_ABI, 'record', tradeArgs(row))
    throw new Error('unknown_record_kind')
  }

  async process(row) {
    try {
      const hash = await this.send(row)
      const receipt = await this.public.waitForTransactionReceipt({ hash, timeout: 120_000 })
      if (receipt.status !== 'success') throw new Error(`transaction_reverted ${hash}`)
      await this.pool.query(
        `UPDATE chain_records SET status='confirmed', tx_hash=$2, block_number=$3, chain_id=$4, token_id=$5,
           confirmed_at=now(), last_error=NULL WHERE id=$1`,
        [row.id, hash.toLowerCase(), Number(receipt.blockNumber), this.cfg.chainId,
          row.kind === 'certificate' ? tokenIdOf(row.record_key).toString() : null])
      return true
    } catch (e) {
      const message = String(e?.shortMessage || e?.message || e).slice(0, 500)
      const failed = row.attempts >= this.cfg.maxAttempts
      const delaySeconds = Math.min(3600, 10 * 2 ** Math.min(row.attempts, 9))
      await this.pool.query(
        `UPDATE chain_records SET status=$2, last_error=$3, next_attempt_at=now() + ($4::int * interval '1 second') WHERE id=$1`,
        [row.id, failed ? 'failed' : 'pending', message, delaySeconds])
      this.lastError = message
      return false
    }
  }

  /** One pass: send the due rows in order; stop the pass at the first failure so later records wait. */
  async tick() {
    if (!this.enabled) return 0
    this.lastTickAt = Date.now()
    await this.checkBalance().catch(e => { this.lastError = String(e?.message || e) })
    let sent = 0
    for (const row of await this.claim()) {
      if (!(await this.process(row))) {
        /* release the rest of the batch for the next pass, keeping the order */
        await this.pool.query(`UPDATE chain_records SET status='pending' WHERE status='sending' AND id > $1 AND sent_at >= now() - interval '1 minute'`, [row.id])
        break
      }
      sent++
    }
    return sent
  }

  async checkBalance(force = false) {
    if (!this.public || !this.operator) return null
    if (!force && Date.now() - this.balanceCheckedAt < 300_000) return this.balanceWei
    this.balanceWei = await this.public.getBalance({ address: this.operator })
    this.balanceCheckedAt = Date.now()
    if (this.balanceWei < this.cfg.minBalanceWei) this.log.warn?.(`[chain-records] operator balance low: ${formatEther(this.balanceWei)} ETH (${this.operator})`)
    return this.balanceWei
  }

  start(intervalMs = 5000) {
    if (!this.enabled || this.timer) return
    this.running = true
    const loop = async () => {
      try { await this.tick() } catch (e) { this.lastError = String(e?.message || e); this.log.error?.('[chain-records]', this.lastError) }
      if (this.running) this.timer = setTimeout(loop, intervalMs)
    }
    this.timer = setTimeout(loop, 1000)
  }

  stop() { this.running = false; clearTimeout(this.timer); this.timer = null }

  async status() {
    const counts = Object.fromEntries((await this.pool.query(
      `SELECT status, count(*)::int AS n FROM chain_records GROUP BY status`)).rows.map(r => [r.status, r.n]))
    return {
      enabled: this.enabled,
      configurationProblems: this.cfg.requested ? this.cfg.problems : [],
      network: this.cfg.network, chainId: this.cfg.chainId, explorerUrl: this.cfg.explorerUrl,
      contracts: { certificate: this.cfg.certificateAddress, ledger: this.cfg.ledgerAddress },
      operator: this.operator,
      balanceEth: this.balanceWei == null ? null : formatEther(this.balanceWei),
      lowBalance: this.balanceWei == null ? null : this.balanceWei < this.cfg.minBalanceWei,
      queue: { pending: (counts.pending ?? 0) + (counts.sending ?? 0), confirmed: counts.confirmed ?? 0, failed: counts.failed ?? 0 },
      lastTickAt: this.lastTickAt ? new Date(this.lastTickAt).toISOString() : null,
    }
  }
}

/* ------------------------------------------------------------------ routes */

const CERTIFICATE_NAMES = {
  purchase: 'Challenge Purchase Certificate', trial: 'Free Trial Start Certificate', stage_pass: 'Phase 1 Pass Certificate',
  final_pass: 'Challenge Pass Certificate', trial_pass: 'Free Trial Pass Certificate', payout: 'Payout Certificate',
}

const recordView = (cfg, r) => ({
  kind: r.kind,
  action: r.payload?.action ?? null,
  certificateKind: r.payload?.certificateKind ?? null,
  certificateStatus: r.kind === 'certificate_status' ? r.payload?.status ?? null : null,
  challengeId: r.challenge_id, positionId: r.position_id,
  market: r.payload?.market ?? null, side: r.payload?.side ?? null,
  quantity: r.payload?.quantity ?? null, entryPrice: r.payload?.entryPrice ?? null, exitPrice: r.payload?.exitPrice ?? null,
  stopLoss: r.payload?.stopLoss ?? null, takeProfit: r.payload?.takeProfit ?? null, realizedPnl: r.payload?.realizedPnl ?? null,
  at: r.payload?.at ?? r.payload?.eventAt ?? r.created_at,
  status: r.status, txHash: r.tx_hash, txUrl: txUrl(cfg, r.tx_hash),
  tokenId: r.token_id, tokenUrl: tokenUrl(cfg, r.token_id),
})

/** Public, read-only: every record is public on chain by owner decision (ADR 0063). */
export function chainRecordRoutes({ pool, recorder }) {
  const router = Router()
  const cfg = recorder.cfg
  const readLimit = limiter('chain.records.read', {
    windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'rate_limited' },
  })
  router.get('/chain/status', readLimit, async (req, res, next) => {
    try { res.set('Cache-Control', 'no-store').json(await recorder.status()) } catch (e) { next(e) }
  })
  router.get('/chain/challenges/:id/records', readLimit, async (req, res, next) => {
    try {
      if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'not_found' })
      /* the whole evaluation chain: the stage-1 root and every later stage */
      const { rows } = await pool.query(
        `WITH RECURSIVE root AS (SELECT openfund_chain_root($1::uuid) AS id),
              chain AS (SELECT c.id FROM openfund_challenges c, root WHERE c.id = root.id
                        UNION SELECT c.id FROM openfund_challenges c JOIN chain ON c.parent_challenge_id = chain.id)
         SELECT r.* FROM chain_records r WHERE r.challenge_id IN (SELECT id FROM chain)
          ORDER BY r.id DESC LIMIT 500`, [req.params.id])
      res.set('Cache-Control', 'no-store').json({ network: cfg.network, chainId: cfg.chainId, explorerUrl: cfg.explorerUrl,
        contracts: { certificate: cfg.certificateAddress, ledger: cfg.ledgerAddress }, records: rows.map(r => recordView(cfg, r)) })
    } catch (e) { next(e) }
  })
  /* tokenURI metadata: OpenfundCertificate.baseURI + 0x<64 hex token id> */
  router.get('/chain/certificates/:tokenId', readLimit, async (req, res, next) => {
    try {
      if (!/^0x[0-9a-f]{64}$/.test(req.params.tokenId)) return res.status(404).json({ error: 'not_found' })
      const id = BigInt(req.params.tokenId).toString()
      const row = (await pool.query(`SELECT * FROM chain_records WHERE kind='certificate' AND token_id=$1 AND status='confirmed'`, [id])).rows[0]
      if (!row) return res.status(404).json({ error: 'not_found' })
      const p = row.payload
      const status = (await pool.query(`SELECT payload->>'status' AS status FROM chain_records WHERE kind='certificate_status' AND payload->>'certificateKey'=$1 AND status='confirmed' ORDER BY id DESC LIMIT 1`, [row.record_key])).rows[0]?.status ?? 'active'
      res.set('Cache-Control', 'public, max-age=300').json({
        name: CERTIFICATE_NAMES[p.certificateKind] ?? 'Openfund Certificate',
        description: 'A non-transferable Openfund certificate recorded on Arbitrum Sepolia. Openfund accounts are simulated; a certificate is not money and not a financial instrument.',
        external_url: txUrl(cfg, row.tx_hash),
        attributes: [
          { trait_type: 'Kind', value: p.certificateKind },
          { trait_type: 'Account size (USD)', value: Number(p.amountUsd) },
          { trait_type: 'Challenge', value: p.challengeId },
          { trait_type: 'Status', value: status },
          { trait_type: 'Event date', display_type: 'date', value: Math.floor(new Date(p.eventAt).getTime() / 1000) },
        ],
      })
    } catch (e) { next(e) }
  })
  return router
}
