import { dirOf, normalizeLocale, pickRecord, intlLocale } from '../../i18n/locales'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { txExplorerUrl } from './chains'
import { apiFetch, useSession } from '../../session/useOpenfundSession'
import { backendUrl } from '../../session/useOpenfundSession'
import { planBySlug } from '../../data/challengePlans'
import { purchaseCopy as copy, purchaseStatuses } from './purchaseContent'
import './purchase.css'

/**
 * Prop product page — purchase & payment history with downloadable invoices.
 * Data: GET /purchases/history (session-scoped) and GET /invoices/:id (PDF).
 * Reuses the terminal page shell (TerminalContext) for chrome and styling.
 */

interface HistoryRow {
  id: string, status: string, lifecycle_state?: string, account_size_usd: string, price_usd: string,
  created_at: string, paid_at: string | null, plan_slug: string, plan_name: string,
  payment: { txHash: string, chainId: number, verifiedAt: string } | null,
  invoice: { id: string, number: string, issuedAt: string } | null,
  challenge_id: string | null
}

const txUrl = (chainId: number, txHash: string) => txExplorerUrl(chainId, txHash) || undefined

export default function PurchaseHistory() {
  const { locale: routeLocale } = useParams()
  const locale = normalizeLocale(routeLocale, 'fa')
  const c = (key: keyof typeof copy) => pickRecord(locale, copy[key])
  const session = useSession()
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setRows(null); setError(null)
    if (session.status !== 'authenticated') return

    void apiFetch('/purchases/history').then(r => {
      if (!active) return
      if (r.ok) setRows(r.data?.orders || [])
      else setError(c('loadError'))
    }).catch(() => { if (active) setError(c('loadError')) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status, session.user?.id, locale])

  const fmtDate = (d?: string | null) => d && Number.isFinite(Date.parse(d)) ? new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'medium' }).format(new Date(d)) : '—'
  const fmtMoney = (v: string | number) => Number.isFinite(Number(v))
    ? new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(v)) : '—'

  return (
    <div className="of-purchase-page" dir={dirOf(locale)}>
      <div className="of-purchase-heading">
        <div><h1>{c('title')}</h1><p>{c('description')}</p></div>
        <Link className="button of-purchase-cta" to={`/${locale}/checkout`}>{c('buy')}</Link>
      </div>
      {session.status !== 'authenticated' && <div className="of-empty"><p>{c('signIn')}</p><button className="button" onClick={() => (window as any).__ofOpenConnect?.()}>{c('connect')}</button></div>}
      {error && <p className="of-profile-error" role="alert">{error}</p>}
      {session.status === 'authenticated' && !rows && !error && <p className="of-empty" role="status">{c('loading')}</p>}
      {rows && rows.length === 0 && (
        <div className="of-empty">
          <p>{c('empty')}</p>        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="of-purchase-scroll" role="region" aria-label={c('title')} tabIndex={0}><table className="of-purchase-table" dir={dirOf(locale)}>
          <thead>
            <tr>
              <th scope="col">{c('plan')}</th>
              <th scope="col">{c('size')}</th>
              <th scope="col">{c('fee')}</th>
              <th scope="col">{c('status')}</th>
              <th scope="col">{c('date')}</th>
              <th scope="col">{c('payment')}</th>
              <th scope="col">{c('invoice')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(o => (
              <tr key={o.id}>
                <td><Link to={`/${locale}/checkout?order=${o.id}`}><b>{pickRecord(locale, planBySlug(o.plan_slug)?.name) || o.plan_name}</b></Link></td>
                <td dir="ltr">{fmtMoney(o.account_size_usd)}</td>
                <td dir="ltr">{fmtMoney(o.price_usd)}</td>
                <td><span className={`of-status-pill of-status-${o.status}`}>{pickRecord(locale, purchaseStatuses[o.lifecycle_state || ''] || purchaseStatuses[o.status]) || c('unknown')}</span></td>
                <td>{fmtDate(o.created_at)}</td>
                <td dir="ltr" className="of-payment-cell">
                  {o.payment && txUrl(o.payment.chainId, o.payment.txHash) ? <a href={txUrl(o.payment.chainId, o.payment.txHash)} target="_blank" rel="noreferrer">{o.payment.txHash.slice(0, 10)}…</a> : <span>{c('unavailable')}</span>}
                </td>
                <td>
                  {o.invoice ? (
                    <a className="button small" href={`${backendUrl()}/invoices/${o.invoice.id}`} target="_blank" rel="noreferrer">
                      {c('pdf')}
                    </a>
                  ) : <span className="of-receipt-unavailable">{c('unavailable')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  )
}
