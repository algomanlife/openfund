/**
 * Openfund Treasury reader.
 *
 * Reads the public treasury wallet's on-chain balances on a backend
 * schedule (TREASURY_REFRESH_MINUTES, default 90, clamped to 60–120) and
 * stores each attempt in treasury_snapshots. Nothing is guessed:
 *  - balances come from the chain (native getBalance / ERC-20 balanceOf);
 *  - USD values come ONLY from a configured Chainlink aggregator per asset
 *    (latestRoundData), rejected when non-positive or older than
 *    TREASURY_PRICE_MAX_AGE_MINUTES. An asset without a valid price is
 *    shown with its balance and excluded from the USD total
 *    (fully_priced=false);
 *  - a failed read is stored as status='error'; readers keep serving the
 *    last good snapshot flagged `stale`.
 * Only a PUBLIC address is configured. No key material exists here.
 */
import { createPublicClient, http, isAddress, formatUnits, parseAbi } from 'viem'
import { mainnet, arbitrum, sepolia, base, arbitrumSepolia } from 'viem/chains'

const CHAINS = new Map([mainnet, arbitrum, sepolia, base, arbitrumSepolia].map(c => [c.id, c]))
const ERC20 = parseAbi(['function balanceOf(address) view returns (uint256)'])
const AGGREGATOR = parseAbi([
  'function decimals() view returns (uint8)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
])

const centsToUsd = c => `${c / 100n}.${String(c % 100n).padStart(2, '0')}`

export function explorerBase(chainId) {
  return CHAINS.get(Number(chainId))?.blockExplorers?.default?.url || null
}
export const explorerAddressUrl = (chainId, address) => explorerBase(chainId) ? `${explorerBase(chainId)}/address/${address}` : null
export const explorerTxUrl = (chainId, hash) => explorerBase(chainId) && /^0x[0-9a-f]{64}$/i.test(hash || '') ? `${explorerBase(chainId)}/tx/${hash}` : null

export function treasuryConfig(env = process.env) {
  const address = String(env.TREASURY_WALLET_ADDRESS || '').trim()
  const chainId = Number(env.TREASURY_CHAIN_ID || env.PURCHASE_PAYMENT_CHAIN || 42161)
  const minutes = Math.min(120, Math.max(60, Number(env.TREASURY_REFRESH_MINUTES) || 90))
  let assets = [{ symbol: CHAINS.get(chainId)?.nativeCurrency?.symbol || 'ETH', address: 'native', decimals: 18 }]
  let assetError = null
  if (env.TREASURY_ASSETS) {
    try {
      const parsed = JSON.parse(env.TREASURY_ASSETS)
      if (!Array.isArray(parsed) || !parsed.length) throw new Error('empty')
      assets = parsed.map(a => {
        const addr = a.address === 'native' ? 'native' : String(a.address || '').toLowerCase()
        if (addr !== 'native' && !isAddress(addr)) throw new Error(`invalid asset address ${a.symbol}`)
        if (a.priceFeed && !isAddress(a.priceFeed)) throw new Error(`invalid price feed ${a.symbol}`)
        const decimals = Number(a.decimals)
        if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error(`invalid decimals ${a.symbol}`)
        return { symbol: String(a.symbol || '').slice(0, 16) || '?', address: addr, decimals, priceFeed: a.priceFeed ? String(a.priceFeed).toLowerCase() : null }
      })
    } catch (e) { assetError = `TREASURY_ASSETS: ${e.message}` }
  }
  const configured = isAddress(address) && CHAINS.has(chainId) && !assetError
  return {
    configured, address: isAddress(address) ? address.toLowerCase() : null, chainId,
    network: CHAINS.get(chainId)?.name || null, rpcUrl: env.TREASURY_RPC_URL || undefined,
    refreshMinutes: minutes, priceMaxAgeMinutes: Number(env.TREASURY_PRICE_MAX_AGE_MINUTES) || 1500,
    assets, configError: !address ? 'not_configured' : !isAddress(address) ? 'invalid_address' : !CHAINS.has(chainId) ? 'unsupported_chain' : assetError,
  }
}

/** Default chain reader; injectable for tests. */
export function chainReader(config) {
  const client = createPublicClient({ chain: CHAINS.get(config.chainId), transport: http(config.rpcUrl, { timeout: 10_000, retryCount: 1 }) })
  return {
    blockNumber: () => client.getBlockNumber(),
    nativeBalance: (address, blockNumber) => client.getBalance({ address, blockNumber }),
    tokenBalance: (token, address, blockNumber) => client.readContract({ address: token, abi: ERC20, functionName: 'balanceOf', args: [address], blockNumber }),
    price: async (feed) => {
      const [decimals, round] = await Promise.all([
        client.readContract({ address: feed, abi: AGGREGATOR, functionName: 'decimals' }),
        client.readContract({ address: feed, abi: AGGREGATOR, functionName: 'latestRoundData' }),
      ])
      return { answer: round[1], decimals: Number(decimals), updatedAt: Number(round[3]) }
    },
  }
}

export class Treasury {
  constructor(pool, { config = treasuryConfig(), reader = null, now = () => Date.now() } = {}) {
    this.pool = pool; this.config = config; this.now = now
    this.reader = reader || (config.configured ? chainReader(config) : null)
    this.timer = null
  }

  /** One snapshot attempt; always records the outcome. */
  async refresh() {
    const c = this.config
    if (!c.configured) return { status: 'not_configured' }
    try {
      const blockNumber = await this.reader.blockNumber()
      const assets = []
      let totalCents = 0n, fullyPriced = true
      for (const a of c.assets) {
        const raw = a.address === 'native'
          ? await this.reader.nativeBalance(c.address, blockNumber)
          : await this.reader.tokenBalance(a.address, c.address, blockNumber)
        const balance = formatUnits(BigInt(raw), a.decimals)
        let priceUsd = null, valueUsd = null, priceUpdatedAt = null, priceError = null
        if (a.priceFeed) {
          try {
            const p = await this.reader.price(a.priceFeed)
            const ageMin = (this.now() / 1000 - p.updatedAt) / 60
            if (BigInt(p.answer) <= 0n) priceError = 'non_positive_price'
            else if (ageMin > c.priceMaxAgeMinutes) priceError = 'price_stale'
            else {
              priceUsd = formatUnits(BigInt(p.answer), p.decimals)
              priceUpdatedAt = new Date(p.updatedAt * 1000).toISOString()
              /* exact: balance(raw, decimals) × answer(decimals) → cents */
              const v = BigInt(raw) * BigInt(p.answer) * 100n / (10n ** BigInt(a.decimals + p.decimals))
              valueUsd = centsToUsd(v)
              totalCents += v
            }
          } catch (e) { priceError = 'price_read_failed' }
        } else priceError = 'no_price_source'
        if (valueUsd == null) fullyPriced = false
        assets.push({ symbol: a.symbol, address: a.address, decimals: a.decimals, balance, priceUsd, valueUsd, priceSource: a.priceFeed ? `chainlink:${a.priceFeed}` : null, priceUpdatedAt, priceError })
      }
      const { rows: [row] } = await this.pool.query(
        `INSERT INTO treasury_snapshots (chain_id, address, status, block_number, assets, total_usd, fully_priced)
         VALUES ($1,$2,'ok',$3,$4,$5,$6) RETURNING id, taken_at`,
        [c.chainId, c.address, Number(blockNumber), JSON.stringify(assets), centsToUsd(totalCents), fullyPriced])
      return { status: 'ok', id: row.id }
    } catch (e) {
      await this.pool.query(
        `INSERT INTO treasury_snapshots (chain_id, address, status, error) VALUES ($1,$2,'error',$3)`,
        [c.chainId, c.address, String(e?.shortMessage || e?.message || e).slice(0, 300)]).catch(() => {})
      return { status: 'error' }
    }
  }

  /** Public view: last good snapshot, last attempt, staleness, history. */
  async view({ historyDays = 90 } = {}) {
    const c = this.config
    const base = {
      configured: c.configured, configError: c.configured ? null : c.configError,
      address: c.address, chainId: c.chainId, network: c.network,
      explorerUrl: c.address ? explorerAddressUrl(c.chainId, c.address) : null,
      refreshMinutes: c.refreshMinutes,
    }
    if (!c.configured) return { ...base, status: 'not_configured', snapshot: null, history: [] }
    const { rows: [ok] } = await this.pool.query(
      `SELECT id, taken_at, block_number, assets, total_usd, fully_priced FROM treasury_snapshots
        WHERE address=$1 AND chain_id=$2 AND status='ok' ORDER BY taken_at DESC LIMIT 1`, [c.address, c.chainId])
    const { rows: [last] } = await this.pool.query(
      `SELECT taken_at, status, error FROM treasury_snapshots WHERE address=$1 AND chain_id=$2 ORDER BY taken_at DESC LIMIT 1`, [c.address, c.chainId])
    const history = (await this.pool.query(
      `SELECT DISTINCT ON (date_trunc('day', taken_at)) date_trunc('day', taken_at) AS day, total_usd, fully_priced, taken_at
         FROM treasury_snapshots WHERE address=$1 AND chain_id=$2 AND status='ok' AND taken_at > now() - ($3 || ' days')::interval
        ORDER BY date_trunc('day', taken_at), taken_at DESC`, [c.address, c.chainId, String(historyDays)])).rows
    const ageMs = ok ? this.now() - new Date(ok.taken_at).getTime() : Infinity
    const stale = !ok || ageMs > c.refreshMinutes * 2 * 60_000 || (last && last.status === 'error')
    return {
      ...base,
      status: ok ? (stale ? 'stale' : 'ok') : (last ? 'unavailable' : 'pending_first_read'),
      stale: !!stale,
      lastAttempt: last ? { at: last.taken_at, status: last.status } : null,
      snapshot: ok ? { takenAt: ok.taken_at, blockNumber: Number(ok.block_number), assets: ok.assets, totalUsd: ok.total_usd, fullyPriced: ok.fully_priced } : null,
      history: history.map(h => ({ day: h.day, totalUsd: h.total_usd, fullyPriced: h.fully_priced })),
    }
  }

  /** Starts the schedule; skips a read when a fresh good snapshot exists. */
  start() {
    if (!this.config.configured || this.timer) return
    const tick = async () => {
      try {
        const { rows: [ok] } = await this.pool.query(
          `SELECT taken_at FROM treasury_snapshots WHERE address=$1 AND chain_id=$2 AND status='ok' ORDER BY taken_at DESC LIMIT 1`,
          [this.config.address, this.config.chainId])
        if (ok && this.now() - new Date(ok.taken_at).getTime() < this.config.refreshMinutes * 60_000 - 60_000) return
        const r = await this.refresh()
        console.log(`[treasury] snapshot ${r.status}`)
      } catch (e) { console.error('[treasury]', e.message) }
    }
    void tick()
    this.timer = setInterval(tick, 5 * 60_000)
    this.timer.unref()
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null }
}
