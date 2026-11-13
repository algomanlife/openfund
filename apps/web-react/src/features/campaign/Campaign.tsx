import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import InformationShell from '../information/InformationShell'
import { publishedPlans, type ChallengePlan } from '../../data/challengePlans'
import { apiFetch } from '../../session/useOpenfundSession'
import { campaignUtm, checkoutHref, trackCampaign, type Utm } from './campaignTracking'
import './campaign.css'

/**
 * Sales-campaign landing — /fa/campaign (RTL) and /en/campaign (LTR) only.
 *
 * Content rules: only capabilities that exist in the product today, genuine
 * screenshots of the current build (public/assets/campaign, provenance in
 * docs/assets/screenshots/manifest.json), prices from the server catalog
 * (/purchases/plans — the same prices checkout charges) and rules from the
 * single plan catalog (src/data/challengePlans.ts). No guaranteed profit,
 * success rates or unsourced financial claims. Every purchase CTA opens the
 * one shared checkout (/:locale/checkout).
 */
type Lang = 'fa' | 'en'
interface CatalogPlan { slug: string, name: string, names?: { en: string | null, fa: string | null } | null, accountSizesUsd: number[], priceUsd: Record<string, number>, free: boolean }

const IMG = (file: string) => `${import.meta.env.BASE_URL}assets/campaign/${file}`

export default function Campaign() {
  const { locale: raw } = useParams()
  if (raw !== 'fa' && raw !== 'en') return <Navigate to="/en/campaign" replace />
  return <CampaignPage lang={raw} />
}

function CampaignPage({ lang }: { lang: Lang }) {
  const t = (fa: string, en: string) => (lang === 'fa' ? fa : en)
  const [params] = useSearchParams()
  const utm: Utm = useMemo(() => campaignUtm(params), [params])
  const checkout = (plan?: string, size?: number) => checkoutHref(lang, utm, plan, size)

  /* authoritative purchasable prices (null until loaded; never a guessed price) */
  const [catalog, setCatalog] = useState<CatalogPlan[] | null | 'error'>(null)
  useEffect(() => {
    let active = true
    void apiFetch('/purchases/plans').then(r => { if (active) setCatalog(r.ok ? (r.data?.plans || []).filter((p: CatalogPlan) => !p.free) : 'error') })
      .catch(() => { if (active) setCatalog('error') })
    return () => { active = false }
  }, [])
  useEffect(() => { trackCampaign('campaign_view', { locale: lang, ...utm }) }, [lang, utm])

  /* SEO: the shell sets title/description/og:title/og:description/og:url and
     seoHead.ts the canonical, fa/en hreflang alternates and og:locale; the
     campaign adds the share card (og:type, og:image, twitter:card) */
  useEffect(() => {
    const origin = window.location.origin
    const tags: HTMLElement[] = []
    const meta = (attr: 'property' | 'name', key: string, content: string) => { const m = document.createElement('meta'); m.setAttribute(attr, key); m.content = content; tags.push(m) }
    meta('property', 'og:type', 'website')
    meta('property', 'og:image', new URL(IMG(`terminal-${lang}.jpg`), origin).href)
    meta('name', 'twitter:card', 'summary_large_image')
    tags.forEach(tag => document.head.appendChild(tag))
    return () => tags.forEach(tag => tag.remove())
  }, [lang])

  const plans = publishedPlans().filter(p => !p.free)
  const cta = (where: string) => () => trackCampaign('campaign_cta', { locale: lang, cta: where, ...utm })

  return <InformationShell page="campaign"
    title={t('چالش‌های پراپ اوپن‌فاند | ترمینال معاملاتی و ارزیابی شفاف', 'Openfund Prop Challenges | Trading Terminal & Transparent Evaluation')}
    description={t('چالش پراپ اوپن‌فاند را با قوانین منتشرشده، ترمینال معاملاتی اختصاصی با چارت و ابزار مدیریت پوزیشن، و پرداخت رمزارزی با تأیید روی بلاک‌چین شروع کنید.',
      'Start an Openfund prop challenge with published rules, a dedicated trading terminal with charting and position tools, and crypto checkout verified on-chain.')}>
    <div className="cmp" dir={lang === 'fa' ? 'rtl' : 'ltr'} lang={lang}>

      {/* Hero */}
      <section className="cmp-hero container" aria-labelledby="cmp-title">
        <div className="cmp-hero-copy">
          <span className="eyebrow cmp-reveal">OPENFUND · PROP CHALLENGES</span>
          <h1 id="cmp-title" className="cmp-reveal">{t('مهارت معاملاتی‌ات را با قوانین روشن بسنج.', 'Prove your trading with rules you can read first.')}</h1>
          <p className="cmp-lead cmp-reveal">{t('اوپن‌فاند یک پلتفرم چالش پراپ است: ارزیابی در محیط معاملاتی شبیه‌سازی‌شده روی دادهٔ زندهٔ بازار، با ترمینال اختصاصی، قوانین منتشرشده و پرداختی که سرور روی بلاک‌چین تأیید می‌کند.',
            'Openfund is a prop-challenge platform: an evaluation in a simulated trading environment on live market data, with a dedicated terminal, published rules and a payment the server verifies on-chain.')}</p>
          <div className="cmp-actions cmp-reveal">
            <Link className="button" to={checkout()} onClick={cta('hero_checkout')} data-cta="campaign-hero-checkout">{t('مشاهده و خرید چالش', 'View & buy a challenge')}</Link>
            <a className="button button-secondary" href="#terminal" onClick={cta('hero_terminal')}>{t('آشنایی با ترمینال', 'Explore the terminal')}</a>
          </div>
          <p className="cmp-fine cmp-reveal">{t('حساب‌های چالش شبیه‌سازی‌شده‌اند. سود تضمین نمی‌شود و هزینهٔ ارزیابی بازگشت‌پذیر نیست.', 'Challenge accounts are simulated. Profits are not guaranteed and the evaluation fee is non-refundable.')}</p>
        </div>
        <figure className="cmp-hero-shot cmp-reveal">
          <img src={IMG(`terminal-${lang}.jpg`)} width="1440" height="823" fetchPriority="high"
            alt={t('ترمینال معاملاتی پراپ اوپن‌فاند با چارت، فرم سفارش و خلاصهٔ حساب', 'The Openfund prop trading terminal with chart, order ticket and account summary')} />
        </figure>
      </section>

      {/* Advantages — capabilities that exist today */}
      <section className="cmp-section container" aria-labelledby="cmp-why">
        <span className="eyebrow">01</span>
        <h2 id="cmp-why">{t('چرا اوپن‌فاند', 'Why Openfund')}</h2>
        <div className="cmp-grid">
          {[
            [t('ترمینال اختصاصی', 'A dedicated terminal'), t('چارت کامل با تایم‌فریم، استایل، اندیکاتور و ابزار ترسیم؛ فرم سفارش با اهرم، حد ضرر و حد سود؛ همه در یک صفحه.', 'A full chart with timeframes, styles, indicators and drawing tools, plus an order ticket with leverage, stop loss and take profit — on one screen.')],
            [t('دادهٔ زندهٔ بازار', 'Live market data'), t('قیمت‌ها از Gains Network می‌آیند: رمزارز، فارکس، سهام، شاخص و کالا.', 'Prices come from Gains Network: crypto, forex, stocks, indices and commodities.')],
            [t('قوانین پیش از شروع', 'Rules before you start'), t('هدف سود، حد ضرر روزانه، حد ضرر کل و حداقل روز معاملاتی هر مدل پیش از خرید منتشر شده است.', 'Each model’s profit target, daily loss limit, maximum loss and minimum trading days are published before you buy.')],
            [t('مدیریت پوزیشن روی چارت', 'Position tools on the chart'), t('نقطهٔ ورود، محدودهٔ سود و زیان و جابه‌جایی حد ضرر و حد سود مستقیم روی نمودار؛ هر تغییر را سرور تأیید می‌کند.', 'Entry, profit and loss zones, and dragging stop loss and take profit directly on the chart — every change is confirmed by the server.')],
            [t('پرداخت قابل راستی‌آزمایی', 'Verifiable payment'), t('پرداخت با DePay یا انتقال دستی؛ در هر دو حالت سرور تراکنش را روی بلاک‌چین بررسی می‌کند و بعد حساب را فعال می‌کند.', 'Pay with DePay or by manual transfer; either way the server checks the transaction on-chain before activating the account.')],
            [t('ورود بدون رمز', 'Password-free sign-in'), t('ورود با امضای کیف پول وب۳؛ بدون ایمیل و رمز عبور.', 'Sign in by signing with your Web3 wallet — no email or password.')],
          ].map(([h, p]) => <article key={h} className="cmp-card"><h3>{h}</h3><p>{p}</p></article>)}
        </div>
      </section>

      {/* Terminal */}
      <section id="terminal" className="cmp-section container" aria-labelledby="cmp-terminal">
        <span className="eyebrow">02</span>
        <h2 id="cmp-terminal">{t('ترمینال معاملاتی اوپن‌فاند', 'The Openfund trading terminal')}</h2>
        <p className="cmp-sub">{t('همان ترمینالی که حساب چالش شما در آن معامله می‌کند. تصاویر زیر از نسخهٔ فعلی محصول گرفته شده‌اند.', 'The same terminal your challenge account trades in. The images below are captured from the current product.')}</p>
        <div className="cmp-shots">
          <figure><img src={IMG(`chart-${lang}.jpg`)} width="1440" height="823" loading="lazy" alt={t('چارت با اندیکاتورها و ابزارهای تحلیل', 'Chart with indicators and analysis tools')} />
            <figcaption>{t('چارت و ابزار تحلیل: تایم‌فریم، استایل کندل، اندیکاتورها، ابزار ترسیم و فوت‌پرینت جریان سفارش.', 'Charting and analysis: timeframes, candle styles, indicators, drawing tools and the order-flow footprint.')}</figcaption></figure>
          <figure><img src={IMG(`ticket-${lang}.jpg`)} width="1440" height="823" loading="lazy" alt={t('فرم سفارش و جدول پوزیشن‌ها', 'Order ticket and positions table')} />
            <figcaption>{t('رابط معاملاتی و مدیریت پوزیشن: اندازهٔ پوزیشن بر حسب وثیقه، اندازهٔ نماد یا لاتیج، اهرم، حد ضرر و حد سود.', 'Trading and position management: size by collateral, symbol size or lotage, leverage, stop loss and take profit.')}</figcaption></figure>
        </div>
        <div className="cmp-actions"><Link className="button button-secondary" to={`/${lang}/prop/trade`} onClick={cta('terminal_open')}>{t('باز کردن ترمینال', 'Open the terminal')}</Link></div>
      </section>

      {/* Challenges */}
      <section id="challenges" className="cmp-section container" aria-labelledby="cmp-plans">
        <span className="eyebrow">03</span>
        <h2 id="cmp-plans">{t('چالش‌های پراپ', 'Prop challenges')}</h2>
        <p className="cmp-sub">{t('قیمت‌ها همان قیمت‌هایی است که صفحهٔ خرید از سرور می‌گیرد. جزئیات کامل در قوانین معاملاتی.', 'Prices are the ones checkout reads from the server. Full details are in the trading rules.')}</p>
        <div className="cmp-plans">
          {plans.map(p => <PlanCard key={p.slug} plan={p} lang={lang} catalog={catalog} checkout={checkout} onCta={cta(`plan_${p.slug}`)} />)}
        </div>
        {catalog === 'error' && <p className="cmp-fine" role="status">{t('قیمت‌ها اکنون در دسترس نیست؛ قیمت قطعی در صفحهٔ خرید نمایش داده می‌شود.', 'Prices are unavailable right now; the final price is shown in checkout.')}</p>}
      </section>

      {/* Steps */}
      <section className="cmp-section container" aria-labelledby="cmp-steps">
        <span className="eyebrow">04</span>
        <h2 id="cmp-steps">{t('مراحل شروع', 'How to start')}</h2>
        <ol className="cmp-steps">
          {[
            [t('انتخاب چالش', 'Choose a challenge'), t('مدل و اندازهٔ حساب را انتخاب کن.', 'Pick a model and an account size.')],
            [t('اتصال کیف پول', 'Connect your wallet'), t('با امضای یک پیام وارد اوپن‌فاند شو.', 'Sign in to Openfund by signing a message.')],
            [t('ایجاد سفارش', 'Create the order'), t('سرور قیمت نهایی را برای سفارش ثابت می‌کند.', 'The server fixes the final price for your order.')],
            [t('انتخاب روش پرداخت', 'Choose how to pay'), t('پرداخت با DePay یا پرداخت دستی به آدرس خزانه.', 'Pay with DePay or by manual transfer to the treasury.')],
            [t('دریافت حساب چالش', 'Receive your challenge account'), t('پس از تأیید تراکنش روی بلاک‌چین، حساب چالش و رسید صادر می‌شود.', 'After the transaction is verified on-chain, your challenge account and receipt are issued.')],
          ].map(([h, p], i) => <li key={h}><span aria-hidden="true">{lang === 'fa' ? (i + 1).toLocaleString('fa-IR') : i + 1}</span><div><h3>{h}</h3><p>{p}</p></div></li>)}
        </ol>
      </section>

      {/* Transparency */}
      <section className="cmp-section container cmp-transparency" aria-labelledby="cmp-trust">
        <span className="eyebrow">05</span>
        <h2 id="cmp-trust">{t('شفافیت', 'Transparency')}</h2>
        <p className="cmp-sub">{t('آدرس‌های خزانهٔ اوپن‌فاند و موجودی آن‌ها به تفکیک شبکه مستقیماً از بلاک‌چین خوانده و در صفحهٔ شفافیت منتشر می‌شود. موجودی خزانه به معنای سود، درآمد یا ذخیرهٔ تضمین‌شده نیست.',
          'Openfund’s treasury addresses and their balances per network are read directly from the blockchain and published on the transparency page. A treasury balance is not profit, revenue or a guaranteed reserve.')}</p>
        <div className="cmp-links">
          <Link className="cmp-link" to={`/${lang}/transparency`} onClick={cta('transparency')}>{t('صفحهٔ شفافیت و خزانه', 'Transparency & treasury')} <span aria-hidden="true">↗</span></Link>
          <Link className="cmp-link" to={`/${lang}/rulebook`} onClick={cta('rulebook')}>{t('قوانین چالش‌ها، ارزیابی و دریافت سود', 'Challenge rules, evaluation and payouts')} <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="cmp-section container" aria-labelledby="cmp-faq">
        <span className="eyebrow">06</span>
        <h2 id="cmp-faq">{t('پرسش‌های متداول', 'Frequently asked questions')}</h2>
        <div className="cmp-faq">
          {[
            [t('چطور شروع کنم؟', 'How do I start?'), t('چالش را انتخاب کن، کیف پول را وصل کن و وارد شو، سفارش بساز و یکی از دو روش پرداخت را انتخاب کن. پس از تأیید پرداخت، حساب چالش در داشبورد آماده است.', 'Choose a challenge, connect and sign in with your wallet, create the order and pick one of the two payment methods. Once the payment is verified, the challenge account is ready in your dashboard.')],
            [t('حساب چالش واقعی است؟', 'Is the challenge account real money?'), t('خیر. ارزیابی در محیط معاملاتی شبیه‌سازی‌شده با دادهٔ زندهٔ بازار انجام می‌شود و قوانین هر مدل در صفحهٔ قوانین آمده است.', 'No. The evaluation runs in a simulated trading environment on live market data; each model’s rules are on the rules page.')],
            [t('با چه چیزی می‌توانم پرداخت کنم؟', 'How can I pay?'), t('با DePay (هر کیف پول، شبکه و توکنی که DePay برای پرداخت پیشنهاد دهد) یا با انتقال دستی توکن تسویه به آدرس خزانهٔ اوپن‌فاند و ثبت شناسهٔ تراکنش.', 'With DePay (any wallet, network and token DePay offers) or by a manual transfer of the settlement token to the Openfund treasury and submitting the transaction ID.')],
            [t('پرداخت دستی چطور تأیید می‌شود؟', 'How is a manual payment verified?'), t('شناسهٔ تراکنش به‌تنهایی کافی نیست؛ سرور شبکه، توکن، گیرنده، مبلغ و تعداد تأییدها را روی بلاک‌چین بررسی می‌کند و هر تراکنش فقط یک‌بار قابل استفاده است.', 'A transaction ID alone is not enough: the server checks the network, token, receiver, amount and confirmations on-chain, and each transaction can be used only once.')],
            [t('قوانین ارزیابی و دریافت سود کجاست؟', 'Where are the evaluation and payout rules?'), t('در صفحهٔ قوانین معاملاتی؛ همان قوانینی که موتور ارزیابی اعمال می‌کند.', 'On the trading rules page — the same rules the evaluation engine applies.')],
            [t('پشتیبانی', 'Support'), t('اگر پرداخت یا فعال‌سازی مشکلی داشت، شمارهٔ سفارش را نگه دار؛ صفحهٔ خرید وضعیت سفارش را از سرور نشان می‌دهد و پرداخت از دست نمی‌رود.', 'If a payment or activation has an issue, keep your order ID; the checkout shows the order status from the server and the payment is not lost.')],
          ].map(([q, a]) => <details key={q} className="cmp-qa"><summary>{q}</summary><p>{a}</p></details>)}
        </div>
        <p className="cmp-fine"><Link className="text-link" to={`/${lang}/faq`}>{t('همهٔ پرسش‌ها', 'All questions')} ↗</Link></p>
      </section>

      {/* Final CTA */}
      <section className="cmp-final container" aria-labelledby="cmp-final">
        <img src={`${import.meta.env.BASE_URL}assets/mark-mint.svg`} width="38" height="42" alt="" />
        <h2 id="cmp-final">{t('آماده‌ای؟ چالشت را انتخاب کن.', 'Ready? Choose your challenge.')}</h2>
        <Link className="button" to={checkout()} onClick={cta('final_checkout')} data-cta="campaign-final-checkout">{t('مشاهده و خرید چالش', 'View & buy a challenge')}</Link>
      </section>
    </div>
  </InformationShell>
}

function PlanCard({ plan: p, lang, catalog, checkout, onCta }: {
  plan: ChallengePlan, lang: Lang, catalog: CatalogPlan[] | null | 'error', checkout: (plan?: string, size?: number) => string, onCta: () => void
}) {
  const t = (fa: string, en: string) => (lang === 'fa' ? fa : en)
  const num = (v: number) => v.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US')
  const money = (v: number) => (lang === 'fa' ? `${num(v)} دلار` : `$${num(v)}`)
  const pct = (v: number) => (lang === 'fa' ? `${num(v)}٪` : `${v}%`)
  const server = Array.isArray(catalog) ? catalog.find(c => c.slug === p.slug) : null
  const prices = server ? server.accountSizesUsd.map(s => Number(server.priceUsd[String(s)])).filter(Number.isFinite) : []
  const from = prices.length ? Math.min(...prices) : null
  const purchasable = !!server
  const rules: Array<[string, string]> = [
    [t('مراحل', 'Phases'), p.phases === 0 ? t('بدون ارزیابی', 'No evaluation') : num(p.phases)],
    [t('هدف سود', 'Profit target'), [p.phase1TargetPct, p.phase2TargetPct].filter((x): x is number => x != null).map(pct).join(' / ') || '—'],
    [t('حد ضرر روزانه', 'Daily loss limit'), pct(p.dailyLossPct)],
    [t('حداکثر ضرر', 'Maximum loss'), pct(p.maxTotalLossPct)],
    [t('سهم معامله‌گر', 'Trader share'), pct(p.profitSplitPct)],
  ]
  return <article className="cmp-plan">
    <h3>{p.name[lang]}</h3>
    <p className="cmp-plan-tag">{p.tagline[lang]}</p>
    <p className="cmp-plan-price">{from != null ? <>{t('از', 'From')} <b dir="ltr">{money(from)}</b></> : catalog === null ? '…' : t('قیمت در صفحهٔ خرید', 'Price in checkout')}</p>
    <dl>{rules.map(([k, v]) => <div key={k}><dt>{k}</dt><dd><bdi>{v}</bdi></dd></div>)}</dl>
    {purchasable || catalog === null
      ? <Link className="button" to={checkout(p.slug, server?.accountSizesUsd[0])} onClick={onCta}>{t('خرید این چالش', 'Buy this challenge')}</Link>
      : <Link className="button button-secondary" to={`/${lang}/rulebook`}>{t('مشاهدهٔ قوانین', 'View the rules')}</Link>}
  </article>
}
