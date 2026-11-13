import { publicRuntimeConfig } from '../../config/runtime'
import { DEPAY_WIDGETS_INTEGRITY, DEPAY_WIDGETS_PATH } from './depay-bundle'

/**
 * Official DePay Payment Widget (https://depay.com/docs/payments/integrate/widget/),
 * managed integration:
 *
 *   DePayWidgets.Payment({ integration: '<id>', payload: { orderId } })
 *
 * DePay posts the payload to Openfund's signed dynamic-configuration endpoint
 * and receives the accepted settlement chains, tokens, receivers and the
 * server price of the order. Openfund passes no `accept`, `allow`,
 * `blockchains` or token list here: which wallets, networks and payer tokens
 * can be used (and converted into the settlement token) is decided by DePay
 * and the owner's integration settings, never narrowed by this file.
 *
 * Client-side callbacks only drive the interface. Payment is confirmed by the
 * signed server callback plus Openfund's on-chain verification.
 */

export interface DePayHandlers {
  sent?: (tx: DePayTransaction) => void
  succeeded?: (tx: DePayTransaction) => void
  validated?: (successful: boolean, tx: DePayTransaction) => void
  failed?: (tx: DePayTransaction, error: unknown) => void
  closed?: () => void
  critical?: (error: unknown) => void
  error?: (error: unknown) => void
}
export interface DePayTransaction { id?: string, url?: string, blockchain?: string, from?: string }

interface DePayWidgetsGlobal { Payment: (options: Record<string, unknown>) => Promise<{ unmount?: () => void } | undefined> | { unmount?: () => void } | undefined }
type WindowWithDePay = Window & { DePayWidgets?: DePayWidgetsGlobal }

/** whether this deployment has an active DePay integration */
export function depayConfigured(): boolean {
  const rc = publicRuntimeConfig()
  return !!(rc.depayWidget && rc.depayIntegrationId)
}

/** where the bundle is loaded from: the vendored same-origin file by default,
 *  or an operator-configured external bundle (always SRI-pinned) */
export function depayBundleSource(): { src: string, integrity: string } {
  const rc = publicRuntimeConfig()
  if (rc.depayWidgetUrl && rc.depayWidgetIntegrity) return { src: rc.depayWidgetUrl, integrity: rc.depayWidgetIntegrity }
  return { src: import.meta.env.BASE_URL + DEPAY_WIDGETS_PATH, integrity: DEPAY_WIDGETS_INTEGRITY }
}

let loading: Promise<DePayWidgetsGlobal> | null = null
export function loadDePayWidgets(): Promise<DePayWidgetsGlobal> {
  const w = window as WindowWithDePay
  if (w.DePayWidgets?.Payment) return Promise.resolve(w.DePayWidgets)
  if (loading) return loading
  const { src, integrity } = depayBundleSource()
  loading = new Promise<DePayWidgetsGlobal>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = src
    /* a changed or tampered bundle never executes */
    el.integrity = integrity
    el.crossOrigin = 'anonymous'
    el.async = true
    el.dataset.ofDepay = '1'
    el.onload = () => (w.DePayWidgets?.Payment ? resolve(w.DePayWidgets) : reject(new Error('depay_unavailable')))
    el.onerror = () => { el.remove(); reject(new Error('depay_load_failed')) }
    document.head.appendChild(el)
  }).catch(e => { loading = null; throw e })
  return loading
}

/* one widget at a time: a second click while it is open does nothing */
let active: { orderId: string, unmount?: () => void } | null = null
export const depayOpenFor = () => active?.orderId ?? null

export async function openDePayPayment(orderId: string, handlers: DePayHandlers = {}): Promise<boolean> {
  if (active) return false
  const rc = publicRuntimeConfig()
  if (!rc.depayIntegrationId) throw new Error('depay_not_configured')
  active = { orderId }
  try {
    const widgets = await loadDePayWidgets()
    const release = () => { active = null }
    const handle = await widgets.Payment({
      integration: rc.depayIntegrationId,
      payload: { orderId },
      sent: (tx: DePayTransaction) => handlers.sent?.(tx),
      succeeded: (tx: DePayTransaction) => handlers.succeeded?.(tx),
      validated: (ok: boolean, tx: DePayTransaction) => handlers.validated?.(ok, tx),
      failed: (tx: DePayTransaction, error: unknown) => handlers.failed?.(tx, error),
      critical: (error: unknown) => { release(); handlers.critical?.(error) },
      error: (error: unknown) => handlers.error?.(error),
      closed: () => { release(); handlers.closed?.() },
    })
    if (active) active.unmount = handle?.unmount
    return true
  } catch (e) {
    active = null
    throw e
  }
}

/** close the widget (e.g. when the page unmounts) */
export function closeDePayPayment() {
  try { active?.unmount?.() } catch { /* already closed */ }
  active = null
}
