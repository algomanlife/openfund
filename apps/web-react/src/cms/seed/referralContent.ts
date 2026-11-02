import { text } from '../../features/information/content'
import type { FaqItemContent, ReferralContent } from '../contentTypes'

/**
 * Growth Partner / Referral page copy.
 *
 * The program is PRE-LAUNCH. A repository audit found no referral tables, no
 * routes, no agreement and no approved commercial terms, so this copy promises
 * no percentage, no reward amount and no payout schedule. What is described as
 * live is only what the backend actually does: an invite code, a shareable
 * link and server-side attribution of the accounts created through it.
 *
 * Seeded into the `referral_content` Directus singleton; the `program_state`
 * column (prelaunch / live) is what flips the status notice when the owner
 * approves the reward terms.
 */
export const referralFaq: FaqItemContent[] = [
  {
    key: 'partner-1', category: 'referrals', sort: 1,
    question: text('Is the Growth Partner program live today?', 'آیا برنامهٔ همیاری همین حالا فعال است؟'),
    answer: text(
      'Partly. Sharing your link and tracking the accounts created through it works today; the reward side is not approved yet, so nothing pays out and no percentage is published.',
      'قسمت اول بله. هم‌اکنون می‌توانی لینکت را به اشتراک بگذاری و حساب‌هایی که از طریق آن ساخته می‌شوند را ببینی؛ ولی سمت پاداش هنوز تصویب نشده، پس هیچ پرداختی انجام نمی‌شود و درصدی منتشر نشده است.'
    ),
  },
  {
    key: 'partner-2', category: 'referrals', sort: 2,
    question: text('How do I get my referral link?', 'لینک معرفی من از کجا می‌آید؟'),
    answer: text(
      'Sign in with your wallet and open your referral dashboard. Your personal code and the full link are generated there and you can copy either one.',
      'با کیف پول وارد شو و داشبورد معرفی را باز کن. کد اختصاصی تو و لینک کامل همان‌جا ساخته می‌شود و می‌توانی هر کدام را کپی کنی.'
    ),
  },
  {
    key: 'partner-3', category: 'referrals', sort: 3,
    question: text('What actually counts as a referral?', 'دقیقاً چه چیزی معرفی حساب می‌شود؟'),
    answer: text(
      'An account created while your code is attached to the visit. Opening the page, clicking a link or browsing does not count; the attribution is written by the server at account creation.',
      'حسابی که هنگام ساخت، کد تو به بازدید متصل بوده باشد. بازکردن صفحه، کلیک روی لینک یا مرور سایت حساب نمی‌شود؛ ثبت انتساب سمت سرویس و در لحظهٔ ساخت حساب انجام می‌شود.'
    ),
  },
  {
    key: 'partner-4', category: 'referrals', sort: 4,
    question: text('Does joining or being referred cost anything?', 'شرکت در این برنامه یا معرفی شدن هزینه دارد؟'),
    answer: text(
      'No. There is no fee to take part and no charge to the trader you refer. Your friend gets exactly the same published terms as anyone who arrives without a link.',
      'نه. شرکت هزینه ندارد و برای کسی که معرفی می‌کنی هم چیزی اضافه نمی‌شود. او دقیقاً همان شرایط منتشرشده‌ای را دارد که یک کاربر بدون لینک دریافت می‌کند.'
    ),
  },
  {
    key: 'partner-5', category: 'referrals', sort: 5,
    question: text('When will the rewards be announced?', 'پاداش‌ها کی اعلام می‌شوند؟'),
    answer: text(
      'When the business terms behind them are approved. Before launch we will publish the reward model, what qualifies a referral, the attribution window and the settlement method as a written agreement.',
      'وقتی اصطلاحات تجاری پشت آن تصویب شود. پیش از عرضه، مدل پاداش، رویداد واجدشرایط، پنجرهٔ انتساب و روش تسویه به‌صورت یک قرارداد کتبی منتشر می‌شود.'
    ),
  },
  {
    key: 'partner-6', category: 'referrals', sort: 6,
    question: text('Can I refer myself, or use a second wallet?', 'می‌توانم خودم را معرفی کنم یا کیف پول دوم بسازم؟'),
    answer: text(
      'No. Attribution is recorded against a wallet identity, a wallet cannot be referred by its own code, and one account can be attributed only once. Attempts to manufacture referrals can void the attribution.',
      'نه. انتساب روی هویت کیف پول ثبت می‌شود، یک کیف پول با کد خودش قابل انتساب نیست و هر حساب فقط یک‌بار منسوب می‌شود. تلاش برای ساختن معرفی مصنوعی می‌تواند انتساب را باطل کند.'
    ),
  },
]

export const referralContent: ReferralContent = {
  hero: {
    eyebrow: text('Growth Partner', 'همیار رشد'),
    title: text('Bring the traders', 'کسانی را بیاور که'),
    accent: text('who take the craft seriously', 'جدی با مهارت رفتار می‌کنند'),
    intro: text(
      'Openfund grows by people who use it recommending it to people who want to use it properly. Your link is tracked honestly, and what it earns is published before it goes live.',
      'اوپن‌فاند با کسانی بزرگ می‌شود که واقعاً ازش استفاده می‌کنند و آن را به آدم‌های جدی معرفی می‌کنند. لینک تو درست پیگیری می‌شود و آنچه برایت می‌سازد، پیش از فعال شدن منتشر خواهد شد.'
    ),
  },
  statusNotice: text(
    'This program is in pre-launch: attribution works today, reward terms are not approved yet and nothing is payable. No commission figure on this page should be read as an offer.',
    'این برنامه پیش‌ازعرضه است: انتساب امروز کار می‌کند، ولی شرایط پاداش تصویب نشده و هیچ قابل‌پرداختی وجود ندارد. هیچ رقم پورسانتی در این صفحه نباید پیشنهاد خوانده شود.'
  ),
  benefits: [
    {
      icon: 'link',
      title: text('Your own link, in one click', 'لینک اختصاصی تو، با یک کلیک'),
      text: text(
        'A stable personal code that you can copy as a link or as text, usable anywhere you would naturally mention the product.',
        'کد شخصی ثابتی که می‌توانی به‌شکل لینک یا متن کپی کنی؛ هر جا که طبیعی باشد نام محصول را ببری.'
      ),
    },
    {
      icon: 'chart',
      title: text('Attribution you can verify', 'انتسابی که قابل راستی‌آزمایی است'),
      text: text(
        'Your dashboard shows the accounts created through your code, recorded by the server at sign-up — not estimated from cookies or clicks.',
        'داشبوردت حساب‌هایی را نشان می‌دهد که در لحظهٔ ورود، سمت سرویس و با کد تو ساخته شده‌اند؛ نه تخمینی از کوکی یا کلیک.'
      ),
    },
    {
      icon: 'shield',
      title: text('Same terms for the referred trader', 'همان شرایط برای کسی که معرفی می‌کنی'),
      text: text(
        'A person arriving through your link gets exactly the published product terms. No discount codes, no special tier, no hidden markup.',
        'کسی که با لینک تو می‌رسد دقیقاً همان شرایط منتشرشدهٔ محصول را می‌گیرد؛ بدون کد تخفیف، بدون سطح ویژه و بدون هزینهٔ پنهان.'
      ),
    },
    {
      icon: 'school',
      title: text('Education to point people at', 'محتوای آموزشی برای راهنمایی'),
      text: text(
        'The Learning Center and the Tools Center exist so a recommendation can come with real help, not a slogan you have to invent.',
        'مرکز آموزش و مرکز ابزارها هستند تا معرفی تو با کمک واقعی همراه باشد، نه با شعاری که خودت باید بسازی.'
      ),
    },
    {
      icon: 'handshake',
      title: text('No cost, no obligation', 'بدون هزینه، بدون تعهد'),
      text: text(
        'Taking part is free, referring is free, and nothing you say creates a contractual offer on Openfund’s behalf before the agreement is published.',
        'شرکت رایگان است، معرفی رایگان است و هیچ جمله‌ای از تو پیش از انتشار قرارداد، تعهد قراردادی از طرف اوپن‌فاند نمی‌سازد.'
      ),
    },
  ],
  stages: [
    {
      title: text('Share your link', 'لینکت را به اشتراک بگذار'),
      text: text(
        'Copy your code or link from the dashboard and use it where you already talk about trading.',
        'کد یا لینکت را از داشبورد کپی کن و همان‌جا استفاده کن که امروز دربارهٔ معامله‌گری حرف می‌زنی.'
      ),
    },
    {
      title: text('They open an account', 'او حساب باز می‌کند'),
      text: text(
        'The visitor connects a wallet and signs in; while your code is still attached, the server records the attribution once.',
        'بازدیدکننده کیف پول را متصل و وارد می‌شود؛ تا وقتی کد تو روی بازدید باقی است، سرویس انتساب را یک‌بار ثبت می‌کند.'
      ),
    },
    {
      title: text('They explore the terminal', 'ترمینال را می‌شناسد'),
      text: text(
        'Markets, the rulebook, the tools and the learning paths are the honest thing to point at — no promise of profit required.',
        'بازارها، رول‌بوک، ابزارها و مسیرهای یادگیری چیزهای درستی‌اند که می‌توانی نشان بدهی؛ بدون نیاز به وعدهٔ سود.'
      ),
    },
    {
      title: text('You see it in your dashboard', 'در داشبورد خودت می‌بینی'),
      text: text(
        'Your code, your link, the number of accounts attributed to you and the status of each attribution, from server data.',
        'کد تو، لینک تو، تعداد حساب‌های منسوب‌شده و وضعیت هر انتساب؛ همه از دادهٔ سمت سرویس.'
      ),
    },
    {
      title: text('Rewards come with the agreement', 'پاداش با قرارداد می‌آید'),
      text: text(
        'When the program terms are approved, the reward model, the qualifying event and the settlement method are published here before anything accrues.',
        'وقتی شرایط برنامه تصویب شود، مدل پاداش، رویداد واجدشرایط و روش تسویه، پیش از هرگونه محاسبه همین‌جا منتشر می‌شود.'
      ),
    },
  ],
  sections: [
    {
      key: 'program',
      title: text('What the program is meant to be', 'این برنامه قرار است چه باشد'),
      body: [
        text(
          'Openfund is a product people explain to each other: a terminal with live market data, published rules and calculators that do not oversell. The Growth Partner program is the formal version of that conversation.',
          'اوپن‌فاند محصولی است که آدم‌ها آن را برای هم توضیح می‌دهند: یک ترمینال با دادهٔ زندهٔ بازار، قوانین منتشرشده و ابزارهایی که اغراق نمی‌کنند. برنامهٔ همیار رشد، شکل رسمی همان گفت‌وگو است.'
        ),
        text(
          'It is deliberately built in two parts. The first part — identity, link, attribution, visibility — is engineering and is being finished now. The second part — what a partner earns — is a business decision that has not been made yet.',
          'عمداً در دو بخش ساخته شده است. بخش اول — هویت، لینک، انتساب و دیده‌شدن — مهندسی است و الان در حال اتمام است. بخش دوم — اینکه همیار چه به دست می‌آورد — یک تصمیم تجاری است که هنوز گرفته نشده.'
        ),
      ],
      items: [
        text('Attribution that is recorded, not assumed', 'انتساب ثبت‌شده، نه فرضی'),
        text('A public page that says what is not decided', 'صفحه‌ای که می‌گوید چه چیزی هنوز تصمیم نشده'),
        text('No pressure on the person being referred', 'بدون فشار روی کسی که معرفی می‌شود'),
      ],
    },
    {
      key: 'attribution',
      title: text('How attribution is recorded', 'انتساب چگونه ثبت می‌شود'),
      body: [
        text(
          'A visit is not a referral. Your code is attached to the browser session, and only when a new account is created through that session does the server write an attribution row, tied to the wallet identity that signed in.',
          'یک بازدید، معرفی نیست. کد تو روی نشست مرورگر قرار می‌گیرد و فقط وقتی حساب تازه‌ای از همان نشست ساخته شود، سرویس یک رکورد انتساب می‌نویسد که به هویت کیف پولِ واردشده گره خورده است.'
        ),
        text(
          'The rules are strict on purpose: a wallet cannot be attributed to its own code, one account can be attributed exactly once, and an account that already exists is never re-attributed later.',
          'قواعد عمداً سخت‌گیرانه‌اند: یک کیف پول با کد خودش منسوب نمی‌شود، هر حساب دقیقاً یک‌بار منسوب می‌شود، و حسابِ موجود هرگز بعداً به کس دیگری نسبت داده نمی‌شود.'
        ),
      ],
      note: text(
        'Attribution is stored server-side and served only to the partner who owns the code. It contains no personal data beyond the account identity itself.',
        'انتساب سمت سرویس نگهداری می‌شود و فقط به همان همیاری که کد مال اوست نشان داده می‌شود. جز هویت خودِ حساب، هیچ دادهٔ شخصی دیگری ندارد.'
      ),
    },
    {
      key: 'eligibility',
      title: text('Who can take part', 'چه کسی می‌تواند شرکت کند'),
      body: [
        text(
          'Any Openfund account in good standing can request its code from the referral dashboard. There is no application queue and no follower-count requirement.',
          'هر حساب اوپن‌فاند که در وضعیت مناسب باشد می‌تواند کدش را از داشبورد معرفی بگیرد. صف درخواست یا حداقل تعداد مخاطب وجود ندارد.'
        ),
        text(
          'What we cannot publish yet is a formal partner agreement. Until reward terms exist, this program is a sharing mechanism, not a contract for compensation.',
          'چیزی که هنوز نمی‌توانیم منتشر کنیم قرارداد همکاری رسمی است. تا وقتی شرایط پاداش وجود ندارد، این برنامه یک سازوکار اشتراک‌گذاری است، نه قرارداد جبران مالی.'
        ),
      ],
    },
    {
      key: 'rewards',
      title: text('Rewards: not decided yet', 'پاداش: هنوز تصمیم نگرفته‌ایم'),
      body: [
        text(
          'There is no commission rate, no reward balance, no tier ladder and no payout schedule to show you, because none of them has been approved. Any page that showed you a number today would be describing a product that does not exist.',
          'هیچ نرخ پورسانت، موجودی پاداش، نردبان سطح یا زمان‌بندی پرداخت برای نمایش وجود ندارد، چون هیچ‌کدام تصویب نشده‌اند. صفحه‌ای امروز عددی نشان بدهد، دارد محصولی را توصیف می‌کند که وجود ندارد.'
        ),
        text(
          'Before launch we will publish the reward model, the event that makes a referral qualify, the attribution window, how and when settlement happens, and the fraud policy — as one versioned document, and the dashboard will only show figures from that document.',
          'پیش از عرضه، مدل پاداش، رویداد واجدشرایط کردن یک معرفی، پنجرهٔ انتساب، چگونگی و زمان تسویه و سیاست تقلب را منتشر می‌کنیم — در یک سند نسخه‌دار؛ و داشبورد هم فقط عددهای همان سند را نشان خواهد داد.'
        ),
      ],
      items: [
        text('Reward model and rate', 'مدل پاداش و نرخ آن'),
        text('Qualifying event and attribution window', 'رویداد واجدشرایط و پنجرهٔ انتساب'),
        text('Settlement method, cycle and minimum', 'روش، چرخه و حداقل تسویه'),
        text('Caps, fraud policy and the written agreement', 'سقف‌ها، سیاست تقلب و قرارداد نوشتاری'),
      ],
      note: text(
        'If you see a percentage for Openfund anywhere before that document exists, it is not ours.',
        'اگر پیش از وجود آن سند جایی برای اوپن‌فاند درصدی دیدی، متعلق به ما نیست.'
      ),
    },
    {
      key: 'fairness',
      title: text('What we will not tolerate', 'چه چیزی را تحمل نمی‌کنیم'),
      body: [
        text(
          'Referral spam in other people’s spaces, claims about Openfund that the product does not support, invented profit promises, and coupon-reseller behaviour all damage the thing they are trying to sell.',
          'هرزنامهٔ معرفی در فضای دیگران، ادعاهایی که محصول از پسشان برنمی‌آید، وعدهٔ سودِ ساختگی و رفتار کدتخفیف‌فروش‌ها، همه به همان چیزی که قرار است بفروشند آسیب می‌زنند.'
        ),
        text(
          'Misleading attribution — self-referral, manufactured accounts, or describing planned features as available — can void the attribution and, once reward terms exist, exclude the account from the program.',
          'انتساب گمراه‌کننده — معرفی خود، حساب‌های ساختگی، یا جا زدن قابلیت‌های برنامه‌ریزی‌شده به‌جای موجود — می‌تواند انتساب را باطل کند و وقتی شرایط پاداش منتشر شد، حساب را از برنامه خارج کند.'
        ),
      ],
    },
  ],
  dashboard: {
    title: text('Your referral dashboard', 'داشبورد معرفی تو'),
    intro: text(
      'The dashboard reads only from your authenticated session. Everything marked live is implemented and shows real records; everything marked pending is a capability that does not exist yet and is displayed as unavailable rather than filled with sample numbers.',
      'داشبورد فقط از نشست احرازهویت‌شدهٔ تو می‌خواند. هرچه «فعال» علامت خورده پیاده‌سازی شده و رکورد واقعی نشان می‌دهد؛ هرچه «در انتظار» است قابلیت وجود ندارد و به‌صورت غیرقابل‌دسترس نمایش داده می‌شود، نه با عددهای نمونه پر می‌شود.'
    ),
    columns: [
      {
        state: 'live',
        title: text('Personal invite code', 'کد دعوت شخصی'),
        text: text('Generated once per wallet identity and stable over time.', 'یک‌بار برای هر هویت کیف پول ساخته می‌شود و ثابت می‌ماند.'),
      },
      {
        state: 'live',
        title: text('Shareable link with copy actions', 'لینک قابل اشتراک با دکمهٔ کپی'),
        text: text('The full URL that carries your code to the visiting session.', 'نشانی کاملی که کد تو را به نشست بازدیدکننده می‌رساند.'),
      },
      {
        state: 'live',
        title: text('Your own attribution status', 'وضعیت انتساب خودت'),
        text: text('Whether your account was created through someone else’s code.', 'که آیا حساب تو با کد شخص دیگری ساخته شده است یا نه.'),
      },
      {
        state: 'live',
        title: text('Accounts attributed to you', 'حساب‌های منسوب‌شده به تو'),
        text: text('A real count and a dated list, readable only by you.', 'عدد واقعی و فهرست تاریخ‌دار؛ فقط تو می‌توانی ببینی.'),
      },
      {
        state: 'pending',
        title: text('Commission history', 'تاریخچهٔ پورسانت'),
        text: text('Requires approved reward terms; nothing is calculated today.', 'به شرایط پاداشِ تصویب‌شده نیاز دارد؛ امروز چیزی محاسبه نمی‌شود.'),
      },
      {
        state: 'pending',
        title: text('Reward balance', 'موجودی پاداش'),
        text: text('No balance exists while the program is pre-launch.', 'تا برنامه پیش‌ازعرضه است هیچ موجودی‌ای وجود ندارد.'),
      },
      {
        state: 'pending',
        title: text('Payout history and settlement', 'تاریخچهٔ پرداخت و تسویه'),
        text: text('Settlement method and cycle are still undecided.', 'روش و چرخهٔ تسویه هنوز تعیین نشده است.'),
      },
    ],
  },
  faq: referralFaq,
  pendingDecisions: [
    {
      title: text('Reward model and rate', 'مدل پاداش و نرخ آن'),
      text: text('Whether a partner earns a share of challenge fees, a flat amount per qualified account, or a non-monetary credit — undecided.', 'که همیار سهمی از هزینهٔ چلنج می‌گیرد، مبلغ ثابت به‌ازای هر حساب واجدشرایط، یا اعتبار غیرمالی — تصمیم گرفته نشده است.'),
    },
    {
      title: text('Qualifying event', 'رویداد واجدشرایط'),
      text: text('Sign-up alone, or only after the referred account starts real activity — this changes the entire economics.', 'فقط ثبت‌نام، یا پس از شروع فعالیت واقعی حسابِ معرفی‌شده؛ این انتخاب کل اقتصاد برنامه را عوض می‌کند.'),
    },
    {
      title: text('Attribution window', 'پنجرهٔ انتساب'),
      text: text('How long your code stays attached to a visit before the referral is no longer credited.', 'کد تو چه مدت روی یک بازدید باقی می‌ماند تا معرفی هنوز محسوب شود.'),
    },
    {
      title: text('Settlement method and cycle', 'روش و چرخهٔ تسویه'),
      text: text('Currency, network, minimum threshold, cadence and any fee — no rails are chosen or integrated.', 'واحد پول، شبکه، حداقل آستانه، دوره و کارمزد — هیچ بستر پرداختی انتخاب یا متصل نشده است.'),
    },
    {
      title: text('Fraud policy and caps', 'سیاست تقلب و سقف‌ها'),
      text: text('Rate limits per partner, what voids an attribution, the appeal path, and the written partner agreement itself.', 'محدودیت نرخ برای هر همیار، چه چیزی انتساب را باطل می‌کند، مسیر اعتراض و خودِ قرارداد نوشته‌شده.'),
    },
  ],
  cta: {
    title: text('Start with the link you already have', 'با همان لینکی که داری شروع کن'),
    text: text(
      'Open your dashboard with a wallet sign-in, copy your code, and send it to someone who will actually read the rulebook.',
      'داشبوردت را با یک ورود کیف پول باز کن، کدت را کپی کن و برای کسی بفرست که واقعاً رول‌بوک را می‌خواند.'
    ),
    primary: text('Open referral dashboard', 'باز کردن داشبورد معرفی'),
    secondary: text('Read the learning paths', 'مسیرهای یادگیری را بخوان'),
  },
}
