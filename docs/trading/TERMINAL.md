# Shared Trading Terminal

One `SharedTradingTerminal` and `TerminalShell` serve both Prop and Perpetual routes. Presentation is reused; balances, positions, orders and business state are isolated. Public content does not wrap the full-space trade workspace.

## Composition

React owns product routing, wallet/session context, navigation and account adapters. The established script-based terminal and Vela workspace run in a disposable frame; `TradingBridge` connects authenticated Prop state to that workspace. The chart adapter maps Gains markets and candles to Vela's provider contract and synchronizes symbol, interval, theme and lifecycle.

- [React terminal sources](../../apps/web-react/src/features/terminal/)
- [Vela bridge](../../packages/openfund-charts/src/vela-bridge.js)
- [Gains provider](../../packages/openfund-gains-adapter/src/gains-adapter.js)
- [Product contracts](../architecture/PRODUCT_TERMINALS.md)

## State synchronization

Prop account snapshots and mutations come from the backend, with SSE state notifications and reconnect/disconnected indicators. Position PnL, ROI and liquidation values render the server calculation. Product dashboards and portfolios refresh through cancellable requests (Prop approximately five seconds, Gains approximately fifteen seconds). A wallet, product or account change clears old private data before the next resource resolves.

The browser market stream and backend execution stream have distinct responsibilities. Browser quotes power charting and discovery; server marks authorize simulated execution. A visible chart price alone cannot prove a fresh execution mark. Unknown/stale values remain unavailable.

## Routes and interaction

Use `/react/#/en/prop/trade` or `/react/#/en/perpetual/trade`; replace `en` with `fa` for the Persian application. Product tabs connect dashboard, trade, portfolio and journal. Unimplemented commercial/reward capabilities display unavailable states. Old `/terminal`, `/portfolio` and `/journal` hashes redirect to Prop using the stored locale.

Themes and RTL support are product features. Repository documentation and screenshot captions use English. Keep required Vela attribution and upstream notices. Oracle market data does not authorize fabricated depth, tape or volume.

[Terminal integration](../integrations/VELA.md) · [Architecture](../architecture/ARCHITECTURE.md) · [Screenshots](../assets/screenshots/README.md)
