/* ============================================================
   OPENFUND TERMINAL — data layer
   Provider abstractions (MarketDataProvider / TradingProvider /
   WalletProvider) with deterministic mock implementations.
   All data is simulated. No exchange or chain connection.
   ============================================================ */
(function(global){
'use strict';

/* ---------- utilities ---------- */
function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(str){
  let h = 2166136261;
  for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const L = (fa, en) => (typeof window !== 'undefined' && window.ofLang === 'fa') ? fa : en;
const fmt = {
  num(v, d){ return Number(v).toLocaleString('en-US', {minimumFractionDigits: d, maximumFractionDigits: d}); },
  price(v, d){ return fmt.num(v, d); },
  usd(v){ return '$' + fmt.num(v, 2); },
  usdS(v){ const s = v < 0 ? '−$' : '$'; return s + fmt.num(Math.abs(v), 2); },
  compact(v){
    const a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(2) + 'K';
    return v.toFixed(2);
  },
  pct(v){ return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + '%'; },
  time(ts){
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString('en-GB', {hour12: false});
  },
  dt(ts){
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('en-GB', {day:'2-digit', month:'short'}) + ' ' +
           d.toLocaleTimeString('en-GB', {hour12:false, hour:'2-digit', minute:'2-digit'});
  }
};

/* ---------- market metadata (simulated) ---------- */
const MARKETS = [
  { id:'BTC-USD', symbol:'BTC/USD', base:'BTC', category:'crypto', basePrice:67890, vol:0.011, dp:1, tick:0.5,
    maxLev:100, funding:0.000021, oiBase:8420, vol24Base:21400, unit:'BTC', dpSize:4, icon:'₿' },
  { id:'ETH-USD', symbol:'ETH/USD', base:'ETH', category:'crypto', basePrice:3242.5, vol:0.013, dp:2, tick:0.05,
    maxLev:100, funding:0.000018, oiBase:128400, vol24Base:962000, unit:'ETH', dpSize:3, icon:'Ξ' },
  { id:'SOL-USD', symbol:'SOL/USD', base:'SOL', category:'crypto', basePrice:172.44, vol:0.021, dp:2, tick:0.01,
    maxLev:50, funding:0.000035, oiBase:640000, vol24Base:5300000, unit:'SOL', dpSize:1, icon:'◎' },
  { id:'EUR-USD', symbol:'EUR/USD', base:'EUR', category:'forex', basePrice:1.08432, vol:0.0016, dp:5, tick:0.00001,
    maxLev:50, funding:null, oiBase:1900000, vol24Base:21000000, unit:'EUR', dpSize:0, icon:'€' },
  { id:'XAU-USD', symbol:'XAU/USD', base:'XAU', category:'commodity', basePrice:2384.6, vol:0.0038, dp:2, tick:0.01,
    maxLev:25, funding:null, oiBase:9600, vol24Base:41000, unit:'oz', dpSize:2, icon:'◆' }
];

const TIMEFRAMES = {
  '1m':  60, '5m': 300, '15m': 900, '30m': 1800,
  '1H': 3600, '4H': 14400, '1D': 86400, '1W': 604800
};

const CANDLE_HISTORY = 30 * 24 * 60; /* 30 days of 1m candles */

/* ---------- deterministic 1m series per market ---------- */
function buildSeries(market){
  const rnd = mulberry32(hash('openfund-demo-1|' + market.id));
  const n = CANDLE_HISTORY;
  const endTs = Math.floor(Date.now() / 60000) * 600 - 60; /* last closed 1m candle */
  const candles = new Array(n);
  /* walk backwards from a deterministic "now" price */
  let price = market.basePrice;
  const vol = market.vol / Math.sqrt(1440); /* per-minute vol */
  for (let i = n - 1; i >= 0; i--){
    const ts = endTs - (n - 1 - i) * 60;
    const drift = (rnd() - 0.485) * 2 * vol * price;
    const open = price;
    const close = Math.max(market.tick, open + drift);
    const spread = Math.abs(drift) + price * vol * (0.25 + rnd() * 0.55);
    const high = Math.max(open, close) + spread * rnd();
    const low = Math.max(market.tick, Math.min(open, close) - spread * rnd());
    const volume = market.vol24Base / 1440 * (0.35 + rnd() * 1.5);
    candles[i] = { time: ts, open, high, low, close, volume };
    price = close;
  }
  return candles;
}

function aggregate(candles, tfSec){
  if (tfSec === 60) return candles;
  const out = [];
  let bucket = null, bucketTs = 0;
  for (const c of candles){
    const ts = Math.floor(c.time / tfSec) * tfSec;
    if (!bucket || ts !== bucketTs){
      if (bucket) out.push(bucket);
      bucketTs = ts;
      bucket = { time: ts, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
    } else {
      bucket.high = Math.max(bucket.high, c.high);
      bucket.low = Math.min(bucket.low, c.low);
      bucket.close = c.close;
      bucket.volume += c.volume;
    }
  }
  if (bucket) out.push(bucket);
  return out;
}

/* ---------- MarketDataProvider (mock) ---------- */
class MarketDataProvider{
  constructor(){
    this._series = new Map();      /* id -> 1m candles */
    this._rnd = new Map();         /* id -> rng for live ticks */
    this._livePrice = new Map();
    this._subs = new Set();
    for (const m of MARKETS){
      const s = buildSeries(m);
      this._series.set(m.id, s);
      this._livePrice.set(m.id, s[s.length - 1].close);
      this._rnd.set(m.id, mulberry32(hash('live|' + m.id)));
    }
  }
  getMarkets(){ return MARKETS.slice(); }
  getMarket(id){ return MARKETS.find(m => m.id === id) || null; }
  getMarkPrice(id){ return this._livePrice.get(id); }
  getOraclePrice(id){ /* deterministic small offset from mark */
    const m = this.getMarket(id);
    const p = this._livePrice.get(id);
    const r = mulberry32(hash('oracle|' + m.id));
    return p * (1 + (r() - 0.5) * 0.0004);
  }
  getCandles(id, tf){
    return aggregate(this._series.get(id), TIMEFRAMES[tf] || 60);
  }
  getStats(id){
    const m = this.getMarket(id);
    const s = this._series.get(id);
    const last = s.length - 1;
    let high = -Infinity, low = Infinity, vol = 0;
    for (let i = Math.max(0, last - 1439); i <= last; i++){
      high = Math.max(high, s[i].high); low = Math.min(low, s[i].low); vol += s[i].volume;
    }
    const p24 = s[Math.max(0, last - 1439)].open;
    const mark = this._livePrice.get(id);
    return {
      last: mark, oracle: this.getOraclePrice(id),
      change: (mark - p24) / p24 * 100, high, low, volume: vol,
      oi: m.oiBase * (1 + (mark / m.basePrice - 1) * 0.4),
      funding: m.funding, maxLev: m.maxLev
    };
  }
  /* simulated virtual order book levels around the mark */
  getOrderBook(id, grouping){
    const m = this.getMarket(id);
    const mid = this._livePrice.get(id);
    const rnd = mulberry32(hash('book|' + m.id));
    const step = m.tick * grouping;
    const base = mid / 400 * m.oiBase / 1000; /* scale depth with price */
    const asks = [], bids = [];
    for (let i = 0; i < 14; i++){
      const rp = rnd();
      asks.push({ price: mid + step * (i + 1), size: base * (0.15 + rp * 1.2) });
      bids.push({ price: Math.max(m.tick, mid - step * (i + 1)), size: base * (0.15 + rnd() * 1.2) });
    }
    return { mid, tick: m.tick * grouping, asks, bids };
  }
  getRecentTrades(id, count){
    const m = this.getMarket(id);
    const s = this._series.get(id);
    const rnd = mulberry32(hash('trades|' + m.id));
    const out = [];
    for (let i = 0; i < count; i++){
      const idx = s.length - 1 - Math.floor(i / 1.6);
      const c = s[Math.max(0, idx)];
      const dir = rnd() > 0.5;
      out.push({
        price: c.close, size: (m.vol24Base / 1440 / 8) * (0.2 + rnd() * 2),
        side: dir ? 'buy' : 'sell', time: c.time + Math.floor(rnd() * 55)
      });
    }
    return out;
  }
  subscribe(fn){ this._subs.add(fn); return () => this._subs.delete(fn); }
  /* live tick: mutate last candle; every 20 ticks roll a new 1m candle */
  tick(){
    const events = [];
    for (const m of MARKETS){
      const s = this._series.get(m.id);
      const rnd = this._rnd.get(m.id);
      const last = s[s.length - 1];
      const vol = m.vol / Math.sqrt(1440);
      const move = (rnd() - 0.5) * 2 * vol * last.close * 1.4;
      let price = Math.max(m.tick, last.close + move);
      last.close = price;
      last.high = Math.max(last.high, price);
      last.low = Math.min(last.low, price);
      last.volume += m.vol24Base / 1440 * rnd();
      this._livePrice.set(m.id, price);
      const tradeRnd = rnd();
      if (tradeRnd > 0.45){
        events.push({ type:'trade', market: m.id,
          trade: { price, size: (m.vol24Base / 1440 / 8) * (0.2 + rnd() * 2),
                   side: move >= 0 ? 'buy' : 'sell', time: last.time + 59 } });
      }
      this._tickCount = (this._tickCount || 0) + 1;
      if (this._tickCount % 20 === 0){
        const nextTs = last.time + 60;
        s.push({ time: nextTs, open: price, high: price, low: price, close: price,
                 volume: m.vol24Base / 1440 * 0.1 });
        if (s.length > CANDLE_HISTORY + 600) s.shift();
        events.push({ type:'candle', market: m.id, ts: nextTs });
      }
    }
    for (const fn of this._subs) fn(events);
    return events;
  }
}

/* ---------- TradingProvider (mock demo engine) ---------- */
const FEE_RATE = 0.0005;       /* 0.05% taker */
const MAINTENANCE = 0.005;     /* 0.5% */

class TradingProvider{
  constructor(marketProvider){
    this.mp = marketProvider;
    this._subs = new Set();
    this.reset();
  }
  reset(){
    this.state = {
      balance: 25000, realized: 0,
      positions: [], nextId: 1,
      orders: [], history: [], fills: [], funding: [],
      notifications: []
    };
    this.emit();
  }
  subscribe(fn){ this._subs.add(fn); return () => this._subs.delete(fn); }
  emit(){ for (const fn of this._subs) fn(this.getAccount()); }

  getAccount(){
    const st = this.state;
    let upnl = 0, margin = 0;
    for (const p of st.positions){
      const mark = this.mp.getMarkPrice(p.market);
      const pnl = (mark - p.entry) * p.size * (p.side === 'long' ? 1 : -1);
      upnl += pnl; margin += p.margin;
    }
    return {
      balance: st.balance, equity: st.balance + upnl, available: Math.max(0, st.balance - margin),
      marginUsed: margin, upnl, positionCount: st.positions.length, orderCount: st.orders.length
    };
  }
  getPosition(id){ return this.state.positions.find(p => p.id === id); }
  liqPrice(side, entry, leverage){
    const m = 1 / leverage - MAINTENANCE;
    return side === 'long' ? entry * (1 - m) : entry * (1 + m);
  }

  validate(req){
    const errs = [];
    const m = this.mp.getMarket(req.market);
    if (!m) errs.push('Unknown market.');
    if (req.leverage < 1 || req.leverage > m.maxLev) errs.push(`Leverage must be between 1× and ${m.maxLev}× for ${m.symbol}.`);
    if (!(req.collateral > 0)) errs.push('Collateral must be greater than zero.');
    const price = req.type === 'market' ? this.mp.getMarkPrice(req.market) : req.price;
    if (req.type !== 'market' && !(req.price > 0)) errs.push('A trigger / limit price is required.');
    const notional = req.collateral * req.leverage;
    if (req.collateral > this.getAccount().available + 1e-9) errs.push('Collateral exceeds available balance.');
    if (req.sl != null && req.sl > 0){
      if (req.side === 'long' && req.sl >= price) errs.push('Stop Loss must be below the entry price for a long.');
      if (req.side === 'short' && req.sl <= price) errs.push('Stop Loss must be above the entry price for a short.');
    }
    if (req.tp != null && req.tp > 0){
      if (req.side === 'long' && req.tp <= price) errs.push('Take Profit must be above the entry price for a long.');
      if (req.side === 'short' && req.tp >= price) errs.push('Take Profit must be below the entry price for a short.');
    }
    if (notional > 5000000) errs.push('Notional exceeds the demo limit of $5,000,000.');
    return errs;
  }

  submit(req){
    /* req: {market, side, type, leverage, collateral, price, sl, tp} */
    const errs = this.validate(req);
    if (errs.length) return { ok: false, errors: errs };
    const m = this.mp.getMarket(req.market);
    const mark = this.mp.getMarkPrice(req.market);
    const entry = req.type === 'market' ? mark : req.price;
    const size = (req.collateral * req.leverage) / entry;
    if (req.type === 'market'){
      this._open(m, req.side, size, entry, req.leverage, req.collateral, req.sl, req.tp);
      return { ok: true, kind: 'position', id: this.state.positions[this.state.positions.length - 1].id };
    }
    const order = {
      id: this.state.nextId++, market: req.market, type: req.type, side: req.side,
      size, trigger: req.price, leverage, collateral: req.collateral, sl: req.sl, tp: req.tp,
      status: 'pending', createdAt: Date.now()
    };
    this.state.orders.push(order);
    this._notify(L(`سفارش ${req.type} در انتظار روی ${m.symbol} در قیمت ${fmt.price(req.price, m.dp)} ایجاد شد.`, `Pending ${req.type} order created on ${m.symbol} at ${fmt.price(req.price, m.dp)}.`));
    this.emit();
    return { ok: true, kind: 'order', id: order.id };
  }

  _open(m, side, size, entry, leverage, collateral, sl, tp){
    const fee = collateral * leverage * FEE_RATE;
    const margin = collateral;
    if (margin > this.state.balance){ return null; }
    this.state.balance -= margin + fee;
    const pos = {
      id: this.state.nextId++, market: m.id, side, size, entry, leverage, margin,
      liq: this.liqPrice(side, entry, leverage), sl: sl || null, tp: tp || null,
      openedAt: Date.now(), feePaid: fee
    };
    this.state.positions.push(pos);
    this.state.fills.push({ id: pos.id, market: m.id, side, size, price: entry, fee, role: 'taker', time: Date.now() });
    this.state.history.push({ id: pos.id, market: m.id, type: 'market', side, size, price: entry, result: 'filled', time: Date.now() });
    this._notify(L(`موقعیت ${side === 'long' ? 'Long' : 'Short'} روی ${m.symbol} باز شد — ${fmt.num(size, m.dpSize)} ${m.unit} @ ${fmt.price(entry, m.dp)}.`, `${side === 'long' ? 'Long' : 'Short'} position opened on ${m.symbol} — ${fmt.num(size, m.dpSize)} ${m.unit} @ ${fmt.price(entry, m.dp)}.`));
    this.emit();
    return pos;
  }

  cancelOrder(id){
    const i = this.state.orders.findIndex(o => o.id === id);
    if (i < 0) return false;
    const o = this.state.orders[i];
    o.status = 'cancelled';
    this.state.history.push({ id: o.id, market: o.market, type: o.type, side: o.side, size: o.size, price: o.trigger, result: 'cancelled', time: Date.now() });
    this.state.orders.splice(i, 1);
    this._notify(L(`سفارش #${o.id} لغو شد.`, `Order #${o.id} cancelled.`));
    this.emit();
    return true;
  }

  modifyRisk(id, sl, tp){
    const p = this.getPosition(id);
    if (!p) return { ok: false, errors: ['Position not found.'] };
    const m = this.mp.getMarket(p.market);
    const mark = this.mp.getMarkPrice(p.market);
    const errs = [];
    if (sl != null && sl > 0){
      if (p.side === 'long' && sl >= mark) errs.push('Stop Loss must be below the mark price for a long.');
      if (p.side === 'short' && sl <= mark) errs.push('Stop Loss must be above the mark price for a short.');
    }
    if (tp != null && tp > 0){
      if (p.side === 'long' && tp <= mark) errs.push('Take Profit must be above the mark price for a long.');
      if (p.side === 'short' && tp >= mark) errs.push('Take Profit must be below the mark price for a short.');
    }
    if (errs.length) return { ok: false, errors: errs };
    p.sl = sl > 0 ? sl : null; p.tp = tp > 0 ? tp : null;
    this._notify(L(`پارامترهای ریسک موقعیت #${p.id} روی ${m.symbol} به‌روزرسانی شد.`, `Risk parameters updated on ${m.symbol} position #${p.id}.`));
    this.emit();
    return { ok: true };
  }

  closePosition(id){
    const p = this.getPosition(id);
    if (!p) return false;
    const m = this.mp.getMarket(p.market);
    const mark = this.mp.getMarkPrice(p.market);
    const pnl = (mark - p.entry) * p.size * (p.side === 'long' ? 1 : -1);
    const fee = p.size * mark * FEE_RATE;
    this.state.balance += p.margin + pnl - fee;
    this.state.realized += pnl - fee - p.feePaid;
    this.state.fills.push({ id: p.id * 1000 + 7, market: p.market, side: p.side === 'long' ? 'sell' : 'buy', size: p.size, price: mark, fee, role: 'taker', time: Date.now() });
    this.state.history.push({ id: p.id, market: p.market, type: 'market-close', side: p.side, size: p.size, price: mark, result: pnl >= 0 ? 'closed-profit' : 'closed-loss', time: Date.now() });
    this.state.positions = this.state.positions.filter(x => x.id !== id);
    this._notify(L(`موقعیت #${p.id} روی ${m.symbol} بسته شد — PnL ${fmt.usdS(pnl - fee)}.`, `Position #${p.id} on ${m.symbol} closed — PnL ${fmt.usdS(pnl - fee)}.`));
    this.emit();
    return true;
  }

  /* called on every market tick: fills pending orders, SL/TP, funding */
  onTick(){
    const st = this.state;
    for (const o of st.orders.slice()){
      const mark = this.mp.getMarkPrice(o.market);
      const triggered =
        (o.type === 'limit' && ((o.side === 'long' && mark <= o.trigger) || (o.side === 'short' && mark >= o.trigger))) ||
        (o.type === 'stop'  && ((o.side === 'long' && mark >= o.trigger) || (o.side === 'short' && mark <= o.trigger)));
      if (triggered){
        st.orders = st.orders.filter(x => x.id !== o.id);
        const m = this.mp.getMarket(o.market);
        const entry = o.trigger;
        const size = (o.collateral * o.leverage) / entry;
        this._open(m, o.side, size, entry, o.leverage, o.collateral, o.sl, o.tp);
        o.status = 'filled';
      }
    }
    for (const p of st.positions.slice()){
      const mark = this.mp.getMarkPrice(p.market);
      const hitSL = p.sl != null && ((p.side === 'long' && mark <= p.sl) || (p.side === 'short' && mark >= p.sl));
      const hitTP = p.tp != null && ((p.side === 'long' && mark >= p.tp) || (p.side === 'short' && mark <= p.tp));
      if (hitSL || hitTP){
        /* execute at trigger level, not mark (simplified) */
        const m = this.mp.getMarket(p.market);
        const exit = hitSL ? p.sl : p.tp;
        const pnl = (exit - p.entry) * p.size * (p.side === 'long' ? 1 : -1);
        const fee = p.size * exit * FEE_RATE;
        st.balance += p.margin + pnl - fee;
        st.realized += pnl - fee - p.feePaid;
        st.fills.push({ id: p.id * 1000 + 8, market: p.market, side: p.side === 'long' ? 'sell' : 'buy', size: p.size, price: exit, fee, role: 'taker', time: Date.now() });
        st.history.push({ id: p.id, market: p.market, type: hitSL ? 'stop-loss' : 'take-profit', side: p.side, size: p.size, price: exit, result: hitSL ? 'closed-loss' : 'closed-profit', time: Date.now() });
        st.positions = st.positions.filter(x => x.id !== p.id);
        this._notify(L(`${hitSL ? 'Stop Loss' : 'Take Profit'} روی موقعیت #${p.id} در ${m.symbol} اجرا شد — PnL ${fmt.usdS(pnl - fee)}.`, `${hitSL ? 'Stop Loss' : 'Take Profit'} executed on ${m.symbol} position #${p.id} — PnL ${fmt.usdS(pnl - fee)}.`));
      }
    }
    this.emit();
  }

  loadDemoScenario(){
    this.reset();
    const mp = this.mp;
    /* position 1: BTC long */
    {
      const m = mp.getMarket('BTC-USD'), entry = mp.getMarkPrice('BTC-USD') * 0.987;
      const collateral = 1200, lev = 10, size = collateral * lev / entry, fee = collateral * lev * FEE_RATE;
      this.state.balance -= collateral + fee;
      this.state.positions.push({ id: this.state.nextId++, market: 'BTC-USD', side: 'long', size, entry, leverage: lev, margin: collateral,
        liq: this.liqPrice('long', entry, lev), sl: entry * 0.97, tp: entry * 1.06, openedAt: Date.now() - 3600e3 * 9, feePaid: fee });
      this.state.fills.push({ id: 9001, market: 'BTC-USD', side: 'long', size, price: entry, fee, role: 'taker', time: Date.now() - 3600e3 * 9 });
    }
    /* position 2: ETH short */
    {
      const m = mp.getMarket('ETH-USD'), entry = mp.getMarkPrice('ETH-USD') * 1.013;
      const collateral = 800, lev = 5, size = collateral * lev / entry, fee = collateral * lev * FEE_RATE;
      this.state.balance -= collateral + fee;
      this.state.positions.push({ id: this.state.nextId++, market: 'ETH-USD', side: 'short', size, entry, leverage: lev, margin: collateral,
        liq: this.liqPrice('short', entry, lev), sl: entry * 1.03, tp: entry * 0.95, openedAt: Date.now() - 3600e3 * 26, feePaid: fee });
      this.state.fills.push({ id: 9002, market: 'ETH-USD', side: 'short', size, price: entry, fee, role: 'taker', time: Date.now() - 3600e3 * 26 });
    }
    /* one pending limit order: SOL */
    {
      const entry = mp.getMarkPrice('SOL-USD') * 0.96;
      const collateral = 500, lev = 5, size = collateral * lev / entry;
      this.state.orders.push({ id: this.state.nextId++, market: 'SOL-USD', type: 'limit', side: 'long', size, trigger: entry,
        leverage: lev, collateral, sl: entry * 0.97, tp: entry * 1.08, status: 'pending', createdAt: Date.now() - 1200e3 });
    }
    /* historical flavour */
    this.state.history.push(
      { id: 8101, market: 'BTC-USD', type: 'limit', side: 'short', size: 0.12, price: 69200, result: 'cancelled', time: Date.now() - 86400e3 },
      { id: 8100, market: 'XAU-USD', type: 'market-close', side: 'long', size: 12.5, price: 2361.4, result: 'closed-profit', time: Date.now() - 172800e3 }
    );
    this.state.funding.push(
      { market: 'ETH-USD', rate: 0.000018, pay: -1.42, time: Date.now() - 3600e3 * 5 },
      { market: 'ETH-USD', rate: 0.000018, pay: -1.38, time: Date.now() - 3600e3 * 6 }
    );
    this._notify(L('سناریوی دمو بارگذاری شد: ۲ موقعیت، ۱ سفارش در انتظار.', 'Demo scenario loaded: 2 positions, 1 pending order.'));
    this.emit();
  }

  _notify(text){
    this.state.notifications.unshift({ text, time: Date.now() });
    if (this.state.notifications.length > 40) this.state.notifications.pop();
  }
}

/* ---------- WalletProvider (mock, explicitly labeled) ---------- */
class WalletProvider{
  constructor(){ this.connected = false; this.address = null; }
  /* demo connection only — never represents a real wallet */
  connectDemo(){
    this.connected = true;
    this.address = '0xDEM0…0000';
    return { connected: true, address: this.address, network: 'Arbitrum (demo)', demo: true };
  }
  disconnect(){ this.connected = false; this.address = null; }
  getState(){ return { connected: this.connected, address: this.address, network: 'Arbitrum (demo)', demo: true }; }
}

/* ---------- exports ---------- */
global.OpenfundTerminal = {
  MARKETS, TIMEFRAMES, fmt, hash,
  MarketDataProvider, TradingProvider, WalletProvider,
  FEE_RATE, MAINTENANCE
};
})(window);
