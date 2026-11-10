import type { WpChapter } from '../../whitepaper/types'
import { text as t } from '../../../features/information/content'

/* Chapters 8–13: trading infrastructure, prop evaluation, business model,
   unit economics, treasury and partner programs. Prices are never typed
   here: the pricing block renders the challenge catalog itself. */
export const economyChapters: WpChapter[] = [
  {
    slug: 'trading-infrastructure', sort: 8,
    kicker: t('Trading Infrastructure', 'زیرساخت معاملاتی'),
    title: t('A terminal that tells you where every number comes from.', 'ترمینالی که می‌گوید هر عدد از کجا آمده است.'),
    summary: t('The shared terminal, market data, the simulated execution engine and its accounting.', 'ترمینال مشترک، دادهٔ بازار، موتور اجرای شبیه‌سازی‌شده و حسابداری آن.'),
    blocks: [
      { type: 'p', text: t(
        'The Openfund terminal is a single workspace used by both products. It embeds the Vela charting engine, fed by an Openfund adapter for Gains Network candles and live prices, and adds market discovery, an order ticket, open positions, order history, a portfolio and a private journal. The product context decides which financial authority answers: the Openfund engine for Prop, the trader’s own wallet records for Perpetual.',
        'ترمینال اوپن‌فاند یک فضای کاری واحد است که هر دو محصول از آن استفاده می‌کنند. موتور چارت Vela را با آداپتور اوپن‌فاند برای کندل‌ها و قیمت‌های لحظه‌ای Gains Network در خود دارد و کشف بازار، فرم سفارش، پوزیشن‌های باز، تاریخچهٔ سفارش، پورتفولیو و ژورنال خصوصی را به آن می‌افزاید. زمینهٔ محصول تعیین می‌کند کدام مرجع مالی پاسخ دهد: موتور اوپن‌فاند برای پراپ و سوابق کیف پول خود معامله‌گر برای پرپچوال.') },
      { type: 'features', items: [
        { status: 'live', title: t('Server-authoritative execution', 'اجرای با مرجعیت سرور'), text: t('Market, limit and stop orders, stop-loss and take-profit, cancellation, partial close and liquidation are executed by the backend against fresh server marks — never by the browser.', 'سفارش‌های بازار، محدود و توقف، حد ضرر و حد سود، لغو، بستن بخشی و لیکوئید شدن توسط بک‌اند و با قیمت‌های تازهٔ سرور اجرا می‌شوند — هرگز توسط مرورگر.') },
        { status: 'live', title: t('Decimal accounting', 'حسابداری دهدهی'), text: t('Money arithmetic uses decimal types, charges fees and spread on both legs of a round trip and treats stale prices as unknown.', 'محاسبات پولی با نوع دهدهی انجام می‌شود، کارمزد و اسپرد در هر دو سوی معامله اعمال می‌شود و قیمت کهنه نامعلوم تلقی می‌شود.') },
        { status: 'live', title: t('Idempotent, owned operations', 'عملیات تکرارپذیر و مالکیت‌دار'), text: t('Every order is scoped to its owner and account and safe to retry; updates are transactional and pushed to the terminal over Server-Sent Events.', 'هر سفارش به مالک و حساب خود محدود است و تکرار آن بی‌خطر است؛ به‌روزرسانی‌ها تراکنشی‌اند و از طریق Server-Sent Events به ترمینال ارسال می‌شوند.') },
        { status: 'live', title: t('Portfolio and journal', 'پورتفولیو و ژورنال'), text: t('Owned positions, fee-aware analytics, filters and CSV export, plus private notes with tags and versioning.', 'پوزیشن‌های متعلق به کاربر، تحلیل‌های حساس به کارمزد، فیلتر و خروجی CSV، به‌علاوهٔ یادداشت‌های خصوصی با برچسب و نسخه.') },
        { status: 'development', title: t('Proprietary indicators', 'اندیکاتورهای اختصاصی'), text: t('Three original Pine indicators run in a shared worker; full reference conformance and deployed acceptance remain open.', 'سه اندیکاتور اصلی Pine در یک worker مشترک اجرا می‌شوند؛ انطباق کامل با مرجع و پذیرش در محیط اصلی هنوز باز است.') },
        { status: 'planned', title: t('Live order routing', 'مسیریابی سفارش واقعی'), text: t('Submitting real orders to Gains Network from the terminal is not enabled. It depends on supported testnet contracts, simulation and a security review.', 'ارسال سفارش واقعی از ترمینال به Gains Network فعال نیست و به قراردادهای آزمایشی پشتیبانی‌شده، شبیه‌سازی تراکنش و بازبینی امنیتی وابسته است.') },
      ] },
      { type: 'callout', tone: 'info', title: t('Simulated means simulated', 'شبیه‌سازی یعنی شبیه‌سازی'), text: t(
        'In Openfund Prop, an order fills against the server mark inside Openfund. No position is opened on any exchange and no one takes market risk on it. The balances are virtual units in a database, not tokens on a blockchain.',
        'در اوپن‌فاند پراپ، سفارش با قیمت مرجع سرور و درون اوپن‌فاند اجرا می‌شود. هیچ پوزیشنی در هیچ صرافی باز نمی‌شود و هیچ‌کس روی آن ریسک بازار نمی‌پذیرد. موجودی‌ها واحدهای مجازی در پایگاه داده‌اند، نه توکن روی بلاکچین.') },
      { type: 'refs', keys: ['gains-integration', 'vela', 'feature-status'] },
    ],
  },
  {
    slug: 'prop-evaluation', sort: 9,
    kicker: t('Prop Trading & Evaluation', 'پراپ‌تریدینگ و ارزیابی'),
    title: t('From purchase to reward, every step on the record.', 'از خرید تا پاداش، هر گام ثبت‌شده.'),
    summary: t('The trader journey, the published programs and how the evaluation engine decides.', 'مسیر معامله‌گر، برنامه‌های منتشرشده و نحوهٔ تصمیم‌گیری موتور ارزیابی.'),
    blocks: [
      { type: 'flow', label: t('The Openfund Prop trader journey', 'مسیر معامله‌گر در اوپن‌فاند پراپ'), steps: [
        { title: t('1 · Challenge purchase', '۱ · خرید چلنج'), text: t('Connect a wallet, choose a program and account size, pay a server-set price. The payment is verified on-chain before the account exists.', 'اتصال کیف پول، انتخاب برنامه و اندازهٔ حساب و پرداخت قیمت تعیین‌شده در سرور. پرداخت پیش از ایجاد حساب روی زنجیره تأیید می‌شود.'), status: 'implemented' },
        { title: t('2 · Evaluation', '۲ · ارزیابی'), text: t('Trade a simulated account under the rule version frozen at purchase: profit targets, daily and maximum loss limits, minimum trading days.', 'معامله روی حساب شبیه‌سازی‌شده تحت نسخهٔ قوانینِ ثبت‌شده در لحظهٔ خرید: هدف سود، حدود زیان روزانه و کل، حداقل روزهای معاملاتی.'), status: 'live' },
        { title: t('3 · Simulated funded account', '۳ · حساب فاندد شبیه‌سازی‌شده'), text: t('After the final stage passes, the account of record continues as a simulated funded account. It is still a simulation.', 'پس از قبولی در مرحلهٔ نهایی، حساب ثبت‌شده به‌عنوان حساب فاندد شبیه‌سازی‌شده ادامه می‌یابد. این حساب همچنان شبیه‌سازی است.'), status: 'live' },
        { title: t('4 · Trader rewards', '۴ · پاداش معامله‌گر'), text: t('Eligible traders request a reward. Each request is reviewed, approved and transferred by an operator, and each step is recorded.', 'معامله‌گر واجد شرایط درخواست پاداش می‌دهد. هر درخواست توسط اپراتور بررسی، تأیید و منتقل می‌شود و هر گام ثبت می‌شود.'), status: 'implemented' },
      ] },
      { type: 'h3', text: t('Published programs and pricing', 'برنامه‌ها و قیمت‌های منتشرشده') },
      { type: 'p', text: t(
        'Openfund publishes four programs. The prices below are read directly from the challenge catalog — the same configuration the production catalog endpoint serves — so this paper cannot drift from the product. Program terms were adapted from published industry terms recorded in the repository research.',
        'اوپن‌فاند چهار برنامه منتشر کرده است. قیمت‌های زیر مستقیماً از کاتالوگ چلنج خوانده می‌شوند — همان پیکربندی‌ای که نقطهٔ پایانی کاتالوگ در محیط اصلی ارائه می‌دهد — بنابراین این سند نمی‌تواند از محصول فاصله بگیرد. شرایط برنامه‌ها با اقتباس از شرایط منتشرشده در صنعت که در پژوهش‌های مخزن ثبت شده تدوین شده‌اند.') },
      { type: 'pricing', caption: t('One-time evaluation fee by account size (USD), from the live challenge catalog', 'کارمزد یک‌بارهٔ ارزیابی بر اساس اندازهٔ حساب (دلار)، از کاتالوگ فعلی چلنج') },
      { type: 'table', caption: t('Core rules by program', 'قوانین اصلی هر برنامه'), head: [t('Rule', 'قاعده'), t('Standard (2-step)', 'استاندارد (دومرحله‌ای)'), t('One-phase', 'تک‌مرحله‌ای'), t('Instant', 'آنی')], rows: [
        [t('Profit target', 'هدف سود'), t('8% then 5%', '۸٪ سپس ۵٪'), t('12%', '۱۲٪'), t('None (no evaluation)', 'ندارد (بدون ارزیابی)')],
        [t('Daily loss limit', 'حد زیان روزانه'), t('5%', '۵٪'), t('3%', '۳٪'), t('3%', '۳٪')],
        [t('Maximum loss', 'حداکثر زیان'), t('10% static', '۱۰٪ ثابت'), t('12% static', '۱۲٪ ثابت'), t('5% trailing, locks at breakeven after 5% profit', '۵٪ شناور، پس از ۵٪ سود در نقطهٔ سربه‌سر قفل می‌شود')],
        [t('Minimum trading days', 'حداقل روزهای معاملاتی'), t('3', '۳'), t('0', '۰'), t('0', '۰')],
        [t('Reward split', 'سهم پاداش'), t('80%', '۸۰٪'), t('80%', '۸۰٪'), t('95%', '۹۵٪')],
      ] },
      { type: 'h3', text: t('How the evaluation engine decides', 'موتور ارزیابی چگونه تصمیم می‌گیرد') },
      { type: 'list', items: [
        t('The daily floor is measured from the larger of opening balance and opening equity at 00:00 UTC+3.', 'کف روزانه از بزرگ‌ترِ موجودی و ارزش حساب در آغاز روز، ساعت ۰۰:۰۰ به وقت UTC+3، سنجیده می‌شود.'),
        t('Maximum loss is static or trailing according to the program; trailing loss locks at breakeven once its profit threshold is reached.', 'حداکثر زیان بسته به برنامه ثابت یا شناور است؛ زیان شناور پس از رسیدن به آستانهٔ سود در نقطهٔ سربه‌سر قفل می‌شود.'),
        t('A target counts only on closed net profit, and a trading day is a UTC+3 day with at least one fill.', 'هدف فقط با سود خالص بسته‌شده محقق می‌شود و روز معاملاتی، روزی به وقت UTC+3 است که دست‌کم یک سفارش در آن اجرا شده باشد.'),
        t('On a breach the engine closes positions at the server mark, cancels pending orders and writes an immutable challenge event.', 'در صورت تخطی، موتور پوزیشن‌ها را با قیمت مرجع سرور می‌بندد، سفارش‌های در انتظار را لغو می‌کند و رویداد تغییرناپذیر چلنج ثبت می‌کند.'),
        t('When stage one of a two-step program passes, stage two is provisioned automatically under the same frozen rules.', 'با قبولی در مرحلهٔ اول برنامهٔ دومرحله‌ای، مرحلهٔ دوم به‌طور خودکار و با همان قوانین ثبت‌شده ایجاد می‌شود.'),
      ] },
      { type: 'callout', tone: 'warning', title: t('Simulated profit is not a payout', 'سود شبیه‌سازی‌شده پرداخت نیست'), text: t(
        'A simulated funded account does not trade in a real market. Rewards are paid by Openfund from its own funds under the program rules; they are not a share of market profits. A reward exists only once a request is approved and the transfer is recorded with a reference. Automated payout settlement and certificates are planned, not live.',
        'حساب فاندد شبیه‌سازی‌شده در بازار واقعی معامله نمی‌کند. پاداش را اوپن‌فاند طبق قوانین برنامه از منابع خود می‌پردازد و سهمی از سود بازار نیست. پاداش فقط زمانی وجود دارد که درخواست تأیید و انتقال با شمارهٔ مرجع ثبت شود. تسویهٔ خودکار پرداخت و گواهی‌نامه‌ها برنامه‌ریزی‌شده‌اند، نه فعال.') },
      { type: 'faq', items: [
        { q: t('Can the rules change after I buy a challenge?', 'آیا قوانین پس از خرید چلنج تغییر می‌کنند؟'), a: t('No. The rule set is snapshotted at purchase, and your account is evaluated against that snapshot for its whole life.', 'خیر. مجموعهٔ قوانین در لحظهٔ خرید ثبت می‌شود و حساب شما در تمام عمرش بر اساس همان نسخه ارزیابی می‌شود.') },
        { q: t('Is the Free Trial ever rewarded?', 'آیا تست رایگان پاداش دارد؟'), a: t('No. The Free Trial rehearses the two-step rules for fourteen days per phase and carries no reward and no conversion.', 'خیر. تست رایگان قوانین دومرحله‌ای را چهارده روز در هر مرحله تمرین می‌کند و پاداش یا امکان تبدیل ندارد.') },
        { q: t('Where can I read the engine?', 'موتور را کجا می‌توانم بخوانم؟'), a: t('The evaluation engine and its audit are in the public repository, linked in the references.', 'موتور ارزیابی و ممیزی آن در مخزن عمومی است و در منابع پیوند داده شده است.') },
      ] },
      { type: 'refs', keys: ['plan-catalog', 'prop-engine', 'adr-purchases'] },
    ],
  },
  {
    slug: 'business-model', sort: 10,
    kicker: t('Business Model', 'مدل کسب‌وکار'),
    title: t('Fees fund the system; verified surplus funds traders.', 'کارمزدها سامانه را تأمین می‌کنند و مازاد تأییدشده، معامله‌گران را.'),
    summary: t('How Openfund earns revenue, what it owes and what it must hold back.', 'اوپن‌فاند چگونه درآمد کسب می‌کند، چه تعهداتی دارد و چه چیزی را باید کنار بگذارد.'),
    blocks: [
      { type: 'p', text: t(
        'Openfund’s primary revenue is the one-time fee a trader pays for an evaluation. That revenue carries obligations: rewards owed to successful traders, commissions owed to ambassadors, infrastructure and operating costs, and the reserves management sets aside. Only what remains after all of them is capital the company could allocate to real markets — where, in the long term, Openfund would earn a share of verified realized profit.',
        'درآمد اصلی اوپن‌فاند کارمزد یک‌باره‌ای است که معامله‌گر برای ارزیابی می‌پردازد. این درآمد تعهداتی به همراه دارد: پاداش معامله‌گران موفق، کمیسیون سفیران، هزینه‌های زیرساخت و عملیات و ذخایری که مدیریت کنار می‌گذارد. فقط آنچه پس از همهٔ این‌ها باقی می‌ماند سرمایه‌ای است که شرکت می‌تواند به بازار واقعی تخصیص دهد — جایی که در بلندمدت اوپن‌فاند سهمی از سود تحقق‌یافتهٔ تأییدشده خواهد داشت.') },
      { type: 'flow', label: t('From purchase to capital', 'از خرید تا سرمایه'), steps: [
        { title: t('Challenge fee', 'کارمزد چلنج'), text: t('Server-priced, wallet-paid', 'با قیمت سرور، پرداخت با کیف پول') },
        { title: t('Payment verification', 'تأیید پرداخت'), text: t('On-chain receipt checks', 'بررسی رسید آن‌چین') },
        { title: t('Obligations', 'تعهدات'), text: t('Rewards, commissions, expenses', 'پاداش، کمیسیون، هزینه') },
        { title: t('Reserves', 'ذخایر'), text: t('Operational and risk', 'عملیاتی و ریسک') },
        { title: t('Allocatable capital', 'سرمایهٔ قابل تخصیص'), text: t('Verified and free', 'تأییدشده و آزاد') },
        { title: t('Live Market Access', 'اتصال به بازار'), text: t('Only above $500,000', 'فقط بالاتر از ۵۰۰٬۰۰۰ دلار'), status: 'planned' },
      ] },
      { type: 'table', caption: t('Revenue and cost lines', 'اقلام درآمد و هزینه'), head: [t('Line', 'قلم'), t('Nature', 'ماهیت'), t('Recognised when', 'زمان شناسایی')], rows: [
        [t('Challenge sales', 'فروش چلنج'), t('Revenue', 'درآمد'), t('The on-chain payment is verified and the order becomes paid', 'پرداخت آن‌چین تأیید و سفارش پرداخت‌شده می‌شود')],
        [t('Refunds and chargebacks', 'بازپرداخت و برگشت وجه'), t('Revenue reduction', 'کاهش درآمد'), t('An adjustment is recorded against the payment', 'اصلاحیه‌ای برای آن پرداخت ثبت می‌شود')],
        [t('Trader rewards', 'پاداش معامله‌گران'), t('Obligation, then outflow', 'تعهد، سپس خروجی'), t('Approved, then transferred with a reference', 'تأیید و سپس با شمارهٔ مرجع منتقل می‌شود')],
        [t('Ambassador commissions', 'کمیسیون سفیران'), t('Acquisition cost', 'هزینهٔ جذب'), t('In the same transaction that confirms a first purchase', 'در همان تراکنشی که نخستین خرید را تأیید می‌کند')],
        [t('Infrastructure and operations', 'زیرساخت و عملیات'), t('Expense', 'هزینه'), t('A verified invoice is recorded and checked by a second operator', 'فاکتور تأییدشده ثبت و توسط اپراتور دوم بررسی می‌شود')],
        [t('Openfund share of live profit', 'سهم اوپن‌فاند از سود واقعی'), t('Future revenue', 'درآمد آینده'), t('A profitable live trade is verified and settled (not enabled)', 'معاملهٔ واقعی سودآور تأیید و تسویه می‌شود (فعال نیست)')],
      ] },
      { type: 'callout', tone: 'principle', title: t('What Openfund does not do', 'آنچه اوپن‌فاند انجام نمی‌دهد'), text: t(
        'Openfund does not take deposits, does not manage customer funds, does not sell a token and does not promise returns. Trader rewards are business expenses governed by program rules, not investment income.',
        'اوپن‌فاند سپرده نمی‌پذیرد، وجوه مشتری را مدیریت نمی‌کند، توکن نمی‌فروشد و بازدهی وعده نمی‌دهد. پاداش معامله‌گران هزینهٔ کسب‌وکار و تابع قوانین برنامه است، نه درآمد سرمایه‌گذاری.') },
    ],
  },
  {
    slug: 'economics', sort: 11,
    kicker: t('Openfund Economics', 'اقتصاد اوپن‌فاند'),
    title: t('Gross sales are not profit. A wallet is not free capital.', 'فروش ناخالص سود نیست؛ کیف پول سرمایهٔ آزاد نیست.'),
    summary: t('Accounting definitions, an interactive illustrative scenario and the limits of industry benchmarks.', 'تعاریف حسابداری، یک سناریوی نمایشی تعاملی و محدودیت‌های شاخص‌های صنعت.'),
    blocks: [
      { type: 'p', text: t(
        'Prop-trading economics are easy to misread because the same dollar appears in several places at once. Openfund keeps each concept separate and reports each from its own record.',
        'اقتصاد پراپ‌تریدینگ به‌راحتی اشتباه خوانده می‌شود، زیرا یک دلار هم‌زمان در چند جا ظاهر می‌شود. اوپن‌فاند هر مفهوم را جدا نگه می‌دارد و هر یک را از سابقهٔ خودش گزارش می‌کند.') },
      { type: 'definitions', items: [
        { term: t('Gross sales', 'فروش ناخالص'), text: t('The total of verified challenge payments in a period.', 'مجموع پرداخت‌های تأییدشدهٔ چلنج در یک دوره.') },
        { term: t('Net revenue', 'درآمد خالص'), text: t('Gross sales minus refunds and chargebacks.', 'فروش ناخالص منهای بازپرداخت‌ها و برگشت وجه.') },
        { term: t('Trader payouts', 'پرداخت به معامله‌گران'), text: t('Rewards actually transferred, recorded with a reference. Approved but unpaid rewards are a liability, not a payout.', 'پاداش‌هایی که واقعاً منتقل و با شمارهٔ مرجع ثبت شده‌اند. پاداش تأییدشدهٔ پرداخت‌نشده بدهی است، نه پرداخت.') },
        { term: t('Operating costs', 'هزینه‌های عملیاتی'), text: t('Verified expenses — infrastructure, services, operations — each backed by an invoice reference.', 'هزینه‌های تأییدشده — زیرساخت، خدمات، عملیات — هر یک با شمارهٔ فاکتور.') },
        { term: t('Net profit', 'سود خالص'), text: t('Net revenue after payouts, commissions and operating costs for a period. It is a result, not a balance.', 'درآمد خالص پس از پرداخت‌ها، کمیسیون‌ها و هزینه‌های عملیاتی یک دوره. این یک نتیجه است، نه موجودی.') },
        { term: t('Treasury balance', 'موجودی خزانه'), text: t('What the public treasury wallet holds at a block, priced from oracle feeds. It includes money already owed.', 'آنچه کیف پول عمومی خزانه در یک بلاک نگه می‌دارد، با قیمت فیدهای اوراکل. شامل پولی است که از قبل بدهکار است.') },
        { term: t('Outstanding liabilities', 'بدهی‌های پرداخت‌نشده'), text: t('Approved unpaid rewards, unpaid commissions, unsettled profit shares, payable expenses and other recorded liabilities.', 'پاداش‌های تأییدشدهٔ پرداخت‌نشده، کمیسیون‌های پرداخت‌نشده، سهم‌های سود تسویه‌نشده، هزینه‌های قابل پرداخت و سایر بدهی‌های ثبت‌شده.') },
        { term: t('Available allocatable capital', 'سرمایهٔ آزاد قابل تخصیص'), text: t('Treasury balance minus liabilities, reserves and existing allocations. Unknown whenever any input is missing.', 'موجودی خزانه منهای بدهی‌ها، ذخایر و تخصیص‌های موجود. هرگاه هر ورودی موجود نباشد، نامعلوم است.') },
      ] },
      { type: 'h3', text: t('An illustrative scenario', 'یک سناریوی نمایشی') },
      { type: 'p', text: t(
        'The scenario below starts from $1,000,000 of gross challenge sales and an illustrative 56% trader payout ratio, leaving $440,000 before other expenses. Adjust any line to see how quickly costs and prudent reserves consume what looks like a large surplus. These are hypothetical values, not Openfund results.',
        'سناریوی زیر از ۱٬۰۰۰٬۰۰۰ دلار فروش ناخالص چلنج و نسبت پرداخت نمایشی ۵۶٪ آغاز می‌شود که پیش از سایر هزینه‌ها ۴۴۰٬۰۰۰ دلار باقی می‌گذارد. هر قلم را تغییر دهید تا ببینید هزینه‌ها و ذخایر محتاطانه با چه سرعتی مازادی را که بزرگ به نظر می‌رسد مصرف می‌کنند. این‌ها مقادیر فرضی‌اند، نه نتایج اوپن‌فاند.') },
      { type: 'chart', dataset: 'scenario-1m', interactive: true },
      { type: 'stats', items: [
        { value: '10%', label: t('Ambassador commission', 'کمیسیون سفیر'), note: t('Of the first confirmed purchase only', 'فقط از نخستین خرید تأییدشده') },
        { value: '10%', label: t('Coach share', 'سهم کوچ'), note: t('Of distributable realized live profit only', 'فقط از سود قابل‌توزیع تحقق‌یافتهٔ واقعی') },
        { value: '$500,000', label: t('Live program threshold', 'آستانهٔ برنامهٔ واقعی'), note: t('Verified available allocatable capital', 'سرمایهٔ آزاد قابل تخصیص تأییدشده') },
      ] },
      { type: 'callout', tone: 'risk', title: t('Methodology and limits', 'روش‌شناسی و محدودیت‌ها'), text: t(
        'No audited industry average for payout ratios exists. Published firm figures vary with product, period and definition. Openfund therefore uses benchmarks only to explain mechanics and publishes its own ratios exclusively from operational records on the Transparency page.',
        'هیچ میانگین حسابرسی‌شده‌ای برای نسبت پرداخت در صنعت وجود ندارد. ارقام منتشرشدهٔ شرکت‌ها با محصول، دوره و تعریف تغییر می‌کنند. از این رو اوپن‌فاند شاخص‌ها را فقط برای توضیح سازوکار به کار می‌برد و نسبت‌های خود را منحصراً از سوابق عملیاتی در صفحهٔ شفافیت منتشر می‌کند.') },
      { type: 'refs', keys: ['topstep-2025', 'fpfx-2024', 'economy-pr'] },
    ],
  },
  {
    slug: 'treasury-transparency', sort: 12,
    kicker: t('Transparency & Treasury', 'شفافیت و خزانه'),
    title: t('Every public figure has exactly one source.', 'هر عدد عمومی دقیقاً یک منبع دارد.'),
    summary: t('The transparency report, on-chain treasury snapshots and the financial position.', 'گزارش شفافیت، تصویر لحظه‌ای آن‌چین خزانه و موقعیت مالی.'),
    blocks: [
      { type: 'p', text: t(
        'The Openfund transparency model publishes aggregates computed from operational records: verified sales, refunds and chargebacks, challenge outcomes, rewards paid and awaiting transfer, verified expenses and the company’s financial position. Figures are never typed in by hand and never estimated; an empty period shows zeros, not samples.',
        'مدل شفافیت اوپن‌فاند آمار تجمیعی محاسبه‌شده از سوابق عملیاتی را منتشر می‌کند: فروش تأییدشده، بازپرداخت و برگشت وجه، نتایج چلنج‌ها، پاداش‌های پرداخت‌شده و در انتظار انتقال، هزینه‌های تأییدشده و موقعیت مالی شرکت. اعداد هرگز دستی وارد یا تخمین زده نمی‌شوند؛ دورهٔ خالی صفر نشان می‌دهد، نه دادهٔ نمونه.') },
      { type: 'features', items: [
        { status: 'implemented', title: t('Transparency report', 'گزارش شفافیت'), text: t('Public, cached for five minutes, aggregates only. Implemented and tested; released with the economy batch under review.', 'عمومی، با حافظهٔ موقت پنج‌دقیقه‌ای و فقط تجمیعی. پیاده‌سازی و آزموده شده؛ همراه بستهٔ اقتصادی در حال بازبینی منتشر می‌شود.') },
        { status: 'implemented', title: t('Treasury snapshots', 'تصویر لحظه‌ای خزانه'), text: t('Balances read on-chain at a single block every 60–120 minutes (90 by default) and valued only through Chainlink feeds; a failed read keeps the last good snapshot labelled stale.', 'موجودی‌ها هر ۶۰ تا ۱۲۰ دقیقه (پیش‌فرض ۹۰) در یک بلاک روی زنجیره خوانده و فقط با فیدهای Chainlink ارزش‌گذاری می‌شوند؛ در صورت خطا، آخرین تصویر سالم با برچسب «کهنه» نمایش داده می‌شود.') },
        { status: 'planned', title: t('Public treasury address', 'نشانی عمومی خزانه'), text: t('Not yet configured. Until management publishes it, the report states “Not configured” instead of showing a balance.', 'هنوز پیکربندی نشده است. تا زمانی که مدیریت آن را منتشر کند، گزارش به‌جای نمایش موجودی عبارت «پیکربندی نشده» را نشان می‌دهد.') },
      ] },
      { type: 'chart', dataset: 'capital-position' },
      { type: 'p', text: t(
        'The chart shows why the public treasury balance and available capital differ. The balance includes money already owed to traders and partners, expenses not yet paid, reserves management keeps against operational and market risk, and capital already allocated. The position is marked verified only when the snapshot is fresh and fully priced and both reserves have been set explicitly; otherwise it is reported as unknown, the missing inputs are listed, and no capital can be allocated.',
        'نمودار نشان می‌دهد چرا موجودی عمومی خزانه با سرمایهٔ آزاد متفاوت است. موجودی شامل پولی است که از قبل به معامله‌گران و همکاران بدهکار است، هزینه‌های هنوز پرداخت‌نشده، ذخایری که مدیریت در برابر ریسک عملیاتی و بازار نگه می‌دارد و سرمایه‌ای که قبلاً تخصیص یافته است. موقعیت فقط زمانی «تأییدشده» است که تصویر لحظه‌ای تازه و به‌طور کامل قیمت‌گذاری‌شده باشد و هر دو ذخیره صریحاً تعیین شده باشند؛ در غیر این صورت «نامعلوم» گزارش می‌شود، ورودی‌های ناقص فهرست می‌شوند و هیچ سرمایه‌ای قابل تخصیص نیست.') },
      { type: 'flow', label: t('Capital flow', 'جریان سرمایه'), steps: [
        { title: t('Verified inflows', 'ورودی‌های تأییدشده'), text: t('Challenge payments to the treasury', 'پرداخت چلنج به خزانه') },
        { title: t('Treasury snapshot', 'تصویر لحظه‌ای خزانه'), text: t('On-chain, oracle-priced', 'آن‌چین، با قیمت اوراکل') },
        { title: t('Minus obligations', 'منهای تعهدات'), text: t('From five record tables', 'از پنج جدول ثبت') },
        { title: t('Minus reserves', 'منهای ذخایر'), text: t('Set by management', 'تعیین‌شده توسط مدیریت') },
        { title: t('Minus allocations', 'منهای تخصیص‌ها'), text: t('Active live capital', 'سرمایهٔ واقعی فعال') },
        { title: t('Available capital', 'سرمایهٔ آزاد'), text: t('Or “unknown”', 'یا «نامعلوم»') },
      ] },
      { type: 'callout', tone: 'principle', title: t('Privacy by design', 'حریم خصوصی در طراحی'), text: t(
        'The report never contains user identifiers, user wallet addresses, per-trader outcomes or any link between a wallet and a failed challenge. Paid rewards are listed with date, amount and explorer link only.',
        'گزارش هرگز شناسهٔ کاربر، نشانی کیف پول کاربر، نتیجهٔ هر معامله‌گر یا ارتباطی میان یک کیف پول و چلنج ناموفق را در بر ندارد. پاداش‌های پرداخت‌شده فقط با تاریخ، مبلغ و پیوند مرورگر بلاک فهرست می‌شوند.') },
      { type: 'refs', keys: ['economy-pr', 'chainlink-feeds'] },
    ],
  },
  {
    slug: 'partner-programs', sort: 13,
    kicker: t('Ambassador & Coach Programs', 'برنامه‌های سفیر و کوچ'),
    title: t('Two independent roles, rewarded for real outcomes.', 'دو نقش مستقل، با پاداش برای نتایج واقعی.'),
    summary: t('The Brand Ambassador and Verified Trading Coach programs and their economics.', 'برنامه‌های سفیر برند و کوچ معاملاتی تأییدشده و اقتصاد آن‌ها.'),
    blocks: [
      { type: 'p', text: t(
        'Openfund grows through people who already teach and discuss markets. Two roles exist, each with its own public application, management review and ledger. One person may hold both, but each role must be approved independently, and approval in one grants nothing in the other.',
        'اوپن‌فاند از طریق کسانی رشد می‌کند که پیش‌تر دربارهٔ بازار آموزش می‌دهند و گفت‌وگو می‌کنند. دو نقش وجود دارد که هر یک درخواست عمومی، بازبینی مدیریت و دفتر مخصوص خود را دارد. یک نفر می‌تواند هر دو نقش را داشته باشد، اما هر نقش باید مستقلاً تأیید شود و تأیید یکی هیچ حقی در دیگری ایجاد نمی‌کند.') },
      { type: 'h3', text: t('Brand Ambassador', 'سفیر برند') },
      { type: 'features', items: [
        { title: t('Eligibility', 'شرایط'), text: t('At least 50,000 followers on Instagram or YouTube, an active presence on the other platform, relevant financial-markets content, an authentic audience and management approval.', 'دست‌کم ۵۰٬۰۰۰ دنبال‌کننده در اینستاگرام یا یوتیوب، حضور فعال در پلتفرم دیگر، محتوای مرتبط با بازارهای مالی، مخاطب واقعی و تأیید مدیریت.') },
        { title: t('Commission', 'کمیسیون'), text: t('10% of the confirmed net amount of a referred customer’s first eligible purchase only, recognised immediately upon confirmed payment.', '۱۰٪ از مبلغ خالص تأییدشدهٔ نخستین خرید واجد شرایط مشتری معرفی‌شده، که بلافاصله پس از تأیید پرداخت شناسایی می‌شود.') },
        { title: t('Adjustments', 'اصلاحات'), text: t('Refunds and chargebacks append proportional reversals; self-referral, suspended ambassadors and late attribution create no commission.', 'بازپرداخت و برگشت وجه، برگشت متناسب ثبت می‌کنند؛ معرفی خود، سفیر تعلیق‌شده و انتساب دیرهنگام کمیسیونی ایجاد نمی‌کنند.') },
      ] },
      { type: 'flow', label: t('Referral lifecycle', 'چرخهٔ معرفی'), steps: [
        { title: t('Apply', 'درخواست'), text: t('Public application with audience evidence', 'درخواست عمومی با شواهد مخاطب') },
        { title: t('Review', 'بازبینی'), text: t('Reviewer records verified counts', 'بازبین ارقام تأییدشده را ثبت می‌کند') },
        { title: t('Code issued', 'صدور کد'), text: t('Only at approval', 'فقط هنگام تأیید') },
        { title: t('Attribution', 'انتساب'), text: t('Referral link, once per customer', 'لینک معرفی، یک بار برای هر مشتری') },
        { title: t('Recognition', 'شناسایی'), text: t('In the payment transaction', 'در تراکنش پرداخت') },
        { title: t('Transfer', 'انتقال'), text: t('Operator payout with reference', 'پرداخت توسط اپراتور با شمارهٔ مرجع') },
      ] },
      { type: 'callout', tone: 'warning', title: t('Recognition is not transfer', 'شناسایی به معنای انتقال نیست'), text: t(
        'A recognised commission is a recorded obligation. It becomes income for the ambassador only when an operator transfers it and records the payout reference. Commissions depend on genuine first purchases and are never guaranteed income.',
        'کمیسیون شناسایی‌شده یک تعهد ثبت‌شده است و فقط زمانی برای سفیر درآمد می‌شود که اپراتور آن را منتقل و شمارهٔ مرجع پرداخت را ثبت کند. کمیسیون به خرید اول واقعی وابسته است و هرگز درآمد تضمین‌شده نیست.') },
      { type: 'h3', text: t('Verified Trading Coach', 'کوچ معاملاتی تأییدشده') },
      { type: 'p', text: t(
        'Coaches guide traders in risk discipline, assess their performance and verify their readiness for real capital. Applications are public and require a verifiable track record, risk-management and mentoring experience; there is no audience threshold. A trader links to a coach by code, the coach accepts, and while the link is active the coach records a qualification decision with a written note. Coaches see only their linked traders’ masked wallet and eligibility progress — never journals or private history.',
        'کوچ‌ها معامله‌گران را در انضباط ریسک راهنمایی، عملکردشان را ارزیابی و آمادگی‌شان برای سرمایهٔ واقعی را تأیید می‌کنند. درخواست‌ها عمومی‌اند و به سابقهٔ قابل راستی‌آزمایی، تجربهٔ مدیریت ریسک و منتورینگ نیاز دارند؛ آستانهٔ مخاطب وجود ندارد. معامله‌گر با کد به کوچ متصل می‌شود، کوچ می‌پذیرد و تا زمانی که ارتباط فعال است، تصمیم احراز صلاحیت را با یادداشت مکتوب ثبت می‌کند. کوچ فقط نشانی پوشیدهٔ کیف پول و پیشرفت احراز معامله‌گران متصل را می‌بیند — هرگز ژورنال یا تاریخچهٔ خصوصی را.') },
      { type: 'architecture', label: t('Coach, trader and Openfund', 'کوچ، معامله‌گر و اوپن‌فاند'), layers: [
        { title: t('Trader', 'معامله‌گر'), nodes: [{ title: t('Earns eligibility through records', 'احراز را از راه سوابق به دست می‌آورد') }, { title: t('Requests a coach by code', 'با کد درخواست کوچ می‌دهد') }] },
        { title: t('Coach', 'کوچ'), nodes: [{ title: t('Guides risk discipline', 'انضباط ریسک را راهنمایی می‌کند') }, { title: t('Verifies readiness with a note', 'آمادگی را با یادداشت تأیید می‌کند') }, { title: t('Earns 10% of distributable realized live profit', '۱۰٪ سود قابل‌توزیع تحقق‌یافتهٔ واقعی را دریافت می‌کند') }] },
        { title: t('Openfund', 'اوپن‌فاند'), nodes: [{ title: t('Re-checks eligibility', 'احراز را دوباره بررسی می‌کند') }, { title: t('Management gives final approval', 'مدیریت تأیید نهایی می‌دهد') }, { title: t('Owns capital and market exposure', 'مالک سرمایه و ریسک بازار است') }] },
      ] },
      { type: 'callout', tone: 'info', title: t('No coach revenue from simulation', 'بدون درآمد کوچ از شبیه‌سازی'), text: t(
        'The coach share applies only to verified realized net profit from eligible live trades after trading fees and execution costs. Simulated accounts and unrealized profit never create coach income, so coach income depends entirely on real results.',
        'سهم کوچ فقط به سود خالص تحقق‌یافته و تأییدشده از معاملات واقعی واجد شرایط، پس از کارمزد و هزینه‌های اجرا، تعلق می‌گیرد. حساب‌های شبیه‌سازی‌شده و سود تحقق‌نیافته هرگز برای کوچ درآمد ایجاد نمی‌کنند؛ بنابراین درآمد کوچ کاملاً به نتایج واقعی وابسته است.') },
      { type: 'refs', keys: ['economy-pr'] },
    ],
  },
]
