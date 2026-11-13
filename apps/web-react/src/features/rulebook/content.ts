import { pick } from '../../i18n/locales'
import { text as t, number as n, type Localized } from '../information/content'
import { publishedPlans, type ChallengePlan, type RewardCycle } from '../../data/challengePlans'
import { PROP_LEVERAGE_CEILINGS as L } from '../../data/leveragePolicy'
import { LOCALES, type AppLocale } from '../../i18n/locales'

export interface RuleTable { caption: Localized; columns: Localized[]; rows: Localized[][] }
export interface RuleSection {
  id: string; title: Localized; status: 'current' | 'draft' | 'planned'
  paragraphs: Localized[]; formula?: string; table?: RuleTable
  explanation?: { title: Localized; body: Localized }
}

/* One source of truth: every plan number below derives from the same
   challenge catalog that renders the landing builder, the comparison table
   and the FAQ (src/data/challengePlans.ts), so the Rulebook can never
   disagree with another page. */
const plans = publishedPlans()
const byslug = (slug: string) => plans.find(p => p.slug === slug)!
const standard = byslug('standard')
const one = byslug('one-phase')
const instant = byslug('instant')
const trial = byslug('free-trial')

const pct = (locale: import('../../i18n/locales').AppLocale, v: number) => `${n(v, locale)}${pick(locale, '٪', '%')}`
const money = (locale: import('../../i18n/locales').AppLocale, v: number) => locale === 'fa' ? n(v, locale) : `$${n(v, locale)}`
/* a table cell rendered from catalog values in every locale (labels via t()) */
const cellOf = (render: (locale: AppLocale) => string): Localized => Object.fromEntries(LOCALES.map(l => [l, render(l)])) as unknown as Localized
const cycleName = (c: RewardCycle) => ({ weekly: t('Weekly', 'هفتگی'), biweekly: t('Bi-weekly', 'دوهفته‌ای'), on_demand: t('On demand', 'درخواستی') })[c.key]
const cyclesCell = (p: ChallengePlan) => cellOf(l => p.rewardCycles.length ? p.rewardCycles.map(c => `${cycleName(c)[l]} ${pct(l, c.splitPct)}`).join(' · ') : t('None', 'ندارد')[l])
const dailyCell = (p: ChallengePlan) => cellOf(l => pct(l, p.dailyLossPct) + (p.dailyLossVariantPriceUsd && p.dailyLossPctAlt ? ` (${t('or', 'یا')[l]} ${pct(l, p.dailyLossPctAlt)})` : ''))
const onDemand = standard.rewardCycles.find(c => c.key === 'on_demand')!
const ik = instant.conduct
const fn = standard.conduct.news!
const sizesList = (locale: import('../../i18n/locales').AppLocale, sizes: number[]) => sizes.map(s => n(s, locale)).join(' / ')

export const rulebookIntro = t(
  'The complete terms of the Openfund challenges — targets, loss limits, reward sharing and the free trial — plus a clear account of what already works today.',
  'شرایط کامل چلنج‌های اوپن‌فاند — اهداف، سقف‌های ضرر، تقسیم سود و تست رایگان — به‌همراه توضیح روشن از امکاناتِ امروز.'
)
export const rulebookNotice = t(
  'These are the published challenge terms of record. The server enforces them on every challenge account: evaluation targets and loss limits, conduct rules, the funded-account review and reward eligibility. Rewards are paid manually after review; legal terms of service are being finalized.',
  'این‌ها شرایط منتشرشده و مرجع چلنج‌های اوپن‌فاند هستند. سرور آن‌ها را روی هر حساب چلنج اعمال می‌کند: اهداف و سقف‌های ضرر ارزیابی، قوانین رفتار حساب، بررسی حساب فاندشده و شرایط پاداش. پاداش‌ها پس از بررسی به‌صورت دستی پرداخت می‌شوند؛ شرایط حقوقی خدمات در حال نهایی‌شدن است.',
)
export const ruleSections: RuleSection[] = [
  { id: 'overview', title: t('Overview', 'نگاه کلی'), status: 'current', paragraphs: [
    t('Openfund brings live market data, a trading workspace and simulated account records into one experience. The current trading environment uses virtual funds — demo profits are not money owed to the trader.', 'اوپن‌فاند دادهٔ زندهٔ بازار، فضای معاملاتی و سوابق حساب شبیه‌سازی‌شده را در یک تجربه کنار هم می‌آورد. محیط معاملاتی فعلی با موجودی مجازی کار می‌کند — سود دمو، طلب مالی معامله‌گر از پلتفرم نیست.'),
    t('This page is the complete reference for the challenge terms: three purchasable models and a free trial, with every target, loss limit, reward split and condition in one place. Challenge purchases, live evaluation and challenge trading are operational in this release; funded-account payouts and the production payment activation are stated as pending, never implied.', 'این صفحه مرجع کامل شرایط چلنج‌هاست: سه مدل خریدنی و یک تست رایگان، با همهٔ اهداف، سقف‌های ضرر، سهم‌های سود و شرایط در یک جا. خرید چلنج، ارزیابی زنده و معاملهٔ چالش در این نسخه عملیاتی است؛ پرداخت‌های حساب فاندشده و فعال‌سازی پرداخت تولید، صریحاً «در انتظار» اعلام می‌شود، نه القایی.'),
  ] },
  { id: 'how-it-works', title: t('How the evaluation works', 'ارزیابی چگونه پیش می‌رود؟'), status: 'current', paragraphs: [
    t('The path: choose a challenge model, pay the published fee, start the evaluation and demonstrate performance against the published objectives, then trade a funded account under the reward agreement. The Instant model skips evaluation entirely and starts at the funded stage.',
      'مسیر ساده است: مدل چلنج را انتخاب می‌کنی، هزینهٔ منتشرشده را می‌پردازی، ارزیابی را شروع می‌کنی و عملکردت را در چارچوب اهداف منتشرشده نشان می‌دهی و سپس طبق قرارداد پاداش، در حساب فاندشده معامله می‌کنی. مدل «آنی» ارزیابی را کامل رد می‌کند و از همان مرحلهٔ فاندشده شروع می‌شود.'),
    t('Today, connect a wallet and trade the free practice account in the terminal, or purchase a challenge and trade it under the full rules of this page. Signing in alone does not purchase a challenge and does not prove an evaluation has been passed.',
      'امروز می‌توانی کیف پول را وصل کنی و حساب تمرینی رایگان را در ترمینال معامله کنی، یا چلنج بخری و طبق کامل قواعد همین صفحه معامله‌اش کنی. ورود به حساب به‌تنهایی، خرید چلنج نیست و اثبات قبولی هم نیست.'),
  ] },
  { id: 'terminology', title: t('Account terminology', 'واژه‌های حساب و ارزیابی'), status: 'current', paragraphs: [
    t('Keep account accounting separate from evaluation status: an account record can exist even while evaluation rules are not active.', 'حسابداری حساب را از وضعیت ارزیابی جدا نگه دار؛ ممکن است سابقهٔ حساب وجود داشته باشد در حالی که قواعد ارزیابی فعال نیست.'),
  ], table: { caption: t('A shared vocabulary', 'واژه‌نامهٔ مشترک'), columns: [t('Term', 'اصطلاح'), t('Meaning', 'معنی')], rows: [
    [t('Trading challenge', 'چلنج معاملاتی'), t('A structured evaluation with a published profit target and loss limits.', 'ارزیابی ساختاریافته با هدف سود و سقف‌های ضررِ منتشرشده.')],
    [t('Instant challenge', 'چلنج آنی'), t('A model with no evaluation phase — the funded stage starts on day one.', 'مدلی بدون مرحلهٔ ارزیابی — مرحلهٔ فاندشده از روز اول آغاز می‌شود.')],
    [t('Free trial', 'تست رایگان'), t('A time-limited rehearsal of the challenge rules with no fee and no reward.', 'تمرینِ زمان‌محدودِ قواعد چلنج، بدون هزینه و بدون پاداش.')],
    [t('Demo account', 'حساب دمو'), t('A virtual trading account; it holds no customer deposit.', 'حساب معاملاتی مجازی؛ سپردهٔ مشتری نگهداری نمی‌کند.')],
    [t('Phase', 'مرحله'), t('One assessment step in a two-phase or one-phase challenge.', 'یک گام سنجش در چلنج دومرحله‌ای یا تک‌مرحله‌ای.')],
    [t('Funded account', 'حساب فاندشده'), t('The payout stage of a passed challenge, under the reward agreement.', 'مرحلهٔ برداشتِ چلنجِ قبول‌شده، طبق قرارداد پاداش.')],
    [t('Breach', 'نقض'), t('Touching a loss limit; closes the account under the agreement.', 'لمسِ سقف ضرر؛ طبق قرارداد، حساب را می‌بندد.')],
  ] } },
  { id: 'configurations', title: t('Challenge configurations', 'ترکیب‌های چلنج'), status: 'draft', paragraphs: [
    t('The four configurations below are the published product structure — the same catalog that renders the landing builder and the comparison table. Terms are conditions of the challenge; fee values are the published nominal prices.', 'ترکیب‌های چهارگانهٔ زیر ساختار منتشرشدهٔ محصول‌اند — همان فهرستی که حساب‌ساز و جدول مقایسهٔ صفحهٔ چلنج‌ها را می‌سازد. شرایط، شرایطِ همان چلنج‌اند و مبالغ، قیمت‌های اسمی منتشرشده.'),
    t('The authenticated demo that runs today is separate: it allocates 100,000 virtual DAI once per user, with no deposits, withdrawals, refills or resets.', 'دموی فعالِ امروز جداست: یک‌بار به هر کاربر ۱۰۰٬۰۰۰ دای مجازی اختصاص می‌دهد؛ بدون واریز، برداشت، شارژ مجدد و بازنشانی.'),
  ], table: { caption: t('Published challenge catalog', 'فهرست منتشرشدهٔ چلنج‌ها'), columns: [t('Challenge', 'چلنج'), t('Sizes · USD', 'اندازه‌ها · دلار'), t('Phases · target', 'مراحل · هدف'), t('Daily / total loss', 'سقف ضرر روزانه / کل'), t('Reward share', 'سهم سود')], rows:
    plans.map(p => [
      p.name,
      t(sizesList('en', p.accountSizesUsd), sizesList('fa', p.accountSizesUsd)),
      p.phases === 0 ? t('—', 'بدون مرحله') : t(`${p.phases} · ${p.phase1TargetPct}${p.phase2TargetPct != null ? ` + ${p.phase2TargetPct}` : ''}%`, `${n(p.phases, 'fa')} · ${pct('fa', p.phase1TargetPct!)}${p.phase2TargetPct != null ? ` + ${pct('fa', p.phase2TargetPct)}` : ''}`),
      t(`${pct('en', p.dailyLossPct)} / ${pct('en', p.maxTotalLossPct)}${p.drawdownMode === 'trailing' ? ' trailing' : ''}`, `${pct('fa', p.dailyLossPct)} / ${pct('fa', p.maxTotalLossPct)}${p.drawdownMode === 'trailing' ? ' شناور' : ''}`),
      p.free ? t('None (trial)', 'ندارد (تست)') : t(`${pct('en', p.profitSplitPct)}${p.profitSplitMonthlyPct ? ` · ${pct('en', p.profitSplitMonthlyPct)} monthly` : ''}`, `${pct('fa', p.profitSplitPct)}${p.profitSplitMonthlyPct ? ` · ${pct('fa', p.profitSplitMonthlyPct)} ماهانه` : ''}`),
    ])
  } },
  { id: 'stages', title: t('Evaluation stages', 'مراحل ارزیابی'), status: 'draft', paragraphs: [
    t(`Standard runs two phases: an ${pct('en', standard.phase1TargetPct!)} evaluation followed by a ${pct('en', standard.phase2TargetPct!)} verification phase. One-phase has a single ${pct('en', one.phase1TargetPct!)} target. Instant has no phases at all. A completed demo trade does not advance any path.`,
      `«استاندارد» دو مرحله دارد: ارزیابیِ ${pct('fa', standard.phase1TargetPct!)} و سپس مرحلهٔ تأییدِ ${pct('fa', standard.phase2TargetPct!)}. «تک‌مرحله‌ای» فقط یک هدف ${pct('fa', one.phase1TargetPct!)} دارد. «آنی» اصلاً مرحله ندارد. انجام معاملهٔ دمو هیچ مسیری را جلو نمی‌برد.`),
    t('Stage transitions, pass detection and breach settlement are automated: the evaluation engine runs on every trade, every mark update and the day boundary, and each transition is recorded in the challenge’s immutable event history. Funded-account provisioning and payouts activate with the commercial launch.',
      'انتقال مراحل، تشخیص قبولی و تسویهٔ نقض خودکار است: موتور ارزیابی روی هر معامله، هر به‌روزرسانی قیمت مرجع و مرز روز اجرا می‌شود و هر گذار در تاریخچهٔ رویداد تغییرناپذیر چالش ثبت می‌گردد. تأمین حساب فاندشده و پرداخت‌ها با عرضهٔ تجاری فعال می‌شوند.'),
  ] },
  { id: 'targets', title: t('Profit targets', 'هدف سود'), status: 'draft', paragraphs: [
    t(`Published targets: ${pct('en', standard.phase1TargetPct!)} then ${pct('en', standard.phase2TargetPct!)} on Standard, a single ${pct('en', one.phase1TargetPct!)} on One-phase, and no target on Instant. Targets are measured on closed net profit — open positions do not count until realized. There is no target once funded.`,
      `اهداف منتشرشده: ${pct('fa', standard.phase1TargetPct!)} و سپس ${pct('fa', standard.phase2TargetPct!)} در «استاندارد»، یک هدف ${pct('fa', one.phase1TargetPct!)} در «تک‌مرحله‌ای» و بدون هدف در «آنی». اهداف با سود خالصِ معاملات بسته‌شده سنجیده می‌شوند — موقعیت باز تا محقق‌نشده حساب نمی‌شود. در مرحلهٔ فاندشده هدف وجود ندارد.`),
    t('The engine enforces targets on closed net profit, together with the minimum trading-day requirement, on every challenge account; reaching the target completes the phase and the stage transition is recorded automatically.', 'موتور اهداف را همراه با شرط حداقل روزهای معاملاتی، روی سود خالصِ معاملات بسته‌شده در هر حساب چالش اعمال می‌کند؛ رسیدن به هدف، مرحله را کامل می‌کند و گذار مرحله به‌طور خودکار ثبت می‌شود.'),
  ], formula: 'Illustrative target amount = starting balance × target rate', explanation: {
    title: t('Read an example without treating it as a rule', 'مثال را با قانون نهایی اشتباه نگیر'),
    body: t('An 8% target on a 10,000-unit account means an 800-unit objective. The arithmetic explains the concept; the pass criteria of record are the ones on this page.', 'هدف ۸٪ برای حساب ۱۰٬۰۰۰ واحدی یعنی هدفِ ۸۰۰ واحدی. محاسبه مفهوم را روشن می‌کند؛ معیار قبولیِ مرجع، همین‌های این صفحه‌اند.'),
  } },
  { id: 'daily-loss', title: t('Daily loss limit', 'سقف ضرر روزانه'), status: 'draft', paragraphs: [
    t(`The daily limit is ${pct('en', standard.dailyLossPct)} on Standard (with a ${pct('en', standard.dailyLossPctAlt!)} configuration), ${pct('en', one.dailyLossPct)} on One-phase (or ${pct('en', one.dailyLossPctAlt!)}) and ${pct('en', instant.dailyLossPct)} on Instant. It is measured against the higher of the day’s opening balance or opening equity, and resets at 00:00 UTC+3. Touching it once is a breach — a recovering trade does not undo it.`,
      `سقف روزانه در «استاندارد» ${pct('fa', standard.dailyLossPct)} است (با پیکربندی ${pct('fa', standard.dailyLossPctAlt!)}، در «تک‌مرحله‌ای» ${pct('fa', one.dailyLossPct)} (یا ${pct('fa', one.dailyLossPctAlt!)}) و در «آنی» ${pct('fa', instant.dailyLossPct)}. مبنای محاسبه، بزرگ‌ترِ موجودی یا ارزش خالصِ ابتدای روز است و ساعت ۰۰:۰۰ (UTC+3) بازنشانی می‌شود. یک بار لمسِ آن نقض است — بازیابیِ معامله آن را به‌عقب نمی‌گرداند.`),
    t('This limit is enforced live by the server on every challenge account: when equity touches the threshold, positions are settled at the server mark, trading stops on that account, and the violation is recorded in the immutable challenge history. The free practice account keeps the margin-and-liquidation risk model.',
      'این سقف توسط سرور روی هر حساب چالش به‌صورت زنده اعمال می‌شود: با لمس آستانه از سوی ارزش خالص، موقعیت‌ها با قیمت مرجع سرور تسویه می‌شوند، معامله روی همان حساب متوقف و نقض در تاریخچهٔ تغییرناپذیر چالش ثبت می‌شود. حساب تمرینی رایگان همچنان از مدل ریسک وجه تضمین و لیکوییدیشن پیروی می‌کند.'),
  ] },
  { id: 'maximum-loss', title: t('Maximum loss limit', 'سقف ضرر کل'), status: 'draft', paragraphs: [
    t(`The total limit is ${pct('en', standard.maxTotalLossPct)} static on Standard and ${pct('en', one.maxTotalLossPct)} static on One-phase: equity must never fall that far below the starting size, in any phase and on the funded account. On Instant it is ${pct('en', instant.maxTotalLossPct)} trailing — it follows the highest recorded equity and locks at breakeven once the account is ${pct('en', instant.trailingLockAtProfitPct!)} in profit; it does not reset after a reward.`,
      `سقف کل در «استاندارد» ${pct('fa', standard.maxTotalLossPct)} ثابت و در «تک‌مرحله‌ای» ${pct('fa', one.maxTotalLossPct)} ثابت است: ارزش خالص نباید در هیچ مرحله‌ای — و در حساب فاندشده — این‌قدر زیر اندازهٔ شروع برود. در «آنی» ${pct('fa', instant.maxTotalLossPct)} شناور است — بالاترین ارزش خالصِ ثبت‌شده را دنبال می‌کند و وقتی حساب ${pct('fa', instant.trailingLockAtProfitPct!)} سود کرد، در نقطهٔ سربه‌سر قفل می‌شود؛ پس از برداشت بازنشانی نمی‌شود.`),
    t('Loss limits count equity — unrealized losses move you toward the boundary in real time. On the funded account of the Instant model, floating losses are additionally capped and the first slice of profit is not payout-eligible (see Payouts).', 'سقف‌ها مبنای اکوییتی دارند — زیان شناور بلافاصله به مرز نزدیک می‌کند. در حساب فاندشدهٔ مدل «آنی»، زیان شناور سقف جداگانه‌ای دارد و نخستین بخشِ سود نیز مشمول برداشت نیست (بخش برداشت را ببین).'),
  ] },
  { id: 'equity-balance', title: t('Equity, balance and margin', 'ارزش خالص، موجودی و وجه تضمین'), status: 'current', paragraphs: [
    t('Balance reflects virtual funding and realized ledger changes, including charged fees. Equity adds the unrealized PnL of open positions. Used margin reserves capacity for positions without reducing the balance itself.', 'موجودی، تأمین مجازی و تغییرات تحقق‌یافتهٔ دفتر حساب — از جمله کارمزدهای کسرشده — را نشان می‌دهد. ارزش خالص، سود و زیان شناور موقعیت‌های باز را به آن می‌افزاید. وجه تضمینِ مصرف‌شده ظرفیت موقعیت‌ها را رزرو می‌کند و خودِ موجودی را کاهش نمی‌دهد.'),
    t('The authenticated server account is authoritative. Portfolio analytics summarize its trade records; the public sample dashboard is independent of your account.', 'برای حساب احرازشده، سوابق سرور مرجع‌اند. تحلیل پرتفوی همین سوابق را خلاصه می‌کند؛ داشبورد عمومیِ نمونه مستقل از حساب توست.'),
  ], formula: 'Equity = balance + Σ unrealized PnL\nFree margin = balance − used margin', explanation: {
    title: t('Why equity can move before a trade closes', 'چرا ارزش خالص پیش از بستن معامله تغییر می‌کند؟'),
    body: t('With a balance of 100,000 and unrealized PnL of −700, equity is 99,300. Closing the position realizes the PnL and applies the closing fee; the displayed unrealized figure alone is not the final net result.', 'با موجودی ۱۰۰٬۰۰۰ و زیان شناور ۷۰۰، ارزش خالص ۹۹٬۳۰۰ است. بستن موقعیت سود یا زیان را محقق و کارمزد خروج را اعمال می‌کند؛ عدد شناور به‌تنهایی نتیجهٔ خالص نهایی نیست.'),
  } },
  { id: 'violations', title: t('Rule violations and account status', 'نقض قواعد و وضعیت حساب'), status: 'draft', paragraphs: [
    t('Touching the daily or total loss limit is a breach: positions close, trading stops on that account and the eligible profit of the period is not withdrawable. A trial breach closes the trial immediately. This enforcement is live on every challenge account; appeals, resets and termination follow the final versioned agreement to be published before launch.',
      'لمسِ سقف ضرر روزانه یا کل، نقض است: موقعیت‌ها بسته می‌شوند، معامله روی همان حساب متوقف می‌شود و سود واجدشرایطِ آن دوره قابل برداشت نیست. نقض در تست رایگان، همان لحظه تست را می‌بندد. این اعمال روی هر حساب چالش زنده است؛ اعتراض، بازنشانی و خاتمه طبق قرارداد نسخه‌داری می‌شود که پیش از عرضه منتشر خواهد شد.'),
  ] },
  { id: 'conditions', title: t('Trading conditions', 'شرایط معامله'), status: 'current', paragraphs: [
    t('The authenticated demo supports market, limit and stop orders, long and short positions, stop-loss and take-profit updates, closing and simulated liquidation. Fresh server marks drive execution; fills are simulations.', 'دموی پس از ورود از سفارش بازار، لیمیت و استاپ، موقعیت خرید و فروش، تغییر حد ضرر و حد سود، بستن موقعیت و لیکوییدشدن شبیه‌سازی‌شده پشتیبانی می‌کند. قیمت تازهٔ سرور مبنای اجراست و معاملات شبیه‌سازی می‌شوند.'),
    t('The documented model uses fee and spread assumptions per asset class; it does not simulate liquidity impact, funding or borrowing costs. Demo results cannot establish live execution quality.', 'مدل مستند برای کارمزد و اسپرد بر اساس دستهٔ دارایی فرض‌هایی دارد؛ اثر نقدینگی، هزینهٔ تأمین مالی و استقراض شبیه‌سازی نمی‌شود. نتیجهٔ دمو کیفیت اجرای واقعی را اثبات نمی‌کند.'),
    t('Overnight, weekend and news: evaluation accounts are not restricted. Funded Standard and One-phase accounts and every Instant account follow the funded-account and conduct rules below.', 'نگهداری شبانه، آخر هفته و هنگام اخبار: حساب‌های ارزیابی محدودیتی ندارند. حساب‌های فاندشدهٔ «استاندارد» و «تک‌مرحله‌ای» و همهٔ حساب‌های «آنی» از قوانین حساب فاندشده و قوانین رفتار حساب در ادامه پیروی می‌کنند.'),
  ] },
  { id: 'markets', title: t('Available markets', 'بازارهای در دسترس'), status: 'current', paragraphs: [
    t('The application loads market metadata and marks from Gains Network. Instruments are grouped into crypto, forex, stocks, indices and commodities — browse the full directory on the Markets page. The available list and each market’s status can change.', 'برنامه مشخصات بازار و قیمت مرجع را از Gains Network می‌خواند. ابزارها به رمزارز، فارکس، سهام، شاخص و کالا دسته‌بندی می‌شوند — فهرست کامل را در صفحهٔ «بازارها» ببین. فهرست در دسترس و وضعیت هر بازار می‌تواند تغییر کند.'),
    t('Check the terminal for the current instrument and trading status. A market-data listing is not a guarantee of availability under a future paid plan or evidence of real on-chain execution.', 'نماد و وضعیت فعلی معامله را در ترمینال بررسی کن. حضور در فهرست داده، تضمین دسترسی در پلن پولی آینده یا مدرک اجرای واقعی آن‌چین نیست.'),
  ] },
  { id: 'leverage', title: t('Leverage and exposure', 'اهرم و اندازهٔ موقعیت'), status: 'current', paragraphs: [
    t(`Challenge accounts use the Openfund leverage ceilings: BTC and ETH up to ${L.btcEth}×, other crypto up to ${L.crypto}×, forex up to ${L.forex}×, stocks up to ${L.stocks}×, commodities up to ${L.commodities}× and indices up to ${L.indices}×. A lower limit of the market itself always applies. Challenges sold before these terms keep the limit recorded in their own rules.`,
      `حساب‌های چلنج از سقف‌های اهرم اوپن‌فاند پیروی می‌کنند: بیت‌کوین و اتریوم تا ${L.btcEth} برابر، سایر رمزارزها تا ${L.crypto} برابر، فارکس تا ${L.forex} برابر، سهام تا ${L.stocks} برابر، کالاها تا ${L.commodities} برابر و شاخص‌ها تا ${L.indices} برابر. سقفِ کمترِ خودِ بازار همیشه اعمال می‌شود. چلنج‌هایی که پیش از این شرایط فروخته شده‌اند، سقف ثبت‌شده در قوانین خودشان را نگه می‌دارند.`),
    t('Leverage increases notional exposure for the same margin and amplifies both profit and loss.', 'اهرم ارزش اسمی موقعیت را برای وجه تضمین یکسان افزایش می‌دهد و سود و زیان را بزرگ‌تر می‌کند.'),
  ], formula: 'Notional exposure = margin × leverage\nQuantity = notional exposure / execution price' },
  { id: 'funded', title: t('Funded-account framework', 'چارچوب حساب فاندشده'), status: 'current', paragraphs: [
    t('A funded account is a simulated account. It opens after an operator approves a passed evaluation (Instant starts funded). It restarts at the starting virtual balance, keeps the same loss limits and has no profit target. No real trading capital is allocated.', 'حساب فاندشده یک حساب شبیه‌سازی‌شده است. پس از تأیید ارزیابیِ قبول‌شده توسط اپراتور باز می‌شود («آنی» از ابتدا فاندشده است). با موجودی مجازی اولیه از نو شروع می‌شود، همان سقف‌های ضرر را دارد و هدف سود ندارد. هیچ سرمایهٔ معاملاتی واقعی تخصیص نمی‌یابد.'),
    t('Before a funded account starts, the trader chooses one of the reward cycles of the model. The choice is recorded with the account and cannot be changed.', 'پیش از شروع حساب فاندشده، معامله‌گر یکی از چرخه‌های پاداشِ مدل را انتخاب می‌کند. این انتخاب همراه حساب ثبت می‌شود و قابل تغییر نیست.'),
    t(`Standard and One-phase funded accounts: every open position is closed each day in the 15 minutes before the daily market close (21:00 UTC in summer time, 22:00 UTC in winter time). Profit from a trade opened or closed within ${fn.windowMin} minutes of a restricted high-impact news release or speech on one of its currencies is not paid, unless the trade was opened at least ${fn.exemptHours} hours before the event. Evaluation accounts may hold positions overnight, over weekends and through news.`,
      `حساب‌های فاندشدهٔ «استاندارد» و «تک‌مرحله‌ای»: هر روز در ۱۵ دقیقهٔ پیش از بسته‌شدن روزانهٔ بازار (۲۱:۰۰ UTC در زمان تابستانی و ۲۲:۰۰ UTC در زمان زمستانی) همهٔ موقعیت‌های باز بسته می‌شوند. سود معامله‌ای که در فاصلهٔ ${fn.windowMin} دقیقه از یک خبر یا سخنرانی پراهمیتِ محدودشده روی یکی از ارزهای آن باز یا بسته شود پرداخت نمی‌شود، مگر آنکه معامله دست‌کم ${fn.exemptHours} ساعت پیش از رویداد باز شده باشد. حساب‌های ارزیابی می‌توانند موقعیت را شبانه، در تعطیلات آخر هفته و هنگام اخبار نگه دارند.`),
  ] },
  { id: 'identity', title: t('Identity and eligibility', 'هویت و شرایط دسترسی'), status: 'draft', paragraphs: [
    t('Wallet connection and Sign-In with Ethereum establish wallet ownership for the current session. One wallet maps to one user identity; a user may own multiple challenge records. A wallet signature is not identity-document verification.', 'اتصال کیف پول و ورود با امضای اتریوم، مالکیت کیف پول را برای نشست فعلی مشخص می‌کند. هر کیف پول به یک هویت کاربر مرتبط است و کاربر می‌تواند چند سابقهٔ چالش داشته باشد. امضای کیف پول، احراز هویت با مدرک شناسایی نیست.'),
    t('KYC requirements, provider, accepted documents, age, geography, deadlines and appeal paths have not been finalized. Do not send identity documents to an unannounced channel or infer eligibility from demo access.', 'الزامات احراز هویت، ارائه‌دهنده، مدارک پذیرفته‌شده، سن، جغرافیا، مهلت و مسیر اعتراض نهایی نشده‌اند. مدارک هویتی را به مسیر اعلام‌نشده نفرست و از دسترسی دمو، واجدشرایط‌بودن را نتیجه نگیر.'),
  ] },
  { id: 'fees', title: t('Fees and costs', 'کارمزد و هزینه‌ها'), status: 'draft', paragraphs: [
    t('Each challenge carries a one-time evaluation fee, published per account size in the catalog. Standard refunds the fee with the fourth reward; One-phase, Instant and the Free Trial do not refund it (the trial charges nothing).', 'هر چلنج هزینهٔ ارزیابی یک‌باره دارد که در فهرست، برای هر اندازهٔ حساب منتشر شده است. «استاندارد» هزینه را با چهارمین برداشت بازمی‌گرداند؛ «تک‌مرحله‌ای»، «آنی» و «تست رایگان» بازپرداخت ندارند (تست رایگان اصلاً هزینه ندارد).'),
    t('The demo’s documented per-side fee tiers are 0.035% for BTC/ETH, 0.05% for other crypto and 0.012% for forex, with a 0.06% fallback for other classes. These simulation settings are not a commercial fee schedule. Taxes, recurring charges and payout fees remain subject to the final agreement.', 'رده‌های مستندِ کارمزد دمو در هر سمت: ۰٫۰۳۵٪ برای بیت‌کوین و اتریوم، ۰٫۰۵٪ برای سایر رمزارزها و ۰٫۰۱۲٪ برای فارکس؛ سایر دسته‌ها ۰٫۰۶٪. این تنظیمات شبیه‌سازی، تعرفهٔ تجاری نیستند. مالیات، هزینهٔ دوره‌ای و کارمزد برداشت تابع قرارداد نهایی است.'),
  ] },
  { id: 'payouts', title: t('Payouts and profit sharing', 'برداشت و تقسیم سود'), status: 'current', paragraphs: [
    t('Rewards are a share of the realized net profit of a funded simulated account and are reviewed and paid manually; a reward is never shown as paid before its payout reference is recorded. When a request is made the account must have no open position or pending order; the requested profit leaves the account, and a rejected or cancelled request returns it.', 'پاداش سهمی از سود خالص تحقق‌یافتهٔ یک حساب فاندشدهٔ شبیه‌سازی‌شده است و به‌صورت دستی بررسی و پرداخت می‌شود؛ هیچ پاداشی پیش از ثبت مرجع پرداخت، پرداخت‌شده نمایش داده نمی‌شود. هنگام درخواست، حساب نباید موقعیت باز یا سفارش در انتظار داشته باشد؛ سود درخواست‌شده از حساب خارج می‌شود و درخواستِ ردشده یا لغوشده آن را بازمی‌گرداند.'),
    t(`Minimum request: ${pct('en', standard.minPayoutPct!)} of the account size. Timed cycles open a set number of days after the first funded trade and then after each request.`,
      `حداقل درخواست: ${pct('fa', standard.minPayoutPct!)} اندازهٔ حساب. چرخه‌های زمان‌دار پس از تعداد مشخصی روز از اولین معاملهٔ فاندشده و سپس پس از هر درخواست باز می‌شوند.`),
    t(`On-demand requests need a consistency score — the best profitable day may not exceed ${pct('en', onDemand.consistencyPct!)} of the cycle profit — and ${onDemand.profitableDays} profitable days, each with a net realized profit of at least ${pct('en', onDemand.profitableDayPct!)} of the account size. A trade idea that loses ${pct('en', onDemand.strikeLossPct!)} of the account size records a strike: two strikes halve the reward share, three reduce it to 20%, and a fourth closes the account. Profit from a trade idea with a strike is not paid.`,
      `درخواستِ «درخواستی» به امتیاز ثبات نیاز دارد — بهترین روزِ سودده نباید از ${pct('fa', onDemand.consistencyPct!)} سود چرخه بیشتر باشد — و ${n(onDemand.profitableDays!, 'fa')} روز سودده که سود خالص تحقق‌یافتهٔ هر کدام دست‌کم ${pct('fa', onDemand.profitableDayPct!)} اندازهٔ حساب باشد. ایدهٔ معاملاتی‌ای که ${pct('fa', onDemand.strikeLossPct!)} اندازهٔ حساب زیان کند یک اخطار ثبت می‌کند: دو اخطار سهم پاداش را نصف می‌کند، سه اخطار آن را به ۲۰٪ می‌رساند و اخطار چهارم حساب را می‌بندد. سود ایدهٔ معاملاتیِ دارای اخطار پرداخت نمی‌شود.`),
    t(`Instant: the best winning day may not exceed ${pct('en', instant.rewardCycles[0].consistencyPct!)} of the profit; a request waits until it does. Standard: the challenge fee actually paid is refunded once the fourth reward has been paid.`,
      `«آنی»: بهترین روزِ سودده نباید از ${pct('fa', instant.rewardCycles[0].consistencyPct!)} سود بیشتر باشد؛ درخواست تا برقراری این شرط منتظر می‌ماند. «استاندارد»: هزینهٔ پرداخت‌شدهٔ چلنج پس از پرداخت چهارمین پاداش بازگردانده می‌شود.`),
    t('News deductions require a verified economic calendar for the period. Until it is available, a request from an affected account is not eligible.', 'کسر سود خبری به تقویم اقتصادی تأییدشده برای همان دوره نیاز دارد. تا زمانی که در دسترس نباشد، درخواستِ حسابِ مشمول واجد شرایط نیست.'),
  ], table: { caption: t('Reward cycles by model', 'چرخه‌های پاداش به تفکیک مدل'), columns: [t('Model', 'مدل'), t('Cycles and reward share', 'چرخه‌ها و سهم پاداش'), t('First request', 'نخستین درخواست')], rows: [
    [t('Standard', 'استاندارد'), cyclesCell(standard), cellOf(l => standard.rewardCycles.map(c => c.firstAfterDays == null ? t('On demand', 'درخواستی')[l] : `${n(c.firstAfterDays, l)} ${t('days', 'روز')[l]}`).join(' · '))],
    [t('One-phase', 'تک‌مرحله‌ای'), cyclesCell(one), cellOf(l => one.rewardCycles.map(c => c.firstAfterDays == null ? t('On demand', 'درخواستی')[l] : `${n(c.firstAfterDays, l)} ${t('days', 'روز')[l]}`).join(' · '))],
    [t('Instant', 'آنی'), cyclesCell(instant), cellOf(l => instant.rewardCycles.map(c => `${n(c.firstAfterDays!, l)} ${t('days', 'روز')[l]}`).join(' · '))],
  ] } },
  { id: 'conduct', title: t('Account conduct rules', 'قوانین رفتار حساب'), status: 'current', paragraphs: [
    t(`Every challenge and funded account must fully close at least one trade within any ${instant.inactivityDays} consecutive calendar days. The count starts when the account starts, or the day after the last fully closed trade; open positions do not count. Missing it closes the account.`,
      `هر حساب چلنج و فاندشده باید در هر ${n(instant.inactivityDays!, 'fa')} روز تقویمیِ پیاپی دست‌کم یک معامله را کامل ببندد. شمارش از شروع حساب، یا از روزِ پس از آخرین معاملهٔ کاملاً بسته‌شده آغاز می‌شود؛ موقعیت باز حساب نمی‌شود. رعایت‌نکردن آن حساب را می‌بندد.`),
    t(`Instant accounts close at once when combined floating losses reach ${pct('en', ik.maxOpenRiskPct!)} of the account size; or a single trade idea loses ${pct('en', ik.tradeIdea!.belowPct)} of the size (below ${money('en', ik.tradeIdea!.thresholdUsd)}) or ${pct('en', ik.tradeIdea!.atOrAbovePct)} (from ${money('en', ik.tradeIdea!.thresholdUsd)}). Positions on the same instrument and direction held together, or reopened within ${ik.tradeIdea!.reentryMin} minutes of a losing close, form one trade idea.`,
      `حساب‌های «آنی» بی‌درنگ بسته می‌شوند هرگاه مجموع زیان شناور به ${pct('fa', ik.maxOpenRiskPct!)} اندازهٔ حساب برسد؛ یا یک ایدهٔ معاملاتی ${pct('fa', ik.tradeIdea!.belowPct)} اندازه (زیر ${money('fa', ik.tradeIdea!.thresholdUsd)} دلار) یا ${pct('fa', ik.tradeIdea!.atOrAbovePct)} (از ${money('fa', ik.tradeIdea!.thresholdUsd)} دلار) زیان کند. موقعیت‌های هم‌نماد و هم‌جهتی که هم‌زمان نگه داشته شوند، یا ظرف ${n(ik.tradeIdea!.reentryMin, 'fa')} دقیقه پس از بستنِ زیان‌ده دوباره باز شوند، یک ایدهٔ معاملاتی‌اند.`),
    t(`Instant accounts also close when a completed ${ik.profitableDayRule!.windowDays}-day period, counted from the first trade, has fewer than ${ik.profitableDayRule!.days} days with a net realized profit of at least ${pct('en', ik.profitableDayRule!.minPct)} of the size; when any position is open within ${ik.news!.windowMin} minutes before or after a restricted high-impact news event on one of its currencies; or when any position is still open at the Friday market close.`,
      `حساب‌های «آنی» همچنین بسته می‌شوند هرگاه در یک دورهٔ کاملِ ${n(ik.profitableDayRule!.windowDays, 'fa')}روزه، که از اولین معامله شمرده می‌شود، کمتر از ${n(ik.profitableDayRule!.days, 'fa')} روز با سود خالص تحقق‌یافتهٔ دست‌کم ${pct('fa', ik.profitableDayRule!.minPct)} اندازهٔ حساب باشد؛ هرگاه موقعیتی در فاصلهٔ ${n(ik.news!.windowMin, 'fa')} دقیقه پیش یا پس از یک خبر پراهمیتِ محدودشده روی یکی از ارزهایش باز باشد؛ یا هرگاه موقعیتی هنگام بسته‌شدن بازار در روز جمعه هنوز باز باشد.`),
    t('Restricted news events come from a licensed economic calendar that Openfund imports and verifies. A plan whose rules depend on news is not sold while verified calendar data is unavailable, and orders that would immediately break a rule are refused.', 'رویدادهای خبریِ محدودشده از یک تقویم اقتصادیِ دارای مجوز می‌آیند که اوپن‌فاند وارد و تأیید می‌کند. پلنی که قوانینش به اخبار وابسته است، تا زمانی که دادهٔ تأییدشدهٔ تقویم در دسترس نباشد فروخته نمی‌شود، و سفارشی که بی‌درنگ قاعده‌ای را نقض کند پذیرفته نمی‌شود.'),
  ] },
  { id: 'free-trial', title: t('Free trial', 'تست رایگان'), status: 'draft', paragraphs: [
    t(`The Free Trial rehearses the Standard challenge with no fee: ${n(trial.trialDaysPerPhase!, 'en')} calendar days per phase, ${pct('en', trial.phase1TargetPct!)} and ${pct('en', trial.phase2TargetPct!)} targets, ${pct('en', trial.dailyLossPct)} daily and ${pct('en', trial.maxTotalLossPct)} total loss limits, and ${n(trial.minTradingDays, 'en')} minimum trading days per phase.`,
      `تست رایگان، چلنج «استاندارد» را بدون هزینه تمرین می‌کند: ${n(trial.trialDaysPerPhase!, 'fa')} روز تقویمی در هر مرحله، اهداف ${pct('fa', trial.phase1TargetPct!)} و ${pct('fa', trial.phase2TargetPct!)}، سقف‌های ضرر ${pct('fa', trial.dailyLossPct)} روزانه و ${pct('fa', trial.maxTotalLossPct)} کل، و حداقل ${n(trial.minTradingDays, 'fa')} روز معاملاتی در هر مرحله.`),
    t('One active trial at a time; holding an active paid challenge blocks starting one. Trial profits cannot be requested as rewards, and a trial never converts into a paid evaluation or a funded account — a pass still requires a separate challenge purchase. Trial provisioning activates with the commercial launch.', 'هم‌زمان فقط یک تست فعال؛ داشتن چلنج خریدنیِ فعال، شروع تست را می‌بندد. سود تست قابل درخواست نیست و تست هرگز به ارزیابی خریدنی یا حساب فاندشده تبدیل نمی‌شود — قبولیِ تست همچنان خرید جداگانهٔ چلنج می‌خواهد. تأمین تست با عرضهٔ تجاری فعال می‌شود.'),
  ] },
  { id: 'verification', title: t('Transparency and verification', 'شفافیت و راستی‌آزمایی'), status: 'current', paragraphs: [
    t('The authenticated account records orders, positions and ledger events on the server. Portfolio analytics summarize those records. These are application records, not public cryptographic proofs.', 'حساب پس از ورود، سفارش‌ها، موقعیت‌ها و رویدادهای دفتر حساب را در سرور ثبت می‌کند. تحلیل پرتفوی خلاصهٔ همین سوابق است. این‌ها سوابق برنامه‌اند، نه اثبات رمزنگاری‌شدهٔ عمومی.'),
    t('The Transparency page uses a separate, explicitly labelled sample dataset to demonstrate a future reporting interface. It is not live reserves, verified performance or an audit. Public verification and independent review remain planned.', 'صفحهٔ شفافیت برای نمایش رابط گزارش‌دهی آینده، مجموعه‌دادهٔ مستقل و صریحاً نمونه به کار می‌برد. این داده، ذخایر زنده، عملکرد راستی‌آزمایی‌شده یا حسابرسی نیست. راستی‌آزمایی عمومی و بررسی مستقل همچنان در برنامه است.'),
  ] },
  { id: 'practices', title: t('Prohibited practices', 'رفتارهای ممنوع'), status: 'draft', paragraphs: [
    t('Never share a seed phrase, impersonate another wallet holder or attempt to access someone else’s account records. The application enforces account ownership, signature checks and suspension.', 'عبارت بازیابی را به اشتراک نگذار، خود را صاحب کیف پول دیگری معرفی نکن و برای دسترسی به سوابق دیگران اقدام نکن. برنامه مالکیت حساب، اعتبار امضا و تعلیق را کنترل می‌کند.'),
    t('The consistency score and profitable days are reward conditions of the cycles that use them (see Payouts). A commercial policy on manipulation, coordinated accounts, technical exploits, cross-account hedging, bots and third-party account management follows the final agreement.', 'امتیاز ثبات و روزهای سودده شرطِ پاداشِ چرخه‌هایی هستند که از آن‌ها استفاده می‌کنند (بخش برداشت). سیاست تجاری دربارهٔ دست‌کاری، حساب‌های هماهنگ، سوءاستفادهٔ فنی، پوشش ریسک میان حساب‌ها، ربات‌ها و مدیریت حساب توسط شخص ثالث از قرارداد نهایی پیروی می‌کند.'),
  ] },
  { id: 'summary', title: t('Rules at a glance', 'خلاصهٔ قواعد'), status: 'current', paragraphs: [
    t('The catalog of record, in one table — plus an honest account of what runs today.', 'فهرستِ مرجع در یک جدول — به‌همراه توضیح صادقانه از وضعیت امروز.'),
  ], table: { caption: t('Challenge catalog of record', 'فهرستِ مرجع چلنج‌ها'), columns: [t('Term', 'شرط'), t('Standard', 'استاندارد'), t('One-phase', 'تک‌مرحله‌ای'), t('Instant', 'آنی'), t('Free trial', 'تست رایگان')], rows: [
    [t('Phases · target', 'مراحل · هدف'), t('2 · 8% + 5%', '۲ · ۸٪ + ۵٪'), t('1 · 12%', '۱ · ۱۲٪'), t('— (funded)', '— (فاندشده)'), t('2 · 8% + 5%', '۲ · ۸٪ + ۵٪')],
    [t('Daily loss', 'سقف ضرر روزانه'), dailyCell(standard), dailyCell(one), dailyCell(instant), dailyCell(trial)],
    [t('Maximum loss', 'سقف ضرر کل'), t('10% static', '۱۰٪ ثابت'), t('12% static', '۱۲٪ ثابت'), t('5% trailing', '۵٪ شناور'), t('10% static', '۱۰٪ ثابت')],
    [t('Reward share', 'سهم سود'), cyclesCell(standard), cyclesCell(one), cyclesCell(instant), cyclesCell(trial)],
    [t('Inactivity limit', 'سقف عدم فعالیت'), ...[standard, one, instant, trial].map(p => cellOf(l => p.inactivityDays ? `${n(p.inactivityDays, l)} ${t('days', 'روز')[l]}` : t('None', 'ندارد')[l]))],
    [t('Minimum trading days', 'حداقل روز معاملاتی'), t('3 / phase', '۳ / مرحله'), t('None', 'ندارد'), t('7 profitable / 30d', '۷ روز سودده / ۳۰ روز'), t('3 / phase', '۳ / مرحله')],
    [t('Fee refund', 'بازپرداخت هزینه'), t('4th reward', 'چهارمین برداشت'), t('None', 'ندارد'), t('None', 'ندارد'), t('Free', 'رایگان')],
  ] } },
  { id: 'support', title: t('Support and account security', 'پشتیبانی و امنیت حساب'), status: 'current', paragraphs: [
    t('Before signing, check the site origin and the purpose of the message. Demo trading never requires a transfer or a token approval. Never disclose your private key or seed phrase.', 'پیش از امضا، نشانی سایت و هدف پیام را بررسی کن. معاملهٔ دمو هرگز به انتقال دارایی یا مجوز برداشت توکن نیاز ندارد. کلید خصوصی یا عبارت بازیابی را هرگز افشا نکن.'),
    t('For a reproducible product issue, use the project’s GitHub issue tracker without posting private account data — include the page, approximate time, language and steps. A commercial support channel, response commitment and appeals process are not finalized.', 'برای گزارش خطای قابل تکرار محصول، از بخش Issues پروژه در گیت‌هاب استفاده کن و دادهٔ خصوصی حساب را منتشر نکن — صفحه، زمان تقریبی، زبان و مراحل رخداد را بنویس. کانال پشتیبانی تجاری، تعهد زمان پاسخ و فرایند اعتراض هنوز نهایی نشده‌اند.'),
  ] },
]
