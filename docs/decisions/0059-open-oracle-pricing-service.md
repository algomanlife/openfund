# ADR 0059 — Open Oracle as the Openfund pricing service

- Status: Accepted by the owner (2026-11-27) for implementation; production
  activation follows the normal reviewed release.
- Supersedes: the "no production edge" boundary of
  [ADR 0058](0058-open-oracle-standalone.md). The research package, its
  methodology and its research defaults are unchanged.

## Context

Every Openfund price came straight from Gains Network: the website and
terminal read the Gains API in the browser, and the demo engine executed on
Gains marks. The owner decided that Openfund prices come from its own
aggregation and price discovery across Gains, Hyperliquid and GMX, and that
the product credits Open Oracle as its price source.

## Decision

1. `packages/open-oracle` gains a long-running `OpenOracleService`. It keeps
   one composite per Gains market (Gains remains the market catalog: symbols,
   sessions, leverage and specifications) and evaluates GAACP every second.
2. Cross-provider equivalence is generated, never assumed from tickers: a
   Gains crypto/USD market joins at most one Hyperliquid main-dex perp and one
   GMX Arbitrum oracle token with a unique symbol, and each member must agree
   with the Gains price within 10 % (log distance) when the rules are built.
   Forex, stocks, indices, commodities and stablecoins are never joined and
   are honestly single-source. Rules are rebuilt every 10 minutes.
3. The service uses the Gains `mark` and a source-specific age policy
   (Gains `updatedAt` is the time of the last change, so its bound is 30 s
   with an 8 s half-life; Hyperliquid receipt times are accepted for that
   source only, with a 9 s bound). Evidence: the live acceptance run measured
   the Gains `index` field 4.4 % (median) from Hyperliquid and GMX on joined
   markets and the `mark` 0.07 %.
4. The backend `market-data` role runs the service. Gains quotes from the
   existing socket become one input; Hyperliquid (main perp dex) and GMX
   (Arbitrum) are polled within a fixed request budget. The demo engine
   executes only on usable composites (`TRIPLE_SOURCE`, `DUAL_SOURCE` or
   `SINGLE_SOURCE`, not stale, at most 5 s old). `DIVERGENT` and
   `MARKET_CLOSED` composites stay available for valuation and are never
   executable, liquidated on or settled on.
5. A public, read-only API serves composites and per-source contributions,
   never provider payloads: `GET /api/oracle/prices`,
   `GET /api/oracle/prices/:market`, `GET /api/oracle/status` and the
   `GET /api/oracle/stream` SSE feed. Browsers read prices from their own
   origin, including the Iran runtime.
6. `MARKET_PRICE_SOURCE=gains` restores Gains-only marks without a code
   change. `OPEN_ORACLE_UPSTREAM` lets a process without the market-data role
   mirror another region's stream.

## Consequences

- Price availability improves where Gains is quiet but Hyperliquid or GMX are
  fresh, and a single misbehaving source can no longer move an executable
  price silently: disagreement beyond 2 % (two sources) or 5 % (three
  sources) suspends execution on that market.
- Gains remains a required input for the market catalog and for every
  non-crypto market. Hyperliquid and GMX usage terms and rate limits are
  operational dependencies; their failure degrades markets to fewer sources.
- Composite prices are reference prices for the simulated demo engine. They
  are not proof of executable liquidity and are not used for real-money
  execution. The research limits of ADR 0058 still apply: confidence is a
  quality indicator, not a correctness probability.
- Historical chart bars remain provider reference history until native
  composite history accumulates; they are labelled as such.

## Evidence

[Service acceptance run](../research/OPEN_ORACLE_VALIDATION.md#pricing-service-acceptance),
[integration contract](../integrations/OPEN_ORACLE.md#pricing-service).
