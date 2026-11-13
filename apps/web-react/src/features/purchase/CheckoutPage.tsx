import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { dirOf, pick } from '../../i18n/locales'
import { apiFetch, backendUrl, useSession } from '../../session/useOpenfundSession'
import { closeDePayPayment, depayConfigured, depayOpenFor, openDePayPayment } from './depay'
import { chainLabel, txExplorerUrl } from './chains'
import './purchase.css'
import './checkout-page.css'

/**
 * Dedicated challenge purchase page — /:locale/checkout
 *
 *   wallet → challenge model → account size → price/coupon → customer
 *   details → review → Pay with DePay → server verification → receipt
 *
 * Contract (backend /purchases/*, unchanged trust model):
 *  - prices come from the server catalog and the server quote; the order is
 *    created server-side (idempotency key) and its frozen net price is what
 *    DePay charges, through the signed dynamic configuration;
 *  - the DePay widget gets only the integration id and { orderId }; Openfund
 *    does not narrow DePay's wallets, networks or payer tokens;
 *  - widget events only update this page. The order is paid when the signed
 *    DePay callback/event plus the on-chain verifier say so; the page learns
 *    it by polling, so it survives refreshes, wallet disconnects and closed
 *    tabs (?order=<id> resumes the same order and shows its receipt).
 */

interface PlanInfo { slug: string, name: string, names?: { en: string | null, fa: string | null } | null, accountSizesUsd: number[], priceUsd: Record<string, number>, free: boolean,
  /* false when a rule of the plan cannot be enforced yet (server sales gate) */
  available?: boolean, unavailableReasons?: string[] }
interface Quote { listPriceUsd: string, discountUsd: string, priceUsd: string, couponCode: string | null, paymentRequired: boolean }
interface OrderView {
  id: string, status: string, lifecycle_state?: string, account_size_usd: string, price_usd: string, currency: string,
  list_price_usd?: string, discount_usd?: string, payment_required?: boolean, coupon_code?: string | null,
  created_at: string, expires_at: string, paid_at: string | null, plan_slug: string, plan_name: string
}
interface PaymentInfo { chainId: number, receiver: string, token: string | null, amount: string, reference: string }
interface Receipt {
  orderId: string, status: string, lifecycleState: string | null,
  plan: { slug: string, name: string, names: { en?: string, fa?: string } | null },
  accountSizeUsd: string, listPriceUsd: string | null, discountUsd: string | null, priceUsd: string, currency: string,
  couponCode: string | null, paymentRequired: boolean, paymentMethod: string | null,
  customer: { name: string | null, email: string | null } | null, walletAddress: string,
  createdAt: string, paidAt: string | null,
  payment: null | {
    txHash: string, chainId: number, blockchain: string | null, route: string | null,
    settlement: { token: string | null, amount: string | null, amountUnits: string | null, decimals: number | null, receiver: string | null },
    sender: string | null, sent: { token: string | null, amount: string | null, reported: true } | null,
    blockTime: string | null, verifiedAt: string
  },
  invoice: { id: string, number: string, issuedAt: string } | null,
  challenge: { id: string, status: string } | null,
}

const ERR: Record<string, [string, string]> = {
  purchases_disabled: ['خرید در حال حاضر فعال نیست.', 'Purchasing is not enabled right now.'],
  invalid_account_size: ['اندازهٔ حساب معتبر نیست.', 'Invalid account size.'],
  not_purchasable: ['این چلنج قابل خرید نیست.', 'This challenge cannot be purchased.'],
  plan_not_found: ['چلنج یافت نشد.', 'Challenge not found.'],
  order_expired: ['زمان اعتبار سفارش تمام شد؛ سفارش تازه بساز.', 'This order expired — start a new one.'],
  order_not_pending: ['این سفارش قابل پرداخت نیست.', 'This order is not payable.'],
  plan_unavailable: ['این چلنج فعلاً برای خرید در دسترس نیست.', 'This challenge is not available for purchase right now.'],
  variant_unavailable: ['این گزینهٔ ضرر روزانه هنوز قیمت‌گذاری نشده و قابل خرید نیست.', 'This daily-loss option is not priced yet and cannot be purchased.'],
  order_not_found: ['سفارش یافت نشد.', 'Order not found.'],
  invalid_email: ['ایمیل معتبر نیست.', 'Enter a valid email address.'],
  invalid_customer: ['اطلاعات خریدار معتبر نیست.', 'The customer details are not valid.'],
  tx_not_successful: ['تراکنش روی زنجیره موفق نبود.', 'The on-chain transaction was not successful.'],
  wrong_receiver: ['مقصد تراکنش با تنظیمات پرداخت تفاوت دارد.', 'The payment went to a different receiver than configured.'],
  wrong_token: ['توکن دریافتی با توکن تسویه تفاوت دارد.', 'The settled token does not match the configuration.'],
  insufficient_amount: ['مبلغ دریافتی کمتر از قیمت سفارش است.', 'The transferred amount is below the order price.'],
  tx_already_used: ['این تراکنش قبلاً استفاده شده است.', 'This transaction was already used.'],
  unsupported_chain: ['این شبکه در تنظیمات پرداخت نیست.', 'This network is not part of the payment configuration.'],
  tx_pending: ['تراکنش هنوز در زنجیره ثبت نشده است؛ خودکار دوباره بررسی می‌شود.', 'The transaction is not on-chain yet — checking again automatically.'],
  tx_not_final: ['تراکنش ثبت شد و منتظر تأییدهای لازم است.', 'The transaction is mined and waiting for the required confirmations.'],
  tx_reorged: ['بلاک تراکنش تغییر کرد؛ دوباره بررسی می‌شود.', 'The transaction block changed — re-checking.'],
  rpc_unavailable: ['اتصال به شبکه موقتاً در دسترس نیست؛ پرداخت شما از دست نمی‌رود و دوباره بررسی می‌شود.', 'The network is temporarily unreachable. Your payment is not lost and will be re-checked.'],
  provisioning_retry: ['پرداخت تأیید شد؛ فعال‌سازی چلنج در حال تکرار است. نیازی به پرداخت دوباره نیست.', 'Payment verified — challenge activation is being retried. You do not need to pay again.'],
  payment_misconfigured: ['پیکربندی پرداخت کامل نیست؛ با پشتیبانی تماس بگیر.', 'Payment configuration is incomplete — please contact support.'],
  wrong_sender: ['تراکنش باید از کیف پول واردشدهٔ شما امضا شده باشد.', 'The transaction must be signed by your signed-in wallet.'],
  native_payment_unsupported: ['پرداخت مستقیم با ارز بومی پذیرفته نیست.', 'Direct native-coin transfers are not accepted.'],
  unapproved_contract: ['تراکنش از قرارداد تأییدنشده عبور کرده است.', 'This transaction went through an unapproved contract.'],
  coupon_invalid: ['کد تخفیف معتبر نیست.', 'This coupon code is not valid.'],
  coupon_not_found: ['کد تخفیف یافت نشد.', 'Coupon not found.'],
  coupon_disabled: ['این کد تخفیف غیرفعال است.', 'This coupon is disabled.'],
  coupon_not_started: ['این کد تخفیف هنوز فعال نشده است.', 'This coupon is not active yet.'],
  coupon_expired: ['زمان اعتبار این کد تخفیف تمام شده است.', 'This coupon has expired.'],
  coupon_not_applicable: ['این کد تخفیف برای این چلنج یا اندازه نیست.', 'This coupon does not apply to this challenge or size.'],
  coupon_exhausted: ['ظرفیت این کد تخفیف تمام شده است.', 'This coupon has reached its usage limit.'],
  coupon_already_used: ['قبلاً از این کد تخفیف استفاده کرده‌ای.', 'You have already used this coupon.'],
  rate_limited: ['درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کن.', 'Too many requests — please try again shortly.'],
}
const RETRYABLE = new Set(['tx_pending', 'tx_not_final', 'tx_reorged', 'rpc_unavailable', 'provisioning_retry'])
const newKey = () => { try { return crypto.randomUUID() } catch { return Date.now().toString(36) + Math.random().toString(16).slice(2) } }
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/
const customerKey = 'of.checkout.customer'
const readCustomer = () => { try { return JSON.parse(localStorage.getItem(customerKey) || 'null') as { name?: string, email?: string } | null } catch { return null } }

export default function CheckoutPage() {
  const locale = useInformationLocale()
  const t = (fa: string, en: string) => pick(locale, fa, en)
  const errText = (code: string) => { const e = ERR[code]; return e ? t(e[0], e[1]) : code }
  const money = (v: string | number | null | undefined) => v == null || v === '' ? '—' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  const dateTime = (d?: string | null) => d ? new Date(d).toLocaleString(locale === 'fa' ? 'fa-IR' : locale) : '—'
  const session = useSession()
  const authenticated = session.status === 'authenticated'
  const [params, setParams] = useSearchParams()
  const orderParam = params.get('order')

  /* ---- catalog ---- */
  const [plans, setPlans] = useState<PlanInfo[] | null>(null)
  const [paymentsEnabled, setPaymentsEnabled] = useState(false)
  const [settlementChains, setSettlementChains] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  useEffect(() => {
    void apiFetch('/purchases/plans').then(r => {
      if (!r.ok) { setLoadError(t('دریافت چلنج‌ها ناموفق بود.', 'Could not load the challenges.')); return }
      setPlans((r.data?.plans || []).filter((p: PlanInfo) => !p.free && p.accountSizesUsd?.length))
      setPaymentsEnabled(!!r.data?.paymentsEnabled)
      setSettlementChains(((r.data?.payment?.chains || []) as { blockchain?: string | null, chainId?: number }[]).map(c => chainLabel(c.blockchain || c.chainId)))
    }).catch(() => setLoadError(t('دریافت چلنج‌ها ناموفق بود.', 'Could not load the challenges.')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---- selection (URL is the source of truth so a link or refresh restores it) ---- */
  const planSlug = params.get('plan') || ''
  const size = Number(params.get('size') || 0)
  const plan = plans?.find(p => p.slug === planSlug) || null
  const validSize = !!plan && plan.accountSizesUsd.includes(size)
  const setSelection = (slug: string, nextSize?: number) => {
    const p = plans?.find(x => x.slug === slug)
    const s = nextSize ?? (p && p.accountSizesUsd.includes(size) ? size : p?.accountSizesUsd[0])
    const next = new URLSearchParams(params)
    next.set('plan', slug); if (s) next.set('size', String(s)); next.delete('order')
    setParams(next, { replace: true })
    setQuote(null); setCouponError(null); attemptKey.current = newKey()
  }
  useEffect(() => { /* default to the first challenge when nothing (or something invalid) is selected */
    if (!plans?.length || orderParam) return
    if (!plan) setSelection(plans[0].slug)
    else if (!validSize) setSelection(plan.slug, plan.accountSizesUsd[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, planSlug, size, orderParam])
  const selectionNotice = plans && params.get('plan') && !plans.some(p => p.slug === params.get('plan'))

  /* ---- coupon → server quote ---- */
  const [couponInput, setCouponInput] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const attemptKey = useRef(newKey())
  const applyCoupon = async () => {
    const code = couponInput.trim()
    setCouponError(null)
    if (!code) { setQuote(null); return }
    setBusy(true)
    try {
      const r = await apiFetch('/purchases/quote', { method: 'POST', body: JSON.stringify({ planSlug, accountSize: size, couponCode: code }) })
      if (!r.ok) { setQuote(null); setCouponError(errText(r.data?.error || 'coupon_invalid')); return }
      setQuote(r.data as Quote); attemptKey.current = newKey()
    } finally { setBusy(false) }
  }
  const listPrice = plan && validSize ? plan.priceUsd[String(size)] : null
  const zeroQuote = quote?.paymentRequired === false

  /* ---- customer details (receipt only; the wallet is the identity) ---- */
  const saved = useMemo(readCustomer, [])
  const [name, setName] = useState(saved?.name || '')
  const [email, setEmail] = useState(saved?.email || '')
  const [accepted, setAccepted] = useState(false)
  const emailOk = EMAIL.test(email.trim())
  const ready = authenticated && !!plan && plan.available !== false && validSize && emailOk && accepted && (paymentsEnabled || zeroQuote)

  /* ---- order, payment and status ---- */
  const [order, setOrder] = useState<OrderView | null>(null)
  const [payment, setPayment] = useState<PaymentInfo | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [waiting, setWaiting] = useState<string | null>(null)
  const [attemptError, setAttemptError] = useState<string | null>(null)
  const [widget, setWidget] = useState<'idle' | 'loading' | 'open' | 'sent' | 'closed'>('idle')
  const [sentTx, setSentTx] = useState<{ id?: string, url?: string } | null>(null)
  const [widgetNote, setWidgetNote] = useState<string | null>(null)
  const [txHash, setTxHash] = useState('')
  const useDePay = depayConfigured()

  const loadReceipt = useCallback(async (id: string) => {
    const r = await apiFetch(`/purchases/orders/${id}/receipt`).catch(() => null)
    if (r?.ok && r.data?.receipt) { setReceipt(r.data.receipt); return r.data.receipt as Receipt }
    return null
  }, [])

  /* resume: ?order=<id> (also after a refresh, a wallet reconnect or a later visit) */
  useEffect(() => {
    if (!authenticated || !orderParam) return
    if (order?.id === orderParam) return
    void (async () => {
      const r = await apiFetch(`/purchases/orders/${orderParam}`).catch(() => null)
      if (!r?.ok) { setError(errText(r?.data?.error || 'order_not_found')); return }
      setOrder(r.data.order); setPayment(r.data.payment || null)
      if (r.data.order.status !== 'pending') await loadReceipt(orderParam)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, orderParam])

  /* poll the server while the order is open: callbacks, verification and
     provisioning run without the browser */
  /* an expired order whose payment was already detected keeps being followed */
  const following = !!order && (order.status === 'pending' || (order.status === 'expired' && order.lifecycle_state === 'payment_detected'))
  useEffect(() => {
    if (!order || !following) return
    let stop = false
    const tick = async () => {
      const r = await apiFetch(`/purchases/orders/${order.id}`).catch(() => null)
      if (stop) return
      if (r?.ok && r.data?.order && (r.data.order.status === 'paid' || r.data.order.status === 'cancelled' || (r.data.order.status !== order.status))) {
        setOrder(r.data.order); setWaiting(null); setAttemptError(null)
        if (r.data.order.status === 'paid') { closeDePayPayment(); await loadReceipt(order.id); await session.reload?.() }
        return
      }
      if (r?.ok && r.data?.order) setOrder(o => (o && o.lifecycle_state === r.data.order.lifecycle_state ? o : r.data.order))
      const a = await apiFetch(`/purchases/orders/${order.id}/attempts`).catch(() => null)
      if (stop || !a?.ok) return
      const latest = (a.data?.attempts || [])[0]
      if (!latest) return
      if (latest.status === 'pending') { setWaiting(latest.error_code ? errText(latest.error_code) : t('پرداخت دریافت شد؛ در حال تأیید روی زنجیره…', 'Payment received — confirming on-chain…')); setAttemptError(null) }
      else if (latest.status === 'rejected') { setWaiting(null); setAttemptError(errText(latest.error_code || 'verify_failed')) }
    }
    void tick()
    const timer = setInterval(() => { void tick() }, 3000)
    return () => { stop = true; clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.status, following])
  useEffect(() => () => closeDePayPayment(), [])

  const createOrder = async (): Promise<OrderView | null> => {
    setError(null)
    try { localStorage.setItem(customerKey, JSON.stringify({ name: name.trim(), email: email.trim() })) } catch { /* optional */ }
    const r = await apiFetch('/purchases/orders', { method: 'POST', body: JSON.stringify({
      planSlug, accountSize: size, couponCode: quote?.couponCode || undefined, idempotencyKey: attemptKey.current,
      customer: { name: name.trim() || undefined, email: email.trim() },
    }) })
    if (!r.ok) { setError(errText(r.data?.error || 'order_failed')); return null }
    setOrder(r.data.order); setPayment(r.data.payment || null)
    const next = new URLSearchParams(params); next.set('order', r.data.order.id)
    setParams(next, { replace: true })
    if (r.data.result?.challengeId) { await loadReceipt(r.data.order.id); await session.reload?.() }
    return r.data.order as OrderView
  }

  const payWithDePay = async () => {
    if (busy || depayOpenFor()) return
    setBusy(true); setError(null); setWidgetNote(null)
    try {
      const o = order && order.status === 'pending' ? order : await createOrder()
      if (!o || o.payment_required === false) return
      setWidget('loading')
      await openDePayPayment(o.id, {
        sent: tx => { setWidget('sent'); setSentTx({ id: tx?.id, url: tx?.url }); setWidgetNote(t('تراکنش ارسال شد؛ منتظر تأیید شبکه و سرور اوپن‌فاند…', 'Transaction submitted — waiting for the network and Openfund verification…')) },
        succeeded: () => setWidgetNote(t('شبکه تراکنش را ثبت کرد؛ اوپن‌فاند در حال تأیید پرداخت است.', 'The network accepted the transaction — Openfund is verifying the payment.')),
        validated: ok => { if (!ok) setWidgetNote(t('DePay پرداخت را تأیید نکرد؛ وضعیت نهایی را سرور اوپن‌فاند تعیین می‌کند.', 'DePay could not validate this payment. Openfund’s server check decides the final status.')) },
        failed: () => setWidgetNote(t('تراکنش روی زنجیره ناموفق بود؛ می‌توانی در همان پنجره دوباره تلاش کنی.', 'The transaction failed on-chain. You can retry in the payment window.')),
        closed: () => setWidget(w => (w === 'sent' ? 'sent' : 'closed')),
        /* previously dropped: e.g. DePay could not load the signed payment configuration */
        error: () => setWidgetNote(t('درگاه DePay خطا گزارش داد. اگر پیکربندی پرداخت بارگذاری نشد، پنجره را ببند و دوباره باز کن؛ در صورت تکرار با پشتیبانی تماس بگیر. سفارش شما باز می‌ماند.', 'DePay reported an error. If the payment configuration did not load, close and reopen the window; contact support if it repeats. Your order stays open.')),
        critical: () => { setWidget('closed'); setError(t('درگاه پرداخت با خطا بسته شد؛ دوباره باز کن.', 'The payment window stopped with an error — open it again.')) },
      })
      setWidget(w => (w === 'loading' ? 'open' : w))
    } catch {
      setWidget('closed')
      setError(t('درگاه پرداخت DePay بارگذاری نشد. اتصال را بررسی کن و دوباره تلاش کن.', 'The DePay payment window could not be loaded. Check your connection and try again.'))
    } finally { setBusy(false) }
  }

  const createManual = async () => { if (busy) return; setBusy(true); try { await createOrder() } finally { setBusy(false) } }
  const verifyManual = async () => {
    if (!order) return
    setBusy(true); setError(null)
    try {
      const r = await apiFetch('/purchases/verify', { method: 'POST', body: JSON.stringify({ orderId: order.id, txHash: txHash.trim() }) })
      if (r.ok) { await loadReceipt(order.id); setOrder(o => o && { ...o, status: 'paid' }); await session.reload?.(); return }
      const code = r.data?.error || 'verify_failed'
      if (r.data?.retryable || RETRYABLE.has(code)) setWaiting(errText(code)); else setError(errText(code))
    } finally { setBusy(false) }
  }
  const cancelOrder = async () => {
    if (!order) return
    const r = await apiFetch(`/purchases/orders/${order.id}/cancel`, { method: 'POST', body: '{}' })
    if (!r.ok) { setError(t('این سفارش دیگر قابل لغو نیست؛ پرداختی برای آن در حال بررسی است.', 'This order can no longer be cancelled — a payment for it is being checked.')); return }
    closeDePayPayment(); setOrder(null); setPayment(null); setWidget('idle'); attemptKey.current = newKey()
    const next = new URLSearchParams(params); next.delete('order'); setParams(next, { replace: true })
  }
  const startOver = () => {
    setOrder(null); setReceipt(null); setPayment(null); setWidget('idle'); setSentTx(null); setWaiting(null); setAttemptError(null); setError(null)
    attemptKey.current = newKey()
    const next = new URLSearchParams(params); next.delete('order'); setParams(next, { replace: true })
  }

  const planName = (p: { name: string, names?: { en?: string | null, fa?: string | null } | null }) =>
    (locale === 'fa' ? p.names?.fa : p.names?.en) || (locale === 'fa' ? p.name.split(' — ')[0] : p.name.split(' — ').pop()) || p.name
  const step = !authenticated ? 1 : receipt && receipt.status === 'paid' ? 4 : order ? 3 : 2
  const orderOpen = order?.status === 'pending'
  const orderClosed = order && !orderOpen && !(receipt && receipt.status === 'paid')

  return (
    <InformationShell page="checkout" title={`${t('خرید چلنج', 'Buy a Challenge')} | Openfund`}
      description={t('خرید چلنج اوپن‌فاند با پرداخت رمزارزی DePay و تأیید سمت سرور.', 'Buy an Openfund challenge with a DePay crypto payment and server-side verification.')}>
      <section className="of-co" dir={dirOf(locale)}>
        <header className="of-co-head">
          <h1>{t('خرید چلنج', 'Buy a Challenge')}</h1>
          <ol className="of-co-steps" aria-label={t('مراحل خرید', 'Checkout steps')}>
            {[t('کیف پول', 'Wallet'), t('انتخاب و بررسی', 'Select & review'), t('پرداخت', 'Payment'), t('رسید', 'Receipt')].map((label, i) => (
              <li key={i} className={i + 1 < step ? 'done' : i + 1 === step ? 'current' : ''} aria-current={i + 1 === step ? 'step' : undefined}><span>{i + 1}</span>{label}</li>
            ))}
          </ol>
        </header>

        {loadError && <p className="of-profile-error" role="alert">{loadError}</p>}

        {/* 1 — wallet */}
        <div className="of-co-card">
          <h2>{t('۱. اتصال کیف پول', '1. Connect wallet')}</h2>
          {authenticated ? (
            <p className="of-co-ok" dir="ltr">✓ {session.user?.walletAddress ? session.user.walletAddress.slice(0, 6) + '…' + session.user.walletAddress.slice(-4) : ''}</p>
          ) : (
            <>
              <p className="of-co-muted">{t('برای خرید، کیف پول را وصل کن و با امضا وارد شو. ورود به اوپن‌فاند روی آربیتروم انجام می‌شود؛ پرداخت می‌تواند روی هر شبکه‌ای باشد که درگاه DePay پیشنهاد می‌دهد.',
                'Connect your wallet and sign in to purchase. Openfund sign-in uses Arbitrum; the payment itself can use any network the DePay checkout offers.')}</p>
              <button className="button" onClick={() => (window as Window & { __ofOpenConnect?: () => void }).__ofOpenConnect?.()}>{t('اتصال کیف پول', 'Connect wallet')}</button>
            </>
          )}
        </div>

        {/* 2 — selection, price, customer, review (locked once an order exists) */}
        {!order && (
          <div className="of-co-card">
            <h2>{t('۲. انتخاب چلنج', '2. Choose your challenge')}</h2>
            {selectionNotice && <p className="of-co-note" role="status">{t('چلنج انتخاب‌شده در دسترس نیست؛ یکی دیگر انتخاب کن.', 'The selected challenge is not available — choose another.')}</p>}
            {!plans && !loadError && <p className="of-co-muted">…</p>}
            {plans && (
              <>
                <fieldset className="of-co-models">
                  <legend>{t('مدل چلنج', 'Challenge model')}</legend>
                  {plans.map(p => (
                    <label key={p.slug} className={p.slug === planSlug ? 'selected' : ''}>
                      <input type="radio" name="of-co-model" value={p.slug} checked={p.slug === planSlug} onChange={() => setSelection(p.slug)} />
                      <b>{planName(p)}</b>
                      {p.available === false && <small className="of-co-unavailable">{t('فعلاً در دسترس نیست', 'Not available yet')}</small>}
                      <small dir="ltr">{t('از', 'from')} {money(Math.min(...p.accountSizesUsd.map(s => Number(p.priceUsd[String(s)])).filter(Number.isFinite)))}</small>
                    </label>
                  ))}
                </fieldset>
                {plan && plan.available === false && <p className="of-co-note" role="status">{t(
                  'این چلنج تا زمانی که همهٔ قوانین آن (از جمله قوانین اخبار با تقویم اقتصادی تأییدشده) قابل اجرا نباشد فروخته نمی‌شود.',
                  'This challenge is not sold until every one of its rules can be enforced, including the news rules, which need a verified economic calendar.')}</p>}
                {plan && (
                  <fieldset className="of-co-sizes">
                    <legend>{t('اندازهٔ حساب', 'Account size')}</legend>
                    {plan.accountSizesUsd.map(s => (
                      <label key={s} className={s === size ? 'selected' : ''}>
                        <input type="radio" name="of-co-size" value={s} checked={s === size} onChange={() => setSelection(plan.slug, s)} />
                        <b dir="ltr">{money(s)}</b>
                        <small dir="ltr">{money(plan.priceUsd[String(s)])}</small>
                      </label>
                    ))}
                  </fieldset>
                )}
              </>
            )}

            {authenticated && plan && validSize && (
              <div className="of-co-coupon">
                <label htmlFor="of-coupon">{t('کد تخفیف (اختیاری)', 'Coupon code (optional)')}</label>
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

            {authenticated && plan && validSize && (
              <div className="of-co-customer">
                <h3>{t('اطلاعات خریدار', 'Customer details')}</h3>
                <label>{t('نام (اختیاری)', 'Name (optional)')}
                  <input dir="auto" autoComplete="name" maxLength={120} value={name} onChange={e => setName(e.target.value)} />
                </label>
                <label>{t('ایمیل برای رسید', 'Email for the receipt')} <span aria-hidden="true">*</span>
                  <input dir="ltr" type="email" autoComplete="email" required maxLength={254} value={email}
                    aria-invalid={email !== '' && !emailOk} onChange={e => setEmail(e.target.value)} />
                </label>
                {email !== '' && !emailOk && <p className="of-profile-error" role="alert">{errText('invalid_email')}</p>}
              </div>
            )}

            {plan && validSize && (
              <div className="of-co-summary of-checkout-summary">
                <h3>{t('خلاصهٔ خرید', 'Purchase summary')}</h3>
                <div><span>{t('چلنج', 'Challenge')}</span><b>{planName(plan)}</b></div>
                <div><span>{t('اندازهٔ حساب', 'Account size')}</span><b dir="ltr">{money(size)}</b></div>
                <div><span>{t('هزینهٔ ارزیابی', 'Evaluation fee')}</span><b dir="ltr">{money(quote?.listPriceUsd ?? listPrice)}</b></div>
                {quote && Number(quote.discountUsd) > 0 && <div><span>{t('تخفیف', 'Discount')} <span dir="ltr">({quote.couponCode})</span></span><b dir="ltr">−{money(quote.discountUsd)}</b></div>}
                <div className="of-co-total"><span>{t('مبلغ قابل پرداخت', 'Amount due')}</span><b dir="ltr">{money(quote?.priceUsd ?? listPrice)}</b></div>
                <p className="of-co-muted">{t('قیمت نهایی را سرور اوپن‌فاند هنگام ساخت سفارش ثابت می‌کند و همان مبلغ در DePay درخواست می‌شود.', 'Openfund’s server fixes the final price when the order is created; DePay charges exactly that amount.')}</p>
              </div>
            )}

            {authenticated && plan && validSize && (
              <label className="of-co-accept">
                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
                <span>{t('قوانین چلنج را خوانده‌ام و می‌دانم هزینهٔ ارزیابی یک‌باره و غیرقابل بازگشت است.', 'I have read the challenge rules and understand the evaluation fee is one-time and non-refundable.')} <Link to={`/${locale}/rulebook`}>{t('قوانین', 'Rulebook')}</Link></span>
              </label>
            )}

            {authenticated && plans && !paymentsEnabled && !zeroQuote && (
              <p className="of-co-note" role="status">{t('پرداخت در حال حاضر فعال نیست. پس از تکمیل تنظیمات پرداخت روی سرور فعال می‌شود.', 'Payment is not active yet. It becomes available once the server payment settings are complete.')}</p>
            )}

            {authenticated && zeroQuote && (
              <button className="button full" disabled={busy || !ready} onClick={createManual}>{busy ? '…' : t('فعال‌سازی چلنج', 'Activate challenge')}</button>
            )}
            {authenticated && paymentsEnabled && !zeroQuote && (useDePay ? (
              <button className="button full of-co-pay" disabled={busy || !ready} onClick={() => { void payWithDePay() }}>
                {busy ? '…' : t('پرداخت با DePay', 'Pay with DePay')}
              </button>
            ) : (
              <button className="button full" disabled={busy || !ready} onClick={createManual}>{busy ? '…' : t('ساخت سفارش و دریافت آدرس پرداخت', 'Create order & get payment address')}</button>
            ))}
            {authenticated && paymentsEnabled && useDePay && !zeroQuote && (
              <p className="of-co-muted of-co-networks">
                {t('در پنجرهٔ DePay هر کیف پول، شبکه و توکنی را که DePay برای این پرداخت پیشنهاد می‌دهد می‌توانی انتخاب کنی؛ DePay در صورت نیاز توکن را تبدیل می‌کند.', 'In the DePay window you can choose any wallet, network and token DePay offers for this payment; DePay converts the token when needed.')}
                {settlementChains.length > 0 && <> {t('شبکه‌های تسویهٔ پیکربندی‌شده:', 'Configured settlement networks:')} <span dir="ltr">{settlementChains.join(' · ')}</span></>}
              </p>
            )}
          </div>
        )}

        {/* 3 — payment / status */}
        {order && orderOpen && (
          <div className="of-co-card" aria-live="polite">
            <h2>{t('۳. پرداخت', '3. Payment')}</h2>
            <div className="of-co-summary of-checkout-summary">
              <div><span>{t('سفارش', 'Order')}</span><b dir="ltr">{order.id.slice(0, 8)}</b></div>
              <div><span>{t('چلنج', 'Challenge')}</span><b>{planName({ name: order.plan_name })}</b></div>
              <div><span>{t('اندازهٔ حساب', 'Account size')}</span><b dir="ltr">{money(order.account_size_usd)}</b></div>
              <div className="of-co-total"><span>{t('مبلغ', 'Amount')}</span><b dir="ltr">{money(order.price_usd)}</b></div>
              <div><span>{t('اعتبار سفارش تا', 'Order valid until')}</span><b>{dateTime(order.expires_at)}</b></div>
            </div>
            {useDePay ? (
              <>
                <button className="button full of-co-pay" disabled={busy || widget === 'loading' || widget === 'open'} onClick={() => { void payWithDePay() }}>
                  {widget === 'loading' ? t('در حال باز کردن DePay…', 'Opening DePay…') : widget === 'idle' ? t('پرداخت با DePay', 'Pay with DePay') : t('باز کردن دوبارهٔ DePay', 'Reopen DePay')}
                </button>
                {widget === 'closed' && !sentTx && <p className="of-co-muted">{t('پنجرهٔ پرداخت بسته شد. سفارش باز می‌ماند؛ هر وقت آماده بودی دوباره باز کن.', 'The payment window was closed. Your order stays open — reopen it whenever you are ready.')}</p>}
                {sentTx?.id && (
                  <p className="of-co-muted" dir="ltr">{sentTx.url ? <a href={sentTx.url} target="_blank" rel="noreferrer">{sentTx.id.slice(0, 14)}…</a> : sentTx.id.slice(0, 14) + '…'}</p>
                )}
              </>
            ) : (
              <>
                <p className="of-checkout-step">{t('۱. مبلغ دقیق را به این آدرس بفرست', '1. Send the exact amount to this address')}:</p>
                <div className="of-checkout-addr">
                  <code dir="ltr">{payment?.receiver}</code>
                  <button className="of-profile-plainbtn" onClick={() => void navigator.clipboard?.writeText(payment?.receiver || '')}>{t('کپی', 'Copy')}</button>
                </div>
                <p className="of-co-muted">{t('شبکه', 'Network')}: <b>{chainLabel(payment?.chainId)}</b></p>
                <p className="of-checkout-step">{t('۲. پس از پرداخت، هش تراکنش را وارد کن', '2. After paying, enter the transaction hash')}:</p>
                <input dir="ltr" className="of-checkout-tx" placeholder="0x…" value={txHash} onChange={e => setTxHash(e.target.value)} spellCheck={false} />
                <button className="button" disabled={busy || !/^0x[0-9a-fA-F]{64}$/.test(txHash.trim())} onClick={() => { void verifyManual() }}>{busy ? '…' : t('تأیید پرداخت', 'Verify payment')}</button>
              </>
            )}
            {widgetNote && <p className="of-checkout-status" role="status">{widgetNote}</p>}
            {waiting && <p className="of-checkout-status" role="status">{waiting}</p>}
            {attemptError && <p className="of-profile-error" role="alert">{attemptError}</p>}
            <p className="of-co-muted">{t('این صفحه وضعیت پرداخت را از سرور می‌خواند؛ اگر صفحه را ببندی یا کیف پول قطع شود، پرداخت از دست نمی‌رود و با همین لینک می‌توانی برگردی.', 'This page reads the payment status from the server. If you close it or your wallet disconnects, the payment is not lost — come back with this link.')}</p>
            {order.lifecycle_state === 'awaiting_payment' && widget !== 'sent' && (
              <button className="of-profile-plainbtn" disabled={busy} onClick={() => { void cancelOrder() }}>{t('لغو سفارش', 'Cancel order')}</button>
            )}
          </div>
        )}

        {orderClosed && following && (
          <div className="of-co-card" aria-live="polite">
            <p className="of-checkout-status" role="status">{waiting || t('پرداختی برای این سفارش دریافت شده و در حال تأیید است؛ نیازی به پرداخت دوباره نیست.', 'A payment for this order was received and is being verified — you do not need to pay again.')}</p>
          </div>
        )}
        {orderClosed && !following && order!.status !== 'paid' && (
          <div className="of-co-card">
            <p className="of-checkout-status">{t('وضعیت سفارش', 'Order status')}: <b>{order!.status}</b></p>
            <button className="button" onClick={startOver}>{t('شروع خرید تازه', 'Start a new purchase')}</button>
          </div>
        )}

        {/* 4 — confirmation + receipt (verified records only) */}
        {receipt && receipt.status === 'paid' && (
          <div className="of-co-card of-co-receipt" aria-live="polite">
            <h2>✓ {t('پرداخت موفق بود؛ چلنج شما آماده است.', 'Payment successful — your challenge is ready.')}</h2>
            <dl>
              <div><dt>{t('شمارهٔ سفارش', 'Order ID')}</dt><dd dir="ltr">{receipt.orderId}</dd></div>
              <div><dt>{t('چلنج', 'Challenge')}</dt><dd>{planName(receipt.plan)}</dd></div>
              <div><dt>{t('اندازهٔ حساب', 'Account size')}</dt><dd dir="ltr">{money(receipt.accountSizeUsd)}</dd></div>
              <div><dt>{t('مبلغ خرید', 'Purchase price')}</dt><dd dir="ltr">{money(receipt.priceUsd)}{receipt.couponCode ? ` (${receipt.couponCode})` : ''}</dd></div>
              <div><dt>{t('وضعیت پرداخت', 'Payment status')}</dt><dd>{receipt.payment ? t('تأییدشده روی زنجیره', 'Verified on-chain') : receipt.paymentRequired ? '—' : t('بدون پرداخت (کد تخفیف)', 'No payment (coupon)')}</dd></div>
              {receipt.payment && <>
                <div><dt>{t('شبکهٔ پرداخت', 'Payment network')}</dt><dd>{chainLabel(receipt.payment.blockchain || receipt.payment.chainId)}</dd></div>
                {receipt.payment.sent && <div><dt>{t('توکن و مبلغ ارسالی (گزارش DePay)', 'Sent token / amount (reported by DePay)')}</dt><dd dir="ltr" className="of-co-mono">{receipt.payment.sent.amount ?? '—'} {receipt.payment.sent.token ?? ''}</dd></div>}
                <div><dt>{t('تسویه', 'Settlement')}</dt><dd dir="ltr" className="of-co-mono">{receipt.payment.settlement.amount ?? receipt.payment.settlement.amountUnits ?? '—'} {receipt.payment.settlement.token ?? ''}</dd></div>
                <div><dt>{t('هش تراکنش', 'Transaction hash')}</dt><dd dir="ltr" className="of-co-mono">{txExplorerUrl(receipt.payment.blockchain || receipt.payment.chainId, receipt.payment.txHash)
                  ? <a href={txExplorerUrl(receipt.payment.blockchain || receipt.payment.chainId, receipt.payment.txHash)!} target="_blank" rel="noreferrer">{receipt.payment.txHash}</a> : receipt.payment.txHash}</dd></div>
              </>}
              <div><dt>{t('تاریخ و زمان', 'Date / time')}</dt><dd>{dateTime(receipt.paidAt)}</dd></div>
              {receipt.invoice && <div><dt>{t('شمارهٔ فاکتور', 'Invoice')}</dt><dd dir="ltr">{receipt.invoice.number}</dd></div>}
              {receipt.challenge && <div><dt>{t('شناسهٔ چلنج', 'Challenge ID')}</dt><dd dir="ltr" className="of-co-mono">{receipt.challenge.id}</dd></div>}
              {receipt.customer?.email && <div><dt>{t('ایمیل', 'Email')}</dt><dd dir="ltr">{receipt.customer.email}</dd></div>}
            </dl>
            <div className="of-checkout-actions">
              <a className="button" href={`/${locale}/prop/dashboard`}>{t('رفتن به داشبورد', 'Go to Dashboard')}</a>
              {receipt.invoice && <a className="button" href={`${backendUrl()}/invoices/${receipt.invoice.id}`} target="_blank" rel="noreferrer">{t('دانلود فاکتور PDF', 'Download invoice PDF')}</a>}
              <button className="of-profile-plainbtn" onClick={() => window.print()}>{t('چاپ رسید', 'Print receipt')}</button>
            </div>
          </div>
        )}

        {error && <p className="of-profile-error" role="alert">{error}</p>}
        <p className="of-co-muted of-co-foot"><Link to={`/${locale}/prop/purchases`}>{t('خریدها و فاکتورهای قبلی', 'Previous purchases & invoices')}</Link></p>
      </section>
    </InformationShell>
  )
}
