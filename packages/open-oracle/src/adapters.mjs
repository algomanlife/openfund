import { PublicTransport, ProviderError, array, timestamp } from './transport.mjs';
import { decimal, format, divRound, SCALE } from './decimal.ts';
import { setTimeout as delay } from 'node:timers/promises';
const valid = value => { if (typeof value !== 'string') throw new ProviderError('INVALID_PRICE'); const n = decimal(value); if (n <= 0n) throw new ProviderError('INVALID_PRICE'); return String(value); };
const rows = response => array(response?.data);
const entries = response => Array.isArray(response) ? response : response && typeof response === 'object' ? Object.entries(response).map(([id, value]) => ({ ...value, _key: id })) : array(response);
class Adapter {
  constructor(source, options = {}) {
    this.source = source; this.transport = options.transport ?? new PublicTransport(); this.now = options.now ?? Date.now;
    this.inventory = []; this.errors = []; this.inventoryComplete = false;
    this.capabilities = { discovery: true, prices: true, streaming: 'BOUNDED_REST_POLL', historical: 'PROVIDER_REFERENCE_ONLY', oracleHistory: false };
  }
  error(error, sourceMarketId) { this.errors.push({ code: error.code ?? 'SCHEMA_INVALID', sourceMarketId, at: this.now() }); if (this.errors.length > 200) this.errors.shift(); }
  health() { return { source: this.source, inventoryComplete: this.inventoryComplete, marketCount: this.inventory.length,
    capabilities: this.capabilities, errors: this.errors, transport: { ...this.transport.metrics } }; }
  observation(sourceMarketId, price, providerTime, raw, extra = {}) {
    const receivedAt = this.now(), ts = timestamp(providerTime);
    return { source: this.source, sourceMarketId, price: valid(price), timestamp: ts ?? receivedAt,
      receivedAt, timestampKind: ts ? 'PROVIDER' : 'RECEIPT', semantics: 'UNDERLYING_REFERENCE', raw, ...extra };
  }
  async *stream({ signal, intervalMs = 2000, onHealth = () => {} } = {}) {
    if (!Number.isSafeInteger(intervalMs) || intervalMs < 500) throw new Error('poll_interval_too_short');
    let failures = 0;
    while (!signal?.aborted) {
      try { const observations = await this.snapshot(signal); onHealth({ time: this.now(), received: true, valid: observations.length > 0, timely: observations.some(o => this.now() - o.timestamp <= 10000) }); yield observations; failures = 0; }
      catch (error) { if (signal?.aborted) break; this.error(error); failures++; onHealth({ time: this.now(), received: false, valid: false, timely: false }); }
      try { await delay(Math.max(intervalMs, Math.min(30000, 500 * 2 ** Math.min(failures, 6))), undefined, { signal }); }
      catch { break; }
    }
  }
}
export class GainsAdapter extends Adapter {
  constructor(options = {}) { super('gains', options); this.url = options.url ?? 'https://api.gains.trade/v1/arbitrum'; }
  async discover(signal) {
    const response = await this.transport.request(`${this.url}/markets`, undefined, signal);
    this.inventory = rows(response).map((m, i) => ({ sourceMarketId: String(m?.symbol ?? `unresolved:${i}`), symbol: m?.symbol,
      baseAsset: m?.base, quoteAsset: m?.quote ?? (m?.symbol?.includes('/') ? m.symbol.split('/')[1] : null),
      assetClass: m?.category ?? m?.group ?? 'UNKNOWN', instrumentType: 'REFERENCE', unit: m?.base,
      priceDecimals: m?.priceDecimals ?? m?.decimals ?? 24, marketHours: m?.marketHours ?? null,
      session: m?.isOpen === false ? 'CLOSED' : m?.isOpen === true ? 'OPEN' : 'UNKNOWN',
      identityVerified: Boolean(m?.symbol && m?.base), semantics: 'UNDERLYING_REFERENCE', raw: m,
      identityEvidence: 'Gains market catalog base/quote; source-scoped identity only' }));
    this.inventoryComplete = true; return this.inventory;
  }
  async snapshot(signal) {
    const data = rows(await this.transport.request(`${this.url}/prices`, undefined, signal)), out = [];
    for (const p of data) try {
      // Reference index only: a missing index never silently substitutes a mark.
      out.push(this.observation(String(p.market), p.index, p.updatedAt, p, { microstructure: { markPrice: p.mark ?? null } }));
    } catch (error) { this.error(error, p?.market); }
    return out;
  }
  async historical(sourceMarketId, { from, to, interval = '1m', signal } = {}) {
    if (!['1m', '5m', '15m', '30m', '1h', '4h', '1d'].includes(interval) || !(from > 0 && to >= from)) throw new Error('unsupported_history_request');
    const response = await this.transport.request(`${this.url}/markets/${encodeURIComponent(sourceMarketId.replace('/', '-'))}/candles?interval=${interval}&from=${from}&to=${to}`, undefined, signal);
    return rows(response).map(c => ({ source: this.source, sourceMarketId, dataKind: 'PROVIDER_REFERENCE', semantics: 'PROVIDER_OHLC', raw: c, timestamp: timestamp(c.time) }));
  }
}
export class HyperliquidAdapter extends Adapter {
  constructor(options = {}) { super('hyperliquid', options); this.url = options.url ?? 'https://api.hyperliquid.xyz/info'; this.dexs = ['']; this.spot = []; }
  async info(body, signal) { return this.transport.request(this.url, body, signal); }
  parsePerps(response, dex, receivedAt = this.now()) {
    if (!Array.isArray(response) || !Array.isArray(response[0]?.universe) || !Array.isArray(response[1]) || response[0].universe.length !== response[1].length) throw new ProviderError('SCHEMA_INVALID');
    return response[0].universe.map((m, i) => ({ metadata: {
      sourceMarketId: `${dex || 'main'}/${m.name ?? `unresolved:${i}`}`, coin: m.name, dex, symbol: m.name,
      baseAsset: m.name, quoteAsset: dex ? null : 'USD', assetClass: dex ? 'UNKNOWN' : 'CRYPTO',
      instrumentType: 'PERPETUAL_UNDERLYING', priceDecimals: 24, unit: m.name,
      identityVerified: Boolean(m.name && Number.isInteger(m.szDecimals) && !dex), semantics: 'UNDERLYING_REFERENCE',
      delisted: Boolean(m.isDelisted), marketHours: null, raw: m,
      identityEvidence: dex ? null : 'Hyperliquid default perp oracle USD semantics; no spot or builder equivalence assumed'
    }, context: response[1][i], receivedAt }));
  }
  async discover(signal) {
    this.inventoryComplete = false;
    const dexs = array(await this.info({ type: 'perpDexs' }, signal));
    this.dexs = ['', ...new Set(dexs.filter(Boolean).map(d => d.name).filter(n => typeof n === 'string' && n))];
    const all = [];
    for (const dex of this.dexs) {
      try { all.push(...this.parsePerps(await this.info({ type: 'metaAndAssetCtxs', dex }, signal), dex).map(p => p.metadata)); }
      catch (error) { this.error(error, `dex:${dex}`); }
    }
    try {
    const spot = await this.info({ type: 'spotMeta' }, signal);
    if (!Array.isArray(spot?.universe) || !Array.isArray(spot?.tokens)) throw new ProviderError('SCHEMA_INVALID');
    const tokens = new Map(spot.tokens.map(t => [t.index, t]));
    this.spot = spot.universe.map((m, i) => ({ sourceMarketId: `spot/${m.name ?? i}`, symbol: m.name,
      baseAsset: tokens.get(m.tokens?.[0])?.name ?? null, quoteAsset: tokens.get(m.tokens?.[1])?.name ?? null,
      assetClass: 'CRYPTO', instrumentType: 'SPOT', unit: tokens.get(m.tokens?.[0])?.name ?? null,
      identityVerified: false, semantics: 'SPOT_MARK', raw: m, priceDecimals: 24 }));
    } catch (error) { this.error(error, 'spot_inventory'); }
    this.inventory = [...all, ...this.spot]; this.inventoryComplete = !this.errors.some(e => e.sourceMarketId?.startsWith('dex:') || e.sourceMarketId === 'spot_inventory'); return this.inventory;
  }
  async snapshot(signal) {
    const out = [];
    for (const dex of this.dexs) {
      const response = await this.info({ type: 'metaAndAssetCtxs', dex }, signal);
      for (const { metadata: m, context: p } of this.parsePerps(response, dex)) try {
        out.push(this.observation(m.sourceMarketId, p.oraclePx, undefined, p, {
          microstructure: { markPrice: p.markPx ?? null, midPrice: p.midPx ?? null, lastTradePrice: null,
            sourceVolume: p.dayNtlVlm ?? null, volumeDefinition: '24h_USD_NOTIONAL', openInterest: p.openInterest ?? null, fundingRate: p.funding ?? null }
        }));
      } catch (error) { this.error(error, m.sourceMarketId); }
    }
    // Public context snapshots do not publish event times. Receipt times are explicit and default-ineligible.
    return out;
  }
  async historical(sourceMarketId, { from, to, interval = '1m', signal } = {}) {
    const market = this.inventory.find(m => m.sourceMarketId === sourceMarketId);
    if (!market?.coin || !(from > 0 && to >= from)) throw new Error('unsupported_history_request');
    const response = await this.info({ type: 'candleSnapshot', req: { coin: market.coin, interval, startTime: from, endTime: to } }, signal);
    return array(response).map(c => ({ source: this.source, sourceMarketId, dataKind: 'PROVIDER_REFERENCE', semantics: 'TRADE_OHLC', timestamp: timestamp(c.t), raw: c }));
  }
}
export class GMXAdapter extends Adapter {
  constructor(options = {}) {
    super('gmx', options); this.networks = options.networks ?? [
      { name: 'arbitrum', oracle: 'https://arbitrum-api.gmxinfra.io', api: 'https://arbitrum.gmxapi.io' },
      { name: 'avalanche', oracle: 'https://avalanche-api.gmxinfra.io', api: 'https://avalanche.gmxapi.io' }
    ];
    this.capabilities = { ...this.capabilities, priceEncoding: 'GMX_API_30_DECIMALS_PER_WHOLE_TOKEN' };
  }
  async discover(signal) {
    this.inventoryComplete = false; const all = [];
    let complete = true;
    for (const network of this.networks) {
      try {
      const tokens = entries(await this.transport.request(`${network.oracle}/tokens`, undefined, signal));
      const markets = entries(await this.transport.request(`${network.oracle}/markets`, undefined, signal));
      for (const [i, m] of markets.entries()) {
        const address = m.marketToken ?? m.marketTokenAddress ?? m.address ?? m._key;
        const token = tokens.find(t => (t.address ?? t.tokenAddress ?? t._key)?.toLowerCase() === String(m.indexToken ?? '').toLowerCase());
        const symbol = token?.symbol ?? token?.tokenSymbol ?? m.name ?? `unresolved:${i}`;
        all.push({ sourceMarketId: `${network.name}/${address ?? `unresolved:${i}`}`, symbol,
          baseAsset: symbol, quoteAsset: token ? 'USD' : null, assetClass: 'UNKNOWN', instrumentType: 'PERPETUAL_UNDERLYING',
          unit: token?.address ?? token?.tokenAddress ?? token?._key ?? null, priceDecimals: 24,
          identityVerified: Boolean(token && address), semantics: 'UNDERLYING_REFERENCE',
          network: network.name, tokenAddress: m.indexToken ?? null, marketHours: null, raw: m,
          identityEvidence: 'GMX network-scoped indexToken contract identity; wrapped assets remain distinct' });
      }
      // Every oracle token also remains visible, including tokens with no active trading market.
      for (const [i, token] of tokens.entries()) {
        const address = token.address ?? token.tokenAddress ?? token._key;
        all.push({ sourceMarketId: `${network.name}/token/${address ?? `unresolved:${i}`}`, symbol: token.symbol ?? token.tokenSymbol,
          baseAsset: token.symbol ?? token.tokenSymbol, quoteAsset: 'USD', assetClass: 'UNKNOWN', instrumentType: 'TOKEN_REFERENCE',
          unit: address ?? null, priceDecimals: 24, identityVerified: Boolean(address), semantics: 'UNDERLYING_REFERENCE',
          network: network.name, tokenAddress: address ?? null, raw: token,
          identityEvidence: 'GMX oracle network token catalog; no wrapped-token equivalence assumed' });
      }
      } catch (error) { complete = false; this.error(error, `network:${network.name}`); }
    }
    this.inventory = all; this.inventoryComplete = complete; return all;
  }
  async snapshot(signal) {
    const out = [];
    for (const network of this.networks) {
      // This API's documented 10^30 per whole token encoding is distinct from the keeper's per-unit encoding.
      const response = await this.transport.request(`${network.api}/v1/prices/tickers`, undefined, signal);
      if (!response?.prices || typeof response.prices !== 'object' || !timestamp(response.originTs)) throw new ProviderError('SCHEMA_INVALID');
      for (const m of this.inventory.filter(m => m.network === network.name)) try {
        const p = Object.entries(response.prices).find(([key]) => key.toLowerCase() === m.tokenAddress?.toLowerCase())?.[1];
        if (!p) continue;
        if (!/^\d{1,100}$/.test(p.minPrice) || !/^\d{1,100}$/.test(p.maxPrice)) throw new ProviderError('INVALID_PRICE');
        const min = BigInt(p.minPrice), max = BigInt(p.maxPrice);
        if (min <= 0n || max < min) throw new ProviderError('INVALID_INTERVAL');
        const midpoint = divRound((min + max) * SCALE, 2n * 10n ** 30n);
        out.push(this.observation(m.sourceMarketId, format(midpoint), response.originTs, p, {
          interval: { min: p.minPrice, max: p.maxPrice, scale: 30, timestamp: response.originTs, tokenAddress: m.tokenAddress },
          timestampNote: 'originTs is the oldest price in the snapshot, a conservative age bound'
        }));
      } catch (error) { this.error(error, m.sourceMarketId); }
    }
    return out;
  }
  async historical(sourceMarketId, { interval = '1m', limit = 100, signal } = {}) {
    const m = this.inventory.find(m => m.sourceMarketId === sourceMarketId), network = this.networks.find(n => n.name === m?.network);
    if (!m?.symbol || !network || !Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('unsupported_history_request');
    const response = await this.transport.request(`${network.oracle}/prices/candles?tokenSymbol=${encodeURIComponent(m.symbol)}&period=${encodeURIComponent(interval)}&limit=${limit}`, undefined, signal);
    return array(response?.candles).map(c => ({ source: this.source, sourceMarketId, dataKind: 'PROVIDER_REFERENCE', semantics: 'PROVIDER_OHLC', timestamp: timestamp(c[0]), raw: c }));
  }
}
