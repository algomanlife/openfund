/* ============================================================
   Openfund Gains Adapter
   Verified market-data integration with Gains Network
   (api.gains.trade / wss:api.gains.trade, Arbitrum), with live prices
   from Open Oracle (ADR 0059).

   Prices: the same-origin Open Oracle API (`/api/oracle/prices` and the
   `/api/oracle/stream` SSE feed) carries Openfund's composite of Gains,
   Hyperliquid and GMX. When this origin has no Open Oracle (the route
   answers 404/503, e.g. a static host or MARKET_PRICE_SOURCE=gains), the
   adapter falls back to the Gains prices socket and reports `gains` as
   its price source. `priceSource()` and the status info say which one is
   live; a price is never relabelled.

   The market catalog, specifications and candle history stay on Gains:
   chart history is Gains provider reference data.

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
const ORACLE = (global.__OPENFUND_ORACLE_BASE__ || '') + '/api/oracle';

/* Vela timeframe → Gains candle interval (1w deliberately absent: unsupported) */
const TF_MAP = {
  '1': '1m', '5': '5m', '15': '15m', '30': '30m', '1440': '1d',
  '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '60': '1h', '4h': '4h', '240': '4h', '1d': '1d', 'D': '1d'
};
const TF_MS = {
  '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
  '1h': 3600000, '4h': 14400000, '1d': 86400000
};

/* Pine resolutions preserve case: M is a calendar month; m is minutes. */
function resolution(timeframe){
  const direct = TF_MAP[timeframe];
  if (direct) return { interval: direct, ms: TF_MS[direct] };
  if (/^(?:1)?[WM]$/.test(timeframe)) return { interval: '1d', calendar: timeframe.endsWith('W') ? 'week' : 'month' };
  const match = /^(\d+)(m|h)?$/.exec(timeframe);
  const minutes = match && Number(match[1]) * (match[2] === 'h' ? 60 : 1);
  if (!minutes || minutes > 1440 || 1440 % minutes !== 0) throw new Error('Unsupported Gains/Pine timeframe: ' + timeframe);
  const ms = minutes * 60000;
  const interval = Object.keys(TF_MS).reverse().find(tf => ms % TF_MS[tf] === 0);
  return { interval, ms };
}

function bucket(time, spec){
  if (!spec.calendar) return Math.floor(time / spec.ms) * spec.ms;
  const date = new Date(time);
  if (spec.calendar === 'month') return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  const day = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return day - ((date.getUTCDay() + 6) % 7) * 86400000;
}

function aggregate(bars, spec){
  const out = [];
  for (const bar of bars){
    const time = bucket(bar.time, spec), last = out[out.length - 1];
    if (!last || last.time !== time) out.push({ ...bar, time });
    else { last.high = Math.max(last.high, bar.high); last.low = Math.min(last.low, bar.low); last.close = bar.close; }
  }
  return out;
}

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
    /* closed markets (isOpen:false) are kept — selectable for charts, not tradeable */
    if (m && typeof m.symbol === 'string' && typeof m.base === 'string') marketsCache.set(m.symbol, m);
  }
  marketsAt = Date.now();
  return marketsCache;
}

/* ---------- Open Oracle availability (decided once per page) ---------- */
let source = null;              /* 'open-oracle' | 'gains' once decided */
let oracleProbe = null;
function oracleRecord(r){
  if (!r || typeof r.market !== 'string' || r.price == null) return null;
  return { market: r.market, mark: r.price, index: null, updatedAt: r.at, mode: r.mode,
           confidence: r.confidence, stale: !!r.stale, source: 'open-oracle' };
}
async function oracleSnapshot(){
  const r = await fetch(ORACLE + '/prices', { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status });
  const j = await r.json();
  if (!j || !Array.isArray(j.data)) throw new Error('Invalid oracle envelope');
  return j.data.map(oracleRecord).filter(Boolean);
}
/* Open Oracle is used when this origin serves it with at least one price. */
function oracleAvailable(){
  if (!oracleProbe) oracleProbe = oracleSnapshot().then(rows => rows.length > 0, () => false)
    .then(ok => { source = ok ? 'open-oracle' : 'gains'; notifyStatus(); return ok; });
  return oracleProbe;
}

async function priceSnapshot(){
  if (await oracleAvailable()){
    try { return await oracleSnapshot(); } catch(e){ /* stream below keeps reconnecting */ }
  }
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
  const s = wsLive && !stale ? 'live' : ((ws || es) ? 'reconnecting' : 'connecting');
  for (const h of statusHandlers) h(s, { lastMsgAt, source });
}
function handlePriceData(items){
  lastMsgAt = Date.now();
  for (const it of items){
    if (!it || typeof it.market !== 'string') continue;
    const mark = Number(it.mark);
    if (!Number.isFinite(mark) || mark <= 0) continue;
    const payload = { market: it.market, mark, index: Number(it.index) || null,
                      updatedAt: Number(it.updatedAt) || Date.now(),
                      source: it.source || 'gains', mode: it.mode || null, stale: !!it.stale,
                      confidence: Number.isFinite(it.confidence) ? it.confidence : null };
    for (const h of priceHandlers) h(payload);
  }
  notifyStatus();
}

/* ---------- live Open Oracle stream (SSE, same origin) ----------
   One `snapshot` event, then `prices` events with the composites that
   changed in each evaluation. EventSource reconnects by itself after a
   dropped connection; a refused stream (closed state) is retried with
   backoff, and the watchdog replaces a silent one. */
let es = null, esRetry = 0, esTimer = null, esEverLive = false;
function connectOracle(){
  if (typeof EventSource !== 'function'){ source = 'gains'; connectWS(); return; }
  if (es) { try { es.close(); } catch(e){} }
  const mine = es = new EventSource(ORACLE + '/stream');
  const onEvent = ev => {
    if (mine !== es) return;
    let body; try { body = JSON.parse(ev.data); } catch(e){ return; }
    if (!body || !Array.isArray(body.data)) return;
    wsLive = true; esRetry = 0; esEverLive = true;
    handlePriceData(body.data.map(oracleRecord).filter(Boolean));
  };
  mine.addEventListener('snapshot', onEvent);
  mine.addEventListener('prices', onEvent);
  mine.onopen = () => { if (mine === es) { lastMsgAt = Date.now(); notifyStatus(); } };
  mine.onerror = () => {
    if (mine !== es) return;
    wsLive = false; notifyStatus();
    if (mine.readyState === 2){ es = null; scheduleOracleReconnect(); }
  };
}
function scheduleOracleReconnect(){
  if (esTimer) return;
  esRetry++;
  /* a stream that never delivered (e.g. a proxy that buffers SSE) falls back to the Gains socket, labelled as such */
  if (!esEverLive && esRetry > 4){ source = 'gains'; notifyStatus(); connectWS(); return; }
  esTimer = setTimeout(() => { esTimer = null; connectOracle(); }, Math.min(30000, 2000 * Math.pow(2, Math.min(esRetry, 4))));
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
  ws.onerror = () => { if (myGen === wsGen) { wsLive = false; notifyStatus(); } };
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
/* Heartbeat watchdog: the server pings, so a silent socket that never
   fires onclose (sleep, network switch, proxy idle drop) is detected and
   replaced instead of leaving frozen prices labelled as live. The status
   is re-evaluated on the same timer so staleness surfaces without waiting
   for the next message. */
const WS_SILENCE_MS = 30000;
let watchdog = null;
function startWatchdog(){
  if (watchdog || typeof setInterval !== 'function') return;   /* sandboxed hosts have no timers */
  watchdog = setInterval(() => {
    if (es && lastMsgAt && Date.now() - lastMsgAt > WS_SILENCE_MS){
      const dead = es; es = null; wsLive = false;
      try { dead.close(); } catch(e){}
      notifyStatus(); esRetry = 0; scheduleOracleReconnect();
    } else if (ws && lastMsgAt && Date.now() - lastMsgAt > WS_SILENCE_MS){
      const dead = ws; ws = null; wsLive = false; priceSeq = null; wsGen++;
      try { dead.close(); } catch(e){}
      notifyStatus();
      retry = 0; scheduleReconnect();
    } else notifyStatus();
  }, 5000);
}
/* Reconnect immediately (not after the backoff) when the network returns
   or the tab becomes visible again with no open socket. */
function reconnectNow(){
  if (source === 'open-oracle'){
    if (!priceHandlers.size || es) return;
    if (esTimer){ clearTimeout(esTimer); esTimer = null; }
    esRetry = 0; connectOracle(); return;
  }
  if (!priceHandlers.size || (ws && ws.readyState <= 1)) return;
  if (retryTimer){ clearTimeout(retryTimer); retryTimer = null; }
  retry = 0; connectWS();
}
if (typeof addEventListener === 'function'){
  addEventListener('online', reconnectNow);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reconnectNow(); });
}
let streamStarted = false;
function subscribePrices(handler){
  priceHandlers.add(handler);
  startWatchdog();
  if (!streamStarted){
    streamStarted = true;
    oracleAvailable().then(ok => ok ? connectOracle() : connectWS());
  } else if (source === 'gains' && !ws && !retryTimer) connectWS();
  return () => priceHandlers.delete(handler);
}
function priceSource(){ return source; }
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
  const tails = new Map();
  return {
    /* required — bars for a window; newest bar is the forming candle */
    async getBars(ticker, timeframe, range){
      const spec = resolution(timeframe);
      const interval = spec.interval;
      const tfMs = spec.ms || (spec.calendar === 'week' ? 7 : 31) * 86400000;
      const to = range && range.to != null ? range.to : Date.now();
      /* default window: ~500 bars (bounded; Gains serves recent history) */
      const from = range && range.from != null ? range.from : to - (range?.limit || 500) * tfMs;
      const bars = await fetchCandles(ticker, interval, bucket(from, spec), to);
      const result = aggregate(bars, spec);
      const tail = result[result.length - 1];
      const key = ticker + ':' + timeframe;
      if (tail && (!tails.has(key) || tail.time >= tails.get(key).time)) tails.set(key, tail);
      return result;
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
        tickerid: ticker,
        main_tickerid: ticker,
        root: m.base,
        basecurrency: m.base,
        currency: m.quote || 'USD',
        timezone: 'UTC',
        prefix: 'gains',
        mintick: 10 ** -m.pricePrecision,
        minmove: 1,
        pricescale: 10 ** m.pricePrecision,
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
    /* optional — live forming bar from the price stream (Open Oracle composites,
       or Gains marks on the fallback); stale composites never print a bar */
    subscribe(ticker, timeframe, onBar){
      const spec = resolution(timeframe);
      let bucketStart = 0, open = null, high = -Infinity, low = Infinity;
      const onPrice = p => {
        if (p.market !== ticker || p.stale) return;
        const now = Date.now();
        const price = p.mark;
        const start = bucket(now, spec);
        if (start !== bucketStart){
          const tail = tails.get(ticker + ':' + timeframe);
          bucketStart = start;
          open = tail?.time === start ? tail.open : price;
          high = Math.max(tail?.time === start ? tail.high : price, price);
          low = Math.min(tail?.time === start ? tail.low : price, price);
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
  subscribePrices, subscribeStatus, priceSource, ORACLE,
  createVelaProvider, openInterestUsd
};
})(window);
