import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch, useSession } from '../../session/useOpenfundSession'
import './purchase.css'

/**
 * Prop product page — withdrawal requests and reward history.
 * Data: GET/POST /withdrawals (session-scoped). Requests are reviewed
 * server-side; nothing here implies automatic payout processing.
 */
interface WithdrawalRow {
  id: string, amount_usd: string, status: string, note: string | null,
  requested_at: string, reviewed_at: string | null, payout_ref: string | null,
  challenge_id: string | null, plan_name: string | null
}
interface Challenge { id: string, plan_name: string, status: string }

const STATUS_FA: Record<string, string> = {
  requested: 'در انتظار بررسی', approved: 'تأییدشده', paid: 'پرداخت‌شده',
  rejected: 'ردشده', cancelled: 'لغوشده'
}
const STATUS_CLASS: Record<string, string> = {
  requested: 'pending', approved: 'approved', paid: 'paid', rejected: 'cancelled', cancelled: 'cancelled'
}

export default function WithdrawalsPage() {
  const { locale: routeLocale } = useParams()
  const isFa = routeLocale !== 'en'
  const t = (fa: string, en: string) => (isFa ? fa : en)
  const session = useSession()
  const [rows, setRows] = useState<WithdrawalRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const r = await apiFetch('/withdrawals').catch(() => null)
    if (r?.ok) setRows(r.data?.withdrawals || [])
    else if (session.status === 'authenticated') setError(t('دریافت درخواست‌ها ناموفق بود.', 'Could not load requests.'))
  }

  useEffect(() => {
    if (session.status !== 'authenticated') { setRows(null); return }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status])

  const submit = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) { setError(t('مبلغ نامعتبر است.', 'Invalid amount.')); return }
    setBusy(true); setError(null)
    try {
      const r = await apiFetch('/withdrawals', { method: 'POST', body: JSON.stringify({ amountUsd: value, note: note.trim() || undefined }) })
      if (!r.ok) {
        setError(r.data?.error === 'invalid_amount' ? t('مبلغ نامعتبر است.', 'Invalid amount.') : t('ثبت درخواست ناموفق بود.', 'Could not submit request.'))
        return
      }
      setAmount(''); setNote('')
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

  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString(isFa ? 'fa-IR' : 'en-US') : '—')
  const fmtMoney = (v: string | number) => '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })

  if (session.status !== 'authenticated') {
    return (
      <div className="of-purchase-page">
        <h2>{t('درخواست برداشت', 'Withdrawal Requests')}</h2>
        <div className="of-empty">
          <p>{t('برای مدیریت برداشت‌ها، کیف پول را وصل و وارد شو.', 'Connect and sign in with your wallet to manage withdrawals.')}</p>
          <button className="button" onClick={() => (window as any).__ofOpenConnect?.()}>{t('اتصال کیف پول', 'Connect wallet')}</button>
        </div>
      </div>
    )
  }

  const challenges: Challenge[] = session.challenges || []

  return (
    <div className="of-purchase-page">
      <h2>{t('درخواست برداشت', 'Withdrawal Requests')}</h2>
      <p className="of-page-note">{t(
        'درخواست‌های برداشت پس از بررسی تیم پردازش می‌شوند؛ پرداخت خودکار در این نسخه فعال نیست.',
        'Withdrawal requests are processed after review; automatic payout is not active in this release.')}
      </p>

      <div className="of-withdraw-form" dir={isFa ? 'rtl' : 'ltr'}>
        <label>
          <span>{t('مبلغ (دلار)', 'Amount (USD)')}</span>
          <input dir="ltr" inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
        </label>
        <label>
          <span>{t('یادداشت (اختیاری)', 'Note (optional)')}</span>
          <input dir="auto" maxLength={200} value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <button className="button" disabled={busy || !amount} onClick={submit}>{busy ? '…' : t('ثبت درخواست', 'Submit request')}</button>
      </div>
      {error && <p className="of-profile-error" role="alert">{error}</p>}

      {rows && rows.length === 0 && <p className="of-empty">{t('هنوز درخواستی نداری.', 'No withdrawal requests yet.')}</p>}
      {rows && rows.length > 0 && (
        <table className="of-purchase-table" dir={isFa ? 'rtl' : 'ltr'}>
          <thead>
            <tr>
              <th>{t('مبلغ', 'Amount')}</th>
              <th>{t('وضعیت', 'Status')}</th>
              <th>{t('چالش', 'Challenge')}</th>
              <th>{t('تاریخ درخواست', 'Requested')}</th>
              <th>{t('تاریخ بررسی', 'Reviewed')}</th>
              <th>{t('یادداشت', 'Note')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(w => (
              <tr key={w.id}>
                <td dir="ltr">{fmtMoney(w.amount_usd)}</td>
                <td><span className={`of-status-pill of-status-${STATUS_CLASS[w.status] || 'pending'}`}>{isFa ? (STATUS_FA[w.status] || w.status) : w.status}</span></td>
                <td>{w.plan_name || (w.challenge_id ? '—' : t('بدون چالش', 'No challenge'))}</td>
                <td>{fmtDate(w.requested_at)}</td>
                <td>{fmtDate(w.reviewed_at)}</td>
                <td className="of-note-cell">{w.note || '—'}</td>
                <td>{w.status === 'requested' && (
                  <button className="of-profile-plainbtn" disabled={busy} onClick={() => cancel(w.id)}>{t('لغو', 'Cancel')}</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {challenges.length > 0 && (
        <p className="of-page-note">{t(
          `چالش‌های فعال: ${challenges.length} — برداشت‌ها پس از احراز شرایط چالش پردازش می‌شوند.`,
          `Owned challenges: ${challenges.length} — withdrawals are processed once challenge terms are met.`)}
        </p>
      )}
    </div>
  )
}
