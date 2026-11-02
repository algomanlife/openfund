import { text } from '../../../features/information/content'
import type { LearningPathContent } from '../../contentTypes'

/** Learning Center - Path C: How prop trading works.
 *  Repo authoring source for the practitioner path. Educational content only:
 *  it explains how prop evaluation models and funded-account terms are written
 *  and never recommends a strategy or promises profit. Openfund-specific claims
 *  stay inside the verified set - Prop Trading today runs one server-side
 *  simulated free_demo account per user, funded once with 100,000 virtual DAI and
 *  priced from live Gains Network mark prices, with no deposits, withdrawals,
 *  refills or resets; purchase activation, funded accounts and payouts are not
 *  enabled in this release, so every figure quoted below is a published term of
 *  record rather than something purchasable or enforced. NOT imported by the app
 *  at runtime. */
export const pathC: LearningPathContent = {
  key: 'prop',
  slug: 'prop-trading-explained',
  sort: 3,
  level: 'practitioner',
  eyebrow: text('Path C · Prop', 'مسیر C · معامله‌گری پراپ'),
  title: text('How prop trading works', 'معاملهٔ پراپ چگونه کار می‌کند'),
  summary: text(
    'A funded account is a set of written terms, not a pile of money. This path reads those terms the way a practitioner must: what is measured, what is bounded, what must be satisfied before payment - and what the document leaves unsaid.',
    'حساب فاندشده دسته‌ای شرطِ مکتوب است، نه کوهی از پول. این مسیر همان شرایط را آن‌طور که یک معامله‌گرِ جدی باید بخواند می‌خواند: چه چیزی سنجیده می‌شود، چه چیزی محدود شده، پیش از پرداخت چه باید رعایت شود — و چه چیزی در متن نیامده.'
  ),
  outcomes: [
    text('you can say what a funded account is and is not: supplied terms, a share of eligible profit, bounded loss', 'می‌توانی بگویی حساب فاندشده چیست و چیست نیست: شرایطِ تأمین‌شده، سهمی از سودِ واجدِ شرایط، ضررِ محدودشده'),
    text('you can explain what an evaluation screens for and how the three published models differ', 'می‌توانی توضیح دهی ارزیابی دنبال چه چیزی است و سه مدلِ منتشرشده چگونه فرق می‌کنند'),
    text('you can read a full rulebook in five passes and separate trading restrictions from payout conditions', 'می‌توانی رول‌بوک را در پنج عبور بخوانی و محدودیت‌های معاملاتی را از شرایطِ برداشت جدا کنی'),
    text('you can size risk on a funded account against the tightest of the daily, total and trailing boundaries', 'می‌توانی ریسک را در حساب فاندشده بر اساسِ تنگ‌ترینِ مرزهای روزانه، کل و شناور تنظیم کنی'),
  ],
  lessons: [
    {
      slug: 'funded-accounts-how-they-work',
      path: 'prop-trading-explained',
      sort: 1,
      minutes: 10,
      status: 'published',
      title: text('How funded accounts actually work', 'حساب فاندشده واقعاً چگونه کار می‌کند'),
      summary: text(
        'The funded stage is a set of conditions applied to an account size you do not own: this lesson separates the terms from the money.',
        'مرحلهٔ فاندشده مجموعه‌ای شرط است که روی اندازهٔ حسابی اعمال می‌شود که مالکش نیستی: این درس شرط را از پول جدا می‌کند.'
      ),
      takeaways: [
        text('A funded account is a trading stage under an agreement, not a deposit account in your name', 'حساب فاندشده مرحله‌ای معاملاتی زیرِ یک قرارداد است، نه حسابِ سپردهٔ به‌نامِ تو'),
        text('The evaluation fee is not capital: the account size is a boundary, not a balance you funded', 'هزینهٔ ارزیابی سرمایه نیست؛ اندازهٔ حساب مرز است، نه موجودی‌ای که تو تأمین کرده باشی'),
        text('Once funded there is no profit target: a daily limit and a total limit carry the whole stage', 'در مرحلهٔ فاندشده هیچ هدفِ سودی وجود ندارد؛ سقفِ روزانه و سقفِ ضررِ کل، تمامِ این مرحله را اداره می‌کنند'),
        text('The reward share applies to eligible profit, and eligibility is written elsewhere in the document', 'سهم پاداش به سودِ واجدِ شرایط تعلق می‌گیرد و واجدِ شرایط بودن جای دیگری از متن تعریف شده'),
      ],
      glossary: [],
      tools: ['prop-drawdown', 'journal-analyzer'],
      blocks: [
        {
          type: 'p',
          text: text(
            'A funded account is the stage a prop programme places you on after an evaluation - or, in some models, without one. It is a trading account whose terms are written so that the account size is provided under the agreement while you trade it, and the profit you produce is shared rather than kept whole. None of that makes it a deposit account in your own name: what you receive is a set of conditions, and the conditions are the product.',
            'حساب فاندشده مرحله‌ای است که یک برنامهٔ پراپ پس از ارزیابی به تو می‌دهد — یا در بعضی مدل‌ها، بی‌آنکه ارزیابی‌ای در کار باشد. حساب معاملاتی‌ست با شرایطی که اندازه‌اش طبق قرارداد تأمین می‌شود و تو رویش معامله می‌کنی، و سودی که می‌سازی تقسیم می‌شود، نه اینکه تمامش از آنِ تو باشد. هیچ‌یک از این‌ها آن را به حسابِ سپردهٔ به‌نامِ خودت تبدیل نمی‌کند: چیزی که می‌گیری دسته‌ای شرط است و خودِ شرط، محصول.'
          )
        },
        { type: 'h2', text: text('What the funded stage replaces', 'مرحلهٔ فاندشده چه چیزی را جانشین می‌کند') },
        {
          type: 'ul',
          items: [
            text('Your own trading capital, with an account size you may not breach.', 'سرمایهٔ معاملاتی خودت، با اندازهٔ حسابی که عبور از آن را حق نداری.'),
            text('Full ownership of profit, with a published share of eligible profit.', 'مالکیتِ کاملِ سود، با سهمی منتشرشده از سودِ واجدِ شرایط.'),
            text('An open-ended loss, with a daily limit and a maximum total limit.', 'ضررِ بی‌پایان، با یک سقفِ روزانه و یک سقفِ ضررِ کل.'),
            text('Your own appetite for risk, with boundaries the agreement sets.', 'ریسک‌پذیریِ خودت، با مرزهایی که قرارداد مشخص می‌کند.'),
          ]
        },
        { type: 'h2', text: text('The fee is not a deposit', 'هزینه، سپرده نیست') },
        {
          type: 'p',
          text: text(
            'In the published structure the money you hand over is a one-time evaluation fee, quoted per account size; it is not capital that becomes the account. That matters twice. It explains why the loss limits are the real contract - they decide how much of the supplied size you may lose before the agreement ends - and it explains why the fee can be refundable at all: on the Openfund Standard terms of record the fee comes back with the fourth reward, while One-phase and Instant do not refund it.',
            'در ساختارِ منتشرشده، پولی که می‌دهی هزینهٔ ارزیابیِ یک‌باره است که به تفکیکِ اندازهٔ حساب قیمت‌گذاری شده؛ سرمایه‌ای نیست که به حساب تبدیل شود. این نکته دو بار مهم است. یک‌بار توضیح می‌دهد چرا سقف‌های ضرر، قراردادِ واقعی‌اند: مشخص می‌کنند چقدر از اندازهٔ تأمین‌شده را اجازه داری پیش از پایانِ قرارداد از دست بدهی. بار دوم توضیح می‌دهد چرا اصلاً امکان بازپرداخت هزینه وجود دارد: در شرایطِ مرجعِ «استانداردِ» اوپن‌فاند، هزینه با چهارمین پاداش بازمی‌گردد و در «تک‌مرحله‌ای» و «آنی» بازنمی‌گردد.'
          )
        },
        {
          type: 'terms',
          items: [
            { term: text('Funded account', 'حساب فاندشده'), text: text('The payout stage of a passed challenge, under the reward agreement, with no profit target.', 'مرحلهٔ برداشتِ چلنجِ قبول‌شده، زیرِ قراردادِ پاداش، بدون هدف سود.') },
            { term: text('Evaluation account', 'حساب ارزیابی'), text: text('The stage where a profit target and minimum activity apply.', 'مرحله‌ای که هدفِ سود و حداقلِ فعالیت در آن حکم می‌کند.') },
            { term: text('Reward split', 'سهم پاداش'), text: text('The trader’s share of eligible profit, not of gross profit.', 'سهمِ معامله‌گر از سودِ واجدِ شرایط، نه از سودِ ناخالص.') },
            { term: text('Account size', 'اندازهٔ حساب'), text: text('The level the account starts at; a boundary for loss rules, not money owned.', 'سطحی که حساب از آن شروع می‌شود؛ مرزی برای قواعدِ ضرر، نه پولِ تو.') },
          ]
        },
        { type: 'h2', text: text('Two numbers that define the stage', 'دو عددی که این مرحله را تعریف می‌کنند') },
        {
          type: 'p',
          text: text(
            'Once you are funded, the objectives that dominated the evaluation disappear: there is no profit target on a funded account. What remains are two boundaries - a daily loss limit and a maximum total loss limit - plus, on the Instant model, a trailing form of the total limit that follows the best recorded equity upward. Everything afterwards is measured against those lines, which is why this path spends two full lessons on how they are calculated.',
            'وقتی فاندشده می‌شوی، هدف‌هایی که مرحلهٔ ارزیابی را اداره می‌کردند حذف می‌شوند: در حساب فاندشده هیچ هدف سودی نیست. دو مرز باقی می‌ماند — سقفِ ضررِ روزانه و سقفِ ضررِ کل — و در مدل «آنی» نسخهٔ شناورِ سقفِ کل که بالاترین ارزشِ خالصِ ثبت‌شده را به بالا دنبال می‌کند. هر کاری پس از آن با همین خط‌ها سنجیده می‌شود؛ به همین دلیل این مسیر دو درسِ کامل به شیوهٔ محاسبهٔ آن‌ها اختصاص می‌دهد.'
          )
        },
        { type: 'formula', expr: 'loss floor = starting account size x (1 - maximum total loss)', text: text('Static limits hold this floor at a fixed level from the starting size; a trailing limit raises it as equity climbs.', 'سقف‌های ثابت این کف را از اندازهٔ شروع ثابت نگه می‌دارند؛ سقفِ شناور با بالا رفتنِ ارزش خالص آن را بالا می‌برد.') },
        { type: 'h2', text: text('One wallet, one identity', 'یک کیف پول، یک هویت') },
        {
          type: 'p',
          text: text(
            'Access starts with a wallet connection and an EIP-4361 signature that creates a first-party session. One wallet maps to one identity, while a single wallet can hold more than one challenge record. Signing a login message is not a transfer and never requires a token approval; it is also not identity-document verification. KYC, minimum age and geographic eligibility are not finalized in this release, so nothing about access should be read as a statement that you qualify for a funded stage.',
            'دسترسی با اتصالِ کیف پول و امضای EIP-4361 شروع می‌شود که یک نشستِ first-party می‌سازد. هر کیف پول به یک هویت نگارش می‌شود، ولی یک کیف پول می‌تواند بیش از یک سابقهٔ چلنج داشته باشد. امضای پیامِ ورود انتقالِ دارایی نیست و هرگز به اجازهٔ برداشتِ توکن نیاز ندارد؛ احرازِ هویت با مدرکِ شناسایی هم نیست. الزامات KYC، حداقلِ سن و شرایط جغرافیایی در این نسخه نهایی نشده‌اند، پس نباید هیچ بخشی از دسترسی را به معنایِ واجدِ شرایط بودن برای مرحلهٔ فاندشده خواند.'
          )
        },
        {
          type: 'note',
          text: text(
            'Openfund status: purchase activation, funded accounts and payouts are not enabled in this release, and a final versioned agreement will be published before launch. What runs today is a single server-side simulated free_demo account per user, funded once with 100,000 virtual DAI and priced from live Gains Network mark prices, with no deposits, withdrawals, refills or resets. Demo profit is not money owed to the trader, and trading the demo does not establish eligibility for a funded account. Every figure in this path is a published term of record.',
            'وضعیت اوپن‌فاند: فعال‌سازیِ خرید، حساب فاندشده و برداشت در این نسخه فعال نیست و پیش از عرضه، قراردادِ نهاییِ نسخه‌دار منتشر خواهد شد. آنچه امروز کار می‌کند یک حسابِ شبیه‌سازی‌شدهٔ free_demo در سمت سرور است، به ازای هر کاربر یکی، یک‌بار با ۱۰۰٬۰۰۰ دای مجازی تأمین شده و از مارک پرایسِ زندهٔ Gains Network قیمت‌گذاری می‌شود؛ بدون واریز، برداشت، شارژِ مجدد یا بازنشانی. سودِ دمو پولی نیست که به معامله‌گر بدهکار باشند، و معاملهٔ دمو واجدِ شرایط شدن برای حساب فاندشده را اثبات نمی‌کند. هر عددی در این مسیر، شرطِ منتشرشده و مرجع است.'
          )
        },
        { type: 'h2', text: text('Read the stage as a list of conditions', 'مرحله را فهرستی از شرایط بخوان') },
        {
          type: 'p',
          text: text(
            'A useful habit is to rewrite any funded-account page as four lists: what is measured, what is bounded, what is required before payment, and what the document does not say. The last list is where most disappointment lives - a rule that is silent is not a rule that favours you. The next three lessons take those lists in order.',
            'عادتِ مفید این است که هر صفحه‌ای دربارهٔ حساب فاندشده را به چهار فهرست بازنویسی کنی: چه چیزی سنجیده می‌شود، چه چیزی محدود شده، پیش از پرداخت چه لازم است و چه چیزی در متن نیامده. فهرستِ آخر خانهٔ بیشترِ سرخوردگی‌هاست؛ قاعده‌ای که درباره‌اش سکوت شده، قاعده‌ای به سودِ تو نیست. سه درسِ بعدی همین فهرست‌ها را به همان ترتیب باز می‌کنند.'
          )
        },
        {
          type: 'table',
          caption: text('Four stages, and what each one is', 'چهار مرحله و تعریفِ هرکدام'),
          head: [text('Stage', 'مرحله'), text('What exists', 'چه چیزی وجود دارد'), text('What it does not mean', 'چه معنایی ندارد')],
          rows: [
            [text('Simulated demo', 'دموی شبیه‌سازی‌شده'), text('One free_demo account per user, 100,000 virtual DAI.', 'یک حساب free_demo برای هر کاربر، ۱۰۰٬۰۰۰ دای مجازی.'), text('No deposits, no withdrawals, no payout right.', 'بدون واریز، بدون برداشت، بدون حقِ برداشت.')],
            [text('Free Trial', 'تست رایگان'), text('Standard rules, 14 days per phase, no fee.', 'قواعدِ «استاندارد»، ۱۴ روز در هر مرحله، بدون هزینه.'), text('No reward, no conversion into a funded account.', 'بدون پاداش، بدون تبدیل به حساب فاندشده.')],
            [text('Evaluation phase', 'مرحلهٔ ارزیابی'), text('Target, loss limits, minimum activity: 8% then 5%.', 'هدف، سقف‌های ضرر، حداقلِ فعالیت: ۸٪ سپس ۵٪.'), text('A pass is a condition, not a claim on capital.', 'قبولی شرط است، نه ادعا بر سرمایه.')],
            [text('Funded account', 'حساب فاندشده'), text('Payout stage: loss limits, no target, published share.', 'مرحلهٔ برداشت: سقف‌های ضرر، بدون هدف، سهمِ منتشرشده.'), text('Not a deposit account; not enabled in this release.', 'حسابِ سپرده نیست؛ در این نسخه فعال نیست.')],
          ]
        },
      ]
    },
    {
      slug: 'why-evaluation-challenges-exist',
      path: 'prop-trading-explained',
      sort: 2,
      minutes: 8,
      status: 'published',
      title: text('Why evaluation challenges exist', 'چرا چلنج ارزیابی وجود دارد'),
      summary: text(
        'A challenge is not a profit contest but a screening device for loss behaviour, and each published model screens with a different combination of target, limit and activity requirement.',
        'چلنج مسابقهٔ سود نیست، دستگاهِ غربالِ رفتارِ ضرر است و هر مدلِ منتشرشده با ترکیبی متفاوت از هدف، سقف و الزامِ فعالیت غربال می‌کند.'
      ),
      takeaways: [
        text('The screening question is the shape of your losses, not the size of one good week', 'سؤالِ غربال شکلِ ضررهای توست، نه اندازهٔ یک هفتهٔ خوب'),
        text('Target relative to total loss sets how much room the test leaves you', 'نسبتِ هدف به سقفِ ضررِ کل مشخص می‌کند آزمون چقدر جای تنفس می‌گذارد'),
        text('Minimum trading days and profitable-day counts test participation over time', 'حداقلِ روزِ معاملاتی و شمارشِ روزهای سودده، حضورِ در طولِ زمان را می‌سنجند'),
        text('A pass is evidence about behaviour; it is not a guarantee of anything, and not eligibility at Openfund', 'قبولی نشانه‌ای دربارهٔ رفتار است؛ تضمینِ هیچ چیزی نیست و در اوپن‌فاند به معنایِ واجدِ شرایط شدن هم نیست'),
      ],
      glossary: ['max-drawdown'],
      tools: ['prop-drawdown', 'position-size'],
      blocks: [
        {
          type: 'p',
          text: text(
            'An evaluation challenge is easy to mistake for a profit contest. It is closer to a risk interview. Nobody is asking whether you can produce 8% once; the question is whether the way you produce profit ever puts a daily or total loss boundary at risk, because that is the behaviour someone else would have to live with on a funded account.',
            'چلنجِ ارزیابی را آسان است مسابقهٔ سود پنداشت، در حالی که بیشتر شبیه مصاحبهٔ ریسک است. کسی نمی‌پرسد آیا یک بار می‌توانی ۸٪ بسازی؛ سؤال این است که آیا شیوه‌ای که با آن سود می‌سازی هرگز مرزی از ضررِ روزانه یا ضررِ کل را در خطر می‌گذارد، چون همان رفتاری است که طرفِ دیگر باید در حساب فاندشده با آن زندگی کند.'
          )
        },
        { type: 'h2', text: text('The ratio that matters', 'نسبتی که مهم است') },
        { type: 'formula', expr: 'target-to-loss ratio = profit target / maximum total loss', text: text('Standard asks 8% against a 10% static total; One-phase asks 12% against a 12% total. Two very different amounts of room.', '«استاندارد» ۸٪ را در برابرِ سقفِ کلِ ۱۰٪ ثابت می‌خواهد و «تک‌مرحله‌ای» ۱۲٪ را در برابرِ سقفِ ۱۲٪؛ دو اندازهٔ آزادیِ بسیار متفاوت.') },
        {
          type: 'p',
          text: text(
            'Read that ratio before anything else. Where the target is small relative to the total limit, ordinary losing weeks are survivable and the test is mostly about steadiness. Where the two are equal, one bad stretch consumes the entire allowance and the evaluation becomes a test of drawdown control first, profit second. Neither design is better; they screen for different behaviour, which is why both can honestly carry the same reward split.',
            'پیش از هر چیزی همین نسبت را بخوان. هر جا هدف نسبت به سقفِ کل کوچک باشد، هفته‌های ضرردهٔ عادی قابلِ تحمل‌اند و سنجش بیشتر دربارهٔ ثبات است. هر جا این دو برابرِ هم باشند، یک بازهٔ بد کلِ بودجه را می‌بلعد و ارزیابی نخست آزمونِ کنترلِ دراودان می‌شود و بعد آزمونِ سود. هیچ‌کدام بهتر نیست؛ این دو رفتارِ متفاوتی را غربال می‌کنند — و به همان دلیل هر دو می‌توانند صادقانه یک سهمِ پاداش داشته باشند.'
          )
        },
        { type: 'h2', text: text('Minimum activity is a second screen', 'حداقلِ فعالیت، غربالِ دومی است') },
        {
          type: 'p',
          text: text(
            'Standard requires three trading days per phase and sets no time limit at all; One-phase carries no minimum days. That combination says what the design cares about: evidence spread across days rather than one concentrated outcome. The Instant model, which has no evaluation phase, replaces it with seven profitable days inside each rolling thirty - the same property, screened differently: participation over time, not a single strong session.',
            '«استاندارد» سه روز معاملاتی در هر مرحله می‌خواهد و هیچ محدودیتِ زمانی ندارد؛ «تک‌مرحله‌ای» حداقلِ روزی ندارد. همین ترکیب می‌گوید طراحی برایش چه مهم بوده: شواهدِ پخش‌شده در چند روز، نه یک نتیجهٔ فشرده. مدلِ «آنی» که اصلاً مرحلهٔ ارزیابی ندارد، آن را با هفت روزِ سودده در هر بازهٔ ۳۰روزهٔ جاری جایگزین می‌کند؛ همان ویژگی، با غربالِ متفاوت: حضور در طولِ زمان، نه یک جلسهٔ درخشان.'
          )
        },
        {
          type: 'ul',
          items: [
            text('Target level: how much profit the stage demands before it is satisfied.', 'سطحِ هدف: مرحله پیش از راضی شدن چقدر سود می‌خواهد.'),
            text('Loss limits: how much damage is allowed while you get there, and from which reference point.', 'سقف‌های ضرر: در این مسیر چقدر خسارت مجاز است و با چه مبنایی سنجیده می‌شود.'),
            text('Activity minimum: how many days must show participation.', 'حداقلِ فعالیت: چند روز باید حضورِ تو ثبت شود.'),
            text('Payout conditions: what must be true before profit becomes payable.', 'شرایطِ برداشت: پیش از قابل‌پرداخت شدنِ سود چه باید درست باشد.'),
          ]
        },
        { type: 'h2', text: text('Three structures, three questions', 'سه ساختار، سه سؤال') },
        {
          type: 'ol',
          items: [
            text('Standard, two phases: 8% then 5%, a 5% daily limit (a 3% option), a 10% static total. Does discipline survive a restart?', '«استاندارد»، دومرحله‌ای: ۸٪ سپس ۵٪، روزانه ۵٪ (با گزینهٔ ۳٪)، کل ۱۰٪ ثابت. آیا نظم پس از شروعِ دوباره هم می‌ماند؟'),
            text('One-phase: a single 12% target, 3% daily (a 2% option), a 12% static total, no minimum days. Can a larger number be reached in tighter room?', '«تک‌مرحله‌ای»: یک هدفِ ۱۲٪، روزانه ۳٪ (یا ۲٪)، کل ۱۲٪ ثابت، بدونِ حداقلِ روز. می‌توان عددی بزرگ‌تر را در فضای تنگ‌تری ساخت؟'),
            text('Instant: no evaluation phase, a 5% trailing total drawdown that locks at breakeven once the account is 5% in profit. Can you work while protection rises?', '«آنی»: بدونِ مرحلهٔ ارزیابی، دراودانِ کلِ ۵٪ شناور که وقتی حساب ۵٪ سود کرد در سربه‌سر قفل می‌شود. آیا وقتی محافظت بالا می‌رود به کار ادامه می‌دهی؟'),
          ]
        },
        { type: 'h2', text: text('What the fee buys', 'هزینه چه می‌خرد') },
        {
          type: 'p',
          text: text(
            'The published structure charges a one-time evaluation fee per account size: $44 to $652 across Standard sizes of $5K to $100K, $74 to $666 on One-phase and $60 to $888 on Instant, which reaches $200K. Those are nominal prices in a catalog, not charges you can pay today. What the fee is written to buy is an evaluation record - and on Standard, the refund of the fee itself with the fourth reward.',
            'در ساختارِ منتشرشده هزینهٔ ارزیابی یک‌باره و به تفکیکِ اندازهٔ حساب است: از ۴۴ تا ۶۵۲ دلار برای اندازه‌های ۵ تا ۱۰۰ هزار دلاریِ «استاندارد»، ۷۴ تا ۶۶۶ دلار در «تک‌مرحله‌ای» و ۶۰ تا ۸۸۸ دلار در «آنی» که تا ۲۰۰ هزار دلار می‌رود. این‌ها قیمت‌های اسمیِ یک فهرست‌اند، نه هزینه‌هایی که امروز بتوانی بپردازی. آنچه هزینه قرار است بخرد یک سابقهٔ ارزیابی است — و در «استاندارد»، بازپرداختِ خودِ هزینه با چهارمین پاداش.'
          )
        },
        {
          type: 'p',
          text: text(
            'The Free Trial sits outside that arithmetic. It applies the Standard rules - 8% then 5%, a 5% daily limit and a 10% static total - for fourteen days per phase, costs nothing, allows only one active trial, pays no reward and never converts into a funded account. Its value is entirely informational: it shows you how you behave when limits are live.',
            'تستِ رایگان بیرونِ این حساب‌وکتاب است. قواعدِ «استاندارد» را اعمال می‌کند — ۸٪ سپس ۵٪، سقفِ روزانه ۵٪ و سقفِ کل ۱۰٪ ثابت — برای ۱۴ روز در هر مرحله، هیچ هزینه‌ای ندارد، فقط یک تستِ فعال را می‌پذیرد، پاداشی نمی‌دهد و هرگز به حساب فاندشده تبدیل نمی‌شود. ارزشش کاملاً اطلاعاتی است: نشان می‌دهد وقتی سقف‌ها فعال‌اند چگونه رفتار می‌کنی.'
          )
        },
        {
          type: 'p',
          text: text(
            'Name the result precisely. A pass is a record that your behaviour satisfied a written condition under one configuration, at your own cost. It is not evidence that the same behaviour will produce the same profit later, and at Openfund it is not a claim on capital, because funded accounts and payouts are not enabled in this release. A catalog is a set of published terms of record; a demo trade advances no path.',
            'نتیجه را دقیق نام بگذار. قبولی یعنی رفتارِ تو شرطِ مکتوبی را زیرِ یک پیکربندی مشخص، با هزینهٔ خودت پاس کرده است. نشانهٔ این نیست که همان رفتار بعداً همان سود را می‌سازد، و در اوپن‌فاند ادعایی بر سرمایه هم نیست، چون حساب فاندشده و برداشت در این نسخه فعال نیستند. فهرستِ چلنج‌ها مجموعه‌ای شرطِ منتشرشده و مرجع است و یک معاملهٔ دمو هیچ مسیری را جلو نمی‌برد.'
          )
        },
        {
          type: 'terms',
          items: [
            { term: text('Screening', 'غربال'), text: text('Selecting by the distribution of losses, not by one return figure.', 'انتخاب بر اساس توزیعِ ضررها، نه یک رقمِ بازده.') },
            { term: text('Trading day', 'روز معاملاتی'), text: text('A day that counts as participation under the published rule.', 'روزی که طبق قاعدهٔ منتشرشده حضور شمرده می‌شود.') },
            { term: text('Static drawdown', 'دراودانِ ثابت'), text: text('A total-loss boundary fixed from the starting account size; profit does not raise it.', 'مرزِ ضررِ کلِ ثابت از اندازهٔ شروعِ حساب؛ سود آن را بالا نمی‌برد.') },
            { term: text('Trailing drawdown', 'دراودانِ شناور'), text: text('A boundary that follows the highest recorded equity upward and never returns down.', 'مرزی که بالاترین ارزشِ خالصِ ثبت‌شده را به بالا دنبال می‌کند و هرگز پایین نمی‌آید.') },
          ]
        },
        {
          type: 'note',
          text: text(
            'All four structures above are published terms of record for Openfund; purchase activation, funded accounts and payouts are not enabled in this release, so nothing here is purchasable or enforced today. Independent review of the product is planned and not yet performed. News-trading and weekend rules for funded stages, a scaling plan and the reset and appeal process are not finalized.',
            'همهٔ ساختارهایِ بالا شرایطِ منتشرشده و مرجعِ اوپن‌فاند است؛ فعال‌سازیِ خرید، حساب فاندشده و برداشت در این نسخه فعال نیست، پس هیچ‌یک از این‌ها امروز قابلِ خرید یا قابلِ اجرا نیست. بررسیِ مستقلِ محصول در برنامه است و هنوز انجام نشده. قواعدِ معاملهٔ خبری و آخرِ هفته برای مرحلهٔ فاندشده، طرحِ scaling و فرایندِ بازنشانی و اعتراض نهایی نشده‌اند.'
          )
        },
        {
          type: 'p',
          text: text(
            'This is why the lesson exists at all: once you know what a rule is screening for, you stop trading the target and start trading the boundary. The next lesson is the reading method that makes that explicit.',
            'این درس دقیقاً برای همین هست: وقتی بفهمی یک قاعده دنبال چه چیزی است، دست از معاملهٔ هدف برمی‌داری و مرز را معامله می‌کنی. درسِ بعدی همان روشِ خواندن است که این را صریح می‌کند.'
          )
        },
      ]
    },
    {
      slug: 'reading-a-rulebook',
      path: 'prop-trading-explained',
      sort: 3,
      minutes: 9,
      status: 'published',
      title: text('Reading a rulebook without missing anything', 'چطور رول‌بوک را کامل بخوانی'),
      summary: text(
        'A five-pass method for reading a set of prop rules: definitions, measurement basis, breach semantics, payout conditions, and finally everything the document leaves unwritten.',
        'روشِ پنج‌عبوره برای خواندنِ قواعدِ پراپ: تعریف‌ها، مبنایِ سنجش، معنایِ نقض، شرایطِ برداشت و در پایان هر چیزی که متن ننوشته.'
      ),
      takeaways: [
        text('Five single-question passes find far more than one careful read', 'پنج عبورِ تک‌سؤالی خیلی بیشتر از یک دقیق‌خواندن پیدا می‌کند'),
        text('Every limit must be traced to the number it is measured against and the clock that resets it', 'هر سقف را باید به عددی که مبنایِ سنجشش است و ساعتی که بازنشانی‌اش می‌کند وصل کنی'),
        text('Touching a limit is the breach; recovery afterwards does not undo it', 'لمسِ سقف همان نقض است و بازیابیِ بعدش چیزی را به‌عقب نمی‌گرداند'),
        text('Silence is a category: write what is missing instead of assuming it favours you', 'سکوت یک دسته است؛ به‌جای فرضِ به‌سودِ تو، آنچه کم است را بنویس'),
      ],
      glossary: [],
      tools: ['journal-analyzer', 'prop-drawdown'],
      blocks: [
        {
          type: 'p',
          text: text(
            'Rulebooks are short, which is exactly why people read them once and believe they know them. The dependable method is five passes, each asking one question: what do the words mean, what is each number measured against, what counts as a breach, what must be true before payment, and what is missing. That order works on any provider’s document, and it is the order that exposes the gap between what a page says and what you assumed.',
            'رول‌بوک‌ها کوتاه‌اند و دقیقاً به همین دلیل خیلی‌ها یک‌بار می‌خوانندشان و فکر می‌کنند بلدند. روشِ قابل‌اتکا پنج عبور است با یک سؤال در هر عبور: واژه‌ها چه معنایی دارند، هر عدد با چه چیزی سنجیده می‌شود، نقض چیست، پیش از پرداخت چه باید درست باشد و چه چیزی جا افتاده. این ترتیب روی سندِ هر ارائه‌دهنده‌ای کار می‌کند و همان ترتیبی است که فاصلهٔ میان «آنچه صفحه می‌گوید» و «آنچه تو فرض کردی» را آشکار می‌کند.'
          )
        },
        { type: 'h2', text: text('Pass one: the definitions', 'عبورِ اول: تعریف‌ها') },
        {
          type: 'p',
          text: text(
            'Half of the disagreements between a trader and a rulebook begin in the glossary. Balance, equity, margin and position size carry separate meanings, and a limit written against one of them behaves very differently from a limit written against another. Write your own one-line definition of every term the document uses, then compare it with the document’s own terminology section.',
            'نیمی از اختلاف‌های میانِ معامله‌گر و رول‌بوک از واژه‌نامه شروع می‌شود. موجودی، ارزشِ خالص، وجهِ تضمین و اندازهٔ موقعیت معنایی جدا دارند و سقفی که روی یکی از آن‌ها نوشته شود رفتاری بسیار متفاوت از سقفی دارد که روی دیگری نوشته شده. برای هر واژهٔ متن یک تعریفِ یک‌خطیِ خودت را بنویس، بعد با بخشِ واژه‌های همان سند مقایسه‌اش کن.'
          )
        },
        {
          type: 'terms',
          items: [
            { term: text('Balance', 'موجودی'), text: text('Realised ledger results and funding, after fees; the number an accounting report shows.', 'نتایجِ تحقق‌یافته و تأمینِ مالی پس از کسرِ هزینه‌ها؛ همان عددی که گزارشِ حسابداری نشان می‌دهد.') },
            { term: text('Equity', 'ارزش خالص'), text: text('Balance plus the unrealised result of open positions; the number live limits track.', 'موجودی به‌همراه سود یا زیانِ شناورِ موقعیت‌های باز؛ همان عددی که سقف‌های زنده دنبال می‌کنند.') },
            { term: text('Used margin', 'وجه تضمین مصرف‌شده'), text: text('Capacity reserved by open positions; it constrains size without being a loss limit.', 'ظرفیتی که موقعیت‌های باز رزرو کرده‌اند؛ اندازه را محدود می‌کند ولی سقفِ ضرر نیست.') },
            { term: text('Breach', 'نقض'), text: text('Touching a loss limit. On the Openfund terms of record it closes the account.', 'لمسِ یک سقفِ ضرر؛ در شرایطِ مرجعِ اوپن‌فاند حساب را می‌بندد.') },
          ]
        },
        { type: 'h2', text: text('Pass two: what each number is measured against', 'عبورِ دوم: هر عدد با چه چیزی سنجیده می‌شود') },
        { type: 'formula', expr: 'daily loss line = max(day-start balance, day-start equity) x (1 - daily loss limit)', text: text('Ask this of every limit: which reference number, which direction, and which clock. On the Openfund terms of record the daily limit uses the higher of the two day-start figures and resets at 00:00 UTC+3.', 'از هر سقف بپرس: با کدام عددِ مرجع، در کدام جهت و با کدام ساعت. در شرایطِ مرجعِ اوپن‌فاند سقفِ روزانه بزرگ‌ترِ دو عددِ ابتدای روز را مبنا می‌گیرد و ساعت ۰۰:۰۰ (UTC+3) بازنشانی می‌شود.') },
        {
          type: 'p',
          text: text(
            'Two consequences follow immediately. Floating profit early in a session can raise the line, so an open winner is quietly buying you room. A day that begins deep inside a losing position begins with almost no allowance, because the higher reference is already fixed. Also notice whose clock is used: 00:00 UTC+3 is not midnight where you live, and if you trade near the boundary the reset hour is part of your risk plan, not a detail.',
            'دو نتیجه بی‌واسطه می‌آید. سودِ شناورِ ابتدای جلسه می‌تواند خط را بالا ببرد، پس یک موقعیتِ سودده بی‌صدا برایت جا می‌خرد. روزی که در دلِ یک موقعیتِ زیان‌ده شروع شود تقریباً بدونِ بودجه شروع می‌شود، چون عددِ مرجعِ بالاتر از پیش ثابت شده. به ساعتِ موردنظر هم دقت کن: ۰۰:۰۰ به وقت UTC+3، نیمه‌شبِ شهرِ تو نیست و اگر نزدیکِ مرز معامله می‌کنی، ساعتِ بازنشانی بخشی از برنامهٔ ریسک توست، نه یک نکتهٔ حاشیه‌ای.'
          )
        },
        { type: 'h2', text: text('Pass three: breach semantics', 'عبورِ سوم: معنایِ نقض') },
        {
          type: 'ul',
          items: [
            text('Touching is enough: limits are written as boundaries, not as something you may exceed and repair.', 'لمس کردن کافی است: سقف‌ها به‌صورتِ مرز نوشته شده‌اند، نه حدی که از آن عبور کنی و بعد جبرانش کنی.'),
            text('Equity counts, so unrealised losses move you to the line before a single position is closed.', 'مبنای محاسبه ارزشِ خالص است، پس زیانِ شناور پیش از بستنِ حتی یک موقعیت تو را به خط می‌رساند.'),
            text('A recovery does not undo a breach: once touched, the account is finished under the agreement.', 'بازگشتِ سود، نقض را پاک نمی‌کند: پس از لمس، طبق قرارداد حساب تمام شده است.'),
            text('A trial breach ends the trial at that moment, with no reward question involved.', 'نقض در تستِ رایگان، همان لحظه تست را می‌بندد و اصلاً بحثِ پاداش مطرح نیست.'),
          ]
        },
        { type: 'h2', text: text('Pass four: trading rules versus payout rules', 'عبورِ چهارم: قاعدهٔ معاملاتی در برابر قاعدهٔ برداشت') },
        {
          type: 'p',
          text: text(
            'This is the most expensive misreading in prop documents. Failing a payout condition costs you money; breaking a trading rule can cost you the account. Draw a line down the middle of a page and place every condition on one side. The consistency score belongs on the payout side: the largest share of total profit taken by one day is capped at 35% on the monthly path and 15% on Instant, and it is not a limit on how you may trade on any given day. Minimum trading days and the profit targets belong on the evaluation side.',
            'گران‌ترینِ خوانشِ غلط در سندهایِ پراپ همین است. رعایت‌نکردنِ شرطِ برداشت هزینه دارد و شکستنِ قاعدهٔ معاملاتی می‌تواند حساب را ببرد. وسطِ یک صفحه خط بکش و هر شرط را در یک طرف بنویس. امتیازِ consistency طرفِ برداشت است: سهمِ بیشینهٔ یک روز از سودِ کل در مسیرِ ماهانه ۳۵٪ و در «آنی» ۱۵٪ محدود شده، و این محدودیتی بر نحوهٔ معاملهٔ تو در یک روز خاص نیست. حداقلِ روزهای معاملاتی و اهدافِ سود هم طرفِ ارزیابی‌اند.'
          )
        },
        { type: 'h2', text: text('Pass five: the silence', 'عبورِ پنجم: سکوت') },
        {
          type: 'p',
          text: text(
            'Now list what is not stated at all. In this release that list is long and it should be written out rather than guessed: the scaling plan, the reset and appeal process, news-trading and weekend rules for funded stages, the payout rails, payout fees, taxes, and the settlement currency and network are all not finalized. Absence is not permission. A plan that quietly assumes the missing line will favour you is one review away from failing.',
            'حالا فهرست کن چه چیزی اصلاً نوشته نشده. در این نسخه آن فهرست بلند است و باید نوشته شود نه حدس: طرحِ scaling، فرایندِ بازنشانی و اعتراض، قواعدِ معاملهٔ خبری و آخرِ هفته در مرحلهٔ فاندشده، مسیرهایِ برداشت، کارمزدِ برداشت، مالیات و ارز و شبکهٔ تسویه — همه نهایی نشده‌اند. نبودِ قاعده به معنایِ اجازه نیست. برنامه‌ای که بی‌صدا فرض کند آن خطِ گم‌شده به سودِ تو پر می‌شود، یک بازبینی تا شکست فاصله دارد.'
          )
        },
        {
          type: 'note',
          text: text(
            'Where the document is silent, this path says so. Nothing here is a contract: purchase activation, funded accounts and payouts are not enabled in this release, and a final versioned agreement will be published before launch. Identity is one wallet to one identity, and a wallet can hold more than one challenge record; KYC, age and geographic eligibility are not finalized.',
            'هر جا سند ساکت است، این مسیر همان را می‌گوید. هیچ‌چیز اینجا قرارداد نیست: فعال‌سازیِ خرید، حساب فاندشده و برداشت در این نسخه فعال نیست و پیش از عرضه قراردادِ نهاییِ نسخه‌دار منتشر خواهد شد. هویت یعنی یک کیف پول و یک هویت، و یک کیف پول می‌تواند چند سابقهٔ چلنج داشته باشد؛ الزاماتِ KYC، سن و شرایطِ جغرافیایی نهایی نشده‌اند.'
          )
        },
        {
          type: 'table',
          caption: text('The published terms of record, rebuilt as one table', 'شرایطِ منتشرشده و مرجع، به‌شکلِ یک جدول'),
          head: [text('Item', 'شرط'), text('Standard', 'استاندارد'), text('One-phase', 'تک‌مرحله‌ای'), text('Instant', 'آنی'), text('Free Trial', 'تست رایگان')],
          rows: [
            [text('Phases · target', 'مراحل · هدف'), text('2 · 8% then 5%', '۲ · ۸٪ سپس ۵٪'), text('1 · 12%', '۱ · ۱۲٪'), text('none · no target', 'بدون مرحله · بدون هدف'), text('2 · 8% then 5%', '۲ · ۸٪ سپس ۵٪')],
            [text('Daily loss', 'سقف ضرر روزانه'), text('5% (or 3%)', '۵٪ (یا ۳٪)'), text('3% (or 2%)', '۳٪ (یا ۲٪)'), text('3%', '۳٪'), text('5%', '۵٪')],
            [text('Maximum loss', 'سقف ضرر کل'), text('10% static', '۱۰٪ ثابت'), text('12% static', '۱۲٪ ثابت'), text('5% trailing', '۵٪ شناور'), text('10% static', '۱۰٪ ثابت')],
            [text('Minimum activity', 'حداقل فعالیت'), text('3 trading days / phase', '۳ روز معاملاتی / مرحله'), text('none', 'ندارد'), text('7 profitable days / rolling 30', '۷ روز سودده / ۳۰ روز جاری'), text('3 trading days / phase', '۳ روز معاملاتی / مرحله')],
            [text('Reward share', 'سهم پاداش'), text('80% bi-weekly · 100% monthly', '۸۰٪ دو‌هفته‌ای · ۱۰۰٪ ماهانه'), text('80% · 100% monthly', '۸۰٪ · ۱۰۰٪ ماهانه'), text('95% every 14 days', '۹۵٪ هر ۱۴ روز'), text('none', 'ندارد')],
            [text('Fee refund', 'بازپرداخت هزینه'), text('with the 4th reward', 'با چهارمین پاداش'), text('none', 'ندارد'), text('none', 'ندارد'), text('free', 'رایگان')],
          ]
        },
        {
          type: 'p',
          text: text(
            'Run the five passes on paper, on the document you actually intend to trade, and keep your notes beside it. Where your reading and the page disagree, the page wins by definition - that is what a term of record means. The next lesson applies the method to the payout side of the page in detail.',
            'پنج عبور را روی کاغذ اجرا کن، همان رول‌بوکی که قصد داری زیرِ قواعدش معامله کنی، و یادداشت‌هایت را کنارش نگه دار. هر جا خوانشِ تو با صفحه اختلاف داشت، تعریفاً صفحه برنده است — شرطِ مرجع یعنی همین. درسِ بعدی روش را روی طرفِ برداشتِ صفحه دقیق اعمال می‌کند.'
          )
        },
      ]
    },
    {
      slug: 'consistency-and-payout-conditions',
      path: 'prop-trading-explained',
      sort: 4,
      minutes: 9,
      status: 'published',
      title: text('Consistency score and payout conditions', 'امتیاز تداوم و شرایط برداشت'),
      summary: text(
        'The conditions that decide whether profit becomes payable - reward shares, cycles, minimums, profitable-day counts and the consistency score - and what the published terms do not cap.',
        'شرایطی که مشخص می‌کنند سود تبدیل به پرداخت می‌شود یا نه: سهم‌های پاداش، سیکل‌ها، حداقلِ درخواست، شمارشِ روزهای سودده و امتیازِ consistency — و اینکه شرایطِ منتشرشده چه چیزی را محدود نکرده‌اند.'
      ),
      takeaways: [
        text('The consistency score caps the share of total profit that one day may hold, and it is a payout condition', 'امتیازِ تداوم سهمِ یک روز از سودِ کل را محدود می‌کند و یک شرطِ برداشت است، نه محدودیتِ معاملاتی'),
        text('Two caps are published: 35% on the monthly path, 15% on Instant', 'دو سقف منتشر شده: ۳۵٪ در مسیرِ ماهانه و ۱۵٪ در «آنی»'),
        text('The monthly 100% share is earned with seven profitable days and the consistency score respected', 'سهمِ ۱۰۰٪ ماهانه با هفت روزِ سودده و رعایتِ امتیازِ تداوم به دست می‌آید'),
        text('There is no published lifetime payout cap, and the payout rails, fees, taxes, currency and network are not finalized', 'سقفِ مادام‌العمرِ برداشت منتشر نشده، و مسیرها، کارمزدها، مالیات، ارز و شبکهٔ برداشت نهایی نشده‌اند'),
      ],
      glossary: [],
      tools: ['journal-analyzer', 'prop-drawdown'],
      blocks: [
        {
          type: 'p',
          text: text(
            'Payout conditions are where prop documents get quietly strict. Nothing in them changes how you may place an order; they decide whether the profit you made is eligible. Read them as a gate in front of the money, not as a rulebook inside the trading day, and the arithmetic becomes easy to plan around. Every number in that gate is published in advance, so routing around it costs you nothing; the expensive version is learning the shape of it on the day you want to withdraw.',
            'شرایطِ برداشت جایی است که سندهایِ پراپ بی‌صدا سخت می‌شوند. هیچ‌یک از آن‌ها روشِ ثبتِ سفارشِ تو را عوض نمی‌کند؛ تصمیم می‌گیرند که آیا سودی که ساخته‌ای واجدِ شرایط هست یا نه. اگر آن‌ها را دروازه‌ای جلویِ پول بخوانی نه قاعده‌ای درونِ روزِ معاملاتی، برنامه‌ریزیِ ریاضی‌شان ساده می‌شود. همهٔ اعدادِ آن دروازه از پیش منتشر شده‌اند، پس کنارِ زدن از آن‌ها هیچ هزینه‌ای برایت ندارد؛ نسخهٔ گران همان است که در روزِ درخواستِ برداشت با شکلِ‌شان آشنا شوی.'
          )
        },
        { type: 'h2', text: text('Why the consistency score exists', 'امتیازِ تداوم چرا وجود دارد') },
        {
          type: 'p',
          text: text(
            'Total profit is a bad summary statistic. Two accounts with identical profit can differ completely in how it arrived: one built across many ordinary days, the other carried by a single session where size and luck lined up. The consistency score is the published way of naming that difference - it caps how much of the total any one day may supply, so the payout is asking for a distribution rather than an outcome.',
            'سودِ کل آمارِ خلاصهٔ بدی است. دو حساب با سودِ یکسان می‌توانند از نظرِ شیوهٔ رسیدن به آن کاملاً فرق داشته باشند: یکی در چند روزِ معمولی ساخته شده و دیگری با یک جلسه که در آن حجم و شانس هم‌راستا شده بودند. امتیازِ تداوم همان نام‌گذاریِ منتشرشدهٔ این تفاوت است: سقف می‌گذارد که یک روز چند بخش از کل را تأمین کند، پس برداشت یک توزیع می‌خواهد، نه یک نتیجه.'
          )
        },
        { type: 'formula', expr: 'consistency share = best profitable day profit / total profit x 100', text: text('The published caps apply to that share: 35% on the monthly path and 15% on Instant.', 'سقف‌های منتشرشده بر همین سهم اعمال می‌شوند: ۳۵٪ در مسیرِ ماهانه و ۱۵٪ در «آنی».') },
        {
          type: 'ul',
          items: [
            text('35% on the monthly path: no single day may supply more than about a third of the profit.', '۳۵٪ در مسیرِ ماهانه: هیچ روزی نباید بیش از حدود یک‌سومِ سود را بسازد.'),
            text('15% on Instant: the same idea applied much more tightly.', '۱۵٪ در «آنی»: همان ایده با سخت‌گیریِ خیلی بیشتر.'),
            text('Neither figure restricts the size of an order or the number of trades in a day.', 'هیچ‌یک از این دو عدد اندازهٔ سفارش یا تعدادِ معاملاتِ یک روز را محدود نمی‌کند.'),
            text('Both are measured on the day’s contribution, so a quiet distribution passes without cost.', 'هر دو بر سهمِ مشارکتِ روز سنجیده می‌شوند، پس توزیعِ آرام بی‌هزینه رد می‌شود.'),
          ]
        },
        { type: 'h2', text: text('The profitable-day requirement', 'الزامِ روزهای سودده') },
        {
          type: 'p',
          text: text(
            'Two different uses of the same idea appear in the published terms. On the Standard and One-phase models, the base share is 80% on a bi-weekly cycle, and the monthly cycle pays 100% when there are seven profitable days and the consistency score is respected - so the higher share is bought with evidence of regularity. On Instant, seven profitable days inside each rolling thirty is a condition of the payout itself, alongside the 15% cap. Both are counted at day level, which means the same total profit can clear one design and fail the other depending on how evenly it was distributed.',
            'دو کاربردِ متفاوت از یک ایده در شرایطِ منتشرشده می‌آید. در مدل‌هایِ «استاندارد» و «تک‌مرحله‌ای» سهمِ پایه ۸۰٪ در سیکلِ دوهفته‌ای است و سیکلِ ماهانه ۱۰۰٪ می‌پردازد وقتی هفت روزِ سودده وجود داشته باشد و امتیازِ تداوم رعایت شده باشد — یعنی سهمِ بالاتر با نشانهٔ نظم خریده می‌شود. در «آنی» هفت روزِ سودده در هر بازهٔ ۳۰روزهٔ جاری بخشی از شرطِ برداشت است، در کنارِ همان سقفِ ۱۵٪. هر دو در سطحِ روز شمرده می‌شوند، پس یک سودِ کلِ یکسان می‌تواند در یک طراحی رد و در طراحیِ دیگر مردود شود؛ بستگی دارد چقدر یکنواخت توزیع شده باشد.'
          )
        },
        { type: 'h2', text: text('The payout clock', 'ساعتِ برداشت') },
        {
          type: 'ol',
          items: [
            text('First request: 14 days after the first trade on the funded stage.', 'نخستینِ درخواست: ۱۴ روز پس از اولین معامله در مرحلهٔ فاندشده.'),
            text('Cycles: a bi-weekly cycle at 80% or a monthly cycle at 100%, and on Instant 95% every 14 calendar days.', 'سیکل‌ها: دوهفته‌ای با ۸۰٪ یا ماهانه با ۱۰۰٪، و در «آنی» ۹۵٪ هر ۱۴ روزِ تقویمی.'),
            text('Minimum request: 1% of the account size.', 'حداقلِ درخواست: ۱٪ اندازهٔ حساب.'),
            text('On Instant the first 3% of profit is not payout-eligible.', 'در «آنی» ۳٪ نخستِ سود مشمولِ برداشت نیست.'),
            text('On Standard the evaluation fee is refunded with the fourth reward.', 'در «استاندارد» هزینهٔ ارزیابی با چهارمین پاداش بازمی‌گردد.'),
          ]
        },
        {
          type: 'table',
          caption: text('Payout conditions of record, by model', 'شرایطِ برداشتِ مرجع، به تفکیکِ مدل'),
          head: [text('Condition', 'شرط'), text('Standard', 'استاندارد'), text('One-phase', 'تک‌مرحله‌ای'), text('Instant', 'آنی')],
          rows: [
            [text('Reward share', 'سهم پاداش'), text('80% · 100% monthly', '۸۰٪ · ۱۰۰٪ ماهانه'), text('80% · 100% monthly', '۸۰٪ · ۱۰۰٪ ماهانه'), text('95%', '۹۵٪')],
            [text('Cycle', 'سیکل'), text('bi-weekly · monthly', 'دوهفته‌ای · ماهانه'), text('bi-weekly · monthly', 'دوهفته‌ای · ماهانه'), text('every 14 calendar days', 'هر ۱۴ روز تقویمی')],
            [text('Consistency cap', 'سقف تداوم'), text('35% on the monthly path', '۳۵٪ در مسیر ماهانه'), text('35% on the monthly path', '۳۵٪ در مسیر ماهانه'), text('15%', '۱۵٪')],
            [text('Profitable days', 'روزهای سودده'), text('7 for the 100% monthly share', '۷ روز برای سهم ۱۰۰٪ ماهانه'), text('7 for the 100% monthly share', '۷ روز برای سهم ۱۰۰٪ ماهانه'), text('7 per rolling 30 days', '۷ در هر بازه ۳۰روزه')],
            [text('Payout-ineligible slice', 'بخشِ غیرمجاز از برداشت'), text('none published', 'منتشر نشده'), text('none published', 'منتشر نشده'), text('first 3% of profit', '۳٪ نخستِ سود')],
          ]
        },
        { type: 'h2', text: text('The cap that is not there', 'سقفی که وجود ندارد') },
        {
          type: 'p',
          text: text(
            'The published terms do not set a lifetime ceiling on how much you can take out, which surprises people who have read other programmes. Two things follow. First, growth is limited by the rules that are written - loss limits, cycles, minimums and the consistency caps - not by a fixed maximum. Second, the absence of a cap is not a promise: a scaling plan is not finalized, and scaling is exactly the mechanism that would decide how much account you reach.',
            'شرایطِ منتشرشده سقفِ مادام‌العمری بر مجموعِ برداشت نگذاشته‌اند؛ چیزی که خوانندگانِ برنامه‌هایِ دیگر را غافلگیر می‌کند. دو نتیجه می‌آید. اول، رشد را قواعدِ نوشته‌شده محدود می‌کنند — سقف‌های ضرر، سیکل‌ها، حداقل‌ها و سقف‌های تداوم — نه یک عددِ بیشینهٔ ثابت. دوم، نبودِ سقف وعده نیست: طرحِ scaling نهایی نشده، و دقیقاً همان سازوکار است که مشخص می‌کند به چه اندازهٔ حسابی می‌رسی.'
          )
        },
        {
          type: 'note',
          text: text(
            'Nothing in this lesson is active in the current release: purchase activation, funded accounts and payouts are not enabled, and a final versioned agreement will be published before launch. The payout rails, payout fees, taxes and the settlement currency and network are not finalized. What is described here is the published terms of record - conditions you can plan against, not money you can request. The Free Trial pays nothing and never converts into a funded account.',
            'هیچ‌چیز در این درس در نسخهٔ فعلی فعال نیست: فعال‌سازیِ خرید، حساب فاندشده و برداشت فعال نیستند و پیش از عرضه قراردادِ نهاییِ نسخه‌دار منتشر خواهد شد. مسیرهایِ برداشت، کارمزدِ برداشت، مالیات و ارز و شبکهٔ تسویه نهایی نشده‌اند. آنچه اینجا آمده شرایطِ منتشرشده و مرجع است — شرایطی که می‌توانی بر مبنای‌شان برنامه بریزی، نه پولی که بتوانی درخواست کنی. تستِ رایگان هیچ پرداختی ندارد و هرگز به حساب فاندشده تبدیل نمی‌شود.'
          )
        },
        { type: 'h2', text: text('Turning the conditions into a routine', 'تبدیلِ شرایط به یک روتین') },
        {
          type: 'ol',
          items: [
            text('Record daily net profit as one column per day; the consistency share is a column of that table, not a feeling.', 'سودِ خالصِ روزانه را در یک ستون به ازای هر روز ثبت کن؛ سهمِ تداوم ستونی از همان جدول است، نه یک حس.'),
            text('Track profitable days inside a rolling 30-day window and the rolling sum that divides them.', 'روزهای سودده را در پنجرهٔ ۳۰روزهٔ جاری و مجموعِ جاریِ تقسیم‌کننده‌شان پی بگیر.'),
            text('Keep the day-14 eligibility date and the minimum request in the same sheet, so the clock is never a surprise.', 'تاریخِ واجدِ شرایط شدنِ روزِ ۱۴ و حداقلِ درخواست را در همان برگه نگه دار تا ساعتِ برداشت غافلگیر نکندت.'),
            text('Check which slice of profit is payout-ineligible before planning any withdrawal request.', 'پیش از برنامه‌ریزی برای هر درخواستِ برداشت ببین کدام بخش از سود مشمولِ برداشت نیست.'),
          ]
        },
        {
          type: 'p',
          text: text(
            'Once the gate is modelled, payout planning stops being a rumour you react to and becomes arithmetic you schedule. The last lesson in this path returns to the trading day itself, where those conditions meet the loss limits.',
            'وقتی دروازه مدل‌سازی شود، برنامه‌ریزیِ برداشت از شایعه‌ای که به آن واکنش نشان می‌دهی به حساب‌وکتابی تبدیل می‌شود که زمانش را تعیین می‌کنی. درسِ پایانیِ این مسیر به خودِ روزِ معاملاتی برمی‌گردد، آن‌جا که این شرایط به سقف‌های ضرر می‌رسند.'
          )
        },
      ]
    },
    {
      slug: 'risk-management-on-a-funded-account',
      path: 'prop-trading-explained',
      sort: 5,
      minutes: 10,
      status: 'published',
      title: text('Risk management on a funded account', 'مدیریت ریسک در حساب فاندشده'),
      summary: text(
        'Without a target, risk management becomes the whole job: which boundary binds first, how floating losses move it, and what changes when the limit trails your own best equity.',
        'بدونِ هدف، مدیریتِ ریسک تمامِ کار می‌شود: کدام مرز زودتر قفل می‌کند، زیانِ شناور همان مرز را چگونه جابه‌جا می‌کند و وقتی سقف به بالاترینِ ارزشِ خالصِ تو وصل شود چه تغییر می‌کند.'
      ),
      takeaways: [
        text('Three limits bind at once - the daily allowance, the static or trailing total, and the payout conditions', 'سه سقف هم‌زمان فعال‌اند: بودجهٔ روزانه، سقفِ کلِ ثابت یا شناور، و شرایطِ برداشت'),
        text('Equity is the reference, so unrealised losses spend the allowance before a position is closed', 'مبنای محاسبه ارزشِ خالص است، پس زیانِ شناور پیش از بستنِ موقعیت بودجه را خرج می‌کند'),
        text('A trailing boundary rises with your best equity, which is a reward that quietly tightens the room', 'مرزِ شناور با بهترینِ ارزشِ خالصِ تو بالا می‌رود؛ پاداشی که بی‌صدا فضا را تنگ می‌کند'),
        text('Simulation fee and spread values are a documented simulation policy, not commercial venue fees', 'اعدادِ کارمزد و اسپردِ شبیه‌سازی یک سیاستِ مستندِ شبیه‌سازی است، نه کارمزدِ صرافی‌های واقعی'),
      ],
      glossary: ['trailing-drawdown', 'max-drawdown', 'position-size'],
      tools: ['position-size', 'prop-drawdown'],
      blocks: [
        {
          type: 'p',
          text: text(
            'On a funded account the target is gone and the boundaries are not. That reversal changes the job: in evaluation you manage risk in service of a number, and after that you manage risk because it is the only remaining variable you control. Nothing here is advice about a method - it is arithmetic about constraints.',
            'در حساب فاندشده هدف رفته و مرزها نرفته‌اند. همین جابه‌جایی کار را عوض می‌کند: در ارزیابی ریسک را برای رسیدن به یک عدد اداره می‌کنی و پس از آن ریسک را اداره می‌کنی، چون تنها متغیرِ باقی‌مانده در کنترلِ توست. چیزی در این درس دربارهٔ یک راهبرد نیست — حساب‌وکتابِ محدودیت‌هاست.'
          )
        },
        { type: 'h2', text: text('Three boundaries, checked in order', 'سه مرز، به ترتیب بررسی می‌شوند') },
        {
          type: 'ol',
          items: [
            text('Daily allowance: the distance from the higher of day-start balance or day-start equity to the daily limit, reset at 00:00 UTC+3.', 'بودجهٔ روزانه: فاصله از بزرگ‌ترِ موجودی یا ارزشِ خالصِ ابتدای روز تا سقفِ روزانه، با بازنشانی ساعت ۰۰:۰۰ به وقت UTC+3.'),
            text('Total allowance: on Standard and One-phase a static floor set from the starting size; on Instant a trailing boundary that only moves up.', 'بودجهٔ کل: در «استاندارد» و «تک‌مرحله‌ای» کفی ثابت از اندازهٔ شروع؛ در «آنی» مرزی شناور که فقط بالا می‌رود.'),
            text('Payout conditions: consistency and profitable-day requirements, which do not restrict a position but decide what is eligible.', 'شرایطِ برداشت: تداوم و الزامِ روزهای سودده که موقعیت را محدود نمی‌کنند ولی واجدِ شرایط بودن را تعیین می‌کنند.'),
            text('The tightest one governs: plan the day from the boundary that binds first, not the one you would prefer.', 'تنگ‌ترینِ آن‌ها تعیین می‌کند: روز را از مرزی که اول قفل می‌شود برنامه بریز، نه از آنکه ترجیح می‌دهی.'),
          ]
        },
        { type: 'formula', expr: 'daily allowance = max(day-start balance, day-start equity) x daily loss limit', text: text('Measured in money, this is the day’s total risk budget before any position is opened.', 'به پول، این بودجهٔ کلِ ریسکِ همان روز است؛ پیش از باز شدنِ هر موقعیت.') },
        {
          type: 'p',
          text: text(
            'The allowance must then be split. If three ordinary stops can consume the daily budget, either the stops are too wide or the size is too large - and the fix is to reduce the budget at risk per trade, not to widen the day. On the published terms of record, touching a limit is a breach that closes the account, so the day is not a soft target you can average into.',
            'بودجه باید سپس تقسیم شود. اگر سه حدِ ضررِ معمولی بتوانند بودجهٔ روز را تمام کنند، یا حدها بیش از حد عریض‌اند یا حجم بیش از حد بزرگ — و راه‌حل کم کردنِ ریسکِ هر معامله است، نه عریض‌تر کردنِ روز. در شرایطِ منتشرشده و مرجع، لمسِ سقف نقضی است که حساب را می‌بندد، پس روز هدفِ نرمی نیست که با میانگین‌گیری از آن عبور کنی.'
          )
        },
        { type: 'formula', expr: 'per-trade risk = min(equity x risk fraction, daily allowance / planned attempts)', text: text('The first term is a habit, the second is a constraint; the smaller number is the one that actually protects the account.', 'عبارتِ اول یک عادت است و عبارتِ دوم یک محدودیت؛ عددِ کوچک‌تر همان است که در عمل از حساب محافظت می‌کند.') },
        {
          type: 'terms',
          items: [
            { term: text('Realised loss', 'زیان محقق‌شده'), text: text('A closed result, already in the balance and in the daily figure.', 'نتیجهٔ بسته‌شده که هم در موجودی و هم در عددِ روز نشسته است.') },
            { term: text('Unrealised loss', 'زیان شناور'), text: text('Open and counted: equity-based limits move toward the boundary immediately.', 'باز ولی شمرده: سقف‌های مبتنی بر ارزشِ خالص فوراً به مرز نزدیک می‌شوند.') },
            { term: text('Breakeven lock', 'قفلِ سربه‌سر'), text: text('On Instant, the trailing boundary fixes at the starting level once the account is 5% in profit.', 'در «آنی» مرزِ شناور وقتی حساب ۵٪ سود شود روی سطحِ شروع ثابت می‌شود.') },
            { term: text('Non-eligible profit', 'سودِ غیرمجاز از برداشت'), text: text('Profit that is real but outside payout: the first 3% on Instant.', 'سودی واقعی ولی بیرونِ برداشت: ۳٪ نخست در «آنی».') },
          ]
        },
        { type: 'h2', text: text('What a trailing boundary does to behaviour', 'مرزِ شناور با رفتار چه می‌کند') },
        {
          type: 'p',
          text: text(
            'A static floor from the starting size is the friendliest of the three: you can lose the same distance again after a recovery, because the line does not move. A trailing boundary is the opposite - every new best equity raises it, so a rising account trades with progressively less room below. On the Instant terms of record the total drawdown trails at 5%, then locks at breakeven once the account is 5% in profit, and it does not reset after a payout. That shape rewards early restraint and punishes the instinct to size up after a good run.',
            'کفِ ثابتِ مبتنی بر اندازهٔ شروع، خوش‌رفتارترینِ این سه است: بعد از جبران می‌توانی همان مقدار را دوباره از دست بدهی، چون خط جابه‌جا نشده. مرزِ شناور عکسِ آن است — هر ارزشِ خالصِ بهترینِ تازه آن را بالا می‌برد، پس حسابِ روبه‌رشد با جای کمتری زیرِ خودش معامله می‌کند. در شرایطِ مرجعِ «آنی» دراودانِ کل به‌صورتِ ۵٪ شناور است، سپس وقتی حساب ۵٪ سود کرد در نقطهٔ سربه‌سر قفل می‌شود، و پس از برداشت هم بازنشانی نمی‌شود. این شکل خودداریِ اولیه را پاداش می‌دهد و غریزهٔ حجم‌افزایی بعد از یک دورهٔ خوب را تنبیه می‌کند.'
          )
        },
        {
          type: 'table',
          caption: text('Three boundaries on a 10,000 account, in money', 'سه مرز روی حساب ۱۰٬۰۰۰، به پول'),
          head: [text('Boundary', 'مرز'), text('Rule', 'قاعده'), text('Distance in money', 'فاصله به پول'), text('Moves when equity rises', 'با رشد ارزش خالص')],
          rows: [
            [text('Daily loss', 'ضرر روزانه'), text('5% Standard', '۵٪ استاندارد'), text('500 from the day-start reference', '۵۰۰ از مبنای ابتدای روز'), text('reference resets at 00:00 UTC+3', 'مبنا ساعت ۰۰:۰۰ به وقت UTC+3 بازنشانی می‌شود')],
            [text('Daily loss', 'ضرر روزانه'), text('3% Instant', '۳٪ آنی'), text('300 from the day-start reference', '۳۰۰ از مبنای ابتدای روز'), text('same reset, tighter line', 'بازنشانیِ یکسان، خطِ تنگ‌تر')],
            [text('Total loss', 'ضرر کل'), text('10% static', '۱۰٪ ثابت'), text('1,000 below the starting size', '۱٬۰۰۰ زیرِ اندازهٔ شروع'), text('never', 'هرگز')],
            [text('Total loss', 'ضرر کل'), text('5% trailing', '۵٪ شناور'), text('500 below the best recorded equity', '۵۰۰ زیرِ بهترین ارزشِ خالصِ ثبت‌شده'), text('always upward, then locks at breakeven', 'همیشه به بالا، سپس قفل در سربه‌سر')],
          ]
        },
        { type: 'h2', text: text('Costs you are actually modelling', 'هزینه‌هایی که واقعاً مدل می‌کنی') },
        {
          type: 'p',
          text: text(
            'Friction has to be subtracted before a day looks acceptable, so it is worth being precise about which numbers are whose. The simulated trading environment in this release uses documented simulation values - a 0.035% taker setting, a 0.05% maker setting, a 0.012% funding setting and a spread of 0.005% to 0.02% depending on the market. Those describe the simulator, not a venue’s price list, and they are not commercial fees.',
            'اصطکاک باید پیش از قابل‌قبول شدنِ یک روز کم شود، پس ارزش دارد دقیق باشی که این اعداد متعلق به چه چیزی‌اند. محیطِ معاملاتیِ شبیه‌سازی‌شدهٔ این نسخه از مقادیرِ مستندِ شبیه‌سازی استفاده می‌کند: ۰٫۰۳۵٪ برای taker، ۰٫۰۵٪ برای maker، ۰٫۰۱۲٪ برای funding و اسپرد ۰٫۰۰۵٪ تا ۰٫۰۲٪ بسته به بازار. این‌ها شبیه‌ساز را توصیف می‌کنند، نه تعرفهٔ یک صرافی، و کارمزدِ تجاری نیستند.'
          )
        },
        {
          type: 'note',
          text: text(
            'The simulated demo is the only trading environment active today: one free_demo account per user, 100,000 virtual DAI allocated once, priced from live Gains Network mark prices, with no deposits, withdrawals, refills or resets. Demo activity does not create a right to capital, a reward share or a withdrawal, and passing demo trading does not establish eligibility for a funded account. News-trading and weekend rules for funded stages, the scaling plan and the reset and appeal process are not finalized; the exact funded-stage conditions follow the final versioned agreement to be published before launch.',
            'دموی شبیه‌سازی‌شده تنها محیطِ معاملاتیِ فعالِ امروز است: یک حساب free_demo برای هر کاربر، ۱۰۰٬۰۰۰ دای مجازی که یک‌بار تخصیص می‌یابد، قیمت‌گذاری از مارک پرایسِ زندهٔ Gains Network، بدون واریز، برداشت، شارژِ مجدد یا بازنشانی. فعالیتِ دمو حقِ سرمایه، سهمِ پاداش یا برداشت ایجاد نمی‌کند و قبولی در معاملهٔ دمو واجدِ شرایط شدن برای حساب فاندشده را اثبات نمی‌کند. قواعدِ معاملهٔ خبری و آخرِ هفته برای مرحلهٔ فاندشده، طرحِ scaling و فرایندِ بازنشانی و اعتراض نهایی نشده‌اند؛ شرایطِ دقیقِ مرحلهٔ فاندشده تابعِ قراردادِ نهاییِ نسخه‌داری است که پیش از عرضه منتشر می‌شود.'
          )
        },
        { type: 'h2', text: text('A routine that survives contact with the limits', 'روتینی که در برخورد با سقف‌ها دوام می‌آورد') },
        {
          type: 'ol',
          items: [
            text('Write the day’s allowance in money before the first order, using the higher day-start reference.', 'بودجهٔ روز را به پول پیش از اولین سفارش بنویس، با مبنایِ بزرگ‌ترِ ابتدای روز.'),
            text('Divide it by the number of attempts you genuinely intend, then stop at that count.', 'بر تعدادِ تلاش‌هایی که واقعاً قصدش را داری تقسیمش کن و روی همان عدد بایست.'),
            text('Check the trailing or static total remaining after the worst day your plan allows.', 'باقی‌ماندهٔ سقفِ کل — شناور یا ثابت — را پس از بدترین روزِ مجازِ برنامه‌ات بررسی کن.'),
            text('Re-read the payout conditions weekly, since they decide what a good month is worth.', 'شرایطِ برداشت را هفتگی بازخوانی کن، چون مشخص می‌کنند یک ماهِ خوب چقدر می‌ارزد.'),
          ]
        },
        {
          type: 'p',
          text: text(
            'That is the whole discipline of the stage: treat the boundary as the fixed quantity and the strategy as the adjustable one. This path has never claimed that any method is profitable, and it does not start now - it only shows where the rules bite, so you can decide what you are willing to trade inside them.',
            'نظمِ کلِ این مرحله همین است: مرز را مقدارِ ثابت بدان و راهبرد را مقدارِ قابل تنظیم. این مسیر هرگز ادعا نکرده روشی سودآور است و الان هم ادعا نمی‌کند — فقط نشان می‌دهد کجاها قواعد دندان دارند، تا خودت تصمیم بگیری داخلِ آن چارچوب حاضر به معاملهٔ چه چیزی هستی.'
          )
        },
      ]
    },
  ]
}
