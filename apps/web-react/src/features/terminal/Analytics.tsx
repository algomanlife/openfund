import { useState } from "react";
import { useTerminal } from "./TerminalContext";
import { money } from "./model";
export function Curve({
  points,
  unit = "DAI",
  format = money,
}: {
  points: { t: string; cumNetPnl: number }[];
  unit?: string;
  format?: (value: unknown) => string;
}) {
  const { t } = useTerminal();
  if (!points.length)
    return (
      <p>{t("داده‌ای برای نمودار موجود نیست.", "No chart data available.")}</p>
    );
  const values = points.map((p) => p.cumNetPnl),
    min = Math.min(0, ...values),
    max = Math.max(0, ...values),
    height = 160;
  const x = (i: number) => 10 + (i / Math.max(1, points.length - 1)) * 780,
    y = (n: number) =>
      height - 10 - ((n - min) / (max - min || 1)) * (height - 20);
  return (
    <svg
      className="of-curve"
      viewBox={`0 0 800 ${height}`}
      role="img"
      aria-label={t("منحنی سود تحقق‌یافته", "Realized PnL curve")}
    >
      <line
        x1="10"
        x2="790"
        y1={y(0)}
        y2={y(0)}
        stroke="currentColor"
        opacity=".2"
      />
      <polyline
        points={points.map((p, i) => `${x(i)},${y(p.cumNetPnl)}`).join(" ")}
        fill="none"
        stroke="var(--of-mint)"
        strokeWidth="2"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(p.cumNetPnl)}
          r="3"
          fill="var(--of-mint)"
        >
          <title>
            {p.t}: {format(p.cumNetPnl)} {unit}
          </title>
        </circle>
      ))}
    </svg>
  );
}
export function PnlCalendar({
  days,
  onDate,
  countLabel = ["معامله", "trades"],
  format = money,
}: {
  days: any[];
  countLabel?: [string, string];
  format?: (value: unknown) => string;
  onDate: (date: string) => void;
}) {
  const { locale, t } = useTerminal(),
    [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [year, mo] = month.split("-").map(Number),
    count = new Date(Date.UTC(year, mo, 0)).getUTCDate(),
    start = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const byDay = new Map(days.map((d) => [d.date, d])),
    change = (n: number) =>
      setMonth(
        new Date(Date.UTC(year, mo - 1 + n, 1)).toISOString().slice(0, 7),
      );
  return (
    <div className="of-calendar">
      <div className="of-calendar-nav">
        <button
          aria-label={t("ماه قبل", "Previous month")}
          onClick={() => change(-1)}
        >
          ‹
        </button>
        <b>
          {new Date(`${month}-01T00:00:00Z`).toLocaleDateString(
            `${locale === "fa" ? "fa-IR" : "en-US"}-u-ca-gregory`,
            { month: "long", year: "numeric", timeZone: "UTC" },
          )}{" "}
          · UTC
        </b>
        <button
          aria-label={t("ماه بعد", "Next month")}
          onClick={() => change(1)}
        >
          ›
        </button>
        <input
          aria-label={t("انتخاب ماه", "Choose month")}
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
        />
      </div>
      <div className="of-calendar-grid">
        {(locale === "fa"
          ? [
              "یکشنبه",
              "دوشنبه",
              "سه‌شنبه",
              "چهارشنبه",
              "پنجشنبه",
              "جمعه",
              "شنبه",
            ]
          : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        ).map((d) => (
          <small key={d}>{d}</small>
        ))}
        {Array.from({ length: start }, (_, i) => (
          <span key={`pad${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`,
            d = byDay.get(date);
          return (
            <button
              key={date}
              onClick={() => onDate(date)}
              aria-label={`${date}: ${d?.trades || 0} ${t(...countLabel)}`}
            >
              <span>{i + 1}</span>
              {d && (
                <>
                  <b
                    dir="ltr"
                    className={d.netPnl >= 0 ? "positive" : "negative"}
                  >
                    {format(d.netPnl)}
                  </b>
                  <small>
                    {d.trades} {t(...countLabel)}
                  </small>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
