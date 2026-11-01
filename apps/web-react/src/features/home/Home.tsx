import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import InformationShell from '../information/InformationShell'
import type { Locale } from '../information/content'
import { fetchCmsHome, directusUrl, type CmsHome } from '../../cms/client'
import './home.css'

const base = import.meta.env.BASE_URL

/** The Openfund product gateway: ONE screen, no scroll, no footer, no menu —
 *  a clean, quiet stage for the two products. ALL copy comes from Directus
 *  (`home_content`); fields the owner leaves empty simply don't render.
 *  Direction B (dual product panels) is the default; `?variant=a` previews
 *  the editorial direction on the same route. */
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
  return <InformationShell page="home" footer={false} nav={false}
      title={c ? (c.translations[locale].seoTitle || 'Openfund') : 'Openfund'}
      description={c ? (c.translations[locale].seoDescription || '') : 'Openfund'}>
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

/* beating heart mark for the signature line */
function Heartbeat() {
  return <svg className="hb-heart" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M12 21C7 16.6 3.2 13.4 3.2 9.3 3.2 6.3 5.5 4.2 8.2 4.2c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2 2.7 0 5 2.1 5 5.1 0 4.1-3.8 7.3-8.8 11.7z" fill="#82e7bd"/>
  </svg>
}

function HomeBody({ variant, locale, content: c }: { variant: 'a' | 'b'; locale: Locale; content: CmsHome }) {
  const t = c.translations[locale]
  /* headline split: last word becomes the accent line (two-line composition) */
  const cut = t.headline.lastIndexOf(' ')
  const [main, accent] = cut > 0 ? [t.headline.slice(0, cut), t.headline.slice(cut + 1)] : [t.headline, '']
  /* signature line under the products (newline-separated in the CMS, joined here) */
  const signature = (t.note || '').split('\n').map(x => x.trim()).filter(Boolean).join(' ')

  return <div id="top" className={`home-gateway home-variant-${variant}`}>
    <div className="home-ambient" aria-hidden="true"><i /><i /><i /><b /></div>

    <div className="container home-stage">
      <h1 className="home-enter e2">{accent ? <>{main}<br /><em>{accent}</em></> : main}</h1>

      <div className="home-products">
        <article className="home-panel home-enter e3">
          <div className="home-art"><img src={illustrationHref(c.propImage, 'prop-trading.svg')} width={520} height={400} decoding="async"
            alt={locale === 'fa' ? 'تصویری از معامله‌گر اوپن‌فاند پشت میز ارزیابی' : 'An Openfund trader at the evaluation desk'} /></div>
          <div className="home-panel-copy">
            <h2>{t.propTitle}</h2>
            <a className="button" href={CTA_HREF[c.propCtaDestination](locale)}>
              {t.propCta}
              <span aria-hidden="true">←</span>
            </a>
          </div>
        </article>

        <article className="home-panel home-enter e4">
          <div className="home-art"><img src={illustrationHref(c.perpetualImage, 'perpetual-trading.svg')} width={520} height={400} decoding="async"
            alt={locale === 'fa' ? 'دستگاه دادهٔ بازار اوپن‌فاند با هستهٔ هولوگرافیک' : 'The Openfund market engine with its holographic core'} /></div>
          <div className="home-panel-copy">
            <h2>{t.perpetualTitle}</h2>
            <a className="button" href={CTA_HREF[c.perpetualCtaDestination](locale)}>
              {t.perpetualCta}
              <span aria-hidden="true">↙</span>
            </a>
          </div>
        </article>
      </div>

      {signature && (
        <div className="home-heartbeat home-enter e5">
          <Heartbeat />
          <span className="hb-line">{signature}</span>
        </div>
      )}
    </div>
  </div>
}
