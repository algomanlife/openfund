/* Retired editorial defaults (ADR 0059: prices come from Open Oracle).
 *
 * Directus rows seeded from an earlier default keep that text until an
 * editor changes it, and seeds never overwrite editor values. A published
 * value that is still EXACTLY a retired default is shown as its current
 * default instead; any edited value is left untouched. Generated from the
 * seed changes of the Open Oracle attribution update. */
export const RETIRED_COPY: ReadonlyMap<string, string> = new Map([
  [
    "A dedicated trading terminal on live Gains Network market data: crypto, forex, stocks, indices and commodities.",
    "A dedicated trading terminal with live Open Oracle prices: crypto, forex, stocks, indices and commodities."
  ],
  [
    "Could not reach Gains Network. Check your connection and retry.",
    "Could not load market data. Check your connection and retry."
  ],
  [
    "Every asset class the Openfund trading ecosystem tracks, with live mark prices straight from Gains Network. Pick a market and take it straight into the terminal.",
    "Every asset class the Openfund trading ecosystem tracks, priced live by Open Oracle — our own aggregation of Gains, Hyperliquid and GMX. Pick a market and take it straight into the terminal."
  ],
  [
    "Explore every Openfund market — crypto, forex, stocks, indices and commodities — with live Gains Network prices.",
    "Explore every Openfund market — crypto, forex, stocks, indices and commodities — with live prices from Open Oracle, Openfund’s own price aggregation."
  ],
  [
    "Gains Network supplies market metadata and prices over REST and WebSocket. Vela displays charts. Market prices are not evidence of orders being executed on-chain.",
    "Open Oracle, Openfund’s own price service, combines Gains, Hyperliquid and GMX prices into one composite per market and streams it from our servers; Gains Network supplies market metadata. Vela displays charts. Market prices are not evidence of orders being executed on-chain."
  ],
  [
    "Gains Network مشخصات بازار و قیمت را با REST و WebSocket تأمین می‌کند. Vela نمودار را نمایش می‌دهد. قیمت بازار، مدرک اجرای سفارش آن‌چین نیست.",
    "Open Oracle، سرویس قیمت اختصاصی اوپن‌فاند، قیمت‌های Gains، Hyperliquid و GMX را برای هر بازار به یک قیمت ترکیبی تبدیل می‌کند و از سرورهای ما پخش می‌کند؛ مشخصات بازار را Gains Network تأمین می‌کند. Vela نمودار را نمایش می‌دهد. قیمت بازار، مدرک اجرای سفارش آن‌چین نیست."
  ],
  [
    "In Openfund the prices you see are Gains Network mark prices, consumed from the public Gains deployment on Arbitrum One and drawn on a Vela (LuxAlgo) chart. Openfund reports these marks as they are published by that feed; it does not compute a separate mark of its own.",
    "In Openfund the prices you see are Open Oracle prices: Openfund’s own composite of Gains, Hyperliquid and GMX, drawn on a Vela (LuxAlgo) chart. When the sources disagree, Openfund flags the price instead of publishing a misleading one."
  ],
  [
    "In Openfund, Prop Trading is a server-side simulated demo: margin and forced closes are handled inside that simulation, priced from live Gains Network mark prices, and no demo result creates a claim on capital. Perpetual Trading is read-only today — on-chain execution is not enabled — so it is a place to study prices, not to test margin modes.",
    "In Openfund, Prop Trading is a server-side simulated demo: margin and forced closes are handled inside that simulation, priced from live Open Oracle prices, and no demo result creates a claim on capital. Perpetual Trading is read-only today — on-chain execution is not enabled — so it is a place to study prices, not to test margin modes."
  ],
  [
    "Mark prices and market specs come from Gains Network (the data source); leverage and Openfund account terms are independent. Only fields provided by the source are shown.",
    "Prices are Open Oracle composites of Gains, Hyperliquid and GMX: crypto markets combine up to three sources, other markets use one. Market specifications come from Gains Network; leverage and Openfund account terms are independent. Only fields provided by the sources are shown."
  ],
  [
    "Markets come from Gains Network metadata and are grouped into crypto, forex, stocks, indices and commodities — around 488 symbols. Prices are Gains Network mark prices, not an independent index feed. The available list and each market’s status can change, so check the terminal.",
    "Markets come from Gains Network metadata and are grouped into crypto, forex, stocks, indices and commodities — around 488 symbols. Prices are Open Oracle composites: crypto markets combine Gains, Hyperliquid and GMX, other markets use Gains. The available list and each market’s status can change, so check the terminal."
  ],
  [
    "Openfund context: the demo is a server-side simulated account — 100,000 virtual DAI once per user, no deposits, withdrawals, refills or resets, priced from live Gains Network mark prices. Demo profit is not money owed, and demo trading does not establish eligibility for a funded account. The loss limits quoted here are published terms of record, not enforced in this release.",
    "Openfund context: the demo is a server-side simulated account — 100,000 virtual DAI once per user, no deposits, withdrawals, refills or resets, priced from live Open Oracle prices. Demo profit is not money owed, and demo trading does not establish eligibility for a funded account. The loss limits quoted here are published terms of record, not enforced in this release."
  ],
  [
    "Openfund is a trading platform with two products on one terminal: Prop Trading and Perpetual Trading. Today Prop Trading runs a simulated demo account — one per user, funded once with 100,000 virtual DAI and priced from live Gains Network mark prices — while Perpetual Trading shows read-only data from the public Gains Network deployment on Arbitrum One.",
    "Openfund is a trading platform with two products on one terminal: Prop Trading and Perpetual Trading. Today Prop Trading runs a simulated demo account — one per user, funded once with 100,000 virtual DAI and priced from live Open Oracle prices — while Perpetual Trading shows read-only data from the public Gains Network deployment on Arbitrum One."
  ],
  [
    "Openfund is one trading platform with two paths: prop trading challenges and leveraged perpetual trading on live Gains Network market data.",
    "Openfund is one trading platform with two paths: prop trading challenges and leveraged perpetual trading, priced live by Open Oracle, our own price aggregation."
  ],
  [
    "Openfund status: purchase activation, funded accounts and payouts are not enabled in this release, and a final versioned agreement will be published before launch. What runs today is a single server-side simulated free_demo account per user, funded once with 100,000 virtual DAI and priced from live Gains Network mark prices, with no deposits, withdrawals, refills or resets. Demo profit is not money owed to the trader, and trading the demo does not establish eligibility for a funded account. Every figure in this path is a published term of record.",
    "Openfund status: purchase activation, funded accounts and payouts are not enabled in this release, and a final versioned agreement will be published before launch. What runs today is a single server-side simulated free_demo account per user, funded once with 100,000 virtual DAI and priced from live Open Oracle prices, with no deposits, withdrawals, refills or resets. Demo profit is not money owed to the trader, and trading the demo does not establish eligibility for a funded account. Every figure in this path is a published term of record."
  ],
  [
    "Prices are live Gains Network mark prices. The data source does not provide order-book depth, open interest or a trade tape, and the terminal shows those as unavailable rather than inventing values for them.",
    "Prices are live Open Oracle composites of Gains, Hyperliquid and GMX. The price sources do not provide order-book depth, open interest or a trade tape, and the terminal shows those as unavailable rather than inventing values for them."
  ],
  [
    "Prices come from Gains Network: crypto, forex, stocks, indices and commodities.",
    "Prices come from Open Oracle, our own aggregation of Gains, Hyperliquid and GMX: crypto, forex, stocks, indices and commodities."
  ],
  [
    "Prices, candles and market metadata come from Gains Network, a decentralized leveraged-trading protocol. Openfund reads this data; it does not execute trades on Gains.",
    "Candles and market metadata come from Gains Network, a decentralized leveraged-trading protocol, which is also one of the three price sources of Open Oracle. Openfund reads this data; it does not execute trades on Gains."
  ],
  [
    "Scope matters. This release is read-only on perpetual markets and cannot execute on-chain, so an automated system here means analysis, monitoring and backtesting over the records, not live orders. The Prop Trading environment is a single server-side simulated demo funded once with 100,000 virtual DAI at live Gains Network mark prices, with purchase activation, funded accounts and payouts not enabled. Treat each backtest as a rehearsal, and the CSV journal analyzer and portfolio dashboard - fed by the account records - as tools for measuring a process, not evidence about results.",
    "Scope matters. This release is read-only on perpetual markets and cannot execute on-chain, so an automated system here means analysis, monitoring and backtesting over the records, not live orders. The Prop Trading environment is a single server-side simulated demo funded once with 100,000 virtual DAI at live Open Oracle prices, with purchase activation, funded accounts and payouts not enabled. Treat each backtest as a rehearsal, and the CSV journal analyzer and portfolio dashboard - fed by the account records - as tools for measuring a process, not evidence about results."
  ],
  [
    "The Gains Network feed that Openfund reads today supplies no open interest, no order-book depth and no trade tape, so Openfund shows those as unavailable instead of estimating or fabricating them. To measure slippage or read depth, use the venue you trade on directly. Openfund’s Perpetual Trading view is read-only and Prop Trading runs a simulated demo priced on live Gains mark prices.",
    "The price feeds Openfund reads today supply no open interest, no order-book depth and no trade tape, so Openfund shows those as unavailable instead of estimating or fabricating them. To measure slippage or read depth, use the venue you trade on directly. Openfund’s Perpetual Trading view is read-only and Prop Trading runs a simulated demo priced on live Open Oracle prices."
  ],
  [
    "The Openfund demo is a server-side simulated account: one per user, 100,000 virtual DAI allocated once, priced from live Gains Network mark prices, with no deposits, withdrawals, refills or resets — and a demo profit is not money owed to anyone. Challenge plans publish a reference leverage of 5x; the real per-market maximum comes from the market feed, so read it in the terminal rather than assuming a ceiling.",
    "The Openfund demo is a server-side simulated account: one per user, 100,000 virtual DAI allocated once, priced from live Open Oracle prices, with no deposits, withdrawals, refills or resets — and a demo profit is not money owed to anyone. Challenge plans publish a reference leverage of 5x; the real per-market maximum comes from the market feed, so read it in the terminal rather than assuming a ceiling."
  ],
  [
    "The application loads market metadata and marks from Gains Network. Instruments are grouped into crypto, forex, stocks, indices and commodities — browse the full directory on the Markets page. The available list and each market’s status can change.",
    "The application loads market metadata from Gains Network and reference prices from Open Oracle, Openfund’s aggregation of Gains, Hyperliquid and GMX. Instruments are grouped into crypto, forex, stocks, indices and commodities — browse the full directory on the Markets page. The available list and each market’s status can change."
  ],
  [
    "The simulated demo is the only trading environment active today: one free_demo account per user, 100,000 virtual DAI allocated once, priced from live Gains Network mark prices, with no deposits, withdrawals, refills or resets. Demo activity does not create a right to capital, a reward share or a withdrawal, and passing demo trading does not establish eligibility for a funded account. News-trading and weekend rules for funded stages, the scaling plan and the reset and appeal process are not finalized; the exact funded-stage conditions follow the final versioned agreement to be published before launch.",
    "The simulated demo is the only trading environment active today: one free_demo account per user, 100,000 virtual DAI allocated once, priced from live Open Oracle prices, with no deposits, withdrawals, refills or resets. Demo activity does not create a right to capital, a reward share or a withdrawal, and passing demo trading does not establish eligibility for a funded account. News-trading and weekend rules for funded stages, the scaling plan and the reset and appeal process are not finalized; the exact funded-stage conditions follow the final versioned agreement to be published before launch."
  ],
  [
    "The simulated demo lowers the stakes but not the pattern: it runs on 100,000 virtual DAI at live Gains Network mark prices, so a losing streak costs you nothing withdrawable, yet still shows how you behave under the feeling - the only thing this lesson is about. Nothing here is investment advice, and staying calm or journalling a loss is no route to profit or to a funded account.",
    "The simulated demo lowers the stakes but not the pattern: it runs on 100,000 virtual DAI at live Open Oracle prices, so a losing streak costs you nothing withdrawable, yet still shows how you behave under the feeling - the only thing this lesson is about. Nothing here is investment advice, and staying calm or journalling a loss is no route to profit or to a funded account."
  ],
  [
    "The terminal pairs the Vela charting engine by LuxAlgo with market data from Gains Network. Both products — Prop Trading and Perpetual Trading — run on this one interface, so you chart and view the same markets in one place.",
    "The terminal pairs the Vela charting engine by LuxAlgo with live Open Oracle prices and Gains Network market data. Both products — Prop Trading and Perpetual Trading — run on this one interface, so you chart and view the same markets in one place."
  ],
  [
    "This lesson describes how perpetual venues work in general. In Openfund, Perpetual Trading is currently read-only market and account information — on-chain order execution is not enabled — and the prices shown are Gains Network mark prices consumed from the public deployment on Arbitrum One, rendered on a Vela (LuxAlgo) chart.",
    "This lesson describes how perpetual venues work in general. In Openfund, Perpetual Trading is currently read-only market and account information — on-chain order execution is not enabled — and the prices shown are Open Oracle prices, Openfund’s own aggregation of Gains, Hyperliquid and GMX, rendered on a Vela (LuxAlgo) chart."
  ],
  [
    "Today the demo drives fills from fresh server-side Gains Network mark prices and records them on your account, so execution is simulated and not routed to any venue. Because it is a simulation, demo results do not prove live execution quality, and any fairness guarantees for live trading belong to the final agreement.",
    "Today the demo drives fills from fresh server-side Open Oracle prices — only when the sources agree — and records them on your account, so execution is simulated and not routed to any venue. Because it is a simulation, demo results do not prove live execution quality, and any fairness guarantees for live trading belong to the final agreement."
  ],
  [
    "Today there is no customer capital to custody: the demo holds only virtual funds — one 100,000 DAI simulated account per user, priced from live Gains Network mark prices, with no deposits or withdrawals. Real funded capital is a planned stage that arrives with the commercial launch and the final agreement.",
    "Today there is no customer capital to custody: the demo holds only virtual funds — one 100,000 DAI simulated account per user, priced from live Open Oracle prices, with no deposits or withdrawals. Real funded capital is a planned stage that arrives with the commercial launch and the final agreement."
  ],
  [
    "ارتباط با Gains Network برقرار نشد. اتصال خود را بررسی کن و دوباره تلاش کن.",
    "دریافت دادهٔ بازار ممکن نشد. اتصال خود را بررسی کن و دوباره تلاش کن."
  ],
  [
    "امروز دمو اجرا را از قیمت مرجع تازهٔ سروریِ Gains Network می‌سازد و در حساب تو ثبتش می‌کند؛ پس اجرا شبیه‌سازی‌شده است و به هیچ بازاری هدایت نمی‌شود. چون شبیه‌سازی است، نتیجهٔ دمو کیفیت اجرای زنده را اثبات نمی‌کند و هر تضمینِ انصاف برای معاملهٔ زنده، به قرارداد نهایی تعلق دارد.",
    "امروز دمو اجرا را از قیمت تازهٔ سروریِ Open Oracle — فقط وقتی منابع هم‌خوان‌اند — می‌سازد و در حساب تو ثبتش می‌کند؛ پس اجرا شبیه‌سازی‌شده است و به هیچ بازاری هدایت نمی‌شود. چون شبیه‌سازی است، نتیجهٔ دمو کیفیت اجرای زنده را اثبات نمی‌کند و هر تضمینِ انصاف برای معاملهٔ زنده، به قرارداد نهایی تعلق دارد."
  ],
  [
    "امروز سپردهٔ مشتری‌ای برای امانت گرفتن وجود ندارد: دمو تنها وجه مجازی نگه می‌دارد — یک حساب شبیه‌سازی‌شدهٔ ۱۰۰٬۰۰۰ دای برای هر کاربر، قیمت‌گذاری‌شده از قیمت مرجع زندهٔ Gains Network، بدون واریز یا برداشت. سرمایهٔ واقعیِ فاندشده مرحله‌ای برنامه‌ریزی‌شده است که با عرضهٔ تجاری و قرارداد نهایی می‌آید.",
    "امروز سپردهٔ مشتری‌ای برای امانت گرفتن وجود ندارد: دمو تنها وجه مجازی نگه می‌دارد — یک حساب شبیه‌سازی‌شدهٔ ۱۰۰٬۰۰۰ دای برای هر کاربر، قیمت‌گذاری‌شده از قیمت زندهٔ Open Oracle، بدون واریز یا برداشت. سرمایهٔ واقعیِ فاندشده مرحله‌ای برنامه‌ریزی‌شده است که با عرضهٔ تجاری و قرارداد نهایی می‌آید."
  ],
  [
    "اوپن‌فاند یک پلتفرم معاملاتی است که دو محصول را روی یک ترمینال دارد: معاملهٔ چلنجی (Prop Trading) و معاملهٔ دائمی (Perpetual Trading). امروز محصول چلنجی یک حساب دموی شبیه‌سازی‌شده اجرا می‌کند — یک حساب برای هر کاربر، یک‌بار با ۱۰۰٬۰۰۰ دای مجازی، قیمت‌گذاری‌شده از قیمت مرجع زندهٔ Gains Network — و محصول دائمی فقط دادهٔ خواندنی از استقرار عمومی Gains Network بر بستر Arbitrum One نشان می‌دهد.",
    "اوپن‌فاند یک پلتفرم معاملاتی است که دو محصول را روی یک ترمینال دارد: معاملهٔ چلنجی (Prop Trading) و معاملهٔ دائمی (Perpetual Trading). امروز محصول چلنجی یک حساب دموی شبیه‌سازی‌شده اجرا می‌کند — یک حساب برای هر کاربر، یک‌بار با ۱۰۰٬۰۰۰ دای مجازی، قیمت‌گذاری‌شده از قیمت زندهٔ Open Oracle — و محصول دائمی فقط دادهٔ خواندنی از استقرار عمومی Gains Network بر بستر Arbitrum One نشان می‌دهد."
  ],
  [
    "اوپن‌فاند یک پلتفرم معاملاتی با دو مسیر است: چلنج‌های پراپ و معاملات پرپچوال اهرمی با دادهٔ زندهٔ بازار از Gains Network.",
    "اوپن‌فاند یک پلتفرم معاملاتی با دو مسیر است: چلنج‌های پراپ و معاملات پرپچوال اهرمی با قیمت زندهٔ Open Oracle، سامانهٔ تجمیع قیمت اختصاصی اوپن‌فاند."
  ],
  [
    "این درس مکانیک عمومی صرافی‌های پرپچوآل را توضیح می‌دهد. در اوپن‌فاند، بخش «معاملات آنی» فعلاً فقط دادهٔ خواندنیِ بازار و حساب است — اجرای آن‌چینیِ سفارش فعال نیست — و قیمت‌های نمایش‌داده‌شده، مارک پرایس‌های Gains Network هستند که از استقرار عمومی آن روی Arbitrum One خوانده و روی نمودار Vela (LuxAlgo) رسم می‌شوند.",
    "این درس مکانیک عمومی صرافی‌های پرپچوآل را توضیح می‌دهد. در اوپن‌فاند، بخش «معاملات آنی» فعلاً فقط دادهٔ خواندنیِ بازار و حساب است — اجرای آن‌چینیِ سفارش فعال نیست — و قیمت‌های نمایش‌داده‌شده، قیمت‌های Open Oracle، سامانهٔ تجمیع قیمت اختصاصی اوپن‌فاند از Gains، Hyperliquid و GMX، هستند که روی نمودار Vela (LuxAlgo) رسم می‌شوند."
  ],
  [
    "بازارها از مشخصات Gains Network می‌آیند و در دسته‌های رمزارز، فارکس، سهام، شاخص و کالا گروه‌بندی می‌شوند — حدود ۴۸۸ نماد. قیمت‌ها، قیمت مرجعِ Gains Network است نه یک خوراکِ مستقلِ شاخص. فهرستِ در دسترس و وضعیت هر بازار می‌تواند تغییر کند، پس در ترمینال بررسی کن.",
    "بازارها از مشخصات Gains Network می‌آیند و در دسته‌های رمزارز، فارکس، سهام، شاخص و کالا گروه‌بندی می‌شوند — حدود ۴۸۸ نماد. قیمت‌ها، قیمت ترکیبی Open Oracle است: بازارهای رمزارز از Gains، Hyperliquid و GMX تجمیع می‌شوند و سایر بازارها از Gains. فهرستِ در دسترس و وضعیت هر بازار می‌تواند تغییر کند، پس در ترمینال بررسی کن."
  ],
  [
    "بافتِ اوپن‌فاند: دمو یک حسابِ شبیه‌سازی‌شدهٔ سمت سرور است — ۱۰۰٬۰۰۰ دای مجازی یک‌بار برای هر کاربر، بدون واریز، برداشت، شارژ یا بازنشانی، با قیمت‌گذاری از مارک پرایس زندهٔ Gains Network. سودِ دمو طلبِ مالی نیست و معاملهٔ دمو واجدِ شرایط شدن برای حساب فاندشده را اثبات نمی‌کند. سقف‌های ضرری که اینجا آمده، شرایط منتشرشده و مرجع است و در این نسخه اجرا نمی‌شود.",
    "بافتِ اوپن‌فاند: دمو یک حسابِ شبیه‌سازی‌شدهٔ سمت سرور است — ۱۰۰٬۰۰۰ دای مجازی یک‌بار برای هر کاربر، بدون واریز، برداشت، شارژ یا بازنشانی، با قیمت‌گذاری از قیمت زندهٔ Open Oracle. سودِ دمو طلبِ مالی نیست و معاملهٔ دمو واجدِ شرایط شدن برای حساب فاندشده را اثبات نمی‌کند. سقف‌های ضرری که اینجا آمده، شرایط منتشرشده و مرجع است و در این نسخه اجرا نمی‌شود."
  ],
  [
    "برنامه مشخصات بازار و قیمت مرجع را از Gains Network می‌خواند. ابزارها به رمزارز، فارکس، سهام، شاخص و کالا دسته‌بندی می‌شوند — فهرست کامل را در صفحهٔ «بازارها» ببین. فهرست در دسترس و وضعیت هر بازار می‌تواند تغییر کند.",
    "برنامه مشخصات بازار را از Gains Network و قیمت مرجع را از Open Oracle، سامانهٔ تجمیع قیمت اوپن‌فاند از Gains، Hyperliquid و GMX، می‌خواند. ابزارها به رمزارز، فارکس، سهام، شاخص و کالا دسته‌بندی می‌شوند — فهرست کامل را در صفحهٔ «بازارها» ببین. فهرست در دسترس و وضعیت هر بازار می‌تواند تغییر کند."
  ],
  [
    "ترمینال، موتور نمودار Vela محصول LuxAlgo را با دادهٔ بازار Gains Network جفت کرده است. هر دو محصول — چلنجی و دائمی — روی همین یک رابط اجرا می‌شوند، پس نمودار و بازارها را در یک جا می‌بینی.",
    "ترمینال، موتور نمودار Vela محصول LuxAlgo را با قیمت زندهٔ Open Oracle و دادهٔ بازار Gains Network جفت کرده است. هر دو محصول — چلنجی و دائمی — روی همین یک رابط اجرا می‌شوند، پس نمودار و بازارها را در یک جا می‌بینی."
  ],
  [
    "دامنه مهم است. در این نسخه معاملهٔ perpetual فقط‌خواندنی است و اجرای آن‌چین فعال نیست، پس سیستمِ خودکار اینجا یعنی تحلیل، پایش و backtest روی سوابق — نه سفارشِ زنده. محیطِ معاملهٔ پراپ یک دموی شبیه‌سازی‌شدهٔ سروری است که یک‌بار با ۱۰۰٬۰۰۰ دای مجازی تأمین و از مارک پرایسِ زندهٔ Gains Network قیمت‌گذاری می‌شود، و فعال‌سازیِ خرید، حساب فاندشده و برداشت فعال نیستند. هر backtestی را تمرین بدان، و تحلیل‌گرِ ژورنالِ CSV و داشبوردِ پرتفوی — تغذیه‌شده از سوابقِ حساب — را ابزارِ سنجشِ فرآیند بخوان، نه مدرکِ نتیجه‌ها.",
    "دامنه مهم است. در این نسخه معاملهٔ perpetual فقط‌خواندنی است و اجرای آن‌چین فعال نیست، پس سیستمِ خودکار اینجا یعنی تحلیل، پایش و backtest روی سوابق — نه سفارشِ زنده. محیطِ معاملهٔ پراپ یک دموی شبیه‌سازی‌شدهٔ سروری است که یک‌بار با ۱۰۰٬۰۰۰ دای مجازی تأمین و از قیمت زندهٔ Open Oracle قیمت‌گذاری می‌شود، و فعال‌سازیِ خرید، حساب فاندشده و برداشت فعال نیستند. هر backtestی را تمرین بدان، و تحلیل‌گرِ ژورنالِ CSV و داشبوردِ پرتفوی — تغذیه‌شده از سوابقِ حساب — را ابزارِ سنجشِ فرآیند بخوان، نه مدرکِ نتیجه‌ها."
  ],
  [
    "در اوپن‌فاند قیمت‌هایی که می‌بینید، مارک پرایس‌های Gains Network‌اند که از استقرار عمومی Gains روی Arbitrum One خوانده و روی نمودار Vela (LuxAlgo) رسم می‌شوند. اوپن‌فاند این مارک‌ها را همان‌طور که فید منتشر می‌کند گزارش می‌دهد و مارک مستقلِ خودش را نمی‌سازد.",
    "در اوپن‌فاند قیمت‌هایی که می‌بینید، قیمت‌های Open Oracle‌اند: قیمت ترکیبی اختصاصی اوپن‌فاند از Gains، Hyperliquid و GMX که روی نمودار Vela (LuxAlgo) رسم می‌شود. وقتی منابع با هم اختلاف دارند، اوپن‌فاند قیمت را علامت‌گذاری می‌کند و قیمت گمراه‌کننده منتشر نمی‌کند."
  ],
  [
    "در اوپن‌فاند، «معاملات حرفه‌ای» یک دموی شبیه‌سازی‌شدهٔ سمت سرور است: وجه تضمین و بسته‌شدن‌های اجباری درون همان شبیه‌سازی و با مارک پرایس زندهٔ Gains Network مدیریت می‌شوند، و هیچ نتیجهٔ دموی حقِ مالکیت سرمایه ایجاد نمی‌کند. بخش «معاملات آنی» امروز خواندنی است — اجرای آن‌چینی فعال نیست — پس جای بررسیِ قیمت است، نه آزمودنِ حالت‌های وجه تضمین.",
    "در اوپن‌فاند، «معاملات حرفه‌ای» یک دموی شبیه‌سازی‌شدهٔ سمت سرور است: وجه تضمین و بسته‌شدن‌های اجباری درون همان شبیه‌سازی و با قیمت زندهٔ Open Oracle مدیریت می‌شوند، و هیچ نتیجهٔ دموی حقِ مالکیت سرمایه ایجاد نمی‌کند. بخش «معاملات آنی» امروز خواندنی است — اجرای آن‌چینی فعال نیست — پس جای بررسیِ قیمت است، نه آزمودنِ حالت‌های وجه تضمین."
  ],
  [
    "دموی اوپن‌فاند یک حساب شبیه‌سازی‌شدهٔ سمت سرور است: برای هر کاربر یکی، با ۱۰۰٬۰۰۰ دای مجازی که یک‌بار تخصیص می‌یابد، قیمت‌گذاری‌شده با مارک پرایس زندهٔ Gains Network، بدون واریز، برداشت، شارژ یا بازنشانی — و سود دمو طلبِ مالی هیچ‌کس نیست. پلن‌های چلنج اهرم مرجع ۵× را منتشر می‌کنند، اما سقف واقعیِ هر بازار از فید می‌آید؛ پس به‌جای فرض کردنِ سقفی، آن را در ترمینال بخوانید.",
    "دموی اوپن‌فاند یک حساب شبیه‌سازی‌شدهٔ سمت سرور است: برای هر کاربر یکی، با ۱۰۰٬۰۰۰ دای مجازی که یک‌بار تخصیص می‌یابد، قیمت‌گذاری‌شده با قیمت زندهٔ Open Oracle، بدون واریز، برداشت، شارژ یا بازنشانی — و سود دمو طلبِ مالی هیچ‌کس نیست. پلن‌های چلنج اهرم مرجع ۵× را منتشر می‌کنند، اما سقف واقعیِ هر بازار از فید می‌آید؛ پس به‌جای فرض کردنِ سقفی، آن را در ترمینال بخوانید."
  ],
  [
    "دموی شبیه‌سازی‌شده تنها محیطِ معاملاتیِ فعالِ امروز است: یک حساب free_demo برای هر کاربر، ۱۰۰٬۰۰۰ دای مجازی که یک‌بار تخصیص می‌یابد، قیمت‌گذاری از مارک پرایسِ زندهٔ Gains Network، بدون واریز، برداشت، شارژِ مجدد یا بازنشانی. فعالیتِ دمو حقِ سرمایه، سهمِ پاداش یا برداشت ایجاد نمی‌کند و قبولی در معاملهٔ دمو واجدِ شرایط شدن برای حساب فاندشده را اثبات نمی‌کند. قواعدِ معاملهٔ خبری و آخرِ هفته برای مرحلهٔ فاندشده، طرحِ scaling و فرایندِ بازنشانی و اعتراض نهایی نشده‌اند؛ شرایطِ دقیقِ مرحلهٔ فاندشده تابعِ قراردادِ نهاییِ نسخه‌داری است که پیش از عرضه منتشر می‌شود.",
    "دموی شبیه‌سازی‌شده تنها محیطِ معاملاتیِ فعالِ امروز است: یک حساب free_demo برای هر کاربر، ۱۰۰٬۰۰۰ دای مجازی که یک‌بار تخصیص می‌یابد، قیمت‌گذاری از قیمت زندهٔ Open Oracle، بدون واریز، برداشت، شارژِ مجدد یا بازنشانی. فعالیتِ دمو حقِ سرمایه، سهمِ پاداش یا برداشت ایجاد نمی‌کند و قبولی در معاملهٔ دمو واجدِ شرایط شدن برای حساب فاندشده را اثبات نمی‌کند. قواعدِ معاملهٔ خبری و آخرِ هفته برای مرحلهٔ فاندشده، طرحِ scaling و فرایندِ بازنشانی و اعتراض نهایی نشده‌اند؛ شرایطِ دقیقِ مرحلهٔ فاندشده تابعِ قراردادِ نهاییِ نسخه‌داری است که پیش از عرضه منتشر می‌شود."
  ],
  [
    "دموی شبیه‌سازی‌شده شرط را پایین می‌آورد ولی الگو را نه: روی ۱۰۰٬۰۰۰ دای مجازی با مارک پرایسِ زندهٔ Gains Network اجرا می‌شود، پس رگبارِ ضرر چیزی قابلِ برداشت از تو نمی‌گیرد، اما همچنان نشان می‌دهد زیرِ آن حس چگونه رفتار می‌کنی — و تنها موضوعِ همین درس است. هیچ‌چیز اینجا توصیهٔ سرمایه‌گذاری نیست، و آرام ماندن یا ژورنال کردنِ یک ضرر نه راهِ سود است و نه راهِ حساب فاندشده.",
    "دموی شبیه‌سازی‌شده شرط را پایین می‌آورد ولی الگو را نه: روی ۱۰۰٬۰۰۰ دای مجازی با قیمت زندهٔ Open Oracle اجرا می‌شود، پس رگبارِ ضرر چیزی قابلِ برداشت از تو نمی‌گیرد، اما همچنان نشان می‌دهد زیرِ آن حس چگونه رفتار می‌کنی — و تنها موضوعِ همین درس است. هیچ‌چیز اینجا توصیهٔ سرمایه‌گذاری نیست، و آرام ماندن یا ژورنال کردنِ یک ضرر نه راهِ سود است و نه راهِ حساب فاندشده."
  ],
  [
    "فیدِ Gains Network که امروز اوپن‌فاند از آن می‌خواند، نه اوپن اینترست دارد، نه عمق دفتر سفارش و نه نوار معاملات؛ پس اوپن‌فاند به‌جای تخمین یا ساختن، این‌ها را «در دسترس نیست» نشان می‌دهد. برای سنجش اسلیپیج یا خواندن عمق، مستقیم به همان صرافی مراجعه کنید. نمای «معاملات آنی» اوپن‌فاند خواندنی است و «معاملات حرفه‌ای» یک دموی شبیه‌سازی‌شده است که با مارک پرایس زندهٔ Gains قیمت‌گذاری می‌شود.",
    "فیدِ Gains Network که امروز اوپن‌فاند از آن می‌خواند، نه اوپن اینترست دارد، نه عمق دفتر سفارش و نه نوار معاملات؛ پس اوپن‌فاند به‌جای تخمین یا ساختن، این‌ها را «در دسترس نیست» نشان می‌دهد. برای سنجش اسلیپیج یا خواندن عمق، مستقیم به همان صرافی مراجعه کنید. نمای «معاملات آنی» اوپن‌فاند خواندنی است و «معاملات حرفه‌ای» یک دموی شبیه‌سازی‌شده است که با قیمت زندهٔ Open Oracle قیمت‌گذاری می‌شود."
  ],
  [
    "قیمت Mark و مشخصات بازار مربوط به منبع دادهٔ Gains Network است؛ اهرم و شرایط حساب‌های اوپن‌فاند مستقل است. تنها فیلدهای موجود در منبع نمایش داده می‌شود.",
    "قیمت‌ها حاصل تجمیع Open Oracle از Gains، Hyperliquid و GMX است: بازارهای رمزارز تا سه منبع و سایر بازارها یک منبع دارند. مشخصات بازار از Gains Network می‌آید؛ اهرم و شرایط حساب‌های اوپن‌فاند مستقل است. تنها فیلدهای موجود در منابع نمایش داده می‌شود."
  ],
  [
    "قیمت‌ها از Gains Network می‌آیند: رمزارز، فارکس، سهام، شاخص و کالا.",
    "قیمت‌ها از Open Oracle، سامانهٔ تجمیع قیمت اختصاصی ما از Gains، Hyperliquid و GMX، می‌آیند: رمزارز، فارکس، سهام، شاخص و کالا."
  ],
  [
    "قیمت‌ها، قیمت مرجعِ زندهٔ Gains Network است. منبع داده، عمق دفتر سفارش، بهرهٔ باز و نوار معاملات را فراهم نمی‌کند و ترمینال این‌ها را «در دسترس نیست» نشان می‌دهد و برایشان مقدارِ ساختگی نمی‌سازد.",
    "قیمت‌ها، قیمت ترکیبی زندهٔ Open Oracle از Gains، Hyperliquid و GMX است. منابع قیمت، عمق دفتر سفارش، بهرهٔ باز و نوار معاملات را فراهم نمی‌کند و ترمینال این‌ها را «در دسترس نیست» نشان می‌دهد و برایشان مقدارِ ساختگی نمی‌سازد."
  ],
  [
    "قیمت‌ها، کندل‌ها و مشخصات بازار از Gains Network، یک پروتکل غیرمتمرکز معاملات اهرمی، می‌آیند. اوپن‌فاند این داده را می‌خواند؛ روی Gains معامله اجرا نمی‌کند.",
    "کندل‌ها و مشخصات بازار از Gains Network، یک پروتکل غیرمتمرکز معاملات اهرمی، می‌آیند که یکی از سه منبع قیمت Open Oracle هم هست. اوپن‌فاند این داده را می‌خواند؛ روی Gains معامله اجرا نمی‌کند."
  ],
  [
    "همهٔ بازارهای اوپن‌فاند را با قیمت زندهٔ Gains Network ببینید: رمزارز، فارکس، سهام، شاخص و کالا.",
    "همهٔ بازارهای اوپن‌فاند را با قیمت زندهٔ Open Oracle، سامانهٔ تجمیع قیمت اختصاصی اوپن‌فاند، ببینید: رمزارز، فارکس، سهام، شاخص و کالا."
  ],
  [
    "همهٔ کلاس‌های دارایی که اکوسیستم معاملاتی اوپن‌فاند پوشش می‌دهد، با قیمت Mark مستقیم از Gains Network. بازار را انتخاب کن و مستقیم به ترمینال ببر.",
    "همهٔ کلاس‌های دارایی که اکوسیستم معاملاتی اوپن‌فاند پوشش می‌دهد، با قیمت زندهٔ Open Oracle؛ سامانهٔ اختصاصی ما برای تجمیع قیمت از Gains، Hyperliquid و GMX. بازار را انتخاب کن و مستقیم به ترمینال ببر."
  ],
  [
    "وضعیت اوپن‌فاند: فعال‌سازیِ خرید، حساب فاندشده و برداشت در این نسخه فعال نیست و پیش از عرضه، قراردادِ نهاییِ نسخه‌دار منتشر خواهد شد. آنچه امروز کار می‌کند یک حسابِ شبیه‌سازی‌شدهٔ free_demo در سمت سرور است، به ازای هر کاربر یکی، یک‌بار با ۱۰۰٬۰۰۰ دای مجازی تأمین شده و از مارک پرایسِ زندهٔ Gains Network قیمت‌گذاری می‌شود؛ بدون واریز، برداشت، شارژِ مجدد یا بازنشانی. سودِ دمو پولی نیست که به معامله‌گر بدهکار باشند، و معاملهٔ دمو واجدِ شرایط شدن برای حساب فاندشده را اثبات نمی‌کند. هر عددی در این مسیر، شرطِ منتشرشده و مرجع است.",
    "وضعیت اوپن‌فاند: فعال‌سازیِ خرید، حساب فاندشده و برداشت در این نسخه فعال نیست و پیش از عرضه، قراردادِ نهاییِ نسخه‌دار منتشر خواهد شد. آنچه امروز کار می‌کند یک حسابِ شبیه‌سازی‌شدهٔ free_demo در سمت سرور است، به ازای هر کاربر یکی، یک‌بار با ۱۰۰٬۰۰۰ دای مجازی تأمین شده و از قیمت زندهٔ Open Oracle قیمت‌گذاری می‌شود؛ بدون واریز، برداشت، شارژِ مجدد یا بازنشانی. سودِ دمو پولی نیست که به معامله‌گر بدهکار باشند، و معاملهٔ دمو واجدِ شرایط شدن برای حساب فاندشده را اثبات نمی‌کند. هر عددی در این مسیر، شرطِ منتشرشده و مرجع است."
  ],
  [
    "پلتفرم معاملاتی اختصاصی با دادهٔ زندهٔ بازار از Gains Network؛ رمزارز، فارکس، سهام، شاخص و کالا.",
    "پلتفرم معاملاتی اختصاصی با قیمت زندهٔ Open Oracle؛ رمزارز، فارکس، سهام، شاخص و کالا."
  ]
])

/** Replaces retired default strings anywhere in a CMS response (exact matches only). */
export function supersedeRetired<T>(value: T): T {
  if (typeof value === 'string') return (RETIRED_COPY.get(value) ?? value) as T
  if (Array.isArray(value)) return value.map(supersedeRetired) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = supersedeRetired(v)
    return out as T
  }
  return value
}
