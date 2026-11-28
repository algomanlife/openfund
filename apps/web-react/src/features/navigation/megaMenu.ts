/* Mega menu data shared by the desktop header panel, the off-canvas drawer and
 * the terminal menu: one original line icon and a one-line description per
 * destination, the Resources sub-groups and a featured banner per group.
 * Descriptions and icons are bundled fallbacks; published Directus
 * navigation_items rows (fields `description`, `icon`) override them. Banner
 * copy goes through the editable interface registry (pick). */
import { text } from '../information/content'
import { flamingoSceneNode } from './flamingoArt'

/** 24×24 line icons (stroke only), original drawings — no vendor logos */
export const MEGA_ICONS: Record<string, string> = {
  challenges: 'M5 20V9l7-5 7 5v11M9 20v-6h6v6M3 20h18',
  compare: 'M4 20V10M10 20V4M16 20v-8M22 20H2M14 7l2-2 2 2',
  checkout: 'M4 6h2l2 10h10l2-7H7M10 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  migrate: 'M3 15c3-4 6-4 9-1s6 3 9-1M6 9c1.5-2 3-2.5 5-2l-2 3M15 6c1.5-1.5 3-2 4.5-1.5L18 7',
  'trading-objectives': 'M4 20h16M6 16l4-5 3 3 5-7M17 7h2v2M4 4v16',
  labs: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7.5 14h9',
  tournament: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4',
  markets: 'M4 19h16M6 16l4-5 3 3 5-7M15 7h3v3',
  rulebook: 'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10M9 8h5',
  governance: 'M4 20h16M6 17V10M10 17V10M14 17V10M18 17V10M3 9l9-5 9 5z',
  whitepaper: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5M9 8h3',
  ambassador: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20a6 6 0 0 1 12 0M16 8l2 2 4-4',
  transparency: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  'revenue-model': 'M12 3v18M17 7.5c0-1.9-2.2-3.5-5-3.5s-5 1.6-5 3.5S9.2 11 12 11s5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5',
  'live-market-access': 'M4 12h6l2-5 3 10 2-5h3',
  referral: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  faq: 'M12 21a9 9 0 1 0-9-9c0 1.6.4 3 1.1 4.3L3 21l4.7-1.1A9 9 0 0 0 12 21ZM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5M12 16.5v.1',
  learn: 'M3 8l9-4 9 4-9 4zM7 10v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5M21 8v6',
  glossary: 'M4 5h7v14H4zM13 5h7v14h-7M7 9h2M16 9h2M7 12h2M16 12h2',
  tools: 'M6 3h12v18H6zM9 7h6M9 11h2M13 11h2M9 15h2M13 15h2',
  apps: 'M3 5h18v11H3zM8 20h8M12 16v4',
  roadmap: 'M4 6h5l2 3h9M4 6v13M4 13h7l2 3h7',
  developers: 'M8 9l-4 3 4 3M16 9l4 3-4 3M14 5l-4 14',
  'certificate-verification': 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9 12l2 2 4-4',
  about: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6M12 7.5v.1',
  contact: 'M4 6h16v12H4zM4 7l8 6 8-6',
  'bug-bounty': 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9.5 11.5h5M10 9l-1.5-1.5M14 9l1.5-1.5M12 9.5v6',
  /* a parachute dropping a parcel */
  airdrop: 'M4 10a8 6 0 0 1 16 0M4 10c1.5-1 3-1 4 0 1-1 2.6-1 4 0 1.4-1 3-1 4 0 1-1 2.5-1 4 0M4 10l7 8M20 10l-7 8M12 10v8M9.5 18h5v3h-5z',
  /* a contract page with a chain link */
  'smart-contracts': 'M6 3h9l4 4v6M15 3v4h4M6 3v18h6M9 8h4M9 11h6M15.5 16.5l-1 1a2 2 0 0 0 2.8 2.8l1-1M18.5 18.5l1-1a2 2 0 0 0-2.8-2.8l-1 1M16 19l3-3',
  home: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  /* terminal destinations */
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  trade: 'M7 4v16M17 4v16M4 8h6M14 15h6M4 15h6M14 8h6',
  chart: 'M4 19h16M7 15v-4M11 15V7M15 15v-6M19 15v-9',
  radar: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 12l6-4M12 16a4 4 0 1 0 0-8',
  heatmap: 'M4 4h5v5H4zM10 4h4v5h-4zM15 4h5v5h-5zM4 10h5v10H4zM10 10h10v10H10z',
  portfolio: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  journal: 'M6 3h11a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM8 8h7M8 12h7',
  accounts: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  leaderboard: 'M8 21V11h8v10M3 21v-6h5M16 21v-8h5M2 21h20',
  rewards: 'M5 9h14v12H5zM3 6h18v3H3zM12 6v15M12 6c-2-3-6-3-6 0M12 6c2-3 6-3 6 0',
  purchases: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  withdrawals: 'M4 9h16v10H4zM12 3v9m0 0-3-3m3 3 3-3',
  inbox: 'M4 5h16v14H4zM4 13h5l1 2h4l1-2h5',
  certificates: 'M5 4h14v12H5zM9 20l3-3 3 3v-4H9zM8 8h8M8 11h5',
}

/** one-line description per destination (bundled; CMS description wins) */
export const MEGA_DESCRIPTIONS: Record<string, { en: string; fa: string }> = {
  challenges: text('Choose a challenge model and account size.', 'مدل چلنج و اندازهٔ حساب را انتخاب کن.'),
  compare: text('Models, sizes and rules side by side.', 'مدل‌ها، اندازه‌ها و قوانین کنار هم.'),
  checkout: text('Pay on-chain and start your evaluation.', 'پرداخت روی زنجیره و شروع ارزیابی.'),
  migrate: text('Funded elsewhere? Start at the funded stage.', 'جای دیگر فاند شده‌ای؟ از مرحلهٔ فاند شروع کن.'),
  tournament: text('A 30-day competition in analysis and risk.', 'رقابت ۳۰ روزه در تحلیل و مدیریت ریسک.'),
  'trading-objectives': text('Every rule of each plan, at a glance.', 'همهٔ قوانین هر پلن، در یک نگاه.'),
  labs: text('Limited drops with experimental rules.', 'دراپ‌های محدود با قوانین آزمایشی.'),
  markets: text('Live prices for the markets you can trade.', 'قیمت زندهٔ بازارهایی که می‌توانی معامله کنی.'),
  rulebook: text('Every rule, before you start.', 'همهٔ قوانین، پیش از شروع.'),
  governance: text('How the community council decides.', 'شورای جامعه چگونه تصمیم می‌گیرد.'),
  ambassador: text('The introducing-broker program.', 'برنامهٔ معرفی‌کنندهٔ معامله‌گر.'),
  transparency: text('Published figures and how they are measured.', 'ارقام منتشرشده و نحوهٔ اندازه‌گیری آن‌ها.'),
  'revenue-model': text('Where revenue comes from and where it goes.', 'درآمد از کجا می‌آید و کجا می‌رود.'),
  'live-market-access': text('The path from a funded account to live markets.', 'مسیر از حساب فاندشده تا بازار واقعی.'),
  referral: text('Referral links and rewards.', 'لینک دعوت و پاداش‌ها.'),
  faq: text('Short answers to common questions.', 'پاسخ کوتاه به پرسش‌های رایج.'),
  learn: text('Learning paths and lessons.', 'مسیرهای یادگیری و درس‌ها.'),
  glossary: text('Trading terms, explained.', 'اصطلاحات معامله‌گری، به زبان ساده.'),
  tools: text('Calculators for size, risk and analysis.', 'ماشین‌حساب‌های اندازه، ریسک و تحلیل.'),
  apps: text('Web terminal and desktop app.', 'ترمینال وب و اپ دسکتاپ.'),
  roadmap: text('What has shipped and what comes next.', 'چه چیزی منتشر شده و قدم بعدی چیست.'),
  developers: text('Build on and contribute to Openfund.', 'روی اوپن‌فاند بساز و در آن مشارکت کن.'),
  'certificate-verification': text('Check that a certificate is genuine.', 'اصالت یک گواهی را بررسی کن.'),
  about: text('Who we are and how we work.', 'ما که هستیم و چگونه کار می‌کنیم.'),
  contact: text('Reach support, legal and technical teams.', 'تماس با پشتیبانی، واحد حقوقی و فنی.'),
  'bug-bounty': text('Report a vulnerability and get rewarded.', 'آسیب‌پذیری را گزارش کن و جایزه بگیر.'),
  airdrop: text('Cash rewards of $1,000 to $5,000 for challenge buyers.', 'جایزهٔ نقدی ۱٬۰۰۰ تا ۵٬۰۰۰ دلاری برای خریداران چلنج.'),
  'smart-contracts': text('Our contracts on Arbitrum Sepolia, open to verify.', 'قراردادهای ما روی Arbitrum Sepolia، قابل بررسی برای همه.'),
}

/** Resources sub-groups (routes must also be in the Resources list) */
export const RESOURCE_SECTIONS: { id: string; label: { en: string; fa: string }; routes: string[] }[] = [
  { id: 'learn', label: text('Learn', 'یادگیری'), routes: ['learn', 'glossary', 'faq'] },
  { id: 'product', label: text('Product', 'محصول'), routes: ['apps', 'tools', 'roadmap', 'developers'] },
  { id: 'company', label: text('Company', 'شرکت'), routes: ['about', 'contact', 'certificate-verification'] },
  { id: 'security', label: text('Security', 'امنیت'), routes: ['bug-bounty', 'smart-contracts'] },
]

export type MegaBannerKind = 'council' | 'desktop' | 'flamingo' | 'whitepaper'
/** featured banner per group: copy is editable through the interface registry */
export interface MegaBannerDef { kind: MegaBannerKind; route: string; hash?: string; title: { en: string; fa: string }; body: { en: string; fa: string }; cta: { en: string; fa: string }; description?: { en: string; fa: string } }
/** one or more featured banners per group (Economy has two) */
export const MEGA_BANNERS: Record<string, MegaBannerDef | MegaBannerDef[]> = {
  'website-challenges': {
    kind: 'flamingo', route: 'migrate',
    title: text('Migration to Openfund', 'مهاجرت به اوپن‌فاند'),
    body: text('Proven funded trader? Skip evaluation with three verified payouts.', 'معامله‌گر فاندشدهٔ اثبات‌شده‌ای؟ با سه برداشت تأییدشده از ارزیابی عبور کن.'),
    cta: text('Start migration', 'شروع مهاجرت'),
    /* read by screen readers only: the scene's concept */
    description: text('Illustration: a flock of flamingos migrating to a new home and landing on a calm lake, like the flamingos that winter at Maharloo Lake near Shiraz, where Openfund is based.', 'تصویر: دسته‌ای از فلامینگوها به خانه‌ای تازه مهاجرت می‌کنند و روی دریاچه‌ای آرام فرود می‌آیند؛ مانند فلامینگوهایی که زمستان را در دریاچهٔ مهارلو نزدیک شیراز، محل استقرار اوپن‌فاند، می‌گذرانند.'),
  },
  'website-economy': [{
    kind: 'council', route: 'governance',
    title: text('Latest council proposals', 'تازه‌ترین پیشنهادهای شورا'),
    body: text('Ten seats and a quorum of seven: see what the council is deciding.', 'ده کرسی و حد نصاب هفت: ببین شورا دربارهٔ چه تصمیم می‌گیرد.'),
    cta: text('Open governance', 'رفتن به حاکمیت'),
  }, {
    kind: 'whitepaper', route: 'whitepaper',
    title: text('Openfund whitepaper', 'وایت‌پیپر اوپن‌فاند'),
    body: text('How the evaluation, the economy and the council work, in one document.', 'ارزیابی، اقتصاد و شورا چگونه کار می‌کنند، در یک سند.'),
    cta: text('Read the whitepaper', 'مطالعهٔ وایت‌پیپر'),
  }],
  'website-resources': {
    kind: 'desktop', route: 'apps', hash: '#desktop-builds',
    title: text('Open Trade for desktop', 'Open Trade برای دسکتاپ'),
    body: text('Desktop app for macOS, Windows and Linux; mobile coming soon.', 'اپ دسکتاپ برای macOS، ویندوز و لینوکس؛ نسخهٔ موبایل به‌زودی.'),
    cta: text('Desktop downloads', 'دانلودهای دسکتاپ'),
  },
}

/** Open Trade platforms under the desktop banner (owner fix 3). Each glyph is
 *  an original line drawing in the mega icon style — a laptop, a window with
 *  two tiles, a shell prompt and a phone — never a vendor logo; the platform
 *  name is plain text. Desktop builds link to their card on /apps; the mobile
 *  apps are Planned (MILESTONES D2), so they stay dimmed with no link. */
export interface MegaPlatform { id: 'macos' | 'windows' | 'linux' | 'android' | 'ios'; name: string; glyph: string; soon: boolean }
const PLATFORM_GLYPHS = {
  laptop: 'M5 5h14v10H5zM3 18h18l-1.5 2h-15z',
  window: 'M3 5h18v14H3zM3 9h18M12 9v10',
  prompt: 'M3 5h18v14H3zM7 10l3 2-3 2M12 15h5',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM11 18h2',
}
export const MEGA_PLATFORMS: MegaPlatform[] = [
  { id: 'macos', name: 'macOS', glyph: PLATFORM_GLYPHS.laptop, soon: false },
  { id: 'windows', name: 'Windows', glyph: PLATFORM_GLYPHS.window, soon: false },
  { id: 'linux', name: 'Linux', glyph: PLATFORM_GLYPHS.prompt, soon: false },
  { id: 'android', name: 'Android', glyph: PLATFORM_GLYPHS.phone, soon: true },
  { id: 'ios', name: 'iOS', glyph: PLATFORM_GLYPHS.phone, soon: true },
]
export const MEGA_PLATFORM_COPY = {
  label: text('Platforms', 'پلتفرم‌ها'),
  soon: text('Coming soon', 'به‌زودی'),
  download: text('Download for ${platform}', 'دانلود برای ${platform}'),
}

const SVG_NS = 'http://www.w3.org/2000/svg'
/** icon as a DOM node (legacy header markup) */
export function megaIconNode(key: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '22'); svg.setAttribute('height', '22')
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); svg.setAttribute('class', 'mega-icon-svg')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', MEGA_ICONS[key] || MEGA_ICONS.about)
  svg.append(path)
  return svg
}

/** banner artwork: a mini council chamber (ten seats, decorative) or a desktop window */
export function megaBannerArt(kind: MegaBannerKind): SVGSVGElement {
  if (kind === 'flamingo') return flamingoSceneNode('panel', `${import.meta.env?.BASE_URL || '/'}assets/mark-mint.svg`)
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 160 90'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false')
  svg.setAttribute('class', `mega-banner-art is-${kind}`)
  const add = (tag: string, attrs: Record<string, string | number>) => {
    const el = document.createElementNS(SVG_NS, tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
    svg.append(el); return el
  }
  if (kind === 'whitepaper') {
    /* an open document: a page turns over the spine, mint text lines and a
       chart draw in (scaleX / opacity only; menu open only) */
    add('rect', { x: 26, y: 10, width: 108, height: 72, rx: 5, class: 'wp-book' })
    add('path', { d: 'M80 12v68', class: 'wp-spine' })
    for (let i = 0; i < 4; i++) add('rect', { x: 34, y: 22 + i * 9, width: 38 - (i % 2) * 10, height: 2.4, rx: 1.2, class: `wp-line l${i}` })
    add('path', { d: 'M90 66l8-10 7 5 9-14 10 6', class: 'wp-chart' })
    ;[[90, 66], [98, 56], [105, 61], [114, 47], [124, 53]].forEach(([cx, cy], i) => add('circle', { cx, cy, r: 2, class: `wp-dot d${i}` }))
    for (let i = 0; i < 2; i++) add('rect', { x: 88, y: 22 + i * 9, width: 34 - i * 8, height: 2.4, rx: 1.2, class: `wp-line r${i}` })
    add('path', { d: 'M80 14h46a3 3 0 0 1 3 3v58a3 3 0 0 1-3 3H80z', class: 'wp-page' })
    return svg
  }
  if (kind === 'council') {
    add('path', { d: 'M18 76A62 44 0 0 1 142 76', class: 'mega-art-arc' })
    for (let i = 0; i < 10; i++) {
      const a = Math.PI - (i * Math.PI) / 9
      add('circle', { cx: (80 + 62 * Math.cos(a)).toFixed(1), cy: (76 - 44 * Math.sin(a)).toFixed(1), r: 6, class: `mega-art-seat s${i}` })
    }
    add('path', { d: 'M64 88h32l-4-12H68z', class: 'mega-art-rostrum' })
  } else {
    /* the app window with its chart; the download arrow is a small button
       outside the window's lower corner (no overlap), its ring pulses while
       the menu is open (transform/opacity only; static under reduced motion) */
    svg.setAttribute('viewBox', '0 0 160 120') /* taller canvas: the art fills the card */
    add('rect', { x: 14, y: 10, width: 112, height: 80, rx: 6, class: 'mega-art-window' })
    add('path', { d: 'M14 22h112', class: 'mega-art-line' })
    add('path', { d: 'M24 76l14-16 10 9 18-22 12 11 16-20 14 9', class: 'mega-art-chart' })
    add('circle', { cx: 140, cy: 101, r: 11, class: 'mega-art-pulse' })
    add('circle', { cx: 140, cy: 101, r: 11, class: 'mega-art-button' })
    add('path', { d: 'M140 95v10m0 0-4-4m4 4 4-4', class: 'mega-art-down' })
  }
  return svg
}
