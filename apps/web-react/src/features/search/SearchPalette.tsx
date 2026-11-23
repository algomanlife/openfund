import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { dirOf, type AppLocale } from '../../i18n/locales'
import { tx } from '../information/content'
import { MEGA_ICONS } from '../navigation/megaMenu'
import DirArrow from '../../ui/DirArrow'
import { highlightRanges, search, type SearchEntry, type SearchKind } from '../../../../../packages/site-search/index.mjs'
import { clearRecentSearches, loadSearchIndex, recentSearches, rememberSearch, reportClick, reportSearch, type SearchIndex } from './searchClient'
import { KIND_ORDER, kindLabels, searchCopy as c } from './copy'
import './search.css'

export const SEARCH_ICON = 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4'
const ICON_FALLBACK: Record<SearchKind, string> = { page: 'about', content: 'faq', whitepaper: 'rulebook', docs: 'developers', market: 'markets' }

export function EntryIcon({ entry }: { entry: SearchEntry }) {
  const d = MEGA_ICONS[entry.icon || ''] || MEGA_ICONS[ICON_FALLBACK[entry.kind]] || SEARCH_ICON
  return <svg className="of-search-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d={d} /></svg>
}

/** the original text with the query's matches wrapped in <mark> */
export function Highlight({ text, query }: { text: string; query: string }) {
  const ranges = highlightRanges(text, query)
  if (!ranges.length) return <>{text}</>
  const out: ReactNode[] = []
  let at = 0
  ranges.forEach(([s, e], i) => { if (s > at) out.push(text.slice(at, s)); out.push(<mark key={i}>{text.slice(s, e)}</mark>); at = e })
  if (at < text.length) out.push(text.slice(at))
  return <>{out}</>
}

/** results grouped in the fixed kind order, each group capped */
export function groupResults(results: SearchEntry[], perGroup: number) {
  return KIND_ORDER.map(kind => ({ kind, items: results.filter(r => r.kind === kind).slice(0, perGroup) })).filter(g => g.items.length)
}

export default function SearchPalette({ locale, initialQuery = '', onClose }: { locale: AppLocale; initialQuery?: string; onClose: () => void }) {
  const t = (v: { fa: string; en: string }) => tx(locale, v)
  const navigate = useNavigate()
  const [query, setQuery] = useState(initialQuery)
  const [index, setIndex] = useState<SearchIndex | null>(null)
  const [active, setActive] = useState(0)
  const [recent, setRecent] = useState(recentSearches)
  const input = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const listId = useId(), titleId = useId(), hintId = useId()

  useEffect(() => { let live = true; loadSearchIndex(locale).then(i => { if (live) setIndex(i) }); return () => { live = false } }, [locale])
  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => {
    const scroll = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => { document.documentElement.style.overflow = scroll }
  }, [])

  const results = useMemo(() => (index && query.trim() ? search(index.entries, query, { synonyms: index.synonyms, limit: 60 }) : []), [index, query])
  const groups = useMemo(() => groupResults(results, 5), [results])
  const flat = groups.flatMap(g => g.items)
  const recentMode = !query.trim()
  const options: { id: string; label: string; go: () => void }[] = recentMode
    ? recent.map(r => ({ id: `r:${r}`, label: r, go: () => setQuery(r) }))
    : flat.length
      ? [...flat.map(e => ({ id: e.id, label: e.title, go: () => open(e.url) })), { id: 'all', label: t(c.seeAll), go: () => openAll() }]
      : (index?.suggestions || []).map(s => ({ id: `s:${s.url}`, label: s.label, go: () => open(s.url) }))
  useEffect(() => { setActive(0) }, [query, index])

  /* one aggregate count per settled query (after typing stops) */
  useEffect(() => {
    if (!index || index.fallback || query.trim().length < 2) return
    const timer = setTimeout(() => reportSearch(locale, query, results.length), 900)
    return () => clearTimeout(timer)
  }, [index, query, results.length, locale])

  function open(url: string) {
    if (query.trim()) { rememberSearch(query); if (!index?.fallback) reportClick(locale, query) }
    onClose()
    navigate(url)
  }
  function openAll() {
    rememberSearch(query)
    onClose()
    navigate(`/${locale}/search?q=${encodeURIComponent(query.trim())}`)
  }
  const optionId = (i: number) => `${listId}-o${i}`

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'Tab') { /* focus stays inside the dialog */
      const focusable = dialog.current?.querySelectorAll<HTMLElement>('input, button:not([disabled]), a[href]')
      if (!focusable?.length) return
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      return
    }
    if (document.activeElement !== input.current) return
    if (!options.length) { if (e.key === 'Enter' && query.trim()) { e.preventDefault(); openAll() } return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => (a + 1) % options.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => (a - 1 + options.length) % options.length) }
    else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); setActive(0) }
    else if (e.key === 'End' && e.ctrlKey) { e.preventDefault(); setActive(options.length - 1) }
    else if (e.key === 'Enter') { e.preventDefault(); options[Math.min(active, options.length - 1)]?.go() }
  }
  useEffect(() => { document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' }) }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  let n = -1
  const option = (key: string, content: ReactNode, go: () => void, extra = '') => {
    n += 1
    const i = n
    return <li key={key} id={optionId(i)} role="option" aria-selected={active === i} className={`of-search-option${extra}`}
      onMouseMove={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={go}>{content}</li>
  }

  return <div className="of-search-layer" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <div ref={dialog} className="of-search-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} dir={dirOf(locale)} lang={locale} onKeyDown={onKeyDown}>
      <h2 id={titleId} className="sr-only">{t(c.dialog)}</h2>
      <div className="of-search-field">
        <svg className="of-search-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d={SEARCH_ICON} /></svg>
        <input ref={input} type="search" role="combobox" enterKeyHint="search" autoComplete="off" spellCheck={false}
          aria-expanded={options.length > 0} aria-controls={listId} aria-autocomplete="list" aria-describedby={hintId}
          aria-activedescendant={options.length ? optionId(Math.min(active, options.length - 1)) : undefined}
          aria-label={t(c.placeholder)} placeholder={t(c.placeholder)} value={query} maxLength={120}
          onChange={e => setQuery(e.target.value)} />
        <button type="button" className="of-search-close" onClick={onClose} aria-label={t(c.close)}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div className="of-search-body">
        {!index && <p className="of-search-note" role="status">{t(c.loading)}</p>}
        {index?.fallback && <p className="of-search-note" role="status">{t(c.offline)}</p>}
        <ul id={listId} role="listbox" aria-label={t(c.dialog)} className="of-search-list">
          {recentMode && recent.length > 0 && <li role="presentation" className="of-search-group">
            <div className="of-search-group-head"><span id={`${listId}-recent`}>{t(c.recent)}</span>
              <button type="button" className="of-search-clear" onClick={() => { clearRecentSearches(); setRecent([]); input.current?.focus() }}>{t(c.clearRecent)}</button></div>
            <ul role="group" aria-labelledby={`${listId}-recent`}>
              {recent.map(r => option(`r:${r}`, <><svg className="of-search-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M12 21a9 9 0 1 0-9-9M3 4v5h5M12 7v5l3 2" /></svg><span className="of-search-title">{r}</span></>, () => setQuery(r)))}
            </ul>
          </li>}
          {!recentMode && groups.map(g => <li role="presentation" key={g.kind} className="of-search-group">
            <div className="of-search-group-head"><span id={`${listId}-${g.kind}`}>{t(kindLabels[g.kind])}</span></div>
            <ul role="group" aria-labelledby={`${listId}-${g.kind}`}>
              {g.items.map(e => option(e.id, <><EntryIcon entry={e} /><span className="of-search-text">
                <span className="of-search-title"><Highlight text={e.title} query={query} /></span>
                {e.snippet && <span className="of-search-snippet"><Highlight text={e.snippet} query={query} /></span>}</span>
                <DirArrow kind="forward" className="of-search-go" /></>, () => open(e.url)))}
            </ul>
          </li>)}
          {!recentMode && flat.length > 0 && option('all', <span className="of-search-title">{t(c.seeAll)} <span className="of-search-count">({results.length} {t(c.count)})</span></span>, openAll, ' of-search-all')}
          {!recentMode && index && !flat.length && <li role="presentation" className="of-search-group">
            <p className="of-search-note">{t(c.none)}</p>
            {index.suggestions.length > 0 && <>
              <div className="of-search-group-head"><span id={`${listId}-suggest`}>{t(c.tryThese)}</span></div>
              <ul role="group" aria-labelledby={`${listId}-suggest`}>
                {index.suggestions.map(s => option(`s:${s.url}`, <><svg className="of-search-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d={SEARCH_ICON} /></svg><span className="of-search-title">{s.label}</span><DirArrow kind="forward" className="of-search-go" /></>, () => open(s.url)))}
              </ul></>}
          </li>}
        </ul>
      </div>
      <p id={hintId} className="of-search-keys">{t(c.keys)}</p>
    </div>
  </div>
}
