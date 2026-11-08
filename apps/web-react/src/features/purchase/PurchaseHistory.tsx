import { dirOf, normalizeLocale, pick } from '../../i18n/locales'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch, useSession } from '../../session/useOpenfundSession'
import { backendUrl } from '../../session/useOpenfundSession'
import './purchase.css'

/**
 * Prop product page — purchase & payment history with downloadable invoices.
 * Data: GET /purchases/history (session-scoped) and GET /invoices/:id (PDF).
 * Reuses the terminal page shell (TerminalContext) for chrome and styling.
 */

interface HistoryRow {
  id: string, status: string, account_size_usd: string, price_usd: string, currency: string,
  created_at: string, paid_at: string | null, plan_slug: string, plan_name: string,
  payment: { txHash: string, chainId: number, verifiedAt: string } | null,
  invoice: { id: string, number: string, issuedAt: string } | null,
  challenge_id: string | null
}

const STATUS_FA: Record<string, string> = { pending: 'در انتظار پرداخت', paid: 'پرداخت‌شده', cancelled: 'لغو‌شده', expired: 'منقضی' }
const EXPLORER: Record<number, string> = { 11155111: 'https://sepolia.etherscan.io', 42161: 'https://arbiscan.io' }
const txUrl = (chainId: number, txHash: string) => `${EXPLORER[chainId] || ''}/tx/${txHash}`

export default function PurchaseHistory() {
  const { locale: routeLocale } = useParams()
  const locale = normalizeLocale(routeLocale, 'fa'), isFa = locale === 'fa'
  const t = (fa: string, en: string) => pick(locale, fa, en)
  const session = useSession()
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session.status !== 'authenticated') { setRows(null); return }
    void apiFetch('/purchases/history').then(r => {
      if (r.ok) setRows(r.data?.orders || [])
      else setError(t('دریافت تاریخچه ناموفق بود.', 'Could not load history.'))
    }).catch(() => setError(t('دریافت تاریخچه ناموفق بود.', 'Could not load history.')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status])

  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString(t('fa-IR', 'en-US')) : '—')
  const fmtMoney = (v: string | number) => '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })

  if (session.status !== 'authenticated') {
    return (
      <div className="of-purchase-page">
        <h2>{t('خریدها و فاکتورها', 'Purchases & Invoices')}</h2>
        <div className="of-empty">
          <p>{t('برای دیدن تاریخچهٔ خرید، کیف پول را وصل و وارد شو.', 'Connect and sign in with your wallet to view your purchase history.')}</p>
          <button className="button" onClick={() => (window as any).__ofOpenConnect?.()}>{t('اتصال کیف پول', 'Connect wallet')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="of-purchase-page">
      <h2>{t('خریدها و فاکتورها', 'Purchases & Invoices')}</h2>
      {error && <p className="of-profile-error" role="alert">{error}</p>}
      {!rows && <p className="of-empty">…</p>}
      {rows && rows.length === 0 && (
        <div className="of-empty">
          <p>{t('هنوز خریدی نداری. پلن‌ها را در صفحهٔ چلنج‌ها ببین.',
            'No purchases yet. See the plans on the Challenges page.')}</p>
          <a className="button" href={`/${locale}/challenges`}>{t('دیدن پلن‌ها', 'View plans')}</a>        </div>
      )}
      {rows && rows.length > 0 && (
        <table className="of-purchase-table" dir={dirOf(locale)}>
          <thead>
            <tr>
              <th>{t('پلن', 'Plan')}</th>
              <th>{t('اندازهٔ حساب', 'Account size')}</th>
              <th>{t('هزینه', 'Fee')}</th>
              <th>{t('وضعیت', 'Status')}</th>
              <th>{t('تاریخ', 'Date')}</th>
              <th>{t('پرداخت', 'Payment')}</th>
              <th>{t('فاکتور', 'Invoice')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(o => (
              <tr key={o.id}>
                <td><b>{o.plan_name}</b></td>
                <td dir="ltr">{fmtMoney(o.account_size_usd)}</td>
                <td dir="ltr">{fmtMoney(o.price_usd)}</td>
                <td><span className={`of-status-pill of-status-${o.status}`}>{isFa ? (STATUS_FA[o.status] || o.status) : o.status}</span></td>
                <td>{fmtDate(o.created_at)}</td>
                <td dir="ltr" className="of-payment-cell">
                  {o.payment ? <a href={txUrl(o.payment.chainId, o.payment.txHash)} target="_blank" rel="noreferrer">{o.payment.txHash.slice(0, 10)}…</a> : '—'}
                </td>
                <td>
                  {o.invoice ? (
                    <a className="button small" href={`${backendUrl()}/invoices/${o.invoice.id}`} target="_blank" rel="noreferrer">
                      {t('دانلود PDF', 'Download PDF')}
                    </a>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
