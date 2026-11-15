import { text } from '../information/content'

export const PRODUCT_ROADMAP = [
  {
    quarter: 1, start: '2026-11-15', end: '2027-02-14', category: 'operations',
    status: 'planned', approval: 'owner-defined', visibility: 'public', updated: '2026-11-15',
    title: text('Foundation and stabilization', 'زیرساخت و تثبیت'),
    body: text(
      'Stabilize the web terminal and Open Trade. Verify funded activation, manual payouts, IB accounting, treasury reconciliation and regional recovery. Target approximately 2,000 registered users by early 2027. Design privacy-preserving commitments for funded trading records.',
      'ترمینال وب و Open Trade را پایدار کنیم. فعال‌سازی حساب فاندد، پرداخت‌های دستی، حسابداری IB، تطبیق خزانه و بازیابی منطقه‌ای را راستی‌آزمایی کنیم. هدف اوایل ۲۰۲۷ حدود ۲٬۰۰۰ کاربر ثبت‌نام‌شده است. برای سوابق معاملات فاندد، سازوکار ثبت تعهد رمزنگاری‌شده با حفظ حریم خصوصی طراحی کنیم.',
    ),
    dependencies: text('Reconciled financial records, an operational support queue and agreed reliability thresholds.', 'سوابق مالی تطبیق‌یافته، صف عملیاتی پشتیبانی و آستانه‌های توافق‌شدهٔ پایداری.'),
  },
  {
    quarter: 2, start: '2027-02-15', end: '2027-05-14', category: 'growth',
    status: 'planned', approval: 'owner-defined', visibility: 'public', updated: '2026-11-15',
    title: text('Growth and operational maturity', 'رشد و بلوغ عملیاتی'),
    body: text(
      'Expand referral and ambassador programs, build measurable acquisition funnels and improve funded analytics, payout reconciliation and support service levels.',
      'برنامه‌های معرفی و سفیران را گسترش دهیم، مراحل جذب را قابل‌اندازه‌گیری کنیم و تحلیل حساب فاندد، تطبیق پرداخت و سطح خدمات پشتیبانی را بهبود دهیم.',
    ),
    dependencies: text('Stable payouts, regional continuity and reliable measurement from registration through verified payments.', 'پرداخت پایدار، تداوم خدمات منطقه‌ای و اندازه‌گیری معتبر از ثبت‌نام تا پرداخت تأییدشده.'),
  },
  {
    quarter: 3, start: '2027-05-15', end: '2027-08-14', category: 'platform',
    status: 'planned', approval: 'owner-defined', visibility: 'public', updated: '2026-11-15',
    title: text('Platform expansion', 'گسترش پلتفرم'),
    body: text(
      'Extend the professional web and desktop tools, improve treasury risk controls and investigate MetaTrader and cTrader licensing and integration requirements.',
      'ابزارهای حرفه‌ای وب و دسکتاپ را توسعه دهیم، کنترل ریسک خزانه را تقویت کنیم و الزامات مجوز و یکپارچه‌سازی MetaTrader و cTrader را بررسی کنیم.',
    ),
    dependencies: text('Commercial terms and technical access verified with each platform provider.', 'بررسی شرایط تجاری و دسترسی فنی با ارائه‌دهندهٔ هر پلتفرم.'),
  },
  {
    quarter: 4, start: '2027-08-15', end: '2027-11-14', category: 'ecosystem',
    status: 'planned', approval: 'owner-defined', visibility: 'public', updated: '2026-11-15',
    title: text('Scaling and ecosystem maturity', 'مقیاس‌پذیری و بلوغ اکوسیستم'),
    body: text(
      'Scale proven acquisition channels, reserve reporting, recovery, audits and web–desktop interoperability. Third-party connectivity and real-market pilots depend on licensing, security and explicit authorization.',
      'کانال‌های جذب اعتبارسنجی‌شده، گزارش ذخایر، بازیابی، حسابرسی و هماهنگی وب و دسکتاپ را گسترش دهیم. اتصال به پلتفرم‌های بیرونی و پایلوت بازار واقعی به مجوز، امنیت و تأیید صریح وابسته‌اند.',
    ),
    dependencies: text('Sustainable reserve coverage, verified free capital for live allocation, and approved controls and licensing.', 'پوشش پایدار ذخایر، سرمایهٔ آزاد تأییدشده برای تخصیص واقعی و کنترل‌ها و مجوزهای مصوب.'),
  },
] as const
