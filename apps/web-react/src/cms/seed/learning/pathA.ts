import { text } from '../../../features/information/content'
import type { LearningPathContent } from '../../contentTypes'

/** Learning Center — Path A: Perpetual futures mechanics.
 *  Repo authoring source for the foundation path. This is educational content
 *  only: it explains general market mechanics and never gives trading advice
 *  or promises profit. Openfund-specific facts stay within the verified set —
 *  the terminal renders a Vela (LuxAlgo) chart and reads mark prices from the
 *  public Gains Network deployment on Arbitrum One; Perpetual Trading is
 *  read-only today, and that feed carries no order-book depth, open interest
 *  or trade tape. NOT imported by the app at runtime. */
export const pathA: LearningPathContent = {
  key: 'perps',
  slug: 'perpetual-futures-mechanics',
  sort: 1,
  level: 'foundation',
  eyebrow: text('Path A · Perps', 'مسیر A · معاملات آنی'),
  title: text('Perpetual futures mechanics', 'مکانیک معاملات آنی (پرپچوآل)'),
  summary: text(
    'How perpetual futures actually work: margin and leverage, the funding rate, mark price versus index price, order types, and the fees and frictions that quietly shape every position.',
    'معاملات آنی دقیقاً چگونه کار می‌کنند: وجه تضمین و اهرم، نرخ فاندینگ، مارک پرایس در برابر ایندکس پرایس، انواع سفارش و هزینه و اصطکاک‌هایی که بی‌صدا هر موقعیت را شکل می‌دهند.'
  ),
  outcomes: [
    text('you can explain why a perpetual has no expiry and how funding keeps it anchored near spot', 'می‌توانی توضیح دهی چرا پرپچوآل سررسید ندارد و فاندینگ چگونه آن را نزدیک قیمت نقدی نگه می‌دارد'),
    text('you can work out a funding payment and read what the rate’s sign says about positioning', 'می‌توانی مبلغ فاندینگ را حساب کنی و بگویی علامتِ نرخ دربارهٔ جهت موقعیت‌ها چه می‌گوید'),
    text('you can tell mark price from index price and explain which one drives liquidation', 'می‌توانی مارک پرایس را از ایندکس پرایس تشخیص دهی و بگویی لیکوئیدیشن تابع کدام است'),
    text('you can account for fees, slippage and open interest when you size a position', 'می‌توانی در تعیین اندازهٔ موقعیت، کارمزد، اسلیپیج و اوپن اینترست را هم لحاظ کنی'),
  ],
  lessons: [
    {
      slug: 'perps-how-they-work',
      path: 'perpetual-futures-mechanics',
      sort: 1,
      minutes: 9,
      status: 'published',
      title: text('Perpetual futures: how they work', 'معاملات آنی چگونه کار می‌کند'),
      summary: text(
        'What a perpetual future is, why it never expires, and how margin, leverage and funding make it track the price of the underlying.',
        'پرپچوآل چیست، چرا هرگز سررسید نمی‌شود و وجه تضمین، اهرم و فاندینگ چگونه آن را به قیمت دارایی پایه نزدیک نگه می‌دارند.'
      ),
      takeaways: [
        text('A perpetual is a leveraged contract on price with no delivery date', 'پرپچوآل قرارداد اهرم‌دار روی قیمت است، بدون تاریخ تحویل'),
        text('Margin is the collateral you post; leverage is the exposure it buys', 'وجه تضمین وثیقه‌ای است که می‌گذاری و اهرم، اندازهٔ مواجهه‌ای است که می‌خرد'),
        text('Long and short are symmetric: you can take either side', 'خرید و فروش متقارن‌اند: می‌توانی هر دو سمت را بگیری'),
        text('Funding, not expiry, is what keeps the contract near spot', 'این فاندینگ است، نه سررسید، که قرارداد را نزدیک قیمت نقدی نگه می‌دارد'),
      ],
      glossary: ['perpetual-future', 'leverage', 'margin'],
      tools: ['leverage-margin', 'position-size'],
      blocks: [
        {
          type: 'p',
          text: text(
            'A perpetual future is a contract between two traders that settles against the price of an underlying asset — crypto, an index, a commodity — without ever fixing a date to deliver it. You do not own the asset; you hold a position whose value rises when the price moves in your favour and falls when it moves against you.',
            'معاملهٔ آنی یا پرپچوآل، قراردادی دوطرفه بین دو معامله‌گر است که نسبت به قیمت یک دارایی پایه — رمزارز، شاخص یا کالا — تسویه می‌شود، بی آن‌که هرگز تاریخ تحویل داشته باشد. شما خودِ دارایی را ندارید؛ فقط موقعیتی دارید که با حرکت قیمت به سودش ارزش می‌گیرد و با حرکت به ضدش، ارزشش کم می‌شود.'
          )
        },
        { type: 'h2', text: text('A future without a delivery date', 'قرارداد آتیِ بی‌تاریخ تحویل') },
        {
          type: 'p',
          text: text(
            'A classic futures contract expires: on a set day it converges to the spot price and closes. A perpetual drops that date, so it could drift away from reality at any moment. To stop this, the venue runs a payment between longs and shorts — the funding rate — that rewards whichever side is helping pull the contract price back toward the market.',
            'قرارداد آتیِ کلاسیک سررسید دارد: در روز مشخصی به قیمت نقدی همگرا و بسته می‌شود. پرپچوآل این تاریخ را حذف می‌کند، پس هر لحظه ممکن است از واقعیت فاصله بگیرد. برای جلوگیری از این، صرافی پرداختی میان خریداران و فروشندگان برقرار می‌کند — همان نرخ فاندینگ — که به سمتی پاداش می‌دهد که قرارداد را به بازار نزدیک می‌کند.'
          )
        },
        {
          type: 'ul',
          items: [
            text('No expiry: you can hold the position as long as you post enough margin.', 'بدون سررسید: تا وقتی وجه تضمین کافی بگذارید، می‌توانید موقعیت را نگه دارید.'),
            text('Two sides: a long profits from a rise, a short from a fall.', 'دو سمت: موقعیت خرید از رشد سود می‌برد و موقعیت فروش از افت.'),
            text('Collateralised: every position is backed by margin held against it.', 'وثیقه‌محور: پشت هر موقعیت، وجه تضمینی نگه‌داشته می‌شود.'),
            text('Marked to market: gains and losses are recomputed on the live price.', 'بهاگذاری به بازار: سود و زیان با قیمت زنده دوباره محاسبه می‌شود.'),
          ]
        },
        { type: 'h2', text: text('Margin and leverage', 'وجه تضمین و اهرم') },
        { type: 'formula', expr: 'leverage = notional / margin', text: text('Your exposure (notional) equals the margin you post multiplied by the leverage you choose.', 'مواجهه یا ارزش اسمی، برابر است با وجه تضمینی که می‌گذارید ضرب‌در اهرمی که برمی‌گزینید.') },
        {
          type: 'p',
          text: text(
            'Leverage lets a small deposit control a large position. If you put up margin to hold a notional many times bigger, every one-percent move in price becomes a much bigger percentage move in your equity. That cuts both ways: leverage amplifies gains and losses by exactly the same factor, and it brings the liquidation threshold closer.',
            'اهرم امکان می‌دهد با سپردهٔ کوچک، موقعیت بزرگی را کنترل کنید. اگر وجه تضمینی بگذارید تا ارزش اسمی چندبرابر آن را در دست بگیرید، هر حرکت یک‌درصدیِ قیمت به تغییر درصدیِ بسیار بزرگ‌تر در ارزش خالص شما تبدیل می‌شود. این تیغ دو لبه است: اهرم سود و زیان را دقیقاً به یک نسبت بزرگ می‌کند و آستانهٔ لیکوئید شدن را هم نزدیک‌تر می‌سازد.'
          )
        },
        {
          type: 'terms',
          items: [
            { term: text('Notional value', 'ارزش اسمی'), text: text('The full size of the position in market value, not just the money you put in.', 'اندازهٔ کامل موقعیت به ارزش بازاری، نه فقط پولی که وارد کرده‌اید.') },
            { term: text('Isolated margin', 'وجه تضمین مجزا'), text: text('Collateral ring-fenced to one position, so its loss cannot drain the rest.', 'وثیقه‌ای که به یک موقعیت محدود شده و ضررش باقی حساب را تخلیه نمی‌کند.') },
            { term: text('Cross margin', 'وجه تضمین متقاطع'), text: text('Collateral shared across positions, which cushions each one but links their risk.', 'وثیقه‌ای مشترک میان موقعیت‌ها؛ از هر کدام محافظت می‌کند ولی ریسکشان را به هم گره می‌زند.') },
          ]
        },
        { type: 'h2', text: text('Who pays whom, and why price tracks spot', 'چه کسی به چه می‌پردازد و چرا قیمت به نقدی می‌چسبد') },
        {
          type: 'p',
          text: text(
            'Because there is no expiry to force convergence, a perpetual relies on funding. When the contract trades above the reference price, most traders are long, and longs pay shorts; when it trades below, shorts pay longs. That payment is a cost of holding the popular side, so it nudges positioning and price back toward the underlying.',
            'چون سررسیدی برای اجبارِ همگرایی وجود ندارد، پرپچوآل به فاندینگ تکیه می‌کند. وقتی قرارداد بالاتر از قیمت مرجع معامله می‌شود، بیشترِ معامله‌گران خریدارند و خریداران به فروشندگان می‌پردازند؛ وقتی پایین‌تر باشد، فروشندگان به خریداران می‌پردازند. این پرداخت، هزینهٔ نگه‌داشتنِ سمتِ پرطرفدارِ بازار است و همین موقعیت و قیمت را به سوی دارایی پایه بازمی‌گرداند.'
          )
        },
        {
          type: 'note',
          text: text(
            'This lesson describes how perpetual venues work in general. In Openfund, Perpetual Trading is currently read-only market and account information — on-chain order execution is not enabled — and the prices shown are Gains Network mark prices consumed from the public deployment on Arbitrum One, rendered on a Vela (LuxAlgo) chart.',
            'این درس مکانیک عمومی صرافی‌های پرپچوآل را توضیح می‌دهد. در اوپن‌فاند، بخش «معاملات آنی» فعلاً فقط دادهٔ خواندنیِ بازار و حساب است — اجرای آن‌چینیِ سفارش فعال نیست — و قیمت‌های نمایش‌داده‌شده، مارک پرایس‌های Gains Network هستند که از استقرار عمومی آن روی Arbitrum One خوانده و روی نمودار Vela (LuxAlgo) رسم می‌شوند.'
          )
        },
        {
          type: 'p',
          text: text(
            'Treat leverage as an exposure dial, not a return dial. Sizing, margin mode and how close you run to the liquidation price decide whether a normal pullback is survivable. The next lessons take these levers one at a time.',
            'اهرم را دستهٔ کنترلِ مواجهه بدانید، نه دستهٔ بازده. اندازهٔ موقعیت، حالت وجه تضمین و فاصله‌تان از قیمت لیکوئیدیشن تعیین می‌کند که یک اصلاحِ عادی قابل تحمل است یا نه. درس‌های بعدی این اهرم‌ها را یکی‌یکی باز می‌کنند.'
          )
        },
      ]
    },
    {
      slug: 'funding-rate-explained',
      path: 'perpetual-futures-mechanics',
      sort: 2,
      minutes: 8,
      status: 'published',
      title: text('Funding rate, explained', 'نرخ فاندینگ، ساده و دقیق'),
      summary: text(
        'What the funding rate is, who pays it, how to turn a per-interval rate into a payment and an annual figure, and what its sign reveals about positioning.',
        'نرخ فاندینگ چیست، چه کسی آن را می‌پردازد، چگونه نرخِ هر بازه به مبلغ پرداخت و رقم سالانه تبدیل می‌شود و علامتش دربارهٔ موقعیت‌ها چه فاش می‌کند.'
      ),
      takeaways: [
        text('Funding is a payment between traders, not a fee charged by the venue', 'فاندینگ پرداخت میان معامله‌گران است، نه کارمزدی که صرافی می‌گیرد'),
        text('You pay or receive on the notional you hold, at each funding interval', 'در هر بازه، روی ارزش اسمیِ نگه‌داشته‌ات می‌پردازی یا دریافت می‌کنی'),
        text('A positive rate means longs pay shorts; a negative rate reverses it', 'نرخ مثبت یعنی خریداران به فروشندگان می‌پردازند؛ منفی آن را برعکس می‌کند'),
        text('The annual figure multiplies the per-interval rate by how often it settles', 'رقم سالانه، نرخ هر بازه را در دفعات تسویه در سال ضرب می‌کند'),
      ],
      glossary: ['funding-rate', 'basis', 'mark-price'],
      tools: ['funding-rate', 'perp-pnl'],
      blocks: [
        {
          type: 'p',
          text: text(
            'The funding rate is the mechanism that keeps a perpetual honest. It is not a fee the exchange takes for itself; it is money handed directly between traders who hold opposite sides, exchanged on a fixed schedule. Its job is simple: make it expensive to crowd onto whichever side is already pushing the contract away from the underlying price.',
            'نرخ فاندینگ سازوکاری است که پرپچوآل را در مسیر درست نگه می‌دارد. این مبلغ، کارمزدی نیست که صرافی برای خودش بردارد؛ پولی است که مستقیم میان معامله‌گرانی با سمت مخالف جابه‌جا می‌شود، در بازهٔ زمانی مشخص. کارش ساده است: هجوم به سمتی که قرارداد را از قیمت دارایی پایه دور کرده، هزینه‌دار کند.'
          )
        },
        { type: 'h2', text: text('The payment', 'مبلغ پرداخت') },
        { type: 'formula', expr: 'funding payment = position notional x funding rate', text: text('Each interval you pay or receive the rate applied to your notional, independent of whether the position is in profit.', 'در هر بازه، نرخ را روی ارزش اسمی‌ات می‌پردازی یا می‌گیری، مستقل از اینکه موقعیت در سود باشد یا زیان.') },
        {
          type: 'p',
          text: text(
            'Notice what this does not depend on: price direction, entry level, or whether you are winning or losing. Funding is charged on size and time. A large notional held across many intervals costs more than the same idea in a smaller position, even if the market never moves.',
            'دقت کنید این مبلغ به چه چیزی وابسته نیست: جهت قیمت، سطح ورود، یا سودده و زیان‌ده بودن شما. فاندینگ بر اساس اندازه و زمان گرفته می‌شود. ارزش اسمی بزرگ که در چند بازه نگه داشته شود، از همان ایده با موقعیت کوچک‌تر گران‌تر تمام می‌شود، حتی اگر اصلاً تکان نخورد.'
          )
        },
        {
          type: 'terms',
          items: [
            { term: text('Funding interval', 'بازهٔ فاندینگ'), text: text('How often the payment settles — commonly every few hours, set by the venue.', 'دفعات تسویهٔ پرداخت؛ معمولاً هر چند ساعت، به‌صورت مشخص از سوی صرافی تعیین می‌شود.') },
            { term: text('Predicted rate', 'نرخ پیش‌بینی‌شده'), text: text('A live estimate for the current interval before the settlement payment is fixed.', 'تقریب زنده برای بازهٔ جاری، پیش از قطعی‌شدن مبلغ تسویه.') },
            { term: text('Settled rate', 'نرخ تسویه‌شده'), text: text('The final value applied at the interval boundary; your payment uses this one.', 'مقدار نهایی که در مرز بازه اعمال می‌شود؛ پرداخت شما بر همین مبناست.') },
          ]
        },
        { type: 'h2', text: text('Reading the sign', 'خواندنِ علامت') },
        {
          type: 'ol',
          items: [
            text('Positive rate: the contract trades above reference, longs pay shorts, positioning is skewed long.', 'نرخ مثبت: قرارداد بالاتر از قیمت مرجع است، خریداران به فروشندگان می‌پردازند و ترازِ سمت خرید است.'),
            text('Negative rate: the contract trades below reference, shorts pay longs, positioning is skewed short.', 'نرخ منفی: قرارداد پایین‌تر از مرجع است، فروشندگان به خریداران می‌پردازند و ترازِ سمت فروش است.'),
            text('Near zero: the two sides balance and the contract sits close to spot.', 'نزدیک صفر: دو سمت متوازن‌اند و قرارداد چسبیده به قیمت نقدی است.'),
          ]
        },
        { type: 'formula', expr: 'annualised funding = funding rate x intervals per day x 365', text: text('To compare costs across venues, scale the per-interval rate to a yearly figure using how many intervals fit in a day.', 'برای مقایسهٔ هزینه میان صرافی‌ها، نرخ هر بازه را با تعداد بازه در روز به رقم سالانه ببرید.') },
        {
          type: 'p',
          text: text(
            'For example, assume a settled rate of 0.01% per interval with three intervals a day. On a 10,000 notional that is 1 per interval, and the annualised figure is 0.01% x 3 x 365, about 10.95%. Change the rate or the interval count and the whole number moves — these are hypothetical inputs, and the real values come from the market feed, not from this page.',
            'مثلاً فرض کنید نرخ تسویه‌شده ۰٫۰۱٪ در هر بازه باشد و روزی سه بازه داشته باشیم. روی ارزش اسمی ۱۰٬۰۰۰ یعنی هر بازه ۱ واحد؛ رقم سالانه هم ۰٫۰۱٪ ضرب‌در ۳ ضرب‌در ۳۶۵، یعنی حدود ۱۰٫۹۵٪ می‌شود. اگر نرخ یا تعداد بازه را عوض کنید، همهٔ عدد جابه‌جا می‌شود — این‌ها ورودی‌های فرضی‌اند و مقادیر واقعی از فید بازار می‌آید، نه از این صفحه.'
          )
        },
        {
          type: 'table',
          caption: text('Annualising a per-interval rate (hypothetical)', 'سالانه‌سازی نرخ هر بازه (فرضی)'),
          head: [text('Rate per interval', 'نرخ هر بازه'), text('Intervals per day', 'بازه در روز'), text('Annualised (approx.)', 'سالانه (تقریبی)')],
          rows: [
            [text('0.01%', '۰٫۰۱٪'), text('3', '۳'), text('~10.95%', 'حدود ۱۰٫۹۵٪')],
            [text('0.03%', '۰٫۰۳٪'), text('3', '۳'), text('~32.85%', 'حدود ۳۲٫۸۵٪')],
            [text('-0.01%', '−۰٫۰۱٪'), text('3', '۳'), text('~ -10.95% (receiver)', 'حدود ‎−۱۰٫۹۵٪ (دریافت‌کننده)')],
          ]
        },
        {
          type: 'note',
          text: text(
            'Openfund’s current simulated model does not charge or credit funding, and the demo does not borrow, fund or settle it — so a demo PnL is not proof of how funding would affect a live position. Perpetual Trading in Openfund is read-only and does not place or settle orders.',
            'مدل شبیه‌سازی‌شدهٔ فعلی اوپن‌فاند فاندینگ نمی‌گیرد و نمی‌دهد، و دمو آن را استقراض، تأمین یا تسویه نمی‌کند — پس سود و زیان دمو دلیلِ اثر فاندینگ بر موقعیت واقعی نیست. بخش «معاملات آنی» در اوپن‌فاند صرفاً خواندنی است و سفارشی ثبت یا تسویه نمی‌کند.'
          )
        },
        {
          type: 'p',
          text: text(
            'Read funding as a thermometer, not a forecast. A stretched positive rate tells you the crowd is long and paying to stay so; it says nothing about which way price goes next. The cost it adds to a position, however, is real arithmetic you can plan around.',
            'فاندینگ را مثل دماسنج بخوانید، نه پیش‌بینی. نرخ مثبتِ کشیده می‌گوید جمعیت خریدار است و برای ماندن می‌پردازد؛ اما نمی‌گوید قیمت به کدام سمت می‌رود. با این حال، هزینه‌ای که به موقعیت اضافه می‌کند حسابِ واقعی و قابل برنامه‌ریزی است.'
          )
        },
      ]
    },
    {
      slug: 'mark-price-vs-index-price',
      path: 'perpetual-futures-mechanics',
      sort: 3,
      minutes: 7,
      status: 'published',
      title: text('Mark price vs index price', 'مارک پرایس در برابر ایندکس پرایس'),
      summary: text(
        'Two different numbers sit behind every position: the tradable contract price and the smoothed reference. This lesson separates them and shows which one triggers liquidation.',
        'پشت هر موقعیت دو عدد متفاوت هست: قیمتِ قابل‌معاملهٔ قرارداد و قیمت مرجعِ هموارشده. این درس آن دو را از هم جدا می‌کند و نشان می‌دهد کدام یکی لیکوئیدیشن را فعال می‌کند.'
      ),
      takeaways: [
        text('The index price is a reference built from many venues and smoothed', 'ایندکس پرایس، قیمت مرجعی از چند صرافی است که هموار شده'),
        text('The mark price is the venue’s contract price used for PnL and margin', 'مارک پرایس، قیمت قرارداد در همان صرافی است که مبنای سود و وجه تضمین است'),
        text('The gap between them is the basis, and funding pulls it toward zero', 'اختلاف این دو، همان basis است و فاندینگ آن را به صفر می‌کشاند'),
        text('Liquidation is checked against the mark price, so it is smoothed against manipulation', 'لیکوئیدیشن با مارک پرایس سنجیده می‌شود و به همین دلیل در برابر دستکاری هموار است'),
      ],
      glossary: ['mark-price', 'index-price', 'basis', 'liquidation'],
      tools: ['liquidation-price', 'leverage-margin'],
      blocks: [
        {
          type: 'p',
          text: text(
            'A perpetual venue shows you more than one price for the same asset, and confusing them is a common source of surprise. One is a neutral reference built from outside markets; the other is the price the venue itself uses to value your position. They usually sit close, and when they do not, that difference matters.',
            'صرافی پرپچوآل برای یک دارایی بیش از یک قیمت نشان می‌دهد و اشتباه گرفتنشان منبعِ رایجِ غافلگیری است. یکی، قیمت مرجعِ بی‌طرفانه‌ای است که از بازارهای بیرون ساخته می‌شود؛ دیگری قیمتی است که خودِ صرافی برای ارزش‌گذاری موقعیت شما به کار می‌برد. این دو معمولاً نزدیک‌اند و وقتی نبودند، همین اختلاف اهمیت پیدا می‌کند.'
          )
        },
        { type: 'h2', text: text('The index price', 'ایندکس پرایس') },
        {
          type: 'p',
          text: text(
            'The index price is a composite reference: it blends the spot price of the asset across several venues and smooths the result, often trimming outliers and moving averages. Its purpose is to represent what the asset is worth in the wider market, so a single exchange having a bad print cannot, on its own, distort the reference.',
            'ایندکس پرایس، مرجعی ترکیبی است: قیمت نقدی دارایی را در چند صرافی با هم می‌آمیزد و نتیجه را هموار می‌کند، اغلب با حذف داده‌پرت و میانگین‌گیری. هدفش نشان دادنِ ارزش دارایی در بازارِ گسترده است، تا یک صرافی با یک قیمتِ بدِ تنها نتواند مرجع را تحریف کند.'
          )
        },
        { type: 'h2', text: text('The mark price', 'مارک پرایس') },
        { type: 'formula', expr: 'mark price = index price + basis', text: text('The mark price is the venue’s own valuation of the contract, the reference price plus the basis it currently applies.', 'مارک پرایس، ارزش‌گذاریِ خودِ صرافی از قرارداد است: قیمت مرجع به‌همراه basis جاری که اعمال می‌کند.') },
        {
          type: 'p',
          text: text(
            'The mark price is the number that counts for you. Unrealised PnL, margin requirements and liquidation checks all read the mark price, not the last trade and not the index. The basis is the small premium or discount the venue adds to the index to build it, and funding is what keeps that basis from running away.',
            'مارک پرایس همان عددی است که برای شما اهمیت دارد. سود و زیان شناور، نیازِ وجه تضمین و بررسیِ لیکوئیدیشن همه مارک پرایس را می‌خوانند؛ نه آخرین معامله و نه ایندکس. basis، کسر یا اضافهٔ کوچکی است که صرافی به ایندکس می‌افزاید تا مارک ساخته شود، و فاندینگ نگه می‌دارد که این basis از کنترل خارج نشود.'
          )
        },
        { type: 'h2', text: text('Why the difference is smoothed', 'چرا این اختلاف هموار می‌شود') },
        {
          type: 'p',
          text: text(
            'A venue that triggered liquidations off its own last trade would be easy to attack: push the tape with one aggressive order, harvest the forced closes, and the price snaps back. Deriving the mark from a broad index plus a bounded basis makes that single-trade spike far harder, which is why the mark can differ slightly from the price you see on the order screen.',
            'صرافی‌ای که لیکوئیدیشن را با آخرین معاملهٔ خودش فعال کند، هدفِ آسان حمله است: با یک سفارشِ تهاجمی نوار قیمت را هُل بده، بستن‌های اجباری را بردار و بعد قیمت برمی‌گردد. ساختن مارک از ایندکسِ گسترده به‌همراه basisِ محدود، این جهشِ تک‌معامله‌ای را بسیار دشوار می‌کند؛ به همین دلیل مارک می‌تواند اندکی با قیمتی که در صفحهٔ سفارش می‌بینید فرق کند.'
          )
        },
        {
          type: 'terms',
          items: [
            { term: text('Index price', 'ایندکس پرایس'), text: text('A smoothed multi-venue reference of the underlying’s spot value.', 'مرجع هموارشده از چند صرافی برای ارزش نقدیِ دارایی پایه.') },
            { term: text('Basis', 'Basis (اختلاف)'), text: text('The premium or discount between the contract and its reference price.', 'کسر یا اضافه میان قرارداد و قیمت مرجعش.') },
            { term: text('Liquidation price', 'قیمت لیکوئیدیشن'), text: text('The mark price at which a position no longer meets its margin requirement.', 'قیمت مارکی که در آن موقعیت دیگر وجه تضمین لازم را تأمین نمی‌کند.') },
          ]
        },
        {
          type: 'p',
          text: text(
            'For example, assume an index of 100.00 and a venue basis of +0.15%, giving a mark of 100.15. If a burst of buying drives the contract far above that, the mark rises only as far as the bounded basis allows, so the margin and liquidation math moves in a controlled way rather than chasing the spike.',
            'مثلاً فرض کنید ایندکس ۱۰۰٫۰۰ و basis صرافی ‎+۰٫۱۵٪ باشد، پس مارک ۱۰۰٫۱۵ می‌شود. اگر هجومِ خرید قرارداد را بسیار بالاتر ببرد، مارک فقط تا اندازهٔ همان basisِ محدود بالا می‌رود؛ بنابراین محاسبهٔ وجه تضمین و لیکوئیدیشن به‌شکلی کنترل‌شده حرکت می‌کند و دنبالهٔ جهش نمی‌افتد.'
          )
        },
        {
          type: 'note',
          text: text(
            'In Openfund the prices you see are Gains Network mark prices, consumed from the public Gains deployment on Arbitrum One and drawn on a Vela (LuxAlgo) chart. Openfund reports these marks as they are published by that feed; it does not compute a separate mark of its own.',
            'در اوپن‌فاند قیمت‌هایی که می‌بینید، مارک پرایس‌های Gains Network‌اند که از استقرار عمومی Gains روی Arbitrum One خوانده و روی نمودار Vela (LuxAlgo) رسم می‌شوند. اوپن‌فاند این مارک‌ها را همان‌طور که فید منتشر می‌کند گزارش می‌دهد و مارک مستقلِ خودش را نمی‌سازد.'
          )
        },
      ]
    },
    {
      slug: 'order-types-and-order-books',
      path: 'perpetual-futures-mechanics',
      sort: 4,
      minutes: 8,
      status: 'published',
      title: text('Order types and the order book', 'انواع سفارش و دفتر سفارش'),
      summary: text(
        'How market, limit and stop orders express your intent, how the order book turns them into fills, and where you can actually see depth and a tape.',
        'سفارش‌های بازار، لیمیت و استاپ چگونه خواستهٔ شما را بیان می‌کنند، دفتر سفارش چگونه آن‌ها را به معامله تبدیل می‌کند و عمق و نوار معاملات را واقعاً کجا می‌توان دید.'
      ),
      takeaways: [
        text('A market order trades at once and pays the spread for certainty', 'سفارش بازار فوراً اجرا می‌شود و برای قطعی‌بودن، اسپرد می‌پردازد'),
        text('A limit order sets a price and may fill partially or not at all', 'سفارش لیمیت قیمت تعیین می‌کند و ممکن است بخشی یا هیچ‌وقت اجرا نشود'),
        text('Stop orders are triggers that convert into a market or limit order', 'سفارش استاپ ماشه‌ای است که به سفارش بازار یا لیمیت تبدیل می‌شود'),
        text('The book’s depth decides how far a market order walks the ladder', 'عمق دفتر تعیین می‌کند سفارش بازار چند پله پایین‌تر/بالاتر برود'),
      ],
      glossary: ['market-order', 'limit-order', 'order-book', 'stop-loss'],
      tools: ['risk-reward', 'position-size'],
      blocks: [
        {
          type: 'p',
          text: text(
            'Every position begins as an order, and the order type encodes a choice: do you want certainty of price or certainty of execution? The order book is where that choice resolves — a live list of resting bids and asks that pairs willing buyers with willing sellers.',
            'هر موقعیت با یک سفارش آغاز می‌شود و نوع سفارش یک انتخاب را ثبت می‌کند: قطعیتِ قیمت می‌خواهید یا قطعیتِ اجرا؟ دفتر سفارش همان‌جایی است که این انتخاب روشن می‌شود — فهرست زنده‌ای از پیشنهادها و تقاضاهای در انتظار که خریدار و فروشندهٔ حاضر را جفت می‌کند.'
          )
        },
        { type: 'h2', text: text('Market and limit orders', 'سفارش بازار و لیمیت') },
        {
          type: 'terms',
          items: [
            { term: text('Market order', 'سفارش بازار'), text: text('Buy or sell immediately against the best available resting price.', 'فوراً در بهترین قیمتِ در دسترس بخرد یا بفروشد.') },
            { term: text('Limit order', 'سفارش لیمیت'), text: text('An order that rests at or inside your stated price and waits to be met.', 'سفارشی که در یا بهترِ قیمتِ اعلامی شما می‌نشیند و منتظر جفت می‌ماند.') },
          ]
        },
        {
          type: 'p',
          text: text(
            'A market order removes liquidity: it takes whatever the book offers until your size is filled, which is why a large market order can clear several levels. A limit order adds liquidity when it rests: you set the worst price you accept and let someone else come to you, trading a guaranteed price for the chance of no fill at all.',
            'سفارش بازار نقدینگی را برمی‌دارد: هرچه دفتر پیش از پرشدنِ حجم شما عرضه کند می‌گیرد، به همین دلیل سفارش بازارِ بزرگ می‌تواند چند سطح را خالی کند. سفارش لیمیت وقتی می‌نشیند نقدینگی اضافه می‌کند: بدترین قیمتِ قابل‌قبول خود را تعیین می‌کنید و می‌گذارید طرف مقابل به شما برسد؛ یعنی قیمتِ تضمین‌شده را به بهای این‌که ممکن است هرگز اجرا نشود، می‌خرید.'
          )
        },
        { type: 'h2', text: text('Stop orders', 'سفارش‌های استاپ') },
        {
          type: 'terms',
          items: [
            { term: text('Stop-loss', 'حد ضرر'), text: text('A trigger that closes a position once price reaches a preset loss level.', 'ماشه‌ای که با رسیدن قیمت به سطح ضرر از پیش تعیین‌شده، موقعیت را می‌بندد.') },
            { term: text('Take-profit', 'حد سود'), text: text('A trigger that closes a position once price reaches a preset gain level.', 'ماشه‌ای که با رسیدن قیمت به سطح سود از پیش تعیین‌شده، موقعیت را می‌بندد.') },
          ]
        },
        {
          type: 'p',
          text: text(
            'A stop order does nothing until its trigger price is touched; then it becomes a market or limit order. A stop-loss turns into a seller into the book when you are wrong, which protects you but also means the exit price is not fixed in a fast or thin market — a gap can fill far from your trigger.',
            'سفارش استاپ تا لمس‌شدن قیمت ماشه‌اش هیچ کاری نمی‌کند؛ آن‌گاه به سفارش بازار یا لیمیت بدل می‌شود. حد ضرر وقتی اشتباه باشید به فروشنده‌ای در دفتر تبدیل می‌شود؛ از شما محافظت می‌کند ولی یعنی در بازارِ تند یا کم‌عمق قیمتِ خروج ثابت نیست — یک گپ می‌تواند بسیار دورتر از ماشه اجرا شود.'
          )
        },
        { type: 'h2', text: text('How the book produces a fill', 'چگونه دفتر، معامله می‌سازد') },
        {
          type: 'ol',
          items: [
            text('You submit a market buy: it matches the lowest ask first.', 'سفارش بازار خرید می‌فرستید: نخست با پایین‌ترین پیشنهاد (ask) جفت می‌شود.'),
            text('Your size exhausts that level, so it moves up to the next ask.', 'حجم‌تان آن سطح را تمام می‌کند، پس به ask بعدی بالا می‌رود.'),
            text('The average fill is worse than the top of book when depth is thin.', 'وقتی عمق کم است، میانگینِ اجرا از بالای دفتر بدتر می‌شود.'),
          ]
        },
        {
          type: 'note',
          text: text(
            'Openfund’s data source today carries no order-book depth, no open interest and no trade tape, so those are shown as unavailable rather than estimated — never invented. You can obtain the order book, depth and tape from the trading venue itself. Perpetual Trading in Openfund is read-only: it neither aggregates liquidity across venues nor routes or executes orders.',
            'منبع دادهٔ اوپن‌فاند امروز عمق دفتر سفارش، اوپن اینترست و نوار معاملات ندارد، پس این‌ها به‌جای تخمین، «در دسترس نیست» نمایش داده می‌شوند — و هرگز جعل نمی‌شوند. دفتر سفارش، عمق و نوار معاملات را خودِ صرافی ارائه می‌دهد. بخش «معاملات آنی» در اوپن‌فاند خواندنی است: نقدینگی چند صرافی را جمع نمی‌کند و سفارشی را مسیریابی یا اجرا نمی‌کند.'
          )
        },
        {
          type: 'p',
          text: text(
            'Match the tool to the task: use limit orders when price matters more than speed, market orders when getting in and out matters more than the exact print, and stops to pre-commit an exit. Depth is what determines how honest each of those is in practice.',
            'ابزار را به کار بسپارید: وقتی قیمت مهم‌تر از سرعت است لیمیت بگذارید، وقتی ورود و خروج مهم‌تر از قیمت دقیق است بازار بزنید، و برای پیش‌تعهد به خروج از استاپ استفاده کنید. همان عمقِ دفتر است که در عمل مشخص می‌کند هرکدام چقدر درست از آب درمی‌آید.'
          )
        },
      ]
    },
    {
      slug: 'fees-slippage-open-interest',
      path: 'perpetual-futures-mechanics',
      sort: 5,
      minutes: 9,
      status: 'published',
      title: text('Fees, slippage and open interest', 'کارمزد، اسلیپیج و اوپن اینترست'),
      summary: text(
        'The three numbers that decide what a trade really costs you: the maker or taker fee, the slippage you pay on execution, and what open interest reveals about the crowd behind the price.',
        'سه عددی که معین می‌کنند یک معامله واقعاً چقدر برایتان تمام می‌شود: کارمزد maker یا taker، اسلیپیجی که در اجرا می‌پردازید، و آنچه اوپن اینترست دربارهٔ جمعیتِ پشت قیمت فاش می‌کند.'
      ),
      takeaways: [
        text('Takers pay more than makers because they remove liquidity', 'taker بیشتر از maker می‌پردازد، چون نقدینگی را برمی‌دارد'),
        text('Round-trip cost is the entry fee plus the exit fee on your notional', 'هزینهٔ رفت‌وبرگشت، جمع کارمزد ورود و خروج روی ارزش اسمی است'),
        text('Slippage is the gap between the price you expected and the price you got', 'اسلیپیج، فاصلهٔ قیمتی است که انتظار داشتید با قیمتی که گرفتید'),
        text('Open interest counts both sides, so longs and shorts always equal each other', 'اوپن اینترست دو سمت را می‌شمارد، پس خرید و فروش همیشه با هم برابرند'),
      ],
      glossary: ['taker-fee', 'maker-fee', 'slippage', 'open-interest'],
      tools: ['perp-pnl', 'position-size'],
      blocks: [
        {
          type: 'p',
          text: text(
            'The price on the screen is not the price you trade at. Between intent and outcome sit three frictions that quietly eat into any strategy: the fee you pay per side, the slippage you absorb when your size moves the market, and the level of open interest that tells you how much risk is parked behind the current price.',
            'قیمتِ روی صفحه، قیمتی نیست که با آن معامله می‌کنید. میان قصد و نتیجه سه اصطکاک آرام‌آرام سود هر راهبرد را می‌خورند: کارمزدی که در هر سمت می‌پردازید، اسلیپیجی که وقتی حجم‌تان بازار را هل می‌دهد تحمل می‌کنید، و سطح اوپن اینترستی که می‌گوید چه اندازه ریسک پشت قیمتِ کنونی پارک شده است.'
          )
        },
        { type: 'h2', text: text('Maker and taker fees', 'کارمزد maker و taker') },
        {
          type: 'terms',
          items: [
            { term: text('Taker fee', 'کارمزد taker'), text: text('The higher fee paid when your order removes resting liquidity.', 'کارمزد بالاتر که وقتی سفارش‌تان نقدینگیِ نشسته را برمی‌دارد پرداخت می‌شود.') },
            { term: text('Maker fee', 'کارمزد maker'), text: text('The lower fee when your order rests and adds to the book.', 'کارمزد پایین‌تر وقتی سفارش‌تان می‌نشیند و به دفتر اضافه می‌کند.') },
          ]
        },
        {
          type: 'p',
          text: text(
            'Exchanges charge a taker more than a maker to reward the orders that add depth rather than drain it. If you cross the spread and fill immediately you are a taker; if you post a resting limit order that someone else lifts you are a maker. The difference is small per trade but decides whether frequent entries are affordable at all.',
            'صرافی‌ها از taker بیشتر از maker می‌گیرند تا به سفارش‌هایی پاداش دهند که عمق اضافه می‌کنند نه آن‌که آن را تخلیه کنند. اگر اسپرد را بشکنید و فوراً اجرا شوید taker هستید؛ اگر سفارش لیمیتِ نشسته‌ای بگذارید که دیگری آن را بردارد maker هستید. تفاوت در هر معامله کوچک است، اما تعیین می‌کند که اصلاً ورودهای مکرر هزینه‌ای قابل‌تحمل دارند یا نه.'
          )
        },
        { type: 'formula', expr: 'round-trip fee = notional x (entry fee rate + exit fee rate)', text: text('Every position pays twice, so add the opening and closing rates and apply them to the notional.', 'هر موقعیت دوبار هزینه می‌دهد؛ پس نرخ ورود و خروج را جمع و روی ارزش اسمی اعمال کنید.') },
        {
          type: 'p',
          text: text(
            'For example, assume both sides were taker orders at 0.05% each on a 20,000 notional: the round-trip fee is 20,000 x (0.05% + 0.05%), or 20. Your strategy needs to clear that cost before it earns anything. These rates are illustrative inputs only — Openfund does not publish a commercial perpetual fee schedule, and real rates come from the venue you trade on.',
            'مثلاً فرض کنید هر دو سمت سفارش taker با نرخ ۰٫۰۵٪ روی ارزش اسمی ۲۰٬۰۰۰ باشند؛ هزینهٔ رفت‌وبرگشت ۲۰٬۰۰۰ × (۰٫۰۵٪ + ۰٫۰۵٪) یعنی ۲۰ می‌شود. راهبرد شما پیش از سود باید این هزینه را جبران کند. این نرخ‌ها فقط ورودی‌های نمونه‌اند — اوپن‌فاند جدول کارمزد تجاریِ پرپچوآل منتشر نمی‌کند و نرخ واقعی از همان صرافی‌ای می‌آید که در آن معامله می‌کنید.'
          )
        },
        { type: 'h2', text: text('Slippage', 'اسلیپیج') },
        { type: 'formula', expr: 'slippage (bps) = (fill price - quoted price) / quoted price x 10000', text: text('A positive figure means you paid more than expected; express it in basis points to compare trades of different sizes.', 'عدد مثبت یعنی بیشتر از انتظار پرداخته‌اید؛ برای مقایسهٔ معاملاتِ با اندازه‌های مختلف آن را در basis point بیان کنید.') },
        {
          type: 'p',
          text: text(
            'Slippage is the difference between the price you saw when you decided and the average you actually got. It grows with your size relative to depth and with speed: a thin book or a fast move forces a market order to walk further down the ladder. Using limit orders, splitting size, or trading calmer hours reduces it, but never removes it.',
            'اسلیپیج تفاوتِ قیمتی است که هنگام تصمیم دیدید با میانگین قیمتی که واقعاً گرفتید. هرچه حجم شما نسبت به عمق بزرگ‌تر و حرکت بازار تندتر باشد، اسلیپیج بیشتر می‌شود: دفترِ کم‌عمق یا حرکتِ سریع، سفارش بازار را وادار می‌کند پله‌های بیشتری پایین/بالا برود. لیمیت‌گذاری، خردکردن حجم یا معامله در ساعات آرامتر آن را کم می‌کند، ولی هیچ‌وقت کامل حذفش نمی‌کند.'
          )
        },
        { type: 'h2', text: text('Open interest', 'اوپن اینترست') },
        { type: 'formula', expr: 'open interest = sum of open long positions = sum of open short positions', text: text('Open interest counts every contract twice, once for each side, so total longs always equal total shorts.', 'اوپن اینترست هر قرارداد را دو بار می‌شمارد، یک بار برای هر سمت؛ پس مجموع خریدها همیشه برابر مجموع فروش‌هاست.') },
        {
          type: 'p',
          text: text(
            'Open interest is the total of contracts still open. Because every long needs a matching short, it never favours one side. Rising open interest alongside price says new money is entering; falling open interest says positions are being closed. It measures crowding, not direction — the same way funding measures which side is paying.',
            'اوپن اینترست مجموع قراردادهای هنوز باز است. چون هر خرید به یک فروشِ جفت نیاز دارد، هرگز به یک سمت سو نمی‌کند. اوپن اینترستِ رو به بالا همراه قیمت می‌گوید پول تازه وارد شده، و رو به پایین می‌گوید موقعیت‌ها بسته می‌شوند. این عدد ازدحام را می‌سنجد نه جهت را — دقیقاً همان کاری که فاندینگ برای سمتِ پرداخت‌کننده می‌کند.'
          )
        },
        {
          type: 'table',
          caption: text('What each friction depends on', 'هر اصطکاک به چه چیزی وابسته است'),
          head: [text('Friction', 'اصطکاک'), text('Main driver', 'محرک اصلی'), text('Where to read it', 'کجا می‌توان خواند')],
          rows: [
            [text('Fee', 'کارمزد'), text('Maker versus taker, and your notional', 'maker یا taker بودن و ارزش اسمی شما'), text('The venue’s published fee schedule', 'جدول کارمزد منتشرشدهٔ صرافی')],
            [text('Slippage', 'اسلیپیج'), text('Order size relative to book depth', 'حجم سفارش نسبت به عمق دفتر'), text('Order-book depth at the venue', 'عمق دفتر سفارش در صرافی')],
            [text('Open interest', 'اوپن اینترست'), text('Net new contracts opened or closed', 'قراردادهای تازه باز یا بسته‌شده'), text('The venue’s market data', 'دادهٔ بازارِ همان صرافی')],
          ]
        },
        {
          type: 'note',
          text: text(
            'The Gains Network feed that Openfund reads today supplies no open interest, no order-book depth and no trade tape, so Openfund shows those as unavailable instead of estimating or fabricating them. To measure slippage or read depth, use the venue you trade on directly. Openfund’s Perpetual Trading view is read-only and Prop Trading runs a simulated demo priced on live Gains mark prices.',
            'فیدِ Gains Network که امروز اوپن‌فاند از آن می‌خواند، نه اوپن اینترست دارد، نه عمق دفتر سفارش و نه نوار معاملات؛ پس اوپن‌فاند به‌جای تخمین یا ساختن، این‌ها را «در دسترس نیست» نشان می‌دهد. برای سنجش اسلیپیج یا خواندن عمق، مستقیم به همان صرافی مراجعه کنید. نمای «معاملات آنی» اوپن‌فاند خواندنی است و «معاملات حرفه‌ای» یک دموی شبیه‌سازی‌شده است که با مارک پرایس زندهٔ Gains قیمت‌گذاری می‌شود.'
          )
        },
        {
          type: 'p',
          text: text(
            'Put the three together before you size a trade. Fees set a floor on how often you can enter, slippage sets how much each entry really costs, and open interest tells you whether the move has fresh positions behind it. None of them changes your view of direction — all of them change what that view is worth.',
            'پیش از تعیین اندازهٔ معامله، هر سه را کنار هم بگذارید. کارمزد سقفِ تعداد ورود شما را می‌گذارد، اسلیپیج هزینهٔ واقعیِ هر ورود را معین می‌کند و اوپن اینترست می‌گوید آیا حرکت پشتش موقعیت تازه دارد یا نه. هیچ‌کدام نگاه شما به جهت را عوض نمی‌کند — ولی همه عوض می‌کنند که آن نگاه چقدر می‌ارزد.'
          )
        },
      ]
    },
  ]
}
