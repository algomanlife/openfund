import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createSiweMessage } from "viem/siwe";
import { getAddress, stringToHex } from "viem";
import { acceptSnapshot, retryDelay } from "../electron/policy.mjs";
import {
  canSimulateTrade,
  perpetualAccount,
  perpetualSnapshotFor,
  propAccounts,
  restoreSelection,
  walletErrorCode,
} from "./desktop-model.mjs";
import {
  LOCALES,
  LOCALE_KEY,
  LOCALE_NAMES,
  applyLocale,
  format,
  initialLocale,
  intlLocale,
  translator,
  untranslated,
  type AppLocale,
  type Translate,
} from "./i18n";
import {
  arbiscanTx,
  feedSeverity,
  gainsFeedState,
  snapshotTime,
} from "../../web-react/src/features/terminal/gainsView";
import "./style.css";
import DirArrow from "./DirArrow";
declare global {
  interface Window {
    desktop: any;
    OpenfundCharts: any;
    OpenfundGains: any;
    OpenfundPositionSizing: any;
    OpenfundPositionOverlay: any;
  }
}
const bridge = window.desktop;
const money = (v: unknown) =>
  v == null || !Number.isFinite(Number(v))
    ? "—"
    : Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
/* Native Gains collateral can be fractional crypto; never round to a false 0.00. */
const native = (v: unknown) =>
  v == null || !Number.isFinite(Number(v))
    ? "—"
    : Number(v).toLocaleString("en-US", { maximumFractionDigits: 10 });
type Product = "prop" | "perpetual";
const PERPETUAL_POLL_MS = 30_000;
/** Coalescing window for Gains price ticks (≈4 UI updates per second). */
const PRICE_FLUSH_MS = 250;
/** Stable empty list: a fresh [] per render re-synced every chart overlay. */
const NO_POSITIONS: any[] = [];
/** Below this drag height the trading panel snaps closed. */
const PANEL_SNAP = 72;
const PANEL_MIN = 105;
const PANEL_MAX = 900;
/* 0.0.4 opens Quick Trade in the top-right corner; earlier saved positions
   (bottom-left default) are not carried over. */
const TICKET_POSITION_KEY = "ot-ticket-position-v2";
const panelDragState: { current: { y: number; height: number; moved: boolean } | null } = { current: null };
/**
 * Drag-to-open/close for the bottom trading panel. The panel is resized by
 * writing its style directly while the pointer moves (no React render per
 * mouse move); the final open state and height are committed on release.
 * Dragging a collapsed panel upwards opens it, dragging it below PANEL_SNAP
 * closes it, and a double-click toggles it.
 */
function panelDrag(
  open: boolean,
  height: number,
  setOpen: (v: boolean) => void,
  setHeight: (v: number) => void,
) {
  /* The drag origin lives at module level: the workspace re-renders during a
     drag (price flushes), which replaces these handlers mid-gesture. */
  const drag = panelDragState;
  const apply = (el: HTMLElement, h: number) => {
    const expanded = h >= PANEL_SNAP;
    el.classList.toggle("expanded", expanded);
    el.classList.toggle("collapsed", !expanded);
    el.style.height = expanded ? Math.min(PANEL_MAX, h) + "px" : "";
  };
  return {
    role: "separator",
    "aria-orientation": "horizontal" as const,
    tabIndex: 0,
    onPointerDown(event: React.PointerEvent<HTMLElement>) {
      if (event.button !== 0) return;
      const panel = event.currentTarget.parentElement!;
      drag.current = { y: event.clientY, height: open ? panel.offsetHeight : 0, moved: false };
      panel.classList.add("dragging");
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: React.PointerEvent<HTMLElement>) {
      const s = drag.current;
      if (!s) return;
      const h = s.height + s.y - event.clientY;
      if (Math.abs(s.y - event.clientY) > 3) s.moved = true;
      if (s.moved) apply(event.currentTarget.parentElement!, h);
    },
    onLostPointerCapture(event: React.PointerEvent<HTMLElement>) {
      const panel = event.currentTarget.parentElement!;
      panel.classList.remove("dragging");
      const s = drag.current;
      drag.current = null;
      if (!s || !s.moved) return;
      const h = s.height + s.y - event.clientY;
      const next = h >= PANEL_SNAP;
      const finalHeight = Math.max(PANEL_MIN, Math.min(PANEL_MAX, h));
      apply(panel, next ? finalHeight : 0);
      if (next) setHeight(finalHeight);
      setOpen(next);
    },
    onDoubleClick() {
      setOpen(!open);
    },
    onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
      if (event.key === "ArrowUp") { event.preventDefault(); if (!open) setOpen(true); else setHeight(Math.min(PANEL_MAX, height + 24)); }
      if (event.key === "ArrowDown") { event.preventDefault(); if (height - 24 < PANEL_MIN) setOpen(false); else setHeight(height - 24); }
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen(!open); }
    },
  };
}
async function request(
  path: string,
  body?: unknown,
  account?: string,
  key?: string,
) {
  return bridge.request({
    path,
    method: body === undefined ? "GET" : "POST",
    body,
    account,
    key,
  });
}
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
const defaults = [
  { symbol: "BTC/USD", timeframe: "60" },
  { symbol: "ETH/USD", timeframe: "60" },
  { symbol: "XAU/USD", timeframe: "60" },
  { symbol: "EUR/USD", timeframe: "60" },
];
/** Stored layout → a safe four-chart workspace (bad storage never breaks startup). */
function workspace(value: any): { charts: any[]; layout: number } {
  const charts = defaults.map((d, i) => {
    const c = Array.isArray(value?.charts) ? value.charts[i] : null;
    return c && typeof c.symbol === "string" && c.symbol.length <= 40 &&
      typeof c.timeframe === "string" && c.timeframe.length <= 8
      ? { symbol: c.symbol, timeframe: c.timeframe }
      : d;
  });
  const layout = [1, 2, 3, 4].includes(Number(value?.layout)) ? Number(value.layout) : 1;
  return { charts, layout };
}
class Boundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    const t = translator(
      initialLocale(read<string | null>(LOCALE_KEY, null), navigator.languages),
    );
    return this.state.failed ? (
      <main className="startup" role="alert">
        <img className="emblem" src="./assets/mark-mint.svg" alt="Openfund" />
        <h1>Open Trade</h1>
        <p>
          {t(
            "The workspace could not render. Restart the application to recover.",
            "فضای کاری نمایش داده نشد. برای بازیابی، برنامه را دوباره اجرا کنید.",
          )}
        </p>
      </main>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [theme, setTheme] = useState(read("ot-theme", "dark"));
  const [locale, setLocale] = useState<AppLocale>(() =>
    initialLocale(read<string | null>(LOCALE_KEY, null), navigator.languages),
  );
  const [localeReady, setLocaleReady] = useState(0);
  const t: Translate = translator(locale);
  useEffect(() => {
    let current = true;
    void applyLocale(locale).then(() => current && setLocaleReady((n) => n + 1));
    return () => {
      current = false;
    };
  }, [locale]);
  const [product, setProduct] = useState<Product>(() =>
    read<string>("ot-product", "prop") === "perpetual" ? "perpetual" : "prop",
  );
  const [gains, setGains] = useState<{ data: any; loading: boolean; error: string | null }>({
    data: null,
    loading: false,
    error: null,
  });
  const [gainsTab, setGainsTab] = useState<"positions" | "orders" | "history">("positions");
  const [update, setUpdate] = useState<{ version: string; tag: string } | null>(null);
  /* Strings without a reviewed translation are reported by the shared web
     lookup; the visible note is the same contract as the web terminal. */
  const [missing, setMissing] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setMissing(untranslated(locale));
    sync();
    addEventListener("of-i18n-miss", sync);
    return () => removeEventListener("of-i18n-miss", sync);
  }, [locale, localeReady]);
  /** Official-release notification only: nothing is downloaded or installed. */
  async function checkUpdates(manual = false) {
    try {
      const found = await bridge.checkUpdates();
      const deferred = read<string | null>("ot-update-deferred", null);
      if (found && (manual || found.version !== deferred)) setUpdate(found);
      else if (manual)
        setNotice(found ? "" : t("You have the latest official release.", "آخرین نسخهٔ رسمی نصب است."));
    } catch {
      if (manual)
        setNotice(t("Release information is unavailable. Try again later.", "اطلاعات انتشار در دسترس نیست. بعداً دوباره تلاش کنید."));
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => void checkUpdates(), 15_000);
    return () => clearTimeout(timer);
  }, []);
  const [config, setConfig] = useState<any>({ origin: "", projectId: "", projectIdStatus: "missing" }),
    [settings, setSettings] = useState(false),
    [network, setNetwork] = useState("initializing"),
    [user, setUser] = useState<any>(null),
    [accounts, setAccounts] = useState<any[]>([]),
    [account, setAccount] = useState<any>(null),
    [state, setState] = useState<any>(null),
    [connection, setConnection] = useState("loading"),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [explore, setExplore] = useState(false);
  /* Chart layouts are remembered per product (Prop and Perpetual keep their
     own symbols and layout); the 0.0.2 single layout migrates into Prop. */
  const productRef = useRef<Product>(product);
  productRef.current = product;
  const [workspaces, setWorkspaces] = useState<Record<Product, { charts: any[]; layout: number }>>(() => ({
    prop: workspace(read("ot-workspace-prop", { charts: read("ot-charts", defaults), layout: read("ot-layout", 1) })),
    perpetual: workspace(read("ot-workspace-perpetual", { charts: defaults, layout: 1 })),
  }));
  const charts = workspaces[product].charts,
    layout = workspaces[product].layout;
  const setCharts = (next: (old: any[]) => any[]) =>
    setWorkspaces((w) => {
      const p = productRef.current;
      return { ...w, [p]: { ...w[p], charts: next(w[p].charts) } };
    });
  const setLayout = (n: number) =>
    setWorkspaces((w) => {
      const p = productRef.current;
      return { ...w, [p]: { ...w[p], layout: n } };
    });
  const [active, setActive] = useState(0),
    [max, setMax] = useState<number | null>(null),
    [focus, setFocus] = useState(false),
    [watch, setWatch] = useState(false),
    [ticket, setTicket] = useState(true),
    [tab, setTab] = useState(read("ot-tab", "positions"));
  const [markets, setMarkets] = useState<Map<string, any>>(new Map()),
    [prices, setPrices] = useState<Record<string, any>>({}),
    [feed, setFeed] = useState("connecting"),
    [clock, setClock] = useState(Date.now());
  const [margin, setMargin] = useState("100"),
    [leverage, setLeverage] = useState("10"),
    [mode, setMode] = useState("collateral"),
    [sl, setSl] = useState(""),
    [tp, setTp] = useState(""),
    [preview, setPreview] = useState<any>(null),
    [pending, setPending] = useState<any>(null);
  const [positionsOpen, setPositionsOpen] = useState(read("ot-positions-open", false)),
    [ticketDock, setTicketDock] = useState(read("ot-ticket-dock", false)),
    [accountMenu, setAccountMenu] = useState(false),
    [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [ticketPosition, setTicketPosition] = useState(read<{x: number; y: number} | null>(TICKET_POSITION_KEY, null));
  const [chartSplit, setChartSplit] = useState(read("ot-chart-split", 66));
  useEffect(() => localStorage.setItem("ot-chart-split", JSON.stringify(chartSplit)), [chartSplit]);
  const [panelHeight, setPanelHeight] = useState(read("ot-panel-height", 180));
  const ticketElement = useRef<HTMLElement>(null);
  const drag = useRef<{x: number; y: number; left: number; top: number} | null>(null);
  useEffect(() => {
    for (const [key, value] of Object.entries({
      [TICKET_POSITION_KEY]: ticketPosition, "ot-panel-height": panelHeight,
      "ot-tab": tab, "ot-positions-open": positionsOpen, "ot-ticket-dock": ticketDock,
    })) localStorage.setItem(key, JSON.stringify(value));
  }, [ticketPosition, panelHeight, tab, positionsOpen, ticketDock]);

  useEffect(() => {
    const element = ticketElement.current;
    const workspace = element?.offsetParent;
    if (!element || !workspace || ticketDock) return;
    const observer = new ResizeObserver(() => setTicketPosition((position) => {
      if (!position) return null;
      const x = Math.max(0, Math.min(position.x, workspace.clientWidth - element.offsetWidth));
      const y = Math.max(0, Math.min(position.y, workspace.clientHeight - element.offsetHeight));
      return x === position.x && y === position.y ? position : { x, y };
    }));
    observer.observe(workspace);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ticketDock, ticket, focus, account, explore]);
  const [regions, setRegions] = useState<{international: number | null; iran: number | null; iranEnabled: boolean} | null>(null);
  useEffect(() => {
    if (account || explore) return;
    let active = true;
    const measure = () => void bridge.regions().then((result: NonNullable<typeof regions>) => {
      if (active) setRegions(result);
    }).catch(() => {});
    measure();
    const timer = setInterval(measure, 30_000);
    return () => { active = false; clearInterval(timer); };
  }, [account, explore]);
  const chartActions = useRef<ChartActions>(null as unknown as ChartActions);
  const scope = useRef(""),
    provider = useRef<any>(null),
    operation = useRef(false),
    generation = useRef(0);
  const selected = charts[active] || charts[0],
    meta = markets.get(selected.symbol),
    price = prices[selected.symbol];
  const [chartImage, setChartImage] = useState("");
  async function captureChart() {
    document.documentElement.classList.add("capturing-chart");
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const chart = document.querySelector(".chart-cell.active:not([hidden])");
      if (!chart) throw new Error(t("Select a visible chart first.", "ابتدا یک نمودار قابل مشاهده را انتخاب کنید."));
      const r = chart.getBoundingClientRect();
      const x = Math.max(0, Math.ceil(r.left)), y = Math.max(0, Math.ceil(r.top));
      const data = await bridge.captureChart({
        x, y, width: Math.min(innerWidth, Math.floor(r.right)) - x,
        height: Math.min(innerHeight, Math.floor(r.bottom)) - y,
      });
      const image = new Image();
      image.src = data;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height + 80;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#17181d";
      ctx.fillRect(0, 0, canvas.width, 80);
      ctx.fillStyle = "#eef0f4";
      ctx.font = "bold 24px system-ui";
      ctx.fillText("Open Trade · Openfund", 20, 33);
      ctx.font = "17px system-ui";
      const position = state?.positions?.find((p: any) => p.market === selected.symbol);
      const pnl = position?.unrealized_pnl;
      /* unrealized P&L only from a fresh Prop valuation with a matching
         position; Perpetual captures never carry account figures */
      const detail = product === "prop" && pnl != null && Number.isFinite(Number(pnl)) && state?.account?.valuation_status === "fresh"
        ? " · " + (state.account.type === "free_demo" ? t("Demo", "دمو") : state.account.type === "challenge" ? t("Evaluation", "ارزیابی") : t("Trading account", "حساب معاملاتی")) + " · " + t("Unrealized P&L", "سود/زیان باز") + " " + money(pnl) + " USD"
        : "";
      ctx.fillText(selected.symbol + " · " + selected.timeframe + detail, 20, 61);
      ctx.drawImage(image, 0, 80);
      setChartImage(canvas.toDataURL("image/png"));
    } catch (error) { setNotice(String(error)); }
    finally { document.documentElement.classList.remove("capturing-chart"); }
  }
  const fresh = feed === "live" && price && clock - price.updatedAt < 45000;
  const ready =
    canSimulateTrade(product, account) &&
    state?.account?.status === "active" &&
    state?.account?.valuation_status === "fresh" &&
    connection === "ready" &&
    network === "online" &&
    fresh &&
    !pending &&
    !busy;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ot-theme", JSON.stringify(theme));
    if (config.platform) void bridge.chromeTheme?.(theme).catch(() => {});
  }, [theme, config.platform]);
  /* Glass chrome: "native" when the window has an OS material behind it. */
  useEffect(() => {
    const root = document.documentElement;
    if (config.platform) root.dataset.platform = config.platform;
    root.dataset.glass = config.glass === "native" ? "native" : "css";
  }, [config.platform, config.glass]);
  useEffect(() => {
    for (const p of ["prop", "perpetual"] as const)
      localStorage.setItem("ot-workspace-" + p, JSON.stringify(workspaces[p]));
    setPreview(null);
  }, [workspaces]);
  useEffect(() => {
    localStorage.setItem("ot-product", JSON.stringify(product));
    setActive(0);
    setMax(null);
  }, [product]);
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 2000);
    return () => clearInterval(id);
  }, []);
  /** Loads the signed-in wallet's real directory and restores the last
   * product/account selection only when it still belongs to that wallet. */
  async function loadAccounts(wallet: string) {
    const result = await request("/accounts");
    if (!result.ok)
      throw new Error(result.error || t("Account directory unavailable", "فهرست حساب‌ها در دسترس نیست"));
    const list = Array.isArray(result.data?.accounts) ? result.data.accounts : [];
    setAccounts(list);
    const restored = restoreSelection(read("ot-selection", null), list, wallet);
    if (restored) {
      setProduct(restored.product as Product);
      setAccount(restored.account);
    }
  }
  async function restore() {
    const result = await request("/auth/me");
    if (result.ok) {
      setUser(result.data.user);
      await loadAccounts(result.data.user?.walletAddress);
    } else if (result.status === 401) setUser(null);
  }
  /** Product switch without signing in again: stops the other product's
   * stream/polling (effects keyed on product and account) and clears its data. */
  function selectProduct(next: Product, nextAccount: any) {
    if (pending || busy) return;
    setState(null);
    setGains({ data: null, loading: false, error: null });
    setPreview(null);
    setProduct(next);
    setAccount(nextAccount);
    const wallet = String(user?.walletAddress || "").toLowerCase();
    if (nextAccount)
      localStorage.setItem(
        "ot-selection",
        JSON.stringify({ wallet, product: next, id: nextAccount.id }),
      );
  }
  useEffect(() => {
    let disposed = false,
      timer: ReturnType<typeof setTimeout>,
      attempt = 0;
    async function check() {
      try {
        const c = await bridge.config();
        if (disposed) return;
        setConfig(c);
        const n = await bridge.connectivity();
        if (disposed) return;
        setNetwork(n);
        if (n === "online" && attempt === 0) await restore();
        attempt = n === "online" ? 0 : attempt + 1;
      } catch {
        if (!disposed) setNetwork("unavailable");
      }
      if (!disposed)
        timer = setTimeout(check, attempt ? retryDelay(attempt) : 30000);
    }
    void check();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    let stopped = false;
    window.OpenfundGains.marketList()
      .then((m: Map<string, any>) => {
        if (!stopped) setMarkets(m);
      })
      .catch(() =>
        setNotice(
          t(
            "Market catalog unavailable. Retry connection.",
            "فهرست بازارها در دسترس نیست. دوباره تلاش کنید.",
          ),
        ),
      );
    /* Gains pushes every market's tick individually. Re-rendering the whole
       workspace per tick made the app lag, so ticks are coalesced and
       committed at most PRICE_FLUSH_MS apart (the chart canvases stream their
       own data and are not affected). */
    let queued: Record<string, any> = {},
      flush: ReturnType<typeof setTimeout> | undefined;
    const p = window.OpenfundGains.subscribePrices((v: any) => {
      queued[v.market] = v;
      if (flush) return;
      flush = setTimeout(() => {
        flush = undefined;
        const batch = queued;
        queued = {};
        if (!stopped) setPrices((old) => ({ ...old, ...batch }));
      }, PRICE_FLUSH_MS);
    });
    const s = window.OpenfundGains.subscribeStatus(setFeed);
    return () => {
      stopped = true;
      clearTimeout(flush);
      p();
      s();
    };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettings(false);
        setChartImage("");
        setAccountMenu(false);
        setMenu(null);
        return;
      }
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === ",") {
        e.preventDefault();
        setSettings((v) => !v);
      }
      if (mod && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        setLayout(Number(e.key));
        setActive(0);
        setMax(null);
      }
      if (e.altKey && e.code === "KeyW") {
        e.preventDefault();
        setWatch((v) => !v);
      }
      if (e.altKey && e.code === "KeyT") {
        e.preventDefault();
        setTicket((v) => !v);
      }
      if (e.altKey && e.code === "KeyP") {
        e.preventDefault();
        setPositionsOpen((v) => !v);
      }
      if (mod && e.shiftKey && e.code === "KeyF") {
        e.preventDefault();
        setFocus((v) => !v);
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, []);
  const pendingKey = (id: string) =>
    "ot-pending-" + (user?.id || "") + "-" + id;
  async function refresh(id = scope.current) {
    if (!id) return;
    const result = await request("/trading/state", undefined, id);
    if (scope.current !== id) return;
    if (result.ok) {
      setState((old: any) =>
        acceptSnapshot(old, result.data) ? result.data : old,
      );
      setConnection("ready");
    } else {
      setConnection(result.status === 401 ? "expired" : "disconnected");
      if (result.status === 401) {
        setAccount(null);
        setUser(null);
      }
    }
  }
  useEffect(() => {
    const id = product === "prop" ? account?.id || "" : "";
    scope.current = id;
    setState(null);
    setConnection("loading");
    setPreview(null);
    setPending(id ? read(pendingKey(id), null) : null);
    const off = bridge.onState((v: any) => {
      if (v.account !== scope.current) return;
      setConnection(v.status);
      if (v.snapshot)
        setState((old: any) =>
          acceptSnapshot(old, v.snapshot) ? v.snapshot : old,
        );
      if (v.status === "expired") {
        setAccount(null);
        setUser(null);
      }
    });
    if (id) {
      void refresh(id);
      void bridge.stream(id);
    } else void bridge.stream(null);
    return () => {
      off();
      void bridge.stream(null);
    };
  }, [account?.id, product]);
  /* Perpetual: poll the wallet's read-only Gains snapshot through the existing
     backend boundary while Perpetual is active; a failed refresh keeps the
     last verified snapshot labelled outdated (gainsFeedState). */
  useEffect(() => {
    const wallet = String(user?.walletAddress || "").toLowerCase();
    if (product !== "perpetual" || !account || !wallet) return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      failures = 0;
    setGains({ data: null, loading: true, error: null });
    const load = async () => {
      setGains((g) => ({ ...g, loading: true }));
      let error: string | null = null,
        data: any = null;
      try {
        const result = await request("/products/perpetual/gains");
        if (stopped) return;
        if (result.status === 401) {
          setAccount(null);
          setUser(null);
          return;
        }
        data = result.ok ? perpetualSnapshotFor(result.data, wallet) : null;
        if (!data) error = result.error || "unavailable";
      } catch {
        error = "unavailable";
      }
      if (stopped) return;
      failures = error ? failures + 1 : 0;
      setGains((g) => ({ data: data || g.data, loading: false, error }));
      timer = setTimeout(load, error ? retryDelay(failures) : PERPETUAL_POLL_MS);
    };
    void load();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [product, account?.id, user?.walletAddress]);
  /** Removes the wallet listeners registered by the last successful sign-in. */
  const walletListeners = useRef<(() => void) | null>(null);
  async function logout() {
    generation.current++;
    setAccount(null);
    setUser(null);
    setAccounts([]);
    setExplore(false);
    setState(null);
    setGains({ data: null, loading: false, error: null });
    walletListeners.current?.();
    walletListeners.current = null;
    await request("/auth/logout", {}).catch(() => {});
    try {
      await provider.current?.disconnect();
    } catch {}
    provider.current = null;
  }
  /** Localized, actionable message for a wallet or sign-in failure. */
  function walletMessage(error: unknown) {
    switch (walletErrorCode(error)) {
      case "rejected":
        return t("The request was declined in your wallet. Nothing was signed.", "درخواست در کیف پول رد شد. چیزی امضا نشد.");
      case "expired":
        return t("The wallet request expired. Start the connection again.", "مهلت درخواست کیف پول تمام شد. اتصال را دوباره شروع کنید.");
      case "project":
        return t("Wallet connection is unavailable in this build. Contact Openfund support.", "اتصال کیف پول در این نسخه در دسترس نیست. با پشتیبانی اوپن‌فاند تماس بگیرید.");
      case "relay":
        return t("The wallet connection service is unreachable. Check your connection and try again.", "سرویس اتصال کیف پول در دسترس نیست. اتصال اینترنت را بررسی و دوباره تلاش کنید.");
      case "chain":
        return t("Switch your wallet to Arbitrum One (42161) and try again.", "شبکه کیف پول را روی Arbitrum One (42161) بگذارید و دوباره تلاش کنید.");
      case "mismatch":
        return t("The signed-in wallet does not match the connected wallet. Sign in again.", "کیف پول واردشده با کیف پول متصل یکسان نیست. دوباره وارد شوید.");
      default:
        return t("Wallet sign-in failed. Try again.", "ورود با کیف پول ناموفق بود. دوباره تلاش کنید.");
    }
  }
  function chooseLocale(next: AppLocale) {
    localStorage.setItem(LOCALE_KEY, JSON.stringify(next));
    setLocale(next);
  }
  async function login() {
    setBusy(true);
    setNotice("");
    const gen = ++generation.current;
    let wallet: any = null;
    try {
      if (config.projectIdStatus !== "configured")
        throw new Error("project id " + config.projectIdStatus);
      const { EthereumProvider } = await import(
        "@walletconnect/ethereum-provider"
      );
      wallet = await EthereumProvider.init({
        projectId: config.projectId,
        chains: [42161],
        showQrModal: true,
        methods: ["personal_sign"],
        events: ["accountsChanged", "chainChanged"],
        metadata: {
          name: "Open Trade by Openfund",
          description: t("Openfund desktop wallet sign-in", "ورود با کیف پول به نسخه دسکتاپ اوپن‌فاند"),
          url: config.metadataUrl || config.origin,
          icons: config.metadataUrl ? [config.metadataUrl + "/assets/mark-mint.svg"] : [],
        },
      });
      provider.current = wallet;
      await wallet.connect();
      if (gen !== generation.current) return;
      if (Number(wallet.chainId) !== 42161)
        throw new Error("Arbitrum One is required.");
      const address = getAddress(wallet.accounts[0]);
      const nonce = await request("/auth/nonce", { address });
      if (gen !== generation.current) return;
      if (!nonce.ok)
        throw Object.assign(new Error("backend"), { backend: nonce.error || nonce.status });
      /* EIP-4361: domain and URI are the configured Openfund backend that verifies it */
      const base = new URL(config.origin),
        message = createSiweMessage({
          address,
          chainId: 42161,
          domain: base.host,
          uri: base.origin,
          version: "1",
          nonce: nonce.data.nonce,
          issuedAt: new Date(),
          expirationTime: new Date(Date.now() + 300000),
          statement:
            "Sign in to Open Trade by Openfund. This does not authorize a blockchain transaction.",
        });
      const signature = await wallet.request({
        method: "personal_sign",
        params: [stringToHex(message), address],
      });
      if (gen !== generation.current) return;
      const result = await request("/auth/verify", { message, signature });
      if (gen !== generation.current) return;
      if (!result.ok)
        throw Object.assign(new Error("backend"), { backend: result.error || result.status });
      const verified = await request("/auth/me");
      if (
        !verified.ok ||
        verified.data.user?.walletAddress?.toLowerCase() !==
          address.toLowerCase()
      ) {
        await request("/auth/logout", {}).catch(() => {});
        throw new Error("Verified wallet session mismatch");
      }
      setUser(verified.data.user);
      await loadAccounts(address);
      /* Pairing is not authentication: a different address, or the wallet
         ending the pairing, ends the Openfund desktop session as well. */
      const onAccounts = (list: string[]) => {
        if (!list?.[0] || list[0].toLowerCase() !== address.toLowerCase()) {
          setNotice(t("Your wallet switched accounts. Sign in again to continue.", "حساب کیف پول تغییر کرد. برای ادامه دوباره وارد شوید."));
          void logout();
        }
      };
      const onDisconnect = () => {
        setNotice(t("The wallet ended the connection. Sign in again to continue.", "کیف پول اتصال را قطع کرد. برای ادامه دوباره وارد شوید."));
        void logout();
      };
      walletListeners.current?.();
      wallet.on("accountsChanged", onAccounts);
      wallet.on("disconnect", onDisconnect);
      walletListeners.current = () => {
        wallet.removeListener?.("accountsChanged", onAccounts);
        wallet.removeListener?.("disconnect", onDisconnect);
      };
    } catch (e: any) {
      if (gen === generation.current) {
        if (e?.backend !== undefined)
          setNotice(
            e.backend === 0
              ? t("The Openfund service is unavailable. Retrying automatically.", "سرویس اوپن‌فاند در دسترس نیست. اتصال خودکار تکرار می‌شود.")
              : format(t, "Openfund rejected the sign-in (${reason}).", "اوپن‌فاند ورود را نپذیرفت (${reason}).", { reason: String(e.backend) }),
          );
        else setNotice(walletMessage(e));
      }
      /* never keep a half-established pairing after a failed sign-in */
      if (wallet && !user) {
        try {
          await wallet.disconnect();
        } catch {}
        if (provider.current === wallet) provider.current = null;
      }
    } finally {
      setBusy(false);
    }
  }
  const updateChart = (i: number, patch: any) =>
    setCharts((old: any[]) =>
      old.map((c, j) => (j === i ? { ...c, ...patch } : c)),
    );
  function orderBody(side: string) {
    const sizing = window.OpenfundPositionSizing;
    let collateral = margin;
    if (mode === "lots") {
      const spec = sizing.lotSpec(meta, selected.symbol),
        q = sizing.quantityFromLots(margin, spec);
      if (!q.ok) throw new Error(q.reason);
      collateral = sizing.collateralFromQuantity({
        quantity: q.quantity,
        leverage,
        price: String(price?.mark),
      });
    }
    if (!collateral || Number(collateral) <= 0) throw new Error("Invalid size");
    return {
      market: selected.symbol,
      side,
      order_type: "market",
      margin: collateral,
      leverage: Number(leverage),
      sl: sl ? Number(sl) : null,
      tp: tp ? Number(tp) : null,
      product: "prop",
    };
  }
  async function estimate(side: string) {
    if (!ready) return;
    try {
      const id = scope.current,
        body = orderBody(side),
        result = await request("/trading/preview", body, id);
      if (id !== scope.current) return;
      if (!result.ok) throw new Error(result.error);
      setPreview({ body, data: result.data, account: id, time: Date.now() });
    } catch (e) {
      setNotice(String(e));
    }
  }
  async function mutate(path: string, body: any) {
    if (operation.current || !scope.current || pending) return;
    const id = scope.current,
      key = crypto.randomUUID(),
      intent = { path, body, key, account: id, time: Date.now() };
    operation.current = true;
    setBusy(true);
    setPending(intent);
    localStorage.setItem(pendingKey(id), JSON.stringify(intent));
    setNotice(t("Pending confirmation…", "در انتظار تأیید…"));
    try {
      const result = await request(path, body, id, key);
      if (scope.current !== id) return;
      if (!result.ok && (result.status === 0 || result.status >= 500)) {
        setNotice(
          t(
            "Outcome unknown. Review account state before any further trading. No automatic retry.",
            "نتیجه نامشخص است. پیش از معامله بعدی وضعیت حساب را بررسی کنید.",
          ),
        );
        return;
      }
      localStorage.removeItem(pendingKey(id));
      setPending(null);
      setPreview(null);
      setNotice(
        result.ok
          ? t("Confirmed by Openfund.", "توسط اوپن‌فاند تأیید شد.")
          : t("Rejected: ", "رد شد: ") + (result.error || result.status),
      );
      await refresh(id);
    } catch {
      setNotice(
        t(
          "Outcome unknown. Trading is locked until reconciliation.",
          "نتیجه نامشخص است. معامله تا تطبیق وضعیت قفل می‌ماند.",
        ),
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function reconcile() {
    if (!pending || busy) return;
    const id = scope.current;
    setBusy(true);
    try {
      const result = await request("/trading/state", undefined, id);
      if (!result.ok) throw new Error("Account snapshot unavailable");
      const next = result.data;
      let confirmed = false;
      if (pending.path === "/trading/order") {
        confirmed = next.orders.some((o: any) =>
          String(o.idempotency_key || "").endsWith(":" + pending.key),
        );
        for (const p of [...next.positions, ...next.history]
          .filter(
            (p: any) =>
              p.market === pending.body.market &&
              Date.parse(p.opened_at) >= pending.time - 60000,
          )
          .slice(0, 30)) {
          const detail = await request(
            "/products/prop/trades/" + p.id,
            undefined,
            id,
          );
          if (
            detail.ok &&
            String(detail.data.order?.idempotencyKey || "").endsWith(
              ":" + pending.key,
            )
          ) {
            confirmed = true;
            break;
          }
        }
      } else if (pending.path.endsWith("/protection")) {
        const p = next.positions.find((p: any) => pending.path.includes(p.id));
        confirmed =
          !!p &&
          ["sl", "tp"].every((k) =>
            p[k + "_price"] == null
              ? pending.body[k] == null
              : Number(p[k + "_price"]) === Number(pending.body[k]),
          );
      } else if (pending.path.endsWith("/close"))
        confirmed = next.history.some((p: any) => pending.path.includes(p.id));
      if (scope.current !== id) return;
      setState(next);
      setConnection("ready");
      if (confirmed) {
        localStorage.removeItem(pendingKey(id));
        setPending(null);
        setNotice(
          t(
            "Operation reconciled with the authoritative account.",
            "عملیات با وضعیت قطعی حساب تطبیق داده شد.",
          ),
        );
      } else
        setNotice(
          t(
            "No conclusive confirmation yet. Trading remains locked; contact support with the operation ID.",
            "تأیید قطعی پیدا نشد. معامله قفل می‌ماند؛ شناسه عملیات را به پشتیبانی بدهید.",
          ),
        );
    } catch (e) {
      setNotice(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (
      !ready ||
      !preview ||
      preview.account !== scope.current ||
      Date.now() - preview.time > 15000
    ) {
      setPreview(null);
      return;
    }
    await mutate("/trading/order", preview.body);
  }
  /* Charts are memoised; their callbacks read the latest App closures from
     this ref so a price flush never re-renders (or re-syncs) a chart. */
  chartActions.current = {
    activate: (i: number) => setActive(i),
    market: (i: number, patch: any) => updateChart(i, patch),
    max: (i: number) => {
      setActive(i);
      setMax((m) => (m === i ? null : i));
    },
    risk: (p: any, edit: any) => void mutate(`/trading/positions/${p.id}/protection`, edit),
    error: setNotice,
  };
  const lot = window.OpenfundPositionSizing.lotSpec(meta, selected.symbol);
  const terminal = !!account || explore;
  const walletAddress = String(user?.walletAddress || "");
  const shortWallet = walletAddress
    ? walletAddress.slice(0, 6) + "…" + walletAddress.slice(-4)
    : "";
  const channelLabel =
    config.channel === "stable" ? "" : config.channel === "beta" ? "BETA" : t("INTERNAL", "داخلی");
  const productLabel = (p: Product) =>
    p === "prop"
      ? t("PROP — Simulated Trading", "پراپ — معاملهٔ شبیه‌سازی‌شده")
      : t("PERPETUAL — Gains Account", "پرپچوال — حساب Gains");
  const gainsState = gainsFeedState(!!user, gains);
  /** Both products for the signed-in wallet, strictly separated. */
  const directory = (after?: () => void) => {
    const prop = propAccounts(accounts),
      perpetual = perpetualAccount(accounts, walletAddress);
    const locked = busy || !!pending || network !== "online";
    return (
      <div className="product-directory">
        <p className="wallet-line">
          <span>{t("Connected wallet", "کیف پول متصل")}</span>
          <bdi dir="ltr" title={walletAddress}>{shortWallet}</bdi>
          <span className="muted">Arbitrum One · 42161</span>
        </p>
        <section aria-label={productLabel("prop")} className="product-section">
          <h3>{productLabel("prop")}</h3>
          {prop.length ? (
            <div className="accounts">
              {prop.map((a: any) => (
                <button
                  key={a.id}
                  disabled={locked}
                  aria-pressed={product === "prop" && account?.id === a.id}
                  className={product === "prop" && account?.id === a.id ? "selected" : ""}
                  onClick={() => {
                    selectProduct("prop", a);
                    after?.();
                  }}
                >
                  <span>
                    {a.name}
                    <small>
                      {a.type} · {a.status}
                      {a.readOnly ? " · " + t("Read-only", "فقط خواندنی") : ""}
                    </small>
                  </span>
                  <strong dir="ltr">
                    {money(a.equity)} {a.currency || ""}
                  </strong>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">
              {t(
                "This wallet has no Prop accounts yet. Start a challenge or free demo on the Openfund website.",
                "این کیف پول هنوز حساب پراپ ندارد. چالش یا حساب دموی رایگان را از وب‌سایت اوپن‌فاند شروع کنید.",
              )}
            </p>
          )}
        </section>
        <section aria-label={productLabel("perpetual")} className="product-section">
          <h3>{productLabel("perpetual")}</h3>
          {perpetual ? (
            <div className="accounts">
              <button
                disabled={locked}
                aria-pressed={product === "perpetual" && !!account}
                className={product === "perpetual" && account ? "selected" : ""}
                onClick={() => {
                  selectProduct("perpetual", perpetual);
                  after?.();
                }}
              >
                <span>
                  Gains Network
                  <small>
                    {t("Read-only", "فقط خواندنی")} · Arbitrum One
                  </small>
                </span>
                <strong>{t("View", "مشاهده")}</strong>
              </button>
            </div>
          ) : (
            <p className="muted">
              {t("Perpetual account information is unavailable.", "اطلاعات حساب پرپچوال در دسترس نیست.")}
            </p>
          )}
          <small className="muted">
            {t(
              "Official Gains records for this wallet. Orders, approvals and collateral transfers are not available in Open Trade.",
              "سوابق رسمی Gains برای این کیف پول. ثبت سفارش، تأیید و انتقال وثیقه در Open Trade در دسترس نیست.",
            )}
          </small>
        </section>
        <button disabled={busy || !!pending} onClick={() => void logout()}>
          {t("Disconnect wallet", "قطع اتصال کیف پول")}
        </button>
      </div>
    );
  };
  return (
    <div className="app">
      <header className="titlebar">
        <div className="window-title">
          <img className="title-mark" src="./assets/mark-mint.svg" alt="" />
          Open Trade <span>{config.version}{channelLabel ? " " + channelLabel : ""}</span>
        </div>
        <div className="titlebar-actions">
          {terminal && (
            <>
              {account && (
                <span className={"product-badge " + product} aria-live="polite">
                  {product === "prop" ? t("PROP", "پراپ") : t("PERPETUAL", "پرپچوال")}
                </span>
              )}
              <button
                aria-label={t("Select account", "انتخاب حساب")}
                onClick={() => setAccountMenu(true)}
              >
                {account
                  ? product === "perpetual"
                    ? "Gains · " + shortWallet
                    : account.name
                  : t("Connect account", "اتصال حساب")}{" "}
                ▾
              </button>
              <span className="connection-dot" title={network} aria-label={network}>
                ●
              </span>
            </>
          )}
          <button
            aria-label={t("Settings", "تنظیمات")}
            title={t("Settings", "تنظیمات") + " · ⌘,"}
            onClick={() => setSettings(true)}
          >
            ⚙
          </button>
        </div>
      </header>
      {!terminal ? (
        <main className="startup">
          <div className="orbit o1" />
          <div className="orbit o2" />
          <div className="orbit o3" />
          <section className={"launch glass scene-" + (busy ? "wallet" : network === "online" ? "online" : "offline")}>
            <label className="region-selector">{t("Server region", "منطقهٔ سرور")}
              <select aria-label={t("Server region", "منطقهٔ سرور")} value={config.region || "international"} disabled={busy || !!pending}
                onChange={async (event) => {
                  try {
                    await bridge.selectRegion(event.target.value);
                    setUser(null); setAccounts([]); setAccount(null);
                    setConfig(await bridge.config());
                    setNetwork(await bridge.connectivity());
                  } catch (error) { setNotice(String(error)); }
                }}>
                <option value="international">{t("International", "بین‌المللی")}</option>
                <option value="iran" disabled={!regions?.iranEnabled || regions.iran === null}>{t("Iran", "ایران")}</option>
              </select>
            </label>
            <p className="region-status" aria-label={t("API latency", "تأخیر سرور")}>{(["international", "iran"] as const).map((key) => (
              <span key={key}>{key === "iran" ? t("Iran", "ایران") : t("International", "بین‌المللی")} · <bdi>{regions ? regions[key] === null ? t("Unavailable", "ناموجود") : regions[key] + " ms" : t("Checking", "در حال بررسی")}</bdi></span>
            ))}</p>
            {regions && !regions.iranEnabled && (
              <p className="region-note muted">
                {t(
                  "The Iran region is not enabled for this build. Accounts stay on the international service.",
                  "منطقهٔ ایران برای این نسخه فعال نیست. حساب‌ها روی سرویس بین‌المللی می‌مانند.",
                )}
              </p>
            )}
            <img className="emblem" src="./assets/mark-mint.svg" alt="Openfund" />
            <p className="eyebrow">OPEN TRADE / OPENFUND</p>
            <h1>
              {user
                ? t(
                    "Your accounts. One workspace.",
                    "حساب‌های شما، یک فضای معاملاتی.",
                  )
                : t("A clearer view of the market.", "نگاهی روشن‌تر به بازار.")}
            </h1>
            <p className="muted">
              {network === "offline"
                ? t(
                    "No usable internet connection. We will keep trying.",
                    "اتصال اینترنت در دسترس نیست. تلاش مجدد ادامه دارد.",
                  )
                : network === "unavailable"
                  ? t(
                      "The Openfund service is unavailable. Retrying automatically.",
                      "سرویس اوپن‌فاند در دسترس نیست. اتصال خودکار تکرار می‌شود.",
                    )
                  : network === "unconfigured"
                    ? t(
                        "Choose your Openfund backend in Settings.",
                        "آدرس سرویس اوپن‌فاند را در تنظیمات وارد کنید.",
                      )
                    : t(
                        "Your wallet. Your Openfund accounts. A focused trading experience.",
                        "کیف پول شما. حساب‌های اوپن‌فاند شما. تجربه‌ای متمرکز بر معامله.",
                      )}
            </p>
            {user ? (
              directory()
            ) : (
              <>
                <button
                  className="primary"
                  disabled={busy || network !== "online" || config.projectIdStatus !== "configured"}
                  onClick={() => void login()}
                >
                  {busy
                    ? t("Waiting for wallet…", "در انتظار کیف پول…")
                    : t("Connect wallet", "اتصال کیف پول")}{" "}
                  <DirArrow kind="external" />
                </button>
                {config.projectIdStatus !== "configured" && (
                  <p className="muted" role="status">
                    {t(
                      "Wallet connection is unavailable in this build. Contact Openfund support.",
                      "اتصال کیف پول در این نسخه در دسترس نیست. با پشتیبانی اوپن‌فاند تماس بگیرید.",
                    )}
                  </p>
                )}
              </>
            )}
            <label className="language-selector">
              {t("Language", "زبان")}
              <select aria-label={t("Language", "زبان")} value={locale} onChange={(e) => chooseLocale(e.target.value as AppLocale)}>
                {LOCALES.map((l) => (
                  <option key={l} value={l} lang={l}>{LOCALE_NAMES[l]}</option>
                ))}
              </select>
            </label>
            <div className="launch-actions">
              <button
                onClick={() => {
                  setExplore(true);
                  setNotice("");
                }}
              >
                {t("Explore charts", "مشاهده نمودارها")}
              </button>
              <button
                onClick={async () => {
                  setNetwork("initializing");
                  const n = await bridge.connectivity();
                  setNetwork(n);
                  if (n === "online") await restore();
                }}
              >
                {t("Retry connection", "تلاش مجدد")}
              </button>
            </div>
            <small className="muted">
              {t(
                "Arbitrum One · Wallet signature only",
                "آربیتروم وان · فقط امضای کیف پول",
              )}
            </small>
          </section>
        </main>
      ) : (
        <main
          className={
            "terminal " +
            (focus ? "focus " : "") +
            (positionsOpen ? "positions-open " : "") +
            (ticketDock ? "ticket-docked" : "")
          }
        >
          <nav className="app-rail" aria-label={t("Workspace panels", "پنل‌های فضای کاری")}>
            <img src="./assets/mark-mint.svg" alt="Openfund" />
            {channelLabel && <span className="beta-label">{channelLabel}</span>}
            <button
              aria-label={t("Toggle watchlist", "نمایش دیده‌بان")}
              title={t("Watchlist", "دیده‌بان") + " · Alt+W"}
              className={watch ? "selected" : ""}
              onClick={() => setWatch(!watch)}
            >
              ☷
            </button>
            <button
              aria-label={t("Toggle quick trade", "نمایش معامله سریع")}
              title={t("Quick Trade", "معامله سریع") + " · Alt+T"}
              className={ticket ? "selected" : ""}
              onClick={() => setTicket(!ticket)}
            >
              ⇄
            </button>
            <button
              aria-label={t("Toggle positions", "نمایش موقعیت‌ها")}
              title={t("Positions", "موقعیت‌ها") + " · Alt+P"}
              className={positionsOpen ? "selected" : ""}
              onClick={() => setPositionsOpen(!positionsOpen)}
            >
              ▤
            </button>
            <button
              aria-label={t("Focus mode", "حالت تمرکز")}
              title={t("Focus mode", "حالت تمرکز") + " · ⌘⇧F"}
              onClick={() => setFocus(!focus)}
            >
              ⛶
            </button>
            <div className="rail-space" />
            <button
              aria-label={t("Select account", "انتخاب حساب")}
              title={t("Account", "حساب")}
              onClick={() => setAccountMenu(true)}
            >
              ◎
            </button>
            <button
              aria-label={t("Settings", "تنظیمات")}
              title={t("Settings", "تنظیمات") + " · ⌘,"}
              onClick={() => setSettings(true)}
            >
              ⚙
            </button>
          </nav>
          {!focus && watch && (
            <aside className="watch glass">
              <div className="panel-title">
                {t("Watchlist", "دیده‌بان")}
                <button aria-label={t("Close", "بستن")} onClick={() => setWatch(false)}>×</button>
              </div>
              <input
                aria-label={t("Search markets", "جستجوی بازار")}
                placeholder={t("Search markets", "جستجوی بازار")}
                onChange={(e) => {
                  document
                    .querySelectorAll<HTMLElement>("[data-market]")
                    .forEach(
                      (row) =>
                        (row.hidden = !row.dataset.market
                          ?.toLowerCase()
                          .includes(e.target.value.toLowerCase())),
                    );
                }}
              />
              {[...markets.values()].map((m) => (
                <button
                  data-market={m.symbol}
                  className={
                    m.symbol === selected.symbol ? "selected market" : "market"
                  }
                  key={m.symbol}
                  onClick={() => updateChart(active, { symbol: m.symbol })}
                >
                  <span>
                    {m.symbol}
                    <small>{m.group}</small>
                  </span>
                  <b dir="ltr">{money(prices[m.symbol]?.mark)}</b>
                </button>
              ))}
            </aside>
          )}
          <section className="workspace">
            <nav
              className="workspace-bar"
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY });
              }}
            >
              <div className="workspace-layouts">
                <span className="workspace-name">{selected.symbol}</span>
                {[1, 2, 3, 4].map((n) => (
                  <button
                    aria-label={format(t, "${count} chart layout", "چیدمان ${count} نمودار", { count: n })}
                    title={format(t, "${count} chart layout", "چیدمان ${count} نمودار", { count: n }) + " · ⌘" + n}
                    className={layout === n ? "selected" : ""}
                    onClick={() => {
                      setLayout(n);
                      setActive(0);
                      setMax(null);
                    }}
                    key={n}
                  >
                    {n === 1 ? "□" : n === 2 ? "◫" : "▦"} {n}
                  </button>
                ))}
              </div>
              <span className={feed === "live" ? "good" : "muted"}>
                {t(
                  feed === "live" ? "● Live" : "○ Reconnecting",
                  feed === "live" ? "● زنده" : "○ اتصال مجدد",
                )}
              </span>
              <div>
                <button aria-label={t("Watchlist", "دیده‌بان")} onClick={() => setWatch(!watch)}>
                  {t("Watchlist", "دیده‌بان")}
                </button>
                <button
                  aria-label={t("Quick Trade", "معامله سریع")}
                  onClick={() => setTicket(!ticket)}
                >
                  {t("Quick Trade", "معامله سریع")}
                </button>
              </div>
              <button onClick={() => void captureChart()} aria-label={t("Capture chart", "ثبت تصویر نمودار")}>{t("Capture", "تصویر")}</button>
            </nav>
            <div
              className={
                "charts layout-" + layout + (max !== null ? " maximized" : "")
              }
              style={layout === 3 && max === null ? { "--chart-split": chartSplit + "%" } as React.CSSProperties : undefined}
            >
              {layout === 3 && max === null && <div className="chart-splitter" role="separator" aria-label={t("Resize chart columns", "تغییر اندازهٔ ستون نمودارها")}
                onPointerDown={(event) => { if (event.button === 0) event.currentTarget.setPointerCapture(event.pointerId); }}
                onPointerMove={(event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  const rect = event.currentTarget.parentElement!.getBoundingClientRect();
                  setChartSplit(Math.min(78, Math.max(42, (event.clientX - rect.left) / rect.width * 100)));
                }}
              />}
              {charts.slice(0, layout).map((c, i) => (
                <Chart
                  key={i}
                  index={i}
                  symbol={c.symbol}
                  timeframe={c.timeframe}
                  active={active === i}
                  hidden={max !== null && max !== i}
                  theme={theme}
                  t={t}
                  locale={locale}
                  localeReady={localeReady}
                  wallet={user?.id || "guest"}
                  account={account?.id}
                  positions={state?.positions || NO_POSITIONS}
                  ready={ready}
                  actions={chartActions}
                />
              ))}
            </div>
            {!focus && product === "perpetual" && account && (
              <GainsPanel
                t={t}
                locale={locale}
                resource={gains}
                state={gainsState}
                tab={gainsTab}
                onTab={(x: any) => {
                  setGainsTab(x);
                  setPositionsOpen(true);
                }}
                open={positionsOpen}
                onToggle={() => setPositionsOpen(!positionsOpen)}
                onOpen={setPositionsOpen}
                height={panelHeight}
                onResize={setPanelHeight}
                onTx={(tx: string) => void bridge.external("tx:" + tx)}
              />
            )}
            {!focus && (product === "prop" || !account) && (
              <section
                className={
                  "positions " + (positionsOpen ? "expanded" : "collapsed")
                }
                style={positionsOpen ? { height: panelHeight } : undefined}
              >
                <div className="positions-divider" aria-label={t("Resize trading panel", "تغییر اندازهٔ پنل معاملات")}
                  title={t("Drag to open, resize or close", "برای باز کردن، تغییر اندازه یا بستن بکشید")}
                  {...panelDrag(positionsOpen, panelHeight, setPositionsOpen, setPanelHeight)}
                ><span className="grip" aria-hidden="true" /></div>
                <nav>
                  <button
                    aria-label={t("Expand or collapse positions", "باز یا بسته کردن موقعیت‌ها")}
                    onClick={() => setPositionsOpen(!positionsOpen)}
                  >
                    {positionsOpen ? "⌄" : "⌃"}
                  </button>
                  <button
                    className={tab === "positions" ? "selected" : ""}
                    onClick={() => {
                      setTab("positions");
                      setPositionsOpen(true);
                    }}
                  >
                    {t("Positions", "موقعیت‌ها")} (
                    {state?.positions?.length || 0})
                  </button>
                  <button
                    className={tab === "orders" ? "selected" : ""}
                    onClick={() => {
                      setTab("orders");
                      setPositionsOpen(true);
                    }}
                  >
                    {t("Orders", "سفارش‌ها")} ({state?.orders?.length || 0})
                  </button>
                  <button
                    className={tab === "activity" ? "selected" : ""}
                    onClick={() => {
                      setTab("activity");
                      setPositionsOpen(true);
                    }}
                  >
                    {t("Activity", "فعالیت")}
                  </button>
                  <span className="position-status muted">
                    {account
                      ? connectionLabel(t, connection)
                      : t(
                          "Sign in to load your account",
                          "برای مشاهده حساب وارد شوید",
                        )}
                  </span>
                </nav>
                <div className="account-stats">
                  <span>
                    {t("Balance", "موجودی")}{" "}
                    <b dir="ltr">{money(state?.account?.balance)}</b>
                  </span>
                  <span>
                    {t("Equity", "ارزش حساب")}{" "}
                    <b dir="ltr">{money(state?.account?.equity)}</b>
                  </span>
                  <span>
                    {t("Available", "آزاد")}{" "}
                    <b dir="ltr">{money(state?.account?.free_margin)}</b>
                  </span>
                  <span>
                    {t("Margin", "مارجین")}{" "}
                    <b dir="ltr">{money(state?.account?.used_margin)}</b>
                  </span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          t("Market", "بازار"),
                          t("Side", "جهت"),
                          t("Entry / Target", "ورود / هدف"),
                          "P&L",
                          t("Stop loss", "حد ضرر"),
                          t("Take profit", "حد سود"),
                          "",
                        ].map((x, i) => (
                          <th key={i}>{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        state?.[tab === "activity" ? "history" : tab] || []
                      ).map((p: any) => (
                        <tr key={p.id}>
                          <td>{p.market}</td>
                          <td>{sideLabel(t, p.side)}</td>
                          <td dir="ltr">{money(p.entry_price ?? p.target_price)}</td>
                          <td dir="ltr">{money(p.unrealized_pnl ?? p.realized_pnl)}</td>
                          <td dir="ltr">{money(p.sl_price)}</td>
                          <td dir="ltr">{money(p.tp_price)}</td>
                          <td>
                            {tab !== "activity" && (
                              <button
                                disabled={!ready}
                                onClick={() =>
                                  void mutate(
                                    tab === "orders"
                                      ? `/trading/orders/${p.id}/cancel`
                                      : `/trading/positions/${p.id}/close`,
                                    tab === "orders" ? {} : { fraction: 1 },
                                  )
                                }
                              >
                                {t(
                                  tab === "orders" ? "Cancel" : "Close",
                                  tab === "orders" ? "لغو" : "بستن",
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!state?.[tab === "activity" ? "history" : tab]?.length && (
                    <p className="empty muted">
                      {t(
                        account
                          ? "No confirmed records to display."
                          : "Your positions appear after wallet sign-in.",
                        account
                          ? "داده تأییدشده‌ای برای نمایش نیست."
                          : "پس از ورود با کیف پول، موقعیت‌های شما نمایش داده می‌شود.",
                      )}
                    </p>
                  )}
                </div>
              </section>
            )}

            {!focus && ticket && product === "perpetual" && account && (
              <aside className="ticket glass floating readonly-ticket" aria-label={t("Read-only", "فقط خواندنی")}>
                <div className="ticket-head">
                  <strong>Gains Network</strong>
                  <span className="order-type">{t("Read-only", "فقط خواندنی")}</span>
                  <button aria-label={t("Hide order ticket", "پنهان کردن برگه سفارش")} onClick={() => setTicket(false)}>⌄</button>
                </div>
                <p className="muted">
                  {t(
                    "Perpetual is a read-only view of your official Gains account. Open Trade does not place, change or close Gains trades.",
                    "پرپچوال نمای فقط‌خواندنی حساب رسمی Gains شماست. Open Trade معامله Gains را ثبت، ویرایش یا بسته نمی‌کند.",
                  )}
                </p>
              </aside>
            )}
            {!focus && ticket && (product === "prop" || !account) && (
              <aside
                ref={ticketElement}
                style={!ticketDock && ticketPosition && Number.isFinite(ticketPosition.x) && Number.isFinite(ticketPosition.y) ? { left: ticketPosition.x, top: ticketPosition.y, right: "auto", bottom: "auto" } : undefined}
                aria-label={t("Quick Trade", "معامله سریع")}
                className={
                  "ticket glass " + (ticketDock ? "docked" : "floating")
                }
              >
                <div className="ticket-head"
                  onPointerDown={(event) => {
                    const element = ticketElement.current;
                    if (!element || ticketDock || event.button !== 0 || (event.target as HTMLElement).closest("button, input, select, textarea")) return;
                    drag.current = { x: event.clientX, y: event.clientY, left: element.offsetLeft, top: element.offsetTop };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    const start = drag.current, element = ticketElement.current;
                    const workspace = element?.offsetParent;
                    if (!start || !element || !workspace) return;
                    /* moved directly; React state is committed once, on release */
                    const x = Math.max(0, Math.min(start.left + event.clientX - start.x, workspace.clientWidth - element.offsetWidth));
                    const y = Math.max(0, Math.min(start.top + event.clientY - start.y, workspace.clientHeight - element.offsetHeight));
                    Object.assign(element.style, { left: x + "px", top: y + "px", right: "auto", bottom: "auto" });
                  }}
                  onLostPointerCapture={() => {
                    const element = ticketElement.current;
                    if (drag.current && element) setTicketPosition({ x: element.offsetLeft, y: element.offsetTop });
                    drag.current = null;
                  }}
                >
                  <strong>{selected.symbol}</strong>
                  <span className="order-type">{t("MARKET", "بازار")} ⇄</span>
                  <button
                    title={t(
                      "Dock / float order ticket",
                      "اتصال / شناورسازی سفارش",
                    )}
                    aria-label={t("Dock / float order ticket", "اتصال / شناورسازی سفارش")}
                    onClick={() => setTicketDock(!ticketDock)}
                  >
                    ◧
                  </button>
                  <button
                    aria-label={t("Hide order ticket", "پنهان کردن برگه سفارش")}
                    onClick={() => setTicket(false)}
                  >
                    ⌄
                  </button>
                </div>
                <div className="ticket-fields">
                  <label>
                    {t("Leverage", "اهرم")}
                    <input
                      aria-label={t("Leverage", "اهرم")}
                      value={leverage}
                      type="number"
                      min="1"
                      onChange={(e) => {
                        setLeverage(e.target.value);
                        setPreview(null);
                      }}
                    />
                  </label>
                  <label>
                    {t("SL", "حد ضرر")}
                    <input
                      aria-label={t("Stop loss", "حد ضرر")}
                      value={sl}
                      type="number"
                      min="0"
                      placeholder="—"
                      onChange={(e) => {
                        setSl(e.target.value);
                        setPreview(null);
                      }}
                    />
                  </label>
                  <label>
                    {t("TP", "حد سود")}
                    <input
                      aria-label={t("Take profit", "حد سود")}
                      value={tp}
                      type="number"
                      min="0"
                      placeholder="—"
                      onChange={(e) => {
                        setTp(e.target.value);
                        setPreview(null);
                      }}
                    />
                  </label>
                </div>
                <div className="ticket-quotes">
                  <span className="negative" dir="ltr">{money(price?.mark)}</span>
                  <span>
                    {t("Available", "آزاد")}:{" "}
                    {money(state?.account?.free_margin)}
                  </span>
                  <span className="positive">
                    {fresh
                      ? t("Live mark", "قیمت زنده")
                      : t("Unavailable", "ناموجود")}
                  </span>
                </div>
                <div className="ticket-execution">
                  <button
                    className="sell"
                    disabled={!ready}
                    onClick={() => void estimate("short")}
                  >
                    {t("SELL", "فروش")}
                  </button>
                  <div className="size-control">
                    <input
                      aria-label={t("Order size", "اندازه سفارش")}
                      value={margin}
                      type="number"
                      min="0"
                      onChange={(e) => {
                        setMargin(e.target.value);
                        setPreview(null);
                      }}
                    />
                    <select
                      aria-label={t("Sizing mode", "روش اندازه‌گذاری")}
                      value={mode}
                      onChange={(e) => {
                        setMode(e.target.value);
                        setPreview(null);
                      }}
                    >
                      <option value="collateral">
                        {t("Collateral", "وثیقه")}
                      </option>
                      <option value="lots" disabled={!lot.available}>
                        {t("Lotage", "لاتیج")}
                      </option>
                    </select>
                  </div>
                  <button
                    className="buy"
                    disabled={!ready}
                    onClick={() => void estimate("long")}
                  >
                    {t("BUY", "خرید")}
                  </button>
                </div>
                {!account && (
                  <button
                    className="ticket-login"
                    onClick={() => setAccountMenu(true)}
                  >
                    {t(
                      "Connect account to trade",
                      "برای معامله حساب را متصل کنید",
                    )}{" "}
                    <DirArrow kind="external" />
                  </button>
                )}
                {preview && (
                  <div className="preview">
                    <strong>
                      {t("Review order", "بررسی سفارش")} · {sideLabel(t, preview.body.side)}
                    </strong>
                    <p>
                      {t("Quantity", "تعداد")}: {preview.data.quantity} ·{" "}
                      {t("Fee", "کارمزد")}: {money(preview.data.open_fee)}
                    </p>
                    <button
                      className="primary"
                      disabled={!ready || clock - preview.time > 15000}
                      onClick={() => void confirm()}
                    >
                      {t("Confirm order", "تأیید سفارش")}
                    </button>
                  </div>
                )}
                {pending && (
                  <div role="alert" className="warning">
                    <strong>
                      {t("Unconfirmed operation", "عملیات تأییدنشده")}
                    </strong>
                    <p>
                      {t("Operation ID", "شناسه عملیات")}: <bdi dir="ltr">{pending.key}</bdi>
                    </p>
                    <button onClick={() => void reconcile()}>
                      {t("Reconcile operation", "تطبیق عملیات")}
                    </button>
                  </div>
                )}
              </aside>
            )}
          </section>
        </main>
      )}
      {notice && (
        <div role="status" className="notice glass">
          {notice}
          <button aria-label={t("Close", "بستن")} onClick={() => setNotice("")}>×</button>
        </div>
      )}
      {update && (
        <div role="status" className="notice glass update-notice">
          {format(t, "Open Trade ${version} is available.", "نسخهٔ ${version} اوپن ترید منتشر شده است.", { version: update.version })}{" "}
          <button onClick={() => void bridge.external("release:" + update.tag)}>
            {t("View release", "مشاهدهٔ انتشار")}
          </button>
          <button
            onClick={() => {
              localStorage.setItem("ot-update-deferred", JSON.stringify(update.version));
              setUpdate(null);
            }}
          >
            {t("Later", "بعداً")}
          </button>
        </div>
      )}
      {missing.length > 0 && (
        <div className="untranslated muted" role="note">
          {t(
            "Some text is not yet translated and is shown in English.",
            "بخشی از متن هنوز ترجمه نشده و به انگلیسی نمایش داده می‌شود.",
          )}
        </div>
      )}
      <footer>
        <span>
          Open Trade <bdi dir="ltr">{config.version}</bdi> ·{" "}
          {config.signed ? t("Signed build", "نسخهٔ امضاشده") : t("Unsigned internal build", "نسخهٔ داخلی بدون امضا")}
        </span>
        <span dir="ltr">
          {config.origin || t("Backend not configured", "سرویس تنظیم نشده")}
        </span>
        <span>
          <button onClick={() => void bridge.external("vela")}>Vela</button> ·{" "}
          <button onClick={() => void bridge.external("source")}>
            {t("Source code & notices", "کد منبع و مجوزها")}
          </button>
        </span>
      </footer>
      {menu && (
        <div
          className="desktop-menu glass"
          role="menu"
          style={{
            left: Math.min(menu.x, innerWidth - 220),
            top: Math.min(menu.y, innerHeight - 230),
          }}
          onMouseLeave={() => setMenu(null)}
        >
          <button
            role="menuitem"
            onClick={() => {
              setWatch(!watch);
              setMenu(null);
            }}
          >
            {t("Watchlist", "دیده‌بان")} <kbd>Alt W</kbd>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setTicket(!ticket);
              setMenu(null);
            }}
          >
            {t("Quick Trade", "معامله سریع")} <kbd>Alt T</kbd>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setPositionsOpen(!positionsOpen);
              setMenu(null);
            }}
          >
            {t("Positions", "موقعیت‌ها")} <kbd>Alt P</kbd>
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setSettings(true);
              setMenu(null);
            }}
          >
            {t("Settings", "تنظیمات")} <kbd>⌘ ,</kbd>
          </button>
        </div>
      )}
      {accountMenu && (
        <div className="modal-backdrop" onClick={() => setAccountMenu(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={t("Accounts", "حساب‌ها")}
            className="account-dialog glass"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-title">
              <h2>{t("Accounts", "حساب‌ها")}</h2>
              <button aria-label={t("Close", "بستن")} onClick={() => setAccountMenu(false)}>×</button>
            </div>
            {user ? (
              directory(() => {
                setAccountMenu(false);
                setPositionsOpen(true);
              })
            ) : (
              <>
                <p className="muted">
                  {t(
                    "Connect the wallet linked to your Openfund account.",
                    "کیف پول متصل به حساب اوپن‌فاند را انتخاب کنید.",
                  )}
                </p>
                <button
                  className="primary"
                  disabled={busy || network !== "online" || config.projectIdStatus !== "configured"}
                  onClick={() => void login()}
                >
                  {busy
                    ? t("Waiting for wallet…", "در انتظار کیف پول…")
                    : t("Connect wallet", "اتصال کیف پول")}
                </button>
                <small>Arbitrum One · 42161</small>
              </>
            )}
          </section>
        </div>
      )}
      {chartImage && <div className="modal-backdrop">
        <section className="settings glass chart-preview" role="dialog" aria-modal="true" aria-label={t("Chart capture preview", "پیش‌نمایش تصویر نمودار")}>
          <div className="panel-title"><h2>{t("Chart capture preview", "پیش‌نمایش تصویر نمودار")}</h2><button aria-label={t("Close", "بستن")} onClick={() => setChartImage("")}>×</button></div>
          <img src={chartImage} alt={t("Captured chart", "تصویر نمودار")} />
          <button onClick={() => void bridge.saveChart(chartImage).catch((error: unknown) => setNotice(String(error)))}>{t("Save PNG", "ذخیره PNG")}</button>
          <button onClick={() => void bridge.copyChart(chartImage).then(() => setNotice(t("Chart copied to clipboard.", "نمودار در کلیپ‌بورد کپی شد."))).catch((error: unknown) => setNotice(String(error)))}>{t("Copy image", "کپی تصویر")}</button>
        </section>
      </div>}
      {settings && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={t("Settings", "تنظیمات")}
            className="settings glass"
          >
            <div className="panel-title">
              <h2>{t("Settings", "تنظیمات")}</h2>
              <button aria-label={t("Close", "بستن")} onClick={() => setSettings(false)}>×</button>
            </div>
            <label>
              {t("Language", "زبان")}
              <select aria-label={t("Language", "زبان")} value={locale} onChange={(e) => chooseLocale(e.target.value as AppLocale)}>
                {LOCALES.map((l) => (
                  <option key={l} value={l} lang={l}>{LOCALE_NAMES[l]}</option>
                ))}
              </select>
            </label>
            <label>
              {t("Appearance", "ظاهر")}
              <select aria-label={t("Appearance", "ظاهر")} value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="dark">{t("Dark", "تیره")}</option>
                <option value="light">{t("Light", "روشن")}</option>
              </select>
            </label>
            <div className="workspace-settings">
              <h3>{t("Workspace", "فضای کاری")}</h3>
              <button onClick={() => { setLayout(1); setActive(0); setMax(null); setTicketPosition(null); setPanelHeight(180); setChartSplit(66); setTicketDock(false); }}>{t("Reset workspace layout", "بازنشانی چیدمان")}</button>
            </div>
            <p className="muted">
              {config.secureStorage
                ? t(
                    "Session storage is protected by your operating system.",
                    "نشست با رمزگذاری سیستم‌عامل محافظت می‌شود.",
                  )
                : t(
                    "Encrypted storage unavailable: session is kept in memory only.",
                    "ذخیره رمزگذاری‌شده در دسترس نیست؛ نشست فقط در حافظه نگهداری می‌شود.",
                  )}
            </p>
            <section className="about" aria-label={t("About Open Trade", "درباره اوپن ترید")}>
              <h3>{t("About Open Trade", "درباره اوپن ترید")}</h3>
              <dl>
                <dt>{t("Version", "نسخه")}</dt>
                <dd dir="ltr">{config.version}{config.channel ? " · " + config.channel : ""}</dd>
                <dt>{t("Build", "بیلد")}</dt>
                <dd dir="ltr">{config.sha ? String(config.sha).slice(0, 12) : "—"}</dd>
                <dt>{t("Signature", "امضا")}</dt>
                <dd>{config.signed ? t("Signed build", "نسخهٔ امضاشده") : t("Unsigned internal build", "نسخهٔ داخلی بدون امضا")}</dd>
                <dt>{t("Server", "سرور")}</dt>
                <dd dir="ltr">{config.origin || "—"}</dd>
              </dl>
              <p className="muted">
                {t(
                  "Open Trade never installs updates by itself. When a newer official release is published, you are notified and can open its release page.",
                  "اوپن ترید هرگز به‌روزرسانی را خودکار نصب نمی‌کند. با انتشار نسخهٔ رسمی جدید به شما اطلاع داده می‌شود و می‌توانید صفحهٔ انتشار را باز کنید.",
                )}
              </p>
              <button onClick={() => void checkUpdates(true)}>
                {t("Check for updates", "بررسی به‌روزرسانی")}
              </button>
            </section>
          </section>
        </div>
      )}
    </div>
  );
}
function connectionLabel(t: Translate, status: string) {
  switch (status) {
    case "ready":
      return t("Live account", "حساب زنده");
    case "loading":
      return t("Loading account…", "در حال بارگذاری حساب…");
    case "disconnected":
      return t("Reconnecting to account…", "در حال اتصال مجدد به حساب…");
    case "expired":
      return t("Session expired. Sign in again.", "نشست منقضی شد. دوباره وارد شوید.");
    default:
      return status;
  }
}
const sideLabel = (t: Translate, side: unknown) =>
  side === "long" ? t("Long", "خرید") : side === "short" ? t("Short", "فروش") : String(side ?? "—");
/** Read-only Gains account records for the signed-in wallet. Mirrors the web
 * terminal's GainsPortfolio presentation rules (shared gainsView.ts): the
 * backend snapshot is the only source; nothing is computed or inferred here. */
function GainsPanel({ t, locale, resource, state, tab, onTab, open, onToggle, onOpen, height, onResize, onTx }: any) {
  const data = resource.data,
    rows = data?.[tab] || [],
    at = snapshotTime(data),
    severity = feedSeverity(state);
  const status =
    state === "live" ? t("Up to date", "به‌روز")
    : state === "stale" ? t("Source data is stale", "دادهٔ منبع قدیمی است")
    : state === "inconsistent" ? t("Source timestamps are inconsistent", "زمان‌های منبع ناسازگار است")
    : state === "outdated" ? t("Connection failed; showing last verified data (outdated)", "اتصال ناموفق؛ آخرین دادهٔ تأییدشده (قدیمی)")
    : state === "unavailable" ? t("Provider unavailable", "ارائه‌دهنده در دسترس نیست")
    : state === "loading" ? t("Loading records from Gains…", "در حال دریافت اطلاعات از Gains…")
    : t("Sign in to view your Gains account.", "برای مشاهدهٔ حساب Gains وارد شوید.");
  const tabs: [string, string, string, number | undefined][] = [
    ["positions", "Open positions", "پوزیشن باز", data?.positions?.length],
    ["orders", "Open orders", "سفارش باز", data?.orders?.length],
    ["history", "Trade history", "تاریخچهٔ معاملات", data?.history?.length],
  ];
  return (
    <section
      className={"positions gains-panel " + (open ? "expanded" : "collapsed")}
      style={open ? { height } : undefined}
      aria-label={t("Gains account records", "رکوردهای حساب Gains")}
    >
      <div
        className="positions-divider"
        aria-label={t("Resize trading panel", "تغییر اندازهٔ پنل معاملات")}
        title={t("Drag to open, resize or close", "برای باز کردن، تغییر اندازه یا بستن بکشید")}
        {...panelDrag(open, height, onOpen, onResize)}
      >
        <span className="grip" aria-hidden="true" />
      </div>
      <nav role="tablist" aria-label={t("Gains account records", "رکوردهای حساب Gains")}>
        <button aria-label={t("Expand or collapse positions", "باز یا بسته کردن موقعیت‌ها")} onClick={onToggle}>
          {open ? "⌄" : "⌃"}
        </button>
        {tabs.map(([key, en, fa, n]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "selected" : ""} onClick={() => onTab(key)}>
            {t(en, fa)} ({n ?? "—"})
          </button>
        ))}
        <span className={"position-status gains-status " + severity} role={severity === "error" ? "alert" : "status"}>
          {status}
        </span>
      </nav>
      <div className="account-stats gains-source">
        <span>{t("Source", "منبع")}: <bdi dir="ltr">Gains Network</bdi></span>
        <span>{t("Network", "شبکه")}: <bdi dir="ltr">Arbitrum One · 42161</bdi></span>
        <span className="readonly-badge">{t("Read-only", "فقط خواندنی")}</span>
        {at && (
          <span>
            {t("Last fetched", "آخرین دریافت")}{" "}
            <bdi dir="ltr">{new Date(at).toLocaleString(intlLocale(locale))}</bdi>
          </span>
        )}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {(tab === "history"
                ? [
                    ["Time", "زمان"],
                    ["Symbol", "نماد"],
                    ["Event", "رویداد"],
                    ["Side", "جهت"],
                    ["Price", "قیمت"],
                    ["PnL", "سود/زیان"],
                    ["Collateral currency", "ارز وثیقه"],
                    ["Transaction", "تراکنش"],
                  ]
                : [
                    ...(tab === "orders" ? [["Order type", "نوع سفارش"]] : []),
                    ["Symbol", "نماد"],
                    ["Side", "جهت"],
                    ["Collateral", "وثیقه"],
                    ["Collateral currency", "ارز وثیقه"],
                    ["Leverage", "اهرم"],
                    ["Entry Price", "نقطه ورود"],
                    ["Stop loss", "حد ضرر"],
                    ["Take profit", "حد سود"],
                  ]
              ).map(([en, fa]) => (
                <th key={en}>{t(en, fa)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              const tx = arbiscanTx(r.tx);
              return tab === "history" ? (
                <tr key={r.key}>
                  <td dir="ltr">{new Date(r.date).toLocaleString(intlLocale(locale))}</td>
                  <td dir="ltr">{r.market ?? "—"}</td>
                  <td dir="ltr">{r.action}</td>
                  <td>{sideLabel(t, r.side)}</td>
                  <td dir="ltr">{native(r.price)}</td>
                  <td dir="ltr">{String(r.action).startsWith("TradeClosed") ? native(r.pnl) : "—"}</td>
                  <td dir="ltr">{r.currency ?? "—"}</td>
                  <td>
                    {tx ? (
                      <button className="link" onClick={() => onTx(r.tx)} title={tx}>
                        Arbiscan <DirArrow kind="external" />
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ) : (
                <tr key={r.id}>
                  {tab === "orders" && (
                    <td>{r.orderType === "limit" ? t("Limit", "لیمیت") : r.orderType === "stop" ? t("Stop", "استاپ") : r.orderType}</td>
                  )}
                  <td dir="ltr">{r.market}</td>
                  <td>{sideLabel(t, r.side)}</td>
                  <td dir="ltr">{native(r.margin)}</td>
                  <td dir="ltr">{r.currency}</td>
                  <td dir="ltr">{native(r.leverage)}×</td>
                  <td dir="ltr">{native(r.entry)}</td>
                  <td dir="ltr">{r.sl != null && Number(r.sl) ? native(r.sl) : "—"}</td>
                  <td dir="ltr">{r.tp != null && Number(r.tp) ? native(r.tp) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <p className="empty muted">
            {resource.error && !data
              ? t("Account records could not be retrieved. Please retry.", "دریافت اطلاعات ناموفق بود. دوباره تلاش کنید.")
              : resource.loading && !data
                ? t("Loading account records…", "در حال دریافت اطلاعات…")
                : t("No records to display.", "رکوردی برای نمایش وجود ندارد.")}
          </p>
        )}
        {tab === "history" && data?.pagination?.hasMore === true && (
          <p className="muted">
            {t(
              "Showing the latest 100 Gains events. Open the Openfund web terminal for the full history.",
              "۱۰۰ رویداد اخیر Gains نمایش داده می‌شود. برای تاریخچهٔ کامل ترمینال وب اوپن‌فاند را باز کنید.",
            )}
          </p>
        )}
      </div>
    </section>
  );
}
type ChartActions = {
  activate: (index: number) => void;
  market: (index: number, patch: any) => void;
  max: (index: number) => void;
  risk: (position: any, edit: any) => void;
  error: (message: string) => void;
};
type ChartProps = {
  index: number;
  symbol: string;
  timeframe: string;
  active: boolean;
  hidden: boolean;
  theme: string;
  t: Translate;
  locale: AppLocale;
  localeReady: number;
  wallet: string;
  account?: string;
  positions: any[];
  ready: boolean;
  actions: React.RefObject<ChartActions>;
};
/** Overlay-relevant fields only: snapshots that do not move a level keep the
 * drawn position boxes untouched. */
const positionSignature = (positions: any[], symbol: string) =>
  JSON.stringify(
    positions
      .filter((p) => p.market === symbol)
      .map((p) => [p.id, p.side, p.entry_price, p.sl_price, p.tp_price, p.opened_at]),
  );
/* Re-render a chart only when something it draws changes: never for a price
   flush, a clock tick or a panel drag elsewhere in the workspace. */
const Chart = React.memo(ChartView, (a, b) =>
  a.index === b.index && a.symbol === b.symbol && a.timeframe === b.timeframe &&
  a.active === b.active && a.hidden === b.hidden && a.theme === b.theme &&
  a.locale === b.locale && a.localeReady === b.localeReady && a.wallet === b.wallet &&
  a.account === b.account && a.positions === b.positions && a.ready === b.ready);
function ChartView({
  index,
  symbol,
  timeframe,
  active,
  hidden,
  theme,
  t,
  wallet,
  account,
  positions,
  ready,
  actions,
}: ChartProps) {
  const config = { symbol, timeframe };
  const host = useRef<HTMLDivElement>(null),
    controller = useRef<any>(null),
    managed = useRef(new Map<string, string>()),
    syncing = useRef(false),
    latest = useRef<any>({});
  latest.current = { positions, ready };
  const [failure, setFailure] = useState(""),
    [loaded, setLoaded] = useState(0);
  const applyTheme = (c: any, value: string) => {
    const light = value === "light";
    const palette = {
      background: light ? "#fafafa" : "#111113",
      textColor: light ? "#52525b" : "#b9bac2",
      gridColor: light ? "#0000000b" : "#ffffff08",
      borderColor: light ? "#00000018" : "#ffffff12",
      upColor: "#49b98b",
      downColor: "#ef676c",
      fontFamily: "Ubuntu, system-ui, sans-serif",
    };
    c.workspace.setTheme(palette);
    c.chart.renderer.applyConfig({
      layout: { background: palette.background, textColor: palette.textColor },
      grid: {
        vertLines: { color: palette.gridColor },
        horzLines: { color: palette.gridColor },
      },
    });
    c.chart.renderer.set({
      upColor: palette.upColor,
      downColor: palette.downColor,
      intro: false,
    });
  };
  useEffect(() => {
    if (!host.current) return;
    let disposed = false;
    const key = `ot-chart-${wallet}-${index}`;
    try {
      const c = window.OpenfundCharts.mount(host.current, {
        ...config,
        storageKey: key,
      });
      controller.current = c;
      c.on("load:start", () => {
        setLoaded(0);
        setFailure("");
      });
      c.on("load:end", (e: any) => setLoaded(e.bars || 0));
      c.on("error", (e: any) =>
        setFailure(e.message || "chart-unavailable"),
      );
      Promise.resolve(c.chart.ready()).then(() => {
        if (disposed) return;
        applyTheme(c, theme);
        const saved = read<any[]>("ot-drawings-" + key, []);
        for (const d of saved) {
          if (!String(d.type).startsWith("of-"))
            try {
              c.chart.drawings.add(d.type, d);
            } catch {}
        }
      });
      const save = () => {
        if (syncing.current) return;
        try {
          localStorage.setItem(
            "ot-drawings-" + key,
            JSON.stringify(
              c.chart.drawings
                .all()
                .filter((d: any) => !String(d.type).startsWith("of-")),
            ),
          );
        } catch {}
      };
      c.on("market:changed", (e: any) => {
        const m = e?.market || c.chart.market;
        if (m?.symbol)
          actions.current.market(index, {
            symbol: m.symbol.replace(/^gains:/, ""),
            timeframe: m.timeframe,
          });
      });
      c.on("drawing:created", save);
      c.on("drawing:removed", save);
      c.on("drawing:edited", (e: any) => {
        if (syncing.current) return;
        const pair = [...managed.current].find(([, id]) => id === e.id);
        if (!pair) {
          save();
          return;
        }
        const p = latest.current.positions.find((p: any) => p.id === pair[0]),
          d = c.chart.drawings.all().find((d: any) => d.id === e.id);
        if (!p || !d || !latest.current.ready) return;
        const edit = window.OpenfundPositionOverlay.riskEdit(
          {
            entry: Number(p.entry_price),
            sl: p.sl_price == null ? null : Number(p.sl_price),
            tp: p.tp_price == null ? null : Number(p.tp_price),
            side: p.side,
          },
          { sl: d.anchors[1]?.price, tp: d.anchors[2]?.price },
          8,
          { allowCreate: true },
        );
        if (edit.error) actions.current.error(edit.error);
        else if (edit.changed)
          actions.current.risk(p, { sl: edit.sl, tp: edit.tp });
      });
    } catch (e) {
      setFailure(String(e));
    }
    return () => {
      disposed = true;
      controller.current?.destroy();
      controller.current = null;
      managed.current.clear();
    };
  }, [wallet, index]);
  useEffect(() => {
    if (controller.current) applyTheme(controller.current, theme);
  }, [theme]);
  useEffect(() => {
    const c = controller.current;
    if (
      c &&
      (c.chart.market.symbol !== "gains:" + config.symbol ||
        c.chart.market.timeframe !== config.timeframe)
    )
      Promise.resolve(c.chart.ready())
        .then(() => c.setMarket(config))
        .catch((e) => setFailure(String(e)));
  }, [symbol, timeframe]);
  const overlay = positionSignature(positions, symbol);
  useEffect(() => {
    const c = controller.current;
    if (!c?.chart?.drawings) return;
    const dr = c.chart.drawings;
    syncing.current = true;
    try {
      for (const id of managed.current.values()) dr.remove(id);
      managed.current.clear();
      for (const p of positions) {
        if (p.market !== config.symbol) continue;
        const entry = Number(p.entry_price),
          bar = 60000,
          span = window.OpenfundPositionOverlay.span(
            Date.parse(p.opened_at),
            Date.now(),
            bar,
            12,
          );
        const anchors = [
          { time: span.start, price: entry },
          {
            time: span.end,
            price: p.sl_price == null ? entry : Number(p.sl_price),
          },
          {
            time: span.end,
            price: p.tp_price == null ? entry : Number(p.tp_price),
          },
        ];
        const d = dr.add("of-position", { paneId: "price", anchors });
        if (d) {
          managed.current.set(p.id, d.id);
          dr.update(d.id, {
            anchors,
            locked: !ready,
            props: {
              showText: false,
              showPrices: true,
              showLossSize: false,
              showHeader: p.sl_price != null && p.tp_price != null,
              showStopLabel: p.sl_price != null,
              showTargetLabel: p.tp_price != null,
              profitColor: "#82e7bd33",
              lossColor: "#e8948333",
              ofSide: p.side,
              ofEditable: ready ? ["stop", "target"] : [],
              ofMissing: [
                p.sl_price == null ? "stop" : null,
                p.tp_price == null ? "target" : null,
              ].filter(Boolean),
            },
          });
        }
      }
    } finally {
      syncing.current = false;
    }
    /* keyed on the overlay signature, not on each snapshot's new array */
  }, [overlay, ready, symbol, account, loaded > 0]);
  return (
    <section
      className={"chart-cell " + (active ? "active" : "")}
      data-loaded-bars={loaded}
      hidden={hidden}
      onPointerDown={() => actions.current.activate(index)}
      dir="ltr"
    >
      <div className="chart-title">
        <input
          aria-label={format(t, "Chart ${number} symbol", "نماد نمودار ${number}", { number: index + 1 })}
          value={symbol}
          onChange={(e) => actions.current.market(index, { symbol: e.target.value })}
        />
        <span>{index + 1}</span>
        <button aria-label={t("Maximize chart", "بزرگ‌نمایی نمودار")} onClick={() => actions.current.max(index)}>
          ⛶
        </button>
      </div>
      {/* Openfund chart mark: the same corner, glyph and hover reveal as the
          web terminal (legacy/terminal.css .chart-brand). */}
      <div className="chart-brand" aria-hidden="true">
        <span className="brand-o">O</span>
        <span className="brand-rest">penfund</span>
        <small>Chart by Openfund Data</small>
      </div>
      {(failure || !loaded) && (
        <div className="chart-loading" role="status">
          {failure === "chart-unavailable"
            ? t("Chart data unavailable", "دادهٔ نمودار در دسترس نیست")
            : failure || t("Loading market history…", "در حال بارگذاری سابقهٔ بازار…")}
        </div>
      )}
      <div ref={host} className="chart-host" />
    </section>
  );
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <App />
  </Boundary>,
);
