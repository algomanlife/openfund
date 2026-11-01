import { Curve, PnlCalendar } from "./Analytics";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../../session/useOpenfundSession";
import { AccessGate } from "./TerminalShell";
import { useTerminal } from "./TerminalContext";
import { api, csvCell, download, money, route, useResource } from "./model";
import { Metric } from "./Dashboard";
import GainsPortfolio from "./GainsPortfolio";
export default function ProductPortfolio() {
  const { product, locale, context, t, message } = useTerminal(),
    session = useSession(),
    [tab, setTab] = useState("positions"),
    [filter, setFilter] = useState({
      market: "",
      side: "",
      status: "",
      sort: "closed_desc",
      from: "",
      to: "",
    }),
    [page, setPage] = useState(0),
    [revision, setRevision] = useState(0),
    [detail, setDetail] = useState<any>(null),
    [draft, setDraft] = useState({ notes: "", tags: "" }),
    [actionError, setActionError] = useState(""),
    [busy, setBusy] = useState(false);
  const signed = session.status === "authenticated",
    query = new URLSearchParams(
      Object.entries(filter).filter(([, v]) => v),
    ).toString(),
    q = `?${query}&limit=20&offset=${page * 20}`;
  const overview = useResource(
      product,
      signed && product === "prop"
        ? `/overview?from=${filter.from}&to=${filter.to}`
        : null,
      revision,
    ),
    history = useResource(
      product,
      signed && product === "prop" ? `/trades${q}` : null,
      revision,
    ),
    orders = useResource(
      product,
      signed && tab === "orders"
        ? `/orders?market=${encodeURIComponent(filter.market)}&from=${filter.from}&to=${filter.to}&limit=20&offset=${page * 20}`
        : null,
      revision,
    ),
    buckets = useResource(
      product,
      signed && product === "prop"
        ? `/buckets?from=${filter.from}&to=${filter.to}`
        : null,
      revision,
    );
  const change = (k: string, v: string) => {
    setFilter((x) => ({ ...x, [k]: v }));
    setPage(0);
    setDetail(null);
  };
  if (!signed) return <AccessGate />;
  if (product === "perpetual") return <GainsPortfolio />;
  const data = overview.data,
    a = data?.account,
    m = data?.metrics,
    rows = history.data?.trades || [],
    total = tab === "orders" ? orders.data?.total : history.data?.total;
  const error = overview.error || history.error || orders.error || actionError;
  const open = async (id: string) => {
    setActionError("");
    try {
      const d = await api(product, `/trades/${id}`);
      setDetail(d);
      setDraft({ notes: d.note.notes, tags: d.note.tags.join(", ") });
    } catch (e) {
      setActionError((e as Error).message);
    }
  };
  const exportCsv = async () => {
    setBusy(true);
    setActionError("");
    try {
      const all: any[] = [];
      let offset = 0,
        total = 0;
      do {
        const result = await api(
          product,
          `/trades?${query}&limit=100&offset=${offset}`,
        );
        all.push(...result.trades);
        total = result.total;
        offset += 100;
      } while (offset < total);
      const cols = [
        "ofPositionId",
        "symbol",
        "direction",
        "openedAt",
        "closedAt",
        "ofEntryPrice",
        "ofExitPrice",
        "netPnl",
        "fees",
        "ofStatus",
      ];
      download(
        `${product}-trades.csv`,
        "\uFEFF" +
          [cols, ...all.map((row) => cols.map((k) => row[k]))]
            .map((r) => r.map(csvCell).join(","))
            .join("\r\n"),
        "text/csv;charset=utf-8",
      );
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="of-account-bar">
        <label>
          {t("حساب", "Account")}{" "}
          <select
            aria-label={t("انتخاب حساب", "Account selection")}
            value={context?.accountRef || ""}
            onChange={() => {
              setPage(0);
              setRevision((x) => x + 1);
            }}
          >
            {context?.accounts.map((a: any) => (
              <option key={a.id} value={a.id}>
                {a.type === "free_demo"
                  ? t("حساب تمرینی", "Practice account")
                  : t("کیف پول", "Wallet")}{" "}
                · {a.id}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => setRevision((x) => x + 1)}>
          {t("به‌روزرسانی", "Refresh")}
        </button>
        <Link to={route(locale, product, "journal")}>
          {t("ژورنال معاملات", "Trade Journal")} ↗
        </Link>
      </div>
      {error && (
        <p role="alert" className="of-error">
          {t(
            "عملیات ناموفق بود؛ دوباره تلاش کنید.",
            "Request failed; please retry.",
          )}
        </p>
      )}
      {overview.loading && (
        <p role="status">{t("در حال بارگذاری…", "Loading…")}</p>
      )}
      <div className="of-metrics">
        <Metric
          label={t("موجودی حساب · DAI", "Account balance · DAI")}
          value={a?.balance}
        />
        <Metric
          label={t("سود تحقق‌یافتهٔ حساب · DAI", "Account realized PnL · DAI")}
          value={a?.realizedPnl}
        />
        <Metric
          label={t("سود باز · DAI", "Unrealized PnL · DAI")}
          value={a?.unrealizedPnl}
        />
        <Metric
          label={t("مارجین مصرفی · DAI", "Used margin · DAI")}
          value={a?.usedMargin}
        />
      </div>
      <div className="of-tabs" role="tablist">
        {[
          ["positions", "پوزیشن‌ها", "Positions"],
          ["orders", "سفارش‌ها", "Orders"],
          ["performance", "عملکرد", "Performance"],
          ["calendar", "تقویم", "Calendar"],
        ].map(([id, fa, en]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              setPage(0);
            }}
          >
            {t(fa, en)}
          </button>
        ))}
      </div>
      <div className="of-filters">
        <label>
          {t("از تاریخ · UTC", "From · UTC")}
          <input
            type="date"
            value={filter.from}
            onChange={(e) => change("from", e.target.value)}
          />
        </label>
        <label>
          {t("تا تاریخ · UTC", "To · UTC")}
          <input
            type="date"
            value={filter.to}
            onChange={(e) => change("to", e.target.value)}
          />
        </label>
        {["positions", "orders"].includes(tab) && (
          <label>
            {t("جست‌وجوی نماد", "Search symbol")}
            <input
              type="search"
              value={filter.market}
              onChange={(e) => change("market", e.target.value)}
            />
          </label>
        )}
        {tab === "positions" && (
          <>
            <select
              aria-label={t("جهت", "Direction")}
              value={filter.side}
              onChange={(e) => change("side", e.target.value)}
            >
              <option value="">{t("همهٔ جهت‌ها", "All directions")}</option>
              <option value="long">{t("لانگ", "Long")}</option>
              <option value="short">{t("شورت", "Short")}</option>
            </select>
            <select
              aria-label={t("وضعیت", "Status")}
              value={filter.status}
              onChange={(e) => change("status", e.target.value)}
            >
              <option value="">{t("همهٔ وضعیت‌ها", "All statuses")}</option>
              {["open", "closed", "liquidated"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select
              aria-label={t("مرتب‌سازی", "Sort")}
              value={filter.sort}
              onChange={(e) => change("sort", e.target.value)}
            >
              {[
                ["closed_desc", "جدیدترین", "Latest"],
                ["opened_asc", "قدیمی‌ترین", "Oldest"],
                ["pnl_desc", "بیشترین سود", "Highest PnL"],
                ["pnl_asc", "کمترین سود", "Lowest PnL"],
              ].map(([id, fa, en]) => (
                <option key={id} value={id}>
                  {t(fa, en)}
                </option>
              ))}
            </select>
            <button disabled={busy} onClick={exportCsv}>
              {t("خروجی CSV", "Export CSV")}
            </button>
          </>
        )}
      </div>
      {tab === "positions" && (
        <div className="of-table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "نماد|Symbol",
                  "جهت|Side",
                  "باز شدن|Opened",
                  "بسته شدن|Closed",
                  "قیمت ورود|Entry",
                  "قیمت خروج|Exit",
                  "اهرم|Leverage",
                  "سود تحقق‌یافته · DAI|Realized PnL · DAI",
                  "کارمزد · DAI|Fees · DAI",
                  "وضعیت|Status",
                  "جزئیات|Details",
                ].map((s) => (
                  <th key={s}>{t(...(s.split("|") as [string, string]))}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.ofPositionId}>
                  <td>
                    <bdi>{r.symbol}</bdi>
                  </td>
                  <td>{r.direction}</td>
                  <td>
                    <time>
                      {new Date(r.openedAt).toLocaleString(
                        locale === "fa" ? "fa-IR" : "en-US",
                      )}
                    </time>
                  </td>
                  <td>
                    {r.closedAt
                      ? new Date(r.closedAt).toLocaleString(
                          locale === "fa" ? "fa-IR" : "en-US",
                        )
                      : "—"}
                  </td>
                  <td dir="ltr">{money(r.ofEntryPrice)}</td>
                  <td dir="ltr">{money(r.ofExitPrice)}</td>
                  <td>{r.ofLeverage}×</td>
                  <td dir="ltr">
                    {r.status === "open" ? "—" : money(r.netPnl)}
                  </td>
                  <td dir="ltr">{money(r.fees)}</td>
                  <td>{r.ofStatus}</td>
                  <td>
                    <button onClick={() => open(r.ofPositionId)}>
                      {t("جزئیات و یادداشت", "Details & notes")}
                    </button>
                    <Link
                      to={`${route(locale, product, "journal")}?trade=${r.ofPositionId}`}
                    >
                      {t("ژورنال", "Journal")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !history.loading && (
            <p className="of-empty">
              {message("emptyTrades") ||
                t("معامله‌ای یافت نشد.", "No trades found.")}
            </p>
          )}
        </div>
      )}
      {tab === "orders" && (
        <div className="of-table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "نماد|Symbol",
                  "نوع|Type",
                  "جهت|Side",
                  "وضعیت|Status",
                  "مارجین · DAI|Margin · DAI",
                  "اهرم|Leverage",
                  "زمان|Time",
                  "دلیل رد|Rejection reason",
                ].map((s) => (
                  <th key={s}>{t(...(s.split("|") as [string, string]))}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.data?.orders.map((o: any) => (
                <tr key={o.id}>
                  <td>{o.market}</td>
                  <td>{o.order_type}</td>
                  <td>{o.side}</td>
                  <td>{o.status}</td>
                  <td dir="ltr">{money(o.margin)}</td>
                  <td>{o.leverage}×</td>
                  <td>
                    {new Date(o.created_at).toLocaleString(
                      locale === "fa" ? "fa-IR" : "en-US",
                    )}
                  </td>
                  <td>{o.reject_reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.data?.total === 0 && (
            <p className="of-empty">
              {t("سفارشی یافت نشد.", "No orders found.")}
            </p>
          )}
        </div>
      )}
      {["positions", "orders"].includes(tab) && (
        <div className="of-pagination">
          <button disabled={page === 0} onClick={() => setPage((x) => x - 1)}>
            {t("قبلی", "Previous")}
          </button>
          <span>
            {page + 1} / {Math.max(1, Math.ceil((total || 0) / 20))} ·{" "}
            {total ?? "—"}
          </span>
          <button
            disabled={(page + 1) * 20 >= (total || 0)}
            onClick={() => setPage((x) => x + 1)}
          >
            {t("بعدی", "Next")}
          </button>
        </div>
      )}
      {tab === "performance" && (
        <>
          <div className="of-metrics">
            <Metric
              label={t("سود دوره · DAI", "Period PnL · DAI")}
              value={m?.netPnl}
            />
            <Metric
              label={t("نرخ برد · ٪", "Win rate · %")}
              value={m?.winRate == null ? null : m.winRate * 100}
            />
            <Metric
              label={t("فاکتور سود", "Profit factor")}
              value={m?.profitFactor}
            />
            <Metric
              label={t("افت سرمایه · DAI", "Drawdown · DAI")}
              value={data?.drawdown?.maxDrawdown}
            />
          </div>
          <section className="of-panel">
            <h2>Edge Score v{data?.edgeScore?.version || 2}</h2>
            <b dir="ltr">{money(data?.edgeScore?.score)} / 100</b>
            <div className="of-score-components">
              {Object.entries(data?.edgeScore?.components || {}).map(
                ([key, value]) => (
                  <div key={key}>
                    <span>{key}</span>
                    <meter
                      min={0}
                      max={100}
                      value={Number(value)}
                      aria-label={key}
                    />
                    <b>{money(value)}</b>
                  </div>
                ),
              )}
            </div>
          </section>
          <section className="of-panel">
            <h2>
              {t("منحنی سود تحقق‌یافته · DAI", "Realized PnL curve · DAI")}
            </h2>
            <p>{message("realizedCurve")}</p>
            <Curve points={data?.equityCurve || []} />
          </section>
          <div className="of-grid">
            {[
              "bySymbol",
              "byDirection",
              "byAssetClass",
              "byHour",
              "byWeekday",
              "byDuration",
              "byTag",
            ].map((k) => (
              <section className="of-panel" key={k}>
                <h3>
                  {k === "bySymbol"
                    ? t("نماد", "Symbol")
                    : k === "byDirection"
                      ? t("جهت", "Direction")
                      : k === "byAssetClass"
                        ? t("نوع دارایی", "Asset class")
                        : k === "byHour"
                          ? t("ساعت · UTC", "Hour · UTC")
                          : k === "byWeekday"
                            ? t("روز هفته · UTC", "Weekday · UTC")
                            : k === "byDuration"
                              ? t("مدت معامله", "Trade duration")
                              : t("تگ", "Tag")}
                </h3>
                {buckets.data?.[k].map((b: any) => (
                  <p key={b.key}>
                    <bdi>{b.key}</bdi> · {b.trades} ·{" "}
                    <bdi>{money(b.netPnl)} DAI</bdi>
                  </p>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
      {tab === "calendar" && (
        <PnlCalendar
          days={data?.daily || []}
          onDate={(date) => {
            setFilter((x) => ({ ...x, from: date, to: date }));
            setPage(0);
            setTab("positions");
          }}
        />
      )}
      {detail && (
        <div
          className="of-modal-backdrop"
          onKeyDown={(e) => {
            if (e.key === "Escape") setDetail(null);
            if (e.key === "Tab") {
              const focusable = Array.from(
                e.currentTarget.querySelectorAll<HTMLElement>(
                  "button,input,textarea,a[href]",
                ),
              ).filter((el) => !el.hasAttribute("disabled"));
              const first = focusable[0],
                last = focusable.at(-1);
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
              }
            }
          }}
        >
          <section
            className="of-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("جزئیات معامله", "Trade details")}
          >
            <button
              aria-label={t("بستن", "Close")}
              autoFocus
              onClick={() => setDetail(null)}
            >
              {t("بستن", "Close")} ×
            </button>
            <h2>{detail.trade.symbol}</h2>
            <p dir="ltr">{detail.trade.ofPositionId}</p>
            <p>
              {t("سود تحقق‌یافته · DAI", "Realized PnL · DAI")}:{" "}
              <bdi>
                {detail.trade.status === "open"
                  ? "—"
                  : money(detail.trade.netPnl)}
              </bdi>
            </p>
            <p>
              {t("سفارش", "Order")}: <bdi>{detail.order?.id}</bdi> ·{" "}
              {detail.order?.type}
            </p>
            <div className="of-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("رویداد", "Event")}</th>
                    <th>DAI</th>
                    <th>{t("موجودی پس از رویداد", "Balance after")}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.ledger.map((l: any, i: number) => (
                    <tr key={i}>
                      <td>{l.event}</td>
                      <td dir="ltr">{money(l.amount)}</td>
                      <td dir="ltr">{money(l.balanceAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <label>
              {t("یادداشت خصوصی", "Private note")}
              <textarea
                aria-label={t("یادداشت خصوصی", "Private note")}
                maxLength={4000}
                value={draft.notes}
                onChange={(e) =>
                  setDraft((x) => ({ ...x, notes: e.target.value }))
                }
              />
            </label>
            <label>
              {t("تگ‌ها با کاما", "Tags, comma separated")}
              <input
                aria-label={t("تگ‌ها با کاما", "Tags, comma separated")}
                value={draft.tags}
                onChange={(e) =>
                  setDraft((x) => ({ ...x, tags: e.target.value }))
                }
              />
            </label>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(product, "/notes", {
                    method: "PUT",
                    body: JSON.stringify({
                      tradeKey: detail.trade.key,
                      notes: draft.notes,
                      tags: draft.tags
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    }),
                  });
                  setDetail(null);
                } catch (e) {
                  setActionError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("ذخیرهٔ یادداشت", "Save note")}
            </button>
            {actionError && (
              <p role="alert">
                {t(
                  "ذخیره ناموفق بود. دوباره تلاش کنید.",
                  "Could not save. Please retry.",
                )}
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
