import { Link, useParams } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { number, text } from '../information/content'
import { pathBySlug, useSiteLibrary } from '../../cms/siteContent'

type Locale = 'fa' | 'en'

export default function PathPage() {
  const locale = useInformationLocale()
  const { slug } = useParams()
  const { library } = useSiteLibrary()
  const path = pathBySlug(library, slug)
  const minutes = path?.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0) || 0

  if (!path) return <InformationShell page="learn" description={text('Learning path', 'مسیر یادگیری')[locale]}>
    <Hero locale={locale} page="learn" title={text('Path not found', 'مسیر پیدا نشد')[locale]} accent={''} intro={text('This learning path does not exist.', 'این مسیر یادگیری وجود ندارد.')[locale]} />
    <div className="container"><div className="info-end">
      <Link className="button" to={`/${locale}/learn`}>{text('Back to the Learning Center', 'بازگشت به مركز آموزش')[locale]}</Link>
    </div></div>
  </InformationShell>

  const first = path.lessons[0]

  return <InformationShell page="learn" title={`${path.title[locale]} | Openfund`} description={path.summary[locale]}>
    <Hero locale={locale} page="learn"
      title={path.title[locale]}
      accent={path.eyebrow[locale]}
      intro={path.summary[locale]}>
      <div className="info-hero-meta">
        <span>{number(path.lessons.length, locale)} {text('lessons', 'درس')[locale]}</span>
        <span dir="ltr">{number(minutes, locale)} {text('min', 'دقیقه')[locale]}</span>
        {first && <span>{text('starts with', 'شروع با')[locale]} {first.title[locale]}</span>}
      </div>
      {first && <div className="hero-actions">
        <Link className="button" to={`/${locale}/learn/lessons/${first.slug}`}>{text('Start the path', 'مسیر را شروع کن')[locale]} <span aria-hidden="true">↙</span></Link>
      </div>}
    </Hero>

    <div className="container path-page">
      {path.outcomes.length > 0 && <section className="path-outcomes" aria-labelledby="path-outcomes">
        <h2 id="path-outcomes">{text('After this path you can', 'پس از این مسیر می‌توانی')[locale]}</h2>
        <ul className="lesson-list">
          {path.outcomes.map((outcome, i) => <li key={i}>{outcome[locale]}</li>)}
        </ul>
      </section>}

      <section className="path-lessons" aria-labelledby="path-lessons">
        <h2 id="path-lessons">{text('Lessons', 'درس‌ها')[locale]}</h2>
        <ol className="path-lesson-list">
          {path.lessons.map((lesson, index) => <li key={lesson.slug}>
            <Link to={`/${locale}/learn/lessons/${lesson.slug}`}>
              <span className="path-lesson-number">{number(index + 1, locale, { minimumIntegerDigits: 2 })}</span>
              <span className="path-lesson-title">
                <b>{lesson.title[locale]}</b>
                <small>{lesson.summary[locale]}</small>
              </span>
              <span className="path-lesson-min" dir="ltr">{number(lesson.minutes, locale)} {text('min', 'دقیقه')[locale]}</span>
              <span aria-hidden="true" className="path-lesson-arrow">↙</span>
            </Link>
          </li>)}
        </ol>
      </section>

      <div className="info-end">
        <p>{text('Every path ends where the tools begin.', 'هر مسیر همان‌جا تمام می‌شود که ابزارها شروع می‌شوند.')[locale]}</p>
        <div className="hero-actions">
          <Link className="button" to={`/${locale}/tools`}>{text('Open the Tools Center', 'مركز ابزارها را باز کن')[locale]} <span aria-hidden="true">↙</span></Link>
          <Link className="text-link" to={`/${locale}/learn`}>{text('All paths', 'همهٔ مسیرها')[locale]} <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </div>
  </InformationShell>
}
