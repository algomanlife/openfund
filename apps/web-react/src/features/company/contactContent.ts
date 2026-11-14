/* ============================================================
   Contact Us & Support — editorial copy (English / Persian source).
   Department mailboxes are NOT written here: they come from Directus
   (site_settings.*_email) and are shown only when the owner has entered
   a verified address. The office location is the owner-provided
   address; the map pin is street-level (see SHIRAZ_LOCATION).
   ============================================================ */
import { text } from '../information/content'

export const contactMeta = {
  title: text('Contact Openfund', 'تماس با اوپن‌فاند'),
  description: text(
    'Contact Openfund customer support, legal, technical and community teams, send a tracked support request and find help on purchases, payments, rules and rewards.',
    'تماس با پشتیبانی مشتریان، واحد حقوقی، فنی و ارتباط با جامعهٔ اوپن‌فاند، ثبت درخواست پشتیبانی با شمارهٔ پیگیری و راهنمای خرید، پرداخت، قوانین و پاداش.'),
}

export const contactHero = {
  eyebrow: text('Contact & support', 'تماس و پشتیبانی'),
  title: text('Talk to a person', 'با یک انسان صحبت کن'),
  accent: text('who can see the same rules you do.', 'که همان قوانینی را می‌بیند که تو می‌بینی.'),
  intro: text(
    'Choose the team that fits your question, or send a request below. Every request receives a reference number so it can be followed up.',
    'تیمی را که با سؤالت جور است انتخاب کن یا از فرم زیر درخواست بفرست. هر درخواست یک شمارهٔ پیگیری می‌گیرد تا بتوان آن را دنبال کرد.'),
  safety: text(
    'Openfund will never ask for your seed phrase, private key or wallet password. Never share them with anyone, including people who say they are Openfund staff.',
    'اوپن‌فاند هرگز عبارت بازیابی، کلید خصوصی یا رمز کیف پولت را نمی‌خواهد. آن‌ها را با هیچ‌کس، حتی کسی که خود را کارمند اوپن‌فاند معرفی می‌کند، در میان نگذار.'),
}

export const departments = [
  {
    key: 'support' as const, icon: 'support',
    title: text('Customer Support', 'پشتیبانی مشتریان'),
    body: text('Account access, wallet connections, challenge purchases, payments, invoices, challenge activation and general help.', 'دسترسی به حساب، اتصال کیف پول، خرید چلنج، پرداخت، فاکتور، فعال‌سازی چلنج و راهنمایی عمومی.'),
  },
  {
    key: 'legal' as const, icon: 'legal',
    title: text('Legal Department', 'واحد حقوقی'),
    body: text('Legal inquiries, terms and policies, privacy requests, formal correspondence and compliance questions.', 'پرسش‌های حقوقی، شرایط و سیاست‌ها، درخواست‌های حریم خصوصی، مکاتبات رسمی و پرسش‌های انطباق.'),
  },
  {
    key: 'technical' as const, icon: 'technical',
    title: text('Technical Department', 'واحد فنی'),
    body: text('Platform bugs, trading terminal issues, chart errors, API or market-data incidents and technical troubleshooting.', 'اشکالات پلتفرم، مشکلات ترمینال معاملاتی، خطاهای چارت، رخدادهای API یا دادهٔ بازار و عیب‌یابی فنی.'),
  },
  {
    key: 'community' as const, icon: 'community',
    title: text('Community Relations', 'ارتباط با جامعه'),
    body: text('Community proposals, partnerships, ambassador inquiries, collaboration requests and community feedback.', 'پیشنهادهای جامعه، همکاری‌ها، پرسش‌های سفیران، درخواست همکاری و بازخورد جامعه.'),
  },
]

export const contactUi = {
  departmentsTitle: text('Choose a team', 'یک تیم را انتخاب کن'),
  emailPending: text('Email address not published yet — please use the form below.', 'نشانی ایمیل هنوز منتشر نشده است — لطفاً از فرم زیر استفاده کن.'),
  copy: text('Copy', 'کپی'),
  copied: text('Copied', 'کپی شد'),
  copyLabel: text('Copy email address', 'کپی نشانی ایمیل'),
  writeTo: text('Write to this team', 'نوشتن به این تیم'),
  telegramTitle: text('Telegram community', 'جامعهٔ تلگرام'),
  telegramBody: text('Talk with other traders and follow announcements in the official Openfund Telegram community. Do not share account or payment details in public chats.', 'با معامله‌گران دیگر گفت‌وگو کن و اطلاعیه‌ها را در جامعهٔ رسمی تلگرام اوپن‌فاند دنبال کن. جزئیات حساب یا پرداخت را در گفت‌وگوهای عمومی منتشر نکن.'),
  telegramCta: text('Open Telegram', 'باز کردن تلگرام'),
}

export const formCopy = {
  title: text('Send a support request', 'ارسال درخواست پشتیبانی'),
  intro: text('We store your request securely and reply by email. Fields marked * are required.', 'درخواستت به‌صورت امن ذخیره می‌شود و از طریق ایمیل پاسخ می‌دهیم. فیلدهای ستاره‌دار الزامی‌اند.'),
  name: text('Full name', 'نام و نام خانوادگی'),
  email: text('Email address', 'نشانی ایمیل'),
  department: text('Department', 'واحد'),
  subject: text('Subject', 'موضوع'),
  message: text('Message', 'پیام'),
  orderId: text('Order ID (optional)', 'شناسهٔ سفارش (اختیاری)'),
  challengeId: text('Challenge ID (optional)', 'شناسهٔ چلنج (اختیاری)'),
  idHint: text('Letters, digits, “-” and “_” only. Never paste a private key or seed phrase.', 'فقط حروف، اعداد، «-» و «_». هرگز کلید خصوصی یا عبارت بازیابی را وارد نکن.'),
  consentBefore: text('I agree that Openfund may store and use this information to answer my request, as described in the', 'موافقم اوپن‌فاند این اطلاعات را برای پاسخ به درخواستم ذخیره و استفاده کند، همان‌طور که در'),
  consentLink: text('legal information', 'اطلاعات حقوقی'),
  consentAfter: text('.', ' توضیح داده شده است.'),
  submit: text('Send request', 'ارسال درخواست'),
  sending: text('Sending…', 'در حال ارسال…'),
  successTitle: text('Request received', 'درخواست دریافت شد'),
  successBody: text('Your reference number is below. Keep it for follow-up; our team replies by email. We do not send automatic confirmation emails yet.', 'شمارهٔ پیگیری‌ات در زیر آمده است. آن را برای پیگیری نگه دار؛ تیم ما از طریق ایمیل پاسخ می‌دهد. فعلاً ایمیل تأیید خودکار ارسال نمی‌کنیم.'),
  reference: text('Reference', 'شمارهٔ پیگیری'),
  another: text('Send another request', 'ارسال درخواست دیگر'),
  charCount: text('characters', 'نویسه'),
}

/** Field and server error messages (keys match apps/backend/support.js). */
export const formErrors = {
  required: text('This field is required.', 'این فیلد الزامی است.'),
  too_short: text('This is too short.', 'این مقدار خیلی کوتاه است.'),
  too_long: text('This is too long.', 'این مقدار خیلی طولانی است.'),
  invalid_email: text('Enter a valid email address.', 'یک نشانی ایمیل معتبر وارد کن.'),
  invalid_department: text('Choose a department.', 'یک واحد را انتخاب کن.'),
  invalid_reference: text('Use letters, digits, “-” or “_” only.', 'فقط از حروف، اعداد، «-» یا «_» استفاده کن.'),
  consent_required: text('Please accept to continue.', 'برای ادامه لطفاً موافقت کن.'),
  too_fast: text('Please take a moment to review your request and send it again.', 'لطفاً لحظه‌ای درخواستت را مرور کن و دوباره بفرست.'),
  duplicate_submission: text('This request was already received.', 'این درخواست قبلاً دریافت شده است.'),
  rate_limited: text('Too many requests. Please try again later.', 'درخواست‌ها بیش از حد مجاز است. لطفاً بعداً دوباره تلاش کن.'),
  network: text('The request could not be sent. Check your connection and try again.', 'ارسال درخواست ممکن نشد. اتصال را بررسی کن و دوباره تلاش کن.'),
  generic: text('The request could not be sent. Please try again.', 'ارسال درخواست ممکن نشد. لطفاً دوباره تلاش کن.'),
}

export const locationCopy = {
  title: text('Where we are', 'کجا هستیم'),
  addressLabel: text('Office address', 'نشانی دفتر'),
  address: text('Alley 13, Daneshamooz Street (between Mehr and Motahari), Shiraz, Fars Province, Iran', 'ایران، استان فارس، شیراز، خیابان دانش‌آموز، بین مهر و مطهری، کوچهٔ ۱۳'),
  approx: text('The pin marks Daneshamooz Street at Mehr Boulevard (street level, from OpenStreetMap). The office is in Alley 13 nearby.', 'نشانگر، تقاطع خیابان دانش‌آموز و بلوار مهر را نشان می‌دهد (در سطح خیابان، از OpenStreetMap). دفتر در کوچهٔ ۱۳ همین محدوده است.'),
  visits: text('Visits by appointment only — please contact us first.', 'مراجعه فقط با هماهنگی قبلی — لطفاً ابتدا با ما تماس بگیر.'),
  openOsm: text('Open in OpenStreetMap', 'باز کردن در OpenStreetMap'),
  openGoogle: text('Open in Google Maps', 'باز کردن در Google Maps'),
  mapLabel: text('Stylised map of the Openfund office area in Shiraz', 'نقشهٔ طراحی‌شدهٔ محدودهٔ دفتر اوپن‌فاند در شیراز'),
  credit: text('Street-level location: © OpenStreetMap contributors. Illustration not to scale.', 'موقعیت در سطح خیابان: © مشارکت‌کنندگان OpenStreetMap. تصویر بدون مقیاس است.'),
  city: text('Shiraz', 'شیراز'),
  street: text('Daneshamooz St.', 'خ. دانش‌آموز'),
  boulevard: text('Mehr Blvd.', 'بلوار مهر'),
}

export const helpCopy = {
  title: text('Quick help', 'راهنمای سریع'),
  intro: text('Many answers are already published. These pages are the fastest route.', 'پاسخ بسیاری از پرسش‌ها از قبل منتشر شده است. این صفحه‌ها سریع‌ترین مسیرند.'),
  pending: text('Pending legal publication', 'در انتظار انتشار حقوقی'),
  links: {
    rulebook: text('Rulebook', 'قوانین'),
    faq: text('FAQ', 'پرسش‌های متداول'),
    plans: text('Challenge plans', 'پلن‌های چلنج'),
    purchase: text('Purchase help', 'راهنمای خرید'),
    payment: text('Payment help', 'راهنمای پرداخت'),
    withdrawal: text('Reward & withdrawal policy', 'سیاست پاداش و برداشت'),
    legal: text('Legal information & disclaimers', 'اطلاعات حقوقی و سلب مسئولیت'),
    terms: text('Terms of Service', 'شرایط استفاده از خدمات'),
    privacy: text('Privacy Policy', 'سیاست حریم خصوصی'),
    refund: text('Refund Policy', 'سیاست بازپرداخت'),
    about: text('About Openfund', 'دربارهٔ اوپن‌فاند'),
  },
}

/** Street-level point verified in OpenStreetMap on 2026-11-13: the shared node
 *  of Daneshamooz Street (way 1551979654) and Mehr Boulevard (way 80735880).
 *  Alley 13 itself is not mapped in OpenStreetMap; the exact office pin
 *  needs owner confirmation before it replaces this point. */
export const SHIRAZ_LOCATION = { lat: 29.64901, lon: 52.49664, zoom: 17 }
