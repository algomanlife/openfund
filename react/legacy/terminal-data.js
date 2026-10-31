/* ============================================================
   OPENFUND TERMINAL — data layer
   PriceBoard: verified live Gains Network market data
              (REST snapshot + WS stream, staleness aware).
   TradingProvider: local demo trading engine — orders are
   SIMULATED against real Gains mark prices. No real funds.
   WalletProvider: demo-labelled wallet state only.
   ============================================================ */
(function(global){
'use strict';

/* ---------- utilities ---------- */
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
  pct(v){ if (!Number.isFinite(v)) return '—'; return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2) + '%'; },
  time(ts){ const d = new Date(ts * 1000); return d.toLocaleTimeString('en-GB', {hour12: false}); },
  dt(ts){ const d = new Date(ts * 1000); return d.toLocaleDateString('en-GB', {day:'2-digit', month:'short'}) + ' ' + d.toLocaleTimeString('en-GB', {hour12:false, hour:'2-digit', minute:'2-digit'}); }
};

/* ============================================================
   PriceBoard — real Gains data for the terminal
   ============================================================ */
const G = global.OpenfundGains;
class PriceBoard{
  constructor(){
    this.marks = new Map();       /* symbol → {mark, index, updatedAt, at} */
    this.meta = new Map();        /* symbol → market metadata */
    this.stats = new Map();       /* symbol → {24h stats, at} */
    this.status = 'connecting';   /* connecting | live | reconnecting */
    this.listeners = new Set();
    this._boot = null;
  }
  on(fn){ this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(){ for (const fn of this.listeners) fn(this); }

  async boot(){
    if (this._boot) return this._boot;
    this._boot = (async () => {
      const [, prices] = await Promise.all([ this.refreshMeta(), this.refreshSnapshot() ]);
      G.subscribePrices(p => {
        this.marks.set(p.market, { ...p, at: Date.now() });
        this._emit();
      });
      G.subscribeStatus(s => { this.status = s; this._emit(); });
      setInterval(() => this._emit(), 20000); /* staleness watchdog */
      return prices;
    })();
    return this._boot;
  }
  async refreshMeta(){
    const list = await G.marketList(true);
    this.meta = list;
    return list;
  }
  async refreshSnapshot(){
    const prices = await G.priceSnapshot();
    for (const p of prices){
      const mark = Number(p.mark);
      if (!Number.isFinite(mark) || mark <= 0) continue;
      this.marks.set(p.market, { market: p.market, mark, index: Number(p.index) || null,
                                 updatedAt: Number(p.updatedAt) || Date.now(), at: Date.now() });
    }
    this._emit();
    return prices;
  }
  getMark(symbol){ const m = this.marks.get(symbol); return m ? m.mark : null; }
  getIndex(symbol){ const m = this.marks.get(symbol); return m ? m.index : null; }
  markAge(symbol){ const m = this.marks.get(symbol); return m ? Date.now() - m.updatedAt : Infinity; }
  stale(symbol){ return this.markAge(symbol) > 90000; }
  getMeta(symbol){ return this.meta.get(symbol) || null; }
  async stats24(symbol, force){
    const c = this.stats.get(symbol);
    if (!force && c && Date.now() - c.at < 60000) return c.data;
    const data = await G.stats24h(symbol);
    if (data) this.stats.set(symbol, { data, at: Date.now() });
    return data;
  }
}

/* ============================================================
   TradingProvider — SIMULATED demo engine on real marks
   (fees / margin / liquidation are simplified demo assumptions)
   ============================================================ */
const FEE_RATE = 0.0005;       /* 0.05% taker — demo assumption */
const MAINTENANCE = 0.005;     /* 0.5% — demo assumption */

class TradingProvider{
  constructor(board){
    this.board = board;
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

  getMarkPrice(symbol){ return this.board.getMark(symbol) || 0; }
  getAccount(){
    const st = this.state;
    let upnl = 0, margin = 0;
    for (const p of st.positions){
      const mark = this.getMarkPrice(p.market) || p.entry;
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
    const meta = this.board.getMeta(req.market);
    const maxLev = meta ? Number(meta.maxLeverage) : 100;
    if (req.leverage < 1 || req.leverage > maxLev)
      errs.push(L(`اهرم باید بین ۱× و ${maxLev}× باشد.`, `Leverage must be between 1× and ${maxLev}×.`));
    if (!(req.collateral > 0)) errs.push(L('واریزه باید بزرگ‌تر از صفر باشد.', 'Collateral must be greater than zero.'));
    const price = req.type === 'market' ? this.getMarkPrice(req.market) : req.price;
    if (req.type !== 'market' && !(req.price > 0)) errs.push(L('قیمت Trigger / Limit لازم است.', 'A trigger / limit price is required.'));
    if (req.collateral > this.getAccount().available + 1e-9) errs.push(L('واریزه از موجودی قابل استفاده بیشتر است.', 'Collateral exceeds available balance.'));
    if (req.sl != null && req.sl > 0){
      if (req.side === 'long' && req.sl >= price) errs.push(L('Stop Loss برای Long باید زیر قیمت ورود باشد.', 'Stop Loss must be below the entry price for a long.'));
      if (req.side === 'short' && req.sl <= price) errs.push(L('Stop Loss برای Short باید بالای قیمت ورود باشد.', 'Stop Loss must be above the entry price for a short.'));
    }
    if (req.tp != null && req.tp > 0){
      if (req.side === 'long' && req.tp <= price) errs.push(L('Take Profit برای Long باید بالای قیمت ورود باشد.', 'Take Profit must be above the entry price for a long.'));
      if (req.side === 'short' && req.tp >= price) errs.push(L('Take Profit برای Short باید زیر قیمت ورود باشد.', 'Take Profit must be below the entry price for a short.'));
    }
    if (req.collateral * req.leverage > 5000000) errs.push(L('اندازهٔ موقعیت از سقف دمو (۵ میلیون دلار) بیشتر است.', 'Notional exceeds the demo limit of $5,000,000.'));
    return errs;
  }

  submit(req){
    const errs = this.validate(req);
    if (errs.length) return { ok: false, errors: errs };
    const mark = this.getMarkPrice(req.market);
    if (!mark) return { ok: false, errors: [L('قیمت زنده در دسترس نیست — اتصال داده را بررسی کن.', 'Live price unavailable — check the data connection.')] };
    const entry = req.type === 'market' ? mark : req.price;
    const size = (req.collateral * req.leverage) / entry;
    if (req.type === 'market'){
      this._open(req.market, req.side, size, entry, req.leverage, req.collateral, req.sl, req.tp);
      return { ok: true, kind: 'position', id: this.state.positions[this.state.positions.length - 1].id };
    }
    const order = {
      id: this.state.nextId++, market: req.market, type: req.type, side: req.side,
      size, trigger: req.price, leverage, collateral: req.collateral, sl: req.sl, tp: req.tp,
      status: 'pending', createdAt: Date.now()
    };
    this.state.orders.push(order);
    this._notify(L(`سفارش ${req.type} در انتظار ایجاد شد.`, `Pending ${req.type} order created.`));
    this.emit();
    return { ok: true, kind: 'order', id: order.id };
  }

  _open(market, side, size, entry, leverage, collateral, sl, tp){
    const fee = collateral * leverage * FEE_RATE;
    const margin = collateral;
    if (margin > this.state.balance) return null;
    this.state.balance -= margin + fee;
    const pos = {
      id: this.state.nextId++, market, side, size, entry, leverage, margin,
      liq: this.liqPrice(side, entry, leverage), sl: sl || null, tp: tp || null,
      openedAt: Date.now(), feePaid: fee
    };
    this.state.positions.push(pos);
    this.state.fills.push({ id: pos.id, market, side, size, price: entry, fee, role: 'taker', time: Date.now() });
    this.state.history.push({ id: pos.id, market, type: 'market', side, size, price: entry, result: 'filled', time: Date.now() });
    this._notify(L(`موقعیت ${side === 'long' ? 'Long' : 'Short'} باز شد — ${market} در ${fmt.price(entry, 2)}.`,
                   `${side === 'long' ? 'Long' : 'Short'} position opened — ${market} @ ${fmt.price(entry, 2)}.`));
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
    if (!p) return { ok: false, errors: [L('موقعیت پیدا نشد.', 'Position not found.')] };
    const mark = this.getMarkPrice(p.market);
    const errs = [];
    if (sl != null && sl > 0){
      if (p.side === 'long' && sl >= mark) errs.push(L('Stop Loss برای Long باید زیر قیمت Mark باشد.', 'Stop Loss must be below the mark price for a long.'));
      if (p.side === 'short' && sl <= mark) errs.push(L('Stop Loss برای Short باید بالای قیمت Mark باشد.', 'Stop Loss must be above the mark price for a short.'));
    }
    if (tp != null && tp > 0){
      if (p.side === 'long' && tp <= mark) errs.push(L('Take Profit برای Long باید بالای قیمت Mark باشد.', 'Take Profit must be above the mark price for a long.'));
      if (p.side === 'short' && tp >= mark) errs.push(L('Take Profit برای Short باید زیر قیمت Mark باشد.', 'Take Profit must be below the mark price for a short.'));
    }
    if (errs.length) return { ok: false, errors: errs };
    p.sl = sl > 0 ? sl : null; p.tp = tp > 0 ? tp : null;
    this._notify(L(`پارامترهای ریسک موقعیت #${p.id} به‌روزرسانی شد.`, `Risk parameters updated on position #${p.id}.`));
    this.emit();
    return { ok: true };
  }

  closePosition(id){
    const p = this.getPosition(id);
    if (!p) return false;
    const mark = this.getMarkPrice(p.market) || p.entry;
    const pnl = (mark - p.entry) * p.size * (p.side === 'long' ? 1 : -1);
    const fee = p.size * mark * FEE_RATE;
    this.state.balance += p.margin + pnl - fee;
    this.state.realized += pnl - fee - p.feePaid;
    this.state.fills.push({ id: p.id * 1000 + 7, market: p.market, side: p.side === 'long' ? 'sell' : 'buy', size: p.size, price: mark, fee, role: 'taker', time: Date.now() });
    this.state.history.push({ id: p.id, market: p.market, type: 'market-close', side: p.side, size: p.size, price: mark, result: pnl >= 0 ? 'closed-profit' : 'closed-loss', time: Date.now() });
    this.state.positions = this.state.positions.filter(x => x.id !== id);
    this._notify(L(`موقعیت #${p.id} بسته شد — PnL ${fmt.usdS(pnl - fee)}.`, `Position #${p.id} closed — PnL ${fmt.usdS(pnl - fee)}.`));
    this.emit();
    return true;
  }

  /* checked against real Gains marks on every board update */
  checkTriggers(){
    const st = this.state;
    for (const o of st.orders.slice()){
      const mark = this.getMarkPrice(o.market);
      if (!mark) continue;
      const triggered =
        (o.type === 'limit' && ((o.side === 'long' && mark <= o.trigger) || (o.side === 'short' && mark >= o.trigger))) ||
        (o.type === 'stop'  && ((o.side === 'long' && mark >= o.trigger) || (o.side === 'short' && mark <= o.trigger)));
      if (triggered){
        st.orders = st.orders.filter(x => x.id !== o.id);
        const entry = o.trigger;
        const size = (o.collateral * o.leverage) / entry;
        this._open(o.market, o.side, size, entry, o.leverage, o.collateral, o.sl, o.tp);
        o.status = 'filled';
      }
    }
    for (const p of st.positions.slice()){
      const mark = this.getMarkPrice(p.market);
      if (!mark) continue;
      const hitSL = p.sl != null && ((p.side === 'long' && mark <= p.sl) || (p.side === 'short' && mark >= p.sl));
      const hitTP = p.tp != null && ((p.side === 'long' && mark >= p.tp) || (p.side === 'short' && mark <= p.tp));
      if (hitSL || hitTP){
        const exit = hitSL ? p.sl : p.tp;
        const pnl = (exit - p.entry) * p.size * (p.side === 'long' ? 1 : -1);
        const fee = p.size * exit * FEE_RATE;
        st.balance += p.margin + pnl - fee;
        st.realized += pnl - fee - p.feePaid;
        st.fills.push({ id: p.id * 1000 + 8, market: p.market, side: p.side === 'long' ? 'sell' : 'buy', size: p.size, price: exit, fee, role: 'taker', time: Date.now() });
        st.history.push({ id: p.id, market: p.market, type: hitSL ? 'stop-loss' : 'take-profit', side: p.side, size: p.size, price: exit, result: hitSL ? 'closed-loss' : 'closed-profit', time: Date.now() });
        st.positions = st.positions.filter(x => x.id !== p.id);
        this._notify(L(`${hitSL ? 'Stop Loss' : 'Take Profit'} روی موقعیت #${p.id} اجرا شد — PnL ${fmt.usdS(pnl - fee)}.`,
                       `${hitSL ? 'Stop Loss' : 'Take Profit'} executed on position #${p.id} — PnL ${fmt.usdS(pnl - fee)}.`));
      }
    }
    this.emit();
  }

  loadDemoScenario(){
    this.reset();
    const mk = s => this.getMarkPrice(s);
    if (mk('BTC/USD')){
      const entry = mk('BTC/USD') * 0.987;
      const collateral = 1200, lev = 10, size = collateral * lev / entry, fee = collateral * lev * FEE_RATE;
      this.state.balance -= collateral + fee;
      this.state.positions.push({ id: this.state.nextId++, market: 'BTC/USD', side: 'long', size, entry, leverage: lev, margin: collateral,
        liq: this.liqPrice('long', entry, lev), sl: entry * 0.97, tp: entry * 1.06, openedAt: Date.now() - 3600e3 * 9, feePaid: fee });
      this.state.fills.push({ id: 9001, market: 'BTC/USD', side: 'long', size, price: entry, fee, role: 'taker', time: Date.now() - 3600e3 * 9 });
    }
    if (mk('ETH/USD')){
      const entry = mk('ETH/USD') * 1.013;
      const collateral = 800, lev = 5, size = collateral * lev / entry, fee = collateral * lev * FEE_RATE;
      this.state.balance -= collateral + fee;
      this.state.positions.push({ id: this.state.nextId++, market: 'ETH/USD', side: 'short', size, entry, leverage: lev, margin: collateral,
        liq: this.liqPrice('short', entry, lev), sl: entry * 1.03, tp: entry * 0.95, openedAt: Date.now() - 3600e3 * 26, feePaid: fee });
      this.state.fills.push({ id: 9002, market: 'ETH/USD', side: 'short', size, price: entry, fee, role: 'taker', time: Date.now() - 3600e3 * 26 });
    }
    if (mk('SOL/USD')){
      const entry = mk('SOL/USD') * 0.96;
      const collateral = 500, lev = 5, size = collateral * lev / entry;
      this.state.orders.push({ id: this.state.nextId++, market: 'SOL/USD', type: 'limit', side: 'long', size, trigger: entry,
        leverage: lev, collateral, sl: entry * 0.97, tp: entry * 1.08, status: 'pending', createdAt: Date.now() - 1200e3 });
    }
    this.state.history.push(
      { id: 8101, market: 'BTC/USD', type: 'limit', side: 'short', size: 0.12, price: 69200, result: 'cancelled', time: Date.now() - 86400e3 },
      { id: 8100, market: 'XAU/USD', type: 'market-close', side: 'long', size: 12.5, price: 2361.4, result: 'closed-profit', time: Date.now() - 172800e3 }
    );
    this.state.funding.push(
      { market: 'ETH/USD', rate: 0.000018, pay: -1.42, time: Date.now() - 3600e3 * 5 },
      { market: 'ETH/USD', rate: 0.000018, pay: -1.38, time: Date.now() - 3600e3 * 6 }
    );
    this._notify(L('سناریوی دمو بارگذاری شد.', 'Demo scenario loaded.'));
    this.emit();
  }

  _notify(text){
    this.state.notifications.unshift({ text, time: Date.now() });
    if (this.state.notifications.length > 40) this.state.notifications.pop();
  }
}

/* ---------- WalletProvider (mock, explicitly labelled) ---------- */
class WalletProvider{
  constructor(){ this.connected = false; this.address = null; }
  connectDemo(){ this.connected = true; this.address = '0xDEM0…0000'; return this.getState(); }
  disconnect(){ this.connected = false; this.address = null; }
  getState(){ return { connected: this.connected, address: this.address, network: 'Arbitrum (demo)', demo: true }; }
}

/* ---------- exports ---------- */
global.OpenfundTerminal = {
  fmt, L, PriceBoard, TradingProvider, WalletProvider,
  FEE_RATE, MAINTENANCE
};
})(window);
