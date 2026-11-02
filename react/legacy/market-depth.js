/** Public Gains VOB and executed trades. Never derive liquidity or prints from marks. */
(() => {
  const $ = (id) => document.getElementById(id),
    fa = () => window.ofLang === "fa",
    L = (a, b) => (fa() ? a : b);
  const api = "https://api.gains.trade/v1/arbitrum",
    wsUrl = "wss://api.gains.trade/v1/arbitrum/ws";
  const valid = (v) =>
    v != null && Number.isFinite(Number(v)) && Number(v) >= 0;
  let symbol = "",
    book = null,
    trades = [],
    socket = null,
    seq = null,
    generation = 0,
    stopped = false,
    retry,
    controller,
    received = 0,
    lastBookTimestamp = 0;
  const denomination = document.createElement("select");
  denomination.id = "book-denomination";
  denomination.setAttribute("aria-label", "Depth denomination");
  for (const value of ["USD", "Base"]) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = value;
    denomination.append(o);
  }
  denomination.value = "Base";
  document.querySelector(".book-controls")?.append(denomination);
  const note = document.createElement("p");
  note.id = "depth-feed-status";
  note.setAttribute("role", "status");
  document.querySelector(".book-panel")?.append(note);
  const fmt = (v) =>
    Number(v).toLocaleString("en-US", {
      maximumFractionDigits: Math.min(
        10,
        Number($("book-group")?.value) === 1
          ? 6
          : Number($("book-group")?.value) === 10
            ? 3
            : 1,
      ),
    });
  function unavailable(host, text) {
    if (host) {
      host.replaceChildren();
      const p = document.createElement("p");
      p.className = "depth-unavailable";
      p.textContent = text;
      host.append(p);
    }
  }
  function renderBook() {
    if (!book) {
      unavailable(
        $("book-asks"),
        L("عمق بازار در دسترس نیست.", "Market depth unavailable."),
      );
      $("book-bids")?.replaceChildren();
      $("book-mid-price").textContent = "—";
      $("book-spread").textContent = "—";
      return;
    }
    const usd = denomination.value === "USD",
      max = Math.max(
        1,
        ...book.asks.concat(book.bids).map((r) => Number(r.cumulativeUsd)),
      );
    const levels = (side) => {
      let sum = 0;
      return book[side].map((r) => ({
        ...r,
        cumulativeBase: (sum += Number(r.size)),
      }));
    };
    const renderSide = (host, rows, side) => {
      while (host.children.length > rows.length) host.lastElementChild.remove();
      rows.forEach((r, i) => {
        let el = host.children[i];
        if (!el || !el.classList.contains("bk-row")) {
          el = document.createElement("div");
          el.className = "bk-row " + side;
          const bar = document.createElement("i");
          bar.className = "depth";
          el.append(bar);
          for (let k = 0; k < 3; k++) {
            const span = document.createElement("span");
            span.className = "num";
            el.append(span);
          }
          if (host.children[i]) host.children[i].replaceWith(el);
          else host.append(el);
        }
        el.querySelector(".depth").style.width =
          `${(Number(r.cumulativeUsd) / max) * 100}%`;
        const values = [
          r.price,
          usd ? r.sizeUsd : r.size,
          usd ? r.cumulativeUsd : r.cumulativeBase,
        ];
        el.querySelectorAll("span").forEach((span, k) => {
          const next = fmt(values[k]);
          if (span.textContent !== next) span.textContent = next;
        });
      });
    };
    renderSide($("book-asks"), levels("asks").reverse(), "a");
    renderSide($("book-bids"), levels("bids"), "b");
    $("book-asks").scrollTop = $("book-asks").scrollHeight;
    const cols = document.querySelectorAll("#book-view .book-cols span");
    if (cols.length === 3) {
      cols[0].textContent = `${L("قیمت", "Price")} ${symbol.split("/")[1]}`;
      cols[1].textContent = `${L("اندازه", "Size")} ${usd ? "USD" : symbol.split("/")[0]}`;
      cols[2].textContent = `${L("جمع", "Total")} ${usd ? "USD" : symbol.split("/")[0]}`;
    }
    $("book-mid-price").textContent = fmt(book.markPrice);
    const spread =
      book.asks.length && book.bids.length
        ? Number(book.asks[0].price) - Number(book.bids[0].price)
        : null;
    $("book-spread").textContent =
      spread === null ? "—" : `${L("اسپرد", "Spread")} ${fmt(spread)}`;
  }
  function renderTrades() {
    const host = $("trades-list");
    if (!host) return;
    if (!trades.length) {
      unavailable(
        host,
        L(
          "معامله‌ای از منبع دریافت نشده است.",
          "No executed trades received from the provider.",
        ),
      );
      return;
    }
    host.replaceChildren(
      ...trades.map((t) => {
        const row = document.createElement("div");
        row.className = "tr-row " + (t.side === "long" ? "buy" : "sell");
        row.title = `${t.side} · ${t.action} · ${t.txHash}`;
        for (const v of [
          fmt(t.price),
          fmt(t.sizeUsd),
          new Date(t.timestamp).toLocaleTimeString("en-GB", { hour12: false }),
        ]) {
          const el = document.createElement("span");
          el.textContent = v;
          row.append(el);
        }
        return row;
      }),
    );
  }
  function acceptBook(b) {
    if (
      !b ||
      b.market !== symbol ||
      !valid(b.markPrice) ||
      Number(b.markPrice) <= 0 ||
      !Number.isFinite(b.timestamp) ||
      b.timestamp < lastBookTimestamp ||
      b.timestamp > Date.now() + 1000 ||
      Date.now() - b.timestamp > 15000 ||
      !Array.isArray(b.asks) ||
      !Array.isArray(b.bids)
    )
      return false;
    if (
      b.asks
        .concat(b.bids)
        .some(
          (r) =>
            !["price", "size", "sizeUsd", "cumulativeUsd"].every((k) =>
              valid(r[k]),
            ) || Number(r.price) <= 0,
        )
    )
      return false;
    book = b;
    lastBookTimestamp = b.timestamp;
    received = Date.now();
    note.textContent = L(
      "Gains VOB · نقدینگی مجازی مبتنی بر مخزن",
      "Gains VOB · vault-based virtual liquidity",
    );
    renderBook();
    return true;
  }
  function acceptTrades(rows, snapshot) {
    if (!Array.isArray(rows)) return;
    const validRows = rows.filter(
      (t) =>
        t && typeof t === "object" && t.market === symbol &&
        valid(t.price) &&
        Number(t.price) > 0 &&
        valid(t.sizeUsd) &&
        ["long", "short"].includes(t.side) &&
        Number.isFinite(t.timestamp) &&
        t.timestamp <= Date.now() + 1000 &&
        /^0x[0-9a-f]{64}$/i.test(t.txHash),
    );
    const all = snapshot ? validRows : validRows.concat(trades),
      seen = new Set();
    trades = all
      .filter((t) => {
        const k = `${t.txHash}:${t.action}:${t.timestamp}:${t.sizeUsd}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);
    renderTrades();
  }
  function connect(g) {
    if (stopped || g !== generation) return;
    const ws = new WebSocket(wsUrl);
    socket = ws;
    ws.onopen = () => {
      if (g !== generation) {
        ws.close();
        return;
      }
      seq = null;
      for (const channel of ["book", "trades"])
        ws.send(JSON.stringify({ op: "subscribe", channel, market: symbol }));
    };
    ws.onmessage = (e) => {
      if (g !== generation) return;
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.op === "ping") {
        ws.send(JSON.stringify({ op: "pong" }));
        return;
      }
      if (m.market && m.market !== symbol) return;
      if (m.channel === "book") {
        if (
          !m.snapshot &&
          seq !== null &&
          Number.isFinite(m.seq) &&
          m.seq !== seq + 1
        ) {
          book = null;
          renderBook();
          seq = null;
          ws.send(
            JSON.stringify({
              op: "unsubscribe",
              channel: "book",
              market: symbol,
            }),
          );
          ws.send(
            JSON.stringify({
              op: "subscribe",
              channel: "book",
              market: symbol,
            }),
          );
          return;
        }
        if (Number.isFinite(m.seq)) seq = m.seq;
        acceptBook(m.data && {...m.data, market:m.data.market || m.market});
      } else if (m.channel === "trades")
        acceptTrades(Array.isArray(m.data) ? m.data : [m.data], !!m.snapshot);
    };
    ws.onclose = () => {
      if (g === generation && !stopped) {
        book = null;
        renderBook();
        note.textContent = L(
          "ارتباط قطع شد؛ اتصال دوباره…",
          "Disconnected; reconnecting…",
        );
        retry = setTimeout(() => connect(g), 2500);
      }
    };
    ws.onerror = () => ws.close();
  }
  async function select(next) {
    if (next === symbol) return;
    symbol = next;
    const g = ++generation;
    clearTimeout(retry);
    controller?.abort();
    socket?.close();
    controller = new AbortController();
    book = null;
    trades = [];
    seq = null;
    lastBookTimestamp = 0;
    renderBook();
    renderTrades();
    note.textContent = L("در حال اتصال به Gains…", "Connecting to Gains…");
    const base = `${api}/markets/${encodeURIComponent(symbol)}`;
    const reads = await Promise.allSettled([
      fetch(base + "/book?levels=15", { signal: controller.signal }).then(
        (r) => {
          if (!r.ok) throw Error();
          return r.json();
        },
      ),
      fetch(base + "/trades?limit=50", { signal: controller.signal }).then(
        (r) => {
          if (!r.ok) throw Error();
          return r.json();
        },
      ),
    ]);
    if (g !== generation || stopped) return;
    if (reads[0].status === "fulfilled") acceptBook(reads[0].value);
    if (reads[1].status === "fulfilled")
      acceptTrades(reads[1].value.data, true);
    if (!book)
      note.textContent = L(
        "دادهٔ عمق Gains در دسترس نیست.",
        "Gains depth unavailable.",
      );
    connect(g);
  }
  denomination.addEventListener("change", renderBook);
  $("book-group")?.addEventListener("change", renderBook);
  const stale = setInterval(() => {
    if (book && Date.now() - received > 15000) {
      book = null;
      renderBook();
      note.textContent = L("دادهٔ عمق قدیمی است.", "Depth data is stale.");
    }
  }, 3000);
  addEventListener(
    "pagehide",
    () => {
      stopped = true;
      generation++;
      clearInterval(stale);
      clearTimeout(retry);
      controller?.abort();
      socket?.close();
    },
    { once: true },
  );
  window.OpenfundDepth = { select, renderBook, renderTrades };
})();
