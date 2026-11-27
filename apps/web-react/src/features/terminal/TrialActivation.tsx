import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../session/useOpenfundSession";
import { intlLocale } from "../../i18n/locales";
import { useTerminal } from "./TerminalContext";
import "./trial-activation.css";

/* the public checkout, embedded (loaded only when the panel is shown) */
const Checkout = lazy(() => import("../purchase/CheckoutPage"));

type TrialModel = "standard" | "one-phase";
interface ModelOffer { model: TrialModel; phases: number; phase1TargetPct: number | null; phase2TargetPct: number | null; dailyLossPct: number | null; maxTotalLossPct: number | null; drawdownMode: string; minTradingDays: number; daysPerPhase: number }
interface TrialResponse {
  offer: { accountSizesUsd: number[]; models: ModelOffer[]; daysPerPhase: number; cooldownHours: number } | null;
  eligibility: { eligible: boolean; reason: string | null; availableAt?: string; activeChallengeId?: string };
}

/**
 * ADR 0062: what a signed-in Prop trader with no running account sees on the
 * dashboard — request a 14-day Free Trial (One-phase or Two-phase, any site
 * account size) or buy a challenge in the embedded checkout. The server
 * decides eligibility (one running account, 72 hours after a trial ends).
 */
export function TrialActivation() {
  const { locale, t } = useTerminal(), navigate = useNavigate();
  const [data, setData] = useState<TrialResponse | null>(null), [loadError, setLoadError] = useState(false);
  const [model, setModel] = useState<TrialModel>("standard"), [size, setSize] = useState<number | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const load = () => {
    setLoadError(false);
    void apiFetch("/trials").then(r => { if (r.ok) setData(r.data); else setLoadError(true) }).catch(() => setLoadError(true));
  };
  useEffect(load, []);
  const sizes = data?.offer?.accountSizesUsd ?? [];
  const chosenSize = size ?? sizes[1] ?? sizes[0] ?? null;
  const usd = (v: number) => "$" + v.toLocaleString("en-US");
  const pct = (v: number | null) => (v == null ? "—" : `${v}%`);
  const when = (iso?: string) => (iso ? new Date(iso).toLocaleString(intlLocale(locale)) : "");
  const reasonText = (reason: string | null, availableAt?: string) =>
    reason === "trial_cooldown" ? `${t("تست رایگان بعدی ۷۲ ساعت پس از پایان تست قبلی در دسترس است:", "Your next Free Trial is available 72 hours after the previous one ended:")} ${when(availableAt)}`
      : reason === "active_account_exists" ? t("شما یک حساب فعال دارید. تا وقتی حساب فعالی دارید، نمی‌توانید تریال بگیرید.", "You already have a running account. A Free Trial is available only when no account is running.")
        : reason === "rate_limited" ? t("تعداد درخواست‌ها زیاد است. یک دقیقه بعد دوباره تلاش کنید.", "Too many attempts. Please wait a minute and try again.")
          : t("فعال‌سازی تریال انجام نشد. دوباره تلاش کنید.", "The Free Trial could not be activated. Please try again.");
  const activate = async () => {
    if (!chosenSize) return;
    setPending(true); setError("");
    try {
      const r = await apiFetch("/trials", { method: "POST", body: JSON.stringify({ model, accountSizeUsd: chosenSize }) });
      if (!r.ok) { setError(reasonText(r.data?.error ?? null, r.data?.availableAt)); load(); return; }
      dispatchEvent(new Event("of-trading-update"));
      navigate(`/${locale}/prop/dashboard?account=${encodeURIComponent(r.data.challenge.id)}`);
    } catch { setError(reasonText(null)); } finally { setPending(false); }
  };
  const eligible = data?.eligibility.eligible === true;
  const offers = data?.offer?.models ?? [];
  const label = (m: TrialModel) => (m === "standard" ? t("دومرحله‌ای", "Two-phase") : t("یک‌مرحله‌ای", "One-phase"));
  return <div className="of-activation">
    <section className="of-activation-hero of-panel" aria-labelledby="trial-activation-title">
      <div className="of-activation-orbit" aria-hidden="true"><span /><span /><span /></div>
      <span className="of-eyebrow">{t("تست رایگان ۱۴ روزه", "14-day Free Trial")}</span>
      <h2 id="trial-activation-title">{t("چالش واقعی را رایگان تجربه کنید", "Try a real challenge for free")}</h2>
      <p>{t("همان قوانین چالش واقعی، با حساب شبیه‌سازی‌شده و بدون پرداخت. هر مرحله ۱۴ روز فرصت دارد؛ اگر قبول شوید، گواهی قبولی تست رایگان می‌گیرید. تست رایگان پاداش و برداشت ندارد.", "The same rules as a real challenge, on a simulated account, with nothing to pay. Each phase has 14 days; pass it and you receive a Free Trial pass certificate. A Free Trial has no rewards and no withdrawals.")}</p>
      {loadError && <p role="alert" className="of-error">{t("دریافت اطلاعات تست رایگان ناموفق بود.", "The Free Trial offer could not be loaded.")} <button className="of-link-button" onClick={load}>{t("تلاش دوباره", "Try again")}</button></p>}
      {!data && !loadError && <p role="status">{t("در حال دریافت…", "Loading…")}</p>}
      {data && !data.offer && <p role="status">{t("تست رایگان در حال حاضر در دسترس نیست.", "The Free Trial is not available right now.")}</p>}
      {data?.offer && <>
        <div className="of-activation-models" role="radiogroup" aria-label={t("نوع ارزیابی", "Evaluation type")}>
          {offers.map(o => <button key={o.model} type="button" role="radio" aria-checked={model === o.model} className="of-activation-model" data-selected={model === o.model} onClick={() => setModel(o.model)}>
            <b>{label(o.model)}</b>
            <span>{o.phases >= 2 ? <><bdi dir="ltr">{o.phases} × {o.daysPerPhase}</bdi> {t("روز (هر مرحله ۱۴ روز)", "days (14 days per phase)")}</> : <><bdi dir="ltr">{o.daysPerPhase}</bdi> {t("روز", "days")}</>}</span>
            <dl>
              <div><dt>{t("هدف سود", "Profit target")}</dt><dd dir="ltr">{o.phases >= 2 ? `${pct(o.phase1TargetPct)} + ${pct(o.phase2TargetPct)}` : pct(o.phase1TargetPct)}</dd></div>
              <div><dt>{t("حد ضرر روزانه", "Daily loss")}</dt><dd dir="ltr">{pct(o.dailyLossPct)}</dd></div>
              <div><dt>{t("حد ضرر کل", "Maximum loss")}</dt><dd dir="ltr">{pct(o.maxTotalLossPct)}</dd></div>
              <div><dt>{t("حداقل روز معاملاتی", "Minimum trading days")}</dt><dd dir="ltr">{o.minTradingDays}</dd></div>
            </dl>
          </button>)}
        </div>
        <div className="of-activation-sizes" role="radiogroup" aria-label={t("اندازهٔ حساب", "Account size")}>
          {sizes.map(v => <button key={v} type="button" role="radio" aria-checked={chosenSize === v} data-selected={chosenSize === v} onClick={() => setSize(v)}><bdi dir="ltr">{usd(v)}</bdi></button>)}
        </div>
        {!eligible && <p role="status" className="of-activation-note">{reasonText(data.eligibility.reason, data.eligibility.availableAt)}</p>}
        {error && <p role="alert" className="of-error">{error}</p>}
        <button className="of-activation-cta" disabled={!eligible || pending || !chosenSize} onClick={() => void activate()}>
          {pending ? t("در حال فعال‌سازی…", "Activating…") : t("فعال‌سازی تست رایگان", "Activate Free Trial")}
        </button>
        <p className="of-muted">{t("با فعال‌سازی، گواهی شروع تست رایگان صادر می‌شود و همهٔ معاملات حساب با قوانین چالش ارزیابی می‌شوند. حساب‌ها شبیه‌سازی‌شده‌اند و پول واقعی در کار نیست.", "Activation issues a Free Trial start certificate, and every trade on the account is evaluated under the challenge rules. Accounts are simulated; no real money is involved.")}</p>
      </>}
    </section>
    <section className="of-activation-checkout of-panel" aria-label={t("خرید چالش", "Buy a challenge")}>
      <Suspense fallback={<p role="status">{t("در حال دریافت…", "Loading…")}</p>}><Checkout embedded /></Suspense>
    </section>
  </div>;
}
