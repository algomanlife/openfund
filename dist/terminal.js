/* ============================================================
   OPENFUND TERMINAL — UI layer
   Wires providers to components: market selector, chart,
   order book, order entry, positions workspace, account,
   status bar. All interactions are simulated.
   ============================================================ */
(function(){
'use strict';
const { MARKETS, TIMEFRAMES, fmt, MarketDataProvider, TradingProvider, WalletProvider, FEE_RATE } = window.OpenfundTerminal;

/* ---------- app state ---------- */
const mp = new MarketDataProvider();
const tp = new TradingProvider(mp);
const wp = new WalletProvider();

const S = {
  marketId: 'BTC-USD',
  tf: '1m',
  chartType: 'candles',
  indMA: false,
  indVol: true,
  side: 'long',
  otype: 'market',
  leverage: 5,
  grouping: 1,
  dense: false,
  favorites: new Set(),
  btTab: 'positions',
  tickOn: true,
  flashOn: true,
  tick: 0
};
const $ = id => document.getElementById(id);
const market = () => mp.getMarket(S.marketId);

/* ============================================================
   THEME — dark (default) / light
   ============================================================ */
const THEME = {
  dark: {
    bg:'#060808', text:'#A9B3A9', gridV:'#FFFFFF07', gridH:'#FFFFFF09', scale:'#FFFFFF18',
    up:'#82E7BD', down:'#E89483', wickUp:'#82E7BD88', wickDown:'#E8948388',
    line:'#82E7BD', ma:'#86A8FF', cross:'#82E7BD55', volUp:'#82E7BD44', volDown:'#E8948344'
  },
  light: {
    bg:'#F2F5F0', text:'#3F4C44', gridV:'#0A120D0F', gridH:'#0A120D14', scale:'#0A120D22',
    up:'#12965D', down:'#C0453E', wickUp:'#12965D88', wickDown:'#C0453E88',
    line:'#12965D', ma:'#3D6BE8', cross:'#12965D55', volUp:'#12965D44', volDown:'#C0453E44'
  }
};
let curTheme = 'dark';
function applyChartTheme(){
  if (!chartReady) return;
  const c = THEME[curTheme];
  chart.applyOptions({
    layout: { background: { type: 'solid', color: c.bg }, textColor: c.text,
      fontFamily: (window.ofLang === 'fa' ? 'Irancell' : 'Ubuntu') + ', system-ui, sans-serif', fontSize: 11.5 },
    grid: { vertLines: { color: c.gridV }, horzLines: { color: c.gridH } },
    rightPriceScale: { borderColor: c.scale },
    timeScale: { borderColor: c.scale },
    crosshair: {
      mode: 0,
      vertLine: { color: c.cross, width: 1, style: 3, labelBackgroundColor: c.scale },
      horzLine: { color: c.cross, width: 1, style: 3, labelBackgroundColor: c.scale }
    }
  });
  candleSeries.applyOptions({ upColor: c.up, downColor: c.down, wickUpColor: c.wickUp, wickDownColor: c.wickDown });
  lineSeries.applyOptions({ color: c.line });
  maSeries.applyOptions({ color: c.ma });
  const data = mp.getCandles(S.marketId, S.tf).slice(-600);
  volSeries.setData(data.map(cd => ({ time: cd.time, value: cd.volume,
    color: cd.close >= cd.open ? c.volUp : c.volDown })));
  if (priceLine){
    try { (priceLine._owner || candleSeries).removePriceLine(priceLine); } catch(e){}
    const target = S.chartType === 'candles' ? candleSeries : lineSeries;
    priceLine = target.createPriceLine({ price: mp.getMarkPrice(S.marketId), color: c.line, lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'mark' });
    priceLine._owner = target;
  }
}
function setTheme(theme){
  curTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  $('theme-toggle').textContent = theme === 'dark' ? '◐' : '◑';
  try{ localStorage.setItem('of-theme', theme) }catch(e){}
  applyChartTheme();
}
$('theme-toggle').addEventListener('click', () => setTheme(curTheme === 'dark' ? 'light' : 'dark'));


/* ============================================================
   I18N — FA (default, RTL) / EN. Trading terms stay English
   in FA; financial numbers stay Latin LTR.
   ============================================================ */
const I18N = {
  en: {},
  fa: {
    'nav.trade': 'معامله', 'nav.markets': 'بازارها', 'nav.portfolio': 'پرتفوی', 'nav.more': 'بیشتر',
    'nav.notifications': 'اطلاع‌رسانی‌ها',
    'st.last': 'آخرین', 'st.oracle': 'اوراکل', 'st.change': 'تغییر ۲۴ساعته',
    'st.high': 'سقف ۲۴ساعته', 'st.low': 'کف ۲۴ساعته', 'st.vol': 'حجم ۲۴ساعته',
    'st.oi': 'موقعیت‌های باز', 'st.funding': 'نرخ فاندینگ ۱ساعته', 'st.lev': 'حداکثر اهرم',
    'dd.searchPh': 'جست‌وجوی بازار…', 'dd.market': 'بازار', 'dd.price': 'قیمت', 'dd.24h': '۲۴ساعته',
    'dd.foot': 'بازارهای شبیه‌سازی‌شده · ۵ نماد', 'dd.noMatch': 'بازاری با این عبارت پیدا نشد.',
    'cat.crypto': 'رمزارز', 'cat.forex': 'فارکس', 'cat.commodity': 'کالا',
    'book.tab': 'Order Book', 'book.tradesTab': 'Trades',
    'book.grouping': 'گروینگ', 'book.compact': 'فشرده', 'book.simulated': 'شبیه‌سازی‌شده',
    'book.price': 'قیمت', 'book.size': 'اندازه', 'book.total': 'جمع', 'book.time': 'زمان',
    'book.note': 'دفتر مجازی مشتق از شبیه‌سازی است — عمق واقعی بازار نیست.',
    'book.spread': 'اسپرد',
    'ac.equity': 'ارزش حساب', 'ac.available': 'قابل استفاده', 'ac.margin': 'مارژین در استفاده',
    'ac.unrealized': 'سود/زیان شناور', 'ac.positions': 'موقعیت‌ها', 'ac.orders': 'سفارش‌ها',
    'ac.mode': 'حالت', 'ac.modeVal': 'Cross · شبیه‌سازی‌شده',
    'lev': 'اهرم',
    'of.price': 'قیمت Trigger / Limit <em>USD</em>', 'of.collateral': 'Collateral <em>USD</em>',
    'of.size': 'اندازه', 'of.notional': 'Notional',
    'of.sl': 'Stop Loss <em>USD · optional</em>', 'of.tp': 'Take Profit <em>USD · optional</em>',
    'rk.entry': 'Entry تخمینی', 'rk.oracle': 'قیمت اوراکل', 'rk.liq': 'Liquidation تخمینی',
    'rk.margin': 'Margin تخمینی', 'rk.fee': 'کارمزد تخمینی (open)', 'rk.impact': 'اثر قیمت',
    'rk.impactVal': '—', 'rk.maxloss': 'حداکثر ضرر با SL',
    'submit.long': 'بررسی سفارش — Long', 'submit.short': 'بررسی سفارش — Short',
    'demoBanner': 'حالت دمو — هیچ سفارش واقعی ثبت نمی‌شود',
    'bt.positions': 'موقعیت‌ها', 'bt.orders': 'سفارش‌های باز', 'bt.history': 'تاریخچهٔ سفارش‌ها',
    'bt.fills': 'Fills', 'bt.funding': 'فاندینگ',
    'bt.empty': 'فعالیتی در این حساب شبیه‌سازی‌شده ثبت نشده است.',
    'bt.loadDemo': 'بارگذاری سناریوی دمو', 
    'bt.hint': 'دو موقعیت، یک سفارش Limit در انتظار و تاریخچه می‌سازد تا ترمینال را کاوش کنی.',
    'th.market': 'بازار', 'th.side': 'سمت', 'th.size': 'اندازه', 'th.lev': 'اهرم',
    'th.actions': 'عملیات', 'th.type': 'نوع', 'th.status': 'وضعیت', 'th.created': 'زمان ایجاد',
    'th.price': 'قیمت', 'th.result': 'نتیجه', 'th.time': 'زمان', 'th.payment': 'پرداخت',
    'th.entry': 'Entry',
    'dlg.review': 'بررسی سفارش', 'dlg.cancel': 'لغو', 'dlg.confirm': 'تأیید',
    'dlg.confirmOrder': 'تأیید سفارش شبیه‌سازی‌شده', 'dlg.save': 'ذخیره',
    'dlg.close': 'بستن',
    'rv.market': 'بازار', 'rv.dir': 'جهت', 'rv.otype': 'نوع سفارش', 'rv.lev': 'اهرم',
    'rv.size': 'اندازه', 'rv.notional': 'Notional', 'rv.collateral': 'Collateral',
    'rv.entry': 'Entry تخمینی', 'rv.oracle': 'اوراکل', 'rv.liq': 'Liquidation تخمینی',
    'rv.fee': 'کارمزد تخمینی (open)', 'rv.sl': 'Stop Loss', 'rv.tp': 'Take Profit',
    'rv.equityAfter': 'ارزش حساب پس از سفارش', 'rv.exec': 'شبیه‌سازی‌شده — موتور محلی',
    'rv.side.long': 'Long', 'rv.side.short': 'Short',
    'cf.close': 'بستن موقعیت', 'cf.closeTxt': 'این موقعیت شبیه‌سازی‌شده در قیمت Mark فعلی بسته شود؟ سود/زیان شناور و کارمزد بستن اعمال می‌شود.',
    'cf.cancel': 'لغو سفارش', 'cf.cancelTxt': 'این سفارش شبیه‌سازی‌شدهٔ در انتظار حذف شود؟',
    'cf.detail': 'جزئیات موقعیت',
    'sltp.title': 'ویرایش ریسک',
    'pos.opened': 'موقعیت Long', 'pos.details': ['موقعیت', 'بازار', 'جهت', 'اندازه', 'Entry', 'Mark', 'اهرم', 'Collateral', 'Liquidation تخمینی', 'PnL شناور', 'SL / TP', 'زمان باز شدن', 'کارمزد باز شدن'],
    'act.close': 'بستن', 'act.sltp': 'SL/TP', 'act.details': 'جزئیات', 'act.cancel': 'لغو',
    'tag.pending': 'در انتظار',
    'res.filled': 'انجام‌شده', 'res.cancelled': 'لغو‌شده', 'res.closed-profit': 'بسته با سود', 'res.closed-loss': 'بسته با زیان',
    'res.stop-loss': 'Stop Loss', 'res.take-profit': 'Take Profit', 'res.market-close': 'بستن بازار',
    'empty.positions': 'موقعیت بازی وجود ندارد. از پنل سفارش یکی باز کن یا سناریوی دمو را بارگذاری کن.',
    'empty.orders': 'سفارش بازی وجود ندارد.',
    'empty.history': 'هنوز تاریخچهٔ سفارشی وجود ندارد.',
    'empty.fills': 'هنوز معامله‌ای انجام نشده است.',
    'empty.funding': 'هنوز پرداخت فاندینگی وجود ندارد — فاندینگ شبیه‌سازی‌شده به موقعیت‌های دمو اعمال می‌شود.',
    'sb.demo': 'حالت دمو', 'sb.source': 'داده: شبیه‌سازی‌شده · seed openfund-demo-1',
    'sb.tick': 'تیک', 'sb.assumptions': 'مفروضات دمو',
    'asm.title': 'مفروضات دمو',
    'asm.fees': '<b>کارمزد:</b> کارمزد taker ثابت ۰٫۰۵٪ از Notional در باز و بستن. کارمزد maker صفر.',
    'asm.margin': '<b>Margin:</b> مارجین اولیه = Notional ÷ اهرم. حالت Cross، بدون مارجین جزئی.',
    'asm.liq': '<b>Liquidation:</b> ساده‌شده — Entry × (۱ ∓ (۱/اهرم − ۰٫۵٪ نگهداشت)). صرافی‌های واقعی از نگهداشت پلکانی استفاده می‌کنند.',
    'asm.exec': '<b>اجرا:</b> سفارش Market در قیمت Mark شبیه‌سازی‌شدهٔ فعلی و بدون Slippage انجام می‌شود. سفارش‌های Limit و Stop با عبور Mark از قیمت تریگر فعال می‌شوند.',
    'asm.prices': '<b>قیمت‌ها:</b> گام تصادفی deterministic با seed ثابت، هر ۱٫۵ ثانیه. ارتباطی با بازارهای واقعی ندارد.',
    'asm.book': '<b>Order Book:</b> دفتر مجازی مشتق از همین شبیه‌سازی. نمایندهٔ نقدینگی یا عمق واقعی نیست.',
    'asm.funding': '<b>فاندینگ:</b> نرخ ساعتی مصنوعی که در سناریوی دمو هر ساعت شبیه‌سازی‌شده به موقعیت‌های باز اعمال می‌شود.',
    'asm.note': 'این قواعد مدل اجرای dYdX، Gains Network یا هیچ سیستم عملیاتی را بازتولید نمی‌کنند.',
    'set.title': 'تنظیمات',
    'set.note': 'ذخیره‌سازی تنظیمات برای فاز بعدی برنامه‌ریزی شده است. تنظیمات نمایش با بارگذاری مجدد ریست می‌شوند.',
    'set.tick': 'شبیه‌سازی زندهٔ قیمت', 'set.flash': 'فلاش قیمت ردیف‌ها', 'set.sound': 'صدای اجرا (غیرفعال)',
    'notif.title': 'اطلاع‌رسانی‌ها',
    'notif.empty': 'هنوز اطلاع‌رسانی‌ای نیست. اجراهای شبیه‌سازی‌شده اینجا نمایش داده می‌شوند.',
    'toast.position': 'موقعیت شبیه‌سازی‌شده باز شد.',
    'toast.order': 'سفارش در انتظارِ شبیه‌سازی‌شده ایجاد شد.',
    'toast.wallet': 'اتصال کیف پول شبیه‌سازی‌شده — فقط دمو.',
    'chart.msg': 'کتابخانهٔ چارت از CDN بارگذاری نشد.<br>اتصال اینترنت را بررسی کن و صفحه را تازه‌سازی کن.',
    'chart.unavailable': 'چارت در دسترس نیست',
    'ph.price': '—', 'ph.collateral': '۰٫۰۰', 'ph.optional': '—'
  }
};
const EN = {
  'nav.trade': 'Trade', 'nav.markets': 'Markets', 'nav.portfolio': 'Portfolio', 'nav.more': 'More',
  'nav.notifications': 'Notifications',
  'st.last': 'Last', 'st.oracle': 'Oracle', 'st.change': '24h Change', 'st.high': '24h High',
  'st.low': '24h Low', 'st.vol': '24h Volume', 'st.oi': 'Open Interest', 'st.funding': 'Funding 1h',
  'st.lev': 'Max Leverage',
  'dd.searchPh': 'Search market…', 'dd.market': 'Market', 'dd.price': 'Price', 'dd.24h': '24h',
  'dd.foot': 'Simulated markets · 5 instruments', 'dd.noMatch': t('dd.noMatch'),
  'cat.crypto': 'crypto', 'cat.forex': 'forex', 'cat.commodity': 'commodity',
  'book.tab': 'Order Book', 'book.tradesTab': 'Trades',
  'book.grouping': 'Grouping', 'book.compact': 'Compact', 'book.simulated': 'simulated',
  'book.price': 'Price', 'book.size': 'Size', 'book.total': 'Total', 'book.time': 'Time',
  'book.note': 'Virtual book derived from the simulation — does not represent real market depth.',
  'book.spread': 'spread',
  'ac.equity': 'Equity', 'ac.available': 'Available', 'ac.margin': 'Margin used',
  'ac.unrealized': 'Unrealized', 'ac.positions': 'Positions', 'ac.orders': 'Orders',
  'ac.mode': 'Mode', 'ac.modeVal': 'Cross · Simulated',
  'lev': 'Leverage',
  'of.price': 'Trigger / Limit price <em>USD</em>', 'of.collateral': 'Collateral <em>USD</em>',
  'of.size': 'Size', 'of.notional': 'Notional',
  'of.sl': 'Stop Loss <em>USD · اختیاری</em>', 'of.tp': 'Take Profit <em>USD · اختیاری</em>',
  'rk.entry': 'Est. entry', 'rk.oracle': 'Oracle price', 'rk.liq': 'Est. liquidation',
  'rk.margin': 'Est. margin', 'rk.fee': 'Est. fee (open)', 'rk.impact': 'Price impact',
  'rk.impactVal': 'N/A', 'rk.maxloss': 'Max loss at SL',
  'submit.long': 'Review order — Long', 'submit.short': 'Review order — Short',
  'demoBanner': 'Demo Mode — No Real Orders Are Submitted',
  'bt.positions': 'Positions', 'bt.orders': 'Open Orders', 'bt.history': 'Order History',
  'bt.fills': 'Fills', 'bt.funding': 'Funding',
  'bt.empty': 'No activity in this simulated account.',
  'bt.loadDemo': 'Load demo scenario',
  'bt.hint': 'Seeds two positions, one pending limit order and history so you can explore the terminal.',
  'th.market': 'Market', 'th.side': 'Side', 'th.size': 'Size', 'th.lev': 'Lev',
  'th.actions': 'Actions', 'th.type': 'Type', 'th.status': 'Status', 'th.created': 'Created',
  'th.price': 'Price', 'th.result': 'Result', 'th.time': 'Time', 'th.payment': 'Payment',
  'th.entry': 'Entry',
  'dlg.review': 'Order review', 'dlg.cancel': 'Cancel', 'dlg.confirm': 'Confirm',
  'dlg.confirmOrder': 'Confirm simulated order', 'dlg.save': 'Save', 'dlg.close': 'Close',
  'rv.market': 'Market', 'rv.dir': 'Direction', 'rv.otype': 'Order type', 'rv.lev': 'Leverage',
  'rv.size': 'Size', 'rv.notional': 'Notional', 'rv.collateral': 'Collateral',
  'rv.entry': 'Est. entry', 'rv.oracle': 'Oracle', 'rv.liq': 'Est. liquidation',
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
  'res.market-close': 'market-close',
  'empty.positions': 'No open positions. Open one from the order panel or load the demo scenario.',
  'empty.orders': 'No open orders.',
  'empty.history': 'No order history yet.',
  'empty.fills': 'No fills yet.',
  'empty.funding': 'No funding payments yet — simulated funding applies to demo positions.',
  'sb.demo': 'DEMO MODE', 'sb.source': 'Data: simulated · seed openfund-demo-1',
  'sb.tick': 'tick', 'sb.assumptions': 'Demo assumptions',
  'asm.title': 'Demo assumptions',
  'asm.fees': '<b>Fees:</b> flat 0.05% taker fee on notional at open and close. Maker fee 0%.',
  'asm.margin': '<b>Margin:</b> initial margin = notional / leverage. Cross mode, no partial margin.',
  'asm.liq': '<b>Liquidation:</b> simplified — entry × (1 ∓ (1/leverage − 0.5% maintenance)). Real venues use tiered maintenance margins.',
  'asm.exec': '<b>Execution:</b> market orders fill at the current simulated mark price with zero slippage. Limit and stop orders trigger when the mark crosses the trigger price.',
  'asm.prices': '<b>Prices:</b> deterministic seeded random walk, refreshed every 1.5 s. Not related to real markets.',
  'asm.book': '<b>Order book:</b> a virtual book derived from the same simulation. It does not represent real liquidity or depth.',
  'asm.funding': '<b>Funding:</b> synthetic 1h rate applied to open positions every simulated hour in the demo scenario.',
  'asm.note': 'These rules do not reproduce dYdX, Gains Network or any production execution model.',
  'set.title': 'Settings',
  'set.note': 'Settings persistence is planned for a later phase. Display preferences currently reset on reload.',
  'set.tick': 'Live price simulation', 'set.flash': 'Row price flash', 'set.sound': 'Execution sound (unavailable)',
  'notif.title': 'Notifications',
  'notif.empty': 'No notifications yet. Simulated executions will appear here.',
  'toast.position': 'Simulated position opened.', 'toast.order': 'Simulated pending order created.',
  'toast.wallet': 'Simulated wallet connection — demo only.',
  'chart.msg': 'The charting library could not be loaded from the CDN.<br>Check your connection and reload the page.',
  'chart.unavailable': 'Chart unavailable'
};
Object.assign(I18N.en, EN);
window.ofLang = 'fa';
function t(key){
  const v = (I18N[window.ofLang] && I18N[window.ofLang][key]);
  if (v === undefined) return key;
  return v;
}
function applyStaticI18n(){
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = t(el.dataset.i18n);
    el.innerHTML = v;
  });
  document.querySelectorAll('[data-i18n-p]').forEach(el => { el.placeholder = t(el.dataset.i18nP); });
  document.documentElement.setAttribute('lang', window.ofLang);
  document.documentElement.setAttribute('dir', window.ofLang === 'fa' ? 'rtl' : 'ltr');
  document.title = window.ofLang === 'fa' ? 'Openfund Terminal — معامله' : 'Openfund Terminal — Trade';
  $('lang-label').textContent = window.ofLang === 'fa' ? 'EN' : 'FA';
}
function setLang(lang){
  window.ofLang = lang;
  applyChartTheme && chartReady && applyChartTheme();
  applyStaticI18n();
  setSide(S.side);
  renderDropdown(ddOpen ? $('market-search').value : '');
  renderMarketStats(true);
  renderBook(); renderTrades();
  computeForm(); renderAccount(); renderBottom();
  updateOHLC(null);
}
$('language-toggle').addEventListener('click', () => setLang(window.ofLang === 'fa' ? 'en' : 'fa'));


/* ============================================================
   ICONS — simple inline SVG per market (no external assets)
   ============================================================ */
const ICONS = {
  'BTC-USD': '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="11" fill="#F7931A"/><path d="M7.4 6.5h5.1a2.4 2.4 0 0 1 .6 4.7 2.6 2.6 0 0 1-.7 5.2H7.4zM9 11.2h3.3a1.1 1.1 0 1 0 0-2.2H9zm0 4.5h3.5a1.2 1.2 0 1 0 0-2.4H9z" fill="#fff"/><path d="M10.2 5h1.3v1.6h-1.3zM10.2 17.4h1.3V19h-1.3zM12.5 5h1.3v1.6h-1.3zM12.5 17.4h1.3V19h-1.3z" fill="#fff"/></svg>',
  'ETH-USD': '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="11" fill="#627EEA"/><path d="M12 4.5 7.5 12 12 14.6zM12 15.9 7.5 13.2 12 19.5zM12 4.5l4.5 7.5L12 14.6z" fill="#fff" opacity=".95"/><path d="M12 15.9l4.5-2.7L12 19.5z" fill="#fff" opacity=".6"/></svg>',
  'SOL-USD': '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="11" fill="#111827"/><path d="M7 8.2h10l-2.4 2.4H4.6zM7 13.4h10l-2.4 2.4H4.6zM15.4 8.2h2.4L12.4 15.8H10z" fill="#9945FF"/><path d="M9.8 10.6h10L17.4 13H7.4z" fill="#14F195"/></svg>',
  'EUR-USD': '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="11" fill="#2563EB"/><text x="12" y="16.5" text-anchor="middle" font-size="11" font-weight="bold" fill="#fff" font-family="Ubuntu,sans-serif">€</text></svg>',
  'XAU-USD': '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="11" fill="#B08D3E"/><text x="12" y="16.5" text-anchor="middle" font-size="10" font-weight="bold" fill="#fff" font-family="Ubuntu,sans-serif">Au</text></svg>'
};
function iconHTML(id){ return ICONS[id] || '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="#33402f"/></svg>'; }

/* ============================================================
   MARKET SELECTOR + STATS
   ============================================================ */
function renderDropdown(filter){
  const list = $('market-dd-list');
  const f = (filter || '').trim().toLowerCase();
  const items = MARKETS.filter(m => !f || m.symbol.toLowerCase().includes(f) || m.category.includes(f));
  list.innerHTML = items.map(m => {
    const p = mp.getMarkPrice(m.id);
    const st = mp.getStats(m.id);
    return `<li role="option" aria-selected="${m.id===S.marketId}" data-id="${m.id}" class="${m.id===S.marketId?'selected':''}">
      <span class="mk">${iconHTML(m.id)}<b>${m.symbol}</b><small>${t('cat.' + m.category)}</small>
        <span class="st" data-star="${m.id}">${S.favorites.has(m.id)?'★':'☆'}</span></span>
      <span class="num r">${fmt.price(p, m.dp)}</span>
      <span class="num r ${st.change>=0?'up':'down'}">${fmt.pct(st.change)}</span>
    </li>`;
  }).join('') || '<li class="dd-none" style="padding:12px;color:var(--muted)">No market matches this search.</li>';
  [...list.querySelectorAll('[data-star]')].forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const id = el.dataset.star;
      S.favorites.has(id) ? S.favorites.delete(id) : S.favorites.add(id);
      renderDropdown($('market-search').value);
    });
  });
  [...list.querySelectorAll('li[data-id]')].forEach(li => {
    li.addEventListener('click', () => { selectMarket(li.dataset.id); closeDropdown(); });
  });
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
$('market-select-btn').addEventListener('click', () => ddOpen ? closeDropdown() : openDropdown());
$('market-search').addEventListener('input', e => renderDropdown(e.target.value));
document.addEventListener('click', e => {
  if (ddOpen && !e.target.closest('.market-select')) closeDropdown();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ddOpen) closeDropdown(); });

function selectMarket(id){
  S.marketId = id;
  const m = market();
  $('cur-icon').src = ''; $('cur-icon').outerHTML = `<span id="cur-icon" class="cur-ic">${iconHTML(id)}</span>`;
  $('cur-pair').textContent = m.symbol;
  updateStarBtn();
  /* clamp leverage to market max */
  if (S.leverage > m.maxLev){ S.leverage = m.maxLev; syncLeverageUI(); }
  renderLevPresets();
  if (S.otype !== 'market'){ const p = mp.getMarkPrice(id); $('of-price').value = p.toFixed(m.dp); }
  loadChart();
  renderMarketStats(true);
  renderBook();
  renderTrades();
  computeForm();
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

function renderMarketStats(force){
  const m = market(), st = mp.getStats(S.marketId);
  const set = (id, text, cls) => { const el = $(id); el.textContent = text; el.className = cls ? cls : 'num'; };
  const prev = renderMarketStats._last || {};
  const paint = (id, v) => {
    if (!S.flashOn || force) return;
    if (prev[id] != null && v !== prev[id]){
      const el = $(id);
      el.classList.remove('flash-up', 'flash-down');
      void el.offsetWidth;
      el.classList.add(v > prev[id] ? 'flash-up' : 'flash-down');
    }
    prev[id] = v;
  };
  set('st-last', fmt.price(st.last, m.dp)); paint('st-last', st.last);
  set('st-oracle', fmt.price(st.oracle, m.dp));
  set('st-change', fmt.pct(st.change), 'num ' + (st.change >= 0 ? 'up' : 'down'));
  set('st-high', fmt.price(st.high, m.dp));
  set('st-low', fmt.price(st.low, m.dp));
  set('st-vol', fmt.compact(st.volume));
  set('st-oi', fmt.compact(st.oi));
  set('st-funding', m.funding != null ? (m.funding * 100).toFixed(4) + '%' : '—');
  set('st-lev', m.maxLev + '×');
  renderMarketStats._last = prev;
  /* accent last price by direction */
  $('st-last').classList.add(st.change >= 0 ? 'up' : 'down');
}

/* ============================================================
   CHART (lightweight-charts)
   ============================================================ */
let chart = null, candleSeries = null, lineSeries = null, volSeries = null, maSeries = null, priceLine = null;
let chartReady = false;

function chartColors(){
  return {
    layout: { background: { type: 'solid', color: '#080B0A' }, textColor: '#A9B3A9',
      fontFamily: 'Ubuntu, system-ui, sans-serif', fontSize: 10.5 },
    grid: { vertLines: { color: '#FFFFFF07' }, horzLines: { color: '#FFFFFF09' } },
    rightPriceScale: { borderColor: '#FFFFFF18' },
    timeScale: { borderColor: '#FFFFFF18', timeVisible: true, secondsVisible: false },
    crosshair: {
      mode: 0,
      vertLine: { color: '#82E7BD55', width: 1, style: 3, labelBackgroundColor: '#101711' },
      horzLine: { color: '#82E7BD55', width: 1, style: 3, labelBackgroundColor: '#101711' }
    }
  };
}

function initChart(){
  const host = $('chart-host');
  if (!window.LightweightCharts){
    $('chart-msg').hidden = false;
    $('chart-msg').innerHTML = `<span><b>${t('chart.unavailable')}</b><br>${t('chart.msg')}</span>`;
    return;
  }
  chart = LightweightCharts.createChart(host, chartColors());
  candleSeries = chart.addCandlestickSeries({
    upColor: '#82E7BD', downColor: '#E89483', borderVisible: false,
    wickUpColor: '#82E7BD88', wickDownColor: '#E8948388',
    priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
  });
  lineSeries = chart.addLineSeries({ color: '#82E7BD', lineWidth: 1.5, visible: false });
  volSeries = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol', visible: true });
  chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  maSeries = chart.addLineSeries({ color: '#86A8FF', lineWidth: 1, visible: false, priceLineVisible: false, lastValueVisible: false });
  chart.subscribeCrosshairMove(onCrosshair);
  /* resize observer */
  const ro = new ResizeObserver(() => {
    if (chart && !document.fullscreenElement) chart.applyOptions({ width: host.clientWidth, height: host.clientHeight });
  });
  ro.observe(host);
  chartReady = true;
}

function candleToLine(c){ return { time: c.time, value: c.close }; }
function ma20(data){
  const out = [];
  for (let i = 19; i < data.length; i++){
    let s = 0;
    for (let j = i - 19; j <= i; j++) s += data[j].close;
    out.push({ time: data[i].time, value: s / 20 });
  }
  return out;
}

function loadChart(){
  if (!chartReady) return;
  const m = market();
  const data = mp.getCandles(S.marketId, S.tf);
  const visible = data.slice(-Math.min(data.length, 600));
  candleSeries.applyOptions({ priceFormat: { type: 'price', precision: m.dp, minMove: Math.pow(10, -m.dp) } });
  lineSeries.applyOptions({ priceFormat: { type: 'price', precision: m.dp, minMove: Math.pow(10, -m.dp) } });
  if (S.chartType === 'candles'){
    candleSeries.setData(visible);
    lineSeries.setData([]);
  } else {
    lineSeries.setData(visible.map(candleToLine));
    candleSeries.setData([]);
  }
  volSeries.applyOptions({ visible: S.indVol });
  volSeries.setData(visible.map(c => ({ time: c.time, value: c.volume,
    color: c.close >= c.open ? '#82E7BD44' : '#E8948344' })));
  maSeries.applyOptions({ visible: S.indMA });
  if (S.indMA) maSeries.setData(ma20(visible)); else maSeries.setData([]);
  if (priceLine){
    try { (priceLine._owner || candleSeries).removePriceLine(priceLine); }
    catch(e){ try { candleSeries.removePriceLine(priceLine); } catch(e2){} }
    priceLine = null;
  }
  const last = visible[visible.length - 1];
  const target = S.chartType === 'candles' ? candleSeries : lineSeries;
  priceLine = target.createPriceLine({ price: last.close, color: '#82E7BD', lineWidth: 1,
    lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'mark' });
  priceLine._owner = target;
  chart.timeScale().fitContent();
  updateOHLC(null);
}

function updateChartLive(){
  if (!chartReady) return;
  const data = mp.getCandles(S.marketId, S.tf);
  const last = data[data.length - 1];
  if (S.chartType === 'candles') candleSeries.update(last); else lineSeries.update(candleToLine(last));
  if (S.indVol) volSeries.update({ time: last.time, value: last.volume, color: last.close >= last.open ? '#82E7BD44' : '#E8948344' });
  if (S.indMA){
    const arr = data.slice(-20);
    if (arr.length === 20){
      const v = arr.reduce((s, c) => s + c.close, 0) / 20;
      maSeries.update({ time: last.time, value: v });
    }
  }
  if (priceLine){
    try { (priceLine._owner || candleSeries).removePriceLine(priceLine); } catch(e){}
    const target = S.chartType === 'candles' ? candleSeries : lineSeries;
    priceLine = target.createPriceLine({ price: last.close, color: '#82E7BD', lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelVisible: true, title: 'mark' });
    priceLine._owner = target;
  }
}

function onCrosshair(param){
  if (!param || !param.time){
    updateOHLC(null); return;
  }
  const series = S.chartType === 'candles' ? candleSeries : lineSeries;
  const d = param.seriesData.get(series);
  const vol = param.seriesData.get(volSeries);
  updateOHLC(d, vol);
}
function updateOHLC(d, vol){
  const m = market();
  $('chart-ohlc').querySelector('.pair').textContent = m.symbol + ' · ' + S.tf;
  const el = $('chart-ohlc').querySelector('.ohlc');
  if (!d){ el.textContent = 'O — H — L — C —'; return; }
  const p = v => fmt.price(v, m.dp);
  let html;
  if ('open' in d){
    const up = d.close >= d.open;
    html = `O <b class="${up?'up':'down'}">${p(d.open)}</b> H <b class="${up?'up':'down'}">${p(d.high)}</b> L <b class="${up?'up':'down'}">${p(d.low)}</b> C <b class="${up?'up':'down'}">${p(d.close)}</b>`;
  } else {
    html = `C <b class="up">${p(d.value)}</b>`;
  }
  if (vol && S.indVol) html += ` · Vol <b>${fmt.compact(vol.value)}</b>`;
  el.innerHTML = html;
}

/* chart toolbar */
$('tf-group').addEventListener('click', e => {
  const b = e.target.closest('.tf'); if (!b) return;
  S.tf = b.dataset.tf;
  [...$('tf-group').querySelectorAll('.tf')].forEach(x => x.classList.toggle('active', x === b));
  loadChart();
});
$('ctype-candles').addEventListener('click', () => setChartType('candles'));
$('ctype-line').addEventListener('click', () => setChartType('line'));
function setChartType(t){
  S.chartType = t;
  $('ctype-candles').classList.toggle('active', t === 'candles');
  $('ctype-line').classList.toggle('active', t === 'line');
  loadChart();
}
$('ind-ma').addEventListener('click', () => {
  S.indMA = !S.indMA; $('ind-ma').classList.toggle('active', S.indMA); loadChart();
});
$('ind-vol').addEventListener('click', () => {
  S.indVol = !S.indVol; $('ind-vol').classList.toggle('active', S.indVol); loadChart();
});
$('chart-reset').addEventListener('click', () => { if (chart) chart.timeScale().fitContent(); });
$('chart-full').addEventListener('click', () => {
  document.documentElement.classList.toggle('fscreen');
  if (chart){
    const host = $('chart-host');
    setTimeout(() => chart.applyOptions({ width: host.clientWidth, height: host.clientHeight }), 60);
  }
});
document.addEventListener('fullscreenchange', () => {
  document.documentElement.classList.remove('fscreen');
});

/* ============================================================
   ORDER BOOK + TRADES
   ============================================================ */
document.querySelectorAll('[data-book-tab]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-book-tab]').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', String(x === b)); });
  const t = b.dataset.bookTab;
  $('book-view').hidden = t !== 'book';
  $('trades-view').hidden = t !== 'trades';
  if (t === 'book') renderBook(); else renderTrades();
}));
$('book-group').addEventListener('change', e => { S.grouping = +e.target.value; renderBook(); });
$('book-dense').addEventListener('change', e => { S.dense = e.target.checked; $('book-view').classList.toggle('dense', S.dense); });

function renderBook(){
  if ($('book-view').hidden) return;
  const m = market();
  const book = mp.getOrderBook(S.marketId, S.grouping);
  let maxTotal = 0;
  const rows = side => {
    let cum = 0;
    return side.slice(0, 12).map(l => {
      cum += l.size;
      maxTotal = Math.max(maxTotal, cum);
      return { ...l, cum };
    });
  };
  const asks = rows(book.asks), bids = rows(book.bids);
  const maxT = Math.max(asks[asks.length - 1].cum, bids[bids.length - 1].cum);
  const row = (l, cls) => `<div class="bk-row ${cls}" title="Level — simulated">
    <span class="depth" style="width:${Math.min(100, l.cum / maxT * 100).toFixed(1)}%"></span>
    <span class="num">${fmt.price(l.price, m.dp)}</span>
    <span class="num r">${fmt.num(l.size, m.dpSize)}</span>
    <span class="num r">${fmt.compact(l.cum)}</span></div>`;
  $('book-asks').innerHTML = asks.slice().reverse().map(l => row(l, 'a')).join('');
  $('book-bids').innerHTML = bids.map(l => row(l, 'b')).join('');
  const bestBid = bids[0].price, bestAsk = asks[0].price;
  const spread = bestAsk - bestBid;
  $('book-mid-price').textContent = fmt.price(book.mid, m.dp);
  $('book-mid-price').className = 'num ' + (mp.getStats(S.marketId).change >= 0 ? 'up' : 'down');
  $('book-spread').textContent = `${t('book.spread')} ${fmt.price(spread, m.dp)} (${(spread / book.mid * 100).toFixed(3)}%)`;
}

function renderTrades(){
  if ($('trades-view').hidden) return;
  const m = market();
  const trades = mp.getRecentTrades(S.marketId, 42);
  $('trades-list').innerHTML = trades.map(t =>
    `<div class="tr-row ${t.side}">
      <span class="num">${fmt.price(t.price, m.dp)}</span>
      <span class="num r">${fmt.num(t.size, m.dpSize)}</span>
      <span>${fmt.time(t.time)}</span></div>`).join('');
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
    priceInput.value = mp.getMarkPrice(S.marketId).toFixed(market().dp);
  }
  computeForm();
}));

/* leverage */
function syncLeverageUI(){
  $('lev-val').textContent = S.leverage + '×';
  $('lev-range').value = S.leverage;
}
function renderLevPresets(){
  const m = market();
  [...$('lev-presets').querySelectorAll('button')].forEach(b => {
    const v = +b.dataset.lev;
    b.disabled = v > m.maxLev;
    b.classList.toggle('active', v === S.leverage);
  });
}
$('lev-range').addEventListener('input', e => {
  S.leverage = Math.min(market().maxLev, +e.target.value);
  syncLeverageUI(); renderLevPresets(); computeForm();
});
$('lev-presets').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  S.leverage = +b.dataset.lev;
  syncLeverageUI(); renderLevPresets(); computeForm();
});

/* collateral + shortcuts */
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

function computeForm(){
  const m = market();
  const collateral = +$('of-collateral').value || 0;
  const price = S.otype === 'market' ? mp.getMarkPrice(S.marketId) : (+$('of-price').value || 0);
  const size = price > 0 ? collateral * S.leverage / price : 0;
  const notional = collateral * S.leverage;
  $('of-units').textContent = m.unit;
  $('of-size').textContent = size > 0 ? fmt.num(size, m.dpSize) : '0.000000';
  $('of-notional').textContent = fmt.usd(notional);
  /* risk summary */
  const mark = mp.getMarkPrice(S.marketId);
  const liq = price > 0 ? tp.liqPrice(S.side, price, S.leverage) : null;
  $('rk-entry').textContent = price > 0 ? fmt.price(price, m.dp) : '—';
  $('rk-entry').className = price > 0 ? 'num' : '';
  $('rk-oracle').textContent = fmt.price(mp.getOraclePrice(S.marketId), m.dp);
  $('rk-liq').textContent = liq ? fmt.price(liq, m.dp) : '—';
  $('rk-liq').className = liq ? 'num down' : '';
  $('rk-margin').textContent = collateral > 0 ? fmt.usd(collateral) : '—';
  $('rk-fee').textContent = collateral > 0 ? fmt.usd(notional * FEE_RATE) : '—';
  const sl = +$('of-sl').value || null;
  $('rk-maxloss').textContent = (sl && price > 0)
    ? fmt.usdS((price - sl) * size * (S.side === 'long' ? 1 : -1) - notional * FEE_RATE)
    : (collateral > 0 ? fmt.usdS(-collateral) : '—');
  $('rk-maxloss').className = 'num down';
  /* live validation hints */
  const errs = tp.validate(buildRequest());
  const errEl = $('of-err');
  if (errs.length){ errEl.textContent = errs[0]; errEl.hidden = false; }
  else errEl.hidden = true;
}

function buildRequest(){
  return {
    market: S.marketId, side: S.side, type: S.otype, leverage: S.leverage,
    collateral: +$('of-collateral').value || 0,
    price: +$('of-price').value || 0,
    sl: +$('of-sl').value || null, tp: +$('of-tp').value || null
  };
}

/* ---------- order review + submission ---------- */
$('submit-order').addEventListener('click', () => {
  const req = buildRequest();
  const errs = tp.validate(req);
  if (errs.length){ $('of-err').textContent = errs[0]; $('of-err').hidden = false; return; }
  const m = market();
  const mark = mp.getMarkPrice(S.marketId);
  const entry = req.type === 'market' ? mark : req.price;
  const size = req.collateral * req.leverage / entry;
  const notional = req.collateral * req.leverage;
  const liq = tp.liqPrice(req.side, entry, req.leverage);
  const acc = tp.getAccount();
  const rows = [
    [t('rv.market'), m.symbol], [t('rv.dir'), t(req.side === 'long' ? 'rv.side.long' : 'rv.side.short')],
    [t('rv.otype'), req.type], [t('rv.lev'), req.leverage + '×'],
    [t('rv.size'), fmt.num(size, m.dpSize) + ' ' + m.unit], [t('rv.notional'), fmt.usd(notional)],
    [t('rv.collateral'), fmt.usd(req.collateral)], [t('rk.entry'), fmt.price(entry, m.dp)],
    [t('rv.oracle'), fmt.price(mp.getOraclePrice(S.marketId), m.dp)],
    [t('rk.liq'), fmt.price(liq, m.dp)],
    [t('rv.fee'), fmt.usd(notional * FEE_RATE)],
    [t('rv.sl'), req.sl ? fmt.price(req.sl, m.dp) : '—'],
    [t('rv.tp'), req.tp ? fmt.price(req.tp, m.dp) : '—'],
    [t('rv.equityAfter'), fmt.usd(acc.equity - req.collateral - notional * FEE_RATE)],
    [t('rv.exec'), t('rv.execVal') ? t('rv.execVal') : t('rv.exec')]
  ];
  $('review-body').innerHTML = `<div class="review-grid">` +
    rows.map(([k, v]) => `<div><span>${k}</span><b class="num">${v}</b></div>`).join('') + `</div>`;
  $('review-confirm').className = 'submit ' + req.side;
  $('review-dialog').showModal();
  pendingOrder = req;
});
let pendingOrder = null;
$('review-cancel').addEventListener('click', () => { pendingOrder = null; $('review-dialog').close(); });
$('review-confirm').addEventListener('click', () => {
  if (!pendingOrder) return;
  const res = tp.submit(pendingOrder);
  pendingOrder = null;
  $('review-dialog').close();
  if (res.ok){
    toast(t(res.kind === 'position' ? 'toast.position' : 'toast.order'), 'pos');
    renderBottom(); renderAccount();
  } else {
    toast(res.errors[0], 'neg');
  }
});

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
  const st = tp.state;
  const hasActivity = st.positions.length || st.orders.length || st.history.length || st.fills.length || st.funding.length;
  $('bt-empty').hidden = !!hasActivity;
  document.querySelectorAll('.bt-table').forEach(el => el.hidden = el.dataset.t !== S.btTab || !hasActivity);
  $('cnt-positions').textContent = st.positions.length;
  $('cnt-orders').textContent = st.orders.length;
  /* positions */
  $('tb-positions').innerHTML = st.positions.map(p => {
    const m = mp.getMarket(p.market);
    const mark = mp.getMarkPrice(p.market);
    const pnl = (mark - p.entry) * p.size * (p.side === 'long' ? 1 : -1);
    const roe = pnl / p.margin * 100;
    return `<tr>
      <td>${iconHTML(p.market)} <b>${m.symbol}</b></td>
      <td class="side-${p.side === 'long' ? 'l' : 's'}">${p.side === 'long' ? 'Long' : 'Short'}</td>
      <td class="r num">${fmt.num(p.size, m.dpSize)} ${m.unit}</td>
      <td class="r num">${fmt.price(p.entry, m.dp)}</td>
      <td class="r num">${fmt.price(mark, m.dp)}</td>
      <td>${p.leverage}×</td>
      <td class="r num">${fmt.usd(p.margin)}</td>
      <td class="r num ${pnl >= 0 ? 'up' : 'down'}">${fmt.usdS(pnl)}</td>
      <td class="r num ${roe >= 0 ? 'up' : 'down'}">${fmt.pct(roe)}</td>
      <td class="r num down" title="Simplified estimate">${fmt.price(p.liq, m.dp)}</td>
      <td class="r num">${p.sl ? fmt.price(p.sl, m.dp) : '—'} / ${p.tp ? fmt.price(p.tp, m.dp) : '—'}</td>
      <td>
        <button class="act-btn" data-close="${p.id}">${t("act.close")}</button>
        <button class="act-btn" data-sltp="${p.id}">${t("act.sltp")}</button>
        <button class="act-btn" data-detail="${p.id}">${t("act.details")}</button>
      </td></tr>`;
  }).join('') || emptyRow(12, t('empty.positions'));
  /* orders */
  $('tb-orders').innerHTML = st.orders.map(o => {
    const m = mp.getMarket(o.market);
    return `<tr>
      <td>${iconHTML(o.market)} <b>${m.symbol}</b></td>
      <td><span class="tag">${o.type}</span></td>
      <td class="side-${o.side === 'long' ? 'l' : 's'}">${o.side === 'long' ? 'Long' : 'Short'}</td>
      <td class="r num">${fmt.num(o.size, m.dpSize)} ${m.unit}</td>
      <td class="r num">${fmt.price(o.trigger, m.dp)}</td>
      <td><span class="tag lime">${t("tag.pending")}</span></td>
      <td class="num">${fmt.dt(o.createdAt / 1000)}</td>
      <td><button class="act-btn danger" data-cancel="${o.id}">${t("act.cancel")}</button></td>
    </tr>`;
  }).join('') || emptyRow(8, t('empty.orders'));
  /* history */
  $('tb-history').innerHTML = st.history.map(h => {
    const m = mp.getMarket(h.market); if (!m) return '';
    const cls = h.result.includes('profit') ? 'pos' : h.result.includes('loss') ? 'neg' : '';
    return `<tr>
      <td>${iconHTML(h.market)} <b>${m.symbol}</b></td>
      <td><span class="tag">${h.type}</span></td>
      <td class="side-${h.side === 'long' ? 'l' : 's'}">${h.side === 'long' ? 'Long' : 'Short'}</td>
      <td class="r num">${fmt.num(h.size, m.dpSize)}</td>
      <td class="r num">${fmt.price(h.price, m.dp)}</td>
      <td><span class="tag ${cls}">${t('res.' + h.result)}</span></td>
      <td class="num">${fmt.dt(h.time / 1000)}</td>
    </tr>`;
  }).join('') || emptyRow(7, t('empty.history'));
  /* fills */
  $('tb-fills').innerHTML = st.fills.map(f => {
    const m = mp.getMarket(f.market);
    return `<tr>
      <td>${iconHTML(f.market)} <b>${m.symbol}</b></td>
      <td class="side-${f.side === 'long' || f.side === 'buy' ? 'l' : 's'}">${f.side === 'buy' ? 'Buy' : f.side === 'sell' ? 'Sell' : f.side === 'long' ? 'Long' : 'Short'}</td>
      <td class="r num">${fmt.num(f.size, m.dpSize)}</td>
      <td class="r num">${fmt.price(f.price, m.dp)}</td>
      <td class="r num">${fmt.usd(f.fee)}</td>
      <td><span class="tag">${f.role}</span></td>
      <td class="num">${fmt.dt(f.time / 1000)}</td>
    </tr>`;
  }).join('') || emptyRow(7, t('empty.fills'));
  /* funding */
  $('tb-funding').innerHTML = st.funding.map(f => {
    const m = mp.getMarket(f.market);
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
      tp.closePosition(+b.dataset.close); renderBottom(); renderAccount();
    });
  }));
  document.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => {
    confirmDialog(t('cf.cancel'), t('cf.cancelTxt'), () => {
      tp.cancelOrder(+b.dataset.cancel); renderBottom(); renderAccount();
    });
  }));
  document.querySelectorAll('[data-sltp]').forEach(b => b.addEventListener('click', () => {
    const p = tp.getPosition(+b.dataset.sltp);
    if (!p) return;
    const m = mp.getMarket(p.market);
    $('sltp-title').textContent = `${t('sltp.title')} — ${m.symbol} #${p.id}`;
    $('sltp-sl').value = p.sl || '';
    $('sltp-tp').value = p.tp || '';
    $('sltp-err').hidden = true;
    $('sltp-dialog').showModal();
    sltpTarget = p.id;
  }));
  document.querySelectorAll('[data-detail]').forEach(b => b.addEventListener('click', () => {
    const p = tp.getPosition(+b.dataset.detail);
    if (!p) return;
    const m = mp.getMarket(p.market);
    const mark = mp.getMarkPrice(p.market);
    const pnl = (mark - p.entry) * p.size * (p.side === 'long' ? 1 : -1);
    const L = t('pos.details');
    const rows = [
      [L[0], '#' + p.id], [L[1], m.symbol], [L[2], p.side],
      [L[3], fmt.num(p.size, m.dpSize) + ' ' + m.unit], [L[4], fmt.price(p.entry, m.dp)],
      [L[5], fmt.price(mark, m.dp)], [L[6], p.leverage + '×'],
      [L[7], fmt.usd(p.margin)], [L[8], fmt.price(p.liq, m.dp)],
      [L[9], fmt.usdS(pnl)], [L[10], (p.sl ? fmt.price(p.sl, m.dp) : '—') + ' / ' + (p.tp ? fmt.price(p.tp, m.dp) : '—')],
      [L[11], fmt.dt(p.openedAt / 1000)], [L[12], fmt.usd(p.feePaid)]
    ];
    confirmDialog(t('cf.detail'), null, null, () => {},
      `<div class="review-grid">${rows.map(([k, v]) => `<div><span>${k}</span><b class="num">${v}</b></div>`).join('')}</div>`);
  }));
}
let sltpTarget = null;
$('sltp-cancel').addEventListener('click', () => $('sltp-dialog').close());
$('sltp-save').addEventListener('click', () => {
  if (sltpTarget == null) return;
  const res = tp.modifyRisk(sltpTarget, +$('sltp-sl').value || null, +$('sltp-tp').value || null);
  if (!res.ok){ $('sltp-err').textContent = res.errors[0]; $('sltp-err').hidden = false; return; }
  $('sltp-dialog').close(); renderBottom();
});

/* confirm dialog helper */
let confirmCb = null;
function confirmDialog(title, text, cb, extraCb, html){
  $('confirm-title').textContent = title;
  $('confirm-text').innerHTML = html || text || '';
  $('confirm-text').className = html ? 'review-body' : '';
  $('confirm-ok').hidden = !cb;
  $('confirm-cancel').textContent = cb ? 'Cancel' : 'Close';
  confirmCb = cb;
  $('confirm-dialog').showModal();
}
$('confirm-cancel').addEventListener('click', () => $('confirm-dialog').close());
$('confirm-ok').addEventListener('click', () => { $('confirm-dialog').close(); if (confirmCb) confirmCb(); confirmCb = null; });

/* ============================================================
   ACCOUNT + WALLET + DIALOGS
   ============================================================ */
function renderAccount(){
  const a = tp.getAccount();
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
$('set-tick').addEventListener('change', e => S.tickOn = e.target.checked);
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

/* notifications dot */
tp.subscribe(acc => {
  if (document.querySelector('dialog[open]') !== $('notifications-dialog')) $('notif-dot').classList.add('on');
});

/* toast (success/failure feedback) */
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
    if (chart) chart.applyOptions({ width: $('chart-host').clientWidth, height: $('chart-host').clientHeight });
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
    if (chart) chart.applyOptions({ width: $('chart-host').clientWidth, height: $('chart-host').clientHeight });
  });
})();

/* ============================================================
   LIVE LOOP — deterministic simulation clock
   ============================================================ */
const TICK_MS = 1500;
function tick(){
  if (!S.tickOn) return;
  S.tick++;
  mp.tick();
  tp.onTick();
  renderMarketStats();
  if (S.tick % 2 === 0) renderBook();
  renderTrades();
  updateChartLive();
  renderAccount();
  /* refresh positions table values without full rebuild each tick */
  if (S.btTab === 'positions' && tp.state.positions.length && S.tick % 2 === 0) renderBottom();
  $('sb-tick').textContent = t('sb.tick') + ' ' + S.tick;
}
setInterval(tick, TICK_MS);

function clock(){
  $('sb-clock').textContent = new Date().toLocaleTimeString('en-GB', {hour12: false}) + ' UTC' +
    (-(new Date().getTimezoneOffset() / 60) >= 0 ? '+' : '') + (-new Date().getTimezoneOffset() / 60);
}
setInterval(clock, 1000); clock();

/* ============================================================
   BOOT
   ============================================================ */
applyStaticI18n();
let __initTheme = 'dark';
try{ __initTheme = localStorage.getItem('of-theme') || 'dark' }catch(e){}
initChart();
setTheme(__initTheme);
selectMarket('BTC-USD');
syncLeverageUI();
renderLevPresets();
computeForm();
renderAccount();
renderBottom();
})();
