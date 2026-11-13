import { Link } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { labels, text as t, type Localized, type Locale } from '../information/content'
import EconomyNav from '../economy/EconomyNav'
import { Bars, Kpi, Source, StateBlock, Status, backendText, day, int, pct, usd, when, useRemote } from '../economy/ui'
import type { TransparencyReport, TreasuryView } from '../economy/types'
import { infrastructure, transparencyIntro } from './content'
import TreasuryWallets from './TreasuryWallets'

const CATEGORY: Record<string, Localized> = {
  render_infrastructure: t('Technical infrastructure', 'زیرساخت فنی'), database: t('Database', 'پایگاه داده'), cms: t('CMS', 'سیستم مدیریت محتوا'),
  market_data: t('Market data services', 'سرویس‌های دادهٔ بازار'), operational_services: t('Operational services', 'سرویس‌های عملیاتی'), marketing: t('Marketing', 'بازاریابی'),
  ambassador_commissions: t('Ambassador commissions', 'کمیسیون سفیران'), salaries_administration: t('Salaries & administration', 'حقوق و امور اداری'), other: t('Other verified expenses', 'سایر هزینه‌های تأییدشده'),
}
const MISSING: Record<string, Localized> = {
  treasury_snapshot: t('No treasury snapshot', 'تصویر موجودی خزانه وجود ندارد'), treasury_snapshot_fresh: t('Treasury snapshot is stale', 'تصویر موجودی خزانه منقضی است'),
  treasury_asset_prices: t('Some treasury assets have no valid price', 'برخی دارایی‌های خزانه قیمت معتبر ندارند'),
  operational_reserve: t('Operational reserve not set by management', 'ذخیرهٔ عملیاتی توسط مدیریت تعیین نشده'), risk_reserve: t('Risk reserve not set by management', 'ذخیرهٔ ریسک توسط مدیریت تعیین نشده'),
}

function Treasury({ tv, locale }: { tv: TreasuryView; locale: Locale }) {
  if (!tv.configured) return <div className="econ-panel">
    <h3>{t('Treasury wallet not configured', 'کیف پول خزانه پیکربندی نشده است')[locale]}</h3>
    <p className="econ-msg">{t('The public treasury address is supplied by backend configuration (TREASURY_WALLET_ADDRESS). Until management provides it, no treasury balance is displayed and allocatable capital stays Unknown.', 'نشانی عمومی خزانه از پیکربندی بک‌اند (TREASURY_WALLET_ADDRESS) خوانده می‌شود. تا زمانی که مدیریت آن را ارائه نکند، موجودی خزانه نمایش داده نمی‌شود و سرمایهٔ قابل تخصیص «نامعلوم» می‌ماند.')[locale]}</p>
    <Status kind="off">{t('Not configured', 'پیکربندی‌نشده')[locale]}{tv.configError && tv.configError !== 'not_configured' ? ` · ${tv.configError}` : ''}</Status>
  </div>
  const s = tv.snapshot
  return <>
    <div className="econ-panel">
      <div className="section-top"><div><h3>Openfund Treasury</h3><p className="econ-address" dir="ltr">{tv.address}</p></div>
        <div className="econ-actions">{tv.status === 'ok' ? <Status kind="ok">{t('Fresh', 'به‌روز')[locale]}</Status> : <Status kind="warn">{tv.status === 'stale' ? t('Stale — last valid snapshot shown', 'منقضی — آخرین تصویر معتبر')[locale] : t('Awaiting first snapshot', 'در انتظار اولین تصویر')[locale]}</Status>}
          {tv.explorerUrl && <a className="text-link" href={tv.explorerUrl} target="_blank" rel="noopener noreferrer">{t('View on block explorer', 'مشاهده در کاوشگر بلاک')[locale]} ↗</a>}</div></div>
      <div className="econ-grid">
        <Kpi label={t('Network', 'شبکه')[locale]} value={tv.network || tv.chainId} />
        <Kpi label={t('Priced balance (USD)', 'موجودی قیمت‌گذاری‌شده (دلار)')[locale]} value={s ? usd(s.totalUsd, locale) : '—'} note={s && !s.fullyPriced ? t('Excludes assets without a valid price feed', 'بدون دارایی‌های فاقد قیمت معتبر')[locale] : undefined} />
        <Kpi label={t('Last snapshot', 'آخرین تصویر')[locale]} value={s ? when(s.takenAt, locale) : '—'} note={s ? `block ${s.blockNumber}` : undefined} />
        <Kpi label={t('Refresh interval', 'بازهٔ به‌روزرسانی')[locale]} value={`${int(tv.refreshMinutes, locale)} ${t('min', 'دقیقه')[locale]}`} note={tv.lastAttempt ? `${t('Last attempt', 'آخرین تلاش')[locale]}: ${when(tv.lastAttempt.at, locale)} · ${tv.lastAttempt.status}` : undefined} />
      </div>
      {s && <div className="info-table-wrap"><table><caption>{t('Balances by asset', 'موجودی به تفکیک دارایی')[locale]}</caption><thead><tr>{[t('Asset', 'دارایی'), t('Balance', 'موجودی'), t('Price (USD)', 'قیمت (دلار)'), t('Value (USD)', 'ارزش (دلار)'), t('Price source', 'منبع قیمت')].map((h, i) => <th key={i} scope="col">{h[locale]}</th>)}</tr></thead>
        <tbody>{s.assets.map(a => <tr key={a.symbol + a.address}><th scope="row">{a.symbol}</th><td dir="ltr">{a.balance}</td><td>{a.priceUsd ? usd(a.priceUsd, locale, 4) : '—'}</td><td>{a.valueUsd ? usd(a.valueUsd, locale) : <Status kind="warn">{a.priceError}</Status>}</td><td dir="ltr" style={{ overflowWrap: 'anywhere' }}>{a.priceSource || '—'}{a.priceUpdatedAt ? ` · ${when(a.priceUpdatedAt, locale)}` : ''}</td></tr>)}</tbody></table></div>}
      <Source locale={locale}>{t('On-chain balanceOf / getBalance at the snapshot block; USD via configured Chainlink aggregators only', 'balanceOf / getBalance روی زنجیره در بلاک تصویر؛ ارزش دلاری فقط از Chainlink پیکربندی‌شده')[locale]}</Source>
    </div>
    {tv.history.length > 1 && <div className="econ-panel"><h3>{t('Treasury balance history', 'تاریخچهٔ موجودی خزانه')[locale]}</h3>
      <Bars locale={locale} label={t('Daily last priced balance, USD', 'آخرین موجودی قیمت‌گذاری‌شدهٔ روزانه، دلار')[locale]} points={tv.history.map(h => ({ key: h.day.slice(0, 10), value: Number(h.totalUsd || 0) }))} format={v => usd(v, locale)} /></div>}
  </>
}

function Report({ r, locale }: { r: TransparencyReport; locale: Locale }) {
  const s = r.sales, c = r.challenges, p = r.payouts, pos = r.position
  return <>
    <section className="econ-section" id="sales"><div className="section-top"><div><span className="eyebrow">01 / {t('SALES & REVENUE', 'فروش و درآمد')[locale]}</span><h2>{t('Confirmed sales only.', 'فقط فروش‌های تأییدشده.')[locale]}</h2></div><p>{t('Generated', 'تولید')[locale]} {when(r.generatedAt, locale)}</p></div>
      <div className="econ-grid">
        <Kpi label={t('Challenges sold', 'چلنج‌های فروخته‌شده')[locale]} value={int(s.challengesSold, locale)} note={`${int(s.uniqueCustomers, locale)} ${t('unique customers', 'مشتری یکتا')[locale]}`} />
        <Kpi label={t('Gross revenue', 'درآمد ناخالص')[locale]} value={usd(s.grossRevenueUsd, locale)} note={`${t('Average order', 'میانگین خرید')[locale]} ${usd(s.averageOrderUsd, locale)}`} />
        <Kpi label={t('Net revenue', 'درآمد خالص')[locale]} value={usd(s.netRevenueUsd, locale)} tone="good" note={`${t('Refunds', 'بازپرداخت')[locale]} ${usd(s.refundsUsd, locale)} · ${t('Chargebacks', 'برگشتی')[locale]} ${usd(s.chargebacksUsd, locale)}`} />
        <Kpi label={t('Payment success rate', 'نرخ موفقیت پرداخت')[locale]} value={pct(s.paymentSuccessRate, locale)} note={backendText(locale, s.paymentSuccessDefinition)} />
      </div>
      <div className="econ-grid three" style={{ marginTop: 14 }}>
        {(['d7', 'd30', 'd90'] as const).map(k => <Kpi key={k} label={{ d7: t('Last 7 days', '۷ روز اخیر'), d30: t('Last 30 days', '۳۰ روز اخیر'), d90: t('Last 90 days', '۹۰ روز اخیر') }[k][locale]} value={usd(s.periods[k].grossUsd, locale)} note={`${int(s.periods[k].orders, locale)} ${t('orders', 'سفارش')[locale]}`} />)}
      </div>
      <div className="econ-grid two" style={{ marginTop: 16 }}>
        <div className="econ-panel"><h3>{t('Monthly gross sales', 'فروش ناخالص ماهانه')[locale]}</h3><Bars locale={locale} label="USD" points={s.monthly.map(m => ({ key: m.month, value: Number(m.grossUsd) }))} format={v => usd(v, locale)} /></div>
        <div className="econ-panel"><h3>{t('Sales by account', 'فروش به تفکیک حساب')[locale]}</h3>
          {s.byAccount.length ? <div className="econ-list">{s.byAccount.map(b => <div key={b.plan + b.sizeUsd}><span dir="ltr">{b.plan} · {usd(b.sizeUsd, locale, 0)}</span><span>{int(b.orders, locale)} · {usd(b.grossUsd, locale)}</span></div>)}</div> : <p className="econ-empty">{t('No confirmed sales yet.', 'هنوز فروش تأییدشده‌ای ثبت نشده است.')[locale]}</p>}
        </div>
      </div>
      <Source locale={locale}>{s.source}</Source>
    </section>

    <section className="econ-section" id="challenges"><div className="section-top"><div><span className="eyebrow">02 / {t('CHALLENGE STATISTICS', 'آمار چلنج‌ها')[locale]}</span><h2>{t('Outcomes from the evaluation engine.', 'نتایج از موتور ارزیابی.')[locale]}</h2></div><Link className="text-link" to={`/${locale}/rulebook`}>{labels.rulebook[locale]} ↗</Link></div>
      <div className="econ-grid">
        <Kpi label={t('Accounts created', 'حساب‌های ایجادشده')[locale]} value={int(c.accountsCreated, locale)} note={`${int(c.active, locale)} ${t('active', 'فعال')[locale]}`} />
        <Kpi label={t('Final evaluations passed', 'ارزیابی‌های نهایی قبول‌شده')[locale]} value={int(c.finalEvaluationsPassed, locale)} note={`${t('Failed', 'مردود')[locale]} ${int(c.failed, locale)} · ${t('Expired', 'منقضی')[locale]} ${int(c.expired, locale)}`} />
        <Kpi label={t('Funded simulated accounts', 'حساب‌های فاندد شبیه‌سازی‌شده')[locale]} value={int(c.fundedSimulated, locale)} note={backendText(locale, c.fundedDefinition)} />
        <Kpi label={t('Accounts with a paid withdrawal', 'حساب‌های دارای برداشت پرداخت‌شده')[locale]} value={int(c.accountsWithPayout, locale)} note={`${int(c.paidWithdrawals.count, locale)} · ${usd(c.paidWithdrawals.totalUsd, locale)}`} />
      </div>
      <div className="econ-grid three" style={{ marginTop: 14 }}>
        <Kpi label={t('Phase 1 pass rate', 'نرخ قبولی مرحلهٔ ۱')[locale]} value={pct(c.phase1PassRate, locale)} note={`n = ${int(c.phase1Completed, locale)}`} />
        <Kpi label={t('Phase 2 pass rate', 'نرخ قبولی مرحلهٔ ۲')[locale]} value={pct(c.phase2PassRate, locale)} note={`n = ${int(c.phase2Completed, locale)}`} />
        <Kpi label={t('First payout rate', 'نرخ اولین برداشت')[locale]} value={pct(c.firstPayoutRate, locale)} note={`n = ${int(c.fundedSimulated, locale)}`} />
      </div>
      <p className="econ-source">{backendText(locale, c.rateDefinitions)}</p><Source locale={locale}>{c.source}</Source>
    </section>

    <section className="econ-section" id="payouts"><div className="section-top"><div><span className="eyebrow">03 / {t('TRADER PAYOUTS', 'پرداخت به معامله‌گران')[locale]}</span><h2>{t('Approved is not paid.', 'تأییدشده یعنی هنوز پرداخت نشده.')[locale]}</h2></div></div>
      <div className="econ-grid">
        <Kpi label={t('Paid (transfer recorded)', 'پرداخت‌شده (انتقال ثبت‌شده)')[locale]} value={usd(p.paid.totalUsd, locale)} tone="good" note={`${int(p.paid.count, locale)} ${t('payouts', 'پرداخت')[locale]} · ${int(p.uniqueRecipients, locale)} ${t('recipients', 'دریافت‌کننده')[locale]}`} />
        <Kpi label={t('Approved, awaiting transfer', 'تأییدشده، در انتظار انتقال')[locale]} value={usd(p.approvedAwaitingTransfer.totalUsd, locale)} tone="warn" note={`${int(p.approvedAwaitingTransfer.count, locale)}`} />
        <Kpi label={t('Requested, under review', 'درخواست‌شده، در حال بررسی')[locale]} value={usd(p.requestedUnderReview.totalUsd, locale)} note={`${int(p.requestedUnderReview.count, locale)}`} />
        <Kpi label={t('Paid ÷ net revenue', 'پرداخت ÷ درآمد خالص')[locale]} value={pct(p.payoutToNetRevenue, locale)} note={`${t('Average per recipient', 'میانگین هر دریافت‌کننده')[locale]} ${usd(p.averagePerRecipientUsd, locale)}`} />
      </div>
      <div className="econ-grid two" style={{ marginTop: 16 }}>
        <div className="econ-panel"><h3>{t('Monthly paid rewards', 'پاداش پرداخت‌شدهٔ ماهانه')[locale]}</h3><Bars locale={locale} label="USD" points={p.monthly.map(m => ({ key: m.month, value: Number(m.totalUsd) }))} format={v => usd(v, locale)} /></div>
        <div className="econ-panel"><h3>{t('On-chain payout transactions', 'تراکنش‌های آن‌چین پرداخت')[locale]}</h3>
          {p.transactions.length ? <div className="econ-list">{p.transactions.map((x, i) => <div key={i}><span>{day(x.at, locale)} · {usd(x.amountUsd, locale)}</span><span>{x.explorerUrl ? <a className="text-link" href={x.explorerUrl} target="_blank" rel="noopener noreferrer">{t('Explorer', 'کاوشگر')[locale]} ↗</a> : '—'}</span></div>)}</div> : <p className="econ-empty">{t('No payout with an on-chain transaction reference yet.', 'هنوز پرداختی با مرجع تراکنش آن‌چین ثبت نشده است.')[locale]}</p>}
          <p className="econ-source">{t('Recipients are not identified. Only date, amount and the public transaction are listed.', 'دریافت‌کنندگان معرفی نمی‌شوند؛ فقط تاریخ، مبلغ و تراکنش عمومی آمده است.')[locale]}</p></div>
      </div>
      <Source locale={locale}>{p.source}</Source>
    </section>

    <section className="econ-section" id="treasury"><div className="section-top"><div><span className="eyebrow">04 / OPENFUND TREASURY</span><h2>{t('Read from the chain, not typed in.', 'خوانده‌شده از زنجیره، نه واردشده با دست.')[locale]}</h2></div></div>
      <TreasuryWallets locale={locale} />
      <Treasury tv={r.treasury} locale={locale} />
      <div className="econ-panel"><h3>{t('Identifiable flows', 'جریان‌های قابل شناسایی')[locale]}</h3><div className="econ-grid">
        <Kpi label={t('Verified payments into treasury', 'پرداخت‌های تأییدشده به خزانه')[locale]} value={r.flows.inflows ? usd(r.flows.inflows.totalUsd, locale) : '—'} note={r.flows.inflows ? `${int(r.flows.inflows.verifiedPayments, locale)}` : t('Treasury not configured', 'خزانه پیکربندی نشده')[locale]} />
        <Kpi label={t('Trader rewards paid', 'پاداش پرداخت‌شده')[locale]} value={usd(r.flows.outflows.traderRewardsUsd, locale)} />
        <Kpi label={t('Commissions & live settlements', 'کمیسیون و تسویهٔ معاملات واقعی')[locale]} value={usd(Number(r.flows.outflows.ambassadorCommissionsUsd) + Number(r.flows.outflows.liveSettlementsUsd), locale)} />
        <Kpi label={t('Expenses & refunds paid', 'هزینه و بازپرداخت')[locale]} value={usd(Number(r.flows.outflows.expensesUsd) + Number(r.flows.outflows.refundsUsd), locale)} />
      </div><p className="econ-source">{backendText(locale, r.flows.outflows.definition)}</p></div>
    </section>

    <section className="econ-section" id="position"><div className="section-top"><div><span className="eyebrow">05 / {t('FINANCIAL POSITION', 'وضعیت مالی')[locale]}</span><h2>{t('Three numbers, never merged.', 'سه عدد، هرگز ادغام‌نشده.')[locale]}</h2></div>{pos.status === 'verified' ? <Status kind="ok">{t('Verified inputs', 'ورودی‌های تأییدشده')[locale]}</Status> : <Status kind="warn">{t('Unknown / Not verified', 'نامعلوم / تأییدنشده')[locale]}</Status>}</div>
      <div className="econ-grid three">
        <Kpi label={t('Gross Treasury Balance', 'موجودی ناخالص خزانه')[locale]} value={usd(pos.grossTreasuryUsd, locale)} />
        <Kpi label={t('Outstanding Financial Obligations', 'تعهدات مالی معوق')[locale]} value={usd(pos.outstandingObligationsUsd, locale)} tone="warn" note={`${t('Reserves', 'ذخایر')[locale]} ${usd(pos.reservesUsd, locale)} · ${t('Allocated', 'تخصیص‌یافته')[locale]} ${usd(pos.allocatedCapitalUsd, locale)}`} />
        <Kpi label={t('Available Allocatable Capital', 'سرمایهٔ قابل تخصیص موجود')[locale]} value={pos.status === 'verified' ? usd(pos.availableAllocatableUsd, locale) : t('Unknown', 'نامعلوم')[locale]} tone={pos.status === 'verified' ? 'good' : undefined} />
      </div>
      <div className="econ-grid two" style={{ marginTop: 16 }}>
        <div className="econ-panel"><h3>{t('Obligations', 'تعهدات')[locale]}</h3><div className="econ-list">
          {([['traderRewardsApprovedUnpaid', t('Trader rewards approved, unpaid', 'پاداش تأییدشدهٔ پرداخت‌نشده')], ['ambassadorCommissionsUnpaid', t('Ambassador commissions unpaid', 'کمیسیون پرداخت‌نشدهٔ سفیران')], ['liveProfitSharesUnsettled', t('Live profit shares unsettled', 'سهم سود تسویه‌نشده')], ['expensesPayable', t('Verified expenses payable', 'هزینه‌های تأییدشدهٔ پرداخت‌نشده')], ['otherLiabilities', t('Other liabilities', 'سایر بدهی‌ها')]] as const).map(([k, label]) => <div key={k}><span>{label[locale]}</span><span>{usd(pos.obligations[k], locale)}</span></div>)}
          <div><span>{t('Operational / risk / other reserves', 'ذخایر عملیاتی / ریسک / سایر')[locale]}</span><span>{usd(pos.reserves.operational, locale)} / {usd(pos.reserves.risk, locale)} / {usd(pos.reserves.other, locale)}</span></div>
        </div></div>
        <div className="econ-panel"><h3>{t('Formula and status', 'فرمول و وضعیت')[locale]}</h3><p className="econ-source" dir="ltr">{pos.formula}</p>
          {pos.missing.length > 0 && <ul className="econ-check-list" style={{ marginTop: 12 }}>{pos.missing.map(m => <li key={m}>{(MISSING[m]?.[locale] ?? m)}</li>)}</ul>}
          <p className="econ-source">{t('Calculated', 'محاسبه')[locale]} {when(pos.calculatedAt, locale)}</p></div>
      </div>
    </section>

    <section className="econ-section" id="expenses"><div className="section-top"><div><span className="eyebrow">06 / {t('COMPANY EXPENSES', 'هزینه‌های شرکت')[locale]}</span><h2>{t('Invoices, not estimates.', 'فاکتور، نه برآورد.')[locale]}</h2></div><p>{int(r.expenses.awaitingVerification, locale)} {t('records awaiting verification', 'رکورد در انتظار تأیید')[locale]}</p></div>
      <div className="econ-grid">{r.expenses.categories.map(cat => <Kpi key={cat.category} label={(CATEGORY[cat.category]?.[locale] ?? cat.category)} value={usd(cat.totalUsd, locale)} note={`${int(cat.records, locale)} ${t('verified records', 'رکورد تأییدشده')[locale]}`} />)}</div>
      {r.expenses.records.length > 0 && <div className="info-table-wrap"><table><caption>{t('Verified expense records', 'رکوردهای تأییدشدهٔ هزینه')[locale]}</caption><thead><tr>{[t('Date', 'تاریخ'), t('Category', 'دسته'), t('Description', 'شرح'), t('Amount', 'مبلغ'), t('Source / reference', 'منبع / مرجع'), t('Status', 'وضعیت')].map((h, i) => <th key={i} scope="col">{h[locale]}</th>)}</tr></thead>
        <tbody>{r.expenses.records.map((e, i) => <tr key={i}><td>{day(e.incurredOn, locale)}</td><td>{(CATEGORY[e.category]?.[locale] ?? e.category)}</td><td>{e.description}</td><td dir="ltr">{e.amount} {e.currency}{e.currency !== 'USD' ? ` (${usd(e.amountUsd, locale)})` : ''}</td><td dir="ltr">{e.source} · {e.reference}</td><td>{e.paymentStatus}</td></tr>)}</tbody></table></div>}
      <Source locale={locale}>{r.expenses.source}</Source>
    </section>
  </>
}

export default function Transparency() {
  const locale = useInformationLocale()
  const [state] = useRemote<TransparencyReport>('/economy/transparency')
  return <InformationShell page="transparency" description={transparencyIntro[locale]}>
    <Hero locale={locale} page="transparency" title={t('Openfund economy,', 'اقتصاد اوپن‌فاند،')[locale]} accent={t('in verifiable numbers.', 'با اعداد قابل راستی‌آزمایی.')[locale]} intro={transparencyIntro[locale]}>
      <EconomyNav locale={locale} current="transparency" />
    </Hero>
    <div className="container">
      <aside className="info-notice"><span className="tiny-mark" aria-hidden="true">◇</span><p>{t('Every figure below is computed by the backend from operational records (confirmed payments, the evaluation engine, withdrawal reviews, on-chain treasury reads and verified invoices) and refreshed at most every five minutes. Missing inputs are shown as Unknown, never estimated. Customer identities are never published.', 'همهٔ اعداد زیر را بک‌اند از سوابق عملیاتی (پرداخت‌های تأییدشده، موتور ارزیابی، بررسی برداشت‌ها، خوانش آن‌چین خزانه و فاکتورهای تأییدشده) محاسبه می‌کند و حداکثر هر پنج دقیقه تازه می‌شوند. ورودی ناموجود «نامعلوم» نمایش داده می‌شود و هرگز برآورد نمی‌شود. هویت مشتریان منتشر نمی‌شود.')[locale]}</p></aside>
      {state.status === 'ready' ? <Report r={state.data} locale={locale} /> : <StateBlock state={state} locale={locale} />}
      <section className="econ-section" id="infrastructure"><div className="section-top"><div><span className="eyebrow">07 / {t('TRADING INFRASTRUCTURE', 'زیرساخت معاملاتی')[locale]}</span><h2>{t('Four layers. Clear responsibilities.', 'چهار لایه. مسئولیت‌های روشن.')[locale]}</h2></div></div><div className="infrastructure-grid">{infrastructure.map(layer => <article className="model-card" key={layer.code}><span className="eyebrow" dir="ltr">{layer.code}</span><h3>{layer.title[locale]}</h3><span className="pill status-current">{labels.current[locale]}</span><p>{layer.body[locale]}</p></article>)}</div></section>
      <div className="info-end"><img src={`${import.meta.env.BASE_URL}assets/mark-mint.svg`} width="38" height="42" alt="" /><p>{t('Clarity is a practice, not a claim.', 'شفافیت را باید ساخت و نشان داد.')[locale]}</p><Link className="button" to={`/${locale}/revenue-model`}>{labels['revenue-model'][locale]} <span aria-hidden="true">↗</span></Link></div>
    </div>
  </InformationShell>
}
