# LuxAlgo source comparison

Upstream cloned and inspected at `834e7b68f553d1aba0d7777875cdc4622f5a7eb5` (same as vendored core), MIT. Evidence: README Features plus `packages/core/src/{metrics,analysis,aggregate,equity,edge-score,adherence}.ts`; `apps/web/src/app/{journal,notebook,reports,calendar,import}/`; API journal/export/import routes; journal-features and journal-defaults tests; lib import-review/export-format/calendar-insights. No upstream Next/SQLite server is substituted for Openfund React/PostgreSQL/session boundaries.

| Original verified feature | Existing Openfund | Compatible implementation / dependency | Status before implementation |
| --- | --- | --- | --- |
| PnL, win rates, expectancy, equity, drawdown, daily aggregates | Vendored core + portfolio API | Reuse authoritative positions; scoped metrics and charts | Existing; scope/read fixes needed |
| Advanced filters, time/direction/symbol reports | Paginated history, buckets | Add real date/search/status/sort filters, account scope | Partial |
| Trade details/executions/tags | Details/ledger, notes/tags | Validate ownership and preserve annotations | Existing; write validation needed |
| Calendar with daily stats | Incomplete day grid and wrong Persian weekday alignment | Full UTC/Gregorian grid with localized headings and daily trade links | Partial |
| Daily journal + notebook search/tags/trade links | Notes on trades only | PostgreSQL notebook entries, daily date, classification, owned trade links | Missing |
| JSON journal export/import | None | Versioned metadata-only export/import, dedup IDs, transaction atomicity | Missing |
| CSV trade export | None | Read-only filtered export, spreadsheet formula protection | Missing |
| Broker sync / 16 statement importers / manual executions | Not incorporated | Cannot write broker/manual fills into simulated engine ledger; separate import account engine required | Dependency |
| FIFO/LIFO/partial fills | Core contains algorithms; Engine positions are indivisible | Preserve actual engine position model; no invented fills | Not applicable to supported engine |
| Replay, estimated MAE/MFE, entry/exit candles | Chart terminal only | Requires per-trade candle coverage and replay adapter | Dependency |
| Exact Edge Score v2, rolling/comparison/scatter analytics | Existing radar is custom proxy | Reuse available core metrics; do not label proxy as upstream Edge Score | Partial/dependency |
| Attachments, Markdown templates, voice dictation | None | Requires upload/storage/AV policy, editor/speech support | Dependency |
| Playbook rule checklists/adherence, folders, routines/missed trades | None | Additional workflow models/UX not part of existing authoritative records | Dependency |
| AI reflection and encrypted provider credentials | None | No server provider configuration or encrypted credential subsystem | Dependency |
| Prop firm cash/ROI/payout tracking | None | No verified payout/account eligibility backend | Dependency |
| Currency conversion / trade risk defaults | DAI simulation only | Do not allow personal defaults to override server fee/risk math | Not applicable |
| Privacy masking, saved drag layouts, PDF/PNG reviews | Existing fixed dashboard | Compatible presentation features still unimplemented | Gap |

Implementation and executed verification status are recorded in DELIVERY.md after implementation; dependencies here must not be reported as completed features.


## Final compatible feature implementation

| Area | Delivered behavior |
| --- | --- |
| Existing analytics | Owned Prop journal-core metrics, realized curve/drawdown, Edge Score **v2 from upstream core**, UTC calendar, symbol/direction/asset/hour/weekday/duration/private-tag buckets |
| Trade/account records | Owned UUID-based Prop details, order history, ledger and persistent validated notes; legacy annotation compatibility; account-only selector; pagination/search/dates/status/side/sort |
| Notebook/journal | Independent Prop/Perpetual daily entries, notes, tags, classifications, date/search, owned Prop trade references, native Gains transaction-to-reflection links |
| Portability | Read-only filtered Prop CSV, native Gains page CSV, full notebook JSON export and scoped metadata-only restore (50-entry atomic batches, idempotent IDs) |
| Perpetual supported records | Verified official Gains address-scoped positions/pending orders, cursor history and provider stats; collateral-separated PnL fields and recent closing-event analytics; no invented round trips |
| Presentation | Shared terminal/account chrome, full workspace, fa/en RTL/LTR, horizontal mobile tabs, responsive tables/calendar and theme support |

The upstream app is much broader than Openfund's authoritative trading model. Broker sync/import/manual financial fills, FIFO/LIFO configuration, attachment storage/Markdown editor/voice, playbook rule engine/routines, AI credentials/reflection, replay/MAE-MFE, saved drag layouts/privacy mode and PDF/PNG review export remain gaps or dependencies. They have not been disguised as completed controls. There is no upstream Portfolio package beyond the vendored core and the original application's features audited here. Openfund retains the MIT core and Vela attribution; no incompatible Next/SQLite backend is copied.
