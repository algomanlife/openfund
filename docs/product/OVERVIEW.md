# Openfund product overview

Openfund is a trading technology startup building a connected environment for market discovery, trading, account analysis and trader development. Its ecosystem brings Prop Trading and Perpetual Trading into a consistent workspace, with separate account systems and explicit sources for financial data.

The product strategy is to earn trust through useful tools, clear rules and inspectable engineering. The repository contains a working application under active development. Current delivery includes a React interface, a Node.js service, persistent simulated Prop execution, Gains Network market and wallet reads, wallet authentication, product portfolios and private journals. Commercial challenge activation, live perpetual execution and protocol routing remain future capabilities.

## The problem

Traders move between charts, market feeds, account portals and personal records. That fragmentation makes it harder to understand which account a trade belongs to, reconcile performance, or distinguish market prices from executable outcomes. Proprietary trading products also need clear separation between practice, evaluation and funded capital.

Openfund addresses that workflow with a common terminal, visible product identity and consistent navigation. It keeps simulated account accounting distinct from wallet-derived perpetual records, labels missing information, and maintains the provenance of performance metrics.

## Who it serves

| User | Use case | Current boundary |
| --- | --- | --- |
| Self-directed trader | Discover markets, chart price action and review personal decisions | Gains feeds depend on upstream availability; journal access requires a session |
| Prop participant | Practice execution and inspect risk and performance | Virtual DAI simulation; paid challenge purchase and evaluation are planned |
| Perpetual trader | Inspect Gains positions, pending orders and history by wallet | Arbitrum One read integration; transaction execution is disabled |
| Product operator | Maintain published content and the challenge catalog | Directus editorial/admin access; backend remains the financial and authorization boundary |
| Engineering contributor | Extend a traceable trading platform | Isolated branches, documented contracts, tests and preserved upstream licensing |

## Product structure

- [Prop Trading](../trading/PROP.md): server-authoritative simulated execution, account valuation and a persistent ledger.
- [Perpetual Trading](../trading/PERPETUAL.md): market discovery and authenticated wallet-scoped Gains records.
- [Shared Terminal](../trading/TERMINAL.md): one Vela-based workspace with product-specific adapters.
- [Wallet and Identity](../wallet/IDENTITY.md): SIWE, first-party sessions and product network policy.
- [Portfolio and Journal](../trading/PORTFOLIO_JOURNAL.md): product-scoped records, analytics and private decision notes.
- [Openfund Protocol](../roadmap/PROTOCOL.md): a future liquidity aggregation and routing product.

The public website also contains Home, Challenges, Markets, Rulebook and Transparency pages. The application supports English and Persian, including RTL layouts. Repository documentation is English-only. Transparency charts are labelled sample data; catalog terms do not establish an operational purchase, payout or funded-account service.

## Delivery and trust

[Feature Status](FEATURE_STATUS.md) records capability-level evidence and limitations. [Strategy](STRATEGY.md) sets priorities; the [roadmap](../../ROADMAP.md) supplies acceptance criteria rather than promised release dates. No investor, partnership, commercial adoption, revenue or regulatory approval is asserted here.

[Documentation index](../README.md)
