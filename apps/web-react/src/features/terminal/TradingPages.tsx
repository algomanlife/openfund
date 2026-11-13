import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useSession } from "../../session/useOpenfundSession";
import { useAccount } from "wagmi";
import body from "../../pages/terminal-body.html?raw";
import workspaceStyles from "./workspace.css?raw";
import { setupWorkspaceLayout } from "./workspaceLayout";
import { fetchCmsTranslations } from "../../cms/client";
import { useTerminal } from "./TerminalContext";
import { api, type Product } from "./model";
import { currentLocale, dirOf, pick, type AppLocale } from "../../i18n/locales";

/** Product adapters share one rendering/interaction surface. Never construct
 * a local TradingProvider or invent a balance while account data is absent. */
function useAccountAdapter(product: Product, context: any) {
  const session = useSession(),
    snapshot = useRef<any>(null),
    [revision, setRevision] = useState(0);
  const status = useRef("signedout"),
    signed = session.status === "authenticated";
  /* Display-only wallet state for the signed-out empty state. 'checking'
     covers wagmi's reconnect and the session restore so the empty state
     never flashes before the connection is known. */
  const { status: walletStatus, isConnected } = useAccount();
  const walletState = useRef("checking");
  const nextWalletState =
    walletStatus === "reconnecting" || walletStatus === "connecting" ? "checking"
      : !isConnected ? "disconnected"
      : session.status === "anonymous" ? "checking" : "connected";
  useEffect(() => {
    if (walletState.current === nextWalletState) return;
    walletState.current = nextWalletState;
    window.dispatchEvent(new Event("of-trading-update"));
  }, [nextWalletState]);
  const owner = useRef<string | null>(null);
  useEffect(() => {
    /* a manual refresh (revision) must not blank the last snapshot; only a
       different product or user starts from an empty state */
    const identity = `${product}:${signed ? session.user?.id : "guest"}`;
    if (owner.current !== identity) {
      owner.current = identity;
      snapshot.current = null;
      status.current = signed ? "loading" : "signedout";
    }
    if (!signed || product === "prop") return;
    let active = true,
      loading = false;
    const load = async () => {
      if (loading) return;
      loading = true;
      try {
        const data = await api("perpetual", "/gains");
        if (active) {
          snapshot.current = data;
          status.current = "ready";
          window.dispatchEvent(new Event("of-trading-update"));
        }
      } catch {
        if (active) {
          /* keep the last valid snapshot on screen, flagged as possibly
             outdated; report an error only when there is nothing to show */
          status.current = snapshot.current ? "disconnected" : "error";
          window.dispatchEvent(new Event("of-trading-update"));
        }
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = setInterval(load, 15000);
    const refresh = () => void load();
    addEventListener("of-refresh-trading", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      removeEventListener("of-refresh-trading", refresh);
    };
  }, [product, signed, session.user?.id, revision]);
  return useMemo(
    () => ({
      readOnly: true,
      canTrade: false,
      serverMode: true,
      get walletState() {
        return walletState.current;
      },
      get status() {
        return product === "prop" && signed ? context?.accounts?.[0]?.type === "challenge" ? "unavailable" : "loading" : status.current;
      },
      get state() {
        const s = snapshot.current;
        return {
          positions: (s?.positions || []).map((p: any) => ({
            id: p.id,
            market: p.market,
            side: p.side,
            entry: Number(p.entry),
            size: null,
            margin: Number(p.margin),
            currency: p.currency,
            leverage: Number(p.leverage),
            sl: Number(p.sl) || null,
            tp: Number(p.tp) || null,
            liq: null,
            openedAt: null,
            feePaid: null,
          })),
          orders: (s?.orders || []).map((o: any) => ({
            id: o.id,
            market: o.market,
            side: o.side,
            type: o.type === 1 ? "limit" : "stop",
            size: null,
            trigger: Number(o.entry),
            createdAt: null,
          })),
          history: (s?.history || []).map((h: any) => ({
            id: h.key,
            market: h.market,
            side: h.side,
            size: null,
            price: h.price,
            time: Date.parse(h.date),
            type: h.action,
            result: h.action,
          })),
          fills: [],
          funding: [],
          notifications: [],
        };
      },
      getAccount() {
        const s = snapshot.current;
        return {
          equity: null,
          available: null,
          marginUsed: null,
          upnl: null,
          positionCount: s?.positions.length ?? null,
          orderCount: s?.orders.length ?? null,
        };
      },
      validate() {
        return [
          signed
            ? pick(currentLocale(), "این حساب امکان ثبت سفارش ندارد.", "This account cannot place orders.")
            : pick(currentLocale(), "برای ثبت سفارش وارد حساب شوید.", "Sign in to place an order."),
        ];
      },
      liqPrice() {
        return null;
      },
      subscribe() {
        return () => {};
      },
      checkTriggers() {},
      loadDemoScenario() {},
      getPosition(id: string) {
        return this.state.positions.find((p: any) => p.id === id);
      },
      refresh() {
        setRevision((x) => x + 1);
      },
    }),
    [product, signed, context?.accounts?.[0]?.type],
  );
}
const QUICK_TRADE_MARKUP = `
<div class="qt-bar" dir="ltr">
  <span class="qt-meta"><span class="qt-mode" id="qt-mode"></span><span class="qt-px" id="qt-px" aria-live="off"></span></span>
  <button type="button" class="qt-btn short" id="qt-sell" aria-expanded="false" aria-controls="qt-panel" data-i18n="qt.sell">Sell</button>
  <button type="button" class="qt-btn long" id="qt-buy" aria-expanded="false" aria-controls="qt-panel" data-i18n="qt.buy">Buy</button>
</div>
<div class="qt-panel" id="qt-panel" role="group" aria-labelledby="qt-title" hidden>
  <div class="qt-head">
    <b id="qt-title" class="qt-title"></b>
    <button type="button" class="qt-close" id="qt-close" aria-label="Close">×</button>
  </div>
  <label class="qt-field"><span data-i18n="qt.amount">Amount (USD)</span>
    <input id="qt-amount" type="text" inputmode="decimal" autocomplete="off" dir="ltr"></label>
  <div class="qt-chips" id="qt-chips" role="group">
    <button type="button" data-pct="25">25%</button><button type="button" data-pct="50">50%</button><button type="button" data-pct="100">100%</button>
  </div>
  <label class="qt-field"><span><span data-i18n="lev">Leverage</span> <b id="qt-lev-val" dir="ltr"></b></span>
    <input id="qt-lev" type="range" min="1" max="100" step="1" value="1"></label>
  <dl class="qt-stats">
    <div><dt data-i18n="ac.available">Available</dt><dd id="qt-avail" class="num">—</dd></div>
    <div><dt data-i18n="of.size">Size</dt><dd id="qt-size" class="num">—</dd></div>
    <div><dt data-i18n="rk.margin">Est. margin</dt><dd id="qt-margin" class="num">—</dd></div>
    <div><dt data-i18n="rk.fee">Est. fee (open)</dt><dd id="qt-fee" class="num">—</dd></div>
    <div><dt data-i18n="rk.liq">Est. liquidation</dt><dd id="qt-liq" class="num">—</dd></div>
  </dl>
  <p class="qt-note" id="qt-note" data-i18n="qt.note"></p>
  <p class="qt-err" id="qt-err" role="alert" hidden></p>
  <button type="button" class="submit long" id="qt-submit"></button>
</div>`;
function workspaceMarkup(locale: AppLocale) {
  const template = document.createElement("template");
  template.innerHTML = body;
  const compact = document.createElement("nav");
  compact.className = "workspace-views";
  compact.setAttribute("aria-label", pick(locale, 'نمایش‌های محیط کار', 'Workspace views'));
  compact.innerHTML = [
    ["chart", "نمودار", "Chart"], ["news", "اخبار و اطلاعات", "News"], ["book", "دفتر مجازی", "Book"],
    ["trade", "سفارش", "Order"], ["activity", "فعالیت حساب", "Activity"],
  ].map(([id, fa, en]) => `<button type="button" data-workspace-view="${id}" aria-pressed="${id === "chart"}" data-fa="${fa}" data-en="${en}">${en}</button>`).join("");
  template.content.querySelector(".workspace")?.before(compact);
  const marketDetails = document.createElement("details");
  marketDetails.className = "market-details";
  marketDetails.innerHTML = '<summary aria-label="More market statistics" data-fa="آمار بیشتر" data-en="More stats">More stats</summary><div class="market-details-content"></div>';
  template.content.querySelectorAll('.stat[data-k="vol"],.stat[data-k="oi"],.stat[data-k="funding"],.stat[data-k="lev"]').forEach(stat => {
    marketDetails.querySelector(".market-details-content")!.append(stat);
  });
  template.content.querySelector(".market-bar")?.append(marketDetails);
  const form = template.content.querySelector(".form-grid")!;
  const sizingTools = document.createElement("div");
  sizingTools.className = "sizing-tools";
  sizingTools.append(form.querySelector(".kv")!, form.querySelector(".pct-btns")!);
  form.querySelector(".sl")?.before(sizingTools);
  const risk = template.content.querySelector(".risk-box")!;
  const details = document.createElement("details");
  details.className = "order-details";
  details.innerHTML = '<summary><span data-fa="جزئیات سفارش" data-en="Order details">Order details</span><span aria-hidden="true">＋</span></summary><div class="order-details-content"></div>';
  const secondary = details.querySelector(".order-details-content")!;
  ["#rk-entry", "#rk-oracle", ".na"].forEach(selector => {
    const row = risk.querySelector(selector)?.closest(".kv");
    if (row) secondary.append(row);
  });
  risk.append(details);
  /* Quick Trade (Chart tab only; hidden by CSS in the Trading layout). Behaviour
     lives in legacy/terminal.js and calls the active account adapter. */
  const quick = document.createElement("div");
  quick.id = "qt-root";
  quick.className = "qt";
  /* Openfund trading UI placed over the chart: it keeps the page language and
     direction (the surrounding #chart-host is the English/LTR Vela layer) */
  quick.dataset.openfundUi = "";
  quick.lang = locale;
  quick.dir = locale === "fa" || locale === "ar" ? "rtl" : "ltr";
  quick.innerHTML = QUICK_TRADE_MARKUP;
  template.content.querySelector("#chart-host")?.append(quick);
  const feed = document.createElement('p'); feed.id = 'account-feed-state'; feed.setAttribute('role','status');
  template.content.querySelector('.trade-panel')?.prepend(feed);
  // Preserve legacy IDs used by event wiring, while removing obsolete customer copy.
  template.content.querySelector(".topnav")?.setAttribute("hidden", "");
  template.content
    .querySelectorAll(
      ".demo-banner,.dlg-warn,.hint,#load-demo,#assumptions-btn,#set-tick",
    )
    .forEach((el) => ((el as HTMLElement).style.display = "none"));
  template.content
    .querySelectorAll("#assumptions-dialog")
    .forEach((el) => el.remove());
  // Retain an empty dialog target for legacy event wiring; its trigger stays hidden.
  template.content.querySelector("#set-tick")?.closest("label")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "assumptions-dialog";
  template.content.appendChild(dialog);
  template.content.querySelectorAll("[title]").forEach((el) => {
    if (
      /demo|simulat|phase|simplified|later/i.test(
        el.getAttribute("title") || "",
      )
    )
      el.removeAttribute("title");
  });
  template.content
    .querySelectorAll(
      "#ac-equity,#ac-available,#ac-margin,#ac-upnl,#ac-pos,#ac-ord",
    )
    .forEach((el) => (el.textContent = "—"));
  template.content
    .querySelectorAll(".bt-empty .hint")
    .forEach((el) => el.remove());
  template.content.querySelector("#submit-order")?.setAttribute("disabled", "");
  const retry = document.createElement("button");
  retry.type = "button";
  retry.id = "account-retry";
  retry.className = "ghost-btn";
  retry.textContent = "↻";
  retry.setAttribute("aria-label", pick(locale, 'تازه‌سازی حساب', 'Refresh account'));
  retry.onclick = null;
  template.content.querySelector("#bt-empty")?.appendChild(retry);
  /* One shared signed-out empty state for every account tab; terminal.js
     shows it only once the wallet state is known (see renderBottom). */
  const walletEmpty = document.createElement("div");
  walletEmpty.id = "bt-wallet-empty";
  walletEmpty.className = "wallet-empty";
  walletEmpty.hidden = true;
  walletEmpty.innerHTML = '<img src="assets/wallet-empty.svg" width="240" height="160" alt="" decoding="async"><p id="bt-wallet-empty-text"></p><button type="button" id="bt-wallet-connect" class="wallet-empty-btn"></button>';
  template.content.querySelector("#bt-empty")?.after(walletEmpty);
  return template.innerHTML;
}

/** The only trading UI: same markup, chart, controls and viewport layout for
 * both routes. The product changes adapters/configuration, never the interface. */
export function SharedTradingTerminal() {
  const { product, locale, context } = useTerminal(),
    /* Trading and Chart are the same mounted workspace; only the layout differs */
    layout = useLocation().pathname.split("/").at(-1) === "chart" ? "chart" : "trade",
    bootLayout = useRef(layout),
    frame = useRef<HTMLIFrameElement>(null),
    adapter = useAccountAdapter(product, context),
    session = useSession(),
    [cms, setCms] = useState<any>(undefined);
  /* Chart workspace identity (legacy/chart-workspace.js): the signed-in
     session's user id, or null for a guest. It is published BEFORE the
     terminal document renders and is part of the iframe key, so login,
     logout and a wallet switch remount the chart with that identity's own
     workspace — one document never mixes two wallets' chart state. */
  const chartUser = session.status === "authenticated" && session.user?.id ? session.user.id : null;
  (window as any).__ofChartIdentity = { user: chartUser };
  useEffect(() => {
    let active = true;
    fetchCmsTranslations().then((x) => {
      if (active) setCms(x?.terminal || {});
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    (window as any).__ofReadOnlyProductAdapter = adapter;
    window.dispatchEvent(new Event("of-trading-update"));
    return () => {
      delete (window as any).__ofReadOnlyProductAdapter;
    };
  }, [adapter]);
  useEffect(() => {
    const events = ["of-trading-ready", "of-trading-update", "of-trading-off"];
    const forward = (e: Event) => {
      const w = frame.current?.contentWindow;
      if (w) w.dispatchEvent(new (w as any).Event(e.type));
    };
    events.forEach((e) => addEventListener(e, forward));
    return () => events.forEach((e) => removeEventListener(e, forward));
  }, []);
  useEffect(() => {
    const sync = () =>
      frame.current?.contentWindow?.postMessage(
        {
          type: "openfund-display",
          locale,
          theme: document.documentElement.dataset.theme,
        },
        location.origin,
      );
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, [locale, cms]);
  useEffect(() => {
    frame.current?.contentWindow?.postMessage({ type: "openfund-layout", layout }, location.origin);
  }, [layout]);
  /* The workspace document is built once per product; language changes are
     applied live through the openfund-display message. Rebuilding srcDoc on
     a locale change reloaded the whole iframe, dropping the chart, price
     socket and positions until everything reconnected. */
  const bootLocale = useRef(locale);
  const source = useMemo(() => {
    if (cms === undefined) return undefined;
    const locale = bootLocale.current;
    const safe = (x: any) => JSON.stringify(x).replaceAll("<", "\\u003c"),
      base = `${location.origin}${import.meta.env.BASE_URL}`;
    const translations = {
      ...cms,
      "book.grouping": {fa:"گروه",en:"Group"},
      "book.tab": {fa:"دفتر مجازی",en:"Book"},
      "book.simulated": {fa:"Gains VOB",en:"Gains VOB"},
      "book.note": {fa:"نقدینگی مجازی Gains؛ دفتر سفارش متمرکز نیست.",en:"Gains virtual execution liquidity; no resting orders."},
      "trades.note": {fa:"معاملات اجراشدهٔ Gains · اندازه به USD",en:"Gains executed trades · size in USD"},
      "ac.modeVal": {
        fa: product === "prop" ? "حساب تمرینی" : "پرپچوال",
        en: product === "prop" ? "Practice account" : "Perpetual",
      },
      "rk.maxloss": { fa: "برآورد سود و زیان در SL", en: "Est. PnL at SL" },
      demoBanner: { fa: "", en: "" },
      "bt.empty": {
        fa: "فعالیت معاملاتی برای نمایش وجود ندارد.",
        en: "No trading activity to display.",
      },
      "empty.positions": {
        fa: "پوزیشن بازی وجود ندارد.",
        en: "No open positions.",
      },
      "bt.hint": { fa: "", en: "" },
      "dlg.confirmOrder": { fa: "تأیید سفارش", en: "Confirm order" },
      "rv.exec": { fa: "حساب تمرینی", en: "Practice account" },
      "notif.empty": { fa: "اعلانی وجود ندارد.", en: "No notifications." },
      "toast.position": { fa: "پوزیشن باز شد.", en: "Position opened." },
      "toast.order": { fa: "سفارش ثبت شد.", en: "Order submitted." },
      "cf.closeTxt": { fa: "این پوزیشن بسته شود؟", en: "Close this position?" },
      "cf.cancelTxt": { fa: "این سفارش لغو شود؟", en: "Cancel this order?" },
    };
    /* boot data travels through a NON-EXECUTABLE JSON island; the boot
       logic itself is the external legacy/react-boot.js so the strict
       script-src 'self' CSP holds for the whole terminal */
    const bootData = safe({ locale, product, translations });
    return `<!doctype html><html lang="${locale}" dir="${dirOf(locale)}" data-theme="${document.documentElement.dataset.theme || "dark"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><style>html{color-scheme:only dark}html[data-theme="light"]{color-scheme:only light}</style><base href="${base}"><link rel="stylesheet" href="legacy/terminal.css"><style>${workspaceStyles}</style></head><body data-layout="${bootLayout.current}"><script type="application/json" id="of-boot-data">${bootData}</script>${workspaceMarkup(locale)}<script src="legacy/react-boot.js"></script>${["legacy/gains-adapter.js", "legacy/chart-workspace.js", "assets/vela-workspace.global.min.js", "legacy/vela-bridge.js", "legacy/terminal-data.js", "legacy/market-depth.js", "legacy/share-card.js", "legacy/terminal-locales.js", "legacy/numeric-input.js", "legacy/position-overlay.js", "legacy/prop-leverage.js", "legacy/position-sizing.js", "legacy/terminal.js"].map((src) => `<script src="${src}"></script>`).join("")}</body></html>`;
  }, [cms, product, locale]);
  return (
    <>
      <iframe
        key={`${product}:${chartUser || "guest"}`}
        ref={frame}
        className="of-trading-workspace"
        title={pick(locale, "فضای معاملات", "Trading workspace")}
        srcDoc={source}
        onLoad={() => {
          const w = frame.current?.contentWindow;
          w?.postMessage({type: "openfund-display", locale, theme: document.documentElement.dataset.theme || "dark"}, location.origin);
          w?.postMessage({type: "openfund-layout", layout}, location.origin);
          if (frame.current?.contentDocument) setupWorkspaceLayout(frame.current.contentDocument);
          if (w) w.dispatchEvent(new (w as any).Event("of-trading-ready"));
        }}
      />
    </>
  );
}
