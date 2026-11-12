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
  /* ---------- confirmed executions → candle markers ----------
     `records` are the account's open positions and closed history. A record
     exists only once its order filled; `openedAt` is that fill time and
     `rootId` the original fill a partial-close remainder belongs to. */
  function executionFills(records, market) {
    const out = new Map();
    for (const p of records || []) {
      if (!p || p.market !== market) continue;
      const time = Number(p.openedAt), price = Number(p.entry);
      if (!Number.isFinite(time) || time <= 0 || !(price > 0)) continue;
      const root = String(p.rootId != null ? p.rootId : p.id);
      if (!out.has(root)) out.set(root, { id: root, side: p.side === 'short' ? 'short' : 'long', time, price });
    }
    return [...out.values()];
  }
  /* UTC start of the candle containing `time` */
  function bucket(time, barMs) { return Math.floor(Number(time) / barMs) * barMs; }
  /* one marker per candle and side; individual fills are kept */
  function executionGroups(fills, barMs) {
    const groups = new Map();
    for (const f of fills) {
      const b = bucket(f.time, barMs), key = b + '|' + f.side;
      const g = groups.get(key) || { key, bucket: b, side: f.side, fills: [] };
      g.fills.push(f); groups.set(key, g);
    }
    for (const g of groups.values()) {
      g.fills.sort((a, b) => a.time - b.time);
      g.label = (g.side === 'long' ? 'BUY' : 'SELL') + (g.fills.length > 1 ? ' ×' + g.fills.length : '');
      g.placement = g.side === 'long' ? 'below' : 'above';
    }
    return groups;
  }
  /* marker price: BUY under the candle low, SELL over the candle high; without
     candle data the fill price (still on the correct candle) */
  function markerPrice(group, range) {
    const prices = group.fills.map(f => f.price);
    if (range) return group.side === 'long' ? range.low : range.high;
    return group.side === 'long' ? Math.min(...prices) : Math.max(...prices);
  }
  /* zone span: from the entry candle to `ahead` bars past the latest candle */
  function span(openedAt, now, barMs, ahead) {
    const opened = Number(openedAt), lastBar = bucket(now, barMs);
    const start = Number.isFinite(opened) && opened > 0 ? bucket(opened, barMs) : lastBar - 60 * barMs;
    return { start, end: Math.max(lastBar, start) + (ahead == null ? 12 : ahead) * barMs };
  }
  global.OpenfundPositionOverlay = { model, executionFills, executionGroups, markerPrice, bucket, span };
})(typeof window !== 'undefined' ? window : globalThis);
