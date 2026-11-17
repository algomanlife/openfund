# ADR 0042 — One manifest for Liara infrastructure and deploy environments

- **Status:** Accepted for the source tree (branch `agent/claude/liara-iran-runtime-fixes`).
- **Date:** 2026-11-17
- **Builds on:** [ADR 0031](0031-iran-edge-on-liara.md) (Iran edge), [ADR 0033](0033-regional-authority-and-synchronization.md) (regional runtime).

## Context

Two Liara deployments were designed independently: the edge reverse proxy
(ADR 0031) and the independent regional runtime (ADR 0033). The edge guide
named its production app `openfund-iran`; the owner later created
`openfund-iran` for the runtime, which now serves the Iran domains. The
runtime manifest named apps and a network that never existed
(`openfund-iran-web`, `openfund-iran-net`), and the edge's GitHub staging
environment still pointed `LIARA_APP_NAME` at `openfund-iran`. Dispatching
the edge staging deploy would have replaced the production runtime with a
proxy. Nothing checked that workflows, docs and the account agreed. The
[audit](../reviews/liara-iran-infrastructure/AUDIT.md) lists every finding.

## Decision

1. **`infra/liara-iran-runtime/stack.json` is the single source of truth**
   for GLOBAL (names only, never a Liara target), IRAN production, IRAN
   staging and the dormant edge: app ids, network, database, domains, roles,
   required variables and the GitHub environment of each target.
2. **Live identifiers win over tidy names.** Production keeps
   `openfund-iran` and the private network `staging`: renaming a Liara app,
   network or database recreates it. New resources follow
   `openfund-iran[-staging][-worker|-db|-cms|-net]`; the edge uses
   `openfund-iran-edge[-staging]`.
3. **No identifier is shared between scopes**, and a worker is never public,
   never runs `http` and never migrates. Only the web app migrates, so it
   deploys first.
4. **Drift fails loudly.** `scripts/liara/check-infra.mjs` checks the
   repository in CI, the live account and GitHub with `--live`, and guards
   both deploy workflows before they deploy: the runtime workflow accepts
   only the manifest's provisioned apps for its target, and the edge workflow
   refuses every runtime app.
5. **Production deploys only an official release tag**, and the image's
   `/version` records whether it is official.

## Consequences

- An unprovisioned target (`provisioned: false`, staging today) cannot be
  deployed until it is provisioned and the manifest says so.
- Renaming anything means editing the manifest first; CI then shows every
  workflow and document to update.
- The legacy edge stays in the tree but can only target its own apps.
  Reviving it needs a new decision about the domains.
- GitHub environment settings (required reviewers, variables) stay owner
  actions; the live check reports them until they match.
