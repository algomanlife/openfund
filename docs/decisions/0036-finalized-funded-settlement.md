# ADR 0036 — Finalized funded settlement evidence

**Status:** Proposed in the funded financial controls branch.

## Decision

Funded reward settlement records a finalized Arbitrum One DAI receipt on
the existing withdrawal. The withdrawal retains its owner, approved amount,
calculation snapshot and bound recipient. Financial audit entries and the
settlement state commit in the same database transaction. Certificates and
public explorer evidence are derived from verified settlement evidence.

## Consequences

Settlement remains human-controlled. If the configured treasury or RPC
evidence is unavailable, the withdrawal remains approved. Historical operator
references do not gain finalized status by migration. Independent regional
databases still need a cross-region transaction replay strategy before
operational acceptance.
