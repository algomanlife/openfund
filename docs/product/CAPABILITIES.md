# Capability guide

This guide explains the scope of each product area. [Feature Status](FEATURE_STATUS.md) is the canonical delivery register; [milestones](../roadmap/MILESTONES.md) define future completion gates.

## Discover and understand markets

Home offers product entry points. Markets supports discovery, search, filtering and deep-links into the terminal using Gains metadata and prices. Rulebook content is editorial and carries provisional-policy context. Transparency is a sample reporting interface, not evidence of reserves, settlements, payouts or production usage.

## Practice execution

Authenticated Prop users receive a single virtual-DAI practice account. Server-side orders, positions and ledger events persist across browser restarts. Market, limit and stop workflows, protection edits, cancellation, partial closes and liquidation monitoring use the simulation's documented pricing and fee policy. See [Prop Trading](../trading/PROP.md).

Challenge catalog entries and user challenge records exist. Purchase, payment, evaluation decisions, funded capital and payouts are not delivered merely because a catalog or database field exists.

## Review perpetual exposure

Perpetual views request official Gains positions, pending orders, history and statistics for the session wallet on Arbitrum One. Supported raw and derived values are displayed; unavailable fee-adjusted PnL or balances remain unknown. Execution controls do not send transactions. See [Perpetual Trading](../trading/PERPETUAL.md).

## Connect identity and review decisions

Wallet connection and SIWE are separate steps. Backend sessions enforce ownership, expiry and suspension. Product portfolios show the records supported by each authority; private journals support notes, tags, classification, search, calendar/statistics and version-aware metadata import/export. JSON restore cannot create trades or balances.

## Extend the platform

Shared UI and provider contracts support incremental changes. The vendored Gains SDK is not an operational transaction integration. Openfund Protocol, additional venue adapters, developer services and production reporting require future delivery gates. See [Technology Stack](../architecture/TECH_STACK.md) and the [roadmap](../../ROADMAP.md).
