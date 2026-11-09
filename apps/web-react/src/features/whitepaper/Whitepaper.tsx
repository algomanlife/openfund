import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { text as t, type Locale } from '../information/content'
import { useWhitepaper } from '../../cms/whitepaper/client'
import type { WpChapter, WpStatus } from '../../cms/whitepaper/types'
import Block, { STATUS_LABEL } from './blocks'
import './whitepaper.css'

/* Openfund Whitepaper — one long-form page, anchor-navigated.
   Chapters, datasets and references come from Directus (validated) or the
   repository edition; this component only lays them out. */

const day = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** decorative brand illustration: concentric capital rings around the mark */
function HeroArt() {
  return <svg className="wp-hero-art" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="wp-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="var(--mint)" stopOpacity=".22" /><stop offset="1" stopColor="var(--mint)" stopOpacity="0" /></radialGradient>
    </defs>
    <circle cx="200" cy="200" r="190" fill="url(#wp-glow)" />
    {[60, 100, 140, 180].map((r, i) => <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="var(--mint)" strokeOpacity={0.5 - i * 0.1} strokeDasharray={i % 2 ? '2 6' : undefined} />)}
    {[0, 60, 120, 180, 240, 300].map((a, i) => {
      const r = [100, 140, 180][i % 3], x = 200 + r * Math.cos(a * Math.PI / 180), y = 200 + r * Math.sin(a * Math.PI / 180)
      return <g key={a}><line x1="200" y1="200" x2={x} y2={y} stroke="var(--mint)" strokeOpacity=".18" /><circle cx={x} cy={y} r="5" fill="var(--mint)" fillOpacity={0.9 - i * 0.1} /></g>
    })}
    <image href={`${import.meta.env.BASE_URL}assets/mark-mint.svg`} x="171" y="167" width="58" height="66" />
  </svg>
}

function CopyLink({ slug, locale, title }: { slug: string; locale: Locale; title: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    const url = `${location.origin}${location.pathname}#${slug}`
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { window.prompt(t('Copy this link', 'این پیوند را کپی کنید')[locale], url) }
  }
  return <button type="button" className="wp-copy" onClick={copy} aria-label={`${t('Copy link to', 'کپی پیوند')[locale]} ${title}`}>
    <span aria-hidden="true">{copied ? '✓' : '#'}</span><span className="wp-copy-text" aria-live="polite">{copied ? t('Link copied', 'پیوند کپی شد')[locale] : t('Copy link', 'کپی پیوند')[locale]}</span>
  </button>
}

function Toc({ chapters, active, locale, onJump }: { chapters: WpChapter[]; active: string; locale: Locale; onJump: (slug: string) => void }) {
  return <ol className="wp-toc-list">{chapters.map((c, i) => <li key={c.slug}>
    <a href={`#${c.slug}`} aria-current={active === c.slug ? 'location' : undefined} onClick={e => { e.preventDefault(); onJump(c.slug) }}>
      <span className="wp-toc-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>{c.kicker[locale]}
    </a>
  </li>)}</ol>
}

export default function Whitepaper() {
  const locale = useInformationLocale()
  const paper = useWhitepaper()
  const { document: doc, chapters } = paper
  const navigate = useNavigate()
  const { hash } = useLocation()
  const [active, setActive] = useState(chapters[0]?.slug || '')
  const mobileNav = useRef<HTMLDetailsElement>(null)

  /* smooth in-document scrolling (unless reduced motion) while this page is mounted */
  useEffect(() => {
    const root = document.documentElement, previous = root.style.scrollBehavior
    if (!reducedMotion()) root.style.scrollBehavior = 'smooth'
    return () => { root.style.scrollBehavior = previous }
  }, [])

  /* deep links: the shell resets scroll on mount, then we honour the hash */
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1))
    if (!id) return
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' }))
  }, [hash])

  /* active chapter highlighting */
  useEffect(() => {
    const sections = chapters.map(c => document.getElementById(c.slug)).filter((el): el is HTMLElement => !!el)
    if (!sections.length || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visible) setActive(visible.target.id)
    }, { rootMargin: '-20% 0px -70% 0px' })
    sections.forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [chapters])

  /* chapter links push a history entry (Back returns to the previous chapter) */
  const jump = useCallback((slug: string) => {
    if (mobileNav.current) mobileNav.current.open = false
    navigate({ hash: slug }, { preventScrollReset: true })
    const target = document.getElementById(slug)
    target?.scrollIntoView({ block: 'start' })
    target?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  }, [navigate])

  /* structured document metadata */
  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'TechArticle',
      headline: `${doc.title[locale]} v${doc.version}`, alternativeHeadline: doc.subtitle[locale], description: doc.seoDescription[locale],
      inLanguage: locale, version: doc.version, datePublished: doc.publishedOn, dateModified: doc.updatedOn,
      publisher: { '@type': 'Organization', name: 'Openfund' }, url: `${location.origin}/${locale}/whitepaper`,
    })
    const og = document.createElement('meta')
    og.setAttribute('property', 'og:type'); og.content = 'article'
    document.head.append(script, og)
    return () => { script.remove(); og.remove() }
  }, [doc, locale])

  const activeChapter = chapters.find(c => c.slug === active) || chapters[0]
  const statusKeys = useMemo(() => Object.keys(STATUS_LABEL) as WpStatus[], [])

  return <InformationShell page="whitepaper" title={doc.seoTitle[locale]} description={doc.seoDescription[locale]}>
    <article className="wp" lang={locale} aria-labelledby="wp-title">
      <header className="container wp-hero" id="top">
        <div className="hero-atmosphere" aria-hidden="true"><i /><i /><i /></div>
        <div className="wp-hero-copy">
          <div className="eyebrow"><span className="tiny-mark" aria-hidden="true">✳</span> OPENFUND / {t('OFFICIAL PUBLICATION', 'انتشار رسمی')[locale]}</div>
          <h1 id="wp-title">{doc.title[locale]} <span className="wp-version" dir="ltr">v{doc.version}</span></h1>
          <p className="wp-subtitle">{doc.subtitle[locale]}</p>
          <p className="wp-abstract">{doc.abstract[locale]}</p>
          <dl className="wp-meta">
            <div><dt>{t('Version', 'نسخه')[locale]}</dt><dd dir="ltr">{doc.version}</dd></div>
            <div><dt>{t('Published', 'انتشار')[locale]}</dt><dd><time dateTime={doc.publishedOn}>{day(doc.publishedOn, locale)}</time></dd></div>
            <div><dt>{t('Last updated', 'آخرین بازنگری')[locale]}</dt><dd><time dateTime={doc.updatedOn}>{day(doc.updatedOn, locale)}</time></dd></div>
            <div><dt>{t('Edition', 'ویرایش')[locale]}</dt><dd>{paper.source.document === 'cms' ? t('Openfund CMS', 'سیستم محتوای اوپن‌فاند')[locale] : t('Repository edition', 'ویرایش مخزن')[locale]}</dd></div>
          </dl>
          <div className="wp-actions">
            <a className="button" href={`#${chapters[0]?.slug}`} onClick={e => { e.preventDefault(); jump(chapters[0].slug) }}>{t('Start reading', 'شروع مطالعه')[locale]} <span aria-hidden="true">↓</span></a>
            <button type="button" className="text-link wp-print" onClick={() => window.print()}>{t('Print or save as PDF', 'چاپ یا ذخیره به PDF')[locale]}</button>
          </div>
        </div>
        <HeroArt />
      </header>

      <div className="container wp-legend-bar" role="note" aria-label={t('Status legend', 'راهنمای وضعیت')[locale]}>
        <span>{t('Status labels', 'برچسب‌های وضعیت')[locale]}:</span>
        {statusKeys.map(s => <span key={s} className={`wp-status ${s}`}>{STATUS_LABEL[s][locale]}</span>)}
      </div>
      {doc.revisionNote[locale] && <p className="container wp-revision">{doc.revisionNote[locale]}</p>}

      <details className="wp-toc-mobile" ref={mobileNav}>
        <summary><span>{t('Chapter', 'فصل')[locale]} {String(chapters.indexOf(activeChapter) + 1).padStart(2, '0')}</span> {activeChapter?.kicker[locale]}</summary>
        <nav aria-label={t('Whitepaper chapters', 'فصل‌های وایت‌پیپر')[locale]}><Toc chapters={chapters} active={active} locale={locale} onJump={jump} /></nav>
      </details>

      <div className="container wp-layout">
        <nav className="wp-toc" aria-label={t('Whitepaper chapters', 'فصل‌های وایت‌پیپر')[locale]}>
          <p className="wp-toc-title">{t('Contents', 'فهرست')[locale]}</p>
          <Toc chapters={chapters} active={active} locale={locale} onJump={jump} />
        </nav>
        <div className="wp-body">
          {chapters.map((chapter, i) => <section key={chapter.slug} id={chapter.slug} className="wp-chapter" aria-labelledby={`${chapter.slug}-title`}>
            <div className="wp-chapter-head">
              <span className="wp-chapter-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <span className="eyebrow">{chapter.kicker[locale]}</span>
              <h2 id={`${chapter.slug}-title`} tabIndex={-1}>{chapter.title[locale]}</h2>
              <p className="wp-summary">{chapter.summary[locale]}</p>
              <CopyLink slug={chapter.slug} locale={locale} title={chapter.kicker[locale]} />
            </div>
            {chapter.blocks.map((block, j) => <Block key={j} block={block} locale={locale} paper={paper} bibliography={chapter.slug === 'references'} />)}
          </section>)}
          <div className="info-end wp-end">
            <img src={`${import.meta.env.BASE_URL}assets/mark-mint.svg`} width="38" height="42" alt="" />
            <p>{t('Openfund grows only as fast as it can prove.', 'اوپن‌فاند فقط به اندازه‌ای رشد می‌کند که بتواند اثبات کند.')[locale]}</p>
            <a className="text-link" href="#top">{t('Back to top ↑', 'بازگشت به بالا ↑')[locale]}</a>
          </div>
        </div>
      </div>
    </article>
  </InformationShell>
}
