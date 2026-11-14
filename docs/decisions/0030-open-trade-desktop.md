# ADR 0030: Open Trade desktop boundary

Status: Proposed (unmerged beta implementation).

Open Trade is a separately versioned Electron host in `apps/open-trade`, using
per-app npm lockfiles. It shares the customized Vela runtime and Gains provider,
while adapting the UI to a small chart-first desktop workspace. Desktop chart
storage keys must not overwrite web workspaces or authoritative financial state.

The renderer is local, sandboxed and isolated from Node. A small preload exposes
allowlisted API operations. Main retains the backend session credential and
protects it using OS encryption when available. WalletConnect requests an
Arbitrum One SIWE signature; the existing backend validates it and owns sessions,
accounts, orders, protection and P&L. No alternate financial authority is created.
An uncertain mutation locks further trading until read-only reconciliation proves
its outcome. Reconnection never silently retries a mutation.

Desktop builds have their own CI and unsigned internal artifacts. They do not
trigger Render or the web release process. Public publication requires explicit
owner approval, verified platform artifacts and resolution of existing license
and signing blockers. Automatic updates remain disabled for unsigned builds.

See [desktop implementation and tests](../../apps/open-trade/README.md) and
[acceptance record](../../apps/open-trade/ACCEPTANCE.md).
