# Openfund v0.6.5 — release notes

Official release, published by the *Unified release* workflow from `main`
with `release_version=0.6.5` (the owner-approved patch inside the 0.6.x line
that the batch allocates after v0.5.0). The tag, GitHub Release, archive,
checksums and manifest are the source of truth for the exact commit.
Production deployment is a separate, owner-approved step
([runbook](../deployment/LAUNCH_PARITY_RUNBOOK.md)).

It contains the full launch-completion batch (PR #132, first described in
the unpublished [0.6.0 candidate notes](openfund-0.6.0.md)), the Dependabot
updates and the release hardening below.

## Highlights

- **Backstage:** partner review and commissions; finance (expenses with
  four-eyes verification, reserves, obligations, treasury refresh); unified
  audit trail; trader suspension; commercial coupon wizard; support replies
  and departments; notification records; read-only live risk board; global
  search; operational metrics; and a Content workspace that edits website
  copy in Directus with a live read-only preview.
- **Traders:** an Inbox with in-app notifications (payout decisions,
  support replies, purchase paid, challenge passed/failed/expired) and
  support conversations.
- **Content:** the Directus Studio visual editor can frame the site again;
  coverage exceptions 75 → 49 with a placeholder-safe `pickFormat`.
- **Release and deploy:** the manifest reports the real runtime (Node 26,
  PostgreSQL 17, Directus 11.17.4); post-deploy live SIWE gate and runtime
  verification; `engine-strict`.

## Fixes in this release

- **Render dashboard deploys of `main` failed** with "Cannot derive an
  exact candidate version from the latest official release." The candidate
  check compared GitHub's paginated compare list (at most 250 commits) with
  the exact total (261). It now uses the exact total. Official tags take the
  official path, which this release makes available for the first time.
- `audit_log` insert failures are no longer swallowed: they are counted,
  logged as `[obs]` lines and shown in `/admin/operations/metrics`, together
  with engine-loop lag, market-feed staleness and payment-recovery failures.
- The equity-sampling test no longer fails in the last seconds of a minute.
- ADR numbering: the certificate ADR is 0039 (was a duplicate 0033).

## New tooling

- `scripts/release/purchase-readiness.mjs`: read-only, no-money check that a
  deployment is ready for the owner's DePay and manual purchase test.
- `scripts/ops/backup-drill.mjs`: dump, checksum, restore into a scratch
  database and compare schema and row counts.
- `scripts/ops/engine-load.mjs` and the [load report](../reviews/_archive/release-0.6.5/LOAD_REPORT.md).

## Dependencies

`ws` 8.23.0 (Ping-flood memory-exhaustion fix), `express-rate-limit` 8.7.4,
`markdownlint-cli2` 0.24.1.

## Database

Additive, idempotent: `notifications` (kind list includes `purchase_paid`),
`notification_relay_state`, support thread columns. No financial table
changes.

## Configuration

New optional variables: `CSP_EXTRA_FRAME_ANCESTORS` (openfund),
`CONTENT_SECURITY_POLICY_DIRECTIVES__CHILD_SRC` (openfund-cms),
`BACKSTAGE_DIRECTUS_TOKEN` (openfund-backstage), and the GitHub environment
variable `RELEASE_SIWE_DOMAINS`. See [ENVIRONMENT.md](../deployment/ENVIRONMENT.md).

## Security

[Security acceptance](../reviews/_archive/release-0.6.5/SECURITY_ACCEPTANCE.md) of the
new admin surface and the framing change. Real settlement recording stays
off (`BACKSTAGE_REAL_SETTLEMENT=false`) until the owner accepts it.

## Owner actions after publication

Production deployment approval, the production CMS upgrade and content
publication, secrets, the DePay and manual purchase test, real-settlement
activation, native review of ar/ru/zh-CN, and the public-copy decision in
[the release findings](../reviews/_archive/release-0.6.5/OUT_OF_SCOPE_FINDINGS.md).
