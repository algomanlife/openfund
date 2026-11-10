import type { WpReference } from '../../whitepaper/types'
import { text as t } from '../../../features/information/content'

/* Every source was opened and checked on the access date. Repository links
   point at the public `main` branch, except economy capabilities that are
   still under review in pull request #59 (linked as such). */
const REPO = 'https://github.com/algomanlife/openfund'
const blob = (path: string) => `${REPO}/blob/main/${path}`
const CHECKED = '2026-11-09'

export const references: WpReference[] = [
  { key: 'repo', sort: 1, kind: 'repository', title: 'Openfund source repository', publisher: 'Openfund', url: REPO, accessed: CHECKED,
    note: t('Public repository containing the web application, backend, CMS scripts, documentation and release automation.', 'مخزن عمومی شامل اپلیکیشن وب، بک‌اند، اسکریپت‌های CMS، مستندات و خودکارسازی انتشار.') },
  { key: 'readme-licensing', sort: 2, kind: 'repository', title: 'README — Licensing and upstream attribution', publisher: 'Openfund', url: `${REPO}#licensing-and-upstream-attribution`, accessed: CHECKED,
    note: t('States that no root licence is present and lists the separate licences of vendored and third-party components.', 'تصریح می‌کند که مجوز ریشه وجود ندارد و مجوزهای جداگانهٔ اجزای ثالث را فهرست می‌کند.') },
  { key: 'contributing', sort: 3, kind: 'repository', title: 'Contributing guide', publisher: 'Openfund', url: blob('CONTRIBUTING.md'), accessed: CHECKED,
    note: t('Branching, review and pull-request workflow for contributors.', 'روند شاخه‌سازی، بازبینی و درخواست ادغام برای مشارکت‌کنندگان.') },
  { key: 'feature-status', sort: 4, kind: 'documentation', title: 'Feature status register', publisher: 'Openfund', url: blob('docs/product/FEATURE_STATUS.md'), accessed: CHECKED,
    note: t('Capability-level status with evidence and practical limits; the authority for every status label in this paper.', 'وضعیت هر قابلیت همراه با شواهد و محدودیت‌ها؛ مرجع همهٔ برچسب‌های وضعیت در این سند.') },
  { key: 'milestones', sort: 5, kind: 'documentation', title: 'Milestones and acceptance gates', publisher: 'Openfund', url: blob('docs/roadmap/MILESTONES.md'), accessed: CHECKED,
    note: t('Phase milestones with dependencies and acceptance criteria; no delivery dates are promised.', 'نقاط عطف هر فاز با وابستگی‌ها و معیارهای پذیرش؛ هیچ تاریخ تحویلی وعده داده نشده است.') },
  { key: 'architecture', sort: 6, kind: 'documentation', title: 'System architecture', publisher: 'Openfund', url: blob('docs/architecture/ARCHITECTURE.md'), accessed: CHECKED,
    note: t('Runtime graph, source boundaries, financial authority and deployment boundary.', 'نمودار اجرا، مرزهای کد، مرجع مالی و مرز استقرار.') },
  { key: 'gains-integration', sort: 7, kind: 'documentation', title: 'Gains Network integration', publisher: 'Openfund', url: blob('docs/integrations/GAINS.md'), accessed: CHECKED,
    note: t('Market-data interfaces, wallet reads and the execution gate that keeps order submission disabled.', 'رابط‌های دادهٔ بازار، خواندن کیف پول و دروازهٔ اجرا که ارسال سفارش را غیرفعال نگه می‌دارد.') },
  { key: 'prop-engine', sort: 8, kind: 'documentation', title: 'Prop trading engine and evaluation audit', publisher: 'Openfund', url: blob('docs/audits/PROP_ENGINE_AUDIT.md'), accessed: CHECKED,
    note: t('Audit of the evaluation engine, including fixed defects and open questions.', 'ممیزی موتور ارزیابی، شامل نقص‌های رفع‌شده و پرسش‌های باز.') },
  { key: 'adr-purchases', sort: 9, kind: 'documentation', title: 'ADR 0009 — Challenge purchases and payment verification', publisher: 'Openfund', url: blob('docs/decisions/0009-challenge-purchases-and-payment-verification.md'), accessed: CHECKED,
    note: t('Server-priced orders, on-chain receipt verification and exactly-once provisioning.', 'سفارش با قیمت سرور، تأیید رسید آن‌چین و ایجاد دقیقاً‌یک‌بارهٔ حساب.') },
  { key: 'plan-catalog', sort: 10, kind: 'repository', title: 'Challenge plan catalog (single source of truth)', publisher: 'Openfund', url: blob('apps/web-react/src/data/challengePlans.ts'), accessed: CHECKED,
    note: t('Published prices, targets and loss limits; the same values are served by the production catalog endpoint.', 'قیمت‌ها، اهداف و حدود زیان منتشرشده؛ همین مقادیر از نقطهٔ پایانی کاتالوگ در محیط اصلی ارائه می‌شود.') },
  { key: 'economy-pr', sort: 11, kind: 'repository', title: 'Pull request #59 — Economy, transparency, ambassadors and live funding', publisher: 'Openfund', url: `${REPO}/pull/59`, accessed: CHECKED,
    note: t('Implementation and documentation of the transparency report, treasury snapshots, partner programs and the Live Market Access control plane. Under review; not yet released.', 'پیاده‌سازی و مستندات گزارش شفافیت، تصاویر لحظه‌ای خزانه، برنامه‌های همکاری و لایهٔ کنترل اتصال به بازار. در حال بازبینی و هنوز منتشرنشده.') },
  { key: 'protocol-provenance', sort: 12, kind: 'repository', title: 'Openfund Protocol source provenance', publisher: 'Openfund', url: blob('packages/openfund-protocol/PROVENANCE.md'), accessed: CHECKED,
    note: t('Dormant Solidity foundation imported from MUX Protocol under GPL-2.0; not connected to any runtime.', 'زیربنای غیرفعال Solidity برگرفته از MUX Protocol تحت GPL-2.0؛ به هیچ بخش اجرایی متصل نیست.') },
  { key: 'deployment-blueprint', sort: 13, kind: 'repository', title: 'Deployment blueprint', publisher: 'Openfund', url: blob('render.yaml'), accessed: CHECKED,
    note: t('Three deployed resources: the web/API service, PostgreSQL and Directus.', 'سه منبع مستقر: سرویس وب/API، پایگاه داده PostgreSQL و Directus.') },
  { key: 'release-v044', sort: 14, kind: 'release', title: 'Openfund v0.4.4 release', publisher: 'Openfund', url: `${REPO}/releases/tag/v0.4.4`, published: '2026-11-08', accessed: CHECKED,
    note: t('Latest official release at the time of writing; its version and commit are served by the production /version endpoint.', 'آخرین نسخهٔ رسمی در زمان نگارش؛ نسخه و کامیت آن از نقطهٔ پایانی /version محیط اصلی قابل بررسی است.') },
  { key: 'releases', sort: 15, kind: 'release', title: 'Openfund release history', publisher: 'Openfund', url: `${REPO}/releases`, accessed: CHECKED,
    note: t('Immutable tagged releases from v0.1.0 (3 November 2026) onwards.', 'نسخه‌های برچسب‌دار تغییرناپذیر از v0.1.0 (۱۲ آبان ۱۴۰۵) به بعد.') },
  { key: 'gains-docs', sort: 16, kind: 'provider', title: 'Gains Network documentation', publisher: 'Gains Network', url: 'https://docs.gains.trade/', accessed: CHECKED,
    note: t('Provider documentation for the trading venue whose public market data Openfund reads.', 'مستندات ارائه‌دهندهٔ بازاری که اوپن‌فاند دادهٔ عمومی آن را می‌خواند.') },
  { key: 'vela', sort: 17, kind: 'provider', title: 'Vela charting library', publisher: 'LuxAlgo', url: 'https://github.com/LuxAlgo/Vela', accessed: CHECKED,
    note: t('Apache-2.0 charting engine vendored into the shared terminal with its notice preserved.', 'موتور چارت با مجوز Apache-2.0 که با حفظ اعلامیه در ترمینال مشترک استفاده شده است.') },
  { key: 'siwe', sort: 18, kind: 'provider', title: 'EIP-4361: Sign-In with Ethereum', publisher: 'Ethereum Improvement Proposals', url: 'https://eips.ethereum.org/EIPS/eip-4361', accessed: CHECKED,
    note: t('The message standard used for wallet authentication; signing in never authorises a transaction.', 'استاندارد پیامی که برای احراز هویت با کیف پول استفاده می‌شود؛ ورود هرگز مجوز تراکنش نیست.') },
  { key: 'chainlink-feeds', sort: 19, kind: 'provider', title: 'Chainlink Data Feeds', publisher: 'Chainlink', url: 'https://docs.chain.link/data-feeds', accessed: CHECKED,
    note: t('Price feeds the treasury snapshot uses to value configured assets; stale answers are excluded.', 'فیدهای قیمتی که تصویر لحظه‌ای خزانه برای ارزش‌گذاری دارایی‌ها استفاده می‌کند؛ پاسخ‌های کهنه کنار گذاشته می‌شوند.') },
  { key: 'directus-docs', sort: 20, kind: 'provider', title: 'Directus documentation', publisher: 'Directus', url: 'https://directus.io/docs', accessed: CHECKED,
    note: t('The headless CMS that stores and publishes this document and the website editorial content.', 'سیستم مدیریت محتوایی که این سند و محتوای وب‌سایت را نگهداری و منتشر می‌کند.') },
  { key: 'topstep-2025', sort: 21, kind: 'industry', title: 'Risk Disclosure — 2025 Trader Performance Statistics', publisher: 'Topstep', url: 'https://www.topstep.com/risk-disclosure', published: 'Page last updated 2025-09-25; statistics for January–December 2025', accessed: CHECKED,
    note: t('Firm-published, not independently audited, futures only, mixing simulated and live stages. 16.8% of Trading Combines initiated were completed; 51.8% of participants advanced in at least one Combine; 33.3% of Funded-level participants received a payout; 0.71% of Express Funded participants were called up to a Live Funded Account.', 'منتشرشده توسط خود شرکت، بدون حسابرسی مستقل، فقط فیوچرز و ترکیبی از مراحل شبیه‌سازی‌شده و واقعی. ۱۶٫۸٪ از Trading Combineهای آغازشده تکمیل شدند؛ ۵۱٫۸٪ از شرکت‌کنندگان دست‌کم در یک Combine موفق شدند؛ ۳۳٫۳٪ از شرکت‌کنندگان سطح فاندد پرداخت دریافت کردند؛ ۰٫۷۱٪ از شرکت‌کنندگان Express Funded به حساب فاندد واقعی دعوت شدند.') },
  { key: 'fpfx-2024', sort: 22, kind: 'industry', title: 'Exclusive: Only 7% of 300,000 Prop Trading Accounts Achieved Payouts', publisher: 'Finance Magnates (Damian Chmiel)', url: 'https://www.financemagnates.com/forex/analysis/exclusive-only-7-of-300000-prop-trading-accounts-achieved-payouts/', published: '2024-09-18', accessed: CHECKED,
    note: t('FPFX Tech data covering over 300,000 accounts of 100,000 traders at ten firms. Despite the headline, the 7% figure refers to traders who achieved a payout; the average payout was reported as 4% of plan size. Not an industry-wide census.', 'دادهٔ FPFX Tech شامل بیش از ۳۰۰٬۰۰۰ حساب متعلق به ۱۰۰٬۰۰۰ معامله‌گر در ده شرکت. برخلاف تیتر، عدد ۷٪ به معامله‌گرانی اشاره دارد که پرداخت دریافت کرده‌اند؛ میانگین پرداخت ۴٪ اندازهٔ حساب گزارش شده است. سرشماری کل صنعت نیست.') },
]
