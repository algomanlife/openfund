# تحویل اصلاحات یکپارچهٔ Openfund — ۲۰۲۶/۱۱/۰۲

## مبنای Git و دامنهٔ کار

مبنای کار `origin/main` در Commit `1aaa806`، شامل PR #23 و نسخهٔ Home در
`48f68bc` است. Remote رسمی `algomanlife/openfund` دریافت شد؛ PRهای ۱۳ تا ۲۳،
معماری، دستورهای AGENTS، تست‌ها و Blueprint مطالعه شدند. پوشهٔ معرفی‌شده Git
نبود؛ نسخه‌های `dual-terminals` و `landing-pages` عقب‌تر بودند. تغییرات در
worktree مستقل `integration-audit` و شاخهٔ `codex/trading-wallet-integration-audit`
از main انجام شدند. نسخه‌های قبلی و تغییرات کاربران بازنویسی نشدند.

این تحویل اصلاح کد و تست محلی است؛ استقرار Production یا اتصال افزونهٔ واقعی
کیف پول ادعا نمی‌شود. هیچ سفارش Prop به Gains یا زنجیره فرستاده نشده است.

## ایرادها و اصلاحات

| ایراد تأییدشده | علت | اصلاح |
| --- | --- | --- |
| منوهای اضافی Home | فعال‌نشدن گزینهٔ موجود `nav=false` | استفاده از Layout موجود؛ صفحات داخلی حفظ شدند |
| ورود Perpetual به Prop | CTA به مسیر قدیمی `/terminal` می‌رفت | مسیر مستقیم وابسته به زبان و محصول |
| مسیر ناقص حساب | شبکه و SIWE فقط Arbitrum Sepolia؛ پنل فاقد ورودی محصول | Sepolia برای Prop و Arbitrum One برای Perpetual؛ لینک هر دو حساب در پنل |
| نمایش اطلاعات کیف پول قبلی | پاسخ‌های ناهم‌زمان و ترتیب نامشخص تغییر کوکی | تطبیق آدرس، پاک‌کردن فوری داده، ترتیب‌دادن verify/logout و ابطال نشست هنگام قطع اتصال |
| مصرف دوبارهٔ Nonce هم‌زمان | خواندن و مصرف جداگانه بدون شرط اتمیک | UPDATE شرطی و کنترل تک‌بار مصرف، URI، زمان و شبکه |
| افشای پاسخ سفارش با کلید مشترک | جست‌وجوی عمومی Idempotency | محدودکردن به مالک، حفظ خواندن سوابق قبلی و رد payload متفاوت |
| قبول سفارش بدون هزینهٔ کافی | کنترل فقط Margin | لحاظ کارمزد افتتاح، Equity و زیان باز؛ بازاعتبارسنجی هنگام Trigger |
| اختلاف PnL و حذف اعشار قیمت | محاسبهٔ دوباره در مرورگر و گردکردن قیمت به دو رقم | محاسبات مشترک Decimal در سرور؛ Terminal مقادیر سرور را نمایش می‌دهد |
| Net analytics بیشتر از نتیجهٔ حساب | کم‌نشدن Open Fee از Round Trip | کسر هر دو کارمزد؛ عدم بازنویسی Ledger تاریخی |
| بستن جزئی وجود نداشت | Close فقط کامل بود | سهم‌های ۲۵٪/۵۰٪/۱۰۰٪ در UI، تخصیص متناسب و نتیجهٔ اتمیک قابل تکرار |
| رقابت Fill/Cancel/Protection | قفل‌های ناهمسان | ترتیب قفل حساب سپس سفارش/پوزیشن در تراکنش |
| قیمت منقضی به‌شکل معتبر نمایش داده می‌شد | استفاده از Mark بدون Freshness در بعضی مسیرها | مقدار نامعلوم و وضعیت stale؛ جلوگیری از اجرای خودکار با قیمت منقضی |
| بازیابی Feed و Timer | شکست Boot بدون Retry؛ Interval تازه در هر Reconnect | Retry و Refresh واحد با پاک‌سازی؛ حفظ زمان منبع قیمت و بررسی مقدار معتبر |
| بیرون‌زدگی Header موبایل | Chips شبکه/حساب بدون Wrap | Wrap و محدودیت عرض در همان Header |
| 404 پس‌زمینهٔ Home | ارجاع به backdrop.svg ناموجود | لایهٔ نور CSS با Transform، بدون تغییر Logo، متن و کارت‌ها |

## موتور محاسباتی و داده

`apps/backend/trading-math.js` مرجع مشترک Decimal برای Engine و Portfolio است.
Notional برابر Margin × Leverage و Quantity برابر Notional ÷ Entry اجرایی است.
Gross PnL با Quantity و اختلاف Mark/Entry حساب می‌شود؛ Net تخمینی خروج، Spread
خروج و هر دو Fee را لحاظ می‌کند. Balance از Ledger و Used Margin از حساب معتبر
می‌آیند. Available Margin از Equity محاسبه و هنگام افتتاح به وجه نقد قابل استفاده
محدود می‌شود؛ سود باز وثیقهٔ تازه نمی‌سازد. مقدار نامعلوم به صفر تبدیل نمی‌شود.

Liquidation مدل Prop، هزینهٔ بستن و Spread خروج را در شرط نگهداشت دخیل می‌کند.
قیمت نهایی Trigger/Close همان سیاست شبیه‌سازی مستند پروژه است؛ Slippage ناشی از
عمق بازار، تضمین اجرای Stop در Gap و Funding/Borrowing مدل نشده‌اند.

Partial Close یک ردیف بسته در همان جدول پوزیشن با `parent_position_id` می‌سازد؛
ردیف اصلی با Quantity/Margin/Open Fee باقی‌مانده باز می‌ماند. Order، زمان افتتاح،
SL/TP و مالکیت حفظ می‌شوند. Ledger موجود تغییر نمی‌کند؛ کارمزد خروج و آزادسازی
Margin فقط برای سهم بسته تسویه می‌شوند. کلید درخواست، نتیجهٔ ثبت‌شده را برمی‌گرداند.

API حساب، سود تحقق‌یافتهٔ خالص از هزینه‌ها را نمایش می‌دهد. ستون قدیمی DB برای
Close Settlement محفوظ است و جداگانه `close_settlement_pnl` نام دارد. سوابق
پوزیشن نیز فیلد صریح `net_pnl` دارند. نمودار معاملات بسته پس از بسته‌شدن همهٔ
پوزیشن‌ها با تغییر Balance نسبت به تأمین اولیه تطبیق دارد.

افت روزانه و بیشینهٔ افت، از Equity مشاهده‌شده ذخیره می‌شوند: UTC، شروع روز در
نخستین مشاهدهٔ تازهٔ آن روز، تاریخ شروع اندازه‌گیری در `since`. تاریخچهٔ Markهای
ناموجود بازسازی نمی‌شود. حساب Free Demo به قوانین تجاری یک Challenge متصل نیست؛
سقف‌ها null می‌مانند و قوانین خرید/قبولی چالش به‌طور ساختگی اعمال نشده‌اند.

## مقایسه با Gains

نسخهٔ جاری npm و SDK موجود هر دو `1.8.10` بررسی شدند. مستندات رسمی
[SDK](https://docs.gains.trade/developer/technical-reference/sdk)،
[Fees & Spread](https://docs.gains.trade/gtrade-leveraged-trading/fees-and-spread)
و [v10 migration](https://docs.gains.trade/developer/integrators/guides/v10-migration)
مرجع بررسی‌اند. مدل Openfund همان شبیه‌سازی Virtual DAI است: نرخ‌های سادهٔ
Asset Class، نگهداشت قابل تنظیم، بدون Accumulatorهای Funding/Borrowing، Skew،
Fee Decay یا محاسبات وثیقهٔ چندارزی قراردادهای Gains. برابری با قرارداد v10
ادعا نمی‌شود. Perpetual داده‌های معتبر خواندنی را از Wallet/منابع Gains می‌گیرد؛
PnL خالص و موجودی‌ای که دادهٔ کافی برایشان نیست، ساخته نمی‌شوند.

## Wallet، Portfolio و Terminal

یک سیستم حساب، یک SessionProvider و یک Terminal مشترک حفظ شده است. Prop به
Ethereum Sepolia با Chain ID `11155111` و Perpetual به Arbitrum One با `42161`
متصل‌اند. تغییر شبکه و امضا از کیف پول درخواست می‌شود. کلید خصوصی یا Seed کاربر
درخواست/ثبت نشده است. EIP-1271 بر مبنای شبکهٔ پیام بررسی می‌شود.

Portfolio و Dashboard با درخواست‌های قابل لغو تازه می‌شوند؛ Prop حدود ۵ ثانیه و
Gains حدود ۱۵ ثانیه با Cache خواندن بالادستی ۲۰ ثانیه. Terminal از SSE موجود
استفاده می‌کند، PnL/ROI/Liquidation سرور را می‌گیرد و قطع اتصال را مشخص می‌کند.
نشست منقضی/باطل/معلق در SSE دوباره بررسی می‌شود. Journal و داده‌های دو محصول
جدا باقی مانده‌اند.

## Home و شواهد تصویری

چهار لینک اضافی در Layout خود Home حذف شدند؛ ناوبری داخلی برقرار است. Motion
با سه لایهٔ CSS در پشت محتوا، حرکت Transform و پشتیبانی Reduced Motion است.
موبایل دو لایه دارد. Timer، Canvas، WebGL یا تغییر Layout برای این حرکت نیست.

![Home فارسی با محتوای واقعی Directus](home-fa-desktop.png)

تصاویر دیگر و نتایج ماشین‌خوان در `output/playwright/` محلی هستند. Fixtureهای
مرورگر CI به‌صراحت محتوای آزمایشی‌اند؛ تصویر بالا محتوای Directus محلی واقعی است.

## Render و Migration

سه منبع حفظ شدند: `openfund`، `openfund-db` با PostgreSQL 17 و `openfund-cms` با
Directus 11.9.1. مسیر `/react/`، APIها، کوکی first-party و Engine/SSE همان‌اند.
سرویس Static، Redis، Worker، Dockerfile یا دیتابیس Production تازه اضافه نشده است.

تغییرات ضروری Blueprint: نصب devDependencies برای Build، نام‌های عمومی برای
SIWE/CMS به‌جای hostname داخلی، متغیرهای صحیح اتصال Directus، Region مشترک و
یک Instance موتور. دلیل فنی و منابع در [راهنمای Render](../../deployment/RENDER.md)
ثبت شده‌اند. اگر منابع موجود در Region دیگری provision شده‌اند، Region با Sync
قابل تغییر نیست و باید طبق روش Render مهاجرت شود؛ این کار در این PR انجام نشده است.

Migrationها افزایشی و دو بار روی دیتابیس آزمایشی اجرا شده‌اند. هیچ پاک‌سازی
دیتابیس موجود، بازنویسی Ledger، Secret تازه یا تغییر مستقیم Production انجام نشده است.

## نتایج تست

محیط: Node `22.23.4`، PostgreSQL `17.11` محلی و دیتابیس آزمایشی جدا از CMS/کاربر.

| بررسی | نتیجه |
| --- | --- |
| TypeScript واقعی، بدون نادیده‌گرفتن خطا | موفق |
| Frontend Unit: Plans / Information / Markets | ۱۷ موفق |
| Backend: SIWE / Trading / Portfolio / Products / Gains / Audit | ۱۸۱ موفق |
| مرورگر با Directus و Gains زنده، Signer آزمایشی | ۹۴ بررسی |
| مرورگر CI با Fixtureهای CMS/Gains و Wallet آزمایشی | ۳۱ بررسی |
| Build با NODE_ENV=production و نصب include=dev | موفق؛ هشدار موجود حجم Chunk باقی است |
| Production-mode Smoke: Health، Asset، Cookie و غیرفعال‌بودن Seam آزمایشی | ۷ موفق؛ Transport محلی HTTP، نه TLS مستقر |
| Migration دو بار | موفق |
| Blueprint ساختاری و کنترل معنایی | موفق، ۲ سرویس و ۱ دیتابیس |

Browserها به‌ترتیب و بعد از Backend اجرا می‌شوند، زیرا Seam قیمت آزمایشی در
یک Process مشترک است. آزمون PnL منتظر رسیدن Snapshot تازهٔ SSE می‌ماند؛ مشاهدهٔ
پوزیشن به‌تنهایی نشانهٔ دریافت آخرین Mark نیست. CI همین Smoke مرورگر را ذخیره می‌کند.

## محدودیت‌های واقعی و تحویل

- افزونهٔ واقعی MetaMask/Rabby، WalletConnect از راه دور، Hardware Wallet و
  Contract Wallet در شبکهٔ واقعی با کاربر تست نشده‌اند. Signerهای تولیدشدهٔ تست،
  امضای واقعی ECDSA/SIWE دارند؛ نتیجهٔ شبکهٔ واقعی محسوب نمی‌شوند.
- اجرای On-chain Gains طبق AGENTS غیرفعال باقی است. دادهٔ خواندنی Gains زنده
  بررسی شده؛ صحت تسویهٔ یک تراکنش واقعی یا Net PnL بدون Accumulator ادعا نمی‌شود.
- Render CLI احرازشده، apply Blueprint، سلامت Production و اجرای Directus در
  Render تأیید نشده‌اند؛ اعتبارسنجی محلی و تطبیق مستندات، جای Deployment نیست.
- قوانین اجباری Challenge خریداری‌شده، Funding و Borrowing اختصاصی Prop و
  تاریخچهٔ افت قبل از شروع اندازه‌گیری قابلیت تحویل‌شده محسوب نمی‌شوند.
- Merge باید بعد از Review انجام شود؛ این شاخه مستقیماً روی Production اعمال نمی‌شود.

فایل‌های اصلی اصلاح‌شده: Engine/Market Data/Portfolio/Server/Schema، Wallet و Session،
TradingBridge، Terminal مشترک، Home/Layout، Blueprint/Validator، CI، تست‌ها و مستندات.
نشانی PR و Commitها در پاسخ تحویل و تاریخچهٔ همین شاخه درج می‌شوند.
