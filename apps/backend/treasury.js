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

/* ======================================================================
 * Treasury wallets by network (public transparency page).
 *
 * The Openfund treasury addresses are the settlement receivers of the
 * payment configuration (PURCHASE_PAYMENT_CHAINS — the one place they are
 * configured; nothing is hard-coded here). Balances are read per network
 * through the same dedicated RPC endpoints the payment verifier uses
 * (PURCHASE_RPC_URLS, Alchemy in production) and are NEVER summed across
 * networks or converted to USD: a treasury balance is not revenue, profit,
 * payout liquidity or a guaranteed reserve.
 *
 *  - native coin + the network's configured settlement token(s);
 *  - token decimals and symbol are read from the chain (ERC-20 decimals()/
 *    symbol(), SPL mint account), never assumed;
 *  - each network is cached for `ttlMs` and refreshed single-flight, so the
 *    public endpoint cannot multiply RPC traffic;
 *  - a failed network read keeps its last good balances, flagged `stale`
 *    with the time they were read; without a good read it reports `error`
 *    and no number at all. Other networks are unaffected.
 * ====================================================================== */
import { SUPPORTED_CHAINS as PAYMENT_CHAINS, SOLANA_CHAIN_ID, chainNameOf, explorerAddressUrlFor, explorerTokenUrlFor, blockchainOf } from './payment-verification.js'

const ERC20_META = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
])

/** networks to show: one entry per configured settlement chain with a receiver */
export function treasuryNetworksConfig(paymentChains = []) {
  const byChain = new Map()
  for (const c of paymentChains) {
    if (!c || !c.receiver) continue
    const solana = c.chainId === SOLANA_CHAIN_ID
    if (!solana && !PAYMENT_CHAINS.has(c.chainId)) continue
    const key = `${c.chainId}:${c.receiver}`
    const n = byChain.get(key) || { chainId: c.chainId, blockchain: c.blockchain || blockchainOf(c.chainId), family: solana ? 'solana' : 'evm',
      network: chainNameOf(c.chainId), address: c.receiver, tokens: [], symbols: {}, rpcUrl: c.rpcUrl || null }
    if (c.token && !n.tokens.includes(c.token)) n.tokens.push(c.token)
    if (c.token && c.tokenSymbol) n.symbols[c.token] = c.tokenSymbol
    byChain.set(key, n)
  }
  return [...byChain.values()]
}

const units = (raw, decimals) => formatUnits(BigInt(raw), Number(decimals))

/** default network reader (injectable for tests) */
export function networkReader(n) {
  if (!n.rpcUrl) return null
  if (n.family === 'solana') {
    const rpc = async (method, params) => {
      const res = await fetch(n.rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
      if (!res.ok) throw new Error(`rpc_http_${res.status}`)
      const body = await res.json()
      if (body.error) throw new Error('rpc_error')
      return body.result
    }
    return {
      native: async () => ({ raw: BigInt((await rpc('getBalance', [n.address, { commitment: 'finalized' }]))?.value ?? 0), decimals: 9, symbol: 'SOL', name: 'Solana' }),
      token: async mint => {
        /* the mint filter selects the token accounts of either SPL program */
        const r = await rpc('getTokenAccountsByOwner', [n.address, { mint }, { encoding: 'jsonParsed', commitment: 'finalized' }])
        let raw = 0n, decimals = null
        for (const a of r?.value || []) {
          const amt = a.account?.data?.parsed?.info?.tokenAmount
          if (!amt) continue
          raw += BigInt(amt.amount); decimals = Number(amt.decimals)
        }
        if (decimals == null) decimals = Number((await rpc('getTokenSupply', [mint]))?.value?.decimals)
        if (!Number.isInteger(decimals)) throw new Error('mint_decimals_unknown')
        return { raw, decimals, symbol: null, name: null }
      },
    }
  }
  const client = createPublicClient({ chain: PAYMENT_CHAINS.get(n.chainId), transport: http(n.rpcUrl, { timeout: 10_000, retryCount: 1 }) })
  return {
    native: async () => {
      const c = PAYMENT_CHAINS.get(n.chainId).nativeCurrency
      return { raw: await client.getBalance({ address: n.address }), decimals: c.decimals, symbol: c.symbol, name: c.name }
    },
    token: async token => {
      const [raw, decimals, symbol] = await Promise.all([
        client.readContract({ address: token, abi: ERC20_META, functionName: 'balanceOf', args: [n.address] }),
        client.readContract({ address: token, abi: ERC20_META, functionName: 'decimals' }),
        client.readContract({ address: token, abi: ERC20_META, functionName: 'symbol' }).catch(() => null),
      ])
      return { raw, decimals: Number(decimals), symbol: typeof symbol === 'string' ? symbol.slice(0, 16) : null, name: null }
    },
  }
}

export class TreasuryNetworks {
  constructor({ networks = [], readerFor = networkReader, ttlMs = 5 * 60_000, now = () => Date.now() } = {}) {
    this.networks = networks; this.ttlMs = ttlMs; this.now = now
    this.readers = new Map(networks.map(n => [n, readerFor(n)]))
    this.state = new Map()   /* network → { good, goodAt, attemptAt, error, inflight } */
  }

  async read(n) {
    const reader = this.readers.get(n)
    if (!reader) throw new Error('rpc_not_configured')
    const balances = []
    const native = await reader.native()
    balances.push({ kind: 'native', symbol: native.symbol, name: native.name, decimals: native.decimals, contract: null,
      raw: native.raw.toString(), balance: units(native.raw, native.decimals), contractExplorerUrl: null })
    for (const token of n.tokens) {
      const t = await reader.token(token)
      /* the on-chain symbol; else the configured display symbol (SPL mints carry none) */
      balances.push({ kind: 'token', symbol: t.symbol || n.symbols?.[token] || null, name: t.name, decimals: t.decimals, contract: token,
        raw: t.raw.toString(), balance: units(t.raw, t.decimals), contractExplorerUrl: explorerTokenUrlFor(n.chainId, token) })
    }
    return balances
  }

  async refresh(n) {
    const s = this.state.get(n) || {}
    if (s.inflight) return s.inflight
    s.inflight = (async () => {
      s.attemptAt = this.now()
      try { s.good = await this.read(n); s.goodAt = s.attemptAt; s.error = null }
      catch (e) { s.error = String(e?.shortMessage || e?.message || e).slice(0, 120) }
      finally { s.inflight = null }
    })()
    this.state.set(n, s)
    return s.inflight
  }

  /** public view; refreshes networks whose last attempt is older than the TTL */
  async view() {
    await Promise.all(this.networks.map(n => {
      const s = this.state.get(n)
      return !s || !s.attemptAt || this.now() - s.attemptAt >= this.ttlMs ? this.refresh(n) : s.inflight
    }))
    return {
      generatedAt: new Date(this.now()).toISOString(),
      cacheSeconds: Math.round(this.ttlMs / 1000),
      networks: this.networks.map(n => {
        const s = this.state.get(n) || {}
        const status = s.good ? (s.error ? 'stale' : 'ok') : (s.error ? 'error' : 'pending')
        return {
          chainId: n.chainId, blockchain: n.blockchain, network: n.network, family: n.family,
          address: n.address, explorerUrl: explorerAddressUrlFor(n.chainId, n.address),
          status, readAt: s.goodAt ? new Date(s.goodAt).toISOString() : null,
          attemptedAt: s.attemptAt ? new Date(s.attemptAt).toISOString() : null,
          error: s.error || null,
          /* last good balances (labelled with readAt); none without a good read */
          balances: s.good || [],
        }
      }),
    }
  }
}
