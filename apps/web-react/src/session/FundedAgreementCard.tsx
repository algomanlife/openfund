import { useCallback, useEffect, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { apiFetch } from './useOpenfundSession'
import { currentLocale, pick } from '../i18n/locales'

/* Funded-trader agreement (ADR 0054): funded accounts that need the signed
   terms before their first trade, and the ones already signed. The wallet
   signs the exact message the server issues; nothing else is signed. */
interface Row { challengeId: string; status: string; required: boolean; signed: boolean; termsVersion: string | null; signedAt: string | null }

export default function FundedAgreementCard() {
  const locale = currentLocale()
  const t = (fa: string, en: string) => pick(locale, fa, en)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { signMessageAsync } = useSignMessage()
  const { address } = useAccount()
  const load = useCallback(async () => {
    const r = await apiFetch('/funded/agreements')
    setRows(r.ok ? (r.data?.accounts || []).filter((a: Row) => a.required || a.signed) : [])
  }, [])
  useEffect(() => { void load() }, [load])
  const sign = async (id: string) => {
    setBusy(id); setError(null)
    try {
      const issued = await apiFetch(`/funded/agreements/${id}/message`, { method: 'POST', body: '{}' })
      if (!issued.ok) throw new Error(issued.data?.error || 'failed')
      if (!address) throw new Error('wallet_not_connected')
      const signature = await signMessageAsync({ account: address, message: issued.data.message })
      const done = await apiFetch(`/funded/agreements/${id}`, { method: 'POST', body: JSON.stringify({ message: issued.data.message, signature }) })
      if (!done.ok) throw new Error(done.data?.error || 'failed')
      await load()
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      setError(/reject|denied|User rejected/i.test(code) ? t('امضا لغو شد.', 'Signature cancelled.') : t('امضا انجام نشد. دوباره تلاش کن.', 'The agreement could not be signed. Please try again.'))
    } finally { setBusy(null) }
  }
  if (!rows?.length) return null
  return <section className="of-agreements" aria-labelledby="of-agreements-title">
    <h3 id="of-agreements-title">{t('توافق‌نامهٔ معامله‌گر فاندشده', 'Funded-trader agreement')}</h3>
    <p className="of-muted">{t('پیش از اولین معامله در حساب فاندشده، شرایط را با امضای کیف پولت می‌پذیری. پاداش‌ها فقط به همین کیف پول پرداخت می‌شوند.',
      'Before the first trade on a funded account, you accept the terms by signing with your wallet. Rewards are paid only to this wallet.')}</p>
    <ul>{rows.map(r => <li key={r.challengeId}>
      <span dir="ltr" className="of-mono">{r.challengeId.slice(0, 8)}</span>
      {r.signed
        ? <span className="of-agreement-ok">{t('امضا شد', 'Signed')} · {t('نسخه', 'version')} <bdi dir="ltr">{r.termsVersion}</bdi> · {r.signedAt ? new Date(r.signedAt).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US') : ''}</span>
        : <button type="button" className="of-profile-plainbtn" disabled={busy === r.challengeId} onClick={() => { void sign(r.challengeId) }}>{t('امضای توافق‌نامه', 'Sign the agreement')}</button>}
    </li>)}</ul>
    {error && <p role="alert" className="of-error">{error}</p>}
  </section>
}
