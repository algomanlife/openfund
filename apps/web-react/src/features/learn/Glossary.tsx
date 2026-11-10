import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { number, text } from '../information/content'
import { useSiteLibrary } from '../../cms/siteContent'
import { matchesQuery, normalizeText } from '../faq/search'
import './learn.css'

type Locale = import('../../i18n/locales').AppLocale

/** first letter used for the alphabet index, Latin or Persian */
function letterOf(term: string, locale: Locale): string {
  const source = locale === 'fa' ? term : term
  const char = source.trim().charAt(0).toUpperCase()
  return /[A-Z]/.test(char) ? char : char
}

export default function Glossary() {
  const locale = useInformationLocale()
  const { slug: termSlug } = useParams()
  const { library } = useSiteLibrary()
  const [query, setQuery] = useState('')

  /* deep link: scroll to and expand one term */
  const [open, setOpen] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!termSlug) return
    if (!library.glossary.some(term => term.slug === termSlug)) return
    setOpen(new Set([termSlug]))
    const timer = setTimeout(() => {
      document.getElementById(`term-${termSlug}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    return () => clearTimeout(timer)
  }, [termSlug, library])

  const visible = useMemo(() => {
    if (!query.trim()) return library.glossary
    return library.glossary.filter(term =>
      matchesQuery(query, term.term[locale]) || matchesQuery(query, term.short[locale]) || matchesQuery(query, term.definition[locale]))
  }, [library, query, locale])

  const letters = useMemo(() => {
    const set = new Set(visible.map(term => letterOf(term.term[locale], locale)))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [visible, locale])

  const toggle = (slug: string) => setOpen(prev => {
    const next = new Set(prev)
    if (next.has(slug)) next.delete(slug); else next.add(slug)
    return next
  })

  const searchLabel = text('Search the glossary', 'جست‌وجو در واژه‌نامه')
  const termLessons = (slugs: string[]) => slugs
    .map(slug => {
      for (const path of library.paths) {
        const lesson = path.lessons.find(l => l.slug === slug)
        if (lesson) return lesson
      }
      return null
    })
    .filter(Boolean)

  return <InformationShell page="learn" title={text('Glossary', 'واژه‌نامه')[locale]} description={text(
    'Trading terms defined in one line and in depth: perpetual futures mechanics, margin, drawdown, prop rules and on-chain transparency.',
    'اصطلاح‌های معامله‌گری با یک خط تعریف و توضیح کامل: مکانیک معاملات آنی، مارجین، دراودان، قواعد پراپ و شفافیت درون‌زنجیره‌ای.')[locale]}>
    <Hero locale={locale} page="learn"
      title={text('The glossary', 'واژه‌نامه')[locale]}
      accent={text('plain definitions', 'تعریف‌های روشن')[locale]}
      intro={text(
        'Every term a trader meets on this site, defined in one line for a quick check and in depth when you need the real mechanics.',
        'هر اصطلاحی که در این سایت می‌بینی؛ یک خط برای بررسی سریع و توضیح کامل وقتی مکانیک واقعی لازم داری.')[locale]}>
      <div className="info-hero-meta">
        <span>{number(library.glossary.length, locale)} {text('terms', 'اصطلاح')[locale]}</span>
        <span>{number(library.paths.length, locale)} {text('linked paths', 'مسیر مرتبط')[locale]}</span>
      </div>
    </Hero>

    <div className="container glossary-page">
      <div className="glossary-toolbar">
        <label className="faq-search glossary-search" htmlFor="glossary-search-input">
          <span className="faq-search-icon" aria-hidden="true">⌕</span>
          <input id="glossary-search-input" type="search" value={query}
            placeholder={searchLabel[locale]} aria-label={searchLabel[locale]}
            onChange={e => setQuery(e.target.value)} />
          {query && <button type="button" className="faq-search-clear" onClick={() => setQuery('')} aria-label={text('Clear search', 'پاک‌کردن جست‌وجو')[locale]}>×</button>}
        </label>
        <div className="glossary-alphabet" aria-label={text('Jump to letter', 'پرش به حرف')[locale]}>
          {letters.map(letter => <a key={letter} href={`#glossary-letter-${normalizeText(letter)}`}>{letter}</a>)}
        </div>
      </div>

      {!query.trim() && <nav className="glossary-letters" aria-hidden="false">
        {letters.map(letter => <a key={letter} id={`glossary-letter-${normalizeText(letter)}`} href={`#glossary-letter-${normalizeText(letter)}`}>{letter}</a>)}
      </nav>}

      {visible.map(term => <article key={term.slug} id={`term-${term.slug}`} className={`glossary-entry${open.has(term.slug) ? ' open' : ''}`}>
        <h2>
          <button type="button" aria-expanded={open.has(term.slug)} aria-controls={`term-body-${term.slug}`} onClick={() => toggle(term.slug)}>
            <span className="glossary-letter-badge" aria-hidden="true">{letterOf(term.term[locale], locale)}</span>
            <span dir="auto">{term.term[locale]}</span>
            <i aria-hidden="true">{open.has(term.slug) ? '−' : '+'}</i>
          </button>
        </h2>
        <p className="glossary-short">{term.short[locale]}</p>
        <div className="glossary-body" id={`term-body-${term.slug}`} hidden={!open.has(term.slug)}>
          <p>{term.definition[locale]}</p>
          {(termLessons(term.lessons).length > 0 || term.tool) && <div className="faq-related">
            <span>{text('Read more', 'بیشتر بخوان')[locale]}</span>
            {termLessons(term.lessons).map(lesson => lesson && <Link key={lesson.slug} to={`/${locale}/learn/lessons/${lesson.slug}`}>{lesson.title[locale]}</Link>)}
            {term.tool && library.tools.find(tool => tool.slug === term.tool) && <Link to={`/${locale}/tools/${term.tool}`}>{library.tools.find(tool => tool.slug === term.tool)!.name[locale]}</Link>}
          </div>}
        </div>
      </article>)}

      {!visible.length && <div className="faq-empty">
        <i aria-hidden="true">⌕</i>
        <h2>{text('No matching terms', 'اصطلاح منطبقی نیست')[locale]}</h2>
        <p>{text('Try another word or clear the search.', 'واژهٔ دیگری را امتحان کن یا جست‌وجو را پاک کن.')[locale]}</p>
      </div>}

      <div className="info-end">
        <p>{text('Definitions end where the lessons begin.', 'تعریف‌ها همان‌جا تمام می‌شوند که درس‌ها شروع می‌شوند.')[locale]}</p>
        <div className="hero-actions">
          <Link className="button" to={`/${locale}/learn`}>{text('All learning paths', 'همهٔ مسیرهای یادگیری')[locale]} <span aria-hidden="true">↙</span></Link>
          <Link className="text-link" to={`/${locale}/faq`}>{text('FAQ', 'پرسش‌های متداول')[locale]} <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </div>
  </InformationShell>
}
