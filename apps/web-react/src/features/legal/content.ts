import { text, type Localized } from '../information/content'

/* Openfund Terms of Use and Privacy Policy: the reviewed built-in copy.
   A published `legal_documents` row (doc_type 'terms' or 'privacy') replaces
   it; a draft never renders, and the built-in copy stays when Directus is
   down. Arabic, Russian and Chinese come from the reviewed dictionaries. */

export interface LegalSection { id: string; heading: Localized; paragraphs: Localized[] }
export interface LegalDocument { docType: 'terms' | 'privacy'; version: string; effective: string; title: Localized; intro: Localized; sections: LegalSection[] }

export const LEGAL_VERSION = '2026-11-28'

export const terms: LegalDocument = {
  docType: 'terms',
  version: LEGAL_VERSION,
  effective: '2026-11-28',
  title: text('Terms of Use', 'شرایط استفاده'),
  intro: text(
    'These terms govern your use of the Openfund website, trading terminal, desktop app and related services (together, “Openfund”). By connecting a wallet, signing in or buying a challenge you accept them. If you do not accept them, do not use Openfund.',
    'این شرایط، استفادهٔ شما از وب‌سایت، ترمینال معاملاتی، اپلیکیشن دسکتاپ و خدمات مرتبط اوپن‌فاند (روی‌هم «اوپن‌فاند») را تعیین می‌کند. با اتصال کیف پول، ورود یا خرید چلنج، این شرایط را می‌پذیرید. اگر آن را نمی‌پذیرید، از اوپن‌فاند استفاده نکنید.'),
  sections: [
    { id: 'service', heading: text('1. What Openfund is', '۱. اوپن‌فاند چیست'), paragraphs: [
      text('Openfund runs trading evaluations (challenges) on demo accounts in a simulated trading environment. Demo balances have no cash value and cannot be withdrawn. No trade placed on a demo account reaches a live financial market.',
        'اوپن‌فاند ارزیابی‌های معاملاتی (چلنج) را روی حساب‌های دمو و در محیط معاملاتی شبیه‌سازی‌شده اجرا می‌کند. موجودی حساب دمو ارزش نقدی ندارد و برداشت‌شدنی نیست. هیچ معامله‌ای روی حساب دمو به بازار مالی واقعی نمی‌رسد.'),
      text('Openfund is not a broker, exchange, bank, custodian or investment adviser. It does not take deposits and does not manage anyone’s money for investment. Nothing on Openfund is investment, financial, legal or tax advice.',
        'اوپن‌فاند کارگزار، صرافی، بانک، امانت‌دار یا مشاور سرمایه‌گذاری نیست؛ سپرده نمی‌پذیرد و پول کسی را برای سرمایه‌گذاری مدیریت نمی‌کند. هیچ محتوایی در اوپن‌فاند توصیهٔ سرمایه‌گذاری، مالی، حقوقی یا مالیاتی نیست.'),
    ] },
    { id: 'eligibility', heading: text('2. Eligibility', '۲. شرایط استفاده‌کننده'), paragraphs: [
      text('You must be at least 18 years old and allowed by the laws of the place where you live to use Openfund. Checking those laws is your responsibility. Openfund may refuse or end the service where it is prohibited.',
        'باید دست‌کم ۱۸ سال داشته باشید و قوانین محل زندگی‌تان استفاده از اوپن‌فاند را مجاز بداند. بررسی این قوانین بر عهدهٔ خود شماست. اوپن‌فاند هر جا که این خدمت ممنوع باشد می‌تواند آن را ارائه ندهد یا متوقف کند.'),
    ] },
    { id: 'wallet', heading: text('3. Your wallet is your account', '۳. کیف پول شما، حساب شماست'), paragraphs: [
      text('Openfund has no usernames or passwords. You sign in by signing a message with your wallet (Sign-In with Ethereum, EIP-4361). Whoever controls the wallet controls the account: the owner of the wallet is the owner of the account, its challenges, certificates and rewards.',
        'اوپن‌فاند نام کاربری و رمز عبور ندارد. ورود با امضای یک پیام با کیف پول شما انجام می‌شود (Sign-In with Ethereum، استاندارد EIP-4361). هر کس کیف پول را در اختیار دارد، حساب را در اختیار دارد: مالک کیف پول، مالک حساب و چلنج‌ها، گواهی‌ها و پاداش‌های آن است.'),
      text('Keep your private keys and recovery phrase safe. Openfund never asks for them. Openfund cannot recover a wallet, reverse a signature or transaction, or move an account to another wallet if you lose access.',
        'کلیدهای خصوصی و عبارت بازیابی خود را امن نگه دارید. اوپن‌فاند هرگز آن‌ها را درخواست نمی‌کند. اگر دسترسی به کیف پول را از دست بدهید، اوپن‌فاند نمی‌تواند کیف پول را بازیابی کند، امضا یا تراکنشی را برگرداند یا حساب را به کیف پول دیگری منتقل کند.'),
    ] },
    { id: 'no-kyc', heading: text('4. No identity verification (KYC)', '۴. بدون احراز هویت (KYC)'), paragraphs: [
      text('Openfund does not run KYC. It does not ask for, collect or verify names, identity documents, photos or home addresses, and it makes no identity-verification commitment to anyone. The wallet signature is the only proof of account ownership.',
        'اوپن‌فاند احراز هویت (KYC) انجام نمی‌دهد. نام، مدرک هویتی، عکس یا نشانی منزل را درخواست، جمع‌آوری یا بررسی نمی‌کند و در برابر هیچ‌کس تعهدی به احراز هویت ندارد. امضای کیف پول تنها دلیل مالکیت حساب است.'),
      text('Rewards, prizes and refunds are paid only to the wallet that holds the account. Openfund may refuse a payment to a wallet that appears on a public sanctions list where the law requires it.',
        'پاداش، جایزه و بازپرداخت فقط به کیف پولی پرداخت می‌شود که حساب به آن تعلق دارد. اوپن‌فاند می‌تواند هر جا قانون الزام کند، از پرداخت به کیف پولی که در فهرست‌های عمومی تحریم آمده خودداری کند.'),
    ] },
    { id: 'fees', heading: text('5. Challenges, fees and payments', '۵. چلنج، هزینه و پرداخت'), paragraphs: [
      text('A challenge fee pays for an evaluation service. It is not a deposit, a loan or an investment and earns no interest or return. The price, account size, rules and phases are shown before you pay.',
        'هزینهٔ چلنج بهای یک خدمت ارزیابی است؛ سپرده، وام یا سرمایه‌گذاری نیست و سود یا بازدهی ندارد. قیمت، اندازهٔ حساب، قوانین و مراحل پیش از پرداخت نمایش داده می‌شود.'),
      text('Payments are made on-chain in the tokens and networks listed at checkout, and you pay the network fees. A payment counts once it is confirmed on-chain and matched to your order. If a confirmed payment does not start the challenge you bought, Openfund either starts it or refunds the amount paid to the paying wallet.',
        'پرداخت به‌صورت آن‌چین و با توکن‌ها و شبکه‌هایی انجام می‌شود که در صفحهٔ خرید آمده‌اند و کارمزد شبکه با شماست. پرداخت وقتی معتبر است که روی بلاک‌چین تأیید و با سفارش شما تطبیق داده شود. اگر پرداخت تأییدشده‌ای چلنج خریداری‌شده را فعال نکند، اوپن‌فاند یا آن را فعال می‌کند یا مبلغ پرداختی را به همان کیف پول پرداخت‌کننده برمی‌گرداند.'),
      text('Once a challenge has started its fee is not refundable, except as the trading rules provide (for example the fee refund with a later reward) or as the law requires.',
        'پس از شروع چلنج، هزینهٔ آن بازگشت‌پذیر نیست؛ مگر طبق قوانین معاملاتی (مثلاً بازپرداخت هزینه همراه یکی از برداشت‌های بعدی) یا آنجا که قانون الزام کند.'),
    ] },
    { id: 'rules', heading: text('6. Trading rules', '۶. قوانین معاملاتی'), paragraphs: [
      text('The published trading rules are part of these terms. They set the profit targets, loss limits, consistency rules, prohibited strategies and what happens on a breach. The trading engine applies the rules published when you bought the challenge. A breach ends the challenge without a refund.',
        'قوانین معاملاتیِ منتشرشده بخشی از همین شرایط است و هدف سود، حد ضرر، قواعد ثبات، راهبردهای ممنوع و پیامد نقض قوانین را تعیین می‌کند. موتور معاملات همان قوانینی را اعمال می‌کند که هنگام خرید چلنج منتشر بوده است. نقض قوانین، چلنج را بدون بازپرداخت پایان می‌دهد.'),
    ] },
    { id: 'rewards', heading: text('7. Funded stage and rewards', '۷. مرحلهٔ فاندد و پاداش'), paragraphs: [
      text('After a successful evaluation, the funded-trader agreement shown before your first funded trade applies in addition to these terms. Rewards are calculated as that agreement and the trading rules describe and are paid to the account wallet. Openfund may withhold a reward that results from a breach of the rules or of these terms and will tell you why.',
        'پس از ارزیابی موفق، علاوه بر این شرایط، توافق‌نامهٔ معامله‌گر فاندد که پیش از نخستین معاملهٔ فاندد نمایش داده می‌شود اعمال می‌شود. پاداش طبق همان توافق‌نامه و قوانین معاملاتی محاسبه و به کیف پول حساب پرداخت می‌شود. اوپن‌فاند می‌تواند پاداشی را که از نقض قوانین یا این شرایط به دست آمده نگه دارد و دلیل آن را اعلام می‌کند.'),
    ] },
    { id: 'conduct', heading: text('8. Acceptable use', '۸. استفادهٔ مجاز'), paragraphs: [
      text('You may not exploit price-feed errors or latency, coordinate or copy trades between accounts to get around the rules, use several wallets to get around limits, run automation that abuses the platform, attack or overload the service, or use Openfund for anything unlawful. Report security issues through the bug bounty instead of exploiting them.',
        'سوءاستفاده از خطا یا تأخیر قیمت، هماهنگی یا کپی معاملات میان حساب‌ها برای دور زدن قوانین، استفاده از چند کیف پول برای دور زدن محدودیت‌ها، اجرای خودکارسازی‌ای که به پلتفرم آسیب بزند، حمله یا ایجاد بار بیش از حد روی سرویس و هر استفادهٔ غیرقانونی از اوپن‌فاند مجاز نیست. ایرادهای امنیتی را به‌جای سوءاستفاده، از طریق باگ بانتی گزارش کنید.'),
    ] },
    { id: 'ip', heading: text('9. Open source and ownership', '۹. متن‌باز بودن و مالکیت'), paragraphs: [
      text('Openfund’s source code and documentation are open source under the Apache License 2.0. The three Openfund chart indicators (Open Algo V5, Price Action Concepts and Smart Money Concepts) and their libraries are owned by Openfund and published as open source under the licence stated in the repository.',
        'کد منبع و مستندات اوپن‌فاند با مجوز Apache 2.0 متن‌باز است. سه اندیکاتور اختصاصی نمودار اوپن‌فاند (Open Algo V5، Price Action Concepts و Smart Money Concepts) و کتابخانه‌های آن‌ها متعلق به اوپن‌فاند است و با مجوزی که در مخزن آمده متن‌باز منتشر شده است.'),
      text('The Openfund name, logo and brand are not covered by the open-source licence and may not be used to suggest that something comes from or is endorsed by Openfund. Third-party components keep their own licences, listed in the repository.',
        'نام، لوگو و برند اوپن‌فاند مشمول مجوز متن‌باز نیست و نباید برای القای اینکه چیزی از سوی اوپن‌فاند یا مورد تأیید آن است به کار رود. اجزای شخص ثالث مجوزهای خود را دارند که در مخزن فهرست شده است.'),
    ] },
    { id: 'third-parties', heading: text('10. Third-party services and market data', '۱۰. خدمات شخص ثالث و دادهٔ بازار'), paragraphs: [
      text('Wallets, blockchains, market-data sources and payment widgets are run by others. Openfund does not control them and is not responsible for their outages, fees or errors. Prices can be delayed or wrong; Openfund may correct or cancel a trade filled at a clearly erroneous price and will say so in the account history.',
        'کیف پول‌ها، بلاک‌چین‌ها، منابع دادهٔ بازار و ابزارهای پرداخت را دیگران اداره می‌کنند. اوپن‌فاند بر آن‌ها کنترلی ندارد و مسئول قطعی، کارمزد یا خطای آن‌ها نیست. قیمت‌ها ممکن است با تأخیر یا نادرست باشند؛ اوپن‌فاند می‌تواند معامله‌ای را که با قیمتی آشکارا نادرست پر شده اصلاح یا لغو کند و این را در تاریخچهٔ حساب ثبت می‌کند.'),
    ] },
    { id: 'liability', heading: text('11. Availability and liability', '۱۱. دسترس‌پذیری و مسئولیت'), paragraphs: [
      text('Openfund is provided as it is and as available. It may be interrupted for maintenance or change over time. To the extent the law allows, Openfund gives no warranties and is not liable for indirect or consequential loss, lost profit or the result of your trading decisions.',
        'اوپن‌فاند همان‌گونه که هست و در حد دسترس‌پذیری ارائه می‌شود و ممکن است برای نگهداری قطع شود یا به‌مرور تغییر کند. تا جایی که قانون اجازه می‌دهد، اوپن‌فاند هیچ ضمانتی نمی‌دهد و مسئول زیان غیرمستقیم یا تبعی، سود ازدست‌رفته یا نتیجهٔ تصمیم‌های معاملاتی شما نیست.'),
      text('Openfund’s total liability for any claim is limited to the fees you paid Openfund in the 12 months before the claim. Nothing in these terms limits a liability that the law does not allow to be limited.',
        'مسئولیت کل اوپن‌فاند در برابر هر ادعا به مبلغ هزینه‌هایی محدود است که در ۱۲ ماه پیش از ادعا به اوپن‌فاند پرداخته‌اید. هیچ بندی از این شرایط مسئولیتی را که قانون محدودکردنش را مجاز نمی‌داند محدود نمی‌کند.'),
    ] },
    { id: 'termination', heading: text('12. Suspension and ending', '۱۲. تعلیق و پایان'), paragraphs: [
      text('Openfund may suspend an account that breaches these terms or the trading rules, that puts the service or other users at risk, or where the law requires it, and will give the reason unless the law prevents it. You can stop using Openfund at any time.',
        'اوپن‌فاند می‌تواند حسابی را که این شرایط یا قوانین معاملاتی را نقض کند، سرویس یا دیگر کاربران را به خطر بیندازد یا قانون الزام کند تعلیق کند و دلیل آن را اعلام می‌کند، مگر قانون مانع شود. شما هر زمان می‌توانید استفاده از اوپن‌فاند را متوقف کنید.'),
    ] },
    { id: 'changes', heading: text('13. Changes to these terms', '۱۳. تغییر این شرایط'), paragraphs: [
      text('Openfund publishes every new version on this page with its date. Using Openfund after that date means you accept the new version. A change never applies retroactively to a challenge that is already running.',
        'اوپن‌فاند هر نسخهٔ تازه را با تاریخ آن در همین صفحه منتشر می‌کند. استفاده از اوپن‌فاند پس از آن تاریخ به معنای پذیرش نسخهٔ تازه است. هیچ تغییری به‌صورت عطف به ماسبق بر چلنجی که در جریان است اعمال نمی‌شود.'),
    ] },
    { id: 'contact', heading: text('14. Contact, disputes and language', '۱۴. تماس، اختلاف و زبان'), paragraphs: [
      text('Contact Openfund through the contact page first; Openfund will try to resolve any dispute informally. Mandatory consumer protection in your country still applies. These terms are published in Persian, English, Arabic, Russian and Chinese; if the versions differ, the English version prevails.',
        'برای هر موضوعی ابتدا از صفحهٔ تماس با اوپن‌فاند در ارتباط باشید؛ اوپن‌فاند می‌کوشد هر اختلافی را به‌صورت دوستانه حل کند. حمایت‌های الزامی از مصرف‌کننده در کشور شما همچنان برقرار است. این شرایط به زبان‌های فارسی، انگلیسی، عربی، روسی و چینی منتشر می‌شود و در صورت تفاوت، نسخهٔ انگلیسی ملاک است.'),
    ] },
  ],
}

export const privacy: LegalDocument = {
  docType: 'privacy',
  version: LEGAL_VERSION,
  effective: '2026-11-28',
  title: text('Privacy Policy', 'سیاست حریم خصوصی'),
  intro: text(
    'This policy explains which data Openfund processes when you use the website, the trading terminal and the desktop app, why it does so and what you can ask for. Openfund collects as little as the service needs.',
    'این سیاست توضیح می‌دهد اوپن‌فاند هنگام استفاده از وب‌سایت، ترمینال معاملاتی و اپلیکیشن دسکتاپ چه داده‌هایی را پردازش می‌کند، چرا، و شما چه درخواست‌هایی می‌توانید داشته باشید. اوپن‌فاند فقط همان مقداری داده جمع می‌کند که خدمت به آن نیاز دارد.'),
  sections: [
    { id: 'no-identity', heading: text('1. No identity documents', '۱. بدون مدرک هویتی'), paragraphs: [
      text('Openfund does not run KYC. It never asks for your name, an identity document, a photo or your home address to use the platform. Your wallet address is your account identifier.',
        'اوپن‌فاند احراز هویت (KYC) انجام نمی‌دهد و برای استفاده از پلتفرم هرگز نام، مدرک هویتی، عکس یا نشانی منزل شما را نمی‌خواهد. نشانی کیف پول شما شناسهٔ حساب شماست.'),
    ] },
    { id: 'collect', heading: text('2. What Openfund processes', '۲. داده‌هایی که پردازش می‌شود'), paragraphs: [
      text('Wallet and sign-in: your wallet address and network, the signed sign-in message and a session record held in a secure cookie.',
        'کیف پول و ورود: نشانی کیف پول و شبکهٔ آن، پیام امضاشدهٔ ورود و یک رکورد نشست که در یک کوکی امن نگه داشته می‌شود.'),
      text('Trading activity: orders, positions, equity, challenge results and certificates of your demo accounts, with the display name you choose for a certificate, if any.',
        'فعالیت معاملاتی: سفارش‌ها، پوزیشن‌ها، اکوئیتی، نتیجهٔ چلنج‌ها و گواهی‌های حساب‌های دموی شما، همراه نام نمایشی‌ای که در صورت تمایل برای گواهی انتخاب می‌کنید.'),
      text('Payments: the order, the paying wallet, the amount, the token and the on-chain transaction. On-chain data is public by the nature of the blockchain.',
        'پرداخت: سفارش، کیف پول پرداخت‌کننده، مبلغ، توکن و تراکنش آن‌چین. دادهٔ آن‌چین به‌طور ذاتی روی بلاک‌چین عمومی است.'),
      text('What you send: contact and support messages with the email address you give, a Premium League registration email, partner applications, and, for a migration request, the name on your account at the other firm and the payout proofs you upload.',
        'آنچه خودتان می‌فرستید: پیام‌های تماس و پشتیبانی همراه نشانی ایمیلی که وارد می‌کنید، ایمیل ثبت‌نام در لیگ برتر، درخواست‌های همکاری و، برای درخواست مهاجرت، نام روی حساب شما در آن شرکت و مدارک برداشتی که بارگذاری می‌کنید.'),
      text('Technical data: the IP address and request details in security logs and rate limits, and your preferences (language, theme, chart layout) stored in your own browser.',
        'دادهٔ فنی: نشانی IP و جزئیات درخواست‌ها در گزارش‌های امنیتی و محدودیت نرخ درخواست، و ترجیحات شما (زبان، تم، چیدمان نمودار) که در مرورگر خودتان ذخیره می‌شود.'),
    ] },
    { id: 'not-done', heading: text('3. What Openfund does not do', '۳. کارهایی که اوپن‌فاند انجام نمی‌دهد'), paragraphs: [
      text('Openfund does not sell personal data, does not use advertising trackers or third-party analytics, and never asks for or stores private keys or recovery phrases.',
        'اوپن‌فاند دادهٔ شخصی نمی‌فروشد، از ردیاب تبلیغاتی یا ابزار تحلیل شخص ثالث استفاده نمی‌کند و هرگز کلید خصوصی یا عبارت بازیابی را درخواست یا ذخیره نمی‌کند.'),
    ] },
    { id: 'purposes', heading: text('4. Why', '۴. چرا'), paragraphs: [
      text('To run your account and challenges, process payments, rewards and refunds, prevent fraud and abuse, keep the service secure, answer your messages and meet legal obligations. Aggregate, non-identifying figures help improve the product.',
        'برای اداره کردن حساب و چلنج‌های شما، پردازش پرداخت، پاداش و بازپرداخت، جلوگیری از تقلب و سوءاستفاده، حفظ امنیت سرویس، پاسخ به پیام‌ها و انجام تعهدات قانونی. آمار کلی و غیرقابل‌شناسایی هم به بهبود محصول کمک می‌کند.'),
    ] },
    { id: 'sharing', heading: text('5. Who receives data', '۵. چه کسانی داده را دریافت می‌کنند'), paragraphs: [
      text('Hosting providers that run Openfund’s servers, the email delivery provider for messages you asked for, the payment widget and blockchain networks used for a payment, and authorities where the law requires it. Each provider receives only what its task needs.',
        'میزبان‌هایی که سرورهای اوپن‌فاند را اجرا می‌کنند، سرویس ارسال ایمیل برای پیام‌هایی که خودتان خواسته‌اید، ابزار پرداخت و شبکه‌های بلاک‌چینی که در پرداخت به کار می‌روند، و مراجع رسمی آنجا که قانون الزام کند. هر ارائه‌دهنده فقط همان داده‌ای را می‌گیرد که کارش به آن نیاز دارد.'),
      text('Public by design: leaderboards show your chosen nickname or a shortened wallet address, and a certificate you share can be verified publicly with its result and display name.',
        'عمومی به‌اقتضای طراحی: جدول‌های رتبه‌بندی نام مستعار انتخابی شما یا نشانی کوتاه‌شدهٔ کیف پول را نشان می‌دهند و گواهی‌ای که به اشتراک می‌گذارید با نتیجه و نام نمایشی‌اش به‌صورت عمومی قابل تأیید است.'),
    ] },
    { id: 'retention', heading: text('6. How long', '۶. مدت نگهداری'), paragraphs: [
      text('Sessions expire on their own. Security logs are kept for a short period. Account, trading and payment records are kept while the account exists and afterwards for as long as accounting and the law require. Messages are kept until they are resolved and for a reasonable period after.',
        'نشست‌ها خودبه‌خود منقضی می‌شوند. گزارش‌های امنیتی برای مدت کوتاهی نگه داشته می‌شوند. سوابق حساب، معاملات و پرداخت تا زمانی که حساب وجود دارد و پس از آن تا جایی که حسابداری و قانون الزام کند نگه داشته می‌شود. پیام‌ها تا رسیدگی و مدتی معقول پس از آن نگه داشته می‌شوند.'),
    ] },
    { id: 'rights', heading: text('7. Your choices and rights', '۷. اختیارات و حقوق شما'), paragraphs: [
      text('You can ask for a copy of your data, its correction or deletion, or object to a use of it, from the contact page using the wallet that holds the account. Records on a blockchain cannot be erased by anyone, and payment records may have to be kept for the periods the law sets.',
        'از صفحهٔ تماس و با همان کیف پولی که حساب به آن تعلق دارد، می‌توانید نسخه‌ای از داده‌هایتان، اصلاح یا حذف آن را بخواهید یا به نوعی استفاده از آن اعتراض کنید. سوابق روی بلاک‌چین را هیچ‌کس نمی‌تواند پاک کند و سوابق پرداخت ممکن است باید تا مدتی که قانون تعیین می‌کند نگه داشته شود.'),
    ] },
    { id: 'security', heading: text('8. Security', '۸. امنیت'), paragraphs: [
      text('Traffic is encrypted, one-time codes are stored only as hashes, database access is split into least-privilege roles and every administrative action is recorded in an audit log.',
        'ترافیک رمزنگاری می‌شود، کدهای یک‌بارمصرف فقط به‌صورت هش ذخیره می‌شوند، دسترسی پایگاه داده به نقش‌هایی با کمترین سطح دسترسی لازم تقسیم شده و هر اقدام مدیریتی در گزارش ممیزی ثبت می‌شود.'),
    ] },
    { id: 'cookies', heading: text('9. Cookies and browser storage', '۹. کوکی و حافظهٔ مرورگر'), paragraphs: [
      text('Openfund uses only the cookies the service needs (the sign-in session and its protection). Preferences such as language, theme and chart layout stay in your browser storage. There are no tracking cookies.',
        'اوپن‌فاند فقط از کوکی‌های ضروری سرویس استفاده می‌کند (نشست ورود و محافظت از آن). ترجیحاتی مانند زبان، تم و چیدمان نمودار در حافظهٔ مرورگر خودتان می‌ماند. هیچ کوکی ردیابی وجود ندارد.'),
    ] },
    { id: 'transfers', heading: text('10. Where data is processed', '۱۰. محل پردازش داده'), paragraphs: [
      text('Data is processed in the countries where Openfund’s hosting providers run its servers, which may differ from your own. Openfund applies this policy wherever the data is.',
        'داده در کشورهایی پردازش می‌شود که میزبان‌های اوپن‌فاند سرورهای آن را اجرا می‌کنند و ممکن است با کشور شما متفاوت باشد. اوپن‌فاند این سیاست را در هر جایی که داده باشد اعمال می‌کند.'),
    ] },
    { id: 'minors', heading: text('11. Under 18', '۱۱. افراد زیر ۱۸ سال'), paragraphs: [
      text('Openfund is not for anyone under 18 and does not knowingly process their data.',
        'اوپن‌فاند برای افراد زیر ۱۸ سال نیست و آگاهانه داده‌های آنان را پردازش نمی‌کند.'),
    ] },
    { id: 'changes', heading: text('12. Changes and contact', '۱۲. تغییرات و تماس'), paragraphs: [
      text('Openfund publishes every new version of this policy on this page with its date. Questions and requests go through the contact page.',
        'اوپن‌فاند هر نسخهٔ تازهٔ این سیاست را با تاریخ آن در همین صفحه منتشر می‌کند. پرسش‌ها و درخواست‌ها از طریق صفحهٔ تماس ارسال می‌شوند.'),
    ] },
  ],
}

export const legalCopy = {
  version: text('Version', 'نسخه'),
  effective: text('Effective', 'تاریخ اجرا'),
  contents: text('Contents', 'فهرست'),
  related: text('Related', 'مرتبط'),
  rules: text('Trading rules', 'قوانین معاملاتی'),
  contact: text('Contact Openfund', 'تماس با اوپن‌فاند'),
}
