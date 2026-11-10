# ADR 0021 — Upstream governance automation

- **Status:** Accepted
- **Date:** 2026-11-10
- **Builds on:** [ADR 0019](0019-upstream-isolation.md), [ADR 0020](0020-directus-upgrade-policy.md)

## Context

Upstreams move on their own schedules, with different versioning promises: Vela is 0.x, Directus ships breaking changes in minors, the Gains API has no versions, several libraries are a major behind. Openfund needs to notice changes early without giving automation the power to change production behaviour.

## Decision

1. **A scheduled workflow plus a registry file is enough.** No bot service, database or dashboard.
2. **Watch, classify, propose.** Weekly read-only checks classify risk from the provider's real policy and the release notes; the output is a single draft proposal PR that changes only `latest_observed`.
3. **Updates are separate, human-started and reported.** Vendored sources use the candidate workflow or the local tool, which stop on any patch conflict; Directus follows the migration runbook; libraries go one per PR.
4. **No automatic merge or deployment, ever.** Majors and high-risk updates are labelled for an owner decision. Workflows carry `needs-human-approval` and never enable auto-merge.
5. **Evidence is part of the PR.** Version change, compatibility result, test output and a rollback note are required before the registry marks anything reviewed.

## Consequences

- New upstream versions are visible within a week, with a stated risk and reason.
- The workflows need the repository setting that lets Actions create pull requests; otherwise reports remain artifacts.
- Browser regressions stay with maintainers and CI; the candidate PR lists them as unchecked items.

[ADR index](README.md) · [Upstream update automation](../integrations/UPSTREAM_AUTOMATION.md)
