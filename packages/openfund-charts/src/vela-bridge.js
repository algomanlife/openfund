/* ============================================================
   Openfund Charts — Vela WORKSPACE bridge
   Mounts the full LuxAlgo Vela workspace (topbar with symbol /
   timeframe / style / indicators, drawing toolbar, status line,
   bottom bar, symbol search, keyboard map) as the terminal chart,
   powered by the Gains provider.

   Bundle: dist/assets/vela-workspace.global.min.js
           (esbuild IIFE of @luxalgo/vela/workspace@0.9.3)
   Contract (packages/openfund-charts):
     OpenfundCharts.mount(container, opts) → controller
     controller.setSymbol(symbol)      in-place market switch
     controller.setTimeframe(tf)
     controller.setTheme('dark'|'light')
     controller.setLocale(tag)
     controller.resize()
     controller.chart                   → active Vela chart
     controller.workspace               → VelaWorkspace instance
     controller.destroy()
   ============================================================ */
(function(global){
'use strict';
const G = global.OpenfundGains;
if (!G) throw new Error('OpenfundGains adapter required before vela-bridge');
const WLib = global.VelaWorkspace;
if (!WLib || !WLib.VelaWorkspace) throw new Error('Vela workspace bundle not loaded (assets/vela-workspace.global.min.js)');

/* Gains-supported timeframes only (1w verified unsupported) */
const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

/* Openfund brand themes (Vela full theme objects — 7 required fields) */
const THEMES = {
  dark: {
    background: '#060808', textColor: '#A9B3A9', gridColor: '#FFFFFF0A',
    borderColor: '#FFFFFF18', upColor: '#82E7BD', downColor: '#E89483',
    fontFamily: "Ubuntu, 'Irancell', system-ui, sans-serif"
  },
  light: {
    background: '#F2F5F0', textColor: '#3F4C44', gridColor: '#0A120D12',
    borderColor: '#0A120D22', upColor: '#12965D', downColor: '#C0453E',
    fontFamily: "Ubuntu, 'Irancell', system-ui, sans-serif"
  }
};

function mount(container, opts){
  opts = opts || {};
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) throw new Error('Vela mount: container not found');

  /* Openfund hosts its own market selector — Vela's symbol chip is omitted.
     Timeframe / style / indicators / undo-redo stay (left side),
     alerts / panels / screenshot on the right. */
  const ws = new WLib.VelaWorkspace(el, {
    layout: false,                    /* single-chart mode */
    symbol: 'gains:' + (opts.symbol || 'BTC/USD'),
    timeframe: opts.timeframe || '1m',
    providers: { gains: () => G.createVelaProvider() },
    timeframes: TIMEFRAMES,
    live: true,
    theme: THEMES.dark,               /* chart always dark; the host inverts for light mode */
    persist: false,
    topbar: {
      left: ['timeframes', 'style', 'indicators', 'undo-redo'],
      right: ['actions', 'alerts', 'panels', 'screenshot']
    }
  });
  /* The built-in V attribution mark is replaced by Openfund branding; the
     upstream NOTICE is honoured with a visible "Vela" link on the same screen
     (see .vela-credit in terminal.html). */
  const attributionOff = () => {
    try { ws.chart && ws.chart.renderer.set('attribution', false); return true; } catch(e){ return false; }
  };
  if (!attributionOff()){
    /* the chart may not exist yet — retry until the first cell paints */
    const iv = setInterval(() => { if (attributionOff()) clearInterval(iv); }, 400);
    setTimeout(() => clearInterval(iv), 20000);
  }

  const ro = new ResizeObserver(() => { try { ws.chart && ws.chart.resize(); } catch(e){} });
  ro.observe(el);

  const controller = {
    workspace: ws,
    /* debug/testing handle */
    __set: (k, v) => { try { return ws.chart.renderer.set(k, v); } catch(e){ return 'ERR:' + e.message; } },
    get chart(){ return ws.chart; },
    setSymbol(symbol){ return ws.chart.setMarket({ symbol: 'gains:' + symbol }); },
    setTimeframe(tf){ return ws.chart.setMarket({ timeframe: tf }); },
    setMarket(next){
      if (next.symbol) next.symbol = 'gains:' + next.symbol;
      return ws.chart.setMarket(next);
    },
    setTheme(theme){
      /* chart stays dark; light mode is a host-level invert so the whole
         terminal (incl. chart canvas) matches the landing light theme */
      return ws;
    },
    setLocale(tag){ try { return ws.setLocale(tag); } catch(e){} },
    resize(){ try { return ws.chart && ws.chart.resize(); } catch(e){} },
    on(event, handler){ return ws.chart.on(event, handler); },
    destroy(){
      ro.disconnect();
      try { ws.destroy(); } catch(e){}
    }
  };
  global.__openfundChart = controller;   /* debug handle */
  return controller;
}

global.OpenfundCharts = { mount, THEMES, TIMEFRAMES };
})(window);
