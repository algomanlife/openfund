import { pick, type AppLocale } from '../i18n/locales'

/* ============================================================
   Wallet / SIWE error classification.

   Wallets report the same situations through different shapes (EIP-1193
   `code`, viem error classes with a `cause` chain, ethers-style
   `ACTION_REJECTED`, plain strings). Every user-facing message goes through
   `walletErrorMessage` so that:
   - a request the user declined in the wallet is reported neutrally (it is
     a normal choice, not a site failure);
   - real failures name an actionable cause instead of a raw provider string.
   ============================================================ */

export type WalletStage = 'connect' | 'network' | 'sign' | 'session' | 'restore'

export type WalletErrorKind =
  | 'rejected'           /* EIP-1193 4001 — the user declined in the wallet */
  | 'pending'            /* -32002 — a request is already open in the wallet */
  | 'unauthorized'       /* 4100 — wallet locked / account not authorised */
  | 'unsupported'        /* 4200 — the wallet does not support the method */
  | 'chain_unknown'      /* 4902 — the wallet does not know the network */
  | 'disconnected'       /* 4900 / 4901 — provider disconnected */
  | 'no_provider'        /* the selected wallet extension is unavailable */
  | 'server_unreachable' /* Openfund backend could not be reached */
  | 'domain'             /* backend rejected this site's address for SIWE */
  | 'expired'            /* nonce/message expired or reused */
  | 'signature'          /* backend could not verify the signature */
  | 'rate_limited'       /* backend throttled the request */
  | 'suspended'
  | 'unknown'

export interface ClassifiedWalletError { kind: WalletErrorKind; detail: string }

const BACKEND_KINDS: Record<string, WalletErrorKind> = {
  invalid_domain: 'domain', invalid_uri: 'domain', invalid_origin: 'domain',
  nonce_expired: 'expired', nonce_reused: 'expired', unknown_nonce: 'expired', invalid_message_time: 'expired',
  invalid_signature: 'signature', invalid_message: 'signature', invalid_payload: 'signature', nonce_address_mismatch: 'signature', missing_nonce: 'signature',
  invalid_chain: 'chain_unknown', rate_limited: 'rate_limited', account_suspended: 'suspended',
  server_unreachable: 'server_unreachable', nonce: 'server_unreachable', internal: 'server_unreachable',
}

/** Error raised for Openfund backend responses (code = backend `error`). */
export class OpenfundAuthError extends Error {
  constructor(public code: string, public status = 0) { super(code); this.name = 'OpenfundAuthError' }
}

function chain(error: unknown): any[] {
  const seen: any[] = []
  let current: any = error
  for (let i = 0; current && i < 8 && !seen.includes(current); i++) { seen.push(current); current = current.cause }
  return seen
}

export function classifyWalletError(error: unknown): ClassifiedWalletError {
  const links = chain(error)
  const detail = String((links[0] as any)?.shortMessage || (links[0] as any)?.message || error || '').slice(0, 200)
  for (const e of links) {
    if (e instanceof OpenfundAuthError || e?.name === 'OpenfundAuthError') return { kind: BACKEND_KINDS[e.code] || (e.status === 429 ? 'rate_limited' : e.status >= 500 ? 'server_unreachable' : 'unknown'), detail: e.code }
    const code = e?.code
    const name = String(e?.name || '')
    if (code === 4001 || code === 'ACTION_REJECTED' || name === 'UserRejectedRequestError') return { kind: 'rejected', detail }
    if (code === -32002 || name === 'ResourceUnavailableRpcError') return { kind: 'pending', detail }
    if (code === 4100 || name === 'UnauthorizedProviderError') return { kind: 'unauthorized', detail }
    if (code === 4200 || name === 'UnsupportedProviderMethodError' || name === 'SwitchChainNotSupportedError') return { kind: 'unsupported', detail }
    if (code === 4902 || name === 'ChainNotConfiguredError') return { kind: 'chain_unknown', detail }
    if (code === 4900 || code === 4901 || name === 'ProviderDisconnectedError' || name === 'ChainDisconnectedError') return { kind: 'disconnected', detail }
    if (name === 'ProviderNotFoundError' || name === 'ConnectorNotFoundError') return { kind: 'no_provider', detail }
    if (name === 'ConnectorAlreadyConnectedError') return { kind: 'pending', detail }
  }
  /* last resort for wallets that only send text */
  if (/user (rejected|denied|cancel+ed)|rejected by user|request rejected|user disapproved/i.test(detail)) return { kind: 'rejected', detail }
  if (/already pending|already processing/i.test(detail)) return { kind: 'pending', detail }
  if (error instanceof TypeError && /fetch|network|load failed/i.test(detail)) return { kind: 'server_unreachable', detail }
  return { kind: 'unknown', detail }
}

/** A declined request is a user decision: shown as neutral status, not an alert. */
export const isNeutral = (kind: WalletErrorKind) => kind === 'rejected'

export function walletErrorMessage(locale: AppLocale, stage: WalletStage, error: ClassifiedWalletError): string {
  const t = (fa: string, en: string) => pick(locale, fa, en)
  switch (error.kind) {
    case 'rejected':
      return stage === 'connect' ? t('درخواست اتصال در کیف پول رد شد. هر زمان آماده بودید دوباره تلاش کنید.', 'The connection request was declined in your wallet. Try again whenever you are ready.')
        : stage === 'network' ? t('تغییر شبکه در کیف پول رد شد. برای ادامه، شبکهٔ درخواستی لازم است.', 'The network switch was declined in your wallet. The requested network is needed to continue.')
        : t('امضای ورود در کیف پول رد شد. کیف پول متصل می‌ماند و هر زمان بخواهید می‌توانید وارد شوید.', 'The sign-in signature was declined in your wallet. Your wallet stays connected and you can sign in whenever you choose.')
    case 'pending': return t('یک درخواست در کیف پول شما باز است. پنجرهٔ افزونه را باز کنید و آن را تأیید یا رد کنید.', 'A request is already open in your wallet. Open the wallet extension and approve or decline it.')
    case 'unauthorized': return t('کیف پول قفل است یا این حساب مجاز نشده است. کیف پول را باز کنید و دوباره تلاش کنید.', 'Your wallet is locked or this account is not authorised. Unlock the wallet and try again.')
    case 'unsupported': return t('این کیف پول از این درخواست پشتیبانی نمی‌کند. شبکه را دستی در کیف پول تغییر دهید یا کیف پول دیگری انتخاب کنید.', 'This wallet does not support this request. Change the network manually in the wallet or choose another wallet.')
    case 'chain_unknown': return t('کیف پول این شبکه را نمی‌شناسد. شبکه را در کیف پول اضافه کنید و دوباره تلاش کنید.', 'Your wallet does not recognise this network. Add the network in your wallet and try again.')
    case 'disconnected': return t('ارتباط با کیف پول قطع شد. افزونه را باز کنید و دوباره وصل شوید.', 'The wallet disconnected. Open the extension and connect again.')
    case 'no_provider': return t('کیف پول انتخاب‌شده در این مرورگر در دسترس نیست. افزونه را فعال کنید یا کیف پول دیگری انتخاب کنید.', 'The selected wallet is not available in this browser. Enable the extension or choose another wallet.')
    case 'server_unreachable': return stage === 'restore'
        ? t('بازیابی نشست ممکن نشد چون سرور اوپن‌فاند در دسترس نیست. اتصال اینترنت را بررسی و صفحه را دوباره بارگذاری کنید.', 'Your session could not be restored because the Openfund server is unreachable. Check your connection and reload the page.')
        : t('سرور اوپن‌فاند در دسترس نیست. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.', 'The Openfund server is unreachable. Check your connection and try again.')
    case 'domain': return t('ورود از این نشانی سایت پذیرفته نشد. این یک مشکل پیکربندی سرور است؛ لطفاً به پشتیبانی اطلاع دهید.', 'Sign-in from this site address was not accepted. This is a server configuration problem; please contact support.')
    case 'expired': return t('درخواست ورود منقضی شد. دوباره روی «ورود» بزنید تا پیام تازه‌ای امضا کنید.', 'The sign-in request expired. Select Sign in again to sign a fresh message.')
    case 'signature': return t('امضا تأیید نشد. مطمئن شوید همان حساب متصل را امضا می‌کنید و دوباره تلاش کنید.', 'The signature could not be verified. Make sure you sign with the connected account and try again.')
    case 'rate_limited': return t('تعداد درخواست‌ها زیاد بود. یک دقیقه صبر کنید و دوباره تلاش کنید.', 'Too many requests. Wait a minute and try again.')
    case 'suspended': return t('این حساب معلق است.', 'This account is suspended.')
    default: return stage === 'connect' ? t('اتصال کیف پول انجام نشد. دوباره تلاش کنید یا کیف پول دیگری انتخاب کنید.', 'The wallet could not be connected. Try again or choose another wallet.')
        : stage === 'network' ? t('تغییر شبکه انجام نشد. شبکه را دستی در کیف پول تغییر دهید.', 'The network could not be switched. Change it manually in your wallet.')
        : t('ورود انجام نشد. دوباره تلاش کنید.', 'Sign-in did not complete. Please try again.')
  }
}
