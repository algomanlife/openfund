import { createPortal } from 'react-dom'
import { useState } from 'react'
import type { OpenfundChallenge, OpenfundUser } from './useOpenfundSession'

/**
 * Account panel — authenticated user profile + challenge list (fa/en).
 * Rendered as a portal dialog; opened from the wallet area when the session
 * is authenticated. Only the session owner's data is ever displayed
 * (backend enforces ownership — this is presentation only).
 */
const STATUS_FA: Record<string, string> = {
  created: 'ایجادشده', started: 'در جریان', passed: 'قبول‌شده',
  failed: 'شکست‌خورده', expired: 'منقضی', cancelled: 'لغو‌شده'
}

export function ProfilePanel(props: {
  user: OpenfundUser
  challenges: OpenfundChallenge[]
  onLogout: () => void
  onClose: () => void
}) {
  const { user, challenges, onLogout, onClose } = props
  const isFa = (window as any).ofLang !== 'en'
  const [closing] = useState(false)
  if (closing) return null

  const t = (fa: string, en: string) => (isFa ? fa : en)
  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString(isFa ? 'fa-IR' : 'en-US') : '—')

  return createPortal(
    <div
      className="of-profile-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <dialog open className="of-profile" dir={isFa ? 'rtl' : 'ltr'}>
        <button className="dialog-close of-profile-close" onClick={onClose} aria-label={t('بستن', 'Close')}>×</button>

        <h2>{t('حساب اوپن‌فاند', 'Openfund Account')}</h2>

        <div className="of-profile-rows">
          <div><span>{t('کیف پول', 'Wallet')}</span><b dir="ltr" className="of-addr">{user.walletAddress.slice(0, 8)}…{user.walletAddress.slice(-6)}</b></div>
          <div><span>{t('شناسه کاربر', 'User ID')}</span><b dir="ltr">{user.id.slice(0, 8)}…</b></div>
          <div><span>{t('نام نمایشی', 'Display name')}</span><b>{user.displayName || t('— بدون نام —', '— unnamed —')}</b></div>
          <div><span>{t('وضعیت', 'Status')}</span><b className={user.status === 'active' ? 'of-ok' : 'of-bad'}>
            {user.status === 'active' ? t('فعال', 'Active') : t('معلق', 'Suspended')}</b></div>
          <div><span>{t('تاریخ عضویت', 'Registered')}</span><b>{fmtDate(user.createdAt)}</b></div>
          <div><span>{t('آخرین ورود', 'Last login')}</span><b>{fmtDate(user.lastLoginAt)}</b></div>
        </div>

        <h3>{t('چالش‌های من', 'My challenges')} <i className="of-count">{challenges.length}</i></h3>
        {challenges.length === 0 ? (
          <p className="of-empty">{t('هنوز چالشی نداری. خرید و فعال‌سازی چالش در فاز بعدی اضافه می‌شود.',
            'No challenges yet. Challenge purchase and activation arrive in a later phase.')}</p>
        ) : (
          <ul className="of-challenges">
            {challenges.map(c => (
              <li key={c.id}>
                <b>{c.plan_name}</b>
                <span>{isFa ? (STATUS_FA[c.status] || c.status) : c.status}</span>
                <small dir="ltr">{c.id.slice(0, 8)}…</small>
                <small>{fmtDate(c.created_at)}</small>
              </li>
            ))}
          </ul>
        )}

        <div className="of-profile-actions">
          <button className="button danger" onClick={onLogout}>{t('خروج از حساب', 'Sign out')}</button>
        </div>
      </dialog>
    </div>,
    document.body
  )
}
