import { text as t, number as n, type Localized } from '../information/content'
import { publishedPlans } from '../../data/challengePlans'

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

const pct = (locale: 'en' | 'fa', v: number) => `${n(v, locale)}${locale === 'fa' ? '٪' : '%'}`
const money = (locale: 'en' | 'fa', v: number) => locale === 'fa' ? n(v, locale) : `$${n(v, locale)}`
const sizesList = (locale: 'en' | 'fa', sizes: number[]) => sizes.map(s => n(s, locale)).join(' / ')

export const rulebookIntro = t(
  'The complete terms of the Openfund challenges — targets, loss limits, reward sharing and the free trial — plus a clear account of what already works today.',
  'شرایط کامل چلنج‌های اوپن‌فاند — اهداف، سقف‌های ضرر، تقسیم سود و تست رایگان — به‌همراه توضیح روشن از امکاناتِ امروز.'
)
export const rulebookNotice = t(
  'These are the published challenge terms of record. Purchase activation, funded accounts and payouts are not yet enabled in this release — the terminal currently runs the simulated 100,000 DAI demo — and a final versioned agreement will be published before launch.',
  'این‌ها شرایط منتشرشده و مرجع چلنج‌های اوپن‌فاند هستند. فعال‌سازی خرید، حساب فاندشده و برداشت در این نسخه فعال نیست — ترمینال فعلاً دموی شبیه‌سازی‌شدهٔ ۱۰۰٬۰۰۰ دای را اجرا می‌کند — و پیش از عرضه، قرارداد نهایی نسخه‌دار منتشر خواهد شد.'
)
export const ruleSections: RuleSection[] = [
  { id: 'overview', title: t('Overview', 'نگاه کلی'), status: 'current', paragraphs: [
    t('Openfund brings live market data, a trading workspace and simulated account records into one experience. The current trading environment uses virtual funds — demo profits are not money owed to the trader.', 'اوپن‌فاند دادهٔ زندهٔ بازار، فضای معاملاتی و سوابق حساب شبیه‌سازی‌شده را در یک تجربه کنار هم می‌آورد. محیط معاملاتی فعلی با موجودی مجازی کار می‌کند — سود دمو، طلب مالی معامله‌گر از پلتفرم نیست.'),
    t('This page is the complete reference for the challenge terms: three purchasable models and a free trial, with every target, loss limit, reward split and condition in one place. What is not yet operational — purchasing, funded accounts, payouts — is stated as such, never implied.', 'این صفحه مرجع کامل شرایط چلنج‌هاست: سه مدل خریدنی و یک تست رایگان، با همهٔ اهداف، سقف‌های ضرر، سهم‌های سود و شرایط در یک جا. آنچه هنوز عملیاتی نیست — خرید، حساب فاندشده، برداشت — صریحاً بیان می‌شود، نه القایی.'),
  ] },
  { id: 'how-it-works', title: t('How the evaluation works', 'ارزیابی چگونه پیش می‌رود؟'), status: 'planned', paragraphs: [
    t('The path: choose a challenge model, demonstrate performance against the published objectives, then trade a funded account under the reward agreement. The Instant model skips evaluation entirely and starts at the funded stage.', 'مسیر ساده است: مدل چلنج را انتخاب می‌کنی، عملکردت را در چارچوب اهداف منتشرشده نشان می‌دهی و سپس طبق قرارداد پاداش، در حساب فاندشده معامله می‌کنی. مدل «آنی» ارزیابی را کامل رد می‌کند و از همان مرحلهٔ فاندشده شروع می‌شود.'),
    t('Today, connect a wallet and explore simulated trading in the terminal, or rehearse the full challenge path with the free trial. Signing in does not purchase a challenge and does not prove an evaluation has been passed.', 'امروز می‌توانی کیف پول را وصل کنی و معاملات شبیه‌سازی‌شده را در ترمینال تجربه کنی، یا مسیر کامل چلنج را با تست رایگان تمرین کنی. ورود به حساب، خرید چلنج نیست و اثبات قبولی هم نیست.'),
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
    t('Phase transitions, pass detection and funded-account provisioning are not automated yet — they activate with the commercial launch.', 'انتقال مراحل، تشخیص قبولی و تأمین حساب فاندشده هنوز خودکار نیستند — با عرضهٔ تجاری فعال می‌شوند.'),
  ] },
  { id: 'targets', title: t('Profit targets', 'هدف سود'), status: 'draft', paragraphs: [
    t(`Published targets: ${pct('en', standard.phase1TargetPct!)} then ${pct('en', standard.phase2TargetPct!)} on Standard, a single ${pct('en', one.phase1TargetPct!)} on One-phase, and no target on Instant. Targets are measured on closed net profit — open positions do not count until realized. There is no target once funded.`,
      `اهداف منتشرشده: ${pct('fa', standard.phase1TargetPct!)} و سپس ${pct('fa', standard.phase2TargetPct!)} در «استاندارد»، یک هدف ${pct('fa', one.phase1TargetPct!)} در «تک‌مرحله‌ای» و بدون هدف در «آنی». اهداف با سود خالصِ معاملات بسته‌شده سنجیده می‌شوند — موقعیت باز تا محقق‌نشده حساب نمی‌شود. در مرحلهٔ فاندشده هدف وجود ندارد.`),
    t('The engine does not yet enforce targets; they are the published conditions the commercial evaluation will measure.', 'موتور فعلی اهداف را اجرا نمی‌کند؛ این‌ها شرایط منتشرشده‌ای هستند که ارزیابی تجاری خواهد سنجید.'),
  ], formula: 'Illustrative target amount = starting balance × target rate', explanation: {
    title: t('Read an example without treating it as a rule', 'مثال را با قانون نهایی اشتباه نگیر'),
    body: t('An 8% target on a 10,000-unit account means an 800-unit objective. The arithmetic explains the concept; the pass criteria of record are the ones on this page.', 'هدف ۸٪ برای حساب ۱۰٬۰۰۰ واحدی یعنی هدفِ ۸۰۰ واحدی. محاسبه مفهوم را روشن می‌کند؛ معیار قبولیِ مرجع، همین‌های این صفحه‌اند.'),
  } },
  { id: 'daily-loss', title: t('Daily loss limit', 'سقف ضرر روزانه'), status: 'draft', paragraphs: [
    t(`The daily limit is ${pct('en', standard.dailyLossPct)} on Standard (with a ${pct('en', standard.dailyLossPctAlt!)} configuration), ${pct('en', one.dailyLossPct)} on One-phase (or ${pct('en', one.dailyLossPctAlt!)}) and ${pct('en', instant.dailyLossPct)} on Instant. It is measured against the higher of the day’s opening balance or opening equity, and resets at 00:00 UTC+3. Touching it once is a breach — a recovering trade does not undo it.`,
      `سقف روزانه در «استاندارد» ${pct('fa', standard.dailyLossPct)} است (با پیکربندی ${pct('fa', standard.dailyLossPctAlt!)}، در «تک‌مرحله‌ای» ${pct('fa', one.dailyLossPct)} (یا ${pct('fa', one.dailyLossPctAlt!)}) و در «آنی» ${pct('fa', instant.dailyLossPct)}. مبنای محاسبه، بزرگ‌ترِ موجودی یا ارزش خالصِ ابتدای روز است و ساعت ۰۰:۰۰ (UTC+3) بازنشانی می‌شود. یک بار لمسِ آن نقض است — بازیابیِ معامله آن را به‌عقب نمی‌گرداند.`),
    t('The demo does not apply a commercial daily-loss breach yet; the terminal manages risk through margin and simulated liquidation.', 'دمو هنوز نقضِ تجاریِ سقف روزانه را اعمال نمی‌کند؛ ترمینال ریسک را با وجه تضمین و لیکوییدشدن شبیه‌سازی‌شده مدیریت می‌کند.'),
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
    t('Touching the daily or total loss limit is a breach: positions close, trading stops on that account and the eligible profit of the period is not withdrawable. A trial breach closes the trial immediately. The demo already rejects invalid orders, insufficient margin and stale execution prices, and suspends suspended users — but it does not yet apply commercial breach handling.', 'لمسِ سقف ضرر روزانه یا کل، نقض است: موقعیت‌ها بسته می‌شوند، معامله روی همان حساب متوقف می‌شود و سود واجدشرایطِ آن دوره قابل برداشت نیست. نقض در تست رایگان، همان لحظه تست را می‌بندد. دمو همین حالا سفارش نامعتبر، وجه تضمین ناکافی و قیمت کهنه را رد می‌کند و کاربر تعلیق‌شده را می‌بندد — اما رسیدگیِ تجاری به نقض را هنوز اعمال نمی‌کند.'),
    t('Appeals, resets and termination follow the final versioned agreement to be published before launch.', 'اعتراض، بازنشانی و خاتمه طبق قرارداد نسخه‌داری می‌شود که پیش از عرضه منتشر خواهد شد.'),
  ] },
  { id: 'conditions', title: t('Trading conditions', 'شرایط معامله'), status: 'current', paragraphs: [
    t('The authenticated demo supports market, limit and stop orders, long and short positions, stop-loss and take-profit updates, closing and simulated liquidation. Fresh server marks drive execution; fills are simulations.', 'دموی پس از ورود از سفارش بازار، لیمیت و استاپ، موقعیت خرید و فروش، تغییر حد ضرر و حد سود، بستن موقعیت و لیکوییدشدن شبیه‌سازی‌شده پشتیبانی می‌کند. قیمت تازهٔ سرور مبنای اجراست و معاملات شبیه‌سازی می‌شوند.'),
    t('The documented model uses fee and spread assumptions per asset class; it does not simulate liquidity impact, funding or borrowing costs. Demo results cannot establish live execution quality.', 'مدل مستند برای کارمزد و اسپرد بر اساس دستهٔ دارایی فرض‌هایی دارد؛ اثر نقدینگی، هزینهٔ تأمین مالی و استقراض شبیه‌سازی نمی‌شود. نتیجهٔ دمو کیفیت اجرای واقعی را اثبات نمی‌کند.'),
    t('Weekend holding and news trading: unrestricted during evaluation; on funded accounts, the final agreement governs holding and high-impact-news windows. No other firm’s restrictions are adopted here.', 'نگهداری آخر هفته و معاملهٔ هنگام اخبار: در مرحلهٔ ارزیابی آزاد است؛ در حساب فاندشده، قرارداد نهایی حکم می‌کند. محدودیت هیچ شرکت دیگری در این سند پذیرفته نشده است.'),
  ] },
  { id: 'markets', title: t('Available markets', 'بازارهای در دسترس'), status: 'current', paragraphs: [
    t('The application loads market metadata and marks from Gains Network. Instruments are grouped into crypto, forex, stocks, indices and commodities — browse the full directory on the Markets page. The available list and each market’s status can change.', 'برنامه مشخصات بازار و قیمت مرجع را از Gains Network می‌خواند. ابزارها به رمزارز، فارکس، سهام، شاخص و کالا دسته‌بندی می‌شوند — فهرست کامل را در صفحهٔ «بازارها» ببین. فهرست در دسترس و وضعیت هر بازار می‌تواند تغییر کند.'),
    t('Check the terminal for the current instrument and trading status. A market-data listing is not a guarantee of availability under a future paid plan or evidence of real on-chain execution.', 'نماد و وضعیت فعلی معامله را در ترمینال بررسی کن. حضور در فهرست داده، تضمین دسترسی در پلن پولی آینده یا مدرک اجرای واقعی آن‌چین نیست.'),
  ] },
  { id: 'leverage', title: t('Leverage and exposure', 'اهرم و اندازهٔ موقعیت'), status: 'current', paragraphs: [
    t('Challenge accounts publish plan leverage up to 5×. The demo validates whole-number leverage against the market metadata limit, with a configured fallback when metadata is absent — the terminal can therefore show higher per-market limits than the plan setting.', 'حساب‌های چلنج اهرمِ پلنی تا ۵ برابر منتشر می‌کنند. دمو اهرم صحیح را با سقف مشخصات بازار می‌سنجد و در نبود آن از مقدار جایگزین استفاده می‌کند — پس ترمینال می‌تواند سقف‌های بالاتری برای هر بازار نسبت به تنظیم پلن نشان دهد.'),
    t('Leverage increases notional exposure for the same margin and amplifies both profit and loss.', 'اهرم ارزش اسمی موقعیت را برای وجه تضمین یکسان افزایش می‌دهد و سود و زیان را بزرگ‌تر می‌کند.'),
  ], formula: 'Notional exposure = margin × leverage\nQuantity = notional exposure / execution price' },
  { id: 'funded', title: t('Funded-account framework', 'چارچوب حساب فاندشده'), status: 'planned', paragraphs: [
    t('The funded account is the payout stage of a passed challenge (or the starting stage of the Instant model). It keeps the same loss limits; there is no profit target.', 'حساب فاندشده مرحلهٔ برداشتِ چلنجِ قبول‌شده است (یا مرحلهٔ شروعِ مدل «آنی»). همان سقف‌های ضرر را نگه می‌دارد؛ هدف سود ندارد.'),
    t('Current demo activity does not create a right to capital, profit sharing or withdrawals. Capital arrangements, termination and the exact funded-stage conditions follow the final agreement to be published before launch.', 'فعالیت دموی فعلی حق دریافت سرمایه، سهم سود یا برداشت ایجاد نمی‌کند. سازوکار سرمایه، خاتمه و شرایط دقیق مرحلهٔ فاندشده طبق قرارداد نهایی است که پیش از عرضه منتشر می‌شود.'),
  ] },
  { id: 'identity', title: t('Identity and eligibility', 'هویت و شرایط دسترسی'), status: 'draft', paragraphs: [
    t('Wallet connection and Sign-In with Ethereum establish wallet ownership for the current session. One wallet maps to one user identity; a user may own multiple challenge records. A wallet signature is not identity-document verification.', 'اتصال کیف پول و ورود با امضای اتریوم، مالکیت کیف پول را برای نشست فعلی مشخص می‌کند. هر کیف پول به یک هویت کاربر مرتبط است و کاربر می‌تواند چند سابقهٔ چالش داشته باشد. امضای کیف پول، احراز هویت با مدرک شناسایی نیست.'),
    t('KYC requirements, provider, accepted documents, age, geography, deadlines and appeal paths have not been finalized. Do not send identity documents to an unannounced channel or infer eligibility from demo access.', 'الزامات احراز هویت، ارائه‌دهنده، مدارک پذیرفته‌شده، سن، جغرافیا، مهلت و مسیر اعتراض نهایی نشده‌اند. مدارک هویتی را به مسیر اعلام‌نشده نفرست و از دسترسی دمو، واجدشرایط‌بودن را نتیجه نگیر.'),
  ] },
  { id: 'fees', title: t('Fees and costs', 'کارمزد و هزینه‌ها'), status: 'draft', paragraphs: [
    t('Each challenge carries a one-time evaluation fee, published per account size in the catalog. Standard refunds the fee with the fourth reward; One-phase, Instant and the Free Trial do not refund it (the trial charges nothing).', 'هر چلنج هزینهٔ ارزیابی یک‌باره دارد که در فهرست، برای هر اندازهٔ حساب منتشر شده است. «استاندارد» هزینه را با چهارمین برداشت بازمی‌گرداند؛ «تک‌مرحله‌ای»، «آنی» و «تست رایگان» بازپرداخت ندارند (تست رایگان اصلاً هزینه ندارد).'),
    t('The demo’s documented per-side fee tiers are 0.035% for BTC/ETH, 0.05% for other crypto and 0.012% for forex, with a 0.06% fallback for other classes. These simulation settings are not a commercial fee schedule. Taxes, recurring charges and payout fees remain subject to the final agreement.', 'رده‌های مستندِ کارمزد دمو در هر سمت: ۰٫۰۳۵٪ برای بیت‌کوین و اتریوم، ۰٫۰۵٪ برای سایر رمزارزها و ۰٫۰۱۲٪ برای فارکس؛ سایر دسته‌ها ۰٫۰۶٪. این تنظیمات شبیه‌سازی، تعرفهٔ تجاری نیستند. مالیات، هزینهٔ دوره‌ای و کارمزد برداشت تابع قرارداد نهایی است.'),
  ] },
  { id: 'payouts', title: t('Payouts and profit sharing', 'برداشت و تقسیم سود'), status: 'planned', paragraphs: [
    t(`Reward shares: ${pct('en', standard.profitSplitPct)} on Standard and One-phase — raised to ${pct('en', standard.profitSplitMonthlyPct!)} on the monthly cycle with seven profitable days and the consistency score — and ${pct('en', instant.profitSplitPct)} on Instant, settled every 14 calendar days. The first payout opens ${n(standard.firstPayoutDays!, 'en')} days after the first funded trade; the minimum request is ${pct('en', standard.minPayoutPct!)} of account size.`,
      `سهم سود: در «استاندارد» و «تک‌مرحله‌ای» ${pct('fa', standard.profitSplitPct)} — که در سیکل ماهانه با هفت روز سودده و رعایت امتیاز تداوم به ${pct('fa', standard.profitSplitMonthlyPct!)} می‌رسد — و در «آنی» ${pct('fa', instant.profitSplitPct)} که هر ۱۴ روز تقویمی تسویه می‌شود. نخستین برداشت ${n(standard.firstPayoutDays!, 'fa')} روز پس از اولین معاملهٔ فاندشده باز می‌شود؛ حداقل درخواست ${pct('fa', standard.minPayoutPct!)} اندازهٔ حساب است.`),
    t(`Instant specifics: keep ${n(instant.profitableDaysPer30!, 'en')} profitable days per rolling 30 days, the largest winning day must not exceed ${pct('en', instant.consistencyPct!)} of cumulative profit, floating losses are capped, and the first ${pct('en', 3)} of profit is not payout-eligible. No payout promise beyond these published conditions is made, and nothing here is active in the current release.`,
      `نکات «آنی»: ${n(instant.profitableDaysPer30!, 'fa')} روز سودده در هر بازهٔ ۳۰روزه لازم است، بزرگ‌ترین روزِ سود نباید از ${pct('fa', instant.consistencyPct!)} سود انباشته بیشتر شود، زیان شناور سقف جداگانه دارد و ${pct('fa', 3)} اولِ سود مشمول برداشت نیست. هیچ وعدهٔ پرداختی فراتر از همین شرایط منتشرشده داده نمی‌شود و هیچ‌یک در نسخهٔ فعلی فعال نیست.`),
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
    t('The consistency score is a payout condition, not a trading restriction: on the monthly cycle the best day must not exceed 35% of total profit, and on Instant 15%. A commercial policy on manipulation, coordinated accounts, technical exploits, cross-account hedging, bots and third-party account management follows the final agreement.', 'امتیاز تداوم شرطِ برداشت است، نه محدودیت معامله: در سیکل ماهانه بهترین روز نباید از ۳۵٪ سود کل بیشتر شود و در «آنی» از ۱۵٪. سیاست تجاری دربارهٔ دستکاری، حساب‌های هماهنگ، سوءاستفادهٔ فنی، هج میان حساب‌ها، ربات و مدیریت حساب توسط دیگران تابع قرارداد نهایی است.'),
  ] },
  { id: 'summary', title: t('Rules at a glance', 'خلاصهٔ قواعد'), status: 'current', paragraphs: [
    t('The catalog of record, in one table — plus an honest account of what runs today.', 'فهرستِ مرجع در یک جدول — به‌همراه توضیح صادقانه از وضعیت امروز.'),
  ], table: { caption: t('Challenge catalog of record', 'فهرستِ مرجع چلنج‌ها'), columns: [t('Term', 'شرط'), t('Standard', 'استاندارد'), t('One-phase', 'تک‌مرحله‌ای'), t('Instant', 'آنی'), t('Free trial', 'تست رایگان')], rows: [
    [t('Phases · target', 'مراحل · هدف'), t('2 · 8% + 5%', '۲ · ۸٪ + ۵٪'), t('1 · 12%', '۱ · ۱۲٪'), t('— (funded)', '— (فاندشده)'), t('2 · 8% + 5%', '۲ · ۸٪ + ۵٪')],
    [t('Daily loss', 'سقف ضرر روزانه'), t('5% (or 3%)', '۵٪ (یا ۳٪)'), t('3% (or 2%)', '۳٪ (یا ۲٪)'), t('3%', '۳٪'), t('5%', '۵٪')],
    [t('Maximum loss', 'سقف ضرر کل'), t('10% static', '۱۰٪ ثابت'), t('12% static', '۱۲٪ ثابت'), t('5% trailing', '۵٪ شناور'), t('10% static', '۱۰٪ ثابت')],
    [t('Reward share', 'سهم سود'), t('80% · 100% monthly', '۸۰٪ · ۱۰۰٪ ماهانه'), t('80% · 100% monthly', '۸۰٪ · ۱۰۰٪ ماهانه'), t('95% / 14 days', '۹۵٪ / ۱۴ روز'), t('None', 'ندارد')],
    [t('Minimum trading days', 'حداقل روز معاملاتی'), t('3 / phase', '۳ / مرحله'), t('None', 'ندارد'), t('7 profitable / 30d', '۷ روز سودده / ۳۰ روز'), t('3 / phase', '۳ / مرحله')],
    [t('Fee refund', 'بازپرداخت هزینه'), t('4th reward', 'چهارمین برداشت'), t('None', 'ندارد'), t('None', 'ندارد'), t('Free', 'رایگان')],
  ] } },
  { id: 'support', title: t('Support and account security', 'پشتیبانی و امنیت حساب'), status: 'current', paragraphs: [
    t('Before signing, check the site origin and the purpose of the message. Demo trading never requires a transfer or a token approval. Never disclose your private key or seed phrase.', 'پیش از امضا، نشانی سایت و هدف پیام را بررسی کن. معاملهٔ دمو هرگز به انتقال دارایی یا مجوز برداشت توکن نیاز ندارد. کلید خصوصی یا عبارت بازیابی را هرگز افشا نکن.'),
    t('For a reproducible product issue, use the project’s GitHub issue tracker without posting private account data — include the page, approximate time, language and steps. A commercial support channel, response commitment and appeals process are not finalized.', 'برای گزارش خطای قابل تکرار محصول، از بخش Issues پروژه در گیت‌هاب استفاده کن و دادهٔ خصوصی حساب را منتشر نکن — صفحه، زمان تقریبی، زبان و مراحل رخداد را بنویس. کانال پشتیبانی تجاری، تعهد زمان پاسخ و فرایند اعتراض هنوز نهایی نشده‌اند.'),
  ] },
]
