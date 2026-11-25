# Open Oracle market coverage

## Verified remote inventory and collection

The remote public-data job completed successfully for implementation commit
`15c0b1c9b1944b7396bce2fa59b3c69f7a150b2a`. It requested a 60-second observation
window and took 67,185 ms including discovery and history reads. Counts are a
timestamped snapshot, not permanent market totals.

| Provider | Discovered inventory entries | Reference observations parsed | Provider-reference historical bars |
| --- | --- | --- | --- |
| Gains | 496 | 3,397 | 10 |
| Hyperliquid | 927 | 5,139 | 11 |
| GMX | 305 | 2,592 | 3 |

The engine accepted 10,117 deduplicated input events. Hyperliquid inventory
includes default perps, every discovered builder dex and spot metadata. GMX
includes both documented active networks and both market/token catalog records.
These are inventory-entry counts; economic overlap and unique comparable
underlyings still require a reviewed equivalence corpus. The adapter reports
496 source-verified Gains identities, 235 Hyperliquid identities and 297 GMX
identities. Remaining entries stay explicit rather than being discarded.

[Actual aggregate capture](../../packages/open-oracle/benchmarks/ci-live-validated.json) ·
[Successful public run](https://github.com/algomanlife/openfund/actions/runs/45487308364).
Raw provider history remains local to the ephemeral runner; uploaded artifacts
contain aggregate counts and health only pending redistribution-term review.

## Coverage limits and historical attempts

Gains-only/Hyperliquid-only/GMX-only economic counts, all pairwise/triple overlaps,
comparable unique-market counts and representative asset-class validation are
not established by source inventory discovery alone. Unverified identities stay
source-scoped or ambiguous. Do not infer equivalence from ticker correlation.

The [initial local capture](../../packages/open-oracle/benchmarks/live-coverage.json)
failed every network request. The [first remote attempt](../../packages/open-oracle/benchmarks/ci-live-initial.json)
reached Gains/Hyperliquid but exposed a GMX envelope defect. That defect was
fixed and regression-tested before the successful revalidation above. Both
failed captures are historical evidence, not the current conformance result.

## Implemented inventory behavior

Discovery traverses the complete supplied Gains catalog, every Hyperliquid perp
dex reported by `perpDexs`, Hyperliquid spot metadata, and GMX's documented
Arbitrum/Avalanche market and token catalogs. All discovered entries are
registered, including ambiguous, delisted, closed and unsupported-reference
instruments. Inventory failures prevent a complete-union claim.

The coverage writer exports collection time, source inventory status, counts,
canonical entries, exclusive source combinations, ambiguous mappings and
asset-class counts as JSON and Markdown. Unknown semantic identity remains
source-scoped; symbol matching alone does not inflate overlap counts. A reviewed
equivalence corpus is necessary to establish actual comparable cross-source
instruments, units, quote currencies, stock identities and session calendars.

Fixtures deliberately cover crypto, forex, builder synthetic and spot identities
without presenting their small inventory as live market coverage. Representative
live validation across every available category remains an explicit incomplete
acceptance requirement.

## Repeat collection

```bash
node packages/open-oracle/scripts/live.mjs /tmp/oracle-validation 60000
```

Use a network-enabled development host or the separate pull-request/manual
`Open Oracle public data validation` workflow. It performs no signing,
transactions, deployment or terminal integration. Preserve actual failure
records rather than replacing them with provider marketing counts.
