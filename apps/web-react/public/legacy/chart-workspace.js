/* ============================================================
   Openfund — per-wallet chart workspace sync (terminal iframe)

   The signed-in wallet's chart workspace lives in the Openfund backend
   (GET/PUT /chart/workspaces/:workspace[/:scope], session-owned — the
   server never trusts an address from the browser). This module:

   - fixes the chart identity for this terminal document from the React
     shell (window.parent.__ofChartIdentity → the session user id, or
     null for a guest). The shell remounts the terminal iframe whenever the
     identity changes (login, logout, wallet switch), so one document only
     ever shows ONE identity's workspace;
   - namespaces the local cache per identity (`key@<userId>`), so wallet B
     never reads wallet A's cached drawings; guests keep the original keys;
   - hydrates that cache from the server BEFORE the chart mounts (`ready`),
     so the default chart initialization can never overwrite a restored
     workspace with a late response;
   - saves debounced snapshots per scope ('*' = settings: Vela workspace
     state, renderer config, tool defaults; '<symbol>' = that market's
     drawings) with optimistic revisions: a stale tab gets 409 and adopts
     the newer server copy instead of overwriting it;
   - keeps working offline / while the database is unavailable: the local
     cache is written first and failed saves are retried.
   Only chart state passes through here — never keys, signatures or session
   material. Live position overlays are excluded by the callers.
   ============================================================ */
(function (global) {
  'use strict';
  const parentWin = (() => { try { return global.parent && global.parent !== global ? global.parent : null; } catch (e) { return null; } })();
  const ident = (() => { try { return parentWin && parentWin.__ofChartIdentity; } catch (e) { return null; } })() || {};
  const identity = typeof ident.user === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(ident.user) ? ident.user : null;
  const product = (global.__ofTerminalConfig && global.__ofTerminalConfig.product) || 'prop';
  const workspace = /^[a-z0-9_-]{1,32}$/.test(product) ? product : 'prop';
  const backend = (() => { try { return String((parentWin && parentWin.__ofBackendUrl) || '').replace(/\/$/, ''); } catch (e) { return ''; } })();
  const SCOPE_RE = /^[A-Za-z0-9._:/-]{1,64}$/;
  const DEBOUNCE_MS = 1200, RETRY_MS = 15000, HYDRATE_TIMEOUT_MS = 4000;
  const SETTINGS_KEYS = { workspace: 'of-chart-v2-' + product, config: 'of-vela-config', tools: 'of-vela-tools' };
  const drawingsKey = sym => 'of-vela-drawings-' + sym;

  const nsKey = k => identity ? k + '@' + identity : k;
  const rawGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const rawSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage full / private mode */ } };
  const getLocal = k => rawGet(nsKey(k));
  const setLocal = (k, v) => rawSet(nsKey(k), v);
  const parse = s => { try { return s == null ? null : JSON.parse(s); } catch (e) { return null; } };

  /* last server revision per scope (cached so a reload without network
     still sends the right base revision when it comes back) */
  const REV_KEY = 'of-chart-sync-rev';
  const revisions = new Map(Object.entries(parse(getLocal(REV_KEY)) || {}));
  const saveRevs = () => setLocal(REV_KEY, JSON.stringify(Object.fromEntries(revisions)));
  const pending = new Map(), timers = new Map(), lastSent = new Map();
  let status = identity ? 'hydrating' : 'guest';

  const emit = (name, detail) => { try { global.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) {} };
  const api = (path, init) => fetch(backend + '/chart/workspaces/' + workspace + path, {
    credentials: 'include', cache: 'no-store', ...init,
    headers: { 'Content-Type': 'application/json', ...(identity ? { 'X-Openfund-Chart-User': identity } : {}), ...(init && init.headers) },
  });

  function settingsDoc() {
    return { workspace: getLocal(SETTINGS_KEYS.workspace), config: parse(getLocal(SETTINGS_KEYS.config)), tools: parse(getLocal(SETTINGS_KEYS.tools)) };
  }
  /* write one server entry into this identity's local cache */
  function adopt(entry) {
    if (!entry || !entry.data) return;
    if (entry.scope === '*') {
      const d = entry.data;
      if (typeof d.workspace === 'string') setLocal(SETTINGS_KEYS.workspace, d.workspace);
      if (d.config && typeof d.config === 'object') setLocal(SETTINGS_KEYS.config, JSON.stringify(d.config));
      if (d.tools && typeof d.tools === 'object') setLocal(SETTINGS_KEYS.tools, JSON.stringify(d.tools));
    } else if (SCOPE_RE.test(entry.scope) && Array.isArray(entry.data.drawings)) {
      setLocal(drawingsKey(entry.scope), JSON.stringify(entry.data));
    }
    if (Number.isInteger(entry.revision)) { revisions.set(entry.scope, entry.revision); saveRevs(); }
    lastSent.set(entry.scope, JSON.stringify(entry.data));
  }

  /* one-time continuity for drawings saved before per-wallet storage
     existed (shared, un-namespaced keys): only the FIRST wallet that signs
     in on this browser with an empty server workspace adopts them; every
     later wallet starts clean. */
  const LEGACY_FLAG = 'of-chart-legacy-adopted';
  function adoptLegacyOnce() {
    if (rawGet(LEGACY_FLAG)) return;
    rawSet(LEGACY_FLAG, '1');
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k.includes('@')) continue;
        const isDrawings = k.startsWith('of-vela-drawings-');
        if (!isDrawings && !Object.values(SETTINGS_KEYS).includes(k)) continue;
        if (getLocal(k) == null) setLocal(k, rawGet(k));
        if (isDrawings) { const sym = k.slice('of-vela-drawings-'.length); if (SCOPE_RE.test(sym)) saveSymbol(sym, parse(rawGet(k))); }
      }
      saveSettings();
    } catch (e) {}
  }

  const ready = !identity ? Promise.resolve('guest') : (async () => {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => ctl && ctl.abort(), HYDRATE_TIMEOUT_MS);
    try {
      const res = await api('', { method: 'GET', signal: ctl ? ctl.signal : undefined });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const body = await res.json();
      const entries = Array.isArray(body && body.entries) ? body.entries : [];
      entries.forEach(adopt);
      const localEmpty = getLocal(SETTINGS_KEYS.workspace) == null;
      if (!entries.length && localEmpty) adoptLegacyOnce();
      status = 'synced';
    } catch (e) {
      /* offline / backend or database unavailable: keep this wallet's last
         local cache; saves queue and retry */
      status = 'offline';
    } finally { clearTimeout(timer); }
    return status;
  })();

  function schedule(scope) {
    clearTimeout(timers.get(scope));
    timers.set(scope, setTimeout(() => { void flush(scope); }, DEBOUNCE_MS));
  }
  function saveSymbol(sym, doc) {
    if (!identity || !SCOPE_RE.test(String(sym || '')) || !doc || !Array.isArray(doc.drawings)) return;
    pending.set(sym, { drawings: doc.drawings, ...(doc.version != null ? { version: doc.version } : {}) });
    schedule(sym);
  }
  function saveSettings() {
    if (!identity) return;
    const d = settingsDoc();
    if (d.workspace == null && d.config == null && d.tools == null) return;
    pending.set('*', d);
    schedule('*');
  }
  /* one request per scope at a time: a second edit waits for the first
     save's revision instead of racing it into a self-inflicted 409 */
  const inflight = new Map();
  function flush(scope, opts) {
    const prev = inflight.get(scope);
    if (prev) return prev.then(() => flush(scope, opts));
    const run = flushNow(scope, opts).finally(() => { if (inflight.get(scope) === run) inflight.delete(scope); });
    inflight.set(scope, run);
    return run;
  }
  async function flushNow(scope, { keepalive = false } = {}) {
    const data = pending.get(scope);
    if (!data) return;
    const json = JSON.stringify(data);
    if (lastSent.get(scope) === json) { pending.delete(scope); return; }
    pending.delete(scope);
    try {
      await ready;
      const res = await api('/' + encodeURIComponent(scope), { method: 'PUT', keepalive,
        body: JSON.stringify({ data, schemaVersion: 1, baseRevision: revisions.get(scope) || 0 }) });
      if (res.ok) {
        const out = await res.json();
        revisions.set(scope, out.revision); saveRevs(); lastSent.set(scope, json); status = 'synced';
        return;
      }
      if (res.status === 409 && (await res.clone().json().catch(() => ({}))).error === 'identity_mismatch') return;
      if (res.status === 409) {
        /* another tab/device saved first: never overwrite it — adopt the
           newer server copy and let the terminal re-apply it */
        const body = await res.json().catch(() => null);
        if (body && body.current) { adopt(body.current); emit('of-chart-workspace-remote', { scope }); }
        else { revisions.delete(scope); saveRevs(); pending.set(scope, data); schedule(scope); }
        return;
      }
      /* not retryable: signed out, suspended, invalid, too large, or the
         session now belongs to another wallet (identity_mismatch) */
      if (res.status === 401 || res.status === 403 || res.status === 400 || res.status === 413) return;
      throw new Error('HTTP ' + res.status);
    } catch (e) {
      status = 'offline';
      if (!pending.has(scope)) pending.set(scope, data);
      clearTimeout(timers.get(scope));
      timers.set(scope, setTimeout(() => { void flush(scope); }, RETRY_MS));
    }
  }
  const flushAll = opts => Promise.all([...pending.keys()].map(s => flush(s, opts)));
  global.addEventListener('online', () => { void flushAll(); });
  global.addEventListener('pagehide', () => { [...timers.values()].forEach(clearTimeout); void flushAll({ keepalive: true }); });

  global.OpenfundChartWorkspace = {
    identity, workspace, ready,
    get status() { return status; },
    key: nsKey, getLocal, setLocal,
    saveSymbol, saveSettings, flushAll,
  };
})(window);
