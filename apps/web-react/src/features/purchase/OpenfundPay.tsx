import { useEffect, useMemo, useState } from 'react'
import { erc20Abi, formatUnits, UserRejectedRequestError } from 'viem'
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from 'wagmi'
import { apiFetch } from '../../session/useOpenfundSession'
import type { PAYMENT_CHAINS } from '../../wallet/config'
import { chainLabel, txExplorerUrl } from './chains'
import { PAYMENT_STATUS_TEXT, statusTone, type ServerPaymentStatus } from './checkoutStatus'

/**
 * Openfund Pay — first-party checkout pieces (ADR 0046).
 *
 *  WalletPayment     the server prepares a payment intent (approved token,
 *                    treasury, exact base units of the remaining balance on
 *                    the chosen network); the connected wallet signs ONE
 *                    ERC-20 transfer; the hash is persisted on the server
 *                    immediately. Nothing here can mark a payment paid.
 *  ManualWarning     the mandatory red sender warning + acknowledgment.
 *  PaymentStatus     the server's status code, ledger totals, transactions,
 *                    refunds and timeline.
 */

type T = (fa: string, en: string) => string
type PayChainId = (typeof PAYMENT_CHAINS)[number]['id']
export interface WalletChain { chainId: number, blockchain: string | null, network: string | null, token: string, tokenSymbol: string | null, tokenDecimals: number, receiver: string, minConfirmations: number }
interface Intent { id: string, orderId: string, chainId: number, token: `0x${string}`, tokenSymbol: string | null, tokenDecimals: number, receiver: `0x${string}`, amountUnits: string, amount: string, amountUsd: string, payer: string, expiresAt: string }

const pendingKey = (orderId: string) => `of.checkout.pending.${orderId}`
const savePending = (orderId: string, v: { intentId: string, txHash: string } | null) => {
  try { if (v) localStorage.setItem(pendingKey(orderId), JSON.stringify(v)); else localStorage.removeItem(pendingKey(orderId)) } catch { /* optional convenience */ }
}
const readPending = (orderId: string): { intentId: string, txHash: string } | null => {
  try { return JSON.parse(localStorage.getItem(pendingKey(orderId)) || 'null') } catch { return null }
}
const short = (a?: string | null) => (a ? a.slice(0, 6) + '…' + a.slice(-4) : '')

const WALLET_ERR: Record<string, [string, string]> = {
  wallet_mismatch: ['کیف پول متصل با کیف پولی که با آن وارد شده‌ای یکی نیست. به همان کیف پول برگرد.', 'The connected wallet is not the wallet you signed in with. Switch back to that wallet.'],
  method_disabled: ['پرداخت با کیف پول موقتاً غیرفعال است؛ از پرداخت دستی استفاده کن.', 'Wallet payment is temporarily disabled — use Manual Transfer.'],
  unsupported_chain: ['این شبکه برای پرداخت پیکربندی نشده است.', 'This network is not configured for payment.'],
  order_not_payable: ['این سفارش دیگر قابل پرداخت نیست.', 'This order can no longer be paid.'],
  order_already_paid: ['این سفارش قبلاً به‌طور کامل پرداخت شده است.', 'This order is already fully paid.'],
  tx_already_used: ['این تراکنش قبلاً ثبت شده است.', 'This transaction was already recorded.'],
  intent_already_submitted: ['برای این درخواست پرداخت قبلاً تراکنشی ثبت شده است.', 'A transaction was already submitted for this payment request.'],
}

export function WalletPayment({ t, orderId, chains, sessionWallet, remainingUsd, disabled, onSubmitted }: {
  t: T, orderId: string, chains: WalletChain[], sessionWallet: string | null | undefined, remainingUsd: string, disabled?: boolean, onSubmitted: () => void
}) {
  const { address, chainId: walletChain, isConnected } = useAccount()
  const { switchChainAsync, isPending: switching } = useSwitchChain()
  const { writeContractAsync, isPending: signing } = useWriteContract()
  const [chainId, setChainId] = useState<number>(chains[0]?.chainId ?? 0)
  const [intent, setIntent] = useState<Intent | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [fee, setFee] = useState<string | null>(null)
  const errText = (code: string) => { const e = WALLET_ERR[code]; return e ? t(...e) : code }
  const wrongAccount = !!address && !!sessionWallet && address.toLowerCase() !== sessionWallet.toLowerCase()
  const chain = chains.find(c => c.chainId === chainId) || chains[0]
  const publicClient = usePublicClient({ chainId: intent?.chainId as PayChainId })

  /* a hash the wallet returned before the page closed is sent again (idempotent on the server) */
  useEffect(() => {
    const p = readPending(orderId)
    if (!p) return
    void apiFetch(`/purchases/intents/${p.intentId}/submit`, { method: 'POST', body: JSON.stringify({ txHash: p.txHash }) })
      .then(r => { if (r.ok || r.status === 409) { savePending(orderId, null); setSent(p.txHash); onSubmitted() } }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const { data: balance } = useReadContract({
    address: intent?.token, abi: erc20Abi, functionName: 'balanceOf', chainId: intent?.chainId as PayChainId,
    args: address ? [address] : undefined, query: { enabled: !!intent && !!address },
  })
  const insufficient = intent && typeof balance === 'bigint' ? balance < BigInt(intent.amountUnits) : false

  /* network fee estimate for the transfer (native coin of the network) */
  useEffect(() => {
    setFee(null)
    if (!intent || !publicClient || !address) return
    let stop = false
    void (async () => {
      try {
        const [gas, price] = await Promise.all([
          publicClient.estimateContractGas({ address: intent.token, abi: erc20Abi, functionName: 'transfer', args: [intent.receiver, BigInt(intent.amountUnits)], account: address }),
          publicClient.getGasPrice(),
        ])
        if (!stop) setFee(Number(formatUnits(gas * price, 18)).toPrecision(3))
      } catch { if (!stop) setFee(null) }
    })()
    return () => { stop = true }
  }, [intent, publicClient, address])

  const prepare = async () => {
    if (busy || !chain) return
    setBusy(true); setError(null)
    try {
      const r = await apiFetch(`/purchases/orders/${orderId}/intents`, { method: 'POST', body: JSON.stringify({ chainId: chain.chainId, payerAddress: address }) })
      if (!r.ok) { setError(errText(r.data?.error || 'order_not_payable')); return }
      setIntent(r.data.intent)
    } finally { setBusy(false) }
  }

  const pay = async () => {
    if (!intent || busy || signing || sent) return
    if (wrongAccount) { setError(errText('wallet_mismatch')); return }
    setBusy(true); setError(null)
    try {
      if (walletChain !== intent.chainId) await switchChainAsync({ chainId: intent.chainId as PayChainId })
      const hash = await writeContractAsync({ chainId: intent.chainId as PayChainId, address: intent.token, abi: erc20Abi, functionName: 'transfer', args: [intent.receiver, BigInt(intent.amountUnits)], account: address as `0x${string}`, chain: undefined })
      /* persist FIRST (browser may close), then tell the server */
      savePending(orderId, { intentId: intent.id, txHash: hash })
      setSent(hash)
      for (let i = 0; i < 3; i++) {
        const r = await apiFetch(`/purchases/intents/${intent.id}/submit`, { method: 'POST', body: JSON.stringify({ txHash: hash }) }).catch(() => null)
        if (r?.ok) { savePending(orderId, null); break }
        if (r && r.status !== 503 && r.status !== 429) { setError(errText(r.data?.error || 'tx_already_used')); break }
        await new Promise(res => setTimeout(res, 1500 * (i + 1)))
      }
      onSubmitted()
    } catch (e) {
      const rejected = e instanceof UserRejectedRequestError || /reject|denied|cancel/i.test(String((e as Error)?.message || ''))
      setError(rejected
        ? t('امضا در کیف پول رد شد. سفارش باز می‌ماند؛ هر وقت آماده بودی دوباره تلاش کن.', 'The wallet signature was rejected. Your order stays open — try again whenever you are ready.')
        : t('کیف پول تراکنش را ارسال نکرد. اتصال کیف پول را بررسی کن و دوباره تلاش کن.', 'The wallet did not send the transaction. Check the wallet connection and try again.'))
    } finally { setBusy(false) }
  }

  if (!chains.length) return <p className="of-co-note">{t('پرداخت با کیف پول برای هیچ شبکه‌ای پیکربندی نشده است.', 'Wallet payment is not configured for any network.')}</p>
  return (
    <div className="of-pay-wallet">
      <label className="of-co-field">{t('شبکهٔ پرداخت', 'Payment network')}
        <select value={chain?.chainId} disabled={!!intent || !!sent} onChange={e => { setChainId(Number(e.target.value)); setIntent(null) }}>
          {chains.map(c => <option key={c.chainId} value={c.chainId}>{chainLabel(c.blockchain || c.chainId)}{c.tokenSymbol ? ` · ${c.tokenSymbol}` : ''}</option>)}
        </select>
      </label>
      <p className="of-co-muted">{t('ورود به اوپن‌فاند روی آربیتروم است؛ پرداخت می‌تواند روی هر شبکهٔ بالا باشد، اما باید از همان کیف پولی امضا شود که با آن وارد شده‌ای.',
        'Sign-in uses Arbitrum; the payment can use any network above, but it must be signed by the same wallet you signed in with.')} <bdi dir="ltr">{short(sessionWallet)}</bdi></p>
      {!isConnected && <p className="of-profile-error" role="alert">{t('کیف پول متصل نیست؛ دوباره وصل کن.', 'Your wallet is not connected — reconnect it.')}</p>}
      {wrongAccount && <p className="of-profile-error" role="alert">{errText('wallet_mismatch')} (<bdi dir="ltr">{short(address)}</bdi> ≠ <bdi dir="ltr">{short(sessionWallet)}</bdi>)</p>}
      {!intent && !sent && (
        <button className="button full of-co-pay" disabled={disabled || busy || !isConnected || wrongAccount} onClick={() => { void prepare() }}>
          {busy ? '…' : <>{t('آماده‌سازی پرداخت', 'Prepare payment')} <bdi dir="ltr">{'$' + remainingUsd}</bdi></>}
        </button>
      )}
      {intent && (
        <div className="of-co-summary of-checkout-summary">
          <div className="of-co-total"><span>{t('مبلغ دقیق انتقال', 'Exact transfer amount')}</span><b dir="ltr">{intent.amount} {intent.tokenSymbol || ''}</b></div>
          <div><span>{t('شبکه', 'Network')}</span><b>{chainLabel(intent.chainId)}</b></div>
          <div><span>{t('قرارداد توکن', 'Token contract')}</span><b dir="ltr" className="of-co-mono">{short(intent.token)}</b></div>
          <div><span>{t('خزانهٔ اوپن‌فاند', 'Openfund treasury')}</span><b dir="ltr" className="of-co-mono">{short(intent.receiver)}</b></div>
          <div><span>{t('موجودی کیف پول', 'Wallet balance')}</span><b dir="ltr">{typeof balance === 'bigint' ? `${formatUnits(balance, intent.tokenDecimals)} ${intent.tokenSymbol || ''}` : '—'}</b></div>
          <div><span>{t('کارمزد تقریبی شبکه', 'Estimated network fee')}</span><b dir="ltr">{fee ? `≈ ${fee}` : '—'}</b></div>
          <div><span>{t('اعتبار درخواست تا', 'Request valid until')}</span><b dir="ltr">{new Date(intent.expiresAt).toLocaleTimeString()}</b></div>
        </div>
      )}
      {insufficient && <p className="of-profile-error" role="alert">{t('موجودی این توکن در کیف پول کافی نیست. می‌توانی بخشی را بپردازی؛ مانده در سفارش باقی می‌ماند.', 'Your token balance is below the amount. You may pay part of it; the remaining balance stays on the order.')}</p>}
      {intent && !sent && (
        <button className="button full of-co-pay" disabled={disabled || busy || signing || switching || wrongAccount || !isConnected} onClick={() => { void pay() }}>
          {switching ? t('تغییر شبکه را در کیف پول تأیید کن…', 'Confirm the network switch in your wallet…')
            : busy || signing ? t('در انتظار امضای کیف پول…', 'Awaiting wallet signature…')
            : walletChain !== intent.chainId ? <>{t('تغییر شبکه و پرداخت', 'Switch network and pay')} · <bdi dir="ltr">{chainLabel(intent.chainId)}</bdi></>
            : <>{t('پرداخت', 'Pay')} <bdi dir="ltr">{intent.amount} {intent.tokenSymbol || ''}</bdi></>}
        </button>
      )}
      {sent && (
        <p className="of-checkout-status" role="status">{t('تراکنش ارسال و ثبت شد؛ سرور اوپن‌فاند آن را مستقیماً روی بلاک‌چین بررسی می‌کند.', 'Transaction submitted and recorded — Openfund’s server is verifying it on-chain.')}{' '}
          {txExplorerUrl(intent?.chainId, sent) ? <a dir="ltr" href={txExplorerUrl(intent?.chainId, sent)!} target="_blank" rel="noreferrer">{short(sent)}</a> : <bdi dir="ltr">{short(sent)}</bdi>}</p>
      )}
      {error && <p className="of-profile-error" role="alert">{error}</p>}
    </div>
  )
}

/** the mandatory red sender warning for EVM manual transfers */
export function ManualWarning({ t, wallet, accepted, onAccept }: { t: T, wallet: string | null | undefined, accepted: boolean, onAccept: (v: boolean) => void }) {
  return (
    <div className="of-pay-warning" role="alert">
      <strong>{t('هشدار بسیار مهم', 'Very important warning')}</strong>
      <p>{t('پرداخت را حتماً از همان کیف پولی انجام دهید که با آن وارد Openfund شده و امضا کرده‌اید.',
        'Make the payment from the same wallet you used to sign in to Openfund.')}</p>
      <p>{t('پرداخت از کیف پول دیگر یا صرافی به‌صورت خودکار به سفارش شما متصل و تأیید نمی‌شود و نیازمند بررسی پشتیبانی خواهد بود.',
        'A payment from another wallet or from an exchange is not automatically matched to your order or confirmed, and will need a support review.')}</p>
      <p>{t('کیف پول واردشده:', 'Signed-in wallet:')} <code dir="ltr">{wallet || '—'}</code></p>
      <label className="of-pay-ack">
        <input type="checkbox" checked={accepted} onChange={e => onAccept(e.target.checked)} />
        <span>{t('متوجه شدم و از همین کیف پول پرداخت می‌کنم.', 'I understand and will pay from this wallet.')}</span>
      </label>
    </div>
  )
}

export interface Ledger {
  totalUsd: string, receivedUsd: string, remainingUsd: string, excessUsd: string, partialDeadlineAt: string | null,
  transactions: { id: string, chainId: number, txHash: string, amount: string | null, usd: string | null, allocatedUsd: string, excessUsd: string, status: string, code: string | null, confirmations: number | null, source: string, verifiedAt: string | null }[],
  refunds: { id: string, reason: string, usd: string, status: string, destination: string, refundTxHash: string | null, chainId: number }[],
}
export interface PaymentStatusView { status: ServerPaymentStatus | null, ledger: Ledger | null, timeline: { kind: string, at: string, detail?: Record<string, unknown> }[] }

const TIMELINE: Record<string, [string, string]> = {
  intent_created: ['درخواست پرداخت ساخته شد', 'Payment request created'],
  transaction_submitted: ['تراکنش از کیف پول ارسال شد', 'Transaction submitted from the wallet'],
  transaction_observed: ['تراکنش در خزانه دیده شد', 'Transaction seen at the treasury'],
  transaction_verified: ['تراکنش روی بلاک‌چین تأیید شد', 'Transaction verified on-chain'],
  allocation_order: ['مبلغ به سفارش اختصاص یافت', 'Amount applied to the order'],
  allocation_excess: ['مبلغ اضافه ثبت شد', 'Excess amount recorded'],
  refund_liability_created: ['بدهی بازپرداخت ثبت شد', 'Refund liability recorded'],
  order_partially_paid: ['بخشی از مبلغ پرداخت شد', 'Order partially paid'],
  order_settled: ['سفارش به‌طور کامل پرداخت شد', 'Order fully paid'],
  status_delayed: ['بررسی بیش از ۱۵ دقیقه طول کشیده است', 'Verification has taken more than 15 minutes'],
  escalated_review: ['برای بررسی پشتیبانی ارجاع شد', 'Escalated to support review'],
  review_required: ['نیازمند بررسی', 'Review required'],
  partial_balance_overdue: ['مهلت پرداخت مانده گذشت؛ در حال بررسی', 'Remaining balance overdue — under review'],
  refund_review: ['بازپرداخت در حال بررسی', 'Refund under review'], refund_approved: ['بازپرداخت تأیید شد', 'Refund approved'],
  refund_sent: ['بازپرداخت ارسال شد', 'Refund sent'], refund_confirmed: ['بازپرداخت روی بلاک‌چین تأیید شد', 'Refund confirmed on-chain'],
  refund_rejected: ['درخواست بازپرداخت رد شد', 'Refund rejected'], refund_failed: ['بازپرداخت ناموفق بود', 'Refund failed'],
  order_awaiting_payment: ['سفارش ساخته شد', 'Order created'], order_payment_detected: ['پرداخت شناسایی شد', 'Payment detected'],
  order_partially_paid_state: ['پرداخت جزئی', 'Partially paid'], order_paid: ['پرداخت شد', 'Paid'], order_provisioned: ['چالش فعال شد', 'Challenge activated'],
  order_expired: ['سفارش منقضی شد', 'Order expired'], order_manual_review: ['در بررسی پشتیبانی', 'Under support review'], order_cancelled: ['سفارش لغو شد', 'Order cancelled'],
}
const REFUND: Record<string, [string, string]> = {
  refund_due: ['ثبت‌شده', 'Recorded'], refund_review: ['در حال بررسی', 'Under review'], refund_approved: ['تأییدشده', 'Approved'],
  refund_sent: ['ارسال‌شده', 'Sent'], refund_confirmed: ['انجام‌شده', 'Completed'], refund_rejected: ['ردشده', 'Rejected'], refund_failed: ['ناموفق', 'Failed'],
}
const DELAY: Record<string, [string, string]> = {
  tx_pending: ['تراکنش هنوز در بلاک‌چین ثبت نشده است.', 'The transaction is not on-chain yet.'],
  tx_not_final: ['تراکنش ثبت شده و منتظر تعداد تأیید لازم است.', 'The transaction is mined and waiting for the required confirmations.'],
  rpc_unavailable: ['اتصال به شبکه موقتاً در دسترس نیست؛ پرداخت شما از دست نمی‌رود.', 'The network is temporarily unreachable; your payment is not lost.'],
  tx_reorged: ['بلاک تراکنش تغییر کرد و دوباره بررسی می‌شود.', 'The transaction block changed and is being re-checked.'],
}

export function PaymentStatus({ t, view, money, dateTime, onCompleteRemaining }: {
  t: T, view: PaymentStatusView, money: (v: string) => string, dateTime: (d: string) => string, onCompleteRemaining?: () => void
}) {
  const s = view.status, l = view.ledger
  const timeline = useMemo(() => view.timeline.filter(e => TIMELINE[e.kind] || TIMELINE[e.kind + '_state']), [view.timeline])
  if (!s) return null
  const tone = statusTone(s.code)
  return (
    <section className={`of-pay-status of-pay-tone-${tone}`} aria-live="polite">
      <p className="of-co-state" role="status" data-status={s.code}><span>{t('وضعیت پرداخت', 'Payment status')}:</span> <b>{t(...PAYMENT_STATUS_TEXT[s.code])}</b></p>
      {s.escalation === 'delayed' && <p className="of-co-note">{t('بررسی بیش از ۱۵ دقیقه طول کشیده است.', 'Verification has taken more than 15 minutes.')} {DELAY[s.reason || ''] ? t(...DELAY[s.reason!]) : ''}</p>}
      {s.escalation === 'review' && <p className="of-co-note">{t('این پرداخت برای بررسی پشتیبانی ارجاع شد. بررسی خودکار روی بلاک‌چین ادامه دارد و به‌محض نتیجه، این صفحه به‌روز می‌شود. پرداخت ناموفق اعلام نشده است.',
        'This payment was escalated to support review. Automatic on-chain verification continues and this page updates as soon as there is a result. The payment has not been declared failed.')}</p>}
      {l && (
        <div className="of-co-summary of-checkout-summary">
          <div><span>{t('مبلغ سفارش', 'Order total')}</span><b dir="ltr">{money(l.totalUsd)}</b></div>
          <div><span>{t('دریافت‌شده', 'Received')}</span><b dir="ltr">{money(l.receivedUsd)}</b></div>
          <div className={l.remainingUsd !== '0' ? 'of-co-total' : ''}><span>{t('مانده', 'Remaining')}</span><b dir="ltr">{money(l.remainingUsd)}</b></div>
          {l.excessUsd !== '0' && <div><span>{t('مبلغ اضافه (قابل بازپرداخت)', 'Excess (refundable)')}</span><b dir="ltr">{money(l.excessUsd)}</b></div>}
          {l.partialDeadlineAt && l.remainingUsd !== '0' && <div><span>{t('مهلت پرداخت مانده', 'Pay the remaining balance by')}</span><b>{dateTime(l.partialDeadlineAt)}</b></div>}
        </div>
      )}
      {s.code === 'partially_received' && onCompleteRemaining && (
        <button className="button full" onClick={onCompleteRemaining}>{t('پرداخت مبلغ باقی‌مانده', 'Complete Remaining Payment')}</button>
      )}
      {l && l.transactions.length > 0 && (
        <div className="of-pay-table" role="table" aria-label={t('تراکنش‌ها', 'Transactions')}>
          {l.transactions.map(x => (
            <div role="row" key={x.id}>
              <span role="cell">{chainLabel(x.chainId)}</span>
              <span role="cell" dir="ltr" className="of-co-mono">{txExplorerUrl(x.chainId, x.txHash) ? <a href={txExplorerUrl(x.chainId, x.txHash)!} target="_blank" rel="noreferrer">{short(x.txHash)}</a> : short(x.txHash)}</span>
              <span role="cell" dir="ltr">{x.usd ? money(x.usd) : '—'}</span>
              <span role="cell">{x.status === 'verified' ? t('تأییدشده', 'Verified') : x.status === 'reorged' ? t('حذف از زنجیره', 'Reorganized') : t('در انتظار', 'Pending')}</span>
            </div>
          ))}
        </div>
      )}
      {l && l.refunds.length > 0 && (
        <div className="of-pay-refunds">
          <h3>{t('بازپرداخت‌ها', 'Refunds')}</h3>
          {l.refunds.map(r => (
            <p key={r.id}><b dir="ltr">{money(r.usd)}</b> · {t(...(REFUND[r.status] || ['—', '—']))} · {t('به', 'to')} <bdi dir="ltr" className="of-co-mono">{short(r.destination)}</bdi>
              {r.refundTxHash && txExplorerUrl(r.chainId, r.refundTxHash) && <> · <a dir="ltr" href={txExplorerUrl(r.chainId, r.refundTxHash)!} target="_blank" rel="noreferrer">{short(r.refundTxHash)}</a></>}</p>
          ))}
          <p className="of-co-muted">{t('بازپرداخت خودکار نیست: پس از بررسی و تأیید، به همان کیف پولی که پرداخت از آن انجام شده ارسال می‌شود.', 'Refunds are not automatic: after review and approval they are sent to the wallet the payment came from.')}</p>
        </div>
      )}
      {timeline.length > 0 && (
        <ol className="of-pay-timeline" aria-label={t('روند پرداخت', 'Payment timeline')}>
          {timeline.map((e, i) => <li key={i}><span>{t(...(TIMELINE[e.kind] || TIMELINE[e.kind + '_state']))}</span> <time>{dateTime(e.at)}</time></li>)}
        </ol>
      )}
    </section>
  )
}
