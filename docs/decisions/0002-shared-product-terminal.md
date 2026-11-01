# ADR 0002 — Shared terminal workspace, isolated product adapters

- Status: Accepted for implementation; pending PR review
- Date: 2026-11-02
- Base: main `61c70fe`

## Context

The latest user correction supersedes the original requirement for two distinct terminal interfaces: both products must have identical trading layout and interaction, independent URLs/data/business logic, a horizontal application header and no surrounding editorial content on the Terminal tab.

## Decision

- One `SharedTradingTerminal` renders the same legacy Vela workspace markup and controls on `/:locale/prop/trade` and `/:locale/perpetual/trade`. The shared `TerminalShell` owns the exact required horizontal primary tabs, wallet/SIWE, product switch and locale. Journal is Portfolio secondary navigation, with independent product URLs.
- Terminal is a viewport-filling flex child directly below the application header. It does not mount Editorial, banners, headings or page padding. Mobile tabs scroll horizontally; workspace panels scroll inside the workspace, without outer page scrolling.
- Preserve the mature legacy chart/drawing/order system in a disposable **same-origin frame**. Its scripts, styles, DOM listeners, market socket and timers are discarded together on leaving Terminal. Parent navigation does not reload the application. This is runtime containment within the existing React/legacy architecture, not another app/service/CMS.
- React owns account adapters. Prop mounts the existing authenticated `TradingBridge` and server Engine. Perpetual mounts a read-only Gains account adapter. Neither product constructs a guest local TradingProvider when account data is absent. Unknown balances/PnL are null and render as em dashes.
- The existing deterministic presentation order book/tape is not used on either new product route. The same panel instead lists verified live market prices with working symbol selection. Market prices never become synthetic operational records.
- Gains execution stays disabled (root AGENTS requirement). Reading official address-scoped open trades, pending limit/stop orders, history and stats is now supported. No wallet signature, approval or transaction is sent by the read adapter.
- Keep financial Engine arithmetic and NUMERIC ledger writes unchanged. Portfolio reads owned engine records; historical curves retain the existing close-settlement basis. The UI estimate reads fee rates exposed by that same engine, rather than the legacy flat fee.
- Directus remains editorial-only: existing pages/ui_messages plus normalized terminal_sections/translations. Runtime public read, published filter, 20-second cache, 30-second refresh while mounted. No terminal editorial sections are mounted on the trade route. All CMS changes go through the existing instance; no admin token in browser code.
- The new journal table is a private notebook (not a second financial trade ledger). Entries are authorized by user, product and a server-derived account reference. Prop links must refer to an owned engine position; Gains history can open a reflection with an Arbiscan transaction reference. Native Gains events remain events, including partial closes, rather than invented completed trades.
- Keep `/terminal`, `/portfolio`, `/journal` compatibility redirects (Prop) and locale-less product aliases. Public Home's Perpetual CTA points directly to its own route; marketing header markup remains separate.

## Consequences and boundaries

- The frame intentionally has same-origin access to the parent's read/trading adapters. It is first-party bundled code, not a trust boundary; user notes and CMS text are not executed in it.
- An unsupported trading action stays disabled. Missing authoritative financial values remain unavailable; there are no fallback balances or manufactured empty portfolios after a failed upstream request.
- Perpetual amounts keep collateral currencies separate; PnL/borrowing/liquidation math that is not verified is not guessed. Recent-event analytics are explicitly limited to the retrieved page. Provider outages are visible request errors with retry.
- Account selector contains only the existing supported free practice account. Challenge purchasing, funded evaluation, payout eligibility, certificates, rankings and rewards need authoritative services/rules. Customer UI uses concise operational copy; engineering status stays in documentation.
- No root Render blueprint previously existed. The optional new blueprint builds the existing frontend/backend and serves `/react/` and session APIs from one origin, using the existing PostgreSQL/Directus URLs. It creates no replacement database or CMS, disables automatic deploys, and is not applied by this PR.
