import { useEffect, useMemo, useState } from 'react'
import InformationShell, { Hero, useInformationLocale, useUiLocale } from '../information/InformationShell'
import { pick, dirOf, type AppLocale } from '../../i18n/locales'
import { bundledDeveloperDocs, fetchDeveloperDocs, REPO_BLOB, type DevDocSection, type DocLocale } from './content'
import Markdown from './Markdown'
import './developers.css'
import DirArrow from '../../ui/DirArrow'

/** Developer documentation (/:locale/developers). English is the authored
 *  source and Persian is fully written; ar, ru and zh-CN show the English text
 *  (marked lang="en") until an editor publishes a reviewed translation in
 *  Directus. Public page: no admin endpoints, infrastructure details or
 *  secrets (SECURITY.md). */
const GROUPS: [string, string, string][] = [
  ['getting-started', 'شروع کار', 'Getting started'], ['architecture', 'معماری', 'Architecture'], ['operations', 'استقرار و انتشار', 'Operations'],
  ['quality', 'کیفیت', 'Quality'], ['contributing', 'مشارکت', 'Contributing'], ['changelog', 'تغییرات', 'Changelog'],
]

export default function Developers() {
  const info = useInformationLocale()
  const ui = useUiLocale() as AppLocale
  const t = (fa: string, en: string) => pick(ui, fa, en)
  const [docs, setDocs] = useState<DevDocSection[]>(bundledDeveloperDocs)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(bundledDeveloperDocs[0]?.slug)
  useEffect(() => { let on = true; void fetchDeveloperDocs().then(d => { if (on && d?.length) setDocs(d) }); return () => { on = false } }, [])
  const text = (s: DevDocSection) => {
    const own = (s.title[ui as DocLocale] && s.body[ui as DocLocale]) ? ui as DocLocale : null
    const lang: DocLocale = own || 'en'
    return { lang, title: s.title[lang] || s.title.en, body: s.body[lang] || s.body.en }
  }
  const q = query.trim().toLowerCase()
  const visible = useMemo(() => docs.filter(s => {
    if (!q) return true
    const x = text(s)
    return [x.title, x.body, s.title.en, s.sourcePath].some(v => v.toLowerCase().includes(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [docs, q, ui])
  /* highlight the section in view in the index */
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (top) setActive(top.target.id.replace(/^doc-/, ''))
    }, { rootMargin: '-110px 0px -60% 0px' })
    document.querySelectorAll('.dd-section').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [visible])
  const englishOnly = ui !== 'fa' && ui !== 'en'
  const intro = t('راهنمای فنی اوپن‌فاند برای توسعه‌دهندگان و مشارکت‌کنندگان: راه‌اندازی محلی، ساختار مخزن، آزمون‌ها، انتشار و قوانین مشارکت. هر بخش به فایل منبعش در GitHub پیوند دارد.',
    'Openfund’s technical guide for developers and contributors: local setup, repository structure, testing, releases and contribution rules. Every section links to its source file on GitHub.')

  const index = <nav className="dd-index" aria-label={t('بخش‌های مستندات', 'Documentation sections')}>
    {GROUPS.map(([g, fa, en]) => {
      const items = visible.filter(s => s.section === g)
      return items.length ? <div key={g}><h3>{t(fa, en)}</h3><ul>{items.map(s => <li key={s.slug}>
        <a href={`#doc-${s.slug}`} aria-current={active === s.slug ? 'location' : undefined}>{text(s).title}</a></li>)}</ul></div> : null
    })}
  </nav>

  return <InformationShell page="developers" description={intro}>
    <Hero locale={info} page="developers" title={t('مستندات توسعه‌دهندگان', 'Developer documentation')} accent={t('ساختن روی اوپن‌فاند، با قواعد روشن.', 'Build on Openfund, with clear rules.')} intro={intro} />
    <div className="container dd-layout">
      <aside className="dd-aside">
        <label className="dd-search"><span className="sr-only">{t('جست‌وجو در مستندات', 'Search the docs')}</span>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t('جست‌وجو در مستندات', 'Search the docs')} />
        </label>
        <details className="dd-index-mobile"><summary>{t('بخش‌های مستندات', 'Documentation sections')}</summary>{index}</details>
        <div className="dd-index-desktop">{index}</div>
      </aside>
      <div className="dd-main">
        {englishOnly && <p className="dd-note" role="note">{t('این مستندات به انگلیسی و فارسی نوشته شده است؛ تا انتشار ترجمهٔ بازبینی‌شده، متن انگلیسی نمایش داده می‌شود.', 'This documentation is written in English and Persian; the English text is shown until a reviewed translation is published.')}</p>}
        {!visible.length && <p className="dd-empty" role="status">{t('هیچ بخشی با جست‌وجوی تو مطابقت ندارد.', 'No section matches your search.')}</p>}
        {visible.map(s => {
          const x = text(s)
          return <section key={s.slug} id={`doc-${s.slug}`} className="dd-section" lang={x.lang} dir={dirOf(x.lang as AppLocale)} aria-labelledby={`doc-${s.slug}-title`}>
            <h2 id={`doc-${s.slug}-title`}>{x.title}</h2>
            <Markdown source={x.body} copyLabel={t('کپی', 'Copy')} copiedLabel={t('کپی شد', 'Copied')} />
            <p className="dd-meta" lang={ui} dir={dirOf(ui)}>
              <a href={REPO_BLOB + s.sourcePath} target="_blank" rel="noopener noreferrer">{t('منبع', 'Source')}: <code dir="ltr">{s.sourcePath}</code> <DirArrow kind="external" /></a>
              <span>{t('آخرین بازبینی', 'Last verified')}: <bdi dir="ltr">{s.lastVerifiedAt} · {s.lastVerifiedCommit}</bdi></span>
            </p>
          </section>
        })}
      </div>
    </div>
  </InformationShell>
}
