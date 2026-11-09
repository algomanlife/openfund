import { useId, useMemo, useState } from 'react'
import { number, text as t, type Locale } from '../information/content'
import type { WpDataset, WpDatasetPoint } from '../../cms/whitepaper/types'

/* Charts read structured datasets only (values + translated labels) —
   never numbers parsed out of prose. Every chart ships an equivalent data
   table for assistive technology and print. Geometry uses logical
   (inline-start) positioning so bars grow with the reading direction. */

const fmt = (unit: WpDataset['unit'], v: number, locale: Locale) => unit === 'usd'
  ? number(v, locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  : number(v / 100, locale, { style: 'percent', maximumFractionDigits: 2 })

interface Row { key: string; label: string; role: 'start' | 'delta' | 'subtotal'; value: number; from: number; to: number }

/** running-sum geometry: starts and subtotals are absolute, deltas move the level */
export function waterfallRows(points: WpDatasetPoint[], overrides: Record<string, number> = {}, locale: Locale = 'en'): Row[] {
  let level = 0
  return points.map(p => {
    const value = p.role === 'delta' ? -(overrides[p.key] ?? Math.abs(p.value ?? 0)) : p.role === 'start' ? (overrides[p.key] ?? p.value ?? 0) : level
    if (p.role === 'start') { level = value; return { key: p.key, label: p.label[locale], role: 'start', value, from: 0, to: value } }
    if (p.role === 'subtotal') return { key: p.key, label: p.label[locale], role: 'subtotal', value: level, from: 0, to: level }
    const from = level
    level += value
    return { key: p.key, label: p.label[locale], role: 'delta', value, from, to: level }
  })
}

function DataTable({ caption, head, rows }: { caption: string; head: [string, string]; rows: Array<[string, string]> }) {
  return <details className="wp-chart-data">
    <summary>{caption}</summary>
    <table><thead><tr><th scope="col">{head[0]}</th><th scope="col">{head[1]}</th></tr></thead>
      <tbody>{rows.map(([a, b]) => <tr key={a}><th scope="row">{a}</th><td><bdi>{b}</bdi></td></tr>)}</tbody></table>
  </details>
}

function Waterfall({ dataset, locale, interactive }: { dataset: WpDataset; locale: Locale; interactive?: boolean }) {
  const start = dataset.points.find(p => p.role === 'start')?.value ?? 0
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const rows = useMemo(() => waterfallRows(dataset.points, overrides, locale), [dataset, overrides, locale])
  const max = Math.max(1, ...rows.map(r => Math.max(r.from, r.to)))
  const min = Math.min(0, ...rows.map(r => Math.min(r.from, r.to)))
  const span = max - min
  const pos = (v: number) => `${((v - min) / span) * 100}%`
  const id = useId()
  const deltas = dataset.points.filter(p => p.role === 'delta')
  return <>
    <div className="wp-waterfall" role="img" aria-labelledby={`${id}-cap`}>
      {rows.map(r => {
        const lo = Math.min(r.from, r.to), hi = Math.max(r.from, r.to)
        return <div key={r.key} className={`wp-wf-row ${r.role}${r.role === 'delta' && r.value < 0 ? ' negative' : ''}`}>
          <span className="wp-wf-label">{r.label}</span>
          <span className="wp-wf-track" aria-hidden="true"><i style={{ insetInlineStart: pos(lo), width: `max(2px, calc(${pos(hi)} - ${pos(lo)}))` }} /></span>
          <span className="wp-wf-value"><bdi>{fmt(dataset.unit, r.value, locale)}</bdi></span>
        </div>
      })}
    </div>
    {interactive && <div className="wp-controls">
      <p className="wp-controls-title">{t('Adjust the hypothetical lines', 'اقلام فرضی را تغییر دهید')[locale]}</p>
      {deltas.map(p => {
        const value = overrides[p.key] ?? Math.abs(p.value ?? 0)
        return <label key={p.key} className="wp-range">
          <span>{p.label[locale]}</span>
          <input type="range" min={0} max={start} step={Math.max(1, Math.round(start / 200))} value={value}
            aria-valuetext={fmt(dataset.unit, value, locale)}
            onChange={e => setOverrides(o => ({ ...o, [p.key]: Number(e.target.value) }))} />
          <output><bdi>{fmt(dataset.unit, value, locale)}</bdi></output>
        </label>
      })}
      <button type="button" className="wp-reset" onClick={() => setOverrides({})} disabled={!Object.keys(overrides).length}>{t('Reset to the published scenario', 'بازگشت به سناریوی منتشرشده')[locale]}</button>
      <p className="wp-live" aria-live="polite">{rows.at(-1)?.label}: <bdi>{fmt(dataset.unit, rows.at(-1)?.value ?? 0, locale)}</bdi></p>
    </div>}
    <span id={`${id}-cap`} hidden>{dataset.title[locale]}</span>
    <DataTable caption={t('View the data', 'نمایش داده‌ها')[locale]} head={[t('Line', 'قلم')[locale], t('Value', 'مقدار')[locale]]} rows={rows.map(r => [r.label, fmt(dataset.unit, r.value, locale)])} />
  </>
}

function Bars({ dataset, locale }: { dataset: WpDataset; locale: Locale }) {
  const max = Math.max(1, ...dataset.points.map(p => p.value ?? 0))
  return <>
    <div className="wp-bars" role="img" aria-label={dataset.title[locale]}>
      {dataset.points.map(p => <div key={p.key} className="wp-bar-row">
        <span className="wp-wf-label">{p.label[locale]}</span>
        <span className="wp-wf-track" aria-hidden="true"><i style={{ width: `${Math.max(1, (p.value ?? 0) / max * 100)}%` }} /></span>
        <span className="wp-wf-value"><bdi>{fmt(dataset.unit, p.value ?? 0, locale)}</bdi></span>
      </div>)}
    </div>
    <DataTable caption={t('View the data', 'نمایش داده‌ها')[locale]} head={[t('Measure', 'شاخص')[locale], t('Value', 'مقدار')[locale]]} rows={dataset.points.map(p => [p.label[locale], fmt(dataset.unit, p.value ?? 0, locale)])} />
  </>
}

function Stacked({ dataset, locale }: { dataset: WpDataset; locale: Locale }) {
  const segments = dataset.segments || []
  return <>
    <ul className="wp-legend">{segments.map((s, i) => <li key={s.key}><i className={`seg-${i}`} aria-hidden="true" />{s.label[locale]}</li>)}</ul>
    <div className="wp-stacked" role="img" aria-label={dataset.title[locale]}>
      {dataset.points.map(p => {
        const total = (p.values || []).reduce((a, b) => a + b, 0) || 1
        return <div key={p.key} className="wp-stack-row">
          <span className="wp-wf-label">{p.label[locale]}</span>
          <span className="wp-stack-track" aria-hidden="true">{(p.values || []).map((v, i) =>
            <i key={i} className={`seg-${i}`} style={{ width: `${v / total * 100}%` }}><b><bdi>{fmt(dataset.unit, v, locale)}</bdi></b></i>)}</span>
        </div>
      })}
    </div>
    <DataTable caption={t('View the data', 'نمایش داده‌ها')[locale]} head={[t('Tier', 'ردیف')[locale], segments.map(s => s.label[locale]).join(' / ')]}
      rows={dataset.points.map(p => [p.label[locale], (p.values || []).map(v => fmt(dataset.unit, v, locale)).join(' / ')])} />
  </>
}

export default function Chart({ dataset, locale, interactive, sourceLabel }: { dataset: WpDataset | undefined; locale: Locale; interactive?: boolean; sourceLabel?: (key: string) => string | null }) {
  if (!dataset) return null
  const sources = (dataset.sources || []).map(k => sourceLabel?.(k)).filter(Boolean)
  return <figure className={`wp-chart wp-chart-${dataset.kind}`}>
    <div className="wp-chart-head">
      <h4>{dataset.title[locale]}</h4>
      <p>{dataset.caption[locale]}</p>
    </div>
    {dataset.kind === 'waterfall' && <Waterfall dataset={dataset} locale={locale} interactive={interactive} />}
    {dataset.kind === 'bars' && <Bars dataset={dataset} locale={locale} />}
    {dataset.kind === 'stacked' && <Stacked dataset={dataset} locale={locale} />}
    <figcaption>
      <span className="wp-chart-note">{dataset.note[locale]}</span>
      {sources.length > 0 && <span className="wp-chart-sources">{t('Sources', 'منابع')[locale]}: {sources.join(' · ')}</span>}
    </figcaption>
  </figure>
}
