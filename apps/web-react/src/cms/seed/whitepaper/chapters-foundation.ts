import type { WpChapter } from '../../whitepaper/types'
import { text as t } from '../../../features/information/content'

/* Chapters 1–7: introduction, purpose, problem, approach, ecosystem,
   openness and architecture. Status labels follow the feature register
   (docs/product/FEATURE_STATUS.md) and the official v0.4.4 release. */
export const foundationChapters: WpChapter[] = [
  {
    slug: 'introduction', sort: 1,
    kicker: t('Introduction', 'مقدمه'),
    title: t('An evolving ecosystem for traders, built in the open.', 'اکوسیستمی در حال تکامل برای معامله‌گران، ساخته‌شده در فضای باز.'),
    summary: t('What Openfund is, who it serves and how to read the status labels in this paper.', 'اوپن‌فاند چیست، به چه کسانی خدمت می‌کند و برچسب‌های وضعیت این سند را چگونه باید خواند.'),
    blocks: [
      { type: 'lead', text: t(
        'Openfund is a trading technology project that connects market discovery, a shared trading terminal, trader evaluation, transparent economic reporting and — in time — the allocation of company capital to traders who have proven themselves.',
        'اوپن‌فاند یک پروژهٔ فناوری معاملاتی است که کشف بازار، ترمینال معاملاتی مشترک، ارزیابی معامله‌گر، گزارش‌دهی شفاف اقتصادی و — در گذر زمان — تخصیص سرمایهٔ شرکت به معامله‌گرانی که توانایی خود را ثابت کرده‌اند را به هم پیوند می‌دهد.') },
      { type: 'p', text: t(
        'The project is organised around two trading products that share one workspace but never share money. Openfund Prop is a trader-evaluation product: traders practise and are evaluated on simulated accounts under published rules, and successful traders can earn rewards. Openfund Perpetual is a wallet-native product that reads a trader’s own positions on Gains Network. Around them sit the public website, a learning centre, a challenge catalog, wallet sign-in, a content management system and an economy layer that reports sales, rewards, expenses and treasury positions from records rather than estimates.',
        'این پروژه حول دو محصول معاملاتی سازمان یافته که یک فضای کاری مشترک دارند اما هرگز پول مشترک ندارند. اوپن‌فاند پراپ محصول ارزیابی معامله‌گر است: معامله‌گران روی حساب‌های شبیه‌سازی‌شده و طبق قوانین منتشرشده تمرین و ارزیابی می‌شوند و معامله‌گران موفق می‌توانند پاداش دریافت کنند. اوپن‌فاند پرپچوال محصولی مبتنی بر کیف پول است که پوزیشن‌های خود معامله‌گر را در Gains Network می‌خواند. پیرامون این دو، وب‌سایت عمومی، مرکز آموزش، کاتالوگ چلنج‌ها، ورود با کیف پول، سیستم مدیریت محتوا و لایهٔ اقتصادی قرار دارند که فروش، پاداش‌ها، هزینه‌ها و موقعیت خزانه را از سوابق واقعی گزارش می‌کند، نه از برآورد.') },
      { type: 'stats', items: [
        { value: 'v0.4.4', label: t('Latest official release', 'آخرین نسخهٔ رسمی'), note: t('Served in production and verifiable at /version', 'در محیط اصلی ارائه می‌شود و از /version قابل بررسی است') },
        { value: '4', label: t('Published challenge programs', 'برنامهٔ چلنج منتشرشده'), note: t('Standard, One-phase, Instant and Free Trial', 'استاندارد، تک‌مرحله‌ای، آنی و تست رایگان') },
        { value: '5', label: t('Interface languages', 'زبان رابط کاربری'), note: t('Persian and English editorial; Arabic, Russian and Chinese interface', 'محتوای فارسی و انگلیسی؛ رابط عربی، روسی و چینی') },
        { value: '3', label: t('Deployed infrastructure resources', 'منبع زیرساختی مستقر'), note: t('Web/API service, PostgreSQL and Directus', 'سرویس وب/API، PostgreSQL و Directus') },
      ] },
      { type: 'architecture', label: t('The Openfund ecosystem at a glance', 'نمای کلی اکوسیستم اوپن‌فاند'), layers: [
        { title: t('Discover', 'کشف'), nodes: [
          { title: t('Public website and markets directory', 'وب‌سایت عمومی و فهرست بازارها'), status: 'live' },
          { title: t('Learning centre, FAQ and tools', 'مرکز آموزش، پرسش‌ها و ابزارها'), status: 'live' },
        ] },
        { title: t('Trade', 'معامله'), nodes: [
          { title: t('Shared trading terminal', 'ترمینال معاملاتی مشترک'), status: 'live' },
          { title: t('Prop simulation and evaluation engine', 'شبیه‌سازی و موتور ارزیابی پراپ'), status: 'live' },
          { title: t('Perpetual wallet reads on Gains Network', 'خواندن کیف پول پرپچوال در Gains Network'), status: 'live' },
        ] },
        { title: t('Fund', 'تأمین سرمایه'), nodes: [
          { title: t('Wallet payments for challenges', 'پرداخت چلنج با کیف پول'), status: 'implemented' },
          { title: t('Transparency, treasury and partner programs', 'شفافیت، خزانه و برنامه‌های همکاری'), status: 'implemented' },
          { title: t('Live Market Access execution', 'اجرای واقعی در اتصال به بازار'), status: 'planned' },
        ] },
      ] },
      { type: 'h3', text: t('How to read this paper', 'این سند را چگونه بخوانیم') },
      { type: 'p', text: t(
        'Every capability is labelled with one of four states. Live means it is part of the official release running in production. Implemented means the code exists and is tested in the repository but has not been released or activated. In development means work is under way and acceptance is incomplete. Planned means a documented intention or proposal with no working implementation. Nothing in this paper should be read as more mature than its label.',
        'هر قابلیت با یکی از چهار وضعیت برچسب خورده است. «فعال» یعنی بخشی از نسخهٔ رسمی است که در محیط اصلی اجرا می‌شود. «پیاده‌سازی‌شده» یعنی کد در مخزن وجود دارد و آزموده شده، اما هنوز منتشر یا فعال نشده است. «در حال توسعه» یعنی کار جریان دارد و پذیرش آن کامل نیست. «برنامه‌ریزی‌شده» یعنی قصد یا پیشنهادی مستند که پیاده‌سازی کارکردی ندارد. هیچ بخشی از این سند را نباید بالغ‌تر از برچسبش خواند.') },
      { type: 'callout', tone: 'info', title: t('A living publication', 'سندی زنده'), text: t(
        'This whitepaper is managed in the Openfund content system and versioned. When a capability changes state, the paper changes with it; the version and revision date at the top of the page identify the edition you are reading.',
        'این وایت‌پیپر در سیستم مدیریت محتوای اوپن‌فاند نگهداری و نسخه‌گذاری می‌شود. هرگاه وضعیت قابلیتی تغییر کند، سند نیز همراه آن تغییر می‌کند؛ نسخه و تاریخ بازنگری در بالای صفحه، ویرایشی را که می‌خوانید مشخص می‌کند.') },
    ],
  },
  {
    slug: 'vision-mission', sort: 2,
    kicker: t('Vision & Mission', 'چشم‌انداز و مأموریت'),
    title: t('Trust earned through what can be checked.', 'اعتمادی که از راه قابل‌بررسی‌بودن به دست می‌آید.'),
    summary: t('Why openness, verifiability and accountability are the organising principles of the project.', 'چرا باز بودن، قابلیت راستی‌آزمایی و پاسخ‌گویی اصول سازمان‌دهندهٔ این پروژه‌اند.'),
    blocks: [
      { type: 'quote', text: t(
        'Build a coherent trading ecosystem in which traders can move from market insight to account review — and eventually to real capital — with clear boundaries and information they can verify.',
        'ساختن اکوسیستم معاملاتی منسجمی که معامله‌گر در آن بتواند از بینش بازار تا بررسی حساب — و در نهایت تا سرمایهٔ واقعی — با مرزهای روشن و اطلاعاتی قابل راستی‌آزمایی پیش برود.') },
      { type: 'p', text: t(
        'Trading infrastructure is usually a black box. Traders see a chart, a balance and a set of rules, but rarely the source of a price, the logic that decides a pass or a breach, or how the business that sets the rules actually earns and spends its money. Openfund starts from the opposite assumption: the more of the system a trader, partner or contributor can inspect, the less trust has to be asked for.',
        'زیرساخت معاملاتی معمولاً جعبه‌ای سیاه است. معامله‌گر یک چارت، یک موجودی و مجموعه‌ای قانون می‌بیند، اما به ندرت منبع قیمت، منطقی که دربارهٔ قبولی یا تخطی تصمیم می‌گیرد، یا این‌که کسب‌وکارِ وضع‌کنندهٔ قوانین واقعاً چگونه درآمد کسب و هزینه می‌کند را می‌بیند. اوپن‌فاند از فرض مخالف آغاز می‌کند: هر چه معامله‌گر، همکار یا مشارکت‌کننده بتواند بخش بیشتری از سامانه را بررسی کند، اعتماد کمتری لازم است طلب شود.') },
      { type: 'h3', text: t('Mission', 'مأموریت') },
      { type: 'p', text: t(
        'Give traders a clear, connected environment to study markets, develop execution discipline, prove their skill under published rules and understand exactly how their performance is measured and rewarded.',
        'فراهم‌کردن محیطی روشن و پیوسته برای معامله‌گران تا بازار را مطالعه کنند، انضباط اجرایی بسازند، مهارت خود را تحت قوانین منتشرشده اثبات کنند و دقیقاً بدانند عملکردشان چگونه سنجیده و پاداش داده می‌شود.') },
      { type: 'features', items: [
        { title: t('Openness', 'باز بودن'), text: t('The application source, architecture decisions and status register are public. Contributions arrive through reviewed pull requests.', 'کد اپلیکیشن، تصمیم‌های معماری و ثبت وضعیت‌ها عمومی‌اند. مشارکت‌ها از طریق درخواست‌های ادغامِ بازبینی‌شده انجام می‌شود.') },
        { title: t('Verifiability', 'راستی‌آزمایی'), text: t('Official releases carry an immutable tag and a manifest; production reports its exact version and commit.', 'نسخه‌های رسمی برچسب تغییرناپذیر و مانیفست دارند و محیط اصلی نسخه و کامیت دقیق خود را گزارش می‌کند.') },
        { title: t('Transparency', 'شفافیت'), text: t('Economic figures are aggregated from operational records. Unknown values are shown as unknown, never estimated.', 'ارقام اقتصادی از سوابق عملیاتی تجمیع می‌شوند. مقادیر نامعلوم، نامعلوم نمایش داده می‌شوند و هرگز تخمین زده نمی‌شوند.') },
        { title: t('Accountability', 'پاسخ‌گویی'), text: t('Financial decisions are made through an audited administrative API that records which operator acted and why.', 'تصمیم‌های مالی از طریق API مدیریتی ممیزی‌شده گرفته می‌شود که ثبت می‌کند کدام اپراتور و به چه دلیل اقدام کرده است.') },
        { title: t('Accessibility', 'دسترس‌پذیری'), text: t('Five interface languages, right-to-left layouts, keyboard navigation and both light and dark themes are first-class requirements.', 'پنج زبان رابط، چیدمان راست‌به‌چپ، پیمایش با صفحه‌کلید و هر دو پوستهٔ روشن و تیره الزامات درجه‌یک‌اند.') },
        { title: t('Sustainability', 'پایداری'), text: t('Capital reaches real markets only when it is verifiably free of obligations and reserves — growth follows solvency, not the reverse.', 'سرمایه فقط زمانی به بازار واقعی می‌رسد که آزاد بودنش از تعهدات و ذخایر قابل اثبات باشد — رشد از پی توان پرداخت می‌آید، نه برعکس.') },
      ] },
      { type: 'p', text: t(
        'These are objectives, not claims of scale. Openfund does not present investors, partnerships, user counts, trading volumes or regulatory approvals in this paper because none are established in the project record.',
        'این‌ها هدف‌اند، نه ادعای مقیاس. اوپن‌فاند در این سند سرمایه‌گذار، شراکت، تعداد کاربر، حجم معاملات یا مجوز نظارتی ارائه نمی‌کند، زیرا هیچ‌یک در سوابق پروژه ثابت نشده‌اند.') },
    ],
  },
  {
    slug: 'problem', sort: 3,
    kicker: t('The Problem', 'مسئله'),
    title: t('Traders are asked to trust what they cannot see.', 'از معامله‌گر خواسته می‌شود به چیزی اعتماد کند که نمی‌بیند.'),
    summary: t('Structural challenges in proprietary trading and trader funding.', 'چالش‌های ساختاری در معامله‌گری اختصاصی و تأمین سرمایهٔ معامله‌گران.'),
    blocks: [
      { type: 'lead', text: t(
        'The prop-trading model has opened professional-scale accounts to many traders who could never fund them alone. It has also concentrated information on one side of the relationship.',
        'مدل پراپ‌تریدینگ حساب‌هایی در مقیاس حرفه‌ای را در دسترس معامله‌گرانی قرار داده که هرگز به‌تنهایی توان تأمین آن را نداشتند. اما در عین حال، اطلاعات را در یک سوی این رابطه متمرکز کرده است.') },
      { type: 'features', items: [
        { title: t('Opaque payout economics', 'اقتصاد پرداخت مبهم'), text: t('Few firms publish how much of their fee revenue is returned to traders, or what remains after costs. Traders cannot judge whether a program is sustainable.', 'شرکت‌های اندکی منتشر می‌کنند چه بخشی از درآمد کارمزدشان به معامله‌گران بازمی‌گردد یا پس از هزینه‌ها چه می‌ماند. معامله‌گر نمی‌تواند پایداری یک برنامه را بسنجد.') },
        { title: t('Limited visibility into operations', 'دید محدود به عملیات'), text: t('Treasury balances, liabilities and reserves are rarely disclosed, so a firm’s ability to keep paying is taken on faith.', 'موجودی خزانه، بدهی‌ها و ذخایر به ندرت افشا می‌شوند؛ پس توان ادامهٔ پرداخت یک شرکت بر پایهٔ اعتماد پذیرفته می‌شود.') },
        { title: t('Proprietary infrastructure', 'زیرساخت انحصاری'), text: t('The engines that compute drawdown, breaches and passes are closed. Disputes become one party’s word against the other’s.', 'موتورهایی که افت سرمایه، تخطی و قبولی را محاسبه می‌کنند بسته‌اند. اختلاف به ادعای یک طرف در برابر طرف دیگر تبدیل می‌شود.') },
        { title: t('Simulated and real are blurred', 'مرز شبیه‌سازی و واقعی مبهم است'), text: t('Marketing language often makes simulated “funded” accounts sound like real capital in real markets. Very few traders ever reach live capital.', 'زبان تبلیغاتی اغلب حساب‌های «فاندد» شبیه‌سازی‌شده را مانند سرمایهٔ واقعی در بازار واقعی جلوه می‌دهد. شمار بسیار کمی از معامله‌گران هرگز به سرمایهٔ واقعی می‌رسند.') },
        { title: t('Misaligned incentives', 'ناهم‌راستایی انگیزه‌ها'), text: t('When fee income does not depend on trader success, the interests of firms, referrers and traders can drift apart.', 'وقتی درآمد کارمزد به موفقیت معامله‌گر وابسته نباشد، منافع شرکت، معرف و معامله‌گر می‌تواند از هم فاصله بگیرد.') },
        { title: t('Barriers to real capital', 'موانع رسیدن به سرمایهٔ واقعی'), text: t('A clear, rules-based path from consistent simulated performance to genuine market allocation is uncommon and rarely documented.', 'مسیری روشن و قاعده‌مند از عملکرد پایدار شبیه‌سازی‌شده تا تخصیص واقعی در بازار کمیاب است و به ندرت مستند می‌شود.') },
      ] },
      { type: 'p', text: t(
        'Public outcome data is scarce and uneven. The figures below are the clearest published examples Openfund could verify. Each belongs to a single publisher and definition and must not be read as an industry average — but together they show how far evaluation success, payouts and live capital can sit from one another.',
        'دادهٔ عمومی دربارهٔ نتایج کمیاب و ناهمگون است. اعداد زیر روشن‌ترین نمونه‌های منتشرشده‌ای است که اوپن‌فاند توانست راستی‌آزمایی کند. هر عدد به یک ناشر و یک تعریف تعلق دارد و نباید میانگین صنعت تلقی شود — اما در کنار هم نشان می‌دهند موفقیت در ارزیابی، دریافت پرداخت و رسیدن به سرمایهٔ واقعی چقدر می‌توانند از یکدیگر دور باشند.') },
      { type: 'chart', dataset: 'industry-benchmarks' },
      { type: 'callout', tone: 'principle', title: t('No accusations, only evidence', 'بدون اتهام، فقط شواهد'), text: t(
        'Openfund does not claim that other firms act in bad faith. The point is structural: when the rules engine, the economics and the treasury cannot be inspected, even an honest operator cannot prove it.',
        'اوپن‌فاند ادعا نمی‌کند شرکت‌های دیگر با سوءنیت عمل می‌کنند. نکته ساختاری است: وقتی موتور قوانین، اقتصاد و خزانه قابل بررسی نباشند، حتی اپراتور صادق هم نمی‌تواند صداقتش را ثابت کند.') },
      { type: 'refs', keys: ['topstep-2025', 'fpfx-2024'] },
    ],
  },
  {
    slug: 'solution', sort: 4,
    kicker: t('The Openfund Approach', 'رویکرد اوپن‌فاند'),
    title: t('Make the system inspectable, then let it grow.', 'سامانه را قابل بررسی کن، سپس اجازه بده رشد کند.'),
    summary: t('How each problem maps to an Openfund design decision and an intended outcome.', 'هر مسئله چگونه به یک تصمیم طراحی در اوپن‌فاند و یک پیامد مورد انتظار نگاشت می‌شود.'),
    blocks: [
      { type: 'p', text: t(
        'Openfund does not try to solve these problems with a promise. It solves them with architecture: a single server-authoritative engine for every financial decision, ledgers that cannot be edited after the fact, public aggregates computed from those ledgers, and explicit gates between simulation and real capital.',
        'اوپن‌فاند این مسائل را با وعده حل نمی‌کند، بلکه با معماری حل می‌کند: یک موتور واحد با مرجعیت سرور برای هر تصمیم مالی، دفاتری که پس از ثبت قابل ویرایش نیستند، آمار تجمیعی عمومی که از همین دفاتر محاسبه می‌شود و دروازه‌های صریح میان شبیه‌سازی و سرمایهٔ واقعی.') },
      { type: 'mapping', head: [t('Problem', 'مسئله'), t('Openfund approach', 'رویکرد اوپن‌فاند'), t('Intended outcome', 'پیامد مورد انتظار')], rows: [
        [t('Opaque payout economics', 'اقتصاد پرداخت مبهم'), t('Public transparency report of sales, refunds, rewards paid and verified expenses (implemented, under review)', 'گزارش عمومی شفافیت از فروش، بازپرداخت، پاداش‌های پرداخت‌شده و هزینه‌های تأییدشده (پیاده‌سازی‌شده، در حال بازبینی)'), t('Traders can judge program sustainability from records', 'معامله‌گر پایداری برنامه را از روی سوابق می‌سنجد')],
        [t('Hidden treasury and liabilities', 'خزانه و بدهی‌های پنهان'), t('On-chain treasury snapshots and a financial position that subtracts obligations and reserves', 'تصویر لحظه‌ای آن‌چین خزانه و موقعیت مالی که تعهدات و ذخایر را کسر می‌کند'), t('Solvency is visible, not assumed', 'توان پرداخت دیده می‌شود، نه فرض')],
        [t('Closed rules engines', 'موتورهای قوانین بسته'), t('Evaluation engine in a public repository, rule snapshot frozen at purchase, immutable challenge events', 'موتور ارزیابی در مخزن عمومی، ثبت قوانین در لحظهٔ خرید، رویدادهای تغییرناپذیر چلنج'), t('Every pass or breach is explainable', 'هر قبولی یا تخطی قابل توضیح است')],
        [t('Simulated and real are blurred', 'ابهام شبیه‌سازی و واقعی'), t('Separate products, ledgers and vocabulary; simulated balances never count as capital', 'محصولات، دفاتر و واژگان جدا؛ موجودی شبیه‌سازی‌شده هرگز سرمایه به حساب نمی‌آید'), t('No trader mistakes a simulation for market exposure', 'هیچ معامله‌گری شبیه‌سازی را با ریسک بازار اشتباه نمی‌گیرد')],
        [t('Misaligned incentives', 'ناهم‌راستایی انگیزه‌ها'), t('Ambassador commission only on a first confirmed purchase; coach income only from realized live profit', 'کمیسیون سفیر فقط از نخستین خرید تأییدشده؛ درآمد کوچ فقط از سود تحقق‌یافتهٔ واقعی'), t('Partners are rewarded for genuine customers and genuine skill', 'همکاران برای مشتری واقعی و مهارت واقعی پاداش می‌گیرند')],
        [t('Barriers to real capital', 'موانع رسیدن به سرمایهٔ واقعی'), t('Live Market Access: record-based eligibility, coach verification and a $500,000 free-capital threshold', 'اتصال به بازار: احراز مبتنی بر سوابق، تأیید کوچ و آستانهٔ ۵۰۰٬۰۰۰ دلار سرمایهٔ آزاد'), t('A documented path from simulation to real allocation', 'مسیری مستند از شبیه‌سازی تا تخصیص واقعی')],
      ] },
      { type: 'callout', tone: 'warning', title: t('Strategic objectives, not guarantees', 'اهداف راهبردی، نه تضمین'), text: t(
        'Several approaches in the table are implemented but not yet released, and real-market execution is not enabled. The chapters that follow give the exact status of each.',
        'چند رویکرد جدول پیاده‌سازی شده اما هنوز منتشر نشده‌اند و اجرای واقعی در بازار فعال نیست. فصل‌های بعد وضعیت دقیق هر یک را بیان می‌کنند.') },
    ],
  },
  {
    slug: 'ecosystem', sort: 5,
    kicker: t('Ecosystem & Products', 'اکوسیستم و محصولات'),
    title: t('One workspace. Separate money. Explicit sources.', 'یک فضای کاری؛ پول جدا؛ منابع صریح.'),
    summary: t('The products and shared services that make up Openfund today.', 'محصولات و خدمات مشترکی که امروز اوپن‌فاند را می‌سازند.'),
    blocks: [
      { type: 'p', text: t(
        'Openfund products share presentation — the same terminal, navigation, identity and design language — while each keeps its own system of record. A shared look never implies shared collateral, a shared risk engine or transferable balances.',
        'محصولات اوپن‌فاند نمایش مشترک دارند — همان ترمینال، ناوبری، هویت و زبان طراحی — در حالی که هر یک سامانهٔ ثبت مستقل خود را دارد. ظاهر مشترک هرگز به معنای وثیقهٔ مشترک، موتور ریسک مشترک یا موجودی قابل انتقال نیست.') },
      { type: 'features', items: [
        { status: 'live', title: t('Openfund Trading Terminal', 'ترمینال معاملاتی اوپن‌فاند'), text: t('One branded workspace on the Vela charting engine with Gains Network candles and live marks, market selection, order ticket, positions, portfolio and a private trading journal.', 'یک فضای کاری برند‌شده بر پایهٔ موتور چارت Vela با کندل‌ها و قیمت‌های لحظه‌ای Gains Network، انتخاب بازار، فرم سفارش، پوزیشن‌ها، پورتفولیو و ژورنال معاملاتی خصوصی.') },
        { status: 'live', title: t('Openfund Prop', 'اوپن‌فاند پراپ'), text: t('Server-authoritative simulated execution and a rules engine that evaluates paid challenges against the published rule version frozen at purchase.', 'اجرای شبیه‌سازی‌شده با مرجعیت سرور و موتور قوانینی که چلنج‌های پولی را بر اساس نسخهٔ قوانینِ ثبت‌شده در لحظهٔ خرید ارزیابی می‌کند.') },
        { status: 'live', title: t('Openfund Perpetual', 'اوپن‌فاند پرپچوال'), text: t('Wallet-scoped reads of a trader’s own Gains Network positions, pending orders and history on Arbitrum One. Transaction execution is disabled.', 'خواندن پوزیشن‌ها، سفارش‌های در انتظار و تاریخچهٔ خود معامله‌گر در Gains Network روی Arbitrum One. اجرای تراکنش غیرفعال است.') },
        { status: 'implemented', title: t('Challenge purchases', 'خرید چلنج'), text: t('Server-priced orders paid from the trader’s wallet, verified on-chain before an account is provisioned exactly once. Production activation waits for an approved payment receiver.', 'سفارش با قیمت سرور که از کیف پول معامله‌گر پرداخت و پیش از ایجاد دقیقاً‌یک‌بارهٔ حساب، روی زنجیره تأیید می‌شود. فعال‌سازی در محیط اصلی منتظر تأیید نشانی دریافت پرداخت است.') },
        { status: 'implemented', title: t('Economy & Transparency', 'اقتصاد و شفافیت'), text: t('Public transparency report, treasury snapshots and the financial position used to gate capital allocation.', 'گزارش عمومی شفافیت، تصویر لحظه‌ای خزانه و موقعیت مالی که دروازهٔ تخصیص سرمایه است.') },
        { status: 'implemented', title: t('Ambassador & Coach programs', 'برنامه‌های سفیر و کوچ'), text: t('Two independent, reviewed partner roles with append-only commission and profit-share ledgers.', 'دو نقش همکاری مستقل و بازبینی‌شده با دفاتر کمیسیون و سهم سود فقط‌افزودنی.') },
        { status: 'planned', title: t('Live Market Access execution', 'اجرای واقعی اتصال به بازار'), text: t('Allocation of Openfund-owned capital to selected traders on Gains Network. The control plane is implemented; execution and settlement transfers are disabled.', 'تخصیص سرمایهٔ متعلق به اوپن‌فاند به معامله‌گران منتخب در Gains Network. لایهٔ کنترل پیاده‌سازی شده؛ اجرا و انتقال تسویه غیرفعال است.') },
        { status: 'planned', title: t('Openfund Protocol', 'پروتکل اوپن‌فاند'), text: t('A future liquidity-aggregation and routing layer. A dormant Solidity source foundation is preserved in the repository; nothing is deployed or routed.', 'لایهٔ آیندهٔ تجمیع نقدینگی و مسیریابی. یک زیربنای غیرفعال Solidity در مخزن نگهداری می‌شود؛ هیچ چیز مستقر یا مسیریابی نشده است.') },
      ] },
      { type: 'h3', text: t('Gains Network: what is read, what is not executed', 'Gains Network: چه خوانده می‌شود و چه اجرا نمی‌شود') },
      { type: 'table', caption: t('Gains Network integration by capability', 'یکپارچگی با Gains Network به تفکیک قابلیت'), head: [t('Capability', 'قابلیت'), t('Source', 'منبع'), t('Status', 'وضعیت')], rows: [
        [t('Market metadata (symbols, precision, leverage bounds)', 'فرادادهٔ بازار (نمادها، دقت، حدود اهرم)'), t('Gains public REST API', 'API عمومی REST گینز'), t('Live', 'فعال')],
        [t('Historical candles (1m to 1d)', 'کندل‌های تاریخی (۱ دقیقه تا ۱ روز)'), t('Gains public REST API', 'API عمومی REST گینز'), t('Live', 'فعال')],
        [t('Live price updates', 'به‌روزرسانی لحظه‌ای قیمت'), t('Gains WebSocket price stream', 'جریان قیمت WebSocket گینز'), t('Live', 'فعال')],
        [t('Order book (VOB) and executed trades panel', 'پنل دفتر سفارش (VOB) و معاملات انجام‌شده'), t('Gains Trading API public reads', 'خواندن عمومی Trading API گینز'), t('In development — deployed acceptance pending', 'در حال توسعه — پذیرش در محیط اصلی در انتظار')],
        [t('Wallet positions, orders and history', 'پوزیشن‌ها، سفارش‌ها و تاریخچهٔ کیف پول'), t('Official Arbitrum wallet endpoints', 'نقاط پایانی رسمی کیف پول آربیتروم'), t('Live (read-only)', 'فعال (فقط خواندنی)')],
        [t('Order execution and position management', 'اجرای سفارش و مدیریت پوزیشن'), t('Gains contracts', 'قراردادهای گینز'), t('Planned — disabled by default', 'برنامه‌ریزی‌شده — به‌طور پیش‌فرض غیرفعال')],
      ] },
      { type: 'callout', tone: 'principle', title: t('No inferred depth', 'بدون عمق ساختگی'), text: t(
        'An oracle price feed is not an order book. Openfund never derives market depth, executed volume or footprint data from price feeds; when a provider does not supply a value, the interface says so.',
        'فید قیمت اوراکل دفتر سفارش نیست. اوپن‌فاند هرگز عمق بازار، حجم اجراشده یا دادهٔ فوت‌پرینت را از فید قیمت استخراج نمی‌کند؛ وقتی ارائه‌دهنده مقداری را نمی‌دهد، رابط کاربری همین را اعلام می‌کند.') },
      { type: 'refs', keys: ['gains-integration', 'gains-docs', 'feature-status'] },
    ],
  },
  {
    slug: 'openness', sort: 6,
    kicker: t('Open Source & Community', 'متن‌باز و جامعه'),
    title: t('Public by default, precise about licences.', 'عمومی به‌طور پیش‌فرض؛ دقیق دربارهٔ مجوزها.'),
    summary: t('What is public, which licences apply and how the community participates.', 'چه چیزی عمومی است، کدام مجوزها اعمال می‌شوند و جامعه چگونه مشارکت می‌کند.'),
    blocks: [
      { type: 'p', text: t(
        'The full Openfund application — frontend, backend, rules engine, CMS scripts, documentation, architecture decision records and release automation — is developed in a public GitHub repository. Anyone can read the code that evaluates a challenge, the arithmetic that computes a commission, or the formula behind available capital.',
        'تمام اپلیکیشن اوپن‌فاند — فرانت‌اند، بک‌اند، موتور قوانین، اسکریپت‌های CMS، مستندات، سوابق تصمیم‌های معماری و خودکارسازی انتشار — در یک مخزن عمومی GitHub توسعه می‌یابد. هر کسی می‌تواند کدی را که یک چلنج را ارزیابی می‌کند، محاسبهٔ کمیسیون یا فرمول سرمایهٔ آزاد را بخواند.') },
      { type: 'callout', tone: 'warning', title: t('Source-available, not a blanket licence', 'کد در دسترس، نه مجوز فراگیر'), text: t(
        'The repository has no root licence. Public source availability is not a grant to copy, redistribute or reuse Openfund’s own code commercially; that requires agreement with the maintainers. Third-party components keep their own licences, listed below.',
        'مخزن مجوز ریشه ندارد. در دسترس بودن عمومی کد به معنای اجازهٔ کپی، توزیع مجدد یا استفادهٔ تجاری از کد خود اوپن‌فاند نیست و این کار نیازمند توافق با نگهدارندگان است. اجزای ثالث مجوزهای خود را حفظ می‌کنند که در ادامه آمده‌اند.') },
      { type: 'table', caption: t('Component licences preserved in the repository', 'مجوزهای اجزای نگهداری‌شده در مخزن'), head: [t('Component', 'جزء'), t('Licence', 'مجوز'), t('Role', 'نقش')], rows: [
        [t('Openfund application code', 'کد اپلیکیشن اوپن‌فاند'), t('No root licence (all rights reserved by default)', 'بدون مجوز ریشه (به‌طور پیش‌فرض همهٔ حقوق محفوظ)'), t('Website, terminal, backend, engine', 'وب‌سایت، ترمینال، بک‌اند، موتور')],
        [t('LuxAlgo Vela', 'Vela از LuxAlgo'), t('Apache-2.0 with NOTICE', 'Apache-2.0 همراه NOTICE'), t('Charting engine', 'موتور چارت')],
        [t('Gains Network SDK (vendored)', 'SDK گینز (درون‌سازی‌شده)'), t('MIT', 'MIT'), t('Reference only; does not enable execution', 'فقط مرجع؛ اجرا را فعال نمی‌کند')],
        [t('LuxAlgo trade journal core', 'هستهٔ ژورنال معاملاتی LuxAlgo'), t('MIT', 'MIT'), t('Journal analytics', 'تحلیل ژورنال')],
        [t('Openfund Protocol (from MUX Protocol)', 'پروتکل اوپن‌فاند (برگرفته از MUX Protocol)'), t('GPL-2.0 (component scope)', 'GPL-2.0 (در محدودهٔ همان جزء)'), t('Dormant source foundation', 'زیربنای کد غیرفعال')],
        [t('Vazirmatn font', 'قلم وزیرمتن'), t('OFL (bundled licence file)', 'OFL (فایل مجوز همراه)'), t('Persian typography', 'تایپوگرافی فارسی')],
      ] },
      { type: 'h3', text: t('How the community participates', 'جامعه چگونه مشارکت می‌کند') },
      { type: 'list', items: [
        t('Contributors open pull requests from isolated branches; nothing is pushed directly to the main branch and history is never rewritten.', 'مشارکت‌کنندگان از شاخه‌های مجزا درخواست ادغام باز می‌کنند؛ هیچ چیز مستقیماً به شاخهٔ اصلی ارسال نمی‌شود و تاریخچه هرگز بازنویسی نمی‌شود.'),
        t('Every pull request runs continuous integration: type checks, unit and browser tests, documentation checks, secret scanning and infrastructure validation.', 'هر درخواست ادغام یکپارچه‌سازی پیوسته را اجرا می‌کند: بررسی نوع، آزمون‌های واحد و مرورگر، بررسی مستندات، جست‌وجوی اسرار و اعتبارسنجی زیرساخت.'),
        t('Architectural decisions are recorded as public ADRs, and capability changes must update the public feature-status register.', 'تصمیم‌های معماری به‌صورت ADR عمومی ثبت می‌شوند و هر تغییر قابلیت باید ثبت عمومی وضعیت قابلیت‌ها را به‌روز کند.'),
        t('Traders and partners contribute through the Learning Centre, the ambassador and coach programs and public issue reports.', 'معامله‌گران و همکاران از طریق مرکز آموزش، برنامه‌های سفیر و کوچ و گزارش‌های عمومی مشکلات مشارکت می‌کنند.'),
      ] },
      { type: 'callout', tone: 'info', title: t('No token, no DAO', 'بدون توکن، بدون DAO'), text: t(
        'Openfund has no token, no tokenomics and no on-chain governance. Community participation is valued, but it does not carry voting rights or operational authority. Any change to that would be announced as a new, separately documented decision.',
        'اوپن‌فاند توکن، توکنومیکس یا حاکمیت آن‌چین ندارد. مشارکت جامعه ارزشمند است اما حق رأی یا اختیار عملیاتی به همراه ندارد. هرگونه تغییر در این زمینه به‌عنوان تصمیمی جدید و جداگانه مستند و اعلام خواهد شد.') },
      { type: 'refs', keys: ['repo', 'readme-licensing', 'contributing', 'protocol-provenance', 'vela'] },
    ],
  },
  {
    slug: 'architecture', sort: 7,
    kicker: t('Technology & Protocol Architecture', 'فناوری و معماری پروتکل'),
    title: t('Three resources, one financial authority.', 'سه منبع، یک مرجع مالی.'),
    summary: t('How the application is built, where each decision is made and where the security boundaries sit.', 'اپلیکیشن چگونه ساخته شده، هر تصمیم کجا گرفته می‌شود و مرزهای امنیتی کجا قرار دارند.'),
    blocks: [
      { type: 'lead', text: t(
        'Openfund deliberately avoids artificial microservices. Production runs three resources: one Node.js service that serves the web application and the API, one PostgreSQL database, and one Directus content service.',
        'اوپن‌فاند آگاهانه از ریزسرویس‌های مصنوعی پرهیز می‌کند. محیط اصلی سه منبع را اجرا می‌کند: یک سرویس Node.js که اپلیکیشن وب و API را ارائه می‌دهد، یک پایگاه دادهٔ PostgreSQL و یک سرویس محتوای Directus.') },
      { type: 'architecture', label: t('Openfund runtime architecture', 'معماری اجرایی اوپن‌فاند'), layers: [
        { title: t('Clients', 'کلاینت‌ها'), nodes: [
          { title: t('React 19 + TypeScript web app', 'اپلیکیشن وب React 19 و TypeScript'), text: t('Five locales, RTL/LTR, light/dark', 'پنج زبان، راست‌به‌چپ/چپ‌به‌راست، روشن/تیره'), status: 'live' },
          { title: t('Wallet connection', 'اتصال کیف پول'), text: t('RainbowKit, wagmi, viem', 'RainbowKit، wagmi، viem'), status: 'live' },
          { title: t('Vela terminal workspace', 'فضای کاری ترمینال Vela'), text: t('Charts, indicators, order ticket', 'چارت، اندیکاتور، فرم سفارش'), status: 'live' },
        ] },
        { title: t('Application service', 'سرویس اپلیکیشن'), nodes: [
          { title: t('SIWE sessions and ownership', 'نشست SIWE و مالکیت'), status: 'live' },
          { title: t('Prop engine and evaluation', 'موتور پراپ و ارزیابی'), status: 'live' },
          { title: t('Purchases and payment verification', 'خرید و تأیید پرداخت'), status: 'implemented' },
          { title: t('Economy, partners and live-funding control plane', 'اقتصاد، همکاران و لایهٔ کنترل تأمین سرمایهٔ واقعی'), status: 'implemented' },
        ] },
        { title: t('Data and content', 'داده و محتوا'), nodes: [
          { title: t('PostgreSQL 17', 'PostgreSQL 17'), text: t('Ledgers, accounts, append-only audit tables', 'دفاتر، حساب‌ها، جداول ممیزی فقط‌افزودنی'), status: 'live' },
          { title: t('Directus 11.9.1 CMS', 'Directus 11.9.1'), text: t('Published editorial content only', 'فقط محتوای منتشرشده'), status: 'live' },
        ] },
        { title: t('External sources', 'منابع بیرونی'), nodes: [
          { title: t('Gains Network APIs', 'APIهای Gains Network'), text: t('Market data and wallet reads', 'دادهٔ بازار و خواندن کیف پول'), status: 'live' },
          { title: t('Blockchain RPC', 'RPC بلاکچین'), text: t('Payment receipts and treasury balances', 'رسید پرداخت و موجودی خزانه'), status: 'implemented' },
          { title: t('Chainlink price feeds', 'فیدهای قیمت Chainlink'), text: t('Treasury valuation', 'ارزش‌گذاری خزانه'), status: 'implemented' },
        ] },
      ] },
      { type: 'table', caption: t('Technology choices and responsibilities', 'انتخاب‌های فناوری و مسئولیت‌ها'), head: [t('Layer', 'لایه'), t('Technology', 'فناوری'), t('Responsibility', 'مسئولیت')], rows: [
        [t('Frontend', 'فرانت‌اند'), t('React, TypeScript, Vite, React Router', 'React، TypeScript، Vite، React Router'), t('Routes, product views, wallet and session state', 'مسیرها، نماهای محصول، وضعیت کیف پول و نشست')],
        [t('Charting', 'چارت'), t('LuxAlgo Vela with an Openfund Gains adapter', 'Vela از LuxAlgo با آداپتور گینز اوپن‌فاند'), t('Candles, live marks, indicators', 'کندل، قیمت لحظه‌ای، اندیکاتورها')],
        [t('API and engine', 'API و موتور'), t('Node.js, Express, Decimal arithmetic, Server-Sent Events', 'Node.js، Express، محاسبات Decimal، Server-Sent Events'), t('Authentication, simulated execution, evaluation, commerce, economy', 'احراز هویت، اجرای شبیه‌سازی‌شده، ارزیابی، تجارت، اقتصاد')],
        [t('Database', 'پایگاه داده'), t('PostgreSQL 17, idempotent additive migrations', 'PostgreSQL 17، مهاجرت‌های افزودنی و تکرارپذیر'), t('System of record for every financial row', 'سامانهٔ ثبت برای هر ردیف مالی')],
        [t('Content', 'محتوا'), t('Directus 11.9.1, public read of published rows', 'Directus 11.9.1، خواندن عمومی ردیف‌های منتشرشده'), t('Editorial pages, catalog administration, this whitepaper', 'صفحات محتوایی، مدیریت کاتالوگ، همین وایت‌پیپر')],
        [t('Deployment and release', 'استقرار و انتشار'), t('Infrastructure-as-code blueprint, GitHub Actions, immutable release manifests', 'نقشهٔ زیرساخت به‌صورت کد، GitHub Actions، مانیفست‌های تغییرناپذیر انتشار'), t('Reproducible, verifiable deployments', 'استقرارهای تکرارپذیر و قابل راستی‌آزمایی')],
      ] },
      { type: 'h3', text: t('Security boundaries', 'مرزهای امنیتی') },
      { type: 'list', items: [
        t('Browser values never authorise a financial change; the backend re-prices, re-validates and owns every mutation.', 'مقادیر مرورگر هرگز مجوز تغییر مالی نیستند؛ بک‌اند قیمت‌گذاری و اعتبارسنجی را دوباره انجام می‌دهد و مالک هر تغییر است.'),
        t('Sign-In with Ethereum establishes identity only. A session never authorises a blockchain transaction.', 'ورود با اتریوم فقط هویت را مشخص می‌کند. نشست هرگز مجوز تراکنش بلاکچینی نیست.'),
        t('The CMS public role reads published content only and can never see accounts, sessions or financial tables.', 'نقش عمومی CMS فقط محتوای منتشرشده را می‌خواند و هرگز به حساب‌ها، نشست‌ها یا جداول مالی دسترسی ندارد.'),
        t('Administrative financial actions require a server-side token and a named operator, and are written to an append-only audit log.', 'اقدامات مالی مدیریتی به توکن سمت سرور و اپراتور مشخص نیاز دارند و در گزارش ممیزی فقط‌افزودنی ثبت می‌شوند.'),
        t('No private keys exist in the system. Treasury reads use a public address; execution and payout adapters are disabled by default.', 'هیچ کلید خصوصی در سامانه وجود ندارد. خواندن خزانه با نشانی عمومی انجام می‌شود و آداپتورهای اجرا و پرداخت به‌طور پیش‌فرض غیرفعال‌اند.'),
        t('Secret scanning runs in continuous integration, and secrets are injected only through the deployment environment.', 'جست‌وجوی اسرار در یکپارچه‌سازی پیوسته اجرا می‌شود و اسرار فقط از طریق محیط استقرار تزریق می‌شوند.'),
      ] },
      { type: 'h3', text: t('Protocol status', 'وضعیت پروتکل') },
      { type: 'p', text: t(
        'The long-term Openfund Protocol aims to aggregate liquidity across venues and choose execution paths intelligently. Today the repository holds only a dormant Solidity foundation imported from MUX Protocol under GPL-2.0. It is not referenced by the application, not compiled by the release pipeline and not deployed to any chain. Turning it into a product is a separate, separately authorised project.',
        'هدف بلندمدت پروتکل اوپن‌فاند تجمیع نقدینگی میان بازارها و انتخاب هوشمند مسیر اجراست. امروز مخزن فقط یک زیربنای غیرفعال Solidity را نگه می‌دارد که از MUX Protocol تحت GPL-2.0 وارد شده است. این زیربنا در اپلیکیشن ارجاع داده نمی‌شود، در خط انتشار کامپایل نمی‌شود و روی هیچ زنجیره‌ای مستقر نیست. تبدیل آن به محصول، پروژه‌ای جداگانه و نیازمند مجوز جداگانه است.') },
      { type: 'refs', keys: ['architecture', 'deployment-blueprint', 'siwe', 'protocol-provenance', 'release-v044'] },
    ],
  },
]
