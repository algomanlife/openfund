import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { labels, number, text } from '../information/content'
import { faqCountByCategory, targetHref, useSiteLibrary } from '../../cms/siteContent'
import type { FaqCategoryContent, FaqItemContent, LinkRef } from '../../cms/contentTypes'
import { matchesQuery } from './search'
import './faq.css'

type Locale = import('../../i18n/locales').AppLocale

const CATEGORY_GLYPHS: Record<FaqCategoryContent['icon'], string> = {
  start: '⌖', payout: '⇩', rules: '§', partner: '↗', terminal: '▤', verify: '◉', general: '◇',
}

function RelatedLinks({ locale, links }: { locale: Locale; links: LinkRef[] | undefined }) {
  if (!links?.length) return null
  return <div className="faq-related">
    <span>{text('Related', 'مرتبط')[locale]}</span>
    {links.map((link, i) => {
      const href = targetHref(link.target, locale)
      return href ? <a key={i} href={href}>{link.label[locale]}</a> : null
    })}
  </div>
}

function FaqItem({ locale, item, open, onToggle }: { locale: Locale; item: FaqItemContent; open: boolean; onToggle: () => void }) {
  const headingId = `faq-q-${item.key}`
  const panelId = `faq-a-${item.key}`
  return <li className={`faq-item${open ? ' open' : ''}`} id={headingId}>
    <h3>
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span>{item.question[locale]}</span>
        <i aria-hidden="true">{open ? '−' : '+'}</i>
      </button>
    </h3>
    <div className="faq-answer" id={panelId} role="region" aria-labelledby={headingId} hidden={!open}>
      <p>{item.answer[locale]}</p>
      <RelatedLinks locale={locale} links={item.links} />
    </div>
  </li>
}

export default function Faq() {
  const locale = useInformationLocale()
  const { key: questionKey } = useParams()
  const { loading, library } = useSiteLibrary()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const counts = useMemo(() => faqCountByCategory(library), [library])
  const categories = useMemo(() => library.faqCategories.filter(c => (counts.get(c.key) || 0) > 0), [library, counts])

  /* deep link: /faq/q/<key> opens exactly that question */
  useEffect(() => {
    if (!questionKey) return
    const exists = library.faqItems.some(item => item.key === questionKey)
    if (!exists) return
    setOpenKeys(new Set([questionKey]))
    const timer = setTimeout(() => {
      document.getElementById(`faq-q-${questionKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    return () => clearTimeout(timer)
  }, [questionKey, library])

  const visible = useMemo(() => {
    const inCategory = category === 'all' ? library.faqItems : library.faqItems.filter(item => item.category === category)
    if (!query.trim()) return inCategory
    return inCategory.filter(item =>
      matchesQuery(query, item.question[locale]) || matchesQuery(query, item.answer[locale]))
  }, [library, category, query, locale])

  const grouped = useMemo(() => categories
    .map(cat => ({ cat, items: visible.filter(item => item.category === cat.key) }))
    .filter(group => group.items.length > 0), [categories, visible])

  const allOpen = visible.length > 0 && visible.every(item => openKeys.has(item.key))
  const toggle = (key: string) => setOpenKeys(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  const searchLabel = text('Search questions and answers', 'جست‌وجو میان پرسش‌ها و پاسخ‌ها')
  const clearLabel = text('Clear search', 'پاک‌کردن جست‌وجو')
  const emptyTitle = text('No matching questions', 'پرسش منطبقی پیدا نشد')
  const emptyBody = text('Try another word, or clear the search to browse the categories.', 'واژهٔ دیگری را امتحان کن یا جست‌وجو را پاک کن و دسته‌ها را مرور کن.')

  return <InformationShell page="faq" description={text(
    'Answers about the Openfund products, challenge terms, payouts, referrals, the trading terminal and transparency.',
    'پاسخ پرسش‌های رایج دربارهٔ محصولات اوپن‌فاند، شرایط چلنج‌ها، برداشت، معرفی، ترمینال معاملاتی و شفافیت.')[locale]}>
    <Hero locale={locale} page="faq"
      title={text('Questions, answered', 'پرسش‌ها،')[locale]}
      accent={text('in plain words', 'با پاسخ‌های روشن')[locale]}
      intro={text(
        'Everything people ask about the products, the published terms, the terminal and what is not enabled yet — grouped, searchable and straight.',
        'هرچه دربارهٔ محصولات، شرایط منتشرشده، ترمینال و آنچه هنوز فعال نیست می‌پرسند — دسته‌بندی‌شده، قابل جست‌وجو و بی‌تعارف.')[locale]}>
      <div className="info-hero-meta">
        <span className="pill">{labels.current[locale]}</span>
        <span>{labels.updated[locale]}</span>
        <span>{number(library.faqItems.length, locale)} {text('questions', 'پرسش')[locale]}</span>
        <span>{number(categories.length, locale)} {text('topics', 'موضوع')[locale]}</span>
      </div>
    </Hero>

    <div className="container">
      <aside className="info-notice">
        <span className="tiny-mark" aria-hidden="true">◇</span>
        <p>{text(
          'Numbers that appear in the answers are the published challenge terms of record. Purchase activation, funded accounts and payouts are not enabled in this release — where something is not decided yet, the answer says so.',
          'عددهای پرسش‌ها همان شرایط منتشرشده و مرجع چلنج‌هاست. فعال‌سازی خرید، حساب فاندشده و برداشت در این نسخه فعال نیست — و هرجا هنوز تصمیمی نیست، پاسخ همان را می‌گوید.')[locale]}</p>
      </aside>

      <div className="faq-layout" ref={containerRef}>
        <aside className="faq-sidebar">
          <label className="faq-search" htmlFor="faq-search-input">
            <span className="faq-search-icon" aria-hidden="true">⌕</span>
            <input
              id="faq-search-input"
              ref={searchRef}
              type="search"
              value={query}
              placeholder={searchLabel[locale]}
              aria-label={searchLabel[locale]}
              onChange={e => setQuery(e.target.value)} />
            {query && <button type="button" className="faq-search-clear" aria-label={clearLabel[locale]} onClick={() => { setQuery(''); searchRef.current?.focus() }}>×</button>}
          </label>
          <nav aria-label={text('FAQ topics', 'موضوع‌های پرسش‌ها')[locale]} className="faq-cats">
            <button type="button" className={category === 'all' ? 'active' : ''} aria-current={category === 'all' ? 'true' : undefined}
              onClick={() => setCategory('all')}>
              <i aria-hidden="true">≡</i>
              <span>{text('All questions', 'همهٔ پرسش‌ها')[locale]}</span>
              <b>{number(library.faqItems.length, locale)}</b>
            </button>
            {categories.map(cat => <button key={cat.key} type="button"
              className={category === cat.key ? 'active' : ''}
              aria-current={category === cat.key ? 'true' : undefined}
              onClick={() => setCategory(cat.key)}>
              <i aria-hidden="true">{CATEGORY_GLYPHS[cat.icon]}</i>
              <span>{cat.label[locale]}</span>
              <b>{number(counts.get(cat.key) || 0, locale)}</b>
            </button>)}
          </nav>
          <div className="faq-help">
            <span className="eyebrow">{text('Still stuck?', 'هنوز جواب نگرفتی؟')[locale]}</span>
            <p>{text('The rulebook is the full reference for every term; the tools page puts the maths in your hands.', 'رول‌بوک مرجع کامل همهٔ شرایط است و صفحهٔ ابزارها هم حساب‌ها را دست تو می‌دهد.')[locale]}</p>
            <div className="faq-help-links">
              <a className="text-link" href={`/${locale}/rulebook`}>{labels.rulebook[locale]} <span aria-hidden="true">↗</span></a>
              <a className="text-link" href={`/${locale}/tools`}>{text('Tools', 'ابزارها')[locale]} <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </aside>

        <div className="faq-content">
          <div className="faq-toolbar">
            <span className="faq-count">{grouped.reduce((sum, g) => sum + g.items.length, 0)} {text('shown', 'نمایش‌داده‌شده')[locale]}</span>
            {library.source.faq === 'bundled' && !loading && <span className="pill">{text('Bundled copy', 'نسخهٔ همراه')[locale]}</span>}
            <div className="faq-toggle-all">
              <button type="button" className="text-link" onClick={() => setOpenKeys(allOpen ? new Set() : new Set(visible.map(i => i.key)))}>
                {allOpen ? text('Collapse all', 'بستن همه')[locale] : text('Expand all', 'باز کردن همه')[locale]}
              </button>
            </div>
          </div>

          <div className="faq-mobile-cats">
            <label className="visually-hidden" htmlFor="faq-mobile-select">{text('FAQ topics', 'موضوع‌های پرسش‌ها')[locale]}</label>
            <select id="faq-mobile-select" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="all">{text('All questions', 'همهٔ پرسش‌ها')[locale]} ({number(library.faqItems.length, locale)})</option>
              {categories.map(cat => <option key={cat.key} value={cat.key}>{cat.label[locale]} ({number(counts.get(cat.key) || 0, locale)})</option>)}
            </select>
          </div>

          {grouped.map(({ cat, items }) => <section key={cat.key} className="faq-group" aria-labelledby={`faq-cat-${cat.key}`}>
            <h2 id={`faq-cat-${cat.key}`}><i aria-hidden="true">{CATEGORY_GLYPHS[cat.icon]}</i> {cat.label[locale]} <b>{number(items.length, locale)}</b></h2>
            {cat.description[locale] && <p className="faq-cat-desc">{cat.description[locale]}</p>}
            <ul className="faq-list">
              {items.map(item => <FaqItem key={item.key} locale={locale} item={item}
                open={openKeys.has(item.key) || !!query.trim()}
                onToggle={() => toggle(item.key)} />)}
            </ul>
          </section>)}

          {!grouped.length && <div className="faq-empty">
            <i aria-hidden="true">⌕</i>
            <h2>{emptyTitle[locale]}</h2>
            <p>{emptyBody[locale]}</p>
            <button type="button" className="text-link" onClick={() => { setQuery(''); setCategory('all') }}>{clearLabel[locale]}</button>
          </div>}

          <div className="info-end">
            <p>{text('Pick a challenge, read its terms, and try the terminal yourself.', 'یک چلنج را انتخاب کن، شرایطش را بخوان و خودت ترمینال را امتحان کن.')[locale]}</p>
            <div className="hero-actions">
              <a className="button" href={`/${locale}/challenges`}>{labels.challenges[locale]} <span aria-hidden="true">↙</span></a>
              <a className="text-link" href={`/${locale}/tools`}>{text('Open the tools', 'ابزارها را باز کن')[locale]} <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </InformationShell>
}
