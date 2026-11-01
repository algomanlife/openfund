import { text, type Localized } from '../../features/information/content'

/** Canonical legal seed (landing legal section). Seeded into `legal_documents`.
 *  NOT imported by the app at runtime — the page renders from Directus. */
export interface LegalSeed { docType: string; title: Localized; paragraphs: Localized[] }
export const legalSeed: LegalSeed[] = [
  {
    docType: 'overview',
    title: text('Important information & disclaimer', 'اطلاعات مهم و سلب مسئولیت'),
    paragraphs: [
      text('Last updated: November 2026 — the complete terms live in the Openfund documents.', 'آخرین به‌روزرسانی: نوامبر ۲۰۲۶ — شرایط کامل در اسناد اوپن‌فاند.'),
    ],
  },
  {
    docType: 'simulated-environment',
    title: text('Simulated trading environment', 'محیط معاملاتی شبیه‌سازی‌شده'),
    paragraphs: [
      text('Accounts in this model are demo accounts operating exclusively in a simulated trading environment. No actual trades are executed in live financial markets through these accounts. Services are for educational and evaluation purposes.', 'حساب‌های معرفی‌شده در این مدل، حساب‌های آزمایشی در محیط معاملاتی شبیه‌سازی‌شده‌اند. در این حساب‌ها معاملهٔ واقعی در بازارهای مالی انجام نمی‌شود. هدف این خدمات، آموزش و ارزیابی عملکرد است.'),
    ],
  },
  {
    docType: 'no-investment-services',
    title: text('No investment services', 'عدم ارائهٔ خدمات سرمایه‌گذاری'),
    paragraphs: [
      text('Openfund content is for general information only. Openfund does not provide investment advice, solicit or recommend buying or selling financial instruments, securities or funds, or act as a broker, custodian or financial intermediary on this website.', 'محتوای اوپن‌فاند صرفاً برای اطلاع‌رسانی عمومی است. اوپن‌فاند مشاورهٔ سرمایه‌گذاری ارائه نمی‌کند، خرید یا فروش ابزار مالی، اوراق بهادار یا صندوقی را توصیه یا درخواست نمی‌کند و در این وب‌سایت به‌عنوان کارگزار، متولی دارایی یا واسطهٔ مالی فعالیت نمی‌کند.'),
      text('Participation is voluntary. Program fees are service fees, not deposits, client funds or investments. They do not generate interest, returns or an entitlement to profit sharing. In the proposed model, fees are non-refundable except where required by law or specified in final terms.', 'مشارکت در برنامه‌ها داوطلبانه است. مبالغ پرداختی، هزینهٔ خدمات‌اند؛ سپرده، وجوه مشتری یا سرمایه‌گذاری محسوب نمی‌شوند و سود، بهره یا حق مشارکت در درآمد ایجاد نمی‌کنند. در مدل پیشنهادی، این هزینه‌ها پس از پرداخت قابل استرداد نیستند، مگر در موارد الزام قانون یا استثناهای مقرر در شرایط نهایی.'),
      text('Program fees support operational and administrative costs, including staffing, technology infrastructure, platform development and maintenance, software licensing, risk-management systems and support. Payment does not create fiduciary duties, a custodial relationship or an investment arrangement. It provides access only to simulated evaluations and related services.', 'هزینهٔ برنامه‌ها برای مخارج عملیاتی و اداری، از جمله نیروی انسانی، زیرساخت فناوری، توسعه و نگهداری پلتفرم، مجوز نرم‌افزار، سامانه‌های مدیریت ریسک، پشتیبانی و سایر هزینه‌های کسب‌وکار صرف می‌شود. پرداخت هزینه، رابطهٔ امانی، نگهداری دارایی یا قرارداد سرمایه‌گذاری ایجاد نمی‌کند و صرفاً دسترسی به ارزیابی شبیه‌سازی‌شده و خدمات مرتبط را فراهم می‌سازد.'),
      text('Nothing on this site or in these programs is an offer to buy or sell futures, options, CFDs, forex, stocks or other financial instruments. Evaluation results are simulated. Past simulated performance does not necessarily indicate future results.', 'هیچ‌یک از مطالب این وب‌سایت یا برنامه‌ها، پیشنهاد خرید یا فروش قراردادهای آتی، اختیار معامله، CFD، فارکس، سهام یا سایر ابزارهای مالی نیست. نتایج ارزیابی بر عملکرد شبیه‌سازی‌شده استوارند و عملکرد گذشته لزوماً نشان‌دهندهٔ نتایج آینده نیست.'),
    ],
  },
  {
    docType: 'general-risk',
    title: text('General risk warning', 'هشدار عمومی ریسک'),
    paragraphs: [
      text('Trading involves substantial risk of loss. Even in simulation, leveraged strategies may produce results that differ from real-world execution. Consider your objectives, experience and risk tolerance before participating.', 'معامله در بازارهای مالی با خطر قابل توجه زیان همراه است. حتی در محیط شبیه‌سازی‌شده، نتیجهٔ راهبردهای اهرمی ممکن است با اجرای واقعی متفاوت باشد. پیش از مشارکت، اهداف، تجربه و تحمل ریسک خود را بررسی کنید.'),
    ],
  },
  {
    docType: 'corporate',
    title: text('Corporate information & availability', 'اطلاعات شرکتی و دسترسی به خدمات'),
    paragraphs: [
      text('Openfund’s registration details, service entity, verification requirements and geographic restrictions are not finalized and will be announced before launch. No other company’s license, registration number or address is attributed to Openfund.', 'اطلاعات ثبت، شخصیت حقوقی ارائه‌دهنده، شرایط احراز هویت و محدودیت‌های جغرافیایی اوپن‌فاند هنوز نهایی نشده‌اند و پیش از ارائهٔ خدمات اعلام خواهند شد. مجوز، شمارهٔ ثبت یا نشانی شرکت دیگری به اوپن‌فاند نسبت داده نمی‌شود.'),
    ],
  },
  {
    docType: 'offices',
    title: text('Office locations', 'محل دفاتر'),
    paragraphs: [
      text('Iran — Fars, Shiraz, Arm Boulevard, Naron Street, between Naron and Khakshanasi', 'ایران — فارس — شیراز، بلوار ارم، خیابان نارون، بین نارون و خاکشانسی'),
      text('United States — 525 Brannan St., Suite 300, San Francisco, CA 94107', 'ایالات متحده — سان‌فرانسیسکو، خیابان برنان ۵۲۵، سوئیت ۳۰۰، کد پستی ۹۴۱۰۷'),
      text('This release is hosted on Sites; Render is shown as the project’s intended infrastructure provider.', 'میزبانی این نسخه در Sites انجام می‌شود؛ ذکر Render در بخش زیرساخت، معرفی زیرساخت مدنظر پروژه است.'),
    ],
  },
]
