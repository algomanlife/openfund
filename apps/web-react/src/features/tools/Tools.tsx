import { Link } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { labels, number, text } from '../information/content'
import { useSiteLibrary } from '../../cms/siteContent'
import type { ToolSpec } from '../../cms/contentTypes'
import './tools.css'

type Locale = import('../../i18n/locales').AppLocale

const CATEGORY_LABELS: Record<ToolSpec['category'], ReturnType<typeof text>> = {
  sizing: text('Position sizing', 'حجم‌گذاری موقعیت'),
  risk: text('Risk and limits', 'ریسک و سقف‌ها'),
  analysis: text('Record analysis', 'تحلیل سوابق'),
}

const CATEGORY_GLYPHS: Record<ToolSpec['category'], string> = { sizing: '⊙', risk: '⌁', analysis: '▤' }

function ToolCard({ tool, locale }: { tool: ToolSpec; locale: Locale }) {
  return <Link to={`/${locale}/tools/${tool.slug}`} className="tool-card">
    <span className="tool-card-glyph" aria-hidden="true">{CATEGORY_GLYPHS[tool.category]}</span>
    <h3>{tool.name[locale]}</h3>
    <p>{tool.tagline[locale]}</p>
    <span className="text-link">{text('Open the tool', 'باز کردن ابزار')[locale]} <span aria-hidden="true">↗</span></span>
  </Link>
}

export default function Tools() {
  const locale = useInformationLocale()
  const { loading, library } = useSiteLibrary()
  const grouped = (['sizing', 'risk', 'analysis'] as const).map(category => ({
    category, tools: library.tools.filter(tool => tool.category === category),
  }))

  return <InformationShell page="tools" description={text(
    'Ten browser-side trading calculators: position size, margin, liquidation, PnL, funding, risk/reward, risk of ruin, drawdown, consistency and a CSV journal analyzer.',
    'ده محاسبه‌گر معاملاتی در مرورگر: حجم موقعیت، مارجین، لیکوئید، سود و زیان، فاندینگ، ریسک به ریوارد، احتمال ویرانی، دراودان، تداوم و تحلیل‌گر CSV ژورنال.')[locale]}>
    <Hero locale={locale} page="tools"
      title={text('Ten calculators,', 'ده محاسبه‌گر،')[locale]}
      accent={text('zero guesswork', 'بدون حدس و شانس')[locale]}
      intro={text(
        'The maths traders keep redoing by hand — sizing, margin, liquidation, funding, drawdown and the statistics of your own journal — computed in your browser, with the formula shown and the assumptions stated.',
        'همان حساب‌هایی که معامله‌گرها مدام با دست تکرار می‌کنند — حجم، مارجین، لیکوئید، فاندینگ، دراودان و آمار ژورنال خودت — در مرورگر تو، با فرمولِ نمایان و فرض‌های بیان‌شده.')[locale]}>
      <div className="info-hero-meta">
        <span className="pill">{text('Runs in your browser', 'در مرورگر تو اجرا می‌شود')[locale]}</span>
        <span>{text('No account, no orders, no uploads', 'بدون حساب، بدون سفارش، بدون بارگذاری')[locale]}</span>
        <span>{number(library.tools.length, locale)} {text('tools', 'ابزار')[locale]}</span>
      </div>
    </Hero>

    <div className="container tool-index">
      <aside className="info-notice">
        <span className="tiny-mark" aria-hidden="true">◇</span>
        <p>{text(
          'These are planning aids, not trading advice, and they are not connected to any order, wallet or venue. Where a tool mirrors a challenge rule, the terms are the published terms of record — purchase activation, funded accounts and payouts are not enabled in this release.',
          'این‌ها ابزار برنامه‌ریزی‌اند، نه توصیهٔ معاملاتی، و به هیچ سفارش، کیف پول یا صرافی متصل نیستند. جایی که ابزاری قاعدهٔ چلنج را بازتولید می‌کند، شرایط همان شرایط منتشرشده و مرجع است — فعال‌سازی خرید، حساب فاندشده و برداشت در این نسخه فعال نیست.')[locale]}</p>
      </aside>

      {grouped.map(({ category, tools }) => tools.length > 0 && <section key={category} className="tool-group" aria-labelledby={`tool-cat-${category}`}>
        <h2 id={`tool-cat-${category}`}><i aria-hidden="true">{CATEGORY_GLYPHS[category]}</i> {CATEGORY_LABELS[category][locale]} <b>{number(tools.length, locale)}</b></h2>
        <div className="tool-card-grid">
          {tools.map(tool => <ToolCard key={tool.slug} tool={tool} locale={locale} />)}
        </div>
      </section>)}

      <section className="tool-education">
        <h2>{text('Before you use them', 'پیش از استفاده')[locale]}</h2>
        <p>{text(
          'The Learning Center explains the mechanics behind every number these tools produce, and the glossary defines each term without jargon.',
          'مركز آموزش، مکانیکِ پشت هر عددی که این ابزارها می‌سازند را توضیح می‌دهد و واژه‌نامه هر اصطلاح را بدون زبان تخصصی تعریف می‌کند.')[locale]}</p>
        <div className="hero-actions">
          <Link className="button" to={`/${locale}/learn`}>{labels.learn[locale]} <span aria-hidden="true">↙</span></Link>
          <Link className="text-link" to={`/${locale}/learn/glossary`}>{text('Open the glossary', 'واژه‌نامه را باز کن')[locale]} <span aria-hidden="true">↗</span></Link>
        </div>
      </section>
    </div>
  </InformationShell>
}
