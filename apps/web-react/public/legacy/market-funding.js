/* ============================================================
   OPENFUND TERMINAL — Funding and Details tabs (item G)
   Funding: current long/short funding, borrowing, an open-interest ratio
   bar and skew, and a history chart from Openfund's own hourly samples
   (GET /markets/:symbol/funding-history). Ranges without enough samples
   are disabled and say from when data exists; nothing is estimated.
   Details: the Gains market specification and the Openfund account limits
   as two separate cards. Data: the backend (documented Gains endpoints
   only), labelled "Market data from Gains Network".
   ============================================================ */
(function (global) {
  'use strict';
  const doc = global.document;
  const $ = id => doc.getElementById(id);
  const parentWin = (() => { try { return global.parent && global.parent !== global ? global.parent : null; } catch (e) { return null; } })();
  const backend = (() => { try { return String((parentWin && parentWin.__ofBackendUrl) || '').replace(/\/$/, ''); } catch (e) { return ''; } })();
  const product = (global.__ofTerminalConfig && global.__ofTerminalConfig.product) || 'prop';
  const T = key => (typeof global.ofT === 'function' ? global.ofT(key) : key);
  const lang = () => global.ofLang || 'en';
  const intl = () => ({ fa: 'fa-IR', ar: 'ar', ru: 'ru-RU', 'zh-CN': 'zh-CN' })[lang()] || 'en-US';
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const symbol = () => { try { return global.OpenfundTerminalInspect && global.OpenfundTerminalInspect.symbol(); } catch (e) { return null; } };
  const dashed = s => encodeURIComponent(String(s).replace('/', '-'));
  const HOURS_PER_YEAR = 24 * 365;
  const ST = { tab: 'chart', range: '1w', interval: '4h', series: 'long', annual: false, history: null, current: null, details: null, market: null, seq: 0 };
  try { const saved = JSON.parse(global.localStorage.getItem('of-funding-view') || '{}'); Object.assign(ST, { range: saved.range || ST.range, interval: saved.interval || ST.interval, series: saved.series || ST.series, annual: saved.annual === true }); } catch (e) { /* optional */ }
  const save = () => { try { global.localStorage.setItem('of-funding-view', JSON.stringify({ range: ST.range, interval: ST.interval, series: ST.series, annual: ST.annual })); } catch (e) { /* optional */ } };

  const pct = (hourly, annual, digits) => {
    const n = Number(hourly);
    if (!Number.isFinite(n)) return '—';
    const v = n * (annual ? HOURS_PER_YEAR : 1) * 100;
    return new Intl.NumberFormat(intl(), { maximumFractionDigits: digits == null ? (annual ? 2 : 5) : digits, minimumFractionDigits: annual ? 2 : 4, signDisplay: 'exceptZero' }).format(v) + '%';
  };
  const usd = v => { const n = Number(v); return Number.isFinite(n) ? new Intl.NumberFormat(intl(), { style: 'currency', currency: 'USD', notation: n >= 1e6 ? 'compact' : 'standard', maximumFractionDigits: n >= 1e6 ? 2 : 0 }).format(n) : '—'; };
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? new Intl.NumberFormat(intl(), { maximumFractionDigits: d == null ? 4 : d }).format(n) : '—'; };
  const date = iso => { try { return new Intl.DateTimeFormat(intl(), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(iso)) + ' UTC'; } catch (e) { return iso; } };
  const day = iso => { try { return new Intl.DateTimeFormat(intl(), { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso)); } catch (e) { return iso; } };

  async function get(path) {
    const r = await global.fetch(backend + path, { credentials: 'omit' });
    if (!r.ok) throw new Error('http_' + r.status);
    return r.json();
  }
  const state = (box, kind) => {
    if (!box) return;
    box.dataset.state = kind;
    box.innerHTML = kind === 'loading' ? `<span class="news-spinner" aria-hidden="true"></span><span>${esc(T('fund.loading'))}</span>`
      : kind === 'failed' ? `<span>${esc(T('fund.unavailable'))}</span> <button type="button" class="ghost-btn" data-fund-retry>${esc(T('fund.retry'))}</button>` : '';
  };

  /* ---------------- Funding ---------------- */
  async function loadFunding(force) {
    const m = symbol();
    if (!m) return;
    const seq = ++ST.seq;
    if (force || ST.market !== m) { ST.current = null; ST.history = null; ST.details = null; ST.market = m; }
    renderFunding();
    if (!ST.current) state($('funding-state'), 'loading');
    try {
      const [current, history] = await Promise.all([
        ST.current ? Promise.resolve(ST.current) : get(`/markets/${dashed(m)}/funding`),
        get(`/markets/${dashed(m)}/funding-history?range=${ST.range}&interval=${ST.interval}`),
      ]);
      if (seq !== ST.seq) return;
      ST.current = current; ST.history = history;
      state($('funding-state'), 'ready');
    } catch (e) {
      if (seq !== ST.seq) return;
      state($('funding-state'), 'failed');
    }
    renderFunding();
  }

  function renderFunding() {
    const host = $('funding-host');
    if (!host) return;
    const c = ST.current, h = ST.history;
    const longOi = Number(c && c.openInterestLongUsd), shortOi = Number(c && c.openInterestShortUsd);
    const total = longOi + shortOi;
    const longShare = total > 0 ? longOi / total : null;
    const ranges = ['1d', '1w', '1m', '3m'], intervals = ['1h', '4h', '1d'];
    const msOf = { '1d': 864e5, '1w': 6048e5, '1m': 2592e6, '3m': 7776e6, '1h': 36e5, '4h': 144e5 };
    const avail = (h && h.available) || {};
    const chip = (group, value, label, disabled, title) => `<button type="button" class="fund-chip" data-fund-${group}="${value}" aria-pressed="${ST[group] === value}"${disabled ? ' disabled aria-disabled="true"' : ''}${title ? ` title="${esc(title)}"` : ''}>${esc(label)}</button>`;
    const fromNote = h && h.availableFrom ? `${T('fund.availableFrom')} ${day(h.availableFrom)}` : T('fund.noSamples');
    host.innerHTML = `
      <div class="fund-cards">
        <div class="fund-card"><span class="fund-k">${esc(T('fund.long'))}</span><b class="fund-v" data-sign="${Math.sign(Number(c && c.fundingRateLongHourly)) || 0}">${c ? pct(c.fundingRateLongHourly, ST.annual) : '—'}</b><small>${esc(T(ST.annual ? 'fund.perYear' : 'fund.perHour'))}</small></div>
        <div class="fund-card"><span class="fund-k">${esc(T('fund.short'))}</span><b class="fund-v" data-sign="${Math.sign(Number(c && c.fundingRateShortHourly)) || 0}">${c ? pct(c.fundingRateShortHourly, ST.annual) : '—'}</b><small>${esc(T(ST.annual ? 'fund.perYear' : 'fund.perHour'))}</small></div>
        <div class="fund-card"><span class="fund-k">${esc(T('fund.borrowing'))}</span><b class="fund-v">${c && c.borrowingRateHourly != null ? pct(c.borrowingRateHourly, ST.annual) : '—'}</b><small>${esc(T(ST.annual ? 'fund.perYear' : 'fund.perHour'))}</small></div>
      </div>
      <div class="fund-oi">
        <div class="fund-oi-head"><span>${esc(T('fund.oi'))}</span><span>${esc(T('fund.skew'))} <b dir="ltr">${c ? usd(c.skewUsd) : '—'}</b></span></div>
        <div class="fund-oi-bar" role="img" aria-label="${esc(T('fund.oi'))}: ${esc(T('fund.longs'))} ${c ? usd(longOi) : '—'}, ${esc(T('fund.shorts'))} ${c ? usd(shortOi) : '—'}">
          <i class="fund-oi-long" style="transform:scaleX(${longShare == null ? 0.5 : longShare.toFixed(4)})"></i>
        </div>
        <div class="fund-oi-legend"><span><i class="dot long"></i>${esc(T('fund.longs'))} <b dir="ltr">${c ? usd(longOi) : '—'}</b>${longShare == null ? '' : ` · ${num(longShare * 100, 1)}%`}</span><span><i class="dot short"></i>${esc(T('fund.shorts'))} <b dir="ltr">${c ? usd(shortOi) : '—'}</b>${longShare == null ? '' : ` · ${num((1 - longShare) * 100, 1)}%`}</span></div>
      </div>
      <div class="fund-history">
        <div class="fund-controls">
          <div class="fund-group" role="group" aria-label="${esc(T('fund.range'))}">${ranges.map(r => chip('range', r, T('fund.r' + r), h && avail[r] === false, avail[r] === false ? fromNote : '')).join('')}</div>
          <div class="fund-group" role="group" aria-label="${esc(T('fund.interval'))}">${intervals.map(i => chip('interval', i, i, msOf[i] >= msOf[ST.range])).join('')}</div>
          <div class="fund-group" role="group" aria-label="${esc(T('fund.series'))}">${chip('series', 'long', T('fund.long'))}${chip('series', 'short', T('fund.short'))}</div>
          <label class="fund-toggle"><input type="checkbox" data-fund-annual${ST.annual ? ' checked' : ''}> ${esc(T('fund.annualized'))}</label>
        </div>
        <div class="fund-chart" id="fund-chart">${chartMarkup(h)}</div>
        <div class="fund-tip" id="fund-tip" role="status" aria-live="polite"></div>
      </div>
      <p class="fund-source">${esc(T('fund.source'))}${h ? ` · ${esc(T('fund.sampled'))}` : ''}</p>`;
  }

  function chartMarkup(h) {
    if (!h) return `<p class="fund-empty">${esc(T('fund.loading'))}</p>`;
    if (!h.available || !h.available[ST.range] || !h.points || !h.points.length) {
      return `<p class="fund-empty">${esc(h.availableFrom ? `${T('fund.availableFrom')} ${day(h.availableFrom)}.` : T('fund.noSamples'))}</p>`;
    }
    const pts = h.points.map(p => ({ t: Date.parse(p.t), v: Number(p[ST.series]) * (ST.annual ? HOURS_PER_YEAR : 1) * 100 })).filter(p => Number.isFinite(p.v));
    if (!pts.length) return `<p class="fund-empty">${esc(T('fund.noSamples'))}</p>`;
    const W = 640, H = 180, P = 8;
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
    let lo = Math.min(0, ...pts.map(p => p.v)), hi = Math.max(0, ...pts.map(p => p.v));
    if (hi === lo) { hi += 1e-9; lo -= 1e-9; }
    const x = t => P + ((t - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
    const y = v => P + (1 - (v - lo) / (hi - lo)) * (H - 2 * P);
    const zero = y(0).toFixed(1);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    const area = `${line}L${x(pts[pts.length - 1].t).toFixed(1)},${zero}L${x(t0).toFixed(1)},${zero}Z`;
    global.__ofFundingPts = pts.map(p => ({ ...p, x: x(p.t), y: y(p.v) }));
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(T('fund.chart'))}" focusable="false">
      <defs><clipPath id="fund-above"><rect x="0" y="0" width="${W}" height="${zero}"/></clipPath><clipPath id="fund-below"><rect x="0" y="${zero}" width="${W}" height="${H}"/></clipPath></defs>
      <path d="${area}" class="fund-area up" clip-path="url(#fund-above)"/><path d="${area}" class="fund-area down" clip-path="url(#fund-below)"/>
      <line x1="0" x2="${W}" y1="${zero}" y2="${zero}" class="fund-zero"/>
      <path d="${line}" class="fund-line up" clip-path="url(#fund-above)"/><path d="${line}" class="fund-line down" clip-path="url(#fund-below)"/>
      <line class="fund-cursor" id="fund-cursor" x1="0" x2="0" y1="0" y2="${H}" style="opacity:0"/>
    </svg>`;
  }

  function tip(clientX) {
    const svg = doc.querySelector('#fund-chart svg'), pts = global.__ofFundingPts || [];
    if (!svg || !pts.length) return;
    const r = svg.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * 640;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p.x - vx) < Math.abs(best.x - vx)) best = p;
    const cur = $('fund-cursor');
    if (cur) { cur.setAttribute('x1', best.x); cur.setAttribute('x2', best.x); cur.style.opacity = '1'; }
    const out = $('fund-tip');
    if (out) out.textContent = `${date(new Date(best.t).toISOString())} · ${T(ST.series === 'long' ? 'fund.long' : 'fund.short')} ${new Intl.NumberFormat(intl(), { maximumFractionDigits: ST.annual ? 2 : 5, signDisplay: 'exceptZero' }).format(best.v)}%${ST.annual ? ' ' + T('fund.perYear') : ' ' + T('fund.perHour')}`;
  }

  /* ---------------- Details ---------------- */
  async function loadDetails(force) {
    const m = symbol();
    if (!m) return;
    if (!force && ST.details && ST.details.market === m) return renderDetails();
    const seq = ++ST.seq;
    state($('details-state'), 'loading');
    try {
      const d = await get(`/markets/${dashed(m)}/details`);
      if (seq !== ST.seq) return;
      ST.details = d; state($('details-state'), 'ready');
    } catch (e) { if (seq === ST.seq) state($('details-state'), 'failed'); }
    renderDetails();
  }
  function renderDetails() {
    const host = $('details-host');
    if (!host) return;
    const d = ST.details;
    if (!d) { host.innerHTML = ''; return; }
    const s = d.spec || {}, lim = (d.accountLimits && d.accountLimits.prop) || {};
    const row = (k, v) => `<div class="det-row"><dt>${esc(T(k))}</dt><dd dir="ltr">${v}</dd></div>`;
    const lev = v => (v == null ? '—' : num(v, 1) + '×');
    const rate = v => (v == null ? '—' : new Intl.NumberFormat(intl(), { style: 'percent', maximumFractionDigits: 4 }).format(Number(v)));
    const finite = [lim.maxLeverage, s.maxLeverage].map(Number).filter(Number.isFinite)
    const effective = finite.length ? Math.min(...finite) : null
    host.innerHTML = `
      <section class="det-card" aria-labelledby="det-spec-h"><h3 id="det-spec-h">${esc(T('det.spec'))}</h3>
        <dl>${row('det.market', esc(s.symbol || d.market))}${row('det.status', esc(T(s.isOpen ? 'det.open' : 'det.closed')))}
          ${row('det.minLev', lev(s.minLeverage))}${row('det.maxLev', lev(s.maxLeverage))}
          ${row('det.minCollateral', usd(s.minCollateralUsd))}${row('det.minPosition', usd(s.minPositionUsd))}
          ${row('det.openFee', rate(s.openFeeRate))}${row('det.closeFee', rate(s.closeFeeRate))}${row('det.spread', rate(s.spreadRate))}
          ${row('det.collaterals', esc((s.collaterals || []).join(', ') || '—'))}${row('det.margin', esc(T(s.onlyIsolated ? 'det.isolated' : 'det.cross')))}</dl>
        <p class="fund-source">${esc(T('fund.source'))}</p></section>
      <section class="det-card" aria-labelledby="det-lim-h"><h3 id="det-lim-h">${esc(T('det.limits'))}</h3>
        ${product === 'prop' ? `<dl>${row('det.propMax', lev(lim.maxLeverage))}${row('det.effective', lev(effective))}</dl>
          <p class="det-note">${esc(T('det.planNote'))}</p>` : `<p class="det-note">${esc(T('det.perpNote'))}</p>`}
      </section>`;
  }

  /* ---------------- wiring ---------------- */
  doc.addEventListener('of:chart-tab', e => {
    ST.tab = e.detail && e.detail.tab;
    if (ST.tab === 'funding') loadFunding(false);
    if (ST.tab === 'details') loadDetails(false);
  });
  doc.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-fund-range],[data-fund-interval],[data-fund-series],[data-fund-retry]');
    if (!t || t.disabled) return;
    if (t.hasAttribute('data-fund-retry')) { if (t.closest('#details-panel')) loadDetails(true); else loadFunding(true); return; }
    if (t.dataset.fundRange) {
      ST.range = t.dataset.fundRange;
      const order = ['1h', '4h', '1d'], ms = { '1d': 864e5, '1w': 6048e5, '1m': 2592e6, '3m': 7776e6 }, ims = { '1h': 36e5, '4h': 144e5, '1d': 864e5 };
      if (ims[ST.interval] >= ms[ST.range]) ST.interval = order.find(i => ims[i] < ms[ST.range]) || '1h';
    }
    if (t.dataset.fundInterval) ST.interval = t.dataset.fundInterval;
    if (t.dataset.fundSeries) { ST.series = t.dataset.fundSeries; save(); return renderFunding(); }
    save(); loadFunding(false);
  });
  doc.addEventListener('change', e => { if (e.target.matches && e.target.matches('[data-fund-annual]')) { ST.annual = e.target.checked; save(); renderFunding(); } });
  doc.addEventListener('pointermove', e => { if (e.target.closest && e.target.closest('#fund-chart svg')) tip(e.clientX); });
  doc.addEventListener('focusin', e => { if (e.target.closest && e.target.closest('#fund-chart')) tip((doc.querySelector('#fund-chart svg') || {}).getBoundingClientRect ? doc.querySelector('#fund-chart svg').getBoundingClientRect().right - 1 : 0); });
  /* a market change refreshes the open panel */
  const pair = $('cur-pair');
  if (pair) new MutationObserver(() => { if (ST.tab === 'funding') loadFunding(true); else if (ST.tab === 'details') loadDetails(true); }).observe(pair, { childList: true, characterData: true, subtree: true });
  /* language change re-renders with the new dictionary */
  new MutationObserver(() => { renderFunding(); renderDetails(); }).observe(doc.documentElement, { attributes: true, attributeFilter: ['lang'] });
  global.OpenfundFunding = { state: () => ({ ...ST }), reload: () => { loadFunding(true); loadDetails(true); } };
})(window);
