import { text } from '../../../features/information/content'
import type { GlossaryTermContent } from '../../contentTypes'

/** Learning Center — bilingual glossary of trading and on-chain terms.
 *  Repo authoring source only; NOT imported by the app at runtime.
 *  Content contract: every definition is textbook-accurate and generic. Where a
 *  value differs by venue it is stated as such, and no number is presented as
 *  an Openfund commercial term. Openfund-specific claims are limited to what the
 *  product actually says today: it publishes its challenge conditions on the
 *  rulebook page, and paid activation, funded accounts and payouts are not
 *  enabled in this release. No other brand is ever named. */
export const glossaryTerms: GlossaryTermContent[] = [
  {
    slug: 'balance',
    sort: 1,
    term: text('Balance', 'موجودی'),
    short: text('The cash total of an account: funds plus realized profit, loss and fees.', 'جمعِ نقدی حساب: موجودی به‌همراه سود و زیان و کارمزدهای محقق‌شده.'),
    definition: text(
      'Balance is the total cash credited to an account: the money added, plus realized profit and loss and any charged fees. It ignores open positions, so it only changes when a trade closes or a fee is taken. Equity is balance plus the floating PnL of open positions, so the two differ while you hold something.',
      'موجودی جمعِ نقدیِ ثبت‌شده برای حساب است: پولِ افزوده‌شده به‌همراه سود و زیان و کارمزدهای محقق‌شده. موجودی موقعیت‌های باز را نادیده می‌گیرد، پس فقط وقتی معامله‌ای بسته شود یا کارمزدی کسر گردد تغییر می‌کند. ارزش خالص همان موجودی به‌اضافهٔ سود و زیان شناور است، پس تا وقتی موقعیت بازی دارید این دو عدد با هم فرق می‌کنند.'
    ),
    lessons: ['margin-and-leverage-basics', 'funded-accounts-how-they-work'],
    tool: 'perp-pnl',
  },
  {
    slug: 'basis',
    sort: 2,
    term: text('Basis', 'بیسیس'),
    short: text('The gap between a perpetual price and its reference index price.', 'اختلافِ میانِ قیمتِ پرپچوآل و قیمتِ مرجعِ ایندکس.'),
    definition: text(
      'Basis is the difference between the perpetual own price and the index price it tracks. A positive basis means the contract trades above the reference; a negative basis means it trades below. Mark price is usually built as the index price plus a bounded, smoothed basis, and funding is what pulls that basis back toward zero.',
      'بیسیس اختلافِ میانِ قیمتِ خودِ پرپچوآل و قیمتِ مرجعِ ایندکسی است که آن را دنبال می‌کند. بیسیسِ مثبت یعنی قرارداد بالاتر از مرجع معامله می‌شود و منفی یعنی پایین‌تر. مارک پرایس معمولاً از ایندکس به‌اضافهٔ یک بیسیسِ هموار و محدود ساخته می‌شود، و همان فاندینگ است که این بیسیس را به سوی صفر بازمی‌گرداند.'
    ),
    lessons: ['mark-price-vs-index-price', 'funding-rate-explained'],
  },
  {
    slug: 'block-explorer',
    sort: 3,
    term: text('Block explorer', 'بلاک‌اکسپلورر'),
    short: text('A public website for searching blocks, transactions and contract records on a chain.', 'سایتِ عمومیِ جست‌وجوی بلاک، تراکنش و سوابق قرارداد روی بلاک‌چین.'),
    definition: text(
      'A block explorer is a public index that lets you look up blocks, transactions, addresses and contract activity on a blockchain. It shows what the chain recorded — amounts, timestamps, status and event logs — so you can verify a transaction independently of any platform own dashboard. Explorers reflect on-chain data only; they do not reveal off-chain balances or internal ledgers.',
      'بلاک‌اکسپلورر نمایهٔ عمومی است که جست‌وجوی بلاک‌ها، تراکنش‌ها، آدرس‌ها و فعالیتِ قراردادها را روی بلاک‌چین ممکن می‌کند. این ابزار نشان می‌دهد بلاک‌چین چه ثبت کرده — مبالغ، زمان، وضعیت و لاگ رویدادها — تا تراکنش را فارغ از داشبوردِ هر پلتفرم مستقل راستی‌آزمایی کنید. اکسپلوررها فقط دادهٔ آن‌چین را می‌نمایانند و موجودی یا دفترِ حسابِ خارجِ زنجیره را فاش نمی‌کنند.'
    ),
    lessons: ['reading-a-block-explorer', 'verifying-a-transaction'],
  },
  {
    slug: 'consistency-rule',
    sort: 4,
    term: text('Consistency rule', 'قانون تداوم'),
    short: text('A limit on how much of total profit one day may contribute.', 'سقفی بر سهمِ یک روز از مجموعِ سود.'),
    definition: text(
      'A consistency rule caps the share of total profit that a single best day may account for, so a result cannot rest on one lucky spike. It is usually written as a percentage: if the cap were 35%, no day could exceed 35% of cumulative profit. The exact percentage differs by firm and by plan; Openfund publishes its own challenge conditions on its rulebook page, and paid activation, funded accounts and payouts are not enabled in this release.',
      'قانون تداوم سهمِ بزرگ‌ترین روزِ سود را از مجموعِ سود محدود می‌کند تا نتیجه به یک اوجِ خوش‌یام وابسته نشود. این قانون معمولاً درصدی بیان می‌شود: اگر سقف ۳۵٪ باشد، هیچ روزی نباید از ۳۵٪ سودِ انباشته بیشتر شود. این درصد بر اساس شرکت و پلن فرق می‌کند؛ اوپن‌فاند شرایطِ چلنجِ خودش را در صفحهٔ قوانین منتشر می‌کند و فعال‌سازیِ پولی، حساب فاندشده و برداشت در این نسخه فعال نیستند.'
    ),
    lessons: ['consistency-and-payout-conditions', 'reading-a-rulebook'],
    tool: 'consistency-rule',
  },
  {
    slug: 'cross-margin',
    sort: 5,
    term: text('Cross margin', 'وجه تضمین متقاطع'),
    short: text('A margin mode that pools collateral across all positions in the account.', 'حالتِ وجه تضمینی که وثیقه را میانِ همهٔ موقعیت‌ها مشترک می‌کند.'),
    definition: text(
      'Cross margin lets every open position draw on the same shared balance as collateral, so profitable or free positions cushion losing ones. It lowers each position liquidation price because more equity backs it, but it links their risk: one severe move can consume the whole balance and liquidate everything at once. Isolated margin is the alternative that ring-fences collateral to a single position.',
      'وجه تضمین متقاطع اجازه می‌دهد هر موقعیت باز از یک موجودیِ مشترک به‌عنوان وثیقه برداشت کند، پس موقعیت سودده یا آزاد از موقعیت زیان‌ده محافظت می‌کند. این حالت قیمتِ لیکوئیدیشن هر موقعیت را پایین می‌آورد، چون ارزش خالصِ بیشتری پشت آن است؛ ولی ریسک‌ها را به هم گره می‌زند: یک حرکتِ تند می‌تواند کل موجودی را بخورد و همه را یک‌جا لیکوئید کند. جایگزینش وجه تضمین مجزا است که وثیقه را به یک موقعیت محدود می‌کند.'
    ),
    lessons: ['isolated-vs-cross-margin', 'margin-and-leverage-basics'],
    tool: 'leverage-margin',
  },
  {
    slug: 'daily-drawdown',
    sort: 6,
    term: text('Daily drawdown', 'افت روزانه'),
    short: text('The loss measured against a single day starting account value.', 'زیانی که نسبت به ارزشِ شروعِ یک روز سنجیده می‌شود.'),
    definition: text(
      'Daily drawdown is how far account value has fallen from that day starting level, usually measured against the higher of the day opening balance or equity. Trading firms often pair it with a daily loss limit, where touching the limit is a breach that a later recovery does not undo. The reset time and the exact basis differ by venue, so read the specific rule rather than assuming one standard.',
      'افت روزانه نشان می‌دهد ارزشِ حساب چقدر از سطحِ شروعِ همان روز پایین رفته است؛ معمولاً مبنای محاسبه بزرگ‌ترِ موجودی یا ارزش خالصِ ابتدای روز است. شرکت‌های معاملاتی اغلب آن را با سقفِ ضرر روزانه جفت می‌کنند، به‌گونه‌ای که یک بار لمسِ آن نقض باشد و بازگشتِ بعدی آن را برنمی‌گرداند. زمانِ بازنشانی و مبنای دقیق بر اساس صرافی فرق می‌کند، پس قاعدهٔ مشخص را بخوانید و یک استانداردِ واحد فرض نکنید.'
    ),
    lessons: ['drawdown-and-high-water-mark'],
    tool: 'prop-drawdown',
  },
  {
    slug: 'equity',
    sort: 7,
    term: text('Equity', 'ارزش خالص'),
    short: text('Live account value: balance plus the floating PnL of open positions.', 'ارزشِ زندهٔ حساب: موجودی به‌اضافهٔ سود و زیانِ شناور موقعیت‌های باز.'),
    definition: text(
      'Equity is the real-time value of an account: the balance plus the unrealized profit and loss of every open position. Because it moves with price before anything closes, equity — not balance — is what most margin, liquidation and loss-limit rules read. It rises when floating PnL turns positive and falls when it turns negative.',
      'ارزش خالص مقدارِ زندهٔ حساب است: موجودی به‌اضافهٔ سود و زیانِ محقق‌نشدهٔ هر موقعیت باز. چون پیش از بستنِ هیچ معامله‌ای با قیمت حرکت می‌کند، معمولاً ارزش خالص است — نه موجودی — که قواعدِ وجه تضمین، لیکوئیدیشن و سقف ضرر آن را می‌خوانند. وقتی سود و زیانِ شناور مثبت شود بالا می‌رود و وقتی منفی شود پایین می‌آید.'
    ),
    lessons: ['margin-and-leverage-basics', 'drawdown-and-high-water-mark'],
    tool: 'perp-pnl',
  },
  {
    slug: 'expectancy',
    sort: 8,
    term: text('Expectancy', 'امید ریاضی'),
    short: text('Average profit or loss expected per trade over many trades.', 'میانگینِ سود یا زیانی که به‌ازای هر معامله انتظار می‌رود.'),
    definition: text(
      'Expectancy is the average amount a strategy earns or loses per trade across a large number of trades. It is computed as win rate times average win minus loss rate times average loss: p × avgWin − q × avgLoss. A positive expectancy says the edge is real on average, but it says nothing about how long a losing streak might last or how deep the drawdown goes.',
      'امید ریاضی میانگینِ مبلغی است که یک راهبرد در هر معامله به‌میانِ تعدادِ زیادی معامله به دست می‌آورد یا از دست می‌دهد. آن را چنین حساب می‌کنند: نرخ برد × میانگینِ سود، منهای نرخ ضرر × میانگینِ زیان؛ یعنی p × avgWin − q × avgLoss. امیدِ مثبت می‌گوید مزیت در میانگین واقعی است، ولی نمی‌گوید یک رشتهٔ زیان چقدر طول می‌کشد یا افت چقدر عمیق می‌شود.'
    ),
    lessons: ['trading-journal-that-works', 'sizing-for-survival'],
    tool: 'journal-analyzer',
  },
  {
    slug: 'funding-rate',
    sort: 9,
    term: text('Funding rate', 'نرخ فاندینگ'),
    short: text('A recurring payment between longs and shorts that anchors a perp to its index.', 'پرداختِ دوره‌ای میانِ خریدار و فروشنده که پرپچوآل را به ایندکس می‌بندد.'),
    definition: text(
      'The funding rate is a periodic payment exchanged between traders holding opposite sides — longs and shorts — not a fee paid to the exchange. When the perpetual trades above the index, longs pay shorts; when it trades below, shorts pay longs, and this cost discourages the crowded side and nudges the contract price back toward the index. The rate, the interval and any cap are set per venue, so the same position can carry different funding on different platforms.',
      'نرخ فاندینگ پرداختی دوره‌ای است که میانِ معامله‌گرانِ دو سمتِ مخالف — خریدار و فروشنده — جابه‌جا می‌شود، نه کارمزدی که به صرافی بپردازید. وقتی پرپچوآل بالاتر از ایندکس معامله می‌شود، خریداران به فروشندگان می‌پردازند و وقتی پایین‌تر باشد فروشندگان به خریداران؛ این هزینه سمتِ شلوغِ بازار را کم می‌کند و قیمتِ قرارداد را به سوی ایندکس هل می‌دهد. نرخ، بازهٔ زمانی و هر سقفی برای هر صرافی جدا تعیین می‌شود، پس یک موقعیت می‌تواند فاندینگِ متفاوتی روی پلتفرم‌های دیگر داشته باشد.'
    ),
    lessons: ['funding-rate-explained', 'perps-how-they-work'],
    tool: 'funding-rate',
  },
  {
    slug: 'high-water-mark',
    sort: 10,
    term: text('High-water mark', 'سطح اوج'),
    short: text('The highest recorded account value, the peak from which drawdown is measured.', 'بالاترینِ ارزشِ ثبت‌شدهٔ حساب؛ همان اوجی که افت از آن سنجیده می‌شود.'),
    definition: text(
      'A high-water mark is the highest account value the record has ever reached. Drawdown is measured downward from this peak, and profit-based limits — for example a trailing drawdown — often rise with it. Depending on the rule, the mark may update on equity or only on closed balance, and it may or may not reset after a payout, so the definition matters and differs by venue.',
      'سطح اوج بالاترینِ ارزشی است که حساب تاکنون به آن رسیده است. افت از همین اوج به پایین سنجیده می‌شود و سقف‌های سودمحور — مثلاً افتِ شناور — اغلب با آن بالا می‌روند. بسته به قاعده، سطح اوج ممکن است با ارزش خالص به‌روز شود یا فقط با موجودیِ محقق‌شده، و ممکن است پس از برداشت بازنشانی شود یا نشود؛ به همین دلیل تعریفِ دقیقش اهمیت دارد و بر اساس صرافی فرق می‌کند.'
    ),
    lessons: ['drawdown-and-high-water-mark'],
    tool: 'prop-drawdown',
  },
  {
    slug: 'index-price',
    sort: 11,
    term: text('Index price', 'ایندکس پرایس'),
    short: text('A smoothed spot reference built from several venues, used to anchor a perpetual.', 'قیمتِ مرجعِ هموارشده از چند صرافی که لنگرِ پرپچوآل است.'),
    definition: text(
      'The index price is a reference value that blends the spot price of an asset across multiple venues and smooths the result, often trimming outliers. It represents what the asset is worth in the wider market, so a single exchange bad print cannot by itself distort the reference. Perpetual venues use it as the target that mark price and funding keep the contract near.',
      'ایندکس پرایس قیمتِ مرجعی است که قیمتِ نقدی یک دارایی را در چند صرافی با هم می‌آمیزد و نتیجه را — اغلب با حذفِ داده‌پرت — هموار می‌کند. این عدد نشان می‌دهد دارایی در بازارِ گسترده چقدر می‌ارزد، پس یک قیمتِ بد در یک صرافی به‌تنهایی نمی‌تواند مرجع را تحریف کند. صرافی‌های پرپچوآل از آن به‌عنوان هدفی استفاده می‌کنند که مارک پرایس و فاندینگ باید قرارداد را نزدیکش نگه دارند.'
    ),
    lessons: ['mark-price-vs-index-price', 'perps-how-they-work'],
  },
  {
    slug: 'isolated-margin',
    sort: 12,
    term: text('Isolated margin', 'وجه تضمین مجزا'),
    short: text('A margin mode that ring-fences collateral to a single position.', 'حالتِ وجه تضمینی که وثیقه را به یک موقعیت محدود می‌کند.'),
    definition: text(
      'Isolated margin assigns a fixed amount of collateral to one position, and that position can lose at most that amount. If it reaches its liquidation price, only the isolated margin is used, leaving the rest of the balance untouched. The trade-off is a higher liquidation price than cross margin, because less equity stands behind the position.',
      'وجه تضمین مجزا مقدارِ مشخصی وثیقه را به یک موقعیت اختصاص می‌دهد و همان موقعیت حداکثر می‌تواند تا اندازهٔ آن ضرر کند. اگر به قیمتِ لیکوئیدیشن برسد، فقط همان وجهِ تضمینِ مجزا مصرف می‌شود و بقیهٔ موجودی دست‌نخورده می‌ماند. بهای این کار قیمتِ لیکوئیدیشنِ بالاتری نسبت به حالتِ متقاطع است، چون ارزشِ خالصِ کمتری پشت موقعیت می‌ایستد.'
    ),
    lessons: ['isolated-vs-cross-margin', 'margin-and-leverage-basics'],
    tool: 'leverage-margin',
  },
  {
    slug: 'kelly-criterion',
    sort: 13,
    term: text('Kelly criterion', 'معیار کلی'),
    short: text('A formula for the bet size that maximises long-run logarithmic growth.', 'فرمولی برای اندازهٔ موقعیتی که رشدِ لگاریتمیِ بلندمدت را بیشینه می‌کند.'),
    definition: text(
      'The Kelly criterion gives the fraction of capital that maximises the expected long-run logarithmic growth rate of the account. In its simple form the fraction is f = (p·b − q) / b, where p is win rate, q its complement and b the win-to-loss ratio. Full Kelly is the mathematically aggressive extreme: it assumes your edge estimates are accurate, so most practitioners bet a fraction of it — half Kelly or less — to tolerate estimation error and avoid ruin.',
      'معیار کلی نسبتی از سرمایه را می‌دهد که نرخِ رشدِ لگاریتمیِ بلندمدتِ حساب را بیشینه می‌کند. در ساده‌ترین شکل این نسبت f = (p·b − q) / b است که در آن p نرخ برد، q مکملِ آن و b نسبتِ سود به زیان است. کِلیِ کامل حدِ تهاجمیِ ریاضی است و فرض می‌کند برآوردهای شما از مزیت دقیق‌اند؛ به همین بیشترِ فعالان بازار کسری از آن را به کار می‌برند — کِلیِ نیم یا کمتر — تا خطای برآورد را تحمل کنند و از ورشکستگی بپرهیزند.'
    ),
    lessons: ['sizing-for-survival'],
    tool: 'position-size',
  },
  {
    slug: 'leverage',
    sort: 14,
    term: text('Leverage', 'اهرم'),
    short: text('The multiplier between a position notional size and the margin behind it.', 'ضریبِ میانِ ارزشِ اسمیِ موقعیت و وجه تضمینی که پشت آن است.'),
    definition: text(
      'Leverage is how many times larger a position notional value is than the margin you post to hold it. It amplifies price moves: a one-percent move against a 10x position changes your margin roughly ten percent. Leverage raises exposure and magnifies both gain and loss, and it brings the liquidation price closer; the maximum allowed leverage differs by venue and by instrument.',
      'اهرم نشان می‌دهد ارزشِ اسمیِ یک موقعیت چند برابرِ وجه تضمینی است که برای نگه‌داشتن آن می‌گذارید. اهرم حرکتِ قیمت را بزرگ‌نمایی می‌کند: یک تغییرِ یک‌درصدی در قیمت، برای موقعیتی با اهرمِ ۱۰ برابری تقریباً ۱۰٪ تغییر در وجه تضمین می‌سازد. اهرم مواجهه را بالا می‌برد و هم سود و هم زیان را بزرگ می‌کند و قیمتِ لیکوئیدیشن را نزدیک‌تر می‌سازد؛ سقفِ مجازِ اهرم بر اساس صرافی و نماد فرق می‌کند.'
    ),
    lessons: ['margin-and-leverage-basics', 'perps-how-they-work'],
    tool: 'leverage-margin',
  },
  {
    slug: 'limit-order',
    sort: 15,
    term: text('Limit order', 'سفارش لیمیت'),
    short: text('An order that fills only at your stated price or better.', 'سفارشی که فقط در قیمتِ اعلامیِ شما یا بهتر اجرا می‌شود.'),
    definition: text(
      'A limit order states the worst price you will accept and rests in the book until the market reaches it. It guarantees the price but not the fill: in a fast or thin market it may fill only partly or not at all. Resting limit orders add liquidity and usually earn the lower maker fee, unlike market orders that take liquidity.',
      'سفارش لیمیت بدترین قیمتی را که می‌پذیرید مشخص می‌کند و در دفتر سفارش می‌نشیند تا بازار به آن برسد. این سفارش قیمت را تضمین می‌کند، نه اجرا را: در بازارِ تند یا کم‌عمق ممکن است فقط بخشی اجرا شود یا اصلاً اجرا نشود. سفارش‌های لیمیتِ نشسته نقدینگی اضافه می‌کنند و معمولاً کارمزدِ پایین‌ترِ میکر را می‌گیرند، برخلاف سفارش بازار که نقدینگی برمی‌دارد.'
    ),
    lessons: ['order-types-and-order-books'],
  },
  {
    slug: 'liquidation',
    sort: 16,
    term: text('Liquidation', 'لیکوئیدیشن'),
    short: text('Forced closure of a position when its margin falls below the required floor.', 'بستنِ اجباریِ موقعیت وقتی وجه تضمینش از کفِ لازم پایین‌تر می‌رود.'),
    definition: text(
      'Liquidation is the forced closing of a position by the venue once the collateral behind it can no longer meet the maintenance-margin requirement. It happens at a price derived from the mark price, so it follows the smoothed reference rather than the last trade. How the loss is realised — through a venue liquidation engine or a backstop auction — and whether a penalty applies differ by exchange.',
      'لیکوئیدیشن بستنِ اجباریِ یک موقعیت توسط صرافی است، وقتی وثیقهٔ پشت آن دیگر نیازِ وجهِ تضمینِ نگهداری را تأمین نمی‌کند. این رخداد در قیمتی بر مبنای مارک پرایس انجام می‌شود، پس مرجعِ هموارشده را دنبال می‌کند نه آخرین معاملهٔ خام. شیوهٔ تحققِ ضرر — از طریق موتورِ لیکوئیدیشن صرافی یا حراجِ سپرِ پشتیبان — و این‌که جریمه‌ای اعمال می‌شود یا نه، بر اساس صرافی فرق می‌کند.'
    ),
    lessons: ['isolated-vs-cross-margin', 'margin-and-leverage-basics'],
    tool: 'liquidation-price',
  },
  {
    slug: 'liquidation-price',
    sort: 17,
    term: text('Liquidation price', 'قیمت لیکوئیدیشن'),
    short: text('The mark price at which a position margin no longer meets the requirement.', 'قیمتِ مارکی که در آن وجهِ تضمینِ موقعیت دیگر نیاز را تأمین نمی‌کند.'),
    definition: text(
      'The liquidation price is the mark price at which a position remaining collateral falls to the maintenance-margin level and the venue closes it. It depends on entry price, leverage, the maintenance rate, the margin mode, and the fees and funding accumulated on the position, so it shifts over time rather than staying fixed. Isolated margin and cross margin produce different liquidation prices for the same trade.',
      'قیمتِ لیکوئیدیشن، قیمتِ مارکی است که در آن وثیقهٔ باقی‌ماندهٔ موقعیت تا سطحِ وجهِ تضمینِ نگهداری پایین می‌رود و صرافی آن را می‌بندد. این قیمت به قیمتِ ورود، اهرم، نرخِ نگهداری، حالتِ وجهِ تضمین و کارمزد و فاندینگِ انباشته‌شده روی موقعیت وابسته است، پس با گذشت زمان جابه‌جا می‌شود و ثابت نمی‌ماند. وجهِ تضمینِ مجزا و متقاطع برای یک معاملهٔ یکسان، قیمت‌هایِ لیکوئیدیشنِ متفاوتی می‌سازند.'
    ),
    lessons: ['isolated-vs-cross-margin', 'stop-loss-placement'],
    tool: 'liquidation-price',
  },
  {
    slug: 'maintenance-margin',
    sort: 18,
    term: text('Maintenance margin', 'وجه تضمین نگهداری'),
    short: text('The minimum collateral a position must retain before it can be liquidated.', 'کمینهٔ وثیقه‌ای که موقعیت باید نگه دارد وگرنه لیکوئید می‌شود.'),
    definition: text(
      'Maintenance margin is the minimum collateral a position must keep in order to stay open; it is a floor, not the margin you initially post. The initial margin is what you commit to open the trade, but once the equity behind the position drops to the maintenance level, liquidation is triggered. The maintenance rate is a small percentage of notional and is set per venue and per instrument.',
      'وجهِ تضمینِ نگهداری کمینهٔ وثیقه‌ای است که یک موقعیت باید نگه دارد تا باز بماند؛ این یک کف است، نه وجهِ تضمینی که در ابتدا گذاشته‌اید. وجهِ تضمینِ اولیه همان چیزی است که برای بازکردن معامله اختصاص می‌دهید، ولی وقتی ارزشِ خالصِ پشتِ موقعیت تا سطحِ نگهداری برود، لیکوئیدیشن فعال می‌شود. نرخِ نگهداری کسرِ کوچکی از ارزشِ اسمی است و برای هر صرافی و هر نماد جدا تعیین می‌شود.'
    ),
    lessons: ['margin-and-leverage-basics', 'isolated-vs-cross-margin'],
    tool: 'leverage-margin',
  },
  {
    slug: 'maker-fee',
    sort: 19,
    term: text('Maker fee', 'کارمزد میکر'),
    short: text('The lower fee for a resting order that adds liquidity to the book.', 'کارمزدِ پایین‌تر برای سفارشِ نشسته‌ای که به دفتر نقدینگی اضافه می‌کند.'),
    definition: text(
      'A maker fee is charged when your order rests in the book and is later taken by someone else, adding liquidity rather than removing it. Venues set it below the taker fee to reward orders that deepen the book. The exact rate, and whether makers pay anything at all, differ by exchange and often by volume tier.',
      'کارمزد میکر وقتی به شما تعلق می‌گیرد که سفارش‌تان در دفتر بنشیند و بعداً دیگری آن را بردارد؛ یعنی شما نقدینگی اضافه کرده‌اید نه این‌که آن را برداشته‌اید. صرافی‌ها این کارمزد را پایین‌تر از کارمزدِ تیکر می‌گذارند تا به سفارش‌های عمق‌ساز پاداش دهند. نرخِ دقیق و این‌که آیا اصلاً هزینه‌ای برای سازندگان هست، بر اساس صرافی و اغلب بر اساس ردهٔ حجم فرق می‌کند.'
    ),
    lessons: ['fees-slippage-open-interest', 'order-types-and-order-books'],
    tool: 'perp-pnl',
  },
  {
    slug: 'margin',
    sort: 20,
    term: text('Margin', 'وجه تضمین'),
    short: text('The collateral you post to open and hold a leveraged position.', 'وثیقه‌ای که برای بازکردن و نگه‌داشتن یک موقعیت اهرم‌دار می‌گذارید.'),
    definition: text(
      'Margin is the collateral you lock up to open and keep a leveraged position; it is not a fee and not the full cost of the trade. Its size relative to the notional sets your leverage, and the maintenance-margin floor built from it decides how far price can move against you before liquidation. Some models treat margin as deducted from balance, while others reserve it without reducing the balance, so check which one your account uses.',
      'وجهِ تضمین وثیقه‌ای است که برای بازکردن و نگه‌داشتن یک موقعیت اهرم‌دار قفل می‌کنید؛ نه کارمزد است و نه کلِ هزینهٔ معامله. نسبتِ آن به ارزشِ اسمی اهرم شما را تعیین می‌کند و همان وجهِ تضمین، همراه با کفِ نگهداری، مشخص می‌کند قیمت تا کجا می‌تواند علیه شما برود پیش از این‌که لیکوئید شوید. در بعضی مدل‌ها وجهِ تضمین از موجودی کسر می‌شود و در بعضی بدون کاهشِ موجودی رزرو می‌گردد، پس ببینید حسابتان از کدام استفاده می‌کند.'
    ),
    lessons: ['margin-and-leverage-basics', 'perps-how-they-work'],
    tool: 'leverage-margin',
  },
  {
    slug: 'mark-price',
    sort: 21,
    term: text('Mark price', 'مارک پرایس'),
    short: text('The venue contract valuation used to compute PnL and trigger liquidation.', 'ارزش‌گذاریِ صرافی از قرارداد که مبنای محاسبهٔ PnL و لیکوئیدیشن است.'),
    definition: text(
      'The mark price is the price a venue uses to value a position: unrealized PnL, margin requirements and liquidation checks all read it. It is built as the index price plus a bounded basis — typically a moving average of that basis — so it moves smoothly and is hard to push with one aggressive trade. The tradable last price can briefly differ from the mark; the mark, not the last print, decides whether you are liquidated.',
      'مارک پرایس قیمتی است که صرافی برای ارزش‌گذاری موقعیت به کار می‌برد: سود و زیانِ شناور، نیازِ وجهِ تضمین و بررسیِ لیکوئیدیشن همه آن را می‌خوانند. این عدد از ایندکس به‌اضافهٔ یک بیسیسِ محدود ساخته می‌شود — معمولاً میانگینِ متحرکِ همان بیسیس — پس هموار حرکت می‌کند و هل‌دادنش با یک سفارشِ تهاجمی دشوار است. آخرین قیمتِ قابل‌معامله ممکن است لحظاتی با مارک فرق کند؛ اما مارک است، نه آخرین معامله، که تعیین می‌کند لیکوئید می‌شوید یا نه.'
    ),
    lessons: ['mark-price-vs-index-price', 'funding-rate-explained'],
    tool: 'liquidation-price',
  },
  {
    slug: 'market-order',
    sort: 22,
    term: text('Market order', 'سفارش بازار'),
    short: text('An order that executes immediately against the best available price.', 'سفارشی که فوراً در بهترین قیمتِ در دسترس اجرا می‌شود.'),
    definition: text(
      'A market order executes at once by taking whatever the order book offers until its size is filled, trading a guaranteed fill for no guaranteed price. Because it removes resting liquidity it pays the higher taker fee, and a large market order in a thin book walks several price levels, producing slippage. Use it when getting in or out matters more than the exact print.',
      'سفارشِ بازار بلافاصله با برداشتنِ هرچه دفتر سفارش تا پرشدنِ حجم ارائه می‌کند اجرا می‌شود؛ یعنی اجرایِ تضمین‌شده را بهای قیمتی می‌دهد که تضمین‌شده نیست. چون نقدینگیِ نشسته را برمی‌دارد، کارمزدِ بالاترِ تیکر را می‌پردازد و سفارشِ بازارِ بزرگ در دفتری کم‌عمق چند سطحِ قیمتی را می‌پیماید و اسلیپیج می‌سازد. وقتی ورود یا خروج مهم‌تر از قیمتِ دقیق است، از آن استفاده کنید.'
    ),
    lessons: ['order-types-and-order-books'],
  },
  {
    slug: 'max-drawdown',
    sort: 23,
    term: text('Maximum drawdown', 'حداکثر افت'),
    short: text('The largest peak-to-trough fall in account value over a period.', 'بزرگ‌ترین افتِ ارزشِ حساب از قله تا دره در یک بازه.'),
    definition: text(
      'Maximum drawdown is the largest decline from a peak to the following trough in account value, expressed as a percentage of that peak. It measures depth, not duration, and recovery is asymmetric: a drawdown of size d needs a gain of d / (1 − d), which equals 1 / (1 − d) − 1, so a 50% drawdown requires a 100% gain just to break even. Many firms express a total loss limit as a maximum-drawdown rule, sometimes trailing a high-water mark rather than a fixed starting value.',
      'حداکثرِ افت، بزرگ‌ترینِ کاهش از یک قله تا درهٔ پس از آن در ارزشِ حساب است که به‌صورت درصدی از همان قله بیان می‌شود. این معیار عمق را می‌سنجد نه مدت را، و بازگشت نامتقارن است: افتی به بزرگیِ d برای جبران به سودی به اندازهٔ d / (۱ − d) نیاز دارد — همان ۱ / (۱ − d) − ۱ — پس یک افتِ ۵۰٪ی برای سربه‌سرشدن به سودِ ۱۰۰٪ نیازمند است. بسیاری از شرکت‌ها سقفِ ضررِ کل را به‌شکلِ قاعدهٔ حداکثرِ افت بیان می‌کنند؛ گاهی این قاعده به‌صورتِ شناور یک سطح اوج را دنبال می‌کند نه مقدارِ ثابتِ شروع را.'
    ),
    lessons: ['drawdown-and-high-water-mark', 'sizing-for-survival'],
    tool: 'prop-drawdown',
  },
  {
    slug: 'notional-value',
    sort: 24,
    term: text('Notional value', 'ارزش اسمی'),
    short: text('The full market size of a position: quantity multiplied by price.', 'اندازهٔ کاملِ بازارِ یک موقعیت: حجم ضرب‌در قیمت.'),
    definition: text(
      'Notional value is the full market size of a position, equal to the quantity held multiplied by its price, not the money you actually put in. It is the base on which fees, funding and the maintenance-margin requirement are calculated, so it matters more than your margin for cost arithmetic. You get it by multiplying the margin you post by your leverage.',
      'ارزشِ اسمی اندازهٔ کاملِ بازارِ یک موقعیت است: حجمِ نگه‌داشته‌شده ضرب‌در قیمت، نه پولی که واقعاً وارد کرده‌اید. این عدد مبنای محاسبهٔ کارمزد، فاندینگ و نیازِ وجهِ تضمینِ نگهداری است، پس در حسابِ هزینه مهم‌تر از خودِ وجهِ تضمین به شمار می‌آید. آن را با ضرب‌کردنِ وجهِ تضمینِ گذاشته‌شده در اهرم به دست می‌آورید.'
    ),
    lessons: ['margin-and-leverage-basics', 'perps-how-they-work'],
    tool: 'position-size',
  },
  {
    slug: 'open-interest',
    sort: 25,
    term: text('Open interest', 'اوپن اینترست'),
    short: text('The total value of contracts still open across all positions.', 'ارزشِ کلِ قراردادهایی که هنوز در همهٔ موقعیت‌ها باز مانده‌اند.'),
    definition: text(
      'Open interest is the total number or value of contracts that remain open. Every long must be matched by a short, so it counts both sides and never favours one: rising open interest with price signals new money entering, while falling open interest signals positions being closed. It measures how crowded a market is, not which way it will move, and not every data feed exposes it.',
      'اوپن اینترست تعداد یا ارزشِ کلِ قراردادهایی است که هنوز باز مانده‌اند. برای هر خرید یک فروشِ جفت لازم است، پس هر دو سمت را می‌شمارد و هرگز به یک سو گرایش ندارد: اوپن اینترستِ رو به بالا همراه قیمت می‌گوید پولِ تازه وارد شده و رو به پایین می‌گوید موقعیت‌ها بسته می‌شوند. این عدد میزانِ ازدحام بازار را می‌سنجد نه جهتِ حرکتش را، و هر فیدِ داده‌ای آن را در اختیار نمی‌گذارد.'
    ),
    lessons: ['fees-slippage-open-interest'],
  },
  {
    slug: 'order-book',
    sort: 26,
    term: text('Order book', 'دفتر سفارش'),
    short: text('The live list of resting bids and asks that turns orders into fills.', 'فهرستِ زندهٔ پیشنهادها و تقاضاهای نشسته که سفارش‌ها را به معامله بدل می‌کند.'),
    definition: text(
      'The order book is the live list of resting buy bids and sell asks at each price level, matching willing buyers with willing sellers. The gap between the best bid and best ask is the spread, and the quantity stacked at each level is the depth that determines how far a market order moves the price. A venue may expose the book and trade tape publicly, but a market-data feed for price alone does not include this depth.',
      'دفترِ سفارش فهرستِ زندهٔ پیشنهادِ خرید و درخواستِ فروشِ نشسته در هر سطحِ قیمتی است که خریدار و فروشندهٔ حاضر را جفت می‌کند. فاصلهٔ میانِ بهترین پیشنهاد و بهترین درخواست همان اسپرد است و حجمِ انباشته‌شده در هر سطح، عمقی است که تعیین می‌کند سفارشِ بازار چقدر قیمت را جابه‌جا کند. یک صرافی ممکن است دفتر و نوارِ معاملات را عمومی کند، اما فیدِ داده فقط برای قیمت این عمق را شامل نمی‌شود.'
    ),
    lessons: ['order-types-and-order-books', 'fees-slippage-open-interest'],
  },
  {
    slug: 'perpetual-future',
    sort: 27,
    term: text('Perpetual future', 'معامله آنی (پرپچوآل)'),
    short: text('A leveraged, margin-based contract on price that never expires.', 'قراردادِ اهرم‌دار و وجه‌تضمین‌محور روی قیمت که هرگز سررسید نمی‌شود.'),
    definition: text(
      'A perpetual future is a leveraged, collateralised contract that settles against an underlying price but has no expiry date, so you can hold it indefinitely. With no delivery date to force convergence, it relies on the funding rate between longs and shorts to keep its price near the index. You never own the underlying asset; you hold a position whose value tracks the price up or down.',
      'معاملهٔ آنی یا پرپچوآل قراردادی اهرم‌دار و وثیقه‌محور است که نسبت به قیمتِ داراییِ پایه تسویه می‌شود ولی تاریخِ سررسید ندارد، پس می‌توانید تا بی‌نهایت نگهش دارید. چون تاریخِ تحویلی برای اجبارِ همگرایی وجود ندارد، به نرخِ فاندینگ میانِ خریدار و فروشنده تکیه می‌کند تا قیمتش را نزدیکِ ایندکس نگه دارد. شما خودِ دارایی را هرگز ندارید؛ فقط موقعیتی دارید که ارزشش با قیمت بالا یا پایین می‌رود.'
    ),
    lessons: ['perps-how-they-work', 'funding-rate-explained'],
    tool: 'perp-pnl',
  },
  {
    slug: 'position-size',
    sort: 28,
    term: text('Position size', 'اندازه موقعیت'),
    short: text('How many units or how much notional to put into a single trade.', 'این‌که در یک معامله چند واحد یا چه ارزشِ اسمی وارد کنید.'),
    definition: text(
      'Position size is the amount — units or notional value — you commit to one trade. In risk-based sizing you choose it so that the distance to your stop-loss costs a fixed fraction of the account, which makes the loss per trade the controllable variable rather than the market. Sizing, not entry accuracy, is what mainly determines whether a streak of losses stays survivable.',
      'اندازهٔ موقعیت مبلغی است — به واحد یا ارزشِ اسمی — که در یک معامله وارد می‌کنید. در تعیینِ اندازهٔ ریسک‌محور آن را چنان انتخاب می‌کنید که فاصله تا حدِ ضرر کسرِ ثابتی از حساب را هزینه کند؛ بدین‌ترتیب متغیرِ قابل‌کنترل، ضررِ هر معامله است نه بازار. این اندازهٔ موقعیت است، نه دقتِ ورود، که عمدتاً تعیین می‌کند یک رشتهٔ زیان قابل‌تحمل می‌ماند یا نه.'
    ),
    lessons: ['sizing-for-survival', 'margin-and-leverage-basics'],
    tool: 'position-size',
  },
  {
    slug: 'profit-factor',
    sort: 29,
    term: text('Profit factor', 'ضریب سود'),
    short: text('Gross profit divided by gross loss across a set of trades.', 'سودِ ناخال تقسیم‌بر زیانِ ناخال در یک دسته معامله.'),
    definition: text(
      'Profit factor is gross profit divided by gross loss over a set of trades. A value above 1 means the wins outweigh the losses and the record is net positive; a value below 1 means it is net negative. It measures the ratio of good to bad results but ignores timing, so a high profit factor can still hide a deep drawdown.',
      'ضریبِ سود همان سودِ ناخال تقسیم‌بر زیانِ ناخال در یک دستهٔ معاملاتی است. مقداری بیش از ۱ می‌گوید سودها بر زیان‌ها غلبه دارند و سابقه خالصاً مثبت است، و مقدارِ زیر ۱ یعنی خالصاً منفی. این معیار نسبتِ نتایجِ خوب به بد را می‌سنجد ولی زمان‌بندی را نادیده می‌گیرد، پس ضریبِ سودِ بالا همچنان می‌تواند افتی عمیق را پنهان کند.'
    ),
    lessons: ['trading-journal-that-works'],
    tool: 'journal-analyzer',
  },
  {
    slug: 'proof-of-reserves',
    sort: 30,
    term: text('Proof of reserves', 'اثبات ذخایر'),
    short: text('A published cryptographic check that held assets cover customer liabilities.', 'راستی‌آزماییِ رمزنگاری‌شدهٔ منتشرشده که می‌گوید داراییِ نگه‌داشته بدهیِ کاربران را پوشش می‌دهد.'),
    definition: text(
      'Proof of reserves is a disclosure in which a venue publishes cryptographic evidence — commonly a Merkle-tree snapshot of on-chain assets against anonymous user balances — that the assets it holds at least cover what it owes users. It speaks only to assets held versus liabilities owed at a moment in time: it does not prove solvency overall, because it omits off-chain debt, loans and the timing between snapshots. Openfund makes no proof-of-reserves claim in this release; the Transparency page shows explicitly labelled sample data, not live reserves or an audit.',
      'اثباتِ ذخایر شکلی از افشاست که در آن صرافی مدرکِ رمزنگاری‌شده — معمولاً تصویرِ درختِ مرکل از دارایی‌های آن‌چین در برابر موجودیِ ناشناسِ کاربران — منتشر می‌کند تا نشان دهد داراییِ نگه‌داشته‌شده دستِ کم بدهیِ کاربران را پوشش می‌دهد. این ادعا فقط به مقایسهٔ داراییِ نگهداری‌شده با بدهی در یک لحظه می‌گوید و کلِ توانِ مالی را اثبات نمی‌کند، چون بدهی و وامِ خارجِ زنجیره و زمانِ میانِ تصویربرداری‌ها را حذف می‌کند. اوپن‌فاند در این نسخه هیچ ادعایِ اثباتِ ذخایری ندارد؛ صفحهٔ شفافیت دادهٔ نمونهٔ صریحاً برچسب‌دار را نشان می‌دهد، نه ذخایرِ زنده یا یک حسابرسی.'
    ),
    lessons: ['proof-of-reserves-explained', 'limits-of-onchain-transparency'],
  },
  {
    slug: 'risk-of-ruin',
    sort: 31,
    term: text('Risk of ruin', 'ریسک ورشکستگی'),
    short: text('The statistical probability of losing so much that recovery is impossible.', 'احتمالِ آماریِ از دست دادنِ چنان مبلغی که بازگشت ممکن نباشد.'),
    definition: text(
      'Risk of ruin is the probability that losses drive an account to a point from which it can no longer keep trading. It grows with per-trade risk and with how negative or thin your edge is, and shrinks as the bankroll grows relative to each bet. It is a statistical estimate under explicit model assumptions — fixed bet size, a given win rate and independent trades — so a low figure is not a guarantee, and a change in behaviour can invalidate the model.',
      'ریسکِ ورشکستگی احتمالِ این است که زیان‌ها حساب را به نقطه‌ای برسانند که دیگر امکانِ ادامهٔ معامله نباشد. این ریسک با افزایشِ ریسکِ هر معامله و با منفی یا نازک بودنِ مزیت بزرگ می‌شود و با رشدِ سرمایه نسبت به هر شرط کوچک می‌گردد. این عدد تخمینِ آماری زیرِ فرض‌های صریحِ مدل است — اندازهٔ ثابتِ شرط، نرخِ بردِ مشخص و استقلالِ معاملات — پس رقمِ پایین تضمین نیست و تغییرِ رفتار می‌تواند مدل را بی‌اعتبار کند.'
    ),
    lessons: ['sizing-for-survival', 'risk-management-on-a-funded-account'],
    tool: 'risk-of-ruin',
  },
  {
    slug: 'slippage',
    sort: 32,
    term: text('Slippage', 'اسلیپیج'),
    short: text('The gap between the price you expected and the price you actually got.', 'فاصلهٔ میانِ قیمتی که انتظار داشتید و قیمتی که گرفتید.'),
    definition: text(
      'Slippage is the difference between the price you expected when you placed an order and the average price you were actually filled at. It grows when your size is large relative to order-book depth or when the market moves fast, because a market order must then walk more levels. Limit orders and smaller, split entries reduce it, but a fill can then be partial or missed instead.',
      'اسلیپیج تفاوتِ میانِ قیمتی است که هنگام ثبتِ سفارش انتظار داشتید با میانگینِ قیمتی که واقعاً در آن اجرا شدید. وقتی حجمِ شما نسبت به عمقِ دفتر بزرگ باشد یا بازار تند حرکت کند، اسلیپیج بیشتر می‌شود، چون سفارشِ بازار باید پله‌های بیشتری بردارد. سفارشِ لیمیت و ورودهای کوچک‌تر و خردشده آن را کم می‌کنند، ولی آنگاه ممکن است اجرا ناقص بماند یا اصلاً رخ ندهد.'
    ),
    lessons: ['fees-slippage-open-interest', 'order-types-and-order-books'],
    tool: 'perp-pnl',
  },
  {
    slug: 'smart-contract',
    sort: 33,
    term: text('Smart contract', 'قرارداد هوشمند'),
    short: text('Program code deployed on a blockchain that runs when its conditions are met.', 'کدِ برنامه‌ای روی بلاک‌چین که وقتی شرایطش فراهم شود اجرا می‌شود.'),
    definition: text(
      'A smart contract is program code deployed on a blockchain that carries out predefined rules automatically when its conditions are met, with its logic and storage visible on-chain. Anyone can read the deployed bytecode and events, but visible code is not the same as verified or safe: it may be unverified on an explorer, upgradeable through a proxy, or hold privileges that let it change balances. Treat a contract behaviour as exactly what its published, verified source shows — nothing more.',
      'قراردادِ هوشمند کدِ برنامه‌ای است که روی بلاک‌چین استقرار می‌یابد و وقتی شرایطِ از پیش تعریف‌شده‌اش برقرار شود قواعد را خودکار اجرا می‌کند؛ منطق و ذخیره‌اش روی زنجیره دیده می‌شود. هرکس می‌تواند بایت‌کد و رویدادهای مستقرشده را بخواند، ولی دیدنِ کد با تأییدشده یا امن بودن فرق دارد: ممکن است در اکسپلورر تأیید نشده باشد، از طریق پروکسی قابل ارتقا باشد یا اختیاراتی داشته باشد که بتواند موجودی‌ها را تغییر دهد. رفتارِ قرارداد را دقیقاً همان‌قدر بدانید که منبعِ تأییدشدهٔ منتشرشده‌اش نشان می‌دهد — نه بیشتر.'
    ),
    lessons: ['smart-contracts-and-the-terminal', 'reading-a-block-explorer'],
  },
  {
    slug: 'spread',
    sort: 34,
    term: text('Spread', 'اسپرد'),
    short: text('The gap between the best available buy price and sell price.', 'فاصلهٔ میانِ بهترین قیمتِ خرید و بهترین قیمتِ فروشِ در دسترس.'),
    definition: text(
      'The spread is the difference between the best bid a buyer will pay and the best ask a seller will accept, so a round trip crosses it twice. It is a core cost of trading: a market order pays the spread immediately, while a limit order placed inside it can capture part of it. Spreads widen in thin or fast markets and vary by instrument and venue, so the same asset is not equally cheap to trade everywhere.',
      'اسپرد اختلافِ میانِ بهترین پیشنهادِ خریداری است که حاضر است بپردازد با بهترین درخواستِ فروشنده‌ای که می‌پذیرد؛ پس یک رفت‌وبرگشت دو بار از آن عبور می‌کند. این یکی از هزینه‌های بنیادینِ معامله است: سفارشِ بازار همان لحظه اسپرد را می‌پردازد، اما سفارشِ لیمیتِ درونِ آن می‌تواند بخشی‌اش را بگیرد. اسپرد در بازارهای کم‌عمق یا تند گشاد می‌شود و بر اساس نماد و صرافی فرق می‌کند، پس یک دارایی در همه‌جا به یک اندازه ارزان معامله نمی‌شود.'
    ),
    lessons: ['order-types-and-order-books', 'fees-slippage-open-interest'],
    tool: 'risk-reward',
  },
  {
    slug: 'stop-loss',
    sort: 35,
    term: text('Stop-loss', 'حد ضرر'),
    short: text('A preset order that closes a position once price reaches a loss level.', 'سفارشِ از پیش تعیین‌شده‌ای که با رسیدنِ قیمت به سطحِ زیان موقعیت را می‌بندد.'),
    definition: text(
      'A stop-loss is a trigger you set in advance that closes a position once the price reaches a defined loss level, converting into a market or limit order at that point. It caps how far a single trade can hurt you, but because the triggered order then enters the market, the exit price is not guaranteed: in a gap or a fast move the fill can be worse than your stop. Where and how tightly to place it — manual versus a hard order, and which price the trigger reads — depend on the venue rules.',
      'حدِ ضرر ماشه‌ای است که از پیش می‌چینید و وقتی قیمت به سطحِ زیانِ مشخصی برسد موقعیت را می‌بندد؛ در آن لحظه به سفارشِ بازار یا لیمیت بدل می‌شود. این سفارش مشخص می‌کند یک معامله حداکثر چقدر می‌تواند به شما آسیب بزند، اما چون سفارشِ فعال‌شده آنگاه وارد بازار می‌شود، قیمتِ خروج تضمین‌شده نیست: در یک گپ یا حرکتِ تند، اجرا می‌تواند بدتر از حدِ شما باشد. جای و شدتِ قرار دادنِ آن — دستی در برابر سفارشِ سخت، و این‌که ماشه کدام قیمت را می‌خواند — به قواعدِ صرافی بستگی دارد.'
    ),
    lessons: ['stop-loss-placement', 'order-types-and-order-books'],
    tool: 'risk-reward',
  },
  {
    slug: 'take-profit',
    sort: 36,
    term: text('Take-profit', 'حد سود'),
    short: text('A preset order that closes a position once price reaches a gain level.', 'سفارشِ از پیش تعیین‌شده‌ای که با رسیدنِ قیمت به سطحِ سود موقعیت را می‌بندد.'),
    definition: text(
      'A take-profit is a trigger set in advance that closes a position once the price reaches a chosen gain level, locking in the result without you having to act. Like a stop-loss it turns into an order at its trigger, so a limit take-profit may fill only if price actually reaches it and a market take-profit fills at whatever is available. Placing it too close surrenders upside; the distance between take-profit and stop-loss sets the trade reward-to-risk ratio.',
      'حدِ سود ماشه‌ای است که از پیش تعیین می‌کنید و وقتی قیمت به سطحِ سودِ برگزیده برسد موقعیت را می‌بندد تا نتیجه را بدونِ دخالتِ شما تثبیت کند. همانند حدِ ضرر، در نقطهٔ ماشه به سفارش بدل می‌شود؛ پس حدِ سودِ لیمیتی فقط در صورتی اجرا می‌شود که قیمت واقعاً به آن برسد و حدِ سودِ بازاری در هر قیمتِ در دسترس اجرا می‌گردد. قرار دادنش بیش از حد نزدیک، پتانسیلِ سود را می‌بازد؛ فاصلهٔ میانِ حدِ سود و حدِ ضرر، نسبتِ پاداش به ریسکِ معامله را می‌سازد.'
    ),
    lessons: ['stop-loss-placement'],
    tool: 'risk-reward',
  },
  {
    slug: 'taker-fee',
    sort: 37,
    term: text('Taker fee', 'کارمزد تیکر'),
    short: text('The higher fee for an order that takes liquidity off the book.', 'کارمزدِ بالاتر برای سفارشی که نقدینگی را از دفتر برمی‌دارد.'),
    definition: text(
      'A taker fee is charged when your order crosses the spread and matches existing resting orders, removing liquidity from the book. Venues price it above the maker fee to discourage draining depth. Market orders are the typical taker, but any resting order you lift pays the taker fee too, and the exact rate varies by exchange and volume tier.',
      'کارمزد تیکر وقتی گرفته می‌شود که سفارشِ شما از اسپرد بگذرد و با سفارش‌های نشستهٔ موجود جفت شود و نقدینگی را از دفتر بردارد. صرافی‌ها آن را بالاتر از کارمزدِ میکر قیمت‌گذاری می‌کنند تا از تخلیهٔ عمق جلوگیری کنند. سفارشِ بازار نمونهٔ رایجِ تیکر است، اما هر سفارشِ نشسته‌ای هم که شما بردارید همین کارمزد را می‌پردازد و نرخِ دقیقش بر اساس صرافی و ردهٔ حجم فرق می‌کند.'
    ),
    lessons: ['fees-slippage-open-interest'],
    tool: 'perp-pnl',
  },
  {
    slug: 'trailing-drawdown',
    sort: 38,
    term: text('Trailing drawdown', 'افت شناور'),
    short: text('A loss limit that follows a rising high-water mark instead of a fixed value.', 'سقفِ ضرری که به‌جای مقدارِ ثابت، سطح اوجِ در حال رشد را دنبال می‌کند.'),
    definition: text(
      'Trailing drawdown is a moving loss limit that follows the account high-water mark instead of a fixed starting value, keeping a constant distance below the peak. As profit lifts the peak, the limit rises with it and the allowable cushion does not grow, so the rule tightens as you win. Some versions lock at breakeven once the account is in profit and may not reset after a payout; the exact behaviour is defined per venue and per plan.',
      'افتِ شناور سقفِ ضرری متحرک است که به‌جای مقدارِ ثابتِ شروع، سطح اوجِ حساب را دنبال می‌کند و فاصله‌ای ثابت زیرِ قله نگه می‌دارد. هرچه سود قله را بالا ببرد این سقف هم بالا می‌رود و بالشتکِ مجاز بزرگ‌تر نمی‌شود، پس با بردهایتان قاعده سخت‌تر می‌گردد. بعضی نسخه‌ها وقتی حساب واردِ سود شد در نقطهٔ سربه‌سر قفل می‌شوند و ممکن است پس از برداشت بازنشانی نشوند؛ رفتارِ دقیق به تعریفِ هر صرافی و هر پلن بستگی دارد.'
    ),
    lessons: ['drawdown-and-high-water-mark', 'funded-accounts-how-they-work'],
    tool: 'prop-drawdown',
  },
  {
    slug: 'unrealized-pnl',
    sort: 39,
    term: text('Unrealized PnL', 'سود و زیان شناور'),
    short: text('Floating profit or loss on open positions that price has not yet made final.', 'سود یا زیانِ شناورِ موقعیت‌های باز که قیمت هنوز قطعی‌اش نکرده است.'),
    definition: text(
      'Unrealized PnL is the current profit or loss on positions you still hold, recomputed on each price change and not yet booked to the balance. It moves equity up or down in real time and can affect margin and liquidation checks before you close anything, yet it is provisional — it reverses if price reverses. It becomes realized only when the position closes and the final price and fees are settled.',
      'سود و زیانِ شناور سود یا زیانِ فعلیِ موقعیت‌هایی است که هنوز باز نگه داشته‌اید؛ با هر تغییرِ قیمت دوباره محاسبه می‌شود و هنوز در موجودی ثبت نشده است. این عدد ارزشِ خالص را لحظه‌به‌لحظه بالا یا پایین می‌برد و پیش از بستنِ هر چیزی می‌تواند بر وجهِ تضمین و بررسیِ لیکوئیدیشن اثر بگذارد، ولی موقتی است — اگر قیمت برگردد، آن هم برمی‌گردد. تنها وقتی محقق می‌شود که موقعیت بسته شود و قیمتِ نهایی و کارمزدها تسویه گردند.'
    ),
    lessons: ['margin-and-leverage-basics', 'drawdown-and-high-water-mark'],
    tool: 'perp-pnl',
  },
  {
    slug: 'win-rate',
    sort: 40,
    term: text('Win rate', 'نرخ برد'),
    short: text('The share of trades that close in profit out of all closed trades.', 'سهمِ معاملاتی که از مجموعِ معاملاتِ بسته‌شده در سود پایان می‌یابند.'),
    definition: text(
      'Win rate is the percentage of closed trades that end in profit. On its own it says little: a 90% win rate with small wins and large losses can lose money, while a 40% win rate with larger average wins can profit. Its real meaning comes paired with average win and average loss, because those two — not the win rate alone — decide expectancy.',
      'نرخ برد درصدِ معاملاتِ بسته‌شده‌ای است که با سود تمام می‌شوند. این عدد به‌تنهایی حرفِ کمی دارد: نرخِ بردِ ۹۰٪ با سودهایِ کوچک و زیان‌هایِ بزرگ می‌تواند پول از دست بدهد، در حالی‌که نرخِ بردِ ۴۰٪ با سودهایِ میانگینِ بزرگ‌تر می‌تواند سودآور باشد. معنایِ واقعیِ آن در کنارِ میانگینِ سود و میانگینِ زیان روشن می‌شود، چون همین دو — نه نرخِ بردِ تنها — امیدِ ریاضی را تعیین می‌کنند.'
    ),
    lessons: ['trading-journal-that-works', 'sizing-for-survival'],
    tool: 'journal-analyzer',
  },
]
