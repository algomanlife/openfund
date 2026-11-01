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
      sub: '',
      note: 'قلب تپنده\nساخته شده توسط معامله‌گران\nبرای معامله‌گران',
      propTitle: 'چلنج‌های پراپ',
      propDescription: '',
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
      sub: '',
      note: 'Heartbeat\nBuilt by traders\nfor traders',
      propTitle: 'Prop Trading Challenges',
      propDescription: '',
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
