import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { text, tx } from '../information/content'
import { fetchCmsLegalDoc, type CmsLegalDoc } from '../../cms/client'
import DirArrow from '../../ui/DirArrow'
import './tournament.css'

/* /:locale/tournament/terms — the published Premium League terms from
   Directus (legal_documents, doc_type 'tournament-terms'). Nothing is shown
   as binding until the owner publishes a version; the draft never renders. */
const c = {
  title: text('Openfund Premium League: terms', 'لیگ برتر اوپن‌فاند: قوانین و شرایط'),
  pending: text('The tournament terms have not been published yet. Registration opens only after they are.', 'قوانین مسابقه هنوز منتشر نشده است. ثبت‌نام فقط پس از انتشار آن باز می‌شود.'),
  version: text('Version', 'نسخه'),
  back: text('Back to the Premium League', 'بازگشت به لیگ برتر'),
}

export default function TournamentTermsPage() {
  const locale = useInformationLocale()
  const t = (v: { en: string; fa: string }) => tx(locale, v)
  const [doc, setDoc] = useState<(CmsLegalDoc & { version: string | null }) | null | undefined>(undefined)
  useEffect(() => { let live = true; void fetchCmsLegalDoc('tournament-terms').then(d => { if (live) setDoc(d) }); return () => { live = false } }, [])
  return <InformationShell page="tournament" description={t(c.title)} title={`${t(c.title)} | Openfund`}>
    <article className="container tl-section tl-terms" id="top">
      <h1>{doc ? tx(locale, doc.title) : t(c.title)}</h1>
      {doc === undefined ? null : doc === null ? <p className="tl-empty">{t(c.pending)}</p> : <>
        {doc.version && <p className="tl-note">{t(c.version)}: <span dir="ltr">{doc.version}</span></p>}
        {doc.paragraphs.map((p, i) => <p key={i}>{tx(locale, p)}</p>)}
      </>}
      <p><Link className="text-link" to={`/${locale}/tournament`}><DirArrow kind="back" /> {t(c.back)}</Link></p>
    </article>
  </InformationShell>
}
