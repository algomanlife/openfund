import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch, useSession } from '../../session/useOpenfundSession'
import { dirOf, intlLocale, normalizeLocale, pick } from '../../i18n/locales'
import '../purchase/purchase.css'

/**
 * Trader inbox — in-app notifications and support conversations.
 * Data: GET /notifications, POST /notifications/read, GET /support/inbox,
 * GET/POST /support/inbox/:ref/thread (all session-scoped; a trader only
 * sees records linked to their own account). Delivery is by polling;
 * nothing here sends email or touches financial records.
 */
interface Notification { id: string; kind: string; payload: Record<string, unknown>; read_at: string | null; created_at: string }
interface Conversation { reference: string; department: string; subject: string; status: string; created_at: string; unread: number }
interface Thread {
  reference: string; status: string; subject: string; body: string; createdAt: string; total: number; nextBefore: number | null
  messages: { sequence: number; role: 'trader' | 'operator'; message: string; at: string }[]
}

const POLL_MS = 60_000

export default function InboxPage() {
  const { locale: routeLocale } = useParams()
  const locale = normalizeLocale(routeLocale, 'fa')
  const t = (fa: string, en: string) => pick(locale, fa, en)
  const session = useSession()
  const [notifications, setNotifications] = useState<Notification[] | null>(null)
  const [unread, setUnread] = useState(0)
  const [conversations, setConversations] = useState<Conversation[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [thread, setThread] = useState<Thread | null>(null)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const when = (value: string) => new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

  const kindLabel: Record<string, string> = {
    payout_approved: t('درخواست پرداخت شما تأیید شد.', 'Your payout request was approved.'),
    payout_rejected: t('درخواست پرداخت شما رد شد.', 'Your payout request was rejected.'),
    payout_paid: t('پرداخت شما انجام و ثبت شد.', 'Your payout was paid and recorded.'),
    payout_simulated: t('تسویهٔ آزمایشی پرداخت انجام شد.', 'The simulated payout settlement completed.'),
    support_reply: t('پشتیبانی به پیام شما پاسخ داد.', 'Support replied to your message.'),
    challenge_passed: t('چالش شما با موفقیت قبول شد.', 'You passed your challenge.'),
    challenge_failed: t('چالش شما به دلیل نقض قانون پایان یافت.', 'Your challenge ended after a rule breach.'),
    challenge_expired: t('مهلت چالش شما به پایان رسید.', 'Your challenge expired.'),
    challenge_stage_passed: t('یک مرحله از چالش را قبول شدید.', 'You passed a challenge phase.'),
  }
  const statusLabel: Record<string, string> = {
    new: t('جدید', 'New'), in_progress: t('در حال رسیدگی', 'In progress'),
    waiting_customer: t('در انتظار پاسخ شما', 'Waiting for your reply'), resolved: t('حل‌شده', 'Resolved'), closed: t('بسته‌شده', 'Closed'),
  }

  const loadLists = useCallback(async () => {
    try {
      const [n, s] = await Promise.all([apiFetch('/notifications'), apiFetch('/support/inbox')])
      if (!n.ok || !s.ok) throw new Error('inbox_unavailable')
      setNotifications(n.data.notifications)
      setUnread(n.data.unread)
      setConversations(s.data.messages)
    } catch { setFailed(true) }
  }, [])

  useEffect(() => {
    if (session.status !== 'authenticated') return
    void loadLists()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void loadLists() }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [session.status, loadLists])

  const markAllRead = async () => {
    setBusy(true)
    try { await apiFetch('/notifications/read', { method: 'POST', body: JSON.stringify({}) }); await loadLists() }
    catch { setFailed(true) } finally { setBusy(false) }
  }

  const openThread = async (reference: string, before?: number) => {
    setBusy(true)
    setFailed(false)
    try {
      const path = `/support/inbox/${encodeURIComponent(reference)}/thread`
      const response = await apiFetch(before == null ? path : `${path}?before=${before}`)
      if (!response.ok) throw new Error('thread_unavailable')
      const next: Thread = response.data
      setOpen(reference)
      setThread(current => current && before != null ? { ...next, messages: [...next.messages, ...current.messages] } : next)
      if (before == null && next.total)
        await apiFetch(path, { method: 'POST', body: JSON.stringify({ action: 'read', through: next.total }) })
    } catch { setFailed(true) } finally { setBusy(false) }
  }

  const reply = async () => {
    if (!open) return
    setBusy(true)
    setFailed(false)
    try {
      const response = await apiFetch(`/support/inbox/${encodeURIComponent(open)}/thread`, { method: 'POST', body: JSON.stringify({ action: 'reply', message }) })
      if (!response.ok) throw new Error('reply_failed')
      setMessage('')
      await openThread(open)
      await loadLists()
    } catch { setFailed(true) } finally { setBusy(false) }
  }

  if (session.status !== 'authenticated') return <div className="of-purchase-page" dir={dirOf(locale)}>
    <h2>{t('صندوق پیام', 'Inbox')}</h2>
    <div className="of-empty">
      <p>{t('برای دیدن اعلان‌ها و پیام‌های پشتیبانی وارد شوید.', 'Sign in to see your notifications and support messages.')}</p>
      <button className="button" onClick={() => (window as any).__ofOpenConnect?.()}>{t('اتصال کیف پول', 'Connect wallet')}</button>
    </div>
  </div>

  return <div className="of-purchase-page" dir={dirOf(locale)}>
    <h2>{t('پیام‌ها و اعلان‌ها', 'Messages and notifications')}</h2>
    {failed && <p role="alert">{t('بارگذاری یا ارسال پیام ناموفق بود.', 'Could not load or send messages.')}</p>}

    <section className="of-reward-block" aria-label={t('اعلان‌ها', 'Notifications')}>
      <div className="of-reward-head">
        <h3>{t('اعلان‌ها', 'Notifications')}</h3>
        {unread > 0 && <button className="of-profile-plainbtn" type="button" disabled={busy} onClick={() => void markAllRead()}>
          {t('علامت‌گذاری همه به‌عنوان خوانده‌شده', 'Mark all as read')}
        </button>}
      </div>
      {notifications && !notifications.length && <p>{t('اعلانی ندارید.', 'You have no notifications.')}</p>}
      <ol>{notifications?.map(item => <li key={item.id} data-unread={item.read_at ? undefined : 'true'}>
        <strong>{kindLabel[item.kind] ?? item.kind}</strong>{' '}
        <time dateTime={item.created_at}>{when(item.created_at)}</time>
        {typeof item.payload.reference === 'string' && <> <button className="of-profile-plainbtn" type="button"
          onClick={() => void openThread(item.payload.reference as string)}><bdi dir="ltr">{item.payload.reference}</bdi></button></>}
        {!item.read_at && <>{' '}<span className="of-status pending">{t('جدید', 'New')}</span></>}
      </li>)}</ol>
    </section>

    <section className="of-reward-block" aria-label={t('پیام‌های پشتیبانی', 'Support messages')}>
      <h3>{t('پیام‌های پشتیبانی', 'Support messages')}</h3>
      {conversations && !conversations.length && <p>{t('هنوز پیامی به پشتیبانی نفرستاده‌اید.', 'You have not contacted support yet.')}</p>}
      <ul>{conversations?.map(item => <li key={item.reference}>
        <button className="of-profile-plainbtn" type="button" onClick={() => void openThread(item.reference)}>{item.subject}</button>{' '}
        <bdi dir="ltr">{item.reference}</bdi>{' '}
        <span className="of-status">{statusLabel[item.status] ?? item.status}</span>
        {item.unread > 0 && <>{' · '}<span className="of-status pending">{t('پاسخ تازه', 'New reply')}</span></>}
      </li>)}</ul>
    </section>

    {thread && open && <section className="of-reward-block" aria-label={t('گفت‌وگوی پشتیبانی', 'Support conversation')}>
      <div className="of-reward-head">
        <h3>{thread.subject}</h3>
        <button className="of-profile-plainbtn" type="button" onClick={() => { setOpen(null); setThread(null) }}>{t('بستن', 'Close')}</button>
      </div>
      <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{thread.body}</p>
      {thread.nextBefore != null && <button disabled={busy} type="button" onClick={() => void openThread(open, thread.nextBefore!)}>
        {t('پیام‌های قدیمی‌تر', 'Older messages')}
      </button>}
      <ol>{thread.messages.map(item => <li key={item.sequence}>
        <strong>{item.role === 'operator' ? t('پشتیبانی اوپن‌فاند', 'Openfund support') : t('شما', 'You')}</strong>{' '}
        <time dateTime={item.at}>{when(item.at)}</time>
        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.message}</p>
      </li>)}</ol>
      {thread.status !== 'closed'
        ? <form onSubmit={event => { event.preventDefault(); void reply() }}>
          <label>{t('پیام', 'Message')} <textarea value={message} maxLength={2000} onChange={event => setMessage(event.target.value)} required /></label>
          <button className="button" disabled={busy || !message.trim()} type="submit">{t('ارسال پیام', 'Send message')}</button>
        </form>
        : <p>{t('این گفت‌وگو بسته شده است.', 'This conversation is closed.')}</p>}
    </section>}
  </div>
}
