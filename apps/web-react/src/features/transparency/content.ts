import { text as t, type Localized } from '../information/content'
import type { MetricKey } from './data/mockTransparency'

export const transparencyIntro = t('Clarity starts with knowing what you are looking at. Explore our reporting concept, today’s infrastructure and the path toward independent verification.', 'شفافیت از شناخت داده شروع می‌شود. طرح گزارش‌دهی، زیرساخت امروز و مسیر راستی‌آزمایی مستقل را بررسی کن.')
export const sampleNotice = t('Illustrative sample data only. Every metric, chart and history row below is synthetic. These are not actual accounts, live volume, evaluation results, payouts, reserves or audited financial figures. No live reporting API is connected.', 'فقط دادهٔ نمونهٔ نمایشی. همهٔ شاخص‌ها، نمودارها و ردیف‌های تاریخچهٔ زیر ساختگی‌اند. این اعداد حساب واقعی، حجم زنده، نتیجهٔ ارزیابی، برداشت، ذخیره یا آمار مالی حسابرسی‌شده نیستند. API گزارش‌دهی زنده متصل نیست.')
export const metricCopy: Record<MetricKey, { label: Localized; note: Localized }> = {
  accounts: { label: t('Demo accounts', 'حساب‌های دمو'), note: t('Illustrative account total', 'تعداد نمایشی حساب‌ها') },
  volume: { label: t('Simulated volume', 'حجم شبیه‌سازی‌شده'), note: t('Sum of sample trade notionals · USD', 'مجموع ارزش اسمی معاملات نمونه · دلار') },
  trades: { label: t('Simulated trades', 'معاملات شبیه‌سازی‌شده'), note: t('Sample activity across the fixture period', 'فعالیت نمونه در بازهٔ نمایش') },
  completed: { label: t('Completed evaluations', 'ارزیابی‌های تکمیل‌شده'), note: t('Proposed reporting · passed + failed', 'گزارش پیشنهادی · قبول + مردود') },
  passRate: { label: t('Evaluation pass rate', 'نرخ قبولی ارزیابی'), note: t('Sample passed ÷ sample completed', 'قبولی نمونه ÷ تکمیل‌شدهٔ نمونه') },
  pnl: { label: t('Aggregate demo PnL', 'مجموع سود و زیان دمو'), note: t('Virtual DAI · synthetic net result', 'دای مجازی · نتیجهٔ خالص ساختگی') },
}
export const infrastructure: { title: Localized; status: 'current' | 'planned'; body: Localized; code: string }[] = [
  { title: t('Market data', 'دادهٔ بازار'), status: 'current', code: '01 / DATA', body: t('Gains Network supplies market metadata and prices over REST and WebSocket. Vela displays charts. Market prices are not evidence of orders being executed on-chain.', 'Gains Network مشخصات بازار و قیمت را با REST و WebSocket تأمین می‌کند. Vela نمودار را نمایش می‌دهد. قیمت بازار، مدرک اجرای سفارش آن‌چین نیست.') },
  { title: t('Demo trading engine', 'موتور معاملاتی دمو'), status: 'current', code: '02 / SIMULATION', body: t('For signed-in accounts, the backend simulates orders, fills, SL/TP and liquidation using server marks. Fee and spread assumptions are documented. No real capital is traded.', 'برای حساب‌های واردشده، سرور سفارش، اجرا، حد ضرر، حد سود و لیکوییدشدن را با قیمت مرجع شبیه‌سازی می‌کند. فرض کارمزد و اسپرد مستند است. سرمایهٔ واقعی معامله نمی‌شود.') },
  { title: t('Account records', 'سوابق حساب'), status: 'current', code: '03 / RECORDS', body: t('Authenticated demo positions, orders and ledger entries persist in PostgreSQL. Session ownership protects account access. Directus provides administrative views, not public financial verification.', 'موقعیت، سفارش و رویداد دفتر حسابِ دموی پس از ورود در PostgreSQL نگهداری می‌شوند. مالکیت نشست از دسترسی محافظت می‌کند. Directus نمای مدیریتی دارد، نه راستی‌آزمایی مالی عمومی.') },
  { title: t('Portfolio analytics', 'تحلیل پرتفوی'), status: 'current', code: '04 / ANALYTICS', body: t('The portfolio aggregates the signed-in account’s trade records into PnL, equity, drawdown and journal views. This public dashboard is a separate sample and never displays private account records.', 'پرتفوی سوابق معاملات حساب واردشده را به سود و زیان، ارزش خالص، افت و ژورنال تبدیل می‌کند. این داشبورد عمومی، نمونه‌ای جداست و سوابق خصوصی حساب را نمایش نمی‌دهد.') },
]
export const roadmap = [
  { title: t('Publish a versioned evaluation policy', 'انتشار سیاست نسخه‌دار ارزیابی'), body: t('Approve targets, loss measurement, eligibility and a change history before paid evaluations become available.', 'پیش از عرضهٔ ارزیابی پولی، هدف‌ها، روش سنجش زیان، شرایط دسترسی و تاریخچهٔ تغییرات تصویب شوند.') },
  { title: t('Connect scoped reporting', 'اتصال گزارش‌دهی با دامنهٔ مشخص'), body: t('Define aggregation, privacy, refresh time, reconciliation and source provenance before replacing sample figures.', 'پیش از جایگزینی اعداد نمونه، تجمیع، حریم خصوصی، زمان به‌روزرسانی، تطبیق و منشأ داده تعریف شوند.') },
  { title: t('Enable independent review', 'فراهم‌کردن بررسی مستقل'), body: t('Publish the review scope and evidence. Any future cryptographic proof or on-chain settlement needs a deployed, inspectable implementation first.', 'دامنه و شواهد بررسی منتشر شوند. هر اثبات رمزنگاری یا تسویهٔ آن‌چین آینده، ابتدا به پیاده‌سازی مستقر و قابل بررسی نیاز دارد.') },
]
