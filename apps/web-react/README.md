
## Shared product terminals (2026-11-02)

`src/features/terminal/` owns the product shell/header, shared trading workspace, product account adapters, Portfolio, Journal and shared analytics views. URLs follow `#/{locale}/{product}/{page}`; previous `/terminal` and `/portfolio` links redirect to Prop. Both products render one identical terminal interface, with no editorial content or padding around the trade workspace. Independent server-scoped account data is never kept in a shared simulated account.

Run `npm run typecheck`, `node --test test/*.test.mjs`, and `npm run build`. Production API calls default to the same origin; local Vite can use VITE_BACKEND_URL. Existing Vela/Gains legacy code runs in the disposable workspace frame while React owns wallet/session/product context. See the [architecture and API contract](../../docs/architecture/PRODUCT_TERMINALS.md), [ADR](../../docs/decisions/0002-shared-product-terminal.md), and [CMS guide](../../docs/backstage/TERMINAL_CONTENT.md).
