import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { text, tx } from '../information/content'
import { pickFormat, intlLocale, type AppLocale } from '../../i18n/locales'
import { apiFetch, backendUrl, useSession } from '../../session/useOpenfundSession'
import MigrationHero from './MigrationHero'
import DirArrow from '../../ui/DirArrow'
import './migration.css'

/* /:locale/migrate — Migration to Openfund (ADR 0051). The rules, the firm
   list and whether requests are open come from the backend; nothing is
   collected until private evidence storage is configured. */
type L = { en: string; fa: string }
const c = {
  eyebrow: text('Migration to Openfund', 'مهاجرت به اوپن‌فاند'),
  title: text('Funded elsewhere? Start at the funded stage.', 'جای دیگر فاند شده‌ای؟ از مرحلهٔ فاند شروع کن.'),
  intro: text('Proven funded trader? Skip evaluation with three verified payouts.', 'معامله‌گر فاندشدهٔ اثبات‌شده‌ای؟ با سه برداشت تأییدشده از ارزیابی عبور کن.'),
  start: text('Start migration', 'شروع مهاجرت'), how: text('How it works', 'روند کار'),
  compareTitle: text('Two ways to a funded account', 'دو راه تا حساب فاندشده'),
  normal: text('Normal path', 'مسیر عادی'), migration: text('Migration path', 'مسیر مهاجرت'),
  rowStart: text('Starts at', 'شروع از'), rowStartN: text('Evaluation (stage 1)', 'ارزیابی (مرحلهٔ ۱)'), rowStartM: text('Funded stage', 'مرحلهٔ فاند'),
  rowPrice: text('Price', 'قیمت'), rowPriceBoth: text('The normal plan price', 'قیمت عادی پلن'),
  rowRules: text('Funded rules', 'قوانین مرحلهٔ فاند'), rowRulesBoth: text('The plan’s normal funded rules', 'قوانین عادی مرحلهٔ فاند پلن'),
  rowNeeds: text('You need', 'نیاز داری'), rowNeedsN: text('To pass the evaluation', 'قبولی در ارزیابی'),
  rowNeedsM: text('Proof of ${n} payouts in ${m} months and of the funded account', 'اثبات ${n} برداشت در ${m} ماه و اثبات حساب فاندشده'),
  rowSize: text('Account size', 'اندازهٔ حساب'), rowSizeN: text('Any size of the plan', 'هر اندازهٔ پلن'), rowSizeM: text('Up to your largest proven funded size', 'تا بزرگ‌ترین حساب فاندشدهٔ اثبات‌شده'),
  stepsTitle: text('Steps', 'مراحل'),
  s1: text('Request', 'درخواست'), s1b: text('Choose your firm and your largest funded account size.', 'شرکت و بزرگ‌ترین اندازهٔ حساب فاندشده‌ات را انتخاب کن.'),
  s2: text('Upload', 'بارگذاری'), s2b: text('Add evidence; the checklist shows what is still missing.', 'مدارک را اضافه کن؛ فهرست بررسی نشان می‌دهد چه چیزی کم است.'),
  s3: text('Review', 'بازبینی'), s3b: text('A reviewer checks every item. No identity documents: your wallet is your account.', 'بازبین همهٔ موارد را بررسی می‌کند. مدرک هویتی لازم نیست: کیف پول تو، حساب توست.'),
  s4: text('Decision', 'تصمیم'), s4b: text('Approval or rejection, always with a reason.', 'تأیید یا رد، همیشه با دلیل.'),
  s5: text('Buy', 'خرید'), s5b: text('Checkout’s Migration path uses your single-use pass.', 'مسیر مهاجرت در صفحهٔ خرید از مجوز یک‌بارمصرف تو استفاده می‌کند.'),
  evidenceTitle: text('Accepted evidence', 'مدارک پذیرفته‌شده'),
  e1: text('Payout certificate verification links or QR codes on the firm’s site', 'لینک یا QR تأیید گواهی برداشت در سایت شرکت'),
  e2: text('On-chain payout transaction hashes (checked automatically where the chain is supported)', 'هش تراکنش برداشت روی زنجیره (در زنجیره‌های پشتیبانی‌شده خودکار بررسی می‌شود)'),
  e3: text('Bank or payment-provider statements', 'صورت‌حساب بانک یا ارائه‌دهندهٔ پرداخت'),
  e4: text('A screen recording of a live login showing the account and payout history', 'فیلم صفحه از ورود زنده که حساب و سابقهٔ برداشت را نشان دهد'),
  privacy: text('Files are stored privately and encrypted, opened only by reviewers through links that expire in minutes, and deleted ${d} days after the decision.', 'فایل‌ها خصوصی و رمزنگاری‌شده نگهداری می‌شوند، فقط بازبین‌ها با لینک‌هایی که چند دقیقه بعد منقضی می‌شوند آن‌ها را باز می‌کنند و ${d} روز پس از تصمیم حذف می‌شوند.'),
  firmsTitle: text('Accepted firms', 'شرکت‌های پذیرفته‌شده'),
  officialSite: text('Official site', 'سایت رسمی'), programs: text('Accepted programs', 'برنامه‌های پذیرفته‌شده'), firmEvidence: text('Evidence the firm provides', 'مدارکی که شرکت ارائه می‌دهد'),
  email: text('Email for updates on your request', 'ایمیل برای اطلاع از وضعیت درخواست'),
  notAffiliated: text('Openfund is not affiliated with any of the firms listed. Their names are used only to identify where your account is.', 'اوپن‌فاند به هیچ‌یک از شرکت‌های فهرست‌شده وابسته نیست. نام آن‌ها فقط برای مشخص کردن محل حساب تو آمده است.'),
  requestTitle: text('Your migration', 'مهاجرت تو'),
  soon: text('Migration requests are opening soon.', 'درخواست مهاجرت به‌زودی باز می‌شود.'),
  soonBody: text('Requests open once private evidence storage is ready. Nothing is collected before then.', 'درخواست‌ها پس از آماده شدن فضای خصوصی نگهداری مدارک باز می‌شوند. تا آن زمان اطلاعاتی دریافت نمی‌شود.'),
  connect: text('Connect wallet', 'اتصال کیف پول'), signIn: text('Sign in with your wallet', 'ورود با کیف پول'),
  firm: text('Prop firm', 'شرکت تأمین سرمایه'), size: text('Largest funded account size (USD)', 'بزرگ‌ترین اندازهٔ حساب فاندشده (دلار)'),
  fullName: text('Name on your account at the firm', 'نام روی حساب تو در آن شرکت'),
  create: text('Create request', 'ثبت درخواست'),
  checklist: text('Checklist', 'فهرست بررسی'),
  cFunded: text('Funded account proof (screenshot or recording)', 'اثبات حساب فاندشده (تصویر یا فیلم)'),
  cPayouts: text('${have} of ${need} payouts in the last ${m} months', '${have} از ${need} برداشت در ${m} ماه اخیر'),
  addFile: text('Upload a file', 'بارگذاری فایل'), kind: text('Type', 'نوع'),
  kFunded: text('Funded account proof', 'اثبات حساب فاندشده'), kStatement: text('Payout statement', 'صورت‌حساب برداشت'),
  kRecording: text('Screen recording', 'فیلم صفحه'), kCertificate: text('Payout certificate', 'گواهی برداشت'), kTx: text('On-chain payout', 'برداشت روی زنجیره'),
  payoutDate: text('Payout date', 'تاریخ برداشت'), amount: text('Amount (USD, optional)', 'مبلغ (دلار، اختیاری)'),
  file: text('File (PDF, PNG, JPEG, WebP up to 10 MB; MP4 or WebM up to 40 MB)', 'فایل (PDF، PNG، JPEG، WebP تا ۱۰ مگابایت؛ MP4 یا WebM تا ۴۰ مگابایت)'),
  upload: text('Upload', 'بارگذاری'),
  addLink: text('Add a certificate link or transaction', 'افزودن لینک گواهی یا تراکنش'),
  url: text('Certificate verification link (https)', 'لینک تأیید گواهی (https)'), chain: text('Chain', 'زنجیره'), tx: text('Transaction hash', 'هش تراکنش'),
  add: text('Add', 'افزودن'), remove: text('Remove', 'حذف'),
  verified: text('verified on-chain', 'روی زنجیره تأیید شد'), notVerified: text('not verified automatically', 'به‌صورت خودکار تأیید نشد'),
  submit: text('Submit for review', 'ارسال برای بازبینی'), withdraw: text('Withdraw request', 'لغو درخواست'),
  status: text('Status', 'وضعیت'),
  stDraft: text('Draft: add evidence, then submit.', 'پیش‌نویس: مدارک را اضافه و سپس ارسال کن.'),
  stSubmitted: text('In review. We will decide and give a reason.', 'در حال بازبینی. تصمیم همراه با دلیل اعلام می‌شود.'),
  stApproved: text('Approved. Your single-use pass is ready.', 'تأیید شد. مجوز یک‌بارمصرف تو آماده است.'),
  stRejected: text('Not approved.', 'تأیید نشد.'), stWithdrawn: text('Withdrawn.', 'لغو شد.'),
  passLine: text('Pass: ${plans}, up to ${size}, valid until ${date}.', 'مجوز: ${plans}، تا ${size}، معتبر تا ${date}.'),
  passUsed: text('Your pass has been used for a purchase.', 'مجوز تو برای یک خرید استفاده شده است.'),
  buy: text('Buy with my migration pass', 'خرید با مجوز مهاجرت'),
  reason: text('Reason', 'دلیل'),
  faqTitle: text('Questions', 'پرسش‌ها'),
  q1: text('Is migration cheaper?', 'آیا مهاجرت ارزان‌تر است؟'), a1: text('No. You pay the normal plan price; you skip the evaluation and start with the plan’s normal funded rules.', 'خیر. قیمت عادی پلن را می‌پردازی؛ از ارزیابی عبور می‌کنی و با قوانین عادی مرحلهٔ فاند شروع می‌کنی.'),
  q2: text('Which plans can I buy?', 'کدام پلن‌ها را می‌توانم بخرم؟'), a2: text('Standard or One-phase, at a size no larger than your largest proven funded account.', 'استاندارد یا تک‌مرحله‌ای، با اندازه‌ای نه بزرگ‌تر از بزرگ‌ترین حساب فاندشدهٔ اثبات‌شده.'),
  q3: text('Can I migrate twice?', 'آیا می‌توانم دو بار مهاجرت کنم؟'), a3: text('No. One migration per person. If a request is rejected you may apply again with better evidence.', 'خیر. هر نفر یک بار. اگر درخواستی رد شود می‌توانی با مدارک کامل‌تر دوباره درخواست بدهی.'),
  errors: text('Something went wrong. Please try again.', 'مشکلی پیش آمد. دوباره تلاش کن.'),
}
const ERR: Record<string, L> = {
  invalid_firm: text('Choose a firm.', 'یک شرکت انتخاب کن.'), invalid_size: text('Enter a valid account size.', 'اندازهٔ حساب معتبر وارد کن.'),
  invalid_name: text('Enter your full name.', 'نام کامل را وارد کن.'), invalid_email: text('Enter a valid email address.', 'ایمیل معتبر وارد کن.'), already_migrated: text('You have already migrated once.', 'تو قبلاً یک بار مهاجرت کرده‌ای.'),
  request_exists: text('You already have an open request.', 'یک درخواست باز داری.'), invalid_date: text('Enter the payout date.', 'تاریخ برداشت را وارد کن.'),
  invalid_url: text('Use an https link.', 'از لینک https استفاده کن.'), invalid_tx_hash: text('That transaction hash is not valid.', 'هش تراکنش معتبر نیست.'),
  tx_already_used: text('That transaction is already part of a request.', 'این تراکنش قبلاً در درخواستی آمده است.'),
  file_type_not_accepted: text('That file type is not accepted.', 'این نوع فایل پذیرفته نمی‌شود.'), file_type_mismatch: text('The file content does not match its type.', 'محتوای فایل با نوع آن هم‌خوان نیست.'),
  file_too_large: text('The file is too large.', 'حجم فایل بیش از حد مجاز است.'), file_active_content: text('PDFs with scripts or embedded files are not accepted.', 'PDF دارای اسکریپت یا فایل جاسازی‌شده پذیرفته نمی‌شود.'),
  checklist_incomplete: text('The checklist is not complete yet.', 'فهرست بررسی هنوز کامل نیست.'), migration_opening_soon: text('Migration requests are opening soon.', 'درخواست مهاجرت به‌زودی باز می‌شود.'),
}
interface Firm { id: string; name: string; websiteUrl: string | null; programTypes: string[]; evidenceTypes: string[]; logoUrl: string | null }
interface Config { open: boolean; firms: Firm[]; rules: { minPayouts: number; windowMonths: number; plans: string[]; retentionDays: number } }
interface Evidence { id: string; kind: string; payoutDate: string | null; amountUsd: string | null; url: string | null; txHash: string | null; file: { contentType: string; sizeBytes: number } | null; verification: { verified: boolean | null } | null }
interface Me { open: boolean; request: null | { id: string; status: string; firm: string; claimedMaxSizeUsd: string; approvedMaxSizeUsd: string | null; decisionReason: string | null }
  evidence?: Evidence[]; checklist?: { fundedAccount: boolean; payouts: boolean; payoutCount: number; minPayouts: number; windowMonths: number; complete: boolean }
  pass?: { id: string; plans: string[]; maxSizeUsd: string; status: string; expiresAt: string } | null }

export default function MigratePage() {
  const locale = useInformationLocale()
  const t = (v: L) => tx(locale, v)
  const [config, setConfig] = useState<Config | null>(null)
  useEffect(() => { void fetch(`${backendUrl()}/migration/config`).then(r => (r.ok ? r.json() : null)).then(setConfig).catch(() => setConfig(null)) }, [])
  const rules = config?.rules ?? { minPayouts: 3, windowMonths: 12, plans: ['standard', 'one-phase'], retentionDays: 90 }
  const num = (v: number) => new Intl.NumberFormat(intlLocale(locale)).format(v)
  return <InformationShell page="migrate" description={t(c.intro)} title={`${t(c.eyebrow)} | Openfund`}>
    <section className="mg-hero" id="top">
      <MigrationHero />
      <div className="mg-hero-copy container">
        <p className="mg-eyebrow">{t(c.eyebrow)}</p>
        <h1>{t(c.title)}</h1>
        <p className="mg-intro">{t(c.intro)}</p>
        <div className="hero-actions"><a className="button" href="#mg-request">{t(c.start)} <DirArrow kind="down" /></a><a className="text-link" href="#mg-steps">{t(c.how)} <DirArrow kind="down" /></a></div>
      </div>
    </section>

    <section className="container mg-section" aria-labelledby="mg-compare">
      <h2 id="mg-compare">{t(c.compareTitle)}</h2>
      <div className="info-table-wrap"><table className="mg-compare">
        <thead><tr><th scope="col"><span className="sr-only">{t(c.rowStart)}</span></th><th scope="col">{t(c.normal)}</th><th scope="col" className="is-migration">{t(c.migration)}</th></tr></thead>
        <tbody>
          <tr><th scope="row">{t(c.rowStart)}</th><td>{t(c.rowStartN)}</td><td className="is-migration">{t(c.rowStartM)}</td></tr>
          <tr><th scope="row">{t(c.rowNeeds)}</th><td>{t(c.rowNeedsN)}</td><td className="is-migration">{pickFormat(locale, c.rowNeedsM.fa, c.rowNeedsM.en, { n: num(rules.minPayouts), m: num(rules.windowMonths) })}</td></tr>
          <tr><th scope="row">{t(c.rowPrice)}</th><td>{t(c.rowPriceBoth)}</td><td className="is-migration">{t(c.rowPriceBoth)}</td></tr>
          <tr><th scope="row">{t(c.rowRules)}</th><td>{t(c.rowRulesBoth)}</td><td className="is-migration">{t(c.rowRulesBoth)}</td></tr>
          <tr><th scope="row">{t(c.rowSize)}</th><td>{t(c.rowSizeN)}</td><td className="is-migration">{t(c.rowSizeM)}</td></tr>
        </tbody></table></div>
    </section>

    <section className="container mg-section" id="mg-steps" aria-labelledby="mg-steps-title">
      <h2 id="mg-steps-title">{t(c.stepsTitle)}</h2>
      <ol className="mg-steps">{[[c.s1, c.s1b], [c.s2, c.s2b], [c.s3, c.s3b], [c.s4, c.s4b], [c.s5, c.s5b]].map(([h, b], i) =>
        <li key={i}><span aria-hidden="true">{new Intl.NumberFormat(intlLocale(locale)).format(i + 1)}</span><b>{t(h)}</b><p>{t(b)}</p></li>)}</ol>
    </section>

    <section className="container mg-section" aria-labelledby="mg-evidence">
      <h2 id="mg-evidence">{t(c.evidenceTitle)}</h2>
      <ul className="mg-evidence">{[c.e1, c.e2, c.e3, c.e4].map((e, i) => <li key={i}>{t(e)}</li>)}</ul>
      <p className="mg-note">{pickFormat(locale, c.privacy.fa, c.privacy.en, { d: num(rules.retentionDays) })}</p>
    </section>

    {config?.firms.length ? <section className="container mg-section" aria-labelledby="mg-firms">
      <h2 id="mg-firms">{t(c.firmsTitle)}</h2>
      <ul className="mg-firms">{config.firms.map(f => <li key={f.id} className="mg-firm">
        {f.logoUrl ? <img className="mg-firm-logo" src={`${backendUrl()}${f.logoUrl}`} alt="" width="48" height="48" loading="lazy" /> : <Monogram name={f.name} />}
        <div>
          <h3>{f.name}</h3>
          {f.websiteUrl && <a className="text-link" href={f.websiteUrl} target="_blank" rel="noopener noreferrer nofollow" dir="ltr">{t(c.officialSite)} <DirArrow kind="external" /></a>}
          {f.programTypes.length > 0 && <p><b>{t(c.programs)}:</b> <span dir="auto">{f.programTypes.join(' · ')}</span></p>}
          {f.evidenceTypes.length > 0 && <p><b>{t(c.firmEvidence)}:</b> <span dir="auto">{f.evidenceTypes.join(' · ')}</span></p>}
        </div>
      </li>)}</ul>
      <p className="mg-note">{t(c.notAffiliated)}</p>
    </section> : <section className="container mg-section"><p className="mg-note">{t(c.notAffiliated)}</p></section>}

    <RequestPanel locale={locale} t={t} config={config} />

    <section className="container mg-section" aria-labelledby="mg-faq">
      <h2 id="mg-faq">{t(c.faqTitle)}</h2>
      {[[c.q1, c.a1], [c.q2, c.a2], [c.q3, c.a3]].map(([q, a], i) => <details key={i} className="mg-faq"><summary>{t(q)}</summary><p>{t(a)}</p></details>)}
      <p><Link className="text-link" to={`/${locale}/challenges`}>{t(c.normal)} <DirArrow kind="forward" /></Link></p>
    </section>
  </InformationShell>
}

function RequestPanel({ locale, t, config }: { locale: AppLocale; t: (v: L) => string; config: Config | null }) {
  const session = useSession()
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const authenticated = session.status === 'authenticated'
  const load = useCallback(async () => { if (!authenticated) { setMe(null); return } const r = await apiFetch('/migration/me'); if (r.ok) setMe(r.data) }, [authenticated])
  useEffect(() => { void load() }, [load])
  const fail = (code?: string) => setError(t(ERR[code ?? ''] ?? c.errors))
  const act = async (fn: () => Promise<{ ok: boolean; data: { error?: string } | null }>) => {
    setBusy(true); setError('')
    try { const r = await fn(); if (!r.ok) fail(r.data?.error); else await load() } catch { fail() } finally { setBusy(false) }
  }
  const money = (v: string | number) => new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v))
  let body: ReactNode
  if (!config) body = null
  else if (!config.open && !me?.request) body = <div className="mg-card"><h3>{t(c.soon)}</h3><p>{t(c.soonBody)}</p></div>
  else if (!authenticated) body = <div className="mg-card">{session.status === 'unauthenticated'
    ? <button type="button" className="button" onClick={() => void session.signIn()}>{t(c.signIn)}</button>
    : <button type="button" className="button" onClick={() => (window as Window & { __ofOpenConnect?: () => void }).__ofOpenConnect?.()}>{t(c.connect)}</button>}</div>
  else if (!me) body = null
  else if (!me.request || ['rejected', 'withdrawn'].includes(me.request.status) && !me.pass) body = <>
    {me.request && <Status t={t} me={me} money={money} locale={locale} />}
    <CreateForm t={t} config={config} busy={busy} onCreate={b => act(() => apiFetch('/migration/requests', { method: 'POST', body: JSON.stringify(b) }))} />
  </>
  else body = <>
    <Status t={t} me={me} money={money} locale={locale} />
    {me.request.status === 'draft' && <Evidence t={t} me={me} busy={busy} act={act} locale={locale} />}
  </>
  return <section className="container mg-section" id="mg-request" aria-labelledby="mg-request-title">
    <h2 id="mg-request-title">{t(c.requestTitle)}</h2>
    {body}
    {error && <p role="alert" className="mg-error">{error}</p>}
  </section>
}

/* an original monogram badge for a firm without an uploaded logo (never a recreation of its logo) */
function Monogram({ name }: { name: string }) {
  const words = name.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s-]+/).filter(Boolean)
  const letters = (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
  return <svg className="mg-monogram" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
    <path d="M24 3l18 10v22L24 45 6 35V13z" className="mg-monogram-shape" />
    <text x="24" y="29" textAnchor="middle">{letters}</text>
  </svg>
}

function CreateForm({ t, config, busy, onCreate }: { t: (v: L) => string; config: Config; busy: boolean; onCreate: (b: object) => void }) {
  const [firmId, setFirm] = useState(''), [size, setSize] = useState(''), [name, setName] = useState(''), [email, setEmail] = useState('')
  return <form className="mg-card mg-form" onSubmit={e => { e.preventDefault(); onCreate({ firmId, claimedMaxSizeUsd: Number(size), fullName: name, email }) }}>
    <label>{t(c.email)}<input required type="email" autoComplete="email" dir="ltr" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label>{t(c.firm)}<select required value={firmId} onChange={e => setFirm(e.target.value)}><option value="" />{config.firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
    <label>{t(c.size)}<input required type="number" min="1" step="1" dir="ltr" value={size} onChange={e => setSize(e.target.value)} /></label>
    <label>{t(c.fullName)}<input required maxLength={120} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>
    <button className="button" disabled={busy}>{t(c.create)}</button>
  </form>
}

function Status({ t, me, money, locale }: { t: (v: L) => string; me: Me; money: (v: string | number) => string; locale: AppLocale }) {
  const r = me.request!
  const line = { draft: c.stDraft, submitted: c.stSubmitted, approved: c.stApproved, rejected: c.stRejected, withdrawn: c.stWithdrawn }[r.status as 'draft'] ?? c.stDraft
  const p = me.pass
  const date = (iso: string) => new Intl.DateTimeFormat(`${intlLocale(locale)}-u-ca-gregory`, { dateStyle: 'medium' }).format(new Date(iso))
  return <div className={`mg-card mg-status is-${r.status}`} role="status">
    <p><b>{t(c.status)}:</b> {t(line)} <span className="mg-firm">{r.firm}</span></p>
    {r.status === 'rejected' && r.decisionReason && <p><b>{t(c.reason)}:</b> {r.decisionReason}</p>}
    {p && p.status === 'issued' && <>
      <p>{pickFormat(locale, c.passLine.fa, c.passLine.en, { plans: p.plans.join(' / '), size: money(p.maxSizeUsd), date: date(p.expiresAt) })}</p>
      <Link className="button" to={`/${locale}/checkout?migration=${p.id}&plan=${p.plans[0]}`}>{t(c.buy)} <DirArrow kind="forward" /></Link>
    </>}
    {p && p.status === 'redeemed' && <p>{t(c.passUsed)}</p>}
  </div>
}

function Evidence({ t, me, busy, act, locale }: { t: (v: L) => string; me: Me; locale: AppLocale; busy: boolean; act: (fn: () => Promise<{ ok: boolean; data: { error?: string } | null }>) => Promise<void> }) {
  const id = me.request!.id
  const list = me.checklist!
  const [kind, setKind] = useState('funded_account'), [date, setDate] = useState(''), [amount, setAmount] = useState('')
  const [linkKind, setLinkKind] = useState('payout_certificate'), [url, setUrl] = useState(''), [chain, setChain] = useState('42161'), [hash, setHash] = useState(''), [linkDate, setLinkDate] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const kinds: [string, L][] = [['funded_account', c.kFunded], ['statement', c.kStatement], ['recording', c.kRecording], ['payout_certificate', c.kCertificate]]
  const label = (k: string) => t(([...kinds, ['payout_tx', c.kTx]] as [string, L][]).find(([v]) => v === k)?.[1] ?? c.kFunded)
  const payout = ['statement', 'payout_certificate'].includes(kind)
  const upload = () => act(async () => {
    const f = file.current?.files?.[0]
    if (!f) return { ok: false, data: { error: 'file_type_not_accepted' } }
    const q = new URLSearchParams({ kind }); if (date) q.set('payoutDate', date); if (amount) q.set('amountUsd', amount)
    const r = await fetch(`${backendUrl()}/migration/requests/${id}/evidence/upload?${q}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': f.type || 'application/octet-stream' }, body: f })
    const data = await r.json().catch(() => null)
    if (r.ok && file.current) file.current.value = ''
    return { ok: r.ok, data }
  })
  return <>
    <div className="mg-card">
      <h3>{t(c.checklist)}</h3>
      <ul className="mg-checklist">
        <li className={list.fundedAccount ? 'is-done' : ''}>{t(c.cFunded)}</li>
        <li className={list.payouts ? 'is-done' : ''}>{pickFormat(locale, c.cPayouts.fa, c.cPayouts.en, { have: new Intl.NumberFormat(intlLocale(locale)).format(list.payoutCount), need: new Intl.NumberFormat(intlLocale(locale)).format(list.minPayouts), m: new Intl.NumberFormat(intlLocale(locale)).format(list.windowMonths) })}</li>
      </ul>
      <ul className="mg-items">{(me.evidence ?? []).map(e => <li key={e.id}>
        <span>{label(e.kind)}{e.payoutDate ? ` · ${e.payoutDate}` : ''}{e.amountUsd ? ` · $${e.amountUsd}` : ''}</span>
        {e.kind === 'payout_tx' && <small>{e.verification?.verified ? t(c.verified) : t(c.notVerified)}</small>}
        <button type="button" className="text-link" disabled={busy} onClick={() => void act(() => apiFetch(`/migration/requests/${id}/evidence/${e.id}`, { method: 'DELETE' }))}>{t(c.remove)}</button>
      </li>)}</ul>
      <div className="mg-actions">
        <button type="button" className="button" disabled={busy || !list.complete} onClick={() => void act(() => apiFetch(`/migration/requests/${id}/submit`, { method: 'POST', body: '{}' }))}>{t(c.submit)}</button>
        <button type="button" className="text-link" disabled={busy} onClick={() => void act(() => apiFetch(`/migration/requests/${id}/withdraw`, { method: 'POST', body: '{}' }))}>{t(c.withdraw)}</button>
      </div>
    </div>
    <form className="mg-card mg-form" onSubmit={e => { e.preventDefault(); void upload() }}>
      <h3>{t(c.addFile)}</h3>
      <label>{t(c.kind)}<select value={kind} onChange={e => setKind(e.target.value)}>{kinds.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select></label>
      {payout && <label>{t(c.payoutDate)}<input type="date" required dir="ltr" value={date} onChange={e => setDate(e.target.value)} /></label>}
      {payout && <label>{t(c.amount)}<input type="number" min="1" dir="ltr" value={amount} onChange={e => setAmount(e.target.value)} /></label>}
      <label>{t(c.file)}<input ref={file} type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4,.webm,application/pdf,image/png,image/jpeg,image/webp,video/mp4,video/webm" /></label>
      <button className="button" disabled={busy}>{t(c.upload)}</button>
    </form>
    <form className="mg-card mg-form" onSubmit={e => { e.preventDefault(); void act(() => apiFetch(`/migration/requests/${id}/evidence`, { method: 'POST', body: JSON.stringify(
      linkKind === 'payout_tx' ? { kind: linkKind, chainId: Number(chain), txHash: hash.trim(), payoutDate: linkDate } : { kind: linkKind, url: url.trim(), payoutDate: linkDate }) })) }}>
      <h3>{t(c.addLink)}</h3>
      <label>{t(c.kind)}<select value={linkKind} onChange={e => setLinkKind(e.target.value)}><option value="payout_certificate">{t(c.kCertificate)}</option><option value="payout_tx">{t(c.kTx)}</option></select></label>
      {linkKind === 'payout_tx'
        ? <><label>{t(c.chain)}<select value={chain} onChange={e => setChain(e.target.value)} dir="ltr">{[['1', 'Ethereum'], ['42161', 'Arbitrum'], ['8453', 'Base'], ['10', 'Optimism'], ['137', 'Polygon'], ['56', 'BNB Chain']].map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
          <label>{t(c.tx)}<input required dir="ltr" pattern="0x[0-9a-fA-F]{64}" value={hash} onChange={e => setHash(e.target.value)} /></label></>
        : <label>{t(c.url)}<input required type="url" dir="ltr" pattern="https://.*" value={url} onChange={e => setUrl(e.target.value)} /></label>}
      <label>{t(c.payoutDate)}<input type="date" required dir="ltr" value={linkDate} onChange={e => setLinkDate(e.target.value)} /></label>
      <button className="button" disabled={busy}>{t(c.add)}</button>
    </form>
  </>
}
