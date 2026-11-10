import type { WpDataset } from '../../whitepaper/types'
import { text as t } from '../../../features/information/content'

/* Chart datasets. Values are stored as numbers once; labels are translated.
   Every scenario dataset is hypothetical and says so in its own note. */
export const datasets: WpDataset[] = [
  {
    key: 'scenario-1m', kind: 'waterfall', unit: 'usd',
    title: t('Illustrative scenario: $1,000,000 of gross challenge sales', 'سناریوی نمایشی: ۱٬۰۰۰٬۰۰۰ دلار فروش ناخالص چلنج'),
    caption: t('How one hypothetical period of sales could flow through rewards, costs and reserves before any capital becomes allocatable.', 'جریان فرضی فروش یک دوره از پاداش‌ها، هزینه‌ها و ذخایر پیش از آن‌که سرمایه‌ای قابل تخصیص شود.'),
    note: t('Hypothetical. A 56% trader payout ratio, zero refunds, 20% of sales attributed to ambassador first purchases and the cost lines are assumptions for explanation only. They are not Openfund revenue, a forecast or a guaranteed payout ratio. Real figures appear only on the Transparency page, from operational records.', 'فرضی. نسبت پرداخت ۵۶٪ به معامله‌گران، بازپرداخت صفر، انتساب ۲۰٪ فروش به خرید اول از طریق سفیران و ارقام هزینه، صرفاً برای توضیح فرض شده‌اند. این اعداد درآمد اوپن‌فاند، پیش‌بینی یا نسبت پرداخت تضمین‌شده نیستند. اعداد واقعی فقط در صفحهٔ شفافیت و از سوابق عملیاتی نمایش داده می‌شوند.'),
    points: [
      { key: 'gross', role: 'start', value: 1_000_000, label: t('Gross challenge sales', 'فروش ناخالص چلنج') },
      { key: 'trader-rewards', role: 'delta', value: -560_000, label: t('Trader rewards (56%)', 'پاداش معامله‌گران (۵۶٪)') },
      { key: 'after-rewards', role: 'subtotal', value: 440_000, label: t('Remaining before other expenses', 'باقی‌مانده پیش از سایر هزینه‌ها') },
      { key: 'referral', role: 'delta', value: -20_000, label: t('Ambassador commissions', 'کمیسیون سفیران') },
      { key: 'infrastructure', role: 'delta', value: -30_000, label: t('Infrastructure', 'زیرساخت') },
      { key: 'operations', role: 'delta', value: -110_000, label: t('Operating expenses', 'هزینه‌های عملیاتی') },
      { key: 'operating-result', role: 'subtotal', value: 280_000, label: t('Operating result', 'نتیجهٔ عملیاتی') },
      { key: 'reserves', role: 'delta', value: -140_000, label: t('Operational and risk reserves', 'ذخایر عملیاتی و ریسک') },
      { key: 'allocatable', role: 'subtotal', value: 140_000, label: t('Illustrative allocatable capital', 'سرمایهٔ قابل تخصیص نمایشی') },
    ],
    sources: ['fpfx-2024', 'topstep-2025'],
  },
  {
    key: 'capital-position', kind: 'waterfall', unit: 'usd',
    title: t('Why a treasury balance is not free capital', 'چرا موجودی خزانه سرمایهٔ آزاد نیست'),
    caption: t('An illustrative treasury balance reduced by obligations, reserves and existing allocations to reach Available Allocatable Capital.', 'یک موجودی نمایشی خزانه که پس از کسر تعهدات، ذخایر و تخصیص‌های موجود به سرمایهٔ آزاد قابل تخصیص می‌رسد.'),
    note: t('Hypothetical values that mirror the formula used by the backend financial position. No Openfund treasury figure is shown here; the treasury address is not yet configured.', 'مقادیر فرضی منطبق بر فرمول موقعیت مالی در بک‌اند. هیچ رقمی از خزانهٔ اوپن‌فاند در این نمودار نیست؛ نشانی خزانه هنوز پیکربندی نشده است.'),
    points: [
      { key: 'gross-treasury', role: 'start', value: 1_200_000, label: t('Gross treasury balance', 'موجودی ناخالص خزانه') },
      { key: 'obligations', role: 'delta', value: -250_000, label: t('Outstanding obligations', 'تعهدات پرداخت‌نشده') },
      { key: 'operational-reserve', role: 'delta', value: -150_000, label: t('Operational reserve', 'ذخیرهٔ عملیاتی') },
      { key: 'risk-reserve', role: 'delta', value: -200_000, label: t('Risk reserve', 'ذخیرهٔ ریسک') },
      { key: 'allocations', role: 'delta', value: -100_000, label: t('Existing live allocations', 'تخصیص‌های فعال موجود') },
      { key: 'available', role: 'subtotal', value: 500_000, label: t('Available allocatable capital', 'سرمایهٔ آزاد قابل تخصیص') },
    ],
  },
  {
    key: 'live-split-tiers', kind: 'stacked', unit: 'pct',
    title: t('Candidate profit-share tiers for Live Market Access', 'ردیف‌های پیشنهادی تقسیم سود در اتصال به بازار'),
    caption: t('Shares of verified realized net profit after eligible trading costs, per candidate tier.', 'سهم هر طرف از سود خالص تحقق‌یافته و تأییدشده پس از هزینه‌های معاملاتی مجاز، برای هر ردیف پیشنهادی.'),
    note: t('Proposals under consideration, not contractual terms. No tier applies by default; management must select one explicitly for each approved trader. The coach share is fixed at 10%.', 'پیشنهادهای در دست بررسی، نه شرایط قراردادی. هیچ ردیفی به‌صورت پیش‌فرض اعمال نمی‌شود و مدیریت باید برای هر معامله‌گر تأییدشده صریحاً یکی را انتخاب کند. سهم کوچ ثابت و ۱۰٪ است.'),
    segments: [
      { key: 'trader', label: t('Trader', 'معامله‌گر') },
      { key: 'coach', label: t('Coach', 'کوچ') },
      { key: 'openfund', label: t('Openfund', 'اوپن‌فاند') },
    ],
    points: [
      { key: 'standard', values: [70, 10, 20], label: t('Standard', 'استاندارد') },
      { key: 'advanced', values: [80, 10, 10], label: t('Advanced', 'پیشرفته') },
      { key: 'elite', values: [85, 10, 5], label: t('Elite', 'ممتاز') },
    ],
    sources: ['economy-pr'],
  },
  {
    key: 'industry-benchmarks', kind: 'bars', unit: 'pct',
    title: t('Published prop-industry outcome figures', 'آمار منتشرشدهٔ نتایج در صنعت پراپ'),
    caption: t('Each bar comes from one publisher with its own definition; the bars are not comparable to each other.', 'هر ستون از یک ناشر با تعریف خاص خودش است و ستون‌ها با هم قابل مقایسه نیستند.'),
    note: t('Single-firm or single-provider figures, not audited industry averages. Openfund publishes its own ratios only from its operational records.', 'آمار یک شرکت یا یک ارائه‌دهنده است، نه میانگین حسابرسی‌شدهٔ صنعت. اوپن‌فاند نسبت‌های خود را فقط از سوابق عملیاتی‌اش منتشر می‌کند.'),
    points: [
      { key: 'topstep-funded-payout', value: 33.3, label: t('Topstep 2025: funded-level participants paid', 'تاپ‌استپ ۲۰۲۵: شرکت‌کنندگان فاندد دارای پرداخت') },
      { key: 'topstep-combines', value: 16.8, label: t('Topstep 2025: combines completed', 'تاپ‌استپ ۲۰۲۵: Combineهای تکمیل‌شده') },
      { key: 'fpfx-traders-paid', value: 7, label: t('FPFX 2024: traders with a payout', 'FPFX ۲۰۲۴: معامله‌گران دارای پرداخت') },
      { key: 'topstep-live', value: 0.71, label: t('Topstep 2025: called up to live', 'تاپ‌استپ ۲۰۲۵: دعوت به حساب واقعی') },
    ],
    sources: ['topstep-2025', 'fpfx-2024'],
  },
]
