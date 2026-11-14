import { useEffect, useRef, useState } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import ReleaseStatus from "./ReleaseStatus";
import { useAccounts } from "./Accounts";
import { TradingBridge } from "../../trading/TradingBridge";
import { RainbowConnect } from "../../wallet/RainbowConnect";
import { useSession } from "../../session/useOpenfundSession";
import {
  fetchCmsTranslations,
  fetchCmsPageMeta,
  fetchTerminalSections,
  directusUrl,
} from "../../cms/client";
import {
  primary,
  route,
  useResource,
  type Product,
  type Locale,
} from "./model";
import "./terminal.css";
import { detailsPopover, registerPopover } from "./popovers";
import { TerminalContext, useTerminal } from "./TerminalContext";
import { chooseTheme, currentTheme, DAY_NIGHT_MARKUP } from "../../theme";
import LanguageSelect from "../../i18n/LanguageSelect";
import TerminalMenu from "./TerminalMenu";
import { dirOf, normalizeLocale, pick, pickRecord, switchLocalePath } from "../../i18n/locales";
export default function TerminalShell({ product }: { product: Product }) {
  const params = useParams(),
    locale: Locale = normalizeLocale(params.locale, "fa");
  const { pathname, search } = useLocation(),
    navigate = useNavigate(),
    session = useSession(),
    directory = useAccounts();
  const [revision, setRevision] = useState(0);
  const previousOwner = useRef<string | undefined>(undefined);
  useEffect(() => {
    const owner = session.user?.id;
    if (!owner) return;
    if (previousOwner.current && previousOwner.current !== owner) {
      const query = new URLSearchParams(search);
      for (const key of ["account", "trade", "transaction"]) query.delete(key);
      navigate(pathname + (query.size ? "?" + query : ""), { replace: true });
    }
    previousOwner.current = owner;
  }, [session.user?.id, pathname, search, navigate]);
  const [messages, setMessages] = useState<
    Record<string, { fa: string; en: string }>
  >({});
  const [theme, setTheme] = useState(currentTheme);
  const page = pathname.split("/").at(-1) || "dashboard";
  const context = useResource(
    product,
    session.status === "authenticated" ? "/context" : null,
    revision,
    true,
  );
  const t = (fa: string, en: string) => pick(locale, fa, en);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirOf(locale);
    (window as any).ofLang = locale;
    try { localStorage.setItem("of-language", locale); } catch { /* The current route still determines the locale. */ }
    window.dispatchEvent(new Event("of-terminal-route"));
    const runtime = window as any;
    if (!runtime.__ofLegacyLandingLoaded && !runtime.__ofLegacyTerminalLoaded) {
      window.dispatchEvent(new Event("of-language"));
    }
  }, [locale, pathname, search]);
  useEffect(() => {
    const sync = () => setTheme(currentTheme());
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    const load = () =>
      fetchCmsTranslations().then((data) => {
        if (active) setMessages(data?.terminal || {});
      });
    void load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const message = (key: string) =>
    pickRecord(locale, messages[`products.${product}.${key}`]) ||
    pickRecord(locale, messages[`products.${key}`]) ||
    "";
  /* the More menu shares outside-click / Escape / one-open-at-a-time
     dismissal with the wallet menu and the workspace popovers */
  const moreMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!moreMenu.current) return;
    return registerPopover(detailsPopover(moreMenu.current));
  }, [pathname, search]);
  const accountsSection = page === "journal" && new URLSearchParams(search).get("section") === "accounts";
  const accountsPath = route(locale, product, "journal");
  const accountsHref = accountsPath + (accountsPath.includes("?") ? "&" : "?") + "section=accounts";
  const navigation = (
    <nav id="terminal-navigation" aria-label={t("ناوبری ترمینال", "Terminal navigation")}>
      {primary[product].filter(([id]) => ["dashboard", "trade", "chart", "portfolio"].includes(id)).map(([id, fa, en]) => (
        <Link key={id} to={route(locale, product, id)} aria-current={page === id ? "page" : undefined}
          className={page === id ? "active" : ""}>
          {id === "trade" ? t("معاملات", "Trading") : t(fa, en)}
        </Link>
      ))}
      <Link to={route(locale, product, "journal")} className={page === "journal" && !accountsSection ? "active" : ""}
        aria-current={page === "journal" && !accountsSection ? "page" : undefined}>{t("ژورنال", "Journal")}</Link>
      <Link to={accountsHref} className={accountsSection ? "active" : ""}
        aria-current={accountsSection ? "page" : undefined}>{t("حساب‌ها", "Accounts")}</Link>
      <details className="of-terminal-more" key={pathname + search} ref={moreMenu} onKeyDown={event => {
        if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
      }}>
        <summary>{t("بیشتر", "More")} <span aria-hidden="true">▾</span></summary>
        <div className="of-terminal-more-links">
          {primary[product].map(([id, fa, en]) => <Link key={id}
            className={["dashboard", "trade", "chart", "portfolio"].includes(id) ? "of-compact-destination" : page === id ? "active" : undefined}
            aria-current={page === id ? "page" : undefined} to={route(locale, product, id)}>{t(fa, en)}</Link>)}
          <Link className="of-compact-destination" to={route(locale, product, "journal")}>{t("ژورنال", "Journal")}</Link>
          <Link className="of-compact-destination" to={accountsHref}>{t("حساب‌ها", "Accounts")}</Link>
        </div>
      </details>
    </nav>
  );
  return (
    <TerminalContext.Provider
      value={{
        product,
        locale,
        context: context.data,
        refresh: () => setRevision((x) => x + 1),
        t,
        message,
      }}
    >
      {product === "prop" && context.data?.state?.account && <TradingBridge pricing={context.data?.pricing} accountId={context.data.accountRef}/> }
      <div
        className={`of-terminal of-terminal-compact ${page === "trade" || page === "chart" ? "of-terminal-trading" : ""} ${page === "dashboard" ? "of-dashboard-page" : ""}`}
        dir={dirOf(locale)}
        data-product={product}
      >
        <a
          href="#terminal-main"
          className="of-skip"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("terminal-main")?.focus();
          }}
        >
          {t("رفتن به محتوا", "Skip to content")}
        </a>
        <header className="of-terminal-header">
          <ReleaseStatus locale={locale}>{version => <div className="of-terminal-top">
            <Link className="of-brand" to={`/${locale}/home`}>
              <img
                src={`${import.meta.env.BASE_URL}assets/mark-mint.svg`}
                alt=""
                width="28"
                height="32"
              />
              <b dir="ltr">openfund</b>
            </Link>
            {<label className="of-product-switch">
              <span className="sr-only">{t("محصول", "Product")}</span>
              <select
                aria-label={t("محصول", "Product")}
                value={product}
                onChange={(e) =>
                  navigate(
                    route(
                      locale,
                      e.target.value as Product,
                      (e.target.value === "prop" ||
                        !["withdrawals", "certificates", "purchases"].includes(page)) &&
                        (e.target.value === "perpetual" || page !== "rewards")
                        ? page
                        : "dashboard",
                    ),
                  )
                }
              >
                <option value="prop">Openfund Prop</option>
                <option value="perpetual">Openfund Perpetual</option>
              </select>
            </label>}
            {navigation}
            <TerminalMenu locale={locale} product={product} page={page} accountsHref={accountsHref}
              accountsSection={accountsSection} pathname={pathname} search={search} />
            <label className="of-header-account">
              <span className="sr-only">{t("حساب فعال", "Active account")}</span>
              <select aria-label={t("حساب فعال", "Active account")} value={context.data?.accountRef || ""}
                disabled={session.status !== "authenticated" || !directory.accounts.length}
                onChange={event => {
                  const query = new URLSearchParams(search); query.set("account", event.target.value);
                  query.delete("trade"); query.delete("transaction");
                  navigate(pathname + "?" + query);
                }}>
                {!context.data && <option value="">{t("بدون حساب", "No account")}</option>}
                {directory.accounts.filter(account => account.product === product).map(account =>
                  <option key={account.id} value={account.id}>{account.name} · {account.id.slice(0, 8)}</option>)}
              </select>
            </label>
            <div className="of-terminal-actions">
              {version}
              <button
                type="button"
                className="of-daynight"
                aria-pressed={theme === "dark"}
                aria-label={t("تغییر پوسته", "Toggle theme")}
                onClick={() => {
                  const next = currentTheme() === "dark" ? "light" : "dark";
                  chooseTheme(next);
                  setTheme(next);
                }}
                dangerouslySetInnerHTML={{ __html: DAY_NIGHT_MARKUP }}
              />
              {/* same page in the chosen locale; both products in every locale */}
              <LanguageSelect locale={locale} onChange={next =>
                navigate(switchLocalePath(pathname, next) + search)} />
              {/* shared header order: theme · language · wallet (see styles/header-controls.css) */}
              <RainbowConnect />
            </div>
          </div>}</ReleaseStatus>
        </header>
        <main id="terminal-main" tabIndex={-1} className="of-terminal-main">
          {page !== "trade" && page !== "chart" && page !== "purchases" && page !== "certificates" && <Editorial page={page} />}
          {page !== "trade" && page !== "chart" && context.error && (
            <div role="alert" className="of-error">
              {t("دریافت حساب ناموفق بود.", "Account could not be loaded.")}{" "}
              <button onClick={() => setRevision((x) => x + 1)}>
                {t("تلاش دوباره", "Retry")}
              </button>
            </div>
          )}
          <Outlet key={`${product}:${session.user?.id || "guest"}:${new URLSearchParams(search).get("account") || "default"}`} />
        </main>
      </div>
    </TerminalContext.Provider>
  );
}
function Editorial({ page }: { page: string }) {
  const { product, locale, t } = useTerminal(),
    [data, setData] = useState<any>(null),
    [sections, setSections] = useState<any[]>([]);
  useEffect(() => {
    let active = true;
    setData(null);
    setSections([]);
    const load = async () => {
      const [meta, rows] = await Promise.all([
        fetchCmsPageMeta(`${product}-${page}`),
        fetchTerminalSections(product, page),
      ]);
      if (active) {
        setData(meta);
        setSections(rows || []);
        document.title =
          pickRecord(locale, meta?.seoTitle) || `Openfund ${product} · ${page}`;
      }
    };
    void load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [product, page, locale]);
  return (
    <section className="of-editorial">
      <div>
        <span className="of-eyebrow" dir="ltr">
          OPENFUND {product.toUpperCase()}
        </span>
        <h1>
          {pickRecord(locale, data?.title) ||
            (() => { const item = primary[product].find((x) => x[0] === page); return item ? t(item[1], item[2]) : ""; })() ||
            t("ژورنال معاملات", "Trade Journal")}
        </h1>
        {pickRecord(locale, data?.description) && <p>{pickRecord(locale, data?.description)}</p>}
      </div>
      {sections.map((s) => (
        <aside className="of-banner" key={s.id}>
          {s.illustration && (
            <img src={`${directusUrl()}/assets/${s.illustration}`} alt="" />
          )}
          <h2>{pickRecord(locale, s.title)}</h2>
          <p>{pickRecord(locale, s.body)}</p>
          {s.supportUrl && (
            <a href={s.supportUrl} target="_blank" rel="noreferrer">
              {t("اطلاعات بیشتر", "Learn more")}
            </a>
          )}
        </aside>
      ))}
    </section>
  );
}
export function AccessGate() {
  const session = useSession(),
    { t, message } = useTerminal();
  return session.status === "authenticated" ? null : (
    <div className="of-empty">
      <h2>{t("ورود به حساب", "Sign in")}</h2>
      <p>{message("signin")}</p>
      <RainbowConnect />
    </div>
  );
}
