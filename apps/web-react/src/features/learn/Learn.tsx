import { Link } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { labels, number, text } from '../information/content'
import { useSiteLibrary } from '../../cms/siteContent'
import type { LearningPathContent } from '../../cms/contentTypes'
import './learn.css'

type Locale = import('../../i18n/locales').AppLocale

const LEVEL_LABELS: Record<LearningPathContent['level'], ReturnType<typeof text>> = {
  foundation: text('Foundation', 'پایه'),
  practitioner: text('Practitioner', 'کاربردی'),
  advanced: text('Advanced', 'پیشرفته'),
}

function PathCard({ path, locale }: { path: LearningPathContent; locale: Locale }) {
  const minutes = path.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0)
  return <Link to={`/${locale}/learn/paths/${path.slug}`} className="learn-path-card">
    <span className="learn-path-eyebrow">{path.eyebrow[locale]}</span>
    <h3>{path.title[locale]}</h3>
    <p>{path.summary[locale]}</p>
    <div className="learn-path-meta">
      <span className="pill">{LEVEL_LABELS[path.level][locale]}</span>
      <span>{number(path.lessons.length, locale)} {text('lessons', 'درس')[locale]}</span>
      <span dir="ltr">{number(minutes, locale)} {text('min', 'دقیقه')[locale]}</span>
    </div>
  </Link>
}

export default function Learn() {
  const locale = useInformationLocale()
  const { library } = useSiteLibrary()
  const totalLessons = library.paths.reduce((sum, path) => sum + path.lessons.length, 0)
  const totalMinutes = library.paths.reduce((sum, path) => sum + path.lessons.reduce((s, l) => s + l.minutes, 0), 0)

  return <InformationShell page="learn" description={text(
    'The Openfund Learning Center: five learning paths from perpetual futures mechanics to on-chain transparency, a 40-term glossary and lessons that link to the calculators.',
    'مركز آموزش اوپن‌فاند: پنج مسیر یادگیری از مکانیک معاملات آنی تا شفافیت درون‌زنجیره‌ای، واژه‌نامهٔ ۴۰ اصطلاح و درس‌هایی که به محاسبه‌گرها وصل می‌شوند.')[locale]}>
    <Hero locale={locale} page="learn"
      title={text('Learn the mechanics,', 'مکانیک را یاد بگیر،')[locale]}
      accent={text('not the hype', 'نه شعار را')[locale]}
      intro={text(
        'Five paths, from how a perpetual contract actually works to what on-chain transparency can and cannot prove. Every lesson states what it assumes, shows the formulas, and points at the tool that puts it into practice.',
        'پنج مسیر، از اینکه یک قرارداد آنی واقعاً چگونه کار می‌کند تا اینکه شفافیت درون‌زنجیره‌ای چه چیزی را می‌تواند اثبات کند و چه چیزی را نه. هر درس فرض‌هایش را می‌گوید، فرمول‌ها را نشان می‌دهد و به ابزاری که آن را عملی می‌کند اشاره دارد.')[locale]}>
      <div className="info-hero-meta">
        <span className="pill">{text('Educational, not advice', 'آموزشی، نه توصیه')[locale]}</span>
        <span>{number(library.paths.length, locale)} {text('paths', 'مسیر')[locale]}</span>
        <span>{number(totalLessons, locale)} {text('lessons', 'درس')[locale]}</span>
        <span dir="ltr">{number(totalMinutes, locale)} {text('min', 'دقیقه')[locale]}</span>
      </div>
    </Hero>

    <div className="container learn-index">
      <aside className="info-notice">
        <span className="tiny-mark" aria-hidden="true">◇</span>
        <p>{text(
          'The material explains how markets and instruments work in general, and which parts of Openfund are live today. It is not a promise of profit, and it does not claim features that are not enabled in this release.',
          'این مطالب توضیح می‌دهند بازارها و ابزارها به‌طور کلی چگونه کار می‌کنند و کدام بخش‌های اوپن‌فاند امروز فعال است. نه وعدهٔ سود است و نه ادعای قابلیتی که در این نسخه فعال نیست.')[locale]}</p>
      </aside>

      <div className="learn-path-grid">
        {library.paths.map(path => <PathCard key={path.slug} path={path} locale={locale} />)}
      </div>

      <section className="learn-glossary-teaser">
        <h2>{text('The glossary', 'واژه‌نامه')[locale]}</h2>
        <p>{text(
          'Forty terms traders actually meet — funding, mark price, maintenance margin, drawdown, expectancy — defined in one line and in depth.',
          'چهل اصطلاحی که معامله‌گر واقعاً با آن‌ها روبه‌رو می‌شود — فاندینگ، مارک پرایس، مارجین نگهداری، دراودان، امید ریاضی — با یک خط تعریف و با توضیح کامل.')[locale]}</p>
        <div className="hero-actions">
          <Link className="button" to={`/${locale}/learn/glossary`}>{text('Open the glossary', 'واژه‌نامه را باز کن')[locale]} <span aria-hidden="true">↙</span></Link>
          <Link className="text-link" to={`/${locale}/tools`}>{labels.tools[locale]} <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <div className="info-end">
        <p>{text('Pick a path and read the first lesson — it takes about ten minutes.', 'یک مسیر را انتخاب کن و درس اولش را بخوان — حدود ده دقیقه وقت می‌برد.')[locale]}</p>
        <div className="hero-actions">
          {library.paths[0] && <Link className="button" to={`/${locale}/learn/paths/${library.paths[0].slug}`}>{text('Start with', 'شروع کن با')[locale]} {library.paths[0].title[locale]} <span aria-hidden="true">↙</span></Link>}
          <Link className="text-link" to={`/${locale}/faq`}>{labels.faq[locale]} <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </div>
  </InformationShell>
}
