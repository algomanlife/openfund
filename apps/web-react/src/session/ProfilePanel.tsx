import { currentLocale, dirOf, pick } from '../i18n/locales'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import type { OpenfundChallenge, OpenfundUser } from './useOpenfundSession'

/**
 * Account panel — authenticated user profile + challenge list (fa/en).
 * Rendered as a portal dialog; opened from the wallet area when the session
 * is authenticated. Only the session owner's data is ever displayed
 * (backend enforces ownership — this is presentation only).
 *
 * Phase 1: editable display name + avatar (PATCH /auth/profile). The wallet
 * identity itself is immutable — one wallet = one Openfund user.
 */
const STATUS_FA: Record<string, string> = {
  created: 'ایجادشده', started: 'در جریان', passed: 'قبول‌شده',
  failed: 'شکست‌خورده', expired: 'منقضی', cancelled: 'لغو‌شده'
}

const AVATAR_MAX = 256 * 1024

export function Avatar({ url, displayName, size = 64 }: { url: string | null, displayName: string | null, size?: number }) {
  if (url) return <img className="of-avatar" src={url} alt="" width={size} height={size} style={{ width: size, height: size }} />
  const initial = (displayName || '?').trim().slice(0, 1).toUpperCase()
  return <span className="of-avatar of-avatar-fallback" style={{ width: size, height: size, fontSize: Math.round(size / 2.6) }}>{initial}</span>
}

export function ProfilePanel(props: {
  user: OpenfundUser
  challenges: OpenfundChallenge[]
  onLogout: () => void
  onClose: () => void
  updateProfile?: (patch: { displayName?: string | null, avatarUrl?: string | null }) => Promise<unknown>
  reload?: () => Promise<unknown>
}) {
  const { user, challenges, onLogout, onClose, updateProfile, reload } = props
  const locale = currentLocale(), isFa = locale === 'fa'
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user.displayName || '')
  const [avatar, setAvatar] = useState<string | null>(user.avatarUrl)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const t = (fa: string, en: string) => pick(locale, fa, en)
  const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString(t('fa-IR', 'en-US')) : '—')

  const pickAvatar = (file: File | null | undefined) => {
    setErr(null)
    if (!file) return
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) { setErr(t('فقط تصویر PNG/JPG/WebP/GIF', 'PNG/JPG/WebP/GIF images only')); return }
    if (file.size > AVATAR_MAX) { setErr(t('حجم تصویر باید زیر ۲۵۶ کیلوبایت باشد', 'Image must be under 256 KB')); return }
    const reader = new FileReader()
    reader.onload = () => setAvatar(String(reader.result))
    reader.readAsDataURL(file)
  }

  const save = async () => {
    if (!updateProfile) return
    setBusy(true); setErr(null)
    try {
      const patch: { displayName?: string | null, avatarUrl?: string | null } = {}
      if (name.trim() !== (user.displayName || '')) patch.displayName = name.trim() || null
      if (avatar !== user.avatarUrl) patch.avatarUrl = avatar
      if (Object.keys(patch).length) await updateProfile(patch)
      await reload?.()
      setEditing(false)
    } catch (e: any) {
      setErr(String(e?.message || e).includes('invalid_display_name') ? t('نام نمایشی نامعتبر (۱ تا ۶۰ نویسه)', 'Invalid display name (1–60 chars)') : t('ذخیره ناموفق بود', 'Could not save'))
    } finally { setBusy(false) }
  }

  return createPortal(
    <div
      className="of-profile-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <dialog ref={dialog} onCancel={onClose} onClick={e => {
        const rect = e.currentTarget.getBoundingClientRect()
        if (e.target === e.currentTarget && (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)) onClose()
      }} className="of-profile" dir={dirOf(locale)}>
        <button className="dialog-close of-profile-close" onClick={onClose} aria-label={t('بستن', 'Close')}>×</button>

        <h2>{t('حساب اوپن‌فاند', 'Openfund Account')}</h2>

        <div className="of-profile-head">
          {!editing && <Avatar url={user.avatarUrl} displayName={user.displayName} />}
          {!editing ? (
            <div className="of-profile-headinfo">
              <b>{user.displayName || t('— بدون نام —', '— unnamed —')}</b>
              <span dir="ltr" className="of-addr">{user.walletAddress.slice(0, 10)}…{user.walletAddress.slice(-8)}</span>
              <button className="of-profile-editbtn" onClick={() => { setEditing(true); setName(user.displayName || ''); setAvatar(user.avatarUrl) }}>
                {t('ویرایش نام و تصویر', 'Edit name & avatar')}
              </button>
            </div>
          ) : (
            <div className="of-profile-editform">
              <label className="of-profile-field">
                <span>{t('نام نمایشی', 'Display name')}</span>
                <input dir="auto" maxLength={60} value={name} onChange={e => setName(e.target.value)}
                  placeholder={t('نامی که دیگران می‌بینند', 'Name others will see')} />
              </label>
              <div className="of-profile-field">
                <span>{t('تصویر', 'Avatar')}</span>
                <div className="of-profile-avatarrow">
                  <Avatar url={avatar} displayName={name} size={40} />
                  <label className="button of-profile-filebtn">
                    {t('انتخاب تصویر', 'Choose image')}
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
                      onChange={e => pickAvatar(e.target.files?.[0])} />
                  </label>
                  {avatar && <button className="of-profile-plainbtn" onClick={() => setAvatar(null)}>{t('حذف', 'Remove')}</button>}
                </div>
              </div>
              {err && <p className="of-profile-error" role="alert">{err}</p>}
              <div className="of-profile-formactions">
                <button className="button" disabled={busy} onClick={save}>{busy ? '…' : t('ذخیره', 'Save')}</button>
                <button className="of-profile-plainbtn" disabled={busy} onClick={() => { setEditing(false); setErr(null) }}>{t('انصراف', 'Cancel')}</button>
              </div>
            </div>
          )}
        </div>

        <div className="of-profile-rows">
          <div><span>{t('کیف پول', 'Wallet')}</span><b dir="ltr" className="of-addr">{user.walletAddress.slice(0, 8)}…{user.walletAddress.slice(-6)}</b></div>
          <div><span>{t('شناسه کاربر', 'User ID')}</span><b dir="ltr">{user.id.slice(0, 8)}…</b></div>
          <div><span>{t('وضعیت', 'Status')}</span><b className={user.status === 'active' ? 'of-ok' : 'of-bad'}>
            {user.status === 'active' ? t('فعال', 'Active') : t('معلق', 'Suspended')}</b></div>
          <div><span>{t('تاریخ عضویت', 'Registered')}</span><b>{fmtDate(user.createdAt)}</b></div>
          <div><span>{t('آخرین ورود', 'Last login')}</span><b>{fmtDate(user.lastLoginAt)}</b></div>
        </div>

        <h3>{t('چالش‌های من', 'My challenges')} <i className="of-count">{challenges.length}</i></h3>
        {challenges.length === 0 ? (
          <p className="of-empty">{t('هنوز چالشی نداری. از صفحهٔ چلنج‌ها یک پلن انتخاب و خرید کن.',
            'No challenges yet. Pick a plan on the Challenges page to purchase one.')}</p>
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
          {(['prop', 'perpetual'] as const).filter(product => isFa || product === 'prop').map(product => <a key={product} className="button"
            href={`#/${locale}/${product}/dashboard`} onClick={onClose}>
            Openfund {product === 'prop' ? 'Prop' : 'Perpetual'} ↗
          </a>)}
          <button className="button danger" onClick={onLogout}>{t('خروج از حساب', 'Sign out')}</button>
        </div>
      </dialog>
    </div>,
    document.body
  )
}
