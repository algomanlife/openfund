import { Link, useSearchParams } from "react-router-dom";
import { JournalAnalytics } from "./JournalAnalytics";
import { AccountCards, AccountLinks, useAccounts } from "./Accounts";
import { ChallengePanel } from "./ChallengePanel";
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
  const { product, locale, context, t, message } = useTerminal(), session = useSession();
  const [params] = useSearchParams(), directory = useAccounts();
  const selected = directory.accounts.find(account => account.id === (params.get("account") || context?.accountRef));
  const overview = useResource(product, session.status === "authenticated" && product === "prop" && selected?.type !== "challenge" ? "/overview" : null, 0, true);
  if (session.status !== "authenticated") return <AccessGate />;
  const unit = context?.state?.account?.currency || selected?.currency || "USD";
  const a = overview.data?.account;
  const positions = context?.state?.positions || [];
  return <div className="of-dashboard-workspace">
    <aside className="of-dashboard-accounts"><AccountCards compact selectedId={selected?.id} /></aside>
    <div className="of-dashboard-content">
      <section className="of-dashboard-heading of-panel">
        <div><span className="of-eyebrow">{t("حساب فعال", "Active account")}</span>
          <h2>{selected?.name || (product === "prop" ? t("حساب تمرینی", "Practice account") : "Gains Network")}</h2>
          <bdi>{context?.accountRef || "—"}</bdi></div>
        <Link to={route(locale, product, "trade")}>{t("ورود به ترمینال", "Open terminal")} ↗</Link>
      </section>
      <AccountLinks />
      {selected?.type === "challenge" ? <>
        {context?.state?.account?.status === "active" && <div className="of-metrics of-dashboard-summary">
          <Metric label={t('موجودی', 'Balance') + " · " + unit} value={context?.state?.account?.balance} />
          <Metric label={t('ارزش حساب', 'Equity') + " · " + unit} value={context?.state?.account?.equity} />
          <Metric label={t('سود باز', 'Unrealized PnL') + " · " + unit} value={context?.state?.account?.unrealized_pnl} />
        </div>}
        {context?.state?.positions?.length ? <div className="of-table-wrap"><table><thead><tr><th>{t("بازار", "Market")}</th><th>{t("جهت", "Side")}</th><th>{t("سود باز", "Unrealized PnL")}</th></tr></thead>
          <tbody>{context.state.positions.slice(0, 5).map((position: any) => <tr key={position.id}><td>{position.market}</td><td>{position.side === "long" ? t("خرید", "Long") : t("فروش", "Short")}</td><td dir="ltr">{money(position.unrealized_pnl)} {unit}</td></tr>)}</tbody></table></div> : null}
        <ChallengePanel challengeId={selected.id} />
      </> : product === "prop" ? <>
        {context?.state?.account?.status === "permanently_disabled" && <p role="status" className="of-error">{t("این حساب برای همیشه غیرفعال شده است. تاریخچه قابل مشاهده است.", "Permanently disabled. Historical records remain available in read-only mode.")}</p>}
        {overview.error && <p role="alert" className="of-error">{t("دریافت خلاصه ناموفق بود.", "Summary unavailable.")}</p>}
        <div className="of-metrics of-dashboard-summary">
          <Metric label={t('موجودی', 'Balance') + " · " + unit} value={a?.balance} />
          <Metric label={t('ارزش حساب', 'Equity') + " · " + unit} value={a?.equity} />
          <Metric label={t('سود تحقق\u200cیافته', 'Realized PnL') + " · " + unit} value={a?.realizedPnl} />
          <Metric label={t('سود باز', 'Unrealized PnL') + " · " + unit} value={a?.unrealizedPnl} />
        </div>
        <div className="of-dashboard-grid">
          <section className="of-panel">
            <h2>{t("وضعیت حساب و ریسک", "Account status & risk")}</h2>
            <dl className="of-dashboard-values">
              <div><dt>{t("وضعیت", "Status")}</dt><dd>{a?.status || selected?.status || "—"}</dd></div>
              <div><dt>{t("مارجین مصرف‌شده", "Used margin")}</dt><dd dir="ltr">{money(a?.usedMargin)} {unit}</dd></div>
              <div><dt>{t("مارجین آزاد", "Free margin")}</dt><dd dir="ltr">{money(a?.freeMargin)} {unit}</dd></div>
              <div><dt>{t("افت روزانهٔ ثبت‌شده", "Observed daily drawdown")}</dt><dd dir="ltr">{money(context?.state?.account?.risk?.daily_drawdown)} {unit}</dd></div>
              <div><dt>{t("بیشترین افت ثبت‌شده", "Observed maximum drawdown")}</dt><dd dir="ltr">{money(context?.state?.account?.risk?.maximum_drawdown)} {unit}</dd></div>
              <div><dt>{t("معاملات بسته", "Closed trades")}</dt><dd>{a?.closedTrades ?? "—"}</dd></div>
              <div><dt>{t("چالش‌های ثبت‌شده", "Registered challenges")}</dt><dd>{session.challenges.length}</dd></div>
            </dl><p>{message("evaluation")}</p>
          </section>
          <section className="of-panel">
            <div className="of-dashboard-section-title"><h2>{t("پوزیشن‌های باز", "Open positions")}</h2><span>{a?.openPositions ?? "—"}</span></div>
            {positions.length ? <div className="of-table-wrap"><table><thead><tr><th>{t("بازار", "Market")}</th><th>{t("جهت", "Side")}</th><th>{t("سود باز", "Unrealized PnL")}</th></tr></thead>
              <tbody>{positions.slice(0, 5).map((position: any) => <tr key={position.id}><td>{position.market}</td><td>{position.side === "long" ? t("خرید", "Long") : t("فروش", "Short")}</td><td dir="ltr">{money(position.unrealized_pnl)} {unit}</td></tr>)}</tbody></table></div>
              : <p>{context?.state ? t("پوزیشن بازی وجود ندارد.", "No open positions.") : t("در حال دریافت حساب…", "Loading account…")}</p>}
            <Link to={route(locale, product, "portfolio")}>{t("مشاهدهٔ پورتفولیو", "View portfolio")} ↗</Link>
          </section>
        </div>
        <JournalAnalytics reports />
      </> : <>
        <GainsSummary />
        <div className="of-dashboard-grid">
          <section className="of-panel"><h2>{t("کیف پول", "Wallet")}</h2><p dir="ltr">{context?.wallet || session.user?.walletAddress}</p><p>Gains Network · Arbitrum One</p></section>
          <section className="of-panel" role="status"><h2>{t("وضعیت معاملات", "Trading status")}</h2><p>{t("اطلاعات حساب از Gains دریافت می‌شود؛ اجرای سفارش در اوپن‌فاند فعال نیست.", "Account records come from Gains; order execution in Openfund is not enabled.")}</p><p>{t("موجودی و سود خالص تأییدنشده نمایش داده نمی‌شوند.", "Unsupported balances and net PnL remain unavailable.")}</p></section>
        </div>
        <JournalAnalytics />
      </>}
      <div className="of-quick-links"><Link to={route(locale, product, "portfolio")}>{t("مشاهدهٔ پورتفولیو", "View portfolio")} ↗</Link><Link to={route(locale, product, "journal")}>{t("نوشتن در ژورنال", "Write in journal")} ↗</Link></div>
    </div>
  </div>;
}
export function CapabilityPage() {
  const { t, message } = useTerminal();
  return (
    <div className="of-empty">
      <p>{message("unsupported")}</p>
    </div>
  );
}
