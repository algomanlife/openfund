/* ============================================================
   Openfund — live position risk/reward overlay view model (pure)

   Builds what the chart draws for ONE open position from its
   authoritative fields only (entry, side, sl, tp, openedAt). Percentages
   are price distances from the entry — not leveraged ROE, gross PnL or net
   PnL. The ratio is the conventional R = |TP − entry| / |entry − SL| and
   exists only when BOTH levels exist and the risk is non-zero. No level is
   ever invented: SL-only → loss zone only, TP-only → profit zone only,
   neither → null (no zones; the position marker stays as before), unless
   the caller asks for an editable model ({ allowEmpty: true }): then a
   position without SL/TP still gets a zero-height box whose handles let the
   trader CREATE a level on the chart (submitted to the position API).
   ============================================================ */
(function (global) {
  'use strict';
  function model(p, opts) {
    if (!p) return null;
    const num = v => (v == null || v === '' ? null : Number(v));
    const entry = num(p.entry), sl = num(p.sl), tp = num(p.tp);
    if (!(entry > 0)) return null;
    const stop = sl > 0 ? sl : null, target = tp > 0 ? tp : null;
    if (stop == null && target == null && !(opts && opts.allowEmpty)) return null;
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
  /* ---------- SL / TP drag: what may be submitted ----------
     The executed entry is the immutable reference. A drag may change a level
     the position already has; with { allowCreate: true } it may also CREATE a
     missing level — only when the trader actually dragged it off the entry
     (a missing level still on the entry, at the market's price precision,
     stays absent, so nothing is ever invented). Every level must stay on its
     own side of the entry: LONG stop < entry < target, SHORT the reverse,
     rounded to the market's price precision. The engine re-validates every
     rule; this only refuses a request that can not be valid.
     Returns { sl, tp, changed, created } or { error }. */
  function riskEdit(p, proposed, precision, opts) {
    const entry = Number(p && p.entry);
    if (!(entry > 0)) return { error: 'no_entry' };
    const long = p.side !== 'short';
    const round = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(Number(v).toFixed(precision == null ? 8 : precision)));
    const had = { sl: Number(p.sl) > 0 ? Number(p.sl) : null, tp: Number(p.tp) > 0 ? Number(p.tp) : null };
    const create = !!(opts && opts.allowCreate);
    const level = (prev, value) => {
      if (prev != null) return round(value);
      if (!create) return null;
      const v = round(value);
      return v == null || v === round(entry) ? null : v;
    };
    const sl = level(had.sl, proposed.sl);
    const tp = level(had.tp, proposed.tp);
    if (sl != null && !(sl > 0)) return { error: 'invalid_sl' };
    if (tp != null && !(tp > 0)) return { error: 'invalid_tp' };
    if (sl != null && (long ? sl >= entry : sl <= entry)) return { error: 'sl_wrong_side' };
    if (tp != null && (long ? tp <= entry : tp >= entry)) return { error: 'tp_wrong_side' };
    const out = { sl, tp, changed: sl !== round(had.sl) || tp !== round(had.tp) };
    if (create) out.created = (had.sl == null && sl != null) || (had.tp == null && tp != null);
    return out;
  }
  /* ---------- right-hand information labels: collision-free placement ----------
     `items` carry the wanted y (the entry's pixel row, or null when unknown).
     Labels keep their price order, never overlap (min `gap` between them) and
     stay inside [top, bottom]; items without a y are appended in order. */
  function stackLabels(items, opts) {
    const top = opts.top || 0, bottom = opts.bottom, gap = opts.gap == null ? 4 : opts.gap;
    const placed = items.map((it, i) => ({ ...it, i, want: Number.isFinite(it.y) ? it.y - it.h / 2 : null }));
    let cursor = top;
    const sorted = placed.slice().sort((a, b) => (a.want ?? Infinity) - (b.want ?? Infinity) || a.i - b.i);
    for (const it of sorted) { it.top = Math.max(it.want ?? cursor, cursor); cursor = it.top + it.h + gap; }
    /* overflow at the bottom: shift the stack up, but never above `top` */
    if (Number.isFinite(bottom) && sorted.length) {
      let limit = bottom;
      for (let k = sorted.length - 1; k >= 0; k--) {
        const it = sorted[k];
        if (it.top + it.h > limit) it.top = Math.max(top, limit - it.h);
        limit = it.top - gap;
      }
    }
    return placed.map(it => ({ id: it.id, top: Math.round(it.top) }));
  }
  global.OpenfundPositionOverlay = { model, executionFills, executionGroups, markerPrice, bucket, span, riskEdit, stackLabels };
})(typeof window !== 'undefined' ? window : globalThis);
