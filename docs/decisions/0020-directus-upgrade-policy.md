# ADR 0020 — Directus upgrade policy

- **Status:** Accepted for process; the Directus 12 upgrade itself is blocked on an owner decision
- **Date:** 2026-11-10
- **Note on numbering:** ADR 0018 is reserved by the open payments pull requests and 0019 by upstream isolation; this record uses 0020.

## Context

Openfund pins Directus 11.9.1 as its editorial backstage. Directus 12 changes licensing (the free Core tier allows 25 collections and ignores custom permission rules), moves the minimum Node.js to 26 from 12.6.0, restricts `/server/health`, and changes proxy defaults. Openfund's public content model depends on 43 registered collections and on status-filtered public read rules. Staging evidence is in [the assessment](../backstage/DIRECTUS_12_ASSESSMENT.md).

## Decision

1. **Directus upgrades are never a bare image-tag change.** Each upgrade needs a staged rehearsal on a restored copy of a recent backup, the `cms-check.mjs` suite with zero failures against a baseline taken before the upgrade, a recorded licence result, and the production runbook with a rollback plan.
2. **Openfund customisations stay outside Directus core.** Schema, seeders, permissions and the verification tool are version-controlled in `apps/backstage/` and remain idempotent and additive. Existing editorial content is never overwritten by an upgrade.
3. **The CMS runtime is independent of the application runtime.** The application stays on Node 22; only the CMS image needs the newer runtime.
4. **Probes use the public endpoint.** Render and CI use `/server/ping`; `/server/health` needs a token on Directus 12.
5. **No bump to 12 until the licence question is resolved by the owner.** Staying on 11.x is an explicit, time-limited risk acceptance, not a default.
6. **Image references are pinned.** The tag is kept for readability and the index digest is recorded in the registry and runbook.

## Consequences

- The repository keeps `directus/directus:11.9.1` until the owner provides a licence or Open Innovation Grant key and the rehearsal passes with it.
- Preflight in `apply_schema.py` stops early on an unlicensed Directus 12 instead of failing half-way.
- Every future Directus change is reviewed against this checklist and recorded in the [upstream dependency registry](../integrations/UPSTREAM_DEPENDENCIES.md).

## Addendum 2026-11-12: Directus 11.17.4

The repository pin moves from 11.9.1 to 11.17.4, the latest 11.x release (option B of the [assessment](../backstage/DIRECTUS_12_ASSESSMENT.md)). Directus 12 remains blocked on the licence decision. The [rehearsal](../reviews/directus-11.17.4-staging/README.md) used a restored backup of a seeded database and passed 103 of 104 checks. Two conditions of rule 1 are still open before production deployment:

- a rehearsal on a restored copy of a recent **production** backup, with the container image;
- reviewer acceptance of the one baseline difference, which is a Directus-owned permission row (own-profile read gains the `provider` field), not an Openfund policy.

[ADR index](README.md) · [Migration runbook](../deployment/DIRECTUS_MIGRATION_RUNBOOK.md)
