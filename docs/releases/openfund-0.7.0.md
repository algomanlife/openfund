# Openfund v0.7.0 — release notes

Official release, published on 2026-11-18 (12:50 UTC) by the *Unified
release* workflow from `main` at `34ef7ec719d2bb0e5b20d10e6112a8ccc33261a0`
([GitHub Release](https://github.com/algomanlife/openfund/releases/tag/v0.7.0):
archive, `SHA256SUMS`, `release-manifest.json`, `verification.json`,
`image-digest.txt`). The tag and Release are the source of truth; these notes
were written afterwards and do not change them.

## Contents (PRs #134–#145 after v0.6.5)

- Terminal Heatmap and Trade Radar refresh (#145).
- Challenges page demo wallet showcase (#144).
- Marketing popups and announcement bars managed in Backstage (#143, ADR 0045).
- One canonical status source and repository truth (#142).
- Coupon reliability: one-step Backstage creation, checkout coupon persistence (#141).
- Equity sampling lock regression fix (#140).
- Release stabilization and orchestration (#137, #139).
- Canonical domains, Geo-IP locale and review fixes (#135, #136, ADR 0043).
- Liara IRAN runtime fixes (#134).

## Runtime state (verified 2026-11-18 from public `/version`)

- GLOBAL Web/API (`openfi.cloud`) reports v0.7.0 `34ef7ec`.
- IRAN web (`openfi.live`) still reports v0.6.5 `a87804a`; v0.7.0 is not
  deployed there.

## Known payment issues found after release

Two genuine owner purchases with coupons on 2026-11-18 did not activate a
challenge. See the [incident report](../payments/INCIDENT_2026-11-18.md).
The fix (Openfund Pay, ADR 0046) is **not** part of v0.7.0. It is planned for
the next minor release after review.
