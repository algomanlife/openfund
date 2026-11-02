import { text } from '../../../features/information/content'
import type { LearningPathContent } from '../../contentTypes'

/** Learning Center - Path D: Trading process and psychology.
 *  Repo authoring source for the practitioner path on process, record-keeping,
 *  discipline and the mental handling of losses and automation. It is process
 *  and risk control only: nothing here is investment advice, no strategy is
 *  recommended, and no lesson claims that journaling, checklists or discipline
 *  lead to profit or to a funded account. Openfund-specific claims stay inside
 *  the verified set - the app ships a trading journal and a portfolio dashboard
 *  fed by the server account records plus a CSV-based journal analyzer in the
 *  Tools Center; Prop Trading runs one server-side simulated demo funded once
 *  with 100,000 virtual DAI at live Gains Network mark prices, with purchase
 *  activation, funded accounts and payouts not enabled in this release, a daily
 *  loss measured against the higher of day-start balance or equity that resets
 *  at 00:00 UTC+3 where touching a limit is a breach, and a consistency payout
 *  condition of 35% on the monthly path and 15% on Instant; the market-data
 *  source gives no order-book depth, open interest or trade tape, so those are
 *  shown as unavailable and never estimated; Perpetual Trading is read-only and
 *  on-chain execution is not enabled. NOT imported by the app at runtime. */
export const pathD: LearningPathContent = {
  key: 'process',
  slug: 'trading-process-and-psychology',
  sort: 4,
  level: 'practitioner',
  eyebrow: text('Path D · Process', 'مسیر D · فرآیند و روان'),
  title: text('Trading process and psychology', 'فرآیند معامله‌گری و روان‌شناسی'),
  summary: text(
    'Results arrive before their reasons do, so a trader needs a process that records, measures and holds the line independently of how any single trade felt. This path builds that process: a journal that gets used, a checklist that keeps decisions clean, an honest handling of losses, a clear border between rules and judgment, and realistic limits on what automation can promise.',
    'نتیجه زودتر از دلیلش می‌رسد، پس معامله‌گر به فرآیندی نیاز دارد که فارغ از حسِ هر معامله، ثبت می‌کند، می‌سنجد و خط را نگه می‌دارد. این مسیر همان فرآیند را می‌سازد: ژورنالی که واقعاً پر می‌شود، چک‌لیستی که تصمیم را سالم نگه می‌دارد، مواجههٔ صادقانه با ضرر، مرزِ روشنِ قاعده و سلیقه، و مرزهای واقع‌بینانهٔ آنچه خودکارسازی می‌تواند وعده دهد.'
  ),
  outcomes: [
    text('you can define a journal schema whose fields turn trades into the metrics you actually read: net pnl, win rate, profit factor, expectancy, drawdown', 'می‌توانی ساختار ژورنالی را تعریف کنی که فیلدهایش معامله را به سنجه‌های واقعاً خواندنی تبدیل می‌کند: سود خالص، نرخ برد، ضریب سود، expectancy و دراودان'),
    text('you can separate a good decision from a good outcome and judge discipline over a sample, not a session', 'می‌توانی تصمیمِ خوب را از نتیجهٔ خوب جدا کنی و نظم را روی یک نمونه بسنجی، نه روی یک جلسه'),
    text('you can describe how losses feel, how a losing streak looks in the numbers, and what keeps the reaction inside the limits', 'می‌توانی توضیح دهی ضرر چه حسی دارد، رگبارِ ضرر در اعداد چه شکلی است و چه چیزی واکنش را داخلِ سقف نگه می‌دارد'),
    text('you can say when to follow a rule and when judgment is legitimate - and why an automated system still inherits the account risk limits', 'می‌توانی بگویی کِی قاعده را رعایت کنی و کِی سلیقه مشروع است — و چرا یک سیستم خودکار همچنان سقف‌های ریسک حساب را به ارث می‌برد'),
  ],
  lessons: [
    {
      slug: 'trading-journal-that-works',
      path: 'trading-process-and-psychology',
      sort: 1,
      minutes: 9,
      status: 'published',
      title: text('A trading journal that actually gets used', 'ژورنال معاملاتی که واقعاً استفاده می‌شود'),
      summary: text(
        'A journal earns its place only when the fields you record become numbers you act on, so this lesson fixes a minimum schema, the metrics it yields, and the sample-size warning that stops you over-reading ten trades.',
        'ژورنال فقط وقتی جای خودش را پیدا می‌کند که فیلدهای ثبت‌شده به اعدادی تبدیل شوند که با آن‌ها تصمیم می‌گیری؛ پس این درس یک کمینهٔ ساختار ثابت می‌کند، سنجه‌هایی که می‌دهد و هشدارِ حجم نمونه را که نمی‌گذارد ده معامله را بیش از اندازه بخوانی.'
      ),
      takeaways: [
        text('Record a fixed set of fields every time - date, symbol, side, quantity, entry, exit, gross pnl, fees, plan, emotion tag and a screenshot link - so the metrics are always computable', 'هر بار یک مجموعهٔ ثابت فیلد ثبت کن — تاریخ، نماد، جهت، مقدار، ورود، خروج، سود ناخالص، کارمزد، پلن، برچسب احساس و پیوند اسکرین‌شات — تا سنجه‌ها همیشه محاسبه‌شدنی بمانند'),
        text('net pnl is gross pnl minus fees, and win rate, profit factor, expectancy and payoff ratio all read out of those same columns', 'سود خالص مساوی است با سود ناخالص منهای کارمزد، و نرخ برد، ضریب سود، expectancy و نسبت بازده همه از همان ستون‌ها بیرون می‌آیند'),
        text('A journal that keeps only the price, not the plan and the chart, stores the outcome but loses the reason - so it cannot teach you anything', 'ژورنالی که فقط قیمت را نگه دارد نه پلن و چارت، نتیجه را ذخیره می‌کند ولی دلیل را می‌بازد — پس چیزی نمی‌آموزد'),
        text('Metrics over a handful of trades are noise; read the distribution and the sample size before you read your behaviour into it', 'سنجه‌ها روی چند معامله، نویز است؛ پیش از آنکه رفتارت را از آن‌ها بخوانی، توزیع و حجم نمونه را بخوان'),
      ],
      glossary: ['expectancy', 'max-drawdown', 'high-water-mark'],
      tools: ['journal-analyzer', 'prop-drawdown'],
      blocks: [
        {
          type: 'p',
          text: text(
            'A trading journal is not a diary of feelings or a scoreboard of wins. It is a small, fixed table you fill the same way every time, so that weeks later you can compute a few numbers and change exactly one thing based on them. Its value comes entirely from consistency of recording: once the fields drift from trade to trade, every metric derived from them drifts too and the record quietly turns into decoration. The goal here is the smallest schema that still produces real metrics.',
            'ژورنال معاملاتی دفترِ احساسات یا تابلوی امتیازِ برد نیست. جدولی کوچک و ثابت است که هر بار به شیوه‌ای یکسان پرش می‌کنی، تا هفته‌ها بعد بتوانی چند عدد حساب کنی و دقیقاً یک چیز را بر پایه‌شان عوض کنی. ارزشش تماماً از نظمِ ثبت کردن می‌آید: لحظه‌ای که فیلدها از معامله‌ای به معاملهٔ دیگر لیز بخورند، همهٔ سنجه‌های مشتق‌شده از آن‌ها هم لیز می‌خورند و سابقه بی‌صدا به تزئینات تبدیل می‌شود. هدف اینجا، کمینهٔ ساختاری است که هنوز سنجه‌های واقعی تولید کند.'
          )
        },
        { type: 'h2', text: text('The fields that make the numbers possible', 'فیلدهایی که اعداد را ممکن می‌کنند') },
        {
          type: 'ul',
          items: [
            text('Date and time - so the trade can be placed on the equity curve and lined up with a session or a news window.', 'تاریخ و ساعت — تا معامله روی منحنی ارزش خالص بنشیند و با یک جلسه یا بازهٔ خبری هم‌تراز شود.'),
            text('Symbol and side - long or short - because the behaviour of the same idea differs across markets and directions.', 'نماد و جهت — خرید یا فروش — زیرا رفتارِ یک ایده در بازارها و جهت‌های مختلف فرق می‌کند.'),
            text('Quantity, entry price and exit price - the raw inputs behind every money figure that follows.', 'مقدار، قیمت ورود و قیمت خروج — داده‌های خامِ پشتِ هر عددِ پولی که می‌آید.'),
            text('Gross pnl, fees and net pnl - kept as three separate columns, not one blended number.', 'سود ناخالص، کارمزد و سود خالص — در سه ستونِ جدا، نه یک عددِ درهم.'),
            text('The plan you intended and a simple flag for whether you followed it.', 'پلنی که قصدش را داشتی و یک پرچم ساده برای اینکه رعایتش کردی یا نه.'),
            text('An emotion tag and a screenshot link - the two fields that carry the reason, not just the result.', 'برچسب احساس و پیوند اسکرین‌شات — دو فیلدی که دلیل را نگه می‌دارند، نه فقط نتیجه را.'),
          ]
        },
        {
          type: 'terms',
          items: [
            { term: text('Gross pnl', 'سود ناخالص'), text: text('The price difference times quantity, before any fee.', 'اختلافِ قیمت ضرب‌در مقدار، پیش از هر کارمزد.') },
            { term: text('Fees', 'کارمزد'), text: text('Every cost charged to open and close the position.', 'همهٔ هزینه‌هایی که برای باز و بسته کردن موقعیت گرفته می‌شود.') },
            { term: text('Net pnl', 'سود خالص'), text: text('Gross pnl after fees; the only figure that moves your balance.', 'سود ناخالص پس از کسرِ کارمزد؛ تنها عددی که موجودی‌ات را جابه‌جا می‌کند.') },
            { term: text('Win', 'برد'), text: text('A trade whose net pnl is greater than zero.', 'معامله‌ای که سود خالصش بزرگ‌تر از صفر است.') },
          ]
        },
        { type: 'h2', text: text('The metrics the schema produces', 'سنجه‌هایی که این ساختار می‌سازد') },
        { type: 'formula', expr: 'net_pnl = gross_pnl - fees', text: text('Every other metric should be built on net, never on gross, or a busy month of small trades looks profitable while the balance fell.', 'همهٔ سنجه‌های دیگر باید روی خالص ساخته شوند نه ناخالص، وگرنه ماهی پرمعامله با معاملات ریز سوداور به نظر می‌رسد در حالی که موجودی افت کرده.') },
        { type: 'formula', expr: 'win_rate = winning_trades / total_trades', text: text('The share of trades that close green. Useful as a single number, misleading on its own.', 'سهمِ معاملاتِ بسته‌شده به سود. به‌عنوان یک عدد مفید است و به‌تنهایی گمراه‌کننده.') },
        { type: 'formula', expr: 'profit_factor = gross_profit / gross_loss', text: text('Gross profit divided by gross loss. Above 1 means the winners outweigh the losers in money, whatever the win rate says.', 'سودِ ناخالص تقسیم بر زیانِ ناخالص. بزرگ‌تر از ۱ یعنی بردها از نظر پولی از باخت‌ها سنگین‌ترند، صرف‌نظر از اینکه نرخ برد چه می‌گوید.') },
        {
          type: 'p',
          text: text(
            'Those two together tell you more than either alone. A 70% win rate with a profit factor under 1 is a journal full of small wins and a few outsized losses - the signature of stops widened whenever a trader cannot bear to be wrong. Before you fix the losses you have to see that structure in the columns, which is why the schema separates quantity, entry, exit and fees instead of storing one blended result.',
            'این دو کنار هم بیشتر از هرکدام به‌تنهایی می‌گویند. نرخِ بردِ ۷۰٪ با ضریبِ سودِ زیرِ ۱، ژورنالی پر از بردهای کوچک و چند باختِ بی‌نسبت است — نشانهٔ حد ضررهایی که هر جا معامله‌گر تابِ اشتباه بودن ندارد عریض می‌شوند. پیش از درست کردنِ ضررها باید این ساختار را در ستون‌ها ببینی؛ و همین دلیلِ جدا نگه داشتنِ مقدار، ورود، خروج و کارمزد — به‌جای ذخیرهٔ یک نتیجهٔ درهم — است.'
          )
        },
        { type: 'formula', expr: 'expectancy_per_trade = (p x avg_win) - (q x avg_loss)', text: text('With p and q the win and loss rates and avg the average size of each: the amount one trade is worth on average.', 'با p و q به‌عنوان نرخِ برد و باخت و avg میانگینِ اندازهٔ هرکدام: میزانِ ارزشِ یک معامله در حالتِ میانگین.') },
        { type: 'formula', expr: 'payoff_ratio = avg_win / avg_loss', text: text('The average winner over the average loser. A low win rate with a high payoff ratio is a different process from a high win rate with a low one - neither is better without expectancy.', 'میانگینِ برد تقسیم بر میانگینِ باخت. نرخِ بردِ پایین با نسبتِ بازدهِ بالا، فرآیندی جداست از نرخِ بردِ بالا با نسبتِ پایین — بدون expectancy هیچ‌کدام بهتر نیست.') },
        { type: 'h2', text: text('Drawdown and streaks come from the same columns', 'دراودان و رگبارها از همان ستون‌ها می‌آیند') },
        { type: 'formula', expr: 'max_drawdown = max over time of (running_equity_peak - equity) / running_equity_peak', text: text('Measured down from the highest equity reached so far, not from the starting balance: the deepest fall a sequence of closes produced.', 'افت از بالاترین ارزش خالصِ تا آن لحظه، نه از موجودیِ شروع: عمیق‌ترین ریزشی که زنجیره‌ای از بستن‌ها ساخته است.') },
        {
          type: 'p',
          text: text(
            'The same closed-trade list also gives you streaks - runs of consecutive closes with the same sign. They are the part people feel most and read worst: a five-trade losing run feels like collapse even when expectancy is intact, and a six-trade winning run feels like genius even when it is ordinary variance. That is why the metrics above are stated as fractions over a count: a single streak, like a single trade, is one data point, and one data point is not evidence about a process.',
            'همان فهرستِ معاملاتِ بسته‌شده رگبارها را هم می‌دهد — پیوستِ چند بستن با یک علامت. این بخش، بیشتر از بقیه حس می‌شود و بدتر خوانده می‌شود: رگبارِ پنج باختی مثل فروپاشی حس می‌شود حتی وقتی expectancy مثبت سرِ جایش است، و رگبارِ شش بردی نبوغ به نظر می‌رسد در حالی که نوسانی معمولی است. به همین دلیل سنجه‌های بالا به‌صورتِ کسری روی یک شمارش بیان شدند؛ یک رگبار درست مثل یک معامله یک نقطهٔ داده است، و یک نقطهٔ داده نشانه‌ای دربارهٔ یک فرآیند نیست.'
          )
        },
        {
          type: 'note',
          text: text(
            'Keep the sample-size caveat beside the schema, not inside it. Ten trades will always produce a tidy-looking win rate and profit factor; on that few closes they are noise wearing the costume of a signal, and metrics computed only on trades that made it into your curated history carry a survivorship bias you cannot see. Openfund ships a trading journal and a portfolio dashboard fed by the server account records, plus a CSV-based journal analyzer in the Tools Center that computes these figures over an uploaded history - a place to see the numbers, not a source of advice. Nothing here is a recommendation, and keeping a journal is not a claim on profit or on passing any evaluation.',
            'هشدارِ حجم نمونه را کنارِ ساختار بگذار، نه درونش. ده معامله همیشه یک نرخِ برد و ضریبِ سودِ مرتب‌به‌نظر تولید می‌کنند؛ روی این تعدادِ بستن، نویزِ لباس‌پوشیده به‌شکلِ سیگنال‌اند، و سنجه‌هایی که فقط روی معاملاتِ راه‌یافته به تاریخِ گزینش‌شده‌ات حساب شوند سوگیریِ بازماندگان دارند که آن را نمی‌بینی. اوپن‌فاند یک ژورنال معاملاتی و داشبورد پرتفویِ تغذیه‌شده از سوابقِ حسابِ سرور دارد، به‌همراه یک تحلیل‌گرِ ژورنالِ مبتنی بر CSV در مرکز ابزارها که این اعداد را روی تاریخِ بارگذاری‌شده حساب می‌کند — جایی برای دیدنِ اعداد، نه منبعِ توصیه. هیچ‌چیز اینجا توصیه نیست و ژورنال‌نویسی ادعایی بر سود یا قبولی در هیچ ارزیابی‌ای نیست.'
          )
        },
      ]
    },
    {
      slug: 'decision-discipline-and-checklists',
      path: 'trading-process-and-psychology',
      sort: 2,
      minutes: 8,
      status: 'published',
      title: text('Decision discipline and checklists', 'نظم تصمیم‌گیری و چک‌لیست'),
      summary: text(
        'Discipline is judging a decision by the information available when you made it, not by the profit it happened to print; a pre-trade checklist and a written plan are how a trader makes that separation concrete.',
        'نظم یعنی تصمیم را با اطلاعاتِ لحظهٔ گرفتنش بسنجی، نه با سودی که اتفاقاً چاپ کرده؛ چک‌لیستِ پیش از معامله و پلنِ مکتوب، شیوهٔ عینی کردنِ همین تفکیک است.'
      ),
      takeaways: [
        text('A good decision can lose and a bad decision can win; judging only by outcome teaches you nothing reliable', 'تصمیمِ خوب ممکن است ببازد و تصمیمِ بد ممکن است ببرد؛ قضاوتِ صرف بر پایهٔ نتیجه چیزی قابل‌اتکا نمی‌آموزد'),
        text('A checklist turns intent into a gate: entry, stop, size, target and a do-not-trade list are written before the market is open, not negotiated during it', 'چک‌لیست، قصد را به دروازه تبدیل می‌کند: ورود، حد ضرر، اندازه، هدف و فهرستِ ممانعت، پیش از باز شدن بازار نوشته می‌شوند نه حینِ آن'),
        text('Expectancy is the yardstick that scores decisions over a sample, which is the only window where discipline is visible', 'expectancy همان خط‌کشی است که تصمیم‌ها را روی یک نمونه نمره می‌دهد؛ و تنها همین پنجره است که نظم درش دیده می‌شود'),
        text('The checklist must be short enough to actually run every trade, or it becomes a document you skip', 'چک‌لیست باید به‌قدرِ کافی کوتاه باشد که واقعاً روی هر معامله اجرا شود، وگرنه به سندی تبدیل می‌شود که ازش رد می‌شوی'),
      ],
      glossary: ['stop-loss', 'take-profit', 'risk-of-ruin', 'position-size'],
      tools: ['position-size', 'journal-analyzer'],
      blocks: [
        {
          type: 'p',
          text: text(
            'Discipline means many things, but for a process it means one: evaluate a decision on the facts you had when you made it, and refuse to let the result rewrite that verdict. Traders who judge every closed trade by its profit or loss learn the wrong lesson half the time - a sound plan stopped out on a random spike printed a loss, an impulsive lucky bet printed a win. Reward the bet and punish the plan and you slowly train yourself to be worse. The checklist exists to break that loop.',
            'نظم چیزهای زیادی را معنا می‌کند، اما برای یک فرآیند فقط یک معنا دارد: تصمیم را با واقعیاتی بسنج که لحظهٔ گرفتنش در اختیار داشتی و اجازه نده نتیجه آن داوری را بازنویسی کند. معامله‌گرهایی که هر معاملهٔ بسته‌شده را فقط با سود یا زیانش قضاوت می‌کنند نیمی از مواقع درسِ اشتباه می‌گیرند؛ پلنِ سالمی که روی یک جهشِ تصادفی به حد ضررش خورده زیان چاپ کرده و شرطِ تکانشیِ خوش‌شانس برد. اگر به آن شرط جایزه بدهی و این پلن را تنبیه کنی، کم‌کم خودت را به معامله‌گرِ بدتری تربیت می‌کنی. چک‌لیست برای شکستنِ همین حلقه هست.'
          )
        },
        { type: 'h2', text: text('The pre-trade checklist', 'چک‌لیستِ پیش از معامله') },
        {
          type: 'ul',
          items: [
            text('Why now: the one setup condition that has to be true, in a sentence, before the order.', 'چرا حالا: همان یک شرطِ موقعیت که پیش از سفارش باید درست باشد، در یک جمله.'),
            text('Entry, stop and size: three numbers fixed in advance, with size derived from the stop distance rather than from confidence.', 'ورود، حد ضرر و اندازه: سه عدد از پیش تعیین‌شده، با اندازه‌ای که از فاصلهٔ حد ضرر می‌آید نه از میزان اعتماد.'),
            text('Target and invalidation: where a winner is taken off, and what would prove the idea wrong while it is still open.', 'هدف و ابطال: کجا برنده را برمی‌داری و چه چیزی وقتی موقعیت هنوز باز است ایده را باطل می‌کند.'),
            text('The do-not-trade list: the moments you agreed to sit out, so the decision is made cold rather than under pressure.', 'فهرستِ ممانعت: لحظه‌هایی که توافق کرده‌ای در آن‌ها وارد نشوی، تا تصمیم سرد گرفته شود نه زیرِ فشار.'),
          ]
        },
        {
          type: 'table',
          caption: text('The same list, split across the three moments of a trade', 'همان فهرست، میان سه لحظهٔ یک معامله'),
          head: [text('Stage', 'مرحله'), text('What the checklist asks', 'چک‌لیست چه می‌پرسد'), text('Who decides', 'چه‌کس تصمیم می‌گیرد')],
          rows: [
            [text('Before', 'پیش از ورود'), text('Setup true, entry, stop, size, target, not on the do-not-trade list.', 'شرطِ موقعیت درست، ورود، حد ضرر، اندازه، هدف، خارج از فهرستِ ممانعت.'), text('Past you, in calm conditions.', 'خودِ قبلی‌ات، در آرامش.')],
            [text('During', 'حینِ معامله'), text('Is anything true that was not written down? If not, do nothing.', 'آیا چیزی درست شده که نوشته نشده بود؟ اگر نه، هیچ‌کار نکن.'), text('The rule, not the feeling.', 'قاعده، نه حس.')],
            [text('After', 'پس از بستن'), text('Was the plan followed? Tag the emotion, link the screenshot.', 'آیا پلن رعایت شد؟ احساس را برچسب بزن، اسکرین‌شات را پیوند بده.'), text('The reviewer you become later.', 'بازبینی که بعداً می‌شوی.')],
          ]
        },
        { type: 'h2', text: text('Scoring the decision, not the trade', 'نمره به تصمیم، نه به معامله') },
        {
          type: 'p',
          text: text(
            'A single trade is too small a sample to say anything about a decision, which is why the checklist ends with a yes-or-no on plan-followed rather than a grade on profit. Over a batch of trades that all followed one rule, the honest score is expectancy: it folds the win rate and the average size of winners and losers into the one number a repeated decision is actually worth.',
            'یک معامله برای اظهار نظر دربارهٔ یک تصمیم، نمونهٔ خیلی کوچکی است؛ و به همین دلیل چک‌لیست با یک بله/خیرِ «پلن رعایت شد؟» تمام می‌شود نه با نمرهٔ سود. روی دسته‌ای معامله که همه از یک قاعده پیروی کرده‌اند، نمرهٔ صادق expectancy است: نرخِ برد و میانگینِ اندازهٔ بردها و باخت‌ها را در همان عددی می‌ریزد که یک تصمیمِ تکرارشونده واقعاً می‌ارزد.'
          )
        },
        { type: 'formula', expr: 'expectancy_per_trade = (p x avg_win) - (q x avg_loss)', text: text('Score the decision by whether a repeated version of it has positive expectancy, judged across many trades, not by how this one closed.', 'تصمیم را با این بسنج که نسخهٔ تکرارشونده‌اش expectancy مثبت دارد یا نه، سنجیده روی معاملاتِ زیاد — نه با اینکه این یکی چگونه بسته شد.') },
        {
          type: 'p',
          text: text(
            'Discipline becomes a routine you run rather than a mood you feel. Before the order you confirm the three numbers and that the setup sentence is true. While the position is open you act only on what was written; anything new is a fresh decision for the next session, made cold. After it closes you record whether you followed the plan and tag what you felt, so the journal can separate rule-following losses from impulsive ones - worth very different things over a sample even when the money column is identical.',
            'نظم آن وقت روتینی می‌شود که اجرا می‌کنی، نه حالی که باید داشته باشی. پیش از سفارش، سه عدد را تأیید می‌کنی و اینکه جملهٔ شرطِ موقعیت راست است. وقتی موقعیت باز است فقط به نوشته‌شده عمل می‌کنی؛ هر تازه‌ای تصمیمی نو برای نشستِ بعدی است، سرد گرفته‌شده. و پس از بستن ثبت می‌کنی پلن را رعایت کردی یا نه و چه حسی داشتی، تا ژورنال باخت‌های قاعده‌محور را از تکانشی‌ها جدا کند — دو چیز که روی یک نمونه ارزش‌های بسیار متفاوتی دارند، حتی وقتی ستونِ پول یکسان است.'
          )
        },
        { type: 'h3', text: text('A rule you can check yourself', 'قاعده‌ای که خودت می‌توانی چک کنی') },
        {
          type: 'ol',
          items: [
            text('Write the plan before the market moves, in the past tense: entry at X, stop at Y, size from the stop distance.', 'پلن را پیش از حرکتِ بازار و در زمان گذشته بنویس: ورود در X، حد ضرر در Y، اندازه از فاصلهٔ حد ضرر.'),
            text('If you cannot write it before the open, you do not have a decision, you have a reaction - and reactions do not belong on the checklist.', 'اگر نمی‌توانی پیش از بازگشایی بنویسی‌اش، تصمیمی در کار نیست و واکنشی هست — و واکنش جایش در چک‌لیست نیست.'),
            text('Keep it to items you genuinely run every trade; a checklist you skip half the time measures nothing.', 'آن را به مورد‌هایی که واقعاً هر اجرا می‌کنی محدود کن؛ چک‌لیستی که نیمی مواقع ردش می‌کنی چیزی را نمی‌سنجد.'),
          ]
        },
        {
          type: 'terms',
          items: [
            { term: text('Resulting', 'نتیجه‌گرایی'), text: text('Judging a decision by its outcome rather than by its quality when made.', 'سنجشِ تصمیم با نتیجه‌اش، نه با کیفیتش در لحظهٔ گرفتن.') },
            { term: text('Plan-followed flag', 'پرچم رعایت پلن'), text: text('A yes or no recorded per trade, independent of whether it was profitable.', 'یک بله یا خیر برای هر معامله، مستقل از سوداور بودنش.') },
            { term: text('Do-not-trade list', 'فهرستِ ممانعت'), text: text('Conditions agreed in advance to stay out, decided calmly rather than in the moment.', 'شرایطی که از پیش بر سرش توافق شده تا وارد نشوی؛ سرد و بیرونِ لحظه تصمیم‌گرفته.') },
          ]
        },
        {
          type: 'note',
          text: text(
            'Openfund context: a checklist is most valuable where the account has hard boundaries. On the simulated Prop Trading demo a daily loss is measured against the higher of the day-start balance or day-start equity and resets at 00:00 UTC+3, and touching a limit is a breach - so writing the size and the stop before the order is how you keep a single decision from reaching that line. A checklist and journal are process, not a shortcut: purchase activation, funded accounts and payouts are not enabled in this release, and nothing here is investment advice or a promise that discipline produces profit or passes an evaluation.',
            'زمینهٔ اوپن‌فاند: چک‌لیست آن‌جا بیشترین ارزش را دارد که حساب مرزهای سخت دارد. در دموی شبیه‌سازی‌شدهٔ معامله‌گری پراپ، ضررِ روزانه با بزرگ‌ترِ موجودی یا ارزش خالصِ ابتدای روز سنجیده می‌شود و ساعت ۰۰:۰۰ (UTC+3) بازنشانی می‌گردد، و یک بار لمسِ سقف نقض است — پس نوشتنِ اندازه و حد ضرر پیش از سفارش، راهِ این است که یک تصمیمِ تنها به آن خط نرسد. چک‌لیست و ژورنال فرآیندند، نه میان‌بر: فعال‌سازیِ خرید، حساب فاندشده و برداشت در این نسخه فعال نیست و هیچ‌چیز اینجا توصیهٔ سرمایه‌گذاری یا این وعده نیست که نظم سود می‌سازد یا ارزیابی را قبول می‌کند.'
          )
        },
      ]
    },
    {
      slug: 'psychology-of-loss',
      path: 'trading-process-and-psychology',
      sort: 3,
      minutes: 9,
      status: 'published',
      title: text('The psychology of a losing trade', 'روان‌شناسی یک معاملهٔ زیان‌ده'),
      summary: text(
        'The damage of a loss is mostly done by the second decision taken under the feeling, not the first under the plan; this lesson names that reaction and pins it to the numbers and limits that stop it compounding.',
        'آسیبِ ضرر را بیشتر تصمیمِ دومی می‌زند که زیرِ حس گرفته می‌شود، نه اولی که زیرِ پلن بود؛ این درس همان واکنش را نام می‌گذارد و به اعداد و سقف‌هایی میخکوبش می‌کند که از تصاعدش جلو می‌گیرند.'
      ),
      takeaways: [
        text('A single loss is one data point; the risk is the widening of stops and doubling of size that follow it', 'یک زیان یک نقطهٔ داده است؛ خطر، عریض کردنِ حد ضررها و دو برابر کردنِ حجمی است که پس از آن می‌آید'),
        text('A losing streak is consecutive same-sign closes, and it reads in the numbers as ordinary variance long before it feels that way', 'رگبارِ ضرر بستن‌های پیاپی با یک علامت است و دیر وقتش در اعداد نوسانِ عادی به نظر می‌رسد، پیش از آنکه چنین حسی بدهد'),
        text('The daily and total loss limits are real because equity counts: a floating loss moves you to the line before you close anything', 'سقف‌های ضررِ روزانه و کل واقعی‌اند چون ارزش خالص مبناست: زیانِ شناور پیش از بستنِ هرچیز تو را به خط می‌رساند'),
        text('The control is decided cold and written down: a fixed stop, a fixed size and a hard count of attempts for the day', 'کنترل سرد تصمیم گرفته و مکتوب می‌شود: حد ضررِ ثابت، اندازهٔ ثابت و شمارشِ قطعیِ تلاش‌های روز'),
      ],
      glossary: ['max-drawdown', 'stop-loss'],
      tools: ['prop-drawdown', 'journal-analyzer'],
      blocks: [
        {
          type: 'p',
          text: text(
            'A losing trade that followed the plan is not the problem - it is an expected expense of a process whose edge appears only across many trades. The problem is the ninety seconds after the loss prints: the tightening in the chest, the wish to be instantly back to even, and a new decision made by someone who is no longer the person who placed it. Most of the money traders lose beyond their statistics is lost in that window, not to the market but to the reaction.',
            'معاملهٔ زیان‌ده‌ای که از پلن پیروی کرده مشکل نیست — هزینهٔ موردانتظارِ فرآیندی است که مزیتش فقط روی معاملاتِ زیاد دیده می‌شود. مشکل، نود ثانیهٔ پس از چاپِ زیان است: فشردگی‌ای در سینه، آرزوی بازگشتِ فوری به سربه‌سر و تصمیمِ تازه‌ای که فرد دیگری می‌گیرد، کسی که دیگر همانِ ثبت‌کنندهٔ سفارش نیست. بیشترِ پولی که معامله‌گرها فراتر از آمارِ خودشان از دست می‌دهند در همان پنجره می‌رود؛ نه به بازار، که به واکنش.'
          )
        },
        { type: 'h2', text: text('The shape of a losing streak', 'شکلِ یک رگبارِ ضرر') },
        { type: 'formula', expr: 'max_drawdown = max over time of (running_equity_peak - equity) / running_equity_peak', text: text('A streak is felt as this number; a run of same-sign closes pulls equity away from its own running peak.', 'رگبار در حس همان این عدد است؛ پیوستِ بستن‌ها با یک علامت، ارزش خالص را از قلهٔ جاریِ خودش دور می‌کند.') },
        {
          type: 'p',
          text: text(
            'Consecutive losses - a row of closes all on the losing side - feel like a verdict on your judgment, when on any positive-expectancy strategy they are a normal feature of the distribution. The run that reads as collapse while you are inside it reads as ordinary variance once it is one streak among fifty on a long journal. That gap between how a streak feels and how it scores is where discipline is tested: the feeling pushes toward action, the statistics advise waiting.',
            'باخت‌های پیاپی — ردیفی بستن که همه به زیان‌اند — مثل حکم بر قضاوتت حس می‌شوند، در حالی که در هر استراتژیِ مثبت‌expectancy ویژگیِ عادیِ توزیع‌اند. همان رگباری که وقتی درونش هستی فروپاشی خوانده می‌شود، وقتی یکی از پنجاه رگبار روی ژورنالی بلند باشد نوسانی معمولی است. همان فاصلهٔ «حسِ رگبار» با «نمرهٔ رگبار» جایی است که نظم آزمایش می‌شود: حس به اقدام هل می‌دهد و آمار به صبر.'
          )
        },
        { type: 'h2', text: text('Why the limit makes the pressure real', 'چرا سقف، فشار را واقعی می‌کند') },
        {
          type: 'p',
          text: text(
            'On an account with a loss boundary the reaction is dangerous, because the boundary is measured on equity: unrealised losses move you toward the line the moment they appear, before any position is closed. On the Openfund simulated demo the daily loss is measured against the higher of day-start balance or equity, resets at 00:00 UTC+3, and touching a limit once is a breach no later recovery undoes. The impulse to average down or size up after a loss is thus the shortest route from an ordinary losing day to an account-ending one.',
            'روی حسابی با مرزِ ضرر آن واکنش خطرناک است، چون مرز روی ارزش خالص سنجیده می‌شود: زیانِ شناور لحظه‌ای که پدیدار می‌شود — پیش از بستنِ هر موقعیت — تو را به خط می‌رساند. در دموی شبیه‌سازی‌شدهٔ اوپن‌فاند ضررِ روزانه با بزرگ‌ترِ موجودی یا ارزش خالصِ ابتدای روز سنجیده و ساعت ۰۰:۰۰ (UTC+3) بازنشانی می‌شود، و یک بار لمسِ سقف نقضی است که بازگشتِ بعدی پاکش نمی‌کند. پس وسوسهٔ میانگینِ کم کردن یا حجم زیاد کردن پس از ضرر، کوتاه‌ترین مسیر از یک روزِ ضرردهٔ معمولی به روزی است که حساب را تمام می‌کند.'
          )
        },
        { type: 'h2', text: text('The impulse, named', 'وسوسه، نام‌گذاری‌شده') },
        {
          type: 'ul',
          items: [
            text('Revenge sizing: making the next position larger to win back the last one, multiplying the very risk that just hurt you.', 'حجمِ انتقامی: بزرگ‌تر کردنِ موقعیتِ بعدی برای پس‌گرفتنِ قبلی، که همان ریسکِ تازه‌زوال‌دهنده را چند برابر می‌کند.'),
            text('Moving the stop: widening a level meant to be fixed, so the plan quietly becomes unlimited.', 'جابه‌جا کردنِ حد ضرر: عریض کردنِ سطوحی که قرار بود ثابت باشد، تا پلن بی‌صدا بی‌حد شود.'),
            text('Skipping the plan: trading a setup that was never on the list, because the feeling needs a trade now.', 'رد کردنِ پلن: معاملهٔ موقعیتی که هیچ‌وقت در فهرست نبود، چون حس همین حالا یک معامله می‌خواهد.'),
          ]
        },
        { type: 'h3', text: text('The countermeasure is written before the loss', 'پاداقدام پیش از ضرر نوشته می‌شود') },
        {
          type: 'p',
          text: text(
            'None of those impulses are beaten by willpower in the moment, because the person in the moment is not the one who can be trusted in it. They are contained by decisions already made: a stop placed before entry, a size set from the stop distance rather than the wish to recover, and a fixed ceiling on the number of attempts for the day. When the count is reached you stop, because the rule was written while you were calm.',
            'هیچ‌یک از آن وسوسه‌ها با اراده در لحظه شکست داده نمی‌شوند، چون آدمِ لحظه همان آدمی نیست که بتوان بهش اعتماد کرد. آن‌ها با تصمیم‌های از پیش گرفته مهار می‌شوند: حد ضرری که پیش از ورود گذاشته شده، اندازه‌ای که از فاصلهٔ حد ضرر می‌آید نه از میلِ جبران، و سقفی مشخص بر تعدادِ تلاش‌های روز. وقتی شمار به آخر رسید می‌ایستی، چون قاعده در آرامش نوشته شده بود.'
          )
        },
        { type: 'formula', expr: 'per_trade_risk = position_size x (entry - stop)', text: text('Set the size so that the worst ordinary losing run your plan allows still leaves room under the daily and total limits.', 'اندازه را چنان تنظیم کن که بدترین رگبارِ ضررِ عادیِ مجازِ پلنت، هنوز زیرِ سقف‌های روزانه و کل جا بگذارد.') },
        { type: 'formula', expr: 'daily_allowance = max(day_start_balance, day_start_equity) x daily_loss_limit', text: text('Dividing this by the attempts you honestly intend fixes the per-trade budget before feeling can change it.', 'تقسیم این بر تلاش‌هایی که صادقانه قصدشان داری، بودجهٔ هر معامله را پیش از آنکه حس عوضش کند تثبیت می‌کند.') },
        {
          type: 'terms',
          items: [
            { term: text('Tilt', 'تیلت'), text: text('The state where the loss-feeling drives decisions instead of the plan.', 'حالتی که حسِ ضرر جایش را به پلن در تصمیم‌گیری می‌دهد.') },
            { term: text('Revenge trade', 'معاملهٔ انتقامی'), text: text('An oversized entry taken to undo a recent loss quickly.', 'ورودِ حجم‌دار برای عقب زدنِ سریعِ یک ضررِ تازه.') },
            { term: text('Stop distance', 'فاصلهٔ حد ضرر'), text: text('The gap between entry and stop; it sets size for a fixed risk, not the reverse.', 'فاصلهٔ ورود تا حد ضرر؛ برای ریسکی ثابت، اندازه را تعیین می‌کند نه برعکس.') },
          ]
        },
        {
          type: 'h3',
          text: text('When the feeling is bigger than trading', 'وقتی حس بزرگ‌تر از معامله است')
        },
        {
          type: 'p',
          text: text(
            'Persistent distress around losses - sleepless nights, anxiety that follows you away from the screen, trading to escape how you feel rather than to act on a plan - is not a discipline problem fixed by a better checklist. Sustained emotional difficulty deserves a conversation with a qualified professional, and reaching for it is a reasonable step, not an admission of weakness. A trading process organises decisions; it is not therapy, and a loss should never be framed as a reason to hurt yourself.',
            'ارزش دارد صریح گفته شود که پریشانیِ پاینده گردِ ضررها — خوابی که نمی‌آید، اضطرابی که از صفحه جدا نمی‌شود، معامله برای گریز از حالِ خود نه برای عمل به پلن — مسئلهٔ نظمی نیست که با چک‌لیستِ بهتر حل شود. دشواریِ عاطفیِ ادامه‌دار سزاوارِ صحبت با یک متخصصِ واجدِ شرایط است و رفتن سراغش قدمی عاقلانه است، نه اقرارِ ضعف. یک فرآیندِ معاملاتی تصمیم‌ها را سازمان می‌دهد؛ درمان نیست، و ضرر هرگز نباید دلیلی برای آسیب به خود قاب شود.'
          )
        },
        {
          type: 'note',
          text: text(
            'The simulated demo lowers the stakes but not the pattern: it runs on 100,000 virtual DAI at live Gains Network mark prices, so a losing streak costs you nothing withdrawable, yet still shows how you behave under the feeling - the only thing this lesson is about. Nothing here is investment advice, and staying calm or journalling a loss is no route to profit or to a funded account.',
            'دموی شبیه‌سازی‌شده شرط را پایین می‌آورد ولی الگو را نه: روی ۱۰۰٬۰۰۰ دای مجازی با مارک پرایسِ زندهٔ Gains Network اجرا می‌شود، پس رگبارِ ضرر چیزی قابلِ برداشت از تو نمی‌گیرد، اما همچنان نشان می‌دهد زیرِ آن حس چگونه رفتار می‌کنی — و تنها موضوعِ همین درس است. هیچ‌چیز اینجا توصیهٔ سرمایه‌گذاری نیست، و آرام ماندن یا ژورنال کردنِ یک ضرر نه راهِ سود است و نه راهِ حساب فاندشده.'
          )
        },
      ]
    },
    {
      slug: 'rules-versus-discretion',
      path: 'trading-process-and-psychology',
      sort: 4,
      minutes: 8,
      status: 'published',
      title: text('Rules versus discretion', 'قاعده در برابر سلیقه'),
      summary: text(
        'Rules and judgment are not opposites: a process fixes most decisions by rule and confines discretion to a narrow, written exception - and never lets it pretend to read data the market feed does not provide.',
        'قاعده و سلیقه ضد هم نیستند: فرآیند بیشترِ تصمیم‌ها را با قاعده تثبیت می‌کند و سلیقه را به یک استثنایِ باریک و مکتوب محدود می‌کند — و هیچ‌گاه اجازه نمی‌دهد وانمود کند داده‌ای را می‌خواند که خوراکِ بازار نمی‌دهد.'
      ),
      takeaways: [
        text('Fix by rule the decisions you are worst at while emotional - size, stop, daily cap, do-not-trade - and keep the chart of exceptions tiny', 'با قاعده آن تصمیم‌هایی را که وقتی پرهستی درشان ضعیف‌ترینی تثبیت کن — اندازه، حد ضرر، سقف روزانه، ممانعت — و نمودارِ استثناها را خیلی کوچک نگه دار'),
        text('Discretion is legitimate only where you have information; here the market-data source supplies no order-book depth, open interest or trade tape, so judgment cannot be built on them', 'سلیقه تنها آن‌جا مشروع است که اطلاعات داشته باشی؛ اینجا مبدأِ داده‌های بازار هیچ عمقِ دفترِ سفارش، open interest یا نوارِ معامله‌ای نمی‌دهد، پس قضاوت را نمی‌توان بر آن‌ها بنا کرد'),
        text('An override is only trustworthy if it is logged: the rule bypassed, the reason, and a later review against the same expectancy yardstick', 'دست‌ورزی تنها وقتی قابل‌اعتماد است که ثبت شود: قاعده‌ای که دور زده شد، دلیلش و بازبینیِ بعدی با همان خط‌کشِ expectancy'),
        text('Perpetual Trading is read-only today and on-chain execution is not enabled, so a manual override cannot place a live order - keep discretion inside what you can actually record', 'معاملهٔ perpetual امروز فقط‌خواندنی است و اجرای آن‌چین فعال نیست، پس دست‌ورزیِ دستی نمی‌تواند سفارشِ زنده ثبت کند — سلیقه را درونِ همان چیزی نگه دار که واقعاً قابلِ ثبت است'),
      ],
      glossary: ['mark-price', 'order-book', 'open-interest', 'stop-loss'],
      tools: ['journal-analyzer', 'position-size'],
      blocks: [
        {
          type: 'p',
          text: text(
            'The debate between trading by rules and trading by feel is usually posed wrong. It is not order versus chaos; it is about where judgment is allowed to operate. A workable process is mostly rule and only occasionally discretion - the rules carry the decisions you are worst at when emotions run high, and judgment is reserved for the narrow case where you genuinely hold information the rule could not anticipate. Everything else is a story you tell after the trade to feel in control.',
            'جدالِ معامله بر پایهٔ قاعده در برابر معامله بر پایهٔ حس، معمولاً غلط طرح می‌شود. مسئله نظم در برابر آشوب نیست؛ مسئله آن‌جاست که به قضاوت اجازهٔ کار کردن داده می‌شود. یک فرآیندِ کارآمد عمدتاً قاعده است و تنها گاه‌به‌گاه سلیقه — قاعده‌ها آن تصمیم‌هایی را که وقتی هیجان بالاست درشان ضعیف‌ترینی حمل می‌کنند، و قضاوت برای همان موردِ باریک کنار گذاشته می‌شود که واقعاً اطلاعاتی داری که قاعده نتوانسته پیش‌بینی‌اش کند. هر چیز دیگر داستانی است که پس از معامله تعریف می‌کنی تا احساس کنترل داشته باشی.'
          )
        },
        { type: 'h2', text: text('What a rule should own', 'قاعده چه چیزی را باید در اختیار داشته باشد') },
        {
          type: 'ul',
          items: [
            text('Position size, derived from the stop distance and a fixed risk fraction - never from how strong the setup feels.', 'اندازهٔ موقعیت، از فاصلهٔ حد ضرر و یک کسرِ ثابت ریسک — نه از چقدر قوی حس کردنِ موقعیت.'),
            text('Stop and target levels, written before entry so the open position cannot renegotiate them.', 'سطحِ حد ضرر و هدف، نوشته پیش از ورود، تا موقعیتِ باز نتواند سرشان مذاکره کند.'),
            text('The daily cap on attempts and on risk, which ends the day by count rather than by mood.', 'سقفِ روزانه بر تعدادِ تلاش و بر ریسک، که روز را با شمارش تمام می‌کند نه با حال.'),
            text('The do-not-trade list, so the biggest discretion - whether to be in the market at all - is decided cold.', 'فهرستِ ممانعت، تا بزرگ‌ترین سلیقه — اینکه اصلاً در بازار باشی یا نه — سرد تعیین شود.'),
          ]
        },
        { type: 'h2', text: text('Where judgment is real, and where it is theatre', 'کجا قضاوت واقعی است و کجا نمایش') },
        {
          type: 'p',
          text: text(
            'Discretion is only as good as the information underneath it. A trader who reads depth, order flow and positioning is doing something a rule cannot easily copy. But the market-data source available to Openfund does not supply order-book depth, open interest or a trade tape at all - the platform shows those as unavailable and does not estimate them. So a judgment here that claims to sense the order book or open interest is built on nothing, no matter how confident it feels. Honest discretion stays inside what you can actually see: the price marks, the candle, your own written conditions.',
            'سلیقه به اندازهٔ اطلاعاتِ زیرِ خودش ارزش دارد. معامله‌گری که عمق، جریانِ سفارش و پوزیشن‌گیری را می‌خواند کاری می‌کند که قاعده به‌سختی کپی‌اش می‌کند. اما مبدأِ داده‌های بازار در دسترسِ اوپن‌فاند هرگز عمقِ دفترِ سفارش، open interest یا نوارِ معاملاتی را تأمین نمی‌کند — پلتفرم آن‌ها را دست‌نیافتنی نشان می‌دهد و تخمینشان هم نمی‌زند. پس قضاوتی اینجا که ادعا کند دفترِ سفارش یا interest را حس می‌کند، هرچقدر هم مطمئن به نظر برسد، بر هیچ بنا شده. سلیقهٔ صادق درونِ همان چیزی می‌ماند که واقعاً می‌بینی: مارکِ قیمت، کندل، و شرایطِ مکتوبِ خودت.'
          )
        },
        {
          type: 'note',
          text: text(
            'Fact of the product: the market-data feed here exposes price marks but not order-book depth, open interest or the trade tape; unavailable fields are shown as unavailable and never guessed. Perpetual Trading is read-only today and on-chain execution is not enabled in this release. Any process built on those data - or on placing live orders - cannot actually run here yet, which is a reason to keep both rules and discretion inside what the records can show.',
            'واقعیتِ محصول: خوراکِ داده‌های بازار اینجا مارکِ قیمت را آشکار می‌کند ولی عمقِ دفترِ سفارش، open interest و نوارِ معامله را نه؛ فیلدهای دست‌نیافتنی به‌عنوان دست‌نیافتنی نشان داده می‌شوند و هیچ‌گاه حدس نمی‌خورند. معاملهٔ perpetual امروز فقط‌خواندنی است و اجرای آن‌چین در این نسخه فعال نیست. هر فرآیندی که بر آن داده‌ها — یا بر ثبتِ سفارشِ زنده — بنا شده، فعلاً نمی‌تواند اینجا اجرا شود؛ و این دلیلی است که هم قاعده و هم سلیقه را درونِ آنچه سوابق نشان می‌دهند نگه داری.'
          )
        },
        { type: 'h2', text: text('The override must be written down', 'دست‌ورزی باید ثبت شود') },
        {
          type: 'ol',
          items: [
            text('Name the rule you are bypassing, in its own words.', 'قاعده‌ای که دور می‌زنی را با همان واژه‌های خودش نام ببر.'),
            text('State the piece of information you hold that the rule did not anticipate.', 'همان تکه اطلاعاتی که داری و قاعده انتظارش را نداشت را بگو.'),
            text('Predict its effect, then grade it later against the same expectancy as the rules - not against whether the one trade won.', 'اثرش را پیش‌بینی کن، بعداً با همان expectancyِ قاعده‌ها نمره‌اش بده، نه با اینکه آن یک معامله برد یا نه.'),
          ]
        },
        { type: 'formula', expr: 'expectancy_per_trade = (p x avg_win) - (q x avg_loss)', text: text('Judged this way, a rule and an override compete on one scale: if the logged exceptions have no better expectancy over a sample, they were not judgment, they were noise.', 'با این سنجش، قاعده و دست‌ورزی روی یک ترازو رقابت می‌کنند: اگر استثناهای ثبت‌شده روی یک نمونه expectancy بهتری ندارند، آن‌ها قضاوت نبودند، نویز بودند.') },
        {
          type: 'table',
          caption: text('Two kinds of decision, and how each is graded', 'دو نوع تصمیم، و شیوهٔ نمره‌دهی هرکدام'),
          head: [text('Decision type', 'نوع تصمیم'), text('Set by', 'تعیین‌کننده'), text('Graded by', 'سنجهٔ نمره'), text('Logging', 'ثبت')],
          rows: [
            [text('Size and stop', 'اندازه و حد ضرر'), text('Rule, fixed in advance', 'قاعده، از پیش ثابت'), text('Compliance, pass or fail', 'رعایت، قبول یا رد'), text('Numbers in the journal', 'اعداد در ژورنال')],
            [text('A written override', 'دست‌ورزیِ مکتوب'), text('Judgment on held information', 'قضاوت بر اطلاعاتِ در دست'), text('Expectancy across many overrides', 'expectancy روی دست‌ورزی‌های زیاد'), text('Rule bypassed, reason, review', 'قاعدهٔ دور زده‌شده، دلیل، بازبینی')],
            [text('An unlogged change', 'تغییرِ ثبت‌نشده'), text('The feeling of the moment', 'حسِ همان لحظه'), text('Nothing reliable', 'هیچ چیزِ قابل‌اتکا'), text('Invisible to the journal', 'نامرئی برای ژورنال')],
          ]
        },
        {
          type: 'h3',
          text: text('Read-only markets, discretionary honesty', 'بازارهای فقط‌خواندنی، سلیقهٔ صادق')
        },
        {
          type: 'p',
          text: text(
            'The distinction earns its keep precisely here. Because this release is read-only on perpetual markets and cannot execute on-chain, a manual override is not a way to put a real order in; it is only a way to change what your process does, in the records. That makes it easier, not harder, to be honest: the only discretion that means anything is the discretion you can describe, justify and measure - everything else is a decision without a trace, and an untraceable decision cannot be reviewed, so it teaches you nothing.',
            'این تفکیک دقیقاً همین‌جا ارزش خودش را ثابت می‌کند. چون این نسخه روی بازارهای perpetual فقط‌خواندنی است و نمی‌تواند آن‌چین اجرا کند، دست‌ورزیِ دستی راهِ ثبتِ یک سفارشِ واقعی نیست؛ تنها راهِ تغییر دادنِ کارِ فرآیندت در سوابق است. همین، صادق بودن را آسان‌تر می‌کند نه سخت‌تر: تنها سلیقه‌ای که معنا دارد همان است که بتوانی توصیفش کنی، برایش دلیل بیاوری و اندازه‌اش بگیری — و بقیه تصمیمی بی‌اثر است، و تصمیمِ بی‌اثر را نمی‌توان بازبینی کرد، پس چیزی نمی‌آموزد.'
          )
        },
        {
          type: 'note',
          text: text(
            'This lesson favours neither side of the argument; it only locates the border. Rules are not a promise of profit and discretion is not a special talent - the funded and payout stages of the prop product are not enabled in this release, and nothing here recommends a strategy. A process is measured by how completely its decisions, rule-followed or overridden, can be read back from the records you keep.',
            'این درس طرفِ هیچ‌یک از دو سو را نمی‌گیرد؛ فقط مرز را تعیین می‌کند. قاعده وعدهٔ سود نیست و سلیقه استعدادِ ویژه نیست — مرحلهٔ فاندشده و برداشتِ محصولِ پراپ در این نسخه فعال نیست و هیچ‌چیز اینجا راهبردی را توصیه نمی‌کند. یک فرآیند با این سنجیده می‌شود که تصمیم‌هایش، قاعده‌محور یا دست‌ورزی‌شده، تا چه حد از سوابقی که نگه می‌داری قابلِ بازخوانی‌اند.'
          )
        },
      ]
    },
    {
      slug: 'automated-systems-and-limits',
      path: 'trading-process-and-psychology',
      sort: 5,
      minutes: 10,
      status: 'published',
      title: text('Automated systems and their limits', 'سیستم‌های خودکار و مرزهای آن‌ها'),
      summary: text(
        'Automation does not remove the psychology, it moves it into the design; a backtest is a claim about the past, and even a working automated strategy still inherits every loss limit and payout condition of the account it runs on.',
        'خودکارسازی روان‌شناسی را حذف نمی‌کند، آن را به دلِ طراحی می‌برد؛ یک backtest ادعایی دربارهٔ گذشته است، و حتی یک استراتژیِ خودکارِ درست‌کار همچنان همهٔ سقف‌های ضرر و شرایطِ برداشتِ حسابی را که رویش اجرا می‌شود به ارث می‌برد.'
      ),
      takeaways: [
        text('A backtest optimised hard enough will fit the noise of its own history; the guard is a walk-forward test on data it never saw', 'backtestی که بیش از حد بهینه شود نویزِ تاریخِ خودش را هم برازش می‌کند؛ محافظش آزمونِ walk-forward روی داده‌ای است که هرگز ندیده'),
        text('Real results differ from simulated ones because of costs the model tends to hide: fees, slippage, latency and fill assumptions', 'نتیجهٔ واقعی با شبیه‌سازی‌شده فرق دارد به‌خاطرِ هزینه‌هایی که مدل معمولاً می‌پوشاند: کارمزد، اسلیپیج، تأخیر و فرض‌های پر شدنِ سفارش'),
        text('Every automated system needs kill switches: a daily-loss auto-stop, a cap on open risk, a data-freshness check and a manual halt', 'هر سیستمِ خودکار به کلیدِ خاموشی نیاز دارد: توقفِ خودکارِ ضرر روزانه، سقف بر ریسکِ باز، بررسی تازگیِ داده و توقفِ دستی'),
        text('Automation never escapes the account terms: the daily and total loss limits still bind, touching one is a breach, and consistency is still a payout condition', 'خودکارسازی هیچ‌گاه از شرایطِ حساب فرار نمی‌کند: سقف‌های ضررِ روزانه و کل همچنان الزامی‌اند، لمسِ یکی نقض است، و consistency همچنان شرطِ برداشت است'),
      ],
      glossary: ['expectancy', 'max-drawdown', 'slippage', 'spread'],
      tools: ['journal-analyzer', 'prop-drawdown'],
      blocks: [
        {
          type: 'p',
          text: text(
            'A program does not revenge-trade, widen a stop or feel a losing streak - that is the appeal of automation. But the calm is not free: every decision a manual trader makes under emotion is instead made at the desk, in the choice of rule, parameters, cost assumptions and guardrails. Automation relocates the psychology rather than deleting it, so a badly designed strategy simply repeats one mistake with great discipline.',
            'برنامه انتقام‌وار معامله نمی‌کند، حد ضرر را عریض نمی‌کند و رگبارِ ضرر را حس نمی‌کند — همین جذابیتِ خودکارسازی است. اما این آرامشِ رایگان نیست: هر تصمیمی که معامله‌گرِ دستی زیرِ هیجان می‌گیرد، جایش پیش از اجرای کد روی میز گرفته می‌شود، در انتخابِ قاعده، پارامترها، فرض‌های هزینه و ریل‌های محافظ. خودکارسازی روان‌شناسی را پاک نمی‌کند، جابه‌جایش می‌کند؛ پس استراتژیِ بدطراحی یک اشتباه را با نظمِ زیاد تکرار می‌کند.'
          )
        },
        { type: 'h2', text: text('The failure mode: overfitting', 'مدلِ شکست: برازشِ بیش از حد') },
        {
          type: 'p',
          text: text(
            'A backtest is a claim about the past, not a promise about the future. Tune enough parameters against one history and you find settings that flatter it by memorising its noise instead of its edge. The guard is walk-forward testing: optimise on one window, run it on the next window the fit never saw, and roll. If good numbers survive only inside the data they were tuned on, you have described last year, not built a process for next year.',
            'backtest ادعایی دربارهٔ گذشته است، نه وعده‌ای دربارهٔ آینده. به‌اندازهٔ کافی پارامتر روی یک تاریخ تنظیم کنی، تنظیماتی می‌یابی که تاریخ را آرایسته نشان می‌دهند، چون نویزش را حفظ کرده‌اند نه مزیتش را. محافظش walk-forward است: روی یک پنجره بهینه کن، روی پنجرهٔ بعدی که برازش ندیده ببر و بچرخان. اگر اعدادِ خوب فقط داخلِ همان داده‌ای که رویش تنظیم شده‌اند سر دو می‌آورند، تو شرحِ سالِ پیش ساخته‌ای، نه فرآیندی برای سالِ بعد.'
          )
        },
        { type: 'formula', expr: 'expected_live_result = backtest_result - fees - slippage - cost_of_missed_fills', text: text('The gap between the two lines is the whole difference between a chart and a running system.', 'فاصلهٔ میان این دو خط، تمامِ فرقِ میان یک نمودار با یک سیستمِ در حالِ کار است.') },
        { type: 'h2', text: text('Assumptions the backtest hides', 'فرض‌هایی که backtest می‌پوشاند') },
        {
          type: 'ul',
          items: [
            text('Slippage: assuming a stop or market order fills at the chart price, which fast or thin markets will not grant.', 'اسلیپیج: این فرض که حد ضرر یا سفارشِ بازار روی قیمتِ چارت پر می‌شود، چیزی که بازارهای سریع یا کم‌عمق اعطا نمی‌کنند.'),
            text('Latency: assuming you see a price and act instantly; real signals arrive late and late orders get old prices.', 'تأخیر: این فرض که قیمتی را می‌بینی و بی‌درنگ عمل می‌کنی؛ سیگنالِ واقعی دیر می‌رسد و سفارشِ دیر قیمتِ کهنه می‌گیرد.'),
            text('Spread and fees per side: a model that ignores them turns a thin-edge strategy into a loser.', 'اسپرد و کارمزدِ هر سمت: مدلی که نادیده‌شان بگیرد، استراتژیِ کم‌مزیت را به بازنده تبدیل می‌کند.'),
            text('Data availability: nothing can be automated on inputs the feed does not send - order-book depth, open interest and the trade tape are not supplied here.', 'دسترسِ داده: هیچ چیزی را نمی‌توان روی ورودی‌هایی که خوراک نمی‌فرستد خودکار کرد — عمقِ دفترِ سفارش، open interest و نوارِ معامله اینجا داده نمی‌شوند.'),
          ]
        },
        { type: 'h2', text: text('Kill switches and guardrails', 'کلیدِ خاموشی و ریل‌های محافظ') },
        {
          type: 'ol',
          items: [
            text('A daily-loss auto-stop that halts the system at a pre-set fraction of the account - the line the trader must not reach.', 'توقفِ خودکارِ ضرر روزانه که سیستم را روی کسرِ از پیش تعیین‌شده‌ای از حساب می‌خواباند — همان خطی که معامله‌گر نباید بهش برسد.'),
            text('A cap on open risk, so a burst of correlated entries cannot stack into the boundary.', 'سقف بر ریسکِ باز، تا انبوهِ ورودهای هم‌بسته روی مرز تلنبار نشود.'),
            text('A data-freshness check, an order-rate limit and a manual halt: if marks go stale, the operator stops it instantly.', 'بررسیِ تازگیِ داده، محدودیتِ نرخ سفارش و توقفِ دستی: اگر مارک‌ها کهنه شوند، اپراتور فوراً متوقفش می‌کند.'),
          ]
        },
        {
          type: 'p',
          text: text(
            'None of this lifts the account terms off you: an automated strategy still inherits every loss limit and payout condition of the account it runs on. On the Openfund simulated demo a daily loss is measured against the higher of the day-start balance or equity, resets at 00:00 UTC+3, and touching a limit is a breach regardless of who placed the order. Consistency is a payout condition - 35% on the monthly path, 15% on Instant - so a system that packs profit into one run can clear the loss limits and still fail the gate.',
            'هیچ‌یک از این‌ها شرایطِ حساب را از دوشت برنمی‌دارد: استراتژیِ خودکار همچنان همهٔ سقف‌های ضرر و شرایطِ برداشتِ حسابی را که رویش اجرا می‌شود به ارث می‌برد. در دموی شبیه‌سازی‌شدهٔ اوپن‌فاند، ضررِ روزانه با بزرگ‌ترِ موجودی یا ارزش خالصِ ابتدای روز سنجیده می‌شود، ساعت ۰۰:۰۰ (UTC+3) بازنشانی می‌گردد و لمسِ سقف، بی‌فرقِ اینکه چه کسی سفارش را گذاشته، نقض است. consistency شرطِ برداشت است — ۳۵٪ در مسیرِ ماهانه، ۱۵٪ در «آنی» — پس سیستمی که سودش را در یک اجرا جمع کند می‌تواند سقف‌های ضرر را پاس کند و در دروازه بیفتد.'
          )
        },
        { type: 'formula', expr: 'daily_allowance = max(day_start_balance, day_start_equity) x daily_loss_limit', text: text('Whatever the execution, this number is the hard budget; the program must be given the same limit the trader is.', 'هرچه نوعِ اجرا، این عدد بودجهٔ سخت است؛ باید همان سقفی که به معامله‌گر داده شده به برنامه هم داده شود.') },
        { type: 'formula', expr: 'consistency_share = best_profitable_day / total_net_profit', text: text('A payout condition, not a trading rule: an automated design can concentrate profit into one day and quietly trip it.', 'یک شرطِ برداشت، نه قاعدهٔ معاملاتی: طراحیِ خودکار می‌تواند سود را در یک روز جمع کند و بی‌صدا پایش بگذارد.') },
        { type: 'h3', text: text('What is not automated here', 'آنچه اینجا خودکار نیست') },
        {
          type: 'p',
          text: text(
            'Scope matters. This release is read-only on perpetual markets and cannot execute on-chain, so an automated system here means analysis, monitoring and backtesting over the records, not live orders. The Prop Trading environment is a single server-side simulated demo funded once with 100,000 virtual DAI at live Gains Network mark prices, with purchase activation, funded accounts and payouts not enabled. Treat each backtest as a rehearsal, and the CSV journal analyzer and portfolio dashboard - fed by the account records - as tools for measuring a process, not evidence about results.',
            'دامنه مهم است. در این نسخه معاملهٔ perpetual فقط‌خواندنی است و اجرای آن‌چین فعال نیست، پس سیستمِ خودکار اینجا یعنی تحلیل، پایش و backtest روی سوابق — نه سفارشِ زنده. محیطِ معاملهٔ پراپ یک دموی شبیه‌سازی‌شدهٔ سروری است که یک‌بار با ۱۰۰٬۰۰۰ دای مجازی تأمین و از مارک پرایسِ زندهٔ Gains Network قیمت‌گذاری می‌شود، و فعال‌سازیِ خرید، حساب فاندشده و برداشت فعال نیستند. هر backtestی را تمرین بدان، و تحلیل‌گرِ ژورنالِ CSV و داشبوردِ پرتفوی — تغذیه‌شده از سوابقِ حساب — را ابزارِ سنجشِ فرآیند بخوان، نه مدرکِ نتیجه‌ها.'
          )
        },
        {
          type: 'terms',
          items: [
            { term: text('Overfitting', 'برازشِ بیش از حد'), text: text('Fitting the noise of a history so well that the edge does not survive new data.', 'آن‌قدر خوب برازش کردنِ نویزِ یک تاریخ که مزیت روی دادهٔ تازه دو نیاورد.') },
            { term: text('Walk-forward', 'walk-forward'), text: text('Optimising on one window and testing on the next unseen one, repeatedly rolled.', 'بهینه کردن روی یک پنجره و آزمون روی پنجرهٔ بعدیِ ندیده‌شده، بارها چرخان.') },
            { term: text('Slippage', 'اسلیپیج'), text: text('The gap between intended and realised fill price, which real trading always pays.', 'فاصلهٔ قیمتِ پر شدنِ موردنظر با محقق‌شده، که معاملهٔ واقعی همیشه می‌پردازد.') },
          ]
        },
        {
          type: 'note',
          text: text(
            'Nothing here is investment advice, and no system - automated or manual - is offered as a way to earn profit or pass an evaluation. The market data gives no order-book depth, open interest or trade tape, and those are never estimated; on-chain execution is not enabled. An automated process is worth only what its rules, cost assumptions and guardrails make it - and it still answers to the loss limits and payout conditions of the account it runs on.',
            'هیچ‌چیز اینجا توصیهٔ سرمایه‌گذاری نیست، و هیچ سیستمی — خودکار یا دستی — راهِ کسبِ سود یا قبولی در ارزیابی ارائه نمی‌شود. دادهٔ بازار عمقِ دفترِ سفارش، open interest و نوارِ معامله نمی‌دهد و آن‌ها هرگز تخمین نمی‌شوند؛ اجرای آن‌چین فعال نیست. ارزشِ یک فرآیندِ خودکار تنها به اندازهٔ قاعده‌ها، فرض‌های هزینه و ریل‌های محافظش است — و همچنان در برابرِ سقف‌های ضرر و شرایطِ برداشتِ همان حسابی که رویش اجرا می‌شود پاسخگوست.'
          )
        },
      ]
    },
  ]
}
