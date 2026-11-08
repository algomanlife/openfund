import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { labels, number, text } from '../information/content'
import { backendUrl, useOpenfundSession } from '../../session/useOpenfundSession'
import { targetHref, useSiteLibrary } from '../../cms/siteContent'
import type { ReferralBenefit } from '../../cms/contentTypes'
import './referral.css'

type Locale = 'fa' | 'en'

const BENEFIT_GLYPHS: Record<ReferralBenefit['icon'], string> = {
  link: '⇗', chart: '▤', wallet: '▣', shield: '⌘', school: '◇', handshake: '⋈',
}

/* ---------------------------------------------------------------- dashboard -- */

interface ReferralSummary {
  code: string
  programState: string
  attributed: { count: number, referrals: Array<{ joinedAt: string, wallet: string, status: string }> }
  attributedTo: { code: string, at: string, referrer: string } | null
}

function CopyButton({ value, locale }: { value: string; locale: Locale }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1800) }
    if (navigator.clipboard?.writeText) void navigator.clipboard.writeText(value).then(done).catch(done)
    else {
      const area = document.createElement('textarea')
      area.value = value; document.body.appendChild(area); area.select()
      try { document.execCommand('copy'); done() } catch { /* older browsers */ }
      area.remove()
    }
  }, [value])
  return <button type="button" className="referral-copy" onClick={copy}>
    {copied ? text('Copied ✓', 'کپی شد ✓')[locale] : text('Copy', 'کپی')[locale]}
  </button>
}

function ReferralDashboard({ locale }: { locale: Locale }) {
  const { status, user } = useOpenfundSession()
  const [data, setData] = useState<ReferralSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (status !== 'authenticated') { setData(null); return }
    void fetch(`${backendUrl()}/referral/summary`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
      .then(json => { if (active) { setData(json); setError(null) } })
      .catch(() => { if (active) setError('load') })
    return () => { active = false }
  }, [status])

  if (status !== 'authenticated') return <div className="referral-dashboard gated">
    <h3>{text('Your referral dashboard', 'داشبورد معرفی تو')[locale]}</h3>
    <p>{text('Sign in with your wallet to see your invite code, your link and the accounts attributed to you.', 'با کیف پول وارد شو تا کد دعوت، لینکت و حساب‌های منسوب‌شده به تو را ببینی.')[locale]}</p>
    <p className="referral-dashboard-note">{text('Signing in does not purchase anything and does not join any program.', 'ورود به حساب هیچ خریدی انجام نمی‌دهد و عضویت هیچ برنامه‌ای هم نیست.')[locale]}</p>
  </div>

  const link = data ? `${window.location.origin}${import.meta.env.BASE_URL}${locale}/ref/${data.code}` : ''

  return <div className="referral-dashboard">
    <div className="referral-dashboard-head">
      <h3>{text('Your referral dashboard', 'داشبورد معرفی تو')[locale]}</h3>
      {user && <span className="referral-wallet" dir="ltr">{user.walletAddress.slice(0, 6)}…{user.walletAddress.slice(-4)}</span>}
    </div>

    {error && <p className="referral-error" role="alert">{text('The dashboard could not be loaded. Refresh in a moment.', 'داشبورد بارگیری نشد؛ چند لحظه بعد تازه‌سازی کن.')[locale]}</p>}
    {!data && !error && <p className="referral-loading">{text('Loading your code…', 'کدت بارگیری می‌شود…')[locale]}</p>}

    {data && <>
      <div className="referral-code-panel">
        <div className="referral-code-field">
          <span>{text('Your invite code', 'کد دعوت تو')[locale]}</span>
          <strong dir="ltr">{data.code}</strong>
          <CopyButton value={data.code} locale={locale} />
        </div>
        <div className="referral-code-field">
          <span>{text('Your shareable link', 'لینک قابل اشتراک تو')[locale]}</span>
          <strong dir="ltr" className="referral-link">{link}</strong>
          <CopyButton value={link} locale={locale} />
        </div>
      </div>

      <div className="referral-stats">
        <div className="referral-stat">
          <span>{text('Accounts attributed to you', 'حساب‌های منسوب‌شده به تو')[locale]}</span>
          <strong>{number(data.attributed.count, locale)}</strong>
          <small>{text('created through your code', 'ساخته‌شده با کد تو')[locale]}</small>
        </div>
        {data.attributedTo && <div className="referral-stat">
          <span>{text('Your account was referred by', 'حساب تو معرفی شده توسط')[locale]}</span>
          <strong dir="ltr">{data.attributedTo.code}</strong>
          <small dir="ltr">{data.attributedTo.referrer}</small>
        </div>}
      </div>

      {data.attributed.count > 0 && <div className="referral-table">
        <div className="info-table-wrap"><table>
          <thead><tr>
            <th scope="col">{text('Joined', 'زمان عضویت')[locale]}</th>
            <th scope="col">{text('Account', 'حساب')[locale]}</th>
            <th scope="col">{text('Status', 'وضعیت')[locale]}</th>
          </tr></thead>
          <tbody>
            {data.attributed.referrals.map((row, i) => <tr key={i}>
              <th scope="row" dir="ltr">{new Date(row.joinedAt).toISOString().slice(0, 10)}</th>
              <td dir="ltr">{row.wallet}</td>
              <td>{row.status}</td>
            </tr>)}
          </tbody>
        </table></div>
      </div>}

      {data.attributed.count === 0 && <p className="referral-dashboard-note">
        {text('No accounts yet. Share the link where you would naturally mention the product — not as spam.', 'هنوز حسابی نیست. لینک را همان‌جا به اشتراک بگذار که طبیعی است نام محصول را ببری — نه به‌شکل هرزنامه.')[locale]}
      </p>}

      <div className="referral-pending">
        <span className="eyebrow">{text('Not available yet', 'هنوز در دسترس نیست')[locale]}</span>
        <p>{text('Commission history, reward balance and payout history appear here only when the reward terms are approved and published — never before, and never as sample numbers.', 'تاریخچهٔ پورسانت، موجودی پاداش و تاریخچهٔ پرداخت فقط وقتی شرایط پاداش تصویب و منتشر شد این‌جا ظاهر می‌شوند — نه قبل از آن، و هرگز با عددهای نمونه.')[locale]}</p>
      </div>
    </>}
  </div>
}

/* ------------------------------------------------------------------- page -- */

export default function Referral() {
  const locale = useInformationLocale()
  const { library } = useSiteLibrary()
  const content = library.referral

  return <InformationShell page="referral" title={`${content.hero.title[locale]} | Openfund`} description={content.hero.intro[locale]}>
    <Hero locale={locale} page="referral"
      title={content.hero.title[locale]}
      accent={content.hero.accent[locale]}
      intro={content.hero.intro[locale]}>
      <div className="info-hero-meta">
        <span className="pill">{text('Pre-launch', 'پیش‌ازعرضه')[locale]}</span>
        <span>{text('Attribution live · rewards pending', 'انتساب فعال · پاداش در انتظار')[locale]}</span>
      </div>
      <div className="hero-actions">
        <a className="button" href="#referral-dashboard-anchor"><span>{content.cta.primary[locale]}</span> <span aria-hidden="true">↓</span></a>
        <Link className="text-link" to={`/${locale}/learn`}>{content.cta.secondary[locale]} <span aria-hidden="true">↗</span></Link>
      </div>
    </Hero>

    <div className="container referral-page">
      <aside className="info-notice">
        <span className="tiny-mark" aria-hidden="true">◇</span>
        <p>{content.statusNotice[locale]}</p>
      </aside>

      <section className="referral-benefits" aria-labelledby="referral-benefits">
        <h2 id="referral-benefits">{text('Why share at all', 'اصلاً چرا به اشتراک بگذاری')[locale]}</h2>
        <div className="referral-benefit-grid">
          {content.benefits.map((benefit, i) => <article key={i}>
            <i aria-hidden="true">{BENEFIT_GLYPHS[benefit.icon]}</i>
            <h3>{benefit.title[locale]}</h3>
            <p>{benefit.text[locale]}</p>
          </article>)}
        </div>
      </section>

      <section className="referral-stages" aria-labelledby="referral-stages">
        <h2 id="referral-stages">{text('How the journey works', 'مسیر چگونه پیش می‌رود')[locale]}</h2>
        <ol className="referral-stage-list">
          {content.stages.map((stage, i) => <li key={i}>
            <span className="referral-stage-number">{number(i + 1, locale, { minimumIntegerDigits: 2 })}</span>
            <b>{stage.title[locale]}</b>
            <p>{stage.text[locale]}</p>
          </li>)}
        </ol>
      </section>

      {content.sections.map(section => <section key={section.key} className="referral-section" id={`referral-${section.key}`}>
        <h2>{section.title[locale]}</h2>
        {section.body.map((paragraph, i) => <p key={i}>{paragraph[locale]}</p>)}
        {section.items && <ul className="lesson-list">
          {section.items.map((item, i) => <li key={i}>{item[locale]}</li>)}
        </ul>}
        {section.note && <div className="info-notice">
          <span className="tiny-mark" aria-hidden="true">◇</span>
          <p>{section.note[locale]}</p>
        </div>}
      </section>)}

      <section className="referral-dashboard-section" id="referral-dashboard-anchor" aria-labelledby="referral-dashboard">
        <h2 id="referral-dashboard">{content.dashboard.title[locale]}</h2>
        <p className="referral-dashboard-intro">{content.dashboard.intro[locale]}</p>
        <div className="referral-columns">
          {content.dashboard.columns.map((column, i) => <div key={i} className={column.state === 'live' ? 'live' : 'pending'}>
            <span className="pill">{column.state === 'live' ? text('Live', 'فعال')[locale] : text('Pending', 'در انتظار')[locale]}</span>
            <h3>{column.title[locale]}</h3>
            <p>{column.text[locale]}</p>
          </div>)}
        </div>
        <ReferralDashboard locale={locale} />
      </section>

      <section className="referral-faq" aria-labelledby="referral-faq">
        <h2 id="referral-faq">{text('Program questions', 'پرسش‌های برنامه')[locale]}</h2>
        <ul className="faq-list">
          {content.faq.map(item => <li key={item.key} className="faq-item">
            <h3><details><summary>{item.question[locale]}</summary>
              <p>{item.answer[locale]}</p>
            </details></h3>
          </li>)}
        </ul>
      </section>

      <section className="referral-pending-decisions" aria-labelledby="referral-pending">
        <h2 id="referral-pending">{text('What the owner still has to decide', 'چه تصمیم‌هایی هنوز با مالک است')[locale]}</h2>
        <p className="referral-pending-intro">{text('Nothing below is a term yet. Each item is a decision that must be made and published before any reward can exist.', 'هیچ‌کدام از موارد زیر هنوز «شرط» نیست. هر مورد یک تصمیم است که باید گرفته و منتشر شود تا پاداشی بتواند وجود داشته باشد.')[locale]}</p>
        <ol className="referral-decision-list">
          {content.pendingDecisions.map((decision, i) => <li key={i}>
            <b>{decision.title[locale]}</b>
            <p>{decision.text[locale]}</p>
          </li>)}
        </ol>
      </section>

      <div className="info-end">
        <p>{content.cta.title[locale]}</p>
        <p className="referral-cta-text">{content.cta.text[locale]}</p>
        <div className="hero-actions">
          <a className="button" href="#referral-dashboard-anchor">{content.cta.primary[locale]} <span aria-hidden="true">↓</span></a>
          <a className="text-link" href={targetHref({ kind: 'page', slug: 'learn' }, locale)}>{content.cta.secondary[locale]} <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </div>
  </InformationShell>
}
