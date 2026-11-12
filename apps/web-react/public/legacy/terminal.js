/* ============================================================
   OPENFUND TERMINAL — UI layer
   Vela chart (LuxAlgo) + verified Gains Network market data
   + simulated demo trading engine on real marks.
   ============================================================ */
(function(){
'use strict';
const { fmt, L, PriceBoard, TradingProvider, WalletProvider, FEE_RATE } = window.OpenfundTerminal;
const G = window.OpenfundGains;

/* ---------- app state ---------- */
const board = new PriceBoard();
const wp = new WalletProvider();
let tp = null; /* created after board boot */

const S = {
  marketId: 'BTC/USD',
  tf: '1m',
  side: 'long',
  otype: 'market',
  leverage: 5,
  grouping: 1,
  dense: false,
  favorites: new Set(),
  btTab: 'positions',
  ddCategory: 'crypto',
  flashOn: true,
  stats: null
};
/* Prop ticket sizing mode: 'collateral' | 'quantity' | 'lots' */
const SZ = { mode: 'collateral' };
const $ = id => document.getElementById(id);
let meta = () => board.getMeta(S.marketId);
let mark = () => board.getMark(S.marketId);
let dp = () => (meta() ? Number(meta().pricePrecision) : 2);
let unit = () => (meta() ? meta().base : '');

/* ============================================================
   ICONS — deterministic initial badges (488 real markets)
   ============================================================ */
const CAT_COLOR = { crypto: '#2f7d5c', forex: '#3D6BE8', stocks: '#8a5cf6', indices: '#B08D3E', commodities: '#c96a1d' };
function iconHTML(symbol){
  const m = board.getMeta(symbol);
  const base = m ? m.base : symbol.split('/')[0];
  const cat = m ? m.group : 'crypto';
  const letter = (base[0] || '?').toUpperCase();
  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="${CAT_COLOR[cat] || '#2f7d5c'}"/><text x="12" y="16.5" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="Ubuntu,sans-serif">${letter}</text></svg>`;
}

/* ============================================================
   I18N — FA (default, RTL) / EN. Trading terms stay English
   in FA; financial numbers stay Latin LTR.
   ============================================================ */
const I18N = {
  en: {},
  fa: {
    'nav.trade': 'معامله', 'nav.markets': 'بازارها', 'nav.portfolio': 'پرتفوی', 'nav.more': 'بیشتر',
    'nav.notifications': 'اطلاع‌رسانی‌ها',
    'st.last': 'آخرین', 'st.oracle': 'اندیس', 'st.change': 'تغییر ۲۴ساعته',
    'st.high': 'سقف ۲۴ساعته', 'st.low': 'کف ۲۴ساعته',
    'st.vol': 'حجم ۲۴ساعته', 'st.oi': 'موقعیت‌های باز', 'st.funding': 'فاندینگ ۱ساعته', 'st.lev': 'حداکثر اهرم',
    'dd.searchPh': 'جست‌وجوی بازار…', 'dd.market': 'بازار', 'dd.price': 'قیمت', 'dd.24h': '۲۴ساعته',
    'dd.noMatch': 'بازاری با این عبارت پیدا نشد.',
    'dd.funding': 'فاندینگ', 'dd.oil': 'OI لانگ', 'dd.ois': 'OI شورت', 'dd.hol': 'هولدینگ لانگ', 'dd.hos': 'هولدینگ شورت', 'dd.closed': 'بسته',
    'dd.foot': 'بازارهای Gains Network — دادهٔ واقعی · بازارهای بسته فقط قابل مشاهده‌اند',
    'cat.crypto': 'رمزارز', 'cat.forex': 'فارکس', 'cat.stocks': 'سهام', 'cat.indices': 'شاخص', 'cat.commodity': 'کالا',
    'book.tab': 'اوردربوک', 'book.tradesTab': 'تریدها',
    'book.grouping': 'گروینگ', 'book.compact': 'فشرده', 'book.simulated': 'شبیه‌سازی‌شده',
    'book.price': 'قیمت', 'book.size': 'اندازه', 'book.total': 'جمع', 'book.time': 'زمان',
    'book.note': 'دفتر مجازی برای نمایش ساخته شده — Gains دفتر سفارش ارائه نمی‌دهد؛ این عمق واقعی نیست.',
    'book.spread': 'اسپرد',
    'trades.note': 'معاملات نمایشی مشتق از قیمت Mark — نوار معاملات واقعی توسط Gains ارائه نمی‌شود.',
    'ac.equity': 'ارزش حساب', 'ac.available': 'قابل استفاده', 'ac.margin': 'مارژین در استفاده',
    'ac.unrealized': 'سود/زیان شناور', 'ac.positions': 'موقعیت‌ها', 'ac.orders': 'سفارش‌ها',
    'ac.mode': 'حالت', 'ac.modeVal': 'Cross · شبیه‌سازی‌شده', 'ac.title': 'خلاصه حساب',
    /* Quick Trade (Chart tab) */
    "qt.aria": "معامله سریع",
    "qt.buy": "خرید",
    "qt.sell": "فروش",
    "qt.amount": "مبلغ (USD)",
    "qt.longTitle": "خرید / Long",
    "qt.shortTitle": "فروش / Short",
    "qt.submitLong": "ثبت خرید / Long",
    "qt.submitShort": "ثبت فروش / Short",
    "qt.sending": "در حال ارسال…",
    "qt.mark": "مارک",
    "qt.stale": "قدیمی",
    "qt.noPrice": "قیمت زنده در دسترس نیست.",
    "qt.invalid": "مبلغ معتبر وارد کنید.",
    "qt.close": "بستن پنل سفارش",
    "qt.note": "قیمت مارک صرفاً راهنماست؛ قیمت اجرا را موتور اجرا تعیین می‌کند.",
    'lev': 'اهرم',
    'of.price': 'قیمت تریگر / لیمیت <em>USD</em>', 'of.collateral': 'کولترال / وثیقه <em>USD</em>', 'of.priceTh': 'تریگر / لیمیت',
    'of.size': 'اندازه', 'of.notional': 'نوشنال',
    'sz.collateral': 'کولترال / وثیقه', 'sz.collateralShort': 'کولترال / وثیقه', 'sz.quantity': 'اندازه نماد', 'sz.lots': 'لات',
    'sz.qtyLabel': 'اندازه نماد', 'sz.lotsLabel': 'لات', 'pos.entry': 'نقطه ورود',
    'ctab.chart': 'نمودار', 'ctab.news': 'اخبار و اطلاعات', 'news.loading': 'در حال بارگذاری تقویم اقتصادی…',
    'news.unavailable': 'تقویم اقتصادی در حال حاضر در دسترس نیست.', 'news.retry': 'تلاش دوباره', 'news.source': 'منبع: TradingView',
    'news.localeNote': 'این تقویم زبان فارسی ندارد و به انگلیسی نمایش داده می‌شود.',
    'of.sl': 'استاپ‌لاس <em>USD · اختیاری</em>', 'of.tp': 'تیک‌پرافیت <em>USD · اختیاری</em>',
    'rk.entry': 'نقطه ورود تخمینی', 'rk.oracle': 'قیمت اندیس', 'rk.liq': 'لیکوییدیشن تخمینی',
    'rk.margin': 'مارجین تخمینی', 'rk.fee': 'کارمزد تخمینی (اوپن)', 'rk.impact': 'اثر قیمت',
    'rk.impactVal': '—', 'rk.maxloss': 'برآورد سود و زیان در SL',
    'submit.long': 'بررسی سفارش — لانگ', 'submit.short': 'بررسی سفارش — شورت',
    'side.long': 'لانگ', 'side.short': 'شورت',
    'ot.market': 'مارکت', 'ot.limit': 'لیمیت', 'ot.stop': 'استاپ',
    'demoBanner': 'حالت دمو — هیچ سفارش واقعی ثبت نمی‌شود',
    'bt.positions': 'موقعیت‌ها', 'bt.orders': 'سفارش‌های باز', 'bt.history': 'تاریخچهٔ سفارش‌ها',
    'bt.fills': 'فیلز', 'bt.funding': 'فاندینگ',
    'th.entry': 'نقطه ورود', 'th.mark': 'مارک', 'th.liq': 'لیکوییدیشن', 'th.sltp': 'استاپ‌لاس / تیک‌پرافیت', 'th.collateral': 'کولترال', 'th.unrealized': 'سود/زیان شناور',
    'bt.empty': 'فعالیتی در این حساب شبیه‌سازی‌شده ثبت نشده است.',
    'bt.loadDemo': 'بارگذاری سناریوی دمو',
    'bt.hint': 'دو موقعیت، یک سفارش Limit در انتظار و تاریخچه می‌سازد تا ترمینال را کاوش کنی.',
    'th.market': 'بازار', 'th.side': 'سمت', 'th.size': 'اندازه', 'th.lev': 'اهرم',
    'th.actions': 'عملیات', 'th.type': 'نوع', 'th.status': 'وضعیت', 'th.created': 'زمان ایجاد',
    'th.price': 'قیمت', 'th.result': 'نتیجه', 'th.time': 'زمان', 'th.payment': 'پرداخت', 'th.fee':'کارمزد', 'th.role':'نقش', 'th.rate':'نرخ (۱ ساعت)',
    'dlg.review': 'بررسی سفارش', 'dlg.cancel': 'لغو', 'dlg.confirm': 'تأیید',
    'dlg.confirmOrder': 'تأیید سفارش شبیه‌سازی‌شده', 'dlg.save': 'ذخیره', 'dlg.close': 'بستن',
    'rv.market': 'بازار', 'rv.dir': 'جهت', 'rv.otype': 'نوع سفارش', 'rv.lev': 'اهرم',
    'rv.size': 'اندازه', 'rv.notional': 'Notional', 'rv.collateral': 'Collateral',
    'rv.entry': 'نقطه ورود تخمینی', 'rv.oracle': 'اندیس', 'rv.liq': 'لیکوییدیشن تخمینی',
    'rv.fee': 'کارمزد تخمینی (open)', 'rv.sl': 'Stop Loss', 'rv.tp': 'Take Profit',
    'rv.equityAfter': 'ارزش حساب پس از سفارش', 'rv.exec': 'شبیه‌سازی‌شده — موتور محلی',
    'rv.side.long': 'لانگ', 'rv.side.short': 'شورت',
    'cf.close': 'بستن موقعیت', 'cf.closeTxt': 'این موقعیت شبیه‌سازی‌شده در قیمت Mark فعلی بسته شود؟ سود/زیان شناور و کارمزد بستن اعمال می‌شود.',
    'cf.cancel': 'لغو سفارش', 'cf.cancelTxt': 'این سفارش شبیه‌سازی‌شدهٔ در انتظار حذف شود؟',
    'cf.detail': 'جزئیات موقعیت', 'sltp.title': 'مدیریت سود و ضرر',
    'pos.details': ['موقعیت', 'بازار', 'جهت', 'اندازه', 'قیمت ورود', 'قیمت مارک', 'اهرم', 'کولترال', 'لیکوییدیشن تخمینی', 'سود/زیان شناور', 'استاپ‌لاس / تیک‌پرافیت', 'زمان باز شدن', 'کارمزد باز شدن'],
    'act.close': 'بستن', 'act.sltp': 'SL/TP', 'act.details': 'جزئیات', 'act.cancel': 'لغو',
    'act.share': 'اشتراک‌گذاری',
    'share.title': 'اشتراک‌گذاری سود و زیان', 'share.download': 'دانلود PNG', 'share.native': 'اشتراک‌گذاری', 'share.close': 'بستن',
    'share.unrealized': 'سود/زیان شناور', 'share.realized': 'سود/زیان تحقق‌یافته',
    'share.entry': 'قیمت ورود', 'share.mark': 'قیمت فعلی', 'share.exit': 'قیمت بسته شدن', 'share.size': 'اندازه',
    'share.opened': 'زمان باز شدن', 'share.closedAt': 'زمان بسته شدن',
    'share.open': 'باز', 'share.closed': 'بسته‌شده', 'share.buy': 'خرید', 'share.sell': 'فروش',
    'share.live': 'قیمت زنده', 'share.stale': 'قیمت با تأخیر', 'share.gone': 'پوزیشن دیگر باز نیست',
    'share.liveNote': 'سود و زیان این پوزیشن باز با دادهٔ زندهٔ حساب به‌روز می‌شود.', 'share.finalNote': 'نتیجهٔ نهایی ثبت‌شده برای این پوزیشن بسته‌شده.',
    'share.profit': 'سود', 'share.loss': 'زیان', 'share.openAt': 'ورود', 'share.closeAt': 'خروج', 'share.markAt': 'فعلی',
    'share.saved': 'تصویر ذخیره شد.', 'share.failed': 'ساخت تصویر ممکن نشد. دوباره تلاش کنید.', 'share.na': 'نامشخص',
    'tag.pending': 'در انتظار',
    'res.filled': 'انجام‌شده', 'res.cancelled': 'لغو‌شده', 'res.closed-profit': 'بسته با سود', 'res.closed-loss': 'بسته با زیان',
    'res.stop-loss': 'استاپ‌لاس', 'res.take-profit': 'تیک‌پرافیت', 'res.market-close': 'بستن مارکت', 'res.liquidation': 'لیکویید شد',
    'res.filled': 'فیل شد', 'res.cancelled': 'کنسل شد',
    'empty.positions': 'موقعیت بازی وجود ندارد. از پنل سفارش یکی باز کن یا سناریوی دمو را بارگذاری کن.',
    'empty.orders': 'سفارش بازی وجود ندارد.',
    'empty.history': 'هنوز تاریخچهٔ سفارشی وجود ندارد.',
    'empty.fills': 'هنوز معامله‌ای انجام نشده است.',
    'empty.funding': 'هنوز پرداخت فاندینگی وجود ندارد — فاندینگ شبیه‌سازی‌شده به موقعیت‌های دمو اعمال می‌شود.',
    'sb.source': 'داده‌ها: Gains Network',
    'sb.tick': 'قیمت زنده', 'sb.assumptions': 'مفروضات دمو',
    'sb.version': 'ترمینال اوپن‌فاند نسخهٔ ۱٫۰', 'sb.support': 'پشتیبانی',
    'mkt.closed': 'این بازار بسته است — امکان ترید نیست، فقط مشاهدهٔ چارت.',
    'cat.all': 'همه',
    'sb.live': 'زنده', 'sb.reconnecting': 'اتصال مجدد…', 'sb.connecting': 'در حال اتصال…', 'sb.stale': 'قدیمی',
    'asm.title': 'مفروضات دمو',
    'asm.fees': '<b>کارمزد:</b> کارمزد taker ثابت ۰٫۰۵٪ از Notional در باز و بستن. کارمزد maker صفر.',
    'asm.margin': '<b>Margin:</b> مارجین اولیه = Notional ÷ اهرم. حالت Cross، بدون مارجین جزئی.',
    'asm.liq': '<b>Liquidation:</b> ساده‌شده — Entry × (۱ ∓ (۱/اهرم − ۰٫۵٪ نگهداشت)). صرافی‌های واقعی از نگهداشت پلکانی استفاده می‌کنند.',
    'asm.exec': '<b>اجرا:</b> سفارش Market در قیمت Mark واقعی Gains و بدون Slippage انجام می‌شود. سفارش‌های Limit و Stop با عبور Mark از قیمت تریگر فعال می‌شوند.',
    'asm.prices': '<b>قیمت‌ها:</b> دادهٔ واقعی Gains Network (REST + WebSocket). خودمان قیمت نمی‌سازیم.',
    'asm.book': '<b>Order Book:</b> Gains دفتر سفارش ارائه نمی‌دهد؛ کتاب نمایشی ما شبیه‌سازی است و نمایندهٔ نقدینگی واقعی نیست.',
    'asm.funding': '<b>فاندینگ:</b> نرخ ساعتی واقعی از متادیتای Gains نمایش داده می‌شود؛ اعمال پرداخت‌ها فقط در سناریوی دمو.',
    'asm.note': 'این قواعد مدل اجرای dYdX، Gains Network یا هیچ سیستم عملیاتی را بازتولید نمی‌کنند.',
    'set.title': 'تنظیمات',
    'set.note': 'ذخیره‌سازی تنظیمات برای فاز بعدی برنامه‌ریزی شده است.',
    'set.tick': 'نمایش قیمت زنده', 'set.flash': 'فلاش قیمت ردیف‌ها', 'set.sound': 'صدای اجرا (غیرفعال)',
    'notif.title': 'اطلاع‌رسانی‌ها',
    'notif.empty': 'هنوز اطلاع‌رسانی‌ای نیست. اجراهای شبیه‌سازی‌شده اینجا نمایش داده می‌شوند.',
    'toast.position': 'موقعیت شبیه‌سازی‌شده باز شد.',
    'toast.order': 'سفارش در انتظارِ شبیه‌سازی‌شده ایجاد شد.',
    'toast.wallet': 'اتصال کیف پول شبیه‌سازی‌شده — فقط دمو.',
    'toast.noPrice': 'قیمت زنده در دسترس نیست.',
    'chart.loading': 'در حال دریافت کندل‌های Gains…',
    'chart.error': 'دریافت کندل ممکن نشد.',
    'chart.retry': 'تلاش دوباره',
    'chart.unavailable': 'چارت در دسترس نیست',
    'chart.msg': 'کتابخانهٔ Vela بارگذاری نشد.',
    'boot.loading': 'در حال اتصال به Gains Network…',
    'boot.failed': 'اتصال به Gains Network برقرار نشد.',
    'boot.retry': 'تلاش دوباره'
  }
};
const EN = {
  'nav.trade': 'Trade', 'nav.markets': 'Markets', 'nav.portfolio': 'Portfolio', 'nav.more': 'More',
  'nav.notifications': 'Notifications',
  'st.last': 'Last', 'st.oracle': 'Index', 'st.change': '24h Change', 'st.high': '24h High',
  'st.low': '24h Low', 'st.vol': '24h Volume', 'st.oi': 'Open Interest', 'st.funding': 'Funding 1h',
  'st.lev': 'Max Leverage',
  'dd.searchPh': 'Search market…', 'dd.market': 'Market', 'dd.price': 'Price', 'dd.24h': '24h',
  'dd.noMatch': 'No market matches this search.',
  'dd.funding': 'Funding', 'dd.oil': 'OI (L)', 'dd.ois': 'OI (S)', 'dd.hol': 'Holding (L)', 'dd.hos': 'Holding (S)', 'dd.closed': 'CLOSED',
  'dd.foot': 'Gains Network markets — verified data · closed markets are view-only',
  'cat.crypto': 'Crypto', 'cat.forex': 'Forex', 'cat.stocks': 'Stocks', 'cat.indices': 'Indices', 'cat.commodity': 'Commodities',
  'book.tab': 'Order Book', 'book.tradesTab': 'Trades',
  'book.grouping': 'Grouping', 'book.compact': 'Compact', 'book.simulated': 'simulated',
  'book.price': 'Price', 'book.size': 'Size', 'book.total': 'Total', 'book.time': 'Time',
  'book.note': 'Presentation-only virtual book — Gains does not provide an order book; this is not real depth.',
  'book.spread': 'spread',
  'trades.note': 'Presentation trades derived from the Gains mark price — Gains provides no trade tape.',
  'ac.equity': 'Equity', 'ac.available': 'Available', 'ac.margin': 'Margin used',
  'ac.unrealized': 'Unrealized', 'ac.positions': 'Positions', 'ac.orders': 'Orders',
  'ac.mode': 'Mode', 'ac.modeVal': 'Cross · Simulated', 'ac.title': 'Account summary',
  /* Quick Trade (Chart tab); ar/ru/zh-CN live in terminal-locales.js */
  "qt.aria": "Quick trade",
  "qt.buy": "Buy",
  "qt.sell": "Sell",
  "qt.amount": "Amount (USD)",
  "qt.longTitle": "Buy / Long",
  "qt.shortTitle": "Sell / Short",
  "qt.submitLong": "Place Buy / Long",
  "qt.submitShort": "Place Sell / Short",
  "qt.sending": "Sending…",
  "qt.mark": "mark",
  "qt.stale": "stale",
  "qt.noPrice": "Live price unavailable.",
  "qt.invalid": "Enter a valid amount.",
  "qt.close": "Close order panel",
  "qt.note": "Indicative mark price. The fill price is set by the execution engine.",
  'lev': 'Leverage',
  'of.price': 'Trigger / Limit price <em>USD</em>', 'of.collateral': 'Collateral <em>USD</em>',
  'of.size': 'Size', 'of.notional': 'Notional',
  'sz.collateral': 'Collateral', 'sz.collateralShort': 'Collateral', 'sz.quantity': 'Quantity', 'sz.lots': 'Lots',
  'sz.qtyLabel': 'Quantity', 'sz.lotsLabel': 'Lots', 'pos.entry': 'Entry',
  'ctab.chart': 'Chart', 'ctab.news': 'News & Information', 'news.loading': 'Loading the economic calendar…',
  'news.unavailable': 'The economic calendar is unavailable right now.', 'news.retry': 'Retry', 'news.source': 'Source: TradingView',
  'news.localeNote': '',
  'of.sl': 'Stop Loss <em>USD · optional</em>', 'of.tp': 'Take Profit <em>USD · optional</em>',
  'rk.entry': 'Est. entry', 'rk.oracle': 'Index price', 'rk.liq': 'Est. liquidation',
  'rk.margin': 'Est. margin', 'rk.fee': 'Est. fee (open)', 'rk.impact': 'Price impact',
  'rk.impactVal': 'N/A', 'rk.maxloss': 'Est. PnL at SL',
  'submit.long': 'Review order — Long', 'submit.short': 'Review order — Short',
  'side.long': 'Long', 'side.short': 'Short',
  'ot.market': 'Market', 'ot.limit': 'Limit', 'ot.stop': 'Stop',
  'of.priceTh': 'Trigger / Limit',
  'th.entry': 'Entry', 'th.mark': 'Mark', 'th.liq': 'Liq. price', 'th.sltp': 'SL / TP', 'th.collateral': 'Collateral', 'th.unrealized': 'Unrealized PnL',
  'mkt.closed': 'This market is closed — viewing only, no trading.',
  'cat.all': 'All',
  'demoBanner': 'Demo Mode — No Real Orders Are Submitted',
  'bt.positions': 'Positions', 'bt.orders': 'Open Orders', 'bt.history': 'Order History',
  'bt.fills': 'Fills', 'bt.funding': 'Funding',
  'bt.empty': 'No activity in this simulated account.',
  'bt.loadDemo': 'Load demo scenario',
  'bt.hint': 'Seeds two positions, one pending limit order and history so you can explore the terminal.',
  'th.market': 'Market', 'th.side': 'Side', 'th.size': 'Size', 'th.lev': 'Lev',
  'th.actions': 'Actions', 'th.type': 'Type', 'th.status': 'Status', 'th.created': 'Created',
  'th.price': 'Price', 'th.result': 'Result', 'th.time': 'Time', 'th.payment': 'Payment', 'th.fee':'Fee', 'th.role':'Role', 'th.rate':'Rate (1h)',
  'dlg.review': 'Order review', 'dlg.cancel': 'Cancel', 'dlg.confirm': 'Confirm',
  'dlg.confirmOrder': 'Confirm simulated order', 'dlg.save': 'Save', 'dlg.close': 'Close',
  'rv.market': 'Market', 'rv.dir': 'Direction', 'rv.otype': 'Order type', 'rv.lev': 'Leverage',
  'rv.size': 'Size', 'rv.notional': 'Notional', 'rv.collateral': 'Collateral',
  'rv.entry': 'Est. entry', 'rv.oracle': 'Index', 'rv.liq': 'Est. liquidation',
  'rv.fee': 'Est. fee (open)', 'rv.sl': 'Stop Loss', 'rv.tp': 'Take Profit',
  'rv.equityAfter': 'Equity after', 'rv.exec': 'Simulated — local engine',
  'rv.side.long': 'Long', 'rv.side.short': 'Short',
  'pos.details': ['Position', 'Market', 'Side', 'Size', 'Entry', 'Mark', 'Leverage', 'Collateral', 'Est. liquidation', 'Unrealized PnL', 'SL / TP', 'Opened', 'Opening fee'],
  'cf.close': 'Close position', 'cf.closeTxt': 'Close this simulated position at the current mark price? Unrealized PnL and a closing fee will be applied.',
  'cf.cancel': 'Cancel order', 'cf.cancelTxt': 'Remove this pending simulated order?',
  'cf.detail': 'Position details', 'sltp.title': 'Modify risk',
  'act.close': 'Close', 'act.sltp': 'SL/TP', 'act.details': 'Details', 'act.cancel': 'Cancel',
  'act.share': 'Share',
  'share.title': 'Share P&L', 'share.download': 'Download PNG', 'share.native': 'Share', 'share.close': 'Close',
  'share.unrealized': 'Unrealized P&L', 'share.realized': 'Realized P&L',
  'share.entry': 'Entry price', 'share.mark': 'Current price', 'share.exit': 'Closing price', 'share.size': 'Size',
  'share.opened': 'Opened', 'share.closedAt': 'Closed',
  'share.open': 'OPEN', 'share.closed': 'CLOSED', 'share.buy': 'BUY', 'share.sell': 'SELL',
  'share.live': 'Live price', 'share.stale': 'Price delayed', 'share.gone': 'Position no longer open',
  'share.liveNote': 'P&L for this open position updates from your live account data.', 'share.finalNote': 'Recorded final result for this closed position.',
  'share.profit': 'PROFIT', 'share.loss': 'LOSS', 'share.openAt': 'OPEN', 'share.closeAt': 'CLOSE', 'share.markAt': 'NOW',
  'share.saved': 'Image saved.', 'share.failed': 'Could not create the image. Try again.', 'share.na': 'N/A',
  'tag.pending': 'pending',
  'res.filled': 'filled', 'res.cancelled': 'cancelled', 'res.closed-profit': 'closed-profit',
  'res.closed-loss': 'closed-loss', 'res.stop-loss': 'Stop Loss', 'res.take-profit': 'Take Profit',
  'res.market-close': 'market-close', 'res.liquidation': 'liquidation',
  'empty.positions': 'No open positions. Open one from the order panel or load the demo scenario.',
  'empty.orders': 'No open orders.',
  'empty.history': 'No order history yet.',
  'empty.fills': 'No fills yet.',
  'empty.funding': 'No funding payments yet.',
  'sb.source': 'Data: Gains Network',
  'sb.tick': 'live', 'sb.assumptions': 'Demo assumptions',
  'sb.version': 'Openfund Terminal v1.0', 'sb.support': 'Support',
  'sb.live': 'Live', 'sb.reconnecting': 'Reconnecting…', 'sb.connecting': 'Connecting…', 'sb.stale': 'stale',
  'asm.title': 'Demo assumptions',
  'asm.fees': '<b>Fees:</b> flat 0.05% taker fee on notional at open and close. Maker fee 0%.',
  'asm.margin': '<b>Margin:</b> initial margin = notional / leverage. Cross mode, no partial margin.',
  'asm.liq': '<b>Liquidation:</b> simplified — entry × (1 ∓ (1/leverage − 0.5% maintenance)). Real venues use tiered maintenance margins.',
  'asm.exec': '<b>Execution:</b> market orders fill at the real Gains mark price with zero slippage. Limit and stop orders trigger when the mark crosses the trigger price.',
  'asm.prices': '<b>Prices:</b> real Gains Network data (REST + WebSocket). We never fabricate prices.',
  'asm.book': '<b>Order book:</b> Gains provides no order book; our presentation book is simulated and does not represent real liquidity.',
  'asm.funding': '<b>Funding:</b> real hourly rates shown from Gains metadata; payments only applied in the demo scenario.',
  'asm.note': 'These rules do not reproduce dYdX, Gains Network or any production execution model.',
  'set.title': 'Settings',
  'set.note': 'Settings persistence is planned for a later phase.',
  'set.tick': 'Live price display', 'set.flash': 'Row price flash', 'set.sound': 'Execution sound (unavailable)',
  'notif.title': 'Notifications',
  'notif.empty': 'No notifications yet. Simulated executions will appear here.',
  'toast.position': 'Simulated position opened.', 'toast.order': 'Simulated pending order created.',
  'toast.wallet': 'Simulated wallet connection — demo only.',
  'toast.noPrice': 'Live price unavailable.',
  'chart.loading': 'Loading Gains candles…', 'chart.error': 'Could not load candles.',
  'chart.retry': 'Retry', 'chart.unavailable': 'Chart unavailable',
  'chart.msg': 'The Vela library failed to load.',
  'boot.loading': 'Connecting to Gains Network…',
  'boot.failed': 'Could not reach Gains Network.',
  'boot.retry': 'Retry'
};
Object.assign(I18N.en, EN);
/* added interface locales (legacy/terminal-locales.js): every key falls
   back to English, never to Persian */
const ADDED_LOCALES = window.OpenfundTerminalLocales || {};
for (const __l of ['ar', 'ru', 'zh-CN']) I18N[__l] = Object.assign({}, EN, ADDED_LOCALES[__l] || {});
const RTL_LOCALES = ['fa', 'ar'];
/* CMS overrides keep the shape of the built-in entry. Directus stores every
   translation as text, so list entries (e.g. the position-details labels)
   arrive as a JSON string; indexing that string produced one-character
   labels. Lists are accepted only when they parse to a list of the same
   length, otherwise the built-in labels stay in place. */
function cmsValue(builtIn, value){
  if (value == null || value === '') return undefined;
  if (!Array.isArray(builtIn)) return typeof value === 'string' ? value : undefined;
  let list = value;
  if (typeof list === 'string') { try { list = JSON.parse(list); } catch(e){ return undefined; } }
  return Array.isArray(list) && list.length === builtIn.length && list.every(x => typeof x === 'string' && x) ? list : undefined;
}
if(window.ofCmsTerminal){for(var __k in window.ofCmsTerminal){var __v=window.ofCmsTerminal[__k];if(__v&&typeof __v==='object'){for(var __l in I18N){if(I18N[__l][__k]!==undefined){var __c=cmsValue(I18N[__l][__k],__v[__l]);if(__c!==undefined)I18N[__l][__k]=__c;}}}}}
window.ofLang = I18N[window.ofLang] ? window.ofLang : 'fa';
function t(key){
  const v = (I18N[window.ofLang] && I18N[window.ofLang][key]);
  return v === undefined ? key : v;
}
/* Static English markup without data-i18n keys (aria-labels, titles,
   placeholders, captions): fa uses the reviewed staticFa map, ar/ru/zh-CN
   the app dictionaries through the parent document (misses are reported
   there). Only nodes present in the template are tracked; dynamic text is
   produced by t() and never re-processed. */
const STATIC_TEXT = window.OpenfundTerminalStaticText || {};
const staticText = new Map(), staticAttrs = new Map();
let staticCaptured = false, staticObserver = null;
function staticValue(source){
  const lang = window.ofLang;
  if (lang === 'en' || !/[A-Za-z]{2}/.test(source)) return source;
  const own = STATIC_TEXT[lang] && STATIC_TEXT[lang][source];
  if (own) return own;
  if (lang === 'fa') return source;
  let tx = null;
  try { tx = window.parent && window.parent !== window && window.parent.__ofTranslateText; } catch (e) { tx = null; }
  return typeof tx === 'function' ? tx(lang, source) : source;
}
function translateStaticMarkup(){
  if (!staticCaptured) {
    staticCaptured = true;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const el = n.parentElement;
      if (!el || el.closest('script,style,[data-i18n],[data-i18n-p],.num,[data-no-static-i18n]')) continue;
      const v = n.nodeValue.trim();
      if (/[A-Za-z]{2}/.test(v) && !/[\u0600-\u06ff]/.test(v)) staticText.set(n, n.nodeValue);
    }
    document.querySelectorAll('[aria-label],[title],[placeholder]').forEach(el => {
      if (el.closest('[data-i18n-p]')) return;
      const keep = {};
      for (const a of ['aria-label', 'title', 'placeholder']) {
        const v = el.getAttribute(a);
        if (v && /[A-Za-z]{2}/.test(v) && !/[\u0600-\u06ff]/.test(v)) keep[a] = v;
      }
      if (Object.keys(keep).length) staticAttrs.set(el, keep);
    });
  }
  if (!staticObserver && typeof MutationObserver === 'function') {
    /* chart toolbar tooltips are created later by the chart library */
    staticObserver = new MutationObserver(records => {
      for (const r of records) for (const node of (r.type === 'attributes' ? [r.target] : r.addedNodes)) {
        if (!(node instanceof Element)) continue;
        if (r.type !== 'attributes') {
          const tw = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          let tn;
          while ((tn = tw.nextNode())) {
            const v = tn.nodeValue.trim();
            if (v && STATIC_TEXT.fa && STATIC_TEXT.fa[v] && !staticText.has(tn)) { staticText.set(tn, tn.nodeValue); const out = tn.nodeValue.replace(v, staticValue(v)); if (out !== tn.nodeValue) tn.nodeValue = out; }
          }
        }
        [node, ...node.querySelectorAll('[title],[aria-label]')].forEach(el => {
          for (const a of ['title', 'aria-label']) {
            const v = el.getAttribute && el.getAttribute(a);
            if (!v || !STATIC_TEXT.fa || !STATIC_TEXT.fa[v]) continue;
            const keep = staticAttrs.get(el) || {}; keep[a] = v; staticAttrs.set(el, keep);
            const out = staticValue(v); if (out !== v) el.setAttribute(a, out);
          }
        });
      }
    });
    staticObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['title', 'aria-label'] });
  }
  staticText.forEach((source, node) => {
    const trimmed = source.trim(), out = source.replace(trimmed, staticValue(trimmed));
    if (node.nodeValue !== out) node.nodeValue = out;
  });
  staticAttrs.forEach((attrs, el) => {
    for (const [a, v] of Object.entries(attrs)) { const out = staticValue(v); if (el.getAttribute(a) !== out) el.setAttribute(a, out); }
  });
}
function applyStaticI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-p]').forEach(el => { el.placeholder = t(el.dataset.i18nP); });
  translateStaticMarkup();
  /* The HEADER follows the language direction (rtl/fa, ltr/en); the main
     workspace is pinned LTR in CSS (.workspace{direction:ltr}) so the trade
     panel is always on the right and the chart stays in its default state. */
  document.documentElement.setAttribute('lang', window.ofLang);
  document.documentElement.setAttribute('dir', RTL_LOCALES.includes(window.ofLang) ? 'rtl' : 'ltr');
  document.title = 'Openfund Terminal — ' + t('nav.trade');
  $('lang-label').textContent = window.ofLang === 'fa' ? 'EN' : 'FA';
}
function setLang(lang){
  window.ofLang = lang;
  applyStaticI18n();
  setSide(S.side);
  renderCats();
  renderDropdown(ddOpen ? $('market-search').value : '');
  renderMarketStats();
  renderBook(); renderTrades();
  computeForm(); renderAccount(); renderBottom();
  renderStatus();
}
$('language-toggle').addEventListener('click', () => setLang(window.ofLang === 'fa' ? 'en' : 'fa'));
/* the React shell applies its route locale through this hook */
/* Read-mostly diagnostics for browser acceptance tests and support: the
   live chart controller, the symbol, and which drawings are live position
   overlays (never persisted) vs user drawings (persisted per wallet). */
/* ============================================================
   NEWS & INFORMATION — official TradingView Economic Calendar widget
   (Web Component <tv-economic-calendar>, ES module from
   widgets.tradingview-widget.com; it renders its own iframe from
   www.tradingview-widget.com with the required TradingView attribution).
   Informational only: no prices, orders or risk rules read it. The chart
   stays mounted underneath (this panel overlays it), so switching tabs never
   resets the market, timeframe, drawings, indicators or account context.
   Persian is not a supported widget locale; fa falls back to English.
   ============================================================ */
const NEWS = { state: 'idle', el: null, timer: null };
const NEWS_LOCALES = { en: 'en', fa: 'en', ar: 'ar_AE', ru: 'ru', 'zh-CN': 'zh_CN' };
function newsTheme(){ return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'; }
function newsStatus(kind){
  const box = $('news-state');
  if (!box) return;
  box.dataset.state = kind;
  if (kind === 'ready'){ box.innerHTML = t('news.localeNote') ? `<small>${esc(t('news.localeNote'))}</small>` : ''; return; }
  box.innerHTML = kind === 'loading'
    ? `<span class="news-spinner" aria-hidden="true"></span><span>${esc(t('news.loading'))}</span>`
    : `<span>${esc(t('news.unavailable'))}</span> <button type="button" class="ghost-btn" id="news-retry">${esc(t('news.retry'))}</button>`;
  $('news-retry')?.addEventListener('click', () => { NEWS.state = 'idle'; loadNews(); });
}
function loadNews(){
  if (NEWS.state === 'loading' || NEWS.state === 'ready') return;
  NEWS.state = 'loading'; newsStatus('loading');
  const fail = () => { if (NEWS.state !== 'loading') return; NEWS.state = 'failed'; clearTimeout(NEWS.timer); newsStatus('failed'); };
  NEWS.timer = setTimeout(fail, 20000);
  if (!customElements.get('tv-economic-calendar') && !document.getElementById('tv-calendar-module')){
    const sc = document.createElement('script');
    sc.type = 'module'; sc.id = 'tv-calendar-module';
    sc.src = `https://widgets.tradingview-widget.com/w/${NEWS_LOCALES[window.ofLang] || 'en'}/tv-economic-calendar.js`;
    sc.onerror = () => { sc.remove(); fail(); };
    document.head.appendChild(sc);
  }
  customElements.whenDefined('tv-economic-calendar').then(() => {
    if (NEWS.state !== 'loading') return;
    clearTimeout(NEWS.timer);
    if (!NEWS.el){
      NEWS.el = document.createElement('tv-economic-calendar');
      NEWS.el.setAttribute('theme', newsTheme());
      $('news-host').appendChild(NEWS.el);
    }
    NEWS.state = 'ready'; newsStatus('ready');
  });
}
function setChartTab(tab){
  const news = tab === 'news';
  $('news-panel').hidden = !news;
  document.querySelectorAll('[data-chart-tab]').forEach(b => {
    const on = b.dataset.chartTab === tab;
    b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
  });
  if (news) loadNews();
}
document.querySelectorAll('[data-chart-tab]').forEach(b => {
  b.addEventListener('click', () => setChartTab(b.dataset.chartTab));
  b.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = b.dataset.chartTab === 'chart' ? 'news' : 'chart';
    setChartTab(next); document.querySelector(`[data-chart-tab="${next}"]`)?.focus();
  });
});
/* the theme toggle and the compact "News" workspace view drive the panel */
new MutationObserver(() => { NEWS.el?.setAttribute('theme', newsTheme()); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
new MutationObserver(() => {
  const v = document.body.dataset.workspaceView;
  if (v === 'news') setChartTab('news'); else if (v === 'chart') setChartTab('chart');
}).observe(document.body, { attributes: true, attributeFilter: ['data-workspace-view'] });

window.OpenfundTerminalInspect = {
  chart: () => vc && vc.chart,
  controller: () => vc,
  symbol: () => S.marketId,
  /* true once the saved drawings of the current identity are restored */
  restored: () => velaRestored,
  positionOverlays: () => { const all = vc?.chart?.drawings?.all?.() || []; return [...posDrawings].map(([positionId, id]) => ({ positionId, drawing: all.find(d => d.id === id) || null })); },
  userDrawings: () => { const ids = managedDrawingIds(); return (vc?.chart?.drawings?.all?.() || []).filter(d => !ids.has(d.id)); },
  entryBoundaries: () => { const all = vc?.chart?.drawings?.all?.() || []; return [...entryDrawings].map(([positionId, e]) => ({ positionId, drawing: all.find(d => d.id === e.id) || null })); },
  executionMarkers: () => { const all = vc?.chart?.drawings?.all?.() || []; return [...execMarkers].map(([key, m]) => ({ key, drawing: all.find(d => d.id === m.id) || null })); },
};
window.__ofSetLang = lang => { if (I18N[lang] && lang !== window.ofLang) setLang(lang); };

/* ============================================================
   THEME — dark (default) / light, synced with Vela
   ============================================================ */
let curTheme = document.documentElement.dataset.theme || 'dark';
function setTheme(theme){
  curTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  $('theme-toggle').textContent = theme === 'dark' ? '◐' : '◑';
  try{ localStorage.setItem('of-theme', theme) }catch(e){}
  window.__openfundChart?.setTheme(theme);
}
window.__openfundApplyTheme = setTheme;
$('theme-toggle').addEventListener('click', () => setTheme(curTheme === 'dark' ? 'light' : 'dark'));

/* ============================================================
   VELA CHART
   ============================================================ */
let vc = null;             /* OpenfundCharts controller */
let chartReady = false;

function chartOverlay(html){
  const msg = $('chart-msg');
  if (!msg) return;   /* teardown race guard */
  if (!html){ msg.hidden = true; return; }
  msg.hidden = false;
  msg.innerHTML = '<span>' + html + '</span>';
}

function initChart(){
  if (!window.OpenfundCharts){ chartOverlay(`<b>${t('chart.unavailable')}</b><br>${t('chart.msg')}`); return; }
  try{
    /* full Vela workspace: native topbar (symbol / timeframe / style /
       indicators), drawing toolbar, status line, symbol search, keyboard */
    vc = window.OpenfundCharts.mount('#chart-host', {
      symbol: S.marketId, timeframe: S.tf, theme: curTheme, locale: document.documentElement.lang
    });
  } catch(e){
    chartOverlay(`<b>${t('chart.unavailable')}</b><br>${String(e.message || e)}`);
    return;
  }
  const c = () => vc.chart;
  vc.on('load:start', () => chartOverlay(`<b>${t('chart.loading')}</b>`));
  vc.on('load:end', ev => {
    if (ev && ev.bars > 0){ chartOverlay(null); chartReady = true; }
    else chartOverlay(`<b>${t('chart.error')}</b>`);
  });
  vc.on('data:unresolved', () => chartOverlay(`<b>${t('chart.error')}</b>`));
  /* the user can switch markets from Vela's own search — keep the
     terminal chrome in sync with the chart's market */
  vc.on('market:changed', ev => {
    chartOverlay(null);
    if (ev && ev.timeframe) S.tf = ev.timeframe;
    liveBar = null;
    /* markers and zones re-map to the new timeframe's candle buckets */
    setTimeout(velaPositionsSync, 0);
    if (ev && ev.symbol){
      const sym = String(ev.symbol).replace(/^gains:/, '');
      if (sym !== S.marketId && board.meta.has(sym)){
        selectMarket(sym);
        /* selectMarket calls setChartMarket → same market, no loop */
      }
    }
  });
}

function setChartMarket(){
  if (!vc) return;
  Promise.resolve(vc.setSymbol(S.marketId)).catch(() => chartOverlay(`<b>${t('chart.error')}</b>`));
}

$('chart-full').addEventListener('click', () => {
  const fullscreen = document.documentElement.classList.toggle('fscreen');
  const notice = document.querySelector('.chart-notice');
  if (notice) {
    notice.classList.toggle('chart-notice-full', fullscreen);
    (fullscreen ? $('chart-host') : document.querySelector('.status-bar')).appendChild(notice);
  }
  if (vc) setTimeout(() => { try{ vc.resize(); }catch(e){} }, 60);
});

/* ============================================================
   MARKET SELECTOR + STATS (real Gains metadata + live marks)
   ============================================================ */
function marketSymbols(){
  const out = [];
  for (const m of board.meta.values()){
    if (S.ddCategory === 'all' || m.group === S.ddCategory) out.push(m);
  }
  return out;
}
function renderDropdown(filter){
  const list = $('market-dd-list');
  const f = (filter || '').trim().toLowerCase();
  let items = marketSymbols();
  if (f) items = [...board.meta.values()].filter(m =>
    m.symbol.toLowerCase().includes(f) || m.base.toLowerCase().includes(f));
  S.ddItems = items.slice(0, 60);
  S.ddFocus = Math.max(0, S.ddItems.findIndex(m => m.symbol === S.marketId));
  paintDropdown(true);
  queueStats(S.ddItems);
}

/* DOM painted once per search/category change; live prices update in place */
function paintDropdown(rebuild){
  const list = $('market-dd-list');
  const items = S.ddItems || [];
  if (rebuild || list.children.length !== items.length){
    list.innerHTML = items.map((m, i) => {
      const p = board.getMark(m.symbol);
      const oi = (window.OpenfundGains.openInterestUsd ? window.OpenfundGains.openInterestUsd(m) : null);
      const hol = m.funding ? Number(m.funding.fundingRateLongHourly) : null;
      const hos = m.funding ? Number(m.funding.fundingRateShortHourly) : null;
      const st = S.statsCache && S.statsCache.get(m.symbol);
      const d = Number(m.pricePrecision);
      const closed = m.isOpen === false;
      return `<li role="option" aria-selected="${m.symbol===S.marketId}" data-id="${m.symbol}" data-i="${i}" class="${m.symbol===S.marketId?'selected':''}${i===S.ddFocus?' focused':''}${closed?' closed':''}">
        <span class="mk">${iconHTML(m.symbol)}<b>${m.symbol}</b>${closed ? `<i class="closed-tag">${t('dd.closed')}</i>` : `<small>${t('cat.' + (m.group === 'commodities' ? 'commodity' : m.group))}</small>`}
          <span class="st" data-star="${m.symbol}">${S.favorites.has(m.symbol)?'★':'☆'}</span></span>
        <span class="num r" data-cell="price">${p ? fmt.price(p, d) : '—'}</span>
        <span class="num r ${st ? (st.data.changePct >= 0 ? 'up' : 'down') : ''}" data-cell="chg">${st ? fmt.pct(st.data.changePct) : '·'}</span>
        <span class="num r" data-cell="oil">${oi ? '$'+fmt.compact(oi.long) : '—'}</span>
        <span class="num r" data-cell="ois">${oi ? '$'+fmt.compact(oi.short) : '—'}</span>
        <span class="num r ${hol > 0 ? 'up' : hol < 0 ? 'down' : ''}" data-cell="hol">${Number.isFinite(hol) ? (hol*100).toFixed(3)+'%' : '—'}</span>
        <span class="num r ${hos > 0 ? 'up' : hos < 0 ? 'down' : ''}" data-cell="hos">${Number.isFinite(hos) ? (hos*100).toFixed(3)+'%' : '—'}</span>
      </li>`;
    }).join('') || `<li class="dd-none" style="padding:12px;color:var(--muted)">${t('dd.noMatch')}</li>`;
    [...list.querySelectorAll('[data-star]')].forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const id = el.dataset.star;
        S.favorites.has(id) ? S.favorites.delete(id) : S.favorites.add(id);
        paintDropdown(true);
      });
    });
    [...list.querySelectorAll('li[data-id]')].forEach(li => {
      li.addEventListener('click', () => { selectMarket(li.dataset.id); closeDropdown(); });
    });
    return;
  }
  /* in-place live update of price cells */
  for (const li of list.querySelectorAll('li[data-id]')){
    const p = board.getMark(li.dataset.id);
    if (!p) continue;
    const cell = li.querySelector('[data-cell="price"]');
    const d = Number((board.getMeta(li.dataset.id) || {}).pricePrecision || 2);
    const txt = fmt.price(p, d);
    if (cell.textContent !== txt){
      cell.classList.remove('flash-up', 'flash-down');
      void cell.offsetWidth;
      const prev = +cell.dataset.v || p;
      cell.classList.add(p >= prev ? 'flash-up' : 'flash-down');
      cell.textContent = txt;
    }
    cell.dataset.v = p;
  }
}

/* lazy 24h stats for the visible rows (cached, low concurrency) */
S.statsCache = new Map();
let statsQueue = [], statsBusy = 0;
function queueStats(items){
  const now = Date.now();
  statsQueue = (items || []).map(m => m.symbol).filter(s => {
    const c = S.statsCache.get(s);
    return !c || now - c.at > 180000;
  });
  pumpStats();
}
async function pumpStats(){
  while (statsBusy < 2 && statsQueue.length){
    const sym = statsQueue.shift();
    statsBusy++;
    board.stats24(sym).then(s => {
      if (s) S.statsCache.set(sym, { data: s, at: Date.now() });
      const li = $('market-dd-list').querySelector(`li[data-id="${sym}"]`);
      if (li){
        const st = S.statsCache.get(sym);
        if (st){
          const cell = li.querySelector('[data-cell="chg"]');
          cell.textContent = fmt.pct(st.data.changePct);
          cell.className = 'num r ' + (st.data.changePct >= 0 ? 'up' : 'down');
        }
      }
    }).catch(() => {}).finally(() => { statsBusy--; pumpStats(); });
  }
}

let ddOpen = false;
function openDropdown(){
  ddOpen = true; renderDropdown('');
  $('market-dropdown').hidden = false;
  $('market-select-btn').setAttribute('aria-expanded', 'true');
  setTimeout(() => $('market-search').focus(), 30);
}
function closeDropdown(){
  ddOpen = false; $('market-dropdown').hidden = true;
  $('market-select-btn').setAttribute('aria-expanded', 'false');
}
function moveDdFocus(delta){
  const n = (S.ddItems || []).length; if (!n) return;
  S.ddFocus = ((S.ddFocus + delta) % n + n) % n;
  const list = $('market-dd-list');
  [...list.querySelectorAll('li')].forEach(li => li.classList.toggle('focused', +li.dataset.i === S.ddFocus));
  const el = list.querySelector(`li[data-i="${S.ddFocus}"]`);
  if (el) el.scrollIntoView({ block: 'nearest' });
}
function pickDdFocus(){
  const m = (S.ddItems || [])[S.ddFocus];
  if (m){ selectMarket(m.symbol); closeDropdown(); }
}
$('market-search').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown'){ moveDdFocus(1); e.preventDefault(); }
  else if (e.key === 'ArrowUp'){ moveDdFocus(-1); e.preventDefault(); }
  else if (e.key === 'Enter'){ pickDdFocus(); e.preventDefault(); }
  else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's'){
    const m = (S.ddItems || [])[S.ddFocus];
    if (m){ S.favorites.has(m.symbol) ? S.favorites.delete(m.symbol) : S.favorites.add(m.symbol); paintDropdown(true); }
    e.preventDefault();
  }
});
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
    e.preventDefault();
    ddOpen ? closeDropdown() : openDropdown();
  }
});
$('market-select-btn').addEventListener('click', () => ddOpen ? closeDropdown() : openDropdown());
$('market-search').addEventListener('input', e => renderDropdown(e.target.value));
document.addEventListener('click', e => { if (ddOpen && e.target.isConnected && !e.target.closest('.market-select, .market-dropdown')) closeDropdown(); });
/* shared terminal popover coordination (workspaceLayout.ts): clicks in the
   parent shell, or opening another popover, close this menu */
window.addEventListener('of-close-popovers', () => { if (ddOpen) closeDropdown(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ddOpen) closeDropdown(); });
function renderCats(){
  const counts = { all: board.meta.size };
  for (const m of board.meta.values()) counts[m.group] = (counts[m.group] || 0) + 1;
  const cats = [['all','cat.all'],['crypto','cat.crypto'],['forex','cat.forex'],['stocks','cat.stocks'],['indices','cat.indices'],['commodities','cat.commodity']];
  $('dd-cats').innerHTML = cats.map(([id, key]) =>
    `<button data-cat="${id}" class="${S.ddCategory === id ? 'active' : ''}">${t(key)}${counts[id] != null ? ' <i>' + counts[id] + '</i>' : ''}</button>`).join('');
}
$('dd-cats').addEventListener('click', e => {
  const b = e.target.closest('[data-cat]'); if (!b) return;
  e.stopPropagation();   /* renderCats re-renders innerHTML — without this the
                            document outside-click handler sees a detached target
                            and closes the dropdown */
  S.ddCategory = b.dataset.cat;
  renderCats();
  renderDropdown('');
});

function selectMarket(id){
  velaSaveDrawings();     /* persist user drawings for the OLD symbol */
  velaPositionsClear();   /* symbol isolation: only the new market's overlays */
  velaClearDrawings();    /* clear user drawings too */
  S.marketId = id;
  S.stats = null;
  renderMarketStats._last = {};   /* no up/down flash across different markets */
  $('cur-icon').outerHTML = `<span id="cur-icon" class="cur-ic">${iconHTML(id)}</span>`;
  $('cur-pair').textContent = id;
  updateStarBtn();
  /* leverage clamp to the market's real max (and, for Prop, the Prop policy) */
  if (meta()) applyLeverageCap(true);
  /* a quantity is in the previous market's base units — never carry it over */
  if (SZ.mode === 'quantity' && $('of-qty')) $('of-qty').value = '';
  if (S.otype !== 'market'){
    const p = mark();
    if (p) $('of-price').value = p.toFixed(dp());
  }
  setChartMarket();
  renderMarketStats();
  loadStats24();
  renderBook(true);
  renderTrades();
  computeForm();
  /* Restore user drawings for the new symbol after the chart updates. */
  setTimeout(() => { velaRestoreDrawings(); velaPositionsSync(); }, 300);
}


function updateStarBtn(){
  const b = $('cur-star');
  b.textContent = S.favorites.has(S.marketId) ? '★' : '☆';
  b.classList.toggle('on', S.favorites.has(S.marketId));
  b.title = S.favorites.has(S.marketId) ? 'Remove from watchlist' : 'Add to watchlist';
}
$('cur-star').addEventListener('click', () => {
  S.favorites.has(S.marketId) ? S.favorites.delete(S.marketId) : S.favorites.add(S.marketId);
  updateStarBtn();
});

async function loadStats24(){
  const sym = S.marketId;
  try{
    const s = await board.stats24(sym);
    if (sym === S.marketId && s){ S.stats = s; renderMarketStats(); }
  }catch(e){ /* 24h stats unavailable for this symbol */ }
}

function renderMarketStats(){
  const m = meta();
  const p = board.marks.get(S.marketId);
  const d = dp();
  /* write only what changed and keep transient flash classes intact;
     resetting className on every tick cut the flash animation short and
     made the values flicker */
  const set = (id, text, cls) => {
    const el = $(id); if (!el) return;
    if (el.textContent !== text) el.textContent = text;
    const want = (cls || 'num').split(' ').filter(Boolean);
    for (const c of ['num', 'up', 'down']) el.classList.toggle(c, want.includes(c));
  };
  const prev = renderMarketStats._last || {};
  const paint = (id, v) => {
    if (!S.flashOn) return;
    if (prev[id] != null && v !== prev[id]){
      const el = $(id);
      if (!el) return;   /* teardown race guard */
      el.classList.remove('flash-up', 'flash-down');
      void el.offsetWidth;
      el.classList.add(v > prev[id] ? 'flash-up' : 'flash-down');
    }
    prev[id] = v;
  };
  const changePct = S.stats ? S.stats.changePct : null;
  set('st-last', p ? fmt.price(p.mark, d) : '—', 'num' + (changePct != null ? (changePct >= 0 ? ' up' : ' down') : ''));
  paint('st-last', p ? p.mark : 0);
  /* the last valid mark stays on screen through brief interruptions, but is
     visibly marked as not live (dimmed + tooltip) instead of passing as live */
  const stLast = $('st-last');
  if (stLast) {
    const notLive = !!p && (board.status !== 'live' || board.stale(S.marketId));
    stLast.classList.toggle('is-stale', notLive);
    const tip = notLive ? t('sb.stale') : '';
    if (stLast.title !== tip) stLast.title = tip;
  }
  set('st-oracle', p && p.index ? fmt.price(p.index, d) : '—');
  set('st-change', changePct == null ? '…' : fmt.pct(changePct), 'num ' + (changePct >= 0 ? 'up' : 'down'));
  set('st-high', S.stats ? fmt.price(S.stats.high, d) : '…');
  set('st-low', S.stats ? fmt.price(S.stats.low, d) : '…');
  set('st-vol', '—');   /* Gains API provides no volume — never fabricated */
  const oi = G.openInterestUsd ? G.openInterestUsd(m) : null;
  set('st-oi', oi ? '$' + fmt.compact(oi.total) : '—');
  if (oi) { const stOi = $('st-oi'); if (stOi) stOi.title = 'Long $' + fmt.compact(oi.long) + ' · Short $' + fmt.compact(oi.short); }
  const f = m && m.funding ? Number(m.funding.fundingRateLongHourly) : null;
  set('st-funding', f != null && Number.isFinite(f) ? (f * 100).toFixed(4) + '%' : '—');
  set('st-lev', m ? (maxLeverage() ?? Number(m.maxLeverage)) + '×' : '—');
  renderMarketStats._last = prev;
}

/* ============================================================
   ORDER BOOK + TRADES — presentation views around the real
   mark, explicitly labelled as simulated (Gains offers
   neither an order book nor a trade tape).
   ============================================================ */
document.querySelectorAll('[data-book-tab]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-book-tab]').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', String(x === b)); });
  const tab = b.dataset.bookTab;
  $('book-view').hidden = tab !== 'book';
  $('trades-view').hidden = tab !== 'trades';
  if (tab === 'book') renderBook(); else renderTrades();
}));
$('book-group').addEventListener('change', e => { S.grouping = +e.target.value; renderBook(true); });
$('book-dense').addEventListener('change', e => { S.dense = e.target.checked; $('book-view').classList.toggle('dense', S.dense); });

function renderBook(force){
  if (window.__ofTerminalConfig?.syntheticMarketData === false) {
    window.OpenfundDepth?.select(S.marketId);
    window.OpenfundDepth?.renderBook();
    return;
  }
  if (!$('book-asks')) return;   /* teardown race guard */
  if ($('book-view').hidden) return;
  const m = meta(), mid = mark();
  if (!m || !mid){
    $('book-asks').innerHTML = ''; $('book-bids').innerHTML = '';
    $('book-mid-price').textContent = '—';
    return;
  }
  const key = S.marketId + '|' + S.grouping;
  if (force || bookKey !== key){ bookKey = key; buildBook(); return; }
  updateBook();
}
let bookKey = null, bookRefs = null;
function buildBook(){
  const m = meta(); if (!m) return;
  const d = dp(), dps = Number(m.sizePrecision) || 2;
  const asks = [], bids = [];
  for (let i = 0; i < 12; i++){ asks.push({ i }); bids.push({ i }); }
  const row = (l, cls) => `<div class="bk-row ${cls}" data-lvl="${l.i}">
    <span class="depth"></span>
    <span class="num p"></span>
    <span class="num r s"></span>
    <span class="num r c"></span></div>`;
  $('book-asks').innerHTML = asks.map(l => row(l, 'a')).reverse().join('');
  $('book-bids').innerHTML = bids.map(l => row(l, 'b')).join('');
  bookRefs = { asks: [...$('book-asks').querySelectorAll('.bk-row')].reverse(),
               bids: [...$('book-bids').querySelectorAll('.bk-row')] };
  updateBook(true);
}
function updateBook(first){
  const m = meta(), mid = mark(); if (!m || !mid || !bookRefs) return;
  const d = dp(), dps = Number(m.sizePrecision) || 2;
  const tick = Math.pow(10, -d) * S.grouping;
  const depthBase = mid * Number(m.minPositionUsd || 100) / 1000;
  const sides = [['asks', 1, false], ['bids', -1, true]];
  const prevMid = updateBook._mid;
  updateBook._mid = mid;
  for (const [side, dir, ] of sides){
    const rows = bookRefs[side];
    let cum = 0;
    const cums = rows.map((r, idx) => { cum += depthBase * (0.15 + pseudo(idx * 2 + (dir > 0 ? 1 : 2), m.symbol) * 1.2); return cum; });
    const maxT = cums[cums.length - 1];
    rows.forEach((r, idx) => {
      const price = mid + tick * (idx + 1) * dir;
      const size = depthBase * (0.15 + pseudo(idx * 2 + (dir > 0 ? 1 : 2), m.symbol) * 1.2);
      r.querySelector('.p').textContent = fmt.price(price, d);
      r.querySelector('.s').textContent = fmt.num(size, dps);
      r.querySelector('.c').textContent = fmt.compact(cums[idx]);
      r.querySelector('.depth').style.width = Math.min(100, cums[idx] / maxT * 100).toFixed(1) + '%';
    });
  }
  const midEl = $('book-mid-price');
  midEl.textContent = fmt.price(mid, d);
  if (!first && prevMid != null && mid !== prevMid && S.flashOn){
    midEl.classList.remove('flash-up', 'flash-down');
    void midEl.offsetWidth;
    midEl.classList.add(mid > prevMid ? 'flash-up' : 'flash-down');
    midEl.classList.add(mid > prevMid ? 'up' : 'down');
    midEl.classList.remove(mid > prevMid ? 'down' : 'up');
  }
  const spread = 2 * tick;
  $('book-spread').textContent = `${t('book.spread')} ${fmt.price(spread, d)}`;
}

/* tiny deterministic pseudo-random for presentation levels */
function pseudo(i, sym){
  let h = 2166136261 ^ i;
  for (let k = 0; k < sym.length; k++){ h ^= sym.charCodeAt(k); h = Math.imul(h, 16777619); }
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* presentation trades derived from mark ticks */
const tradeRows = [];
function noteTrade(p){
  if(window.__ofTerminalConfig?.syntheticMarketData === false)return;
  if (p.market !== S.marketId) return;
  const m = meta(); if (!m) return;
  tradeRows.unshift({ price: p.mark, size: pseudo(tradeRows.length, 'sz' + S.marketId) * (Number(m.minPositionUsd) || 50) / 10,
                      side: p.prev != null ? (p.mark >= p.prev ? 'buy' : 'sell') : (pseudo(Date.now() % 97, S.marketId) > .5 ? 'buy' : 'sell'),
                      time: Date.now() });
  if (tradeRows.length > 42) tradeRows.pop();
}
function renderTrades(){
  if(window.__ofTerminalConfig?.syntheticMarketData === false){window.OpenfundDepth?.renderTrades();return;}
  if (!$('trades-rows')) return;   /* teardown race guard */
  if (!$('trades-rows') && !$('.trades-view tbody')) return;   /* teardown race guard */
  if ($('trades-view').hidden) return;
  const m = meta(); if (!m) return;
  const d = dp(), dps = Number(m.sizePrecision) || 2;
  if (!tradeRows.length){
    $('trades-list').innerHTML = `<div class="tr-row" style="color:var(--muted)">${t('trades.note')}</div>`;
    return;
  }
  $('trades-list').innerHTML = tradeRows.map(r =>
    `<div class="tr-row ${r.side}">
      <span class="num">${fmt.price(r.price, d)}</span>
      <span class="num r">${fmt.num(r.size, dps)}</span>
      <span>${new Date(r.time).toLocaleTimeString('en-GB', {hour12: false})}</span></div>`).join('');
}

/* ============================================================
   ORDER ENTRY FORM
   ============================================================ */
$('side-long').addEventListener('click', () => setSide('long'));
$('side-short').addEventListener('click', () => setSide('short'));
function setSide(side){
  S.side = side;
  $('side-long').classList.toggle('active', side === 'long');
  $('side-short').classList.toggle('active', side === 'short');
  $('side-long').setAttribute('aria-pressed', String(side === 'long'));
  $('side-short').setAttribute('aria-pressed', String(side === 'short'));
  $('submit-order').className = 'submit ' + side;
  $('submit-order').textContent = t(side === 'long' ? 'submit.long' : 'submit.short');
  computeForm();
}
document.querySelectorAll('.ot').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.ot').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
  S.otype = b.dataset.otype;
  const priceInput = $('of-price');
  priceInput.disabled = S.otype === 'market';
  $('price-field').style.opacity = S.otype === 'market' ? .45 : 1;
  if (S.otype !== 'market' && !priceInput.value){
    const p = mark();
    if (p) priceInput.value = p.toFixed(dp());
  }
  computeForm();
}));

function syncLeverageUI(){
  $('lev-val').textContent = S.leverage + '×';
  $('lev-range').value = S.leverage;
}
/* Effective maximum leverage for the selected market. Prop applies the
   Prop-only policy (legacy/prop-leverage.js) together with the market limit
   and any challenge plan limit — the strictest wins, and the backend enforces
   the same ceiling. Perpetual keeps the market's own limit unchanged. */
function isPropTerminal(){ return window.__ofTerminalConfig?.product === 'prop'; }
function maxLeverage(){
  const m = meta();
  if (!m) return null;
  const marketMax = Math.floor(Number(m.maxLeverage));
  if (!isPropTerminal() || !window.OpenfundPropLeverage) return Number.isFinite(marketMax) && marketMax >= 1 ? marketMax : null;
  const plan = (window.__ofServerTP || tp)?.getAccount?.()?.planLeverage ?? null;
  const v = window.OpenfundPropLeverage.maxLeverage(m, S.marketId, plan);
  return Number.isFinite(v) && v >= 1 ? v : null;
}
function leverageCapNote(max){
  const m = meta();
  if (!isPropTerminal() || !m || !window.OpenfundPropLeverage || max == null) return '';
  const cat = window.OpenfundPropLeverage.category(m, S.marketId);
  const name = cat === 'btc' ? 'BTC' : cat === 'eth' ? 'ETH' : cat ? t('cat.' + (cat === 'commodities' ? 'commodity' : cat)) : '';
  return `${L('حداکثر مجاز پراپ', 'Prop max')} ${max}× · ${name}`;
}
/* Clamp the selected leverage to the effective maximum. A lowered value is
   announced (never silent) so the trader sees the order that will be sent. */
function applyLeverageCap(announce){
  const max = maxLeverage();
  if (max == null) return;
  $('lev-range').max = max;
  const hint = $('lev-cap');
  if (hint) hint.textContent = leverageCapNote(max);
  let changed = false;
  if (S.leverage > max){
    const prev = S.leverage;
    S.leverage = max; changed = true;
    if (announce && $('lev-err')){
      $('lev-err').textContent = `${L('اهرم به حداکثر مجاز این بازار کاهش یافت', 'Leverage reduced to the market maximum')}: ${prev}× → ${max}×`;
      $('lev-err').hidden = false;
      $('lev-err').classList.add('notice');
    }
  }
  syncLeverageUI();
  renderLevPresets();
  if (changed) computeForm();
}
function renderLevPresets(){
  const maxLev = maxLeverage() ?? 100;
  [...$('lev-presets').querySelectorAll('button')].forEach(b => {
    const v = +b.dataset.lev;
    b.disabled = v > maxLev;
    b.classList.toggle('active', v === S.leverage);
  });
}
$('lev-range').addEventListener('input', e => {
  S.leverage = Math.max(1, Math.min(maxLeverage() ?? Number($('lev-range').max), +e.target.value));
  if ($('lev-err')?.classList.contains('notice')) $('lev-err').hidden = true;
  syncLeverageUI(); renderLevPresets(); computeForm();
});
$('lev-presets').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const max = maxLeverage();
  S.leverage = max != null ? Math.min(max, +b.dataset.lev) : +b.dataset.lev;
  if ($('lev-err')?.classList.contains('notice')) $('lev-err').hidden = true;
  syncLeverageUI(); renderLevPresets(); computeForm();
});

$('of-collateral').addEventListener('input', computeForm);
$('of-price').addEventListener('input', computeForm);
$('of-sl').addEventListener('input', computeForm);
$('of-tp').addEventListener('input', computeForm);
document.querySelectorAll('.pct-btns button').forEach(b => b.addEventListener('click', () => {
  const avail = tp.getAccount()?.available;
  if (avail == null || tp.canTrade === false) return;
  const rate = tp.feeRate?.(S.marketId);
  const budget = tp.serverMode && rate != null ? avail / (1 + S.leverage * rate) : avail;
  const v = Math.floor(budget * (+b.dataset.pct) / 100 * 100) / 100;
  $('of-collateral').value = v.toFixed(2);
  if (SZ.mode === 'quantity' && PSZ()){
    /* the largest quantity this budget buys; its collateral (rounded up to
       cents) never exceeds the budget */
    const q = PSZ().quantityFromCollateral({ collateral: v.toFixed(2), leverage: S.leverage, price: sizingPrice() || '', quantityPrecision: qtyPrecision() });
    $('of-qty').value = q && Number(q) > 0 ? q.replace(/\.?0+$/, '') : '';
  }
  computeForm();
}));

function marketClosed(){
  const m = meta();
  return !m || m.isOpen === false;
}
function computeForm(){
  if (!$('submit-order')) return;   /* teardown race guard */
  qtRender();
  const m = meta();
  const d = dp();
  const closed = marketClosed();
  $('submit-order').disabled = closed || tp?.canTrade === false;
  if (closed){
    $('of-err').textContent = t('mkt.closed');
    $('of-err').hidden = false;
  }
  renderSizingModes();
  const sizingErr = syncCollateralFromQuantity();
  const collateral = normNum($('of-collateral').value) || 0;
  const price = S.otype === 'market' ? (mark() || 0) : (normNum($('of-price').value) || 0);
  const size = price > 0 ? collateral * S.leverage / price : 0;
  renderSizeEquivalents(price);
  const notional = collateral * S.leverage;
  const rate = tp?.feeRate ? tp.feeRate(S.marketId) : tp?.readOnly ? null : FEE_RATE;
  $('of-units').textContent = unit() || m ? (m ? m.base : '') : '';
  $('of-size').textContent = size > 0 ? fmt.num(size, m ? Number(m.sizePrecision) || 2 : 2) : '0.000000';
  $('of-notional').textContent = fmt.usd(notional);
  const liq = price > 0 && tp ? tp.liqPrice(S.side, price, S.leverage) : null;
  $('rk-entry').textContent = price > 0 ? fmt.price(price, d) : '—';
  $('rk-entry').className = price > 0 ? 'num' : '';
  $('rk-oracle').textContent = (board.getIndex(S.marketId) || '—');
  $('rk-oracle').className = 'num';
  if (board.getIndex(S.marketId)) $('rk-oracle').textContent = fmt.price(board.getIndex(S.marketId), d);
  $('rk-liq').textContent = liq ? fmt.price(liq, d) : '—';
  $('rk-liq').className = liq ? 'num down' : '';
  $('rk-margin').textContent = collateral > 0 ? fmt.usd(collateral) : '—';
  $('rk-fee').textContent = collateral > 0 && rate != null ? fmt.usd(notional * rate) : '—';
  const sl = normNum($('of-sl').value) || null;
  $('rk-maxloss').textContent = rate == null ? '—' : (sl && price > 0)
    ? fmt.usdS((sl - price) * size * (S.side === 'long' ? 1 : -1) - notional * rate * 2)
    : '—';
  $('rk-maxloss').className = 'num down';
  if (!closed && tp){
    const errs = sizingErr ? [sizingErr] : tp.validate(buildRequest());
    const errEl = $('of-err');
    if (errs.length){ errEl.textContent = errs[0]; errEl.hidden = false; }
    else errEl.hidden = true;
  }
}

/* normalize localized numeric input to canonical Western decimals:
   Persian ۰-۹, Arabic-Indic ٠-٩, ٫/٫ decimals and Persian/Arabic/English
   thousands separators are accepted; anything else is rejected as NaN. */
function normNum(v){
  if (typeof v !== 'string') v = String(v ?? '');
  const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
  let out = '';
  for (const ch of v.trim()){
    const fa = FA.indexOf(ch), ar = AR.indexOf(ch);
    if (fa > -1) out += fa;
    else if (ar > -1) out += ar;
    else if (ch === '٫') out += '.';                                        /* Arabic decimal separator */
    else if (ch === '،' || ch === '٬' || ch === ',' || ch === ' ') continue; /* thousands/spacing dropped */
    else out += ch;
  }
  const n = Number(out);
  return Number.isFinite(n) ? n : NaN;
}

/* ============================================================
   PROP POSITION SIZING — collateral / quantity / lots
   All modes resolve to the engine's canonical collateral (margin) value in
   #of-collateral; the engine then derives quantity = margin × leverage /
   entry (ROUND_DOWN). Quantity mode keeps the trader's quantity as intent
   and recomputes collateral when price, leverage or market change. Lots
   need an approved contract specification (legacy/position-sizing.js) and
   are shown as unavailable otherwise — no lot size is guessed.
   ============================================================ */
function PSZ(){ return window.OpenfundPositionSizing; }
function exactInput(id){
  const raw = $(id)?.value ?? '';
  const NI = window.OpenfundNumericInput;
  if (NI) { const r = NI.parseDecimal(raw, { lang: document.documentElement.lang }); return r.ok ? r.text : (r.empty ? '' : null); }
  const n = normNum(raw); return raw.trim() === '' ? '' : Number.isFinite(n) && n >= 0 ? String(n) : null;
}
function sizingPrice(){
  const p = S.otype === 'market' ? mark() : normNum($('of-price').value);
  return p > 0 ? String(p) : null;
}
function qtyPrecision(){ const m = meta(); const v = m ? Number(m.sizePrecision) : NaN; return Number.isInteger(v) && v >= 0 && v <= 10 ? v : 10; }
function currentLotSpec(){ return PSZ() ? PSZ().lotSpec(meta(), S.marketId) : { available: false }; }
function setSizeMode(mode){
  if (!isPropTerminal() || !PSZ()) mode = 'collateral';
  if (mode === 'lots' && !currentLotSpec().available) mode = SZ.mode === 'lots' ? 'collateral' : SZ.mode;
  if (mode === 'quantity' && SZ.mode !== 'quantity'){
    /* start from the quantity the current collateral would buy */
    const q = PSZ()?.quantityFromCollateral({ collateral: exactInput('of-collateral') || '', leverage: S.leverage, price: sizingPrice() || '', quantityPrecision: qtyPrecision() });
    $('of-qty').value = q && Number(q) > 0 ? q.replace(/\.?0+$/, '') : '';
  }
  SZ.mode = mode;
  document.querySelectorAll('[data-size-mode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.sizeMode === mode)));
  $('collateral-field').hidden = mode !== 'collateral';
  $('qty-field').hidden = mode !== 'quantity';
  $('lots-field').hidden = mode !== 'lots';
  computeForm();
}
function renderSizingModes(){
  const box = $('size-mode');
  if (!box) return;
  const on = isPropTerminal() && !!PSZ();
  box.hidden = !on;
  $('size-equiv').hidden = !on;
  if (!on) return;
  const spec = currentLotSpec();
  const lotsBtn = box.querySelector('[data-size-mode="lots"]');
  lotsBtn.disabled = !spec.available;
  lotsBtn.setAttribute('aria-disabled', String(!spec.available));
  lotsBtn.title = spec.available ? '' : L('برای این بازار مشخصات قرارداد تأییدشده‌ای برای لات وجود ندارد.', 'No approved contract specification defines a lot for this market.');
  if (SZ.mode === 'lots' && !spec.available) setSizeMode('collateral');
  $('qty-unit').textContent = meta()?.base || '';
}
/* quantity mode: collateral follows the requested quantity (rounded UP to cents) */
function syncCollateralFromQuantity(){
  if (SZ.mode !== 'quantity' || !PSZ()) return null;
  const q = exactInput('of-qty');
  if (q === null) return L('اندازه نماد نامعتبر است.', 'Enter a valid quantity.');
  const price = sizingPrice();
  if (!q || !price) { $('of-collateral').value = ''; return null; }
  if (!PSZ().quantityOnGrid(q, qtyPrecision())) return `${L('حداکثر رقم اعشار مجاز برای اندازه', 'Maximum quantity decimals')}: ${qtyPrecision()}`;
  const c = PSZ().collateralFromQuantity({ quantity: q, leverage: S.leverage, price });
  $('of-collateral').value = c || '';
  return null;
}
function renderSizeEquivalents(price){
  if ($('size-equiv').hidden || !PSZ()) return;
  const m = meta(), coll = exactInput('of-collateral');
  const q = coll && price ? PSZ().quantityFromCollateral({ collateral: coll, leverage: S.leverage, price: String(price), quantityPrecision: qtyPrecision() }) : null;
  const spec = currentLotSpec();
  const lots = spec.available && q ? PSZ().lotsFromQuantity(q, spec) : null;
  $('eq-lots').textContent = spec.available ? (lots ?? '—') : L('در دسترس نیست', 'Unavailable');
  $('eq-lots').title = spec.available ? '' : L('برای این بازار مشخصات قرارداد تأییدشده‌ای برای لات وجود ندارد.', 'No approved contract specification defines a lot for this market.');
  $('eq-lots').className = spec.available ? 'num' : 'na';
  $('eq-coll').innerHTML = coll ? `<bdi dir="ltr">${esc(fmt.usd(Number(coll)))}</bdi>` : '—';
}
document.querySelectorAll('[data-size-mode]').forEach(b => b.addEventListener('click', () => { if (!b.disabled) setSizeMode(b.dataset.sizeMode); }));
/* short viewports show the key account row; the toggle reveals the rest */
$('acct-toggle')?.addEventListener('click', () => {
  const open = $('acct-strip').dataset.expanded !== 'true';
  $('acct-strip').dataset.expanded = String(open);
  $('acct-toggle').setAttribute('aria-expanded', String(open));
  $('acct-toggle').setAttribute('aria-label', open ? L('نمایش خلاصهٔ کوتاه حساب', 'Show short account summary') : L('نمایش کامل خلاصهٔ حساب', 'Show full account summary'));
});
$('of-qty')?.addEventListener('input', computeForm);

function buildRequest(){
  return {
    market: S.marketId, side: S.side, type: S.otype, leverage: S.leverage,
    collateral: normNum($('of-collateral').value) || 0,
    price: normNum($('of-price').value) || 0,
    sl: normNum($('of-sl').value) || null, tp: normNum($('of-tp').value) || null
  };
}

$('submit-order').addEventListener('click', async () => {
  if (marketClosed()){ toast(t('mkt.closed'), 'neg'); return; }
  const req = buildRequest();
  const invalid = ['of-collateral', 'of-price', 'of-sl', 'of-tp'].some(id => !$(id).disabled && $(id).value.trim() && !Number.isFinite(normNum($(id).value)));
  const invalidProtection = ['of-sl', 'of-tp'].some(id => $(id).value.trim() && normNum($(id).value) <= 0);
  const sizingErr = syncCollateralFromQuantity();
  const errs = sizingErr ? [sizingErr] : invalid || invalidProtection ? [L('مقدار عددی نامعتبر است.', 'Enter a valid number.')] : tp.validate(req);
  if (errs.length){ $('of-err').textContent = errs[0]; $('of-err').hidden = false; return; }
  const m = meta();
  const d = dp();
  const mk = mark();
  let preview=null;
  if(tp.previewAsync){try{preview=await tp.previewAsync(req)}catch(e){$('of-err').textContent=e.message;$('of-err').hidden=false;return}}
  const entry = preview ? Number(preview.entry_price) : req.type === 'market' ? mk : req.price;
  const size = preview ? Number(preview.quantity) : req.collateral * req.leverage / entry;
  const notional = preview ? Number(preview.notional) : req.collateral * req.leverage;
  const liq = preview ? Number(preview.liquidation_price) : tp.liqPrice(req.side, entry, req.leverage);
  const acc = tp.getAccount();
  /* [label, value, technical, extraClass] — presentation only: the values are
     the same ones computed above (nothing is re-rounded here). Technical
     values (symbols, prices, amounts) are isolated LTR so RTL labels never
     reorder them; localized words (direction, order type) keep the page
     direction. One label/value pair per row, so nothing is clipped. */
  const rows = [
    [t('rv.market'), m ? m.symbol : S.marketId, true], [t('rv.dir'), t(req.side === 'long' ? 'rv.side.long' : 'rv.side.short'), false, req.side === 'long' ? 'up' : 'down'],
    [t('rv.otype'), t('ot.' + req.type), false], [t('rv.lev'), req.leverage + '×', true],
    ...(SZ.mode === 'quantity' ? [[L('اندازه درخواستی', 'Requested quantity'), (exactInput('of-qty') || '—') + ' ' + (m ? m.base : ''), true]] : []),
    [preview ? L('اندازه طبق پیش‌نمایش سرور', 'Quantity (server preview)') : t('rv.size'), fmt.num(size, m ? Number(m.sizePrecision) || 2 : 2) + ' ' + (m ? m.base : ''), true],
    [t('rv.notional'), fmt.usd(notional), true],
    [t('rv.collateral'), fmt.usd(req.collateral), true], [t('rk.entry'), fmt.price(entry, d), true],
    [t('rv.oracle'), board.getIndex(S.marketId) ? fmt.price(board.getIndex(S.marketId), d) : '—', true],
    [t('rk.liq'), fmt.price(liq, d), true],
    [t('rv.fee'), fmt.usd(preview ? Number(preview.open_fee) : notional * (tp.feeRate?.(S.marketId) ?? FEE_RATE)), true],
    [t('rv.sl'), req.sl ? fmt.price(req.sl, d) : '—', true],
    [t('rv.tp'), req.tp ? fmt.price(req.tp, d) : '—', true],
    [L('مارجین آزاد تخمینی','Estimated free margin'), fmt.usd(preview ? Number(preview.available_margin)-Number(preview.required_margin)-Number(preview.open_fee) : acc.available-req.collateral), true]
  ];
  $('review-body').innerHTML = `<dl class="review-list">` +
    rows.map(([k, v, tech, cls]) => `<div><dt>${esc(k)}</dt><dd class="${tech ? 'num' : ''}${cls ? ' ' + cls : ''}">${tech ? `<bdi dir="ltr">${esc(v)}</bdi>` : esc(v)}</dd></div>`).join('') +
    `</dl>${SZ.mode === 'quantity' && preview && exactInput('of-qty') && Number(preview.quantity) !== Number(exactInput('of-qty')) ? `<p class="review-note size-diff">${esc(L('اندازهٔ نهایی را موتور از کولترال، اهرم و قیمت ورود (با اسپرد) و دقت نماد محاسبه می‌کند؛ مقدار پیش‌نمایش سرور همان چیزی است که ارسال می‌شود.', 'The engine derives the final quantity from collateral, leverage, entry price (with spread) and symbol precision; the server-preview quantity is what will be submitted.'))}</p>` : ''}<p class="review-note"><b>${esc(t('rv.exec'))}:</b> ${esc(L('برآورد شبیه‌سازی؛ نتیجهٔ اجرا قطعی نیست','Simulation estimate; execution may differ'))}</p>`;
  $('review-confirm').className = 'submit ' + req.side;
  $('review-dialog').showModal();
  pendingOrder = { req, provider: tp };
});
let pendingOrder = null;
$('review-cancel').addEventListener('click', () => { pendingOrder = null; $('review-dialog').close(); });
$('review-dialog').addEventListener('cancel', event => { if ($('review-confirm').disabled) { event.preventDefault(); return; } pendingOrder = null; });
$('review-confirm').addEventListener('click', async () => {
  if (!pendingOrder || $('review-confirm').disabled) return;
  const review = pendingOrder;
  if (review.provider !== tp || tp.canTrade === false) {
    pendingOrder = null; $('review-dialog').close();
    toast(L('وضعیت حساب تغییر کرده است؛ سفارش را دوباره بررسی کنید.', 'Account state changed. Review the order again.'), 'neg');
    return;
  }
  $('review-confirm').disabled = true;
  $('review-cancel').disabled = true;
  try {
    const res = tp.submitAsync ? await tp.submitAsync(review.req) : tp.submit(review.req);
    if (res && res.ok) {
      pendingOrder = null; $('review-dialog').close();
      toast(res.kind === 'position' ? t('toast.position') : t('toast.order'), 'pos');
      renderBottom(); renderAccount();
    } else {
      toast(res && res.errors ? res.errors[0] : 'error', 'neg');
    }
  } catch (error) {
    // Keep the same reviewed request/idempotency identity for an explicit retry.
    toast(L('وضعیت درخواست تأیید نشد؛ پوزیشن‌ها را بررسی کنید یا همین سفارش را دوباره بفرستید.', 'Request status could not be confirmed. Check positions or retry this same review.'), 'neg');
  } finally { $('review-confirm').disabled = false; $('review-cancel').disabled = false; }
});

/* ============================================================
   QUICK TRADE (Chart tab)
   A compact Buy/Sell control over the chart. It owns NO trading logic: it
   builds the same request object as the order form and sends it through the
   active account adapter `tp` (validate → previewAsync → submitAsync), i.e.
   the exact pipeline of the Trading tab. Prices come from the shared
   PriceBoard (no extra subscription). Gains supplies a mark price only, so
   no bid/ask is shown.
   ============================================================ */
const QT = { side: 'long', open: false, amount: '', leverage: null, busy: false,
  req: null, sig: '', status: null, preview: null, previewSig: '', previewErr: '', seq: 0, timer: null, opener: null };
function qtMaxLev(){ return maxLeverage(); }
function qtLeverage(){
  const max = qtMaxLev();
  if (max == null) return null;
  if (QT.leverage == null) QT.leverage = S.leverage;
  QT.leverage = Math.max(1, Math.min(max, Math.floor(Number(QT.leverage)) || 1));
  return QT.leverage;
}
function qtPrice(){
  const p = mark();
  const live = board.status === 'live' && board.markAge(S.marketId) <= 90000;
  return { p, live, ok: !!(p > 0) && live };
}
function qtBuild(){
  return { market: S.marketId, side: QT.side, type: 'market', leverage: qtLeverage() || 1,
    collateral: normNum(QT.amount) || 0, price: 0, sl: null, tp: null };
}
/* one request object (and idempotency key) per distinct intent; an explicit
   retry after an unconfirmed submit reuses it, any edit starts a new one */
function qtRequest(){
  const r = qtBuild(), sig = [r.market, r.side, r.leverage, r.collateral].join('|');
  if (!QT.req || QT.sig !== sig){ QT.req = r; QT.sig = sig; }
  return QT.req;
}
function qtAccountBlocker(){
  if (!tp) return L('حساب در دسترس نیست.', 'Account unavailable.');
  if (marketClosed()) return t('mkt.closed');
  if (tp.canTrade === false) return (tp.validate(qtBuild())[0]) || L('حساب در دسترس نیست.', 'Account unavailable.');
  return null;
}
function qtBlocker(){
  const hard = qtAccountBlocker();
  if (hard) return hard;
  if (!qtPrice().ok || qtLeverage() == null) return t('qt.noPrice');
  const raw = QT.amount.trim();
  if (!raw) return null;
  if (!(normNum(raw) > 0)) return t('qt.invalid');
  return tp.validate(qtBuild())[0] || QT.previewErr || null;
}
function qtEdited(){
  QT.previewErr = ''; QT.preview = null; QT.previewSig = '';
  clearTimeout(QT.timer);
  if (QT.open && tp && tp.previewAsync && !qtBlocker() && normNum(QT.amount) > 0){
    const req = qtBuild(), sig = [req.market, req.side, req.leverage, req.collateral].join('|'), seq = ++QT.seq;
    QT.timer = setTimeout(async () => {
      try {
        const data = await tp.previewAsync(req);
        if (seq === QT.seq){ QT.preview = data; QT.previewSig = sig; qtRender(); }
      } catch (e) {
        if (seq === QT.seq){ QT.previewErr = String(e && e.message || e); qtRender(); }
      }
    }, 450);
  }
  qtRender();
}
function qtSetText(id, text){ const el = $(id); if (el && el.textContent !== text) el.textContent = text; }
function qtRender(){
  const root = $('qt-root');
  if (!root || document.body.dataset.layout !== 'chart') return;
  const m = meta(), d = dp(), ps = qtPrice(), lev = qtLeverage(), hard = qtAccountBlocker();
  root.setAttribute('role', 'group'); root.setAttribute('aria-label', t('qt.aria'));
  qtSetText('qt-mode', t('ac.modeVal') + ' · ' + S.marketId);
  const px = $('qt-px');
  px.classList.toggle('stale', !ps.ok);
  px.replaceChildren(document.createTextNode(ps.p > 0 ? fmt.price(ps.p, d) : '—'));
  const tag = document.createElement('small');
  tag.textContent = ps.p > 0 ? t(ps.live ? 'qt.mark' : 'qt.stale') : '';
  px.append(tag);
  for (const id of ['qt-buy', 'qt-sell']){
    const b = $(id); b.disabled = !!hard; b.title = hard || '';
    b.setAttribute('aria-expanded', String(QT.open && QT.side === (id === 'qt-buy' ? 'long' : 'short')));
  }
  const panel = $('qt-panel');
  panel.hidden = !QT.open;
  if (!QT.open) return;
  const title = $('qt-title');
  title.className = 'qt-title ' + QT.side;
  title.textContent = t(QT.side === 'long' ? 'qt.longTitle' : 'qt.shortTitle') + ' · ' + S.marketId;
  $('qt-close').setAttribute('aria-label', t('qt.close'));
  const range = $('qt-lev');
  if (lev != null){ range.max = String(qtMaxLev()); range.value = String(lev); }
  range.disabled = lev == null || QT.busy;
  qtSetText('qt-lev-val', lev != null ? lev + '×' : '—');
  const acc = tp && tp.getAccount ? tp.getAccount() : null, avail = acc ? acc.available : null;
  qtSetText('qt-avail', avail == null ? '—' : fmt.usd(avail));
  const collateral = normNum(QT.amount) || 0, pv = QT.preview && QT.previewSig === [S.marketId, QT.side, lev || 1, collateral].join('|') ? QT.preview : null;
  const rate = tp && tp.feeRate ? tp.feeRate(S.marketId) : null;
  const notional = collateral * (lev || 0), size = ps.p > 0 ? notional / ps.p : 0;
  const unitTxt = m ? ' ' + m.base : '';
  const q = pv ? Number(pv.quantity) : size;
  qtSetText('qt-size', q > 0 ? fmt.num(q, m ? Number(m.sizePrecision) || 2 : 2) + unitTxt : '—');
  qtSetText('qt-margin', collateral > 0 ? fmt.usd(pv && pv.required_margin != null ? Number(pv.required_margin) : collateral) : '—');
  const fee = pv && pv.open_fee != null ? Number(pv.open_fee) : (collateral > 0 && rate != null ? notional * rate : null);
  qtSetText('qt-fee', fee == null ? '—' : fmt.usd(fee));
  const liq = pv && pv.liquidation_price != null ? Number(pv.liquidation_price) : (ps.p > 0 && tp ? tp.liqPrice(QT.side, ps.p, lev || 1) : null);
  qtSetText('qt-liq', liq ? fmt.price(liq, d) : '—');
  document.querySelectorAll('#qt-chips button').forEach(b => { b.disabled = avail == null || !!hard || QT.busy; });
  const err = $('qt-err'), blocker = qtBlocker();
  if (!QT.status && blocker){ err.textContent = blocker; err.className = 'qt-err'; err.hidden = false; }
  else if (QT.status){ err.textContent = QT.status.text; err.className = 'qt-err' + (QT.status.ok ? ' ok' : ''); err.hidden = false; }
  else err.hidden = true;
  const submit = $('qt-submit');
  submit.className = 'submit ' + QT.side;
  submit.textContent = QT.busy ? t('qt.sending') : t(QT.side === 'long' ? 'qt.submitLong' : 'qt.submitShort');
  submit.disabled = QT.busy || !!blocker || !(collateral > 0);
  submit.setAttribute('aria-busy', String(QT.busy));
  const input = $('qt-amount');
  if (input.value !== QT.amount) input.value = QT.amount;
  input.disabled = QT.busy;
  input.placeholder = t('qt.amount');
}
function qtOpen(side, opener){
  if (QT.open && QT.side === side){ qtClose(); return; }
  if (QT.side !== side || !QT.open){ QT.req = null; QT.status = null; }
  QT.side = side; QT.open = true; QT.opener = opener;
  qtEdited();
  $('qt-amount').focus();
}
function qtClose(){
  QT.open = false; QT.status = null; clearTimeout(QT.timer); QT.seq++;
  qtRender();
  if (QT.opener && !QT.opener.disabled) QT.opener.focus();
}
async function qtSubmit(){
  if (QT.busy) return;                       /* duplicate-submission guard */
  const blocker = qtBlocker();
  if (blocker || !(normNum(QT.amount) > 0)){ QT.status = { text: blocker || t('qt.invalid'), ok: false }; qtRender(); return; }
  const req = qtRequest(), provider = tp, sig = [req.market, req.side, req.leverage, req.collateral].join('|');
  QT.busy = true; QT.status = null; qtRender();
  try {
    if (provider.previewAsync && QT.previewSig !== sig){
      try { await provider.previewAsync(req); }
      catch (e) { QT.status = { text: String(e && e.message || e), ok: false }; return; }
    }
    if (provider !== tp || tp.canTrade === false){
      QT.status = { text: L('وضعیت حساب تغییر کرده است؛ سفارش را دوباره بررسی کنید.', 'Account state changed. Review the order again.'), ok: false };
      return;
    }
    const res = provider.submitAsync ? await provider.submitAsync(req) : provider.submit(req);
    if (res && res.ok){
      QT.req = null; QT.preview = null; QT.previewSig = '';
      toast(res.kind === 'position' ? t('toast.position') : t('toast.order'), 'pos');
      renderBottom(); renderAccount();
      QT.open = false; QT.status = null;
      if (QT.opener && !QT.opener.disabled) QT.opener.focus();
    } else {
      QT.status = { text: res && res.errors ? res.errors[0] : 'error', ok: false };
    }
  } catch (error) {
    /* keep QT.req: an explicit retry reuses the same idempotency key */
    QT.status = { text: L('وضعیت درخواست تأیید نشد؛ پوزیشن‌ها را بررسی کنید یا همین سفارش را دوباره بفرستید.', 'Request status could not be confirmed. Check positions or retry this same review.'), ok: false };
  } finally { QT.busy = false; qtRender(); }
}
if ($('qt-root')){
  $('qt-buy').addEventListener('click', e => qtOpen('long', e.currentTarget));
  $('qt-sell').addEventListener('click', e => qtOpen('short', e.currentTarget));
  $('qt-close').addEventListener('click', qtClose);
  $('qt-amount').addEventListener('input', e => { QT.amount = e.target.value; QT.status = null; qtEdited(); });
  $('qt-amount').addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); qtSubmit(); } });
  $('qt-lev').addEventListener('input', e => { QT.leverage = +e.target.value; QT.status = null; qtEdited(); });
  $('qt-submit').addEventListener('click', qtSubmit);
  $('qt-chips').addEventListener('click', e => {
    const b = e.target.closest('button[data-pct]');
    const avail = tp && tp.getAccount ? tp.getAccount()?.available : null;
    if (!b || b.disabled || avail == null || tp.canTrade === false) return;
    const rate = tp.feeRate?.(S.marketId), lev = qtLeverage() || 1;
    const budget = tp.serverMode && rate != null ? avail / (1 + lev * rate) : avail;
    QT.amount = (Math.floor(budget * (+b.dataset.pct) / 100 * 100) / 100).toFixed(2);
    QT.status = null; qtEdited();
  });
  $('qt-root').addEventListener('keydown', e => { if (e.key === 'Escape' && QT.open){ e.stopPropagation(); qtClose(); } });
  new MutationObserver(qtRender).observe(document.body, { attributes: true, attributeFilter: ['data-layout'] });
}

/* ============================================================
   VELA POSITION OVERLAYS — backend-managed 'position' drawings
   (entry/SL/TP box per open position, symbol-isolated, host-owned:
   user drawings are never touched). Mapping: positionId → drawingId.
   ============================================================ */
const posDrawings = new Map();   /* backend position id → vela drawing id */
const positionEdits = new Map(), positionRiskQueues = new Map();
let syncingPositionDrawings = false;

function velaPositionsSync(){
  if (!vc || !vc.chart || !vc.chart.drawings) return;
  const dr = vc.chart.drawings;
  const srv = window.__ofServerTP;
  if (!srv){ /* logged out → clear managed overlays only */ velaPositionsClear(); return; }
  const st = srv.state;
  syncingPositionDrawings = true;
  try {
  /* the box spans from the position's open time to "now" */
  const t = Math.floor(Date.now() / 60000) * 60000;
  const want = new Map();  /* positionId → overlay model (positionOverlayModel) */
  for (const p of st.positions){
    if (p.market !== S.marketId) continue;          /* symbol isolation */
    const model = positionOverlayModel(p);
    if (model) want.set(p.id, model);               /* no SL and no TP → no invented zones */
  }
  /* remove stale/closed (and all when the symbol switched) */
  for (const [pid, did] of [...posDrawings]){
    if (!want.has(pid)){ clearTimeout(positionEdits.get(pid)?.timer); positionEdits.delete(pid); try { dr.remove(did) } catch(e){}; posDrawings.delete(pid); }
  }
  const colors = positionOverlayColors();
  /* a chart rebuild (e.g. a data reload) can drop managed drawings; a
     mapping to a drawing that no longer exists is recreated, not patched */
  const present = new Set((dr.all ? dr.all() : []).filter(d => d.type === 'position').map(d => d.id));
  for (const [pid, did] of [...posDrawings]) if (!present.has(did)) posDrawings.delete(pid);
  /* create or update */
  for (const [pid, lv] of want){
    if (positionEdits.has(pid)) continue;
    /* The zones start at the candle that contains the confirmed fill
       (openedAt = the engine's fill timestamp) and extend past the latest
       bar into the right-hand region, so a just-opened position is not a
       sliver under the price axis. */
    const { start, end } = positionSpan(lv.openedAt, t);
    /* Vela's position tool is [entry, stop, target]. A missing level sits on
       the entry, so its zone has zero height and is not painted or labelled. */
    const anchors = [
      { time: start, price: lv.entry },
      { time: end, price: lv.stop ?? lv.entry },
      { time: end, price: lv.target ?? lv.entry }
    ];
    /* Labels: only price-distance % and level prices from the real position.
       The tool's own "Loss · Size" line is derived from a hypothetical
       balance × risk % and is never shown; the R:R header only when both
       levels exist (it is then the conventional |TP−E| / |E−SL|). */
    /* Vela applies per-type options only under `props` (DrawingStore.update) */
    const props = {
      anchors,
      /* one-sided boxes are read-only (a drag could otherwise invent the
         missing level); two-sided boxes keep the existing drag-to-edit */
      locked: !(lv.stop != null && lv.target != null && window.__ofServerTP?.canTrade),
      props: {
        showText: true, showPrices: true, showLossSize: false,
        showHeader: lv.ratio != null, showStopLabel: lv.stop != null, showTargetLabel: lv.target != null,
        profitColor: colors.profit, lossColor: colors.loss
      }
    };
    const did = posDrawings.get(pid);
    if (did != null){
      try { dr.update(did, props) } catch(e){ posDrawings.delete(pid); }
    } else {
      try {
        const d = dr.add('position', { paneId: 'price', anchors });
        if (d && d.id){
          posDrawings.set(pid, d.id);
          try { dr.update(d.id, props) } catch(e){}
        }
      } catch(e){ /* renderer without drawing support — table still works */ }
    }
  }
  syncEntryBoundaries(dr, st, t);
  syncExecutionMarkers(dr, st);
  renderPositionLegend(want);
  } finally { syncingPositionDrawings = false; }
}
/* ---------- candle mapping (chart timeframe → bucket) ---------- */
function chartTimeframe(){ return String(vc?.chart?.market?.timeframe ?? S.tf); }
function chartBarMs(){
  return ({ '1': 1, '5': 5, '15': 15, '30': 30, '60': 60, '240': 240, 'D': 1440, '1D': 1440, '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1d': 1440 }[chartTimeframe()] || 1) * 60000;
}
/* UTC bucket start of the candle containing `time` (Gains candles are UTC-aligned) */
function positionSpan(openedAt, now){ return window.OpenfundPositionOverlay.span(openedAt, now, chartBarMs(), 12); }

/* ---------- entry boundary: "نقطه ورود" at the authoritative entry ----------
   One locked horizontal segment per open position on this market, from the
   entry candle to the right edge of the zones. It is drawn for every open
   position (also without SL/TP) and uses the position's own entry price —
   never the current mark. */
const entryDrawings = new Map();   /* positionId → { id, sig } */
function syncEntryBoundaries(dr, st, now){
  const want = new Map();
  for (const p of st.positions) if (p.market === S.marketId && Number(p.entry) > 0) want.set(p.id, p);
  const present = new Set((dr.all ? dr.all() : []).map(d => d.id));
  for (const [pid, e] of [...entryDrawings]){
    if (!want.has(pid) || !present.has(e.id)){ if (present.has(e.id)) try { dr.remove(e.id) } catch(err){}; entryDrawings.delete(pid); }
  }
  const light = document.documentElement.dataset.theme === 'light';
  const color = light ? '#3F4C44' : '#D4E3D8';
  const d = Number(board.getMeta(S.marketId)?.pricePrecision ?? 2);
  for (const [pid, p] of want){
    const { start, end } = positionSpan(p.openedAt, now);
    const label = `${t('pos.entry')} · ${fmt.price(Number(p.entry), d)}`;
    const sig = [start, end, p.entry, label, color].join('|');
    const cur = entryDrawings.get(pid);
    if (cur && cur.sig === sig) continue;
    const patch = { anchors: [{ time: start, price: Number(p.entry) }, { time: end, price: Number(p.entry) }], locked: true,
      style: { lineColor: color, lineWidth: 1, lineStyle: 'dashed' },
      text: { value: label, color, size: 'small', bold: true, place: 'start' } };
    if (cur){ try { dr.update(cur.id, patch); cur.sig = sig; continue; } catch(err){ entryDrawings.delete(pid); } }
    try {
      const drw = dr.add('trendline', { paneId: 'price', anchors: patch.anchors });
      if (drw && drw.id){ entryDrawings.set(pid, { id: drw.id, sig }); try { dr.update(drw.id, patch) } catch(err){} }
    } catch(err){ /* renderer without drawing support */ }
  }
}

/* ---------- BUY / SELL execution markers ----------
   Source: confirmed fills only — each Prop position's opened_at is written by
   the engine when the order fills (market, or a triggered limit/stop);
   pending, cancelled and rejected orders never create a position, so they
   never create a marker. Partial closes share the original fill (same root
   position), so they are counted once. Fills are grouped per candle bucket
   and side for the chart's current timeframe: a long fill is a green BUY
   below the candle's low, a short fill a red SELL above its high; several
   fills in one candle show a count (×n). */
const execMarkers = new Map();     /* `${bucket}|${side}` → { id, sig } */
const candleRanges = new Map();    /* `${symbol}|${tf}|${bucket}` → {high, low} | 'pending' | null */
let liveBar = null;
function candleRange(bucket, barMs){
  if (liveBar && Number(liveBar.time) === bucket) return { high: Number(liveBar.high), low: Number(liveBar.low) };
  const key = `${S.marketId}|${chartTimeframe()}|${bucket}`;
  const hit = candleRanges.get(key);
  if (hit === 'pending') return undefined;
  if (hit !== undefined) return hit;
  const interval = G?.TF_MAP?.[chartTimeframe()];
  if (!interval || !G.fetchCandles) { candleRanges.set(key, null); return null; }
  candleRanges.set(key, 'pending');
  const market = S.marketId;
  G.fetchCandles(market, interval, bucket, bucket + barMs - 1).then(bars => {
    const bar = bars.find(b => b.time === bucket) || bars.find(b => b.time <= bucket && bucket < b.time + barMs) || null;
    candleRanges.set(key, bar ? { high: bar.high, low: bar.low } : null);
  }).catch(() => candleRanges.set(key, null)).finally(() => { if (S.marketId === market) velaPositionsSync(); });
  return undefined;
}
function syncExecutionMarkers(dr, st){
  const PO = window.OpenfundPositionOverlay;
  if (!PO?.executionGroups) return;
  const barMs = chartBarMs();
  const groups = PO.executionGroups(PO.executionFills([...(st.positions || []), ...(st.history || [])], S.marketId), barMs);
  const present = new Set((dr.all ? dr.all() : []).map(d => d.id));
  for (const [key, m] of [...execMarkers]){
    if (!groups.has(key) || !present.has(m.id)){ if (present.has(m.id)) try { dr.remove(m.id) } catch(err){}; execMarkers.delete(key); }
  }
  const light = document.documentElement.dataset.theme === 'light';
  const buy = light ? '#12965D' : '#82E7BD', sell = light ? '#C0453E' : '#E89483';
  for (const [key, g] of groups){
    const range = candleRange(g.bucket, barMs);
    if (range === undefined) continue;                 /* candle still loading */
    const long = g.side === 'long';
    const price = PO.markerPrice(g, range), label = g.label;
    const color = long ? buy : sell;
    const sig = [g.bucket, price, label, color].join('|');
    const cur = execMarkers.get(key);
    if (cur && cur.sig === sig) continue;
    const patch = { anchors: [{ time: g.bucket, price }], locked: true, style: { lineColor: color },
      text: { value: label, color, size: 'small', bold: true } };
    if (cur){ try { dr.update(cur.id, patch); cur.sig = sig; continue; } catch(err){ execMarkers.delete(key); } }
    try {
      const drw = dr.add(long ? 'arrowmarkup' : 'arrowmarkdown', { paneId: 'price', anchors: patch.anchors });
      if (drw && drw.id){ execMarkers.set(key, { id: drw.id, sig }); try { dr.update(drw.id, patch) } catch(err){} }
    } catch(err){ /* renderer without drawing support */ }
  }
  syncExecutionMarks(groups);
}
/* Execution details: the same fills on Vela's timeline-marks lane, which
   clusters per bar and opens a popup listing every individual fill. */
function syncExecutionMarks(groups){
  const marks = vc?.chart?.marks;
  if (!marks || typeof marks.set !== 'function') return;
  try {
    if (!syncExecutionMarks.defined && typeof marks.defineGroup === 'function'){ marks.defineGroup({ id: 'of-executions', label: L('اجرای معاملات', 'Executions') }); syncExecutionMarks.defined = true; }
    const d = Number(board.getMeta(S.marketId)?.pricePrecision ?? 2);
    const list = [];
    for (const g of groups.values()) for (const f of g.fills){
      const long = f.side === 'long';
      list.push({ id: 'of-fill-' + f.id, time: f.time, group: 'of-executions', title: long ? 'BUY' : 'SELL',
        glyph: { shape: 'circle', color: long ? '#12965D' : '#C0453E', letter: long ? 'B' : 'S' },
        tooltip: `${long ? 'BUY' : 'SELL'} · ${fmt.price(f.price, d)}`,
        content: { panel: { items: [
          { type: 'field', label: t('rv.market'), value: S.marketId },
          { type: 'field', label: t('pos.entry'), value: fmt.price(f.price, d) },
          { type: 'field', label: L('زمان اجرا (UTC)', 'Filled (UTC)'), value: new Date(f.time).toISOString().replace('T', ' ').slice(0, 19) },
          { type: 'field', label: L('شناسه موقعیت', 'Position ID'), value: '#' + f.id }
        ] } } });
    }
    const sig = list.map(m => m.id + m.time).join(',') + '|' + S.marketId;
    if (syncExecutionMarks.sig === sig) return;
    syncExecutionMarks.sig = sig;
    marks.set(list);
  } catch(err){ /* marks surface unavailable — the arrows still show */ }
}
/* every host-managed drawing (never persisted, never a user drawing) */
function managedDrawingIds(){
  return new Set([...posDrawings.values(), ...[...entryDrawings.values()].map(e => e.id), ...[...execMarkers.values()].map(m => m.id)]);
}
function positionOverlayModel(p){ return window.OpenfundPositionOverlay ? window.OpenfundPositionOverlay.model(p) : null; }
function positionOverlayColors(){
  const light = document.documentElement.dataset.theme === 'light';
  return light ? { profit: '#12965D', loss: '#C0453E' } : { profit: '#82E7BD', loss: '#E89483' };
}
/* Compact, non-blocking legend (one chip per overlaid position): side ·
   entry · SL · TP · R. Clicking a chip selects that position's box. */
function renderPositionLegend(want){
  const host = document.getElementById('chart-host');
  if (!host) return;
  let el = document.getElementById('pos-rr-legend');
  if (!want || !want.size){ if (el) el.remove(); return; }
  if (!el){ el = document.createElement('div'); el.id = 'pos-rr-legend'; el.className = 'pos-rr-legend'; el.setAttribute('aria-label', L('خلاصهٔ ریسک و بازده موقعیت‌ها', 'Position risk/reward')); host.appendChild(el); }
  const d = Number(board.getMeta(S.marketId)?.pricePrecision ?? 2);
  const pct = v => v == null ? '' : ` (${v.toFixed(2)}%)`;
  const html = [...want.values()].map(m => {
    const parts = [
      `<b class="${m.side === 'long' ? 'up' : 'down'}">${esc(m.side === 'long' ? 'LONG' : 'SHORT')}</b>`,
      `<span>${esc(t('pos.entry'))} <bdi dir="ltr">${esc(fmt.price(m.entry, d))}</bdi></span>`,
      m.stop != null ? `<span class="down">SL <bdi dir="ltr">${esc(fmt.price(m.stop, d))}${pct(m.stopPct)}</bdi></span>` : '',
      m.target != null ? `<span class="up">TP <bdi dir="ltr">${esc(fmt.price(m.target, d))}${pct(m.targetPct)}</bdi></span>` : '',
      m.ratio != null ? `<span>R <bdi dir="ltr">${m.ratio.toFixed(2)}</bdi></span>` : ''
    ].filter(Boolean).join('');
    return `<button type="button" class="pos-rr-chip" data-pos-rr="${esc(String(m.id))}" title="#${esc(String(m.id))}">${parts}</button>`;
  }).join('');
  if (el.dataset.html !== html){ el.innerHTML = html; el.dataset.html = html; }
}
document.addEventListener('click', e => {
  const b = e.target && e.target.closest && e.target.closest('[data-pos-rr]');
  if (!b || !vc?.chart?.drawings) return;
  const did = [...posDrawings].find(([pid]) => String(pid) === b.dataset.posRr)?.[1];
  if (did != null) try { vc.chart.drawings.select(did) } catch(err){}
});
function velaPositionsClear(){
  for (const edit of positionEdits.values()) clearTimeout(edit.timer);
  positionEdits.clear();
  if (!vc || !vc.chart || !vc.chart.drawings) return;
  for (const [, did] of [...posDrawings]){ try { vc.chart.drawings.remove(did) } catch(e){} }
  for (const e of [...entryDrawings.values(), ...execMarkers.values()]){ try { vc.chart.drawings.remove(e.id) } catch(err){} }
  posDrawings.clear(); entryDrawings.clear(); execMarkers.clear();
  try { vc.chart.marks?.set?.([]); syncExecutionMarks.sig = ''; } catch(err){}
  renderPositionLegend(null);
}

/* ============================================================
   VELA DRAWINGS PERSISTENCE — user drawings + tool defaults survive
   page refresh and market switches (per-symbol, localStorage).
   Vela API: chart.drawings.toJSON() / fromJSON(doc),
   chart.renderer.getConfig() / applyConfig(config),
   setToolDefaults(toolDefaults()).
   Position overlays are NOT saved here (rebuilt from backend state).
   ============================================================ */
const VELA_DRAW_KEY = (sym) => 'of-vela-drawings-' + sym;
let velaRestored = false;   /* saves are skipped until the initial restore completes */
const VELA_CONF_KEY = 'of-vela-config';
const VELA_TOOLS_KEY = 'of-vela-tools';
/* per-identity local cache (guest → original keys; signed-in wallet →
   namespaced keys hydrated from its server workspace) */
const chartStore = {
  get(k){ const W = window.OpenfundChartWorkspace; try { return W ? W.getLocal(k) : localStorage.getItem(k); } catch(e){ return null; } },
  set(k, v){ const W = window.OpenfundChartWorkspace; try { if (W) W.setLocal(k, v); else localStorage.setItem(k, v); } catch(e){} }
};
/* a newer save from another tab/device won the revision race: re-apply it
   (only the current symbol's drawings can be applied live) */
window.addEventListener('of-chart-workspace-remote', e => {
  if (!vc?.chart?.drawings || e.detail?.scope !== S.marketId) return;
  velaRestoreDrawings(); posDrawings.clear(); entryDrawings.clear(); execMarkers.clear(); velaPositionsSync();
  toast(L('نمودار از نشست دیگری به‌روز شد.', 'Chart updated from another session.'), 'info');
});

function velaSaveDrawings(){
  if (!vc || !vc.chart || !vc.chart.drawings) return;
  if (!velaRestored) return;   /* don't overwrite saved drawings before restore */
  try {
    const fullDoc = vc.chart.drawings.toJSON();
    const posIds = managedDrawingIds();
    if (fullDoc && Array.isArray(fullDoc.drawings)){
      fullDoc.drawings = fullDoc.drawings.filter(d => !posIds.has(d.id));
    }
    chartStore.set(VELA_DRAW_KEY(S.marketId), JSON.stringify(fullDoc));
    /* renderer config + tool defaults (once, not per symbol) */
    const conf = vc.chart.renderer.getConfig ? vc.chart.renderer.getConfig() : null;
    if (conf) chartStore.set(VELA_CONF_KEY, JSON.stringify(conf));
    const tools = vc.chart.drawings.toolDefaults ? vc.chart.drawings.toolDefaults() : null;
    if (tools) chartStore.set(VELA_TOOLS_KEY, JSON.stringify(tools));
    /* mirror to the signed-in wallet's server workspace (debounced) */
    const W = window.OpenfundChartWorkspace;
    if (W) { W.saveSymbol(S.marketId, fullDoc); W.saveSettings(); }
  } catch(e){ /* storage full or private mode — silently skip */ }
}

function velaRestoreDrawings(){
  if (!vc || !vc.chart || !vc.chart.drawings) return;
  try {
    const raw = chartStore.get(VELA_DRAW_KEY(S.marketId));
    const doc = JSON.parse(raw || 'null');
    if (doc && doc.drawings) {
      vc.chart.drawings.fromJSON(doc);
      /* fromJSON replaced every drawing (overlays included) and Vela may
         reuse their ids: forget the overlay mapping so a user drawing is
         never mistaken for an overlay; the next sync rebuilds them */
      posDrawings.clear();
      }
    velaRestored = true;   /* allow saves from now on */
    const conf = JSON.parse(chartStore.get(VELA_CONF_KEY) || 'null');
    if (conf && vc.chart.renderer.applyConfig) vc.chart.renderer.applyConfig(conf);
    // Restore user cosmetics first, then enforce the app-owned canvas palette.
    vc.setTheme(document.documentElement.dataset.theme);
    const tools = JSON.parse(chartStore.get(VELA_TOOLS_KEY) || 'null');
    if (tools && vc.chart.drawings.setToolDefaults) vc.chart.drawings.setToolDefaults(tools);
  } catch(e){ /* corrupted JSON — start fresh */ }
}

function velaClearDrawings(){
  if (!vc || !vc.chart || !vc.chart.drawings) return;
  try { vc.chart.drawings.fromJSON({ drawings: [] }) } catch(e){}
  posDrawings.clear();
}

/* ============================================================
   SL/TP DRAG-EDIT on chart — when the user drags the stop or target
   handle of a backend position overlay, update the backend protection.
   Vela events: drawing:edited → check if it's one of our position
   drawings → extract stop/target prices → PUT /trading/positions/:id/protection
   Reverts the chart position if the backend rejects.
   ============================================================ */
function onPositionDrawingEdited(drawingId){
  if (syncingPositionDrawings || !vc?.chart?.drawings) return;
  const srv = window.__ofServerTP;
  if (!srv?.canTrade) return;
  const pair = [...posDrawings].find(([, id]) => id === drawingId);
  if (!pair) return;
  const posId = pair[0], p = srv.state.positions.find(p => p.id === posId);
  const d = vc.chart.drawings.all().find(d => d.id === drawingId);
  if (!p || !d?.anchors || d.anchors.length < 3) return;
  const stop = d.anchors[1]?.price, target = d.anchors[2]?.price;
  if (!Number.isFinite(stop) || !Number.isFinite(target)) return;
  const precision = Number(board.getMeta(p.market)?.pricePrecision ?? 2);
  const sl = Number((p.side === 'long' ? Math.min(stop, target) : Math.max(stop, target)).toFixed(precision));
  const targetPrice = Number((p.side === 'long' ? Math.max(stop, target) : Math.min(stop, target)).toFixed(precision));
  clearTimeout(positionEdits.get(posId)?.timer);
  if (sl === Number(p.sl) && targetPrice === Number(p.tp)) { positionEdits.delete(posId); return; }
  // Capture the user intent now. SSE redraws must not overwrite a pending drag.
  const intent = { srv, market:p.market, sl, tp:targetPrice, timer:null };
  positionEdits.set(posId, intent);
  intent.timer = setTimeout(() => {
    const previous = positionRiskQueues.get(posId) || Promise.resolve();
    const write = previous.catch(() => {}).then(async () => {
      if (positionEdits.get(posId) !== intent) return;
      if (window.__ofServerTP !== srv || !srv.canTrade || S.marketId !== intent.market) { positionEdits.delete(posId); velaPositionsSync(); return; }
      try {
        const result = await srv.modifyRisk(posId, intent.sl, intent.tp);
        toast(result.ok ? L('حد ضرر و سود به‌روز شد.', 'SL/TP updated.') : result.errors?.[0] || L('تغییر حد ضرر و سود رد شد.', 'SL/TP update rejected.'), result.ok ? 'pos' : 'neg');
      } catch(error) { toast(L('به‌روزرسانی حد ضرر و سود ناموفق بود.', 'SL/TP update failed.'), 'neg'); }
      finally {
        if (positionEdits.get(posId) === intent) positionEdits.delete(posId);
        velaPositionsSync();
      }
    });
    positionRiskQueues.set(posId, write);
    const cleanup = () => { if (positionRiskQueues.get(posId) === write) positionRiskQueues.delete(posId); };
    void write.then(cleanup, cleanup);
  }, 600);
}

/* save drawings whenever the user modifies them (debounced) */
let velaSaveTimer = null;
function velaScheduleSave(){
  clearTimeout(velaSaveTimer);
  velaSaveTimer = setTimeout(velaSaveDrawings, 500);
}

/* lifecycle hooks: every state change, every market switch, boot, logout */
window.addEventListener('of-trading-update', velaPositionsSync);
window.addEventListener('of-trading-ready', velaPositionsSync);
window.addEventListener('of-trading-off', velaPositionsClear);

/* ============================================================
   POSITIONS / ORDERS WORKSPACE
   ============================================================ */
document.querySelectorAll('[data-bt]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-bt]').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', String(x === b)); });
  S.btTab = b.dataset.bt;
  renderBottom();
}));
$('load-demo').addEventListener('click', () => { tp.loadDemoScenario(); renderBottom(); renderAccount(); });

/* Patch a table body in place: unchanged renders are skipped entirely and,
   when the rows are the same records, only changed cells are rewritten.
   Rebuilding whole tables every tick made rows flicker, reset hover state
   and swallowed clicks on buttons replaced mid-click. */
const __rowTpl = document.createElement('template');
function patchBody(tb, html){
  if (!tb || tb.__ofHtml === html) return;
  tb.__ofHtml = html;
  __rowTpl.innerHTML = '<table><tbody>' + html + '</tbody></table>';
  const next = __rowTpl.content.querySelector('tbody').rows, cur = tb.rows;
  const same = cur.length === next.length && Array.prototype.every.call(next, (r, i) =>
    r.dataset.key && cur[i].dataset.key === r.dataset.key && cur[i].cells.length === r.cells.length);
  if (!same) { tb.innerHTML = html; return; }
  for (let i = 0; i < next.length; i++){
    const a = cur[i].cells, b = next[i].cells;
    for (let j = 0; j < b.length; j++){
      if (a[j].innerHTML !== b[j].innerHTML) a[j].innerHTML = b[j].innerHTML;
      if (a[j].className !== b[j].className) a[j].className = b[j].className;
      if (a[j].title !== b[j].title) a[j].title = b[j].title;
    }
  }
}
function renderBottom(){
  if (!tp || !$('bt-empty')) return;   /* teardown race guard */
  const st = tp.state;
  const feedState = $('account-feed-state');
  if (feedState) { feedState.hidden = tp.status === 'ready' && !tp.readOnly; feedState.textContent = tp.readOnly && tp.status === 'ready' ? L('حساب Gains فقط خواندنی است؛ اجرای سفارش فعال نیست.', 'Gains account is read-only; order execution is not enabled.') : tp.status === 'disconnected' ? L('اتصال حساب قطع است؛ اطلاعات ممکن است قدیمی باشد.', 'Account disconnected; displayed data may be stale.') : tp.status === 'stale' ? L('قیمت حساب به‌روز نیست.', 'Account prices are stale.') : tp.status === 'error' ? L('دریافت حساب ناموفق بود.', 'Account could not be loaded.') : tp.status === 'unavailable' ? L('معاملات این چالش فعال نشده است؛ فقط حساب تمرینی فعال امکان معامله دارد.', 'Challenge execution is not activated; select an active Free Trial to trade.') : tp.status === 'signedout' ? L('برای مشاهده حساب وارد شوید.', 'Sign in to view your account.') : L('در حال دریافت حساب…', 'Loading account…'); }
  if(window.__ofTerminalConfig){
    const ready=tp.status === undefined || tp.status === 'ready';
    const walletState=tp.walletState;
    const message=ready?t('bt.empty'):tp.status==='error'?L('دریافت اطلاعات حساب ناموفق بود. دوباره تلاش کنید.','Account activity could not be retrieved. Retry.'):tp.status==='signedout'&&walletState!=='checking'?L('برای مشاهدهٔ حساب وارد شوید.','Sign in to view your account.'):L('در حال دریافت اطلاعات حساب…','Loading account activity…');
    $('bt-empty').querySelector('p').textContent=message;
    $('cnt-positions').textContent=ready?st.positions.length:'—';$('cnt-orders').textContent=ready?st.orders.length:'—';
  }
  const hasActivity = st.positions.length || st.orders.length || st.history.length || st.fills.length || st.funding.length;
  /* signed-out empty state (one element shared by all tabs); shown only once
     the wallet state is known, so it never flashes during reconnect/restore */
  const walletEmpty = $('bt-wallet-empty');
  const signedOut = !!window.__ofTerminalConfig && tp.status === 'signedout' && (tp.walletState === 'disconnected' || tp.walletState === 'connected');
  if (walletEmpty) {
    walletEmpty.hidden = !signedOut;
    if (signedOut) {
      const connected = tp.walletState === 'connected';
      const text = connected ? L('برای مشاهدهٔ موقعیت‌ها و سفارش‌ها، وارد اوپن‌فاند شوید.', 'Sign in to Openfund to view positions and orders.') : L('برای مشاهده موقعیت‌ها و سفارش‌ها، کیف پول خود را متصل کنید.', 'Connect your wallet to view positions and orders.');
      const label = connected ? L('ورود به اوپن‌فاند', 'Sign in') : L('اتصال کیف پول', 'Connect wallet');
      if ($('bt-wallet-empty-text').textContent !== text) $('bt-wallet-empty-text').textContent = text;
      if ($('bt-wallet-connect').textContent !== label) $('bt-wallet-connect').textContent = label;
    }
  }
  $('bt-empty').hidden = !!hasActivity || signedOut;
  document.querySelectorAll('.bt-table').forEach(el => el.hidden = el.dataset.t !== S.btTab || !hasActivity);
  if(!window.__ofTerminalConfig || tp.status===undefined || tp.status==='ready') $('cnt-positions').textContent = st.positions.length;
  if(!window.__ofTerminalConfig || tp.status===undefined || tp.status==='ready') $('cnt-orders').textContent = st.orders.length;
  patchBody($('tb-positions'), st.positions.map(p => {
    const m = board.getMeta(p.market); if (!m) return '';
    const d = Number(m.pricePrecision), dps = Number(m.sizePrecision) || 2;
    const mk = tp.serverMode ? p.srvMark ?? null : board.getMark(p.market) || p.entry;
    const pnl = tp.readOnly ? null : tp.serverMode ? p.srvPnl ?? null : (mk - p.entry) * p.size * (p.side === 'long' ? 1 : -1);
    const roe = tp.serverMode ? p.srvRoi ?? null : pnl == null ? null : pnl / p.margin * 100;
    return `<tr data-key="p:${esc(p.id)}">
      <td>${iconHTML(p.market)} <b>${m.symbol}</b></td>
      <td class="side-${p.side === 'long' ? 'l' : 's'}">${t(p.side === 'long' ? 'rv.side.long' : 'rv.side.short')}</td>
      <td class="r num">${fmt.num(p.size, dps)} ${m.base}</td>
      <td class="r num">${fmt.price(p.entry, d)}</td>
      <td class="r num">${fmt.price(mk, d)}</td>
      <td>${p.leverage}×</td>
      <td class="r num">${p.currency ? fmt.num(p.margin,2)+' '+p.currency : fmt.usd(p.margin)}</td>
      <td class="r num ${pnl >= 0 ? 'up' : 'down'}">${fmt.usdS(pnl)}</td>
      <td class="r num ${roe >= 0 ? 'up' : 'down'}">${fmt.pct(roe)}</td>
      <td class="r num down" title="Simplified estimate">${fmt.price(p.liq, d)}</td>
      <td class="r num">${p.sl ? fmt.price(p.sl, d) : '—'} / ${p.tp ? fmt.price(p.tp, d) : '—'}</td>
      <td>
        <button class="act-btn" ${tp.canTrade===false?'disabled':''} data-close="${p.id}">${t('act.close')}</button>
        <button class="act-btn" ${tp.canTrade===false?'disabled':''} data-sltp="${p.id}">${t('act.sltp')}</button>
        <button class="act-btn" data-detail="${p.id}">${t('act.details')}</button>
        <button class="act-btn act-share" data-share="${p.id}">${t('act.share')}</button>
      </td></tr>`;
  }).join('') || emptyRow(12, t('empty.positions')));
  patchBody($('tb-orders'), st.orders.map(o => {
    const m = board.getMeta(o.market); if (!m) return '';
    const d = Number(m.pricePrecision), dps = Number(m.sizePrecision) || 2;
    return `<tr data-key="o:${esc(o.id)}">
      <td>${iconHTML(o.market)} <b>${m.symbol}</b></td>
      <td><span class="tag">${t('ot.' + o.type)}</span></td>
      <td class="side-${o.side === 'long' ? 'l' : 's'}">${t(o.side === 'long' ? 'rv.side.long' : 'rv.side.short')}</td>
      <td class="r num">${fmt.num(o.size, dps)} ${m.base}</td>
      <td class="r num">${fmt.price(o.trigger, d)}</td>
      <td><span class="tag lime">${t('tag.pending')}</span></td>
      <td class="num">${fmt.dt(o.createdAt / 1000)}</td>
      <td><button class="act-btn danger" ${tp.canTrade===false?'disabled':''} data-cancel="${o.id}">${t('act.cancel')}</button></td>
    </tr>`;
  }).join('') || emptyRow(8, t('empty.orders')));
  patchBody($('tb-history'), st.history.map(h => {
    const m = board.getMeta(h.market); if (!m) return '';
    const d = Number(m.pricePrecision);
    const cls = h.result.includes('profit') ? 'pos' : h.result.includes('loss') ? 'neg' : '';
    return `<tr data-key="h:${esc(h.id)}">
      <td>${iconHTML(h.market)} <b>${m.symbol}</b></td>
      <td><span class="tag">${tp.readOnly ? h.type : h.type.includes('-') ? t('res.' + h.type) : t('ot.' + h.type)}</span></td>
      <td class="side-${h.side === 'long' ? 'l' : 's'}">${t(h.side === 'long' ? 'rv.side.long' : 'rv.side.short')}</td>
      <td class="r num">${fmt.num(h.size, Number(m.sizePrecision) || 2)}</td>
      <td class="r num">${fmt.price(h.price, d)}</td>
      <td><span class="tag ${cls}">${tp.readOnly ? h.result : t('res.' + h.result)}</span></td>
      <td class="num">${fmt.dt(h.time / 1000)}</td>
      <td>${h.realized != null && Number.isFinite(h.realized) ? `<button class="act-btn act-share" data-share-history="${h.id}">${t('act.share')}</button>` : ''}</td>
    </tr>`;
  }).join('') || emptyRow(8, t('empty.history')));
  patchBody($('tb-fills'), st.fills.map(f => {
    const m = board.getMeta(f.market); if (!m) return '';
    const d = Number(m.pricePrecision);
    return `<tr>
      <td>${iconHTML(f.market)} <b>${m.symbol}</b></td>
      <td class="side-${f.side === 'long' || f.side === 'buy' ? 'l' : 's'}">${f.side === 'buy' ? 'بای' : f.side === 'sell' ? 'سل' : t(f.side === 'long' ? 'rv.side.long' : 'rv.side.short')}</td>
      <td class="r num">${fmt.num(f.size, Number(m.sizePrecision) || 2)}</td>
      <td class="r num">${fmt.price(f.price, d)}</td>
      <td class="r num">${fmt.usd(f.fee)}</td>
      <td><span class="tag">${f.role}</span></td>
      <td class="num">${fmt.dt(f.time / 1000)}</td>
    </tr>`;
  }).join('') || emptyRow(7, t('empty.fills')));
  patchBody($('tb-funding'), st.funding.map(f => {
    const m = board.getMeta(f.market); if (!m) return '';
    return `<tr>
      <td>${iconHTML(f.market)} <b>${m.symbol}</b></td>
      <td class="r num">${(f.rate * 100).toFixed(4)}%</td>
      <td class="r num ${f.pay >= 0 ? 'up' : 'down'}">${fmt.usdS(f.pay)}</td>
      <td class="num">${fmt.dt(f.time / 1000)}</td>
    </tr>`;
  }).join('') || emptyRow(4, t('empty.funding')));
  wireRowActions();
  window.OpenfundShareCard?.refresh();
}
function emptyRow(cols, text){
  return `<tr class="empty-tr"><td colspan="${cols}" style="color:var(--muted);padding:22px 18px;white-space:normal">${text}</td></tr>`;
}

/* Built-in position-detail labels per language, used whenever a CMS value
   is missing or malformed so a label can never collapse to one character. */
const DETAIL_LABELS = {};
for (const __l in I18N) DETAIL_LABELS[__l] = Array.isArray(I18N[__l]['pos.details']) ? I18N[__l]['pos.details'] : null;
function detailLabels(){
  const v = t('pos.details');
  if (Array.isArray(v) && v.length === 13) return v;
  return DETAIL_LABELS[window.ofLang] || DETAIL_LABELS.en || EN['pos.details'];
}
function esc(v){
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
/* ============================================================
   SHARE P&L — builds the share-card model from the same authoritative
   values the positions/history tables show (server snapshot in server
   mode, the live board otherwise). No P&L is computed here beyond what
   the table already displays; unavailable fields render as N/A.
   ============================================================ */
function shareCategory(m){
  const g = m && m.group;
  if (!g) return '';
  for (const k of ['cat.' + g, 'cat.' + g.replace(/s$/, '')]) { const v = t(k); if (v !== k) return v; }
  return '';
}
function shareCommon(market){
  const m = board.getMeta(market);
  const product = window.__ofTerminalConfig && window.__ofTerminalConfig.product === 'perpetual' ? 'PERPETUAL' : 'PROP';
  return { m, rtl: document.documentElement.dir === 'rtl', productLabel: 'OPENFUND ' + product };
}
function shareResult(v){ return v == null || !Number.isFinite(v) ? t('share.unrealized') : t(v >= 0 ? 'share.profit' : 'share.loss'); }
function shareTime(ms){
  const d = new Date(ms), z = n => String(n).padStart(2, '0');
  return d.getFullYear() + '/' + z(d.getMonth() + 1) + '/' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds());
}
function shareGenerated(){
  return new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}
function shareOpenModel(id){
  const p = tp && tp.getPosition(id);
  if (!p) return null;
  const { m, rtl, productLabel } = shareCommon(p.market);
  if (!m) return null;
  const d = Number(m.pricePrecision), dps = Number(m.sizePrecision) || 2, na = t('share.na');
  /* identical expressions to the positions table */
  const mk = tp.serverMode ? p.srvMark ?? null : board.getMark(p.market) || p.entry;
  const pnl = tp.readOnly ? null : tp.serverMode ? p.srvPnl ?? null : (mk - p.entry) * p.size * (p.side === 'long' ? 1 : -1);
  const roe = tp.serverMode ? p.srvRoi ?? null : pnl == null ? null : pnl / p.margin * 100;
  const stale = tp.serverMode ? (tp.status === 'stale' || tp.status === 'disconnected' || mk == null) : (board.status !== 'live' || board.stale(p.market));
  return {
    rtl, productLabel, status: 'open', statusLabel: t('share.open'),
    symbol: m.symbol, instrument: shareCategory(m), long: p.side === 'long',
    sideLabel: t(p.side === 'long' ? 'share.buy' : 'share.sell'),
    leverageLabel: Number.isFinite(Number(p.leverage)) && p.leverage ? p.leverage + '×' : '',
    pnl: pnl == null || !Number.isFinite(pnl) ? null : pnl,
    pnlLabel: t('share.unrealized'),
    pnlText: pnl == null || !Number.isFinite(pnl) ? na : fmt.usdS(pnl),
    roiText: roe == null || !Number.isFinite(roe) ? '' : fmt.pct(roe),
    resultLabel: shareResult(pnl),
    sizeText: p.size != null && Number.isFinite(p.size) ? fmt.num(p.size, dps) + ' ' + m.base : '',
    openLabel: t('share.openAt'), openPrice: Number.isFinite(p.entry) ? fmt.price(p.entry, d) : na,
    openTime: p.openedAt ? shareTime(p.openedAt) : na,
    endLabel: t('share.markAt'), endPrice: mk != null && Number.isFinite(mk) ? fmt.price(mk, d) : na,
    endTime: shareTime(Date.now()),
    stale, feedLabel: t(stale ? 'share.stale' : 'share.live'),
    generatedText: shareGenerated()
  };
}
function shareClosedModel(id){
  const h = tp && tp.state.history.find(x => String(x.id) === String(id));
  if (!h || h.realized == null || !Number.isFinite(h.realized)) return null;
  const { m, rtl, productLabel } = shareCommon(h.market);
  if (!m) return null;
  const d = Number(m.pricePrecision), dps = Number(m.sizePrecision) || 2, na = t('share.na');
  return {
    rtl, productLabel, status: 'closed', statusLabel: t('share.closed'),
    symbol: m.symbol, instrument: shareCategory(m), long: h.side === 'long',
    sideLabel: t(h.side === 'long' ? 'share.buy' : 'share.sell'),
    leverageLabel: Number.isFinite(Number(h.leverage)) && h.leverage ? h.leverage + '×' : '',
    pnl: h.realized, pnlLabel: t('share.realized'), pnlText: fmt.usdS(h.realized),
    roiText: h.roi != null && Number.isFinite(h.roi) ? fmt.pct(h.roi) : '',
    resultLabel: shareResult(h.realized),
    sizeText: Number.isFinite(h.size) ? fmt.num(h.size, dps) + ' ' + m.base : '',
    openLabel: t('share.openAt'), openPrice: h.entry != null && Number.isFinite(h.entry) ? fmt.price(h.entry, d) : na,
    openTime: h.openedAt ? shareTime(h.openedAt) : na,
    endLabel: t('share.closeAt'), endPrice: Number.isFinite(h.price) ? fmt.price(h.price, d) : na,
    endTime: h.time ? shareTime(h.time) : na,
    stale: false, feedLabel: '', generatedText: shareGenerated()
  };
}
function shareLabels(){
  return { title: t('share.title'), download: t('share.download'), share: t('share.native'), close: t('share.close'),
    liveNote: t('share.liveNote'), finalNote: t('share.finalNote'), saved: t('share.saved'), failed: t('share.failed'), gone: t('share.gone') };
}
function openShare(kind, id){
  if (!window.OpenfundShareCard) return;
  const getter = kind === 'history' ? () => shareClosedModel(id) : () => shareOpenModel(id);
  if (!window.OpenfundShareCard.open(getter, shareLabels())) toast(t('share.failed'), 'error');
}
/* Row actions are delegated once: rows are patched in place on every
   data update, so per-render listeners would either duplicate or be lost
   (a click landing while a row was being replaced used to do nothing). */
let rowActionsWired = false;
function wireRowActions(){
  if (rowActionsWired) return;
  rowActionsWired = true;
  document.addEventListener('click', e => {
    const b = e.target && e.target.closest && e.target.closest('[data-close],[data-cancel],[data-sltp],[data-detail],[data-share],[data-share-history]');
    if (!b || b.disabled || !b.closest('.bt-table')) return;
    if (b.matches('[data-share]')) {
    openShare('position', b.dataset.share);
      return;
    }
    if (b.matches('[data-share-history]')) {
    openShare('history', b.dataset.shareHistory);
      return;
    }
    if (b.matches('[data-close]')) {
    const partial = tp.serverMode && !tp.readOnly;
    confirmDialog(t('cf.close'), t('cf.closeTxt'), () => {
      const fraction = partial ? Number($('close-fraction').value) : 1;
      (async () => { try { await tp.closePosition(b.dataset.close, fraction); } catch(e){ toast(String(e.message || e), 'error'); } renderBottom(); renderAccount(); })();
    }, null, partial ? `<label>${L('مقدار بستن پوزیشن', 'Position to close')} <select id="close-fraction"><option value="1">100%</option><option value="0.5">50%</option><option value="0.25">25%</option></select></label>` : null);
      return;
    }
    if (b.matches('[data-cancel]')) {
    confirmDialog(t('cf.cancel'), t('cf.cancelTxt'), () => {
      (async () => { try { await tp.cancelOrder(b.dataset.cancel); } catch(e){ toast(String(e.message || e), 'error'); } renderBottom(); renderAccount(); })();
    });
      return;
    }
    if (b.matches('[data-sltp]')) {
    const p = tp.getPosition(b.dataset.sltp);
    if (!p) return;
    openSltpDialog(p);
      return;
    }
    if (b.matches('[data-detail]')) {
    const p = tp.getPosition(b.dataset.detail);
    if (!p) return;
    const m = board.getMeta(p.market);
    const d = Number(m.pricePrecision);
    const srv = p.mark_price != null ? p.mark_price : (p.srvMark != null ? p.srvMark : null);
    const mk = srv != null ? Number(srv) : (board.getMark(p.market) || p.entry);
    const pnl = tp.readOnly ? null : tp.serverMode ? p.srvPnl ?? p.realized ?? null : p.realized != null ? p.realized : (mk - p.entry) * p.size * (p.side === 'long' ? 1 : -1);
    const D = detailLabels();
    /* [label, value, isTechnical] — technical values (ids, symbols, numbers,
       dates) are isolated LTR so they keep their reading order in RTL. */
    const rows = [
      [D[0], '#' + p.id, true], [D[1], m.symbol, true], [D[2], t(p.side === 'long' ? 'rv.side.long' : 'rv.side.short'), false],
      [D[3], fmt.num(p.size, Number(m.sizePrecision) || 2) + ' ' + m.base, true], [D[4], fmt.price(p.entry, d), true],
      [D[5], fmt.price(mk, d), true], [D[6], p.leverage + '×', true],
      [D[7], p.currency ? fmt.num(p.margin,2)+' '+p.currency : fmt.usd(p.margin), true], [D[8], fmt.price(p.liq, d), true],
      [D[9], fmt.usdS(pnl), true], [D[10], (p.sl ? fmt.price(p.sl, d) : '—') + ' / ' + (p.tp ? fmt.price(p.tp, d) : '—'), true],
      [D[11], fmt.dt(p.openedAt / 1000), true], [D[12], fmt.usd(p.feePaid), true]
    ];
    const pnlCls = pnl == null ? '' : pnl > 0 ? ' up' : pnl < 0 ? ' down' : '';
    confirmDialog(t('cf.detail'), null, null, () => {},
      `<dl class="pos-detail-grid">${rows.map(([k, v, tech], i) => `<div><dt>${esc(k)}</dt><dd class="${tech ? 'num' : ''}${i === 9 ? pnlCls : ''}">${tech ? `<bdi dir="ltr">${esc(v)}</bdi>` : esc(v)}</dd></div>`).join('')}</dl>`);
      return;
    }
  });
}
/* SL/TP dialog. Input is normalized at the UI boundary only
   (OpenfundNumericInput: English, Persian and Arabic-Indic digits, locale
   decimal separators); the parsed number goes to the SAME provider
   modifyRisk() as before, which keeps every price rule. A blank field
   clears that level; an unreadable field is reported and never sent (it
   used to become NaN → null and silently REMOVE the level). The dialog
   closes only after the provider confirms; the server provider refreshes
   positions (and with them the chart overlay) from the backend first. */
let sltpTarget = null, sltpBusy = false;
const shortId = id => { const s = String(id); return s.length > 12 ? s.slice(0, 6) + '…' + s.slice(-4) : s; };
function sltpError(msg, field){
  $('sltp-err').textContent = msg; $('sltp-err').hidden = !msg;
  for (const id of ['sltp-sl', 'sltp-tp']) {
    $(id).closest('.field').classList.toggle('invalid', id === field);
    $(id).setAttribute('aria-invalid', String(id === field));
  }
}
function openSltpDialog(p){
  const m = board.getMeta(p.market) || {};
  const d = Number(m.pricePrecision ?? 2);
  sltpTarget = p.id;
  $('sltp-title').textContent = t('sltp.title');
  const side = p.side === 'long' ? 'long' : 'short';
  $('sltp-meta').innerHTML =
    `<bdi dir="ltr" class="sltp-sym">${esc(m.symbol || p.market)}</bdi>` +
    `<span class="sltp-side ${side === 'long' ? 'up' : 'down'}">${esc(t(side === 'long' ? 'rv.side.long' : 'rv.side.short'))}</span>` +
    `<button type="button" class="sltp-id" id="sltp-copy-id" title="${esc(String(p.id))}" aria-label="${esc(L('کپی شناسهٔ موقعیت', 'Copy position ID') + ' ' + p.id)}"><bdi dir="ltr">#${esc(shortId(p.id))}</bdi></button>`;
  $('sltp-hint').innerHTML = `${esc(t('rk.entry'))}: <bdi dir="ltr" class="num">${esc(fmt.price(p.entry, d))}</bdi>`;
  /* show stored levels exactly as stored (no reformatting / rounding) */
  $('sltp-sl').value = p.sl != null && p.sl !== '' ? String(p.sl) : '';
  $('sltp-tp').value = p.tp != null && p.tp !== '' ? String(p.tp) : '';
  sltpError('');
  sltpBusy = false; $('sltp-save').disabled = false; $('sltp-save').removeAttribute('aria-busy');
  $('sltp-dialog').showModal();
}
document.addEventListener('click', e => {
  const b = e.target && e.target.closest && e.target.closest('#sltp-copy-id');
  if (!b) return;
  const full = b.getAttribute('title') || '';
  try { navigator.clipboard?.writeText(full).then(() => toast(L('شناسه کپی شد.', 'ID copied.'), 'pos'), () => {}); } catch(err){}
});
$('sltp-cancel').addEventListener('click', () => { if (!sltpBusy) $('sltp-dialog').close(); });
$('sltp-dialog').addEventListener('cancel', e => { if (sltpBusy) e.preventDefault(); });
$('sltp-save').addEventListener('click', async () => {
  if (sltpTarget == null || sltpBusy) return;
  const NI = window.OpenfundNumericInput;
  const read = id => {
    const r = NI ? NI.parseDecimal($(id).value, { lang: window.ofLang }) : (() => { const v = normNum($(id).value); return !$(id).value.trim() ? { ok: true, empty: true } : Number.isFinite(v) ? { ok: true, value: v } : { ok: false }; })();
    if (r.ok && !r.empty && !(r.value > 0)) return { ok: false };
    return r;
  };
  const sl = read('sltp-sl'), tpv = read('sltp-tp');
  if (!sl.ok) { sltpError(L('قیمت حد ضرر معتبر نیست.', 'Enter a valid Stop Loss price.'), 'sltp-sl'); $('sltp-sl').focus(); return; }
  if (!tpv.ok) { sltpError(L('قیمت حد سود معتبر نیست.', 'Enter a valid Take Profit price.'), 'sltp-tp'); $('sltp-tp').focus(); return; }
  sltpError('');
  sltpBusy = true; $('sltp-save').disabled = true; $('sltp-save').setAttribute('aria-busy', 'true');
  const target = sltpTarget, provider = tp;
  try {
    const res = await Promise.resolve(provider.modifyRisk(target, sl.empty ? null : sl.value, tpv.empty ? null : tpv.value));
    if (!res || !res.ok) { sltpError((res && res.errors && res.errors[0]) || L('تغییر حد ضرر و سود رد شد.', 'SL/TP update rejected.')); return; }
    $('sltp-dialog').close();
    toast(L('حد ضرر و سود به‌روز شد.', 'SL/TP updated.'), 'pos');
    renderBottom(); velaPositionsSync();
  } catch (err) {
    sltpError(String((err && err.message) || L('به‌روزرسانی حد ضرر و سود ناموفق بود.', 'SL/TP update failed.')));
  } finally {
    sltpBusy = false; $('sltp-save').disabled = false; $('sltp-save').removeAttribute('aria-busy');
  }
});

let confirmCb = null;
function confirmDialog(title, text, cb, extraCb, html){
  $('confirm-title').textContent = title;
  $('confirm-text').innerHTML = html || text || '';
  $('confirm-text').className = html ? 'review-body' : '';
  $('confirm-ok').hidden = !cb;
  $('confirm-cancel').textContent = cb ? t('dlg.cancel') : t('dlg.close');
  confirmCb = cb;
  $('confirm-dialog').showModal();
}
$('confirm-cancel').addEventListener('click', () => $('confirm-dialog').close());
$('confirm-ok').addEventListener('click', () => { $('confirm-dialog').close(); if (confirmCb) confirmCb(); confirmCb = null; });

/* ============================================================
   ACCOUNT + WALLET + DIALOGS
   ============================================================ */
function renderAccount(){
  if (!tp || !$('ac-equity')) return;   /* teardown race guard */
  const a = tp.getAccount();
  if (!a) { for (const id of ['ac-equity','ac-available','ac-margin','ac-upnl','ac-pos','ac-ord']) $(id).textContent='—'; return; }
  $('ac-equity').textContent = fmt.usd(a.equity);
  $('ac-available').textContent = fmt.usd(a.available);
  $('ac-margin').textContent = fmt.usd(a.marginUsed);
  $('ac-upnl').textContent = fmt.usdS(a.upnl);
  $('ac-upnl').className = 'num ' + (a.upnl > 0 ? 'up' : a.upnl < 0 ? 'down' : '');
  $('ac-pos').textContent = a.positionCount ?? '—';
  $('ac-ord').textContent = a.orderCount ?? '—';
  if (isPropTerminal() && meta()) applyLeverageCap(true);
}
/* the empty-state button runs the shell's existing wallet flow (connect,
   or Openfund sign-in when a wallet is already connected) */
$('bt-wallet-connect')?.addEventListener('click', () => { try { window.parent.__ofOpenConnect?.(); } catch (e) { /* shell unavailable */ } });
$('wallet-btn').addEventListener('click', () => {
  if (!wp.connected){
    wp.connectDemo();
    $('wallet-btn').innerHTML = `${wp.address} <em class="demo-flag">DEMO</em>`;
    toast(t('toast.wallet'), 'info');
  } else {
    wp.disconnect();
    $('wallet-btn').innerHTML = `Connect Wallet <em class="demo-flag">DEMO</em>`;
  }
});
$('settings-btn').addEventListener('click', () => $('settings-dialog').showModal());
$('set-flash').addEventListener('change', e => S.flashOn = e.target.checked);
$('assumptions-btn').addEventListener('click', () => $('assumptions-dialog').showModal());
$('notifications-btn').addEventListener('click', () => {
  const list = tp.state.notifications;
  $('notif-list').innerHTML = list.length
    ? list.map(n => `<li>${n.text}<time>${fmt.dt(n.time / 1000)}</time></li>`).join('')
    : `<li class="notif-empty">${t('notif.empty')}</li>`;
  $('notif-dot').classList.remove('on');
  $('notifications-dialog').showModal();
});
document.querySelectorAll('.dlg-close').forEach(b => b.addEventListener('click', e => e.target.closest('dialog').close()));

tp = null; /* assigned after boot */
let toastTimer = null;
function toast(text, kind){
  let el = document.querySelector('.toast');
  if (!el){
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.className = 'toast show ' + (kind || '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ============================================================
   BOTTOM PANEL RESIZE
   ============================================================ */
(function(){
  const handle = $('bottom-resize'), panel = document.querySelector('.bottom-panel');
  let dragging = false, startY = 0, startH = 0;
  function begin(e){
    dragging = true; startY = e.clientY; startH = panel.offsetHeight;
    handle.classList.add('active');
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }
  function move(e){
    if (!dragging) return;
    const h = Math.max(120, Math.min(innerHeight - 260, startH + (startY - e.clientY)));
    panel.style.height = h + 'px';
    if (vc) { try { vc.resize(); } catch(err){} }
  }
  function end(){
    dragging = false; handle.classList.remove('active');
    document.body.style.userSelect = '';
  }
  handle.addEventListener('pointerdown', begin);
  addEventListener('pointermove', move, {passive: true});
  addEventListener('pointerup', end);
  handle.addEventListener('keydown', e => {
    const h = panel.offsetHeight;
    if (e.key === 'ArrowUp'){ panel.style.height = Math.min(innerHeight - 260, h + 24) + 'px'; e.preventDefault(); }
    if (e.key === 'ArrowDown'){ panel.style.height = Math.max(120, h - 24) + 'px'; e.preventDefault(); }
    if (vc) { try { vc.resize(); } catch(err){} }
  });
})();

/* ============================================================
   STATUS BAR (real feed state)
   ============================================================ */
function renderStatus(){
  const s = board.status;
  const stale = board.markAge(S.marketId) > 90000;
  let txt, live = s === 'live' && !stale;
  if (live) txt = t('sb.live');
  else if (s === 'reconnecting') txt = t('sb.reconnecting');
  else txt = t('sb.connecting');
  if (stale && s === 'live') txt = t('sb.stale');
  const tick = $('sb-tick'); if (tick) tick.innerHTML = `<i class="dot ${live ? 'dot-live' : 'dot-info'}"></i> ${txt}`;
}
function clock(){
  const el = $('sb-clock'); if (!el) return;   /* teardown race guard */
  const off = -new Date().getTimezoneOffset();
  const sign = off >= 0 ? '+' : '−';
  const h = Math.floor(Math.abs(off) / 60), m = Math.abs(off) % 60;
  const tz = 'UTC' + sign + h + (m ? ':' + String(m).padStart(2, '0') : '');
  $('sb-clock').textContent = new Date().toLocaleTimeString('en-GB', {hour12: false}) + ' · ' + tz;
}
setInterval(clock, 1000); clock();

/* ============================================================
   BOOT — connect to Gains, then build the UI
   ============================================================ */
function boot(){
  $('market-select-btn').disabled = true;
  $('submit-order').disabled = true;
  chartOverlay(`<b>${t('boot.loading')}</b>`);
  /* the signed-in wallet's chart workspace is hydrated BEFORE the chart
     mounts, so default initialization never overwrites a restored state */
  Promise.all([board.boot(), window.OpenfundChartWorkspace ? window.OpenfundChartWorkspace.ready : null]).then(() => {
    let requestedSymbol = null;
    /* market deep-link from the Markets page (sessionStorage handshake;
       applied once at boot, only when the symbol exists in Gains metadata) */
    try {
      const want = sessionStorage.getItem('of-terminal-symbol');
      if (want) { sessionStorage.removeItem('of-terminal-symbol');
        if (board.meta.has(want)) { S.marketId = want; requestedSymbol = want;
          const g = board.meta.get(want).group;
          if (g) S.ddCategory = g; } }
    } catch(e){}
    tp = window.__ofProductAdapter || window.__ofServerTP || new TradingProvider(board);
    /* server trading bridge (authenticated users): swap provider + live updates */
    window.addEventListener('of-trading-ready', () => {
      tp = window.__ofProductAdapter || window.__ofServerTP;
      $('load-demo').style.display = 'none';
      renderAccount(); renderBottom(); computeForm();
    });
    window.addEventListener('of-trading-update', () => {
      tp = window.__ofProductAdapter || window.__ofServerTP || tp;
      renderAccount(); computeForm();
      if (['positions','orders','history'].includes(S.btTab) || S.btTab == null) renderBottom();
    });
    window.addEventListener('of-trading-off', () => {
      tp = window.__ofProductAdapter || new TradingProvider(board);
      renderAccount(); renderBottom(); computeForm();
    });
    tp.subscribe(() => {
      if (document.querySelector('dialog[open]') !== $('notifications-dialog')) $('notif-dot').classList.add('on');
    });
    /* live board → UI + demo triggers (throttled) */
    let lastTrig = 0, lastBook = 0, renderQ = false;
    let selectedDirty = true;
    board.on((_, changed) => {
      if (!changed || changed.market === S.marketId) selectedDirty = true;
      if (renderQ) return;
      renderQ = true;
      requestAnimationFrame(() => {
        renderQ = false;
        const now = Date.now();
        /* other markets' ticks only matter to the open dropdown, positions
           and the throttled blocks below */
        if (selectedDirty) { selectedDirty = false; renderMarketStats(); renderStatus(); computeForm(); }
        /* live ticks patch price cells in place; rebuilding the list here
           detached the row under the pointer, so a click was lost or read
           as an outside click that closed the menu */
        if (ddOpen) paintDropdown(false);
        if (now - lastBook > 1500){ lastBook = now; renderBook(); noteTrade(board.marks.get(S.marketId)); renderTrades(); }
        if (now - lastTrig > 1500){ lastTrig = now; tp.checkTriggers(); renderAccount(); velaPositionsSync(); if (S.btTab === 'positions' && tp.state.positions.length) renderBottom(); else window.OpenfundShareCard?.refresh(); }
      });
    });
    board.on(p => { if (p && p.market === S.marketId) { /* nothing extra */ } });
    applyStaticI18n();
    initChart();
    /* restore user drawings + settings after the chart is ready */
    vc?.chart?.ready ? vc.chart.ready().then(() => {
      velaRestoreDrawings();
      /* save on any drawing change */
      try { vc.chart.on('drawing:created', velaScheduleSave) } catch(e){}
      try { vc.chart.on('drawing:edited', velaScheduleSave) } catch(e){}
      try { vc.chart.on('drawing:removed', velaScheduleSave) } catch(e){}
      /* SL/TP drag-edit on position overlays */
      try { vc.chart.on('drawing:edited', (ev) => { if (ev && ev.id) onPositionDrawingEdited(ev.id) }) } catch(e){}
      /* the forming candle's high/low anchors a marker placed on it */
      try { vc.chart.on('bar', b => { if (b && Number.isFinite(Number(b.time))) liveBar = b; }) } catch(e){}
      velaPositionsSync();
    }) : setTimeout(() => { velaRestoreDrawings(); velaPositionsSync(); }, 1000);
    $('market-select-btn').disabled = false;
    $('submit-order').disabled = false;
    const restoredSymbol = vc?.chart?.market?.symbol?.replace(/^gains:/, '');
    const initialSymbol = requestedSymbol || restoredSymbol || S.marketId;
    selectMarket(board.meta.has(initialSymbol) ? initialSymbol : [...board.meta.keys()][0]);
    renderCats();
    syncLeverageUI();
    renderLevPresets();
    computeForm();
    renderAccount();
    renderBottom();
    renderStatus();
    /* refresh 24h stats periodically */
    setInterval(() => { if (S.marketId) loadStats24(); }, 60000);
  }).catch(err => {
    chartOverlay(`<b>${t('boot.failed')}</b><br>${String(err && err.message || err)}<br><button class="ghost-btn" onclick="location.reload()">${t('boot.retry')}</button>`);
    $('sb-tick').innerHTML = `<i class="dot dot-info"></i> ${t('sb.reconnecting')}`;
    setTimeout(() => boot(), 8000);
  });
}

/* The React shell stamps the current theme on srcdoc. Do not replace it with
   an older stored value while a newly mounted workspace is booting. */
let __initTheme = document.documentElement.dataset.theme;
if(__initTheme !== 'light' && __initTheme !== 'dark'){
  try{ __initTheme = localStorage.getItem('of-theme') || 'dark' }catch(e){ __initTheme = 'dark' }
}
document.documentElement.setAttribute('data-theme', __initTheme);
curTheme = __initTheme;
$('theme-toggle').textContent = __initTheme === 'dark' ? '◐' : '◑';

applyStaticI18n();
boot();
})();
