import { text, type Localized } from '../../features/information/content'

/** Canonical Home (product gateway) content seed. Seeded into the
 *  `home_content` Directus collection by the backstage seeder.
 *  NOT imported by the app at runtime — Home.tsx renders from Directus. */
export interface HomeSeed {
  status: 'published'
  propCtaDestination: 'challenges' | 'terminal'
  perpetualCtaDestination: 'challenges' | 'terminal'
  translations: Record<'fa' | 'en', {
    headline: string
    sub: string
    note: string
    propTitle: string
    propDescription: string
    propCta: string
    propKicker: string
    perpetualTitle: string
    perpetualDescription: string
    perpetualCta: string
    perpetualKicker: string
    seoTitle: string
    seoDescription: string
  }>
}

export const homeSeed: HomeSeed = {
  status: 'published',
  propCtaDestination: 'challenges',
  perpetualCtaDestination: 'terminal',
  translations: {
    fa: {
      headline: 'همه بازارها در یک پلتفرم معاملاتی',
      sub: 'دو مسیر، یک مقصد: مهارتت را در چلنج‌های پراپ ثابت کن یا مستقیم وارد معاملات پرپچوال شو.',
      note: 'دادهٔ بازار: Gains Network · اجرای معاملات در این فاز شبیه‌سازی‌شده است.',
      propTitle: 'چلنج‌های پراپ',
      propDescription: 'سه مدل چلنج — استاندارد، تک‌مرحله‌ای و آنی — به‌علاوهٔ تست رایگان ۱۴روزه؛ اهداف، سقف‌های ضرر و سهم سود از همان ابتدا روشن.',
      propCta: 'چلنج‌های پراپ',
      propKicker: 'محصول الف',
      perpetualTitle: 'معاملات پرپچوال اهرمی',
      perpetualDescription: 'پلتفرم معاملاتی اختصاصی با دادهٔ زندهٔ بازار از Gains Network؛ رمزارز، فارکس، سهام، شاخص و کالا.',
      perpetualCta: 'معاملات پرپچوال اهرمی',
      perpetualKicker: 'محصول ب',
      seoTitle: 'اوپن‌فاند — همه بازارها در یک پلتفرم معاملاتی',
      seoDescription: 'اوپن‌فاند یک پلتفرم معاملاتی با دو مسیر است: چلنج‌های پراپ و معاملات پرپچوال اهرمی با دادهٔ زندهٔ بازار از Gains Network.',
    },
    en: {
      headline: 'All Markets One Trading Platform',
      sub: 'Two paths, one destination: prove your skill in prop trading challenges, or step straight into leveraged perpetual trading.',
      note: 'Market data by Gains Network · execution is simulated in this phase.',
      propTitle: 'Prop Trading Challenges',
      propDescription: 'Three challenge models — Standard, One-phase and Instant — plus a 14-day free trial; targets, loss limits and reward shares clear from the start.',
      propCta: 'Prop Trading Challenges',
      propKicker: 'Product A',
      perpetualTitle: 'Leveraged Perpetual Trading',
      perpetualDescription: 'A dedicated trading terminal on live Gains Network market data: crypto, forex, stocks, indices and commodities.',
      perpetualCta: 'Leveraged Perpetual Trading',
      perpetualKicker: 'Product B',
      seoTitle: 'Openfund — All Markets, One Trading Platform',
      seoDescription: 'Openfund is one trading platform with two paths: prop trading challenges and leveraged perpetual trading on live Gains Network market data.',
    },
  },
}
