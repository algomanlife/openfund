import { text } from '../../features/information/content'
import type { ToolCopy } from '../contentTypes'

/**
 * Bilingual prose for the ten Tools Center calculators, keyed by tool slug.
 * The numeric contract (inputs, result keys, the arithmetic itself) lives in
 * `src/features/tools/toolSpecs.ts` and `calculators.ts` because it is covered
 * by automated tests; only the reader-facing copy is stored here (and seeded
 * into the `tools` Directus collection so editors can reword it).
 *
 * Content policy: every figure below is an illustrative example, never an
 * Openfund commercial term. Challenge numbers quoted here are the published
 * terms of record, which are not purchasable or enforced in this release.
 */
export const toolsCopy: Record<string, ToolCopy> = {
  'position-size': {
    name: text('Position Size Calculator', 'محاسبهٔ حجم موقعیت'),
    tagline: text('How much to trade for a fixed money risk', 'چقدر معامله کنی تا ریسکت ثابت بماند'),
    about: text(
      'Decide the money you are willing to lose on one trade first, then let the calculator convert that into a position size from your entry and stop distance. Use it before you click buy or sell, not after.',
      'اول تعیین کن در یک معامله چقدر حاضرید از دست بدهی، بعد ابزار آن مبلغ را با فاصلهٔ ورود تا حد ضرر به حجم موقعیت تبدیل می‌کند. قبل از زدن دکمهٔ خرید یا فروش از آن استفاده کن، نه بعدش.'
    ),
    method: text(
      'Risk money equals account equity multiplied by your risk percentage. The distance to stop is the absolute difference between entry and stop, plus an allowance for the round-trip fee so the size does not quietly exceed your risk. Units are then risk money divided by that distance multiplied by contract size. The resulting notional and the margin it needs at your chosen leverage are shown alongside, so you can see whether the position is even possible on your balance.',
      'مبلغ ریسک برابر است با موجودی ضرب‌در درصد ریسک. فاصله تا حد ضرر، اختلاف مطلق قیمت ورود و حد ضرر است، به‌اضافهٔ سهمی برای کارمزد رفت و برگشت تا حجم بی‌سر‌و‌صدا از ریسک تو بیشتر نشود. سپس تعداد واحد از تقسیم مبلغ ریسک بر آن فاصله و بر اندازهٔ قرارداد به دست می‌آید. ارزش اسمی حاصل و مارجین لازم در اهرم انتخابی هم نمایش داده می‌شود تا ببینی این موقعیت با موجودی تو اصلاً ممکن است یا نه.'
    ),
    assumptions: [
      text('Your stop order fills at the price you enter, with no gap or slippage.', 'فرض می‌شود حد ضرر دقیقاً روی قیمت تعیین‌شده اجرا می‌شود؛ بدون گپ و بدون اسلیپیج.'),
      text('The fee rate you type applies to both legs of the trade.', 'نرخ کارمزدی که وارد می‌کنی روی هر دو پای معامله اعمال می‌شود.'),
      text('Contract size is constant per unit, as the venue defines it.', 'اندازهٔ هر قرارداد ثابت است، همان‌طور که صرافی تعریف کرده است.'),
      text('It ignores funding, spreads and margin tiering.', 'فاندینگ، اسپرد و سطوح مارجین در نظر گرفته نمی‌شوند.'),
    ],
    limitations: text(
      'This sizes a trade; it does not tell you whether the trade is a good one. A correct size on a strategy with negative expectancy still loses money. Margin availability also depends on the venue and on your other open positions, which the calculator cannot see.',
      'این ابزار حجم را می‌سازد، نه اینکه بگوید معامله خوب است؛ حجمِ درست روی استراتژی با امید ریاضی منفی هم ضرر می‌دهد. مارجین در دسترس هم به صرافی و هم به سایر موقعیت‌های باز تو بستگی دارد که در دسترس این محاسبه‌گر نیست.'
    ),
  },
  'leverage-margin': {
    name: text('Leverage and Margin Calculator', 'محاسبهٔ اهرم و وجه تضمین'),
    tagline: text('What a position locks up, and what is left', 'چقدر مارجین قفل می‌شود و چه باقی می‌ماند'),
    about: text(
      'Enter the position value you want and the leverage you plan to use, and see the margin that gets locked, how much of your equity that consumes, and the cushion that remains before the maintenance floor.',
      'ارزش موقعیت موردنظر و اهرمی که می‌خواهی استفاده کنی را وارد کن تا مارجین قفل‌شده، سهم آن از سرمایه، و فاصله تا کف نگهداری مشخص شود.'
    ),
    method: text(
      'Required margin is notional divided by leverage. Free margin is your equity minus that requirement, margin usage is the same figure as a percentage of equity, and effective leverage is notional divided by equity — the leverage you actually have on, including what your existing positions already use. The maintenance buffer is the equity value at which the maintenance-margin requirement stops you from adding more.',
      'وجه تضمین لازم برابر است با ارزش اسمی تقسیم‌بر اهرم. مارجین آزاد، سرمایه کم‌شدهٔ همان عدد است؛ استفاده از مارجین همان مقدار را به‌صورت درصدی از سرمایه نشان می‌دهد و اهرم مؤثر، ارزش اسمی تقسیم‌بر سرمایه است؛ یعنی اهرمی که واقعاً روشن کرده‌اید، با احتساب موقعیت‌های قبلی. حاشیهٔ نگهداری هم سطحی است که در آن، الزام مارجین نگهداری جلوی اضافه‌کردن را می‌گیرد.'
    ),
    assumptions: [
      text('Leverage is a flat ratio, as selected; real venues use margin tiers.', 'اهرم نسبتی ثابت فرض می‌شود؛ صرافی‌ها معمولاً پله‌های مارجین دارند.'),
      text('Equity is the value you type, not a live account read.', 'ارزش سرمایه، همان عددی است که تو وارد می‌کنی؛ نه خواندن زنده از حساب.'),
      text('Maintenance rate is a single percentage of position value.', 'نرخ نگهداری یک درصد ثابت از ارزش موقعیت در نظر گرفته می‌شود.'),
      text('Isolated and cross margin are treated the same here.', 'مارجین جدا و مشترک در این محاسبه یکسان درنظر گرفته می‌شود.'),
    ],
    limitations: text(
      'The venue decides the real margin tier, the maintenance rate and whether your order fits, so treat this as a planning estimate. Higher leverage does not create profit; it compresses the distance to liquidation.',
      'سطح واقعی مارجین، نرخ نگهداری و جا شدن سفارش را صرافی تعیین می‌کند؛ پس این فقط برآوردی برای برنامه‌ریزی است. اهرم بیشتر سود نمی‌سازد، فقط فاصله تا لیکوئید شدن را کوتاه می‌کند.'
    ),
  },
  'liquidation-price': {
    name: text('Liquidation Price Estimator', 'برآورد قیمت لیکوئید شدن'),
    tagline: text('Where the venue would likely close you', 'کجا احتمالاً صرافی موقعیتت را می‌بندد'),
    about: text(
      'Estimate the price at which your posted margin no longer covers the maintenance requirement — the level where an isolated position is closed by the venue. It works for either direction and for any leverage you choose to test.',
      'قیمتی را برآورد می‌کند که در آن وجه تضمینِ گذاشته‌شده دیگر الزام نگهداری را پوشش نمی‌دهد؛ همان جایی که صرافی موقعیت جدا را می‌بندد. برای هر دو جهت و هر اهرمی که امتحان می‌کنی کار می‌کند.'
    ),
    method: text(
      'For a long, the liquidation price is the point where the loss from entry has eaten the posted margin down to the maintenance requirement, which gives (notional − margin) ÷ (quantity × (1 − maintenance rate)). A short uses (notional + margin) ÷ (quantity × (1 + maintenance rate)). If you do not supply your own margin, it is derived from leverage.',
      'در پوزیشن خرید، قیمت لیکوئید جایی است که زیان از قیمت ورود، وجه تضمین را تا الزام نگهداری خورده است؛ یعنی (ارزش اسمی − مارجین) ÷ (تعداد × (۱ − نرخ نگهداری)). در پوزیشن فروش از (ارزش اسمی + مارجین) ÷ (تعداد × (۱ + نرخ نگهداری)) استفاده می‌شود. اگر خودت مارجین وارد نکنی، از روی اهرم محاسبه می‌شود.'
    ),
    assumptions: [
      text('Isolated margin mode, with margin equal to notional ÷ leverage.', 'حالت مارجین جدا، با مارجین برابر ارزش اسمی تقسیم‌بر اهرم.'),
      text('One maintenance rate, applied to the liquidation notional.', 'یک نرخ نگهداری ثابت، اعمال‌شده بر ارزش اسمی در لحظهٔ لیکوئید.'),
      text('No funding, no fees and no spread widening during the move.', 'بدون فاندینگ، بدون کارمزد و بدون بازتر شدن اسپرد در حرکت قیمت.'),
      text('The mark price path is continuous — no gap through the level.', 'مسیر مارک پرایس پیوسته فرض می‌شود؛ یعنی گپ از این سطح رد شدن نداریم.'),
    ],
    limitations: text(
      'The real liquidation price depends on the execution venue, the margin mode, maintenance tiers that change with position size, accrued fees and funding, and market conditions at that moment. This is an estimate for risk planning, not a venue quote, and cross-margin positions depend on the whole account.',
      'قیمت واقعی لیکوئید به صرافی اجراکننده، حالت مارجین، پله‌های نگهداری که با اندازهٔ موقعیت عوض می‌شوند، کارمزد و فاندینگ انباشت‌شده و شرایط بازار آن لحظه بستگی دارد. این یک برآورد برای برنامه‌ریزی ریسک است، نه قیمت‌گیری صرافی؛ در حالت مارجین مشترک هم کل حساب دخیل می‌شود.'
    ),
  },
  'perp-pnl': {
    name: text('Perpetual Futures PnL Calculator', 'محاسبهٔ سود و زیان معاملات آنی'),
    tagline: text('Net result after fees and funding', 'نتیجهٔ خالص بعد از کارمزد و فاندینگ'),
    about: text(
      'Work out what a round trip actually leaves you with: price move, fees on both legs and the funding paid or received while the position was open. It also reports the break-even exit, where your all-in result would have been zero.',
      'حساب می‌کند یک رفت و برگشت واقعاً چقدر برایت می‌ماند: تغییر قیمت، کارمزد هر دو پا و فاندینگی که در دورهٔ باز ماندن موقعیت پرداخت یا دریافت کرده‌ای. قیمت خروج سربه‌سر را هم نشان می‌دهد؛ جایی که نتیجهٔ کل صفر می‌شد.'
    ),
    method: text(
      'Gross profit is direction × (exit − entry) × quantity × contract size. Open and close fees are charged on their own notionals, and funding is applied to the position value for the intervals you held. Net is gross minus both costs, and return on investment is expressed against the posted margin. The break-even exit solves the same expression for a net result of zero, so fees and funding are already inside it.',
      'سود ناخالص برابر است با جهت × (خروج − ورود) × تعداد × اندازهٔ قرارداد. کارمزد باز و بسته شدن روی ارزش اسمی هر پای خودشان حساب می‌شود و فاندینگ به ازای هر بازهٔ نگه‌داری روی ارزش موقعیت اعمال می‌شود. خالص، سود ناخالص منهای این دو هزینه است و بازده نسبت به مارجین گذاشته‌شده گزارش می‌شود. قیمت خروج سربه‌سر هم همان عبارت را برای نتیجهٔ صفر حل می‌کند؛ پس کارمزد و فاندینگ داخل آن لحاظ شده‌اند.'
    ),
    assumptions: [
      text('Both legs are filled at the prices you type.', 'هر دو پا دقیقاً روی قیمت‌هایی که وارد می‌کنی اجرا می‌شوند.'),
      text('Funding is entered as a total percentage of position value over the holding period.', 'فاندینگ به‌صورت درصدی از ارزش موقعیت در کل دورهٔ نگه‌داری وارد می‌شود.'),
      text('A long pays funding when the rate is positive; a short receives it.', 'در نرخ مثبت، خریدار فاندینگ می‌دهد و فروشنده دریافت می‌کند.'),
      text('Contract size and quantity stay constant.', 'اندازهٔ قرارداد و تعداد در کل معامله ثابت می‌مانند.'),
    ],
    limitations: text(
      'Real results differ because of slippage, partial fills, changing funding rates and fee tiers, and because closing a position early changes how much funding accrues. Use it to compare scenarios, not to reproduce a past trade exactly.',
      'نتیجهٔ واقعی به‌خاطر اسلیپیج، اجراهای جزئی، تغییر نرخ فاندینگ و سطوح کارمزد متفاوت است و بستن زودهنگام موقعیت هم مقدار فاندینگ را عوض می‌کند. از آن برای مقایسهٔ سناریوها استفاده کن، نه برای بازتولید دقیق یک معاملهٔ گذشته.'
    ),
  },
  'funding-rate': {
    name: text('Funding Rate Calculator', 'محاسبهٔ نرخ فاندینگ'),
    tagline: text('What holding a perp costs you over time', 'نگهداری یک پوزیشن آنی چقدر هزینه دارد'),
    about: text(
      'Funding is the periodic payment between longs and shorts that keeps a perpetual contract near the spot price. This calculator turns a rate per interval into the money you pay or receive, and into an annualised figure you can compare.',
      'فاندینگ پرداخت دوره‌ای میان خریداران و فروشندگان است تا قیمت قرارداد آنی به قیمت نقدی نزدیک بماند. این ابزار، نرخ هر بازه را به مبلغی تبدیل می‌کند که پرداخت یا دریافت می‌کنی و به عددی سالانه که قابل مقایسه است.'
    ),
    method: text(
      'Position value is quantity multiplied by the mark price. Each interval costs position value × funding rate, and the total is that figure multiplied by the number of intervals in the time you held the position. Annualising multiplies the rate by intervals per day and by 365 days. The final view also expresses the cost against posted margin, so leverage is visible.',
      'ارزش موقعیت از تعداد ضرب‌در مارک پرایس به دست می‌آید. هزینهٔ هر بازه برابر است با ارزش موقعیت × نرخ فاندینگ، و جمع کل همان عدد ضرب‌در تعداد بازه‌های مدت نگه‌داری است. برای سالانه کردن، نرخ در تعداد بازه در روز و در ۳۶۵ روز ضرب می‌شود. نمای پایانی هزینه را نسبت به مارجین گذاشته‌شده هم نشان می‌دهد تا اثر اهرم دیده شود.'
    ),
    assumptions: [
      text('The rate stays constant across the holding period.', 'نرخ در تمام دورهٔ نگه‌داری ثابت می‌ماند.'),
      text('The mark price used for the position value does not move.', 'مارک پرایسی که برای ارزش موقعیت استفاده می‌شود تغییر نمی‌کند.'),
      text('Three intervals per day is the common convention; the interval count is editable.', 'سه بازه در روز رایج است؛ ولی تعداد بازه قابل تغییر است.'),
      text('A positive rate means longs pay and shorts receive.', 'نرخ مثبت یعنی خریدار پرداخت و فروشنده دریافت می‌کند.'),
    ],
    limitations: text(
      'Funding is set by each venue and changes from interval to interval, so the annualised number is an extrapolation, not a forecast. It is also a payment between traders, not a fee charged by Openfund, and Openfund does not collect it.',
      'فاندینگ را هر صرافی تعیین می‌کند و از یک بازه به بازهٔ بعد تغییر می‌کند؛ پس عدد سالانه یک برون‌یابی است، نه پیش‌بینی. این هم پرداخت میان معامله‌گران است، نه کارمزدی که اوپن‌فاند می‌گیرد — و اوپن‌فاند آن را دریافت نمی‌کند.'
    ),
  },
  'risk-reward': {
    name: text('Risk/Reward Calculator', 'محاسبهٔ ریسک به ریوارد'),
    tagline: text('Is the payoff worth this stop?', 'آیندهٔ این حد ضرر ارزش دارد؟'),
    about: text(
      'Compare what you are risking with what you are aiming for, in price distance and in money, and see what win rate the setup needs just to break even.',
      'میزان ریسک را با هدف مقایسه کن؛ هم به فاصلهٔ قیمتی و هم به مبلغ — و ببین این ستاپ برای سربه‌سر شدن به چه درصد بردی نیاز دارد.'
    ),
    method: text(
      'Risk per unit is the distance from entry to stop, reward per unit the distance from entry to target; their ratio is the reward-to-risk figure. Planned money at risk comes from account equity × risk percentage, and the planned reward scales by the same ratio. With a win rate supplied, expectancy is p × average win − (1 − p) × average loss, expressed in money and in R multiples. The break-even win rate is risk ÷ (risk + reward); a fee-adjusted version treats the round-trip cost as extra risk.',
      'ریسک به ازای هر واحد، فاصلهٔ ورود تا حد ضرر و ریوارد، فاصلهٔ ورود تا هدف است؛ نسبت این دو، ریوارد به ریسک را می‌دهد. مبلغ ریسکِ برنامه‌ریزی‌شده از موجودی × درصد ریسک می‌آید و ریوارد برنامه‌ریزی‌شده با همان نسبت مقیاس می‌شود. اگر درصد برد وارد کنی، امید ریاضی برابر p × میانگین برد − (۱ − p) × میانگین باخت است؛ هم به مبلغ و هم بر حسب واحد R. درصد برد سربه‌سر از ریسک ÷ (ریسک + ریوارد) می‌آید و نسخهٔ اصلاح‌شده با کارمزد، هزینهٔ رفت و برگشت را به ریسک اضافه می‌کند.'
    ),
    assumptions: [
      text('The stop and the target are both reached at the typed prices.', 'هم حد ضرر و هم هدف دقیقاً روی قیمت‌های واردشده اجرا می‌شوند.'),
      text('Win rate, when supplied, describes your own past sample or a hypothesis.', 'درصد برد، اگر وارد شود، مربوط به نمونهٔ گذشتهٔ خودت یا یک فرض است.'),
      text('One position at a time; correlated concurrent trades are not modelled.', 'یک موقعیت در هر زمان؛ هم‌زمانیِ همبسته مدل نشده است.'),
      text('Fees are a single round-trip percentage.', 'کارمزد یک درصد رفت و برگشت ساده است.'),
    ],
    limitations: text(
      'A large ratio does not make a trade likely: setups with high reward-to-risk usually win less often. Expectancy is only as good as the win-rate input, and past frequencies drift. The calculator cannot see whether your stop is reachable in the market structure.',
      'نسبت بزرگ، معامله را محتمل نمی‌کند: ستاپ‌های با ریوارد به ریسک بالا معمولاً کمتر می‌برند. امید ریاضی به همان اندازه که ورودی درصد برد قابل‌اتکاست معتبر است و فراوانی گذشته تغییر می‌کند. اینکه حد ضررت در ساختار بازار قابل رسیدن هست یا نه، در این ابزار دیده نمی‌شود.'
    ),
  },
  'risk-of-ruin': {
    name: text('Risk of Ruin Calculator', 'محاسبهٔ احتمال از دست دادن کل سرمایه'),
    tagline: text('How often a sized edge still busts', 'چرا ریسک درست هم گاهی همه‌چیز را می‌بازد'),
    about: text(
      'Estimates the probability that your account falls to a level you have decided you cannot continue from, given your win rate, average win and loss, and the fraction of capital you risk per trade.',
      'احتمال آن را برآورد می‌کند که حساب تو به سطحی برسد که تصمیم گرفته‌ای ادامه ندهی؛ با توجه به درصد برد، میانگین برد و باخت، و درصدی از سرمایه که در هر معامله ریسک می‌کنی.'
    ),
    method: text(
      'Your inputs are converted into the mean and the variance of per-trade returns at the chosen risk fraction. The estimate then applies the standard diffusion approximation, P ≈ exp(−2 × mean × ln(capital ÷ stop-out level) ÷ variance). Alongside it you get the per-trade edge, the Kelly fraction for these inputs, and the largest risk fraction that keeps the estimated probability below 5%.',
      'ورودی‌هایت به میانگین و واریانس بازده هر معامله در آن درصد ریسک تبدیل می‌شوند. سپس برآورد با تقریب رایج انتشار انجام می‌شود: P ≈ exp(−۲ × میانگین × ln(سرمایه ÷ سطح توقف) ÷ واریانس). در کنار آن، لبهٔ هر معامله، نسبت Kelly برای این ورودی‌ها و بیشترین درصد ریسکی که احتمال برآوردی را زیر ۵٪ نگه می‌دارد نمایش داده می‌شود.'
    ),
    assumptions: [
      text('Trades are independent and identically distributed.', 'معاملات مستقل و با توزیع یکسان فرض می‌شوند.'),
      text('Your edge and dispersion stay constant over the whole sequence.', 'لبه و پراکندگی تو در کل زنجیره ثابت می‌مانند.'),
      text('Sizing is a fixed fraction of current capital.', 'حجم‌گذاری درصد ثابتی از سرمایهٔ جاری است.'),
      text('The continuous approximation ignores discrete bet sizes.', 'تقریب پیوسته، گسسته بودن اندازهٔ هر شرط را نادیده می‌گیرد.'),
      text('A zero or negative edge is reported as certain ruin over an infinite sequence.', 'لبهٔ صفر یا منفی، ویرانی قطعی در توالی بی‌پایان گزارش می‌شود.'),
    ],
    limitations: text(
      'This is a statistical model, not a prediction. Real sequences are autocorrelated, edge drifts, regimes change and brokers, venues and rules fail. A low number here is not a guarantee of survival, and a high one is not proof that you should stop — it is a reason to reduce the risk per trade. The figures are also sensitive to the average loss you assume.',
      'این یک مدل آماری است، نه پیش‌گویی. زنجیره‌های واقعی خودهمبسته‌اند، لبه تغییر می‌کند، رژیم‌های بازار جابه‌جا می‌شوند و کارگزار، صرافی و قواعد هم ممکن است بایستند. عدد پایین اینجا تضمین بقا نیست و عدد بالا هم دلیلِ رها کردن نیست — فقط دلیلی است برای کم کردن ریسک هر معامله. خروجی به میانگین باختی که فرض می‌کنی هم بسیار حساس است.'
    ),
  },
  'prop-drawdown': {
    name: text('Prop Drawdown Calculator', 'محاسبهٔ دراودان حساب پراپ'),
    tagline: text('How much loss room is left today', 'امروز چقدر جا برای ضرر مانده'),
    about: text(
      'For a chosen challenge model, shows the daily loss allowance and the total-loss allowance, what you have already used, what is left, and whether the additional open risk you are planning would put the account past a limit.',
      'برای مدل چلنجی که انتخاب می‌کنی، سقف ضرر روزانه و سقف ضرر کل، مقدار مصرف‌شده، باقیمانده و اینکه آیا ریسک بازِ برنامه‌ریزی‌شده‌ات حساب را از حد عبور می‌دهد را نشان می‌دهد.'
    ),
    method: text(
      'The daily allowance is the model percentage applied to the higher of your day-start balance or day-start equity, and it resets at 00:00 UTC+3. Used amount is the drop of current equity from that baseline. The total allowance is static on the Standard and One-phase models, and trailing on the Instant model, where it follows the best recorded balance or equity level. Remaining room is the difference, and the breach check adds the open risk you type so you see the outcome before it happens.',
      'سقف روزانه، درصد همان مدل است که بر بزرگ‌ترِ موجودی یا ارزش خالصِ ابتدای روز اعمال می‌شود و هر روز ساعت ۰۰:۰۰ (UTC+3) بازنشانی می‌شود. مقدار استفاده‌شده، افت ارزش خالص فعلی از همان مبنای ابتدای روز است. سقف ضرر کل در مدل‌های استاندارد و تک‌مرحله‌ای ثابت است و در مدل آنی شناور، که از بهترین سطح ثبت‌شدهٔ موجودی یا اکوییتی پیروی می‌کند. باقیمانده از اختلاف این دو می‌آید و بررسی نقض، ریسک بازِ واردشده توسط تو را هم اضافه می‌کند تا نتیجه را پیش از وقوع ببینی.'
    ),
    assumptions: [
      text('The model terms are the published challenge terms of record.', 'ارقام، همان شرایط منتشرشده و مرجعِ چلنج‌هاست.'),
      text('Purchase activation, funded accounts and payouts are not enabled in this release.', 'فعال‌سازی خرید، حساب فاندشده و برداشت در این نسخه فعال نیست.'),
      text('The simulated demo account you can use today does not enforce these commercial limits.', 'حساب دموی شبیه‌سازی‌شده‌ای که امروز در دسترس است این سقف‌های تجاری را اعمال نمی‌کند.'),
      text('Day-start and current values are typed in, not read from an account.', 'مقادیر ابتدای روز و فعلی را تو وارد می‌کنی؛ از حساب خوانده نمی‌شود.'),
    ],
    limitations: text(
      'It mirrors the rulebook arithmetic; it is not your account state and cannot see other open positions, intraday equity swings or the exact reset moment of your venue. The authoritative record is always your account page and the published rulebook.',
      'این ابزار حساب کتاب رول‌بوک را بازتولید می‌کند؛ وضعیت حساب تو نیست و سایر موقعیت‌های باز، نوسان لحظه‌ای اکوییتی و زمان دقیق بازنشانی را نمی‌بیند. مرجع همیشگی، صفحهٔ حساب تو و رول‌بوک منتشرشده است.'
    ),
  },
  'consistency-rule': {
    name: text('Consistency Rule Calculator', 'محاسبهٔ قانون تداوم'),
    tagline: text('Is tomorrow’s big day allowed?', 'فردا روزِ بزرگ مجاز است؟'),
    about: text(
      'Enter the profit of each trading day and see whether your best day already exceeds the allowed share of total profit, how large a single day may still be, and how much room you have left.',
      'سود هر روز معاملاتی را وارد کن تا ببینی آیا بهترین روزت از سهم مجازِ سود کل گذشته است، یک روز حداکثر چقدر می‌تواند باشد و چقدر جا مانده است.'
    ),
    method: text(
      'Total profit is the sum of the daily figures, and the consistency share is the largest single day divided by that total. The rule passes when the share stays within the limit you select. The calculator also reports the biggest day that is still allowed at your current total, and — if you keep earning the same total — the largest future single day that would not break the limit.',
      'سود کل، جمع ارقام روزانه است و سهم تداوم، بزرگ‌ترین روز تقسیم‌بر همان کل. قانون برقرار است تا وقتی این سهم زیر حد انتخابی تو بماند. ابزار همچنین بزرگ‌ترین روزی که هنوز با سود فعلی مجاز است، و اگر به همان روند ادامه دهی بزرگ‌ترین روزِ آینده که تداوم را نمی‌شکند، گزارش می‌کند.'
    ),
    assumptions: [
      text('Daily figures are net closed profit per day, in one currency.', 'عددهای روزانه، سود خالص بسته‌شده در هر روز و با یک واحد پولی است.'),
      text('Only profitable days matter for the share; losing days lower the total.', 'برای سهم فقط روزهای سودده مهم‌اند؛ روزهای زیان‌ده جمع را کم می‌کنند.'),
      text('Consistency is a payout condition in the published terms, not a trading restriction.', 'تداوم در شرایط منتشرشده یک شرط برداشت است، نه محدودیت معاملاتی.'),
      text('The limit you choose (35% or 15%) follows the model you are on.', 'حد انتخابی تو (۳۵٪ یا ۱۵٪) از مدل فعالِ حساب پیروی می‌کند.'),
    ],
    limitations: text(
      'The share is computed on closed daily profit exactly as you enter it; the account record remains the source of truth. Deliberately engineering small days only to place one huge day defeats the purpose of the rule and can still fail other payout conditions.',
      'سهم دقیقاً بر سود بسته‌شدهٔ روزانه‌ای که وارد می‌کنی محاسبه می‌شود؛ مرجع همان سوابق حساب است. روزهای کوچک را صرفاً ساختن تا یک روز بسیار بزرگ بگذاری، با هدف قانون در نمی‌آید و همچنان می‌تواند شرط‌های دیگر برداشت را رد کند.'
    ),
  },
  'journal-analyzer': {
    name: text('Trading Journal Analyzer', 'تحلیل‌گر ژورنال معاملاتی'),
    tagline: text('Your own CSV, measured honestly', 'CSV خودت، بی‌تعارف سنجیده می‌شود'),
    about: text(
      'Import a CSV of your closed trades and get the statistics that actually describe a record: net profit, win rate, profit factor, expectancy, drawdown, streaks and the share of your profit that came from a single day.',
      'فایل CSV معاملات بسته‌شده‌ات را درون‌ریزی کن و آمارهایی بگیر که واقعاً سابقه‌ات را توصیف می‌کنند: سود خالص، درصد برد، ضریب سود، امید ریاضی، بیشترین افت، رشته‌های برد و باخت، و سهم یک روز از کل سود.'
    ),
    method: text(
      'The file is parsed in your browser, rows are validated, and net profit per trade is taken from the profit column, with fees subtracted when the file provides them. Trades are then ordered chronologically to build an equity curve for the drawdown figures, grouped by day for the per-day and consistency views, and split into winning and losing runs for the streak statistics. Profit factor is gross profit divided by gross loss, expectancy is p × average win − (1 − p) × average loss, and any row that cannot be parsed is listed rather than silently dropped.',
      'فایل در مرورگر تو خوانده می‌شود، سطرها اعتبارسنجی می‌شوند و سود خالص هر معامله از ستون سود برداشته می‌شود؛ اگر فایل ستون کارمزد داشته باشد، کسر می‌شود. سپس معاملات بر اساس زمان مرتب می‌شوند تا منحنی سرمایه برای محاسبهٔ افت ساخته شود، بر حسب روز گروه‌بندی می‌شوند تا نمای روزانه و تداوم درست شود، و برای آمار رشته‌ها به برد و باخت تفکیک می‌شوند. ضریب سود، سود ناخالص تقسیم‌بر زیان ناخالص است و امید ریاضی برابر p × میانگین برد − (۱ − p) × میانگین باخت؛ هر سطری که خوانده نشود، به‌جای حذف بی‌صدا، فهرست می‌شود.'
    ),
    assumptions: [
      text('The file holds closed trades with a per-trade profit figure.', 'فایل شامل معاملات بسته‌شده با عدد سود هر معامله است.'),
      text('Profit values are net of the market impact of your own fills.', 'مقادیر سود، پس از اثر اجرای خودِ سفارش‌ها در نظر گرفته شده‌اند.'),
      text('Rows are assumed unique; duplicates are reported, not merged.', 'تکراری نبودن سطرها فرض می‌شود؛ تکراری‌ها گزارش می‌شوند، ادغام نمی‌شوند.'),
      text('The document on the page describes the accepted columns.', 'راهنمای همان صفحه ستون‌های پذیرفته‌شده را توضیح می‌دهد.'),
      text('Nothing leaves your device; the file is never uploaded.', 'هیچ داده‌ای از دستگاه تو خارج نمی‌شود و فایل هرگز بارگذاری نمی‌شود.'),
    ],
    limitations: text(
      'Statistics describe the past, not the next trade. A short journal is noise: the metrics only become meaningful with a large, honestly recorded sample, and they cannot see the trades you did not take, skipped or mis-entered.',
      'آمار گذشته را توصیف می‌کند، نه معاملهٔ بعدی. ژورنال کوتاه فقط نویز است: این معیارها با نمونهٔ بزرگ و صادقانه ثبت‌شده معنا پیدا می‌کنند و نمی‌توانند معاملاتی را که نزدهی، جا انداخته‌ای یا اشتباه ثبت کرده‌ای ببینند.'
    ),
  },
}
