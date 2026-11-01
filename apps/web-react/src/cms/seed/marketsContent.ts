import { text, type Localized } from '../../features/information/content'

/** Canonical Markets page editorial seed (hero + supporting copy).
 *  Seeded into the `pages` collection (slug: markets) by the backstage seeder.
 *  Market instruments and live prices ALWAYS come from Gains Network —
 *  never from the CMS. NOT imported by the app at runtime. */
export interface MarketsSeed {
  title: Localized
  subtitle: Localized
  description: Localized
  seoTitle: Localized
  seoDescription: Localized
}

export const marketsSeed: MarketsSeed = {
  title: text('Markets', 'بازارها'),
  subtitle: text('Explore Openfund', 'بازارهای جهانی'),
  description: text(
    'Every asset class the Openfund trading ecosystem tracks, with live mark prices straight from Gains Network. Pick a market and take it straight into the terminal.',
    'همهٔ کلاس‌های دارایی که اکوسیستم معاملاتی اوپن‌فاند پوشش می‌دهد، با قیمت Mark مستقیم از Gains Network. بازار را انتخاب کن و مستقیم به ترمینال ببر.'
  ),
  seoTitle: text('Openfund Markets', 'بازارهای اوپن‌فاند'),
  seoDescription: text(
    'Explore every Openfund market — crypto, forex, stocks, indices and commodities — with live Gains Network prices.',
    'همهٔ بازارهای اوپن‌فاند را با قیمت زندهٔ Gains Network ببینید: رمزارز، فارکس، سهام، شاخص و کالا.'
  ),
}

/** Footer link seed — destination values are validated against a frontend
 *  route whitelist before rendering (never arbitrary URLs). */
export interface FooterLinkSeed { destination: string; label: Localized }
export const footerLinkSeed: FooterLinkSeed[] = [
  { destination: 'accounts-section', label: text('Challenges', 'چلنج‌ها') },
  { destination: 'team-section', label: text('Team', 'تیم') },
  { destination: 'faq-section', label: text('FAQ', 'پرسش‌ها') },
  { destination: 'markets', label: text('Markets', 'بازارها') },
  { destination: 'rulebook', label: text('Trading Rules', 'قوانین معاملاتی') },
  { destination: 'transparency', label: text('Transparency', 'شفافیت') },
]

/** Navigation seed — the fixed four public items (order of record). */
export interface NavSeed { route: string; label: Localized }
export const navSeed: NavSeed[] = [
  { route: 'challenges', label: text('Trading Challenges', 'چلنج‌های معاملاتی') },
  { route: 'markets', label: text('Markets', 'بازارها') },
  { route: 'rulebook', label: text('Trading Rules', 'قوانین معاملاتی') },
  { route: 'transparency', label: text('Transparency', 'شفافیت') },
]
