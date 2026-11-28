import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { tx } from '../information/content'
import { fetchCmsLegalDoc, type CmsLegalDoc } from '../../cms/client'
import { legalCopy, privacy, terms, type LegalDocument } from './content'
import './legal.css'

/* /:locale/terms and /:locale/privacy. A published legal_documents row
   (doc_type 'terms' or 'privacy') replaces the built-in reviewed copy; a
   draft never renders and the built-in copy stays when Directus is down. */
const DOCS: Record<'terms' | 'privacy', LegalDocument> = { terms, privacy }

export default function LegalPage({ doc: docType }: { doc: 'terms' | 'privacy' }) {
  const locale = useInformationLocale()
  const t = (v: { en: string; fa: string }) => tx(locale, v)
  const doc = DOCS[docType]
  const [cms, setCms] = useState<(CmsLegalDoc & { version: string | null }) | null>(null)
  useEffect(() => { let live = true; setCms(null); void fetchCmsLegalDoc(docType).then(d => { if (live) setCms(d) }); return () => { live = false } }, [docType])
  const other = docType === 'terms' ? 'privacy' : 'terms'
  const date = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-persian' : locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(doc.effective + 'T00:00:00Z'))
  return <InformationShell page={docType} description={t(doc.intro)} title={`${cms ? tx(locale, cms.title) : t(doc.title)} | Openfund`}>
    <article className="container of-legal" id="top" data-legal-doc={docType}>
      <header className="of-legal-head">
        <h1>{cms ? tx(locale, cms.title) : t(doc.title)}</h1>
        <p className="of-legal-meta">
          <span>{t(legalCopy.version)}: <bdi dir="ltr">{cms?.version ?? doc.version}</bdi></span>
          {!cms && <span>{t(legalCopy.effective)}: {date}</span>}
        </p>
      </header>
      {cms ? <div className="of-legal-body">{cms.paragraphs.map((p, i) => <p key={i}>{tx(locale, p)}</p>)}</div> : <div className="of-legal-layout">
        <nav className="of-legal-toc" aria-label={t(legalCopy.contents)}>
          <b>{t(legalCopy.contents)}</b>
          <ol>{doc.sections.map(s => <li key={s.id}><a href={`#${s.id}`}>{t(s.heading)}</a></li>)}</ol>
        </nav>
        <div className="of-legal-body">
          <p className="of-legal-intro">{t(doc.intro)}</p>
          {doc.sections.map(s => <section key={s.id} id={s.id} className="of-legal-section">
            <h2>{t(s.heading)}</h2>
            {s.paragraphs.map((p, i) => <p key={i}>{t(p)}</p>)}
          </section>)}
        </div>
      </div>}
      <footer className="of-legal-related">
        <b>{t(legalCopy.related)}</b>
        <Link className="text-link" to={`/${locale}/${other}`}>{t(DOCS[other].title)}</Link>
        <Link className="text-link" to={`/${locale}/rulebook`}>{t(legalCopy.rules)}</Link>
        <Link className="text-link" to={`/${locale}/contact`}>{t(legalCopy.contact)}</Link>
      </footer>
    </article>
  </InformationShell>
}
