/* ============================================================
   Openfund — live position risk/reward overlay view model (pure)

   Builds what the chart draws for ONE open position from its
   authoritative fields only (entry, side, sl, tp, openedAt). Percentages
   are price distances from the entry — not leveraged ROE, gross PnL or net
   PnL. The ratio is the conventional R = |TP − entry| / |entry − SL| and
   exists only when BOTH levels exist and the risk is non-zero. No level is
   ever invented: SL-only → loss zone only, TP-only → profit zone only,
   neither → null (no zones; the position marker stays as before).
   ============================================================ */
(function (global) {
  'use strict';
  function model(p) {
    if (!p) return null;
    const num = v => (v == null || v === '' ? null : Number(v));
    const entry = num(p.entry), sl = num(p.sl), tp = num(p.tp);
    if (!(entry > 0)) return null;
    const stop = sl > 0 ? sl : null, target = tp > 0 ? tp : null;
    if (stop == null && target == null) return null;
    const side = p.side === 'short' ? 'short' : 'long';
    const risk = stop != null ? Math.abs(entry - stop) : null;
    const reward = target != null ? Math.abs(target - entry) : null;
    return {
      id: p.id, side, entry, stop, target, openedAt: p.openedAt,
      /* zones in price terms: loss = entry↔stop, profit = entry↔target —
         for a LONG the stop sits below and the target above; for a SHORT
         the reverse. Colors follow gain/loss, not above/below. */
      lossZone: stop != null ? { from: Math.min(entry, stop), to: Math.max(entry, stop) } : null,
      profitZone: target != null ? { from: Math.min(entry, target), to: Math.max(entry, target) } : null,
      stopPct: risk != null ? risk / entry * 100 : null,
      targetPct: reward != null ? reward / entry * 100 : null,
      ratio: risk != null && reward != null && risk > 0 ? reward / risk : null,
    };
  }
  global.OpenfundPositionOverlay = { model };
})(typeof window !== 'undefined' ? window : globalThis);
