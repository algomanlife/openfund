// Openfund Footprint plugin for Vela — built ONLY on the public plugin SDK
// (vendor/vela/src/plugin.ts): no Vela core file is modified.
//
//   Mode A  chart style "Footprint"   registerChartType('footprint') + layer 'footprint'
//           (Gains candles stay the OHLC base, slimmed under the footprint)
//   Mode B  overlay "Footprint"       registerNativeIndicator('footprint-overlay') +
//           layer 'footprint-overlay' (Gains candles untouched, footprint beside them)
//
// Both read the same page-wide FootprintChannel per symbol, so having both on screen
// never opens a second stream. Layer canvases are created by Vela with
// pointer-events:none: drawings, position overlays and SL/TP drags are unaffected.
// Nothing here emits trading events, touches drawings or writes prices anywhere.
import { msg } from '../../../../vendor/vela/src/core/i18n/message';
import { registerChartType, type SeriesDataEngine, type SeriesDataEngineHost } from '../../../../vendor/vela/src/chart-types/registry';
import { registerRendererLayer, type RendererLayerArgs, type RendererLayerInstance, type BasePaintingModulation } from '../../../../vendor/vela/src/renderers/native/layers';
import { registerNativeIndicator, type NativeIndicator, type NativeIndicatorContext } from '../../../../vendor/vela/src/core/native-indicators/NativeIndicator';
import type { InputValue } from '../../../../vendor/vela/src/core/model/inputs';
import type { OHLCV } from '../../../../vendor/vela/src/core/model/ohlcv';
import { timeframeMs } from '../../../openfund-footprint/src/core.mjs';
import { assessCompatibility } from '../../../openfund-footprint/src/compat.mjs';
import { tickAt } from '../../../openfund-footprint/src/markets.mjs';
import { channelFor, markets, setApiBase, stripProvider, feedDiagnostics, type FootprintChannel, type MarketInfo } from './feed';
import { chartTypeSettings, normalizeSettings, overlayInputs, overlayDefaults, type FootprintSettings } from './settings';
import { paintFootprint, type FootprintFrame, type FrameState, type PaintResult } from './painter';

export const FOOTPRINT_TYPE = 'footprint';
export const FOOTPRINT_OVERLAY = 'footprint-overlay';

const ICON = '<svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="7" y="5" width="6" height="18"/><rect x="15" y="5" width="6" height="18"/><path d="M7 9h14M7 13h14M7 17h14M7 21h14"/></svg>';

interface DriverHost {
    symbol: string;
    timeframe: string;
    bars(): readonly OHLCV[];
    push(frame: FootprintFrame): void;
}

/**
 * One consumer of the footprint feed for one chart (shared by both modes).
 * Lifecycle: start → (suspend ↔ resume)* → stop. While suspended or stopped it
 * holds no stream reference and no timer.
 */
class FootprintDriver {
    private host: DriverHost | null = null;
    private channel: FootprintChannel | null = null;
    private release: (() => void) | null = null;
    private market: MarketInfo | null = null;
    private state: FrameState = 'loading';
    private reason = '';
    private settings: FootprintSettings = normalizeSettings(null);
    private timer: ReturnType<typeof setInterval> | null = null;
    private pushQueued = false;
    private firstLoaded = Infinity;
    private active = false;

    start(host: DriverHost): void {
        this.host = host;
        this.active = true;
        const symbol = stripProvider(host.symbol);
        this.emit();
        markets().then((list) => {
            if (!this.active || this.host !== host) return;
            const m = list.get(symbol);
            if (!m || m.status !== 'supported') { this.state = 'unsupported'; this.reason = m?.reasons?.join(',') || 'not_mapped'; this.emit(); return; }
            this.market = m;
            this.attach();
        }).catch(() => { if (this.active) { this.state = 'error'; this.reason = 'markets_unavailable'; this.emit(); } });
    }

    private attach(): void {
        if (!this.host || !this.market || this.release) return;
        this.channel = channelFor(this.host.symbol);
        this.release = this.channel.acquire(() => this.schedule());
        /* staleness must surface even when no message arrives */
        this.timer = setInterval(() => this.schedule(), 5000);
        this.loadHistory();
    }

    private detach(): void {
        this.release?.(); this.release = null; this.channel = null;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }

    private loadHistory(): void {
        const host = this.host, ch = this.channel;
        if (!host || !ch) return;
        const bars = host.bars();
        const tfMs = timeframeMs(host.timeframe);
        if (!tfMs) { this.state = 'unsupported'; this.reason = 'timeframe'; this.emit(); return; }
        if (!bars.length) return;
        const from = bars[0]!.time, to = bars[bars.length - 1]!.time + tfMs;
        this.firstLoaded = Math.min(this.firstLoaded, from);
        ch.ensureHistory(host.timeframe, from, to).then(() => this.schedule()).catch(() => this.schedule());
    }

    suspend(): void { this.active = false; this.detach(); }
    resume(): void { if (!this.host) return; this.active = true; if (this.market) this.attach(); this.emit(); }
    stop(): void { this.active = false; this.detach(); this.host = null; }

    onBars(): void {
        const bars = this.host?.bars();
        if (bars?.length && bars[0]!.time < this.firstLoaded) this.loadHistory();   /* older history landed */
        this.schedule();
    }

    setSettings(values: Record<string, unknown>): void { this.settings = normalizeSettings(values); this.schedule(); }

    /** Coalesce pushes to at most one per animation frame / 250 ms. */
    private schedule(): void {
        if (this.pushQueued || !this.active) return;
        this.pushQueued = true;
        setTimeout(() => { this.pushQueued = false; if (this.active) this.emit(); }, 250);
    }

    private emit(): void {
        const host = this.host;
        if (!host) return;
        const tfMs = timeframeMs(host.timeframe) ?? 60_000;
        const m = this.market;
        const base: FootprintFrame = { state: this.state, reason: this.reason, coin: m?.coin ?? stripProvider(host.symbol), unit: m?.unit, priceDecimals: m?.priceDecimals ?? 0, sizeDecimals: m?.sizeDecimals ?? 0, rowUnits: 1, bars: new Map(), gaps: [], tfMs, settings: this.settings };
        if (!m || !this.channel) { host.push(base); return; }
        const { bars, rowUnits, gaps } = this.channel.bars(host.timeframe);
        const P = 10 ** (m.priceDecimals ?? 0);
        const gainsBars = host.bars();
        const hlLast = new Map<number, { price: number; time: number }>();
        for (const [t, b] of bars) if (b.lastTime) hlLast.set(t, { price: b.lastPu / P, time: b.lastTime });
        const ref = gainsBars.length ? gainsBars[gainsBars.length - 1]!.close : 0;
        const verdict = assessCompatibility({
            gainsBars: gainsBars.map(b => ({ time: b.time, close: b.close })), hlLast, tfMs,
            calibration: m.calibration, tickPrice: ref > 0 ? tickAt(ref, m.sizeDecimals ?? 0) : 0,
            feed: this.channel.status, now: Date.now(),
        });
        let state: FrameState = verdict.status as FrameState;
        if (this.channel.error && !bars.size) state = 'error';
        else if (!bars.size && this.channel.history.get(host.timeframe)?.inflight.size) state = 'loading';
        this.state = state; this.reason = verdict.reason;
        host.push({ ...base, state, reason: verdict.reason, rowUnits, bars, gaps, recentBps: verdict.recentBps });
    }
}

/* ---------------- Mode A: chart type ---------------- */

/** Engine lifecycle counters (diagnostics for browser tests). */
const lifecycle = { created: 0, started: 0, suspended: 0, resumed: 0, stopped: 0, pushes: 0 };

class FootprintEngine implements SeriesDataEngine {
    private driver = new FootprintDriver();
    private pending: Record<string, unknown> | null = null;
    constructor() { lifecycle.created++; }
    start(host: SeriesDataEngineHost): void {
        lifecycle.started++;
        if (this.pending) this.driver.setSettings(this.pending);
        this.driver.start({ symbol: host.symbol, timeframe: host.timeframe, bars: host.bars, push: (f) => { lifecycle.pushes++; host.pushData(f); } });
    }
    suspend(): void { lifecycle.suspended++; this.driver.suspend(); }
    resume(): void { lifecycle.resumed++; this.driver.resume(); }
    stop(): void { lifecycle.stopped++; this.driver.stop(); }
    onBars(): void { this.driver.onBars(); }
    onSettings(values: Record<string, unknown>): void { this.pending = values; this.driver.setSettings(values); }
}

/** Last paint per layer kind — read by browser tests through footprintDiagnostics(). */
const lastPaint: Record<string, { state?: string; bars?: number; rowUnits?: number; fade: number; at: number; canvas: HTMLCanvasElement | null; sample?: { bidCx: number; askCx: number; cy: number }; barsRef?: readonly OHLCV[] }> = {};

class FootprintLayer implements RendererLayerInstance {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private last: PaintResult = { fade: 0, anyWithin: false, drew: false };
    constructor(private readonly overlay: boolean) {}
    mount(canvas: HTMLCanvasElement): void { this.canvas = canvas; this.ctx = canvas.getContext('2d'); }
    render(args: RendererLayerArgs): void {
        const ctx = this.ctx, canvas = this.canvas;
        if (!ctx || !canvas) return;
        let frame = (args.data as FootprintFrame | null | undefined) ?? null;
        if (!this.overlay) {
            /* the chart-type layer paints only while its style is active */
            if (args.priceStyle !== FOOTPRINT_TYPE) frame = null;
            /* live dialog edits arrive per frame on the type's settings channel */
            else if (frame) frame = { ...frame, settings: normalizeSettings(args.settings) };
        }
        try {
            this.last = paintFootprint(ctx, canvas, args, frame, this.overlay);
            lastPaint[this.overlay ? 'overlay' : 'type'] = { state: this.last.state, bars: this.last.bars, rowUnits: this.last.rowUnits, fade: this.last.fade, at: Date.now(), canvas, sample: this.last.sample, barsRef: args.bars };
        } catch (e) {
            /* a painting fault never breaks the chart: blank this layer only */
            this.last = { fade: 0, anyWithin: false, drew: false };
            try { ctx.clearRect(0, 0, canvas.width, canvas.height); } catch { /* ignore */ }
            if (typeof console !== 'undefined') console.warn('[footprint] paint failed', e);
        }
    }
    modulateBase(): BasePaintingModulation | null {
        if (this.overlay || !this.last.drew || this.last.fade <= 0) return null;
        const f = this.last.fade;
        return { candleBodyScale: Math.max(0.12, 1 - 0.88 * f), ...(this.last.anyWithin ? { candleBodyAlpha: 1 - 0.6 * f } : {}) };
    }
    destroy(): void { this.canvas = null; this.ctx = null; }
}

/* ---------------- Mode B: overlay indicator ---------------- */

class FootprintOverlayIndicator implements NativeIndicator {
    private driver = new FootprintDriver();
    private ctx: NativeIndicatorContext | null = null;
    private inputs: Record<string, InputValue> = {};
    private hidden = false;
    start(ctx: NativeIndicatorContext, inputs: Record<string, InputValue>): void {
        this.ctx = ctx; this.inputs = inputs;
        ctx.emit({});   /* legend row; painting goes through the layer channel */
        this.driver.setSettings(inputs);
        this.driver.start({ symbol: ctx.symbol, timeframe: ctx.timeframe, bars: () => ctx.bars(), push: (f) => { if (!this.hidden) ctx.pushData(f); } });
    }
    onBars(): void { this.driver.onBars(); }
    onViewport(): void { /* the layer culls to the visible range per frame */ }
    setInputs(inputs: Record<string, InputValue>): void { this.inputs = inputs; this.driver.setSettings(inputs); }
    suspend(): void { this.hidden = true; this.driver.suspend(); this.ctx?.pushData(null); }
    resume(): void { this.hidden = false; this.driver.resume(); }
    stop(): void { this.driver.stop(); this.ctx?.pushData(null); this.ctx = null; }
}

let installed = false;

/**
 * Register the footprint chart type, its layers and the overlay indicator. Must run
 * before the Vela workspace is constructed (renderers pick up layers at mount).
 * Called by the host ONLY when the footprint feature flag is on.
 */
export function installFootprint(opts: { apiBase?: string } = {}): boolean {
    if (installed) return true;
    installed = true;
    setApiBase(opts.apiBase ?? '');
    registerRendererLayer({ id: FOOTPRINT_TYPE, placement: 'above-data', repaintOnCursor: true, create: () => new FootprintLayer(false) });
    registerRendererLayer({ id: FOOTPRINT_OVERLAY, placement: 'above-data', repaintOnCursor: true, create: () => new FootprintLayer(true) });
    registerChartType({
        id: FOOTPRINT_TYPE,
        label: msg('footprint.title', 'Footprint'),
        icon: ICON,
        settings: chartTypeSettings(),
        dataEngine: () => new FootprintEngine(),
        basePainting: 'candles',
    });
    registerNativeIndicator({
        type: FOOTPRINT_OVERLAY,
        title: msg('footprint.overlay.title', 'Footprint (order flow overlay)'),
        shortTitle: msg('footprint.title', 'Footprint'),
        paneHint: 'price',
        overlay: true,
        inputsSchema: overlayInputs,
        defaultInputs: overlayDefaults,
        create: () => new FootprintOverlayIndicator(),
    });
    return true;
}

export const footprintDiagnostics = () => ({ installed, ...feedDiagnostics(), paints: lastPaint, lifecycle: { ...lifecycle } });
