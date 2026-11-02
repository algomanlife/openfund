# Portfolio and Journal

Portfolio and Journal share product navigation while retaining separate records for each authenticated wallet, product and account. Financial records and editable notebook metadata have different authorities.

## Portfolio

Prop views use owned backend account records: open/closed positions, order history, ledger-backed trade details, notes, filters, analytical curves, performance statistics, grouped reports and CSV exports. Opening and closing fees are included in round-trip net analysis. Partial-close slices retain their original position reference. Current equity uses fresh marks; historical curves do not reconstruct missing marks.

Perpetual views use official Gains positions, pending orders, history and statistics for the session wallet. Per-collateral reporting preserves units; unavailable balances and net unrealized PnL remain unknown. Provider events are not rewritten as Prop account trades. Source errors remain visible.

Analytics reuse the attributed journal-core package for suitable derived metrics. Display calculations may use JavaScript numbers; they do not settle financial balances. See [provenance](../../third_party/luxalgo-trade-journal/PROVENANCE.md) and [product API](../architecture/PRODUCT_TERMINALS.md).

## Private notebook

Journal supports daily entries, notes, tags, classification, date/search filters, calendar/statistics views and optional trade references. Writes verify ownership and current integer version; stale edits/deletes return conflict. Prop references must belong to an actual owned trade. Perpetual references retain Gains provenance without creating a simulated trade.

`openfund-journal-v1` JSON export/restore is metadata only. Restore checks product/account identity and batches at most 50 entries atomically, within a 2 MiB request limit. Existing IDs are skipped rather than overwritten. Earlier batches remain committed if a later batch fails; retry can resume safely. Imports cannot create orders, positions, balances, funding or ledger events.

## Privacy and reporting

All product APIs require a backend session. Account mismatch is rejected; switching wallet or disconnecting removes the previous private view. CSV cells are escaped against spreadsheet formulas. Exports may contain personal decision notes and should be stored accordingly. Directus public content is never a source for private financial or notebook values.

[Wallet and Identity](../wallet/IDENTITY.md) · [Feature Status](../product/FEATURE_STATUS.md) · [Product architecture](../architecture/PRODUCT_TERMINALS.md)
