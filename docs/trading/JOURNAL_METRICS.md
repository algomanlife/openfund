# Journal metrics and workflows

Financial analytics read PostgreSQL position settlements, opening-fee allocations and the append-only ledger. Editable journal entries never create trades. Perpetual uses Gains records in native collateral units; unsupported fee-adjusted net statistics remain unavailable.

## Definitions

| Metric | Definition |
| --- | --- |
| Net PnL | Sum of closed-slice realized price PnL minus both allocated opening and closing fees |
| Trade Win % | Positive-net closed slices / all eligible closed slices, including exact breakevens in the denominator |
| Profit Factor | Sum of positive closed net results / absolute sum of negative closed net results; positive profit without losses is infinity; no closed trades is unknown |
| Day Win % | Positive-net UTC trading days / all UTC days with a close, including breakeven days |
| Average Win/Loss | Mean positive-net result / absolute mean negative-net result; missing either side is unknown |
| Cumulative PnL | Closed-slice net PnL in closing-time order; never labelled historical marked equity |
| Net Daily PnL | Sum of closed-slice net results by UTC close date |
| Relative drawdown | Decline from the realized-equity running peak using the initial virtual balance; live account risk is separately labelled observed equity |
| Balance curve | Actual `balance_after` ledger records, including opening fees at their posting time |
| Observed equity curve | Fresh equity observations persisted at most once per minute; no reconstruction of earlier marks |

Partial closes are distinct, traceable closed slices with proportional quantity, margin and opening fee; the parent retains the remainder. They count as eligible closed slices. There are no partial liquidity fills. Opening fees for still-open positions affect current balance but not closed-trade net statistics until the corresponding slice closes. Gross position mark PnL excludes estimated closing spread/fees; executable net position estimates include them. No currency conversion or cross-collateral sum is inferred.

Analytics date ranges apply to **close time** for settled slices and opening time for currently open rows. Trade history, metrics, charts, instrument/direction buckets and calendar use the same range/filter convention. Current account balance/equity and current position counts remain live account totals, labelled separately from period results.

## Edge Score v2

Reuse the vendored journal core formula; return unknown with fewer than five closed slices. Each component is normalized to 0–100 and clipped:

- Win rate / 0.60, weight 15.
- Profit factor / 3, weight 25; infinite profit factor receives the full component.
- Average win/loss ratio / 2.5, weight 20.
- One minus relative maximum drawdown / 0.25, weight 15; an unknowable percentage is neutral 50.
- Recovery factor / 3, weight 10; positive profit with zero drawdown receives the full component.
- Winning-day concentration: full component when the largest profitable day is at most 15% of total day profits; linear decline to zero at 100%, weight 15. No profitable days receives zero.

The score is the weighted mean, rounded to two decimals. [Formula source](../../third_party/luxalgo-trade-journal/packages-core/src/edge-score.ts). This descriptive score never imposes Free Trial trading restrictions.

## Navigation and persistent workflows

Dashboard and Reports provide filtered metrics, cumulative/daily PnL, calendar, instrument reports and actual balance/observed-equity series. Calendar supports month navigation and opens a dated Daily Journal entry. Trades reuses the existing portfolio, detail, filters and trade-note workflow.

Daily Journal, Notebook, Playbooks, Progress, Missed Trades and Prop Firms use existing private PostgreSQL entries. Module classifications are `daily`, `playbook`, `progress`, `missed_trade` and `prop_firm`; Notebook preserves unrestricted classifications. Missed trades and firm research are notes, not executed trades or proof of a commercial relationship. Playbooks store plans and tags; Progress combines actual analytics with private review notes.

Import restores existing `openfund-journal-v1` account-scoped metadata with ID duplicate prevention and revision protection. It cannot import financial performance. Accounts shows the unified directory. Settings exposes UTC boundaries, account denomination and display preference restoration. The dashboard's 7D/30D/90D/YTD/All controls, instrument/direction filters, layouts and card visibility are functional. Range/layout/hidden cards persist on the server per product/account.

Terminated trials are read-only across notes, settings and imports. The grouped All accounts view preserves attribution and unknown values. User annotations, provider records and engine settlements remain distinct.

[Account model](UNIFIED_ACCOUNTS.md) · [Existing portfolio contract](PORTFOLIO_JOURNAL.md)
