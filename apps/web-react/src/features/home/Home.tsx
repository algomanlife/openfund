import { normalizeLocale, pick } from '../../i18n/locales'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import InformationShell from '../information/InformationShell'
import type { Locale } from '../information/content'
import { fetchCmsHome, type CmsHome } from '../../cms/client'
import LandingMotionBackground from './LandingMotionBackground'
import AnimatedTradingTerminalIllustration from './AnimatedTradingTerminalIllustration'
import TechnicalFeatureStrip from './TechnicalFeatureStrip'
import LeveragedMarketIllustration from './LeveragedMarketIllustration'
import './home.css'
import TelegramCommunity from '../community/TelegramCommunity'


/** Persian-only product gateway. Editorial fields remain owned by Directus;
 * decorative components do not connect to market, wallet or execution APIs. */
export default function Home() {
  const locale: Locale = normalizeLocale(useParams().locale, 'fa')
  const [content, setContent] = useState<CmsHome | null | 'error'>(null)
  useEffect(() => {
    let active = true
    void fetchCmsHome().then(data => { if (active) setContent(data || 'error') })
    return () => { active = false }
  }, [])
  const c = content === 'error' ? null : content
  return <InformationShell page="home" footer={false} nav={false}
      title={c ? (c.translations[locale].seoTitle || 'Openfund') : 'Openfund'}
      description={c ? (c.translations[locale].seoDescription || '') : 'Openfund'}>
    {c ? <HomeBody locale={locale} content={c} /> : <HomeUnavailable locale={locale} />}
  </InformationShell>
}

/* CTA destination whitelist — the CMS picks from these; arbitrary URLs are never rendered */
const CTA_HREF: Record<'challenges' | 'terminal', (locale: Locale) => string> = {
  challenges: locale => `/${locale}/challenges`,
  terminal: locale => `/${locale}/perpetual/trade`,
}

function HomeUnavailable({ locale }: { locale: Locale }) {
  return <div id="top" className="home-gateway">
    <div className="container home-stage">
      <h1>{pick(locale, 'محتوای این بخش در دسترس نیست', 'This section’s content is unavailable')}</h1>
      <p className="hero-intro">
        {pick(locale, 'اتصال به سامانهٔ مدیریت محتوا برقرار نشد. چند لحظه بعد صفحه را تازه‌سازی کن.', 'The content management service could not be reached. Please refresh in a moment.')}
      </p>
      <div className="home-community"><TelegramCommunity locale={locale} /></div>
    </div>
  </div>
}

function HomeBody({ locale, content: c }: { locale: Locale; content: CmsHome }) {
  const t = c.translations[locale]
  /* headline split: last word becomes the accent line (two-line composition) */
  const cut = t.headline.lastIndexOf(' ')
  const [main, accent] = cut > 0 ? [t.headline.slice(0, cut), t.headline.slice(cut + 1)] : [t.headline, '']

  return <div id="top" className="home-gateway">
    <LandingMotionBackground />

    <div className="container home-stage">
      <div className="home-enter e1 eyebrow"><span className="tiny-mark" aria-hidden="true">✳</span> OPENFUND</div>
      <h1 className="home-enter e2">{accent ? <>{main}<br /><em>{accent}</em></> : main}</h1>

      <div className="home-products">
        <article className="home-panel home-enter e3">
          <div className="home-art"><AnimatedTradingTerminalIllustration /></div>
          <div className="home-panel-copy">
            <h2>{t.propTitle}</h2>
          <p className="home-product-note" title={t.propDescription || undefined}>{t.propDescription || pick(locale, 'تمرین و ارزیابی · تصویر نمایشی', 'Practice and evaluation · illustration')}</p>
            <a className="button" href={c.propCtaDestination === 'terminal' ? `/${locale}/prop/trade` : CTA_HREF.challenges(locale)}>
              {t.propCta}
              <span aria-hidden="true">←</span>
            </a>
          </div>
        </article>

        <article className="home-panel home-enter e4">
          <div className="home-art home-perpetual-art" aria-hidden="true">
            <LeveragedMarketIllustration />
          </div>
          <div className="home-panel-copy">
            <h2>{t.perpetualTitle}</h2>
          <p className="home-product-note" title={t.perpetualDescription || undefined}>{t.perpetualDescription || pick(locale, 'داده‌های بازار · دسترسی خواندنی', 'Market data · read-only access')}</p>
            <a className="button" href={CTA_HREF[c.perpetualCtaDestination](locale)}>
              {t.perpetualCta}
              <span aria-hidden="true">↙</span>
            </a>
          </div>
        </article>
      </div>

      <div className="home-community"><TelegramCommunity locale={locale} /></div>
      <TechnicalFeatureStrip locale={locale} />
    </div>
  </div>
}
