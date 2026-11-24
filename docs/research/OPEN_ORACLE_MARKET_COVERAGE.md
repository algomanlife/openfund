# Open Oracle market coverage

## Actual collection result

The executed validation run attempted all three public providers. Every inventory
request failed with a classified `NETWORK` error in the execution environment.
The run accepted **zero observations**. No current total market universe or
cross-provider overlap was verified. This is failed live validation, not an
empty market universe and not successful adapter conformance.

| Required coverage fact | Observed result |
| --- | --- |
| Gains market count | Unknown: network access failed |
| Hyperliquid default, builder and spot market counts | Unknown: network access failed |
| GMX Arbitrum and Avalanche markets/tokens | Unknown: network access failed |
| Complete canonical union | Unverified |
| Gains-only / Hyperliquid-only / GMX-only | Unknown |
| Gains + Hyperliquid / Gains + GMX / Hyperliquid + GMX overlap | Unknown |
| Triple-source markets | Unknown |
| Real ambiguous mappings | Unknown |
| Temporarily unavailable instruments by category | Unknown; provider inventory unavailable |
| Asset-class counts | Unknown |

The machine-readable [actual failed coverage capture](../../packages/open-oracle/benchmarks/live-coverage.json)
records collection timestamps and `complete: false`.
[Live validation evidence](../../packages/open-oracle/benchmarks/live-validation.json)
records attempted providers, elapsed time, requested duration and zero accepted
observations. It must not be interpreted as a successful observation window.

## Remote collection follow-up

[Initial CI capture](../../packages/open-oracle/benchmarks/ci-live-initial.json)
observed a Gains inventory of 496 and a Hyperliquid inventory of 927 entries;
these are timestamped captures, not permanent counts. Its GMX four-entry result
revealed a catalog-envelope parsing defect and is explicitly rejected as complete
GMX coverage. The parser and regression test were corrected; subsequent live
validation is tracked in PR #223. The earlier local network-failure capture above
remains historical evidence of the local environment, not the current CI result.

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
