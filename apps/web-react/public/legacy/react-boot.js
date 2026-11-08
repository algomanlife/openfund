/* ============================================================
   Openfund terminal iframe boot (external, CSP-safe).
   Loaded from the React terminal's srcDoc workspace. All dynamic
   data (locale, product, CMS translations) arrives through a
   non-executable JSON island (#of-boot-data) — never an inline
   script, so the strict `script-src 'self'` Content-Security-Policy
   applies end-to-end.
   ============================================================ */
(function (global) {
  'use strict';
  var data = {};
  try {
    var island = document.getElementById('of-boot-data');
    if (island) data = JSON.parse(island.textContent || '{}');
  } catch (e) { /* data stays empty; the terminal renders with defaults */ }
  global.ofLang = ['fa', 'en', 'ar', 'ru', 'zh-CN'].indexOf(data.locale) >= 0 ? data.locale : 'en';
  global.ofCmsTerminal = data.translations || {};
  global.__ofTerminalConfig = { product: data.product === 'perpetual' ? 'perpetual' : 'prop', syntheticMarketData: false };

  /* fallback adapter when no account data is available (guest / error) */
  var unavailableAccountAdapter = {
    readOnly: true, canTrade: false, serverMode: true, status: 'loading',
    state: { positions: [], orders: [], history: [], fills: [], funding: [], notifications: [] },
    getAccount: function () { return null; },
    validate: function () { var x = global.OpenfundTerminalLocales; return [global.ofLang === 'fa' ? 'حساب در دسترس نیست.' : (x && x.L[global.ofLang] && x.L[global.ofLang]['Account unavailable.']) || 'Account unavailable.']; },
    liqPrice: function () { return null; },
    subscribe: function () { return function () {}; },
    checkTriggers: function () {},
    loadDemoScenario: function () {},
  };
  var useServerTrading = global.__ofTerminalConfig.product === 'prop';
  Object.defineProperty(global, '__ofProductAdapter', {
    get: function () {
      return (useServerTrading && global.parent.__ofServerTP) || global.parent.__ofReadOnlyProductAdapter || unavailableAccountAdapter;
    },
  });
  Object.defineProperty(global, '__ofServerTP', {
    get: function () { return useServerTrading ? global.parent.__ofServerTP : undefined; },
  });

  /* display updates from the React shell: theme + locale stay in sync
     with the outer document without reloading the workspace.
     NOTE: this document is about:srcdoc — location.origin serializes as
     the string "null" — so origin equality against the parent URL can
     never hold here. The authoritative same-origin guarantee is
     e.source === parent (an srcdoc document inherits the parent's
     origin), and the shell only posts with targetOrigin = its own
     origin, which a cross-origin document could not match. */
  global.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'openfund-display' || e.source !== global.parent) return;
    if (e.data.theme === 'light' || e.data.theme === 'dark') {
      if (global.__openfundApplyTheme) global.__openfundApplyTheme(e.data.theme);
      else document.documentElement.dataset.theme = e.data.theme;
    }
    if (global.ofLang !== e.data.locale && global.__ofSetLang) global.__ofSetLang(e.data.locale);
  });
  var retry = document.getElementById('account-retry');
  if (retry) retry.onclick = function () { global.parent.dispatchEvent(new global.parent.Event('of-refresh-trading')); };
})(window);
