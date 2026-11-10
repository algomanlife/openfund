import { currentLocale, dirOf, pick } from '../../i18n/locales'
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
 *  - coupons are validated and priced by the server (/purchases/quote); a
 *    100% discount is provisioned by the zero-payment flow, with no payment;
 *  - the DePay button is optional (VITE_DEPAY_WIDGET=1), lists the
 *    settlement chains the SERVER configured (payment is not tied to the
 *    Arbitrum sign-in chain; DePay converts the payer's token) and carries
 *    only the order id — DePay fetches the signed accept list from the backend.
 *
 * While the backend reports payments disabled (destination unset), the panel
 * states plainly that purchasing is not active — mirroring the legacy dialog.
 */

interface PlanInfo { slug: string, name: string, accountSizesUsd: number[], priceUsd: Record<string, number>, free: boolean }
interface Quote { listPriceUsd: string, discountUsd: string, priceUsd: string, couponCode: string | null, paymentRequired: boolean }
interface OrderView {
  id: string, status: string, lifecycle_state?: string, account_size_usd: string, price_usd: string, currency: string,
  list_price_usd?: string, discount_usd?: string, payment_required?: boolean, coupon_code?: string | null,
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
  tx_pending: 'تراکنش هنوز در زنجیره ثبت نشده است؛ چند لحظه دیگر دوباره بررسی می‌شود.',
  tx_not_final: 'تراکنش ثبت شده ولی هنوز تعداد تأییدهای لازم را ندارد؛ خودکار پیگیری می‌شود.',
  tx_reorged: 'بلاک تراکنش تغییر کرده است؛ دوباره بررسی می‌شود.',
  rpc_unavailable: 'اتصال به شبکه موقتاً در دسترس نیست؛ پرداخت شما از دست نمی‌رود و دوباره بررسی می‌شود.',
  payment_misconfigured: 'پیکربندی پرداخت کامل نیست؛ با پشتیبانی تماس بگیر.',
  unapproved_contract: 'این تراکنش از طریق قرارداد تأییدنشده انجام شده است.',
  native_payment_unsupported: 'پرداخت با ارز بومی شبکه پشتیبانی نمی‌شود؛ از استیبل‌کوین پیشنهادی استفاده کن.',
  coupon_invalid: 'کد تخفیف معتبر نیست.',
  coupon_not_found: 'کد تخفیف یافت نشد.',
  coupon_disabled: 'این کد تخفیف غیرفعال است.',
  coupon_not_started: 'این کد تخفیف هنوز فعال نشده است.',
  coupon_expired: 'زمان اعتبار این کد تخفیف تمام شده است.',
  coupon_not_applicable: 'این کد تخفیف برای این پلن یا اندازهٔ حساب نیست.',
  coupon_exhausted: 'ظرفیت استفاده از این کد تخفیف تمام شده است.',
  coupon_already_used: 'شما قبلاً از این کد تخفیف استفاده کرده‌اید.',
  rate_limited: 'درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کن.',
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
  tx_pending: 'The transaction is not on-chain yet — checking again shortly.',
  tx_not_final: 'The transaction is mined but does not have enough confirmations yet — following up automatically.',
  tx_reorged: 'The transaction block changed — re-checking.',
  rpc_unavailable: 'The network is temporarily unreachable. Your payment is not lost and will be re-checked.',
  payment_misconfigured: 'Payment configuration is incomplete — please contact support.',
  unapproved_contract: 'This transaction went through an unapproved contract.',
  native_payment_unsupported: 'Native-coin payments are not supported — pay with the listed stablecoin.',
  coupon_invalid: 'This coupon code is not valid.',
  coupon_not_found: 'Coupon not found.',
  coupon_disabled: 'This coupon is disabled.',
  coupon_not_started: 'This coupon is not active yet.',
  coupon_expired: 'This coupon has expired.',
  coupon_not_applicable: 'This coupon does not apply to this plan or account size.',
  coupon_exhausted: 'This coupon has reached its usage limit.',
  coupon_already_used: 'You have already used this coupon.',
  rate_limited: 'Too many requests — please try again shortly.',
}
/* conditions that resolve on their own: keep polling instead of failing */
const RETRYABLE = new Set(['tx_pending', 'tx_not_final', 'tx_reorged', 'rpc_unavailable'])
const txKey = (orderId: string) => 'of.checkout.tx.' + orderId
const readTx = (orderId: string) => { try { return localStorage.getItem(txKey(orderId)) || '' } catch { return '' } }
const saveTx = (orderId: string, tx: string) => { try { localStorage.setItem(txKey(orderId), tx) } catch { /* private mode */ } }
const clearTx = (orderId: string) => { try { localStorage.removeItem(txKey(orderId)) } catch { /* private mode */ } }
const STATUS_FA: Record<string, string> = { created: 'ایجادشده', started: 'در جریان', passed: 'قبول‌شده', failed: 'شکست‌خورده', expired: 'منقضی', cancelled: 'لغو‌شده' }
const CHAIN_LABEL: Record<number, string> = {
  11155111: 'Ethereum Sepolia', 42161: 'Arbitrum One', 1: 'Ethereum', 8453: 'Base', 10: 'Optimism', 137: 'Polygon',
  56: 'BNB Smart Chain', 43114: 'Avalanche', 100: 'Gnosis', 480: 'World Chain', 501: 'Solana',
}
/** one idempotency key per checkout attempt: a retried or interrupted
 *  request returns the same order instead of creating a second one */
const newAttemptKey = () => { try { return crypto.randomUUID() } catch { return String(Date.now()) + Math.random().toString(16).slice(2) } }

export function CheckoutPanel(props: { planSlug: string, accountSize: number, onClose: () => void }) {
  const { planSlug, accountSize, onClose } = props
  const session = useSession()
  const locale = currentLocale(), isFa = locale === 'fa'
  const t = (fa: string, en: string) => pick(locale, fa, en)
  const errText = (e: string) => isFa ? (ERR_FA[e] || e) : (ERR_EN[e] || e)
  const fmtMoney = (v: string | number) => '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })

  const [plans, setPlans] = useState<PlanInfo[] | null>(null)
  const [paymentsEnabled, setPaymentsEnabled] = useState(false)
  const [paymentCfg, setPaymentCfg] = useState<{ chainId: number, receiver: string, token: string | null, chains?: { blockchain: string | null }[] } | null>(null)
  const [order, setOrder] = useState<OrderView | null>(null)
  const [payment, setPayment] = useState<PaymentInfo | null>(null)
  const [txHash, setTxHash] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ challengeId: string, invoiceNumber: string } | null>(null)
  const [waiting, setWaiting] = useState<string | null>(null)
  const [attemptError, setAttemptError] = useState<string | null>(null)
  const [widgetOpen, setWidgetOpen] = useState(false)
  const [manual, setManual] = useState(false) /* manual payment only when the widget cannot load */
  const [couponInput, setCouponInput] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const attemptKey = useRef(newAttemptKey())
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

  /* coupon → authoritative server quote (the browser never prices) */
  const applyCoupon = useCallback(async () => {
    const code = couponInput.trim()
    setCouponError(null)
    if (!code) { setQuote(null); return }
    setBusy(true)
    try {
      const r = await apiFetch('/purchases/quote', { method: 'POST', body: JSON.stringify({ planSlug, accountSize, couponCode: code }) })
      if (!r.ok) { setQuote(null); setCouponError(errText(r.data?.error || 'coupon_invalid')); return }
      setQuote(r.data as Quote)
      attemptKey.current = newAttemptKey()
    } finally { setBusy(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponInput, planSlug, accountSize])

  const createOrder = useCallback(async (): Promise<OrderView | null> => {
    setBusy(true); setError(null)
    try {
      const r = await apiFetch('/purchases/orders', {
        method: 'POST',
        body: JSON.stringify({ planSlug, accountSize, couponCode: quote?.couponCode || undefined, idempotencyKey: attemptKey.current })
      })
      if (!r.ok) { setError(errText(r.data?.error || 'order_failed')); return null }
      setOrder(r.data.order)
      setPayment(r.data.payment || null)
      /* zero-payment (100% coupon): provisioned in the same request */
      if (r.data.result?.challengeId) { setResult(r.data.result); await session.reload?.() }
      return r.data.order as OrderView
    } finally { setBusy(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planSlug, accountSize, quote])

  /* The backend on-chain verifier is the ONLY authority. A retryable answer
     (not mined yet / not final / RPC down) is not a failure: the hash is
     kept (survives a page refresh) and the check repeats until it settles. */
  const runVerify = useCallback(async (orderId: string, hash: string, silent = false) => {
    if (!silent) { setBusy(true); setError(null) }
    try {
      const r = await apiFetch('/purchases/verify', {
        method: 'POST',
        body: JSON.stringify({ orderId, txHash: hash })
      })
      if (r.ok) {
        clearTx(orderId); setWaiting(null); setError(null)
        setResult(r.data)
        await session.reload?.()
        return 'done'
      }
      const code = r.data?.error || 'verify_failed'
      if (r.data?.retryable || RETRYABLE.has(code)) { saveTx(orderId, hash); setWaiting(errText(code)); return 'retry' }
      clearTx(orderId); setWaiting(null); setError(errText(code))
      return 'failed'
    } finally { if (!silent) setBusy(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const verify = useCallback(async () => {
    if (!order) return
    const hash = txHash.trim()
    saveTx(order.id, hash)
    await runVerify(order.id, hash)
  }, [order, txHash, runVerify])

  /* resume: reopen a still-payable order for this plan/size after a refresh
     and re-check any transaction hash that was already submitted */
  useEffect(() => {
    if (!authenticated || !paymentsEnabled || order || result) return
    void (async () => {
      const h = await apiFetch('/purchases/history').catch(() => null)
      const row = h?.data?.orders?.find((o: any) => o.status === 'pending' && o.plan_slug === planSlug && Number(o.account_size_usd) === accountSize)
      if (!row) return
      const r = await apiFetch('/purchases/orders/' + row.id).catch(() => null)
      if (r?.ok && r.data?.order?.status === 'pending') { setOrder(r.data.order); setPayment(r.data.payment || null) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, paymentsEnabled])
  useEffect(() => {
    if (!order || result || !['pending', 'expired'].includes(order.status)) return
    const saved = readTx(order.id)
    if (!saved) return
    setTxHash(saved)
    let stop = false
    const tick = async () => { if (stop) return; const out = await runVerify(order.id, saved, true); if (out === 'retry' && !stop) timer = setTimeout(tick, 15000) }
    let timer = setTimeout(tick, 500)
    return () => { stop = true; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, result])

  /* Poll while an order is payable: the DePay callback → backend verification
     → provisioning chain runs without the browser, so this is how the page
     learns the outcome (also after a refresh). It shows retryable waiting
     states and rejected attempts (underpayment, wrong token …) in plain words. */
  useEffect(() => {
    if (!order || order.status !== 'pending' || result) return
    let stop = false
    const tick = async () => {
      const r = await apiFetch(`/purchases/orders/${order.id}`).catch(() => null)
      if (stop) return
      if (r?.ok && r.data?.order?.status === 'paid') {
        setOrder(r.data.order); setWaiting(null); setAttemptError(null)
        const h = await apiFetch('/purchases/history').catch(() => null)
        const row = h?.data?.orders?.find((o: any) => o.id === order.id)
        if (row?.invoice?.number) setResult({ challengeId: row.challenge_id, invoiceNumber: row.invoice.number })
        await session.reload?.()
        return
      }
      if (r?.ok && r.data?.order && r.data.order.status !== order.status) { setOrder(r.data.order); return }
      const a = await apiFetch(`/purchases/orders/${order.id}/attempts`).catch(() => null)
      if (stop || !a?.ok) return
      const latest = (a.data?.attempts || [])[0]
      if (!latest) return
      if (latest.status === 'pending' && latest.error_code) { setWaiting(errText(latest.error_code)); setAttemptError(null) }
      else if (latest.status === 'pending') { setWaiting(t('پرداخت دریافت شد؛ در حال تأیید روی زنجیره…', 'Payment received — confirming on-chain…')); setAttemptError(null) }
      else if (latest.status === 'rejected') { setWaiting(null); setAttemptError(errText(latest.error_code || 'verify_failed')) }
    }
    void tick()
    const timer = setInterval(() => { void tick() }, 3000)
    return () => { stop = true; clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.status, result])

  /* optional DePay widget — only when explicitly enabled (VITE_DEPAY_WIDGET=1
     + VITE_DEPAY_WIDGET_URL pointing at the approved widget bundle) AND the
     backend provides payment configuration; amounts/receivers always come
     from the backend order, never from this file */
  const rc = publicRuntimeConfig()
  const depayUrl = rc.depayWidget && rc.depayWidgetUrl && rc.depayWidgetIntegrity && rc.depayIntegrationId ? rc.depayWidgetUrl : undefined
  const depayAvailable = !!(depayUrl && paymentCfg?.token)
  /* DePay networks = the settlement chains configured on the server */
  const depayBlockchains = (paymentCfg?.chains || []).map(c => c.blockchain).filter((b): b is string => !!b)
  const showManual = !depayAvailable || manual
  const widgetFailed = t('درگاه پرداخت بارگذاری نشد؛ پرداخت دستی را انجام بده.', 'The payment widget could not be loaded — use the manual payment below.')

  /* Official DePay button (https://depay.com/docs/payments/integrate/button/):
     <div class="DePayButton" integration=… blockchains='[…server-configured chains…]' payload=…>
     + DePayButtons.init({document}). The payload carries only the order id;
     DePay then asks OUR server for the accepted payment (chain, token, amount,
     receiver — signed), so the browser can never choose the price, network
     or receiver. The button's own success is not trusted: the signed
     callback/events + on-chain verification decide, and this page learns the
     result by polling. If the approved bundle is the widget bundle instead,
     DePayWidgets.Payment is opened with the same server-configured chain list.
     Wallet sign-in stays on Arbitrum One; a chain switch made by the DePay
     UI does not affect the Openfund session. */
  const depayHost = useRef<HTMLDivElement | null>(null)
  const loadDepay = async () => {
    const w = window as any
    if (w.DePayButtons || w.DePayWidgets) return
    await new Promise<void>((resolve, reject) => {
      const el = document.createElement('script')
      el.src = depayUrl as string
      /* the approved bundle is pinned by hash: a changed or tampered file never executes */
      el.integrity = rc.depayWidgetIntegrity as string
      el.crossOrigin = 'anonymous'
      el.dataset.ofDepay = '1'
      el.onload = () => resolve()
      el.onerror = () => { el.remove(); reject(new Error('depay_load_failed')) }
      document.head.appendChild(el)
    })
  }
  useEffect(() => {
    if (!depayUrl || !order || order.status !== 'pending' || order.payment_required === false || result) return
    let cancelled = false
    void (async () => {
      try {
        await loadDepay()
        const w = window as any
        if (cancelled) return
        if (w.DePayButtons?.init && depayHost.current) {
          const btn = document.createElement('div')
          btn.className = 'DePayButton'
          btn.setAttribute('label', t('پرداخت با DePay', 'Pay with DePay'))
          btn.setAttribute('integration', rc.depayIntegrationId as string)
          if (depayBlockchains.length) btn.setAttribute('blockchains', JSON.stringify(depayBlockchains))
          btn.setAttribute('payload', JSON.stringify({ orderId: order.id }))
          depayHost.current.replaceChildren(btn)
          w.DePayButtons.init({ document })
          setWidgetOpen(true)
        } else if (!w.DePayWidgets?.Payment) throw new Error('depay_unavailable')
      } catch { if (!cancelled) { setError(widgetFailed); setManual(true) } }
    })()
    return () => { cancelled = true; depayHost.current?.replaceChildren() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.status, result, depayUrl])
  const openDepay = async (orderId: string) => {
    if (!depayUrl) return
    await loadDepay()
    const w = window as any
    if (w.DePayButtons) return /* the button rendered for the order is the entry point */
    if (!w.DePayWidgets?.Payment) throw new Error('depay_unavailable')
    setWidgetOpen(true)
    void Promise.resolve(w.DePayWidgets.Payment({ integration: rc.depayIntegrationId, ...(depayBlockchains.length ? { blockchains: depayBlockchains } : {}), payload: { orderId } }))
      .catch(() => { setError(widgetFailed); setManual(true) })
  }
  const buyChallenge = async () => {
    setError(null)
    try {
      const o = order && order.status === 'pending' ? order : await createOrder()
      if (!o || o.payment_required === false) return
      setBusy(true)
      await openDepay(o.id)
    } catch { setError(widgetFailed); setManual(true) } finally { setBusy(false) }
  }
  const zeroQuote = quote?.paymentRequired === false

  return createPortal(
    <div className="of-checkout-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <dialog className="of-checkout" dir={dirOf(locale)} open onClose={onClose}>
        <button className="dialog-close of-checkout-close" onClick={onClose} aria-label={t('بستن', 'Close')}>×</button>
        <h2>{t('خرید چالش', 'Challenge Checkout')}</h2>

        {/* ---- summary ---- */}
        {plan && (
          <div className="of-checkout-summary">
            <div><span>{t('پلن', 'Plan')}</span><b>{plan.name}</b></div>
            <div><span>{t('اندازهٔ حساب', 'Account size')}</span><b dir="ltr">{fmtMoney(accountSize)}</b></div>
            <div><span>{t('هزینهٔ ارزیابی', 'Evaluation fee')}</span><b dir="ltr">{fmtMoney(quote?.listPriceUsd ?? plan.priceUsd[String(accountSize)] ?? '—')}</b></div>
            {quote && Number(quote.discountUsd) > 0 && <div><span>{t('تخفیف', 'Discount')} <span dir="ltr">({quote.couponCode})</span></span><b dir="ltr">−{fmtMoney(quote.discountUsd)}</b></div>}
            {quote && <div><span>{t('مبلغ قابل پرداخت', 'Amount due')}</span><b dir="ltr">{fmtMoney(quote.priceUsd)}</b></div>}
          </div>
        )}

        {/* ---- coupon (validated and priced by the server) ---- */}
        {authenticated && plan && !order && !result && (
          <div className="of-checkout-coupon">
            <label htmlFor="of-coupon">{t('کد تخفیف', 'Coupon code')}</label>
            <div className="of-checkout-coupon-row">
              <input id="of-coupon" dir="ltr" autoComplete="off" spellCheck={false} maxLength={40} value={couponInput}
                onChange={e => { setCouponInput(e.target.value); setQuote(null); setCouponError(null) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void applyCoupon() } }} />
              <button className="of-profile-plainbtn" disabled={busy || !couponInput.trim()} onClick={() => { void applyCoupon() }}>{t('اعمال', 'Apply')}</button>
            </div>
            {couponError && <p className="of-profile-error" role="alert">{couponError}</p>}
            {zeroQuote && <p className="of-checkout-status" role="status">{t('با این کد، چالش بدون پرداخت فعال می‌شود.', 'With this coupon the challenge is activated without payment.')}</p>}
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
        {authenticated && plans && !paymentsEnabled && !zeroQuote && (
          <div className="of-checkout-note">
            <p>{t('فعال‌سازی خرید در این نسخه فراهم نیست. با تنظیم مقصد پرداخت روی سرور فعال می‌شود.',
              'Purchases are not enabled in this release. They activate once the server payment destination is configured.')}</p>
          </div>
        )}

        {/* ---- create order ---- */}
        {authenticated && zeroQuote && !order && !result && (
          <button className="button full" disabled={busy || !plan} onClick={() => { void createOrder() }}>
            {busy ? '…' : t('فعال‌سازی چالش', 'Activate challenge')}
          </button>
        )}
        {authenticated && paymentsEnabled && !zeroQuote && !order && !result && (
          depayAvailable ? (
            <button className="button full" disabled={busy || !plan} onClick={buyChallenge}>
              {busy ? '…' : t('خرید چالش', 'Buy Challenge')}
            </button>
          ) : (
            <button className="button full" disabled={busy || !plan} onClick={() => { void createOrder() }}>
              {busy ? '…' : t('ساخت سفارش و دریافت آدرس پرداخت', 'Create order & get payment address')}
            </button>
          )
        )}

        {/* ---- pay ---- */}
        {authenticated && order && !result && (
          <div className="of-checkout-pay">
            {order.status === 'pending' ? (
              <>
                {showManual && <>
                  <p className="of-checkout-step">{t('۱. مبلغ دقیق را به این آدرس بفرست', '1. Send the exact amount to this address')}:</p>
                  <div className="of-checkout-addr">
                    <code dir="ltr">{payment?.receiver}</code>
                    <button className="of-profile-plainbtn" onClick={() => void navigator.clipboard?.writeText(payment?.receiver || '')}>
                      {t('کپی', 'Copy')}
                    </button>
                  </div>
                </>}
                <div className="of-checkout-meta">
                  <span>{t('مبلغ', 'Amount')}: <b dir="ltr">{payment ? fmtMoney(order.price_usd) : '—'}</b></span>
                  <span>{t('زنجیره', 'Chain')}: <b>{CHAIN_LABEL[payment?.chainId || 0] || payment?.chainId}</b></span>
                  <span>{t('دارایی', 'Asset')}: <b dir="ltr">{payment?.token ? 'USD stablecoin' : 'test ETH'}</b></span>
                </div>
                {depayAvailable && payment && <div className="of-checkout-depay" ref={depayHost} />}
                {depayAvailable && payment && !(window as any).DePayButtons && (
                  <button className="button full" disabled={busy} onClick={buyChallenge}>
                    {widgetOpen ? t('بازکردن دوبارهٔ درگاه پرداخت', 'Reopen payment widget') : t('خرید چالش', 'Buy Challenge')}
                  </button>
                )}
                {waiting && <p className="of-checkout-status" role="status">{waiting}</p>}
                {attemptError && <p className="of-profile-error" role="alert">{attemptError}</p>}
                {showManual && <>
                  <p className="of-checkout-step">{t('۲. پس از پرداخت، هش تراکنش را وارد کن', '2. After paying, enter the transaction hash')}:</p>
                  <input dir="ltr" className="of-checkout-tx" placeholder="0x…" value={txHash}
                    onChange={e => setTxHash(e.target.value)} spellCheck={false} />
                </>}
                <div className="of-checkout-actions">
                  {showManual && <button className="button" disabled={busy || !/^0x[0-9a-fA-F]{64}$/.test(txHash.trim())} onClick={verify}>
                    {busy ? '…' : t('تأیید پرداخت', 'Verify payment')}
                  </button>}
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
            <p>✓ {t('پرداخت موفق بود؛ چالش شما آماده است.', 'Payment successful — your challenge is ready.')}</p>
            <div className="of-checkout-meta">
              <span>{t('شمارهٔ فاکتور', 'Invoice')}: <b dir="ltr">{result.invoiceNumber}</b></span>
              <span>{t('شناسهٔ چالش', 'Challenge')}: <b dir="ltr">{String(result.challengeId).slice(0, 8)}…</b></span>
            </div>
            <div className="of-checkout-actions">
              <a className="button" href={`/${locale}/prop/purchases`} onClick={onClose}>
                {t('تاریخچهٔ خرید و فاکتورها', 'Purchases & invoices')}
              </a>
              <a className="button" href={`/${locale}/prop/dashboard`} onClick={onClose}>                {t('رفتن به داشبورد', 'Go to Dashboard')}
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
