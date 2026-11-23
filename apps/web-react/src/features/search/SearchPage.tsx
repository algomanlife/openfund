import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { number, tx } from '../information/content'
import DirArrow from '../../ui/DirArrow'
import { search, type SearchKind } from '../../../../../packages/site-search/index.mjs'
import { loadSearchIndex, rememberSearch, reportClick, reportSearch, type SearchIndex } from './searchClient'
import { EntryIcon, Highlight, SEARCH_ICON } from './SearchPalette'
import { KIND_ORDER, kindLabels, searchCopy as c } from './copy'
import './search.css'

/* /:locale/search?q=&type=&page= — full results (noindex: not a public
   route in seoHead.ts). Filter tabs by kind, 20 results per page, and the
   Backstage-editable suggestions when nothing matches. */
const PER_PAGE = 20

export default function SearchPage() {
  const locale = useInformationLocale()
  const t = (v: { fa: string; en: string }) => tx(locale, v)
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') || '').slice(0, 120)
  const kind = (KIND_ORDER as string[]).includes(params.get('type') || '') ? params.get('type') as SearchKind : null
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1)
  const [draft, setDraft] = useState(q)
  const [index, setIndex] = useState<SearchIndex | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { setDraft(q) }, [q])
  useEffect(() => { let live = true; loadSearchIndex(locale).then(i => { if (live) setIndex(i) }); return () => { live = false } }, [locale])

  const all = useMemo(() => (index && q.trim() ? search(index.entries, q, { synonyms: index.synonyms }) : []), [index, q])
  const counts = useMemo(() => Object.fromEntries(KIND_ORDER.map(k => [k, all.filter(e => e.kind === k).length])) as Record<SearchKind, number>, [all])
  const filtered = kind ? all.filter(e => e.kind === kind) : all
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const current = Math.min(page, pages)
  const shown = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE)
  useEffect(() => { if (index && !index.fallback && q.trim().length >= 2) reportSearch(locale, q, all.length) }, [index, q, all.length, locale])

  const go = (next: { q?: string; type?: SearchKind | null; page?: number }) => {
    const p = new URLSearchParams()
    const nq = next.q ?? q
    if (nq) p.set('q', nq)
    const nt = next.type === undefined ? kind : next.type
    if (nt) p.set('type', nt)
    if ((next.page ?? 1) > 1) p.set('page', String(next.page))
    setParams(p)
    requestAnimationFrame(() => heading.current?.focus())
  }
  const tabs: (SearchKind | null)[] = [null, ...KIND_ORDER.filter(k => counts[k] > 0 || k === kind)]

  return <InformationShell page="search" description={t(c.intro)} title={`${q ? `${q} · ` : ''}${t(c.title)} | Openfund`}>
    <section className="of-search-page container">
      <h1 ref={heading} tabIndex={-1}>{t(c.title)}</h1>
      <p className="of-search-page-intro">{t(c.intro)}</p>
      <form role="search" className="of-search-page-form" onSubmit={e => { e.preventDefault(); rememberSearch(draft); go({ q: draft.trim(), page: 1 }) }}>
        <label className="of-search-field">
          <svg className="of-search-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d={SEARCH_ICON} /></svg>
          <span className="sr-only">{t(c.placeholder)}</span>
          <input type="search" value={draft} maxLength={120} placeholder={t(c.placeholder)} onChange={e => setDraft(e.target.value)} enterKeyHint="search" />
        </label>
        <button type="submit" className="of-search-submit">{t(c.submit)}</button>
      </form>
      {!index && q && <p className="of-search-note" role="status">{t(c.loading)}</p>}
      {index?.fallback && <p className="of-search-note" role="status">{t(c.offline)}</p>}
      {!q.trim() && <p className="of-search-note">{t(c.empty)}</p>}
      {index && q.trim() && <>
        <div className="of-search-tabs" role="tablist" aria-label={t(c.filters)}>
          {tabs.map(k => <button key={k || 'all'} type="button" role="tab" aria-selected={kind === k} aria-controls="of-search-results"
            className="of-search-tab" onClick={() => go({ type: k, page: 1 })}>
            {k ? t(kindLabels[k]) : t(c.all)} <span className="of-search-count">{number(k ? counts[k] : all.length, locale)}</span>
          </button>)}
        </div>
        <div id="of-search-results" role="tabpanel" aria-live="polite">
          <p className="of-search-summary">{number(filtered.length, locale)} {t(c.count)}</p>
          {shown.length > 0 ? <ol className="of-search-results">
            {shown.map(e => <li key={e.id}>
              <Link to={e.url} className="of-search-result" onClick={() => { rememberSearch(q); if (!index.fallback) reportClick(locale, q) }}>
                <EntryIcon entry={e} />
                <span className="of-search-text">
                  <span className="of-search-kind">{t(kindLabels[e.kind])}</span>
                  <span className="of-search-title"><Highlight text={e.title} query={q} /></span>
                  {e.snippet && <span className="of-search-snippet"><Highlight text={e.snippet} query={q} /></span>}
                </span>
                <DirArrow kind="forward" className="of-search-go" />
              </Link>
            </li>)}
          </ol> : <div className="of-search-empty">
            <p>{t(c.none)}</p>
            {index.suggestions.length > 0 && <><h2>{t(c.tryThese)}</h2>
              <ul className="of-search-suggestions">{index.suggestions.map(s => <li key={s.url}><Link to={s.url}>{s.label}<DirArrow kind="forward" /></Link></li>)}</ul></>}
          </div>}
          {pages > 1 && <nav className="of-search-pager" aria-label={`${t(c.page)} ${number(current, locale)} ${t(c.of)} ${number(pages, locale)}`}>
            <button type="button" disabled={current <= 1} onClick={() => go({ page: current - 1 })}><DirArrow kind="back" /> {t(c.previous)}</button>
            <span aria-current="page">{t(c.page)} {number(current, locale)} {t(c.of)} {number(pages, locale)}</span>
            <button type="button" disabled={current >= pages} onClick={() => go({ page: current + 1 })}>{t(c.next)} <DirArrow kind="forward" /></button>
          </nav>}
        </div>
      </>}
    </section>
  </InformationShell>
}
