import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTerminal } from "./TerminalContext";
import { api, csvCell, download, money, route, useResource } from "./model";
import { Curve, PnlCalendar, RatioGauge } from "./Analytics";
import { AccountPicker } from "./Accounts";
import { GainsAnalytics } from "./GainsPortfolio";
export const JOURNAL_CARD_LABELS = [
  ["Net P&L", "سود خالص"],
  ["Trade Win %", "درصد معاملات موفق"],
  ["Profit Factor", "ضریب سود"],
  ["Day Win %", "درصد روزهای موفق"],
  ["Avg Win / Loss", "میانگین سود به زیان"],
  ["Edge Score", "امتیاز عملکرد"],
];
const labels = JOURNAL_CARD_LABELS;
export function JournalAnalytics({
  calendarOnly = false,
  reports = false,
}: {
  calendarOnly?: boolean;
  reports?: boolean;
}) {
  const { product, context, t, locale } = useTerminal(),
    navigate = useNavigate(),
    [range, setRange] = useState("All"),
    [market, setMarket] = useState(""),
    [side, setSide] = useState(""),
    [showFilters, setShowFilters] = useState(false),
    [layout, setLayout] = useState("comfortable"),
    [hidden, setHidden] = useState<string[]>([]),
    [customize, setCustomize] = useState(false),
    [prefError, setPrefError] = useState(""),
    [preferenceStatus,setPreferenceStatus]=useState("");
  const preferenceRef=useRef({range:"All",layout:"comfortable",hidden:[] as string[]}),preferenceQueue=useRef<Promise<void>>(Promise.resolve()),preferenceRevision=useRef(0);
  const preferences = useResource(product, "/preferences");
  useEffect(() => {
    if (preferences.data) {
      preferenceRef.current=preferences.data;
      setRange(preferences.data.range);
      setLayout(preferences.data.layout);
      setHidden(preferences.data.hidden || []);
    }
  }, [preferences.data]);
  const to = new Date().toISOString().slice(0, 10),
    from =
      range === "All"
        ? ""
        : range === "YTD"
          ? `${to.slice(0, 4)}-01-01`
          : new Date(Date.now() - (Number(range.slice(0, -1)) - 1) * 86400000)
              .toISOString()
              .slice(0, 10);
  const query = new URLSearchParams({ from, to, market, side }).toString();
  const overview = useResource(
      product,
      product === "prop" ? `/overview?${query}` : null,
      0,
      true,
    ),
    trades = useResource(
      product,
      product === "prop" ? `/trades?${query}&limit=10` : null,
      0,
      true,
    ),
    buckets = useResource(
      product,
      product === "prop" ? `/buckets?${query}` : null,
      0,
      true,
    );
  const savePreferences = (next: any) => {
    const accountScope = context?.accountRef;
    const snapshot={...preferenceRef.current,...next};preferenceRef.current=snapshot;
    const revision=++preferenceRevision.current;
    setPrefError("");setPreferenceStatus(t("در حال ذخیرهٔ تنظیمات…","Saving preferences…"));
    const write=preferenceQueue.current.catch(()=>{}).then(async()=>{
      try {
        await api(product,"/preferences",{method:"PUT",keepalive:true,body:JSON.stringify(snapshot)},accountScope);
        if(revision===preferenceRevision.current)setPreferenceStatus(t("تنظیمات ذخیره شد.","Preferences saved."));
      } catch(e){if(revision===preferenceRevision.current){setPrefError((e as Error).message);setPreferenceStatus("")}}
    });
    preferenceQueue.current=write;return write;
  };
  const d = overview.data,
    m = d?.metrics,
    a = d?.account,
    unit = a?.currency || context?.state?.account?.currency || "USD",
    readOnly = context?.state?.account?.status === "permanently_disabled";
  const vals = [
    money(m?.netPnl),
    m?.winRate == null ? "—" : `${money(m.winRate * 100)}%`,
    m?.profitFactorIsInfinite ? "∞" : money(m?.profitFactor),
    m?.dayWinRate == null ? "—" : `${money(m.dayWinRate * 100)}%`,
    money(m?.avgWinLossRatio),
    money(d?.edgeScore?.score),
  ];
  const exportReport = () =>
    download(
      `${product}-performance.csv`,
      [
        [
          "Account",
          "From UTC",
          "To UTC",
          "Closed trades",
          "Net PnL",
          "Win rate",
          "Profit factor",
          "Currency",
        ],
        [
          context?.accountRef,
          from,
          to,
          m?.closedTrades,
          m?.netPnl,
          m?.winRate,
          m?.profitFactor,
          unit,
        ],
      ]
        .map((r) => r.map(csvCell).join(","))
        .join("\n"),
      "text/csv",
    );
  return (
    <>
      <div className="of-account-bar of-journal-toolbar">
        <AccountPicker />
        <div className="of-segmented" role="group" aria-label={t("بازهٔ زمانی", "Date range")}>
          {["7D", "30D", "90D", "YTD", "All"].map((v) => (
            <button
              key={v}
              disabled={!preferences.data}
                aria-pressed={v === range}
              onClick={() => {
                setRange(v);
                if (!readOnly) void savePreferences({ range: v });
              }}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="of-toolbar-actions">
          <button aria-expanded={showFilters} onClick={() => setShowFilters((x) => !x)}>
            {t("فیلترها", "Filters")}
          </button>
          <label>
            {t("چیدمان", "Layouts")}{" "}
            <select
              disabled={readOnly || !preferences.data}
              aria-label="Journal layout"
              value={layout}
              onChange={(e) => {
                setLayout(e.target.value);
                void savePreferences({ layout: e.target.value });
              }}
            >
              <option value="comfortable">{t("راحت", "Comfortable")}</option>
              <option value="compact">{t("فشرده", "Compact")}</option>
            </select>
          </label>
          <button aria-expanded={customize} onClick={() => setCustomize((x) => !x)}>
            {t("شخصی‌سازی", "Customize")}
          </button>
          {reports && (
            <button disabled={!d} onClick={exportReport}>
              {t("خروجی گزارش CSV", "Export report CSV")}
            </button>
          )}
        </div>
      </div>
      {showFilters && (
        <div className="of-filters">
          <label>
            {t("نماد", "Instrument")}
            <input
              aria-label="Analytics instrument"
              value={market}
              onChange={(e) => setMarket(e.target.value)}
            />
          </label>
          <label>
            {t("جهت", "Direction")}
            <select value={side} onChange={(e) => setSide(e.target.value)}>
              <option value="">All</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </label>
          <span>
            UTC · {from || "All"} → {to}
          </span>
        </div>
      )}
      {preferenceStatus && <p role="status">{preferenceStatus}</p>}
      {prefError && <p role="alert">{prefError}</p>}
      {customize && (
        <div className="of-filters">
          {labels.map(([en, fa]) => (
            <label key={en}>
              <input
                type="checkbox"
                disabled={readOnly || !preferences.data}
                checked={!hidden.includes(en)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? hidden.filter((v) => v !== en)
                    : [...hidden, en];
                  setHidden(next);
                  void savePreferences({ hidden: next });
                }}
              />
              {t(fa, en)}
            </label>
          ))}
        </div>
      )}
      {product === "perpetual" ? (
        <GainsAnalytics />
      ) : overview.error ? (
        <p role="alert">{overview.error}</p>
      ) : (
        <div
          className={`of-journal-analytics ${layout === "compact" ? "compact" : ""}`}
        >
          {!calendarOnly && (
            <>
              <div className="of-metrics">
                {labels
                  .filter(([en]) => !hidden.includes(en))
                  .map(([en, fa]) => (
                    <section className="of-metric" key={en}>
                      <span>
                        {t(fa, en)}
                        {en === "Net P&L" ? ` · ${unit}` : ""}
                      </span>
                      {en === "Trade Win %" || en === "Day Win %" ? <RatioGauge label={t(fa,en)} value={en === "Trade Win %" ? m?.winRate : m?.dayWinRate}/> : <b dir="ltr">{vals[labels.findIndex((r) => r[0] === en)]}</b>}
                      {en === "Net P&L" && <small>{m?.closedTrades ?? "—"} {t("معاملهٔ بسته", "closed trades")}</small>}
                      {en === "Avg Win / Loss" && <small dir="ltr">{money(m?.avgWin)} / {money(m?.avgLoss)} {unit}</small>}
                    </section>
                  ))}
              </div>
              <div className="of-analytics-grid">
                <section className="of-panel">
                  <h2>
                    {t("امتیاز عملکرد", "Edge Score")} · v
                    {d?.edgeScore?.version || 2}
                  </h2>
                  {d?.edgeScore?.score == null ? (
                    <p>
                      {t(
                        "حداقل ۵ معاملهٔ بسته لازم است.",
                        "At least five closed trades are required.",
                      )}
                    </p>
                  ) : (
                    <EdgeRadar components={d.edgeScore.components} />
                  )}
                </section>
                <section className="of-panel">
                  <h2>
                    {t("سود خالص انباشته", "Daily Net Cumulative P&L")} · {unit}
                  </h2>
                  <Curve points={d?.equityCurve || []} unit={unit} />
                  <h3>{t("افت نسبی","Relative drawdown")} · %</h3>
                  <DailyBars days={(d?.relativeDrawdownCurve || []).filter((p:any)=>p.drawdownPct!==null).map((p:any)=>({date:p.t,netPnl:-p.drawdownPct*100}))}/>
                  <p>
                    {t("بیشترین افت نسبی", "Maximum relative drawdown")}:{" "}
                    {d?.drawdown?.maxDrawdownPct == null
                      ? "—"
                      : money(d.drawdown.maxDrawdownPct * 100) + "%"}
                  </p>
                </section>
                <section className="of-panel">
                  <h2>
                    {t("سود خالص روزانه", "Net Daily P&L")} · {unit}
                  </h2>
                  <DailyBars days={d?.daily || []} />
                </section>
              </div>
            </>
          )}
          <div className="of-journal-lower">
            <section className="of-panel">
              <h2>{t("تقویم معاملات", "Trading Calendar")}</h2>
              <PnlCalendar
                days={d?.daily || []}
                onDate={(date) =>
                  navigate(`/${locale}/${product}/journal?account=${encodeURIComponent(context.accountRef)}&section=daily&date=${date}`)
                }
              />
            </section>
            {!calendarOnly && (
              <section className="of-panel">
                <h2>{t("فعالیت", "Activity")}</h2>
                <Link to={route(locale, product, "portfolio")}>
                  {t(
                    "معاملات اخیر و پوزیشن‌های باز",
                    "Recent Trades & Open Positions",
                  )}{" "}
                  ↗
                </Link>
                <p>
                  {t("پوزیشن باز", "Open Positions")}: {a?.openPositions ?? "—"}
                </p>
                {(() => {
                  const recent = trades.data?.trades?.filter((r: any) => r.status !== "open") || [];
                  if (!recent.length) return null;
                  return (
                    <div className="of-activity" role="table" aria-label={t("معاملات اخیر", "Recent trades")}>
                      <div className="of-activity-row of-activity-head" role="row">
                        <span role="columnheader">{t("نماد", "Symbol")}</span>
                        <span role="columnheader">{t("جهت", "Side")}</span>
                        <span role="columnheader">{t("سود / زیان", "P&L")} · {unit}</span>
                      </div>
                      {recent.map((r: any) => (
                        <Link
                          className="of-activity-row of-trade-activity"
                          role="row"
                          key={r.key}
                          to={`${route(locale, product, "journal")}${route(locale, product, "journal").includes("?") ? "&" : "?"}trade=${r.ofPositionId}&section=notebook`}
                        >
                          <bdi role="cell" className="of-activity-symbol">{r.symbol}</bdi>
                          <span role="cell" className={`of-side-badge ${String(r.direction).toLowerCase() === "short" ? "short" : "long"}`}>
                            {String(r.direction).toLowerCase() === "short" ? t("شورت", "Short") : t("لانگ", "Long")}
                          </span>
                          <bdi role="cell" dir="ltr" className={`of-activity-pnl ${r.netPnl > 0 ? "positive" : r.netPnl < 0 ? "negative" : ""}`}>
                            {r.netPnl > 0 ? "+" : ""}{money(r.netPnl)}
                          </bdi>
                        </Link>
                      ))}
                    </div>
                  );
                })()}
              </section>
            )}
          </div>
          {reports && (
            <>
              <div className="of-analytics-grid">
                <section className="of-panel">
                  <h2>
                    {t("منحنی موجودی", "Balance curve")} · {unit}
                  </h2>
                  <Curve points={d?.balanceCurve || []} unit={unit} />
                </section>
                <section className="of-panel">
                  <h2>
                    {t("ارزش حساب ثبت‌شده", "Observed equity curve")} · {unit}
                  </h2>
                  <Curve points={d?.observedEquityCurve || []} unit={unit} />
                  <p>
                    {t(
                      "فقط مشاهدات به‌روز ثبت‌شده؛ سابقه بازسازی نمی‌شود.",
                      "Fresh observations only; earlier mark-to-market history is not reconstructed.",
                    )}
                  </p>
                </section>
              </div>
              <section className="of-panel">
                <h2>{t("عملکرد بر اساس نماد", "Performance by instrument")}</h2>
                {(buckets.data?.symbol || buckets.data?.bySymbol || []).map(
                  (b: any, i: number) => (
                    <p key={i}>
                      {b.key || b.symbol}: {money(b.netPnl)} {unit}
                    </p>
                  ),
                )}
              </section>
            </>
          )}
        </div>
      )}
    </>
  );
}
function DailyBars({ days }: { days: any[] }) {
  if (!days.length) return <p>No closed trading days in this range.</p>;
  const max = Math.max(1, ...days.map((d) => Math.abs(d.netPnl)));
  return (
    <svg viewBox="0 0 600 180" role="img" aria-label="Daily net PnL">
      <line
        x1="0"
        y1="90"
        x2="600"
        y2="90"
        stroke="currentColor"
        opacity=".2"
      />
      {days.map((d, i) => {
        const h = (Math.abs(d.netPnl) / max) * 80;
        return (
          <rect
            key={d.date}
            x={(i * 600) / days.length}
            y={d.netPnl >= 0 ? 90 - h : 90}
            width={Math.max(1, 600 / days.length - 3)}
            height={h}
            fill={d.netPnl >= 0 ? "var(--of-mint)" : "var(--of-chart-negative)"}
          >
            <title>
              {d.date}: {money(d.netPnl)}
            </title>
          </rect>
        );
      })}
    </svg>
  );
}
function EdgeRadar({ components }: { components: Record<string, number> }) {
  /* Presentation only: the component values come from the API unchanged. */
  const entries = Object.entries(components),
    n = Math.max(entries.length, 3),
    cx = 200,
    cy = 175,
    R = 118,
    angle = (i: number) => (i * 2 * Math.PI) / n,
    point = (i: number, r: number) => [cx + Math.sin(angle(i)) * r, cy - Math.cos(angle(i)) * r];
  return (
    <svg className="of-edge-radar" viewBox="0 0 400 350" role="img" aria-label="Edge Score components">
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon
          key={r}
          points={entries.map((_, i) => point(i, R * r).join(",")).join(" ")}
          fill="none"
          stroke="currentColor"
          opacity={r === 1 ? 0.4 : 0.2}
        />
      ))}
      {entries.map((_, i) => {
        const [x, y] = point(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" opacity=".2" />;
      })}
      {[25, 50, 75].map((v) => (
        <text key={v} x={cx + 4} y={cy - (R * v) / 100 + 4} fontSize="10" fill="currentColor" opacity=".55">{v}</text>
      ))}
      <polygon
        points={entries.map(([, v], i) => point(i, (R * Math.max(0, Math.min(100, v))) / 100).join(",")).join(" ")}
        fill="var(--of-chart-fill)"
        stroke="var(--of-mint)"
        strokeWidth="2"
      />
      {entries.map(([, v], i) => {
        const [x, y] = point(i, (R * Math.max(0, Math.min(100, v))) / 100);
        return <circle key={i} cx={x} cy={y} r="3.5" fill="var(--of-mint)" />;
      })}
      {entries.map(([k, v], i) => {
        const [x, y] = point(i, R + 20),
          dx = x - cx,
          anchor = Math.abs(dx) < 8 ? "middle" : dx > 0 ? "start" : "end",
          top = y < cy - R / 2;
        return (
          <text key={k} x={x} y={top ? y - 10 : y} textAnchor={anchor} fill="currentColor" direction="ltr">
            <tspan x={x} fontSize="13" opacity=".8">{k}</tspan>
            <tspan x={x} dy="17" fontSize="14" fontWeight="700" fill="var(--of-mint)">{money(v)}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
