import { useEffect, useState } from 'react'
import { apiFetch } from '../../session/useOpenfundSession'
import { intlLocale, pick, type AppLocale } from '../../i18n/locales'

interface Thread {
  status: string
  rejectionReason: string | null
  appealPending: boolean
  nextBefore: number | null
  total: number
  messages: { sequence: number; role: 'trader' | 'operator'; kind: string; message: string; at: string }[]
}

export default function PayoutThread({ id, locale, close }: { id: string; locale: AppLocale; close: () => void }) {
  const [thread, setThread] = useState<Thread | null>(null)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const path = `/withdrawals/${id}/thread`
  const t = (fa: string, en: string) => pick(locale, fa, en)
  const load = async (before?: number) => {
    setBusy(true)
    setFailed(false)
    try {
      const response = await apiFetch(before == null ? path : `${path}?before=${before}`)
      if (!response.ok) throw new Error('thread_unavailable')
      const next: Thread = response.data
      setThread(current => current && before != null ? { ...next, messages: [...next.messages, ...current.messages] } : next)
      if (before == null && next.total) {
        await apiFetch(path, { method: 'POST', body: JSON.stringify({ action: 'read', through: next.total }) })
      }
    } catch { setFailed(true) }
    finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [id])

  const send = async (action: 'reply' | 'appeal') => {
    setBusy(true)
    setFailed(false)
    try {
      const response = await apiFetch(path, { method: 'POST', body: JSON.stringify({ action, message }) })
      if (!response.ok) throw new Error('thread_unavailable')
      setThread(response.data)
      setMessage('')
    } catch { setFailed(true) }
    finally { setBusy(false) }
  }
  return <section className="of-reward-block" aria-label={t('پیام‌های پرداخت', 'Payout messages')}>
    <div className="of-reward-head">
      <h3>{t('پیام‌های پرداخت', 'Payout messages')}</h3>
      <button className="of-profile-plainbtn" type="button" onClick={close}>{t('بستن', 'Close')}</button>
    </div>
    {failed && <p role="alert">{t('بارگذاری یا ارسال پیام ناموفق بود.', 'Could not load or send messages.')}</p>}
    {thread?.rejectionReason && <p><strong>{t('دلیل رد', 'Rejection reason')}</strong> {thread.rejectionReason}</p>}
    {thread?.appealPending && <p role="status">{t('درخواست بازبینی در حال بررسی است.', 'Reconsideration is pending.')}</p>}
    {thread?.nextBefore != null && <button disabled={busy} type="button" onClick={() => void load(thread.nextBefore!)}>
      {t('پیام‌های قدیمی‌تر', 'Older messages')}
    </button>}
    <ol>{thread?.messages.map(item => <li key={item.sequence}>
      <strong>{item.role === 'operator' ? t('اپراتور', 'Operator') : t('معامله‌گر', 'Trader')}</strong>{' '}
      <time dateTime={item.at}>{new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.at))}</time>
      <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.message}</p>
    </li>)}</ol>
    {thread && <form onSubmit={event => { event.preventDefault(); void send('reply') }}>
      <label>{t('پیام', 'Message')} <textarea value={message} maxLength={1000} onChange={event => setMessage(event.target.value)} required /></label>
      <button className="button" disabled={busy || !message.trim()} type="submit">{t('ارسال پیام', 'Send message')}</button>
      {thread.status === 'rejected' && !thread.appealPending && <button className="of-profile-plainbtn" disabled={busy || !message.trim()}
        type="button" onClick={() => void send('appeal')}>{t('درخواست بازبینی', 'Request reconsideration')}</button>}
    </form>}
  </section>
}
