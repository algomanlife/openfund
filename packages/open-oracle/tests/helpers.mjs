import { MarketRegistry } from '../src/registry.mjs';
export const TIME = 1795500000000;
export const sources = ['gains', 'hyperliquid', 'gmx'];
export function observation(source = 'gains', price = '100', time = TIME, extra = {}) {
  return { source, sourceMarketId: source, marketId: 'BTC/USD', price, timestamp: time, receivedAt: time,
    timestampKind: 'PROVIDER', mappingVerified: true, quoteValid: true, semantics: 'UNDERLYING_REFERENCE', ...extra };
}
export function registry() {
  const r = new MarketRegistry({ equivalences: [{ canonicalId: 'BTC/USD', quoteAsset: 'USD', unit: 'BTC', evidence: 'Synthetic test identities, not live-provider conformance',
    members: sources.map(source => ({ source, sourceMarketId: source })) }] });
  for (const source of sources) r.register(source, { sourceMarketId: source, symbol: 'BTC/USD', quoteAsset: 'USD', unit: 'BTC', semantics: 'UNDERLYING_REFERENCE' });
  return r;
}
