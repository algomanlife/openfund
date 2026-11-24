export type Source = 'gains' | 'hyperliquid' | 'gmx';
export type PricingMode = 'TRIPLE_SOURCE' | 'DUAL_SOURCE' | 'SINGLE_SOURCE' | 'DIVERGENT' | 'STALE' | 'UNAVAILABLE' | 'MARKET_CLOSED';
export interface Observation {
  source: Source; sourceMarketId: string; marketId: string; price: string;
  timestamp: number; receivedAt: number; timestampKind: 'PROVIDER' | 'RECEIPT';
  mappingVerified: boolean; quoteValid: boolean; semantics: string;
  reliability?: string; calibrated?: boolean; dependencyGroup?: string;
  dependencyEvidence?: string; independentEvidence?: string;
  raw?: unknown; microstructure?: Record<string, unknown>;
}
export interface OracleConfig {
  version: string; algorithmVersion: string; confidenceVersion: string;
  baseWeights: Record<Source, string>; halfLifeMs: number; maxAgeMs: number;
  maxAlignmentMs: number; sigmaFloor: string; huberK: string;
  dualTolerance: string; hardDeviation: string; allowReceiptTimestamps: boolean;
  reliabilityWindowMs: number; watermarkMs: number;
  sourcePolicies?: Partial<Record<Source, { halfLifeMs: number; maxAgeMs: number }>>;
}
export interface SourceContribution {
  source: Source; sourceMarketId: string; rawPrice: string; normalizedPrice: string;
  timestamp: number; receivedAt: number; timestampKind: string; ageMs: number;
  eligible: boolean; exclusionReason: string | null;
  freshness: string; reliability: string; deviation: string; independence: string;
  dependencyStatus: string; dependencyEvidence: string | null; calibrated: boolean;
  residual: string; rawWeight: string; weight: string;
  rawObservation: unknown; microstructure: Record<string, unknown>;
}
export interface OraclePrice {
  marketId: string; price: string | null; timestamp: number; referenceTimestamp: number | null;
  pricingMode: PricingMode; confidence: number; sources: SourceContribution[];
  algorithmVersion: string; configurationVersion: string; confidenceVersion: string;
  stale: boolean; eligibleSourceCount: number; configuredSourceCount: number;
  dispersion: string; spread: string; marketSession: string;
}
