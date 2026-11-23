import { useEffect, useMemo, useState } from 'react'
import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { text, tx } from '../information/content'
import { intlLocale, pickFormat } from '../../i18n/locales'
import DirArrow from '../../ui/DirArrow'
import { useLive } from '../objectives/TradingObjectivesPage'
import { BountyHeroArt } from './bountyArt'
import { DEFAULT_TIERS, REPORT_URL, loadBounty, type HallEntry, type Severity, type Tier } from './bountyData'
import '../objectives/objectives.css'
import './bounty.css'

/* /:locale/bug-bounty (ADR 0057). Reward amounts come from the published
   Directus table (owner-edited in Backstage) or the published defaults;
   the hall of fame lists only consenting reporters and is honestly empty
   until there is one. Reports go through GitHub's private advisory flow. */
type L = { en: string; fa: string }
const c = {
  eyebrow: text('Security', 'امنیت'),
  title: text('Openfund bug bounty', 'باگ بانتی اوپن‌فاند'),
  intro: text('Find a security issue in Openfund, report it privately, and get paid in USDC on Arbitrum. Rewards follow the severity of the issue and its demonstrated impact on this project.', 'یک مشکل امنیتی در اوپن‌فاند پیدا کن، آن را به‌صورت خصوصی گزارش بده و جایزه‌ات را به USDC روی آربیتروم بگیر. جایزه به شدت مشکل و اثر اثبات‌شدهٔ آن روی همین پروژه بستگی دارد.'),
  report: text('Report a vulnerability', 'گزارش یک آسیب‌پذیری'),
  reportNote: text('Reports go through GitHub’s private security advisory. Only the maintainers can read them.', 'گزارش‌ها از طریق بخش گزارش خصوصی امنیتی گیت‌هاب ارسال می‌شوند و فقط نگهدارندگان پروژه آن‌ها را می‌بینند.'),
  rewards: text('Rewards', 'جایزه‌ها'),
  rewardsNote: text('Severity is set with CVSS 4.0 together with the impact you demonstrate on Openfund.', 'شدت با CVSS 4.0 همراه با اثری که روی اوپن‌فاند نشان می‌دهی تعیین می‌شود.'),
  exceptional: text('Exceptional findings may receive a higher discretionary reward.', 'یافته‌های استثنایی ممکن است جایزهٔ بیشتری به تشخیص تیم دریافت کنند.'),
  upTo: text('${min} to ${max}', '${min} تا ${max}'),
  critical: text('Critical', 'بحرانی'), high: text('High', 'بالا'), medium: text('Medium', 'متوسط'), low: text('Low', 'پایین'),
  exCritical: text('Unauthorized movement of funds or rewards; SIWE or session forgery leading to account takeover; remote code execution on the backend or Backstage; bypass of the Backstage owner gate; release or supply-chain compromise.', 'جابه‌جایی غیرمجاز وجوه یا جایزه‌ها؛ جعل SIWE یا نشست که به تصاحب حساب برسد؛ اجرای کد از راه دور روی بک‌اند یا بک‌استیج؛ دور زدن دروازهٔ مالک در بک‌استیج؛ نفوذ به انتشار نسخه یا زنجیرهٔ تأمین.'),
  exHigh: text('Reading or changing other users’ data or migration documents; getting a challenge without paying, or changing the price through quote or coupon tampering; bypassing evaluation rules to pass or get funded; SQL injection; stored XSS in Backstage or the CMS leading to admin actions; remote code execution in the Open Trade desktop app.', 'خواندن یا تغییر دادهٔ کاربران دیگر یا مدارک مهاجرت؛ گرفتن چلنج بدون پرداخت یا تغییر قیمت با دستکاری پیش‌فاکتور یا کد تخفیف؛ دور زدن قوانین ارزیابی برای قبولی یا فاند شدن؛ تزریق SQL؛ XSS ذخیره‌شده در بک‌استیج یا CMS که به اقدام مدیریتی برسد؛ اجرای کد از راه دور در اپ دسکتاپ Open Trade.'),
  exMedium: text('Stored XSS on public pages; CSRF on state-changing endpoints; tournament leaderboard manipulation; IRAN/GLOBAL or Prop/Perpetual data leaks; a rate-limit bypass that enables mass abuse.', 'XSS ذخیره‌شده در صفحه‌های عمومی؛ CSRF روی endpointهای تغییردهندهٔ وضعیت؛ دستکاری جدول رده‌بندی مسابقه؛ نشت داده میان ایران و جهانی یا میان پراپ و پرپچوال؛ دور زدن محدودیت نرخ که سوءاستفادهٔ گسترده را ممکن کند.'),
  exLow: text('Limited reflected XSS; sensitive information in error responses; personal data stored in search analytics; misconfiguration with demonstrated impact.', 'XSS بازتابی محدود؛ اطلاعات حساس در پاسخ‌های خطا؛ دادهٔ شخصی ذخیره‌شده در آمار جست‌وجو؛ پیکربندی نادرست با اثر اثبات‌شده.'),
  demo: text('Demo accounts', 'حساب‌های دمو'),
  demoBody: text('Changing a simulated demo balance is in scope only when it leads to a real reward or prize. Then it is Critical.', 'تغییر موجودی شبیه‌سازی‌شدهٔ حساب دمو فقط وقتی در محدوده است که به جایزه یا پاداش واقعی برسد؛ در آن صورت بحرانی است.'),
  scope: text('Scope', 'محدوده'),
  all: text('All', 'همه'), inScope: text('In scope', 'در محدوده'), outScope: text('Out of scope', 'خارج از محدوده'),
  target: text('Target', 'هدف'), status: text('Status', 'وضعیت'),
  s1: text('Openfund code in this repository and its release artifacts', 'کد اوپن‌فاند در این مخزن و خروجی‌های انتشار آن'),
  s2: text('The Openfund website and terminal on the official domains', 'وب‌سایت و ترمینال اوپن‌فاند روی دامنه‌های رسمی'),
  s3: text('Backend API, wallet sign-in (SIWE) and sessions', 'API بک‌اند، ورود با کیف پول (SIWE) و نشست‌ها'),
  s4: text('Payments, checkout, coupons and rewards', 'پرداخت، خرید، کد تخفیف و جایزه‌ها'),
  s5: text('Backstage and our own configuration of the CMS', 'بک‌استیج و پیکربندی خود ما از CMS'),
  s6: text('Open Trade desktop app', 'اپ دسکتاپ Open Trade'),
  s7: text('GitHub Actions workflows and release integrity', 'گردش‌کارهای GitHub Actions و یکپارچگی انتشار'),
  o1: text('Denial of service, social engineering and spam', 'حملهٔ منع سرویس، مهندسی اجتماعی و اسپم'),
  o2: text('Third-party services: Gains, LI.FI, DePay, wallets, upstream Directus and our infrastructure services (our own configuration of them is in scope)', 'سرویس‌های ثالث: Gains، LI.FI، DePay، کیف پول‌ها، Directus اصلی و سرویس‌های زیرساختی ما (پیکربندی خود ما از آن‌ها در محدوده است)'),
  o3: text('Self-XSS and unproven scanner output', 'Self-XSS و خروجی اسکنر بدون اثبات'),
  o4: text('Missing headers with no demonstrated impact', 'نبود هدرها بدون اثر اثبات‌شده'),
  o5: text('Findings that need a compromised device or browser', 'یافته‌هایی که به دستگاه یا مرورگر آلوده نیاز دارند'),
  rules: text('Rules', 'قوانین'),
  r1: text('Test only your own accounts and wallets, and stop as soon as you find an issue.', 'فقط روی حساب‌ها و کیف پول‌های خودت آزمایش کن و به محض پیدا کردن مشکل متوقف شو.'),
  r2: text('Do not disclose anything publicly before a fix is released.', 'پیش از انتشار اصلاحیه چیزی را عمومی نکن.'),
  r3: text('Only the first report of a duplicate issue is rewarded.', 'برای گزارش‌های تکراری فقط اولین گزارش جایزه می‌گیرد.'),
  r4: text('Report only through the private GitHub security advisory.', 'فقط از طریق گزارش خصوصی امنیتی گیت‌هاب گزارش بده.'),
  r5: text('Never access, change or delete other people’s data, and never use real private keys or seed phrases in a report.', 'هرگز به دادهٔ دیگران دسترسی پیدا نکن، آن را تغییر نده یا حذف نکن و هرگز کلید خصوصی یا عبارت بازیابی واقعی را در گزارش نگذار.'),
  r6: text('Rewards are paid in USDC on Arbitrum to your wallet, subject to eligibility under applicable law.', 'جایزه به USDC روی آربیتروم به کیف پول تو پرداخت می‌شود، به شرط واجد شرایط بودن طبق قانون قابل اعمال.'),
  harbor: text('Safe harbor', 'بندر امن'),
  harborBody: text('If you follow these rules in good faith, we will treat your research as authorized, we will not take legal action against you for it, and we will work with you to understand and fix the issue. If a third party takes action against you over research that followed these rules, we will make it known that your work was authorized under this program.', 'اگر با حسن نیت از این قوانین پیروی کنی، پژوهش تو را مجاز می‌دانیم، به خاطر آن علیه تو اقدام حقوقی نمی‌کنیم و با تو برای درک و رفع مشکل همکاری می‌کنیم. اگر شخص ثالثی به خاطر پژوهشی که طبق همین قوانین انجام شده علیه تو اقدام کند، اعلام می‌کنیم که کار تو در چارچوب این برنامه مجاز بوده است.'),
  process: text('How it works', 'روند کار'),
  p1: text('Report', 'گزارش'), p1b: text('Open a private advisory with steps to reproduce and the impact.', 'یک گزارش خصوصی با مراحل بازتولید و اثر آن باز کن.'),
  p2: text('Triage', 'بررسی اولیه'), p2b: text('We confirm the issue and agree on its severity with you.', 'مشکل را تأیید می‌کنیم و دربارهٔ شدت آن با تو به توافق می‌رسیم.'),
  p3: text('Fix', 'اصلاح'), p3b: text('We fix it and ship the fix in a release.', 'مشکل را رفع می‌کنیم و اصلاحیه را در یک نسخه منتشر می‌کنیم.'),
  p4: text('Payout', 'پرداخت'), p4b: text('We pay the reward in USDC on Arbitrum to your wallet.', 'جایزه را به USDC روی آربیتروم به کیف پولت پرداخت می‌کنیم.'),
  p5: text('Disclosure', 'افشا'), p5b: text('We publish the advisory and credit you if you want to be named.', 'گزارش امنیتی را منتشر می‌کنیم و اگر بخواهی نامت را ذکر می‌کنیم.'),
  hall: text('Hall of fame', 'تالار افتخار'),
  hallEmpty: text('No rewarded reports yet. The first researcher who agrees to be named will appear here.', 'هنوز گزارشی جایزه نگرفته است. اولین پژوهشگری که با ذکر نامش موافقت کند اینجا نمایش داده می‌شود.'),
  faq: text('Questions', 'پرسش‌ها'),
  q1: text('Who decides the severity?', 'شدت را چه کسی تعیین می‌کند؟'),
  a1: text('The maintainers, using CVSS 4.0 and the impact you demonstrate on Openfund. We explain the decision in the advisory.', 'نگهدارندگان پروژه، با CVSS 4.0 و اثری که روی اوپن‌فاند نشان می‌دهی. دلیل تصمیم را در همان گزارش توضیح می‌دهیم.'),
  q2: text('How am I paid?', 'جایزه چطور پرداخت می‌شود؟'),
  a2: text('In USDC on Arbitrum, to a wallet you control, after the fix is released and subject to eligibility under applicable law.', 'به USDC روی آربیتروم، به کیف پولی که در اختیار خودت است، پس از انتشار اصلاحیه و به شرط واجد شرایط بودن طبق قانون قابل اعمال.'),
  q3: text('Can I test on production?', 'آیا می‌توانم روی نسخهٔ اصلی آزمایش کنم؟'),
  a3: text('Yes, with your own accounts and wallets only, without hurting availability for others, and stopping as soon as you find something.', 'بله، فقط با حساب‌ها و کیف پول‌های خودت، بدون اختلال در دسترسی دیگران و با توقف به محض پیدا کردن مشکل.'),
  q4: text('Are payouts recorded?', 'آیا پرداخت‌ها ثبت می‌شوند؟'),
  a4: text('Yes. Every bounty payout is recorded as an expense in the “bug bounty” category of the public economy figures.', 'بله. هر پرداخت باگ بانتی به‌عنوان هزینه در دستهٔ «باگ بانتی» در آمار عمومی اقتصاد ثبت می‌شود.'),
  graph: text('Illustrative scan of Openfund components', 'نمایش تصویری اسکن اجزای اوپن‌فاند'),
  illustrative: text('Illustrative', 'تصویری'),
  nBackend: text('Backend', 'بک‌اند'), nWallet: text('Wallet', 'کیف پول'), nPayments: text('Payments', 'پرداخت‌ها'),
  nTerminal: text('Terminal', 'ترمینال'), nDesktop: text('Desktop', 'دسکتاپ'),
}
const SEVERITY_COPY: Record<Severity, { label: L; examples: L }> = {
  critical: { label: c.critical, examples: c.exCritical }, high: { label: c.high, examples: c.exHigh },
  medium: { label: c.medium, examples: c.exMedium }, low: { label: c.low, examples: c.exLow },
}
const SCOPE: { text: L; inScope: boolean }[] = [
  ...[c.s1, c.s2, c.s3, c.s4, c.s5, c.s6, c.s7].map(t => ({ text: t, inScope: true })),
  ...[c.o1, c.o2, c.o3, c.o4, c.o5].map(t => ({ text: t, inScope: false })),
]

/** counts up once the cards are visible; reduced motion shows the value */
function useCountUp(target: number, live: boolean) {
  const [value, setValue] = useState(() => (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? target : 0))
  useEffect(() => {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(target); return }
    if (!live) return
    let raf = 0; const start = performance.now()
    const step = (now: number) => { const p = Math.min(1, (now - start) / 900); setValue(Math.round(target * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, live])
  return value
}

function TierCard({ tier, live, t, f, usd }: { tier: Tier; live: boolean; t: (v: L) => string; f: (v: L, x: Record<string, string>) => string; usd: (n: number) => string }) {
  const min = useCountUp(tier.minUsd, live), max = useCountUp(tier.maxUsd, live)
  const copy = SEVERITY_COPY[tier.severity]
  return <li className={`bb-tier is-${tier.severity}`}>
    <span className="bb-sev">{t(copy.label)}</span>
    <b className="bb-amount" aria-label={tier.minUsd === tier.maxUsd ? usd(tier.minUsd) : f(c.upTo, { min: usd(tier.minUsd), max: usd(tier.maxUsd) })}>
      <span aria-hidden="true">{tier.minUsd === tier.maxUsd ? usd(min) : f(c.upTo, { min: usd(min), max: usd(max) })}</span>
    </b>
    <p>{t(copy.examples)}</p>
  </li>
}

export default function BugBountyPage() {
  const locale = useInformationLocale()
  const t = (v: L) => tx(locale, v)
  const f = (v: L, values: Record<string, string>) => pickFormat(locale, v.fa, v.en, values)
  const usd = useMemo(() => { const fmt = new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }); return (n: number) => fmt.format(n) }, [locale])
  const [data, setData] = useState<{ tiers: Tier[]; hall: HallEntry[] }>({ tiers: DEFAULT_TIERS, hall: [] })
  useEffect(() => { let live = true; void loadBounty().then(d => { if (live) setData(d) }).catch(() => {}); return () => { live = false } }, [])
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all')
  const [heroRef, heroLive] = useLive<HTMLDivElement>()
  const [tiersRef, tiersLive] = useLive<HTMLUListElement>()
  const rows = SCOPE.filter(r => filter === 'all' || (filter === 'in') === r.inScope)
  const reportLink = <a className="button bb-report" href={REPORT_URL} target="_blank" rel="noopener noreferrer">{t(c.report)} <DirArrow kind="external" /></a>

  return <InformationShell page="bug-bounty" description={t(c.intro)} title={`${t(c.title)} | Openfund`}>
    <section className="bb-hero container" id="top" ref={heroRef} data-live={heroLive || undefined}>
      <div className="bb-hero-copy">
        <p className="ob-eyebrow">{t(c.eyebrow)}</p>
        <h1>{t(c.title)}</h1>
        <p className="ob-intro">{t(c.intro)}</p>
        <div className="bb-actions">{reportLink}</div>
        <p className="ob-note">{t(c.reportNote)}</p>
      </div>
      <figure className="bb-hero-art">
        <BountyHeroArt label={t(c.graph)} nodes={{ backend: t(c.nBackend), wallet: t(c.nWallet), payments: t(c.nPayments), terminal: t(c.nTerminal), desktop: t(c.nDesktop) }} />
        <figcaption className="bb-illustrative">{t(c.illustrative)}</figcaption>
      </figure>
    </section>

    <section className="container ob-section" aria-labelledby="bb-rewards">
      <h2 id="bb-rewards">{t(c.rewards)}</h2>
      <p className="ob-note">{t(c.rewardsNote)}</p>
      <ul className="bb-tiers" ref={tiersRef}>{data.tiers.map(tier => <TierCard key={tier.severity} tier={tier} live={tiersLive} t={t} f={f} usd={usd} />)}</ul>
      <p className="bb-exceptional">{t(c.exceptional)}</p>
      <div className="bb-callout"><h3>{t(c.demo)}</h3><p>{t(c.demoBody)}</p></div>
    </section>

    <section className="container ob-section" aria-labelledby="bb-scope">
      <h2 id="bb-scope">{t(c.scope)}</h2>
      <div className="bb-filters" role="group" aria-label={t(c.scope)}>
        {([['all', c.all], ['in', c.inScope], ['out', c.outScope]] as const).map(([key, label]) =>
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{t(label)}</button>)}
      </div>
      <div className="bb-table-wrap"><table className="bb-scope">
        <thead><tr><th scope="col">{t(c.target)}</th><th scope="col">{t(c.status)}</th></tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className={r.inScope ? 'is-in' : 'is-out'}><td>{t(r.text)}</td>
          <td><span className={`bb-pill ${r.inScope ? 'is-in' : 'is-out'}`}>{t(r.inScope ? c.inScope : c.outScope)}</span></td></tr>)}</tbody>
      </table></div>
    </section>

    <section className="container ob-section" aria-labelledby="bb-rules">
      <h2 id="bb-rules">{t(c.rules)}</h2>
      <ul className="bb-rules">{[c.r1, c.r2, c.r3, c.r4, c.r5, c.r6].map((r, i) => <li key={i}>{t(r)}</li>)}</ul>
      <div className="bb-callout"><h3>{t(c.harbor)}</h3><p>{t(c.harborBody)}</p></div>
    </section>

    <section className="container ob-section" aria-labelledby="bb-process">
      <h2 id="bb-process">{t(c.process)}</h2>
      <ol className="bb-timeline">{[[c.p1, c.p1b], [c.p2, c.p2b], [c.p3, c.p3b], [c.p4, c.p4b], [c.p5, c.p5b]].map(([h, b], i) =>
        <li key={i}><span className="bb-step" aria-hidden="true">{new Intl.NumberFormat(intlLocale(locale)).format(i + 1)}</span><b>{t(h)}</b><p>{t(b)}</p></li>)}</ol>
      <div className="bb-actions">{reportLink}</div>
    </section>

    <section className="container ob-section" aria-labelledby="bb-hall">
      <h2 id="bb-hall">{t(c.hall)}</h2>
      {data.hall.length
        ? <ul className="bb-hall">{data.hall.map(h => <li key={h.id}>
            {h.profileUrl ? <a href={h.profileUrl} target="_blank" rel="noopener noreferrer nofollow" dir="auto">{h.name}</a> : <b dir="auto">{h.name}</b>}
            <small>{new Intl.NumberFormat(intlLocale(locale), { useGrouping: false }).format(h.year)}{h.severity ? ` · ${t(SEVERITY_COPY[h.severity].label)}` : ''}</small></li>)}</ul>
        : <p className="ob-note">{t(c.hallEmpty)}</p>}
    </section>

    <section className="container ob-section" aria-labelledby="bb-faq">
      <h2 id="bb-faq">{t(c.faq)}</h2>
      {[[c.q1, c.a1], [c.q2, c.a2], [c.q3, c.a3], [c.q4, c.a4]].map(([q, a], i) => <details key={i} className="ob-faq"><summary>{t(q)}</summary><p>{t(a)}</p></details>)}
    </section>
  </InformationShell>
}
