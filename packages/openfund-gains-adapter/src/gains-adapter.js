/* ============================================================
   Openfund Gains Adapter
   Verified market-data integration with Gains Network
   (api.gains.trade / wss:api.gains.trade, Arbitrum).

   Verified endpoints (2026-10-31):
     GET  /v1/arbitrum/markets                                → 488 symbols w/ metadata
     GET  /v1/arbitrum/prices                                 → {market, mark, index, updatedAt}
     GET  /v1/arbitrum/markets/{SYMBOL-DASHED}/candles?interval=1m|5m|15m|30m|1h|4h|1d&from={ms}&to={ms}
                                                              → [{time, open, high, low, close}] (strings)
     WS   wss://api.gains.trade/v1/arbitrum/ws               → subscribe prices channel

   Not provided by this API (never fabricated):
     volume, open interest, executed trades, order-book depth.
     1w candles are NOT supported (verified: empty response).

   Exposes:
     window.OpenfundGains = {
       rest, marketList, priceSnapshot, subscribePrices,
       fetchCandles, stats24h, createVelaProvider, TF_MAP
     }
   ============================================================ */
(function(global){
'use strict';

const API = 'https://api.gains.trade/v1/arbitrum';
const WS = 'wss://api.gains.trade/v1/arbitrum/ws';

/* Vela timeframe → Gains candle interval (1w deliberately absent: unsupported) */
const TF_MAP = {
  '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '60': '1h', '4h': '4h', '240': '4h', '1d': '1d', 'D': '1d'
};
const TF_MS = {
  '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
  '1h': 3600000, '4h': 14400000, '1d': 86400000
};

/* ---------- REST ---------- */
async function get(path, timeoutMs){
  const r = await fetch(API + path, { signal: AbortSignal.timeout(timeoutMs || 12000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (!Array.isArray(j.data)) throw new Error('Invalid data envelope');
  return j.data;
}

/* ---------- state ---------- */
let marketsCache = null;        /* symbol → metadata */
let marketsAt = 0;
const MARKETS_TTL = 10 * 60 * 1000;

async function marketList(force){
  if (!force && marketsCache && Date.now() - marketsAt < MARKETS_TTL) return marketsCache;
  const data = await get('/markets');
  marketsCache = new Map();
  for (const m of data){
    if (m && typeof m.symbol === 'string' && m.isOpen !== false) marketsCache.set(m.symbol, m);
  }
  marketsAt = Date.now();
  return marketsCache;
}

async function priceSnapshot(){
  return get('/prices', 8000); /* [{market, mark, index, updatedAt}] */
}

/* ---------- candles ---------- */
function dashSymbol(symbol){ return symbol.replace('/', '-'); }

async function fetchCandles(symbol, interval, fromMs, toMs){
  const data = await get('/markets/' + encodeURIComponent(dashSymbol(symbol)) +
    '/candles?interval=' + encodeURIComponent(interval) +
    '&from=' + Math.floor(fromMs) + '&to=' + Math.floor(toMs == null ? Date.now() : toMs));
  const out = [];
  let prevTime = -1;
  for (const c of data){
    const time = Number(c.time), open = Number(c.open), high = Number(c.high),
          low = Number(c.low), close = Number(c.close);
    if (!Number.isFinite(time) || !Number.isFinite(close) || close <= 0) continue;
    if (time === prevTime) continue;            /* de-dupe by open time */
    prevTime = time;
    out.push({
      time,
      open: Number.isFinite(open) ? open : close,
      high: Number.isFinite(high) ? high : close,
      low: Number.isFinite(low) ? low : close,
      close
    });
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

/* 24h stats derived from real 1h candles (no volume/OI — not provided) */
async function stats24h(symbol){
  const now = Date.now();
  const bars = await fetchCandles(symbol, '1h', now - 25 * 3600000, now);
  if (!bars.length) return null;
  let high = -Infinity, low = Infinity;
  for (const b of bars){ high = Math.max(high, b.high); low = Math.min(low, b.low); }
  const first = bars[0].open, last = bars[bars.length - 1].close;
  return { high, low, changePct: (last - first) / first * 100, bars: bars.length };
}

/* ---------- live price WS (shared singleton, reconnect + staleness) ----------
   Protocol (verified 2026-10-31, mirrors the landing integration):
     send  {op:'subscribe',   channel:'prices'}
     recv  {op:'hello', heartbeatMs}
     recv  {op:'ping'}            -> must answer {op:'pong'}
     recv  {channel:'prices', snapshot?, seq, data:[{market, mark, index, updatedAt}]}
   A sequence gap forces unsubscribe + resubscribe (snapshot resync).          */
let ws = null, wsGen = 0, wsLive = false, lastMsgAt = 0, retry = 0, retryTimer = null, priceSeq = null;
const priceHandlers = new Set();
const statusHandlers = new Set();

function notifyStatus(){
  const stale = lastMsgAt && Date.now() - lastMsgAt > 45000;
  const s = wsLive && !stale ? 'live' : (ws ? 'reconnecting' : 'connecting');
  for (const h of statusHandlers) h(s, { lastMsgAt });
}
function handlePriceData(items){
  lastMsgAt = Date.now();
  for (const it of items){
    if (!it || typeof it.market !== 'string') continue;
    const mark = Number(it.mark);
    if (!Number.isFinite(mark) || mark <= 0) continue;
    const payload = { market: it.market, mark, index: Number(it.index) || null,
                      updatedAt: Number(it.updatedAt) || Date.now() };
    for (const h of priceHandlers) h(payload);
  }
  notifyStatus();
}
function connectWS(){
  if (ws) { try { ws.close(); } catch(e){} }
  const myGen = ++wsGen;
  try { ws = new WebSocket(WS); } catch(e){ scheduleReconnect(); return; }
  ws.onopen = () => {
    if (myGen !== wsGen) return;
    retry = 0; priceSeq = null;
    ws.send(JSON.stringify({ op: 'subscribe', channel: 'prices' }));
    lastMsgAt = Date.now(); notifyStatus();
  };
  ws.onmessage = ev => {
    if (myGen !== wsGen) return;
    let msg;
    try { msg = JSON.parse(ev.data); } catch(e){ return; }
    if (msg && msg.op === 'ping'){
      try { ws.send(JSON.stringify({ op: 'pong' })); } catch(e){}
      lastMsgAt = Date.now();
      return;
    }
    if (msg && msg.op === 'hello'){ lastMsgAt = Date.now(); notifyStatus(); return; }
    if (msg && msg.op === 'subscribed'){ wsLive = true; notifyStatus(); return; }
    if (msg && msg.channel === 'prices' && Array.isArray(msg.data)){
      wsLive = true;
      if (!msg.snapshot && priceSeq !== null && Number.isFinite(msg.seq) && msg.seq !== priceSeq + 1){
        priceSeq = null;
        try {
          ws.send(JSON.stringify({ op: 'unsubscribe', channel: 'prices' }));
          ws.send(JSON.stringify({ op: 'subscribe', channel: 'prices' }));
        } catch(e){}
        return;
      }
      if (Number.isFinite(msg.seq)) priceSeq = msg.seq;
      handlePriceData(msg.data);
    }
  };
  ws.onerror = () => { if (myGen === wsGen) wsLive = false; };
  ws.onclose = () => {
    if (myGen !== wsGen) return;
    wsLive = false; ws = null; priceSeq = null; notifyStatus();
    scheduleReconnect();
  };
}
function scheduleReconnect(){
  if (retryTimer) return;
  retry++;
  const delay = Math.min(30000, 2000 * Math.pow(2, Math.min(retry, 4)));
  retryTimer = setTimeout(() => { retryTimer = null; connectWS(); }, delay);
}
function subscribePrices(handler){
  priceHandlers.add(handler);
  if (!ws && !retryTimer) connectWS();
  return () => priceHandlers.delete(handler);
}
function subscribeStatus(handler){ statusHandlers.add(handler); notifyStatus(); return () => statusHandlers.delete(handler); }

/* ---------- real open interest from /markets funding metadata ---------- */
function openInterestUsd(meta){
  if (!meta || !meta.funding) return null;
  const l = Number(meta.funding.openInterestLongUsd), s = Number(meta.funding.openInterestShortUsd);
  if (!Number.isFinite(l) || !Number.isFinite(s)) return null;
  return { long: l, short: s, total: l + s };
}

/* ---------- Vela DataProvider (verified Gains data only) ---------- */
function createVelaProvider(){
  return {
    /* required — bars for a window; newest bar is the forming candle */
    async getBars(ticker, timeframe, range){
      const interval = TF_MAP[timeframe] || '1h';
      const tfMs = TF_MS[interval] || 3600000;
      const to = range && range.to != null ? range.to : Date.now();
      /* default window: ~500 bars (bounded; Gains serves recent history) */
      const from = range && range.from != null ? range.from : to - 500 * tfMs;
      return fetchCandles(ticker, interval, from, to);
    },
    /* optional — full verified symbol list (488 markets) */
    async listSymbols(){
      const list = await marketList(true);
      return [...list.values()].map(m => ({
        ticker: m.symbol,
        description: m.base + ' / ' + (m.quote || 'USD'),
        type: m.group
      }));
    },
    /* optional — real precision metadata */
    async getSymbolInfo(ticker){
      const list = await marketList();
      const m = list.get(ticker);
      if (!m) return { ticker };
      return {
        ticker,
        description: m.base + ' / ' + (m.quote || 'USD'),
        pricePrecision: m.pricePrecision,
        sizePrecision: m.sizePrecision,
        maxLeverage: Number(m.maxLeverage),
        minLeverage: Number(m.minLeverage),
        spreadRate: Number(m.spreadRate),
        funding: m.funding || null,
        fees: m.fees || null
      };
    },
    /* optional — true live stream from the Gains prices channel */
    subscribe(ticker, timeframe, onBar){
      const interval = TF_MAP[timeframe] || '1h';
      const tfMs = TF_MS[interval] || 3600000;
      let bucketStart = 0, open = null, high = -Infinity, low = Infinity;
      const onPrice = p => {
        if (p.market !== ticker) return;
        const now = Date.now();
        const price = p.mark;
        const start = Math.floor(now / tfMs) * tfMs;
        if (start !== bucketStart){
          bucketStart = start; open = price; high = price; low = price;
        } else {
          if (open == null) open = price;
          high = Math.max(high, price); low = Math.min(low, price);
        }
        onBar({ time: bucketStart, open, high, low, close: price });
      };
      const unsub = subscribePrices(onPrice);
      return unsub;
    },
    info(){
      return {
        name: 'Gains Network',
        timeframes: Object.keys(TF_MS),
        capabilities: { history: true, live: true, volume: false }
      };
    }
  };
}

global.OpenfundGains = {
  API, WS, TF_MAP, TF_MS,
  rest: get, marketList, priceSnapshot,
  fetchCandles, stats24h,
  subscribePrices, subscribeStatus,
  createVelaProvider, openInterestUsd
};
})(window);
