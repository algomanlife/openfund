# ADR 0066 — Openfund owns the chart indicators and publishes them as open source

- Status: Accepted by the owner (2026-11-28).
- Supersedes the open licensing item of
  [ADR 0048](0048-pine-indicator-optimization-and-provenance.md) and
  [Licensing item 3](../legal/LICENSING.md#pine-indicator-sources).

## Decision

The three proprietary indicators added to the Openfund Vela chart (Open Algo
V5, Price Action Concepts and Smart Money Concepts) and their two libraries
(`Overlayslibrary`, `sdk`) are owned by Openfund and published as open source.

| File | Licence |
| --- | --- |
| `indicators/Open algo v5.pine` | Apache-2.0, "Copyright 2026 Openfund" |
| `indicators/pac v1.pine` | Apache-2.0, "Copyright 2026 Openfund" |
| `indicators/Overlayslibrary.pine` | Apache-2.0, "Copyright 2026 Openfund" |
| `indicators/sdk.pine` | Apache-2.0, "Copyright 2026 Openfund" |
| `indicators/smc-v1.pine` | CC BY-NC-SA 4.0, "© Openfund", the licence the file states |

## Consequences

- Each Apache-2.0 file carries an `SPDX-License-Identifier` header;
  `indicators/LICENSE` holds the licence text. The Terms of Use state the
  ownership.
- `smc-v1.pine` keeps the licence it was published under. Changing it is a
  separate owner decision.
- The Openfund name and logo stay outside the open-source grant
  ([ADR 0060](0060-open-source-license.md)).
- The indicators remain observational: no signal feeds orders, accounts, risk
  limits or payouts.
- The earlier provenance review is kept as a
  [historical record](../legal/history/PINE_PROVENANCE_REVIEW_2026-11.md).
