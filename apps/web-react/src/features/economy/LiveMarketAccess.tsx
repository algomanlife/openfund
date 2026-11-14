import { useState } from 'react'
import { Link } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { labels, text as t, type Localized, type Locale } from '../information/content'
import { apiFetch, useOpenfundSession } from '../../session/useOpenfundSession'
import EconomyNav from './EconomyNav'
import { Field, Kpi, StateBlock, Status, errorCopy, usd, when, useRemote } from './ui'
import type { Capacity, EligibilityCheck } from './types'

const intro = t('A separate program that connects selected traders to real markets through Gains Network, using capital owned by Openfund — only when verified free capital exists and management approves.', 'برنامه‌ای مستقل که معامله‌گران منتخب را با سرمایهٔ متعلق به اوپن‌فاند و از طریق Gains Network به بازار واقعی متصل می‌کند؛ فقط در صورت وجود سرمایهٔ آزاد تأییدشده و تأیید مدیریت.')

export const CHECK_COPY: Record<string, Localized> = {
  first_account_purchased: t('First challenge purchased', 'خرید اولین چلنج'),
  first_account_evaluation_passed: t('First account passed every evaluation stage', 'قبولی حساب اول در همهٔ مراحل ارزیابی'),
  first_account_funded: t('First account reached the funded simulation', 'ورود حساب اول به حساب فاندد شبیه‌سازی‌شده'),
  first_account_paid_withdrawals: t('10 paid withdrawals from the first account', '۱۰ برداشت پرداخت‌شده از حساب اول'),
  second_account_double_size: t('Second account exactly 2× the first size', 'حساب دوم دقیقاً دو برابر حساب اول'),
  second_account_evaluation_passed: t('Second account passed evaluation', 'قبولی حساب دوم در ارزیابی'),
  second_account_paid_withdrawals: t('5 paid withdrawals from the second account', '۵ برداشت پرداخت‌شده از حساب دوم'),
  coach_link_active: t('Linked to an approved, active coach', 'ارتباط فعال با کوچ تأییدشده'),
  coach_verified_trader: t('Coach verified your qualification', 'تأیید صلاحیت توسط کوچ'),
}
export function Checks({ checks, locale }: { checks: EligibilityCheck[]; locale: Locale }) {
  return <ul className="econ-check-list">{checks.map(c => <li key={c.key} className={c.ok ? 'ok' : ''}>{(CHECK_COPY[c.key]?.[locale] ?? c.key)}{c.required != null && c.value != null ? <bdi> ({String(c.value)} / {String(c.required)})</bdi> : null}</li>)}</ul>
}

const capacityCopy = (c: Capacity, locale: Locale) => ({
  unknown: [t('Unknown / Not verified', 'نامعلوم / تأییدنشده'), t('Free capital cannot be verified yet, so the program cannot allocate capital.', 'سرمایهٔ آزاد هنوز قابل تأیید نیست؛ بنابراین برنامه سرمایه‌ای تخصیص نمی‌دهد.')],
  below_threshold: [t('Below threshold', 'زیر آستانه'), t('Verified free capital is below $500,000.', 'سرمایهٔ آزاد تأییدشده کمتر از ۵۰۰٬۰۰۰ دلار است.')],
  capacity_available: [t('Capacity available', 'ظرفیت موجود'), t('Verified free capital meets the threshold. Activation still requires management decisions.', 'سرمایهٔ آزاد تأییدشده به آستانه رسیده است؛ فعال‌سازی همچنان به تصمیم مدیریت نیاز دارد.')],
}[c.state].map(x => x[locale]))

interface LiveMe {
  eligibility: { eligible: boolean; checks: EligibilityCheck[]; fundedDefinition: string }
  approval: { id: string; status: string; tier: string | null; trader_pct: string | null; coach_pct: string | null; openfund_pct: string | null; requested_at: string } | null
  allocation: { id: string; amount_usd: string; realized_pnl_usd: string; status: string; halt_reason: string | null; adapter: string; risk_limits: Record<string, number | string> } | null
  trades: { id: string; market: string; side: string; collateral_usd: string; leverage: string; status: string; entry_price: string | null; exit_price: string | null; realized_pnl_usd: string | null; created_at: string }[]
  settlements: { id: string; amount_usd: string; status: string; tx_hash: string | null; settlement_reference: string | null; created_at: string }[]
  executionAdapter: string
}

function TraderPanel({ locale }: { locale: Locale }) {
  const { status } = useOpenfundSession()
  const [me, reload] = useRemote<LiveMe>(status === 'authenticated' ? '/live/me' : null, [status])
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [order, setOrder] = useState({ market: 'BTC/USD', side: 'long', collateralUsd: '', leverage: '2' })
  const [busy, setBusy] = useState(false)
  if (status !== 'authenticated') return <div className="econ-panel"><h3>{t('Your eligibility', 'وضعیت احراز شرایط تو')[locale]}</h3><p className="econ-msg">{t('Connect and sign in with your wallet to see your eligibility, computed from your own account records.', 'برای دیدن وضعیت احراز شرایط که از سوابق حساب خودت محاسبه می‌شود، کیف پول را متصل کن و وارد شو.')[locale]}</p></div>
  if (me.status !== 'ready') return <StateBlock state={me} locale={locale} />
  const d = me.data
  const act = async (fn: () => Promise<{ ok: boolean; data: { error?: string } | null }>, ok: string) => {
    setBusy(true); setMsg(null)
    const r = await fn().catch(() => ({ ok: false, data: null }))
    setBusy(false)
    setMsg(r.ok ? { kind: 'ok', text: ok } : { kind: 'error', text: errorCopy(r.data?.error, locale) })
    reload()
  }
  return <>
    <div className="econ-panel">
      <div className="section-top"><h3>{t('Your eligibility', 'وضعیت احراز شرایط تو')[locale]}</h3>{d.eligibility.eligible ? <Status kind="ok">{t('All conditions met', 'همهٔ شرایط احراز شده')[locale]}</Status> : <Status kind="off">{t('Not yet eligible', 'هنوز واجد شرایط نیستی')[locale]}</Status>}</div>
      <Checks checks={d.eligibility.checks} locale={locale} />
      <p className="econ-source">{t('Computed by the backend from purchases, evaluation results and paid withdrawals. Self-declared information is never used.', 'بک‌اند آن را از خریدها، نتایج ارزیابی و برداشت‌های پرداخت‌شده محاسبه می‌کند؛ اظهار شخصی هرگز ملاک نیست.')[locale]} · {d.eligibility.fundedDefinition}</p>
      <div className="econ-actions">
        {!d.approval || ['rejected', 'revoked'].includes(d.approval.status)
          ? <button className="button" disabled={!d.eligibility.eligible || busy} onClick={() => act(() => apiFetch('/live/apply', { method: 'POST', body: '{}' }), t('Request submitted for management review.', 'درخواست برای بررسی مدیریت ثبت شد.')[locale])}>{t('Request Live Market Access', 'درخواست اتصال به بازار')[locale]}</button>
          : <Status kind={d.approval.status === 'approved' ? 'ok' : 'info'}>{d.approval.status}{d.approval.tier ? ` · ${d.approval.tier} ${d.approval.trader_pct}/${d.approval.coach_pct}/${d.approval.openfund_pct}` : ''}</Status>}
        <Link className="text-link" to={`/${locale}/coach`}>{t('Link a verified coach', 'اتصال به کوچ تأییدشده')[locale]} ↗</Link>
      </div>
      {msg && <p className={`econ-msg ${msg.kind}`} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p>}
    </div>
    {d.allocation && <div className="econ-panel">
      <div className="section-top"><h3>{t('Allocated capital', 'سرمایهٔ تخصیص‌یافته')[locale]}</h3><Status kind={d.allocation.status === 'active' ? 'ok' : 'warn'}>{d.allocation.status}{d.allocation.halt_reason ? ` · ${d.allocation.halt_reason}` : ''}</Status></div>
      {d.allocation.adapter === 'sandbox' && <div className="econ-banner" role="note">{t('SANDBOX — non-monetary execution adapter. Fills use server marks; no funds move and nothing is sent to Gains Network.', 'سندباکس — آداپتر اجرای غیرپولی. اجرا با قیمت مرجع سرور است؛ هیچ وجهی جابه‌جا نمی‌شود و چیزی به Gains Network ارسال نمی‌شود.')[locale]}</div>}
      <div className="econ-grid">
        <Kpi label={t('Allocation', 'تخصیص')[locale]} value={usd(d.allocation.amount_usd, locale)} />
        <Kpi label={t('Realized net PnL', 'سود و زیان خالص تحقق‌یافته')[locale]} value={usd(d.allocation.realized_pnl_usd, locale)} />
        <Kpi label={t('Daily / max drawdown', 'افت روزانه / حداکثر')[locale]} value={`${d.allocation.risk_limits.dailyDrawdownPct}% / ${d.allocation.risk_limits.maxDrawdownPct}%`} />
        <Kpi label={t('Max leverage / exposure', 'حداکثر اهرم / ریسک باز')[locale]} value={`${d.allocation.risk_limits.maxLeverage}× / ${usd(d.allocation.risk_limits.maxExposureUsd, locale, 0)}`} />
      </div>
      {d.allocation.status === 'active' && d.executionAdapter !== 'none' && <form className="econ-form" style={{ marginTop: 16 }} onSubmit={e => { e.preventDefault(); void act(() => apiFetch('/live/orders', { method: 'POST', body: JSON.stringify({ ...order, leverage: Number(order.leverage), idempotencyKey: crypto.randomUUID() }) }), t('Order recorded.', 'سفارش ثبت شد.')[locale]) }}>
        <Field label={t('Market', 'بازار')[locale]}><input value={order.market} onChange={e => setOrder(o => ({ ...o, market: e.target.value.toUpperCase() }))} dir="ltr" /></Field>
        <Field label={t('Side', 'جهت')[locale]}><select value={order.side} onChange={e => setOrder(o => ({ ...o, side: e.target.value }))}><option value="long">{t('Long', 'خرید')[locale]}</option><option value="short">{t('Short', 'فروش')[locale]}</option></select></Field>
        <Field label={t('Collateral (USD)', 'وثیقه (دلار)')[locale]} hint={t('Worst-case loss of an isolated position is its full collateral.', 'بدترین زیان پوزیشن ایزوله، کل وثیقهٔ آن است.')[locale]}><input type="number" min="1" step="0.01" required value={order.collateralUsd} onChange={e => setOrder(o => ({ ...o, collateralUsd: e.target.value }))} /></Field>
        <Field label={t('Leverage', 'اهرم')[locale]}><input type="number" min="1" step="0.1" required value={order.leverage} onChange={e => setOrder(o => ({ ...o, leverage: e.target.value }))} /></Field>
        <div className="econ-actions wide"><button className="button" disabled={busy}>{t('Submit order', 'ثبت سفارش')[locale]}</button></div>
      </form>}
      {d.trades.length > 0 && <div className="info-table-wrap"><table><caption>{t('Live trades', 'معاملات واقعی')[locale]}</caption><thead><tr>{[t('Opened', 'زمان'), t('Market', 'بازار'), t('Collateral × leverage', 'وثیقه × اهرم'), t('Status', 'وضعیت'), t('Entry → exit', 'ورود ← خروج'), t('Realized PnL', 'سود و زیان'), '']. map((h, i) => <th key={i} scope="col">{typeof h === 'string' ? h : h[locale]}</th>)}</tr></thead>
        <tbody>{d.trades.map(tr => <tr key={tr.id}><td>{when(tr.created_at, locale)}</td><td dir="ltr">{tr.market} {tr.side}</td><td dir="ltr">{usd(tr.collateral_usd, locale)} × {tr.leverage}</td><td>{tr.status}</td><td dir="ltr">{tr.entry_price ?? '—'} → {tr.exit_price ?? '—'}</td><td>{usd(tr.realized_pnl_usd, locale)}</td>
          <td>{tr.status === 'open' && <button className="text-link" disabled={busy} onClick={() => act(() => apiFetch(`/live/trades/${tr.id}/close`, { method: 'POST', body: '{}' }), t('Position closed and finalized.', 'پوزیشن بسته و نهایی شد.')[locale])}>{t('Close', 'بستن')[locale]}</button>}</td></tr>)}</tbody></table></div>}
      {d.settlements.length > 0 && <div className="econ-list" style={{ marginTop: 14 }}>{d.settlements.map(s => <div key={s.id}><span>{when(s.created_at, locale)} · {s.status}{s.settlement_reference ? ` · ${s.settlement_reference}` : ''}</span><span>{usd(s.amount_usd, locale)}</span></div>)}</div>}
    </div>}
  </>
}

export default function LiveMarketAccess() {
  const locale = useInformationLocale()
  const [status] = useRemote<{ capacity: Capacity; executionAdapter: string; settlementAdapter: string }>('/live/status')
  return <InformationShell page="live-market-access" description={intro[locale]}>
    <Hero locale={locale} page="live-market-access" title={t('Real markets,', 'بازار واقعی،')[locale]} accent={t('real capital, real controls.', 'سرمایهٔ واقعی، کنترل واقعی.')[locale]} intro={intro[locale]}>
      <EconomyNav locale={locale} current="live-market-access" />
    </Hero>
    <div className="container">
      <section className="econ-section" id="capacity"><div className="section-top"><div><span className="eyebrow">01 / {t('CAPITAL AVAILABILITY', 'ظرفیت سرمایه')[locale]}</span><h2>{t('The program opens only on verified free capital.', 'برنامه فقط با سرمایهٔ آزاد تأییدشده باز می‌شود.')[locale]}</h2></div></div>
        {status.status === 'ready' ? (() => { const c = status.data.capacity; const [title, body] = capacityCopy(c, locale); return <div className="econ-grid three">
          <Kpi label={t('Program capacity', 'ظرفیت برنامه')[locale]} value={title} tone={c.state === 'capacity_available' ? 'good' : 'warn'} note={body} />
          <Kpi label={t('Threshold (available allocatable capital)', 'آستانه (سرمایهٔ آزاد قابل تخصیص)')[locale]} value={usd(c.thresholdUsd, locale, 0)} note={c.availableUsd ? `${t('Verified available', 'سرمایهٔ آزاد تأییدشده')[locale]} ${usd(c.availableUsd, locale)}` : t('Not the gross wallet balance.', 'موجودی ناخالص کیف پول ملاک نیست.')[locale]} />
          <Kpi label={t('Execution / settlement adapter', 'آداپتر اجرا / تسویه')[locale]} value={`${status.data.executionAdapter} / ${status.data.settlementAdapter}`} note={status.data.executionAdapter === 'none' ? t('Live execution is disabled on this deployment.', 'اجرای واقعی در این استقرار غیرفعال است.')[locale] : status.data.executionAdapter === 'sandbox' ? t('Non-monetary sandbox — no real orders.', 'سندباکس غیرپولی — بدون سفارش واقعی.')[locale] : undefined} />
        </div> })() : <StateBlock state={status} locale={locale} />}
        <p className="econ-source">{t('Capital = treasury − (rewards owed + commissions + coach/trader shares + expenses + liabilities) − (operational + risk reserves) − capital already allocated, including open-trade margin.', 'سرمایه = خزانه − (پاداش بدهکار + کمیسیون + سهم کوچ/معامله‌گر + هزینه + بدهی) − (ذخایر عملیاتی + ریسک) − سرمایهٔ قبلاً تخصیص‌یافته شامل مارجین معاملات باز.')[locale]} <Link className="text-link" to={`/${locale}/transparency`}>{labels.transparency[locale]} ↗</Link></p>
      </section>
      <section className="econ-section" id="eligibility"><div className="section-top"><div><span className="eyebrow">02 / {t('ELIGIBILITY', 'شرایط ورود')[locale]}</span><h2>{t('Earned on record, not claimed.', 'اثبات‌شده در سوابق، نه ادعا.')[locale]}</h2></div></div>
        <div className="econ-grid three">
          <div className="econ-panel"><h3>{t('First account', 'حساب اول')[locale]}</h3><Checks locale={locale} checks={['first_account_purchased', 'first_account_evaluation_passed', 'first_account_funded', 'first_account_paid_withdrawals'].map(key => ({ key, ok: false }))} /></div>
          <div className="econ-panel"><h3>{t('Second account', 'حساب دوم')[locale]}</h3><Checks locale={locale} checks={['second_account_double_size', 'second_account_evaluation_passed', 'second_account_paid_withdrawals'].map(key => ({ key, ok: false }))} /></div>
          <div className="econ-panel"><h3>{t('Coach & final approval', 'کوچ و تأیید نهایی')[locale]}</h3><Checks locale={locale} checks={['coach_link_active', 'coach_verified_trader'].map(key => ({ key, ok: false }))} /><p className="econ-msg">{t('Then the backend re-checks every condition and Openfund management makes the final decision and selects the profit-share tier.', 'سپس بک‌اند همهٔ شرایط را دوباره بررسی می‌کند و مدیریت اوپن‌فاند تصمیم نهایی و ردهٔ تقسیم سود را تعیین می‌کند.')[locale]}</p></div>
        </div>
        <div style={{ marginTop: 16 }}><TraderPanel locale={locale} /></div>
      </section>
      <section className="econ-section" id="workflow"><div className="section-top"><div><span className="eyebrow">03 / {t('LIVE TRADING WORKFLOW', 'جریان معاملات واقعی')[locale]}</span><h2>{t('Every order passes the same gates.', 'هر سفارش از همان دروازه‌ها عبور می‌کند.')[locale]}</h2></div></div>
        <div className="econ-flow" role="list">{[
          [t('Order', 'سفارش'), t('The trader submits from the Openfund terminal with an idempotency key.', 'معامله‌گر با کلید یکتای تکرار از ترمینال اوپن‌فاند سفارش می‌دهد.')],
          [t('Pre-trade checks', 'بررسی پیش از معامله'), t('Approval, allocation status, leverage, exposure and worst-case loss against drawdown budgets.', 'تأیید، وضعیت تخصیص، اهرم، ریسک باز و بدترین زیان در برابر بودجهٔ افت.')],
          [t('Execution', 'اجرا'), t('Through the configured adapter. Real Gains execution requires an approved signer, testnet validation and explicit activation.', 'از طریق آداپتر پیکربندی‌شده. اجرای واقعی در Gains به امضاکنندهٔ مجاز، اعتبارسنجی تست‌نت و فعال‌سازی صریح نیاز دارد.')],
          [t('Reconciliation', 'تطبیق'), t('Rejections, failures, partial or unknown outcomes are recorded and reconciled — never assumed.', 'رد، شکست، اجرای جزئی یا نتیجهٔ نامعلوم ثبت و تطبیق می‌شود؛ هرگز فرض نمی‌شود.')],
          [t('Close & verify', 'بستن و تأیید'), t('Realized PnL, fees and execution costs are recorded once, from the verified close result.', 'سود تحقق‌یافته، کارمزد و هزینهٔ اجرا یک‌بار و از نتیجهٔ تأییدشدهٔ بستن ثبت می‌شود.')],
          [t('Split', 'تقسیم'), t('Distributable profit = realized PnL − eligible costs, split by the approved tier.', 'سود قابل‌توزیع = سود تحقق‌یافته − هزینه‌های مجاز، طبق ردهٔ تأییدشده.')],
          [t('Settlement', 'تسویه'), t('Trader and coach shares settle automatically and idempotently; failures retry, then go to reconciliation.', 'سهم معامله‌گر و کوچ به‌طور خودکار و بدون تکرار تسویه می‌شود؛ خطا دوباره تلاش و سپس تطبیق می‌شود.')],
          [t('Losses', 'زیان'), t('No profit share. Allocation equity drops and the circuit breaker halts trading on a drawdown breach.', 'بدون سهم سود. ارزش تخصیص کاهش می‌یابد و قطع‌کنندهٔ مدار با نقض افت، معامله را متوقف می‌کند.')],
        ].map(([a, b], i) => <div role="listitem" key={i}><strong>{a[locale]}</strong>{b[locale]}</div>)}</div>
      </section>
      <section className="econ-section" id="profit"><div className="section-top"><div><span className="eyebrow">04 / {t('PROFIT DISTRIBUTION', 'توزیع سود')[locale]}</span><h2>{t('Coach 10%. Tier chosen by management.', 'سهم کوچ ۱۰٪؛ رده با تصمیم مدیریت.')[locale]}</h2></div><Status kind="warn">{t('Candidate tiers — not final policy', 'رده‌های پیشنهادی — سیاست نهایی نیست')[locale]}</Status></div>
        <div className="info-table-wrap"><table><thead><tr><th scope="col">{t('Tier', 'رده')[locale]}</th><th scope="col">{t('Trader', 'معامله\u200cگر')[locale]}</th><th scope="col">{t('Coach', 'کوچ')[locale]}</th><th scope="col">Openfund</th></tr></thead><tbody>{[['Standard', 70, 10, 20], ['Advanced', 80, 10, 10], ['Elite', 85, 10, 5]].map(r => <tr key={r[0]}>{r.map((v, i) => <td key={i}>{typeof v === 'number' ? `${v}%` : v}</td>)}</tr>)}</tbody></table></div>
        <p className="econ-source">{t('No tier applies by default: approval is refused until an administrator selects one explicitly. Shares always total 100%. Unrealized PnL is never paid.', 'هیچ رده‌ای پیش‌فرض نیست: تا مدیر صریحاً یکی را انتخاب نکند، تأیید انجام نمی‌شود. مجموع سهم‌ها همیشه ۱۰۰٪ است. سود تحقق‌نیافته هرگز پرداخت نمی‌شود.')[locale]}</p>
      </section>
      <section className="econ-section" id="risk"><div className="section-top"><div><span className="eyebrow">05 / {t('RISK CONTROLS', 'کنترل ریسک')[locale]}</span><h2>{t('A 5% limit is not a 5% loss cap.', 'حد ۵٪ یعنی سقف زیان ۵٪ نیست.')[locale]}</h2></div></div>
        <div className="econ-grid">
          {[[t('Drawdown budgets', 'بودجهٔ افت'), t('Daily and maximum drawdown default to the funded account policy and can only be tightened.', 'افت روزانه و حداکثر از سیاست حساب فاندد می‌آیند و فقط سخت‌تر می‌شوند.')],
            [t('Worst-case loss', 'بدترین زیان'), t('An isolated position can lose its whole collateral (gaps, liquidation, slippage). Orders are admitted only if total collateral at risk fits the remaining budget.', 'پوزیشن ایزوله می‌تواند کل وثیقه را از دست بدهد (گپ، لیکوئید، لغزش). سفارش فقط وقتی پذیرفته می‌شود که کل وثیقهٔ در معرض ریسک در بودجهٔ باقی‌مانده جا شود.')],
            [t('Leverage & exposure', 'اهرم و ریسک باز'), t('Per-allocation maximum leverage, total notional exposure and open-position count.', 'حداکثر اهرم، مجموع ارزش اسمی و تعداد پوزیشن باز برای هر تخصیص.')],
            [t('Circuit breaker', 'قطع‌کنندهٔ مدار'), t('A breach halts the allocation; management can halt, resume or close it at any time.', 'نقض حد، تخصیص را متوقف می‌کند؛ مدیریت هر زمان می‌تواند آن را متوقف، از سر گرفته یا بسته کند.')],
          ].map(([a, b], i) => <div className="econ-panel" key={i}><h3>{a[locale]}</h3><p className="econ-msg">{b[locale]}</p></div>)}
        </div>
      </section>
      <div className="info-end"><img src={`${import.meta.env.BASE_URL}assets/mark-mint.svg`} width="38" height="42" alt="" /><p>{t('No real order or transfer happens without explicit management activation.', 'هیچ سفارش یا انتقال واقعی بدون فعال‌سازی صریح مدیریت انجام نمی‌شود.')[locale]}</p><Link className="button" to={`/${locale}/coach`}>{labels.coach[locale]} <span aria-hidden="true">↗</span></Link></div>
    </div>
  </InformationShell>
}
