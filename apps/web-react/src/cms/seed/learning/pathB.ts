import { text } from '../../../features/information/content'
import type { LearningPathContent } from '../../contentTypes'

/** Learning Center - Path B: Leverage and risk.
 *  Repo authoring source for the second foundation path. Educational content
 *  only: it explains general margin, liquidation, drawdown and sizing mechanics
 *  and never recommends a trade or promises profit. Openfund-specific claims
 *  stay inside the verified set - Prop Trading is a server-side simulated demo
 *  (one per user, 100,000 virtual DAI allocated once, priced from live Gains
 *  Network mark prices, with no deposits, withdrawals, refills or resets), the
 *  published challenge terms are not purchasable or enforced in this release,
 *  and Perpetual Trading is read-only, with no order-book depth, open interest
 *  or trade tape in the feed. NOT imported by the app at runtime. */
export const pathB: LearningPathContent = {
  key: 'risk',
  slug: 'leverage-and-risk',
  sort: 2,
  level: 'foundation',
  eyebrow: text('Path B · Risk', 'مسیر B · اهرم و ریسک'),
  title: text('Leverage and risk', 'اهرم و ریسک'),
  summary: text(
    'What leverage takes from you when you are wrong: how margin sets exposure, how isolated and cross margin change the size of a bad day, where a stop-loss belongs, and how drawdown and position sizing decide whether you are still trading after a losing streak.',
    'وقتی اشتباه می‌کنید اهرم چه چیزی از شما می‌گیرد: وجه تضمین چگونه مواجهه می‌سازد، مارجین جدا و مارجین مشترک دامنهٔ یک روز بد را چگونه تغییر می‌دهند، حد ضرر کجا باید بنشیند و دراودان و حجم‌گذاری پوزیشن مشخص می‌کنند پس از یک رشته‌ضرر هنوز معامله می‌کنید یا نه.'
  ),
  outcomes: [
    text('you can turn margin and leverage into a notional and a distance to liquidation', 'می‌توانی از وجه تضمین و اهرم به ارزش اسمی و فاصله تا لیکوئیدیشن برسی'),
    text('you can choose isolated or cross margin knowing exactly what each one exposes', 'می‌توانی با آگاهی از اینکه هرکدام دقیقاً چه چیزی را در معرض می‌گذارد، مارجین جدا یا مشترک را انتخاب کنی'),
    text('you can place a stop on a level you can defend instead of a round number', 'می‌توانی حد ضرر را روی سطحی بچینی که قابل دفاع است، نه روی یک عدد رُند'),
    text('you can size a position from a fixed risk fraction and measure the damage of a losing streak', 'می‌توانی حجم پوزیشن را از کسرِ ریسکِ ثابت بگیری و آسیبِ یک رشته‌ضرر را اندازه کنی'),
  ],
  lessons: [
    {
      slug: 'margin-and-leverage-basics',
      path: 'leverage-and-risk',
      sort: 1,
      minutes: 8,
      status: 'published',
      title: text('Margin and leverage: the basics', 'مبنای مارجین و اهرم'),
      summary: text(
        'Margin is the collateral you lock up and leverage is the exposure it buys; this lesson turns those two numbers into the arithmetic of amplification.',
        'وجه تضمین پولی است که قفل می‌کنید و اهرم مواجهه‌ای است که همان پول می‌خرد؛ این درس این دو عدد را به حساب‌وکتابِ بزرگ‌نمایی تبدیل می‌کند.'
      ),
      takeaways: [
        text('Leverage is notional divided by margin: a ratio between two sizes', 'اهرم یعنی ارزش اسمی تقسیم‌بر وجه تضمین؛ نسبتی میان دو اندازه'),
        text('A 1% move in the underlying is a leverage-sized move in your equity', 'حرکت ۱٪ در دارایی پایه، در ارزش خالص شما به اندازهٔ همان اهرم بزرگ می‌شود'),
        text('Used margin reserves capital; free margin is what actually absorbs a loss', 'وجه تضمین مصرف‌شده سرمایه را رزرو می‌کند؛ همان وجه تضمین آزاد است که ضرر را جذب می‌کند'),
        text('Leverage is an exposure setting you choose before the market chooses for you', 'اهرم تنظیمِ مواجهه است و شما پیش از آنکه بازار برایتان تصمیم بگیرد آن را می‌گزینید'),
      ],
      glossary: ['margin', 'leverage', 'notional-value', 'maintenance-margin'],
      tools: ['leverage-margin', 'position-size'],
      blocks: [
        {
          type: 'p',
          text: text(
            'Margin is the money you lock up; leverage is the exposure that money buys. Every leveraged position answers one question: how much market value am I controlling, and how much of my own capital stands behind it. Get those two numbers straight and most of risk management becomes plain arithmetic.',
            'وجه تضمین پولی است که قفل می‌کنید و اهرم، مواجهه‌ای است که همان پول می‌خرد. هر پوزیشن اهرم‌دار به یک سؤال پاسخ می‌دهد: چه ارزش بازاری را در دست دارم و چه سهمی از سرمایهٔ خودم پشت آن ایستاده است. وقتی این دو عدد روشن شود، بیشترِ مدیریت ریسک حساب‌وکتابِ ساده می‌شود.'
          )
        },
        { type: 'h2', text: text('Turning margin into exposure', 'تبدیل وجه تضمین به مواجهه') },
        {
          type: 'formula',
          expr: 'leverage = notional / margin',
          text: text('Leverage is a ratio of two sizes, not a promise about returns: the position you hold divided by the collateral behind it.', 'اهرم نسبتِ دو اندازه است، نه وعدهٔ بازده: ارزش اسمی پوزیشن تقسیم‌بر وثیقه‌ای که پشتش گذاشته‌اید.')
        },
        {
          type: 'formula',
          expr: 'margin = notional / leverage',
          text: text('Rearranged, the same relation shows the deposit a position needs: a 10,000 notional at 10x ties up 1,000 of margin before fees.', 'اگر همین رابطه را بازمچینیم، سپردهٔ لازم روشن می‌شود: ارزش اسمی ۱۰٬۰۰۰ با اهرم ۱۰×، پیش از کارمزد ۱٬۰۰۰ وجه تضمین می‌خواهد.')
        },
        {
          type: 'p',
          text: text(
            'The words carry precise meanings. Notional value is the full market size of the position, meaning how much of the asset you effectively control. Margin is the slice of your own equity reserved against it. Leverage simply states how many times bigger the first is than the second, which is why raising leverage does not hand you a bigger position for nothing: it takes the buffer you were holding and converts it into exposure.',
            'این واژه‌ها معنای دقیقی دارند. ارزش اسمی، اندازهٔ کاملِ بازارِ پوزیشن است؛ یعنی در عمل چه مقدار از دارایی را کنترل می‌کنید. وجه تضمین، برشی از ارزش خالص شماست که در برابر آن رزرو شده است. اهرم هم فقط می‌گوید اولی چند برابر دومی است؛ به همین دلیل بالا بردنِ اهرم پوزیشنِ بزرگ‌ترِ رایگان به شما نمی‌دهد: حائلِ امنی را که نگه داشته بودید برمی‌دارد و آن را به مواجهه تبدیل می‌کند.'
          )
        },
        { type: 'h2', text: text('The amplification rule', 'قانون بزرگ‌نمایی') },
        {
          type: 'formula',
          expr: 'equity change % = leverage * underlying price move %',
          text: text('A 10x position turns a 1% move in the underlying into a 10% move in your equity, with no preference between profit and loss.', 'پوزیشن ۱۰× حرکت ۱٪ِ دارایی پایه را به حرکت ۱۰٪ در ارزش خالص شما تبدیل می‌کند؛ در سود یا زیان، بی هیچ ترجیحی میان این دو.')
        },
        {
          type: 'p',
          text: text(
            'Work one line of the table in your head. Put up 1,000 of margin and open a 10,000 notional: that is 10x, so a 2% adverse move in price is 200 of loss, or 20% of the collateral you posted. The same 2% at 2x would have cost 10% of a larger deposit. Nothing about the market changed between those two trades; only the ratio you chose did.',
            'یک سطر از جدول را در ذهن حل کنید. ۱٬۰۰۰ وجه تضمین می‌گذارید و ارزش اسمی ۱۰٬۰۰۰ می‌سازید: همان ۱۰× است، پس حرکت ۲٪ به ضدِ شما ۲۰۰ واحد زیان می‌شود؛ یعنی ۲۰٪ از وثیقه‌ای که گذاشته‌اید. همان ۲٪ با اهرم ۲× روی سپردهٔ بزرگ‌تر، ۱۰٪ هزینه می‌کرد. میان این دو معامله هیچ چیزی در بازار عوض نشده بود؛ تنها چیزِ عوض‌شده نسبتی بود که خودتان انتخاب کرده بودید.'
          )
        },
        {
          type: 'table',
          caption: text('The same 1% underlying move, four ways (hypothetical)', 'یک حرکت ۱٪ در دارایی پایه، به چهار شیوه (فرضی)'),
          head: [text('Leverage', 'اهرم'), text('Margin for a 10,000 notional', 'وجه تضمین ارزش اسمی ۱۰٬۰۰۰'), text('Equity change on a 1% move', 'تغییر ارزش خالص با حرکت ۱٪')],
          rows: [
            [text('1x', '۱×'), text('10,000', '۱۰٬۰۰۰'), text('1%', '۱٪')],
            [text('2x', '۲×'), text('5,000', '۵٬۰۰۰'), text('2%', '۲٪')],
            [text('5x', '۵×'), text('2,000', '۲٬۰۰۰'), text('5%', '۵٪')],
            [text('10x', '۱۰×'), text('1,000', '۱٬۰۰۰'), text('10%', '۱۰٪')],
          ]
        },
        { type: 'h2', text: text('Why leverage shortens the runway', 'چرا اهرم پیستِ فرود را کوتاه می‌کند') },
        {
          type: 'terms',
          items: [
            { term: text('Initial margin', 'وجه تضمین اولیه'), text: text('The collateral required to open a position at the leverage you chose.', 'وجه تضمینی که برای باز کردن پوزیشن با اهرم انتخابی لازم است.') },
            { term: text('Maintenance margin', 'وجه تضمین نگهداشت'), text: text('The smaller floor that must stay behind the position for it to remain open.', 'کفِ کوچک‌تری که باید پشت پوزیشن بماند تا آن پوزیشن باز بماند.') },
            { term: text('Free margin', 'وجه تضمین آزاد'), text: text('Equity left after used margin; it absorbs losses before a forced close.', 'ارزش خالصِ باقی‌مانده پس از وجه تضمین مصرف‌شده؛ همان چیزی که پیش از بسته‌شدن اجباری ضرر را جذب می‌کند.') },
          ]
        },
        {
          type: 'p',
          text: text(
            'Your margin is the distance between the entry price and the point where the position stops satisfying the maintenance requirement. Leverage spends that distance on exposure, so 10x leaves roughly one tenth of the price room that 1x leaves. Two traders can be right about the same market and only one of them survives the pullback on the way, purely because of this ratio.',
            'وجه تضمینِ شما همان فاصله میان قیمت ورود و نقطه‌ای است که پوزیشن دیگر وجه تضمین نگهداشت را تأمین نمی‌کند. اهرم این فاصله را صرف مواجهه می‌کند، پس در ۱۰× تقریباً یک‌دهم از آن فضای قیمتی باقی می‌ماند که در ۱× هست. دو معامله‌گر می‌توانند دربارهٔ یک بازار هر دو درست بگویند و فقط یکی از آن‌ها از پسِ اصلاحِ مسیر برآید، و تنها دلیلش همین نسبت باشد.'
          )
        },
        {
          type: 'ul',
          items: [
            text('The buffer between entry and the maintenance floor.', 'حائلِ میان قیمت ورود و کفِ وجه تضمین نگهداشت.'),
            text('The share of your equity that one percent of price consumes.', 'سهمی از ارزش خالص که یک درصدِ حرکت قیمت می‌بلعد.'),
            text('The number of ordinary pullbacks you can still absorb.', 'تعداد اصلاح‌های عادی که هنوز می‌توانید تحمل کنید.'),
          ]
        },
        {
          type: 'note',
          text: text(
            'The Openfund demo is a server-side simulated account: one per user, 100,000 virtual DAI allocated once, priced from live Gains Network mark prices, with no deposits, withdrawals, refills or resets — and a demo profit is not money owed to anyone. Challenge plans publish a reference leverage of 5x; the real per-market maximum comes from the market feed, so read it in the terminal rather than assuming a ceiling.',
            'دموی اوپن‌فاند یک حساب شبیه‌سازی‌شدهٔ سمت سرور است: برای هر کاربر یکی، با ۱۰۰٬۰۰۰ دای مجازی که یک‌بار تخصیص می‌یابد، قیمت‌گذاری‌شده با مارک پرایس زندهٔ Gains Network، بدون واریز، برداشت، شارژ یا بازنشانی — و سود دمو طلبِ مالی هیچ‌کس نیست. پلن‌های چلنج اهرم مرجع ۵× را منتشر می‌کنند، اما سقف واقعیِ هر بازار از فید می‌آید؛ پس به‌جای فرض کردنِ سقفی، آن را در ترمینال بخوانید.'
          )
        },
        {
          type: 'p',
          text: text(
            'Treat leverage as a dial on exposure, not a dial on return. The next lesson covers the single choice that decides how far one bad position can reach into the rest of your account.',
            'اهرم را دستهٔ تنظیمِ مواجهه بدانید، نه دستهٔ تنظیمِ بازده. درس بعد همان انتخابِ واحدی را باز می‌کند که مشخص می‌کند یک پوزیشنِ بد چقدر می‌تواند به بقیهٔ حساب شما دست برساند.'
          )
        },
      ]
    },
    {
      slug: 'isolated-vs-cross-margin',
      path: 'leverage-and-risk',
      sort: 2,
      minutes: 8,
      status: 'published',
      title: text('Isolated vs cross margin', 'مارجین جدا در برابر مارجین مشترک'),
      summary: text(
        'The same size and the same leverage can fail in very different ways, because margin mode decides whether one position has its own collateral or borrows the whole account.',
        'همان حجم و همان اهرم می‌تواند بسیار متفاوت شکست بخورد، چون حالتِ وجه تضمین مشخص می‌کند یک پوزیشن وثیقهٔ مستقل دارد یا از کل حساب وام می‌گیرد.'
      ),
      takeaways: [
        text('Isolated margin rings one position off, so the rest of the account cannot be drained by it', 'مارجین جدا دورِ یک پوزیشن حصار می‌کشد، پس بقیهٔ حساب با آن تخلیه نمی‌شود'),
        text('Cross margin lends the free equity of the account to every open position at once', 'مارجین مشترک، ارزش خالص آزادِ حساب را هم‌زمان به همهٔ پوزیشن‌های باز می‌دهد'),
        text('Shared collateral links liquidations: one fast move can close several positions', 'وثیقهٔ مشترک لیکوئیدیشن‌ها را به هم گره می‌زند؛ یک حرکت تند می‌تواند چند پوزیشن را هم‌زمان ببندد'),
        text('The liquidation formulas are approximations; funding, fees and spread widen the gap', 'فرمول‌های لیکوئیدیشن تقریب‌اند؛ فاندینگ، کارمزد و باز شدن اسپرد این تقریب را از واقع دورتر می‌کنند'),
      ],
      glossary: ['isolated-margin', 'cross-margin', 'liquidation-price', 'maintenance-margin'],
      tools: ['leverage-margin', 'liquidation-price'],
      blocks: [
        {
          type: 'p',
          text: text(
            'Two positions with the same size and the same leverage can still fail in completely different ways. The difference is margin mode: whether the collateral behind a trade is ring-fenced to that trade or shared with every other position you hold. It adds nothing to your expected return and changes almost everything about how a bad day spreads.',
            'دو پوزیشن با همان حجم و همان اهرم می‌توانند کاملاً متفاوت شکست بخورند. تفاوت در حالتِ وجه تضمین است: آیا وثیقهٔ پشت یک معامله فقط به همان معامله محدود شده یا با همهٔ پوزیشن‌های بازِ دیگرِ شما مشترک است. این انتخاب چیزی به بازده مورد انتظار اضافه نمی‌کند، اما تقریباً همه‌چیز را دربارهٔ پخش‌شدنِ یک روز بد در حساب عوض می‌کند.'
          )
        },
        { type: 'h2', text: text('Isolated margin: a wall per position', 'مارجین جدا: یک دیوار برای هر پوزیشن') },
        {
          type: 'p',
          text: text(
            'In isolated mode each position gets its own pocket of collateral. That pocket can be lost and nothing more: if price reaches the liquidation level, the venue closes that one contract and the damage stops at the edge of the pocket. The cost of the wall is that the pocket is small, so adverse movement has little fuel before it hits the limit. Adding margin to a losing position is then a deliberate act: risking more on an idea already wrong.',
            'در حالت مارجین جدا، هر پوزیشن جیبِ وثیقهٔ خودش را دارد. همان جیب ممکن است برود و نه چیزی بیشتر: اگر قیمت به سطح لیکوئیدیشن برسد، صرافی همان یک قرارداد را می‌بندد و خسارت پای همان جیب متوقف می‌شود. بهای این دیوار، کوچک بودنِ همان جیب است؛ پس حرکتِ خلاف، پیش از رسیدن به محدود، سوختِ چندانی ندارد. افزودن وجه تضمین به پوزیشنِ ضررده آن‌گاه یک اقدامِ عامدانه است: به خطر گذاشتنِ بیشتر روی ایده‌ای که همین حالا اشتباه است.'
          )
        },
        {
          type: 'ul',
          items: [
            text('The loss on one position is capped by the margin attached to it.', 'ضرر هر پوزیشن به وجه تضمینِ متصل به همان پوزیشن محدود می‌شود.'),
            text('Each entry needs its own collateral, so total exposure is easier to count.', 'هر ورود به وثیقهٔ خودش نیاز دارد، پس شمارشِ مجموع مواجهه آسان‌تر است.'),
            text('Extending a losing trade is an explicit action, never an automatic one.', 'ادامه دادنِ یک معاملهٔ ضررده همیشه اقدامی صریح است و هیچ‌گاه خودکار نیست.'),
            text('A forced close leaves the rest of the account untouched.', 'بسته‌شدن اجباری، بقیهٔ حساب را دست‌نخورده می‌گذارد.'),
          ]
        },
        { type: 'h2', text: text('Cross margin: one buffer for everyone', 'مارجین مشترک: یک حائل برای همه') },
        {
          type: 'p',
          text: text(
            'Cross mode pools the free equity of the account behind every open position at once, so a losing trade is measured against the whole balance and can absorb far more adverse movement before it is closed. That is also the danger: a position that would have died quietly in isolation now draws collateral out of the account, and in a fast market several positions can consume the shared buffer together. When the pool runs out, everything resting on it is liquidated, not just the trade that began it.',
            'در حالت مشترک، ارزش خالصِ آزادِ حساب هم‌زمان پشت همهٔ پوزیشن‌های باز می‌رود، پس معاملهٔ ضررده با کلِ موجودی سنجیده می‌شود و پیش از بسته‌شدن نوسانِ خلافِ بسیار بیشتری را تاب می‌آورد. همین ویژگی، خطرِ اصلی است: پوزیشنی که در حالت جدا بی‌سروصدا از بین می‌رفت، حالا وثیقه را از بدنهٔ حساب بیرون می‌کشد و در بازارِ تند چند پوزیشن می‌توانند با هم حائلِ مشترک را تمام کنند. آن‌گاه که مخزن خالی شود، هرچه روی آن ایستاده لیکوئید می‌شود؛ نه فقط معامله‌ای که دردسر را شروع کرده بود.'
          )
        },
        {
          type: 'terms',
          items: [
            { term: text('Isolated margin', 'مارجین جدا'), text: text('Collateral assigned to one position, with the loss bounded by that assignment.', 'وجه تضمینی که فقط به یک پوزیشن تخصیص می‌یابد و ضرر در همان تخصیص متوقف می‌شود.') },
            { term: text('Cross margin', 'مارجین مشترک'), text: text('Account equity shared as collateral across all open positions.', 'ارزش خالص حساب که به‌عنوان وثیقه میان همهٔ پوزیشن‌های باز مشترک است.') },
            { term: text('Used margin', 'وجه تضمین مصرف‌شده'), text: text('Equity locked to keep open positions alive.', 'ارزش خالصی که برای باز نگه‌داشتن پوزیشن‌ها قفل شده است.') },
          ]
        },
        { type: 'h2', text: text('What margin mode does to the liquidation level', 'حالت وجه تضمین با سطح لیکوئیدیشن چه می‌کند') },
        {
          type: 'formula',
          expr: 'isolated long liquidation ~ entry * (1 - 1 / leverage) / (1 - maintenance rate)',
          text: text('A textbook approximation for an isolated long. It ignores funding, fees and spread widening, all of which move the real level closer to your entry.', 'تقریبِ کتابی برای پوزیشنِ خریدِ جدا. فاندینگ، کارمزد و باز شدن اسپرد را نادیده می‌گیرد؛ هر سه چیزی که سطحِ واقعی را به قیمت ورود شما نزدیک‌تر می‌کنند.')
        },
        {
          type: 'formula',
          expr: 'isolated short liquidation ~ entry * (1 + 1 / leverage) / (1 + maintenance rate)',
          text: text('The mirror image for an isolated short, with the same omissions. In cross mode there is no per-position level at all: the venue runs one account-wide margin check instead.', 'تصویرِ آینه‌ای برای پوزیشنِ فروشِ جدا، با همان حذف‌ها. در حالت مشترک اصلاً سطحِ مجزا برای هر پوزیشن وجود ندارد؛ صرافی جای آن یک بررسیِ وجه تضمین در سطحِ کل حساب انجام می‌دهد.')
        },
        {
          type: 'p',
          text: text(
            'Take an entry of 100 at 10x with a maintenance rate of 0.5%. Isolated, the long liquidates near 90: 100 * 0.9 / 0.995 is about 90.45, so roughly a 9.5% adverse move ends the trade and nothing else. Put the same position in cross mode with much more equity behind it, and that same 9.5% move is no longer a wall — it is a withdrawal from the account. The formula did not reward you with extra room; you simply relocated the loss from a position onto your balance.',
            'ورودِ ۱۰۰ با اهرم ۱۰× و نرخ نگهداشت ۰٫۵٪ را در نظر بگیرید. در حالت جدا، پوزیشنِ خرید نزدیک ۹۰ لیکوئید می‌شود: ۱۰۰ × ۰٫۹ ÷ ۰٫۹۹۵ ≈ ۹۰٫۴۵، یعنی حرکتی حدوداً ۹٫۵٪ به ضد که همان‌جا معامله را تمام می‌کند و بس. همان پوزیشن را در حالت مشترک بگذارید در حالی که ارزش خالصِ بسیار بیشتری پشتش است؛ آن‌گاه همان حرکت ۹٫۵٪ دیوار نیست، برداشتی از حساب است. فرمول فضایِ بیشتر را به‌عنوان پاداش به شما نداد؛ شما فقط ضرر را از یک پوزیشن برداشتید و روی موجودی خواباندید.'
          )
        },
        { type: 'h3', text: text('Choosing between the two', 'انتخاب میان این دو') },
        {
          type: 'ol',
          items: [
            text('One idea, sized so that losing it is survivable: isolated, so the cap is real.', 'یک ایده با حجمی که باختنش قابل تحمل است: مارجین جدا، تا سقف واقعاً سقف باشد.'),
            text('Offsetting positions you manage as one book: cross, with a written plan for when to cut.', 'پوزیشن‌هایی که یکدیگر را پوشش می‌دهند و یک‌جا مدیریت می‌شوند: مارجین مشترک، آن‌همه با نقشهٔ مکتوب برای لحظهٔ بریدنِ ضرر.'),
            text('News, a thin book or a weekend gap ahead: isolated, because a gap inside a shared buffer takes the account with it.', 'اخبار، دفترِ کم‌عمق یا گپِ آخر هفته در پیش است: مارجین جدا، چون گپ درونِ حائلِ مشترک حساب را هم با خود می‌برد.'),
            text('Either mode can be lost, so pick it for the blast radius, never for the room to be wrong.', 'در هر دو حالت امکان باخت هست؛ حالت را بر پایهٔ دامنهٔ خسارت انتخاب کنید، نه برای فضایِ بیشتر اشتباه کردن.'),
          ]
        },
        {
          type: 'note',
          text: text(
            'In Openfund, Prop Trading is a server-side simulated demo: margin and forced closes are handled inside that simulation, priced from live Gains Network mark prices, and no demo result creates a claim on capital. Perpetual Trading is read-only today — on-chain execution is not enabled — so it is a place to study prices, not to test margin modes.',
            'در اوپن‌فاند، «معاملات حرفه‌ای» یک دموی شبیه‌سازی‌شدهٔ سمت سرور است: وجه تضمین و بسته‌شدن‌های اجباری درون همان شبیه‌سازی و با مارک پرایس زندهٔ Gains Network مدیریت می‌شوند، و هیچ نتیجهٔ دموی حقِ مالکیت سرمایه ایجاد نمی‌کند. بخش «معاملات آنی» امروز خواندنی است — اجرای آن‌چینی فعال نیست — پس جای بررسیِ قیمت است، نه آزمودنِ حالت‌های وجه تضمین.'
          )
        },
        {
          type: 'p',
          text: text(
            'Margin mode is a decision about how much of your account a single trade is allowed to touch. Make it before you choose the size, and the size becomes much easier to justify.',
            'حالت وجه تضمین یعنی تصمیم دربارهٔ اینکه یک معامله اجازه دارد به چه اندازه‌ای از حساب شما دست بزند. این تصمیم را پیش از تعیین حجم بگیرید؛ آن‌گاه توجیهِ حجم بسیار آسان‌تر می‌شود.'
          )
        },
      ]
    },
    {
      slug: 'stop-loss-placement',
      path: 'leverage-and-risk',
      sort: 3,
      minutes: 9,
      status: 'published',
      title: text('Stop-loss orders: types, placement, common mistakes', 'سفارش حد ضرر: انواع، جای‌گذاری، خطاهای رایج'),
      summary: text(
        'A stop-loss converts an open-ended loss into a defined one, but only if the trigger, the order type and the level behind them were decided before the trade hurt.',
        'حد ضرر، زیانی بی‌پایان به زیانی تعریف‌شده تبدیل می‌کند — اما تنها وقتی ماشه، نوع سفارش و سطحِ پشت آن‌ها پیش از درد گرفتنِ معامله مشخص شده باشد.'
      ),
      takeaways: [
        text('A stop fixes the maximum loss of a trade before the trade is open', 'حد ضرر، سقف ضرر یک معامله را پیش از باز شدن همان معامله معین می‌کند'),
        text('A stop-market guarantees exit and not price; a stop-limit protects price and may leave you holding', 'استاپ‌مارکت خروج را تضمین می‌کند نه قیمت را؛ استاپ‌لیمیت قیمت را نگه می‌دارد ولی ممکن است در پوزیشن بمانید'),
        text('Distance comes from the chart, and size comes from the distance', 'فاصله از نمودار می‌آید و حجم از همان فاصله'),
        text('Inside a challenge, the daily loss limit is the boundary that actually ends the account', 'در چلنج، همان سقف ضرر روزانه است که عملاً حساب را تمام می‌کند'),
      ],
      glossary: ['stop-loss', 'take-profit', 'slippage', 'spread'],
      tools: ['risk-reward', 'position-size'],
      blocks: [
        {
          type: 'p',
          text: text(
            'A stop-loss is a decision taken before you are in pain: the price at which you accept that the reason for the trade has expired and step out. It does not guarantee a good exit. Its value is that it turns an open-ended loss into a defined one, chosen by you in a calm moment instead of by the market in its worst hour.',
            'حد ضرر تصمیمی است که پیش از درد کشیدن می‌گیرید: قیمتی که در آن می‌پذیرید دلیلِ معامله از بین رفته و بیرون می‌آیید. خروجِ خوب را تضمین نمی‌کند. ارزشش این است که زیانِ بی‌انتها را به زیانی تعریف‌شده بدل می‌کند؛ عددی که شما در لحظه‌ای آرام انتخاب کرده‌اید، نه بازار در بدترین ساعتش.'
          )
        },
        { type: 'h2', text: text('The stop order types', 'انواع سفارش استاپ') },
        {
          type: 'terms',
          items: [
            { term: text('Stop-market order', 'سفارش استاپ‌مارکت'), text: text('Becomes a market order at the trigger and exits at whatever the book offers.', 'در ماشه به سفارش بازار بدل می‌شود و با هر قیمتِ دفتر خارج می‌کند.') },
            { term: text('Stop-limit order', 'سفارش استاپ‌لیمیت'), text: text('Becomes a limit order at the trigger: your price or better, or no fill.', 'در ماشه به سفارش لیمیت بدل می‌شود: قیمت شما یا بهتر، یا هیچ اجرا.') },
            { term: text('Trailing stop', 'حد ضرر شناور'), text: text('A trigger that keeps a set distance behind the best price reached.', 'ماشه‌ای که فاصلهٔ مشخصی پشتِ بهترین قیمتِ دیده‌شده می‌ماند.') },
            { term: text('Take-profit', 'حد سود'), text: text('The mirror trigger on the gain side, closing at a preset level.', 'ماشهٔ آینه‌ای در سمتِ سود، بستنِ پوزیشن در سطحی از پیش تعیین‌شده.') },
          ]
        },
        { type: 'h3', text: text('What happens after the trigger', 'پس از ماشه چه می‌افتد') },
        {
          type: 'p',
          text: text(
            'The distinction that matters is the second half of the order. A stop-market order gets you out, because a market order always finds a counterparty somewhere in the book; the price it finds may be far from your trigger if liquidity is thin. A stop-limit order protects the price and gives up certainty: if the market skips through your limit, the order rests unfilled and the position keeps bleeding.',
            'تفاوتِ مهم، نیمهٔ دومِ سفارش است. استاپ‌مارکت شما را خارج می‌کند، چون سفارش بازار همیشه جایی در دفتر طرف مقابل پیدا می‌کند؛ اما اگر نقدینگی کم باشد، قیمتِ اجراشده می‌تواند بسیار دورِ ماشه باشد. استاپ‌لیمیت از قیمت دفاع می‌کند و قطعیت را رها می‌کند: اگر بازار از لیمیت شما رد شود، سفارش بی‌اجرا می‌ماند و پوزیشن به خون‌ریزی ادامه می‌دهد.'
          )
        },
        {
          type: 'formula',
          expr: 'stop distance % = abs(entry - stop price) / entry * 100',
          text: text('Measure the stop in percentage terms before you size anything: that distance is the loss per unit and the denominator of every sizing calculation.', 'پیش از هر حجم‌گذاری، حد ضرر را به درصد بسنجید: همان فاصله، ضررِ هر واحد و مخرجِ هر محاسبهٔ حجم‌گذاری است.')
        },
        { type: 'h2', text: text('Placing it on a level you can defend', 'جای‌گذاری روی سطحی که می‌توانید دفاعش کنید') },
        {
          type: 'ol',
          items: [
            text('State the invalidation: the price at which your reason for entering expires.', 'دلیلِ بی‌اعتباری را بیان کنید: قیمتی که در آن دلیلتان برای ورود از بین می‌رود.'),
            text('Place the stop beyond it, outside ordinary noise.', 'حد ضرر را آن‌سوترِ آن و بیرونِ نویزِ معمول بگذارید.'),
            text('Compare the loss there with your risk budget: if it is too large, cut size, not distance.', 'ضررِ آنجا را با بودجهٔ ریسک مقایسه کنید؛ اگر بزرگ بود، حجم را کم کنید نه فاصله را.'),
            text('Confirm the liquidation estimate sits beyond the stop.', 'اطمینان یابید تخمینِ لیکوئیدیشن آن‌سوتر از حد ضرر است.'),
            text('Leave it alone: moving a stop is a new decision.', 'دست نزنید: جابه‌جا کردن حد ضرر تصمیمی تازه است.'),
          ]
        },
        {
          type: 'p',
          text: text(
            'The order of those steps is the lesson. Most traders run it backwards: they pick a size, watch the number in the loss column, and slide the stop closer so it looks tolerable. The result is a stop attached to no market fact and a position designed to be stopped out. Distance comes from the chart; size comes from the distance.',
            'همین ترتیبِ مراحل، خودِ درس است. بیشترِ معامله‌گران عکسِ آن را می‌روند: حجمی برمی‌گزینند، به عددِ ستونِ ضرر نگاه می‌کنند و بعد حد ضرر را نزدیک‌تر می‌کشند تا قابل تحمل به نظر برسد. نتیجه، حدی است که به هیچ واقعیتِ بازاری وصل نیست و پوزیشنی که عملاً برای زده‌شدن طراحی شده. فاصله از نمودار می‌آید و حجم از همان فاصله.'
          )
        },
        { type: 'h2', text: text('Common mistakes', 'خطاهای رایج') },
        {
          type: 'ul',
          items: [
            text('Parking the stop on an obvious round number, where clustering invites a sweep.', 'گذاشتن حد ضرر روی عدد رُندِ آشکار؛ جایی که تجمعِ سفارش‌ها جاروبش را آسان می‌کند.'),
            text('Widening the stop after entry, raising the risk of a trade already against you.', 'عریض‌کردنِ حد ضرر پس از ورود، که ریسکِ معامله‌ای را که همین حالا خلافِ شماست بالا می‌برد.'),
            text('Averaging down with no stop and calling it a long-term investment.', 'میانگین‌گیریِ کمّی بدون هیچ حد ضرر و تغییرِ نام پوزیشن به سرمایه‌گذاری بلندمدت.'),
            text('Believing a stop fixes a gap: it fixes your level, not the fill you receive.', 'باور اینکه حد ضرر از گپ محافظتتان می‌کند: سطحِ موردنظر را معین می‌کند، نه قیمتی را که تحویل می‌گیرید.'),
            text('Setting the stop tighter than the spread, so ordinary pricing closes you.', 'حد ضرر را تنگ‌تر از اسپرد گذاشتن، تا خودِ رفت‌وبرگشتِ عادیِ قیمت شما را بیرون بیندازد.'),
          ]
        },
        {
          type: 'table',
          caption: text('What each stop guarantees', 'تضمینِ هر نوع حد ضرر'),
          head: [text('Order', 'سفارش'), text('Trigger', 'ماشه'), text('Guaranteed', 'تضمین‌شده'), text('Not guaranteed', 'تضمین‌نشده')],
          rows: [
            [text('Stop-market', 'استاپ‌مارکت'), text('Stop level touched', 'لمسِ سطح حد ضرر'), text('Execution', 'اجرا'), text('Exit price', 'قیمتِ خروج')],
            [text('Stop-limit', 'استاپ‌لیمیت'), text('Stop level touched', 'لمسِ سطح حد ضرر'), text('A price ceiling', 'سقفِ قیمت'), text('Any fill', 'خودِ اجرا')],
            [text('Trailing stop', 'حد ضرر شناور'), text('Distance behind best price', 'فاصله پشتِ بهترین قیمت'), text('A moving stop', 'حدِ متحرک'), text('A fixed loss', 'ضررِ ثابت')],
          ]
        },
        {
          type: 'note',
          text: text(
            'If you trade an evaluation, the stop is not your only boundary. Under the published Openfund terms of record — not purchasable or enforced in this release — the daily loss limit is measured against the higher of day-start balance or day-start equity, resets at 00:00 UTC+3, and touching it once is a breach. Standard: 5% daily (a 3% option) and 10% static total. One-phase: 3% daily (a 2% option) and 12% static total. Instant: a 5% trailing total drawdown that locks at breakeven once the account is 5% in profit. A stop that saves the position but reaches the daily limit still costs you the account.',
            'اگر در یک ارزیابی معامله می‌کنید، حد ضرر تنها مرزِ شما نیست. طبق شرایط منتشرشده و مرجعِ اوپن‌فاند — که در این نسخه قابل خرید یا اجرا نیست — سقف ضرر روزانه با بزرگ‌ترِ موجودی یا ارزش خالصِ ابتدای روز سنجیده می‌شود، ساعت ۰۰:۰۰ (UTC+3) بازنشانی می‌شود و یک بار لمسِ آن نقض است. «استاندارد»: روزانه ۵٪ (با گزینهٔ ۳٪) و سقف کل ۱۰٪ ثابت. «تک‌مرحله‌ای»: روزانه ۳٪ (یا ۲٪) و سقف کل ۱۲٪ ثابت. «آنی»: دراودان کل ۵٪ شناور که وقتی حساب ۵٪ سود کرد در نقطهٔ سربه‌سر قفل می‌شود. حد ضرری که پوزیشن را نجات دهد اما شما را به سقف روزانه برساند، باز هم حساب را از شما گرفته است.'
          )
        },
        {
          type: 'p',
          text: text(
            'So work to the tighter of the two boundaries. If three ordinary stops can reach the daily limit, either each stop is too wide or each position is too large. The stop protects the trade and the risk budget protects the account.',
            'پس بر اساسِ تنگ‌ترِ این دو مرز عمل کنید. اگر سه حد ضررِ عادی می‌تواند سقف روزانه را لمس کند، یا حد ضررها بیش از حد عریض‌اند یا پوزیشن‌ها بیش از حد بزرگ. حد ضرر از معامله محافظت می‌کند و بودجهٔ ریسک از حساب.'
          )
        },
        {
          type: 'p',
          text: text(
            'A stop is only useful if it was placed while you were calm and left in place while you are not. Write down the level and the reason for it, then let the order do the job you have already decided on.',
            'حد ضرر فقط وقتی به درد می‌خورد که در آرامش گذاشته شده و در بی‌آرامی دست‌نخورده مانده باشد. سطح و دلیلش را بنویسید، سپس سفارش را بگذارید کاری را که از پیش تصمیم گرفته‌اید انجام دهد.'
          )
        },
      ]
    },
    {
      slug: 'drawdown-and-high-water-mark',
      path: 'leverage-and-risk',
      sort: 4,
      minutes: 8,
      status: 'published',
      title: text('Drawdown and high-water marks', 'دراودان و سطحِ بیشینهٔ سرمایه'),
      summary: text(
        'Profit tells you what you made; drawdown tells you what you had to survive to make it, and why digging out of a hole costs far more than falling in.',
        'سود می‌گوید چه به دست آوردید؛ دراودان می‌گوید برای به دست آوردنش چه چیزی را باید تحمل می‌کردید — و چرا بیرون آمدن از چاه بسیار گران‌تر از افتادن در آن است.'
      ),
      takeaways: [
        text('Drawdown is measured from the recorded peak, not from where you started', 'دراودان از سقفِ ثبت‌شده سنجیده می‌شود، نه از نقطهٔ آغاز'),
        text('Recovery is asymmetric: a 20% drawdown needs 25% profit to be even', 'بازگشت نامتقارن است: دراودان ۲۰٪ برای سربه‌سر شدن به سود ۲۵٪ نیاز دارد'),
        text('A high-water mark is the best recorded equity or balance level, and it never moves down', 'سطحِ بیشینهٔ سرمایه، بالاترین ارزش خالص یا موجودِ ثبت‌شده است و هرگز پایین نمی‌آید'),
        text('Static, daily and trailing limits behave very differently once equity starts climbing', 'سقف‌های ثابت، روزانه و شناور، وقتی ارزش خالص بالا می‌رود رفتاری کاملاً متفاوت پیدا می‌کنند'),
      ],
      glossary: ['max-drawdown', 'high-water-mark', 'daily-drawdown', 'trailing-drawdown'],
      tools: ['prop-drawdown', 'journal-analyzer'],
      blocks: [
        {
          type: 'p',
          text: text(
            'Profit tells you what you made. Drawdown tells you what you had to survive on the way, and it is the number that risk limits, evaluation rules and most blown accounts are built around. Two strategies with the same total return can carry very different drawdowns, and the deeper hole needs the bigger miracle.',
            'سود می‌گوید چه به دست آوردید. دراودان می‌گوید در این مسیر چه چیزی را باید تحمل می‌کردید، و همین عدد است که سقف‌های ریسک، قواعد ارزیابی و بیشترِ حساب‌هایِ از‌دست‌رفته حولِ آن ساخته شده‌اند. دو راهبرد می‌توانند سودِ کلِ یکسان و دراودان‌های بسیار متفاوتی داشته باشند، و چاهِ عمیق‌تر به معجزهٔ بزرگ‌تری برای بیرون آمدن نیاز دارد.'
          )
        },
        { type: 'h2', text: text('Measuring the hole', 'اندازه‌گیریِ چاه') },
        {
          type: 'formula',
          expr: 'drawdown % = (peak - trough) / peak * 100',
          text: text('Peak is the highest equity recorded up to that moment and trough the lowest point after it. Losses are measured from the top, never from the starting line.', 'پیک، بالاترین ارزش خالصِ ثبت‌شده تا آن لحظه و ترو، پایین‌ترین نقطه پس از آن است. ضرر از سقف سنجیده می‌شود، هرگز از خطِ شروع.')
        },
        {
          type: 'p',
          text: text(
            'That detail is where most self-assessment goes wrong. If your equity touched 12,000 and later fell to 10,200, your drawdown is not measured against the 10,000 you started with: it is 1,800 below a 12,000 peak, which is 15%. Accountants call that peak the high-water mark, and once a level is recorded it becomes history — the market does not agree to forget it because your mood or your thesis has changed.',
            'همین نکته جایی است که بیشترِ خودارزیابی‌ها خطا می‌روند. اگر ارزش خالص شما به ۱۲٬۰۰۰ رسیده و بعد به ۱۰٬۲۰۰ پایین آمده، دراودان‌تان نسبت به آن ۱۰٬۰۰۰ شروع سنجیده نمی‌شود: ۱٬۸۰۰ زیرِ سقفِ ۱۲٬۰۰۰ هستید، یعنی ۱۵٪. به آن سقف، سطحِ بیشینهٔ سرمایه می‌گویند و وقتی ثبت شد، تاریخ می‌شود — بازار قرار نیست چون حال‌وهوا یا استدلال شما عوض شده، آن را فراموش کند.'
          )
        },
        { type: 'h2', text: text('The asymmetry of recovery', 'نامتقارنِ بازگشت') },
        {
          type: 'formula',
          expr: 'recovery factor = 1 / (1 - drawdown) - 1',
          text: text('The gain needed to return to the previous peak, as a share of the reduced equity. A 20% drawdown needs 25% profit; the two numbers are not equal and never will be.', 'سودی که برای بازگشت به سقفِ پیشین لازم است، به سهمِ ارزش خالصِ کاهش‌یافته. دراودان ۲۰٪ به سود ۲۵٪ نیاز دارد؛ این دو عدد هیچ‌گاه با هم برابر نیستند.')
        },
        {
          type: 'p',
          text: text(
            'Run it once and it stays with you. Lose 20% of 10,000 and you are left with 8,000. Returning to 10,000 means earning 2,000 on 8,000, which is 25%. Lose half and the required gain is 100%. The relation is convex, so the first few percent of loss are cheap and the deep ones are almost unaffordable. That, not discipline for its own sake, is the real argument for cutting a loss early — while the arithmetic is still on your side.',
            'یک بار حسابش کنید و دیگر رهایتان نمی‌کند. اگر ۲۰٪ از ۱۰٬۰۰۰ را از دست بدهید، ۸٬۰۰۰ باقی می‌ماند. بازگشت به ۱۰٬۰۰۰ یعنی ساختن ۲٬۰۰۰ روی ۸٬۰۰۰، همان ۲۵٪. نصفِ سرمایه را از بدهید و سودِ لازم ۱۰۰٪ می‌شود. این رابطه محدب است، پس چند درصدِ اولِ ضرر ارزان تمام می‌شود و درصدهای عمیق تقریباً غیرقابل‌پرداخت‌اند. همین حساب است، نه نظم برای نظم، که استدلالِ واقعیِ کوچک بستنِ ضرر را می‌سازد — آن‌وقت که ریاضیات هنوز به نفعِ شماست.'
          )
        },
        {
          type: 'table',
          caption: text('Drawdown and the profit required to recover', 'دراودان و سودِ لازم برای بازگشت'),
          head: [text('Drawdown', 'دراودان'), text('Equity left from 10,000', 'ارزش خالصِ باقی‌مانده از ۱۰٬۰۰۰'), text('Gain needed to be even', 'سود لازم برای سربه‌سر شدن')],
          rows: [
            [text('5%', '۵٪'), text('9,500', '۹٬۵۰۰'), text('5.26%', '۵٫۲۶٪')],
            [text('10%', '۱۰٪'), text('9,000', '۹٬۰۰۰'), text('11.11%', '۱۱٫۱۱٪')],
            [text('20%', '۲۰٪'), text('8,000', '۸٬۰۰۰'), text('25.00%', '۲۵٫۰۰٪')],
            [text('30%', '۳۰٪'), text('7,000', '۷٬۰۰۰'), text('42.86%', '۴۲٫۸۶٪')],
            [text('50%', '۵۰٪'), text('5,000', '۵٬۰۰۰'), text('100.00%', '۱۰۰٫۰۰٪')],
          ]
        },
        { type: 'h2', text: text('Which peak you measure from', 'از کدام سقف اندازه می‌گیرید') },
        {
          type: 'formula',
          expr: 'high-water mark = max(previous high-water mark, current equity)',
          text: text('The best recorded equity or balance level. It only ever moves up, so any limit defined against it inherits that one-way behaviour.', 'بالاترین سطحِ ثبت‌شدهٔ ارزش خالص یا موجودی. این عدد فقط بالا می‌رود، پس هر سقفی که بر مبنای او تعریف شود همین رفتارِ یک‌طرفه را به ارث می‌برد.')
        },
        { type: 'h3', text: text('Static, daily and trailing limits', 'سقف‌های ثابت، روزانه و شناور') },
        {
          type: 'ul',
          items: [
            text('Static limit: a fixed floor set from the starting account size; it never moves, however well you trade.', 'سقف ثابت: کفِ مشخصی از اندازهٔ اولیهٔ حساب؛ هرگز جابه‌جا نمی‌شود، هرچقدر هم خوب معامله کنید.'),
            text('Daily limit: a one-day loss allowance, measured from the higher of that day’s opening balance or equity, then reset.', 'سقف روزانه: مجوزِ ضررِ یک روز، سنجیده‌شده از بزرگ‌ترِ موجودی یا ارزش خالصِ آغازِ همان روز، سپس بازنشانی می‌شود.'),
            text('Trailing limit: a boundary that follows the high-water mark upward and never back down, so fresh profit raises it.', 'سقف شناور: مرزی که سطحِ بیشینهٔ سرمایه را به بالا دنبال می‌کند و هرگز پایین نمی‌آید، پس سودِ تازه آن را بالا می‌برد.'),
            text('All three are reached by equity, so unrealised losses count before any position is closed.', 'هر سه با ارزش خالص سنجیده می‌شوند، پس زیانِ شناور پیش از بستنِ هر پوزیشن شمرده می‌شود.'),
          ]
        },
        {
          type: 'note',
          text: text(
            'These are the published Openfund challenge terms of record, none of which is purchasable or enforced in this release; the terminal currently runs the simulated demo. Standard: 5% daily loss (a 3% option) and a 10% static total. One-phase: 3% daily (a 2% option) and a 12% static total. Instant: a 5% trailing total drawdown that locks at breakeven once the account is 5% in profit. Free Trial: Standard rules, 14 days per phase. The daily limit is measured against the higher of day-start balance or day-start equity, resets at 00:00 UTC+3, and touching a limit is a breach. The demo itself allocates 100,000 virtual DAI once per user, with no deposits, withdrawals, refills or resets.',
            'این‌ها شرایط منتشرشده و مرجعِ چلنج‌های اوپن‌فاند است و هیچ‌یک در این نسخه قابل خرید یا اجرا نیست؛ ترمینال فعلاً همان دموی شبیه‌سازی‌شده را اجرا می‌کند. «استاندارد»: ضرر روزانه ۵٪ (با گزینهٔ ۳٪) و سقف کل ۱۰٪ ثابت. «تک‌مرحله‌ای»: روزانه ۳٪ (یا ۲٪) و سقف کل ۱۲٪ ثابت. «آنی»: دراودان کل ۵٪ شناور که وقتی حساب ۵٪ سود کرد در نقطهٔ سربه‌سر قفل می‌شود. «تست رایگان»: قواعد استاندارد، ۱۴ روز برای هر مرحله. سقف روزانه با بزرگ‌ترِ موجودی یا ارزش خالصِ ابتدای روز سنجیده و ساعت ۰۰:۰۰ (UTC+3) بازنشانی می‌شود و لمسِ سقف نقض است. خودِ دمو یک‌بار برای هر کاربر ۱۰۰٬۰۰۰ دای مجازی تخصیص می‌دهد، بدون واریز، برداشت، شارژ یا بازنشانی.'
          )
        },
        { type: 'h3', text: text('Keeping your own record', 'سابقهٔ شخصی‌تان را نگه دارید') },
        {
          type: 'ol',
          items: [
            text('Log equity, not balance, at a fixed time each day so the peak is reproducible.', 'هر روز در ساعتی مشخص ارزش خالص را ثبت کنید نه موجودی را، تا سقفِ ثبت‌شده قابل بازتولید باشد.'),
            text('Compute drawdown from the running peak and write the recovery factor beside it.', 'دراودان را از سقفِ جاری حساب کنید و عددِ بازگشت را کنارش بنویسید.'),
            text('Track your deepest historical drawdown and treat that as live risk, not the account size.', 'عمیق‌ترین دراودانِ تاریخی‌تان را پی بگیرید و همان را ریسکِ زنده بدانید، نه اندازهٔ حساب را.'),
            text('Flag the day a new peak prints: from then on, every trailing limit has moved with it.', 'روزِ ثبتِ سقفِ تازه را علامت بزنید: از آن پس هر سقفِ شناور هم با آن جابه‌جا شده است.'),
          ]
        },
        {
          type: 'p',
          text: text(
            'Read a high-water mark as a survival budget, not a scoreboard. Every unit of profit raises the floor you may fall to, and every unit of drawdown raises the gain you must find to be even. The last lesson in this path turns that into a number you fix before each trade.',
            'سطحِ بیشینهٔ سرمایه را بودجهٔ بقا بخوانید، نه تابلوی امتیازات. هر واحد سود، کفی را که اجازه دارید تا آن بیفتید بالا می‌برد و هر واحد دراودان، سودی را که باید برای سربه‌سر شدن پیدا کنید افزایش می‌دهد. درسِ پایانیِ این مسیر همهٔ این را به عددی تبدیل می‌کند که پیش از هر معامله ثابتش می‌کنید.'
          )
        },
      ]
    },
    {
      slug: 'sizing-for-survival',
      path: 'leverage-and-risk',
      sort: 5,
      minutes: 10,
      status: 'published',
      title: text('Position sizing for survival', 'حجم‌گذاری پوزیشن برای بقا'),
      summary: text(
        'Size is the one variable you control before the outcome exists, so choosing it from a fixed risk fraction is what turns a losing streak into an expense instead of an ending.',
        'حجم تنها متغیری است که پیش از معلوم شدن نتیجه در کنترل شماست؛ پس انتخابش از کسرِ ریسکِ ثابت است که یک رشته‌ضرر را به هزینه بدل می‌کند، نه به پایان.'
      ),
      takeaways: [
        text('Size comes from the loss you are allowed to take, not from the capital you hold', 'حجم از ضررِ مجاز شما می‌آید، نه از سرمایه‌ای که در دست دارید'),
        text('units = risk amount / per-unit distance to stop; the stop sets the size', 'تعداد واحد = مبلغ ریسک ÷ فاصلهٔ هر واحد تا حد ضرر؛ همان حد ضرر است که حجم را می‌سازد'),
        text('Expectancy and profit factor say whether an edge can pay for its own costs', 'امید ریاضی و فاکتور سود می‌گویند یک برتری از پسِ هزینه‌های خودش برمی‌آید یا نه'),
        text('Risk of ruin and Kelly rest on assumptions: treat them as ceilings, not targets', 'ریسک ورشکستگی و معیار کِلِی بر فرض استوارند؛ سقفشان بدانید، نه هدف'),
      ],
      glossary: ['position-size', 'expectancy', 'risk-of-ruin', 'kelly-criterion'],
      tools: ['position-size', 'risk-of-ruin'],
      blocks: [
        {
          type: 'p',
          text: text(
            'Position size is the only variable in a leveraged trade that you control before the outcome is known. Entry and exit belong to the market; the amount you lose at your stop belongs to you. Sizing for survival means choosing that number so a normal run of losses is an inconvenience, not the end of the account.',
            'حجم پوزیشن تنها متغیری است که در یک معاملهٔ اهرم‌دار، پیش از روشن شدن نتیجه، در کنترل شماست. ورود و خروج به بازار تعلق دارد و مبلغی که در حد ضرر از دست می‌دهید به خودتان. حجم‌گذاری برای بقا یعنی همان عدد را طوری انتخاب کنید که یک رشته‌ضررِ عادی مزاحمت باشد، نه پایانِ حساب.'
          )
        },
        { type: 'h2', text: text('Fixed-fraction risk', 'ریسکِ با کسرِ ثابت') },
        {
          type: 'formula',
          expr: 'units = risk amount / (per-unit distance to stop)',
          text: text('Start from a permitted loss: equity times your risk fraction. Divide it by the loss each unit takes at the stop.', 'از ضرر مجاز شروع کنید: ارزش خالص ضرب‌در کسرِ ریسک شما. آن را بر ضررِ هر واحد در حد ضرر تقسیم کنید.')
        },
        {
          type: 'p',
          text: text(
            'Work it through. Equity 10,000 and a risk fraction of 1%, so the budget is 100. Entry at 50 with a stop at 49 means each unit loses 1, so the size is 100 units — a 5,000 notional. If the allowed margin or leverage cannot carry that notional, cut the budget rather than quietly widen the stop. Notice what is absent: a forecast. It sizes the position for the case where you are wrong.',
            'پیش بروید و حساب کنید. ارزش خالص ۱۰٬۰۰۰ و کسر ریسک ۱٪، پس بودجه ۱۰۰ است. ورود روی ۵۰ با حد ضرر ۴۹ یعنی هر واحد ۱ واحد ضرر می‌کند، پس حجم ۱۰۰ واحد است — ارزش اسمی ۵٬۰۰۰. اگر وجه تضمین یا اهرمِ مجاز توانِ حملِ این ارزش اسمی را ندارد، بودجه را کم کنید و بی‌صدا حد ضرر را عریض‌تر نگیرید. ببینید چه چیزی در این محاسبه نیست: پیش‌بینی. فرمول پوزیشن را برای حالتی حجم می‌زند که اشتباه کرده‌اید.'
          )
        },
        { type: 'h2', text: text('Losing streaks are not exceptions', 'رشته‌ضررها استثنا نیستند') },
        {
          type: 'p',
          text: text(
            'A win rate below 100% guarantees streaks. If a method wins 60% of the time and trades are roughly independent, any block of five consecutive losses carries a probability of 0.4 to the fifth power, about 1% — rare enough to feel impossible, common enough across a few hundred trades to arrive. The risk fraction describes your tail, not your average.',
            'نرخِ بردِ زیر ۱۰۰٪، رشته‌ضرر را تضمین می‌کند. اگر روشی ۶۰٪ مواقع برنده باشد و معامله‌ها تا حدی مستقل باشند، هر بلوکِ پنج ضررِ پیاپی احتمال ۰٫۴ به توان ۵، یعنی حدود ۱٪ دارد؛ آن‌قدر کم که غیرممکن به نظر می‌رسد و آن‌قدر زیاد که در چند صد معامله می‌رسد. کسرِ ریسک دنبالهٔ توزیع را توصیف می‌کند، نه میانگین را.'
          )
        },
        {
          type: 'table',
          caption: text('Ten consecutive losses, four risk fractions', 'ده ضررِ پیاپی، چهار کسرِ ریسک'),
          head: [text('Risk per trade', 'ریسک هر معامله'), text('Equity after 10 losses', 'ارزش خالص پس از ۱۰ ضرر'), text('Gain needed to recover', 'سود لازم برای بازگشت')],
          rows: [
            [text('0.5%', '۰٫۵٪'), text('9,511', '۹٬۵۱۱'), text('5.1%', '۵٫۱٪')],
            [text('1%', '۱٪'), text('9,044', '۹٬۰۴۴'), text('10.6%', '۱۰٫۶٪')],
            [text('2%', '۲٪'), text('8,171', '۸٬۱۷۱'), text('22.4%', '۲۲٫۴٪')],
            [text('5%', '۵٪'), text('5,987', '۵٬۹۸۷'), text('67.0%', '۶۷٫۰٪')],
            [text('10%', '۱۰٪'), text('3,487', '۳٬۴۸۷'), text('186.8%', '۱۸۶٫۸٪')],
          ]
        },
        { type: 'h2', text: text('Expectancy and profit factor', 'امید ریاضی و فاکتور سود') },
        {
          type: 'formula',
          expr: 'expected value per trade = p * avgWin - (1 - p) * avgLoss',
          text: text('p is the win rate; avgWin and avgLoss are measured per trade. The result is the average outcome of one trade over a long run.', 'p نرخ برد است و avgWin و avgLoss هر معامله را می‌سنجند؛ حاصل، نتیجهٔ میانگینِ یک معامله در بلندمدت است.')
        },
        {
          type: 'formula',
          expr: 'profit factor = gross profit / gross loss',
          text: text('The same story from the totals: below 1.0 the sample has lost money.', 'همان داستان از مجموعهٔ کل‌ها: زیر ۱٫۰ یعنی نمونه در مجموع ضرر کرده است.')
        },
        {
          type: 'p',
          text: text(
            'Take a 45% win rate, an average win of 300 and an average loss of 150: 0.45 times 300 minus 0.55 times 150 is 135 less 82.5, or 52.5 of expected value per trade. Then ask whether that edge survives its own cost — fees, spread and slippage per round trip, times how often you trade. Expectancy belongs to the strategy plus its friction.',
            'نرخ برد ۴۵٪، میانگین سود ۳۰۰ و میانگین ضرر ۱۵۰ را بگیرید: ۰٫۴۵ × ۳۰۰ منهای ۰٫۵۵ × ۱۵۰ می‌شود ۱۳۵ منهای ۸۲٫۵، یعنی امید ریاضیِ ۵۲٫۵ در هر معامله. سپس بپرسید آیا این برتری از پسِ هزینهٔ خودش برمی‌آید — کارمزد، اسپرد و اسلیپیجِ هر رفت‌وبرگشت، ضرب‌در تعدادِ ورودها. امید ریاضی متعلق به راهبرد به‌همراه اصطکاکش است.'
          )
        },
        { type: 'h2', text: text('Risk of ruin and Kelly: both are estimates', 'ریسک ورشکستگی و کِلِی: هر دو تخمین‌اند') },
        {
          type: 'p',
          text: text(
            'Risk of ruin is the probability that losses take you to a point where you can no longer trade. It is built from win rate, average win and loss, risk per trade and a chosen ruin threshold, and it rests on assumptions markets routinely break: independent trades, a constant edge, an unchanging risk fraction, no effect from gaps or funding. Read it as a conditional estimate, never a guarantee.',
            'ریسک ورشکستگی احتمالِ آن است که ضررها شما را به نقطه‌ای برسانند که دیگر نمی‌توانید معامله کنید. این عدد از نرخ برد، میانگین سود و ضرر، ریسکِ هر معامله و آستانهٔ ورشکستگیِ انتخابی ساخته می‌شود — و بر فرض‌هایی استوار است که بازار معمولاً می‌شکندشان: استقلالِ معاملات، ثابت‌ماندنِ برتری، عوض‌نشدنِ کسرِ ریسک و بی‌اثر بودنِ گپ و فاندینگ. آن را تخمینی مشروط بخوانید، هرگز تضمین.'
          )
        },
        {
          type: 'p',
          text: text(
            'The Kelly criterion gives the fraction of equity that maximises long-run growth when your probability and payoff estimates are correct. Treat it as a ceiling rather than a target. Its inputs come from a finite sample, the true edge is usually flatter than the measured one, and full Kelly on an overestimated edge is the standard route to the ruin above. Fractional Kelly exists to price that error.',
            'معیار کِلِی کسری از سرمایه را می‌دهد که در صورت درست بودنِ برآوردِ احتمال و برد-باخت، رشدِ بلندمدت را بیشینه می‌کند. آن را سقف بدانید نه هدف. ورودی‌هایش از نمونه‌ای محدود می‌آید، برتریِ واقعی معمولاً کم‌شیب‌تر از برتریِ اندازه‌گیری‌شده است و کِلِیِ کامل با برآوردی خوش‌بینانه همان مسیرِ رسیدن به همان ورشکستگیِ بالاست. کِلِیِ کسری هم برای قیمت‌گذاری همین خطا ساخته شده است.'
          )
        },
        {
          type: 'note',
          text: text(
            'Openfund context: the demo is a server-side simulated account — 100,000 virtual DAI once per user, no deposits, withdrawals, refills or resets, priced from live Gains Network mark prices. Demo profit is not money owed, and demo trading does not establish eligibility for a funded account. The loss limits quoted here are published terms of record, not enforced in this release.',
            'بافتِ اوپن‌فاند: دمو یک حسابِ شبیه‌سازی‌شدهٔ سمت سرور است — ۱۰۰٬۰۰۰ دای مجازی یک‌بار برای هر کاربر، بدون واریز، برداشت، شارژ یا بازنشانی، با قیمت‌گذاری از مارک پرایس زندهٔ Gains Network. سودِ دمو طلبِ مالی نیست و معاملهٔ دمو واجدِ شرایط شدن برای حساب فاندشده را اثبات نمی‌کند. سقف‌های ضرری که اینجا آمده، شرایط منتشرشده و مرجع است و در این نسخه اجرا نمی‌شود.'
          )
        },
        {
          type: 'ol',
          items: [
            text('Fix the risk fraction before opening a chart.', 'کسرِ ریسک را پیش از گشودن نمودار ثابت کنید.'),
            text('Write the stop, then size from units = risk amount / distance.', 'حد ضرر را بنویسید و حجم را از «تعداد واحد = مبلغ ریسک ÷ فاصله» بگیرید.'),
            text('Check that margin and the market leverage carry that notional.', 'بررسی کنید وجه تضمین و اهرمِ بازار آن ارزش اسمی را تحمل می‌کند.'),
            text('Rebuild the streak table monthly from realised results.', 'جدولِ رشته‌ضرر را هر ماه از نتایجِ محقق‌شده بازبسازید.'),
          ]
        },
      ]
    },
  ]
}
