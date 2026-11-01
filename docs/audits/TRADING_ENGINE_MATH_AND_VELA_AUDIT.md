# Audit — Trading engine math, Gains alignment & Vela positions

> Audit date: 2026-11-01 · Branch: `qwen/trading-math-vela` (from `qwen/demo-trading`)
> **RESUME FILE.** Continue from the first unchecked item.
> Official references verified: [Gains fees & spread](https://docs.gains.trade/gtrade-leveraged-trading/fees-and-spread) ·
> [Gains v10 changelog](https://docs.gains.trade/developer/technical-reference/contracts/changelogs/v10-update) ·
> [Vela drawing-tools](https://github.com/LuxAlgo/Vela/blob/main/docs/user/drawing-tools.md) ·
> [Vela API reference](https://github.com/LuxAlgo/Vela/blob/main/docs/user/api-reference.md) (vendored 0.9.3 — matches installed).

## Issues found (file · function · root cause · impact · fix)

### BUG-1 — SL/TP and Details dialogs dead in server mode (HIGH)
- **File:** `dist/terminal.js` · `wireRowActions()`
- **Current:** `tp.getPosition(+b.dataset.sltp)` / `tp.getPosition(+b.dataset.detail)` — the `+` coerces the server's UUID position ids to `NaN`; `getPosition` returns `undefined`; both dialogs silently do nothing.
- **Impact:** users cannot modify SL/TP or view details of real positions — exactly the reported symptom ("باز و بسته کردن پوزیشن و … کار نمی‌کنه").
- **Fix:** pass the raw string id (`getPosition` was already made string-safe in `terminal-data.js`).
- **Regression:** E2E — open position → SL/TP dialog opens and saves → details dialog renders real values.

### BUG-2 — Liquidation column shows NaN (HIGH)
- **File:** `apps/web-react/src/trading/TradingBridge.tsx` · position mapping
- **Current:** the adapter does not map the `liq` field; `fmt.price(undefined)` → `NaN`.
- **Impact:** liquidation price missing in the positions table and details dialog.
- **Fix:** map `liq` using the engine's documented rule (maintenance 10% → liquidation at ~90% margin loss: `entry ∓ entry×0.9/leverage`).
- **Regression:** E2E — row shows a numeric liq price.

### BUG-3 — Close button missing / cramped positions table (user round-7 item 1)
- **File:** `dist/terminal.css` · `.bt-table` layout
- **Current:** 12 columns with no min-widths; in RTL and LTR the action buttons wrap invisibly and headers truncate ("استاتوس / ریجنریکشن" is a garbled render of استاپ‌لاس/تیک‌پرافیت).
- **Impact:** the primary Close action is effectively unreachable; table reads as broken in both languages.
- **Fix:** fixed column widths per column role, `table-layout: fixed`-style alignment, nowrap on numeric cells, action column pinned with all three buttons (بستن/SL-TP/جزئیات) visible, RTL/LTR-safe.
- **Regression:** E2E — all 12 headers readable, 3 action buttons present and clickable in fa AND en.

### BUG-4 — Closing fee charged on the EXIT notional (Gains misalignment)
- **File:** `apps/backend/engine.js` · `#closeTx()`
- **Current:** `closeFee = qty × exitPrice × fee%` — Gains: *"fees are always applied on the initial position size (without PnL)"* (fees-and-spread doc).
- **Impact:** close fee varies with PnL — a 5% price move changes the fee 5%; not Gains-equivalent.
- **Fix:** `closeFee = initialNotional × fee%` (margin × leverage at entry). Tests updated to the corrected values.
- **Reference:** Gains fees-and-spread worked example (`2485 × 0.06/100 = 1.491`).

### BUG-5 — Flat 0.05% fee for every market (Gains misalignment)
- **File:** `apps/backend/engine.js` · `SIM.FEE_PCT`
- **Current:** one flat fee for all 488 markets.
- **Expected (Gains docs):** per asset-class fee tiers — BTC/ETH 0.035%, core crypto 0.05%, non-core crypto 0.06%, forex major 0.012%.
- **Fix:** per-group fee map (class A — documented values), fallback 0.06% for unlisted groups (stocks/indices/commodities not published per-class in the public doc — class B fallback, documented).

### BUG-6 — No fixed spread on execution (Gains misalignment)
- **File:** `apps/backend/engine.js` · fills
- **Current:** execution at the raw mark.
- **Expected (Gains docs):** fixed spread per group applied to the oracle price — BTC/ETH 0.005%/side, forex 0.005%/side, most other crypto 0%.
- **Fix:** buy long at `mark×(1+spread)`, sell to open short at `mark×(1−spread)`, mirrored on close. Per-group map with documented values; liquidity/skew impact stay explicitly un-simulated (no depth data in the public API — class C).

### BUG-7 — Persian/Arabic-Indic numeric input rejected (localization)
- **File:** `dist/terminal.js` · `buildRequest()`
- **Current:** `+value`/`parseFloat` on raw input — Persian digits (۱۲۳۴۵) or Arabic-Indic (١٢٣٤٥) produce `NaN` → "کولترال باید مثبت باشد".
- **Impact:** Persian users cannot type amounts in Persian digits; fa/en users get different capabilities (must be identical math).
- **Fix:** `normNum()` normalizer (۰-۹, ٠-٩, ٫/٬ decimals, thousands separators) applied to every order-form input before parsing; the backend always receives canonical Western decimals.
- **Regression:** E2E — the same trade typed in Persian digits and English digits produces identical margin/leverage/execution/PnL.

### BUG-8 — No Vela position overlays (missing feature)
- **File:** new — `dist/terminal.js` · position drawing sync
- **Current:** positions exist only in the bottom table.
- **Expected:** Vela `position` drawing (entry/stop/target box, profit/risk zones) per open position, symbol-isolated, restored on refresh, tied to the backend position id (host-managed; user drawings untouched).
- **Fix:** `syncPositionDrawings()` using `chart.drawings.add('position', { anchors:[entry,stop,target] })`, `update(id, {anchors})` for SL/TP edits, `remove(id)` on close; mapping `positionId → drawingId`; re-sync on market switch, `of-trading-update`, refresh. Drag-to-edit NOT claimed (dedicated SL/TP dialog stays the edit surface — documented).
- **Vela API used:** `drawings.add/update/remove/all`, anchors `[entry, stop, target]` (PositionTool schema), `direction` derived from geometry.

### BUG-9 — details dialog shows client-computed PnL (minor)
- **File:** `dist/terminal.js` · details handler
- **Fix:** use the server's live mark/pnl from the adapter state (single source of truth).

## Gains parity classification (after this fix)

| Class | Items |
|---|---|
| **A — Gains-equivalent (documented)** | notional = leverage × collateral (v10: fees don't shrink size ✓ already correct); PnL = notional × Δprice%; opening fee % per asset class on notional; closing fee on INITIAL notional; fixed spread per group applied to execution price |
| **B — documented simulation assumptions** | liquidation maintenance 10% flat (Gains uses per-class threshold tables incl. closing-fee/borrowing terms — not fully published per leverage; our rule is more conservative); fee fallback 0.06% for stocks/indices/commodities; liquidation executes at mark (no gap/slippage) |
| **C — not simulated (public API lacks data)** | liquidity price impact (depth bands), skew impact (OI state), funding fees (v10 velocity model needs on-chain state), borrowing fees; no partial close/add in v1 |

## Progress checklist (resume)

- [x] Phase 1 — this audit (9 bugs, each with file/root-cause/impact/fix/regression)
- [x] Phase 2 — Gains formulas verified from official docs (fees-and-spread + v10 changelog)
- [x] 1. Engine: closing fee on INITIAL notional (BUG-4) — Gains rule "fees are always applied on the initial position size"
- [x] 2. Engine: per-group fee tiers (BTC/ETH 0.035%, crypto 0.05%, forex 0.012%, fallback 0.06%) + fixed spread on execution (BTC/ETH 0.005%/side, forex 0.005%, commodities 0.02%) — BUG-5, BUG-6; limit/stop fills at the target price without extra spread
- [x] 3. terminal.js: SL/TP + Details dialogs use raw string ids (BUG-1) — they were dead in server mode (UUID → NaN)
- [x] 4. Bridge: liq mapping + getPosition + server-side mark/pnl in details (BUG-2, BUG-9)
- [x] 5. Positions table: fixed readable columns, all 3 action buttons, RTL/LTR-safe headers (BUG-3 / round-7 item 1)
- [x] 6. Persian numeric normalization: normNum (۰-۹, ٠-٩, ٫, separators) on every order input + inputs converted to inputmode=decimal (BUG-7)
- [x] 7. Vela position drawings: chart.drawings.add('position', [entry, stop, target]) + update on SL/TP + remove on close, positionId→drawingId map, symbol isolation on market switch, restore on refresh (BUG-8)
- [x] 8. Tests: engine suite **54/54** (independent Gains-math fixtures) · acceptance E2E **23/23** (incl. Persian digits, Vela overlay, SL/TP dialog+chart sync) · regressions 18/18 + 9/9 + 11/11 on dev AND build · tsc clean
- [x] 9. Docs updated + PR
