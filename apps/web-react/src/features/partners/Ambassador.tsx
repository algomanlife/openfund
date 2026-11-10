import { Link } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { labels, text as t, type Locale } from '../information/content'
import { Bars, Field, Kpi, StateBlock, Status, int, usd, when, useRemote } from '../economy/ui'
import { ApplicationForm, ApplicationStatus, usePartners } from './shared'
import { CoachProgram } from './Coach'
import EconomyNav from '../economy/EconomyNav'

const ibIntro = t('One place for Openfund’s two partner roles: Brand Ambassadors who introduce customers, and Verified Trading Coaches who mentor traders toward live market access. Each role is applied for, reviewed and paid independently.', 'یک صفحه برای دو نقش همکاری اوپن‌فاند: سفیران برند که مشتری معرفی می‌کنند و کوچ‌های معاملاتی تأییدشده که معامله‌گران را تا اتصال به بازار واقعی همراهی می‌کنند. درخواست، بررسی و پرداخت هر نقش مستقل است.')
const ambassadorIntro = t('A reviewed partnership for creators who teach financial markets to a real audience. Approved ambassadors earn 10% of each referred customer’s first confirmed purchase.', 'همکاری‌ای بررسی‌شده برای تولیدکنندگان محتوای بازارهای مالی با مخاطب واقعی. سفیران تأییدشده ۱۰٪ اولین خرید تأییدشدهٔ هر مشتری معرفی‌شده را دریافت می‌کنند.')

interface Dashboard {
  status: string; code: string; linkPath: string; commissionRate: string
  traffic: { uniqueVisitorDays: number; last30Days: number; series: { day: string; visits: number }[] }
  referredSignups: number; confirmedFirstPurchases: number; eligibleRevenueUsd: string
  earnedUsd: string; reversedUsd: string; paidUsd: string; pendingSettlementUsd: string
  history: { id: string; type: string; baseUsd: string | null; amountUsd: string; payoutReference: string | null; campaign: string | null; at: string }[]
  campaigns: { campaign: string; visits: number; purchases: number; earnedUsd: string }[]
}

function AmbassadorDashboard({ locale }: { locale: Locale }) {
  const [d] = useRemote<Dashboard>('/ambassador/dashboard')
  if (d.status !== 'ready') return <StateBlock state={d} locale={locale} />
  const x = d.data
  const link = `${window.location.origin}/${locale}${x.linkPath}`
  return <>
    <div className="econ-panel"><div className="section-top"><h3>{t('Your referral link', 'لینک معرفی تو')[locale]}</h3><Status kind={x.status === 'active' ? 'ok' : 'warn'}>{x.status}</Status></div>
      <div className="econ-list"><div><span>{t('Code', 'کد')[locale]}</span><span className="econ-address" dir="ltr">{x.code}</span></div><div><span>{t('Link', 'لینک')[locale]}</span><span className="econ-address" dir="ltr">{link}</span></div><div><span>{t('Campaign tag', 'برچسب کمپین')[locale]}</span><span className="econ-address" dir="ltr">{link}?c=&lt;campaign&gt;</span></div></div>
      {x.status !== 'active' && <p className="econ-msg error">{t('Your ambassador status is suspended: new referrals do not earn commission.', 'وضعیت سفیر تو معلق است: معرفی‌های جدید کمیسیون ایجاد نمی‌کنند.')[locale]}</p>}
    </div>
    <div className="econ-grid" style={{ marginTop: 16 }}>
      <Kpi label={t('Referral traffic (unique visitor-days)', 'ترافیک معرفی (بازدیدکنندهٔ یکتا در روز)')[locale]} value={int(x.traffic.uniqueVisitorDays, locale)} note={`${int(x.traffic.last30Days, locale)} ${t('in the last 30 days', 'در ۳۰ روز اخیر')[locale]}`} />
      <Kpi label={t('Confirmed first purchases', 'اولین خریدهای تأییدشده')[locale]} value={int(x.confirmedFirstPurchases, locale)} note={`${int(x.referredSignups, locale)} ${t('attributed accounts', 'حساب منسوب')[locale]}`} />
      <Kpi label={t('Eligible revenue', 'درآمد مشمول')[locale]} value={usd(x.eligibleRevenueUsd, locale)} />
      <Kpi label={t('Earned commissions', 'کمیسیون کسب‌شده')[locale]} value={usd(x.earnedUsd, locale)} tone="good" note={`${t('Reversed', 'برگشتی')[locale]} ${usd(x.reversedUsd, locale)}`} />
      <Kpi label={t('Paid commissions', 'کمیسیون پرداخت‌شده')[locale]} value={usd(x.paidUsd, locale)} />
      <Kpi label={t('Pending settlement', 'در انتظار تسویه')[locale]} value={usd(x.pendingSettlementUsd, locale)} tone="warn" />
    </div>
    <div className="econ-grid two" style={{ marginTop: 16 }}>
      <div className="econ-panel"><h3>{t('Traffic, last 30 days', 'ترافیک ۳۰ روز اخیر')[locale]}</h3><Bars locale={locale} label={t('Unique visitor-days', 'بازدیدکنندهٔ یکتا در روز')[locale]} points={x.traffic.series.map(p => ({ key: String(p.day).slice(0, 10), value: p.visits }))} format={v => int(v, locale)} /></div>
      <div className="econ-panel"><h3>{t('Campaign performance', 'عملکرد کمپین‌ها')[locale]}</h3>{x.campaigns.length ? <div className="econ-list">{x.campaigns.map(c => <div key={c.campaign}><span dir="ltr">{c.campaign}</span><span>{int(c.visits, locale)} · {int(c.purchases, locale)} · {usd(c.earnedUsd, locale)}</span></div>)}</div> : <p className="econ-empty">{t('No campaign activity yet.', 'هنوز فعالیتی برای کمپین ثبت نشده است.')[locale]}</p>}</div>
    </div>
    <div className="econ-panel"><h3>{t('Commission ledger', 'دفتر کمیسیون')[locale]}</h3>
      {x.history.length ? <div className="info-table-wrap"><table><thead><tr>{[t('Date', 'تاریخ'), t('Entry', 'نوع'), t('Base', 'مبنا'), t('Amount', 'مبلغ'), t('Reference', 'مرجع')].map((h, i) => <th key={i} scope="col">{h[locale]}</th>)}</tr></thead><tbody>{x.history.map(h => <tr key={h.id}><td>{when(h.at, locale)}</td><td>{h.type}</td><td>{usd(h.baseUsd, locale)}</td><td>{usd(h.amountUsd, locale)}</td><td dir="ltr" style={{ overflowWrap: 'anywhere' }}>{h.payoutReference || h.campaign || '—'}</td></tr>)}</tbody></table></div>
        : <p className="econ-empty">{t('No commission has been recognized yet. Entries appear the moment a referred customer’s first payment is confirmed.', 'هنوز کمیسیونی شناسایی نشده است؛ ردیف‌ها همان لحظهٔ تأیید اولین پرداخت مشتری معرفی‌شده ظاهر می‌شوند.')[locale]}</p>}
      <p className="econ-source">{t('Recognition (ledger entry at confirmed payment) is separate from settlement (transfer recorded with a reference).', 'شناسایی (ثبت در دفتر هنگام تأیید پرداخت) از تسویه (انتقال ثبت‌شده با مرجع) جداست.')[locale]}</p>
    </div>
  </>
}

/** Brand Ambassador program — its own application, approval, attribution
 *  and commission (server: partners.js). Rendered inside the consolidated
 *  Ambassador (IB) page; it never shares state or rules with the coach role. */
export function AmbassadorProgram({ locale }: { locale: Locale }) {
  const [me, reload] = usePartners()
  const data = me?.status === 'ready' ? me.data : null
  const app = data?.applications.ambassador || null
  const canApply = !app || app.status === 'rejected'
  return <>
      <p className="econ-msg">{ambassadorIntro[locale]}</p>

      <section className="econ-section" id="ambassador-eligibility"><div className="section-top"><div><span className="eyebrow">01 / {t('ELIGIBILITY', 'شرایط')[locale]}</span><h2>{t('Real audience, reviewed by people.', 'مخاطب واقعی، بررسی‌شده توسط انسان.')[locale]}</h2></div><Status kind="info">{t('Applying is not approval', 'ثبت درخواست به معنای پذیرش نیست')[locale]}</Status></div>
        <ul className="econ-check-list econ-panel">{[
          t('At least 50,000 followers on Instagram OR YouTube (one platform is enough)', 'حداقل ۵۰٬۰۰۰ دنبال‌کننده در اینستاگرام یا یوتیوب (یک پلتفرم کافی است)'),
          t('Genuine activity on a second platform', 'فعالیت واقعی در پلتفرم دوم'),
          t('Content about financial markets, of acceptable quality', 'محتوای مرتبط با بازارهای مالی با کیفیت قابل قبول'),
          t('Active, credible presence with a real audience and no serious signs of engagement fraud', 'حضور فعال و معتبر با مخاطب واقعی و بدون شواهد جدی تقلب در تعاملات'),
          t('Acceptance of the Openfund partnership terms', 'پذیرش شرایط همکاری اوپن‌فاند'),
        ].map((x, i) => <li key={i}>{x[locale]}</li>)}</ul>
        <p className="econ-source">{t('Follower counts you enter are recorded as claims. Only counts confirmed by an Openfund reviewer with evidence are treated as verified.', 'تعداد دنبال‌کنندگانی که وارد می‌کنی به‌عنوان ادعا ثبت می‌شود؛ فقط اعدادی که بازبین اوپن‌فاند با مدرک تأیید کند «تأییدشده» محسوب می‌شوند.')[locale]}</p>
      </section>
      <section className="econ-section" id="ambassador-policy"><div className="section-top"><div><span className="eyebrow">02 / {t('REFERRAL POLICY', 'سیاست معرفی')[locale]}</span><h2>{t('10% of the first purchase.', '۱۰٪ اولین خرید.')[locale]}</h2></div></div>
        <div className="econ-grid three">
          <Kpi label="Commission Rate" value="10%" note={t('Of the confirmed net purchase amount after discounts', 'از مبلغ خالص تأییدشدهٔ خرید پس از تخفیف')[locale]} />
          <Kpi label="Scope" value={t('First eligible purchase', 'اولین خرید واجد شرایط')[locale]} note={t('Later purchases by the same customer create no commission', 'خریدهای بعدی همان مشتری کمیسیون ندارد')[locale]} />
          <Kpi label="Recognition" value={t('At confirmed payment', 'هنگام تأیید پرداخت')[locale]} note={t('Recorded once, in the same transaction as the payment', 'یک‌بار و در همان تراکنش پرداخت ثبت می‌شود')[locale]} />
        </div>
        <p className="econ-source">{t('Duplicate callbacks or reprocessing never create a second commission. Refunds and chargebacks append an auditable reversal; history is never deleted. Commission transfer to your wallet is recorded separately.', 'Callback تکراری یا پردازش دوباره هرگز کمیسیون دوم ایجاد نمی‌کند. بازپرداخت و برگشت وجه، ردیف اصلاحی قابل حسابرسی اضافه می‌کند و تاریخچه حذف نمی‌شود. انتقال کمیسیون به کیف پول تو جداگانه ثبت می‌شود.')[locale]}</p>
      </section>
      <section className="econ-section" id="ambassador-apply"><div className="section-top"><div><span className="eyebrow">03 / {t('APPLICATION', 'درخواست')[locale]}</span><h2>{data?.ambassador ? t('Your ambassador dashboard.', 'داشبورد سفیر تو.')[locale] : t('Apply to the program.', 'برای برنامه درخواست بده.')[locale]}</h2></div></div>
        {me && me.status !== 'ready' && <StateBlock state={me} locale={locale} />}
        {data?.ambassador ? <AmbassadorDashboard locale={locale} /> : <>
          <ApplicationStatus app={app} locale={locale} />
          {(canApply || !me) && <ApplicationForm role="ambassador" locale={locale} onDone={reload} collect={f => ({
            instagramUrl: f.get('instagramUrl') || null, youtubeUrl: f.get('youtubeUrl') || null,
            instagramFollowers: f.get('instagramFollowers') ? Number(f.get('instagramFollowers')) : null, youtubeSubscribers: f.get('youtubeSubscribers') ? Number(f.get('youtubeSubscribers')) : null,
            audienceLocation: f.get('audienceLocation'), contentCategory: f.get('contentCategory'), marketingExperience: f.get('marketingExperience'), promotionStrategy: f.get('promotionStrategy'), notes: f.get('notes') || null,
          })}>
            <Field label="Instagram URL"><input name="instagramUrl" type="url" placeholder="https://instagram.com/…" dir="ltr" /></Field>
            <Field label={t('Instagram followers (claimed)', 'دنبال‌کنندگان اینستاگرام (اظهاری)')[locale]}><input name="instagramFollowers" type="number" min="0" step="1" /></Field>
            <Field label="YouTube URL"><input name="youtubeUrl" type="url" placeholder="https://youtube.com/@…" dir="ltr" /></Field>
            <Field label={t('YouTube subscribers (claimed)', 'مشترکان یوتیوب (اظهاری)')[locale]}><input name="youtubeSubscribers" type="number" min="0" step="1" /></Field>
            <Field label={`${t('Primary audience location', 'موقعیت اصلی مخاطبان')[locale]} *`}><input name="audienceLocation" required maxLength={120} /></Field>
            <Field label={`${t('Content category', 'دستهٔ محتوا')[locale]} *`}><input name="contentCategory" required maxLength={120} /></Field>
            <div className="wide"><Field label={`${t('Marketing experience', 'تجربهٔ بازاریابی')[locale]} *`}><textarea name="marketingExperience" required maxLength={2000} /></Field></div>
            <div className="wide"><Field label={`${t('Proposed promotion strategy', 'راهبرد پیشنهادی تبلیغ')[locale]} *`}><textarea name="promotionStrategy" required maxLength={3000} /></Field></div>
            <div className="wide"><Field label={t('Additional notes', 'توضیحات بیشتر')[locale]}><textarea name="notes" maxLength={2000} /></Field></div>
          </ApplicationForm>}
        </>}
      </section>
  </>
}

/** Consolidated Ambassador (IB) page — Economy › Ambassador (IB). Two
 *  independent roles on one page: Brand Ambassador and Verified Trading
 *  Coach, each with its own application, approval status, dashboard,
 *  referral / trader links, commission history, settlements and rules. */
export default function Ambassador() {
  const locale = useInformationLocale()
  return <InformationShell page="ambassador" description={ibIntro[locale]}>
    <Hero locale={locale} page="ambassador" title="Openfund" accent={labels.ambassador[locale]} intro={ibIntro[locale]}>
      <div className="hero-actions"><a className="button" href="#brand-ambassador">{labels.brandAmbassador[locale]} <span aria-hidden="true">↓</span></a><a className="button" href="#verified-coach">{labels.coach[locale]} <span aria-hidden="true">↓</span></a></div>
    </Hero>
    <div className="container">
      <EconomyNav locale={locale} current="ambassador" />
      <section className="econ-section" id="programs"><div className="section-top"><div><span className="eyebrow">{t('TWO INDEPENDENT ROLES', 'دو نقش مستقل')[locale]}</span><h2>{t('Separate applications, approvals and rules.', 'درخواست، تأیید و قوانین جداگانه.')[locale]}</h2></div></div>
        <div className="econ-grid two">
          <Kpi label={labels.brandAmbassador[locale]} value="10%" note={t('Of the referred customer’s first eligible confirmed purchase only', 'فقط از اولین خرید تأییدشدهٔ واجد شرایط مشتری معرفی‌شده')[locale]} />
          <Kpi label={labels.coach[locale]} value="10%" note={t('Of distributable realized net profit from eligible live trades, after costs', 'از سود خالص تحقق‌یافتهٔ قابل‌توزیع معاملات واقعی واجد شرایط، پس از کسر هزینه‌ها')[locale]} />
        </div>
        <p className="econ-source">{t('Approving one role never grants the other. Trader and firm profit-sharing tiers beyond the coach share are pending business decisions and are not offered here.', 'تأیید یک نقش هرگز نقش دیگر را اعطا نمی‌کند. سطوح تقسیم سود معامله‌گر و شرکت فراتر از سهم کوچ تصمیم تجاری در انتظار تأیید است و اینجا ارائه نمی‌شود.')[locale]}</p>
      </section>
      <div id="brand-ambassador" className="econ-program"><h2 className="econ-program-title">{labels.brandAmbassador[locale]}</h2><AmbassadorProgram locale={locale} /></div>
      <div id="verified-coach" className="econ-program"><h2 className="econ-program-title">{labels.coach[locale]}</h2><CoachProgram locale={locale} /></div>
      <div className="info-end"><img src={`${import.meta.env.BASE_URL}assets/mark-mint.svg`} width="38" height="42" alt="" /><p>{t('Live capital follows verified skill.', 'سرمایهٔ واقعی به‌دنبال مهارت تأییدشده است.')[locale]}</p><Link className="button" to={`/${locale}/live-market-access`}>{labels['live-market-access'][locale]} <span aria-hidden="true">↗</span></Link></div>
    </div>
  </InformationShell>
}
