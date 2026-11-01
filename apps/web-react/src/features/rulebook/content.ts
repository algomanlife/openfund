import { text as t, type Localized } from '../information/content'

export interface RuleTable { caption: Localized; columns: Localized[]; rows: Localized[][] }
export interface RuleSection {
  id: string; title: Localized; status: 'current' | 'draft' | 'planned'
  paragraphs: Localized[]; formula?: string; table?: RuleTable
  explanation?: { title: Localized; body: Localized }
}
export const rulebookIntro = t(
  'Understand the account, the risk and the next step. A guide to today’s demo and the evaluation framework still being developed.',
  'ماهیت حساب، ریسک و قدم بعدی را بشناس. راهنمای دموی فعلی و چارچوب ارزیابی‌ای که هنوز در دست توسعه است.'
)
export const rulebookNotice = t(
  'Working draft, not final commercial terms. Demo behavior is documented below; sample plans are proposals. Purchasing evaluations, funded trading and payouts are not active. A final, versioned agreement must be published before launch.',
  'این سند پیش‌نویس است و شرایط تجاری نهایی محسوب نمی‌شود. رفتار دموی فعلی در ادامه توضیح داده شده و پلن‌های نمونه پیشنهادی‌اند. خرید ارزیابی، حساب فاندشده و برداشت فعال نیستند. پیش از عرضه، قرارداد نهایی و نسخه‌دار باید منتشر شود.'
)
export const ruleSections: RuleSection[] = [
  { id: 'overview', title: t('Overview', 'نگاه کلی'), status: 'current', paragraphs: [
    t('Openfund brings live market data, a trading workspace and simulated account records into one experience. The current trading environment uses virtual funds. Demo profits are not money owed to the trader.', 'اوپن‌فاند دادهٔ زندهٔ بازار، فضای معاملاتی و سوابق حساب شبیه‌سازی‌شده را در یک تجربه کنار هم می‌آورد. محیط معاملاتی فعلی با موجودی مجازی کار می‌کند. سود دمو، طلب مالی معامله‌گر از پلتفرم نیست.'),
    t('This page separates implemented demo behavior from proposed evaluation terms. Marketing illustrations and account-builder presets do not establish a funded-account contract.', 'این صفحه رفتار پیاده‌شدهٔ دمو را از شرایط پیشنهادی ارزیابی جدا می‌کند. تصاویر تبلیغاتی و تنظیمات نمونهٔ حساب‌ساز، قرارداد حساب فاندشده ایجاد نمی‌کنند.'),
  ] },
  { id: 'how-it-works', title: t('How the evaluation works', 'ارزیابی چگونه پیش می‌رود؟'), status: 'planned', paragraphs: [
    t('The intended path is to choose an evaluation, demonstrate performance against published objectives, then qualify for a funded-account agreement. Evaluation purchasing, activation and automated results are not implemented yet.', 'مسیر مدنظر، انتخاب ارزیابی، نشان‌دادن عملکرد در چارچوب اهداف منتشرشده و سپس احراز شرایط قرارداد حساب فاندشده است. خرید، فعال‌سازی و اعلام نتیجهٔ خودکار ارزیابی هنوز پیاده‌سازی نشده‌اند.'),
    t('Today, use the terminal to explore simulated trading. Connecting a wallet and signing in does not purchase a challenge or prove that an evaluation has been passed.', 'در حال حاضر می‌توانی معاملات شبیه‌سازی‌شده را در ترمینال تجربه کنی. اتصال کیف پول و ورود به حساب، خرید چالش یا اثبات قبولی در ارزیابی نیست.'),
  ] },
  { id: 'terminology', title: t('Account terminology', 'واژه‌های حساب و ارزیابی'), status: 'current', paragraphs: [
    t('Keep account accounting separate from evaluation status. An account record can exist even when evaluation rules are not active.', 'حسابداری حساب را از وضعیت ارزیابی جدا در نظر بگیر. وجود سابقهٔ حساب به معنی فعال‌بودن قواعد ارزیابی نیست.'),
  ], table: { caption: t('A common vocabulary', 'واژه‌نامهٔ مشترک'), columns: [t('Term', 'اصطلاح'), t('Meaning', 'معنی')], rows: [
    [t('Demo account', 'حساب دمو'), t('A virtual trading account; it holds no customer deposit.', 'حساب معاملاتی مجازی؛ سپردهٔ مشتری نگهداری نمی‌کند.')],
    [t('Evaluation', 'ارزیابی'), t('A planned assessment with a published target and risk limits.', 'سنجش برنامه‌ریزی‌شده با هدف و حدود ریسک منتشرشده.')],
    [t('Phase', 'مرحله'), t('One assessment step; phase transitions are not active.', 'یک گام سنجش؛ انتقال خودکار میان مراحل فعال نیست.')],
    [t('Funded account', 'حساب فاندشده'), t('A future contractual framework, not a current demo entitlement.', 'چارچوب قراردادی آینده، نه امتیازی ایجادشده با حساب دمو.')],
  ] } },
  { id: 'configurations', title: t('Account configurations', 'ترکیب‌های حساب'), status: 'draft', paragraphs: [
    t('The current authenticated demo allocates 100,000 virtual DAI once per user. It has no deposits, withdrawals, refills or resets. Visitors without a signed-in session can see a separate browser demo.', 'دموی فعلی پس از ورود، یک‌بار ۱۰۰٬۰۰۰ دای مجازی به هر کاربر اختصاص می‌دهد. واریز، برداشت، شارژ مجدد و بازنشانی ندارد. بازدیدکنندهٔ واردنشده ممکن است دموی جداگانهٔ مرورگر را ببیند.'),
    t('The following configurations exist as plan-catalog seed metadata. They are not purchasable offers or enforced evaluation rules; commercial terms require approval.', 'ترکیب‌های زیر در دادهٔ اولیهٔ فهرست پلن‌ها وجود دارند. این موارد پیشنهاد قابل خرید یا قواعد اجرایی ارزیابی نیستند؛ شرایط تجاری نیازمند تصویب‌اند.'),
  ], table: { caption: t('Provisional catalog presets · inactive', 'نمونه‌های موقت فهرست پلن‌ها · غیرفعال'), columns: [t('Plan', 'پلن'), t('Sample size · USD', 'اندازهٔ نمونه · دلار'), t('Phases', 'مراحل'), t('Daily / total loss', 'زیان روزانه / کل')], rows: [
    [t('Starter', 'شروع'), t('5,000 / 10,000 / 20,000', '۵٬۰۰۰ / ۱۰٬۰۰۰ / ۲۰٬۰۰۰'), t('2', '۲'), t('3% / 3%', '۳٪ / ۳٪')],
    [t('Standard', 'استاندارد'), t('10,000 / 50,000 / 100,000', '۱۰٬۰۰۰ / ۵۰٬۰۰۰ / ۱۰۰٬۰۰۰'), t('2', '۲'), t('3% / 6%', '۳٪ / ۶٪')],
    [t('Single phase', 'تک‌مرحله‌ای'), t('10,000 / 50,000 / 100,000', '۱۰٬۰۰۰ / ۵۰٬۰۰۰ / ۱۰۰٬۰۰۰'), t('1', '۱'), t('3% / 3%', '۳٪ / ۳٪')],
  ] } },
  { id: 'stages', title: t('Evaluation stages', 'مراحل ارزیابی'), status: 'draft', paragraphs: [
    t('One-phase and two-phase paths appear in the prototype. In the two-phase concept, evaluation is followed by a verification phase. A completed demo trade does not advance either path.', 'مسیرهای یک‌مرحله‌ای و دومرحله‌ای در نمونهٔ محصول دیده می‌شوند. در طرح دومرحله‌ای، ارزیابی با مرحلهٔ تأیید مهارت ادامه می‌یابد. انجام معاملهٔ دمو هیچ‌یک از این مسیرها را جلو نمی‌برد.'),
    t('Time limits, minimum trading days, open-position requirements and the conditions for moving to another phase must be confirmed in the final plan. No automatic progression is promised here.', 'مهلت، حداقل روز معاملاتی، وضعیت لازم برای موقعیت‌های باز و شرایط رفتن به مرحلهٔ بعد باید در پلن نهایی تأیید شوند. این سند پیشرفت خودکار را وعده نمی‌دهد.'),
  ] },
  { id: 'targets', title: t('Profit targets', 'اهداف سود'), status: 'draft', paragraphs: [
    t('The landing’s illustrative builder shows 5% then 10% for two phases, and 10% for a single phase. These are prototype examples, not confirmed commercial obligations or targets enforced by the demo engine.', 'حساب‌ساز نمایشی صفحهٔ اصلی برای مسیر دومرحله‌ای ۵٪ و سپس ۱۰٪، و برای تک‌مرحله‌ای ۱۰٪ نشان می‌دهد. این اعداد نمونهٔ محصول‌اند، نه تعهد تجاری تأییدشده یا اهدافی که موتور دمو اجرا کند.'),
    t('A final target must specify whether it uses closed net profit after all costs, how open positions are handled and how passing is recorded. Until approved, the target percentage remains provisional.', 'هدف نهایی باید روشن کند که آیا سود خالص معاملات بسته‌شده پس از همهٔ هزینه‌ها ملاک است، موقعیت‌های باز چگونه لحاظ می‌شوند و قبولی چگونه ثبت می‌شود. تا زمان تصویب، درصد هدف موقت است.'),
  ], formula: 'Illustrative target amount = starting balance × target rate', explanation: {
    title: t('Read an example without treating it as a rule', 'مثال را با قانون نهایی اشتباه نگیر'),
    body: t('A 5% example on a 10,000-unit account gives a 500-unit target. This arithmetic explains the concept only; it does not set an Openfund purchase condition.', 'در مثالِ هدف ۵٪ برای حساب ۱۰٬۰۰۰ واحدی، مقدار هدف ۵۰۰ واحد است. این محاسبه فقط مفهوم را توضیح می‌دهد و شرط خرید اوپن‌فاند تعیین نمی‌کند.'),
  } },
  { id: 'daily-loss', title: t('Daily loss limit', 'حد زیان روزانه'), status: 'draft', paragraphs: [
    t('Daily loss percentages in the plan catalog are sample metadata. The demo does not currently apply a commercial challenge daily-loss rule.', 'درصد زیان روزانه در فهرست پلن‌ها، دادهٔ نمونه است. دمو در حال حاضر قانون زیان روزانهٔ چالش تجاری را اعمال نمی‌کند.'),
    t('The final policy must define the reference balance or equity, rolling versus calendar-day measurement, time zone, unrealized PnL, fees and the exact breach boundary. A midnight reset or rolling 24-hour rule must not be assumed.', 'سیاست نهایی باید مبنای موجودی یا ارزش خالص، بازهٔ شناور یا روز تقویمی، منطقهٔ زمانی، سود و زیان شناور، کارمزد و مرز دقیق نقض را تعیین کند. بازنشانی در نیمه‌شب یا بازهٔ شناور ۲۴ساعته را نباید فرض کرد.'),
  ] },
  { id: 'maximum-loss', title: t('Maximum loss limit', 'حد زیان کل'), status: 'draft', paragraphs: [
    t('Maximum-loss percentages in sample plans are not a live evaluation guard. Margin checks and simulated liquidation in the terminal serve a different purpose.', 'درصد زیان کل در پلن‌های نمونه، کنترل فعال ارزیابی نیست. بررسی وجه تضمین و لیکوییدشدن شبیه‌سازی‌شده در ترمینال، کارکرد دیگری دارند.'),
    t('A final agreement must choose a static or trailing method, identify whether equity or balance is measured, and describe the effects of profits and future payouts. No trailing floor is asserted in this draft.', 'قرارداد نهایی باید روش ثابت یا متحرک، مبنای ارزش خالص یا موجودی و اثر سود و برداشت‌های آینده را مشخص کند. این پیش‌نویس وجود کف زیان متحرک را تأیید نمی‌کند.'),
  ] },
  { id: 'equity-balance', title: t('Equity, balance and margin', 'ارزش خالص، موجودی و وجه تضمین'), status: 'current', paragraphs: [
    t('Balance reflects virtual funding and realized ledger changes, including charged fees. Equity adds the unrealized PnL of open positions. Used margin reserves capacity for positions without reducing the balance itself.', 'موجودی، تأمین مجازی و تغییرات تحقق‌یافتهٔ دفتر حساب، از جمله کارمزدهای کسرشده را نشان می‌دهد. ارزش خالص، سود و زیان شناور موقعیت‌های باز را به آن اضافه می‌کند. وجه تضمین مصرف‌شده، ظرفیت موقعیت‌ها را رزرو می‌کند و خودِ موجودی را کاهش نمی‌دهد.'),
    t('The authenticated server account is authoritative. Portfolio views summarize its trade records; the public sample dashboard is independent of your account.', 'برای حساب احرازشده، سوابق سرور مرجع‌اند. پرتفوی، سوابق معاملات همان حساب را خلاصه می‌کند؛ داشبورد عمومیِ نمونه، مستقل از حساب توست.'),
  ], formula: 'Equity = balance + Σ unrealized PnL\nFree margin = balance − used margin', explanation: {
    title: t('Why equity can move before a trade closes', 'چرا ارزش خالص پیش از بستن معامله تغییر می‌کند؟'),
    body: t('With a balance of 100,000 and unrealized PnL of −700, equity is 99,300. Closing the position realizes PnL and applies the closing fee; the displayed unrealized figure alone is not the final net result.', 'با موجودی ۱۰۰٬۰۰۰ و زیان شناور ۷۰۰، ارزش خالص ۹۹٬۳۰۰ است. بستن موقعیت، سود یا زیان را محقق و کارمزد خروج را اعمال می‌کند؛ عدد شناور به‌تنهایی نتیجهٔ خالص نهایی نیست.'),
  } },
  { id: 'violations', title: t('Rule violations and account status', 'نقض قواعد و وضعیت حساب'), status: 'draft', paragraphs: [
    t('The demo rejects invalid orders, insufficient margin and stale execution prices. Suspended users cannot trade. Simulated liquidation is implemented; challenge failure and payout forfeiture are not.', 'دمو سفارش نامعتبر، وجه تضمین ناکافی و قیمت کهنهٔ اجرا را رد می‌کند. کاربران تعلیق‌شده امکان معامله ندارند. لیکوییدشدن شبیه‌سازی‌شده پیاده شده؛ مردودی چالش و سلب حق برداشت پیاده نشده‌اند.'),
    t('Commercial breach triggers, position closure, appeal handling, resets and account termination need a final published policy. A rejected demo order is not evidence that a commercial challenge was failed.', 'شرایط نقض تجاری، بستن موقعیت، رسیدگی به اعتراض، بازنشانی و خاتمهٔ حساب به سیاست نهایی منتشرشده نیاز دارند. ردشدن سفارش دمو، نشانهٔ مردودی چالش تجاری نیست.'),
  ] },
  { id: 'conditions', title: t('Trading conditions', 'شرایط معامله'), status: 'current', paragraphs: [
    t('The authenticated demo supports market, limit and stop orders, long and short positions, stop-loss and take-profit updates, closing and simulated liquidation. Fresh server marks drive execution; fills are simulations.', 'دموی پس از ورود از سفارش بازار، لیمیت و استاپ، موقعیت خرید و فروش، تغییر حد ضرر و حد سود، بستن موقعیت و لیکوییدشدن شبیه‌سازی‌شده پشتیبانی می‌کند. قیمت تازهٔ سرور مبنای اجراست و معاملات شبیه‌سازی می‌شوند.'),
    t('The documented model uses fee and spread assumptions. It does not simulate liquidity impact, funding or borrowing costs. After a feed outage, triggers use the first fresh mark; missing ticks are not replayed. Demo results cannot establish live execution quality.', 'مدل مستند، فرض‌هایی برای کارمزد و اسپرد دارد. اثر نقدینگی، هزینهٔ تأمین مالی و استقراض شبیه‌سازی نمی‌شود. پس از قطعی داده، سفارش‌های شرطی با نخستین قیمت تازه بررسی می‌شوند و تیک‌های ازدست‌رفته بازپخش نمی‌شوند. نتیجهٔ دمو کیفیت اجرای واقعی را اثبات نمی‌کند.'),
    t('News trading, weekend holding, automated strategies and minimum holding periods require a separate commercial policy. No competitor’s restrictions or permissions are adopted here.', 'معامله هنگام اخبار، نگهداری آخر هفته، راهبرد خودکار و حداقل زمان نگهداری به سیاست تجاری جداگانه نیاز دارند. محدودیت‌ها یا مجوزهای رقیب در این سند پذیرفته نشده‌اند.'),
  ] },
  { id: 'markets', title: t('Available markets', 'بازارهای در دسترس'), status: 'current', paragraphs: [
    t('The application loads market metadata and marks from Gains Network. The interface groups instruments into crypto, forex, stocks, indices and commodities. The available list and each market’s status can change.', 'برنامه مشخصات بازار و قیمت مرجع را از Gains Network می‌خواند. ابزارها در رابط به رمزارز، فارکس، سهام، شاخص و کالا دسته‌بندی می‌شوند. فهرست در دسترس و وضعیت هر بازار می‌تواند تغییر کند.'),
    t('Check the terminal for the current instrument and trading status. A market-data listing is not a guarantee of availability under a future paid plan or evidence of real on-chain execution.', 'نماد و وضعیت فعلی معامله را در ترمینال بررسی کن. حضور در فهرست داده، تضمین دسترسی در پلن پولی آینده یا مدرک اجرای واقعی آن‌چین نیست.'),
  ] },
  { id: 'leverage', title: t('Leverage and exposure', 'اهرم و اندازهٔ موقعیت'), status: 'current', paragraphs: [
    t('The demo validates whole-number leverage against the market metadata limit, with a configured fallback when metadata is absent. The sample landing builder’s 5× figure is a prototype plan setting, not a universal live limit.', 'دمو اهرم صحیح را با سقف مشخصات بازار می‌سنجد و در نبود آن از مقدار جایگزین تنظیم‌شده استفاده می‌کند. عدد ۵ برابر در حساب‌ساز صفحهٔ اصلی، تنظیم پلن نمونه است، نه سقف عمومیِ تأییدشده.'),
    t('Leverage increases notional exposure for the same margin and amplifies both profit and loss. Future plan-specific limits and exposure caps need approval before commercial use.', 'اهرم، ارزش اسمی موقعیت را برای وجه تضمین یکسان افزایش می‌دهد و سود و زیان را بزرگ‌تر می‌کند. حدود اختصاصی پلن و سقف‌های مواجههٔ آینده پیش از استفادهٔ تجاری باید تصویب شوند.'),
  ], formula: 'Notional exposure = margin × leverage\nQuantity = notional exposure / execution price' },
  { id: 'funded', title: t('Funded-account framework', 'چارچوب حساب فاندشده'), status: 'planned', paragraphs: [
    t('Funded accounts belong to the proposed product model. Current demo activity does not create a right to capital, profit sharing or withdrawals.', 'حساب فاندشده بخشی از مدل پیشنهادی محصول است. فعالیت دموی فعلی، حق دریافت سرمایه، سهم سود یا برداشت ایجاد نمی‌کند.'),
    t('Before launch, the agreement must identify the account’s simulated or live nature, capital arrangements, risk limits, reward eligibility and termination process. Hybrid routing, liquidity pools and on-chain settlement are not current verified services.', 'پیش از عرضه، قرارداد باید ماهیت شبیه‌سازی‌شده یا واقعی حساب، سازوکار سرمایه، حدود ریسک، شرایط پاداش و فرایند خاتمه را مشخص کند. مسیریابی هیبریدی، استخر نقدینگی و تسویهٔ آن‌چین خدمات فعلیِ تأییدشده نیستند.'),
  ] },
  { id: 'identity', title: t('Identity and eligibility', 'هویت و شرایط دسترسی'), status: 'draft', paragraphs: [
    t('Wallet connection and Sign-In with Ethereum establish wallet ownership for the current session. One wallet maps to one user identity; a user may own multiple challenge records. A wallet signature is not identity-document verification.', 'اتصال کیف پول و ورود با امضای اتریوم، مالکیت کیف پول را برای نشست فعلی مشخص می‌کنند. هر کیف پول به یک هویت کاربر مرتبط است و کاربر می‌تواند چند سابقهٔ چالش داشته باشد. امضای کیف پول، احراز هویت با مدرک شناسایی نیست.'),
    t('KYC requirements, provider, accepted documents, age, geography, deadlines and appeal paths have not been finalized. Do not send identity documents to an unannounced channel or infer eligibility from demo access.', 'الزامات احراز هویت، ارائه‌دهنده، مدارک پذیرفته‌شده، سن، جغرافیا، مهلت و مسیر اعتراض نهایی نشده‌اند. مدارک هویتی را به مسیر اعلام‌نشده نفرست و از دسترسی دمو، واجدشرایط‌بودن را نتیجه نگیر.'),
  ] },
  { id: 'fees', title: t('Fees and costs', 'کارمزد و هزینه‌ها'), status: 'draft', paragraphs: [
    t('The free authenticated demo uses virtual accounting. The engine charges simulated entry and exit fees by asset class on initial notional. Spread assumptions affect execution prices; they are distinct from fees.', 'دموی رایگان پس از ورود از حسابداری مجازی استفاده می‌کند. موتور، کارمزد شبیه‌سازی‌شدهٔ ورود و خروج را بر اساس دستهٔ دارایی و ارزش اسمی اولیه می‌گیرد. فرض اسپرد بر قیمت اجرا اثر دارد و از کارمزد جداست.'),
    t('The demo’s documented per-side fee tiers are 0.035% for BTC/ETH, 0.05% for other crypto and 0.012% for forex, with a 0.06% fallback for other classes. These simulation settings are not a commercial fee schedule or a promise of Gains execution parity.', 'رده‌های مستند کارمزد دمو در هر سمت، ۰٫۰۳۵٪ برای بیت‌کوین و اتریوم، ۰٫۰۵٪ برای سایر رمزارزها و ۰٫۰۱۲٪ برای فارکس است؛ برای سایر دسته‌ها مقدار جایگزین ۰٫۰۶٪ استفاده می‌شود. این تنظیمات شبیه‌سازی، تعرفهٔ تجاری یا وعدهٔ برابری با اجرای Gains نیستند.'),
    t('Challenge prices, taxes, refunds, recurring charges and payout fees remain unconfirmed. Prices shown in the landing’s sample builder are illustrative; purchasing is not enabled.', 'قیمت چالش، مالیات، استرداد وجه، هزینهٔ دوره‌ای و کارمزد برداشت هنوز تأیید نشده‌اند. قیمت‌های حساب‌ساز صفحهٔ اصلی نمونه‌اند و خرید فعال نیست.'),
  ] },
  { id: 'payouts', title: t('Payouts and profit sharing', 'برداشت و تقسیم سود'), status: 'planned', paragraphs: [
    t('There is no withdrawal from the virtual demo balance. No production payout history, reserve balance or funded-trader reward is asserted on this page.', 'از موجودی مجازی دمو نمی‌توان برداشت کرد. این صفحه وجود سابقهٔ برداشت واقعی، موجودی ذخیره یا پاداش معامله‌گر فاندشده را ادعا نمی‌کند.'),
    t('The seed catalog includes illustrative trader shares of 60% and 80%. Final splits, minimums, timing, caps, currency, networks and verification requirements need commercial approval. No 24-hour payment promise is made here.', 'فهرست اولیه، سهم‌های نمایشی ۶۰٪ و ۸۰٪ برای معامله‌گر دارد. سهم نهایی، حداقل مبلغ، زمان، سقف، ارز، شبکه و شرایط تأیید به تصویب تجاری نیاز دارند. این سند وعدهٔ پرداخت ۲۴ساعته نمی‌دهد.'),
  ] },
  { id: 'verification', title: t('Transparency and verification', 'شفافیت و راستی‌آزمایی'), status: 'current', paragraphs: [
    t('The authenticated account records orders, positions and ledger events on the server. Portfolio analytics summarize those records. These are application records, not public cryptographic proofs.', 'حساب پس از ورود، سفارش‌ها، موقعیت‌ها و رویدادهای دفتر حساب را در سرور ثبت می‌کند. تحلیل پرتفوی خلاصهٔ همان سوابق است. این‌ها سوابق برنامه‌اند، نه اثبات رمزنگاری عمومی.'),
    t('The Transparency page uses a separate, explicitly labelled sample dataset to demonstrate a future reporting interface. It is not live reserves, verified performance or an audit. Public verification and independent review remain planned.', 'صفحهٔ شفافیت برای نمایش رابط گزارش‌دهی آینده، مجموعه‌دادهٔ مستقل و صریحاً نمونه به کار می‌برد. این داده، ذخایر زنده، عملکرد راستی‌آزمایی‌شده یا حسابرسی نیست. راستی‌آزمایی عمومی و بررسی مستقل همچنان برنامه‌ریزی‌شده‌اند.'),
  ] },
  { id: 'practices', title: t('Prohibited practices', 'رفتارهای ممنوع'), status: 'draft', paragraphs: [
    t('The current application enforces account ownership, signature checks and suspension. Never share a seed phrase, impersonate another wallet holder or attempt to access someone else’s account records.', 'برنامهٔ فعلی مالکیت حساب، اعتبار امضا و تعلیق را کنترل می‌کند. عبارت بازیابی را به اشتراک نگذار، خود را صاحب کیف پول دیگری معرفی نکن و برای دسترسی به سوابق دیگران اقدام نکن.'),
    t('A commercial policy on manipulation, coordinated accounts, technical exploits, cross-account hedging, bots and third-party account management remains to be approved. This draft does not invent holding-time penalties, profit cancellation or automatic forfeitures.', 'سیاست تجاری دربارهٔ دستکاری، حساب‌های هماهنگ، سوءاستفادهٔ فنی، هج میان حساب‌ها، ربات و مدیریت حساب توسط دیگران هنوز نیازمند تصویب است. این پیش‌نویس جریمهٔ زمان نگهداری، حذف سود یا سلب خودکار حقوق وضع نمی‌کند.'),
  ] },
  { id: 'summary', title: t('Rules at a glance', 'خلاصهٔ قواعد'), status: 'current', paragraphs: [
    t('Use this checklist to distinguish what you can do today from the terms a future product still needs to publish.', 'این فهرست، امکانات امروز را از شرایطی که محصول آینده باید منتشر کند جدا می‌کند.'),
  ], table: { caption: t('Current state of the product', 'وضعیت فعلی محصول'), columns: [t('Topic', 'موضوع'), t('Current state', 'وضعیت فعلی')], rows: [
    [t('Demo funding', 'تأمین دمو'), t('100,000 virtual DAI, once per authenticated user', '۱۰۰٬۰۰۰ دای مجازی، یک‌بار برای هر کاربر پس از ورود')],
    [t('Demo execution', 'اجرای دمو'), t('Server simulation using Gains market data', 'شبیه‌سازی سرور با دادهٔ بازار Gains')],
    [t('Evaluation targets and loss limits', 'هدف و حدود زیان ارزیابی'), t('Provisional; no active evaluation engine', 'موقت؛ موتور فعال ارزیابی وجود ندارد')],
    [t('Buying challenges', 'خرید چالش'), t('Planned', 'برنامه‌ریزی‌شده')],
    [t('Funded accounts and payouts', 'حساب فاندشده و برداشت'), t('Planned; no demo withdrawals', 'برنامه‌ریزی‌شده؛ دمو برداشت ندارد')],
    [t('Public reporting', 'گزارش عمومی'), t('Sample dashboard, not verified live figures', 'داشبورد نمونه، نه آمار زندهٔ تأییدشده')],
  ] } },
  { id: 'support', title: t('Support and account security', 'پشتیبانی و امنیت حساب'), status: 'current', paragraphs: [
    t('Before signing, check the site origin and the purpose of the message. Demo trading does not require a transfer or token approval. Never disclose your private key or seed phrase.', 'پیش از امضا، نشانی سایت و هدف پیام را بررسی کن. معاملهٔ دمو به انتقال دارایی یا مجوز برداشت توکن نیاز ندارد. کلید خصوصی یا عبارت بازیابی را هرگز افشا نکن.'),
    t('For a reproducible product issue, use the project’s GitHub issue tracker without posting private account data. Include the page, approximate time, language and steps. A commercial support channel, response commitment and appeals process are not finalized.', 'برای گزارش خطای قابل تکرار محصول، از بخش Issues پروژه در گیت‌هاب استفاده کن و دادهٔ خصوصی حساب را منتشر نکن. صفحه، زمان تقریبی، زبان و مراحل رخداد را بنویس. کانال پشتیبانی تجاری، تعهد زمان پاسخ و فرایند اعتراض هنوز نهایی نشده‌اند.'),
  ] },
]
