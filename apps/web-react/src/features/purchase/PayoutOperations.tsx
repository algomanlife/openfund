import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch } from '../../session/useOpenfundSession'
import { dirOf, normalizeLocale, pick } from '../../i18n/locales'
import './purchase.css'

interface Item {
  id: string; status: string; kind?: string; amount_usd: string; wallet_address: string; recipient_wallet: string | null
  eligibility: Record<string, unknown> | null; payout_ref: string | null; payment_evidence: Record<string, unknown> | null
  unread_messages: number; appeal_pending: boolean; ib_settlement: Record<string, unknown> | null
}
const PAGE_SIZE = 25

export default function PayoutOperations() {
  const locale = normalizeLocale(useParams().locale, 'en')
  const t = (fa: string, en: string) => pick(locale, fa, en)
  const [token, setToken] = useState('')
  const [actor, setActor] = useState('')
  const [filter, setFilter] = useState('requested')
  const [items, setItems] = useState<Item[]>([])
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [selection, setSelection] = useState<Item | null>(null)
  const [messages, setMessages] = useState<{ sequence: number; actor: string; message: string; at: string }[]>([])
  const [eventLog, setEventLog] = useState<unknown[]>([])
  const [note, setNote] = useState('')
  const [reference, setReference] = useState('')
  const [policy, setPolicy] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const api = async (path: string, body?: Record<string, unknown>) => {
    const response = await apiFetch(`/admin/withdrawals${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${token}`, 'x-admin-actor': actor },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (!response.ok) throw new Error('admin_request_failed')
    return response.data
  }
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(false)
    try { await fn() }
    catch { setError(true) }
    finally { setBusy(false) }
  }
  const list = async (pageOffset = 0) => {
    const data = await api(`?kind=reward&status=${filter}&limit=${PAGE_SIZE}&offset=${pageOffset}`)
    setItems(data.withdrawals); setOffset(pageOffset); setTotal(data.total)
  }
  const detail = async (item: Item) => {
    const [thread, trail] = await Promise.all([api(`/${item.id}/thread`), api(`/${item.id}/audit`)])
    if (thread.unread) await api(`/${item.id}/thread`, { action: 'read', through: thread.total })
    setSelection({ ...item, appeal_pending: thread.appealPending }); setMessages(thread.messages); setEventLog(trail.events)
  }
  const act = (target: 'review' | 'thread' | 'ib-settlement', action: string) => run(async () => {
    if (!selection) return
    const result = await api(`/${selection.id}/${target}`, { action, payoutRef: reference, note, message: note, policyVersion: policy })
    await detail({ ...selection, status: target === 'review' ? result.status : selection.status,
      ib_settlement: target === 'ib-settlement' ? result.settlement : selection.ib_settlement })
    setNote(''); setReference('')
    await list(offset)
  })
  const statuses = {
    requested: t('در حال بررسی', 'Under review'),
    approved: t('تأییدشده', 'Approved'),
    rejected: t('ردشده', 'Rejected'),
    paid: t('پرداخت‌شده', 'Paid'),
    appeal: t('درخواست بازبینی', 'Request reconsideration'),
    reconciliation: t('نیازمند تطبیق', 'Requires reconciliation'),
  }
  return <main className="container of-reward-block" dir={dirOf(locale)}>
    <h1>{t('مدیریت پرداخت‌ها', 'Payout operations')}</h1>
    <form onSubmit={event => { event.preventDefault(); void run(() => list()) }}>
      <label>{t('توکن اپراتور', 'Operator token')} <input required type="password" autoComplete="off" value={token} onChange={e => { setToken(e.target.value); setItems([]); setSelection(null) }} /></label>
      <label>{t('اپراتور', 'Operator')} <input required value={actor} onChange={e => setActor(e.target.value)} /></label>
      <label>{t('وضعیت', 'Status')} <select value={filter} onChange={e => setFilter(e.target.value)}>
        {Object.entries(statuses).map(([key, title]) => <option key={key} value={key}>{title}</option>)}
      </select></label>
      <button type="submit" disabled={busy}>{t('تازه‌سازی', 'Refresh')}</button>
    </form>
    {error && <p role="alert">{t('درخواست ناموفق بود.', 'The request failed.')}</p>}
    <ul>{items.map(item => <li key={item.id}><button type="button" disabled={busy} onClick={() => void run(() => detail(item))}>
      <bdi>{item.amount_usd} USD · {item.recipient_wallet ?? item.wallet_address}</bdi> · {statuses[item.status as keyof typeof statuses] ?? item.status}
      {item.unread_messages ? ` (${item.unread_messages})` : ''}
    </button></li>)}</ul>
    {offset > 0 && <button onClick={() => void run(() => list(offset - PAGE_SIZE))}>{t('قبلی', 'Previous')}</button>}
    {offset + PAGE_SIZE < total && <button onClick={() => void run(() => list(offset + PAGE_SIZE))}>{t('بعدی', 'Next')}</button>}
    {selection && <section>
      <h2>{t('جزئیات پرداخت', 'Payout details')}</h2>
      <p><bdi>{selection.id} · {selection.amount_usd} USD · {selection.recipient_wallet ?? selection.wallet_address}</bdi></p>
      <details><summary>{t('محاسبه و مدارک', 'Calculation and evidence')}</summary>
        <pre dir="ltr">{JSON.stringify({ calculation: selection.eligibility, receipt: selection.payment_evidence, ib: selection.ib_settlement }, null, 2)}</pre>
      </details>
      <details><summary>{t('سوابق بررسی', 'Audit history')}</summary><pre dir="ltr">{JSON.stringify(eventLog, null, 2)}</pre></details>
      <ol>{messages.map(m => <li key={m.sequence}>{m.actor} · <time dateTime={m.at}>{m.at}</time><p>{m.message}</p></li>)}</ol>
      <label>{t('پیام', 'Message')} <textarea value={note} maxLength={1000} onChange={e => setNote(e.target.value)} /></label>
      <label>{t('مرجع پرداخت', 'Payout reference')} <input value={reference} onChange={e => setReference(e.target.value)} /></label>
      <button disabled={busy || !note.trim()} onClick={() => void act('thread', 'reply')}>{t('ارسال پیام', 'Send message')}</button>
      {selection.appeal_pending && <button disabled={busy || !note.trim()} onClick={() => void act('thread', 'resolve_appeal')}>
        {t('ثبت نتیجهٔ بازبینی', 'Record reconsideration outcome')}
      </button>}
      {selection.status === 'requested' && <>
        <button disabled={busy} onClick={() => void act('review', 'approve')}>{t('تأیید', 'Approve')}</button>
        <button disabled={busy || !note.trim()} onClick={() => void act('review', 'reject')}>{t('رد', 'Reject')}</button>
      </>}
      {selection.status === 'approved' && <button disabled={busy || !reference.trim()} onClick={() => void act('review', 'paid')}>
        {t('ثبت پرداخت', 'Record payment')}
      </button>}
      {selection.status === 'paid' && !!selection.eligibility?.distribution && <div>
        <label>{t('نسخهٔ سیاست IB', 'IB policy version')} <input value={policy} onChange={e => setPolicy(e.target.value)} /></label>
        <button disabled={busy || !policy.trim() || !!selection.ib_settlement} onClick={() => void act('ib-settlement', 'approve')}>
          {t('تأیید تسویهٔ IB', 'Approve IB settlement')}
        </button>
        <button disabled={busy || !reference.trim() || selection.ib_settlement?.status !== 'approved'} onClick={() => void act('ib-settlement', 'paid')}>
          {t('ثبت تسویهٔ IB', 'Record IB settlement')}
        </button>
      </div>}
    </section>}
  </main>
}
