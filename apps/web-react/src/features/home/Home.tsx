import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import InformationShell from '../information/InformationShell'
import type { Locale } from '../information/content'
import { fetchCmsHome, directusUrl, type CmsHome } from '../../cms/client'
import './home.css'

const base = import.meta.env.BASE_URL

/** The Openfund product gateway: one screen, two products, no footer.
 *  ALL copy comes from Directus (`home_content`) — the owner edits headline,
 *  descriptions, CTA labels/destinations, illustrations and SEO without code
 *  changes; edits appear on the next load (no rebuild).
 *  Direction B ("Dual Product Experience") is the production default;
 *  `?variant=a` renders the "Editorial Minimalism" preview on the same route. */
export default function Home() {
  const [params] = useSearchParams()
  const variant = params.get('variant') === 'a' ? 'a' : 'b'
  const locale: Locale = useParams().locale === 'en' ? 'en' : 'fa'
  const [content, setContent] = useState<CmsHome | null | 'error'>(null)
  useEffect(() => {
    let active = true
    void fetchCmsHome().then(data => { if (active) setContent(data || 'error') })
    return () => { active = false }
  }, [])
  const c = content === 'error' ? null : content
  return <InformationShell page="home" footer={false}
      title={c ? (c.translations[locale].seoTitle || 'Openfund') : 'Openfund'}
      description={c ? (c.translations[locale].seoDescription || c.translations[locale].sub) : 'Openfund'}>
    {c ? <HomeBody variant={variant} locale={locale} content={c} /> : <HomeUnavailable locale={locale} />}
  </InformationShell>
}

/* CTA destination whitelist — the CMS picks from these; arbitrary URLs are never rendered */
const CTA_HREF: Record<'challenges' | 'terminal', (locale: Locale) => string> = {
  challenges: locale => `#/${locale}/challenges`,
  terminal: () => '#/terminal',
}

/* illustration: Directus file when the owner uploaded one, bundled asset otherwise */
function illustrationHref(fileId: string | null, fallback: string): string {
  return fileId ? `${directusUrl()}/assets/${fileId}` : `${base}assets/home/${fallback}`
}

function HomeUnavailable({ locale }: { locale: Locale }) {
  return <div id="top" className="home-gateway">
    <div className="container home-stage">
      <h1>{locale === 'fa' ? 'محتوای این بخش در دسترس نیست' : 'This section’s content is unavailable'}</h1>
      <p className="hero-intro">
        {locale === 'fa'
          ? 'اتصال به سامانهٔ مدیریت محتوا برقرار نشد. چند لحظه بعد صفحه را تازه‌سازی کن.'
          : 'The content management service could not be reached. Please refresh in a moment.'}
      </p>
    </div>
  </div>
}

function HomeBody({ variant, locale, content: c }: { variant: 'a' | 'b'; locale: Locale; content: CmsHome }) {
  const t = c.translations[locale]
  /* headline split: last word becomes the accent line (matches the designed
     two-line composition for both locales) */
  const cut = t.headline.lastIndexOf(' ')
  const [main, accent] = cut > 0 ? [t.headline.slice(0, cut), t.headline.slice(cut + 1)] : [t.headline, '']
  return <div id="top" className={`home-gateway home-variant-${variant}`}>
    <div className="hero-atmosphere" aria-hidden="true"><i /><i /><i /></div>

    <div className="container home-stage">
      <div className="eyebrow"><span className="tiny-mark" aria-hidden="true">✳</span> OPENFUND</div>
      <h1>{accent ? <>{main}<br /><em>{accent}</em></> : main}</h1>
      {t.sub && <p className="hero-intro">{t.sub}</p>}

      <div className="home-products">
        <article className="home-panel">
          <img src={illustrationHref(c.propImage, 'prop-trading.svg')} width={440} height={320} decoding="async"
            alt={locale === 'fa' ? 'تصویری از مسیر ارزیابی و مراحل چلنج پراپ اوپن‌فاند' : 'Openfund prop evaluation path with ascending phase milestones'} />
          <div className="home-panel-copy">
            <span className="home-kicker">{locale === 'fa' ? 'محصول الف' : 'Product A'}</span>
            <h2>{t.propTitle}</h2>
            {t.propDescription && <p>{t.propDescription}</p>}
            <a className="button" href={CTA_HREF[c.propCtaDestination](locale)}>
              {t.propCta}
              <span aria-hidden="true">←</span>
            </a>
          </div>
        </article>

        <article className="home-panel">
          <img src={illustrationHref(c.perpetualImage, 'perpetual-trading.svg')} width={440} height={320} decoding="async"
            alt={locale === 'fa' ? 'ترکیب کندل‌ها و فشار خرید و فروش در معاملات پرپچوال' : 'Candlestick composition with long and short pressure'} />
          <div className="home-panel-copy">
            <span className="home-kicker">{locale === 'fa' ? 'محصول ب' : 'Product B'}</span>
            <h2>{t.perpetualTitle}</h2>
            {t.perpetualDescription && <p>{t.perpetualDescription}</p>}
            <a className="button" href={CTA_HREF[c.perpetualCtaDestination](locale)}>
              {t.perpetualCta}
              <span aria-hidden="true">↙</span>
            </a>
          </div>
        </article>
      </div>

      {t.note && <p className="home-note"><span>{t.note}</span></p>}
    </div>
  </div>
}
