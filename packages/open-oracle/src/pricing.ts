import { SCALE, decimal, format, mul, divide, divRound, abs, clamp, ln, exp, LN2, median } from './decimal.ts';
import type { Source, Observation, OraclePrice, SourceContribution, OracleConfig, PricingMode } from './types.ts';
export const DEFAULT_CONFIG: OracleConfig = Object.freeze({
  version: 'gaacp-research-1', algorithmVersion: 'GAACP-v1', confidenceVersion: 'quality-v1',
  baseWeights: Object.freeze({ gains: '0.4', hyperliquid: '0.3', gmx: '0.3' }),
  halfLifeMs: 2000, maxAgeMs: 10000, maxAlignmentMs: 2000,
  sigmaFloor: '0.0001', huberK: '2.5', dualTolerance: '0.01', hardDeviation: '0.05',
  allowReceiptTimestamps: false, reliabilityWindowMs: 300000, watermarkMs: 2000,
});
export function validateConfig(c: OracleConfig): void {
  for (const n of [c.halfLifeMs, c.maxAgeMs, c.maxAlignmentMs, c.reliabilityWindowMs, c.watermarkMs])
    if (!Number.isSafeInteger(n) || n <= 0) throw new RangeError('invalid_time_policy');
  if (c.maxAgeMs / c.halfLifeMs > 64) throw new RangeError('freshness_domain');
  for (const n of [c.sigmaFloor, c.huberK, c.dualTolerance, c.hardDeviation])
    if (decimal(n) <= 0n) throw new RangeError('invalid_threshold');
  for (const s of ['gains', 'hyperliquid', 'gmx'] as Source[])
    if (decimal(c.baseWeights[s]) < 0n) throw new RangeError('negative_base_weight');
  for (const policy of Object.values(c.sourcePolicies ?? {}))
    if (!Number.isSafeInteger(policy.halfLifeMs) || !Number.isSafeInteger(policy.maxAgeMs) || policy.halfLifeMs <= 0 || policy.maxAgeMs <= 0 || policy.maxAgeMs / policy.halfLifeMs > 64) throw new RangeError('invalid_source_policy');
  if (!c.version || !c.algorithmVersion || !c.confidenceVersion) throw new RangeError('unversioned_config');
}
/** Evaluate only observations known by event time AND receipt time; inputs are immutable. */
export function calculatePrice(marketId: string, observations: Observation[], evaluationTime: number,
  config: OracleConfig = DEFAULT_CONFIG, previous: OraclePrice | null = null,
  session = 'UNKNOWN', configuredSourceCount = 3): OraclePrice {
  validateConfig(config);
  if (!Number.isSafeInteger(evaluationTime) || evaluationTime <= 0) throw new RangeError('invalid_evaluation_time');
  const seen = new Set<Source>();
  const rows: { o: Observation; p: bigint; c: SourceContribution }[] = [];
  for (const o of [...observations].sort((a, b) => a.source.localeCompare(b.source))) {
    let reason: string | null = null, p = 0n;
    if (!Object.hasOwn(config.baseWeights, o.source)) continue;
    const policy = config.sourcePolicies?.[o.source] ?? config;
    try { p = decimal(o.price); if (p <= 0n) reason = 'invalid_price'; } catch { reason = 'invalid_price'; }
    if (o.marketId !== marketId || !o.mappingVerified) reason = 'mapping_unverified';
    else if (!o.quoteValid) reason = 'quote_unverified';
    else if (o.semantics !== 'UNDERLYING_REFERENCE') reason = 'incompatible_semantics';
    else if (!Number.isSafeInteger(o.timestamp) || o.timestamp <= 0 || !Number.isSafeInteger(o.receivedAt) || o.receivedAt <= 0) reason = 'invalid_timestamp';
    else if (o.timestamp > o.receivedAt + 1000) reason = 'clock_skew';
    else if (o.timestamp > evaluationTime || o.receivedAt > evaluationTime) reason = 'future_observation';
    else if (evaluationTime - o.timestamp > policy.maxAgeMs) reason = 'stale';
    else if (o.timestampKind === 'RECEIPT' && !config.allowReceiptTimestamps) reason = 'timestamp_unverified';
    if (seen.has(o.source)) reason = 'duplicate_source';
    seen.add(o.source);
    let reliability = SCALE;
    try { reliability = decimal(o.reliability ?? '1'); if (reliability < 0n || reliability > SCALE) reason = 'invalid_reliability'; }
    catch { reason = 'invalid_reliability'; }
    const age = Math.max(0, evaluationTime - o.timestamp);
    const freshness = reason ? 0n : exp(-divRound(LN2 * BigInt(age), BigInt(policy.halfLifeMs)));
    rows.push({ o, p, c: { source: o.source, sourceMarketId: o.sourceMarketId, rawPrice: o.rawPrice ?? o.price,
      normalizedPrice: o.price, timestamp: o.timestamp, receivedAt: o.receivedAt, timestampKind: o.timestampKind,
      ageMs: age, eligible: !reason, exclusionReason: reason, freshness: format(freshness),
      reliability: format(clamp(reliability)), deviation: '1', independence: '1', dependencyStatus: 'UNVERIFIED',
      dependencyEvidence: o.dependencyEvidence ?? null, calibrated: o.calibrated ?? false,
      residual: '0', rawWeight: '0', weight: '0', rawObservation: o.raw ?? null, microstructure: o.microstructure ?? {} } });
  }
  let eligible = rows.filter(r => r.c.eligible);
  if (eligible.length) {
    const newest = Math.max(...eligible.map(r => r.o.timestamp));
    for (const r of eligible) if (newest - r.o.timestamp > config.maxAlignmentMs) {
      r.c.eligible = false; r.c.exclusionReason = 'timestamp_misaligned';
    }
    eligible = rows.filter(r => r.c.eligible);
  }
  let sigma = decimal(config.sigmaFloor), spread = 0n, divergent = false;
  if (eligible.length === 3) {
    const center = median(eligible.map(r => r.p));
    const residuals = eligible.map(r => ln(r.p) - ln(center));
    const med = median(residuals);
    sigma = mul(decimal('1.4826'), median(residuals.map(r => abs(r - med))));
    if (sigma < decimal(config.sigmaFloor)) sigma = decimal(config.sigmaFloor);
    eligible.forEach((r, i) => {
      const residual = residuals[i]!; r.c.residual = format(residual);
      const z = divide(abs(residual), sigma), k = decimal(config.huberK);
      r.c.deviation = format(z <= k ? SCALE : divide(k, z));
      // A agreeing pair must carry explicit independent evidence; correlation is insufficient.
      const peers = eligible.filter(p => p !== r);
      const independent = peers[0]!.o.independentEvidence && peers[1]!.o.independentEvidence &&
        (!peers[0]!.o.dependencyGroup || peers[0]!.o.dependencyGroup !== peers[1]!.o.dependencyGroup);
      const peersAgree = abs(ln(peers[0]!.p) - ln(peers[1]!.p)) <= decimal(config.dualTolerance);
      if (abs(residual) > decimal(config.hardDeviation)) {
        if (independent && peersAgree) { r.c.eligible = false; r.c.exclusionReason = 'independently_confirmed_outlier'; }
        else divergent = true;
      }
    });
    eligible = rows.filter(r => r.c.eligible);
  }
  if (eligible.length === 2) {
    spread = abs(ln(eligible[0]!.p) - ln(eligible[1]!.p));
    divergent ||= spread > decimal(config.dualTolerance);
    // Re-evaluate the source set; triple-source residual weights no longer apply.
    for (const r of eligible) { r.c.deviation = '1'; r.c.residual = '0'; }
  }
  const groups = new Map<string, number>();
  for (const r of eligible) if (r.o.dependencyGroup && r.o.dependencyEvidence)
    groups.set(r.o.dependencyGroup, (groups.get(r.o.dependencyGroup) ?? 0) + 1);
  for (const r of eligible) {
    if (r.o.dependencyGroup && r.o.dependencyEvidence) {
      r.c.independence = format(divRound(SCALE, BigInt(groups.get(r.o.dependencyGroup)!)));
      r.c.dependencyStatus = 'DOCUMENTED';
    }
    let w = decimal(config.baseWeights[r.o.source]);
    for (const factor of [r.c.freshness, r.c.reliability, r.c.deviation, r.c.independence]) w = mul(w, decimal(factor));
    r.c.rawWeight = format(w);
  }
  const total = eligible.reduce((s, r) => s + decimal(r.c.rawWeight), 0n);
  let mode: PricingMode = session === 'CLOSED' ? 'MARKET_CLOSED' : divergent ? 'DIVERGENT' :
    !eligible.length || total === 0n ? 'UNAVAILABLE' : eligible.length === 3 ? 'TRIPLE_SOURCE' : eligible.length === 2 ? 'DUAL_SOURCE' : 'SINGLE_SOURCE';
  let price: string | null = null, confidence = 0, referenceTimestamp: number | null = null;
  if (total > 0n && !divergent && session !== 'CLOSED') {
    // Report weights sum exactly to 1; assign the bounded rounding residue to the largest weight.
    const largest = eligible.reduce((a, b) => decimal(a.c.rawWeight) >= decimal(b.c.rawWeight) ? a : b);
    let used = 0n;
    for (const r of eligible) if (r !== largest) { const w = divide(decimal(r.c.rawWeight), total); r.c.weight = format(w); used += w; }
    largest.c.weight = format(SCALE - used);
    const weighted = eligible.reduce((s, r) => s + r.p * decimal(r.c.weight), 0n);
    price = format(divRound(weighted, SCALE)); referenceTimestamp = Math.min(...eligible.map(r => r.o.timestamp));
    let quality = 0n;
    for (const r of eligible) {
      let q = decimal(r.c.weight);
      for (const factor of [r.c.freshness, r.c.reliability, r.c.deviation, r.c.independence]) q = mul(q, decimal(factor));
      quality += q;
    }
    const coverage = eligible.length === 3 ? SCALE : decimal(eligible.length === 2 ? '0.8' : '0.5');
    confidence = Number(format(mul(clamp(mul(quality, coverage)), 100n * SCALE)));
  }
  let stale = false;
  if (price === null && previous?.price !== null && previous?.price !== undefined &&
      previous.marketId === marketId && previous.timestamp <= evaluationTime) {
    price = previous.price; referenceTimestamp = previous.referenceTimestamp; stale = true;
    if (mode === 'UNAVAILABLE') mode = 'STALE';
  }
  return { marketId, price, timestamp: evaluationTime, referenceTimestamp, pricingMode: mode,
    confidence, sources: rows.map(r => r.c), algorithmVersion: config.algorithmVersion,
    configurationVersion: config.version, confidenceVersion: config.confidenceVersion,
    stale, eligibleSourceCount: eligible.length, configuredSourceCount, dispersion: format(sigma),
    spread: format(spread), marketSession: session };
}
