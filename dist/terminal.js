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
    'ac.mode': 'حالت', 'ac.modeVal': 'Cross · شبیه‌سازی‌شده',
    'lev': 'اهرم',
    'of.price': 'قیمت تریگر / لیمیت <em>USD</em>', 'of.collateral': 'کولترال <em>USD</em>', 'of.priceTh': 'تریگر / لیمیت',
    'of.size': 'اندازه', 'of.notional': 'نوشنال',
    'of.sl': 'استاپ‌لاس <em>USD · اختیاری</em>', 'of.tp': 'تیک‌پرافیت <em>USD · اختیاری</em>',
    'rk.entry': 'انتری تخمینی', 'rk.oracle': 'قیمت اندیس', 'rk.liq': 'لیکوییدیشن تخمینی',
    'rk.margin': 'مارجین تخمینی', 'rk.fee': 'کارمزد تخمینی (اوپن)', 'rk.impact': 'اثر قیمت',
    'rk.impactVal': '—', 'rk.maxloss': 'حداکثر ضرر با SL',
    'submit.long': 'بررسی سفارش — لانگ', 'submit.short': 'بررسی سفارش — شورت',
    'side.long': 'لانگ', 'side.short': 'شورت',
    'ot.market': 'مارکت', 'ot.limit': 'لیمیت', 'ot.stop': 'استاپ',
    'demoBanner': 'حالت دمو — هیچ سفارش واقعی ثبت نمی‌شود',
    'bt.positions': 'موقعیت‌ها', 'bt.orders': 'سفارش‌های باز', 'bt.history': 'تاریخچهٔ سفارش‌ها',
    'bt.fills': 'فیلز', 'bt.funding': 'فاندینگ',
    'th.entry': 'انتری', 'th.mark': 'مارک', 'th.liq': 'لیکوییدیشن', 'th.sltp': 'استاپ‌لاس / تیک‌پرافیت', 'th.collateral': 'کولترال', 'th.unrealized': 'سود/زیان شناور',
    'bt.empty': 'فعالیتی در این حساب شبیه‌سازی‌شده ثبت نشده است.',
    'bt.loadDemo': 'بارگذاری سناریوی دمو',
    'bt.hint': 'دو موقعیت، یک سفارش Limit در انتظار و تاریخچه می‌سازد تا ترمینال را کاوش کنی.',
    'th.market': 'بازار', 'th.side': 'سمت', 'th.size': 'اندازه', 'th.lev': 'اهرم',
    'th.actions': 'عملیات', 'th.type': 'نوع', 'th.status': 'وضعیت', 'th.created': 'زمان ایجاد',
    'th.price': 'قیمت', 'th.result': 'نتیجه', 'th.time': 'زمان', 'th.payment': 'پرداخت',
    'dlg.review': 'بررسی سفارش', 'dlg.cancel': 'لغو', 'dlg.confirm': 'تأیید',
    'dlg.confirmOrder': 'تأیید سفارش شبیه‌سازی‌شده', 'dlg.save': 'ذخیره', 'dlg.close': 'بستن',
    'rv.market': 'بازار', 'rv.dir': 'جهت', 'rv.otype': 'نوع سفارش', 'rv.lev': 'اهرم',
    'rv.size': 'اندازه', 'rv.notional': 'Notional', 'rv.collateral': 'Collateral',
    'rv.entry': 'انتری تخمینی', 'rv.oracle': 'اندیس', 'rv.liq': 'لیکوییدیشن تخمینی',
    'rv.fee': 'کارمزد تخمینی (open)', 'rv.sl': 'Stop Loss', 'rv.tp': 'Take Profit',
    'rv.equityAfter': 'ارزش حساب پس از سفارش', 'rv.exec': 'شبیه‌سازی‌شده — موتور محلی',
    'rv.side.long': 'لانگ', 'rv.side.short': 'شورت',
    'cf.close': 'بستن موقعیت', 'cf.closeTxt': 'این موقعیت شبیه‌سازی‌شده در قیمت Mark فعلی بسته شود؟ سود/زیان شناور و کارمزد بستن اعمال می‌شود.',
    'cf.cancel': 'لغو سفارش', 'cf.cancelTxt': 'این سفارش شبیه‌سازی‌شدهٔ در انتظار حذف شود؟',
    'cf.detail': 'جزئیات موقعیت', 'sltp.title': 'ویرایش ریسک',
    'pos.details': ['موقعیت', 'بازار', 'جهت', 'اندازه', 'Entry', 'Mark', 'اهرم', 'Collateral', 'Liquidation تخمینی', 'PnL شناور', 'SL / TP', 'زمان باز شدن', 'کارمزد باز شدن'],
    'act.close': 'بستن', 'act.sltp': 'SL/TP', 'act.details': 'جزئیات', 'act.cancel': 'لغو',
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
  'ac.mode': 'Mode', 'ac.modeVal': 'Cross · Simulated',
  'lev': 'Leverage',
  'of.price': 'Trigger / Limit price <em>USD</em>', 'of.collateral': 'Collateral <em>USD</em>',
  'of.size': 'Size', 'of.notional': 'Notional',
  'of.sl': 'Stop Loss <em>USD · optional</em>', 'of.tp': 'Take Profit <em>USD · optional</em>',
  'rk.entry': 'Est. entry', 'rk.oracle': 'Index price', 'rk.liq': 'Est. liquidation',
  'rk.margin': 'Est. margin', 'rk.fee': 'Est. fee (open)', 'rk.impact': 'Price impact',
  'rk.impactVal': 'N/A', 'rk.maxloss': 'Max loss at SL',
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
  'th.price': 'Price', 'th.result': 'Result', 'th.time': 'Time', 'th.payment': 'Payment',
  'dlg.review': 'Order review', 'dlg.cancel': 'Cancel', 'dlg.confirm': 'Confirm',
  'dlg.confirmOrder': 'Confirm simulated order', 'dlg.save': 'Save', 'dlg.close': 'Close',
  'rv.market': 'Market', 'rv.dir': 'Direction', 'rv.otype': 'Order type', 'rv.lev': 'Leverage',
  'rv.size': 'Size', 'rv.notional': 'Notional', 'rv.collateral': 'Collateral',
  'rv.entry': 'Est. entry', 'rv.oracle': 'Index', 'rv.liq': 'Est. liquidation',
  'rv.fee': 'Est. fee (open)', 'rv.sl': 'Stop Loss', 'rv.tp': 'Take Profit',
  'rv.equityAfter': 'Equity after', 'rv.exec': 'Simulated — local engine',
  'rv.side.long': 'Long', 'rv.side.short': 'Short',
  'cf.close': 'Close position', 'cf.closeTxt': 'Close this simulated position at the current mark price? Unrealized PnL and a closing fee will be applied.',
  'cf.cancel': 'Cancel order', 'cf.cancelTxt': 'Remove this pending simulated order?',
  'cf.detail': 'Position details', 'sltp.title': 'Modify risk',
  'act.close': 'Close', 'act.sltp': 'SL/TP', 'act.details': 'Details', 'act.cancel': 'Cancel',
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
Object.assign(I18N.en, EN);if(window.ofCmsTerminal){for(var __k in window.ofCmsTerminal){var __v=window.ofCmsTerminal[__k];if(__v&&typeof __v==='object'){if(I18N.fa[__k]!==undefined&&__v.fa)I18N.fa[__k]=__v.fa;if(I18N.en[__k]!==undefined&&__v.en)I18N.en[__k]=__v.en;}}}
window.ofLang = window.ofLang || 'fa';
function t(key){
  const v = (I18N[window.ofLang] && I18N[window.ofLang][key]);
  return v === undefined ? key : v;
}
function applyStaticI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el => { el.innerHTML = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-p]').forEach(el => { el.placeholder = t(el.dataset.i18nP); });
  /* The HEADER follows the language direction (rtl/fa, ltr/en); the main
     workspace is pinned LTR in CSS (.workspace{direction:ltr}) so the trade
     panel is always on the right and the chart stays in its default state. */
  document.documentElement.setAttribute('lang', window.ofLang);
  document.documentElement.setAttribute('dir', window.ofLang === 'fa' ? 'rtl' : 'ltr');
  document.title = window.ofLang === 'fa' ? 'Openfund Terminal — معامله' : 'Openfund Terminal — Trade';
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

/* ============================================================
   THEME — dark (default) / light, synced with Vela
   ============================================================ */
let curTheme = 'dark';
function setTheme(theme){
  curTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  $('theme-toggle').textContent = theme === 'dark' ? '◐' : '◑';
  try{ localStorage.setItem('of-theme', theme) }catch(e){}
  /* light mode = host-level invert (exactly like the landing); the Vela chart
     always renders dark and is inverted along with everything else */
}
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
      symbol: S.marketId, timeframe: S.tf, theme: curTheme
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
  try{ vc.setSymbol(S.marketId); }catch(e){ chartOverlay(`<b>${t('chart.error')}</b>`); }
}

$('chart-full').addEventListener('click', () => {
  document.documentElement.classList.toggle('fscreen');
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
document.addEventListener('click', e => { if (ddOpen && !e.target.closest('.market-select, .market-dropdown')) closeDropdown(); });
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
  S.stats = null;
  $('cur-icon').outerHTML = `<span id="cur-icon" class="cur-ic">${iconHTML(id)}</span>`;
  $('cur-pair').textContent = id;
  updateStarBtn();
  /* leverage clamp to the market's real max */
  const m = meta();
  if (m){
    const maxLev = Number(m.maxLeverage);
    $('lev-range').max = maxLev;
    if (S.leverage > maxLev){ S.leverage = Math.floor(maxLev); }
    syncLeverageUI();
    renderLevPresets();
  }
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
}
  /* restore user drawings for the NEW symbol after the chart updates */
  setTimeout(() => { velaRestoreDrawings(); velaPositionsSync(); }, 300);


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
  const set = (id, text, cls) => { const el = $(id); if (!el) return; el.textContent = text; el.className = cls || 'num'; };
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
  set('st-last', p ? fmt.price(p.mark, d) : '—');
  paint('st-last', p ? p.mark : 0);
  const stLast = $('st-last'); if (changePct != null && stLast) stLast.classList.add(changePct >= 0 ? 'up' : 'down');
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
  set('st-lev', m ? Number(m.maxLeverage) + '×' : '—');
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
  if (p.market !== S.marketId) return;
  const m = meta(); if (!m) return;
  tradeRows.unshift({ price: p.mark, size: pseudo(tradeRows.length, 'sz' + S.marketId) * (Number(m.minPositionUsd) || 50) / 10,
                      side: p.prev != null ? (p.mark >= p.prev ? 'buy' : 'sell') : (pseudo(Date.now() % 97, S.marketId) > .5 ? 'buy' : 'sell'),
                      time: Date.now() });
  if (tradeRows.length > 42) tradeRows.pop();
}
function renderTrades(){
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
function renderLevPresets(){
  const m = meta();
  const maxLev = m ? Number(m.maxLeverage) : 100;
  [...$('lev-presets').querySelectorAll('button')].forEach(b => {
    const v = +b.dataset.lev;
    b.disabled = v > maxLev;
    b.classList.toggle('active', v === S.leverage);
  });
}
$('lev-range').addEventListener('input', e => {
  S.leverage = Math.max(1, Math.min(Number($('lev-range').max), +e.target.value));
  syncLeverageUI(); renderLevPresets(); computeForm();
});
$('lev-presets').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  S.leverage = +b.dataset.lev;
  syncLeverageUI(); renderLevPresets(); computeForm();
});

$('of-collateral').addEventListener('input', computeForm);
$('of-price').addEventListener('input', computeForm);
$('of-sl').addEventListener('input', computeForm);
$('of-tp').addEventListener('input', computeForm);
document.querySelectorAll('.pct-btns button').forEach(b => b.addEventListener('click', () => {
  const avail = tp.getAccount().available;
  const v = avail * (+b.dataset.pct) / 100;
  $('of-collateral').value = v.toFixed(2);
  computeForm();
}));

function marketClosed(){
  const m = meta();
  return !m || m.isOpen === false;
}
function computeForm(){
  if (!$('submit-order')) return;   /* teardown race guard */
  const m = meta();
  const d = dp();
  const closed = marketClosed();
  $('submit-order').disabled = closed;
  if (closed){
    $('of-err').textContent = t('mkt.closed');
    $('of-err').hidden = false;
  }
  const collateral = +$('of-collateral').value || 0;
  const price = S.otype === 'market' ? (mark() || 0) : (+$('of-price').value || 0);
  const size = price > 0 ? collateral * S.leverage / price : 0;
  const notional = collateral * S.leverage;
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
  $('rk-fee').textContent = collateral > 0 ? fmt.usd(notional * FEE_RATE) : '—';
  const sl = +$('of-sl').value || null;
  $('rk-maxloss').textContent = (sl && price > 0)
    ? fmt.usdS((price - sl) * size * (S.side === 'long' ? 1 : -1) - notional * FEE_RATE)
    : (collateral > 0 ? fmt.usdS(-collateral) : '—');
  $('rk-maxloss').className = 'num down';
  if (!closed && tp){
    const errs = tp.validate(buildRequest());
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

function buildRequest(){
  return {
    market: S.marketId, side: S.side, type: S.otype, leverage: S.leverage,
    collateral: normNum($('of-collateral').value) || 0,
    price: normNum($('of-price').value) || 0,
    sl: normNum($('of-sl').value) || null, tp: normNum($('of-tp').value) || null
  };
}

$('submit-order').addEventListener('click', () => {
  if (marketClosed()){ toast(t('mkt.closed'), 'neg'); return; }
  const req = buildRequest();
  const errs = tp.validate(req);
  if (errs.length){ $('of-err').textContent = errs[0]; $('of-err').hidden = false; return; }
  const m = meta();
  const d = dp();
  const mk = mark();
  const entry = req.type === 'market' ? mk : req.price;
  const size = req.collateral * req.leverage / entry;
  const notional = req.collateral * req.leverage;
  const liq = tp.liqPrice(req.side, entry, req.leverage);
  const acc = tp.getAccount();
  const rows = [
    [t('rv.market'), m ? m.symbol : S.marketId], [t('rv.dir'), t(req.side === 'long' ? 'rv.side.long' : 'rv.side.short')],
    [t('rv.otype'), t('ot.' + req.type)], [t('rv.lev'), req.leverage + '×'],
    [t('rv.size'), fmt.num(size, m ? Number(m.sizePrecision) || 2 : 2) + ' ' + (m ? m.base : '')],
    [t('rv.notional'), fmt.usd(notional)],
    [t('rv.collateral'), fmt.usd(req.collateral)], [t('rk.entry'), fmt.price(entry, d)],
    [t('rv.oracle'), board.getIndex(S.marketId) ? fmt.price(board.getIndex(S.marketId), d) : '—'],
    [t('rk.liq'), fmt.price(liq, d)],
    [t('rv.fee'), fmt.usd(notional * FEE_RATE)],
    [t('rv.sl'), req.sl ? fmt.price(req.sl, d) : '—'],
    [t('rv.tp'), req.tp ? fmt.price(req.tp, d) : '—'],
    [t('rv.equityAfter'), fmt.usd(acc.equity - req.collateral - notional * FEE_RATE)],
    [t('rv.exec'), t('rv.exec')]
  ];
  $('review-body').innerHTML = `<div class="review-grid">` +
    rows.map(([k, v]) => `<div><span>${k}</span><b class="num">${v}</b></div>`).join('') + `</div>`;
  $('review-confirm').className = 'submit ' + req.side;
  $('review-dialog').showModal();
  pendingOrder = req;
});
let pendingOrder = null;
$('review-cancel').addEventListener('click', () => { pendingOrder = null; $('review-dialog').close(); });
$('review-confirm').addEventListener('click', async () => {
  if (!pendingOrder) return;
  const req = pendingOrder;
  pendingOrder = null;
  $('review-dialog').close();
  const res = tp.submitAsync ? await tp.submitAsync(req) : tp.submit(req);
  if (res && res.ok){
    toast(res.kind === 'position' ? t('toast.position') : t('toast.order'), 'pos');
    renderBottom(); renderAccount();
  } else {
    toast(res && res.errors ? res.errors[0] : 'error', 'neg');
  }
});

/* ============================================================
   VELA POSITION OVERLAYS — backend-managed 'position' drawings
   (entry/SL/TP box per open position, symbol-isolated, host-owned:
   user drawings are never touched). Mapping: positionId → drawingId.
   ============================================================ */
const posDrawings = new Map();   /* backend position id → vela drawing id */

function velaPositionsSync(){
  if (!vc || !vc.chart || !vc.chart.drawings) return;
  const dr = vc.chart.drawings;
  const srv = window.__ofServerTP;
  if (!srv){ /* logged out → clear managed overlays only */ velaPositionsClear(); return; }
  const st = srv.state;
  /* last bar time for the anchor x-position (managed box starts at "now") */
  const t = Math.floor(Date.now() / 60000) * 60000;
  const want = new Map();  /* positionId → {entry, stop, target, side} */
  for (const p of st.positions){
    if (p.market !== S.marketId) continue;          /* symbol isolation */
    const entry = p.entry;
    const dist = entry * 0.9 / p.leverage;
    const stop = p.sl != null ? p.sl : (p.side === 'long' ? entry - dist : entry + dist);
    const target = p.tp != null ? p.tp : (p.side === 'long' ? entry + dist * 2 : entry - dist * 2);
    want.set(p.id, { entry, stop, target, side: p.side });
  }
  /* remove stale/closed (and all when the symbol switched) */
  for (const [pid, did] of [...posDrawings]){
    if (!want.has(pid)){ try { dr.remove(did) } catch(e){}; posDrawings.delete(pid); }
  }
  /* create or update */
  for (const [pid, lv] of want){
    const anchors = [
      { time: t, price: lv.entry },
      { time: t, price: lv.stop },
      { time: t, price: lv.target }
    ];
    const did = posDrawings.get(pid);
    if (did != null){
      try { dr.update(did, { anchors }) } catch(e){ posDrawings.delete(pid); }
    } else {
      try {
        const d = dr.add('position', { paneId: 'price', anchors });
        if (d && d.id){
          posDrawings.set(pid, d.id);
          /* brand the box: real account balance + our labels */
          try { dr.update(d.id, { accountBalance: 100000, showPrices: true, showText: true }) } catch(e){}
        }
      } catch(e){ /* renderer without drawing support — table still works */ }
    }
  }
}
function velaPositionsClear(){
  if (!vc || !vc.chart || !vc.chart.drawings) return;
  for (const [, did] of [...posDrawings]){ try { vc.chart.drawings.remove(did) } catch(e){} }
  posDrawings.clear();
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

function velaSaveDrawings(){
  if (!vc || !vc.chart || !vc.chart.drawings) return;
  if (!velaRestored) return;   /* don't overwrite saved drawings before restore */
  try {
    const fullDoc = vc.chart.drawings.toJSON();
    const posIds = new Set(posDrawings.values());
    if (fullDoc && Array.isArray(fullDoc.drawings)){
      fullDoc.drawings = fullDoc.drawings.filter(d => !posIds.has(d.id));
    }
    localStorage.setItem(VELA_DRAW_KEY(S.marketId), JSON.stringify(fullDoc));
    /* renderer config + tool defaults (once, not per symbol) */
    const conf = vc.chart.renderer.getConfig ? vc.chart.renderer.getConfig() : null;
    if (conf) localStorage.setItem(VELA_CONF_KEY, JSON.stringify(conf));
    const tools = vc.chart.drawings.toolDefaults ? vc.chart.drawings.toolDefaults() : null;
    if (tools) localStorage.setItem(VELA_TOOLS_KEY, JSON.stringify(tools));
  } catch(e){ /* storage full or private mode — silently skip */ }
}

function velaRestoreDrawings(){
  if (!vc || !vc.chart || !vc.chart.drawings) return;
  try {
    const raw = localStorage.getItem(VELA_DRAW_KEY(S.marketId));
    const doc = JSON.parse(raw || 'null');
    if (doc && doc.drawings) {
      vc.chart.drawings.fromJSON(doc);
      }
    velaRestored = true;   /* allow saves from now on */
    const conf = JSON.parse(localStorage.getItem(VELA_CONF_KEY) || 'null');
    if (conf && vc.chart.renderer.applyConfig) vc.chart.renderer.applyConfig(conf);
    const tools = JSON.parse(localStorage.getItem(VELA_TOOLS_KEY) || 'null');
    if (tools && vc.chart.drawings.setToolDefaults) vc.chart.drawings.setToolDefaults(tools);
  } catch(e){ /* corrupted JSON — start fresh */ }
}

function velaClearDrawings(){
  if (!vc || !vc.chart || !vc.chart.drawings) return;
  try { vc.chart.drawings.fromJSON({ drawings: [] }) } catch(e){}
}

/* ============================================================
   SL/TP DRAG-EDIT on chart — when the user drags the stop or target
   handle of a backend position overlay, update the backend protection.
   Vela events: drawing:edited → check if it's one of our position
   drawings → extract stop/target prices → PUT /trading/positions/:id/protection
   Reverts the chart position if the backend rejects.
   ============================================================ */
let sltpDragTimer = null;
function onPositionDrawingEdited(drawingId){
  clearTimeout(sltpDragTimer);
  sltpDragTimer = setTimeout(async () => {
    if (!vc || !vc.chart || !vc.chart.drawings) return;
    const srv = window.__ofServerTP;
    if (!srv || !srv.state) return;
    /* find which backend position this drawing belongs to */
    let posId = null;
    for (const [pid, did] of posDrawings){
      if (did === drawingId){ posId = pid; break; }
    }
    if (!posId) return;
    /* read the drawing's current anchor prices */
    const dr = vc.chart.drawings;
    const all = dr.all ? dr.all() : [];
    const d = all.find(x => x.id === drawingId);
    if (!d || !d.anchors || d.anchors.length < 3) return;
    const entry = d.anchors[0]?.price;
    const stop = d.anchors[1]?.price;
    const target = d.anchors[2]?.price;
    if (entry == null || stop == null || target == null) return;
    /* find the position to determine side */
    const p = srv.state.positions.find(p => p.id === posId);
    if (!p) return;
    /* determine which is SL and which is TP based on side */
    const isLong = p.side === 'long';
    const sl = isLong ? Math.min(stop, target) : Math.max(stop, target);
    const tp = isLong ? Math.max(stop, target) : Math.min(stop, target);
    /* round to market precision */
    const m = board.getMeta(p.market);
    const dpp = m ? Number(m.pricePrecision) : 2;
    const slR = sl ? sl.toFixed(dpp) : null;
    const tpR = tp ? tp.toFixed(dpp) : null;
    /* update backend */
    try {
      const res = await fetch(window.__ofBackendUrl + '/trading/positions/' + posId + '/protection', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sl: slR, tp: tpR })
      });
      if (res.ok){
        velaPositionsSync();   /* re-sync chart with authoritative state */
        toast('SL/TP updated', 'pos');
      } else {
        velaPositionsSync();   /* revert chart to authoritative state */
        const e = await res.json().catch(() => ({ error: 'unknown' }));
        toast('SL/TP rejected: ' + (e.error || 'invalid'), 'neg');
      }
    } catch(e){
      velaPositionsSync();
      toast('SL/TP update failed', 'neg');
    }
  }, 600);   /* debounce: user may still be dragging */
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

function renderBottom(){
  if (!tp || !$('bt-empty')) return;   /* teardown race guard */
  const st = tp.state;
  const hasActivity = st.positions.length || st.orders.length || st.history.length || st.fills.length || st.funding.length;
  $('bt-empty').hidden = !!hasActivity;
  document.querySelectorAll('.bt-table').forEach(el => el.hidden = el.dataset.t !== S.btTab || !hasActivity);
  $('cnt-positions').textContent = st.positions.length;
  $('cnt-orders').textContent = st.orders.length;
  $('tb-positions').innerHTML = st.positions.map(p => {
    const m = board.getMeta(p.market); if (!m) return '';
    const d = Number(m.pricePrecision), dps = Number(m.sizePrecision) || 2;
    const mk = board.getMark(p.market) || p.entry;
    const pnl = (mk - p.entry) * p.size * (p.side === 'long' ? 1 : -1);
    const roe = pnl / p.margin * 100;
    return `<tr>
      <td>${iconHTML(p.market)} <b>${m.symbol}</b></td>
      <td class="side-${p.side === 'long' ? 'l' : 's'}">${t(p.side === 'long' ? 'rv.side.long' : 'rv.side.short')}</td>
      <td class="r num">${fmt.num(p.size, dps)} ${m.base}</td>
      <td class="r num">${fmt.price(p.entry, d)}</td>
      <td class="r num">${fmt.price(mk, d)}</td>
      <td>${p.leverage}×</td>
      <td class="r num">${fmt.usd(p.margin)}</td>
      <td class="r num ${pnl >= 0 ? 'up' : 'down'}">${fmt.usdS(pnl)}</td>
      <td class="r num ${roe >= 0 ? 'up' : 'down'}">${fmt.pct(roe)}</td>
      <td class="r num down" title="Simplified estimate">${fmt.price(p.liq, d)}</td>
      <td class="r num">${p.sl ? fmt.price(p.sl, d) : '—'} / ${p.tp ? fmt.price(p.tp, d) : '—'}</td>
      <td>
        <button class="act-btn" data-close="${p.id}">${t('act.close')}</button>
        <button class="act-btn" data-sltp="${p.id}">${t('act.sltp')}</button>
        <button class="act-btn" data-detail="${p.id}">${t('act.details')}</button>
      </td></tr>`;
  }).join('') || emptyRow(12, t('empty.positions'));
  $('tb-orders').innerHTML = st.orders.map(o => {
    const m = board.getMeta(o.market); if (!m) return '';
    const d = Number(m.pricePrecision), dps = Number(m.sizePrecision) || 2;
    return `<tr>
      <td>${iconHTML(o.market)} <b>${m.symbol}</b></td>
      <td><span class="tag">${t('ot.' + o.type)}</span></td>
      <td class="side-${o.side === 'long' ? 'l' : 's'}">${t(o.side === 'long' ? 'rv.side.long' : 'rv.side.short')}</td>
      <td class="r num">${fmt.num(o.size, dps)} ${m.base}</td>
      <td class="r num">${fmt.price(o.trigger, d)}</td>
      <td><span class="tag lime">${t('tag.pending')}</span></td>
      <td class="num">${fmt.dt(o.createdAt / 1000)}</td>
      <td><button class="act-btn danger" data-cancel="${o.id}">${t('act.cancel')}</button></td>
    </tr>`;
  }).join('') || emptyRow(8, t('empty.orders'));
  $('tb-history').innerHTML = st.history.map(h => {
    const m = board.getMeta(h.market); if (!m) return '';
    const d = Number(m.pricePrecision);
    const cls = h.result.includes('profit') ? 'pos' : h.result.includes('loss') ? 'neg' : '';
    return `<tr>
      <td>${iconHTML(h.market)} <b>${m.symbol}</b></td>
      <td><span class="tag">${h.type.includes('-') ? t('res.' + h.type) : t('ot.' + h.type)}</span></td>
      <td class="side-${h.side === 'long' ? 'l' : 's'}">${t(h.side === 'long' ? 'rv.side.long' : 'rv.side.short')}</td>
      <td class="r num">${fmt.num(h.size, Number(m.sizePrecision) || 2)}</td>
      <td class="r num">${fmt.price(h.price, d)}</td>
      <td><span class="tag ${cls}">${t('res.' + h.result)}</span></td>
      <td class="num">${fmt.dt(h.time / 1000)}</td>
    </tr>`;
  }).join('') || emptyRow(7, t('empty.history'));
  $('tb-fills').innerHTML = st.fills.map(f => {
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
  }).join('') || emptyRow(7, t('empty.fills'));
  $('tb-funding').innerHTML = st.funding.map(f => {
    const m = board.getMeta(f.market); if (!m) return '';
    return `<tr>
      <td>${iconHTML(f.market)} <b>${m.symbol}</b></td>
      <td class="r num">${(f.rate * 100).toFixed(4)}%</td>
      <td class="r num ${f.pay >= 0 ? 'up' : 'down'}">${fmt.usdS(f.pay)}</td>
      <td class="num">${fmt.dt(f.time / 1000)}</td>
    </tr>`;
  }).join('') || emptyRow(4, t('empty.funding'));
  wireRowActions();
}
function emptyRow(cols, text){
  return `<tr class="empty-tr"><td colspan="${cols}" style="color:var(--muted);padding:22px 18px;white-space:normal">${text}</td></tr>`;
}

function wireRowActions(){
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => {
    confirmDialog(t('cf.close'), t('cf.closeTxt'), () => {
      (async () => { try { await tp.closePosition(b.dataset.close); } catch(e){} renderBottom(); renderAccount(); })();
    });
  }));
  document.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => {
    confirmDialog(t('cf.cancel'), t('cf.cancelTxt'), () => {
      (async () => { try { await tp.cancelOrder(b.dataset.cancel); } catch(e){} renderBottom(); renderAccount(); })();
    });
  }));
  document.querySelectorAll('[data-sltp]').forEach(b => b.addEventListener('click', () => {
    const p = tp.getPosition(b.dataset.sltp);
    if (!p) return;
    const m = board.getMeta(p.market);
    $('sltp-title').textContent = `${t('sltp.title')} — ${m.symbol} #${p.id}`;
    $('sltp-sl').value = p.sl || '';
    $('sltp-tp').value = p.tp || '';
    $('sltp-err').hidden = true;
    $('sltp-dialog').showModal();
    sltpTarget = p.id;
  }));
  document.querySelectorAll('[data-detail]').forEach(b => b.addEventListener('click', () => {
    const p = tp.getPosition(b.dataset.detail);
    if (!p) return;
    const m = board.getMeta(p.market);
    const d = Number(m.pricePrecision);
    const srv = p.mark_price != null ? p.mark_price : (p.srvMark != null ? p.srvMark : null);
    const mk = srv != null ? Number(srv) : (board.getMark(p.market) || p.entry);
    const pnl = p.realized != null ? p.realized : (mk - p.entry) * p.size * (p.side === 'long' ? 1 : -1);
    const D = t('pos.details');
    const rows = [
      [D[0], '#' + p.id], [D[1], m.symbol], [D[2], p.side],
      [D[3], fmt.num(p.size, Number(m.sizePrecision) || 2) + ' ' + m.base], [D[4], fmt.price(p.entry, d)],
      [D[5], fmt.price(mk, d)], [D[6], p.leverage + '×'],
      [D[7], fmt.usd(p.margin)], [D[8], fmt.price(p.liq, d)],
      [D[9], fmt.usdS(pnl)], [D[10], (p.sl ? fmt.price(p.sl, d) : '—') + ' / ' + (p.tp ? fmt.price(p.tp, d) : '—')],
      [D[11], fmt.dt(p.openedAt / 1000)], [D[12], fmt.usd(p.feePaid)]
    ];
    confirmDialog(t('cf.detail'), null, null, () => {},
      `<div class="review-grid">${rows.map(([k, v]) => `<div><span>${k}</span><b class="num">${v}</b></div>`).join('')}</div>`);
  }));
}
let sltpTarget = null;
$('sltp-cancel').addEventListener('click', () => $('sltp-dialog').close());
$('sltp-save').addEventListener('click', async () => {
  if (sltpTarget == null) return;
  const res = tp.modifyRiskAsync || !tp.submitAsync
    ? tp.modifyRisk(sltpTarget, +$('sltp-sl').value || null, +$('sltp-tp').value || null)
    : await tp.modifyRisk(sltpTarget, +$('sltp-sl').value || null, +$('sltp-tp').value || null);
  if (!res.ok){ $('sltp-err').textContent = res.errors[0]; $('sltp-err').hidden = false; return; }
  $('sltp-dialog').close(); renderBottom();
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
  if (!a) return;   /* server account not loaded yet */
  $('ac-equity').textContent = fmt.usd(a.equity);
  $('ac-available').textContent = fmt.usd(a.available);
  $('ac-margin').textContent = fmt.usd(a.marginUsed);
  $('ac-upnl').textContent = fmt.usdS(a.upnl);
  $('ac-upnl').className = 'num ' + (a.upnl > 0 ? 'up' : a.upnl < 0 ? 'down' : '');
  $('ac-pos').textContent = a.positionCount;
  $('ac-ord').textContent = a.orderCount;
}
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
  board.boot().then(() => {
    tp = window.__ofServerTP || new TradingProvider(board);
    /* server trading bridge (authenticated users): swap provider + live updates */
    window.addEventListener('of-trading-ready', () => {
      tp = window.__ofServerTP;
      $('load-demo').style.display = 'none';
      renderAccount(); renderBottom(); computeForm();
    });
    window.addEventListener('of-trading-update', () => {
      renderAccount();
      if (['positions','orders','history'].includes(S.btTab) || S.btTab == null) renderBottom();
    });
    window.addEventListener('of-trading-off', () => {
      tp = new TradingProvider(board);
      renderAccount(); renderBottom(); computeForm();
    });
    tp.subscribe(() => {
      if (document.querySelector('dialog[open]') !== $('notifications-dialog')) $('notif-dot').classList.add('on');
    });
    /* live board → UI + demo triggers (throttled) */
    let lastTrig = 0, lastBook = 0, renderQ = false;
    board.on(() => {
      if (renderQ) return;
      renderQ = true;
      requestAnimationFrame(() => {
        renderQ = false;
        const now = Date.now();
        renderMarketStats();
        renderStatus();
        if (ddOpen) renderDropdown($('market-search').value);
        if (now - lastBook > 1500){ lastBook = now; renderBook(); noteTrade(board.marks.get(S.marketId)); renderTrades(); }
        if (now - lastTrig > 1500){ lastTrig = now; tp.checkTriggers(); renderAccount(); velaPositionsSync(); if (S.btTab === 'positions' && tp.state.positions.length) renderBottom(); }
        computeForm();
      });
    });
    board.on(p => { if (p && p.market === S.marketId) { /* nothing extra */ } });
    applyStaticI18n();
    initChart();
    /* restore user drawings + settings after the chart is ready */
    vc.chart.ready ? vc.chart.ready().then(() => {
      velaRestoreDrawings();
      /* save on any drawing change */
      try { vc.chart.on('drawing:created', velaScheduleSave) } catch(e){}
      try { vc.chart.on('drawing:edited', velaScheduleSave) } catch(e){}
      try { vc.chart.on('drawing:removed', velaScheduleSave) } catch(e){}
      /* SL/TP drag-edit on position overlays */
      try { vc.chart.on('drawing:edited', (ev) => { if (ev && ev.id) onPositionDrawingEdited(ev.id) }) } catch(e){}
      velaPositionsSync();
    }) : setTimeout(() => { velaRestoreDrawings(); velaPositionsSync(); }, 1000);
    $('market-select-btn').disabled = false;
    $('submit-order').disabled = false;
    selectMarket(board.meta.has('BTC/USD') ? 'BTC/USD' : [...board.meta.keys()][0]);
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

/* restore theme before first paint */
let __initTheme = 'dark';
try{ __initTheme = localStorage.getItem('of-theme') || 'dark' }catch(e){}
document.documentElement.setAttribute('data-theme', __initTheme);
curTheme = __initTheme;
$('theme-toggle').textContent = __initTheme === 'dark' ? '◐' : '◑';

applyStaticI18n();
boot();
})();
