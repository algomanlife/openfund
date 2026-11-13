import { dirOf, intlLocale, normalizeLocale, pick } from '../../i18n/locales'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiFetch, useSession } from '../../session/useOpenfundSession'
import './purchase.css'

/**
 * Prop product page — evaluation reviews, funded-account reward eligibility,
 * reward requests and their history.
 * Data: GET /rewards/status, GET/POST /withdrawals (session-scoped).
 * Every amount is computed by the server from the account's realized
 * profit and its frozen rules; the page never sends an amount. Payouts are
 * reviewed and paid manually: nothing here implies an automatic transfer.
 */
interface WithdrawalRow {
  id: string, amount_usd: string, status: string, note: string | null,
  requested_at: string, reviewed_at: string | null, payout_ref: string | null,
  challenge_id: string | null, plan_name: string | null
}
interface Check { key: string, ok: boolean, [detail: string]: unknown }
interface Eligibility { eligible: boolean, cycle: string | null, checks: Check[], splitPct: number, grossProfit: string, reward: string, deducted?: string, deductions?: { kind: string, amount: string }[] }
interface CycleOption { key: string, splitPct: number, firstAfterDays: number | null, everyDays: number | null, consistencyPct: number | null, profitableDays: number | null, profitableDayPct: number | null, strikeLossPct: number | null }
interface Funded { id: string, planName: string, accountSizeUsd: string, balance: string, fundedFrom: string | null, rewardCycle: string | null, legacyTerms?: boolean, strikes?: number, eligibility: Eligibility[], feeRefund?: { amount_usd: string, status: string, payout_ref: string | null } | null }
interface Awaiting { id: string, planName: string, accountSizeUsd: string, cycles: CycleOption[] }
interface Review { id: string, planName: string, accountSizeUsd: string, review: 'under_review' | 'approved' | 'rejected', decidedAt: string | null, note: string | null, fundedChallengeId: string | null }

const STATUS_CLASS: Record<string, string> = {
  requested: 'pending', approved: 'approved', paid: 'paid', rejected: 'cancelled', cancelled: 'cancelled'
}

export default function WithdrawalsPage() {
  const { locale: routeLocale } = useParams()
  const locale = normalizeLocale(routeLocale, 'fa')
  const t = (fa: string, en: string) => pick(locale, fa, en)
  const session = useSession()
  const [rows, setRows] = useState<WithdrawalRow[] | null>(null)
  const [status, setStatus] = useState<{ reviews: Review[], awaitingCycle?: Awaiting[], funded: Funded[] } | null>(null)
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const statusLabel: Record<string, string> = {
    requested: t('در حال بررسی', 'Under review'), approved: t('تأییدشده — در انتظار پرداخت', 'Approved — payout pending'),
    paid: t('پرداخت‌شده', 'Paid'), rejected: t('ردشده', 'Rejected'), cancelled: t('لغوشده', 'Cancelled'),
  }
  const checkLabel: Record<string, string> = {
    reward_plan: t('پلن دارای پاداش', 'Plan pays rewards'),
    flat_account: t('همهٔ پوزیشن‌ها و سفارش‌ها بسته', 'All positions and orders closed'),
    profit: t('سود خالص تحقق‌یافته', 'Realized net profit'),
    minimum_request: t('حداقل مبلغ درخواست', 'Minimum request'),
    waiting_period: t('دورهٔ انتظار', 'Waiting period'),
    consistency: t('امتیاز ثبات', 'Consistency score'),
    profitable_days: t('روزهای سودده', 'Profitable days'),
    cycle: t('چرخهٔ پاداش', 'Reward cycle'),
    reward_cycle_selected: t('چرخهٔ پاداش انتخاب‌شده', 'Reward cycle selected'),
    strikes: t('اخطارهای ایدهٔ معاملاتی', 'Trade-idea strikes'),
    news_calendar_verified: t('تقویم اخبار تأییدشده برای این دوره', 'Verified news calendar for this period'),
  }
  const cycleLabel = (c: string | null) => c === 'monthly' ? t('ماهانه', 'Monthly') : c === 'weekly' ? t('هفتگی', 'Weekly')
    : c === 'on_demand' ? t('درخواستی', 'On demand') : t('دوهفته‌ای', 'Bi-weekly')
  const cycleTerms = (c: CycleOption) => c.firstAfterDays != null
    ? t(`نخستین درخواست ${c.firstAfterDays} روز پس از اولین معامله، سپس هر ${c.everyDays} روز`, `First request ${c.firstAfterDays} days after the first trade, then every ${c.everyDays} days`)
    : t(`بدون انتظار؛ ثبات ${c.consistencyPct}٪، ${c.profitableDays} روز سودده (هر روز ≥ ${c.profitableDayPct}٪) و سامانهٔ اخطار`, `No waiting period; ${c.consistencyPct}% consistency, ${c.profitableDays} profitable days (each ≥ ${c.profitableDayPct}%) and the strike system`)

  const load = async () => {
    const [w, s] = await Promise.all([apiFetch('/withdrawals').catch(() => null), apiFetch('/rewards/status').catch(() => null)])
    if (w?.ok) setRows(w.data?.withdrawals || [])
    if (s?.ok) setStatus(s.data)
    if (!w?.ok || !s?.ok) setError(t('دریافت اطلاعات پاداش ناموفق بود.', 'Could not load reward information.'))
  }

  useEffect(() => {
    if (session.status !== 'authenticated') { setRows(null); setStatus(null); return }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status])

  const request = async (challengeId: string, cycle: string) => {
    setBusy(true); setError(null); setNotice(null)
    try {
      const r = await apiFetch('/withdrawals', { method: 'POST', body: JSON.stringify({ challengeId, cycle }) })
      if (!r.ok) {
        setError(r.data?.error === 'not_eligible' ? t('شرایط درخواست هنوز کامل نیست.', 'The request conditions are not met yet.')
          : r.data?.error === 'reward_request_open' ? t('برای این حساب یک درخواست باز وجود دارد.', 'This account already has an open request.')
            : t('ثبت درخواست ناموفق بود.', 'Could not submit request.'))
      } else {
        setNotice(t('درخواست پاداش ثبت شد و در صف بررسی است. پرداخت دستی انجام می‌شود و تا ثبت مرجع پرداخت، «پرداخت‌شده» نمایش داده نمی‌شود.',
          'Reward request recorded and queued for review. Payouts are made manually and are never shown as paid before a payout reference is recorded.'))
      }
      await load()
    } finally { setBusy(false) }
  }

  const selectCycle = async (id: string) => {
    const cycle = choice[id]
    if (!cycle) return
    setBusy(true); setError(null); setNotice(null)
    try {
      const r = await apiFetch(`/rewards/accounts/${id}/cycle`, { method: 'POST', body: JSON.stringify({ cycle }) })
      if (!r.ok) setError(t('ثبت چرخهٔ پاداش ناموفق بود.', 'Could not save the reward cycle.'))
      else setNotice(t('چرخهٔ پاداش ثبت شد و حساب فاندشدهٔ دمو فعال است. این انتخاب دیگر تغییر نمی‌کند.', 'Reward cycle saved and the funded demo account is active. This choice cannot be changed.'))
      await load()
    } finally { setBusy(false) }
  }

  const cancel = async (id: string) => {
    setBusy(true)
    try {
      await apiFetch(`/withdrawals/${id}/cancel`, { method: 'POST', body: '{}' })
      await load()
    } finally { setBusy(false) }
  }

  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString(intlLocale(locale)) : '—')
  const fmtMoney = (v: string | number) => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const checkDetail = (c: Check) => {
    if (c.key === 'waiting_period' && !c.ok) return c.opensAt ? `${t('باز می‌شود', 'opens')} ${fmtDate(String(c.opensAt))}` : t('پس از اولین معامله', 'after the first funded trade')
    if (c.key === 'minimum_request') return fmtMoney(String(c.minimum))
    if (c.key === 'consistency') return `${c.sharePct}% / ${c.limitPct}%`
    if (c.key === 'profitable_days') return `${c.count} / ${c.required}`
    if (c.key === 'flat_account' && !c.ok) return `${c.openPositions} / ${c.pendingOrders}`
    return ''
  }

  if (session.status !== 'authenticated') {
    return (
      <div className="of-purchase-page">
        <h2>{t('پاداش و برداشت', 'Rewards & Withdrawals')}</h2>
        <div className="of-empty">
          <p>{t('برای مدیریت پاداش‌ها، کیف پول را وصل و وارد شو.', 'Connect and sign in with your wallet to manage rewards.')}</p>
          <button className="button" onClick={() => (window as any).__ofOpenConnect?.()}>{t('اتصال کیف پول', 'Connect wallet')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="of-purchase-page" dir={dirOf(locale)}>
      <h2>{t('پاداش و برداشت', 'Rewards & Withdrawals')}</h2>
      <p className="of-page-note">{t(
        'حساب‌ها شبیه‌سازی‌شده‌اند. پاداش از سود خالص تحقق‌یافتهٔ حساب فاندشده و طبق قوانین ثبت‌شدهٔ همان حساب محاسبه می‌شود؛ هر درخواست به‌صورت دستی بررسی و پرداخت می‌شود.',
        'Accounts are simulated. Rewards are calculated from the funded account’s realized net profit under the rules recorded for that account; every request is reviewed and paid manually.')}
        {' '}<Link to={`/${locale}/rulebook`}>{t('قوانین', 'Rulebook')}</Link> · <Link to={`/${locale}/contact`}>{t('پشتیبانی', 'Support')}</Link>
      </p>
      {error && <p className="of-profile-error" role="alert">{error}</p>}
      {notice && <p className="of-page-note" role="status">{notice}</p>}

      {status && status.reviews.length > 0 && <section className="of-reward-block">
        <h3>{t('بررسی ارزیابی‌های قبول‌شده', 'Passed evaluation review')}</h3>
        <ul className="of-reward-list">
          {status.reviews.map(r => <li key={r.id}>
            <span>{r.planName} · <bdi dir="ltr">{fmtMoney(r.accountSizeUsd)}</bdi></span>
            <span className={`of-status-pill of-status-${r.review === 'approved' ? 'approved' : r.review === 'rejected' ? 'cancelled' : 'pending'}`}>
              {r.review === 'approved' ? t('تأییدشده — حساب فاندشدهٔ دمو فعال است', 'Approved — funded demo account active')
                : r.review === 'rejected' ? t('ردشده', 'Rejected') : t('در انتظار بررسی دستی', 'Awaiting manual review')}
            </span>
            {r.review === 'rejected' && r.note && <small>{r.note}</small>}
          </li>)}
        </ul>
        <p className="of-page-note">{t('هر ارزیابی قبول‌شده پیش از فعال‌شدن حساب فاندشدهٔ دمو به‌صورت دستی بررسی می‌شود. این حساب با موجودی مجازی اولیه شروع می‌شود و سرمایهٔ واقعی تخصیص نمی‌یابد.',
          'Every passed evaluation is reviewed manually before a funded demo account is activated. That account restarts at the starting virtual balance; no real trading capital is allocated.')}</p>
      </section>}

      {status && (status.awaitingCycle || []).map(a => <section className="of-reward-block" key={a.id}>
        <h3>{a.planName} · <bdi dir="ltr">{fmtMoney(a.accountSizeUsd)}</bdi> — {t('انتخاب چرخهٔ پاداش', 'Choose your reward cycle')}</h3>
        <p className="of-page-note">{t('حساب فاندشدهٔ دموی تو آماده است. یک چرخهٔ پاداش را یک بار انتخاب کن؛ حساب پس از انتخاب فعال می‌شود و چرخه دیگر تغییر نمی‌کند.',
          'Your funded demo account is ready. Choose one reward cycle, once: the account starts after the choice and the cycle can never be changed.')}</p>
        <fieldset className="of-reward-cycles">
          <legend className="sr-only">{t('چرخهٔ پاداش', 'Reward cycle')}</legend>
          {a.cycles.map(c => <label key={c.key} data-selected={choice[a.id] === c.key}>
            <input type="radio" name={`cycle-${a.id}`} value={c.key} checked={choice[a.id] === c.key} onChange={() => setChoice(x => ({ ...x, [a.id]: c.key }))} />
            <strong>{cycleLabel(c.key)} · {c.splitPct}%</strong> <small>{cycleTerms(c)}</small>
          </label>)}
        </fieldset>
        <button className="button" disabled={busy || !choice[a.id]} onClick={() => selectCycle(a.id)}>{t('ثبت قطعی چرخه و فعال‌سازی', 'Confirm cycle and activate')}</button>
      </section>)}

      {status && status.funded.map(f => <section className="of-reward-block" key={f.id}>
        <h3>{f.planName} · <bdi dir="ltr">{fmtMoney(f.accountSizeUsd)}</bdi> — {t('موجودی', 'Balance')} <bdi dir="ltr">{fmtMoney(f.balance)}</bdi></h3>
        {f.eligibility.map(e => <div className="of-reward-cycle" key={e.cycle}>
          <div className="of-reward-head">
            <strong>{cycleLabel(e.cycle)} · {e.splitPct}%</strong>
            <span dir="ltr">{fmtMoney(e.reward)}{Number(e.deducted || 0) > 0 ? ` (−${fmtMoney(e.deducted!)} ${t('کسر', 'deducted')})` : ''}</span>
            <button className="button" disabled={busy || !e.eligible} onClick={() => request(f.id, e.cycle)}>
              {e.eligible ? t('درخواست پاداش', 'Request reward') : t('هنوز واجد شرایط نیست', 'Not eligible yet')}
            </button>
          </div>
          <ul className="of-reward-checks">
            {e.checks.map(c => <li key={c.key} data-ok={c.ok}>
              <span aria-hidden="true">{c.ok ? '✓' : '○'}</span> {checkLabel[c.key] || c.key} <small dir="ltr">{checkDetail(c)}</small>
              <span className="sr-only">{c.ok ? t('برقرار', 'met') : t('برقرار نیست', 'not met')}</span>
            </li>)}
          </ul>
        </div>)}
      </section>)}

      {status && status.funded.some(f => f.feeRefund) && <p className="of-page-note">{t('بازپرداخت هزینهٔ چلنج با پرداخت چهارمین پاداش ثبت شده است و به‌صورت دستی پرداخت می‌شود.', 'The challenge fee refund was recorded with the fourth paid reward and is paid manually.')}</p>}

      {status && status.funded.length === 0 && status.reviews.length === 0 && !(status.awaitingCycle || []).length && <p className="of-empty">{t(
        'هنوز حساب فاندشده‌ای نداری. پاداش پس از قبولی در ارزیابی و تأیید دستی، یا روی حساب آنی، قابل درخواست است.',
        'You have no funded account yet. Rewards become available after a passed and approved evaluation, or on an Instant account.')}</p>}

      <h3>{t('تاریخچهٔ درخواست‌ها', 'Request history')}</h3>
      {rows && rows.length === 0 && <p className="of-empty">{t('هنوز درخواستی نداری.', 'No withdrawal requests yet.')}</p>}
      {rows && rows.length > 0 && (
        <div className="of-table-scroll" role="region" tabIndex={0} aria-label={t('تاریخچهٔ درخواست‌ها', 'Request history')}>
          <table className="of-purchase-table">
            <thead>
              <tr>
                <th>{t('مبلغ', 'Amount')}</th>
                <th>{t('وضعیت', 'Status')}</th>
                <th>{t('چلنج', 'Challenge')}</th>
                <th>{t('تاریخ درخواست', 'Requested')}</th>
                <th>{t('تاریخ بررسی', 'Reviewed')}</th>
                <th>{t('مرجع پرداخت', 'Payout reference')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(w => (
                <tr key={w.id}>
                  <td dir="ltr">{fmtMoney(w.amount_usd)}</td>
                  <td><span className={`of-status-pill of-status-${STATUS_CLASS[w.status] || 'pending'}`}>{statusLabel[w.status] || w.status}</span></td>
                  <td>{w.plan_name || '—'}</td>
                  <td>{fmtDate(w.requested_at)}</td>
                  <td>{fmtDate(w.reviewed_at)}</td>
                  <td dir="ltr">{w.status === 'paid' ? (w.payout_ref || '—') : '—'}</td>
                  <td>{w.status === 'requested' && (
                    <button className="of-profile-plainbtn" disabled={busy} onClick={() => cancel(w.id)}>{t('لغو', 'Cancel')}</button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
