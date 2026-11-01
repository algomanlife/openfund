import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../../session/useOpenfundSession";
import { TradingBridge } from "../../trading/TradingBridge";
import body from "../../pages/terminal-body.html?raw";
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
  // Preserve legacy IDs used by event wiring, while removing obsolete customer copy.
  template.content.querySelector(".topnav")?.setAttribute("hidden", "");
  template.content
    .querySelectorAll(
      ".demo-banner,.dlg-warn,.book-src,.book-note,.hint,#load-demo,#assumptions-btn,#set-tick",
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
    return `<!doctype html><html lang="${locale}" dir="${locale === "fa" ? "rtl" : "ltr"}" data-theme="${document.documentElement.dataset.theme || "dark"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${base}"><link rel="stylesheet" href="legacy/terminal.css"><style>.topnav,.demo-banner,.dlg-warn,#load-demo,#assumptions-btn,.book-src,.bt-empty .hint{display:none!important}body{display:grid;grid-template-rows:auto minmax(0,1fr) auto;height:100dvh;overflow:hidden}.workspace{height:auto!important;min-height:0}.book-panel .panel-tabs,.book-tools,.book-controls,.book-cols,.book-note,#trades-view{display:none!important}.book-panel{overflow:auto}#book-view{display:flex;flex:1;min-height:0;flex-direction:column}#book-asks{overflow:auto;flex:1}#book-bids{display:none}.live-market-row{display:flex;width:100%;justify-content:space-between;padding:10px;border:0;border-bottom:1px solid var(--line);background:transparent;text-align:start}.live-market-row.active{color:var(--mint)}.live-market-row:hover{background:var(--surface-2)}@media(max-width:1080px){.workspace{overflow:auto;display:flex;flex-direction:column}.chart-panel{flex:none;height:52dvh;min-height:220px}.book-panel{flex:none;max-height:220px}.trade-panel{flex:none;max-height:none;overflow:visible}.bottom-panel{flex:none;min-height:260px}.market-stats{overflow:auto;max-height:90px}.status-bar{overflow:hidden;min-height:25px}}</style></head><body>${workspaceMarkup()}<script>${boot}</script>${["legacy/gains-adapter.js", "assets/vela-workspace.global.min.js", "legacy/vela-bridge.js", "legacy/terminal-data.js", "legacy/terminal.js"].map((src) => `<script src="${src}"></script>`).join("")}</body></html>`;
  }, [cms, product, locale]);
  return (
    <>
      {product === "prop" && <TradingBridge pricing={context?.pricing} />}
      <iframe
        key={product}
        ref={frame}
        className="of-trading-workspace"
        title={locale === "fa" ? "فضای معاملات" : "Trading workspace"}
        srcDoc={source}
        onLoad={() => {
          const w = frame.current?.contentWindow;
          if (w) w.dispatchEvent(new (w as any).Event("of-trading-ready"));
        }}
      />
    </>
  );
}
