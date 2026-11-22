import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { text, tx } from '../information/content'
import { intlLocale, pickFormat, type AppLocale } from '../../i18n/locales'
import { apiFetch, backendUrl, useSession } from '../../session/useOpenfundSession'
import DirArrow from '../../ui/DirArrow'
import { publicRuntimeConfig } from '../../config/runtime'
import { BADGES, Badge, PrizeScene } from './art'
import { PREMIUM_LEAGUE_START, PREMIUM_LEAGUE_TRADING_DAYS, tradingEnd } from './schedule'
import './tournament.css'

/* /:locale/tournament — the Openfund Premium League. Facts (schedule, rules,
   prizes, the registration count, the leaderboard) come from the backend
   (tournament.js); the bundled schedule is used only until it answers. No
   number on this page is invented: before the start only the real count of
   verified registrations is shown. */
const SLUG = 'premium-league-2027'
const c = {
  eyebrow: text('Trading competition', 'مسابقهٔ معاملاتی'),
  name: text('Openfund Premium League', 'لیگ برتر اوپن‌فاند'),
  line: text('A 30-day competition in analysis and risk.', 'رقابت ۳۰ روزه در تحلیل و مدیریت ریسک.'),
  intro: text('Thirty trading days on a $125,000 demo account. Daily loss 5%, maximum loss 10%, consistency 35%. The highest final equity wins.', 'سی روز معاملاتی روی حساب دموی ۱۲۵٬۰۰۰ دلاری. ضرر روزانه ۵٪، حداکثر ضرر ۱۰٪، ثبات ۳۵٪. بالاترین ارزش نهایی برنده است.'),
  startsIn: text('Starts in', 'تا شروع'), endsIn: text('Ends in', 'تا پایان'), finished: text('The competition has ended.', 'مسابقه به پایان رسیده است.'),
  days: text('days', 'روز'), hours: text('hours', 'ساعت'), minutes: text('minutes', 'دقیقه'), seconds: text('seconds', 'ثانیه'),
  register: text('Register', 'ثبت‌نام'), rules: text('Rules', 'قوانین'), prizes: text('Prizes', 'جوایز'),
  podiumTitle: text('Prizes for the top three', 'جوایز سه نفر اول'),
  first: text('1st place', 'نفر اول'), second: text('2nd place', 'نفر دوم'), third: text('3rd place', 'نفر سوم'),
  cashNote: text('Cash prizes are paid after winner identity checks (KYC), subject to law and sanctions.', 'جوایز نقدی پس از احراز هویت برندگان (KYC) و مطابق قانون و تحریم‌ها پرداخت می‌شود.'),
  ranks4: text('Ranks 4 to 10', 'رتبه‌های ۴ تا ۱۰'),
  ranks4Body: text('A $50K account, plus a PlayStation 5 Pro, plus Grand Theft Auto VI and EA SPORTS FC 27.', 'یک حساب ۵۰ هزار دلاری، به‌علاوهٔ PlayStation 5 Pro، به‌علاوهٔ Grand Theft Auto VI و EA SPORTS FC 27.'),
  ranks4Note: text('The $50K account is a free Standard challenge issued to the winner’s wallet. Where shipping or payment is not possible, a cash equivalent may be offered.', 'حساب ۵۰ هزار دلاری یک چلنج استاندارد رایگان است که به کیف پول برنده صادر می‌شود. اگر ارسال یا پرداخت ممکن نباشد، معادل نقدی پیشنهاد می‌شود.'),
  ranks11: text('Ranks 11 to 100', 'رتبه‌های ۱۱ تا ۱۰۰'),
  ranks11Body: text('A 35% purchase discount: a single-use coupon bound to your wallet, valid for 90 days.', 'تخفیف ۳۵٪ خرید: کوپن یک‌بارمصرف وابسته به کیف پول شما با اعتبار ۹۰ روز.'),
  notAffiliated: text('Openfund is not affiliated with Sony, Rockstar Games or EA. Product names are used to describe prizes only.', 'اوپن‌فاند وابسته به Sony، Rockstar Games یا EA نیست. نام محصولات فقط برای معرفی جوایز آمده است.'),
  illustrative: text('Illustration', 'تصویر نمادین'),
  rulesTitle: text('The rules', 'قوانین'),
  gaugeDaily: text('Daily loss limit', 'سقف ضرر روزانه'), gaugeDailyBody: text('Equity may not fall 5% below the day’s basis (00:00 UTC+3).', 'ارزش حساب نباید ۵٪ زیر مبنای روز (۰۰:۰۰ UTC+3) برود.'),
  gaugeMax: text('Maximum loss', 'حداکثر ضرر'), gaugeMaxBody: text('Static 10% from the starting balance.', '۱۰٪ ثابت از موجودی اولیه.'),
  gaugeConsistency: text('Consistency', 'ثبات'), gaugeConsistencyBody: text('No single day may hold more than 35% of your total profit.', 'سود هیچ روزی نباید بیش از ۳۵٪ کل سود باشد.'),
  gaugeAccount: text('Demo account', 'حساب دمو'), gaugeAccountBody: text('One $125,000 demo account per entrant.', 'برای هر شرکت‌کننده یک حساب دموی ۱۲۵٬۰۰۰ دلاری.'),
  gaugeDays: text('Trading days', 'روزهای معاملاتی'), gaugeDaysBody: text('Thirty weekdays; open positions close at the mark at the end.', 'سی روز کاری؛ پوزیشن‌های باز در پایان با قیمت مارک بسته می‌شوند.'),
  breachNote: text('Breaking a rule removes the account from the ranking. You may keep trading it for practice, marked “out of ranking”.', 'نقض هر قانون حساب را از رتبه‌بندی خارج می‌کند. می‌توانی برای تمرین ادامه دهی؛ با برچسب «خارج از رتبه‌بندی».'),
  rankingNote: text('Ranked by final equity to the cent. Ties: lower maximum drawdown, then the earlier time the final equity was reached. Accounts with no closed trades are not ranked.', 'رتبه‌بندی بر اساس ارزش نهایی تا سنت. در تساوی: افت سرمایهٔ کمتر، سپس زمان زودتر رسیدن به ارزش نهایی. حساب بدون معاملهٔ بسته‌شده رتبه نمی‌گیرد.'),
  timelineTitle: text('Timeline', 'زمان‌بندی'),
  tRegistration: text('Registration', 'ثبت‌نام'), tRegistrationBody: text('Open until the start.', 'تا زمان شروع باز است.'),
  tStart: text('Start', 'شروع'), tEnd: text('End', 'پایان'), tResults: text('Results', 'نتایج'), tResultsBody: text('Published after the final standings are frozen and reviewed.', 'پس از ثبت و بازبینی جدول نهایی منتشر می‌شود.'),
  badgesTitle: text('Achievements', 'دستاوردها'),
  badgesBody: text('Ten badges for ranks 1 to 10 and a Finisher badge for everyone who keeps the account to the end. Badges appear on your profile and certificates.', 'ده نشان برای رتبه‌های ۱ تا ۱۰ و نشان «به خط پایان رسید» برای هر کسی که حسابش را تا پایان حفظ کند. نشان‌ها در پروفایل و گواهی‌ها نمایش داده می‌شوند.'),
  finisher: text('Finisher', 'به خط پایان رسید'),
  leaderboard: text('Leaderboard', 'جدول رده‌بندی'),
  leaderboardLater: text('The leaderboard goes live at the start. Before that only the number of registrations is shown.', 'جدول رده‌بندی از زمان شروع فعال می‌شود. تا آن زمان فقط تعداد ثبت‌نام‌ها نمایش داده می‌شود.'),
  leaderboardEmpty: text('No equity samples yet.', 'هنوز نمونه‌ای از ارزش حساب‌ها ثبت نشده است.'),
  colPosition: text('Position', 'جایگاه'), colTrader: text('Trader', 'معامله‌گر'), colEquity: text('Equity', 'ارزش حساب'),
  outOfRanking: text('Out of ranking', 'خارج از رتبه‌بندی'),
  stepWallet: text('Wallet', 'کیف پول'), stepEmail: text('Email', 'ایمیل'), stepCode: text('Code', 'کد'), stepDone: text('Done', 'پایان'),
  connect: text('Connect wallet', 'اتصال کیف پول'), signIn: text('Sign in with your wallet', 'ورود با کیف پول'),
  walletHint: text('One entry per wallet and per email address.', 'برای هر کیف پول و هر ایمیل فقط یک ثبت‌نام.'),
  emailLabel: text('Email address', 'نشانی ایمیل'), nickname: text('Nickname (optional, shown on the leaderboard)', 'نام نمایشی (اختیاری، در جدول نمایش داده می‌شود)'),
  acceptTerms: text('I am 18 or older and accept the tournament terms.', '۱۸ سال یا بیشتر دارم و قوانین مسابقه را می‌پذیرم.'),
  readTerms: text('Read the tournament terms', 'خواندن قوانین مسابقه'),
  sendCode: text('Send code', 'ارسال کد'), codeLabel: text('6-digit code from the email', 'کد ۶ رقمی ارسال‌شده به ایمیل'), verify: text('Verify', 'تأیید'),
  doneTitle: text('You are in.', 'ثبت‌نامت انجام شد.'),
  doneBody: text('Your $125,000 demo tournament account is created automatically at the start. You will see it here and in your inbox.', 'حساب دموی ۱۲۵٬۰۰۰ دلاری مسابقه در زمان شروع خودکار ساخته می‌شود و اینجا و در صندوق پیام‌ها آن را می‌بینی.'),
  shareCard: text('Download my “I’m in” card', 'دریافت کارت «من هستم»'),
  imIn: text('I’m in the Openfund Premium League', 'من در لیگ برتر اوپن‌فاند هستم'),
  opensSoon: text('Registration opens soon.', 'ثبت‌نام به‌زودی باز می‌شود.'),
  opensSoonBody: text('Registration opens once the tournament terms are published and email verification is available. Nothing is collected before then.', 'ثبت‌نام پس از انتشار قوانین مسابقه و فعال شدن تأیید ایمیل باز می‌شود. تا آن زمان اطلاعاتی دریافت نمی‌شود.'),
  closed: text('Registration is closed.', 'ثبت‌نام بسته است.'),
  regionUnavailable: text('The Premium League is not available in this region.', 'لیگ برتر در این منطقه در دسترس نیست.'),
  regionUnavailableBody: text('Competition accounts run on the international service only. The rules and prizes below are for information.', 'حساب‌های مسابقه فقط روی سرویس بین‌المللی اجرا می‌شوند. قوانین و جوایز زیر فقط برای اطلاع است.'),
  status: text('Your status', 'وضعیت تو'), statusActive: text('In the ranking', 'در رتبه‌بندی'),
  faqTitle: text('Questions', 'پرسش‌ها'),
  faq1q: text('Is this real money?', 'آیا با پول واقعی است؟'), faq1a: text('No. Every account is a demo account priced from live market data. Prizes are real and paid after identity checks.', 'خیر. همهٔ حساب‌ها دمو هستند و قیمت‌ها از دادهٔ زندهٔ بازار می‌آید. جوایز واقعی‌اند و پس از احراز هویت پرداخت می‌شوند.'),
  faq2q: text('Can I have more than one entry?', 'آیا می‌توانم بیش از یک بار شرکت کنم؟'), faq2a: text('No. One person, one entry. Multiple accounts and opposite-side hedging between accounts lead to disqualification.', 'خیر. هر نفر فقط یک بار. چند حساب و پوشش ریسک معکوس بین حساب‌ها به حذف منجر می‌شود.'),
  faq3q: text('What day does the daily loss limit use?', 'سقف ضرر روزانه بر اساس کدام روز است؟'), faq3a: text('The same trading day as Openfund challenges: it resets at 00:00 UTC+3, measured from the higher of the opening balance or equity.', 'همان روز معاملاتی چلنج‌های اوپن‌فاند: ساعت ۰۰:۰۰ UTC+3 بازنشانی می‌شود و مبنای آن بیشترِ موجودی یا ارزش ابتدای روز است.'),
  errors: text('Something went wrong. Please try again.', 'مشکلی پیش آمد. دوباره تلاش کن.'),
}
const ERRORS: Record<string, { en: string; fa: string }> = {
  invalid_email: text('That email address is not valid.', 'نشانی ایمیل معتبر نیست.'),
  email_already_used: text('That email address is already registered.', 'این ایمیل قبلاً ثبت شده است.'),
  already_registered: text('This wallet is already registered.', 'این کیف پول قبلاً ثبت‌نام کرده است.'),
  invalid_code: text('That code is not correct.', 'کد درست نیست.'),
  code_expired: text('The code has expired. Send a new one.', 'کد منقضی شده است. کد تازه بگیر.'),
  too_many_codes: text('Too many codes requested. Try again in an hour.', 'درخواست کد بیش از حد مجاز است. یک ساعت بعد دوباره تلاش کن.'),
  invalid_nickname: text('Use 3–24 letters, digits, spaces, dots, dashes or underscores.', 'از ۳ تا ۲۴ حرف، رقم، فاصله، نقطه، خط تیره یا زیرخط استفاده کن.'),
  terms_not_accepted: text('Please accept the tournament terms.', 'لطفاً قوانین مسابقه را بپذیر.'),
}

interface League { slug: string; status: string; startsAt: string; endsAt: string; tradingDays: number; registered: number
  rules: { accountSizeUsd: number; dailyLossPct: number; maxLossPct: number; consistencyPct: number }
  prizes: { cash?: Record<string, number> }
  registration: { open: boolean; termsPublished: boolean; termsVersion: string | null; emailConfigured: boolean; beforeStart: boolean }
  leaderboard?: { position: number | null; name: string; equity: string; outOfRanking: boolean }[]
  standings?: { rank: number; name: string; finalEquity: string }[] }
interface Me { registered: boolean; status?: string; emailVerified?: boolean; consistency?: { bestDayShare: number | null; limit: number; ok: boolean } | null }

const FALLBACK: League = { slug: SLUG, status: 'registration', startsAt: PREMIUM_LEAGUE_START, endsAt: tradingEnd(PREMIUM_LEAGUE_START, PREMIUM_LEAGUE_TRADING_DAYS).toISOString(),
  tradingDays: PREMIUM_LEAGUE_TRADING_DAYS, registered: 0, rules: { accountSizeUsd: 125000, dailyLossPct: 5, maxLossPct: 10, consistencyPct: 35 }, prizes: { cash: { 1: 10000, 2: 7500, 3: 5000 } },
  registration: { open: false, termsPublished: false, termsVersion: null, emailConfigured: false, beforeStart: true } }

/* motion only while an element is on screen and the tab is visible */
function useLive<T extends Element>() {
  const ref = useRef<T>(null)
  const [live, setLive] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    let seen = false
    const sync = () => setLive(seen && document.visibilityState === 'visible')
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(e => { seen = e.some(x => x.isIntersecting); sync() }) : null
    if (io) io.observe(el); else { seen = true; sync() }
    document.addEventListener('visibilitychange', sync)
    return () => { io?.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [])
  return [ref, live] as const
}

function useNow(stepMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), stepMs); return () => clearInterval(id) }, [stepMs])
  return now
}

export default function TournamentPage() {
  const locale = useInformationLocale()
  const t = (v: { en: string; fa: string }) => tx(locale, v)
  const num = (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', opts).format(n)
  const usd = (n: number) => num(n, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  const date = (iso: string) => new Intl.DateTimeFormat(`${intlLocale(locale)}-u-ca-gregory`, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(iso)) + ' UTC'
  const [league, setLeague] = useState<League>(FALLBACK)
  const [loaded, setLoaded] = useState(false)
  const iran = publicRuntimeConfig().region === 'IRAN'
  const load = useCallback(async () => {
    if (iran) { setLoaded(true); return }
    try { const r = await fetch(`${backendUrl()}/tournaments/${SLUG}`, { credentials: 'include' }); if (r.ok) setLeague(await r.json()) } catch { /* bundled schedule stays */ }
    setLoaded(true)
  }, [iran])
  useEffect(() => { void load() }, [load])
  const now = useNow()
  const before = now < Date.parse(league.startsAt)
  const target = before ? league.startsAt : league.endsAt
  const left = Math.max(0, Date.parse(target) - now)
  const parts = [Math.floor(left / 86_400_000), Math.floor(left / 3_600_000) % 24, Math.floor(left / 60_000) % 60, Math.floor(left / 1000) % 60]
  const [heroRef, heroLive] = useLive<HTMLDivElement>()
  const [podiumRef, podiumLive] = useLive<HTMLDivElement>()
  const [sceneRef, sceneLive] = useLive<HTMLDivElement>()
  const markHref = `${import.meta.env.BASE_URL || '/'}assets/mark-mint.svg`
  const cash = league.prizes?.cash ?? FALLBACK.prizes.cash!
  const rules = league.rules
  const ended = !before && now >= Date.parse(league.endsAt)

  return <InformationShell page="tournament" description={t(c.line)} title={`${t(c.name)} | Openfund`}>
    <section className="tl-hero container" ref={heroRef} data-live={heroLive || undefined}>
      <p className="tl-eyebrow">{t(c.eyebrow)}</p>
      <h1 className="tl-title">{t(c.name)}</h1>
      <p className="tl-line">{t(c.line)}</p>
      {ended ? <p className="tl-ended">{t(c.finished)}</p> : <div className="tl-countdown" role="timer" aria-label={`${t(before ? c.startsIn : c.endsIn)} ${date(target)}`}>
        <span className="tl-countdown-label">{t(before ? c.startsIn : c.endsIn)}</span>
        <div className="tl-digits" dir="ltr">{parts.map((v, i) => <span key={i} className="tl-digit"><b aria-hidden="true">{num(v, { minimumIntegerDigits: 2 })}</b><small>{t([c.days, c.hours, c.minutes, c.seconds][i])}</small></span>)}</div>
        <span className="tl-countdown-date">{date(target)}</span>
      </div>}
      <p className="tl-intro">{t(c.intro)}</p>
      <div className="hero-actions"><a className="button" href="#register">{t(c.register)} <DirArrow kind="down" /></a><a className="text-link" href="#rules">{t(c.rules)} <DirArrow kind="down" /></a></div>
    </section>

    <section className="container tl-section" aria-labelledby="tl-prizes">
      <h2 id="tl-prizes">{t(c.podiumTitle)}</h2>
      <div className="tl-podium" ref={podiumRef} data-live={podiumLive || undefined}>
        {[[2, c.second, 'silver'], [1, c.first, 'gold'], [3, c.third, 'bronze']].map(([rank, label, metal]) =>
          <div key={String(rank)} className={`tl-step is-${metal}`}>
            <div className="tl-cash" aria-hidden="true"><i /><i /><i /></div>
            <strong>{usd(cash[String(rank)] ?? 0)}</strong>
            <span>{t(label as { en: string; fa: string })}</span>
          </div>)}
      </div>
      <p className="tl-note">{t(c.cashNote)}</p>
      <div className="tl-prize-grid">
        <article className="tl-card tl-ranks4" ref={sceneRef} data-live={sceneLive || undefined}>
          <figure><PrizeScene /><figcaption className="tl-illustrative">{t(c.illustrative)}</figcaption></figure>
          <h3>{t(c.ranks4)}</h3><p>{t(c.ranks4Body)}</p><p className="tl-note">{t(c.ranks4Note)}</p>
        </article>
        <article className="tl-card"><h3>{t(c.ranks11)}</h3><p className="tl-big">35%</p><p>{t(c.ranks11Body)}</p></article>
      </div>
      <p className="tl-note">{t(c.notAffiliated)}</p>
    </section>

    <section className="container tl-section" id="rules" aria-labelledby="tl-rules">
      <h2 id="tl-rules">{t(c.rulesTitle)}</h2>
      <div className="tl-gauges">
        <Gauge value={rules.dailyLossPct / 20} label={`${num(rules.dailyLossPct)}%`} title={t(c.gaugeDaily)} body={t(c.gaugeDailyBody)} />
        <Gauge value={rules.maxLossPct / 20} label={`${num(rules.maxLossPct)}%`} title={t(c.gaugeMax)} body={t(c.gaugeMaxBody)} />
        <Gauge value={rules.consistencyPct / 100} label={`${num(rules.consistencyPct)}%`} title={t(c.gaugeConsistency)} body={t(c.gaugeConsistencyBody)} />
        <Gauge value={1} label={usd(rules.accountSizeUsd)} title={t(c.gaugeAccount)} body={t(c.gaugeAccountBody)} />
        <Gauge value={1} label={num(league.tradingDays)} title={t(c.gaugeDays)} body={t(c.gaugeDaysBody)} />
      </div>
      <p className="tl-note">{t(c.breachNote)}</p>
      <p className="tl-note">{t(c.rankingNote)}</p>
    </section>

    <section className="container tl-section" aria-labelledby="tl-timeline">
      <h2 id="tl-timeline">{t(c.timelineTitle)}</h2>
      <ol className="tl-timeline">
        <li className={before ? 'is-now' : 'is-done'}><b>{t(c.tRegistration)}</b><span>{t(c.tRegistrationBody)}</span></li>
        <li className={!before && !ended ? 'is-now' : ended ? 'is-done' : ''}><b>{t(c.tStart)}</b><span>{date(league.startsAt)}</span></li>
        <li className={ended ? 'is-done' : ''}><b>{t(c.tEnd)}</b><span>{date(league.endsAt)}</span></li>
        <li className={league.status === 'finalized' ? 'is-now' : ''}><b>{t(c.tResults)}</b><span>{t(c.tResultsBody)}</span></li>
      </ol>
    </section>

    <section className="container tl-section" aria-labelledby="tl-badges">
      <h2 id="tl-badges">{t(c.badgesTitle)}</h2>
      <p className="tl-note">{t(c.badgesBody)}</p>
      <ul className="tl-badges">{BADGES.map(b => {
        const name = b.rank ? pickFormat(locale, 'رتبهٔ ${n}', 'Rank ${n}', { n: num(b.rank) }) : t(c.finisher)
        return <li key={b.id}><Badge badge={b} markHref={markHref} title={name} /><span>{name}</span></li>
      })}</ul>
    </section>

    <section className="container tl-section" aria-labelledby="tl-board">
      <h2 id="tl-board">{t(c.leaderboard)}</h2>
      {league.standings?.length ? <Board rows={league.standings.map(r => ({ position: r.rank, name: r.name, equity: r.finalEquity, outOfRanking: false }))} t={t} num={num} />
        : league.leaderboard ? (league.leaderboard.length ? <Board rows={league.leaderboard} t={t} num={num} /> : <p className="tl-empty">{t(c.leaderboardEmpty)}</p>)
        : <div className="tl-card"><p className="tl-big">{num(league.registered)}</p><p>{pickFormat(locale, '${n} معامله‌گر تاکنون ثبت‌نام کرده‌اند.', '${n} traders registered so far.', { n: num(league.registered) })}</p><p className="tl-note">{t(c.leaderboardLater)}</p></div>}
    </section>

    {iran ? <section className="container tl-section" id="register"><div className="tl-card"><h3>{t(c.regionUnavailable)}</h3><p>{t(c.regionUnavailableBody)}</p></div></section>
      : <Registration league={league} loaded={loaded} t={t} locale={locale} onChange={load} num={num} />}

    <section className="container tl-section" aria-labelledby="tl-faq">
      <h2 id="tl-faq">{t(c.faqTitle)}</h2>
      {[[c.faq1q, c.faq1a], [c.faq2q, c.faq2a], [c.faq3q, c.faq3a]].map(([q, a], i) => <details key={i} className="tl-faq"><summary>{t(q)}</summary><p>{t(a)}</p></details>)}
      <p><Link className="text-link" to={`/${locale}/tournament/terms`}>{t(c.readTerms)} <DirArrow kind="forward" /></Link></p>
    </section>
  </InformationShell>
}

function Gauge({ value, label, title, body }: { value: number; label: string; title: string; body: string }) {
  const angle = -90 + Math.max(0, Math.min(1, value)) * 180
  return <article className="tl-gauge">
    <svg viewBox="0 0 120 70" aria-hidden="true" focusable="false">
      <path d="M10 64a50 50 0 0 1 100 0" className="tl-gauge-track" />
      <g className="tl-gauge-needle" style={{ transform: `rotate(${angle}deg)` }}><path d="M60 64V22" /></g>
      <circle cx="60" cy="64" r="4" className="tl-gauge-hub" />
    </svg>
    <strong dir="ltr">{label}</strong><h3>{title}</h3><p>{body}</p>
  </article>
}

function Board({ rows, t, num }: { rows: { position: number | null; name: string; equity: string; outOfRanking: boolean }[]; t: (v: { en: string; fa: string }) => string; num: (n: number, o?: Intl.NumberFormatOptions) => string }) {
  return <div className="info-table-wrap"><table className="tl-board"><thead><tr><th scope="col">{t(c.colPosition)}</th><th scope="col">{t(c.colTrader)}</th><th scope="col">{t(c.colEquity)}</th></tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className={r.outOfRanking ? 'is-out' : undefined}><td>{r.position ? num(r.position) : '—'}</td><td dir="auto">{r.name}{r.outOfRanking && <span className="tl-out"> · {t(c.outOfRanking)}</span>}</td>
      <td dir="ltr">{num(Number(r.equity), { style: 'currency', currency: 'USD' })}</td></tr>)}</tbody></table></div>
}

function Registration({ league, loaded, t, locale, onChange, num }: { league: League; loaded: boolean; t: (v: { en: string; fa: string }) => string; locale: AppLocale; onChange: () => void; num: (n: number, o?: Intl.NumberFormatOptions) => string }) {
  const session = useSession()
  const [me, setMe] = useState<Me | null>(null)
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email')
  const [email, setEmail] = useState(''), [nickname, setNickname] = useState(''), [accept, setAccept] = useState(false), [code, setCode] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const authenticated = session.status === 'authenticated'
  useEffect(() => {
    if (!authenticated) { setMe(null); return }
    void apiFetch(`/tournaments/${SLUG}/me`).then(r => { if (r.ok) { setMe(r.data); if (r.data.registered) setStep('done') } })
  }, [authenticated])
  const fail = (code?: string) => setError(t(ERRORS[code ?? ''] ?? c.errors))
  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    const r = await apiFetch(`/tournaments/${SLUG}/register`, { method: 'POST', body: JSON.stringify({ email, nickname: nickname || null, acceptTerms: accept, termsVersion: league.registration.termsVersion }) })
    setBusy(false); if (r.ok) setStep('code'); else fail(r.data?.error)
  }
  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    const r = await apiFetch(`/tournaments/${SLUG}/verify`, { method: 'POST', body: JSON.stringify({ code }) })
    setBusy(false); if (r.ok) { setStep('done'); onChange() } else fail(r.data?.error)
  }
  const current = !authenticated ? 0 : step === 'email' ? 1 : step === 'code' ? 2 : 3
  const steps = [c.stepWallet, c.stepEmail, c.stepCode, c.stepDone]
  const reg = league.registration
  let body: ReactNode
  if (me?.registered) body = <Done t={t} locale={locale} me={me} num={num} />
  else if (!reg.beforeStart || league.status !== 'registration') body = <p className="tl-empty">{t(c.closed)}</p>
  else if (!reg.open) body = <div className="tl-card"><h3>{t(c.opensSoon)}</h3><p>{t(c.opensSoonBody)}</p></div>
  else if (!authenticated) body = <div className="tl-card"><p>{t(c.walletHint)}</p>
    {session.status === 'unauthenticated'
      ? <button type="button" className="button" onClick={() => void session.signIn()}>{t(c.signIn)}</button>
      : <button type="button" className="button" onClick={() => (window as Window & { __ofOpenConnect?: () => void }).__ofOpenConnect?.()}>{t(c.connect)}</button>}</div>
  else if (step === 'email') body = <form className="tl-card tl-form" onSubmit={submitEmail}>
    <label>{t(c.emailLabel)}<input type="email" required autoComplete="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label>{t(c.nickname)}<input maxLength={24} value={nickname} onChange={e => setNickname(e.target.value)} /></label>
    <label className="tl-check"><input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} required /> {t(c.acceptTerms)}</label>
    <Link className="text-link" to={`/${locale}/tournament/terms`}>{t(c.readTerms)} <DirArrow kind="forward" /></Link>
    {error && <p role="alert" className="tl-error">{error}</p>}
    <button className="button" disabled={busy}>{t(c.sendCode)}</button></form>
  else if (step === 'code') body = <form className="tl-card tl-form" onSubmit={submitCode}>
    <label>{t(c.codeLabel)}<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required dir="ltr" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></label>
    {error && <p role="alert" className="tl-error">{error}</p>}
    <button className="button" disabled={busy}>{t(c.verify)}</button></form>
  else body = <Done t={t} locale={locale} me={me} num={num} />
  return <section className="container tl-section" id="register" aria-labelledby="tl-register">
    <h2 id="tl-register">{t(c.register)}</h2>
    <ol className="tl-stepper" aria-label={t(c.register)}>{steps.map((s, i) => <li key={i} className={i < current ? 'is-done' : i === current ? 'is-current' : ''} aria-current={i === current ? 'step' : undefined}><span>{num(i + 1)}</span>{t(s)}</li>)}</ol>
    {loaded ? body : null}
  </section>
}

function Done({ t, locale, me, num }: { t: (v: { en: string; fa: string }) => string; locale: AppLocale; me: Me | null; num: (n: number, o?: Intl.NumberFormatOptions) => string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) confetti(canvas.current) }, [])
  const share = () => {
    const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 630
    const x = cv.getContext('2d'); if (!x) return
    const g = x.createLinearGradient(0, 0, 1200, 630); g.addColorStop(0, '#0a0620'); g.addColorStop(1, '#0b1a14'); x.fillStyle = g; x.fillRect(0, 0, 1200, 630)
    x.fillStyle = '#82e7bd'; x.font = '600 34px Ubuntu, sans-serif'; x.fillText('OpenFi', 80, 110)
    x.fillStyle = '#f1f3ef'; x.font = `700 64px ${locale === 'fa' || locale === 'ar' ? 'Dastkhat, ' : ''}Ubuntu, sans-serif`
    x.direction = locale === 'fa' || locale === 'ar' ? 'rtl' : 'ltr'; x.textAlign = x.direction === 'rtl' ? 'right' : 'left'
    x.fillText(t(c.imIn), x.direction === 'rtl' ? 1120 : 80, 320)
    x.fillStyle = '#ff4fd8'; x.fillRect(80, 360, 240, 6); x.fillStyle = '#38e1ff'; x.fillRect(320, 360, 240, 6)
    const a = document.createElement('a'); a.download = 'openfund-premium-league.png'; a.href = cv.toDataURL('image/png'); a.click()
  }
  return <div className="tl-card tl-done">
    <canvas ref={canvas} className="tl-confetti" aria-hidden="true" />
    <h3>{t(c.doneTitle)}</h3><p>{t(c.doneBody)}</p>
    {me?.status && <p><b>{t(c.status)}:</b> {me.status === 'active' ? t(c.statusActive) : me.status === 'out_of_ranking' ? t(c.outOfRanking) : me.status}</p>}
    {me?.consistency?.bestDayShare != null && <p className={me.consistency.ok ? '' : 'tl-error'}>{pickFormat(locale, 'بهترین روز تاکنون: ${share} از کل سود (سقف ${limit}).', 'Best day so far: ${share} of total profit (limit ${limit}).',
      { share: num(me.consistency.bestDayShare, { style: 'percent', maximumFractionDigits: 1 }), limit: num(me.consistency.limit, { style: 'percent' }) })}</p>}
    <button type="button" className="button" onClick={share}>{t(c.shareCard)}</button>
  </div>
}

/* a short confetti burst on a small canvas (skipped under reduced motion) */
function confetti(canvas: HTMLCanvasElement | null) {
  if (!canvas) return
  const x = canvas.getContext('2d'); if (!x) return
  const w = canvas.width = canvas.clientWidth || 600, h = canvas.height = canvas.clientHeight || 200
  const colors = ['#82e7bd', '#ff4fd8', '#38e1ff', '#f6d36b']
  const bits = Array.from({ length: 90 }, () => ({ x: w / 2, y: h / 3, vx: (Math.random() - .5) * 9, vy: -Math.random() * 7 - 2, c: colors[Math.floor(Math.random() * 4)], s: 3 + Math.random() * 4 }))
  let frame = 0
  const tick = () => {
    x.clearRect(0, 0, w, h)
    for (const b of bits) { b.x += b.vx; b.y += b.vy; b.vy += .25; x.fillStyle = b.c; x.fillRect(b.x, b.y, b.s, b.s) }
    if (++frame < 90 && document.visibilityState === 'visible') requestAnimationFrame(tick); else x.clearRect(0, 0, w, h)
  }
  requestAnimationFrame(tick)
}

