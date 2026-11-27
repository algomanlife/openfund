# ADR 0060 — Openfund is open source under Apache-2.0

- Status: Accepted by the owner (2026-11-27).
- Supersedes: the "no first-party license / all rights reserved" state recorded
  in the [license decision](../legal/LICENSE_DECISION.md) and the
  [licensing report](../legal/LICENSING.md).

## Context

The repository was public but Openfund's own code had no license, so it was
"all rights reserved" by default. At the same time the web application ships
AGPL-3.0-only components (PineTS and the Vela Pine addon), whose terms require
the corresponding source of the combined work to be offered to network users.
The owner states that Openfund is an open-source project and that reuse must
credit Openfund by name.

## Decision

1. Openfund's first-party code and documentation are licensed under the
   **Apache License, Version 2.0** (root [`LICENSE`](../../LICENSE)).
2. The root [`NOTICE`](../../NOTICE) names Openfund and links the repository.
   Apache-2.0 section 4(d) requires every redistribution and derivative work to
   keep it, which is the attribution the owner asked for. Section 6 grants no
   trademark rights: the Openfund name and logos stay protected.
3. Excluded from the Apache grant, each keeping its own terms (listed in
   `NOTICE` and [THIRD_PARTY_NOTICES](../../THIRD_PARTY_NOTICES.md)):
   third-party and vendored components, `packages/openfund-protocol/`
   (GPL-2.0 import), `indicators/` (per-file notices), `brand/` and the
   Openfund trademarks, `docs/business/Openfund-Prop-Investor-Pack/` (all
   rights reserved) and fonts.
4. **AGPL compatibility.** Apache-2.0 code may be combined into a GPLv3/AGPLv3
   work. The shipped web bundle that contains PineTS and the Vela Pine addon is
   conveyed under AGPL-3.0 as a combined work; its complete corresponding
   source is this public repository at the commit reported by `/version`, and
   the AGPL texts stay in `assets/notices/`. Nothing in Openfund's own terms
   restricts that offer.
5. Inbound contributions are accepted under the same license (inbound =
   outbound) with a Developer Certificate of Origin sign-off
   (`git commit -s`).

## Consequences

- Anyone may use, modify and redistribute Openfund's own code, including
  commercially, provided they keep `LICENSE` and `NOTICE` and state changes.
- The source offer for the AGPL components is satisfied by the public
  repository; deployments must keep `/version` and the notices reachable.
- The Pine indicators' CC BY-NC-SA provenance question and the GPL-2.0
  protocol import are unaffected and remain separately scoped.
- This is an engineering record of the owner's decision, not legal advice.
