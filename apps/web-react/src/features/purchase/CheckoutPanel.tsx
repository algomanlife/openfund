import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession, apiFetch } from '../../session/useOpenfundSession'
import { publicRuntimeConfig } from '../../config/runtime'
import './purchase.css'

/**
 * Challenge checkout panel (fa/en) — server-priced order → on-chain payment
 * instructions → server-side verification → provisioning + invoice.
 *
 * Payment flow contract (backend /purchases/*):
 *  - the plan/size price ALWAYS comes from the backend order (server-controlled);
 *  - the receiver address and chain come from the order's payment instructions
 *    (runtime env on the backend — never hardcoded in the frontend);
 *  - verification is server-side: the user submits the transaction hash and
 *    the backend checks receipt, sender, receiver, amount and timing;
 *  - DePay widget integration is optional (VITE_DEPAY_WIDGET=1) and only
 *    bootstrapped from backend-provided payment configuration.
 *
 * While the backend reports payments disabled (destination unset), the panel
 * states plainly that purchasing is not active — mirroring the legacy dialog.
 */

interface PlanInfo { slug: string, name: string, accountSizesUsd: number[], priceUsd: Record<string, number>, free: boolean }
interface OrderView {
  id: string, status: string, account_size_usd: string, price_usd: string, currency: string,
  created_at: string, expires_at: string, paid_at: string | null, plan_slug: string, plan_name: string
}
interface PaymentInfo { chainId: number, receiver: string, token: string | null, amount: string, reference: string }

const ERR_FA: Record<string, string> = {
  purchases_disabled: 'خرید در این نسخه فعال نیست.',
  invalid_account_size: 'اندازهٔ حساب معتبر نیست.',
  not_purchasable: 'این پلن قابل خرید نیست.',
  plan_not_found: 'پلن یافت نشد.',
  order_expired: 'زمان اعتبار سفارش تمام شد؛ دوباره تلاش کن.',
  order_not_pending: 'این سفارش قابل پرداخت نیست.',
  tx_not_successful: 'تراکنش روی زنجیره موفق نبوده است.',
  tx_not_found: 'تراکنش یافت نشد.',
  wrong_sender: 'تراکنش باید از همان کیف پول ورودی شما امضا شده باشد.',
  wrong_receiver: 'مقصد تراکنش با آدرس پرداخت اوپن‌فاند تفاوت دارد.',
  wrong_token: 'توکن پرداخت با تنظیمات تفاوت دارد.',
  insufficient_amount: 'مبلغ تراکنش کمتر از قیمت سفارش است.',
  transfer_not_from_payer: 'انتقال توکن از کیف پول شما نبوده است.',
  tx_too_old: 'این تراکنش قدیمی‌تر از سفارش است.',
  tx_already_used: 'این تراکنش قبلاً استفاده شده است.',
  unsupported_chain: 'زنجیرهٔ تراکنش پشتیبانی نمی‌شود.',
}
const ERR_EN: Record<string, string> = {
  purchases_disabled: 'Purchasing is not enabled in this release.',
  invalid_account_size: 'Invalid account size.',
  not_purchasable: 'This plan is not purchasable.',
  plan_not_found: 'Plan not found.',
  order_expired: 'This order expired — please try again.',
  order_not_pending: 'This order is not payable.',
  tx_not_successful: 'The on-chain transaction was not successful.',
  tx_not_found: 'Transaction not found.',
  wrong_sender: 'The transaction must be signed by your signed-in wallet.',
  wrong_receiver: 'The transaction recipient does not match the Openfund payment address.',
  wrong_token: 'The payment token does not match the configuration.',
  insufficient_amount: 'The transferred amount is below the order price.',
  transfer_not_from_payer: 'The token transfer did not come from your wallet.',
  tx_too_old: 'This transaction predates the order.',
  tx_already_used: 'This transaction was already used.',
  unsupported_chain: 'Unsupported transaction chain.',
}
const STATUS_FA: Record<string, string> = { created: 'ایجادشده', started: 'در جریان', passed: 'قبول‌شده', failed: 'شکست‌خورده', expired: 'منقضی', cancelled: 'لغو‌شده' }
const CHAIN_LABEL: Record<number, string> = { 11155111: 'Ethereum Sepolia', 42161: 'Arbitrum One' }

export function CheckoutPanel(props: { planSlug: string, accountSize: number, onClose: () => void }) {
  const { planSlug, accountSize, onClose } = props
  const session = useSession()
  const isFa = (window as any).ofLang !== 'en'
  const t = (fa: string, en: string) => (isFa ? fa : en)
  const errText = (e: string) => isFa ? (ERR_FA[e] || e) : (ERR_EN[e] || e)
  const fmtMoney = (v: string | number) => '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })

  const [plans, setPlans] = useState<PlanInfo[] | null>(null)
  const [paymentsEnabled, setPaymentsEnabled] = useState(false)
  const [paymentCfg, setPaymentCfg] = useState<{ chainId: number, receiver: string, token: string | null } | null>(null)
  const [order, setOrder] = useState<OrderView | null>(null)
  const [payment, setPayment] = useState<PaymentInfo | null>(null)
  const [txHash, setTxHash] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ challengeId: string, invoiceNumber: string } | null>(null)
  const polling = useRef<ReturnType<typeof setInterval> | null>(null)

  const plan = plans?.find(p => p.slug === planSlug) || null
  const authenticated = session.status === 'authenticated'

  /* catalog + payment configuration */
  useEffect(() => {
    void (async () => {
      const r = await apiFetch('/purchases/plans')
      if (r.ok && r.data) {
        setPlans(r.data.plans || [])
        setPaymentsEnabled(!!r.data.paymentsEnabled)
        setPaymentCfg(r.data.payment || null)
      } else setError(t('دریافت پلن‌ها ناموفق بود.', 'Could not load plans.'))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createOrder = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      const r = await apiFetch('/purchases/orders', {
        method: 'POST',
        body: JSON.stringify({ planSlug, accountSize })
      })
      if (!r.ok) { setError(errText(r.data?.error || 'order_failed')); return }
      setOrder(r.data.order)
      setPayment(r.data.payment || null)
    } finally { setBusy(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planSlug, accountSize])

  const verify = useCallback(async () => {
    if (!order) return
    setBusy(true); setError(null)
    try {
      const r = await apiFetch('/purchases/verify', {
        method: 'POST',
        body: JSON.stringify({ orderId: order.id, txHash: txHash.trim() })
      })
      if (!r.ok) { setError(errText(r.data?.error || 'verify_failed')); return }
      setResult(r.data)
      await session.reload?.()
    } finally { setBusy(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, txHash])

  /* poll order status while a pending order is shown (DePay widget, delayed
     verifications and the test seam all converge here) */
  useEffect(() => {
    if (!order || order.status !== 'pending' || result) return
    polling.current = setInterval(async () => {
      const r = await apiFetch(`/purchases/orders/${order.id}`).catch(() => null)
      if (r?.ok && r.data?.order && r.data.order.status !== order.status) {
        setOrder(r.data.order)
        if (r.data.order.status === 'paid') {
          const h = await apiFetch('/purchases/history').catch(() => null)
          const row = h?.data?.orders?.find((o: any) => o.id === order.id)
          if (row?.invoice?.number) setResult({ challengeId: row.challenge_id, invoiceNumber: row.invoice.number })
          await session.reload?.()
        }
      }
    }, 5000)
    return () => { if (polling.current) clearInterval(polling.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.status, result])

  /* optional DePay widget — only when explicitly enabled (VITE_DEPAY_WIDGET=1
     + VITE_DEPAY_WIDGET_URL pointing at the approved widget bundle) AND the
     backend provides payment configuration; amounts/receivers always come
     from the backend order, never from this file */
  const depayUrl = (import.meta.env?.PROD ? publicRuntimeConfig().depayWidget : (import.meta.env?.VITE_DEPAY_WIDGET as string | undefined) === '1')
    ? (import.meta.env?.PROD ? publicRuntimeConfig().depayWidgetUrl : import.meta.env?.VITE_DEPAY_WIDGET_URL as string | undefined)
    : undefined
  const openDepay = async () => {
    if (!payment || !paymentCfg || !depayUrl) return
    setBusy(true)
    try {
      const w = window as any
      if (!w.DePayWidgets) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script')
          s.src = depayUrl
          s.dataset.ofDepay = '1'
          s.onload = () => resolve()
          s.onerror = () => reject(new Error('depay_load_failed'))
          document.head.appendChild(s)
        })
      }
      const widgets = w.DePayWidgets
      if (widgets?.payment) {
        const blockchain = paymentCfg.chainId === 42161 ? 'arbitrum' : 'ethereum'
        void widgets.payment({
          accept: [{
            blockchain,
            amount: payment.amount,
            token: paymentCfg.token || '0x0000000000000000000000000000000000000000',
            receiver: payment.receiver,
          }],
        })
      } else setError(t('درگاه پرداخت بارگذاری نشد؛ پرداخت دستی را انجام بده.', 'Payment widget failed to load; use the manual payment below.'))
    } catch {
      setError(t('درگاه پرداخت بارگذاری نشد؛ پرداخت دستی را انجام بده.', 'Payment widget failed to load; use the manual payment below.'))
    } finally { setBusy(false) }
  }

  return createPortal(
    <div className="of-checkout-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <dialog className="of-checkout" dir={isFa ? 'rtl' : 'ltr'} open onClose={onClose}>
        <button className="dialog-close of-checkout-close" onClick={onClose} aria-label={t('بستن', 'Close')}>×</button>
        <h2>{t('خرید چالش', 'Challenge Checkout')}</h2>

        {/* ---- summary ---- */}
        {plan && (
          <div className="of-checkout-summary">
            <div><span>{t('پلن', 'Plan')}</span><b>{plan.name}</b></div>
            <div><span>{t('اندازهٔ حساب', 'Account size')}</span><b dir="ltr">{fmtMoney(accountSize)}</b></div>
            <div><span>{t('هزینهٔ ارزیابی', 'Evaluation fee')}</span><b dir="ltr">{fmtMoney(plan.priceUsd[String(accountSize)] ?? '—')}</b></div>
          </div>
        )}

        {/* ---- gate: authentication ---- */}
        {!authenticated && (
          <div className="of-checkout-note">
            <p>{t('برای خرید، اول کیف پول را وصل و با امضا وارد شو.', 'Connect your wallet and sign in to purchase.')}</p>
            <button className="button" onClick={() => { onClose(); (window as any).__ofOpenConnect?.() }}>
              {t('اتصال کیف پول', 'Connect wallet')}
            </button>
          </div>
        )}

        {/* ---- gate: payments disabled ---- */}
        {authenticated && plans && !paymentsEnabled && (
          <div className="of-checkout-note">
            <p>{t('فعال‌سازی خرید در این نسخه فراهم نیست. با تنظیم مقصد پرداخت روی سرور فعال می‌شود.',
              'Purchases are not enabled in this release. They activate once the server payment destination is configured.')}</p>
          </div>
        )}

        {/* ---- create order ---- */}
        {authenticated && paymentsEnabled && !order && !result && (
          <button className="button full" disabled={busy || !plan} onClick={createOrder}>
            {busy ? '…' : t('ساخت سفارش و دریافت آدرس پرداخت', 'Create order & get payment address')}
          </button>
        )}

        {/* ---- pay ---- */}
        {authenticated && order && !result && (
          <div className="of-checkout-pay">
            {order.status === 'pending' ? (
              <>
                <p className="of-checkout-step">{t('۱. مبلغ دقیق را به این آدرس بفرست', '1. Send the exact amount to this address')}:</p>
                <div className="of-checkout-addr">
                  <code dir="ltr">{payment?.receiver}</code>
                  <button className="of-profile-plainbtn" onClick={() => void navigator.clipboard?.writeText(payment?.receiver || '')}>
                    {t('کپی', 'Copy')}
                  </button>
                </div>
                <div className="of-checkout-meta">
                  <span>{t('مبلغ', 'Amount')}: <b dir="ltr">{payment ? fmtMoney(order.price_usd) : '—'}</b></span>
                  <span>{t('زنجیره', 'Chain')}: <b>{CHAIN_LABEL[payment?.chainId || 0] || payment?.chainId}</b></span>
                  <span>{t('دارایی', 'Asset')}: <b dir="ltr">{payment?.token ? 'Token' : 'ETH'}</b></span>
                </div>
                {depayUrl && payment && (
                  <button className="button full" disabled={busy} onClick={openDepay}>
                    {t('پرداخت با DePay', 'Pay with DePay')}
                  </button>
                )}
                <p className="of-checkout-step">{t('۲. پس از پرداخت، هش تراکنش را وارد کن', '2. After paying, enter the transaction hash')}:</p>
                <input dir="ltr" className="of-checkout-tx" placeholder="0x…" value={txHash}
                  onChange={e => setTxHash(e.target.value)} spellCheck={false} />
                <div className="of-checkout-actions">
                  <button className="button" disabled={busy || !/^0x[0-9a-fA-F]{64}$/.test(txHash.trim())} onClick={verify}>
                    {busy ? '…' : t('تأیید پرداخت', 'Verify payment')}
                  </button>
                  <button className="of-profile-plainbtn" disabled={busy}
                    onClick={() => { void apiFetch(`/purchases/orders/${order.id}/cancel`, { method: 'POST', body: '{}' }); onClose() }}>
                    {t('لغو سفارش', 'Cancel order')}
                  </button>
                </div>
              </>
            ) : (
              <p className="of-checkout-status">{t('وضعیت سفارش', 'Order status')}: <b>{order.status}</b></p>
            )}
          </div>
        )}

        {/* ---- success ---- */}
        {result && (
          <div className="of-checkout-done">
            <p>✓ {t('پرداخت تأیید شد و چالش شما ساخته شد.', 'Payment verified — your challenge is provisioned.')}</p>
            <div className="of-checkout-meta">
              <span>{t('شمارهٔ فاکتور', 'Invoice')}: <b dir="ltr">{result.invoiceNumber}</b></span>
              <span>{t('شناسهٔ چالش', 'Challenge')}: <b dir="ltr">{String(result.challengeId).slice(0, 8)}…</b></span>
            </div>
            <div className="of-checkout-actions">
              <a className="button" href={`#/${isFa ? 'fa' : 'en'}/prop/purchases`} onClick={onClose}>
                {t('تاریخچهٔ خرید و فاکتورها', 'Purchases & invoices')}
              </a>
              <a className="button" href={`#/${isFa ? 'fa' : 'en'}/prop/dashboard`} onClick={onClose}>
                {t('رفتن به داشبورد', 'Go to Dashboard')}
              </a>
            </div>
          </div>
        )}

        {error && <p className="of-profile-error" role="alert">{error}</p>}
      </dialog>
    </div>,
    document.body
  )
}
