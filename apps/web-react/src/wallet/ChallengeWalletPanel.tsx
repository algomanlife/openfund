import { useAccount } from 'wagmi'
import { useSession } from '../session/useOpenfundSession'
import { walletPanelState } from './walletPanelState'
import { useProductNetwork } from './productNetwork'
import { dirOf, pick, type AppLocale } from '../i18n/locales'
import './wallet-panel.css'

const short = (address?: string) => (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '')

/** Challenges page wallet card. Uses the existing connect picker
 *  (window.__ofOpenConnect from RainbowConnect) and the existing SIWE
 *  sign-in; it creates no wallet or login flow of its own and grants nothing
 *  — purchase authorization stays with the backend session. */
export default function ChallengeWalletPanel({ locale }: { locale: AppLocale }) {
  const { address, chain, status: walletStatus, isConnected } = useAccount()
  const session = useSession()
  const target = useProductNetwork()
  const state = walletPanelState(walletStatus, isConnected, session.status)
  const t = (fa: string, en: string) => pick(locale, fa, en)
  const openConnect = () => { (window as Window & { __ofOpenConnect?: () => void }).__ofOpenConnect?.() }

  if (state === 'disconnected') return <div className="wallet-panel" data-wallet-state={state} dir={dirOf(locale)} lang={locale}>
    <h3>{t('ورود با کیف پول وب۳.', 'Sign in with a Web3 wallet.')}</h3>
    <p>{t('ورود با MetaMask یا Rabby و امضای یک پیام؛ بدون ایمیل و رمز عبور.', 'Sign in with MetaMask or Rabby by signing a message — no email or password.')}</p>
    <button type="button" className="button wallet-trigger" onClick={openConnect}>{t('اتصال کیف پول', 'Connect wallet')}</button>
  </div>

  if (state === 'restoring') return <div className="wallet-panel" data-wallet-state={state} dir={dirOf(locale)} lang={locale} aria-busy="true">
    <h3>{t('ورود با کیف پول وب۳.', 'Sign in with a Web3 wallet.')}</h3>
    <p role="status" className="wallet-panel-status"><i className="wallet-panel-dot" aria-hidden="true" />{t('در حال بررسی اتصال کیف پول…', 'Checking your wallet connection…')}</p>
  </div>

  const correctNetwork = chain?.id === target.id
  const details = <dl className="wallet-panel-details">
    <div><dt>{t('آدرس', 'Address')}</dt><dd><bdi dir="ltr" title={address}>{short(address)}</bdi></dd></div>
    <div><dt>{t('شبکه', 'Network')}</dt><dd><bdi dir="ltr">{chain?.name || t('شبکه ناشناخته', 'Unknown network')}</bdi></dd></div>
  </dl>

  if (state === 'authenticated') return <div className="wallet-panel" data-wallet-state={state} dir={dirOf(locale)} lang={locale}>
    <h3><i className="wallet-panel-dot live" aria-hidden="true" />{t('کیف پول متصل است', 'Wallet connected')}</h3>
    {details}
    <p role="status" className={correctNetwork ? 'wallet-panel-ready' : 'wallet-panel-note'}>
      {correctNetwork
        ? t('آماده انتخاب چالش', 'Ready to choose a challenge')
        : <>{t('برای خرید چالش، شبکهٔ کیف پول را به ', 'To buy a challenge, switch your wallet network to ')}<bdi dir="ltr">{target.name}</bdi>{t(' تغییر دهید.', '.')}</>}
    </p>
  </div>

  if (state === 'suspended') return <div className="wallet-panel" data-wallet-state={state} dir={dirOf(locale)} lang={locale}>
    <h3><i className="wallet-panel-dot warn" aria-hidden="true" />{t('کیف پول متصل است', 'Wallet connected')}</h3>
    {details}
    <p role="status" className="wallet-panel-note">{t('این حساب معلق است.', 'This account is suspended.')}</p>
  </div>

  /* connected (or signing): wallet linked, Openfund sign-in still required */
  return <div className="wallet-panel" data-wallet-state={state} dir={dirOf(locale)} lang={locale}>
    <h3><i className="wallet-panel-dot info" aria-hidden="true" />{t('کیف پول متصل است', 'Wallet connected')}</h3>
    {details}
    <p className="wallet-panel-note">{t('ورود به اوپن‌فاند برای ادامه لازم است.', 'Sign in to Openfund to continue.')}</p>
    <button type="button" className="button wallet-trigger" disabled={state === 'signing'} onClick={() => void session.signIn()}>
      {state === 'signing' ? t('در حال امضا…', 'Signing…') : t('ورود به اوپن‌فاند', 'Sign in to Openfund')}
    </button>
  </div>
}
