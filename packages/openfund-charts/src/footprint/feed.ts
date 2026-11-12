// Browser-side footprint data client. Talks ONLY to the Openfund footprint service
// (/api/footprint/*); the browser never connects to Hyperliquid directly.
//
// One FootprintChannel per symbol is shared by every consumer on the page (the
// chart-type engine and the overlay indicator, any number of charts): a single
// SSE stream and one history cache per (symbol, timeframe), reference-counted and
// closed when the last consumer releases it — enabling both modes never doubles
// the subscription.
import { bucketBars, groupLevels, timeframeMs } from '../../../openfund-footprint/src/core.mjs';

export interface Slice { t: number; levels: number[][]; lastPu: number; lastTime: number; n: number }
export interface FootprintBar { t: number; rows: number[][]; lastPu: number; lastTime: number; minutes: number }
export interface MarketInfo {
    gains: string; coin: string; dex: string; unit: string; status: string; reasons: string[];
    priceDecimals: number | null; sizeDecimals: number | null;
    calibration: { n: number; medianBps: number; madBps: number; p05Bps: number; p95Bps: number; p99Bps: number } | null;
}
export interface FeedStatus { connected: boolean; lastHeartbeat: number }
export interface Gap { from: number | null; to: number; reason: string }

type Listener = () => void;

let apiBase = '';
export function setApiBase(base: string): void { apiBase = base.replace(/\/$/, ''); }

let marketsPromise: Promise<Map<string, MarketInfo>> | null = null;
/** Verified market list (cached per page; a failure is retried on the next call). */
export function markets(): Promise<Map<string, MarketInfo>> {
    if (!marketsPromise) {
        marketsPromise = fetch(`${apiBase}/api/footprint/markets`, { credentials: 'same-origin' })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(`markets ${r.status}`))))
            .then((j: { markets: MarketInfo[] }) => new Map(j.markets.map(m => [m.gains, m])))
            .catch((e) => { marketsPromise = null; throw e; });
    }
    return marketsPromise;
}

export const stripProvider = (symbol: string) => String(symbol || '').replace(/^[a-z]+:/, '');

/** Shared per-symbol channel: minute slices (history + live) and stream status. */
export class FootprintChannel {
    readonly symbol: string;
    private refs = 0;
    private es: EventSource | null = null;
    private listeners = new Set<Listener>();
    /** live minute slices received on the stream (exact levels) */
    readonly live = new Map<number, Slice>();
    /** history per timeframe: bars keyed by bar start, plus the server's base row */
    readonly history = new Map<string, { bars: Map<number, FootprintBar>; rowUnits: number; from: number; to: number; gaps: Gap[]; inflight: Set<string> }>();
    status: FeedStatus = { connected: false, lastHeartbeat: 0 };
    error: string | null = null;
    private dropped = false;

    constructor(symbol: string) { this.symbol = symbol; }

    acquire(listener: Listener): () => void {
        this.listeners.add(listener);
        if (this.refs++ === 0) this.open();
        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.listeners.delete(listener);
            if (--this.refs === 0) { this.close(); channels.delete(this.symbol); }
        };
    }

    private notify(): void { for (const l of this.listeners) { try { l(); } catch { /* a consumer error never breaks the feed */ } } }

    private open(): void {
        if (typeof EventSource === 'undefined') { this.error = 'no_eventsource'; return; }
        const es = new EventSource(`${apiBase}/api/footprint/stream?symbol=${encodeURIComponent(this.symbol)}`, { withCredentials: true });
        this.es = es;
        es.addEventListener('status', (ev) => {
            try { const s = JSON.parse((ev as MessageEvent).data); this.status = { connected: !!s.connected, lastHeartbeat: Date.now() }; } catch { /* ignore */ }
            this.error = null;
            /* back after a drop: minutes closed while we were away live only in history */
            if (this.dropped) { this.dropped = false; for (const [tf, h] of this.history) if (h.from !== Infinity) void this.ensureHistory(tf, h.from, Date.now()); }
            this.notify();
        });
        es.addEventListener('slices', (ev) => {
            try {
                const { slices } = JSON.parse((ev as MessageEvent).data) as { slices: Slice[] };
                for (const s of slices) this.live.set(s.t, s);
                /* bounded: the live map only needs the window history does not cover yet */
                if (this.live.size > 600) for (const t of [...this.live.keys()].sort((a, b) => a - b).slice(0, this.live.size - 600)) this.live.delete(t);
            } catch { return; }
            this.status = { ...this.status, lastHeartbeat: Date.now() };
            this.notify();
        });
        es.addEventListener('error', () => {
            /* EventSource reconnects by itself (server sends retry: 3000); until a status
               frame arrives again the feed reports itself disconnected → stale, never live */
            this.status = { ...this.status, connected: false };
            this.dropped = true;
            this.notify();
        });
    }

    private close(): void { try { this.es?.close(); } catch { /* ignore */ } this.es = null; }

    /** Ensure history for [from, to) at `tf` is loaded (chunked, de-duplicated). */
    async ensureHistory(tf: string, from: number, to: number): Promise<void> {
        const tfMs = timeframeMs(tf);
        if (!tfMs) return;
        let h = this.history.get(tf);
        if (!h) { h = { bars: new Map(), rowUnits: 1, from: Infinity, to: -Infinity, gaps: [], inflight: new Set() }; this.history.set(tf, h); }
        const want: Array<[number, number]> = [];
        if (h.from === Infinity) want.push([from, to]);
        else {
            if (from < h.from) want.push([from, h.from]);
            if (to > h.to) want.push([Math.max(h.to - 2 * tfMs, from), to]);   /* re-read the forming edge */
        }
        await Promise.all(want.map(async ([a, b]) => {
            for (let end = b; end > a;) {
                const start = Math.max(a, end - 1000 * tfMs);
                const key = `${start}-${end}`;
                if (h!.inflight.has(key)) { end = start; continue; }
                h!.inflight.add(key);
                try {
                    const r = await fetch(`${apiBase}/api/footprint/history?symbol=${encodeURIComponent(this.symbol)}&tf=${encodeURIComponent(tf)}&from=${start}&to=${end}`, { credentials: 'same-origin' });
                    if (!r.ok) { this.error = `history_${r.status}`; break; }
                    const j = await r.json() as { bars: FootprintBar[]; rowUnits: number; gaps: Gap[]; to: number };
                    /* all bars of one timeframe share one base row: coarsen to the widest seen */
                    if (j.rowUnits > h!.rowUnits) {
                        const ru = j.rowUnits;
                        for (const [t, b] of h!.bars) h!.bars.set(t, { ...b, rows: groupLevels(b.rows, ru) });
                        h!.rowUnits = ru;
                    }
                    for (const b of j.bars) h!.bars.set(b.t, h!.rowUnits > j.rowUnits ? { ...b, rows: groupLevels(b.rows, h!.rowUnits) } : b);
                    for (const g of j.gaps) if (!h!.gaps.some(x => x.to === g.to && x.from === g.from)) h!.gaps.push(g);
                    /* the server's `to` is the closed-minute edge where live data takes over */
                    h!.from = Math.min(h!.from, start); h!.to = Math.max(h!.to, Number.isFinite(j.to) ? j.to : end);
                    this.error = null;
                } catch { this.error = 'history_network'; break; }
                finally { h!.inflight.delete(key); }
                end = start;
            }
        }));
        this.notify();
    }

    /**
     * Bars for `tf`: history (closed minutes before the edge) merged with live minute
     * slices at or after the edge. Each live slice is the full state of its minute, so
     * the bar spanning the edge = history part + live part, never double counted.
     * Known limit: a trade arriving late for a minute BEFORE the edge reaches the chart
     * only on the next history refresh of that range (1-minute bars excepted).
     */
    bars(tf: string): { bars: Map<number, FootprintBar>; rowUnits: number; gaps: Gap[] } {
        const tfMs = timeframeMs(tf);
        const h = this.history.get(tf);
        const out = new Map<number, FootprintBar>(h ? h.bars : []);
        const rowUnits = h ? h.rowUnits : 1;
        if (tfMs) {
            const edge = h && h.to !== -Infinity ? h.to : -Infinity;
            const fresh = [...this.live.values()].filter(s => s.t >= edge);
            /* 1-minute bars ARE minutes: a late update of a closed minute replaces it exactly */
            if (tfMs === 60_000) for (const s of this.live.values()) if (s.t < edge && out.has(s.t)) out.set(s.t, { t: s.t, rows: groupLevels(s.levels, rowUnits), lastPu: s.lastPu, lastTime: s.lastTime, minutes: 1 });
            if (fresh.length) {
                for (const [t, b] of bucketBars(fresh, tfMs, rowUnits) as Map<number, FootprintBar>) {
                    const base = out.get(t);
                    out.set(t, base && base.t < edge ? mergeBars(base, b) : b);
                }
            }
        }
        return { bars: out, rowUnits, gaps: h ? h.gaps : [] };
    }
}

function mergeBars(a: FootprintBar, b: FootprintBar): FootprintBar {
    const m = new Map<number, number[]>();
    for (const r of [...a.rows, ...b.rows]) {
        const pu = r[0]!, x = m.get(pu);
        if (x) { for (let k = 1; k <= 4; k++) x[k] = x[k]! + r[k]!; } else m.set(pu, [...r]);
    }
    const last = b.lastTime >= a.lastTime ? b : a;
    return { t: a.t, rows: [...m.values()].sort((x, y) => x[0]! - y[0]!), lastPu: last.lastPu, lastTime: last.lastTime, minutes: a.minutes + b.minutes };
}

const channels = new Map<string, FootprintChannel>();
/** The page-wide channel for a symbol (created on first use). */
export function channelFor(symbol: string): FootprintChannel {
    const key = stripProvider(symbol);
    let c = channels.get(key);
    if (!c) { c = new FootprintChannel(key); channels.set(key, c); }
    return c;
}
/** Diagnostics for tests: how many channels / open streams exist. */
export function feedDiagnostics(): { channels: number; streams: string[] } {
    return { channels: channels.size, streams: [...channels.values()].filter(c => (c as unknown as { es: unknown }).es).map(c => c.symbol) };
}
