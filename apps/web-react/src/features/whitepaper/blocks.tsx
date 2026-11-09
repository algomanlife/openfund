import { useEffect, useState } from 'react'
import { text as t, type Locale } from '../information/content'
import type { WpBlock, WpMilestoneStatus, WpReference, WpStatus, Whitepaper } from '../../cms/whitepaper/types'
import { challengePlans, type ChallengePlan } from '../../data/challengePlans'
import { fetchCmsPlans } from '../../cms/client'
import Chart from './charts'

/* Reusable whitepaper blocks. CMS text is rendered as React text nodes —
   never as HTML — and links only come from validated reference records. */

export const STATUS_LABEL: Record<WpStatus, { fa: string; en: string }> = {
  live: t('Live', 'فعال'),
  implemented: t('Implemented · not released', 'پیاده‌سازی‌شده · منتشرنشده'),
  development: t('In development', 'در حال توسعه'),
  planned: t('Planned', 'برنامه‌ریزی‌شده'),
}
export const MILESTONE_LABEL: Record<WpMilestoneStatus, { fa: string; en: string }> = {
  completed: t('Completed', 'تکمیل‌شده'),
  in_progress: t('In progress', 'در جریان'),
  planned: t('Planned', 'برنامه‌ریزی‌شده'),
  research: t('Research / proposal', 'پژوهش / پیشنهاد'),
}

export function StatusChip({ status, locale }: { status: WpStatus; locale: Locale }) {
  return <span className={`wp-status ${status}`}>{STATUS_LABEL[status][locale]}</span>
}

const ICON: Record<'info' | 'principle' | 'warning' | 'risk', string> = { info: 'ⓘ', principle: '◇', warning: '△', risk: '!' }

/** Catalog prices: the live challenge catalog (Directus challenge_plans) or the repository catalog. */
function Pricing({ caption, locale }: { caption: string; locale: Locale }) {
  const [plans, setPlans] = useState<ChallengePlan[]>(() => challengePlans.filter(p => p.status === 'published'))
  const [source, setSource] = useState<'cms' | 'bundled'>('bundled')
  useEffect(() => {
    let active = true
    void fetchCmsPlans().then(cms => { if (active && cms?.length) { setPlans(cms); setSource('cms') } }).catch(() => undefined)
    return () => { active = false }
  }, [])
  const sizes = [...new Set(plans.flatMap(p => p.accountSizesUsd))].sort((a, b) => a - b)
  const money = (v: number) => new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
  return <div className="wp-table info-table-wrap">
    <table>
      <caption>{caption}</caption>
      <thead><tr><th scope="col">{t('Account size', 'اندازهٔ حساب')[locale]}</th>{plans.map(p => <th key={p.slug} scope="col">{p.name[locale]}</th>)}</tr></thead>
      <tbody>{sizes.map(size => <tr key={size}>
        <th scope="row"><bdi>{money(size)}</bdi></th>
        {plans.map(p => <td key={p.slug} className="num">{p.accountSizesUsd.includes(size) ? <bdi>{p.free ? t('Free', 'رایگان')[locale] : money(p.priceUsd[size])}</bdi> : '—'}</td>)}
      </tr>)}</tbody>
    </table>
    <p className="wp-table-note">{source === 'cms' ? t('Source: live challenge catalog (Directus).', 'منبع: کاتالوگ فعلی چلنج (Directus).')[locale] : t('Source: repository challenge catalog.', 'منبع: کاتالوگ چلنج در مخزن.')[locale]} {t('Purchase activation depends on production payment configuration.', 'فعال بودن خرید به پیکربندی پرداخت در محیط اصلی بستگی دارد.')[locale]}</p>
  </div>
}

function References({ keys, refs, locale, full }: { keys: string[]; refs: Map<string, WpReference>; locale: Locale; full: boolean }) {
  const items = keys.map(k => refs.get(k)).filter((r): r is WpReference => !!r)
  if (!items.length) return null
  return <div className={full ? 'wp-reflist' : 'wp-refs'}>
    {!full && <span className="wp-refs-label">{t('Sources', 'منابع')[locale]}</span>}
    <ol>{items.map(r => <li key={r.key} id={full ? `ref-${r.key}` : undefined}>
      <a href={r.url} target="_blank" rel="noopener noreferrer" dir="ltr">{r.title}</a>
      {full && <>
        <span className="wp-ref-meta"><bdi>{r.publisher}</bdi>{r.published && <> · <bdi>{r.published}</bdi></>} · {t('Accessed', 'دسترسی')[locale]} <bdi>{r.accessed}</bdi></span>
        <span className="wp-ref-note">{r.note[locale]}</span>
      </>}
      {!full && <a className="wp-ref-jump" href={`#ref-${r.key}`} aria-label={t('Open in references', 'نمایش در منابع')[locale]}>↓</a>}
    </li>)}</ol>
  </div>
}

/** `bibliography` renders refs blocks as the full reference list (the References chapter). */
export default function Block({ block, locale, paper, bibliography = false }: { block: WpBlock; locale: Locale; paper: Whitepaper; bibliography?: boolean }) {
  switch (block.type) {
    case 'lead': return <p className="wp-lead">{block.text[locale]}</p>
    case 'p': return <p className="wp-p">{block.text[locale]}</p>
    case 'h3': return <h3 className="wp-h3">{block.text[locale]}</h3>
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul'
      return <Tag className="wp-list">{block.items.map((item, i) => <li key={i}>{item[locale]}</li>)}</Tag>
    }
    case 'quote': return <blockquote className="wp-quote"><p>{block.text[locale]}</p></blockquote>
    case 'callout': return <aside className={`wp-callout ${block.tone}`} role="note">
      <span className="wp-callout-icon" aria-hidden="true">{ICON[block.tone]}</span>
      <div><strong>{block.title[locale]}</strong><p>{block.text[locale]}</p></div>
    </aside>
    case 'features': return <ul className="wp-features">{block.items.map((item, i) => <li key={i}>
      {item.status && <StatusChip status={item.status} locale={locale} />}
      <h4>{item.title[locale]}</h4>
      <p>{item.text[locale]}</p>
    </li>)}</ul>
    case 'stats': return <dl className="wp-stats">{block.items.map((item, i) => <div key={i}>
      <dt>{item.label[locale]}</dt>
      <dd><bdi>{item.value}</bdi></dd>
      {item.note && <dd className="wp-stat-note">{item.note[locale]}</dd>}
    </div>)}</dl>
    case 'definitions': return <dl className="wp-definitions">{block.items.map((item, i) => <div key={i}><dt>{item.term[locale]}</dt><dd>{item.text[locale]}</dd></div>)}</dl>
    case 'table': return <div className="wp-table info-table-wrap"><table>
      <caption>{block.caption[locale]}</caption>
      <thead><tr>{block.head.map((cell, i) => <th key={i} scope="col">{cell[locale]}</th>)}</tr></thead>
      <tbody>{block.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => j === 0 ? <th key={j} scope="row">{cell[locale]}</th> : <td key={j}>{cell[locale]}</td>)}</tr>)}</tbody>
    </table></div>
    case 'flow': return <figure className="wp-flow">
      <figcaption>{block.label[locale]}</figcaption>
      <ol>{block.steps.map((step, i) => <li key={i}>
        <span className="wp-flow-index" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
        <strong>{step.title[locale]}</strong>
        {step.text && <span className="wp-flow-text">{step.text[locale]}</span>}
        {step.status && <StatusChip status={step.status} locale={locale} />}
      </li>)}</ol>
    </figure>
    case 'architecture': return <figure className="wp-arch">
      <figcaption>{block.label[locale]}</figcaption>
      <div className="wp-arch-layers">{block.layers.map((layer, i) => <section key={i} className="wp-arch-layer" aria-label={layer.title[locale]}>
        <h4>{layer.title[locale]}</h4>
        <ul>{layer.nodes.map((node, j) => <li key={j} className={node.status ? `has-${node.status}` : undefined}>
          <strong>{node.title[locale]}</strong>
          {node.text && <span>{node.text[locale]}</span>}
          {node.status && <StatusChip status={node.status} locale={locale} />}
        </li>)}</ul>
      </section>)}</div>
    </figure>
    case 'mapping': return <div className="wp-mapping" role="table" aria-label={block.head.map(h => h[locale]).join(' → ')}>
      <div className="wp-map-row wp-map-head" role="row">{block.head.map((h, i) => <span key={i} role="columnheader">{h[locale]}</span>)}</div>
      {block.rows.map((row, i) => <div key={i} className="wp-map-row" role="row">{row.map((cell, j) => <span key={j} role={j === 0 ? 'rowheader' : 'cell'} data-label={block.head[j]?.[locale]}>{cell[locale]}</span>)}</div>)}
    </div>
    case 'timeline': return <ol className="wp-timeline">{block.items.map((item, i) => <li key={i} className={item.status}>
      <span className="wp-tl-dot" aria-hidden="true" />
      <div className="wp-tl-head"><span className="wp-tl-phase">{item.phase[locale]}</span><span className={`wp-milestone ${item.status}`}>{MILESTONE_LABEL[item.status][locale]}</span></div>
      <h4>{item.title[locale]}</h4>
      <p>{item.text[locale]}</p>
    </li>)}</ol>
    case 'chart': {
      const refs = new Map(paper.references.map(r => [r.key, r]))
      return <Chart dataset={paper.datasets.find(d => d.key === block.dataset)} locale={locale} interactive={block.interactive} sourceLabel={k => refs.get(k)?.publisher || null} />
    }
    case 'pricing': return <Pricing caption={block.caption[locale]} locale={locale} />
    case 'image': return <figure className="wp-image">
      <img src={block.src.startsWith('assets/') ? `${import.meta.env.BASE_URL}${block.src}` : block.src} alt={block.alt[locale]} loading="lazy" decoding="async" />
      {block.caption && <figcaption>{block.caption[locale]}</figcaption>}
    </figure>
    case 'faq': return <div className="wp-faq">{block.items.map((item, i) => <details key={i}><summary>{item.q[locale]}</summary><p>{item.a[locale]}</p></details>)}</div>
    case 'refs': return <References keys={block.keys} refs={new Map(paper.references.map(r => [r.key, r]))} locale={locale} full={bibliography} />
    default: return null
  }
}
