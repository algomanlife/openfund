import { createHash } from 'node:crypto';
import { decimal, mul, format, SCALE } from './decimal.ts';
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 20);
/** Cross-provider equivalences require explicit, inspectable evidence, never ticker similarity. */
export class MarketRegistry {
  constructor({ equivalences = [], maxMarkets = 50000 } = {}) {
    this.entries = new Map(); this.sourceIndex = new Map(); this.maxMarkets = maxMarkets;
    this.equivalences = equivalences;
    for (const rule of equivalences) {
      if (!rule.canonicalId || !rule.evidence || !rule.unit || !rule.quoteAsset || !Array.isArray(rule.members)) throw new Error('invalid_equivalence');
      // Unit multipliers are validated once, at configuration time, so one bad rule cannot fail a whole inventory registration.
      for (const member of rule.members) {
        let valid = false; try { valid = decimal(member.priceMultiplier ?? '1') > 0n; } catch { valid = false; }
        if (!valid) throw new Error('invalid_unit_multiplier');
      }
    }
  }
  register(source, metadata) {
    const sourceId = String(metadata.sourceMarketId ?? 'unidentified:' + hash(JSON.stringify(metadata)));
    const key = `${source}:${sourceId}`;
    const rule = this.equivalences.find(r => r.members.some(m => m.source === source && m.sourceMarketId === sourceId));
    const member = rule?.members.find(m => m.source === source && m.sourceMarketId === sourceId);
    const multiplier = member?.priceMultiplier ?? '1';
    const compatible = rule && rule.quoteAsset === metadata.quoteAsset && (member?.sourceUnit ?? rule.unit) === metadata.unit && metadata.semantics === 'UNDERLYING_REFERENCE';
    const id = compatible ? rule.canonicalId : `${source}:${hash(sourceId)}`;
    if (!this.entries.has(id) && this.entries.size >= this.maxMarkets) throw new Error('registry_capacity');
    const status = compatible ? 'VERIFIED_EQUIVALENCE' : metadata.identityVerified ? 'SOURCE_SCOPED' : 'AMBIGUOUS';
    const previousId = this.sourceIndex.get(key);
    if (previousId && previousId !== id) {
      const previous = this.entries.get(previousId);
      previous.sourceMappings = previous.sourceMappings.filter(m => !(m.source === source && m.sourceMarketId === sourceId));
      previous.supportedSources = [...new Set(previous.sourceMappings.map(m => m.source))].sort();
      if (!previous.sourceMappings.length) this.entries.delete(previousId);
    }
    let entry = this.entries.get(id);
    if (!entry) {
      entry = { id, symbol: metadata.symbol ?? sourceId, baseAsset: metadata.baseAsset ?? null,
        quoteAsset: metadata.quoteAsset ?? null, assetClass: metadata.assetClass ?? 'UNKNOWN',
        instrumentType: metadata.instrumentType ?? 'UNKNOWN', priceDecimals: metadata.priceDecimals ?? 24,
        marketHours: metadata.marketHours ?? null, sourceMappings: [], supportedSources: [], mappingStatus: status };
      this.entries.set(id, entry);
    }
    const mapping = { source, sourceMarketId: sourceId, status, evidence: compatible ? rule.evidence : metadata.identityEvidence ?? null,
      priceMultiplier: compatible ? multiplier : '1', canonicalUnit: compatible ? rule.unit : metadata.unit ?? null,
      semantics: metadata.semantics ?? 'UNKNOWN', unit: metadata.unit ?? null, metadata };
    const previous = entry.sourceMappings.findIndex(m => m.source === source && m.sourceMarketId === sourceId);
    if (previous >= 0) entry.sourceMappings[previous] = mapping; else entry.sourceMappings.push(mapping);
    entry.supportedSources = [...new Set(entry.sourceMappings.map(m => m.source))].sort();
    this.sourceIndex.set(key, id); return entry;
  }
  resolve(source, sourceId) { return this.entries.get(this.sourceIndex.get(`${source}:${sourceId}`)) ?? null; }
  list() { return [...this.entries.values()].sort((a, b) => a.id.localeCompare(b.id)); }
  normalize(observation) {
    const market = this.resolve(observation.source, observation.sourceMarketId);
    if (!market) return { ...observation, marketId: 'UNREGISTERED', mappingVerified: false, quoteValid: false };
    const mapping = market.sourceMappings.find(m => m.source === observation.source && m.sourceMarketId === observation.sourceMarketId);
    let price = observation.price;
    try { if (mapping.priceMultiplier !== '1') price = format(mul(decimal(observation.price), decimal(mapping.priceMultiplier))); } catch { /* Invalid values remain diagnostic inputs for pricing eligibility. */ }
    return { ...observation, price, rawPrice: observation.rawPrice ?? observation.price, marketId: market.id,
      mappingVerified: mapping.status !== 'AMBIGUOUS', quoteValid: Boolean(market.quoteAsset),
      semantics: mapping.semantics };
  }
  coverage(collectedAt, inventoryStatus = {}) {
    const markets = this.list(), masks = {}, classes = {}, counts = {};
    for (const m of markets) { const mask = m.supportedSources.join('+'); masks[mask] = (masks[mask] ?? 0) + 1; classes[m.assetClass] = (classes[m.assetClass] ?? 0) + 1; }
    for (const source of ['gains', 'hyperliquid', 'gmx']) counts[source] = markets.reduce((n, m) => n + m.sourceMappings.filter(s => s.source === source).length, 0);
    return { collectedAt, complete: ['gains', 'hyperliquid', 'gmx'].every(s => inventoryStatus[s]?.complete === true),
      sourceCounts: counts, canonicalCount: markets.length, exclusiveSourceCombinations: masks,
      ambiguousMappings: markets.filter(m => m.mappingStatus === 'AMBIGUOUS').map(m => m.id),
      sourceScopedMappings: markets.filter(m => m.mappingStatus === 'SOURCE_SCOPED').length,
      assetClasses: classes, inventoryStatus, markets };
  }
}
/** Conversion requires an event-time-valid independently verified rate, never a 1:1 peg assumption. */
export function convertQuote(observation, conversion, evaluationTime, maxAgeMs = 10000) {
  if (!conversion?.evidence || conversion.from !== observation.quoteAsset || conversion.timestamp > evaluationTime ||
      conversion.receivedAt > evaluationTime || evaluationTime - conversion.timestamp > maxAgeMs) throw new Error('quote_conversion_unverified');
  const rate = decimal(conversion.rate); if (rate <= 0n) throw new Error('invalid_conversion');
  return { ...observation, rawPrice: observation.rawPrice ?? observation.price, price: format(mul(decimal(observation.price), rate)), quoteAsset: conversion.to,
    quoteValid: true, conversion: { ...conversion, originalPrice: observation.price, precision: format(SCALE) } };
}
