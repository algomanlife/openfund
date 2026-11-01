import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
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
import { TerminalContext, useTerminal } from "./TerminalContext";
export default function TerminalShell({ product }: { product: Product }) {
  const params = useParams(),
    locale: Locale = params.locale === "en" ? "en" : "fa";
  const { pathname } = useLocation(),
    navigate = useNavigate(),
    session = useSession();
  const [open, setOpen] = useState(false),
    [revision, setRevision] = useState(0);
  const [messages, setMessages] = useState<
    Record<string, { fa: string; en: string }>
  >({});
  const [theme, setTheme] = useState(() =>
    localStorage.getItem("of-theme") === "light" ? "light" : "dark",
  );
  const page = pathname.split("/").at(-1) || "dashboard";
  const context = useResource(
    product,
    session.status === "authenticated" ? "/context" : null,
    revision,
  );
  const t = (fa: string, en: string) => (locale === "fa" ? fa : en);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "fa" ? "rtl" : "ltr";
    (window as any).ofLang = locale;
    localStorage.setItem("of-language", locale);
    window.dispatchEvent(new Event("of-language"));
    setOpen(false);
  }, [locale, pathname]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("of-theme", theme);
  }, [theme]);
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
    messages[`products.${product}.${key}`]?.[locale] ||
    messages[`products.${key}`]?.[locale] ||
    "";
  const activePage = page === "journal" ? "portfolio" : page;
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
      <div
        className={`of-terminal ${page === "trade" ? "of-terminal-trading" : ""}`}
        dir={locale === "fa" ? "rtl" : "ltr"}
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
          <div className="of-terminal-top">
            <Link className="of-brand" to={`/${locale}/home`}>
              <img
                src={`${import.meta.env.BASE_URL}assets/mark-mint.svg`}
                alt=""
                width="28"
                height="32"
              />
              <b dir="ltr">openfund</b>
            </Link>
            <label className="of-product-switch">
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
                        !["withdrawals", "certificates"].includes(page)) &&
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
            </label>
            <span className="of-account-context">
              {context.data ? (
                <bdi>
                  {product === "prop"
                    ? `${t("حساب تمرینی", "Practice account")} · ${context.data.accountRef.slice(0, 8)}`
                    : `${context.data.wallet.slice(0, 6)}…${context.data.wallet.slice(-4)}`}
                </bdi>
              ) : (
                t("بدون حساب فعال", "No active account")
              )}
            </span>
            <div className="of-terminal-actions">
              <RainbowConnect />
              <button
                aria-label={t("تغییر پوسته", "Toggle theme")}
                onClick={() =>
                  setTheme((x) => (x === "dark" ? "light" : "dark"))
                }
              >
                ◐
              </button>
              <button
                onClick={() =>
                  navigate(route(locale === "fa" ? "en" : "fa", product, page))
                }
              >
                {locale === "fa" ? "EN" : "FA"}
              </button>
              <button
                className="of-mobile-menu"
                aria-expanded={open}
                aria-controls="terminal-navigation"
                onClick={() => setOpen((x) => !x)}
              >
                {t("منو", "Menu")} ☰
              </button>
            </div>
          </div>
          <nav
            id="terminal-navigation"
            aria-label={t("ناوبری ترمینال", "Terminal navigation")}
            className={open ? "open" : ""}
          >
            {primary[product].map(([id, fa, en]) => (
              <NavLink
                key={id}
                to={route(locale, product, id)}
                aria-current={activePage === id ? "page" : undefined}
                className={activePage === id ? "active" : ""}
                onClick={() => setOpen(false)}
              >
                {t(fa, en)}
              </NavLink>
            ))}
          </nav>
        </header>
        {(page === "portfolio" || page === "journal") && (
          <nav
            className="of-secondary"
            aria-label={t("پورتفولیو و ژورنال", "Portfolio and journal")}
          >
            <NavLink to={route(locale, product, "portfolio")}>
              {t("پورتفولیو", "Portfolio")}
            </NavLink>
            <NavLink to={route(locale, product, "journal")}>
              {t("ژورنال معاملات", "Trade Journal")}
            </NavLink>
          </nav>
        )}
        <main id="terminal-main" tabIndex={-1} className="of-terminal-main">
          {page !== "trade" && <Editorial page={page} />}
          {page !== "trade" && context.error && (
            <div role="alert" className="of-error">
              {t("دریافت حساب ناموفق بود.", "Account could not be loaded.")}{" "}
              <button onClick={() => setRevision((x) => x + 1)}>
                {t("تلاش دوباره", "Retry")}
              </button>
            </div>
          )}
          <Outlet key={`${product}:${session.user?.id || "guest"}`} />
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
          meta?.seoTitle[locale] || `Openfund ${product} · ${page}`;
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
          {data?.title[locale] ||
            primary[product].find((x) => x[0] === page)?.[
              locale === "fa" ? 1 : 2
            ] ||
            t("ژورنال معاملات", "Trade Journal")}
        </h1>
        {data?.description[locale] && <p>{data.description[locale]}</p>}
      </div>
      {sections.map((s) => (
        <aside className="of-banner" key={s.id}>
          {s.illustration && (
            <img src={`${directusUrl()}/assets/${s.illustration}`} alt="" />
          )}
          <h2>{s.title[locale]}</h2>
          <p>{s.body[locale]}</p>
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
