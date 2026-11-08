# ADR 0013 — Release-driven production deployment

- **Status:** Accepted (workflow implemented; first automatic run is the v0.4.2 publication)
- **Date:** 2026-11-08

## Context

[ADR 0008](0008-unified-release-authority.md) made `main` and the immutable
GitHub Release the only release authority. Publication and deployment were
then two separate manual dispatches: **Unified release** with `publish=true`,
then **Deploy or roll back official release** with a tag. The owner asked for
an approved, published version to reach Render without a second manual
dispatch.

Facts that constrain the design (inspected 2026-11-08):

- The `openfund` Render service is a Node runtime that builds the exact source
  commit (`scripts/release/render-build.mjs`). That build refuses a commit
  without a published, non-prerelease GitHub Release and compares its rebuilt
  frontend, backend and schema hashes with the release manifest. Commit
  auto-deploy is off.
- A release created with `GITHUB_TOKEN` does not emit a `release` event to
  other workflows, so an `on: release` trigger would never fire.
- The repository has no Dockerfile and publishes no container image. Moving
  Render to an image runtime would change build, start, migration and
  environment handling for the production service.

## Decision

1. Keep the source-based Render service and the verified release archive as
   the deployable package (`openfund-vX.Y.Z.tar.gz`, `SHA256SUMS`,
   `release-manifest.json`, `verification.json` on the GitHub Release). Do not
   add a container image that production would not run.
2. The **Unified release** workflow calls the deploy workflow as a final
   `deploy` job after `publish` succeeds. It passes the exact tag the run
   published. The deploy workflow is reusable (`workflow_call`) and keeps
   `workflow_dispatch` for redeploys and rollback.
3. The deploy job stays in the protected `production` environment. The
   required-reviewer approval is the one human step between publication and
   Render; `deploy.mjs` still fails closed when that policy is missing.
4. `deploy.mjs` refuses drafts and prereleases. It also refuses any tag that
   is not the latest published release unless `rollback=true`, so a delayed
   run cannot replace a newer production release.
5. A retry is idempotent: when the live `/version` and
   `/react/release-manifest.json` already match the release, no new Render
   deploy is created. The identity and CMS health checks still run.
6. Deployment uses Render's `commitId` with the manifest's exact SHA, never a
   branch head or mutable tag. The `openfund-production` concurrency group
   serializes deploys.

## Consequences

- One stable publication produces one deploy attempt for that tag. After
  approval, no manual deploy dispatch is needed.
- Removing the reviewer gate would make deployment fully unattended. That is
  a security-policy change for the owner; this ADR does not make it.
- A container package (GHCR) is not part of this decision. Adopting one needs
  a separate ADR covering the Render runtime migration, migrations at start,
  environment parity and rollback.
- Rollback remains a manual dispatch with an older tag and `rollback=true`.

[Decisions](README.md) · [Release runbook](../deployment/RELEASES.md)
