# ADR 0001 — Two-Product Gateway Routing and the Markets Page

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

Openfund grew from a single landing page (the prop-trading marketing site, historically
served at the React root `/`) plus editorial pages (rulebook, transparency) plus a separate
terminal application experience. The product direction is a **two-product ecosystem**:

- Product A — prop trading challenges (the existing landing),
- Product B — leveraged perpetual trading (the terminal on Gains Network market data).

Requirements: a new Home page introducing both products in one screen, a standalone
Markets page using Gains Network as the authoritative market source, and exactly four
navigation items (Trading Challenges / Markets / Trading Rules / Transparency) consistent
across all public pages — while preserving the legacy landing runtime, the terminal, and
all existing routes.

## Decision

1. **Locale-prefixed routes for every public page** — `/:locale/home`, `/:locale/challenges`,
   `/:locale/markets`, `/:locale/rulebook`, `/:locale/transparency`. `/` redirects to
   `/:locale/home` using the stored `of-language` preference (default fa).
2. **The landing stays a legacy-script page** but moves to `/:locale/challenges`. The route
   locale is authoritative on entry (synced into `localStorage` before the legacy scripts
   boot); the in-page language toggle silently rewrites the hash with
   `history.replaceState` so the legacy runtime never remounts.
3. **Legacy deep-link migration, not silent 404s** — single-segment hashes from the old
   landing (`#/markets`, `#/accounts`, `#/how`, `#/team`, `#/rules`, …) are routed to the
   page that now owns that content (Markets page / challenges route with a post-boot
   scroll via the existing `ofScrollTo` sessionStorage handshake).
4. **Markets page reuses the shared Gains adapter** (`legacy/gains-adapter.js`,
   `window.OpenfundGains`) as its single data source — same REST endpoints, same singleton
   prices WebSocket, no second price engine. Because the page therefore owns a script
   runtime, it follows the existing teardown contract: leaving the page reloads the
   browser (cancelled on re-mount), so the terminal always boots against a clean adapter.
5. **Market → terminal deep-links** use a sessionStorage handshake
   (`of-terminal-symbol`), consumed once at terminal boot and only for symbols present in
   Gains metadata — the one narrowly-scoped terminal change, no trading logic touched.
6. **One authoritative navigation definition** — the four items and their labels live in
   `features/information/content.ts` (`labels` + `InfoPage`); the landing header markup
   (`landing-body.html`) is the single source of the shared header/footer, consumed both
   by the legacy landing and by the React `Chrome` component used on Home/Markets/
   Rulebook/Transparency.

## Alternatives considered

- **Keep the landing at `/` and put Home somewhere else** — rejected: the product decision
  is that the gateway IS the entry point; old links are migrated deliberately instead.
- **A second Next.js/standalone Markets app or iframe** — rejected: one React app, one
  design system, one navigation.
- **A new React-only Gains client** — rejected: duplicate WebSocket, two truth sources for
  market metadata; the shared adapter already implements the verified protocol
  (subscribe/ping-pong/seq-gap resubscribe).
- **Router navigation for the landing language toggle** — rejected: a hash change remounts
  the legacy landing and re-runs its boot chain; `replaceState` keeps the URL truthful
  without re-booting the runtime.

## Consequences

- Old bookmarks to `#/` land on the gateway (by design); section anchors still find their
  content through the migration map.
- The `nav-account` dropdown was removed from the shared header (the menu now contains
  exactly the four required items); its landing presets remain reachable through in-page
  content CTAs.
- The classic `dist/` site still carries the pre-gateway nav; the React app (`/react/`)
  is the authoritative website (documented as a known divergence in the PR).
- Markets page price fields are limited to what Gains provides (symbol, base, quote,
  group, pricePrecision, maxLeverage, spreadRate, isOpen, mark price) — volume, 24h
  change and market cap are never fabricated.
