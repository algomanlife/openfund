/** Synthetic fixture only. Never sourced from user accounts, APIs or on-chain records. */
export interface ActivityPoint {
  date: string; activeAccounts: number; trades: number; volumeUsd: number; pnlVirtualDai: number
}
export interface EvaluationOutcomes { passed: number; failed: number; inProgress: number }
export interface TransparencySnapshot {
  provenance: 'sample'; periodStart: string; periodEnd: string
  demoAccounts: number; outcomes: EvaluationOutcomes; activity: ActivityPoint[]
}
export type MetricKey = 'accounts' | 'volume' | 'trades' | 'completed' | 'passRate' | 'pnl'
export interface MetricDefinition { key: MetricKey; format: 'integer' | 'usd' | 'percent' | 'virtualDai' }
export const metricDefinitions: MetricDefinition[] = [
  { key: 'accounts', format: 'integer' }, { key: 'volume', format: 'usd' },
  { key: 'trades', format: 'integer' }, { key: 'completed', format: 'integer' },
  { key: 'passRate', format: 'percent' }, { key: 'pnl', format: 'virtualDai' },
]
export const mockTransparency: TransparencySnapshot = {
  provenance: 'sample', periodStart: '2026-10-19', periodEnd: '2026-11-01',
  demoAccounts: 1248, outcomes: { passed: 84, failed: 196, inProgress: 140 },
  activity: [
    { date: '2026-10-19', activeAccounts: 142, trades: 620, volumeUsd: 1240000, pnlVirtualDai: 1240 },
    { date: '2026-10-20', activeAccounts: 168, trades: 710, volumeUsd: 1490000, pnlVirtualDai: 1820 },
    { date: '2026-10-21', activeAccounts: 155, trades: 680, volumeUsd: 1380000, pnlVirtualDai: -960 },
    { date: '2026-10-22', activeAccounts: 194, trades: 820, volumeUsd: 1720000, pnlVirtualDai: 2460 },
    { date: '2026-10-23', activeAccounts: 221, trades: 950, volumeUsd: 1960000, pnlVirtualDai: 3180 },
    { date: '2026-10-24', activeAccounts: 208, trades: 890, volumeUsd: 1840000, pnlVirtualDai: -1450 },
    { date: '2026-10-25', activeAccounts: 242, trades: 1020, volumeUsd: 2150000, pnlVirtualDai: 2840 },
    { date: '2026-10-26', activeAccounts: 267, trades: 1140, volumeUsd: 2380000, pnlVirtualDai: 3640 },
    { date: '2026-10-27', activeAccounts: 251, trades: 1080, volumeUsd: 2210000, pnlVirtualDai: -1780 },
    { date: '2026-10-28', activeAccounts: 294, trades: 1260, volumeUsd: 2640000, pnlVirtualDai: 4260 },
    { date: '2026-10-29', activeAccounts: 318, trades: 1380, volumeUsd: 2910000, pnlVirtualDai: 5120 },
    { date: '2026-10-30', activeAccounts: 301, trades: 1290, volumeUsd: 2730000, pnlVirtualDai: -2140 },
    { date: '2026-10-31', activeAccounts: 349, trades: 1510, volumeUsd: 3180000, pnlVirtualDai: 4860 },
    { date: '2026-11-01', activeAccounts: 382, trades: 1640, volumeUsd: 3460000, pnlVirtualDai: 6210 },
  ],
}
export function summarize(snapshot: TransparencySnapshot): Record<MetricKey, number> {
  const completed = snapshot.outcomes.passed + snapshot.outcomes.failed
  return {
    accounts: snapshot.demoAccounts,
    volume: snapshot.activity.reduce((s, p) => s + p.volumeUsd, 0),
    trades: snapshot.activity.reduce((s, p) => s + p.trades, 0),
    completed,
    passRate: completed ? snapshot.outcomes.passed / completed : 0,
    pnl: snapshot.activity.reduce((s, p) => s + p.pnlVirtualDai, 0),
  }
}
/** A future data adapter can return these states without changing the page layout. */
export type TransparencyDataState =
  | { status: 'loading' | 'empty' | 'error' }
  | { status: 'ready'; snapshot: TransparencySnapshot }
