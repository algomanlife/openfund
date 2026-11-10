# Dependency governance

How Openfund adds, reviews and updates third-party code. The inventory of what
exists today is the generated [upstream dependency registry](../integrations/UPSTREAM_REGISTRY.md)
(source of truth: `docs/integrations/upstream-registry.json`). Vendored-source rules
are in [Upstream source management](../integrations/UPSTREAM.md); layers, the patch registry and the controlled vendor-update tool are in [Upstream isolation and patch registry](../integrations/UPSTREAM_DEPENDENCIES.md).

## Principles

1. **No uncontrolled bulk upgrades.** One logical change per pull request.
2. **Lockfiles are the pin.** Applications install with `npm ci`; each app owns its
   lockfile. A lockfile change is a shared input and triggers the full CI tier
   (`docs/development/CI.md`).
3. **Pinned upstream families move together** (Vela, the Pine addon and PineTS;
   wagmi, viem and RainbowKit) and only through the registry procedure.
4. **Majors are planned**, never proposed automatically.
5. **Licenses are reviewed before adoption.** AGPL, GPL and attribution-required
   code is recorded in the registry with its obligation. A new dependency needs a
   registry entry in the same pull request.
6. **Do not add dependencies or services speculatively.** A placeholder directory
   or an installed package is not an integration (see `AGENTS.md`).

## Automated, reviewable cadence

`.github/dependabot.yml` is intentionally conservative:

| Rule | Effect |
| --- | --- |
| Weekly, Monday | at most one grouped minor/patch pull request per ecosystem and directory |
| Majors ignored | `version-update:semver-major` is never opened automatically |
| `@luxalgo/*`, `pinets` ignored | exact-pinned upstream family, registry procedure only |
| Directus image | not scanned (pinned in `render.yaml`); managed by the Directus upgrade procedure |
| Security advisories | raised by GitHub security updates independently of the schedule |

A human reviews every update: read the changelog of each grouped package, check
the license metadata did not change, confirm CI is green in the full tier, and
merge only in the documented order (`docs/development/PULL_REQUESTS.md`).

## Advisory checks

`ci.yml` runs `npm audit` for the three manifests as a report-only job. A critical
advisory in a *runtime* dependency is a release blocker to triage; a tooling-only
advisory is recorded in the pull request. The audit never auto-fixes.

## Registry check

`node scripts/deps/check-registry.mjs` (run in CI) fails when a pinned version in
`package.json`, `render.yaml`, a workflow or a `PROVENANCE.md` no longer matches the
registry, when a listed path disappears, or when `UPSTREAM_REGISTRY.md` is stale
(`--write` regenerates it). Changing a pinned dependency therefore forces the
registry to be updated in the same pull request.

## Procedures

**Add a dependency.** Justify why existing code cannot do it, record license and
maintenance status, add the registry entry, update `docs/deployment/ENVIRONMENT.md`
if it needs configuration, and keep the lockfile change in the same pull request.

**Update a grouped minor/patch set.** Review the Dependabot pull request, run the
full CI tier, spot-check the affected area locally, merge.

**Update an upstream family or vendored source.** Dedicated branch, exact upstream
tag or commit, diff against the vendored tree, re-apply recorded local patches,
rebuild generated assets, run the tests listed in the registry entry, update the
entry (version, commit, modifications) and the changelog. Rollback: revert the pull
request; vendored trees and lockfiles are tracked, so a revert restores the previous
state exactly.

**Remove a dormant vendored tree.** Prove nothing imports it (search the repository
and the build scripts), open a dedicated pull request, keep the license text in the
registry. Dormant trees today are listed with `Runtime: no` in the registry.
