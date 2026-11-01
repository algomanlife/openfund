import { useParams, useSearchParams } from 'react-router-dom'
import InformationShell from '../information/InformationShell'
import { text, type Locale } from '../information/content'
import './home.css'

const base = import.meta.env.BASE_URL

/** The Openfund product gateway: one screen, two products, no footer.
 *  Direction B ("Dual Product Experience") is the production default;
 *  `?variant=a` renders the "Editorial Minimalism" composition on the same
 *  route as a lightweight preview (documented in the PR, not a second page). */
export default function Home() {
  const [params] = useSearchParams()
  const variant = params.get('variant') === 'a' ? 'a' : 'b'
  const locale: Locale = useParams().locale === 'en' ? 'en' : 'fa'
  return <InformationShell page="home" footer={false}
      title={text('Openfund — All Markets, One Trading Platform', 'اوپن‌فاند — همه بازارها در یک پلتفرم معاملاتی')[locale]}
      description={text(
        'Openfund is one trading platform with two paths: prop trading challenges and leveraged perpetual trading on live Gains Network market data.',
        'اوپن‌فاند یک پلتفرم معاملاتی با دو مسیر است: چلنج‌های پراپ و معاملات پرپچوال اهرمی با دادهٔ زندهٔ بازار از Gains Network.'
      )[locale]}>
    <HomeBody variant={variant} locale={locale} />
  </InformationShell>
}

function HomeBody({ variant, locale }: { variant: 'a' | 'b'; locale: Locale }) {
  return <div id="top" className={`home-gateway home-variant-${variant}`}>
    <div className="hero-atmosphere" aria-hidden="true"><i /><i /><i /></div>

    <div className="container home-stage">
      <div className="eyebrow"><span className="tiny-mark" aria-hidden="true">✳</span> OPENFUND</div>
      <h1>{locale === 'fa' ? <>همه بازارها<br /><em>در یک پلتفرم معاملاتی</em></> : <>All Markets<br /><em>One Trading Platform</em></>}</h1>
      <p className="hero-intro">
        {locale === 'fa'
          ? 'دو مسیر، یک مقصد: مهارتت را در چلنج‌های پراپ ثابت کن یا مستقیم وارد معاملات پرپچوال شو.'
          : 'Two paths, one destination: prove your skill in prop trading challenges, or step straight into leveraged perpetual trading.'}
      </p>

      <div className="home-products">
        <article className="home-panel">
          <img src={`${base}assets/home/prop-trading.svg`} width={440} height={320} decoding="async"
            alt={locale === 'fa' ? 'تصویری از مسیر ارزیابی و مراحل چلنج پراپ اوپن‌فاند' : 'Openfund prop evaluation path with ascending phase milestones'} />
          <div className="home-panel-copy">
            <span className="home-kicker">{locale === 'fa' ? 'محصول الف' : 'Product A'}</span>
            <h2>{locale === 'fa' ? 'چلنج‌های پراپ' : 'Prop Trading Challenges'}</h2>
            <p>{locale === 'fa'
              ? 'ارزیابی روشن، قواعد شفاف و حساب تأمین سرمایه‌شده برای معامله‌گرانی که آمادهٔ قدم بعدی‌اند.'
              : 'A clear evaluation, transparent rules and a funded account for traders ready for the next step.'}</p>
            <a className="button" href={`#/${locale}/challenges`}>
              {locale === 'fa' ? 'چلنج‌های پراپ' : 'Prop Trading Challenges'}
              <span aria-hidden="true">←</span>
            </a>
          </div>
        </article>

        <article className="home-panel">
          <img src={`${base}assets/home/perpetual-trading.svg`} width={440} height={320} decoding="async"
            alt={locale === 'fa' ? 'ترکیب کندل‌ها و فشار خرید و فروش در معاملات پرپچوال' : 'Candlestick composition with long and short pressure'} />
          <div className="home-panel-copy">
            <span className="home-kicker">{locale === 'fa' ? 'محصول ب' : 'Product B'}</span>
            <h2>{locale === 'fa' ? 'معاملات پرپچوال اهرمی' : 'Leveraged Perpetual Trading'}</h2>
            <p>{locale === 'fa'
              ? 'پلتفرم معاملاتی اختصاصی با دادهٔ زندهٔ بازار از Gains Network؛ رمزارز، فارکس، سهام، شاخص و کالا.'
              : 'A dedicated trading terminal on live Gains Network market data: crypto, forex, stocks, indices and commodities.'}</p>
            <a className="button" href="#/terminal">
              {locale === 'fa' ? 'معاملات پرپچوال اهرمی' : 'Leveraged Perpetual Trading'}
              <span aria-hidden="true">↙</span>
            </a>
          </div>
        </article>
      </div>

      <p className="home-note">
        {locale === 'fa'
          ? <span>دادهٔ بازار: <a href="https://gains.trade" target="_blank" rel="noopener" dir="ltr">Gains Network ↗</a> · اجرای معاملات در این فاز شبیه‌سازی‌شده است.</span>
          : <span>Market data by <a href="https://gains.trade" target="_blank" rel="noopener">Gains Network ↗</a> · execution is simulated in this phase.</span>}
      </p>
    </div>
  </div>
}
