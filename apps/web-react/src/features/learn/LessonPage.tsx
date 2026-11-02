import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { number, text } from '../information/content'
import { lessonBySlug, useSiteLibrary } from '../../cms/siteContent'
import LessonBody, { lessonToc } from './LessonBody'
import './learn.css'

type Locale = 'fa' | 'en'

/** a top scroll tracker, shown only on lesson pages */
function ReadingProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight
      setProgress(height > 0 ? Math.min(100, Math.max(0, window.scrollY / height * 100)) : 0)
    }
    addEventListener('scroll', onScroll, { passive: true }); onScroll()
    return () => removeEventListener('scroll', onScroll)
  }, [])
  if (!progress) return null
  return <div className="lesson-progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
}

export default function LessonPage() {
  const locale = useInformationLocale()
  const { slug } = useParams()
  const { library } = useSiteLibrary()
  const context = lessonBySlug(library, slug)
  const [active, setActive] = useState('')

  const toc = useMemo(() => context ? lessonToc(context.lesson.blocks, locale) : [], [context, locale])

  useEffect(() => {
    if (!toc.length) return
    const jump = () => {
      const current = toc.filter(entry => (document.getElementById(entry.id)?.getBoundingClientRect().top ?? Infinity) <= 220).at(-1)
      setActive(current?.id || toc[0].id)
    }
    addEventListener('scroll', jump, { passive: true }); jump()
    return () => removeEventListener('scroll', jump)
  }, [toc])

  if (!context) return <InformationShell page="learn" description={text('Lesson', 'درس')[locale]}>
    <Hero locale={locale} page="learn" title={text('Lesson not found', 'درس پیدا نشد')[locale]} accent={''} intro={text('This lesson does not exist.', 'این درس وجود ندارد.')[locale]} />
    <div className="container"><div className="info-end">
      <Link className="button" to={`/${locale}/learn`}>{text('Back to the Learning Center', 'بازگشت به مركز آموزش')[locale]}</Link>
    </div></div>
  </InformationShell>

  const { path, lesson, prev, next } = context
  const glossary = lesson.glossary.map(slug => library.glossary.find(term => term.slug === slug)).filter(Boolean)
  const tools = lesson.tools.map(slug => library.tools.find(tool => tool.slug === slug)).filter(Boolean)

  return <InformationShell page="learn" title={`${lesson.title[locale]} | Openfund`} description={lesson.summary[locale]}>
    <ReadingProgress />
    <Hero locale={locale} page="learn"
      title={lesson.title[locale]}
      accent={path.eyebrow[locale]}
      intro={lesson.summary[locale]}>
      <div className="info-hero-meta">
        <span><Link to={`/${locale}/learn/paths/${path.slug}`}>{path.title[locale]}</Link></span>
        <span dir="ltr">{number(lesson.minutes, locale)} {text('min', 'دقیقه')[locale]}</span>
        <span>{number(toc.length, locale)} {text('sections', 'بخش')[locale]}</span>
      </div>
    </Hero>

    <div className="container lesson-layout">
      {toc.length > 1 && <aside className="rulebook-sidebar lesson-toc">
        <nav aria-label={text('On this page', 'در این صفحه')[locale]}>
          <span className="eyebrow">{text('Contents', 'فهرست')[locale]}</span>
          <ol>
            {toc.map((entry, index) => <li key={entry.id}>
              <a href={`#${entry.id}`} aria-current={active === entry.id ? 'location' : undefined}
                onClick={e => {
                  e.preventDefault()
                  document.getElementById(entry.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}>
                <span className="section-number">{number(index + 1, locale, { minimumIntegerDigits: 2 })}</span>
                {entry.label}
              </a>
            </li>)}
          </ol>
        </nav>
      </aside>}

      <div className="lesson-content">
        <LessonBody blocks={lesson.blocks} locale={locale} />

        {lesson.takeaways.length > 0 && <section className="lesson-takeaways">
          <h2>{text('Takeaways', 'جمع‌بندی')[locale]}</h2>
          <ul className="lesson-list">
            {lesson.takeaways.map((item, i) => <li key={i}>{item[locale]}</li>)}
          </ul>
        </section>}

        {(glossary.length > 0 || tools.length > 0) && <section className="lesson-related">
          {tools.length > 0 && <div className="lesson-related-group">
            <span className="eyebrow">{text('Try it with', 'با این تمرین کن')[locale]}</span>
            {tools.map(tool => tool && <Link key={tool.slug} className="text-link" to={`/${locale}/tools/${tool.slug}`}>
              {tool.name[locale]} <span aria-hidden="true">↗</span>
            </Link>)}
          </div>}
          {glossary.length > 0 && <div className="lesson-related-group">
            <span className="eyebrow">{text('Terms used here', 'اصطلاح‌های این درس')[locale]}</span>
            {glossary.map(term => term && <Link key={term.slug} className="text-link" to={`/${locale}/learn/glossary/${term.slug}`}>
              {term.term[locale]} <span aria-hidden="true">↗</span>
            </Link>)}
          </div>}
        </section>}

        <nav className="lesson-pager" aria-label={text('Lesson navigation', 'ناوبری درس')[locale]}>
          {prev
            ? <Link className="lesson-pager-prev" to={`/${locale}/learn/lessons/${prev.slug}`}>
                <small>{text('Previous', 'درس قبلی')[locale]}</small>
                <b>{prev.title[locale]}</b>
              </Link>
            : <span />}
          {next
            ? <Link className="lesson-pager-next" to={`/${locale}/learn/lessons/${next.slug}`}>
                <small>{text('Next', 'درس بعدی')[locale]}</small>
                <b>{next.title[locale]}</b>
              </Link>
            : <Link className="lesson-pager-next" to={`/${locale}/tools`}>
                <small>{text('Path complete', 'مسیر تمام شد')[locale]}</small>
                <b>{text('Open the Tools Center', 'مركز ابزارها را باز کن')[locale]}</b>
              </Link>}
        </nav>
      </div>
    </div>
  </InformationShell>
}
