import { text } from '../../features/information/content'
import type { FaqCategoryContent, FaqItemContent } from '../contentTypes'

/** Canonical content for the site-wide FAQ page (6 categories, 43 questions).
 *  This file is the repo authoring source and is also seeded into the Directus
 *  `faqs` collection, so every `key` is a stable lowercase ASCII slug.
 *  NOT imported by the app at runtime — the page renders from Directus. */

export const faqCategories: FaqCategoryContent[] = [
  { key: 'getting-started', sort: 1, icon: 'start',
    label: text('Getting Started', 'راهنمای شروع'),
    description: text('What Openfund is, who can use it and how the demo and the challenge path begin.', 'اوپن‌فاند چیست، چه کسی می‌تواند استفاده کند و مسیر دمو و چلنج چگونه آغاز می‌شود.') },
  { key: 'payouts', sort: 2, icon: 'payout',
    label: text('Payouts & Withdrawals', 'برداشت و پاداش'),
    description: text('Reward sharing and payout conditions for funded traders, published as terms of record.', 'سهم سود و شرایط برداشتِ معامله‌گر فاندشده، به‌عنوان شرایطِ منتشرشده.') },
  { key: 'trading-rules', sort: 3, icon: 'rules',
    label: text('Trading Rules', 'قوانین معاملاتی'),
    description: text('Targets, loss limits, consistency and the practices that close an account.', 'اهداف، سقف‌های ضرر، تداوم و رفتارهایی که حساب را می‌بندد.') },
  { key: 'referrals', sort: 4, icon: 'partner',
    label: text('Affiliates & Referrals', 'معرفی و همکاری'),
    description: text('The Growth Partner program is in design and pre-launch; this says what is live and what is pending.', 'برنامهٔ «شریک رشد» در حال طراحی و پیش از عرضه است؛ اینجا روشن است چه چیزی فعال و چه چیزی در انتظار است.') },
  { key: 'terminal', sort: 5, icon: 'terminal',
    label: text('Trading Terminal', 'ترمینال معاملاتی'),
    description: text('Markets, leverage, orders and the live data the terminal actually shows.', 'بازارها، اهرم، سفارش‌ها و دادهٔ زنده‌ای که ترمینال واقعاً نشان می‌دهد.') },
  { key: 'transparency', sort: 6, icon: 'verify',
    label: text('Transparency', 'شفافیت و راستی‌آزمایی'),
    description: text('Capital handling, on-chain verification, risk systems and audit status, stated honestly.', 'نگهداری سرمایه، راستی‌آزمایی آن‌چین، سامانهٔ ریسک و وضعیت حسابرسی، صادقانه بیان‌شده.') },
]

export const faqItems: FaqItemContent[] = [
  /* ------------------------------------------------------- Getting Started -- */
  { key: 'what-is-openfund', category: 'getting-started', sort: 1,
    question: text('What is Openfund?', 'اوپن‌فاند چیست؟'),
    answer: text('Openfund is a trading platform with two products on one terminal: Prop Trading and Perpetual Trading. Today Prop Trading runs a simulated demo account — one per user, funded once with 100,000 virtual DAI and priced from live Gains Network mark prices — while Perpetual Trading shows read-only data from the public Gains Network deployment on Arbitrum One.', 'اوپن‌فاند یک پلتفرم معاملاتی است که دو محصول را روی یک ترمینال دارد: معاملهٔ چلنجی (Prop Trading) و معاملهٔ دائمی (Perpetual Trading). امروز محصول چلنجی یک حساب دموی شبیه‌سازی‌شده اجرا می‌کند — یک حساب برای هر کاربر، یک‌بار با ۱۰۰٬۰۰۰ دای مجازی، قیمت‌گذاری‌شده از قیمت مرجع زندهٔ Gains Network — و محصول دائمی فقط دادهٔ خواندنی از استقرار عمومی Gains Network بر بستر Arbitrum One نشان می‌دهد.'),
    links: [
      { target: { kind: 'terminal', product: 'prop' }, label: text('Prop terminal', 'ترمینال چلنجی') },
      { target: { kind: 'terminal', product: 'perpetual' }, label: text('Perpetual view', 'نمای معاملات دائمی') },
    ] },
  { key: 'is-openfund-trustworthy', category: 'getting-started', sort: 2,
    question: text('Is Openfund trustworthy, and what makes it verifiable?', 'آیا اوپن‌فاند قابل‌اعتماد است و چه چیزی آن را راستی‌آزمایی‌پذیر می‌کند؟'),
    answer: text('You can verify the published terms and read the public Gains Network data the perpetual view uses, and the signed-in demo keeps your own order, position and ledger records. What is not claimed: an audit, proof of reserves or public cryptographic proofs — those are not live and remain planned.', 'می‌توانی شرایط منتشرشده را راستی‌آزمایی کنی و دادهٔ عمومی Gains Network که نمای دائمی استفاده می‌کند را بخوانی؛ حساب دموی پس از ورود هم سوابق سفارش، موقعیت و دفترِ خودت را نگه می‌دارد. آنچه ادعا نمی‌شود: حسابرسی، اثبات ذخایر یا اثبات رمزنگاری‌شدهٔ عمومی — این‌ها فعال نیستند و همچنان در برنامه‌اند.'),
    links: [
      { target: { kind: 'page', slug: 'transparency' }, label: text('Transparency page', 'صفحهٔ شفافیت') },
      { target: { kind: 'lesson', slug: 'limits-of-onchain-transparency' }, label: text('Limits of on-chain transparency', 'حدود شفافیت آن‌چین') },
    ] },
  { key: 'do-i-need-to-deposit', category: 'getting-started', sort: 3,
    question: text('Do I need to deposit money to start?', 'برای شروع باید واریز کنم؟'),
    answer: text('No. Signing in and using the demo require no deposit, no card and no transfer. The demo is funded once with virtual DAI, with no deposits, withdrawals, refills or resets, and demo profit is not money owed to you.', 'خیر. ورود و استفاده از دمو نه واریز می‌خواهد، نه کارت و نه انتقال دارایی. حساب دمو یک‌بار با دای مجازی تأمین می‌شود؛ بدون واریز، برداشت، شارژ مجدد یا بازنشانی — و سود دمو، طلب مالی تو از پلتفرم نیست.'),
    links: [
      { target: { kind: 'terminal', product: 'prop' }, label: text('Open the demo', 'باز کردن دمو') },
    ] },
  { key: 'who-can-join', category: 'getting-started', sort: 4,
    question: text('Who can join Openfund?', 'چه کسانی می‌توانند به اوپن‌فاند بپیوندند؟'),
    answer: text('Eligibility rules — age, geography and identity checks — are not finalized yet, so we do not state them here. Connecting a wallet proves you control it for this session; it does not confirm you meet any future requirement. Final eligibility terms will be published with the versioned agreement before launch.', 'قواعد واجدشرایط‌بودن — سن، جغرافیا و بررسی هویت — هنوز نهایی نشده‌اند، پس اینجا آن‌ها را بیان نمی‌کنیم. اتصال کیف پول فقط مالکیت آن را برای همین نشست ثابت می‌کند و تأیید نمی‌کند که شرایط آینده را داری. شرایط نهاییِ دسترسی، همراه قرارداد نسخه‌دار پیش از عرضه منتشر خواهد شد.'),
    links: [
      { target: { kind: 'page', slug: 'rulebook' }, label: text('Read the rulebook', 'قوانین‌نامه را بخوان') },
    ] },
  { key: 'how-to-create-account', category: 'getting-started', sort: 5,
    question: text('How do I create an account?', 'چطور حساب بسازم؟'),
    answer: text('Connect a wallet through RainbowKit, then sign a Sign-In with Ethereum (EIP-4361) message that opens a first-party session. There is no password, no payment and no application form, and one wallet maps to one identity.', 'کیف پول را از راه RainbowKit وصل کن، سپس یک پیام «ورود با اتریوم» (EIP-4361) را امضا کن تا یک نشست اختصاصی باز شود. رمز عبور، پرداخت یا فرم ثبت‌نام وجود ندارد و هر کیف پول به یک هویت نگاشت می‌شود.'),
    links: [
      { target: { kind: 'terminal', product: 'prop' }, label: text('Sign in to the terminal', 'ورود به ترمینال') },
    ] },
  { key: 'challenge-models', category: 'getting-started', sort: 6,
    question: text('What challenge models exist?', 'چه مدل‌های چلنجی وجود دارد؟'),
    answer: text('Four published models: Standard (two phases), One-phase (a single target), Instant (no evaluation, funded stage from day one) and a 14-day Free Trial that rehearses Standard rules. These are the terms of record; purchasing them is not enabled in this release.', 'چهار مدلِ منتشرشده: استاندارد (دومرحله‌ای)، تک‌مرحله‌ای (یک هدف)، آنی (بدون ارزیابی، از روز اول در مرحلهٔ فاندشده) و تست رایگان ۱۴روزه که قواعد استاندارد را تمرین می‌کند. این‌ها شرایطِ مرجع‌اند؛ خرید آن‌ها در این نسخه فعال نیست.'),
    links: [
      { target: { kind: 'page', slug: 'challenges' }, label: text('Compare challenges', 'مقایسهٔ چلنج‌ها') },
      { target: { kind: 'page', slug: 'rulebook' }, label: text('Full terms', 'شرایط کامل') },
    ] },
  { key: 'how-to-pay-for-challenge', category: 'getting-started', sort: 7,
    question: text('How do I pay for a challenge?', 'چطور چلنج را بخرم؟'),
    answer: text('Purchase activation is not enabled in this release, so there is no checkout to use and we do not publish payment methods. Until it is live, connect a wallet and use the simulated demo. Final commercial terms will be published with the versioned agreement before launch.', 'فعال‌سازی خرید در این نسخه فعال نیست؛ بنابراین درگاه خریدی وجود ندارد و روش پرداختی منتشر نمی‌کنیم. تا زمان فعال شدن، کیف پول را وصل کن و از دموی شبیه‌سازی‌شده استفاده کن. شرایط نهاییِ تجاری پیش از عرضه، همراه قرارداد نسخه‌دار منتشر خواهد شد.'),
    links: [
      { target: { kind: 'page', slug: 'challenges' }, label: text('Challenge overview', 'نمای چلنج‌ها') },
    ] },
  { key: 'balance-vs-equity', category: 'getting-started', sort: 8,
    question: text('What is the difference between balance and equity?', 'تفاوت موجودی و ارزش خالص چیست؟'),
    answer: text('Balance reflects closed trades only; equity also counts the unrealized PnL of open positions in real time. Loss limits are measured on equity, so an open loss moves you toward the limit immediately.', 'موجودی فقط معاملات بسته‌شده را نشان می‌دهد؛ ارزش خالص، سود و زیان شناور موقعیت‌های باز را هم لحظه‌ای می‌شمارد. سقف‌های ضرر مبنای ارزش خالص دارند، پس زیانِ باز بی‌درنگ تو را به مرز نزدیک می‌کند.'),
    links: [
      { target: { kind: 'glossary', slug: 'mark-price' }, label: text('Mark price', 'قیمت مرجع') },
    ] },

  /* --------------------------------------------- Payouts & Withdrawals -- */
  { key: 'profit-split', category: 'payouts', sort: 1,
    question: text('What is the profit split for funded traders?', 'سهم سودِ معامله‌گر فاندشده چقدر است؟'),
    answer: text('Published terms: Standard offers weekly 60%, bi-weekly 80% or on-demand 100%; One-phase bi-weekly 80% or on-demand 100%; Instant bi-weekly 95%. On demand needs 7 profitable days and a 35% consistency score. Rewards are reviewed and paid manually.', 'شرایط منتشرشده: استاندارد هفتگی ۶۰٪، دوهفته‌ای ۸۰٪ یا درخواستی ۱۰۰٪؛ تک‌مرحله‌ای دوهفته‌ای ۸۰٪ یا درخواستی ۱۰۰٪؛ آنی دوهفته‌ای ۹۵٪. چرخهٔ درخواستی به ۷ روز سودده و امتیاز ثبات ۳۵٪ نیاز دارد. پاداش‌ها به‌صورت دستی بررسی و پرداخت می‌شوند.'),
    links: [
      { target: { kind: 'glossary', slug: 'consistency-rule' }, label: text('Consistency rule', 'قاعدهٔ تداوم') },
      { target: { kind: 'lesson', slug: 'consistency-and-payout-conditions' }, label: text('Consistency and payout conditions', 'تداوم و شرایط برداشت') },
    ] },
  { key: 'when-payout-request', category: 'payouts', sort: 2,
    question: text('When can I request a payout?', 'کِی می‌توانم برداشت درخواست کنم؟'),
    answer: text('The first request follows the cycle you chose: 7 days after your first funded trade on the weekly cycle, 14 days on a bi-weekly cycle, and no waiting period on demand (its conditions still apply). Each later request opens one cycle after the previous one.', 'نخستین درخواست از چرخه‌ای که انتخاب کرده‌ای پیروی می‌کند: در چرخهٔ هفتگی ۷ روز پس از اولین معاملهٔ فاندشده، در چرخهٔ دوهفته‌ای ۱۴ روز، و در چرخهٔ درخواستی بدون انتظار (اما با شرایط خودش). هر درخواست بعدی یک چرخه پس از درخواست قبلی باز می‌شود.'),
    links: [
      { target: { kind: 'page', slug: 'rulebook' }, label: text('Payout terms', 'شرایط برداشت') },
    ] },
  { key: 'payout-minimum', category: 'payouts', sort: 3,
    question: text('Is there a minimum payout amount?', 'حداقل مبلغ برداشت چقدر است؟'),
    answer: text('Published terms set the minimum payout request at 1% of the account size, which scales with the size you choose. This is a documented condition of the reward agreement and applies once payouts are live; it is not active in the current release.', 'شرایط منتشرشده، حداقل درخواستِ برداشت را ۱٪ اندازهٔ حساب تعیین می‌کند که با اندازهٔ انتخابی تو مقیاس می‌گیرد. این یک شرطِ مستندِ قرارداد پاداش است و وقتی برداشت فعال شود اعمال می‌شود؛ در نسخهٔ فعلی فعال نیست.'),
    links: [
      { target: { kind: 'page', slug: 'rulebook' }, label: text('Minimum payout', 'حداقل برداشت') },
    ] },
  { key: 'payout-timeline', category: 'payouts', sort: 4,
    question: text('How long does a payout take?', 'برداشت چقدر طول می‌کشد؟'),
    answer: text('Reward cycles are published per model and chosen once when the funded account starts. Rewards are reviewed and paid manually; how quickly a settlement reaches you, and its payment rails, are not committed yet and will be stated in the final agreement.', 'چرخه‌های پاداش برای هر مدل منتشر شده‌اند و هنگام شروع حساب فاندشده یک بار انتخاب می‌شوند. پاداش‌ها به‌صورت دستی بررسی و پرداخت می‌شوند؛ سرعت رسیدن تسویه و مسیر پرداخت آن هنوز تعهد نشده و در قرارداد نهایی اعلام خواهد شد.'),
    links: [
      { target: { kind: 'page', slug: 'rulebook' }, label: text('Payout cycle', 'سیکل برداشت') },
    ] },
  { key: 'trade-during-payout', category: 'payouts', sort: 5,
    question: text('Can I keep trading while a payout is processing?', 'آیا می‌توانم هنگام پردازش برداشت معامله کنم؟'),
    answer: text('Trading conditions around a pending request are not published yet, so we do not state whether trading is paused or allowed. The final versioned agreement will define it. Nothing in this release lets you place a live payout to test this.', 'شرایط معامله پیرامون یک درخواستِ در انتظار هنوز منتشر نشده، پس نمی‌گوییم معامله متوقف می‌شود یا آزاد است. قرارداد نهاییِ نسخه‌دار آن را تعیین می‌کند. در این نسخه امکان ثبت برداشت واقعی برای آزمودن این مورد وجود ندارد.'),
    links: [
      { target: { kind: 'glossary', slug: 'max-drawdown' }, label: text('Drawdown limits', 'سقف‌های افت سرمایه') },
    ] },
  { key: 'funded-account-fees', category: 'payouts', sort: 6,
    question: text('Are there ongoing fees for funded traders?', 'حساب فاندشده هزینهٔ دوره‌ای دارد؟'),
    answer: text('The published model charges a one-time evaluation fee, and Standard refunds it with the fourth reward. Whether any recurring fee or payout fee applies to a funded account is not finalized and will follow the final agreement. There is no active funded account to charge in this release.', 'مدلِ منتشرشده یک هزینهٔ ارزیابی یک‌باره می‌گیرد و «استاندارد» آن را با چهارمین برداشت بازمی‌گرداند. اینکه در حساب فاندشده هزینهٔ دوره‌ای یا کارمزد برداشت اعمال شود نهایی نشده و تابع قرارداد نهایی است. در این نسخه حساب فاندشدهٔ فعالی برای کسر هزینه وجود ندارد.'),
    links: [
      { target: { kind: 'page', slug: 'rulebook' }, label: text('Fees and costs', 'کارمزد و هزینه‌ها') },
    ] },
  { key: 'wrong-payout-address', category: 'payouts', sort: 7,
    question: text('What if my payout goes to the wrong wallet address?', 'اگر برداشت به نشانیِ اشتباهِ کیف پول برود چه می‌شود؟'),
    answer: text('A wallet address is a signature-sensitive value, so we do not describe a recovery or redirection path until settlement is real. Because payouts are not enabled in this release, no address is charged or used today. The address, correction and irreversibility rules will be defined in the final agreement.', 'نشانیِ کیف پول مقداری حساس به امضا است، پس تا وقتی تسویه واقعی نشده، مسیر بازیابی یا تغییر را توضیح نمی‌دهیم. چون برداشت در این نسخه فعال نیست، امروز هیچ نشانی‌ای مصرف یا کسر نمی‌شود. قواعد نشانی، اصلاح و برگشت‌ناپذیری در قرارداد نهایی تعریف خواهد شد.'),
    links: [
      { target: { kind: 'lesson', slug: 'verifying-a-transaction' }, label: text('Verifying a transaction', 'راستی‌آزمایی تراکنش') },
    ] },
  { key: 'multiple-payouts', category: 'payouts', sort: 8,
    question: text('Can I take multiple payouts?', 'آیا می‌توانم چند بار برداشت کنم؟'),
    answer: text('Published terms allow repeated payouts on each reward cycle while you stay within the loss limits, with no lifetime payout cap published. The consistency conditions and first-payout timing above still apply, and the payout stage is not yet active in this release.', 'شرایط منتشرشده اجازهٔ برداشت‌های مکرر در هر سیکل پاداش می‌دهند، تا زمانی که در سقف‌های ضرر بمانی؛ هیچ سقفِ مادام‌العمری برای برداشت منتشر نشده است. شروط تداوم و زمانِ نخستین برداشت همچنان پابرجاوند و مرحلهٔ برداشت در این نسخه هنوز فعال نیست.'),
    links: [
      { target: { kind: 'glossary', slug: 'consistency-rule' }, label: text('Consistency rule', 'قاعدهٔ تداوم') },
    ] },

  /* ------------------------------------------------------- Trading Rules -- */
  { key: 'daily-loss-limit', category: 'trading-rules', sort: 1,
    question: text('What is the daily loss limit?', 'سقف ضرر روزانه چقدر است؟'),
    answer: text('Published terms: 5% on Standard (with a 3% option), 3% on One-phase (2% option) and 3% on Instant. It is measured against the higher of the day’s opening balance or opening equity and resets at 00:00 UTC+3. Touching it once is a breach.', 'شرایط منتشرشده: ۵٪ در استاندارد (با گزینهٔ ۳٪)، ۳٪ در تک‌مرحله‌ای (گزینهٔ ۲٪) و ۳٪ در آنی. مبنای سنجش، بزرگ‌ترِ موجودی یا ارزش خالصِ ابتدای روز است و ساعت ۰۰:۰۰ (UTC+3) بازنشانی می‌شود. یک بار لمسِ آن، نقض است.'),
    links: [
      { target: { kind: 'glossary', slug: 'daily-drawdown' }, label: text('Daily drawdown', 'افت روزانه') },
      { target: { kind: 'tool', slug: 'prop-drawdown' }, label: text('Drawdown calculator', 'ماشین‌حساب افت سرمایه') },
    ] },
  { key: 'maximum-total-loss', category: 'trading-rules', sort: 2,
    question: text('What is the maximum total loss?', 'حداکثر ضرر کل چقدر است؟'),
    answer: text('Published terms: 10% static on Standard and 12% static on One-phase, measured from the starting size. On Instant it is a 5% trailing limit that follows the highest recorded equity and locks at breakeven once the account is 5% in profit. Touching any of these is a breach.', 'شرایط منتشرشده: ۱۰٪ ثابت در استاندارد و ۱۲٪ ثابت در تک‌مرحله‌ای، سنجیده‌شده از اندازهٔ شروع. در آنی، سقف ۵٪ شناور است که بالاترین ارزش خالصِ ثبت‌شده را دنبال می‌کند و وقتی حساب ۵٪ سود کرد در نقطهٔ سربه‌سر قفل می‌شود. لمس هر یک از این‌ها نقض است.'),
    links: [
      { target: { kind: 'glossary', slug: 'max-drawdown' }, label: text('Maximum drawdown', 'حداکثر افت سرمایه') },
      { target: { kind: 'glossary', slug: 'high-water-mark' }, label: text('High-water mark', 'بیشینهٔ تاریخچه') },
    ] },
  { key: 'consistency-score-rule', category: 'trading-rules', sort: 3,
    question: text('How does the consistency rule or best-day rule work?', 'قاعدهٔ تداوم یا قاعدهٔ بهترین روز چگونه کار می‌کند؟'),
    answer: text('The consistency score is a reward condition, not a trading restriction. On the on-demand cycle of Standard and One-phase your best day must not exceed 35% of the cycle profit; on Instant the limit is 15%. It never blocks you from placing trades.', 'امتیاز ثبات شرطِ پاداش است، نه محدودیت معامله. در چرخهٔ درخواستیِ استاندارد و تک‌مرحله‌ای، بهترین روز نباید از ۳۵٪ سود چرخه بیشتر شود؛ در مدل آنی این حد ۱۵٪ است. این شرط هرگز جلوی ثبت معامله را نمی‌گیرد.'),
    links: [
      { target: { kind: 'glossary', slug: 'consistency-rule' }, label: text('Consistency rule', 'قاعدهٔ تداوم') },
      { target: { kind: 'lesson', slug: 'consistency-and-payout-conditions' }, label: text('Consistency and payout conditions', 'تداوم و شرایط برداشت') },
    ] },
  { key: 'minimum-trading-days', category: 'trading-rules', sort: 4,
    question: text('Is there a time limit or a minimum number of trading days?', 'مهلت زمانی یا حداقل روز معاملاتی داری؟'),
    answer: text('Purchasable models have no time limit. Standard requires at least 3 trading days per phase, while One-phase and Instant require none — Instant instead keeps 7 profitable days per rolling 30 days. The Free Trial gives 14 days per phase.', 'مدل‌های خریدنی محدودیت زمانی ندارند. استاندارد حداقل ۳ روز معاملاتی در هر مرحله می‌خواهد؛ تک‌مرحله‌ای و آنی حداقلِ روز ندارند — آنی به‌جایش ۷ روز سودده در هر بازهٔ ۳۰روزه نگه می‌دارد. تست رایگان ۱۴ روز در هر مرحله وقت می‌دهد.'),
    links: [
      { target: { kind: 'lesson', slug: 'funded-accounts-how-they-work' }, label: text('How funded accounts work', 'حساب فاندشده چگونه کار می‌کند') },
    ] },
  { key: 'profit-target', category: 'trading-rules', sort: 5,
    question: text('What is the profit target for each phase?', 'هدف سودِ هر مرحله چقدر است؟'),
    answer: text('Published targets: 8% in phase one and 5% in phase two on Standard, a single 12% target on One-phase, and no target on Instant or once funded. Targets are measured on closed net profit, so an open position does not count until it is realized.', 'اهدافِ منتشرشده: ۸٪ در مرحلهٔ اول و ۵٪ در مرحلهٔ دوم در استاندارد، یک هدف ۱۲٪ در تک‌مرحله‌ای، و بدون هدف در آنی یا پس از فاندشدن. اهداف با سود خالصِ معاملات بسته‌شده سنجیده می‌شوند، پس موقعیت باز تا محقق‌شدن حساب نمی‌شود.'),
    links: [
      { target: { kind: 'lesson', slug: 'reading-a-rulebook' }, label: text('Reading a rulebook', 'خواندنِ قوانین‌نامه') },
    ] },
  { key: 'forbidden-practices', category: 'trading-rules', sort: 6,
    question: text('Which trading practices are forbidden?', 'کدام رفتارهای معاملاتی ممنوع‌اند؟'),
    answer: text('Do not share a seed phrase, impersonate another wallet holder or access someone else’s records — the application enforces ownership, signature checks and suspension. A commercial policy on manipulation, coordinated accounts, technical exploits, cross-account hedging, bots or third-party management follows the final agreement.', 'عبارت بازیابی را به اشتراک نگذار، خود را صاحب کیف پول دیگری معرفی نکن و به سوابق دیگران دسترسی پیدا نکن — برنامه مالکیت، اعتبار امضا و تعلیق را کنترل می‌کند. سیاستِ تجاری دربارهٔ دستکاری، حساب‌های هماهنگ، سوءاستفادهٔ فنی، هج میان‌حسابی، ربات یا مدیریتِ ثالث، تابع قرارداد نهایی است.'),
    links: [
      { target: { kind: 'lesson', slug: 'automated-systems-and-limits' }, label: text('Automated systems and limits', 'سامانه‌های خودکار و محدودیت‌ها') },
    ] },
  { key: 'weekend-holding', category: 'trading-rules', sort: 7,
    question: text('Can I hold positions over the weekend?', 'می‌توانم موقعیت را در آخر هفته نگه دارم؟'),
    answer: text('Weekend holding is not restricted during evaluation under published terms. On funded accounts it is governed by the final versioned agreement, not by any other firm’s rule. Keep in mind that funding rate accrues while a position is open, so holding has a cost.', 'نگهداری موقعیت در آخر هفته طبق شرایط منتشرشده در مرحلهٔ ارزیابی ممنوع نیست. در حساب فاندشده، قرارداد نهاییِ نسخه‌دار حکم می‌کند، نه قانون هیچ شرکت دیگری. توجه کن که فاندینگ ریت تا باز بودن موقعیت انباشته می‌شود، پس نگه‌داشتن هزینه دارد.'),
    links: [
      { target: { kind: 'glossary', slug: 'funding-rate' }, label: text('Funding rate', 'نرخ تأمین مالی') },
      { target: { kind: 'lesson', slug: 'funding-rate-explained' }, label: text('Funding rate explained', 'توضیح نرخ تأمین مالی') },
    ] },
  { key: 'news-event-trading', category: 'trading-rules', sort: 8,
    question: text('Can I trade around news events?', 'می‌توانم حول رویدادهای خبری معامله کنم؟'),
    answer: text('News-event trading is unrestricted during evaluation under published terms; on funded accounts the final agreement governs high-impact-news windows. No other firm’s restrictions are adopted here. Remember that fast moves can still reach a loss limit, and touching that limit is a breach.', 'معاملهٔ حول رویدادهای خبری طبق شرایط منتشرشده در ارزیابی آزاد است؛ در حساب فاندشده، قرارداد نهایی پنجره‌های اخبارِ پرتأثیر را تنظیم می‌کند و قانون شرکت دیگری پذیرفته نمی‌شود. توجه کن که نوسان سریع همچنان می‌تواند به سقف ضرر برسد و لمسِ آن نقض است.'),
    links: [
      { target: { kind: 'tool', slug: 'liquidation-price' }, label: text('Liquidation price', 'قیمت لیکوییدشدن') },
      { target: { kind: 'glossary', slug: 'liquidation' }, label: text('Liquidation', 'لیکوییدشدن') },
    ] },
  { key: 'account-breach', category: 'trading-rules', sort: 9,
    question: text('What happens when an account is breached?', 'وقتی حساب نقض شود چه اتفاقی می‌افتد؟'),
    answer: text('Touching the daily or total loss limit is a breach: positions close, trading on that account stops and the eligible profit of the period is not withdrawable. A trial breach closes the trial immediately. Appeals, resets and termination follow the final versioned agreement.', 'لمسِ سقف ضرر روزانه یا کل نقض است: موقعیت‌ها بسته می‌شوند، معامله روی همان حساب متوقف می‌شود و سود واجدشرایطِ آن دوره قابل برداشت نیست. نقض در تست رایگان، همان لحظه تست را می‌بندد. اعتراض، بازنشانی و خاتمه طبق قرارداد نهاییِ نسخه‌دار خواهد بود.'),
    links: [
      { target: { kind: 'glossary', slug: 'max-drawdown' }, label: text('Max drawdown', 'حداکثر افت سرمایه') },
      { target: { kind: 'lesson', slug: 'reading-a-rulebook' }, label: text('Reading a rulebook', 'خواندنِ قوانین‌نامه') },
    ] },

  /* ------------------------------------------------ Affiliates & Referrals -- */
  { key: 'referral-program', category: 'referrals', sort: 1,
    question: text('How does the referral program work?', 'برنامهٔ معرفی چگونه کار می‌کند؟'),
    answer: text('The Growth Partner program is in design and pre-launch. The intent is a shareable link that attributes new sign-ups, but attribution is still being built and reward terms require business approval, so no rate or schedule is published. The Growth Partner page marks exactly what is live versus pending.', 'برنامهٔ «شریک رشد» در حال طراحی و پیش از عرضه است. هدف، یک لینک قابل‌اشتراک است که ثبت‌نام‌های تازه را انتساب می‌دهد، اما انتساب هنوز در حال ساخت است و شروط پاداش به تأیید تجاری نیاز دارد؛ به همین دلیل هیچ نرخ یا زمان‌بندی منتشر نشده است. صفحهٔ «شریک رشد» دقیقاً مشخص می‌کند چه چیزی فعال و چه چیزی در انتظار است.'),
    links: [
      { target: { kind: 'page', slug: 'referral' }, label: text('Growth Partner page', 'صفحهٔ شریک رشد') },
    ] },
  { key: 'referred-trader-benefits', category: 'referrals', sort: 2,
    question: text('What does a trader I refer receive?', 'معامله‌گری که معرفی می‌کنم چه چیزی دریافت می‌کند؟'),
    answer: text('No benefit, discount or offer for the referred trader is finalized or live. Any value for new sign-ups will be published with the program terms once they are approved. Until then we do not describe an incentive, because inventing one would be misleading.', 'هیچ مزیت، تخفیف یا پیشنهادی برای معامله‌گرِ معرفی‌شده نهایی یا فعال نشده است. هر ارزشی برای ثبت‌نام‌های تازه، همراه شرایط برنامه و پس از تأیید منتشر خواهد شد. تا آن زمان مزیتی را توصیف نمی‌کنیم، چون ساختن چنین وعده‌ای گمراه‌کننده است.'),
    links: [
      { target: { kind: 'page', slug: 'referral' }, label: text('Growth Partner page', 'صفحهٔ شریک رشد') },
    ] },
  { key: 'referral-reward-schedule', category: 'referrals', sort: 3,
    question: text('How and when are referral rewards paid?', 'پاداش معرفی چگونه و چه زمانی پرداخت می‌شود؟'),
    answer: text('Payment method and timing are not approved yet, so we cannot state a schedule or a percentage. Reward settlement will be defined in the final program terms, alongside payouts generally, which are not enabled in this release.', 'نحوه و زمان پرداخت هنوز تأیید نشده، پس نمی‌توانیم زمان‌بندی یا درصدی اعلام کنیم. تسویهٔ پاداش در شرایط نهاییِ برنامه تعریف خواهد شد، هم‌راستا با برداشت‌ها که آن‌ها هم در این نسخه فعال نیستند.'),
    links: [
      { target: { kind: 'page', slug: 'referral' }, label: text('Program status', 'وضعیت برنامه') },
    ] },
  { key: 'advanced-partnership', category: 'referrals', sort: 4,
    question: text('Is there an advanced partnership tier?', 'سطحِ پیشرفتهٔ مشارکت داری؟'),
    answer: text('Partner tiers and negotiated business terms are not published, because the program is still in design and those terms need an owner decision first. The Growth Partner page lists the pending decisions rather than promising tiers that do not exist yet.', 'سطوح مشارکت و شروطِ مذاکره‌شده منتشر نشده‌اند، چون برنامه هنوز در حال طراحی است و این شروط پیش از هر چیز به تصمیمِ مسئول نیاز دارند. صفحهٔ «شریک رشد» به‌جای وعدهٔ سطوحِ وجودنداشته، تصمیم‌های در انتظار را فهرست می‌کند.'),
    links: [
      { target: { kind: 'page', slug: 'referral' }, label: text('Growth Partner page', 'صفحهٔ شریک رشد') },
    ] },
  { key: 'qualified-referral', category: 'referrals', sort: 5,
    question: text('What counts as a qualified referral?', 'چه چیزی یک معرفیِ واجدشرایط محسوب می‌شود؟'),
    answer: text('The definition of a qualifying action — such as a sign-up, an activation or a funded trade — is not finalized and depends on attribution that is still being built. The qualifying rule will be published with the program terms; no such rule is applied today.', 'تعریفِ کنشِ واجدشرایط — مانند ثبت‌نام، فعال‌سازی یا یک معاملهٔ فاندشده — نهایی نشده و به سامانهٔ انتسابِ در حال ساخت وابسته است. قاعدهٔ واجدشرایط‌بودن، همراه شرایط برنامه منتشر خواهد شد؛ امروز چنین قاعده‌ای اعمال نمی‌شود.'),
    links: [
      { target: { kind: 'page', slug: 'referral' }, label: text('Growth Partner page', 'صفحهٔ شریک رشد') },
    ] },

  /* ------------------------------------------------------- Trading Terminal -- */
  { key: 'terminal-platform', category: 'terminal', sort: 1,
    question: text('Which platform or technology does Openfund use?', 'اوپن‌فاند از چه پلتفرم یا فناوری‌ای استفاده می‌کند؟'),
    answer: text('The terminal pairs the Vela charting engine by LuxAlgo with market data from Gains Network. Both products — Prop Trading and Perpetual Trading — run on this one interface, so you chart and view the same markets in one place.', 'ترمینال، موتور نمودار Vela محصول LuxAlgo را با دادهٔ بازار Gains Network جفت کرده است. هر دو محصول — چلنجی و دائمی — روی همین یک رابط اجرا می‌شوند، پس نمودار و بازارها را در یک جا می‌بینی.'),
    links: [
      { target: { kind: 'terminal', product: 'prop' }, label: text('Open the terminal', 'باز کردن ترمینال') },
      { target: { kind: 'lesson', slug: 'order-types-and-order-books' }, label: text('Order types and order books', 'نوع سفارش و دفتر سفارش') },
    ] },
  { key: 'terminal-assets', category: 'terminal', sort: 2,
    question: text('What assets can I trade?', 'چه دارایی‌هایی می‌توانم معامله کنم؟'),
    answer: text('Markets come from Gains Network metadata and are grouped into crypto, forex, stocks, indices and commodities — around 488 symbols. Prices are Gains Network mark prices, not an independent index feed. The available list and each market’s status can change, so check the terminal.', 'بازارها از مشخصات Gains Network می‌آیند و در دسته‌های رمزارز، فارکس، سهام، شاخص و کالا گروه‌بندی می‌شوند — حدود ۴۸۸ نماد. قیمت‌ها، قیمت مرجعِ Gains Network است نه یک خوراکِ مستقلِ شاخص. فهرستِ در دسترس و وضعیت هر بازار می‌تواند تغییر کند، پس در ترمینال بررسی کن.'),
    links: [
      { target: { kind: 'page', slug: 'markets' }, label: text('Markets directory', 'فهرست بازارها') },
      { target: { kind: 'lesson', slug: 'mark-price-vs-index-price' }, label: text('Mark price vs index price', 'قیمت مرجع در برابر قیمت شاخص') },
    ] },
  { key: 'terminal-fees', category: 'terminal', sort: 3,
    question: text('Are there fees or spreads in the terminal?', 'در ترمینال کارمزد یا اسپرد هست؟'),
    answer: text('The simulated demo applies a documented fee and spread policy, not commercial venue fees: a taker fee of 0.035%, a maker fee of 0.05%, a funding rate of 0.012% and a spread of 0.005% to 0.02% depending on the market. Real trading fees are not finalized and will follow the final agreement.', 'دموی شبیه‌سازی‌شده یک سیاستِ مستندِ کارمزد و اسپرد دارد، نه کارمزدِ صرافیِ تجاری: کارمزد تیکر ۰٫۰۳۵٪، کارمزد میکر ۰٫۰۵٪، نرخ تأمین مالی ۰٫۰۱۲٪ و اسپرد ۰٫۰۰۵٪ تا ۰٫۰۲٪ بسته به بازار. کارمزد واقعیِ معامله نهایی نشده و تابع قرارداد نهایی است.'),
    links: [
      { target: { kind: 'lesson', slug: 'fees-slippage-open-interest' }, label: text('Fees and slippage', 'کارمزد و لغزش قیمت') },
      { target: { kind: 'glossary', slug: 'slippage' }, label: text('Slippage', 'لغزش قیمت') },
    ] },
  { key: 'terminal-mobile', category: 'terminal', sort: 4,
    question: text('Can I trade on mobile?', 'آیا می‌توانم با موبایل معامله کنم؟'),
    answer: text('The terminal is a web application you open in a browser, so you can use it in a phone browser without installing anything; no separate native mobile app is published. Remember that Prop Trading is simulated and Perpetual Trading is read-only in this release.', 'ترمینال یک برنامهٔ وب است که در مرورگر باز می‌شود، پس در مرورگرِ تلفن هم بدون نصب کاری کار می‌کند و اپِ بومیِ جداگانه‌ای منتشر نشده است. به یاد داشته باش که در این نسخه معاملهٔ چلنجی شبیه‌سازی‌شده و معاملهٔ دائمی فقط‌خواندنی است.'),
    links: [
      { target: { kind: 'terminal', product: 'prop' }, label: text('Open the terminal', 'باز کردن ترمینال') },
    ] },
  { key: 'terminal-leverage', category: 'terminal', sort: 5,
    question: text('How is leverage applied per market?', 'اهرم چگونه برای هر بازار اعمال می‌شود؟'),
    answer: text('Each market’s maximum leverage comes from the Gains Network market feed and is capped by Openfund’s ceilings: BTC and ETH 20×, other crypto 15×, forex, stocks, commodities and indices 50×. The lower of the two applies. Challenges sold before these terms keep the limit recorded in their rules.', 'حداکثر اهرمِ هر بازار از خوراکِ بازارِ Gains Network می‌آید و سقف‌های اوپن‌فاند بر آن اعمال می‌شود: بیت‌کوین و اتریوم ۲۰ برابر، سایر رمزارزها ۱۵ برابر، فارکس، سهام، کالاها و شاخص‌ها ۵۰ برابر. مقدار کمتر اعمال می‌شود. چلنج‌هایی که پیش از این شرایط فروخته شده‌اند، سقف ثبت‌شده در قوانین خود را نگه می‌دارند.'),
    links: [
      { target: { kind: 'tool', slug: 'leverage-margin' }, label: text('Leverage and margin', 'اهرم و وجه تضمین') },
      { target: { kind: 'glossary', slug: 'leverage' }, label: text('Leverage', 'اهرم') },
    ] },
  { key: 'terminal-sl-tp', category: 'terminal', sort: 6,
    question: text('Can I place stop-loss, take-profit and partial closes?', 'می‌توانم حد ضرر، حد سود و بستنِ جزئی بگذارم؟'),
    answer: text('The signed-in demo supports market, limit and stop orders, long and short positions, and updating stop-loss and take-profit, plus closing positions with simulated fills. A stop-loss and take-profit update changes the order on your demo record; it is not a live execution.', 'دموی پس از ورود از سفارش بازار، لیمیت و استاپ، موقعیت خرید و فروش و تغییر حد ضرر و حد سود، به‌همراه بستن موقعیت با اجرای شبیه‌سازی‌شده پشتیبانی می‌کند. به‌روزرسانیِ حد ضرر و حد سود، سفارش را در سابقهٔ دموی تو تغییر می‌دهد و اجرای زنده نیست.'),
    links: [
      { target: { kind: 'glossary', slug: 'stop-loss' }, label: text('Stop-loss', 'حد ضرر') },
      { target: { kind: 'tool', slug: 'position-size' }, label: text('Position size', 'اندازهٔ موقعیت') },
    ] },
  { key: 'terminal-data-freshness', category: 'terminal', sort: 7,
    question: text('Is the terminal data live or delayed?', 'دادهٔ ترمینال زنده است یا با تأخیر؟'),
    answer: text('Prices are live Gains Network mark prices. The data source does not provide order-book depth, open interest or a trade tape, and the terminal shows those as unavailable rather than inventing values for them.', 'قیمت‌ها، قیمت مرجعِ زندهٔ Gains Network است. منبع داده، عمق دفتر سفارش، بهرهٔ باز و نوار معاملات را فراهم نمی‌کند و ترمینال این‌ها را «در دسترس نیست» نشان می‌دهد و برایشان مقدارِ ساختگی نمی‌سازد.'),
    links: [
      { target: { kind: 'glossary', slug: 'open-interest' }, label: text('Open interest', 'بهرهٔ باز') },
      { target: { kind: 'lesson', slug: 'perps-how-they-work' }, label: text('How perpetuals work', 'معاملات دائمی چگونه کار می‌کنند') },
    ] },

  /* --------------------------------------------------------- Transparency -- */
  { key: 'how-openfund-transparent', category: 'transparency', sort: 1,
    question: text('How is Openfund transparent?', 'شفافیت اوپن‌فاند چگونه است؟'),
    answer: text('The published rules of record are open, the perpetual view reads public Gains Network data you can inspect, and your signed-in demo keeps its own order, position and ledger records. Public verification tooling and independent review are still planned, not live.', 'قواعدِ مرجعِ منتشرشده آشکارند، نمای دائمی دادهٔ عمومیِ قابل‌بازدیدِ Gains Network را می‌خواند و حساب دموی پس از ورود، سوابق سفارش، موقعیت و دفترِ خودش را نگه می‌دارد. ابزارِ راستی‌آزمایی عمومی و بررسی مستقل همچنان در برنامه‌اند، نه فعال.'),
    links: [
      { target: { kind: 'page', slug: 'transparency' }, label: text('Transparency page', 'صفحهٔ شفافیت') },
      { target: { kind: 'lesson', slug: 'limits-of-onchain-transparency' }, label: text('Limits of on-chain transparency', 'حدود شفافیت آن‌چین') },
    ] },
  { key: 'capital-handling', category: 'transparency', sort: 2,
    question: text('Does Openfund hold customer funds, and what is the simulated environment?', 'آیا اوپن‌فاند سرمایهٔ مشتری را نگه می‌دارد و محیط شبیه‌سازی‌شده چیست؟'),
    answer: text('Today there is no customer capital to custody: the demo holds only virtual funds — one 100,000 DAI simulated account per user, priced from live Gains Network mark prices, with no deposits or withdrawals. Real funded capital is a planned stage that arrives with the commercial launch and the final agreement.', 'امروز سپردهٔ مشتری‌ای برای امانت گرفتن وجود ندارد: دمو تنها وجه مجازی نگه می‌دارد — یک حساب شبیه‌سازی‌شدهٔ ۱۰۰٬۰۰۰ دای برای هر کاربر، قیمت‌گذاری‌شده از قیمت مرجع زندهٔ Gains Network، بدون واریز یا برداشت. سرمایهٔ واقعیِ فاندشده مرحله‌ای برنامه‌ریزی‌شده است که با عرضهٔ تجاری و قرارداد نهایی می‌آید.'),
    links: [
      { target: { kind: 'lesson', slug: 'funded-accounts-how-they-work' }, label: text('How funded accounts work', 'حساب فاندشده چگونه کار می‌کند') },
      { target: { kind: 'terminal', product: 'prop' }, label: text('See the demo', 'دیدن دمو') },
    ] },
  { key: 'risk-management-system', category: 'transparency', sort: 3,
    question: text('How does the risk-management system work?', 'سامانهٔ مدیریت ریسک چگونه کار می‌کند؟'),
    answer: text('Risk is enforced server-side. The demo rejects invalid orders, insufficient margin and stale prices, and manages each position through margin and simulated liquidation using live mark prices. The commercial daily and total loss limits described in Trading Rules are published conditions that activate with the evaluation engine.', 'ریسک در سمتِ سرور کنترل می‌شود. دمو سفارش نامعتبر، وجه تضمین ناکافی و قیمت کهنه را رد می‌کند و هر موقعیت را با وجه تضمین و لیکوییدشدنِ شبیه‌سازی‌شده بر پایهٔ قیمت مرجع زنده مدیریت می‌کند. سقف‌های ضررِ روزانه و کلِ تجاری که در «قوانین معاملاتی» آمده، شرایط منتشرشده‌ای‌اند که با موتور ارزیابی فعال می‌شوند.'),
    links: [
      { target: { kind: 'lesson', slug: 'risk-management-on-a-funded-account' }, label: text('Risk on a funded account', 'ریسک در حساب فاندشده') },
      { target: { kind: 'tool', slug: 'prop-drawdown' }, label: text('Drawdown calculator', 'ماشین‌حساب افت سرمایه') },
    ] },
  { key: 'verify-onchain', category: 'transparency', sort: 4,
    question: text('Where can I verify Openfund on-chain?', 'کجا می‌توانم اوپن‌فاند را آن‌چین راستی‌آزمایی کنم؟'),
    answer: text('The Perpetual Trading product reads public Gains Network data on Arbitrum One, so that deployment is what you can inspect with a block explorer. Openfund Protocol — the module that would place execution on-chain — is planned and not live; Openfund does not claim to settle, route or aggregate liquidity today.', 'محصول معاملات دائمی، دادهٔ عمومی Gains Network روی Arbitrum One را می‌خواند؛ پس همان استقرار است که با مرورگر بلاک قابل بازبینی است. «پروتکل اوپن‌فاند» — مدولی که اجرا را آن‌چین می‌کند — برنامه‌ریزی‌شده و فعال نیست؛ اوپن‌فاند امروز ادعای تسویه، مسیریابی یا تجمیع نقدینگی نمی‌کند.'),
    links: [
      { target: { kind: 'lesson', slug: 'reading-a-block-explorer' }, label: text('Reading a block explorer', 'خواندن مرورگر بلاک') },
      { target: { kind: 'lesson', slug: 'verifying-a-transaction' }, label: text('Verifying a transaction', 'راستی‌آزمایی تراکنش') },
    ] },
  { key: 'fair-execution', category: 'transparency', sort: 5,
    question: text('How do I know trades are executed fairly?', 'چطور بفهمم معاملات منصفانه اجرا می‌شوند؟'),
    answer: text('Today the demo drives fills from fresh server-side Gains Network mark prices and records them on your account, so execution is simulated and not routed to any venue. Because it is a simulation, demo results do not prove live execution quality, and any fairness guarantees for live trading belong to the final agreement.', 'امروز دمو اجرا را از قیمت مرجع تازهٔ سروریِ Gains Network می‌سازد و در حساب تو ثبتش می‌کند؛ پس اجرا شبیه‌سازی‌شده است و به هیچ بازاری هدایت نمی‌شود. چون شبیه‌سازی است، نتیجهٔ دمو کیفیت اجرای زنده را اثبات نمی‌کند و هر تضمینِ انصاف برای معاملهٔ زنده، به قرارداد نهایی تعلق دارد.'),
    links: [
      { target: { kind: 'glossary', slug: 'mark-price' }, label: text('Mark price', 'قیمت مرجع') },
      { target: { kind: 'lesson', slug: 'order-types-and-order-books' }, label: text('Order types and order books', 'نوع سفارش و دفتر سفارش') },
    ] },
  { key: 'audit-status', category: 'transparency', sort: 6,
    question: text('Is Openfund audited?', 'آیا اوپن‌فاند حسابرسی شده است؟'),
    answer: text('Independent review and audit are planned, not completed; Openfund makes no audit or proof-of-reserves claim. A Certik report found in the repository is an upstream third-party document about a dependency, not an audit of Openfund itself.', 'بررسی مستقل و حسابرسی در برنامه است و انجام نشده؛ اوپن‌فاند هیچ ادعای حسابرسی یا اثبات ذخایر ندارد. گزارش Certik که در مخزن هست، سندِ ثالثِ بالادستی دربارهٔ یک وابستگی است، نه حسابرسیِ خودِ اوپن‌فاند.'),
    links: [
      { target: { kind: 'lesson', slug: 'proof-of-reserves-explained' }, label: text('Proof of reserves explained', 'توضیح اثبات ذخایر') },
      { target: { kind: 'page', slug: 'transparency' }, label: text('Transparency page', 'صفحهٔ شفافیت') },
    ] },
]
