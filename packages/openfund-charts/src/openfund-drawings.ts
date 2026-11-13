/*
 * Openfund host-managed drawing types, registered through Vela's public
 * drawing registry (no change to the vendored Vela source). They are created
 * only by the terminal's account bridge (legacy/terminal.js) and live in their
 * own registry group, so they never appear in the drawing toolbar.
 *
 *  of-position   a live position's entry / stop / target box. The executed
 *                entry is immutable: the entry handle does nothing, the body
 *                cannot be translated and no handle can move along the time
 *                axis. Only the stop and the target move, only vertically,
 *                and never across the entry. A level the position does not
 *                have yet (ofMissing) sits on the entry line with a grab
 *                handle at the box's right end: dragging it away from the
 *                entry CREATES that level — towards the loss side a stop
 *                loss, towards the profit side a take profit (when both are
 *                missing the drag direction picks which). Nothing is created
 *                by the drawing itself: the host submits the dropped price to
 *                the position API and redraws from the confirmed position.
 *                Labels are painted only while a handle is being dragged
 *                (live preview of the proposed price, distance % and R);
 *                otherwise the compact right-hand information label carries
 *                them.
 *  of-exec-buy / of-exec-sell
 *                compact BUY / SELL execution markers: a small triangle that
 *                sits a few pixels off the candle's low (BUY) or high (SELL),
 *                with a 10px label beyond it, so it never covers the wick.
 */
import { registerDrawingType } from '../../../vendor/vela/src/core/drawings/registry';
import { PositionTool } from '../../../vendor/vela/src/core/drawings/types/PositionTool';
import { ArrowMarkDown, ArrowMarkUp } from '../../../vendor/vela/src/core/drawings/types/ArrowMark';
import type { DrawingPoint } from '../../../vendor/vela/src/core/drawings/Drawing';
import { labelLineHeight, namedFontSize } from '../../../vendor/vela/src/renderers/shared/drawing-geometry';
import type { Projector } from '../../../vendor/vela/src/core/drawings/geometry';

type Level = 'stop' | 'target';
const ICON = '<svg viewBox="0 0 24 24"></svg>';
const GROUP = 'openfund-managed';

/* Vela hands drawings to its renderer as SERIALIZED records and rebuilds them
   from `type` through the registry, so each Openfund type carries its own
   key (the cast keeps the parent's TypeScript literal). */
export class OpenfundPositionTool extends PositionTool {
    override readonly type = 'of-position' as unknown as 'position';
    /* `declare`: never emitted as class fields, so a field initializer can not
       clobber what readProps sets during the base constructor */
    declare ofSide: 'long' | 'short';
    declare ofEditable: Level[];
    declare ofDragging: boolean;
    /** levels the position does not have yet; their handles sit on the entry */
    declare ofMissing: Level[];
    /** anchor index the current drag edits (a missing-level drag may redirect) */
    declare ofActive: 1 | 2 | null;

    protected override readProps(props: Record<string, unknown>): void {
        super.readProps(props);
        if (props.ofSide === 'long' || props.ofSide === 'short') this.ofSide = props.ofSide;
        if (Array.isArray(props.ofEditable)) this.ofEditable = props.ofEditable.filter((l): l is Level => l === 'stop' || l === 'target');
        if (Array.isArray(props.ofMissing)) this.ofMissing = props.ofMissing.filter((l): l is Level => l === 'stop' || l === 'target');
        if (typeof props.showText === 'boolean') { this.ofDragging = false; this.ofActive = null; } /* a host refresh ends the live preview */
    }

    protected override writeProps(): Record<string, unknown> {
        return { ...super.writeProps(), ofSide: this.ofSide, ofEditable: this.ofEditable ?? [], ofMissing: this.ofMissing ?? [] };
    }

    private missing(index: number): boolean {
        const level: Level | null = index === 1 ? 'stop' : index === 2 ? 'target' : null;
        return level != null && (this.ofMissing ?? []).includes(level);
    }

    /** index a drag on `index` edits: when BOTH levels are missing their handles
     *  coincide on the entry, so the side of the entry the pointer moved to picks
     *  the level (long: below = stop, above = target; short: the reverse) */
    private dragTarget(index: number, price: number): 1 | 2 {
        if (index !== 1 && index !== 2) return 1;
        if (!(this.missing(1) && this.missing(2) && this.editable(1) && this.editable(2))) return index;
        const entry = this.anchors[0]?.price ?? price;
        const long = (this.ofSide ?? 'long') === 'long';
        const below = price < entry;
        return below === long ? 1 : 2;
    }

    private editable(index: number): boolean {
        const level: Level | null = index === 1 ? 'stop' : index === 2 ? 'target' : null;
        return level != null && (this.ofEditable ?? []).includes(level);
    }

    /** The whole box never moves: a body drag keeps the original anchors. */
    override translateBody(_dt: number, _dp: number, orig: DrawingPoint[]): DrawingPoint[] {
        return orig.map((o) => ({ time: o.time, price: o.price }));
    }

    /** Entry: fixed. Stop / target: price only, and only when the position has that level. */
    override dragHandle(index: number, pt: DrawingPoint): void {
        if (!this.editable(index) || !Number.isFinite(pt.price)) return;
        const target = this.dragTarget(index, pt.price);
        const entry = this.anchors[0]?.price;
        /* an editable missing level that is not being dragged stays exactly on the
           entry (props may be inherited from Vela's last-used tool settings, so a
           level that is not editable is never touched) */
        for (const i of [1, 2] as const) if (i !== target && this.missing(i) && this.editable(i) && entry != null && this.anchors[i]) this.anchors[i].price = entry;
        const a = this.anchors[target];
        if (!a) return;
        a.price = pt.price;
        this.ofActive = target;
        this.ofDragging = true;
        this.showText = true;
        this.showPrices = true;
        this.showLossSize = false;
        const set = (i: 1 | 2) => i === target || !this.missing(i);
        this.showHeader = set(1) && set(2) && this.anchors[1]?.price !== entry && this.anchors[2]?.price !== entry;
        this.showStopLabel = set(1);
        this.showTargetLabel = set(2);
    }

    /** Keep the dragged level on its own side of the entry (clamp, never flip the other level). */
    override constrainHandleDrag(index: number): void {
        if (this.ofActive != null) index = this.ofActive;
        const entry = this.anchors[0]?.price;
        const a = this.anchors[index];
        if (entry == null || !a || (index !== 1 && index !== 2)) return;
        const long = (this.ofSide ?? 'long') === 'long';
        const eps = Math.abs(entry) * 1e-6 || 1e-9;
        const below = (index === 1) === long; /* long stop / short target sit below the entry */
        if (below && a.price >= entry) a.price = entry - eps;
        if (!below && a.price <= entry) a.price = entry + eps;
    }

    /** Only the editable levels expose a grab handle (an editable missing level's handle sits
     *  on the entry line at the box's right end); the entry itself never does. */
    override hitHandle(px: number, py: number, proj: Projector, tol: number): number {
        const i = super.hitHandle(px, py, proj, tol);
        return i > 0 && this.editable(i) ? i : -1;
    }
}

/* Compact execution markers. Glyph: 7px triangle, 3px off the anchor. */
const GAP = 3, HEAD = 7, HALF = 4.5;
function compactGlyph(anchor: DrawingPoint | undefined, paneId: string, proj: Projector, dir: 'up' | 'down'): Array<[number, number]> | null {
    if (!anchor) return null;
    const y = proj.yOf(anchor.price, paneId);
    if (y == null) return null;
    const x = proj.xOf(anchor.time);
    const s = dir === 'up' ? 1 : -1; /* up: below the low, tip pointing up at it */
    const tip = y + s * GAP;
    return [[x, tip], [x - HALF, tip + s * HEAD], [x + HALF, tip + s * HEAD]];
}
export class OpenfundExecMarkUp extends ArrowMarkUp {
    override readonly type = 'of-exec-buy' as unknown as 'arrowmarkup';
    override glyphPoints(proj: Projector): Array<[number, number]> | null { return compactGlyph(this.anchors[0], this.paneId, proj, 'up'); }
    override hitTest(): boolean { return false; }
    override hitHandle(): number { return -1; }
}
export class OpenfundExecMarkDown extends ArrowMarkDown {
    override readonly type = 'of-exec-sell' as unknown as 'arrowmarkdown';
    override glyphPoints(proj: Projector): Array<[number, number]> | null { return compactGlyph(this.anchors[0], this.paneId, proj, 'down'); }
    /* Vela places the label of any type other than 'arrowmarkdown' 4px BELOW the
       bounds; a SELL label belongs ABOVE the glyph (away from the candle), so the
       reported bounds sit one label line above the glyph. Markers are not
       hittable or selectable, so the bounds serve label placement only. */
    override bounds(proj: Projector): { x: number; y: number; w: number; h: number } | null {
        const g = this.glyphPoints(proj);
        if (!g) return null;
        const xs = g.map((p) => p[0]);
        const top = Math.min(...g.map((p) => p[1]));
        const lh = labelLineHeight(namedFontSize(this.text?.size ?? 'tiny'));
        return { x: Math.min(...xs), y: top - 8 - lh, w: Math.max(...xs) - Math.min(...xs), h: 0 };
    }
    override hitTest(): boolean { return false; }
    override hitHandle(): number { return -1; }
}

const style = { lineColor: '#82E7BD', lineWidth: 1, lineStyle: 'solid' as const };
registerDrawingType({ type: 'of-position' as never, group: GROUP, label: 'Openfund position', icon: ICON, defaultStyle: style, create: (init) => new OpenfundPositionTool(init) });
registerDrawingType({ type: 'of-exec-buy' as never, group: GROUP, label: 'Openfund BUY', icon: ICON, defaultStyle: style, create: (init) => new OpenfundExecMarkUp(init) });
registerDrawingType({ type: 'of-exec-sell' as never, group: GROUP, label: 'Openfund SELL', icon: ICON, defaultStyle: style, create: (init) => new OpenfundExecMarkDown(init) });
