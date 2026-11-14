import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createSiweMessage } from "viem/siwe";
import { getAddress, stringToHex } from "viem";
import { acceptSnapshot, retryDelay } from "../electron/policy.mjs";
import "./style.css";
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
  v == null
    ? "—"
    : Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
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
class Boundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="startup">
        <h1>Open Trade</h1>
        <p>
          The workspace could not render. Restart the application to recover.
        </p>
      </main>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [locale, setLocale] = useState(read("ot-locale", "en")),
    [theme, setTheme] = useState(read("ot-theme", "dark"));
  const t = (en: string, fa: string) => (locale === "fa" ? fa : en);
  const [config, setConfig] = useState<any>({ origin: "", projectId: "" }),
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
  const [charts, setCharts] = useState(read("ot-charts", defaults)),
    [layout, setLayout] = useState<number>(read("ot-layout", 1)),
    [active, setActive] = useState(0),
    [max, setMax] = useState<number | null>(null),
    [focus, setFocus] = useState(false),
    [watch, setWatch] = useState(false),
    [ticket, setTicket] = useState(true),
    [tab, setTab] = useState("positions");
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
  const [positionsOpen, setPositionsOpen] = useState(false),
    [ticketDock, setTicketDock] = useState(false),
    [accountMenu, setAccountMenu] = useState(false),
    [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const scope = useRef(""),
    provider = useRef<any>(null),
    operation = useRef(false),
    generation = useRef(0);
  const selected = charts[active] || charts[0],
    meta = markets.get(selected.symbol),
    price = prices[selected.symbol];
  const fresh = feed === "live" && price && clock - price.updatedAt < 45000;
  const ready =
    !!account &&
    !account.readOnly &&
    state?.account?.status === "active" &&
    state?.account?.valuation_status === "fresh" &&
    connection === "ready" &&
    network === "online" &&
    fresh &&
    !pending &&
    !busy;
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
    localStorage.setItem("ot-locale", JSON.stringify(locale));
  }, [locale]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ot-theme", JSON.stringify(theme));
  }, [theme]);
  useEffect(() => {
    localStorage.setItem("ot-charts", JSON.stringify(charts));
    setPreview(null);
  }, [charts]);
  useEffect(() => {
    localStorage.setItem("ot-layout", JSON.stringify(layout));
  }, [layout]);
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 2000);
    return () => clearInterval(id);
  }, []);
  async function loadAccounts() {
    const result = await request("/accounts");
    if (!result.ok)
      throw new Error(result.error || "Account directory unavailable");
    setAccounts(result.data.accounts);
  }
  async function restore() {
    const result = await request("/auth/me");
    if (result.ok) {
      setUser(result.data.user);
      await loadAccounts();
    } else if (result.status === 401) setUser(null);
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
    const p = window.OpenfundGains.subscribePrices((v: any) =>
      setPrices((old) => ({ ...old, [v.market]: v })),
    );
    const s = window.OpenfundGains.subscribeStatus(setFeed);
    return () => {
      stopped = true;
      p();
      s();
    };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettings(false);
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
      if (mod && ["1", "2", "4"].includes(e.key)) {
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
    const id = account?.id || "";
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
  }, [account?.id]);
  async function logout() {
    generation.current++;
    setAccount(null);
    setUser(null);
    setAccounts([]);
    setExplore(false);
    await request("/auth/logout", {});
    try {
      await provider.current?.disconnect();
    } catch {}
    provider.current = null;
  }
  async function login() {
    setBusy(true);
    setNotice("");
    const gen = ++generation.current;
    try {
      if (!config.projectId)
        throw new Error(
          t(
            "Set the WalletConnect project ID in Settings to connect your wallet.",
            "شناسه پروژه WalletConnect را در تنظیمات وارد کنید.",
          ),
        );
      const { EthereumProvider } = await import(
        "@walletconnect/ethereum-provider"
      );
      const wallet = await EthereumProvider.init({
        projectId: config.projectId,
        chains: [42161],
        showQrModal: true,
        methods: ["personal_sign"],
        events: ["accountsChanged", "chainChanged"],
        metadata: {
          name: "Open Trade",
          description: "Openfund desktop wallet sign-in",
          url: config.origin,
          icons: [],
        },
      });
      provider.current = wallet;
      await wallet.connect();
      if (gen !== generation.current) return;
      if (wallet.chainId !== 42161)
        throw new Error("Arbitrum One is required.");
      const address = getAddress(wallet.accounts[0]);
      const nonce = await request("/auth/nonce", { address });
      if (!nonce.ok) throw new Error(nonce.error);
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
      if (!result.ok)
        throw new Error(result.error || "Authentication rejected");
      const verified = await request("/auth/me");
      if (
        !verified.ok ||
        verified.data.user?.walletAddress?.toLowerCase() !==
          address.toLowerCase()
      )
        throw new Error("Verified wallet session mismatch");
      setUser(verified.data.user);
      await loadAccounts();
      wallet.on("accountsChanged", () => {
        void logout();
      });
      wallet.on("chainChanged", () => {
        void logout();
      });
      wallet.on("disconnect", () => {
        generation.current++;
        setUser(null);
        setAccount(null);
        void request("/auth/logout", {});
      });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Wallet connection failed");
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
  const lot = window.OpenfundPositionSizing.lotSpec(meta, selected.symbol);
  const terminal = !!account || explore;
  return (
    <div className="app">
      <header className="titlebar">
        <div className="window-title">
          Open Trade <span>0.0.1 BETA</span>
        </div>
        <div className="titlebar-actions">
          {terminal && (
            <>
              <button
                aria-label="Select account"
                onClick={() => setAccountMenu(true)}
              >
                {account?.name || t("Connect account", "اتصال حساب")} ▾
              </button>
              <span className="connection-dot" title={network}>
                ●
              </span>
            </>
          )}
          <button
            aria-label="Settings"
            title="Settings · ⌘,"
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
          <section className="launch glass">
            <img className="emblem" src="./assets/mark-mint.svg" />
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
              <div className="accounts">
                {accounts
                  .filter((a) => a.product === "prop")
                  .map((a) => (
                    <button
                      key={a.id}
                      disabled={network !== "online"}
                      onClick={() => setAccount(a)}
                    >
                      <span>
                        {a.name}
                        <small>
                          {a.type} · {a.status}
                        </small>
                      </span>
                      <strong>
                        {money(a.equity)} {a.currency || ""}
                      </strong>
                    </button>
                  ))}
                <button onClick={() => void logout()}>
                  {t("Disconnect wallet", "قطع اتصال کیف پول")}
                </button>
              </div>
            ) : (
              <button
                className="primary"
                disabled={busy || network !== "online"}
                onClick={() => void login()}
              >
                {busy
                  ? t("Waiting for wallet…", "در انتظار کیف پول…")
                  : t("Connect wallet", "اتصال کیف پول")}{" "}
                ↗
              </button>
            )}
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
          <nav className="app-rail" aria-label="Workspace panels">
            <img src="./assets/mark-mint.svg" />
            <span className="beta-label">BETA</span>
            <button
              aria-label="Toggle watchlist"
              title="Watchlist · Alt+W"
              className={watch ? "selected" : ""}
              onClick={() => setWatch(!watch)}
            >
              ☷
            </button>
            <button
              aria-label="Toggle quick trade"
              title="Quick Trade · Alt+T"
              className={ticket ? "selected" : ""}
              onClick={() => setTicket(!ticket)}
            >
              ⇄
            </button>
            <button
              aria-label="Toggle positions"
              title="Positions · Alt+P"
              className={positionsOpen ? "selected" : ""}
              onClick={() => setPositionsOpen(!positionsOpen)}
            >
              ▤
            </button>
            <button
              aria-label="Focus mode"
              title="Focus · ⌘⇧F"
              onClick={() => setFocus(!focus)}
            >
              ⛶
            </button>
            <div className="rail-space" />
            <button
              aria-label="Select account"
              title="Account"
              onClick={() => setAccountMenu(true)}
            >
              ◎
            </button>
            <button
              aria-label="Settings"
              title="Settings · ⌘,"
              onClick={() => setSettings(true)}
            >
              ⚙
            </button>
          </nav>
          {!focus && watch && (
            <aside className="watch glass">
              <div className="panel-title">
                {t("Watchlist", "دیده‌بان")}
                <button onClick={() => setWatch(false)}>×</button>
              </div>
              <input
                aria-label="Search markets"
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
                  <b>{money(prices[m.symbol]?.mark)}</b>
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
                {[1, 2, 4].map((n) => (
                  <button
                    aria-label={`${n} chart layout`}
                    title={`${n} chart${n === 1 ? "" : "s"} · ⌘${n}`}
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
                <button aria-label="Watchlist" onClick={() => setWatch(!watch)}>
                  {t("Watchlist", "دیده‌بان")}
                </button>
                <button
                  aria-label="Quick Trade"
                  onClick={() => setTicket(!ticket)}
                >
                  {t("Quick Trade", "معامله سریع")}
                </button>
              </div>
            </nav>
            <div
              className={
                "charts layout-" + layout + (max !== null ? " maximized" : "")
              }
            >
              {charts.slice(0, layout).map((c, i) => (
                <Chart
                  key={i}
                  index={i}
                  config={c}
                  active={active === i}
                  hidden={max !== null && max !== i}
                  theme={theme}
                  wallet={user?.id || "guest"}
                  account={account?.id}
                  positions={state?.positions || []}
                  ready={ready}
                  onActivate={() => setActive(i)}
                  onMarket={(p: any) => updateChart(i, p)}
                  onMax={() => setMax(max === i ? null : i)}
                  onRisk={(p: any, edit: any) =>
                    void mutate(`/trading/positions/${p.id}/protection`, edit)
                  }
                  onError={setNotice}
                />
              ))}
            </div>
            {!focus && (
              <section
                className={
                  "positions " + (positionsOpen ? "expanded" : "collapsed")
                }
              >
                <nav>
                  <button
                    aria-label="Expand or collapse positions"
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
                    onClick={() => {
                      setTab("activity");
                      setPositionsOpen(true);
                    }}
                  >
                    {t("Activity", "فعالیت")}
                  </button>
                  <span className="position-status muted">
                    {account
                      ? connection
                      : t(
                          "Sign in to load your account",
                          "برای مشاهده حساب وارد شوید",
                        )}
                  </span>
                </nav>
                <div className="account-stats">
                  <span>
                    {t("Balance", "موجودی")}{" "}
                    <b>{money(state?.account?.balance)}</b>
                  </span>
                  <span>
                    {t("Equity", "ارزش حساب")}{" "}
                    <b>{money(state?.account?.equity)}</b>
                  </span>
                  <span>
                    {t("Available", "آزاد")}{" "}
                    <b>{money(state?.account?.free_margin)}</b>
                  </span>
                  <span>
                    {t("Margin", "مارجین")}{" "}
                    <b>{money(state?.account?.used_margin)}</b>
                  </span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Market",
                          "Side",
                          "Entry / Target",
                          "P&L",
                          "SL",
                          "TP",
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
                          <td>{p.side}</td>
                          <td>{money(p.entry_price ?? p.target_price)}</td>
                          <td>{money(p.unrealized_pnl ?? p.realized_pnl)}</td>
                          <td>{money(p.sl_price)}</td>
                          <td>{money(p.tp_price)}</td>
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

            {!focus && ticket && (
              <aside
                aria-label="Quick Trade ticket"
                className={
                  "ticket glass " + (ticketDock ? "docked" : "floating")
                }
              >
                <div className="ticket-head">
                  <strong>{selected.symbol}</strong>
                  <span className="order-type">{t("MARKET", "بازار")} ⇄</span>
                  <button
                    title={t(
                      "Dock / float order ticket",
                      "اتصال / شناورسازی سفارش",
                    )}
                    aria-label="Dock order ticket"
                    onClick={() => setTicketDock(!ticketDock)}
                  >
                    ◧
                  </button>
                  <button
                    aria-label="Hide order ticket"
                    onClick={() => setTicket(false)}
                  >
                    ⌄
                  </button>
                </div>
                <div className="ticket-fields">
                  <label>
                    {t("Leverage", "اهرم")}
                    <input
                      aria-label="Leverage"
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
                    SL
                    <input
                      aria-label="Stop loss"
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
                    TP
                    <input
                      aria-label="Take profit"
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
                  <span className="negative">{money(price?.mark)}</span>
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
                      aria-label="Order size"
                      value={margin}
                      type="number"
                      min="0"
                      onChange={(e) => {
                        setMargin(e.target.value);
                        setPreview(null);
                      }}
                    />
                    <select
                      aria-label="Sizing mode"
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
                    ↗
                  </button>
                )}
                {preview && (
                  <div className="preview">
                    <strong>
                      {t("Review order", "بررسی سفارش")} · {preview.body.side}
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
                    <p>{pending.key}</p>
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
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      <footer>
        <span>Open Trade · {t("Internal beta", "بتای داخلی")}</span>
        <span>
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
            aria-label="Accounts"
            className="account-dialog glass"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-title">
              <h2>{t("Trading account", "حساب معاملاتی")}</h2>
              <button onClick={() => setAccountMenu(false)}>×</button>
            </div>
            {user ? (
              <div className="accounts">
                {accounts
                  .filter((a) => a.product === "prop")
                  .map((a) => (
                    <button
                      key={a.id}
                      disabled={busy || !!pending}
                      onClick={() => {
                        setAccount(a);
                        setAccountMenu(false);
                        setPositionsOpen(true);
                      }}
                    >
                      <span>
                        {a.name}
                        <small>{a.status}</small>
                      </span>
                      <strong>{money(a.equity)}</strong>
                    </button>
                  ))}
                <button
                  disabled={busy || !!pending}
                  onClick={() => void logout()}
                >
                  {t("Disconnect wallet", "قطع اتصال کیف پول")}
                </button>
              </div>
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
                  disabled={busy || network !== "online"}
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
      {settings && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            className="settings glass"
          >
            <div className="panel-title">
              <h2>{t("Settings", "تنظیمات")}</h2>
              <button onClick={() => setSettings(false)}>×</button>
            </div>
            <label>
              {t("Language", "زبان")}
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
              >
                <option value="en">English</option>
                <option value="fa">فارسی</option>
              </select>
            </label>
            <label>
              {t("Appearance", "ظاهر")}
              <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  await logout();
                  await bridge.configure({
                    origin: f.get("origin"),
                    projectId: f.get("projectId"),
                  });
                  setConfig(await bridge.config());
                  setNetwork(await bridge.connectivity());
                  setSettings(false);
                } catch (err) {
                  setNotice(String(err));
                }
              }}
            >
              <label>
                {t("Openfund backend", "آدرس سرویس اوپن‌فاند")}
                <input
                  name="origin"
                  defaultValue={config.origin}
                  required
                  type="url"
                  dir="ltr"
                />
              </label>
              <label>
                WalletConnect Project ID
                <input
                  name="projectId"
                  defaultValue={config.projectId}
                  dir="ltr"
                  autoComplete="off"
                />
              </label>
              <p className="muted">
                {t(
                  "Saving disconnects the current session. Authentication: Arbitrum One (42161).",
                  "ذخیره تنظیمات نشست فعلی را قطع می‌کند. شبکه احراز هویت: آربیتروم وان (۴۲۱۶۱).",
                )}
              </p>
              <button disabled={busy || !!pending} className="primary">
                {t("Save settings", "ذخیره تنظیمات")}
              </button>
            </form>
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
            <p className="muted">
              {t(
                "Automatic updates are disabled for unsigned beta builds.",
                "به‌روزرسانی خودکار برای نسخه بتای بدون امضا غیرفعال است.",
              )}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
function Chart({
  index,
  config,
  active,
  hidden,
  theme,
  wallet,
  account,
  positions,
  ready,
  onActivate,
  onMarket,
  onMax,
  onRisk,
  onError,
}: any) {
  const host = useRef<HTMLDivElement>(null),
    controller = useRef<any>(null),
    managed = useRef(new Map<string, string>()),
    syncing = useRef(false),
    latest = useRef<any>({});
  latest.current = { positions, ready, onRisk, onMarket, onError };
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
        setFailure(e.message || "Chart data unavailable"),
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
          latest.current.onMarket({
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
        if (edit.error) latest.current.onError(edit.error);
        else if (edit.changed)
          latest.current.onRisk(p, { sl: edit.sl, tp: edit.tp });
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
  }, [config.symbol, config.timeframe]);
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
  }, [positions, ready, config.symbol, account]);
  return (
    <section
      className={"chart-cell " + (active ? "active" : "")}
      data-loaded-bars={loaded}
      hidden={hidden}
      onPointerDown={onActivate}
      dir="ltr"
    >
      <div className="chart-title">
        <input
          aria-label={`Chart ${index + 1} symbol`}
          value={config.symbol}
          onChange={(e) => onMarket({ symbol: e.target.value })}
        />
        <span>{index + 1}</span>
        <button aria-label="Maximize chart" onClick={onMax}>
          ⛶
        </button>
      </div>
      {(failure || !loaded) && (
        <div className="chart-loading" role="status">
          {failure || "Loading market history…"}
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
