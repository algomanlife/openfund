import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { labels, text as t, type Locale } from '../information/content'
import { apiFetch } from '../../session/useOpenfundSession'
import EconomyNav from './EconomyNav'
import { Field, Kpi, usd } from './ui'
import { SIZES, runScenario, type Inputs } from './scenario'

const intro = t('How Openfund earns, what it owes, what it keeps in reserve and how free capital may reach live markets — with the difference between simulated and real trading made explicit.', 'اوپن‌فاند چگونه درآمد کسب می‌کند، چه تعهداتی دارد، چه مقدار ذخیره نگه می‌دارد و سرمایهٔ آزاد چگونه می‌تواند به بازار واقعی برسد؛ با تفکیک صریح معاملات شبیه‌سازی‌شده و واقعی.')

const FLOW = [
  [t('Challenge purchase', 'خرید چلنج'), t('A customer buys an evaluation at a server-set catalog price.', 'مشتری ارزیابی را با قیمت تعیین‌شده در سرور می‌خرد.')],
  [t('Wallet payment', 'پرداخت با کیف پول'), t('The backend verifies the on-chain payment before anything is provisioned.', 'بک‌اند پیش از ایجاد حساب، پرداخت آن‌چین را تأیید می‌کند.')],
  [t('Evaluation', 'ارزیابی'), t('The trader trades a simulated account under the published rule version.', 'معامله‌گر روی حساب شبیه‌سازی‌شده و طبق نسخهٔ منتشرشدهٔ قوانین معامله می‌کند.')],
  [t('Pass or fail', 'قبولی یا مردودی'), t('The evaluation engine decides from closed results and loss limits.', 'موتور ارزیابی بر اساس نتایج بسته‌شده و حدود زیان تصمیم می‌گیرد.')],
  [t('Funded simulation', 'حساب فاندد شبیه‌سازی‌شده'), t('Qualified traders continue on a simulated account that can earn rewards.', 'معامله‌گران واجد شرایط روی حساب شبیه‌سازی‌شدهٔ دارای پاداش ادامه می‌دهند.')],
  [t('Rewards', 'پاداش'), t('Withdrawals are reviewed, approved and transferred; each step is recorded separately.', 'برداشت‌ها بررسی، تأیید و منتقل می‌شوند و هر گام جداگانه ثبت می‌شود.')],
  [t('Obligations & reserves', 'تعهدات و ذخایر'), t('Revenue first covers rewards owed, commissions, expenses and management-set reserves.', 'درآمد ابتدا پاداش‌های بدهکار، کمیسیون‌ها، هزینه‌ها و ذخایر تعیین‌شده توسط مدیریت را پوشش می‌دهد.')],
  [t('Live Market Access', 'اتصال به بازار'), t('Only verified free capital above $500,000 may be allocated to selected traders on real markets.', 'فقط سرمایهٔ آزاد تأییدشدهٔ بالای ۵۰۰٬۰۰۰ دلار می‌تواند به معامله‌گران منتخب در بازار واقعی تخصیص یابد.')],
] as const

const TERMS = [
  ['Simulated Trading', t('Orders fill against server marks inside Openfund. No position exists on any exchange and no market risk is taken by anyone.', 'سفارش‌ها با قیمت مرجع سرور داخل اوپن‌فاند اجرا می‌شوند؛ هیچ پوزیشنی روی صرافی وجود ندارد و ریسک بازاری متوجه کسی نیست.')],
  ['Evaluation Accounts', t('Simulated accounts used to measure a trader against published targets and loss limits.', 'حساب‌های شبیه‌سازی‌شده برای سنجش معامله‌گر در برابر اهداف و حدود زیان منتشرشده.')],
  ['Simulated Funded Accounts', t('Still simulated. Rewards are paid by Openfund from its own funds according to the rules — not from market profits.', 'همچنان شبیه‌سازی‌شده‌اند. پاداش را اوپن‌فاند طبق قوانین از منابع خود می‌پردازد، نه از سود بازار.')],
  ['Real Market Execution', t('Orders placed with Openfund-owned capital on a real venue (Gains Network). Only in Live Market Access, only after approvals and only when enabled.', 'سفارش با سرمایهٔ متعلق به اوپن‌فاند در بازار واقعی (Gains Network)؛ فقط در اتصال به بازار، پس از تأییدها و تنها در صورت فعال‌سازی.')],
  ['Realized Trading PnL', t('Profit or loss of a closed real position, verified from the venue, before costs.', 'سود یا زیان پوزیشن واقعی بسته‌شده، تأییدشده از بازار، پیش از هزینه‌ها.')],
  ['Trader Reward', t('A payment to a trader: simulated-account rewards, or the trader share of distributable live profit.', 'پرداخت به معامله‌گر: پاداش حساب شبیه‌سازی‌شده یا سهم او از سود قابل‌توزیع واقعی.')],
  ['Company Revenue', t('Confirmed challenge sales minus refunds and chargebacks, plus the Openfund share of live profit.', 'فروش تأییدشدهٔ چلنج منهای بازپرداخت و برگشتی، به‌علاوهٔ سهم اوپن‌فاند از سود واقعی.')],
  ['Available Capital', t('Treasury balance minus every obligation, reserve and existing allocation. Unknown whenever any input is missing.', 'موجودی خزانه منهای همهٔ تعهدات، ذخایر و تخصیص‌های موجود؛ در صورت نبود هر ورودی، نامعلوم.')],
] as const

/* Research: each entry names its publisher, scope and the exact metric definition. */
const SOURCES = [
  { name: 'Topstep — Risk Disclosure (2025 performance statistics, Jan–Dec 2025)', url: 'https://www.topstep.com/risk-disclosure', note: t('Firm-published, not independently audited. 16.8% of Trading Combines started were completed and advanced to the Funded level; 51.8% of individual participants advanced in at least one Combine; 33.3% of Funded-level participants received a payout; 0.71% of Express Funded traders were moved to a Live Funded Account. Futures, one firm; mixes simulated and live stages.', 'منتشرشده توسط خود شرکت، بدون حسابرسی مستقل. ۱۶٫۸٪ از Combineهای آغازشده به سطح فاندد رسیدند؛ ۵۱٫۸٪ از افراد دست‌کم در یک Combine موفق شدند؛ ۳۳٫۳٪ از شرکت‌کنندگان سطح فاندد پرداخت دریافت کردند؛ ۰٫۷۱٪ از معامله‌گران Express Funded به حساب واقعی منتقل شدند. فقط فیوچرز و یک شرکت.') },
  { name: 'Finance Magnates — “Only 7% of 300,000 Prop Trading Accounts Achieved Payouts” (2024, FPFX Tech data)', url: 'https://www.financemagnates.com/forex/analysis/exclusive-only-7-of-300000-prop-trading-accounts-achieved-payouts/', note: t('Aggregate of firms using one technology provider. Reported share of accounts that achieved a payout ≈ 7%; average payout ≈ 4% of plan size. Measures accounts, not unique traders, and is not an industry-wide census.', 'مجموع شرکت‌های مشتری یک ارائه‌دهندهٔ فناوری. سهم حساب‌های دارای پرداخت حدود ۷٪ و میانگین پرداخت حدود ۴٪ اندازهٔ حساب گزارش شده است. واحد سنجش حساب است، نه معامله‌گر یکتا؛ سرشماری کل صنعت نیست.') },
  { name: 'FTMO — company statements as reported by CoinLaw (accessed Nov 2026)', url: 'https://coinlaw.io/ftmo-statistics/', note: t('FTMO publishes cumulative rewards paid (company claim, > $650M) but no pass rate. Any FTMO pass-rate figure seen online is a third-party estimate.', 'FTMO مجموع پاداش‌های پرداخت‌شده را (ادعای شرکت، بیش از ۶۵۰ میلیون دلار) منتشر می‌کند اما نرخ قبولی منتشر نمی‌کند؛ هر نرخ قبولی منتسب به FTMO برآورد اشخاص ثالث است.') },
  { name: t('Payout-to-revenue ratios (secondary estimates)', 'نسبت پرداخت به درآمد (برآوردهای ثانویه)').en, url: 'https://alexfirdaus.com/perp-prop-firm-economics/', note: t('Published estimates range widely (e.g. one firm’s monthly books at 65–82%; other estimates of 35–55% for a large firm). No audited industry average exists; Openfund therefore shows this ratio only from its own records on the Transparency page.', 'برآوردهای منتشرشده بسیار پراکنده‌اند (مثلاً دفاتر ماهانهٔ یک شرکت ۶۵ تا ۸۲٪ و برآوردهای دیگر ۳۵ تا ۵۵٪ برای یک شرکت بزرگ). میانگین حسابرسی‌شده‌ای برای صنعت وجود ندارد؛ از این رو اوپن‌فاند این نسبت را فقط از سوابق خود در صفحهٔ شفافیت نشان می‌دهد.') },
]

function Scenario({ locale }: { locale: Locale }) {
  const [inputs, setInputs] = useState<Inputs>({ challengesSold: 1000, mix: { 10000: 40, 25000: 30, 50000: 20, 100000: 10 }, prices: { 10000: 0, 25000: 0, 50000: 0, 100000: 0 },
    passRatePct: 10, firstPayoutRatePct: 33, avgTotalPayoutUsd: 1000, ambassadorSharePct: 20, operatingCostsUsd: 20000, reservePct: 25, refundRatePct: 2 })
  const [priceSource, setPriceSource] = useState<'catalog' | 'manual' | 'loading'>('loading')
  useEffect(() => {
    void apiFetch('/purchases/plans').then(r => {
      const plan = (r.data?.plans || []).find((p: { slug: string }) => p.slug === 'standard')
      if (plan?.priceUsd) { setInputs(v => ({ ...v, prices: Object.fromEntries(SIZES.map(k => [k, Number(plan.priceUsd[k]) || 0])) })); setPriceSource('catalog') } else setPriceSource('manual')
    }).catch(() => setPriceSource('manual'))
  }, [])
  const out = useMemo(() => runScenario(inputs), [inputs])
  const num = (key: keyof Inputs) => ({ type: 'number', min: 0, step: 'any', value: String(inputs[key]), onChange: (e: { target: { value: string } }) => setInputs(v => ({ ...v, [key]: Math.max(0, Number(e.target.value) || 0) })) })
  const nested = (group: 'mix' | 'prices', k: string) => ({ type: 'number', min: 0, step: 'any', value: String(inputs[group][k]), onChange: (e: { target: { value: string } }) => { setInputs(v => ({ ...v, [group]: { ...v[group], [k]: Math.max(0, Number(e.target.value) || 0) } })); if (group === 'prices') setPriceSource('manual') } })
  return <div className="econ-calc">
    <div className="econ-panel">
      <div className="econ-banner" role="note">{t('SCENARIO ONLY. Every input is hypothetical and editable. Results are not company figures, not treasury balances and not forecasts. Defaults for pass and payout rates are illustrative values informed by, but not equal to, the sources below.', 'فقط سناریو. همهٔ ورودی‌ها فرضی و قابل ویرایش‌اند. نتایج، آمار شرکت، موجودی خزانه یا پیش‌بینی نیستند. مقادیر پیش‌فرض نرخ قبولی و پرداخت، نمایشی و الهام‌گرفته از منابع زیرند و با آن‌ها برابر نیستند.')[locale]}</div>
      <div className="econ-form">
        <Field label={t('Challenges sold', 'تعداد چلنج فروخته‌شده')[locale]}><input {...num('challengesSold')} /></Field>
        <Field label={t('Refunds, % of gross', 'بازپرداخت، ٪ ناخالص')[locale]}><input {...num('refundRatePct')} /></Field>
        {SIZES.map(k => <Field key={'m' + k} label={`${t('Mix weight', 'وزن ترکیب')[locale]} ${Number(k) / 1000}K`}><input {...nested('mix', k)} /></Field>)}
        {SIZES.map(k => <Field key={'p' + k} label={`${t('Price', 'قیمت')[locale]} ${Number(k) / 1000}K (USD)`} hint={priceSource === 'catalog' ? t('Loaded from the live catalog', 'بارگیری‌شده از کاتالوگ فعلی')[locale] : undefined}><input {...nested('prices', k)} /></Field>)}
        <Field label={t('Pass rate %', 'نرخ قبولی ٪')[locale]}><input {...num('passRatePct')} /></Field>
        <Field label={t('First payout rate % (of passed)', 'نرخ اولین پاداش ٪ (از قبول‌شدگان)')[locale]}><input {...num('firstPayoutRatePct')} /></Field>
        <Field label={t('Average total payout per paid trader (USD)', 'میانگین کل پاداش هر دریافت‌کننده (دلار)')[locale]}><input {...num('avgTotalPayoutUsd')} /></Field>
        <Field label={t('Sales eligible for ambassador commission %', 'فروش مشمول کمیسیون سفیر ٪')[locale]}><input {...num('ambassadorSharePct')} /></Field>
        <Field label={t('Operating costs (USD)', 'هزینه‌های عملیاتی (دلار)')[locale]}><input {...num('operatingCostsUsd')} /></Field>
        <Field label={t('Reserves, % of remaining', 'ذخایر، ٪ از باقی‌مانده')[locale]}><input {...num('reservePct')} /></Field>
      </div>
    </div>
    <div className="econ-panel" aria-live="polite">
      <h3>{t('Scenario result', 'نتیجهٔ سناریو')[locale]}</h3>
      <div className="econ-list">
        {([['Gross Revenue', out.gross], ['Net Revenue', out.net], ['Trader Payouts', -out.payouts], ['Ambassador Commissions (10%)', -out.commissions], ['Operating Costs', -out.opex], ['Remaining Capital', out.remaining], ['Reserves', -out.reserves]] as const).map(([k, v]) => <div key={k}><span>{k}</span><span>{usd(v, locale)}</span></div>)}
        <div className="total"><span>Available Allocatable Capital ({t('scenario', 'سناریو')[locale]})</span><span>{usd(out.available, locale)}</span></div>
      </div>
      <p className="econ-source">{t('Payouts = sold × pass rate × first-payout rate × average total payout. Commissions = net × eligible share × 10% (first purchases only in policy).', 'پاداش = فروش × نرخ قبولی × نرخ اولین پاداش × میانگین کل پاداش. کمیسیون = خالص × سهم مشمول × ۱۰٪ (طبق سیاست فقط خرید اول).')[locale]}</p>
      <div style={{ marginTop: 14 }}><Kpi label={t('Live program threshold', 'آستانهٔ برنامهٔ بازار واقعی')[locale]} value={usd(500000, locale, 0)} note={t('Real eligibility uses verified treasury data only — see Transparency.', 'احراز واقعی فقط از دادهٔ تأییدشدهٔ خزانه استفاده می‌کند؛ صفحهٔ شفافیت را ببین.')[locale]} /></div>
    </div>
  </div>
}

export default function RevenueModel() {
  const locale = useInformationLocale()
  return <InformationShell page="revenue-model" description={intro[locale]}>
    <Hero locale={locale} page="revenue-model" title={t('How the Openfund', 'اقتصاد اوپن‌فاند')[locale]} accent={t('economy works.', 'چگونه کار می‌کند.')[locale]} intro={intro[locale]}>
      <EconomyNav locale={locale} current="revenue-model" />
    </Hero>
    <div className="container">
      <section className="econ-section" id="model"><div className="section-top"><div><span className="eyebrow">01 / {t('BUSINESS MODEL', 'مدل کسب‌وکار')[locale]}</span><h2>{t('From purchase to capital.', 'از خرید تا سرمایه.')[locale]}</h2></div></div>
        <div className="econ-flow" role="list">{FLOW.map(([title, body], i) => <div role="listitem" key={i}><strong>{title[locale]}</strong>{body[locale]}</div>)}</div>
      </section>
      <section className="econ-section" id="terms"><div className="section-top"><div><span className="eyebrow">02 / {t('DEFINITIONS', 'تعاریف')[locale]}</span><h2>{t('Simulated is not real.', 'شبیه‌سازی، واقعی نیست.')[locale]}</h2></div></div>
        <div className="info-table-wrap"><table><tbody>{TERMS.map(([term, body]) => <tr key={term}><th scope="row" dir="ltr">{term}</th><td>{body[locale]}</td></tr>)}</tbody></table></div>
      </section>
      <section className="econ-section" id="flows"><div className="section-top"><div><span className="eyebrow">03 / {t('REVENUE, COSTS & RESERVES', 'درآمد، هزینه و ذخایر')[locale]}</span><h2>{t('Where each dollar goes.', 'هر دلار کجا می‌رود.')[locale]}</h2></div></div>
        <div className="econ-grid three">
          <div className="econ-panel"><h3>{t('Inflows', 'ورودی‌ها')[locale]}</h3><p className="econ-msg">{t('Verified challenge payments to the treasury wallet; later, the Openfund share of realized live profit.', 'پرداخت‌های تأییدشدهٔ چلنج به کیف پول خزانه؛ در آینده، سهم اوپن‌فاند از سود تحقق‌یافتهٔ بازار واقعی.')[locale]}</p></div>
          <div className="econ-panel"><h3>{t('Obligations', 'تعهدات')[locale]}</h3><p className="econ-msg">{t('Approved trader rewards, recognized ambassador commissions, unsettled live profit shares, verified expenses payable and recorded liabilities.', 'پاداش‌های تأییدشده، کمیسیون‌های شناسایی‌شدهٔ سفیران، سهم‌های تسویه‌نشدهٔ سود واقعی، هزینه‌های تأییدشدهٔ پرداخت‌نشده و بدهی‌های ثبت‌شده.')[locale]}</p></div>
          <div className="econ-panel"><h3>{t('Reserves & allocation', 'ذخایر و تخصیص')[locale]}</h3><p className="econ-msg">{t('Operational and risk reserves set explicitly by management, then capital already allocated to live traders. What remains is allocatable.', 'ذخایر عملیاتی و ریسک که مدیریت صریحاً تعیین می‌کند و سپس سرمایهٔ قبلاً تخصیص‌یافته به معامله‌گران واقعی. باقی‌مانده قابل تخصیص است.')[locale]}</p></div>
        </div>
        <p className="econ-source">{t('The live figures for each item are on the Transparency page; this page explains the model and never shows them as scenario output.', 'اعداد واقعی هر مورد در صفحهٔ شفافیت است؛ این صفحه مدل را توضیح می‌دهد و آن‌ها را به‌عنوان خروجی سناریو نشان نمی‌دهد.')[locale]} <Link className="text-link" to={`/${locale}/transparency`}>{labels.transparency[locale]} ↗</Link></p>
      </section>
      <section className="econ-section" id="research"><div className="section-top"><div><span className="eyebrow">04 / {t('INDUSTRY RESEARCH', 'پژوهش صنعت')[locale]}</span><h2>{t('Single firms, not averages.', 'آمار یک شرکت، نه میانگین صنعت.')[locale]}</h2></div></div>
        <p className="econ-msg">{t('Prop-trading firms rarely publish audited outcome data. Each figure below belongs to one publisher, scope and definition, and must not be read as an industry average.', 'شرکت‌های پراپ به‌ندرت دادهٔ حسابرسی‌شدهٔ نتایج منتشر می‌کنند. هر عدد زیر متعلق به یک ناشر، دامنه و تعریف مشخص است و نباید میانگین صنعت تلقی شود.')[locale]}</p>
        <ol className="econ-sources">{SOURCES.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a><br />{s.note[locale]}</li>)}</ol>
      </section>
      <section className="econ-section" id="scenarios"><div className="section-top"><div><span className="eyebrow">05 / {t('ECONOMIC SCENARIOS', 'سناریوهای اقتصادی')[locale]}</span><h2>{t('Change the assumptions.', 'فرض‌ها را تغییر بده.')[locale]}</h2></div></div>
        <Scenario locale={locale} />
      </section>
      <div className="info-end"><img src={`${import.meta.env.BASE_URL}assets/mark-mint.svg`} width="38" height="42" alt="" /><p>{t('Capital reaches live markets only when it is verifiably free.', 'سرمایه فقط وقتی به بازار واقعی می‌رسد که آزاد بودنش قابل اثبات باشد.')[locale]}</p><Link className="button" to={`/${locale}/live-market-access`}>{labels['live-market-access'][locale]} <span aria-hidden="true">↗</span></Link></div>
    </div>
  </InformationShell>
}
