import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../../session/useOpenfundSession";
import body from "../../pages/terminal-body.html?raw";
import workspaceStyles from "./workspace.css?raw";
import { setupWorkspaceLayout } from "./workspaceLayout";
import { fetchCmsTranslations } from "../../cms/client";
import { useTerminal } from "./TerminalContext";
import { api, type Product } from "./model";

/** Product adapters share one rendering/interaction surface. Never construct
 * a local TradingProvider or invent a balance while account data is absent. */
function useAccountAdapter(product: Product) {
  const session = useSession(),
    snapshot = useRef<any>(null),
    [revision, setRevision] = useState(0);
  const status = useRef("signedout"),
    signed = session.status === "authenticated";
  useEffect(() => {
    snapshot.current = null;
    status.current = signed ? "loading" : "signedout";
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
          status.current = "error";
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
      get status() {
        return product === "prop" && signed ? "loading" : status.current;
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
          (window as any).ofLang === "fa"
            ? signed
              ? "این حساب امکان ثبت سفارش ندارد."
              : "برای ثبت سفارش وارد حساب شوید."
            : signed
              ? "This account cannot place orders."
              : "Sign in to place an order.",
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
    [product, signed],
  );
}
function workspaceMarkup() {
  const template = document.createElement("template");
  template.innerHTML = body;
  const compact = document.createElement("nav");
  compact.className = "workspace-views";
  compact.setAttribute("aria-label", "Workspace views");
  compact.innerHTML = [
    ["chart", "نمودار", "Chart"], ["book", "دفتر مجازی", "Book"],
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
  const retry = document.createElement("button");
  retry.type = "button";
  retry.id = "account-retry";
  retry.className = "ghost-btn";
  retry.textContent = "↻";
  retry.setAttribute("aria-label", "Refresh account");
  retry.onclick = null;
  template.content.querySelector("#bt-empty")?.appendChild(retry);
  return template.innerHTML;
}

/** The only trading UI: same markup, chart, controls and viewport layout for
 * both routes. The product changes adapters/configuration, never the interface. */
export function SharedTradingTerminal() {
  const { product, locale, context } = useTerminal(),
    frame = useRef<HTMLIFrameElement>(null),
    adapter = useAccountAdapter(product),
    [cms, setCms] = useState<any>(undefined);
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
  const source = useMemo(() => {
    if (cms === undefined) return undefined;
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
    const boot = `window.ofLang=${safe(locale)};window.ofCmsTerminal=${safe(translations)};window.__ofTerminalConfig={product:${safe(product)},syntheticMarketData:false};Object.defineProperty(window,'__ofProductAdapter',{get:()=>${product === "prop" ? "parent.__ofServerTP || " : ""}parent.__ofReadOnlyProductAdapter});Object.defineProperty(window,'__ofServerTP',{get:()=>${product === "prop" ? "parent.__ofServerTP" : "undefined"}});addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='openfund-display')return;document.documentElement.dataset.theme=e.data.theme;if(window.ofLang!==e.data.locale)document.getElementById('language-toggle')?.click()});document.getElementById('account-retry').onclick=()=>parent.dispatchEvent(new parent.Event('of-refresh-trading'));`;
    return `<!doctype html><html lang="${locale}" dir="${locale === "fa" ? "rtl" : "ltr"}" data-theme="${document.documentElement.dataset.theme || "dark"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${base}"><link rel="stylesheet" href="legacy/terminal.css"><style>${workspaceStyles}</style></head><body>${workspaceMarkup()}<script>${boot}</script>${["legacy/gains-adapter.js", "assets/vela-workspace.global.min.js", "legacy/vela-bridge.js", "legacy/terminal-data.js", "legacy/market-depth.js", "legacy/terminal.js"].map((src) => `<script src="${src}"></script>`).join("")}</body></html>`;
  }, [cms, product, locale]);
  return (
    <>
      <iframe
        key={product}
        ref={frame}
        className="of-trading-workspace"
        title={locale === "fa" ? "فضای معاملات" : "Trading workspace"}
        srcDoc={source}
        onLoad={() => {
          const w = frame.current?.contentWindow;
          if (frame.current?.contentDocument) setupWorkspaceLayout(frame.current.contentDocument);
          if (w) w.dispatchEvent(new (w as any).Event("of-trading-ready"));
        }}
      />
    </>
  );
}
