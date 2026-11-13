/* ============================================================
   About Openfund — editorial copy (English / Persian source; the added
   locales translate the English source through i18n/content).

   Accuracy contract for this page:
   - The origin story is presented as the project's motivation and
     vision, never as dated company history. No founders, team members,
     funding, user counts, partners or volumes are named or implied.
   - Every capability is labelled by what it is TODAY: simulated prop
     evaluation (server engine), read-only Gains market data and wallet
     reads, read-only Hyperliquid order-flow analytics, Vela charting,
     wallet sign-in on Arbitrum One, DePay checkout. Live order execution
     on Gains and automatic payouts are NOT available (feature register:
     Blocked) and appear only under "planned".
   - No "No KYC", "No VPN", "zero spread", "lowest fees", "no
     restrictions" or "fully decentralized trading" claims. Rule numbers
     are rendered from the plan catalog, never written into this copy.
   ============================================================ */
import { text } from '../information/content'

export const aboutMeta = {
  title: text('About Openfund', 'دربارهٔ اوپن‌فاند'),
  description: text(
    'Why Openfund exists: a wallet-native trading environment and prop evaluation built on transparent rules, decentralized market infrastructure and server-checked fairness.',
    'چرا اوپن‌فاند وجود دارد: محیط معاملاتی مبتنی بر کیف پول و ارزیابی پراپ بر پایهٔ قوانین شفاف، زیرساخت بازار غیرمتمرکز و انصافی که سرور آن را بررسی می‌کند.'),
}

export const aboutHero = {
  eyebrow: text('About us', 'دربارهٔ ما'),
  title: text('A clearer way forward', 'راهی روشن‌تر به جلو'),
  accent: text('for traders who want to see the rules.', 'برای معامله‌گرانی که می‌خواهند قوانین را ببینند.'),
  intro: text(
    'Openfund began with a simple frustration shared by many traders: the tools were powerful, but the terms were hard to see. We are building a trading environment where access starts with your wallet, the rules are published before you pay, and every evaluation decision can be traced to a number.',
    'اوپن‌فاند از یک دلخوری ساده آغاز شد که میان بسیاری از معامله‌گران مشترک است: ابزارها قدرتمند بودند، اما شرایط به‌سختی دیده می‌شد. ما محیطی معاملاتی می‌سازیم که دسترسی در آن با کیف پول خودت شروع می‌شود، قوانین پیش از پرداخت منتشر شده‌اند و هر تصمیم ارزیابی را می‌توان تا یک عدد دنبال کرد.'),
  note: text(
    'This page describes why Openfund exists and where it is heading. It is a statement of motivation and direction, not a company history.',
    'این صفحه توضیح می‌دهد اوپن‌فاند چرا وجود دارد و به کجا می‌رود. این متن بیان انگیزه و مسیر است، نه تاریخچهٔ شرکت.'),
}

export const aboutSections = {
  story: {
    eyebrow: text('Our story', 'داستان ما'),
    title: text('It started at the chart, not in a boardroom.', 'از کنار چارت شروع شد، نه در اتاق جلسه.'),
    body: [
      text(
        'Picture a trader at the end of a long session. The analysis was careful, the risk was sized, the stop was where it should be. Then the evaluation result arrives, and the reason for it sits in a clause they had never seen, measured from a balance they could not check.',
        'معامله‌گری را در پایان یک جلسهٔ طولانی تصور کن. تحلیل دقیق بود، ریسک اندازه‌گیری شده بود و حد ضرر سر جایش بود. بعد نتیجهٔ ارزیابی می‌رسد و دلیلش در بندی است که هرگز ندیده بود و از موجودی‌ای اندازه‌گیری شده که نمی‌توانست بررسی‌اش کند.'),
      text(
        'That scene is not one person’s memory. It is a pattern many traders recognise, and it is the pattern Openfund was conceived to break. The people behind Openfund came to the idea as traders first: people exploring decentralized finance, self-custody and open market infrastructure, and asking why the trading experience around them still depended on so much that could not be seen.',
        'این صحنه خاطرهٔ یک نفر نیست؛ الگویی است که بسیاری از معامله‌گران آن را می‌شناسند و اوپن‌فاند برای شکستن همین الگو طراحی شد. کسانی که پشت اوپن‌فاند هستند، پیش از هر چیز به‌عنوان معامله‌گر به این ایده رسیدند: کسانی که امور مالی غیرمتمرکز، نگهداری شخصی دارایی و زیرساخت باز بازار را کاوش می‌کردند و می‌پرسیدند چرا تجربهٔ معاملاتی اطرافشان هنوز به چیزهای نادیدنیِ زیادی وابسته است.'),
    ],
  },
  problem: {
    eyebrow: text('The problem we experienced as traders', 'مسئله‌ای که به‌عنوان معامله‌گر تجربه کردیم'),
    title: text('Good tools, hidden terms.', 'ابزارهای خوب، شرایط پنهان.'),
    items: [
      { title: text('Rules you meet after paying', 'قوانینی که پس از پرداخت با آن‌ها روبه‌رو می‌شوی'), body: text('Drawdown definitions, day boundaries and reward conditions often live in long documents that are easy to miss and hard to compare.', 'تعریف افت سرمایه، مرز روزها و شرایط پاداش اغلب در اسناد طولانی پنهان است؛ به‌راحتی از چشم می‌افتند و مقایسه‌شان دشوار است.') },
      { title: text('Numbers you cannot check', 'عددهایی که نمی‌توانی بررسی کنی'), body: text('When the balance, the daily basis or the loss limit is calculated somewhere you cannot see, a breach feels like a verdict rather than a measurement.', 'وقتی موجودی، مبنای روزانه یا حد ضرر جایی محاسبه می‌شود که نمی‌بینی، نقض قانون بیشتر شبیه حکم است تا اندازه‌گیری.') },
      { title: text('Access that depends on intermediaries', 'دسترسی وابسته به واسطه‌ها'), body: text('Accounts, passwords and layers of intermediaries stand between a trader and the market, each one another place where friction and opacity can enter.', 'حساب‌ها، رمزهای عبور و لایه‌های واسطه میان معامله‌گر و بازار ایستاده‌اند و هر کدام جای دیگری برای ورود اصطکاک و ابهام است.') },
      { title: text('Costs that are hard to see in advance', 'هزینه‌هایی که از پیش دیده نمی‌شوند'), body: text('Fees, spreads and conditions that only become visible after the fact make it difficult to judge whether an offer is fair.', 'کارمزد، اسپرد و شرایطی که فقط پس از وقوع دیده می‌شوند، قضاوت دربارهٔ منصفانه‌بودن یک پیشنهاد را دشوار می‌کنند.') },
    ],
  },
  why: {
    eyebrow: text('Why we built Openfund', 'چرا اوپن‌فاند را ساختیم'),
    title: text('Bring the clarity of open infrastructure to the trading desk.', 'شفافیت زیرساخت باز را به میز معامله بیاوریم.'),
    body: [
      text(
        'Decentralized finance showed that markets can publish their data openly, that a wallet can replace a password, and that rules can be written down precisely enough for software to enforce. We wanted that same clarity around a professional trading environment and a fair way to prove skill.',
        'امور مالی غیرمتمرکز نشان داد که بازارها می‌توانند داده‌هایشان را آشکارا منتشر کنند، کیف پول می‌تواند جای رمز عبور را بگیرد و قوانین را می‌توان آن‌قدر دقیق نوشت که نرم‌افزار اجرایشان کند. ما همین شفافیت را برای یک محیط معاملاتی حرفه‌ای و راهی منصفانه برای اثبات مهارت می‌خواستیم.'),
      text(
        'So Openfund combines a professional charting terminal, decentralized market data, wallet-native access, published costs and evaluation rules that the server applies exactly as written, with a business model we explain in the open.',
        'پس اوپن‌فاند یک ترمینال چارت حرفه‌ای، دادهٔ بازار غیرمتمرکز، دسترسی مبتنی بر کیف پول، هزینه‌های منتشرشده و قوانین ارزیابی‌ای را که سرور دقیقاً همان‌طور که نوشته شده اجرا می‌کند، با مدل کسب‌وکاری که آشکارا توضیح می‌دهیم کنار هم می‌گذارد.'),
    ],
  },
  mission: {
    eyebrow: text('Our mission', 'مأموریت ما'),
    title: text('Make trading evaluation measurable, published and fair.', 'ارزیابی معاملاتی را قابل‌اندازه‌گیری، منتشرشده و منصفانه کنیم.'),
    body: text(
      'Give every trader the same published rules, the same server-side calculations and the same view of their own numbers, so that the result of an evaluation reflects trading, not fine print.',
      'به هر معامله‌گر همان قوانین منتشرشده، همان محاسبات سمت سرور و همان دید به عددهای خودش را بدهیم تا نتیجهٔ ارزیابی بازتاب معامله باشد، نه ریزنویس قرارداد.'),
  },
  vision: {
    eyebrow: text('Our vision', 'چشم‌انداز ما'),
    title: text('A trading ecosystem you can inspect.', 'اکوسیستم معاملاتی‌ای که بتوانی بررسی‌اش کنی.'),
    body: text(
      'We imagine a place where a trader can open the rulebook, the chart, the order flow and the economics behind the platform side by side, and find that they all say the same thing.',
      'جایی را تصور می‌کنیم که معامله‌گر بتواند قوانین، چارت، جریان سفارش و اقتصاد پشت پلتفرم را کنار هم باز کند و ببیند همه یک چیز می‌گویند.'),
  },
  traders: {
    eyebrow: text('Built around traders', 'ساخته‌شده حول معامله‌گر'),
    title: text('Designed from the trader’s side of the screen.', 'طراحی‌شده از سمت معامله‌گرِ صفحه.'),
    items: [
      { title: text('Your wallet is your login', 'کیف پولت، ورود توست'), body: text('Sign in by signing a message with your wallet. No account password is created or stored.', 'با امضای یک پیام با کیف پولت وارد می‌شوی. هیچ رمز عبوری ساخته یا ذخیره نمی‌شود.') },
      { title: text('Your numbers, live', 'عددهای تو، زنده'), body: text('Balance, equity, daily loss basis and drawdown floor are shown as the engine measures them.', 'موجودی، اکوئیتی، مبنای ضرر روزانه و کف افت سرمایه همان‌طور نمایش داده می‌شوند که موتور اندازه می‌گیرد.') },
      { title: text('Terms frozen at purchase', 'شرایطِ ثابت‌شده هنگام خرید'), body: text('Each purchased challenge keeps the rules snapshot it was sold with. Later catalog changes never rewrite it.', 'هر چلنج خریداری‌شده همان نسخهٔ قوانینی را نگه می‌دارد که با آن فروخته شده است؛ تغییرات بعدی فهرست هرگز آن را بازنویسی نمی‌کند.') },
      { title: text('A person reviews every pass', 'هر قبولی را یک انسان بررسی می‌کند'), body: text('Passed evaluations and reward requests are reviewed by an operator, and every decision is recorded.', 'ارزیابی‌های قبول‌شده و درخواست‌های پاداش را یک اپراتور بررسی می‌کند و هر تصمیم ثبت می‌شود.') },
    ],
  },
  technology: {
    eyebrow: text('Technology behind Openfund', 'فناوری پشت اوپن‌فاند'),
    title: text('Open infrastructure, clearly labelled.', 'زیرساخت باز، با برچسب روشن.'),
    intro: text(
      'Each building block below is marked with what it does in Openfund today. Simulated means no real order is sent to any exchange. Read-only means Openfund displays data and never places transactions.',
      'هر جزء زیر با کاری که امروز در اوپن‌فاند انجام می‌دهد مشخص شده است. «شبیه‌سازی‌شده» یعنی هیچ سفارش واقعی‌ای به هیچ صرافی‌ای فرستاده نمی‌شود. «فقط‌خواندنی» یعنی اوپن‌فاند داده را نمایش می‌دهد و هرگز تراکنشی ثبت نمی‌کند.'),
    items: [
      { key: 'gains', status: 'read-only', title: text('Gains Network market data', 'دادهٔ بازار Gains Network'), body: text('Prices, candles and market metadata come from Gains Network, a decentralized leveraged-trading protocol. Openfund reads this data; it does not execute trades on Gains.', 'قیمت‌ها، کندل‌ها و مشخصات بازار از Gains Network، یک پروتکل غیرمتمرکز معاملات اهرمی، می‌آیند. اوپن‌فاند این داده را می‌خواند؛ روی Gains معامله اجرا نمی‌کند.') },
      { key: 'engine', status: 'simulated', title: text('Server-authoritative evaluation engine', 'موتور ارزیابی با مرجعیت سرور'), body: text('Challenge trades are simulated by Openfund’s own engine using decimal arithmetic, modelled fees and spread, and the rules frozen into each account.', 'معاملات چلنج را موتور خود اوپن‌فاند با محاسبات اعشاری دقیق، کارمزد و اسپرد مدل‌شده و قوانین ثابت‌شدهٔ هر حساب شبیه‌سازی می‌کند.') },
      { key: 'vela', status: 'live', title: text('Professional charting', 'چارت حرفه‌ای'), body: text('The terminal is built on the Vela charting engine, with indicators, drawings and per-wallet chart workspaces.', 'ترمینال بر پایهٔ موتور چارت Vela ساخته شده است؛ با اندیکاتورها، ابزارهای ترسیم و فضای کاری چارت برای هر کیف پول.') },
      { key: 'hyperliquid', status: 'read-only', title: text('Hyperliquid order-flow analytics', 'تحلیل جریان سفارش Hyperliquid'), body: text('Footprint views use public Hyperliquid trade data for order-flow analysis on the chart. They are analytics, not an execution venue.', 'نمای فوت‌پرینت از دادهٔ عمومی معاملات Hyperliquid برای تحلیل جریان سفارش روی چارت استفاده می‌کند. این بخش تحلیلی است، نه محل اجرای معامله.') },
      { key: 'wallet', status: 'live', title: text('Wallet sign-in on Arbitrum One', 'ورود با کیف پول روی Arbitrum One'), body: text('Authentication uses Sign-In with Ethereum on Arbitrum One, with signed, single-use challenges and server-side sessions.', 'احراز هویت با «ورود با اتریوم» روی Arbitrum One و با چالش‌های امضاشدهٔ یک‌بارمصرف و نشست‌های سمت سرور انجام می‌شود.') },
      { key: 'checkout', status: 'live', title: text('Crypto checkout', 'پرداخت رمزارزی'), body: text('Challenge fees are paid through DePay. The backend verifies the payment on-chain before an order is marked paid and a challenge is created.', 'هزینهٔ چلنج از طریق DePay پرداخت می‌شود. بک‌اند پیش از علامت‌گذاری سفارش به‌عنوان پرداخت‌شده و ساخت چلنج، پرداخت را روی زنجیره تأیید می‌کند.') },
    ],
  },
  decentralization: {
    eyebrow: text('Decentralization and accessibility', 'غیرمتمرکزسازی و دسترس‌پذیری'),
    title: text('Wallet-native, and honest about what is on-chain.', 'مبتنی بر کیف پول و صادق دربارهٔ آنچه روی زنجیره است.'),
    body: [
      text(
        'Openfund is built around self-custody: you keep your keys, you sign in with your wallet, and you pay from it. Market data comes from decentralized infrastructure. At the same time, your challenge account is a simulated account on Openfund’s servers, and we say so plainly.',
        'اوپن‌فاند حول نگهداری شخصی دارایی ساخته شده است: کلیدها نزد خودت می‌ماند، با کیف پولت وارد می‌شوی و از همان پرداخت می‌کنی. دادهٔ بازار از زیرساخت غیرمتمرکز می‌آید. در عین حال، حساب چلنج تو یک حساب شبیه‌سازی‌شده روی سرورهای اوپن‌فاند است و این را صریح می‌گوییم.'),
      text(
        'Availability can depend on the law where you live and on the requirements of the services we rely on. Where verification of identity is required before a reward is paid, we will ask for it and explain why.',
        'دسترسی ممکن است به قوانین محل زندگی تو و الزامات سرویس‌هایی که به آن‌ها متکی هستیم بستگی داشته باشد. هرجا پیش از پرداخت پاداش احراز هویت لازم باشد، آن را درخواست و دلیلش را توضیح می‌دهیم.'),
    ],
    today: text('Available today', 'در دسترس امروز'),
    planned: text('Planned, not available', 'برنامه‌ریزی‌شده، در دسترس نیست'),
    todayItems: [
      text('Simulated prop evaluations with published rules', 'ارزیابی پراپ شبیه‌سازی‌شده با قوانین منتشرشده'),
      text('Read-only Gains market data and wallet portfolio views', 'دادهٔ بازار و نمای پورتفوی کیف پول Gains، فقط‌خواندنی'),
      text('Read-only Hyperliquid order-flow analytics', 'تحلیل جریان سفارش Hyperliquid، فقط‌خواندنی'),
      text('Wallet sign-in and on-chain verified checkout', 'ورود با کیف پول و پرداخت تأییدشده روی زنجیره'),
    ],
    plannedItems: [
      text('Live order execution on Gains Network', 'اجرای زندهٔ سفارش روی Gains Network'),
      text('Automatic on-chain reward payouts', 'پرداخت خودکار پاداش روی زنجیره'),
    ],
  },
  fairness: {
    eyebrow: text('Transparency and fair evaluation', 'شفافیت و ارزیابی منصفانه'),
    title: text('The same numbers everywhere.', 'همان عددها، همه‌جا.'),
    body: text(
      'The challenge you see on the website, the summary at checkout, the rules frozen into your account and the limits the engine enforces come from one approved plan specification. Automated checks fail the build if any of them drift apart.',
      'چلنجی که در وب‌سایت می‌بینی، خلاصهٔ هنگام پرداخت، قوانین ثابت‌شده در حسابت و حدودی که موتور اجرا می‌کند همه از یک مشخصات تأییدشدهٔ پلن می‌آیند. اگر هر کدام از دیگری فاصله بگیرد، بررسی‌های خودکار ساخت را متوقف می‌کنند.'),
    planLabel: text('Published plan terms (live from the catalog)', 'شرایط منتشرشدهٔ پلن‌ها (مستقیم از فهرست)'),
    target: text('Profit target', 'هدف سود'),
    daily: text('Daily loss', 'ضرر روزانه'),
    max: text('Maximum loss', 'حداکثر ضرر'),
    share: text('Reward share', 'سهم پاداش'),
    trailing: text('trailing', 'شناور'),
    none: text('No target', 'بدون هدف'),
  },
  future: {
    eyebrow: text('The future we are building', 'آینده‌ای که می‌سازیم'),
    title: text('Step by step, in the open.', 'گام‌به‌گام، در معرض دید.'),
    body: text(
      'Our roadmap moves toward deeper decentralized market access, community governance and more of the platform’s economics published as data. Each step is released only when it is built, tested and approved, and until then it is labelled as planned.',
      'نقشهٔ راه ما به سمت دسترسی عمیق‌تر به بازار غیرمتمرکز، حاکمیت جامعه‌محور و انتشار بخش بیشتری از اقتصاد پلتفرم به‌صورت داده پیش می‌رود. هر گام فقط وقتی منتشر می‌شود که ساخته، آزموده و تأیید شده باشد و تا آن زمان «برنامه‌ریزی‌شده» برچسب می‌خورد.'),
  },
  join: {
    eyebrow: text('Join the Openfund community', 'به جامعهٔ اوپن‌فاند بپیوند'),
    title: text('Read the rules. Open the chart. Ask us anything.', 'قوانین را بخوان. چارت را باز کن. هر سؤالی داری بپرس.'),
    body: text(
      'The best way to judge Openfund is to inspect it. Start with the rules, try the terminal, read how the economy works, and talk to us and other traders.',
      'بهترین راه قضاوت دربارهٔ اوپن‌فاند بررسی خود آن است. با قوانین شروع کن، ترمینال را امتحان کن، بخوان اقتصادش چطور کار می‌کند و با ما و معامله‌گران دیگر گفت‌وگو کن.'),
  },
}

export const aboutLinks = {
  challenges: text('Explore challenges', 'مشاهدهٔ چلنج‌ها'),
  terminal: text('Open the trading terminal', 'باز کردن ترمینال معاملاتی'),
  economy: text('How the economy works', 'اقتصاد چطور کار می‌کند'),
  transparency: text('Transparency', 'شفافیت'),
  governance: text('Governance', 'حاکمیت'),
  contact: text('Contact us', 'تماس با ما'),
  community: text('Join the Telegram community', 'پیوستن به جامعهٔ تلگرام'),
  rulebook: text('Read the rulebook', 'خواندن قوانین'),
}

export const statusLabels = {
  live: text('Live', 'فعال'),
  simulated: text('Simulated', 'شبیه‌سازی‌شده'),
  'read-only': text('Read-only', 'فقط‌خواندنی'),
}
