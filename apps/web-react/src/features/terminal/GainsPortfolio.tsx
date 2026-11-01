import { Curve, PnlCalendar } from "./Analytics";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../../session/useOpenfundSession";
import { useTerminal } from "./TerminalContext";
import { useResource, download, csvCell, route } from "./model";
import { Metric } from "./Dashboard";
// Native collateral can be fractional crypto; never round it to a false 0.00.
const nativeAmount = (value: unknown) =>
  value == null || !Number.isFinite(Number(value))
    ? "—"
    : Number(value).toLocaleString("en-US", { maximumFractionDigits: 10 });
/** Native Gains records retain their event/collateral semantics. We never
 * transform partial-close events into invented round trips or DAI balances. */
export function GainsSummary() {
  const { t } = useTerminal(),
    session = useSession(),
    data = useResource(
      "perpetual",
      session.status === "authenticated" ? "/gains" : null,
    );
  if (data.error)
    return (
      <p role="alert">
        {t(
          "دریافت اطلاعات حساب ناموفق بود.",
          "Account information could not be retrieved.",
        )}
      </p>
    );
  return (
    <div className="of-metrics">
      <Metric
        label={t("پوزیشن باز", "Open positions")}
        value={data.data?.positions.length}
      />
      <Metric
        label={t("سفارش باز", "Open orders")}
        value={data.data?.orders.length}
      />
      <Metric
        label={t("تعداد معاملات", "Total trades")}
        value={data.data?.stats.totalTrades}
      />
      <Metric
        label={t("نرخ برد · ٪", "Win rate · %")}
        value={data.data?.stats.winRate}
      />
    </div>
  );
}
export default function GainsPortfolio() {
  const { locale, t, context } = useTerminal(),
    [tab, setTab] = useState("positions"),
    [query, setQuery] = useState({ market: "", from: "", to: "" }),
    [cursor, setCursor] = useState(""),
    [cursors, setCursors] = useState<string[]>([]),
    [revision, setRevision] = useState(0);
  const params = new URLSearchParams(
      Object.entries({ ...query, cursor }).filter(([, v]) => v),
    ),
    data = useResource("perpetual", `/gains?${params}`, revision);
  const s = data.data,
    rows =
      tab === "positions"
        ? s?.positions
        : tab === "orders"
          ? s?.orders
          : s?.history;
  const change = (k: string, v: string) => {
    setQuery((x) => ({ ...x, [k]: v }));
    setCursor("");
    setCursors([]);
  };
  if (tab === "performance")
    return (
      <>
        <div className="of-tabs">
          <button onClick={() => setTab("history")}>
            {t("بازگشت به پورتفولیو", "Back to portfolio")}
          </button>
        </div>
        <GainsAnalytics />
      </>
    );
  const exportRows = () => {
    const keys =
      tab === "history"
        ? [
            "key",
            "date",
            "market",
            "action",
            "side",
            "price",
            "pnl",
            "currency",
            "tx",
          ]
        : [
            "id",
            "market",
            "side",
            "margin",
            "currency",
            "leverage",
            "entry",
            "sl",
            "tp",
          ];
    download(
      `perpetual-${tab}.csv`,
      "\uFEFF" +
        [keys, ...(rows || []).map((r: any) => keys.map((k) => r[k]))]
          .map((r) => r.map(csvCell).join(","))
          .join("\r\n"),
      "text/csv;charset=utf-8",
    );
  };
  return (
    <>
      <div className="of-account-bar">
        <bdi>{context?.wallet}</bdi>
        <span>Arbitrum</span>
        <button onClick={() => setRevision((x) => x + 1)}>
          {t("به‌روزرسانی", "Refresh")}
        </button>
        <Link to={route(locale, "perpetual", "journal")}>
          {t("ژورنال معاملات", "Trade Journal")}
        </Link>
      </div>
      <GainsSummary />
      <div className="of-tabs" role="tablist">
        {[
          ["positions", "پوزیشن‌ها", "Positions"],
          ["orders", "سفارش‌ها", "Orders"],
          ["history", "تاریخچه", "History"],
          ["performance", "عملکرد", "Performance"],
        ].map(([id, fa, en]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {t(fa, en)}
          </button>
        ))}
      </div>
      <div className="of-filters">
        <label>
          {t("جست‌وجوی نماد", "Search symbol")}
          <input
            value={query.market}
            onChange={(e) => change("market", e.target.value)}
          />
        </label>
        {tab === "history" && (
          <>
            <label>
              {t("از تاریخ · UTC", "From · UTC")}
              <input
                type="date"
                value={query.from}
                onChange={(e) => change("from", e.target.value)}
              />
            </label>
            <label>
              {t("تا تاریخ · UTC", "To · UTC")}
              <input
                type="date"
                value={query.to}
                onChange={(e) => change("to", e.target.value)}
              />
            </label>
          </>
        )}
        <button disabled={!rows?.length} onClick={exportRows}>
          {t("خروجی CSV", "Export CSV")}
        </button>
      </div>
      {data.loading && (
        <p role="status">
          {t("در حال دریافت اطلاعات…", "Loading account records…")}
        </p>
      )}
      {data.error && (
        <p className="of-error" role="alert">
          {t(
            "دریافت اطلاعات ناموفق بود. دوباره تلاش کنید.",
            "Account records could not be retrieved. Please retry.",
          )}
        </p>
      )}
      <div className="of-table-scroll">
        <table>
          <thead>
            <tr>
              {(tab === "history"
                ? [
                    "زمان|Time",
                    "نماد|Symbol",
                    "رویداد|Event",
                    "جهت|Side",
                    "قیمت|Price",
                    "سود/زیان|PnL",
                    "ارز وثیقه|Collateral currency",
                    "تراکنش|Transaction",
                  ]
                : [
                    "نماد|Symbol",
                    "جهت|Side",
                    "وثیقه|Collateral",
                    "ارز وثیقه|Collateral currency",
                    "اهرم|Leverage",
                    "قیمت ورود|Entry",
                    "حد ضرر|Stop loss",
                    "حد سود|Take profit",
                  ]
              ).map((x) => (
                <th key={x}>{t(...(x.split("|") as [string, string]))}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              ?.filter(
                (r: any) =>
                  tab === "history" ||
                  r.market.toLowerCase().includes(query.market.toLowerCase()),
              )
              .map((r: any) => (
                <tr key={r.id || r.key}>
                  {tab === "history" ? (
                    <>
                      <td>
                        {new Date(r.date).toLocaleString(
                          locale === "fa" ? "fa-IR" : "en-US",
                        )}
                      </td>
                      <td>{r.market}</td>
                      <td>{r.action}</td>
                      <td>{r.side}</td>
                      <td dir="ltr">{nativeAmount(r.price)}</td>
                      <td dir="ltr">
                        {r.action.startsWith("TradeClosed")
                          ? nativeAmount(r.pnl)
                          : "—"}
                      </td>
                      <td>{r.currency || "—"}</td>
                      <td>
                        <a
                          href={`https://arbiscan.io/tx/${r.tx}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {r.tx.slice(0, 10)}… ↗
                        </a>
                        <Link
                          to={`${route(locale, "perpetual", "journal")}?transaction=${encodeURIComponent(r.tx)}`}
                        >
                          {t("یادداشت", "Journal")}
                        </Link>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{r.market}</td>
                      <td>{r.side}</td>
                      <td dir="ltr">{nativeAmount(r.margin)}</td>
                      <td>{r.currency}</td>
                      <td>{r.leverage}×</td>
                      <td dir="ltr">{nativeAmount(r.entry)}</td>
                      <td dir="ltr">
                        {Number(r.sl) ? nativeAmount(r.sl) : "—"}
                      </td>
                      <td dir="ltr">
                        {Number(r.tp) ? nativeAmount(r.tp) : "—"}
                      </td>
                    </>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
        {!data.loading && !data.error && !rows?.length && (
          <p className="of-empty">
            {t("رکوردی برای نمایش وجود ندارد.", "No records to display.")}
          </p>
        )}
      </div>
      {tab === "history" && (
        <div className="of-pagination">
          <button
            disabled={!cursors.length}
            onClick={() => {
              setCursor(cursors.at(-1) || "");
              setCursors((x) => x.slice(0, -1));
            }}
          >
            {t("قبلی", "Previous")}
          </button>
          <span>{cursors.length + 1}</span>
          <button
            disabled={!s?.pagination.hasMore}
            onClick={() => {
              setCursors((x) => [...x, cursor]);
              setCursor(String(s.pagination.nextCursor));
            }}
          >
            {t("بعدی", "Next")}
          </button>
        </div>
      )}
    </>
  );
}

/** Per-collateral event analytics over the retrieved history page. */
export function GainsAnalytics() {
  const { locale, t } = useTerminal(),
    [selectedDate, setSelectedDate] = useState(""),
    [currency, setCurrency] = useState(""),
    [revision, setRevision] = useState(0),
    data = useResource("perpetual", "/gains", revision),
    s = data.data;
  const selected = currency || s?.collaterals[0]?.symbol,
    closed = (s?.history || []).filter(
      (e: any) =>
        e.currency === selected &&
        e.action.startsWith("TradeClosed") &&
        e.pnl !== null &&
        Number.isFinite(e.pnl),
    );
  const days = new Map<string, number>();
  for (const e of closed) {
    const day = e.date.slice(0, 10);
    days.set(day, (days.get(day) || 0) + Number(e.pnl || 0));
  }
  let cumulative = 0;
  const points = [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({ t: date, cumNetPnl: (cumulative += pnl) }));
  return (
    <section className="of-panel">
      <h2>
        {t("عملکرد رویدادهای خروج اخیر", "Recent closing-event performance")}
      </h2>
      <div className="of-filters">
        <label>
          {t("ارز وثیقه", "Collateral currency")}
          <select
            aria-label={t("ارز وثیقه", "Collateral currency")}
            value={selected || ""}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {s?.collaterals.map((c: any) => (
              <option key={c.index}>{c.symbol}</option>
            ))}
          </select>
        </label>
        <button onClick={() => setRevision((x) => x + 1)}>
          {t("به‌روزرسانی", "Refresh")}
        </button>
      </div>
      <p>
        {t("آخرین رویدادهای بازیابی‌شده", "Most recently retrieved events")}:{" "}
        {s?.history.length ?? "—"} · {selected}
      </p>
      <Curve points={points} unit={selected} format={nativeAmount} />
      <PnlCalendar
        days={[...days].map(([date, netPnl]) => ({
          date,
          netPnl,
          trades: closed.filter((e: any) => e.date.startsWith(date)).length,
        }))}
        onDate={setSelectedDate}
        countLabel={["رویداد خروج", "closing events"]}
        format={nativeAmount}
      />
      {selectedDate && (
        <button onClick={() => setSelectedDate("")}>
          {t("همهٔ تاریخ‌ها", "All dates")} · {selectedDate}
        </button>
      )}
      {data.loading && (
        <p role="status">{t("در حال دریافت اطلاعات…", "Loading…")}</p>
      )}
      {data.error && (
        <p role="alert">
          {t(
            "دریافت اطلاعات ناموفق بود.",
            "Could not retrieve account records.",
          )}
        </p>
      )}
      {[...days]
        .filter(([date]) => !selectedDate || date === selectedDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, pnl]) => (
          <p key={date}>
            <time>
              {new Date(date + "T00:00:00Z").toLocaleDateString(
                locale === "fa" ? "fa-IR" : "en-US",
                { timeZone: "UTC" },
              )}
            </time>{" "}
            ·{" "}
            <bdi>
              {nativeAmount(pnl)} {selected}
            </bdi>
          </p>
        ))}
      {!closed.length && !data.loading && !data.error && (
        <p>
          {t(
            "رویداد خروجی در این ارز یافت نشد.",
            "No closing events found for this currency.",
          )}
        </p>
      )}
    </section>
  );
}
