import { intlLocale } from '../../i18n/locales'
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../../session/useOpenfundSession";
import { useTerminal } from "./TerminalContext";
import { money, route } from "./model";
import { Metric } from "./Dashboard";

/** Challenge evaluation dashboard (v0.3.1): live rules-of-record metrics,
 *  lifecycle actions (start), violation history and event timeline —
 *  every number comes from the backend's evaluation engine, never the UI. */
export function ChallengePanel({ challengeId }: { challengeId: string }) {
  const { product, locale, t } = useTerminal(), session = useSession();
  const [view, setView] = useState<any>(null), [error, setError] = useState(false),
    [starting, setStarting] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`${(window as any).__ofBackendUrl || ""}/challenges/${challengeId}`, { credentials: "include" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (active) { setView(data); setError(false); }
      } catch { if (active) setError(true); }
    };
    void load();
    const timer = setInterval(load, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [challengeId, session.user?.id]);

  const start = async () => {
    setStarting(true);
    try {
      const res = await fetch(`${(window as any).__ofBackendUrl || ""}/challenges/${challengeId}/start`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch { setError(true); }
    setStarting(false);
    try {
      const res = await fetch(`${(window as any).__ofBackendUrl || ""}/challenges/${challengeId}`, { credentials: "include" });
      if (res.ok) setView(await res.json());
    } catch { /* the polling effect will retry */ }
  };

  if (error) return <section className="of-panel" role="alert">
    <h2>{t("ارزیابی چالش", "Challenge evaluation")}</h2>
    <p>{t("دریافت وضعیت ارزیابی ناموفق بود.", "Evaluation status could not be loaded.")}</p>
  </section>;
  if (!view) return <section className="of-panel"><h2>{t("ارزیابی چالش", "Challenge evaluation")}</h2>
    <p>{t("در حال دریافت وضعیت ارزیابی…", "Loading evaluation status…")}</p></section>;

  const m = view.metrics || {}, rules = view.rules || {},
    statusFa: Record<string, string> = { created: "آمادهٔ شروع", started: "در حال ارزیابی", passed: "قبول‌شده", failed: "مردود", expired: "منقضی", cancelled: "لغو‌شده" },
    statusEn: Record<string, string> = { created: "Ready to start", started: "Evaluation active", passed: "Passed", failed: "Failed", expired: "Expired", cancelled: "Cancelled" };
  const status = locale === "fa" ? (statusFa[view.status] || view.status) : (statusEn[view.status] || view.status);
  const stage = view.stage > 1 ? ` · ${t("مرحله", "Stage")} ${view.stage}` : rules.phases === 0 ? ` · ${t("فاندشده", "Funded")}` : "";
  const unit = "USD";

  return <section className="of-panel of-challenge-panel" data-status={view.status}>
    <div className="of-dashboard-heading">
      <div>
        <span className="of-eyebrow">{t("ارزیابی چالش", "Challenge evaluation")}</span>
        <h2>{view.planName}</h2>
        <bdi>{status}{stage}</bdi>
      </div>
      {view.status === "created" && <button className="of-challenge-start" onClick={start} disabled={starting}>
        {starting ? t("در حال شروع…", "Starting…") : t("شروع چالش", "Start challenge")}
      </button>}
      {view.status === "started" && <Link to={route(locale, product, "trade") + `?account=${encodeURIComponent(view.id)}`}>{t("ورود به ترمینال", "Open terminal")} ↗</Link>}
    </div>

    {view.metrics && <>
      <div className="of-metrics of-dashboard-summary">
        <Metric label={t(`ارزش حساب · ${unit}`, `Equity · ${unit}`)} value={m.equity} />
        <Metric label={t(`سود تحقق‌یافته · ${unit}`, `Realized PnL · ${unit}`)} value={m.realizedProfit} />
        {m.target?.amount != null && <Metric label={t(`هدف سود · ${unit}`, `Profit target · ${unit}`)} value={m.target.amount} />}
      </div>
      <dl className="of-dashboard-values">
        <div><dt>{t("مبنای سقف روزانه", "Daily loss basis")}</dt><dd dir="ltr">{money(m.day?.basis)} {unit}</dd></div>
        <div><dt>{t("افت روزانه", "Daily drawdown")}</dt><dd dir="ltr">{money(m.day?.dailyDrawdown)} / {money(m.daily?.limit)} {unit}</dd></div>
        <div><dt>{t("آستانهٔ سقف کل", "Max-loss threshold")}</dt><dd dir="ltr">{m.maximum?.threshold != null ? `${t("اکوییتی نباید به زیر", "equity must not fall below")} ${money(m.maximum.threshold)}` : "—"}</dd></div>
        {m.trailing?.peak && <div><dt>{t("بالاترین ارزش ثبت‌شده", "Recorded equity peak")}</dt><dd dir="ltr">{money(m.trailing.peak)} {unit}</dd></div>}
        <div><dt>{t("روزهای معاملاتی", "Trading days")}</dt><dd>{m.tradingDays ?? "—"}{rules.minTradingDays ? ` / ${rules.minTradingDays}` : ""}</dd></div>
        <div><dt>{t("قوانین ارزیابی", "Rules of record")}</dt><dd dir="ltr">{rules.rulesVersion ? `v${rules.rulesVersion} · UTC+3` : "—"}</dd></div>
        {view.expiresAt && <div><dt>{t("مهلت", "Time limit")}</dt><dd dir="ltr">{new Date(view.expiresAt).toLocaleDateString(intlLocale(locale))}</dd></div>}
      </dl>
      {m.target?.amount != null && <p role="status" className="of-challenge-progress">
        {m.target.reached
          ? t("هدف سود محقق شده است.", "Profit target reached.")
          : t(`فاصله تا هدف: ${unit} `, `Remaining to target: `) + money(Math.max(0, Number(m.target.amount) - Number(m.realizedProfit || 0)))}
        {rules.minTradingDays > 0 && ` · ${t("حداقل روز معاملاتی", "min trading days")}: ${m.tradingDays ?? 0}/${rules.minTradingDays}`}
      </p>}
      {view.violations?.length ? <div role="alert" className="of-error">
        <b>{t("نقض قوانین", "Rule violations")}</b>
        <ul>{view.violations.map((v: any, i: number) => <li key={i} dir="ltr">{v.rule}{v.detail?.threshold ? ` · ${JSON.stringify(v.detail).slice(0, 120)}` : ""}</li>)}</ul>
      </div> : null}
    </>}

    {view.events?.length ? <details className="of-challenge-events">
      <summary>{t("تاریخچهٔ رویدادها", "Event history")}</summary>
      <ul>{view.events.map((e: any, i: number) => <li key={i}><bdo dir="ltr">{new Date(e.ts).toLocaleString(intlLocale(locale))}</bdo> · {e.kind}</li>)}</ul>
    </details> : null}

    {view.status !== "started" && view.accountId && <p>{t("تاریخچهٔ معاملات این چالش در پورتفولیو و ژورنال قابل مشاهده است.", "This challenge's trading history remains available in the portfolio and journal.")}</p>}
  </section>;
}
