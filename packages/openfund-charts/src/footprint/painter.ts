// Footprint canvas painter (shared by the chart-type layer and the overlay layer).
//
// Prices: every row is drawn at its EXACT Hyperliquid price (pu / 10^priceDecimals)
// on the chart's price scale — no offset, no normalization. Rows only group upward
// to a multiple of the row height. Numbers are always laid out left-to-right
// (bid left, ask right) whatever the UI direction: `beginPlotFrame` forces LTR.
import { barStats, groupLevels, autoRowUnits, rowPassesFilter, nakedPocs } from '../../../openfund-footprint/src/core.mjs';
import { tickAt } from '../../../openfund-footprint/src/markets.mjs';
import { beginPlotFrame } from '../../../../vendor/vela/src/renderers/native/core/plotDirection';
import { msg } from '../../../../vendor/vela/src/core/i18n/message';
import type { RendererLayerArgs } from '../../../../vendor/vela/src/renderers/native/layers';
import type { FootprintBar, Gap } from './feed';
import type { FootprintSettings, FootprintMode, FootprintPosition, CellValues } from './settings';

export type FrameState = 'loading' | 'ok' | 'warn' | 'hide' | 'stale' | 'calibrating' | 'unsupported' | 'error' | 'disabled';

/** Payload pushed through the layer's native-data channel. */
export interface FootprintFrame {
    state: FrameState;
    reason?: string;
    coin?: string;
    unit?: string;
    priceDecimals: number;
    sizeDecimals: number;
    rowUnits: number;
    bars: Map<number, FootprintBar>;
    gaps: Gap[];
    tfMs: number;
    settings: FootprintSettings;
    /** basis of recent bars in bps (diagnostic, shown in the status tooltip) */
    recentBps?: number | null;
}

const STATE_TEXT: Record<FrameState, ReturnType<typeof msg>> = {
    loading: msg('footprint.state.loading', 'loading order flow…'),
    ok: msg('footprint.state.live', 'live'),
    warn: msg('footprint.state.warn', 'price differs from chart more than usual'),
    hide: msg('footprint.state.hide', 'hidden: prices not comparable with chart'),
    stale: msg('footprint.state.stale', 'feed interrupted — data not live'),
    calibrating: msg('footprint.state.calibrating', 'checking price compatibility…'),
    unsupported: msg('footprint.state.unsupported', 'not available for this market'),
    error: msg('footprint.state.error', 'order-flow service unavailable'),
    disabled: msg('footprint.state.disabled', 'disabled'),
};
const SOURCE = msg('footprint.source', 'Footprint · Hyperliquid {coin}');
/* the footprint is drawn at Hyperliquid's own prices: say how far they sit from the chart */
const BASIS = msg('footprint.basis', '{bps} bps vs chart');
const TIP_BIDASK = msg('footprint.tip.bidAsk', 'Bid × Ask');
const TIP_TOTAL = msg('footprint.tip.total', 'Total');
const TIP_DELTA = msg('footprint.tip.delta', 'Delta');
const TIP_TRADES = msg('footprint.tip.trades', 'Trades');
const TIP_PARTIAL = msg('footprint.tip.partial', 'partial coverage');

/* ---------- formatting (ASCII digits, LTR — chart numerals) ---------- */
export function fmtVol(v: number): string {
    const a = Math.abs(v);
    if (a === 0) return '0';
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
    if (a >= 1e4) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    if (a >= 100) return v.toFixed(0);
    if (a >= 1) return v.toFixed(2).replace(/\.?0+$/, '');
    return v.toPrecision(2).replace(/0+$/, '').replace(/\.$/, '');
}
const fmtPct = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1) + '%';

function withAlpha(color: string, a: number): string {
    const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color);
    if (!m) return color;
    const n = parseInt(m[1]!, 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

interface Instance { mode: FootprintMode; position: FootprintPosition; values: CellValues }
function instances(s: FootprintSettings, overlay: boolean): Instance[] {
    const out: Instance[] = [{ mode: s.f1Mode as FootprintMode, position: s.f1Position as FootprintPosition, values: s.f1Values as CellValues }];
    if (!overlay) {
        if (s.f2Enabled) out.push({ mode: s.f2Mode as FootprintMode, position: s.f2Position as FootprintPosition, values: s.f2Values as CellValues });
        if (s.f3Enabled) out.push({ mode: s.f3Mode as FootprintMode, position: s.f3Position as FootprintPosition, values: s.f3Values as CellValues });
    }
    return out;
}

const autoValues = (mode: FootprintMode): CellValues =>
    mode === 'volumeProfile' ? 'total' : mode === 'deltaProfile' || mode === 'absoluteDelta' ? 'delta' : 'bidAsk';

interface BarView { t: number; i: number; xc: number; rows: number[][]; stats: ReturnType<typeof barStats>; partial: boolean }

/** Per-bar grouped rows + stats, memoized by (bar object, row height, stats options). */
const memo = new WeakMap<FootprintBar, Map<string, { rows: number[][]; stats: ReturnType<typeof barStats> }>>();
function viewOf(bar: FootprintBar, rowUnits: number, s: FootprintSettings) {
    const key = `${rowUnits}|${s.valueAreaPct}|${s.imbalanceRatio}|${s.stackedMin}`;
    let m = memo.get(bar);
    if (!m) { m = new Map(); memo.set(bar, m); }
    let v = m.get(key);
    if (!v) {
        const rows = groupLevels(bar.rows, rowUnits);
        v = { rows, stats: barStats(rows, { valueAreaPct: s.valueAreaPct, imbalanceRatioPct: s.imbalanceRatio, stackedMin: s.stackedMin, rowUnits }) };
        if (m.size > 6) m.clear();
        m.set(key, v);
    }
    return v;
}

export interface PaintResult { fade: number; anyWithin: boolean; drew: boolean; bars?: number; rowUnits?: number; state?: FrameState; sample?: { bidCx: number; askCx: number; cy: number } }

/**
 * Paint one frame. `overlay` = the indicator variant (candles stay; single instance).
 * Returns the zoom fade (1 = fully drawn) for the base-candle modulation.
 */
export function paintFootprint(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, args: RendererLayerArgs, frame: FootprintFrame | null, overlay: boolean): PaintResult {
    const { coords, scale, bounds, theme, bars, i18n, cursor } = args;
    const dpr = coords.dpr;
    beginPlotFrame(ctx, dpr);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    if (!frame) return { fade: 0, anyWithin: false, drew: false };
    /* every early return below still reports the frame state (diagnostics, tests) */
    const none: PaintResult = { fade: 0, anyWithin: false, drew: false, bars: 0, state: frame.state };
    if (bounds.height <= 0) return none;
    const font = theme.fontFamily || 'system-ui, sans-serif';

    const chip = (text: string, tone: 'muted' | 'warn' | 'bad') => {
        ctx.save();
        ctx.font = `11px ${font}`;
        const w = ctx.measureText(text).width + 12, h = 18;
        const x = 8, y = bounds.top + bounds.height - h - 6;
        ctx.fillStyle = withAlpha(theme.background, 0.82);
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = tone === 'bad' ? theme.downColor : tone === 'warn' ? '#F2C94C' : withAlpha(theme.textColor, 0.35);
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.fillStyle = theme.textColor;
        ctx.textBaseline = 'middle';
        /* only this sentence follows the UI direction (bidi order of a Persian/Arabic
           label); every plotted number stays LTR */
        const rtl = (i18n as { direction?: string }).direction === 'rtl';
        ctx.direction = rtl ? 'rtl' : 'ltr';
        ctx.textAlign = rtl ? 'right' : 'left';
        ctx.fillText(text, rtl ? x + w - 6 : x + 6, y + h / 2 + 0.5);
        ctx.restore();
    };
    const basis = frame.recentBps != null && Number.isFinite(frame.recentBps) && (frame.state === 'ok' || frame.state === 'warn')
        ? ` · ${i18n.t(BASIS, { bps: (frame.recentBps > 0 ? '+' : '') + frame.recentBps.toFixed(1) })}` : '';
    const label = `${i18n.t(SOURCE, { coin: frame.coin ?? '' })} · ${i18n.t(STATE_TEXT[frame.state])}${basis}`;
    const tone = frame.state === 'ok' ? 'muted' : frame.state === 'warn' || frame.state === 'stale' || frame.state === 'calibrating' || frame.state === 'loading' ? 'warn' : 'bad';
    chip(label, tone);
    if (frame.state === 'hide' || frame.state === 'unsupported' || frame.state === 'error' || frame.state === 'disabled' || frame.state === 'loading') return none;
    if (!bars.length || !frame.bars.size) return none;

    const s = frame.settings;
    const pd = frame.priceDecimals, sd = frame.sizeDecimals;
    const P = 10 ** pd, Q = 10 ** sd;
    const slot = coords.pxPerBar() * 0.92;
    /* zoom fade: fully drawn from ~40px per bar, gone below ~16px (cross-fade to candles) */
    const fade = Math.max(0, Math.min(1, (slot - 16) / 24));

    const r = coords.visibleLogicalRange();
    const i0 = Math.max(0, Math.floor(r.from)), i1 = Math.min(bars.length - 1, Math.ceil(r.to));
    if (i0 > i1) return none;

    /* row height: auto = nice multiple of the server's base row reaching ~12px; manual = ticks × real tick */
    const refPrice = bars[i1]!.close;
    const pxPerPu = Math.abs(coords.priceToY(refPrice, scale, bounds) - coords.priceToY(refPrice + 1 / P, scale, bounds));
    const base = Math.max(1, frame.rowUnits);
    let rowUnits: number;
    if (s.rowMode === 'manual') {
        const tickPu = Math.max(1, Math.round((tickAt(refPrice, sd) ?? 1 / P) * P));
        rowUnits = Math.ceil((tickPu * s.ticksPerRow) / base) * base;
    } else {
        rowUnits = autoRowUnits(pxPerPu * base, 12) * base;
    }
    const lots = (x: number) => x * Q;
    const filter = { volMin: lots(s.volMin), volMax: lots(s.volMax), bidMin: lots(s.bidMin), bidMax: lots(s.bidMax), askMin: lots(s.askMin), askMax: lots(s.askMax) };
    const yOf = (pu: number) => coords.priceToY(pu / P, scale, bounds);
    const inGap = (t: number) => frame.gaps.some(g => (g.from == null || g.from < t + frame.tfMs) && g.to > t);

    const views: BarView[] = [];
    for (let i = i0; i <= i1; i++) {
        const b = bars[i]!;
        const fb = frame.bars.get(b.time);
        if (!fb || !fb.rows.length) continue;
        const v = viewOf(fb, rowUnits, s);
        views.push({ t: b.time, i, xc: coords.logicalToX(i), rows: v.rows, stats: v.stats, partial: inGap(b.time) });
    }
    const inst = instances(s, overlay);
    const anyWithin = inst.some(x => x.position === 'within');

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, bounds.top, coords.width, bounds.height);
    ctx.clip();

    /* ---- forward projections (naked POC, stacked-imbalance zones) — need all loaded bars ---- */
    if (fade > 0 && (s.nakedPoc || (s.stacked && s.imbalance))) {
        const all = [...frame.bars.values()].sort((a, b) => a.t - b.t).map(fb => { const v = viewOf(fb, rowUnits, s); return { t: fb.t, rows: v.rows, stats: v.stats }; });
        const xOfT = (t: number) => coords.timeToX(t);
        const rightX = coords.width;
        ctx.globalAlpha = fade;
        if (s.nakedPoc) {
            ctx.strokeStyle = s.pocColor; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
            for (const np of nakedPocs(all, rowUnits)) {
                const y = (yOf(np.pu) + yOf(np.pu + rowUnits)) / 2;
                const x0 = xOfT(np.t) + slot / 2, x1 = np.untilT == null ? rightX : xOfT(np.untilT);
                if (x1 < 0 || x0 > rightX || x1 <= x0) continue;
                ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
            }
            ctx.setLineDash([]);
        }
        if (s.stacked && s.imbalance) {
            for (let k = 0; k < all.length; k++) {
                const a = all[k]!;
                for (const z of a.stats.stacked) {
                    const lo = a.rows[z.fromIdx]![0]!, hi = a.rows[z.toIdx]![0]! + rowUnits;
                    let until: number | null = null;
                    for (let j = k + 1; j < all.length; j++) {
                        const sj = all[j]!.stats;
                        if (sj.lowPu != null && sj.lowPu < hi && (sj.highPu! + rowUnits) > lo) { until = all[j]!.t; break; }
                    }
                    const x0 = xOfT(a.t) - slot / 2, x1 = until == null ? rightX : xOfT(until);
                    if (x1 < 0 || x0 > rightX) continue;
                    ctx.fillStyle = withAlpha(z.side === 'buy' ? s.imbalanceBuyColor : s.imbalanceSellColor, 0.12);
                    ctx.fillRect(x0, yOf(hi), x1 - x0, yOf(lo) - yOf(hi));
                }
            }
        }
        ctx.globalAlpha = 1;
    }

    /* ---- per-bar footprints ---- */
    let hover: { v: BarView; row: number[]; x0: number; x1: number } | null = null;
    /* one ladder cell with both sides traded — geometry exposed for pixel tests */
    let sample: { bidCx: number; askCx: number; cy: number; score: number } | null = null;
    if (fade > 0) {
        const gap = Math.max(1, slot * 0.06);
        const layout = { left: inst.some(x => x.position === 'left'), within: anyWithin, right: inst.some(x => x.position === 'right') };
        for (const v of views) {
            ctx.globalAlpha = fade * (v.partial ? 0.55 : 1);
            const half = slot / 2;
            let maxSide = 0, maxTotal = 0, maxAbsD = 0;
            for (const row of v.rows) { maxSide = Math.max(maxSide, row[1]!, row[2]!); maxTotal = Math.max(maxTotal, row[1]! + row[2]!); maxAbsD = Math.max(maxAbsD, Math.abs(row[2]! - row[1]!)); }
            for (let n = 0; n < inst.length; n++) {
                const it = inst[n]!;
                const [x0, x1] = regionOf(it.position, v.xc, half, gap, layout);
                const w = x1 - x0;
                if (w < 4) continue;
                const values = it.values === 'auto' ? autoValues(it.mode) : it.values;
                for (let ri = 0; ri < v.rows.length; ri++) {
                    const row = v.rows[ri]!;
                    if (!rowPassesFilter(row, filter)) continue;
                    const yTop = yOf(row[0]! + rowUnits), yBot = yOf(row[0]!);
                    const top = Math.min(yTop, yBot), h = Math.max(1, Math.abs(yBot - yTop) - (Math.abs(yBot - yTop) > 6 ? 1 : 0));
                    if (top > bounds.top + bounds.height || top + h < bounds.top) continue;
                    const bid = row[1]!, ask = row[2]!, d = ask - bid;
                    const imb = s.imbalance ? v.stats.imbalance[ri]! : 0;
                    paintCell(ctx, it.mode, x0, w, top, h, bid, ask, d, maxSide, maxTotal, maxAbsD, s);
                    if (it.mode === 'bidAskLadder' && h >= 6 && w >= 12 && bid > 0 && ask > 0 && !imb && ri !== v.stats.pocIdx) {
                        const score = Math.min(bid, ask);
                        if (!sample || score > sample.score) sample = { bidCx: x0 + Math.max(1.5, w * 0.06), askCx: x0 + w - Math.max(1.5, w * 0.06), cy: top + h / 2, score }; /* cell edges: clear of the centred numbers */
                    }
                    if (imb && !s.recolorValues) {
                        ctx.lineWidth = 1;
                        if ((imb & 1) && (it.mode === 'bidAskLadder')) { ctx.strokeStyle = s.imbalanceBuyColor; ctx.strokeRect(x0 + w / 2 + 0.5, top + 0.5, w / 2 - 1, h - 1); }
                        if ((imb & 2) && (it.mode === 'bidAskLadder')) { ctx.strokeStyle = s.imbalanceSellColor; ctx.strokeRect(x0 + 0.5, top + 0.5, w / 2 - 1, h - 1); }
                    }
                    if (h >= 9 && w >= 26) paintValues(ctx, font, theme.textColor, it.mode, values, x0, w, top, h, row, Q, s, imb);
                    if (n === 0 && ri === v.stats.pocIdx && s.showPoc) { ctx.strokeStyle = s.pocColor; ctx.lineWidth = 1.25; ctx.strokeRect(x0 + 0.5, top + 0.5, w - 1, h - 1); }
                    if (cursor && cursor.x >= x0 && cursor.x <= x1 && cursor.y >= top && cursor.y <= top + h) hover = { v, row, x0, x1 };
                }
                /* value area bracket on the outer edge of the first instance */
                if (n === 0 && s.valueArea && v.stats.vaLoIdx >= 0) {
                    const yA = yOf(v.rows[v.stats.vaHiIdx]![0]! + rowUnits), yB = yOf(v.rows[v.stats.vaLoIdx]![0]!);
                    const ex = it.position === 'left' ? x0 - 1.5 : x1 + 1.5;
                    ctx.strokeStyle = withAlpha(theme.textColor, 0.45); ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(ex, yA); ctx.lineTo(ex, yB); ctx.stroke();
                }
            }
        }
        ctx.globalAlpha = 1;
    }

    /* ---- visible range profile (right edge, all visible bars) ---- */
    if (s.visibleRangeProfile && views.length) {
        const agg = new Map<number, number[]>();
        for (const v of views) for (const row of v.rows) {
            const a = agg.get(row[0]!);
            if (a) { a[1]! += row[1]!; a[2]! += row[2]!; } else agg.set(row[0]!, [row[0]!, row[1]!, row[2]!]);
        }
        let max = 0;
        for (const a of agg.values()) max = Math.max(max, a[1]! + a[2]!);
        const maxW = coords.width * 0.18;
        for (const a of agg.values()) {
            const top = yOf(a[0]! + rowUnits), h = Math.max(1, yOf(a[0]!) - top - 1);
            const wb = (a[1]! / max) * maxW, wa = (a[2]! / max) * maxW;
            ctx.fillStyle = withAlpha(s.sellColor, 0.45); ctx.fillRect(coords.width - wb - wa, top, wb, h);
            ctx.fillStyle = withAlpha(s.buyColor, 0.45); ctx.fillRect(coords.width - wa, top, wa, h);
        }
    }
    ctx.restore();

    /* ---- stat table (per bar strip) ---- */
    if (s.statTable && views.length && slot >= 26) paintStats(ctx, font, args, views, frame, s, Q);

    /* ---- hover readout ---- */
    if (hover) {
        const { v, row } = hover;
        const lo = row[0]! / P, hi = (row[0]! + rowUnits) / P;
        const lines = [
            `${lo.toFixed(pd)} – ${hi.toFixed(pd)}`,
            `${i18n.t(TIP_BIDASK)}: ${fmtVol(row[1]! / Q)} × ${fmtVol(row[2]! / Q)}`,
            `${i18n.t(TIP_TOTAL)}: ${fmtVol((row[1]! + row[2]!) / Q)} ${frame.unit ?? ''}`,
            `${i18n.t(TIP_DELTA)}: ${fmtVol((row[2]! - row[1]!) / Q)}`,
            `${i18n.t(TIP_TRADES)}: ${row[3]} × ${row[4]}`,
            ...(v.partial ? [i18n.t(TIP_PARTIAL)] : []),
        ];
        ctx.save();
        ctx.font = `11px ${font}`;
        const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 14, h = lines.length * 15 + 8;
        let x = cursor!.x + 14, y = cursor!.y + 14;
        if (x + w > coords.width) x = cursor!.x - w - 14;
        if (y + h > bounds.top + bounds.height) y = cursor!.y - h - 14;
        ctx.fillStyle = withAlpha(theme.background, 0.94); ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = withAlpha(theme.textColor, 0.3); ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.fillStyle = theme.textColor; ctx.textBaseline = 'top';
        lines.forEach((l, k) => ctx.fillText(l, x + 7, y + 5 + k * 15));
        ctx.restore();
    }
    return { fade: views.length ? fade : 0, anyWithin, drew: views.length > 0, bars: views.length, rowUnits, state: frame.state, sample: sample ? { bidCx: sample.bidCx, askCx: sample.askCx, cy: sample.cy } : undefined };
}

/**
 * Horizontal region of one instance inside a bar slot. Without a Within instance the
 * candle keeps the centre and Left/Right sit beside it. With one, the slot is split
 * evenly between the present positions (left | within | right), so instances never
 * overlap.
 */
function regionOf(pos: FootprintPosition, xc: number, half: number, gap: number, layout: { left: boolean; within: boolean; right: boolean }): [number, number] {
    if (!layout.within) return pos === 'right' ? [xc + gap, xc + half] : [xc - half, xc - gap];
    const order = (['left', 'within', 'right'] as const).filter(p => layout[p]);
    const w = (2 * half) / order.length, i = order.indexOf(pos as 'left' | 'within' | 'right');
    const a = xc - half + i * w;
    return [a + (i > 0 ? 1 : 0), a + w - (i < order.length - 1 ? 1 : 0)];
}

function paintCell(ctx: CanvasRenderingContext2D, mode: FootprintMode, x0: number, w: number, top: number, h: number,
    bid: number, ask: number, d: number, maxSide: number, maxTotal: number, maxAbsD: number, s: FootprintSettings): void {
    const intensity = (v: number, m: number) => (m > 0 ? 0.12 + 0.68 * (v / m) : 0);
    switch (mode) {
        case 'bidAskLadder': {
            const hw = w / 2;
            if (bid > 0) { ctx.fillStyle = withAlpha(s.sellColor, intensity(bid, maxSide)); ctx.fillRect(x0, top, hw - 0.5, h); }
            if (ask > 0) { ctx.fillStyle = withAlpha(s.buyColor, intensity(ask, maxSide)); ctx.fillRect(x0 + hw + 0.5, top, hw - 0.5, h); }
            break;
        }
        case 'bidAskProfile': {
            const c = x0 + w / 2, hw = w / 2 - 1;
            ctx.fillStyle = withAlpha(s.sellColor, 0.7); ctx.fillRect(c - (maxSide ? bid / maxSide : 0) * hw, top, (maxSide ? bid / maxSide : 0) * hw, h);
            ctx.fillStyle = withAlpha(s.buyColor, 0.7); ctx.fillRect(c, top, (maxSide ? ask / maxSide : 0) * hw, h);
            break;
        }
        case 'volumeProfile': {
            const tw = maxTotal ? ((bid + ask) / maxTotal) * w : 0, bw = bid + ask > 0 ? tw * bid / (bid + ask) : 0;
            ctx.fillStyle = withAlpha(s.sellColor, 0.65); ctx.fillRect(x0, top, bw, h);
            ctx.fillStyle = withAlpha(s.buyColor, 0.65); ctx.fillRect(x0 + bw, top, tw - bw, h);
            break;
        }
        case 'deltaProfile': {
            const c = x0 + w / 2, len = maxAbsD ? (Math.abs(d) / maxAbsD) * (w / 2 - 1) : 0;
            ctx.fillStyle = withAlpha(d >= 0 ? s.buyColor : s.sellColor, 0.7);
            ctx.fillRect(d >= 0 ? c : c - len, top, len, h);
            break;
        }
        case 'absoluteDelta': {
            const len = maxAbsD ? (Math.abs(d) / maxAbsD) * w : 0;
            ctx.fillStyle = withAlpha(d >= 0 ? s.buyColor : s.sellColor, 0.7);
            ctx.fillRect(x0, top, len, h);
            break;
        }
    }
}

function paintValues(ctx: CanvasRenderingContext2D, font: string, color: string, mode: FootprintMode, values: CellValues,
    x0: number, w: number, top: number, h: number, row: number[], Q: number, s: FootprintSettings, imb: number): void {
    const size = Math.min(11, Math.max(8, Math.floor(h - 2)));
    ctx.font = `${size}px ${font}`;
    ctx.textBaseline = 'middle';
    const y = top + h / 2 + 0.5;
    const bid = row[1]! / Q, ask = row[2]! / Q;
    const bidC = s.recolorValues && (imb & 2) ? s.imbalanceSellColor : color;
    const askC = s.recolorValues && (imb & 1) ? s.imbalanceBuyColor : color;
    const fit = (t: string, max: number) => ctx.measureText(t).width <= max;
    if (values === 'bidAsk' || values === 'bidAskTrades') {
        const l = values === 'bidAsk' ? fmtVol(bid) : String(row[3]), r = values === 'bidAsk' ? fmtVol(ask) : String(row[4]);
        if (mode === 'bidAskLadder') {
            const hw = w / 2;
            if (!fit(l, hw - 3) || !fit(r, hw - 3)) return;
            ctx.textAlign = 'right'; ctx.fillStyle = bidC; ctx.fillText(l, x0 + hw - 3, y);
            ctx.textAlign = 'left'; ctx.fillStyle = askC; ctx.fillText(r, x0 + hw + 3, y);
        } else {
            const t = `${l} × ${r}`;
            if (!fit(t, w - 4)) return;
            ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.fillText(t, x0 + w / 2, y);
        }
    } else {
        const v = values === 'total' ? fmtVol(bid + ask) : values === 'delta' ? fmtVol(ask - bid) : String(row[3]! + row[4]!);
        if (!fit(v, w - 4)) return;
        ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.fillText(v, x0 + w / 2, y);
    }
    ctx.textAlign = 'left';
}

const STAT_LABEL: Record<string, ReturnType<typeof msg>> = {
    statVolume: msg('footprint.stat.volume', 'Vol'), statBuy: msg('footprint.stat.buy', 'Buy'), statSell: msg('footprint.stat.sell', 'Sell'),
    statBuyPct: msg('footprint.stat.buyPct', 'Buy %'), statSellPct: msg('footprint.stat.sellPct', 'Sell %'), statDelta: msg('footprint.stat.delta', 'Δ'),
    statDeltaPct: msg('footprint.stat.deltaPct', 'Δ %'), statTrades: msg('footprint.stat.trades', 'Trades'), statCvd: msg('footprint.stat.cvd', 'CVD'),
};

function paintStats(ctx: CanvasRenderingContext2D, font: string, args: RendererLayerArgs, views: BarView[], frame: FootprintFrame, s: FootprintSettings, Q: number): void {
    const keys = (['statVolume', 'statBuy', 'statSell', 'statBuyPct', 'statSellPct', 'statDelta', 'statDeltaPct', 'statTrades', 'statCvd'] as const).filter(k => s[k]);
    if (!keys.length) return;
    const { bounds, theme, coords, i18n } = args;
    const rowH = 14, h = keys.length * rowH + 4;
    const y0 = s.statPlacement === 'above' ? bounds.top + 2 : bounds.top + bounds.height - h - 30;
    const slot = coords.pxPerBar() * 0.92;
    /* CVD over the loaded footprint bars (labelled "loaded range" in settings) */
    const cvd = new Map<number, number>();
    if (s.statCvd) {
        let c = 0;
        for (const b of [...frame.bars.values()].sort((a, b2) => a.t - b2.t)) { for (const r of b.rows) c += r[2]! - r[1]!; cvd.set(b.t, c); }
    }
    ctx.save();
    ctx.fillStyle = withAlpha(theme.background, 0.8);
    ctx.fillRect(0, y0, coords.width, h);
    ctx.font = `10px ${font}`;
    ctx.textBaseline = 'middle';
    const labelRight = 8 + Math.max(...keys.map(k => ctx.measureText(i18n.t(STAT_LABEL[k]!)).width));
    keys.forEach((k, n) => {
        const y = y0 + 2 + n * rowH + rowH / 2;
        ctx.textAlign = 'left'; ctx.fillStyle = withAlpha(theme.textColor, 0.7);
        ctx.fillText(i18n.t(STAT_LABEL[k]!), 4, y);
        ctx.textAlign = 'center';
        for (const v of views) {
            const st = v.stats;
            let text = '', col = theme.textColor;
            switch (k) {
                case 'statVolume': text = fmtVol(st.volume / Q); break;
                case 'statBuy': text = fmtVol(st.buy / Q); break;
                case 'statSell': text = fmtVol(st.sell / Q); break;
                case 'statBuyPct': text = st.buyPct.toFixed(0) + '%'; break;
                case 'statSellPct': text = st.sellPct.toFixed(0) + '%'; break;
                case 'statDelta': text = fmtVol(st.delta / Q); col = st.delta >= 0 ? s.buyColor : s.sellColor; break;
                case 'statDeltaPct': text = fmtPct(st.deltaPct); col = st.delta >= 0 ? s.buyColor : s.sellColor; break;
                case 'statTrades': text = String(st.trades); break;
                case 'statCvd': { const c = cvd.get(v.t) ?? 0; text = fmtVol(c / Q); col = c >= 0 ? s.buyColor : s.sellColor; break; }
            }
            const tw = ctx.measureText(text).width;
            if (tw > slot - 2 || v.xc - tw / 2 < labelRight) continue;   /* never over the label column */
            ctx.fillStyle = col;
            ctx.fillText(text, v.xc, y);
        }
    });
    ctx.restore();
}
