import { Link } from "react-router-dom";
import { useSession } from "../../session/useOpenfundSession";
import { AccessGate } from "./TerminalShell";
import { useTerminal } from "./TerminalContext";
import { GainsSummary } from "./GainsPortfolio";
import { useResource, money, route } from "./model";
export function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="of-metric">
      <span>{label}</span>
      <b dir="ltr">{money(value)}</b>
    </div>
  );
}
export function ProductDashboard() {
  const { product, locale, context, t, message } = useTerminal(),
    session = useSession();
  const overview = useResource(
    product,
    session.status === "authenticated" && product === "prop"
      ? "/overview"
      : null,
  );
  if (session.status !== "authenticated") return <AccessGate />;
  const a = overview.data?.account;
  return (
    <>
      <div className="of-account-bar">
        <span>{t("حساب فعال", "Active account")}</span>
        <bdi>{context?.accountRef || "—"}</bdi>
        <Link to={route(locale, product, "trade")}>
          {t("ورود به ترمینال", "Open terminal")} ↗
        </Link>
      </div>
      {overview.error && (
        <p role="alert" className="of-error">
          {t("دریافت خلاصه ناموفق بود.", "Summary unavailable.")}
        </p>
      )}
      {product === "prop" ? (
        <>
          <div className="of-metrics">
            <Metric
              label={t("موجودی حساب تمرینی · DAI", "Practice balance · DAI")}
              value={a?.balance}
            />
            <Metric
              label={t("ارزش حساب · DAI", "Equity · DAI")}
              value={a?.equity}
            />
            <Metric
              label={t("سود تحقق‌یافته · DAI", "Realized PnL · DAI")}
              value={a?.realizedPnl}
            />
            <Metric
              label={t("سود باز · DAI", "Unrealized PnL · DAI")}
              value={a?.unrealizedPnl}
            />
          </div>
          <div className="of-panel">
            <h2>{t("حساب معاملاتی", "Trading account")}</h2>
            <p>
              {t("وضعیت", "Status")}: {a?.status || "—"} ·{" "}
              {t("پوزیشن باز", "Open positions")}: {a?.openPositions ?? "—"}
            </p>
            <p>{message("evaluation")}</p>
            <p>
              {t("چالش‌های ثبت‌شده", "Registered challenges")}:{" "}
              {session.challenges.length}
            </p>
          </div>
        </>
      ) : (
        <div>
          <GainsSummary />
          <div className="of-panel">
            <h2>{t("کیف پول", "Wallet")}</h2>
            <p dir="ltr">{context?.wallet || session.user?.walletAddress}</p>
            <p>Gains Network · Arbitrum</p>
          </div>
        </div>
      )}
      <div className="of-quick-links">
        <Link to={route(locale, product, "portfolio")}>
          {t("مشاهدهٔ پورتفولیو", "View portfolio")} ↗
        </Link>
        <Link to={route(locale, product, "journal")}>
          {t("نوشتن در ژورنال", "Write in journal")} ↗
        </Link>
      </div>
    </>
  );
}
export function CapabilityPage() {
  const { t, message } = useTerminal();
  return (
    <div className="of-empty">
      <p>{message("unsupported")}</p>
    </div>
  );
}
