import { text, type Localized } from '../information/content'

export const purchaseCopy = {
  title: text('Purchases & Invoices', 'خریدها و فاکتورها'),
  description: text('Review your challenge purchases, payment records and issued invoices.', 'خرید چالش‌ها، سوابق پرداخت و فاکتورهای صادرشده را بررسی کنید.'),
  buy: text('Buy Challenge', 'خرید چالش'),
  signIn: text('Connect and sign in with your wallet to view your purchase history.', 'برای مشاهدهٔ سوابق خرید، کیف پول خود را متصل کنید و وارد شوید.'),
  connect: text('Connect wallet', 'اتصال کیف پول'),
  loadError: text('Could not load history.', 'دریافت تاریخچه ناموفق بود.'),
  loading: text('Loading purchases…', 'در حال دریافت خریدها…'),
  empty: text('No purchases yet. Choose a challenge to get started.', 'هنوز خریدی ثبت نشده است. برای شروع، یک چالش انتخاب کنید.'),
  plan: text('Plan', 'پلن'), size: text('Account size', 'اندازهٔ حساب'), fee: text('Fee', 'هزینه'),
  status: text('Status', 'وضعیت'), date: text('Date', 'تاریخ'), payment: text('Payment', 'پرداخت'),
  invoice: text('Invoice', 'فاکتور'), pdf: text('Download PDF', 'دانلود PDF'),
  unavailable: text('Not available', 'در دسترس نیست'), unknown: text('Unknown', 'نامشخص'),
}
export const purchaseStatuses: Record<string, Localized> = {
  payment_detected: text('Verification Pending', 'در حال بررسی تراکنش'),
  manual_review: text('Under review', 'در حال بررسی'),
  provisioned: text('Challenge Activated', 'چالش فعال شد'),
  pending: text('Awaiting payment', 'در انتظار پرداخت'), paid: text('Paid', 'پرداخت‌شده'),
  cancelled: text('Cancelled', 'لغوشده'), expired: text('Expired', 'منقضی'),
  refunded: text('Refunded', 'بازپرداخت‌شده'), partially_refunded: text('Partially refunded', 'بازپرداخت جزئی'),
}
