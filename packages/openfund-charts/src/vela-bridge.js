/* ============================================================
   Openfund Charts — Vela bridge
   Mounts a LuxAlgo Vela chart (vendored @luxalgo/vela@0.9.3,
   dist/assets/vela.global.min.js → window.Vela) inside the
   Openfund terminal, wired to the Gains provider.

   Contract (packages/openfund-charts):
     OpenfundCharts.mount(container, opts) → controller
     controller.setSymbol(symbol)
     controller.setTimeframe(tf)
     controller.setTheme('dark'|'light')
     controller.resize()
     controller.on(event, handler)
     controller.chart            → underlying Vela instance
     controller.destroy()
   ============================================================ */
(function(global){
'use strict';
const G = global.OpenfundGains;
if (!G) throw new Error('OpenfundGains adapter required before vela-bridge');
if (!global.Vela) throw new Error('Vela bundle not loaded (assets/vela.global.min.js)');
const VelaClass = global.Vela.Vela || global.Vela;   /* global build attaches the exports object */

/* Openfund theme overlays on Vela's built-in dark/light bases.
   Candle colors stay Vela defaults (shared across themes). */
const CHART_BG = { dark: '#060808', light: '#F2F5F0' };

function mount(container, opts){
  opts = opts || {};
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) throw new Error('Vela mount: container not found');

  const provider = G.createVelaProvider();
  const chart = new VelaClass(el, {
    symbol: opts.symbol || 'gains:BTC/USD',
    timeframe: opts.timeframe || '1m',
    theme: opts.theme === 'light' ? 'light' : 'dark'
    /* attribution: Vela renders its NOTICE mark by default (kept enabled) */
  });
  chart.data.registerProvider('gains', provider);

  /* re-frame on resize */
  const ro = new ResizeObserver(() => { try { chart.resize(); } catch(e){} });
  ro.observe(el);

  const listeners = new Map();
  function on(event, handler){
    const off = chart.on(event, handler);
    if (!listeners.has(event)) listeners.set(event, []);
    listeners.get(event).push(off);
    return off;
  }

  const controller = {
    chart,
    setSymbol(symbol){ return chart.setMarket({ symbol: 'gains:' + symbol }); },
    setTimeframe(tf){ return chart.setMarket({ timeframe: tf }); },
    setMarket(next){ return chart.setMarket(next); },
    setTheme(theme){
      return chart.setTheme(theme === 'light' ? 'light' : 'dark');
    },
    resize(){ return chart.resize(); },
    on,
    destroy(){
      ro.disconnect();
      for (const offs of listeners.values()) offs.forEach(off => { try { off(); } catch(e){} });
      listeners.clear();
      try { chart.destroy(); } catch(e){}
    }
  };
  return controller;
}

global.OpenfundCharts = { mount, CHART_BG };
})(window);
