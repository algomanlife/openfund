import type { WpDocument } from '../../whitepaper/types'
import { text as t } from '../../../features/information/content'

export const whitepaperDocument: WpDocument = {
  slug: 'openfund-whitepaper',
  version: '1.0',
  publishedOn: '2026-11-09',
  updatedOn: '2026-11-09',
  title: t('Openfund Whitepaper', 'وایت‌پیپر اوپن‌فاند'),
  subtitle: t('Open Trading Infrastructure, Transparent Economics & Community-Powered Funding', 'زیرساخت معاملاتی باز، اقتصاد شفاف و تأمین سرمایهٔ مبتنی بر جامعه'),
  abstract: t(
    'Openfund is building a connected trading and trader-funding ecosystem: one shared trading terminal, a server-authoritative evaluation engine, a published challenge catalog, wallet-native identity and an economy whose figures come from operational records rather than marketing. This paper describes what the project is, how it works, how it earns and spends money, how capital could one day reach real markets, and — just as importantly — which parts are live today, which are implemented but not yet released, and which remain plans.',
    'اوپن‌فاند در حال ساخت یک اکوسیستم پیوسته برای معامله‌گری و تأمین سرمایهٔ معامله‌گران است: یک ترمینال معاملاتی مشترک، موتور ارزیابی با مرجعیت سرور، کاتالوگ منتشرشدهٔ چلنج‌ها، هویت مبتنی بر کیف پول و اقتصادی که اعدادش از سوابق عملیاتی می‌آید، نه از تبلیغات. این سند توضیح می‌دهد اوپن‌فاند چیست، چگونه کار می‌کند، چگونه درآمد کسب و هزینه می‌کند، سرمایه چگونه ممکن است روزی به بازار واقعی برسد و — به همان اندازه مهم — کدام بخش‌ها امروز فعال‌اند، کدام پیاده‌سازی شده اما هنوز منتشر نشده‌اند و کدام هنوز برنامه‌اند.',
  ),
  revisionNote: t(
    'First official edition. Status labels were verified against the repository, the official v0.4.4 release and the production /version endpoint on 9 November 2026.',
    'نخستین ویرایش رسمی. برچسب‌های وضعیت در ۱۸ آبان ۱۴۰۵ با مخزن کد، نسخهٔ رسمی v0.4.4 و نقطهٔ پایانی /version محیط اصلی تطبیق داده شدند.',
  ),
  seoTitle: t('Openfund Whitepaper v1.0 — Open trading infrastructure and transparent economics', 'وایت‌پیپر اوپن‌فاند نسخهٔ ۱٫۰ — زیرساخت معاملاتی باز و اقتصاد شفاف'),
  seoDescription: t(
    'The official Openfund whitepaper: ecosystem, architecture, prop evaluation, business model, treasury transparency, ambassador and coach programs, Live Market Access, roadmap and disclosures.',
    'وایت‌پیپر رسمی اوپن‌فاند: اکوسیستم، معماری، ارزیابی پراپ، مدل کسب‌وکار، شفافیت خزانه، برنامه‌های سفیر و کوچ، اتصال به بازار، نقشهٔ راه و افشاها.',
  ),
}
