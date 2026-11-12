// Footprint settings — ONE declarative list drives both the chart-type settings tab
// (Vela `ChartTypeSettingsSection`, persisted under `chartTypes.footprint` in the
// renderer config) and the overlay indicator's inputs (persisted as indicator
// inputs). Both live inside the existing per-wallet chart workspace document, so
// no new storage, ownership or revision logic is introduced.
import { msg } from '../../../../vendor/vela/src/core/i18n/message';
import type { ChartTypeSettingsSection, SettingsRowDescriptor } from '../../../../vendor/vela/src/chart-types/registry';
import type { InputSchema, InputValue } from '../../../../vendor/vela/src/core/model/inputs';

export type FootprintMode = 'bidAskLadder' | 'bidAskProfile' | 'volumeProfile' | 'deltaProfile' | 'absoluteDelta';
export type FootprintPosition = 'within' | 'right' | 'left';
export type CellValues = 'auto' | 'bidAsk' | 'total' | 'delta' | 'trades' | 'bidAskTrades';

export const MODE_OPTIONS: ReadonlyArray<readonly [FootprintMode, string]> = [
    ['bidAskLadder', 'Bid × Ask Ladder'],
    ['bidAskProfile', 'Bid × Ask Profile'],
    ['volumeProfile', 'Volume Profile'],
    ['deltaProfile', 'Delta Profile'],
    ['absoluteDelta', 'Absolute Delta'],
];
const POSITION_OPTIONS: ReadonlyArray<readonly [FootprintPosition, string]> = [['within', 'Within'], ['right', 'Right'], ['left', 'Left']];
const VALUE_OPTIONS: ReadonlyArray<readonly [CellValues, string]> = [
    ['auto', 'Auto'], ['bidAsk', 'Bid × Ask'], ['total', 'Total'], ['delta', 'Delta'], ['trades', 'Trades'], ['bidAskTrades', 'Bid × Ask Trades'],
];

/** Openfund brand defaults (dark theme up/down). Colors are user-editable. */
export const DEFAULTS = {
    rowMode: 'auto', ticksPerRow: 1,
    f1Mode: 'bidAskLadder', f1Position: 'within', f1Values: 'auto',
    f2Enabled: false, f2Mode: 'deltaProfile', f2Position: 'left', f2Values: 'auto',
    f3Enabled: false, f3Mode: 'volumeProfile', f3Position: 'right', f3Values: 'auto',
    buyColor: '#82E7BD', sellColor: '#E89483',
    showPoc: true, pocColor: '#F2C94C', nakedPoc: false,
    valueArea: true, valueAreaPct: 70,
    imbalance: true, imbalanceRatio: 300, imbalanceBuyColor: '#3FE0A0', imbalanceSellColor: '#FF6B5B', recolorValues: false,
    stacked: true, stackedMin: 3,
    statTable: true, statPlacement: 'below',
    statVolume: true, statDelta: true, statDeltaPct: true, statBuy: false, statSell: false,
    statBuyPct: false, statSellPct: false, statTrades: false, statCvd: false,
    volMin: 0, volMax: 0, bidMin: 0, bidMax: 0, askMin: 0, askMax: 0,
    visibleRangeProfile: false,
} as const;

export type FootprintSettings = { -readonly [K in keyof typeof DEFAULTS]: (typeof DEFAULTS)[K] extends boolean ? boolean : (typeof DEFAULTS)[K] extends number ? number : string };

/** Merge a stored bag over the defaults with type checks (a malformed or legacy value
 *  falls back to its default instead of breaking the layer). */
export function normalizeSettings(bag: Record<string, unknown> | null | undefined): FootprintSettings {
    const out: Record<string, unknown> = { ...DEFAULTS };
    for (const [k, d] of Object.entries(DEFAULTS)) {
        const v = bag?.[k];
        if (v !== undefined && typeof v === typeof d) out[k] = v;
    }
    const s = out as FootprintSettings;
    s.ticksPerRow = Math.min(64, Math.max(1, Math.round(s.ticksPerRow)));
    s.valueAreaPct = Math.min(100, Math.max(1, s.valueAreaPct));
    s.imbalanceRatio = Math.min(10000, Math.max(101, s.imbalanceRatio));
    s.stackedMin = Math.min(20, Math.max(2, Math.round(s.stackedMin)));
    /* at most ONE instance may sit Within (Vela rule) — later ones fall back to Right */
    let within = false;
    for (const p of ['f1', 'f2', 'f3'] as const) {
        const on = p === 'f1' || s[`${p}Enabled` as 'f2Enabled'];
        if (!on) continue;
        if (s[`${p}Position`] === 'within') { if (within) s[`${p}Position`] = 'right'; within = true; }
    }
    return s;
}

const L = (id: string, text: string) => msg(`footprint.settings.${id}`, text);
const opts = (o: ReadonlyArray<readonly [string, string]>, prefix: string) => o.map(([v, t]) => [v, L(`${prefix}.${v}`, t)] as const);

function instanceRows(p: 'f1' | 'f2' | 'f3'): SettingsRowDescriptor[] {
    return [
        { kind: 'select', key: `${p}Mode`, label: L('mode', 'Display mode'), options: opts(MODE_OPTIONS, 'mode'), defval: DEFAULTS[`${p}Mode`] },
        { kind: 'select', key: `${p}Position`, label: L('position', 'Position'), options: opts(POSITION_OPTIONS, 'position'), defval: DEFAULTS[`${p}Position`] },
        { kind: 'select', key: `${p}Values`, label: L('values', 'Cell values'), options: opts(VALUE_OPTIONS, 'values'), defval: DEFAULTS[`${p}Values`] },
    ];
}

const sharedRows: SettingsRowDescriptor[] = [
    { kind: 'heading', label: L('rows', 'Rows') },
    { kind: 'select', key: 'rowMode', label: L('rowSize', 'Row size'), options: [['auto', L('rowSize.auto', 'Auto')], ['manual', L('rowSize.manual', 'Manual')]], defval: DEFAULTS.rowMode },
    { kind: 'number', key: 'ticksPerRow', label: L('ticksPerRow', 'Ticks per row'), defval: DEFAULTS.ticksPerRow, min: 1, max: 64, step: 1, when: { key: 'rowMode', equals: 'manual' } },
    { kind: 'heading', label: L('levels', 'Levels') },
    { kind: 'toggle', key: 'showPoc', label: L('poc', 'Point of control'), defval: true, colors: [{ key: 'pocColor', label: L('pocColor', 'POC color'), defval: DEFAULTS.pocColor }] },
    { kind: 'toggle', key: 'nakedPoc', label: L('nakedPoc', 'Extend POC until broken'), defval: false },
    { kind: 'toggle', key: 'valueArea', label: L('valueArea', 'Value area (%)'), defval: true, number: { key: 'valueAreaPct', label: L('valueAreaPct', 'Value area (%)'), defval: 70, min: 1, max: 100, step: 1 } },
    { kind: 'heading', label: L('imbalances', 'Imbalances') },
    { kind: 'toggle', key: 'imbalance', label: L('imbalance', 'Imbalance highlight — ratio (%)'), defval: true, number: { key: 'imbalanceRatio', label: L('imbalanceRatio', 'Ratio (%)'), defval: 300, min: 101, max: 10000, step: 10 },
        colors: [{ key: 'imbalanceBuyColor', label: L('imbalanceBuy', 'Buy imbalance'), defval: DEFAULTS.imbalanceBuyColor }, { key: 'imbalanceSellColor', label: L('imbalanceSell', 'Sell imbalance'), defval: DEFAULTS.imbalanceSellColor }] },
    { kind: 'toggle', key: 'recolorValues', label: L('recolorValues', 'Recolor values'), defval: false },
    { kind: 'toggle', key: 'stacked', label: L('stacked', 'Stacked imbalances — min rows'), defval: true, number: { key: 'stackedMin', label: L('stackedMin', 'Min stacked rows'), defval: 3, min: 2, max: 20, step: 1 } },
    { kind: 'heading', label: L('colors', 'Colors') },
    { kind: 'color', key: 'buyColor', label: L('buyColor', 'Buy (ask)'), defval: DEFAULTS.buyColor },
    { kind: 'color', key: 'sellColor', label: L('sellColor', 'Sell (bid)'), defval: DEFAULTS.sellColor },
    { kind: 'heading', label: L('stats', 'Stat table') },
    { kind: 'toggle', key: 'statTable', label: L('statTable', 'Show stat table'), defval: true },
    { kind: 'select', key: 'statPlacement', label: L('statPlacement', 'Placement'), options: [['below', L('statPlacement.below', 'Below')], ['above', L('statPlacement.above', 'Above')]], defval: 'below', when: { key: 'statTable', equals: true } },
    ...([['statVolume', 'Total volume', true], ['statBuy', 'Buy volume', false], ['statSell', 'Sell volume', false], ['statBuyPct', 'Buy %', false], ['statSellPct', 'Sell %', false],
        ['statDelta', 'Delta', true], ['statDeltaPct', 'Delta %', true], ['statTrades', 'Trade count', false], ['statCvd', 'Cumulative delta (loaded range)', false]] as const)
        .map(([key, text, d]): SettingsRowDescriptor => ({ kind: 'toggle', key, label: L(key, text), defval: d, when: { key: 'statTable', equals: true } })),
    { kind: 'heading', label: L('filters', 'Filters') },
    { kind: 'range', label: L('filterVolume', 'Volume'), minKey: 'volMin', maxKey: 'volMax', defval: 0, min: 0, step: 0.0001, placeholder: L('off', 'Off') },
    { kind: 'range', label: L('filterBid', 'Bid volume'), minKey: 'bidMin', maxKey: 'bidMax', defval: 0, min: 0, step: 0.0001, placeholder: L('off', 'Off') },
    { kind: 'range', label: L('filterAsk', 'Ask volume'), minKey: 'askMin', maxKey: 'askMax', defval: 0, min: 0, step: 0.0001, placeholder: L('off', 'Off') },
    { kind: 'heading', label: L('visibleRange', 'Visible range') },
    { kind: 'toggle', key: 'visibleRangeProfile', label: L('visibleRangeProfile', 'Visible range profile'), defval: false },
];

/** Chart-type settings tab: instance strip (Footprint 1–3) + shared groups. */
export function chartTypeSettings(): ChartTypeSettingsSection {
    return {
        title: msg('footprint.title', 'Footprint'),
        placement: 'after-symbol',
        instances: [
            { label: L('instance1', 'Footprint 1'), rows: [...instanceRows('f1'), ...sharedRows] },
            { label: L('instance2', 'Footprint 2'), enableKey: 'f2Enabled', rows: instanceRows('f2') },
            { label: L('instance3', 'Footprint 3'), enableKey: 'f3Enabled', rows: instanceRows('f3') },
        ],
    };
}

/** Overlay indicator inputs: a single instance (Vela rule) with the same keys. */
export function overlayInputs(): InputSchema[] {
    const out: InputSchema[] = [];
    const sel = (key: keyof typeof DEFAULTS, title: string, options: ReadonlyArray<readonly [string, string]>, g: string, defval = DEFAULTS[key] as string): InputSchema =>
        ({ key, title, type: 'string', defval, options: options.map(o => o[0]), display: { options: Object.fromEntries(options.map(o => [o[0], o[1]])) }, group: g });
    out.push(sel('f1Mode', 'Display mode', MODE_OPTIONS, 'Footprint'));
    /* overlay: the candle stays in the middle, the footprint sits to its right */
    out.push(sel('f1Position', 'Position', [['right', 'Right'], ['left', 'Left'], ['within', 'Within']], 'Footprint', 'right'));
    out.push(sel('f1Values', 'Cell values', VALUE_OPTIONS, 'Footprint'));
    out.push(sel('rowMode', 'Row size', [['auto', 'Auto'], ['manual', 'Manual']], 'Rows'));
    out.push({ key: 'ticksPerRow', title: 'Ticks per row', type: 'int', defval: 1, min: 1, max: 64, step: 1, group: 'Rows', when: { key: 'rowMode', equals: 'manual' } });
    const bool = (key: keyof typeof DEFAULTS, title: string, g: string) => out.push({ key, title, type: 'bool', defval: DEFAULTS[key] as boolean, group: g });
    const num = (key: keyof typeof DEFAULTS, title: string, g: string, min: number, max: number, step: number) => out.push({ key, title, type: Number.isInteger(step) ? 'int' : 'float', defval: DEFAULTS[key] as number, min, max, step, group: g });
    const color = (key: keyof typeof DEFAULTS, title: string, g: string) => out.push({ key, title, type: 'color', defval: DEFAULTS[key] as string, group: g });
    bool('showPoc', 'Point of control', 'Levels'); color('pocColor', 'POC color', 'Levels'); bool('nakedPoc', 'Extend POC until broken', 'Levels');
    bool('valueArea', 'Value area', 'Levels'); num('valueAreaPct', 'Value area (%)', 'Levels', 1, 100, 1);
    bool('imbalance', 'Imbalance highlight', 'Imbalances'); num('imbalanceRatio', 'Ratio (%)', 'Imbalances', 101, 10000, 10);
    bool('recolorValues', 'Recolor values', 'Imbalances'); bool('stacked', 'Stacked imbalances', 'Imbalances'); num('stackedMin', 'Min stacked rows', 'Imbalances', 2, 20, 1);
    color('buyColor', 'Buy (ask)', 'Colors'); color('sellColor', 'Sell (bid)', 'Colors');
    color('imbalanceBuyColor', 'Buy imbalance', 'Colors'); color('imbalanceSellColor', 'Sell imbalance', 'Colors');
    bool('statTable', 'Stat table', 'Stat table');
    for (const [k, t] of [['statVolume', 'Total volume'], ['statDelta', 'Delta'], ['statDeltaPct', 'Delta %'], ['statBuy', 'Buy volume'], ['statSell', 'Sell volume'], ['statTrades', 'Trade count'], ['statCvd', 'Cumulative delta (loaded range)']] as const) bool(k, t, 'Stat table');
    for (const [k, t] of [['volMin', 'Min volume'], ['volMax', 'Max volume']] as const) num(k, t, 'Filters', 0, 1e12, 0.0001);
    return out;
}

export function overlayDefaults(): Record<string, InputValue> {
    const out: Record<string, InputValue> = {};
    for (const s of overlayInputs()) out[s.key] = s.defval;
    return out;
}
