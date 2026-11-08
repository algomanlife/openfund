/* ============================================================
   OPENFUND TERMINAL \u2014 branded P&L share card
   The preview IS the export: the card is drawn once on a canvas that is
   both shown in the dialog and encoded to PNG, so the downloaded or
   shared image always matches what the trader sees.
   Every value comes from the terminal's authoritative position data via
   the model getter; nothing is computed or simulated here. Account ids,
   position ids and wallet details are never part of the model.
   ============================================================ */
(function (global) {
  'use strict';
  var W = 1080, H = 1350, SCALE = 1.5;
  var C = {
    bg: '#060808', surface: '#0A100D', line: 'rgba(255,255,255,0.10)', mint: '#82E7BD',
    white: '#F7F8F4', body: '#CBD4CE', muted: '#98A8A0', pos: '#82E7BD', neg: '#E89483'
  };
  var FONT = "Ubuntu, Irancell, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif";
  var dialog = null, canvas = null, ctx = null, getModel = null, model = null, logo = null, logoReady = false;
  var labels = {};

  function $(id) { return document.getElementById(id); }
  function font(weight, size) { return weight + ' ' + size + 'px ' + FONT; }

  function loadLogo() {
    if (logo) return;
    logo = new Image();
    logo.onload = function () { logoReady = true; draw(); };
    logo.src = 'assets/mark-mint.svg';
  }

  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.id = 'share-dialog';
    dialog.className = 'dlg share-dlg';
    dialog.innerHTML =
      '<h2 id="share-title"></h2>' +
      '<div class="share-preview"><canvas id="share-canvas" role="img"></canvas></div>' +
      '<p id="share-status" class="share-status" role="status" aria-live="polite"></p>' +
      '<div class="dlg-actions share-actions">' +
      '<button type="button" class="ghost-btn" id="share-close"></button>' +
      '<button type="button" class="ghost-btn" id="share-native" hidden></button>' +
      '<button type="button" class="submit long" id="share-download"></button>' +
      '</div>';
    document.body.appendChild(dialog);
    canvas = $('share-canvas');
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    ctx = canvas.getContext('2d');
    $('share-close').addEventListener('click', function () { dialog.close(); });
    $('share-download').addEventListener('click', download);
    $('share-native').addEventListener('click', nativeShare);
    dialog.addEventListener('close', function () { getModel = null; model = null; });
  }

  /* ---------- drawing helpers (centered layout, direction-aware) ---------- */
  function rtl() { return !!(model && model.rtl); }
  function isAscii(s) { return /^[\x00-\x7F\u00d7\u2212\u2192\u2190\u00b7\u2066\u2069]*$/.test(s); }
  function measure(str, f) { ctx.font = f; ctx.direction = isAscii(str) ? 'ltr' : (rtl() ? 'rtl' : 'ltr'); return ctx.measureText(str).width; }
  /* draws str centred on cx (or left-aligned at x when align='left') */
  function text(str, x, y, f, color, align) {
    if (!str) return 0;
    ctx.font = f; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
    ctx.direction = isAscii(str) ? 'ltr' : (rtl() ? 'rtl' : 'ltr');
    ctx.textAlign = align || 'center';
    ctx.fillText(str, x, y);
    return ctx.measureText(str).width;
  }
  function roundRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }
  /* a centred row of chips; RTL locales read the row right-to-left */
  function chipRow(items, cy) {
    var f = font(700, 30), pad = 22, gap = 18, h = 56;
    var ws = items.map(function (it) { return it.plain ? measure(it.text, f) : measure(it.text, f) + pad * 2; });
    var total = ws.reduce(function (a, b) { return a + b; }, 0) + gap * (items.length - 1);
    var order = items.map(function (_, i) { return i; });
    if (rtl()) order.reverse();
    var x = (W - total) / 2;
    order.forEach(function (i) {
      var it = items[i], w = ws[i];
      if (!it.plain) roundRect(x, cy - h / 2, w, h, 10, it.fill || 'rgba(255,255,255,0.06)', it.stroke || null);
      text(it.text, x + w / 2, cy + 11, f, it.color || C.white);
      x += w + gap;
    });
  }
  function corners() {
    var m = 36, l = 54;
    ctx.strokeStyle = 'rgba(247,248,244,0.55)'; ctx.lineWidth = 4; ctx.lineCap = 'square';
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(function (c) {
      ctx.beginPath(); ctx.moveTo(c[0], c[1] + c[3] * l); ctx.lineTo(c[0], c[1]); ctx.lineTo(c[0] + c[2] * l, c[1]); ctx.stroke();
    });
  }
  function background() {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    /* Openfund atmosphere: a mint horizon glow behind the brand mark */
    var g = ctx.createRadialGradient(W / 2, -260, 200, W / 2, -260, 900);
    g.addColorStop(0, 'rgba(130,231,189,0.30)'); g.addColorStop(0.55, 'rgba(130,231,189,0.08)'); g.addColorStop(1, 'rgba(130,231,189,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(130,231,189,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(W / 2, -380, 900, 640, 0, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke();
    var g2 = ctx.createRadialGradient(W / 2, H + 120, 40, W / 2, H + 120, 700);
    g2.addColorStop(0, 'rgba(130,231,189,0.10)'); g2.addColorStop(1, 'rgba(130,231,189,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (var y = 300; y < H - 60; y += 46) for (var x = 70; x < W - 60; x += 46) ctx.fillRect(x, y, 2, 2);
  }

  function draw() {
    if (!ctx || !model) return;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.clearRect(0, 0, W, H);
    background();
    corners();
    var m = model, cx = W / 2, pnlColor = m.pnl == null ? C.white : m.pnl >= 0 ? C.pos : C.neg;

    /* brand: Openfund mark + wordmark */
    var wf = font(700, 52), ww = measure('openfund', wf), lw = 52, lh = 58, gap = 20;
    var bx = cx - (lw + gap + ww) / 2;
    if (logoReady) ctx.drawImage(logo, bx, 222, lw, lh); else roundRect(bx, 222, lw, lh, 10, C.mint);
    text('openfund', bx + lw + gap, 270, wf, C.white, 'left');
    text(m.productLabel, cx, 330, font(700, 22), C.muted);

    /* result */
    text(m.resultLabel, cx, 520, font(700, 44), C.white);
    text(m.pnlText, cx, 660, font(700, 150), pnlColor);
    var sub = [m.roiText ? '\u2066' + m.roiText + '\u2069' : '', m.pnlLabel].filter(Boolean).join('  \u00b7  ');
    text(sub, cx, 730, font(400, 30), m.roiText ? pnlColor : C.muted);

    /* instrument chips: side · size · symbol · leverage */
    var chips = [{ text: m.sideLabel, fill: m.long ? C.pos : C.neg, color: C.bg }];
    if (m.sizeText) chips.push({ text: m.sizeText, plain: true, color: C.white });
    chips.push({ text: m.symbol, plain: true, color: C.white });
    if (m.leverageLabel) chips.push({ text: m.leverageLabel, plain: true, color: C.white });
    chipRow(chips, 830);
    var meta = [m.instrument, m.statusLabel].filter(Boolean).join('  \u00b7  ');
    text(meta, cx, 905, font(400, 26), C.muted);

    /* open → close / current */
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(140, 1010, W - 280, 1);
    var iso = function (v) { return '\u2066@' + v + '\u2069'; };
    var left = { label: m.openLabel + ' ' + iso(m.openPrice), time: m.openTime },
        right = { label: m.endLabel + ' ' + iso(m.endPrice), time: m.endTime };
    var a = rtl() ? right : left, b = rtl() ? left : right;
    var ax = W * 0.28, bx2 = W * 0.72;
    text(a.label, ax, 1110, font(700, 34), C.white);
    text(a.time, ax, 1158, font(400, 24), C.muted);
    text(rtl() ? '\u2190' : '\u2192', cx, 1112, font(700, 36), C.muted);
    text(b.label, bx2, 1110, font(700, 34), C.white);
    text(b.time, bx2, 1158, font(400, 24), C.muted);

    /* footer: feed state for open positions, generation time */
    if (m.feedLabel) {
      var ff = font(700, 24), fw = measure(m.feedLabel, ff), dotX = cx - fw / 2 - 18;
      ctx.fillStyle = m.stale ? C.neg : C.mint;
      ctx.beginPath(); ctx.arc(rtl() ? cx + fw / 2 + 18 : dotX, 1238, 8, 0, Math.PI * 2); ctx.fill();
      text(m.feedLabel, cx, 1246, ff, m.stale ? C.neg : C.mint);
    }
    text(m.generatedText, cx, 1290, font(400, 22), C.muted);
    canvas.setAttribute('aria-label', [m.symbol, m.sideLabel, m.leverageLabel, m.resultLabel, m.pnlText, m.roiText].filter(Boolean).join(' \u00b7 '));
  }

  function setStatus(msg) { var el = $('share-status'); if (el) el.textContent = msg || ''; }

  function fileName() {
    var sym = String(model && model.symbol || 'position').replace(/[^A-Za-z0-9]+/g, '-');
    return 'openfund-' + sym + '-' + (model && model.status || 'pnl') + '.png';
  }
  function toBlob() {
    return new Promise(function (resolve, reject) {
      draw();
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('encode')); }, 'image/png');
    });
  }
  function download() {
    toBlob().then(function (blob) {
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = fileName(); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      setStatus(labels.saved);
    }).catch(function () { setStatus(labels.failed); });
  }
  function canShareFiles() {
    try {
      return !!(navigator.share && navigator.canShare &&
        navigator.canShare({ files: [new File([new Blob([''], { type: 'image/png' })], 'x.png', { type: 'image/png' })] }));
    } catch (e) { return false; }
  }
  function nativeShare() {
    toBlob().then(function (blob) {
      var file = new File([blob], fileName(), { type: 'image/png' });
      return navigator.share({ files: [file], title: 'Openfund \u00b7 ' + model.symbol });
    }).catch(function (e) { if (!e || e.name !== 'AbortError') setStatus(labels.failed); });
  }

  /* Re-reads the model from the terminal. Called on every terminal data
     update while the preview is open, so open-position P&L stays live;
     closed positions return their recorded final values unchanged. */
  function refresh() {
    if (!getModel || !dialog || !dialog.open) return;
    var next = null;
    try { next = getModel(); } catch (e) { next = null; }
    if (next) model = next;
    else if (model && model.status === 'open' && !model.gone) {
      /* the position closed while previewing: keep the last shown values,
         clearly marked as no longer live */
      model = Object.assign({}, model, { gone: true, stale: true, feedLabel: labels.gone || model.feedLabel });
    }
    draw();
  }

  function open(getter, ui) {
    labels = ui || {};
    ensureDialog();
    loadLogo();
    getModel = getter;
    model = null;
    try { model = getter(); } catch (e) { model = null; }
    if (!model) return false;
    $('share-title').textContent = labels.title || 'Share P&L';
    $('share-close').textContent = labels.close || 'Close';
    $('share-download').textContent = labels.download || 'Download PNG';
    var nativeBtn = $('share-native');
    nativeBtn.textContent = labels.share || 'Share';
    nativeBtn.hidden = !canShareFiles();
    setStatus(model.status === 'open' ? labels.liveNote : labels.finalNote);
    var ready = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load(font(700, 40)), document.fonts.load(font(400, 20))]).catch(function () {})
      : Promise.resolve();
    draw();
    ready.then(draw);
    if (!dialog.open) dialog.showModal();
    return true;
  }

  global.OpenfundShareCard = { open: open, refresh: refresh, isOpen: function () { return !!(dialog && dialog.open); } };
})(window);
