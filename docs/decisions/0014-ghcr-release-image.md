# ADR 0014 — GHCR release image

- **Status:** Accepted (workflow implemented; first image is v0.4.2)
- **Date:** 2026-11-08
- **Amends:** [ADR 0013](0013-release-driven-production-deployment.md), point 1

## Context

ADR 0013 kept the verified release archive as the only package. The owner
asked for a versioned GitHub Package beside each GitHub Release
(`ghcr.io/algomanlife/openfund:<version>`).

## Decision

1. **Release container image** (`package-image.yml`) builds an OCI image only
   from a published stable release. `scripts/release/image-payload.mjs` downloads
   `openfund-vX.Y.Z.tar.gz`, checks the tag-to-commit match, the archive
   SHA256, safe tar entries and every payload file (`verify.mjs`). The build
   context is that payload plus `infra/image/Dockerfile`; repository source,
   `.env` files and secrets never enter it.
2. The image installs backend production dependencies from the payload
   lockfile, runs as `node`, migrates additively and starts
   `apps/backend/server.js`, the same runtime contract as the Render service.
3. Before pushing, CI runs the container against a disposable PostgreSQL 17
   and requires `/health`, `/react/` and a `/version` of `matched` with the
   release version and commit.
4. Tags `X.Y.Z` and `vX.Y.Z` are pushed once. No `latest` tag. A run refuses
   to replace an existing version tag or the `image-digest.txt` release asset.
   The digest is attached to the GitHub Release and a build-provenance
   attestation is pushed to the registry.
5. Unified release calls the image workflow after `publish`, in parallel with
   the deployment. Manual dispatch builds the image for an existing release.
6. Render production is unchanged: it still builds the exact release commit
   from source and verifies it against the same manifest. The image is a
   distribution and self-hosting artifact, not what Render runs.

## Consequences

- Each stable release has a traceable package: tag → commit → archive SHA256
  → image digest, all recorded on the release.
- Pull requests that touch the image build and smoke-test it from the latest
  release without pushing.
- Switching Render to run this image would be a separate decision (runtime,
  migrations at start, environment parity, rollback).

[Decisions](README.md) · [Release runbook](../deployment/RELEASES.md)
