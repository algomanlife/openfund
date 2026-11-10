# ADR 0019 — Upstream isolation and controlled updates

- **Status:** Accepted
- **Date:** 2026-11-10
- **Note on numbering:** 0018 is reserved by the open payments pull requests; the Directus upgrade policy is ADR 0020.

## Context

Openfund depends on LuxAlgo Vela (vendored, with three local source edits), its Pine addon and PineTS (npm, with a build-time wrapper), the hosted Gains API, the Gains SDK and the Trade Journal core (vendored, unmodified), Directus, and ordinary npm libraries. Before this decision the edits to `vendor/vela` were visible only in git history, nothing proved that a vendor refresh would keep them, and Gains behaviour was tested only against the live feed.

## Decision

1. **Three layers.** Upstream code is replaced wholesale, the integration layer owns adapters, normalisation and error handling, and Openfund-custom code never changes with an upstream update.
2. **Edits to upstream source are patches.** Each is a reversible diff with a reason, affected version, guard and regression test in `infra/upstream/patches.json`. The vendored tree must equal "upstream at the installed ref plus registered patches"; `infra/upstream/vendor-manifest.json` makes any other change fail review.
3. **Customisations are guarded.** Branding, the paired legal attribution (hidden built-in mark plus a visible linked notice), themes, layout, indicators, persistence, localisation and Gains freshness rules have static guards, byte-identical mirrors and browser regressions.
4. **Updates are reported before they are applied.** `update-vendor` fetches the official source, proves the starting point, flags risk and legal changes, re-applies the patches and refuses to write on a conflict. It never commits, builds, merges or deploys.
5. **Gains is protected by contract.** Stable internal contract, recorded-fixture tests, an optional read-only live check. A provider change is fixed in the integration layer; the trading engine and execution rules are not touched, and protocol or contract upgrades are never automatic.
6. **No upstream is upgraded by this decision.** Vela stays at 0.9.3 until a version is separately reviewed and approved.

## Consequences

- An upstream refresh that overwrites a customisation fails `npm run test:upstream` or `npm run check:upstream`.
- Every vendor change is a reviewable diff of the vendor tree, manifest, patch files and registry.
- Retiring a patch is a deliberate, tested act (OF-VELA-001 is the first candidate).
- The registry must be kept current; the dependency-governance workflow proposes updates but a human approves.

[ADR index](README.md) · [Upstream dependency registry](../integrations/UPSTREAM_REGISTRY.md) · [Patch registry](../integrations/UPSTREAM_DEPENDENCIES.md)
