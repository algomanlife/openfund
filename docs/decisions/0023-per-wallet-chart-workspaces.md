# ADR 0023 — Per-wallet chart workspaces

- **Status:** Accepted (implementation; deployment pending review)
- **Date:** 2026-11-11

## Context

Vela chart state (drawings, indicators, timeframe, settings) lived only in
browser `localStorage` under keys shared by everyone using that browser. A
second wallet signing in on the same browser saw the first wallet's drawings,
and a wallet signing in on another device saw nothing.

## Decision

- Store the workspace in PostgreSQL (`chart_workspaces`), one row per
  (user, workspace, scope), owned by the session user only.
- Keep Vela's own serialization (workspace state, `drawings.toJSON()`,
  renderer config, tool defaults) as the stored format; do not fork Vela.
- Use optimistic revisions per entry; a stale writer receives the newer copy.
- Bind each terminal document to one identity, remount it on identity change,
  and refuse saves whose claimed identity no longer matches the session.
- Keep a per-identity local cache so the terminal works offline and starts
  quickly; hydrate it from the server before the chart mounts.
- Never store live position overlays; rebuild them from position state.

## Consequences

- Additive schema change; the previous release ignores the table.
- Signing in or switching wallets reloads the terminal document once.
- Rollback: deploy the previous release; stored rows stay unused.

[Chart workspaces](../trading/CHART_WORKSPACES.md)
