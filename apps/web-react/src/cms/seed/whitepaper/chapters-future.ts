import type { WpChapter } from '../../whitepaper/types'
import { text as t } from '../../../features/information/content'

/* Chapters 14–20: live capital, risk, governance, roadmap, long-term
   vision, disclosures and references. The roadmap mirrors ROADMAP.md and
   docs/roadmap/MILESTONES.md and promises no dates. */
export const futureChapters: WpChapter[] = [
  {
    slug: 'live-market-access', sort: 14,
    kicker: t('Live Market Access', 'اتصال به بازار'),
    title: t('From proven simulation to real capital — behind explicit gates.', 'از شبیه‌سازیِ اثبات‌شده تا سرمایهٔ واقعی — پشت دروازه‌های صریح.'),
    summary: t('Eligibility, the capital threshold, the execution path and how profit would be shared.', 'شرایط احراز، آستانهٔ سرمایه، مسیر اجرا و نحوهٔ تقسیم سود.'),
    blocks: [
      { type: 'lead', text: t(
        'Live Market Access is Openfund’s long-term differentiator: a documented path by which traders who have proven themselves repeatedly on simulated accounts may trade Openfund-owned capital in a real market.',
        'اتصال به بازار تمایز بلندمدت اوپن‌فاند است: مسیری مستند که در آن معامله‌گرانی که بارها خود را روی حساب‌های شبیه‌سازی‌شده اثبات کرده‌اند، ممکن است با سرمایهٔ متعلق به اوپن‌فاند در بازار واقعی معامله کنند.') },
      { type: 'callout', tone: 'warning', title: t('Current status', 'وضعیت فعلی'), text: t(
        'The control plane — eligibility, applications, approvals, allocations, risk checks, profit split and settlement records — is implemented and tested but not yet released. Real execution on Gains Network and automatic settlement transfers are not enabled.',
        'لایهٔ کنترل — احراز، درخواست‌ها، تأییدها، تخصیص‌ها، کنترل ریسک، تقسیم سود و سوابق تسویه — پیاده‌سازی و آزموده شده اما هنوز منتشر نشده است. اجرای واقعی در Gains Network و انتقال خودکار تسویه فعال نیستند.') },
      { type: 'h3', text: t('Trader eligibility', 'شرایط احراز معامله‌گر') },
      { type: 'features', items: [
        { title: t('First account', 'حساب اول'), text: t('Successful evaluation, entry into simulated funded trading and at least 10 verified, paid reward withdrawals on that account.', 'ارزیابی موفق، ورود به معامله‌گری فاندد شبیه‌سازی‌شده و دست‌کم ۱۰ برداشت پاداش پرداخت‌شده و تأییدشده روی همان حساب.') },
        { title: t('Second account', 'حساب دوم'), text: t('A later purchase of exactly twice the first account’s nominal size, a successful evaluation and at least 5 verified, paid reward withdrawals.', 'خریدی بعدی با اندازهٔ اسمی دقیقاً دو برابر حساب اول، ارزیابی موفق و دست‌کم ۵ برداشت پاداش پرداخت‌شده و تأییدشده.') },
        { title: t('Professional verification', 'تأیید حرفه‌ای'), text: t('An active link to an approved Verified Trading Coach who has verified the trader, followed by final Openfund management approval.', 'ارتباط فعال با یک کوچ معاملاتی تأییدشده که معامله‌گر را تأیید کرده باشد و سپس تأیید نهایی مدیریت اوپن‌فاند.') },
      ] },
      { type: 'p', text: t(
        'Eligibility is computed only from system records, never from what a trader declares, and is re-checked at decision time. Meeting every condition does not guarantee an allocation.',
        'احراز فقط از سوابق سامانه محاسبه می‌شود، نه از ادعای معامله‌گر، و در لحظهٔ تصمیم دوباره بررسی می‌شود. برآورده‌شدن همهٔ شرایط تخصیص را تضمین نمی‌کند.') },
      { type: 'h3', text: t('Company capital requirement', 'الزام سرمایهٔ شرکت') },
      { type: 'p', text: t(
        'The program may begin only once Openfund’s verified Available Allocatable Capital reaches at least $500,000. This is company-level capital after obligations, reserves and existing commitments. It is not a balance a trader must hold, and it is not gross sales or the gross treasury balance. Reaching it makes allocation possible; each allocation remains a separate management decision that must fit within the capital available at that moment.',
        'برنامه فقط زمانی می‌تواند آغاز شود که سرمایهٔ آزاد قابل تخصیص و تأییدشدهٔ اوپن‌فاند دست‌کم به ۵۰۰٬۰۰۰ دلار برسد. این سرمایه در سطح شرکت و پس از تعهدات، ذخایر و تعهدات موجود است. موجودی‌ای نیست که معامله‌گر باید داشته باشد و برابر با فروش ناخالص یا موجودی ناخالص خزانه نیست. رسیدن به آن تخصیص را ممکن می‌کند؛ هر تخصیص همچنان تصمیم جداگانهٔ مدیریت است و باید در سرمایهٔ موجود در همان لحظه بگنجد.') },
      { type: 'flow', label: t('Planned live execution path', 'مسیر برنامه‌ریزی‌شدهٔ اجرای واقعی'), steps: [
        { title: t('Trader', 'معامله‌گر'), text: t('Approved allocation', 'تخصیص تأییدشده'), status: 'implemented' },
        { title: t('Openfund Terminal', 'ترمینال اوپن‌فاند'), text: t('Live order ticket in a separate product context', 'فرم سفارش واقعی در زمینهٔ محصول جداگانه'), status: 'development' },
        { title: t('Order validation', 'اعتبارسنجی سفارش'), text: t('Collateral, caps, drawdown floors', 'وثیقه، سقف‌ها، کف افت سرمایه'), status: 'implemented' },
        { title: t('Company execution infrastructure', 'زیرساخت اجرای شرکت'), text: t('Openfund wallet and custody', 'کیف پول و حضانت اوپن‌فاند'), status: 'planned' },
        { title: t('Gains Network', 'Gains Network'), text: t('Real market position', 'پوزیشن در بازار واقعی'), status: 'planned' },
        { title: t('Verified position close', 'بستن تأییدشدهٔ پوزیشن'), text: t('Realized PnL, fees, costs', 'سود و زیان تحقق‌یافته، کارمزد، هزینه'), status: 'implemented' },
        { title: t('Settlement', 'تسویه'), text: t('Profit split and transfer', 'تقسیم سود و انتقال'), status: 'planned' },
      ] },
      { type: 'p', text: t(
        'The execution wallet and every market exposure belong to Openfund. A simulated account balance is a performance record; deployed capital is company money at risk in a real venue. The two are never added together.',
        'کیف پول اجرا و هر ریسک بازار متعلق به اوپن‌فاند است. موجودی حساب شبیه‌سازی‌شده سابقهٔ عملکرد است؛ سرمایهٔ به‌کاررفته پول شرکت است که در بازار واقعی در معرض ریسک قرار دارد. این دو هرگز با هم جمع نمی‌شوند.') },
      { type: 'h3', text: t('Profit distribution', 'تقسیم سود') },
      { type: 'p', text: t(
        'Profit is shared from verified realized net profit after eligible trading costs. The coach receives 10%. Three trader tiers — 70%, 80% and 85% — are under consideration, with the remainder belonging to Openfund. They are proposals, not contractual terms: no tier applies by default and management must select one explicitly for each approval. Losses create no share for anyone.',
        'سود از محل سود خالص تحقق‌یافته و تأییدشده پس از هزینه‌های معاملاتی مجاز تقسیم می‌شود. کوچ ۱۰٪ دریافت می‌کند. سه ردیف برای معامله‌گر — ۷۰٪، ۸۰٪ و ۸۵٪ — در دست بررسی است و باقی‌مانده متعلق به اوپن‌فاند است. این‌ها پیشنهادند، نه شرایط قراردادی: هیچ ردیفی به‌طور پیش‌فرض اعمال نمی‌شود و مدیریت باید برای هر تأیید صریحاً یکی را انتخاب کند. زیان برای هیچ‌کس سهمی ایجاد نمی‌کند.') },
      { type: 'chart', dataset: 'live-split-tiers' },
      { type: 'h3', text: t('Fast settlement — an objective, not a promise', 'تسویهٔ سریع — هدف، نه وعده') },
      { type: 'p', text: t(
        'The intent is near-immediate settlement after a profitable position is verifiably closed. Each split is written exactly once, and a settlement worker retries failed transfers up to five times before handing them to an operator for reconciliation with evidence. Actual timing depends on trade finality, reconciliation, execution costs and payment-network conditions, so instant payment is never unconditional.',
        'هدف، تسویهٔ تقریباً فوری پس از بسته‌شدن تأییدپذیر یک پوزیشن سودآور است. هر تقسیم دقیقاً یک بار ثبت می‌شود و یک فرایند تسویه، انتقال‌های ناموفق را تا پنج بار تکرار می‌کند و سپس برای تطبیق مستند به اپراتور می‌سپارد. زمان واقعی به قطعیت معامله، تطبیق، هزینه‌های اجرا و شرایط شبکهٔ پرداخت بستگی دارد؛ بنابراین پرداخت فوری هرگز بی‌قیدوشرط نیست.') },
      { type: 'callout', tone: 'risk', title: t('Real execution means real losses', 'اجرای واقعی یعنی زیان واقعی'), text: t(
        'Live trading exposes Openfund capital to realized losses, margin and liquidation risk, volatility, gaps, slippage and execution failures. Drawdown limits reduce exposure but do not eliminate it: an isolated position can lose its full collateral, which is why orders are admitted only if the worst case fits above the drawdown floors.',
        'معامله‌گری واقعی سرمایهٔ اوپن‌فاند را در معرض زیان تحقق‌یافته، ریسک مارجین و لیکوئید شدن، نوسان، شکاف قیمتی، لغزش و خطای اجرا قرار می‌دهد. حدود افت سرمایه ریسک را کاهش می‌دهند اما از بین نمی‌برند: یک پوزیشن ایزوله می‌تواند کل وثیقه‌اش را از دست بدهد و به همین دلیل سفارش فقط زمانی پذیرفته می‌شود که بدترین حالت بالاتر از کف‌های افت سرمایه قرار گیرد.') },
      { type: 'refs', keys: ['economy-pr', 'gains-integration'] },
    ],
  },
  {
    slug: 'risk-management', sort: 15,
    kicker: t('Risk Management', 'مدیریت ریسک'),
    title: t('Assume failure, record everything, never guess.', 'خطا را فرض کن، همه چیز را ثبت کن، هرگز حدس نزن.'),
    summary: t('The controls that protect traders, partners and the company across simulation and live trading.', 'کنترل‌هایی که از معامله‌گران، همکاران و شرکت در شبیه‌سازی و معاملهٔ واقعی محافظت می‌کنند.'),
    blocks: [
      { type: 'table', caption: t('Key risks and their controls', 'ریسک‌های کلیدی و کنترل‌های آن‌ها'), head: [t('Risk', 'ریسک'), t('Control', 'کنترل'), t('What remains', 'آنچه باقی می‌ماند')], rows: [
        [t('Stale or missing prices', 'قیمت کهنه یا ناموجود'), t('Freshness checks; stale values become unknown and block valuation', 'بررسی تازگی؛ مقدار کهنه نامعلوم می‌شود و ارزش‌گذاری را متوقف می‌کند'), t('Dependence on provider availability', 'وابستگی به دسترس‌پذیری ارائه‌دهنده')],
        [t('Rule disputes', 'اختلاف بر سر قوانین'), t('Rules frozen at purchase; immutable challenge events; public engine', 'قوانین ثبت‌شده در لحظهٔ خرید؛ رویدادهای تغییرناپذیر؛ موتور عمومی'), t('Interpretation of edge cases', 'تفسیر موارد مرزی')],
        [t('Duplicate or replayed payments', 'پرداخت تکراری یا بازپخش‌شده'), t('Server pricing, receipt verification, idempotent orders, exactly-once provisioning', 'قیمت‌گذاری سرور، تأیید رسید، سفارش تکرارپذیر، ایجاد دقیقاً‌یک‌باره'), t('Chain reorganisation edge cases', 'موارد مرزی سازمان‌دهی مجدد زنجیره')],
        [t('Ledger tampering', 'دست‌کاری دفاتر'), t('Append-only commission, audit and live-trade event tables enforced by database triggers', 'جداول کمیسیون، ممیزی و رویداد معاملهٔ واقعیِ فقط‌افزودنی با تریگر پایگاه داده'), t('Operator error before recording', 'خطای اپراتور پیش از ثبت')],
        [t('Unverified expenses', 'هزینهٔ تأییدنشده'), t('Invoice reference required; a second operator must verify', 'شمارهٔ فاکتور الزامی؛ اپراتور دوم باید تأیید کند'), t('Late invoices', 'فاکتورهای دیرهنگام')],
        [t('Over-allocation of capital', 'تخصیص بیش از حد سرمایه'), t('Verified-position gate, advisory locks, allocation within available capital', 'دروازهٔ موقعیت تأییدشده، قفل مشورتی، تخصیص در حد سرمایهٔ موجود'), t('Market moves between snapshots', 'حرکت بازار میان دو تصویر لحظه‌ای')],
        [t('Live trading losses', 'زیان معاملهٔ واقعی'), t('Collateral-based admission, leverage/notional/position caps, circuit breaker, tighten-only limits', 'پذیرش مبتنی بر وثیقه، سقف اهرم/ارزش/تعداد پوزیشن، قطع‌کنندهٔ مدار، حدودی که فقط سخت‌تر می‌شوند'), t('Gaps, liquidation and slippage up to collateral', 'شکاف قیمت، لیکوئید شدن و لغزش تا سقف وثیقه')],
        [t('Unknown execution outcome', 'نتیجهٔ نامعلوم اجرا'), t('Never assumed to be a fill; marked for reconciliation', 'هرگز اجراشده فرض نمی‌شود؛ برای تطبیق علامت می‌خورد'), t('Manual reconciliation time', 'زمان تطبیق دستی')],
      ] },
      { type: 'quote', text: t('An unknown value stays unknown. Openfund prefers an honest gap to a confident guess.', 'مقدار نامعلوم نامعلوم می‌ماند. اوپن‌فاند شکاف صادقانه را به حدس مطمئن ترجیح می‌دهد.') },
    ],
  },
  {
    slug: 'governance', sort: 16,
    kicker: t('Governance & Operations', 'حاکمیت و عملیات'),
    title: t('Company-operated, publicly accountable.', 'اداره‌شده توسط شرکت، با پاسخ‌گویی عمومی.'),
    summary: t('Who decides what, how decisions are recorded and where the community fits.', 'چه کسی دربارهٔ چه چیزی تصمیم می‌گیرد، تصمیم‌ها چگونه ثبت می‌شوند و جامعه کجا قرار دارد.'),
    blocks: [
      { type: 'p', text: t(
        'Openfund is operated by its management. The treasury is company-managed, capital allocation is a management decision, and financial records are kept by the backend independently of the content system. Transparency is how that authority is held accountable — not a transfer of it.',
        'اوپن‌فاند توسط مدیریت آن اداره می‌شود. خزانه توسط شرکت مدیریت می‌شود، تخصیص سرمایه تصمیم مدیریت است و سوابق مالی مستقل از سیستم محتوا توسط بک‌اند نگهداری می‌شوند. شفافیت راهی است برای پاسخ‌گو نگه‌داشتن این اختیار — نه واگذاری آن.') },
      { type: 'features', items: [
        { title: t('Role-based approvals', 'تأییدهای مبتنی بر نقش'), text: t('Partner applications, reward withdrawals, live approvals and allocations are decided through an administrative API that requires a token and a named operator.', 'درخواست‌های همکاری، برداشت پاداش، تأییدهای واقعی و تخصیص‌ها از طریق API مدیریتی تصمیم‌گیری می‌شوند که به توکن و اپراتور مشخص نیاز دارد.') },
        { title: t('Audited decisions', 'تصمیم‌های ممیزی‌شده'), text: t('Every financial decision is written to an append-only audit log with the operator and a note.', 'هر تصمیم مالی با نام اپراتور و یادداشت در گزارش ممیزی فقط‌افزودنی ثبت می‌شود.') },
        { title: t('Four-eyes expenses', 'هزینه با تأیید دو نفر'), text: t('An expense recorded by one operator must be verified by another before it counts.', 'هزینه‌ای که یک اپراتور ثبت می‌کند پیش از محاسبه باید توسط اپراتور دیگری تأیید شود.') },
        { title: t('Technical oversight', 'نظارت فنی'), text: t('Reviewed pull requests, required checks, immutable releases and a public production version endpoint.', 'درخواست‌های ادغام بازبینی‌شده، بررسی‌های الزامی، نسخه‌های تغییرناپذیر و نقطهٔ پایانی عمومی نسخهٔ محیط اصلی.') },
        { title: t('Content governance', 'حاکمیت محتوا'), text: t('Editors publish content in Directus; the public sees published rows only, and the CMS never edits financial records.', 'ویراستاران محتوا را در Directus منتشر می‌کنند؛ عموم فقط ردیف‌های منتشرشده را می‌بینند و CMS هرگز سوابق مالی را ویرایش نمی‌کند.') },
        { title: t('Community contributions', 'مشارکت‌های جامعه'), text: t('Anyone can propose changes through pull requests and issues. Contributions inform the project; they do not confer voting rights or operational authority.', 'هر کسی می‌تواند از طریق درخواست ادغام و گزارش مشکل تغییر پیشنهاد کند. مشارکت‌ها بر پروژه اثر می‌گذارند اما حق رأی یا اختیار عملیاتی ایجاد نمی‌کنند.') },
      ] },
      { type: 'refs', keys: ['contributing', 'feature-status', 'releases'] },
    ],
  },
  {
    slug: 'roadmap', sort: 17,
    kicker: t('Roadmap', 'نقشهٔ راه'),
    title: t('Milestones, not dates.', 'نقاط عطف، نه تاریخ‌ها.'),
    summary: t('Where development stands across the seven phases and the economy track.', 'وضعیت توسعه در هفت فاز و مسیر اقتصادی.'),
    blocks: [
      { type: 'p', text: t(
        'The roadmap orders work by dependency. No delivery dates are promised: a milestone advances only when its acceptance criteria are met with evidence. Between 3 and 8 November 2026 the project published nine official releases, from v0.1.0 to v0.4.4.',
        'نقشهٔ راه کارها را بر اساس وابستگی مرتب می‌کند. هیچ تاریخ تحویلی وعده داده نمی‌شود: هر نقطهٔ عطف فقط زمانی پیش می‌رود که معیارهای پذیرشش با شواهد برآورده شود. پروژه میان ۱۲ تا ۱۷ آبان ۱۴۰۵ نُه نسخهٔ رسمی، از v0.1.0 تا v0.4.4، منتشر کرد.') },
      { type: 'timeline', items: [
        { phase: t('Phase 1', 'فاز ۱'), status: 'completed', title: t('Platform foundation', 'زیربنای پلتفرم'), text: t('React and Node application, Vela charting and Gains market feeds — delivered within the current application scope.', 'اپلیکیشن React و Node، چارت Vela و فیدهای بازار گینز — در محدودهٔ فعلی اپلیکیشن تحویل شده است.') },
        { phase: t('Phase 2', 'فاز ۲'), status: 'completed', title: t('Trading core', 'هستهٔ معاملاتی'), text: t('Persistent simulated execution, decimal valuation, drawdown telemetry and the paid-challenge evaluation engine.', 'اجرای شبیه‌سازی‌شدهٔ پایدار، ارزش‌گذاری دهدهی، پایش افت سرمایه و موتور ارزیابی چلنج پولی.') },
        { phase: t('Phase 3', 'فاز ۳'), status: 'in_progress', title: t('Product experience', 'تجربهٔ محصول'), text: t('Portfolios, journals, catalog, purchases and five locales are built; real wallet/device acceptance and production payment activation remain.', 'پورتفولیو، ژورنال، کاتالوگ، خرید و پنج زبان ساخته شده‌اند؛ پذیرش کیف پول و دستگاه واقعی و فعال‌سازی پرداخت در محیط اصلی باقی مانده است.') },
        { phase: t('Economy', 'اقتصاد'), status: 'in_progress', title: t('Transparency, treasury and partner programs', 'شفافیت، خزانه و برنامه‌های همکاری'), text: t('Implemented and tested; under review for release. Treasury address, reserves and reviewer roles need management configuration.', 'پیاده‌سازی و آزموده شده و برای انتشار در حال بازبینی است. نشانی خزانه، ذخایر و نقش‌های بازبین به پیکربندی مدیریت نیاز دارند.') },
        { phase: t('Phase 4', 'فاز ۴'), status: 'in_progress', title: t('Production infrastructure', 'زیرساخت محیط اصلی'), text: t('Infrastructure configuration, CI and release-driven deployment are in place; operational monitoring and a rehearsed recovery remain.', 'پیکربندی زیرساخت، یکپارچه‌سازی پیوسته و استقرار مبتنی بر انتشار برقرارند؛ پایش عملیاتی و تمرین بازیابی باقی مانده است.') },
        { phase: t('Live capital', 'سرمایهٔ واقعی'), status: 'planned', title: t('Live Market Access execution', 'اجرای اتصال به بازار'), text: t('Requires custody design, supported testnet contracts, transaction simulation, a security review, $500,000 of verified free capital and explicit activation.', 'به طراحی حضانت، قراردادهای آزمایشی پشتیبانی‌شده، شبیه‌سازی تراکنش، بازبینی امنیتی، ۵۰۰٬۰۰۰ دلار سرمایهٔ آزاد تأییدشده و فعال‌سازی صریح نیاز دارد.') },
        { phase: t('Phase 5', 'فاز ۵'), status: 'planned', title: t('Advanced trading', 'معامله‌گری پیشرفته'), text: t('Extended order workflows, deeper analytics and, once its gates are met, wallet-confirmed Perpetual execution.', 'جریان‌های سفارش گسترده‌تر، تحلیل‌های عمیق‌تر و پس از عبور از دروازه‌ها، اجرای پرپچوال با تأیید کیف پول.') },
        { phase: t('Phase 6', 'فاز ۶'), status: 'research', title: t('Openfund Protocol', 'پروتکل اوپن‌فاند'), text: t('Venue adapters, liquidity aggregation and intelligent routing. Only a dormant source foundation exists today.', 'آداپتورهای بازار، تجمیع نقدینگی و مسیریابی هوشمند. امروز فقط زیربنای غیرفعال کد وجود دارد.') },
        { phase: t('Phase 7', 'فاز ۷'), status: 'planned', title: t('Ecosystem expansion', 'گسترش اکوسیستم'), text: t('Developer services, further integrations, coordinated scaling, and desktop and mobile applications.', 'خدمات توسعه‌دهندگان، یکپارچگی‌های بیشتر، مقیاس‌پذیری هماهنگ و اپلیکیشن‌های دسکتاپ و موبایل.') },
      ] },
      { type: 'refs', keys: ['milestones', 'releases'] },
    ],
  },
  {
    slug: 'long-term-vision', sort: 18,
    kicker: t('Long-Term Vision', 'چشم‌انداز بلندمدت'),
    title: t('A trader’s whole career, in one verifiable place.', 'تمام مسیر حرفه‌ای معامله‌گر، در یک جای قابل راستی‌آزمایی.'),
    summary: t('Where Openfund intends to go if each gate is passed.', 'اگر از هر دروازه عبور شود، اوپن‌فاند قصد دارد به کجا برسد.'),
    blocks: [
      { type: 'p', text: t(
        'In the long term, Openfund aims to be the place where a trader learns, practises, is evaluated, is coached and — when the evidence supports it — trades real capital, with every step recorded in the same verifiable system. Beyond that, the protocol direction aims to let execution choose the best available path across venues rather than being bound to one.',
        'در بلندمدت، اوپن‌فاند می‌خواهد جایی باشد که معامله‌گر در آن یاد می‌گیرد، تمرین می‌کند، ارزیابی می‌شود، مربی‌گری می‌شود و — هنگامی که شواهد پشتیبانی کند — با سرمایهٔ واقعی معامله می‌کند و هر گام در همان سامانهٔ قابل راستی‌آزمایی ثبت می‌شود. فراتر از آن، جهت‌گیری پروتکل این است که اجرا بتواند بهترین مسیر موجود را میان بازارها برگزیند، نه این‌که به یک بازار محدود بماند.') },
      { type: 'list', items: [
        t('Trader growth: from learning paths to evaluation, coaching and live allocation.', 'رشد معامله‌گر: از مسیرهای یادگیری تا ارزیابی، مربی‌گری و تخصیص واقعی.'),
        t('Transparent economics: a public, record-based view of how the business sustains itself.', 'اقتصاد شفاف: نمایی عمومی و مبتنی بر سوابق از این‌که کسب‌وکار چگونه خود را پایدار نگه می‌دارد.'),
        t('Community capital formation: partners rewarded for genuine customers and genuine skill.', 'شکل‌گیری سرمایهٔ اجتماعی: همکارانی که برای مشتری واقعی و مهارت واقعی پاداش می‌گیرند.'),
        t('Multi-venue execution: the Openfund Protocol as a research direction, pursued only after single-venue execution is proven.', 'اجرای چندبازاری: پروتکل اوپن‌فاند به‌عنوان یک جهت پژوهشی که فقط پس از اثبات اجرا در یک بازار دنبال می‌شود.'),
      ] },
      { type: 'callout', tone: 'info', title: t('Forward-looking', 'آینده‌نگر'), text: t(
        'This chapter describes intentions. None of it is a commitment to a feature, a date or a financial outcome.',
        'این فصل نیت‌ها را توصیف می‌کند. هیچ بخشی از آن تعهدی به یک قابلیت، تاریخ یا نتیجهٔ مالی نیست.') },
    ],
  },
  {
    slug: 'disclosures', sort: 19,
    kicker: t('Risk, Limitations & Disclosures', 'ریسک‌ها، محدودیت‌ها و افشاها'),
    title: t('Read this before acting on anything above.', 'پیش از هر اقدامی بر اساس مطالب بالا، این بخش را بخوانید.'),
    summary: t('The limits of this document and of the products it describes.', 'محدودیت‌های این سند و محصولاتی که توصیف می‌کند.'),
    blocks: [
      { type: 'callout', tone: 'risk', title: t('Not an offer or advice', 'نه پیشنهاد، نه مشاوره'), text: t(
        'This whitepaper is informational. It is not an offer of securities, an investment product, financial, legal or tax advice, or a solicitation to trade. Openfund does not claim any company registration, licence or regulatory approval in this document.',
        'این وایت‌پیپر اطلاع‌رسانی است. پیشنهاد اوراق بهادار، محصول سرمایه‌گذاری، مشاورهٔ مالی، حقوقی یا مالیاتی یا دعوت به معامله نیست. اوپن‌فاند در این سند هیچ ثبت شرکت، مجوز یا تأیید نظارتی ادعا نمی‌کند.') },
      { type: 'definitions', items: [
        { term: t('Simulated versus real trading', 'معامله‌گری شبیه‌سازی‌شده در برابر واقعی'), text: t('Evaluation and funded accounts are simulations. Simulated results do not represent real trading and may not reflect execution, liquidity or slippage in real markets.', 'حساب‌های ارزیابی و فاندد شبیه‌سازی‌اند. نتایج شبیه‌سازی‌شده معامله‌گری واقعی را نشان نمی‌دهند و ممکن است اجرا، نقدشوندگی یا لغزش بازار واقعی را منعکس نکنند.') },
        { term: t('Financial risk', 'ریسک مالی'), text: t('Leveraged trading can lose money quickly. A challenge fee pays for an evaluation and is not a deposit or an investment.', 'معامله با اهرم می‌تواند به‌سرعت زیان‌ده شود. کارمزد چلنج بهای یک ارزیابی است و سپرده یا سرمایه‌گذاری نیست.') },
        { term: t('Payout conditions', 'شرایط پرداخت'), text: t('Rewards depend on program rules, review and approval. A reward request or recognised commission is not a completed payment.', 'پاداش‌ها به قوانین برنامه، بررسی و تأیید وابسته‌اند. درخواست پاداش یا کمیسیون شناسایی‌شده پرداخت انجام‌شده نیست.') },
        { term: t('Revenue variability', 'نوسان درآمد'), text: t('Sales, pass rates and payout ratios vary; scenarios in this paper are illustrative and not forecasts.', 'فروش، نرخ قبولی و نسبت پرداخت متغیرند؛ سناریوهای این سند نمایشی‌اند و پیش‌بینی نیستند.') },
        { term: t('Evaluation risk', 'ریسک ارزیابی'), text: t('Engine behaviour is tested and audited, and open questions are documented publicly; software can still contain defects.', 'رفتار موتور آزموده و ممیزی شده و پرسش‌های باز به‌طور عمومی مستند شده‌اند؛ با این حال نرم‌افزار ممکن است نقص داشته باشد.') },
        { term: t('Market execution risk', 'ریسک اجرای بازار'), text: t('Live execution, when enabled, carries liquidation, gap, slippage and venue risk that limits cannot remove.', 'اجرای واقعی، در صورت فعال‌شدن، ریسک لیکوئید شدن، شکاف قیمتی، لغزش و ریسک بازار را دارد که حدود نمی‌توانند آن را حذف کنند.') },
        { term: t('Infrastructure and external dependencies', 'وابستگی‌های زیرساختی و بیرونی'), text: t('Openfund depends on Gains Network, blockchain networks, oracle feeds, wallet software and its infrastructure providers. Their outages or changes can interrupt service.', 'اوپن‌فاند به Gains Network، شبکه‌های بلاکچین، فیدهای اوراکل، نرم‌افزار کیف پول و ارائه‌دهندگان زیرساخت وابسته است. قطعی یا تغییر آن‌ها می‌تواند خدمت را مختل کند.') },
        { term: t('Open-source limitations', 'محدودیت‌های کد عمومی'), text: t('Public source does not imply an audit, a warranty or a licence to reuse. Third-party components are provided under their own terms.', 'کد عمومی به معنای ممیزی، ضمانت یا مجوز استفادهٔ مجدد نیست. اجزای ثالث تحت شرایط خود ارائه می‌شوند.') },
        { term: t('Forward-looking statements', 'اظهارات آینده‌نگر'), text: t('Planned features, tiers and thresholds may change or never be delivered.', 'قابلیت‌ها، ردیف‌ها و آستانه‌های برنامه‌ریزی‌شده ممکن است تغییر کنند یا هرگز ارائه نشوند.') },
        { term: t('Product availability', 'دسترس‌پذیری محصول'), text: t('Products may be unavailable in some jurisdictions or to some persons. Presentation of a product does not verify eligibility, nationality or residency.', 'محصولات ممکن است در برخی حوزه‌های قضایی یا برای برخی افراد در دسترس نباشند. نمایش یک محصول به معنای احراز صلاحیت، تابعیت یا اقامت نیست.') },
      ] },
    ],
  },
  {
    slug: 'references', sort: 20,
    kicker: t('References & Sources', 'منابع و مآخذ'),
    title: t('Every claim, traceable.', 'هر ادعا، قابل ردیابی.'),
    summary: t('Repository evidence, provider documentation and industry sources, with access dates.', 'شواهد مخزن، مستندات ارائه‌دهندگان و منابع صنعتی، همراه با تاریخ دسترسی.'),
    blocks: [
      { type: 'p', text: t(
        'Technical and status claims trace to the public repository, its feature register and official releases. Industry figures come from the cited publishers and keep their own definitions. Project facts, external evidence, business assumptions and future plans are labelled as such throughout this paper.',
        'ادعاهای فنی و وضعیتی به مخزن عمومی، ثبت قابلیت‌ها و نسخه‌های رسمی آن برمی‌گردند. ارقام صنعتی از ناشران ذکرشده آمده‌اند و تعاریف خودشان را حفظ می‌کنند. در سراسر این سند، واقعیت‌های پروژه، شواهد بیرونی، فرض‌های تجاری و برنامه‌های آینده به همین عنوان برچسب خورده‌اند.') },
      { type: 'refs', keys: [
        'repo', 'readme-licensing', 'contributing', 'feature-status', 'milestones', 'architecture', 'gains-integration', 'prop-engine', 'adr-purchases', 'plan-catalog', 'economy-pr',
        'protocol-provenance', 'deployment-blueprint', 'release-v044', 'releases', 'gains-docs', 'vela', 'siwe', 'chainlink-feeds', 'directus-docs', 'topstep-2025', 'fpfx-2024',
      ] },
    ],
  },
]
