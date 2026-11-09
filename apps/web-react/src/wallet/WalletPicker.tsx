import { useEffect, useMemo, useRef, useState } from 'react'
import { useConnect, type Connector } from 'wagmi'
import { pick, dirOf, type AppLocale } from '../i18n/locales'
import { classifyWalletError, isNeutral, walletErrorMessage, type ClassifiedWalletError } from './errors'

/* ============================================================
   Explicit wallet choice.

   Browser wallets announce themselves through EIP-6963; wagmi turns each
   announcement into its own connector. The generic `injected` connector
   talks to whichever extension last claimed `window.ethereum`, so it is only
   offered — honestly labelled — when no wallet announced itself. Nothing is
   connected until the person selects a wallet in this list.

   WalletConnect (mobile / QR) is offered only when a WalletConnect Cloud
   project id is configured; it opens the RainbowKit modal.
   ============================================================ */

export interface WalletChoice { id: string; name: string; icon?: string; connector: Connector; generic: boolean }

/** EIP-6963 connectors first; generic `injected` only when nothing announced. */
export function walletChoices(connectors: readonly Connector[]): WalletChoice[] {
  const browser = connectors.filter(c => c.type === 'injected' && !(c as { rkDetails?: unknown }).rkDetails)
  const announced = browser.filter(c => c.id !== 'injected')
  const list = announced.length ? announced : browser
  const seen = new Set<string>()
  return list.filter(c => { const key = (c.name || c.id).toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true })
    .map(c => ({ id: c.id, name: c.id === 'injected' ? '' : c.name, icon: c.icon, connector: c, generic: c.id === 'injected' }))
}

export function WalletPicker({ locale, walletConnect, onWalletConnect, onClose, onConnected }: {
  locale: AppLocale
  walletConnect: boolean
  onWalletConnect: () => void
  onClose: () => void
  onConnected: () => void
}) {
  const t = (fa: string, en: string) => pick(locale, fa, en)
  const { connectors, connectAsync } = useConnect()
  const choices = useMemo(() => walletChoices(connectors), [connectors])
  const [pending, setPending] = useState<string | null>(null)
  const [result, setResult] = useState<ClassifiedWalletError | null>(null)
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLElement>('button')?.focus()
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    addEventListener('keydown', key)
    return () => { removeEventListener('keydown', key); previous?.focus?.() }
  }, [onClose])

  const choose = async (choice: WalletChoice) => {
    setResult(null)
    setPending(choice.id)
    try {
      if (!await choice.connector.getProvider().catch(() => null)) throw Object.assign(new Error('provider'), { name: 'ProviderNotFoundError' })
      await connectAsync({ connector: choice.connector })
      onConnected()
    } catch (error) {
      setResult(classifyWalletError(error))
    } finally {
      setPending(null)
    }
  }

  const label = (c: WalletChoice) => c.generic ? t('کیف پول مرورگر', 'Browser wallet') : c.name
  return (
    <div className="of-wallet-picker-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={dialog} className="of-wallet-picker" role="dialog" aria-modal="true" aria-labelledby="of-wallet-picker-title" dir={dirOf(locale)} lang={locale} data-wallet-picker>
        <header>
          <h2 id="of-wallet-picker-title">{t('انتخاب کیف پول', 'Choose a wallet')}</h2>
          <button type="button" className="of-wallet-picker-close" onClick={onClose} aria-label={t('بستن', 'Close')}>×</button>
        </header>
        <p className="of-wallet-picker-note">{t('فقط اتصال و امضای ورود؛ هیچ تراکنش یا مجوز توکنی درخواست نمی‌شود.', 'Connection and sign-in signature only; no transaction or token approval is requested.')}</p>
        {choices.length > 0 ? (
          <ul className="of-wallet-list">
            {choices.map(choice => (
              <li key={choice.id}>
                <button type="button" data-wallet-id={choice.id} disabled={pending !== null} aria-busy={pending === choice.id} onClick={() => void choose(choice)}>
                  {choice.icon ? <img src={choice.icon} alt="" width={28} height={28} /> : <span className="of-wallet-icon" aria-hidden="true">◎</span>}
                  <span className="of-wallet-name" dir="auto">{label(choice)}</span>
                  <small>{pending === choice.id ? t('در انتظار تأیید در کیف پول…', 'Waiting for approval in your wallet…') : choice.generic ? t('کیف پول فعال در مرورگر', 'Active browser extension') : t('نصب‌شده', 'Installed')}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="of-wallet-empty" data-wallet-empty>{t('هیچ کیف پول مرورگری پیدا نشد. یک افزونهٔ کیف پول را نصب یا فعال کنید، یا این سایت را در مرورگر داخلی اپ کیف پول باز کنید.', 'No browser wallet was detected. Install or enable a wallet extension, or open this site in your wallet app’s built-in browser.')}</p>
        )}
        {walletConnect ? (
          <button type="button" className="of-wallet-walletconnect" disabled={pending !== null} onClick={onWalletConnect}>{t('کیف پول موبایل (WalletConnect)', 'Mobile wallet (WalletConnect)')}</button>
        ) : (
          <p className="of-wallet-picker-note" data-walletconnect-unavailable>{t('اتصال کیف پول موبایل با کد QR در این نسخه پیکربندی نشده است.', 'Mobile wallet connection by QR code is not configured on this deployment.')}</p>
        )}
        {result && (
          <p className={isNeutral(result.kind) ? 'of-wallet-status' : 'of-wallet-status of-wallet-status-error'} role={isNeutral(result.kind) ? 'status' : 'alert'} data-wallet-result={result.kind}>
            {walletErrorMessage(locale, 'connect', result)}
          </p>
        )}
      </div>
    </div>
  )
}
