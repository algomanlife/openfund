import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useSession } from "../../session/useOpenfundSession";
import { AccessGate } from "./TerminalShell";
import { useTerminal } from "./TerminalContext";
import { api, download, money, useResource } from "./model";
import { GainsAnalytics } from "./GainsPortfolio";
import { PnlCalendar } from "./Analytics";
import { AccountCards, AccountPicker } from "./Accounts";
import { JournalAnalytics, JOURNAL_CARD_LABELS } from "./JournalAnalytics";
import ProductPortfolio from "./Portfolio";
const empty = () => ({
  id: crypto.randomUUID(),
  title: "",
  body: "",
  date: new Date().toISOString().slice(0, 10),
  tags: "",
  classification: "",
  tradeId: "",
  version: undefined as number | undefined,
});
function JournalEntries({ kind = "" }: { kind?: string }) {
  const { product, context, t, message } = useTerminal(),
    session = useSession(),
    [params] = useSearchParams(),
    [draft, setDraft] = useState(() => ({
      ...empty(),
      date: params.get("date") || empty().date,
      classification: kind,
      tradeId: params.get("trade") || "",
      body: params.get("transaction")
        ? `https://arbiscan.io/tx/${params.get("transaction")}`
        : "",
    })),
    [editing, setEditing] = useState(
      !!params.get("trade") || !!params.get("transaction"),
    ),
    [filter, setFilter] = useState({ search: "", from: params.get("date") || "", to: params.get("date") || "" }),
    [page, setPage] = useState(0),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [calendar, setCalendar] = useState(false),
    file = useRef<HTMLInputElement>(null);
  const signed = session.status === "authenticated",
    query = new URLSearchParams(
      Object.entries({ ...filter, classification: kind }).filter(([, v]) => v),
    ).toString(),
    journal = useResource(
      product,
      signed ? `/journal?${query}&limit=20&offset=${page * 20}` : null,
      revision,
    ),
    overview = useResource(
      product,
      signed && product === "prop" ? `/overview?${query}` : null,
      revision,
    ),
    trade = useResource(
      product,
      signed && draft.tradeId
        ? `/trades/${encodeURIComponent(draft.tradeId)}`
        : null,
    );
  const changeFilter = (k: string, v: string) => {
    setFilter((x) => ({ ...x, [k]: v }));
    setPage(0);
  };
  if (!signed) return <AccessGate />;
  const readOnly = context?.state?.account?.status === "permanently_disabled";
  const work = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await fn();
      setRevision((x) => x + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    work(async () => {
      await api(product, "/journal", {
        method: "PUT",
        body: JSON.stringify({
          ...draft,
          tags: draft.tags
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
          tradeId: draft.tradeId || null,
        }),
      });
      setEditing(false);
      setDraft({ ...empty(), classification: kind });
      setStatus(t("یادداشت ذخیره شد.", "Entry saved."));
    });
  const exportAll = () =>
    work(async () => {
      const entries: any[] = [];
      let offset = 0,
        total = 0;
      do {
        const r = await api(
          product,
          `/journal?${query}&limit=100&offset=${offset}`,
        );
        entries.push(...r.entries);
        offset += 100;
        total = r.total;
      } while (offset < total);
      download(
        `${product}-journal.json`,
        JSON.stringify(
          {
            format: "openfund-journal-v1",
            product,
            accountRef: context.accountRef,
            exportedAt: new Date().toISOString(),
            entries,
          },
          null,
          2,
        ),
        "application/json",
      );
    });
  return (
    <>
      <div className="of-account-bar">
        <bdi>{context?.accountRef || "—"}</bdi>
        <button
          disabled={readOnly}
          onClick={() => {
            setDraft({ ...empty(), classification: kind });
            setEditing(true);
            setError("");
          }}
        >
          {t("یادداشت جدید", "New entry")}
        </button>
        <button disabled={busy || !context} onClick={exportAll}>
          {t("خروجی JSON", "Export JSON")}
        </button>
        <button
          disabled={busy || !context || readOnly}
          onClick={() => file.current?.click()}
        >
          {t("ورود JSON", "Import JSON")}
        </button>
        <button aria-pressed={calendar} onClick={() => setCalendar((x) => !x)}>
          {t("تقویم و آمار", "Calendar & statistics")}
        </button>
        <input
          hidden
          ref={file}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            void work(async () => {
              if (f.size > 2 * 1024 * 1024) throw new Error("import_too_large");
              const data = JSON.parse(await f.text());
              if (
                data.format !== "openfund-journal-v1" ||
                data.product !== product ||
                data.accountRef !== context.accountRef ||
                !Array.isArray(data.entries)
              )
                throw new Error("invalid_import_scope");
              let imported = 0,
                skipped = 0;
              for (let i = 0; i < data.entries.length; i += 50) {
                const r = await api(product, "/journal/import", {
                  method: "POST",
                  body: JSON.stringify({
                    ...data,
                    entries: data.entries.slice(i, i + 50),
                  }),
                });
                imported += r.imported;
                skipped += r.skipped;
              }
              setStatus(
                `${t("وارد شد", "Imported")}: ${imported} · ${t("تکراری", "Skipped")}: ${skipped}`,
              );
            });
          }}
        />
      </div>
      <p>{message("journalImport")}</p>
      <div className="of-filters">
        <label>
          {t(
            "جست‌وجوی متن، تگ یا طبقه‌بندی",
            "Search text, tags or classification",
          )}
          <input
            type="search"
            value={filter.search}
            onChange={(e) => changeFilter("search", e.target.value)}
          />
        </label>
        <label>
          {t("از تاریخ", "From")}
          <input
            type="date"
            value={filter.from}
            onChange={(e) => changeFilter("from", e.target.value)}
          />
        </label>
        <label>
          {t("تا تاریخ", "To")}
          <input
            type="date"
            value={filter.to}
            onChange={(e) => changeFilter("to", e.target.value)}
          />
        </label>
        <button onClick={() => setRevision((x) => x + 1)}>
          {t("به‌روزرسانی", "Refresh")}
        </button>
      </div>
      {(error || journal.error) && (
        <p role="alert" className="of-error">
          {error || journal.error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      {journal.loading && (
        <p role="status">{t("در حال بارگذاری…", "Loading…")}</p>
      )}
      {calendar && product === "perpetual" && <GainsAnalytics />}
      {calendar && product === "prop" && (
        <section className="of-panel">
          <h2>
            {t("آمار روزانهٔ معاملات · DAI", "Daily trade statistics · DAI")}
          </h2>
          <PnlCalendar
            days={overview.data?.daily || []}
            onDate={(date) => {
              setFilter((x) => ({ ...x, from: date, to: date }));
              setPage(0);
              setDraft({ ...empty(), date });
              setEditing(true);
            }}
          />
        </section>
      )}
      {editing && (
        <form
          aria-disabled={readOnly}
          className="of-panel of-journal-editor"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h2>{t("یادداشت ژورنال", "Journal entry")}</h2>
          <label>
            {t("عنوان", "Title")}
            <input
              required
              maxLength={160}
              value={draft.title}
              onChange={(e) =>
                setDraft((x) => ({ ...x, title: e.target.value }))
              }
            />
          </label>
          <label>
            {t("تاریخ", "Date")}
            <input
              required
              type="date"
              value={draft.date}
              onChange={(e) =>
                setDraft((x) => ({ ...x, date: e.target.value }))
              }
            />
          </label>
          <label>
            {t("یادداشت خصوصی", "Private notes")}
            <textarea
              aria-label={t("یادداشت خصوصی", "Private notes")}
              rows={8}
              maxLength={10000}
              value={draft.body}
              onChange={(e) =>
                setDraft((x) => ({ ...x, body: e.target.value }))
              }
            />
          </label>
          <label>
            {t("تگ‌ها با کاما", "Tags, comma separated")}
            <input
              value={draft.tags}
              onChange={(e) =>
                setDraft((x) => ({ ...x, tags: e.target.value }))
              }
            />
          </label>
          <label>
            {t("طبقه‌بندی یا استراتژی", "Classification or strategy")}
            <input
              maxLength={80}
              value={draft.classification}
              onChange={(e) =>
                setDraft((x) => ({ ...x, classification: e.target.value }))
              }
            />
          </label>
          {product === "prop" && (
            <>
              <label>
                {t("شناسهٔ معامله (اختیاری)", "Trade ID (optional)")}
                <input
                  value={draft.tradeId}
                  onChange={(e) =>
                    setDraft((x) => ({ ...x, tradeId: e.target.value }))
                  }
                />
              </label>
              {trade.data && (
                <p>
                  <bdi>{trade.data.trade.symbol}</bdi> ·{" "}
                  {trade.data.trade.direction} ·{" "}
                  <bdi>
                    {money(trade.data.trade.netPnl)}{" "}
                    {context?.state?.account?.currency || "USD"}
                  </bdi>
                </p>
              )}
              {trade.error && (
                <p role="alert">
                  {t(
                    "معامله پیدا نشد یا متعلق به این حساب نیست.",
                    "Trade not found or not owned by this account.",
                  )}
                </p>
              )}
            </>
          )}
          <div className="of-actions">
            <button type="submit" disabled={busy || readOnly}>
              {t("ذخیره", "Save")}
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              {t("انصراف", "Cancel")}
            </button>
          </div>
        </form>
      )}
      <div className="of-journal-list">
        {journal.data?.entries.map((entry: any) => (
          <article className="of-panel" key={entry.id}>
            <time>{entry.date}</time>
            <h2>{entry.title}</h2>
            <p className="of-note-body">{entry.body}</p>
            <div>
              {entry.tags.map((tag: string) => (
                <button
                  key={tag}
                  className="of-tag"
                  onClick={() => changeFilter("search", tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            {entry.classification && <p>{entry.classification}</p>}
            {entry.tradeId && (
              <p>
                {t("معاملهٔ مرتبط", "Linked trade")}: <bdi>{entry.tradeId}</bdi>
              </p>
            )}
            <div className="of-actions">
              <button
                disabled={readOnly}
                onClick={() => {
                  setDraft({
                    ...entry,
                    tags: entry.tags.join(", "),
                    tradeId: entry.tradeId || "",
                  });
                  setEditing(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                {t("ویرایش", "Edit")}
              </button>
              <button
                disabled={busy || readOnly}
                onClick={() =>
                  work(async () => {
                    await api(
                      product,
                      `/journal/${entry.id}?version=${entry.version}`,
                      { method: "DELETE" },
                    );
                    setStatus(t("یادداشت حذف شد.", "Entry deleted."));
                  })
                }
              >
                {t("حذف یادداشت", "Delete entry")}
              </button>
            </div>
          </article>
        ))}
      </div>
      {journal.data?.total === 0 && (
        <div className="of-empty">
          <p>
            {message("emptyJournal") ||
              t("یادداشتی یافت نشد.", "No entries found.")}
          </p>
        </div>
      )}
      <div className="of-pagination">
        <button disabled={page === 0} onClick={() => setPage((x) => x - 1)}>
          {t("قبلی", "Previous")}
        </button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil((journal.data?.total || 0) / 20))}
        </span>
        <button
          disabled={(page + 1) * 20 >= (journal.data?.total || 0)}
          onClick={() => setPage((x) => x + 1)}
        >
          {t("بعدی", "Next")}
        </button>
      </div>
    </>
  );
}

const sections = [
  ["dashboard", "داشبورد", "Dashboard"],
  ["calendar", "تقویم", "Calendar"],
  ["daily", "ژورنال روزانه", "Daily Journal"],
  ["trades", "معاملات", "Trades"],
  ["reports", "گزارش‌ها", "Reports"],
  ["firms", "شرکت‌های پراپ", "Prop Firms"],
  ["notebook", "دفتر یادداشت", "Notebook"],
  ["playbooks", "پلن‌های معاملاتی", "Playbooks"],
  ["progress", "پیشرفت", "Progress"],
  ["missed", "فرصت‌های ازدست‌رفته", "Missed Trades"],
  ["import", "ورود اطلاعات", "Import"],
  ["accounts", "حساب‌ها", "Accounts"],
  ["settings", "تنظیمات", "Settings"],
];
export default function ProductJournal() {
  const { product, context, t } = useTerminal(),
    session = useSession(),
    [params, setParams] = useSearchParams();
  const section =
    params.get("section") ||
    (params.get("trade") || params.get("transaction")
      ? "notebook"
      : "dashboard");
  const kinds: Record<string, string> = {
    daily: "daily",
    playbooks: "playbook",
    progress: "progress",
    missed: "missed_trade",
    firms: "prop_firm",
  };
  if (session.status !== "authenticated") return <AccessGate />;
  return (
    <div className="of-journal-workspace">
      <aside className="of-journal-nav">
        <b>{t("ژورنال معاملات", "Trade Journal")}</b>
        <nav aria-label="Journal sections">
          {sections.map(([id, fa, en]) => (
            <button
              key={id}
              aria-current={section === id ? "page" : undefined}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("section", id);
                next.delete("trade");
                next.delete("transaction");
                setParams(next);
              }}
            >
              {t(fa, en)}
            </button>
          ))}
        </nav>
      </aside>
      <div className="of-journal-content">
        <h2>
          {t(
            sections.find((r) => r[0] === section)?.[1] || "",
            sections.find((r) => r[0] === section)?.[2] || "",
          )}
        </h2>
        {context?.state?.account?.status === "permanently_disabled" && (
          <p role="status">
            {t("این ژورنال فقط خواندنی است.", "This journal is read-only.")}
          </p>
        )}
        {params.get("view") === "all" ? (
          <>
            <AccountPicker />
            <p>
              {t(
                "نمای تجمیعی با حفظ تفکیک حساب‌ها؛ موجودی‌های ناشناخته با هم جمع نمی‌شوند.",
                "Aggregated directory with account attribution. Unknown balances and distinct collateral units are not combined.",
              )}
            </p>
            <AccountCards />
          </>
        ) : ["dashboard", "calendar", "reports"].includes(section) ? (
          <JournalAnalytics
            calendarOnly={section === "calendar"}
            reports={section === "reports"}
          />
        ) : section === "trades" ? (
          <ProductPortfolio />
        ) : section === "accounts" ? (
          <AccountCards />
        ) : section === "settings" ? (
          <JournalSettings />
        ) : (
          <>
            <AccountPicker />
            {section === "progress" && <JournalAnalytics />}
            {section === "firms" && (
              <p>
                {t(
                  "یادداشت‌های خصوصی دربارهٔ شرکت‌های پراپ؛ وضعیت حساب‌ها در بخش حساب‌ها قابل مشاهده است.",
                  "Private prop-firm research notes. Owned challenge status is available in Accounts.",
                )}
              </p>
            )}
            {section === "import" && (
              <p>
                {t(
                  "بازیابی یادداشت‌های همین حساب؛ ورود دادهٔ مالی مجاز نیست.",
                  "Restore metadata for this account. Imports never create trades, balances or performance.",
                )}
              </p>
            )}
            <JournalEntries key={`${section}:${params.get("date") || ""}:${params.get("trade") || ""}:${params.get("transaction") || ""}`} kind={kinds[section] || ""} />
          </>
        )}
      </div>
    </div>
  );
}
const RANGES = ["7D", "30D", "90D", "YTD", "All"];
function JournalSettings() {
  /* A form over the existing preference model ({ range, layout, hidden })
     and the existing GET/PUT /preferences API. Unknown fields that the
     server may return are kept in the payload; the raw record stays
     available as a read-only troubleshooting view. */
  const { product, context, t } = useTerminal(),
    prefs = useResource(product, "/preferences"),
    [draft, setDraft] = useState<any>(null),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const readOnly = context?.state?.account?.status === "permanently_disabled";
  const current = draft ?? prefs.data ?? null;
  const hidden: string[] = Array.isArray(current?.hidden) ? current.hidden : [];
  const edit = (patch: any) => { setDraft({ ...(current || {}), ...patch }); setStatus(""); };
  const save = async (body: any, done: string) => {
    setBusy(true);
    try {
      await api(product, "/preferences", { method: "PUT", body: JSON.stringify(body) });
      setDraft(body);
      setStatus(done);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const disabled = readOnly || busy || !current;
  return (
    <section className="of-panel of-journal-settings">
      <AccountPicker />
      <dl className="of-settings-facts">
        <div><dt>{t("مرز روز معاملاتی", "Trading day boundary")}</dt><dd>UTC</dd></div>
        <div><dt>{t("واحد حساب", "Account currency")}</dt><dd>{context?.state?.account?.currency || t("وثیقهٔ بومی پروتکل", "Native protocol collateral")}</dd></div>
        <div><dt>{t("حساب انتخاب‌شده", "Selected account")}</dt><dd><bdi className="of-account-ref">{context?.accountRef || "—"}</bdi></dd></div>
      </dl>
      {prefs.error && <p role="alert" className="of-error">{t("دریافت تنظیمات ناموفق بود.", "Preferences could not be loaded.")}</p>}
      <form
        className="of-settings-form"
        onSubmit={(e) => { e.preventDefault(); if (current) void save({ ...current, hidden }, t("تنظیمات ذخیره شد.", "Preferences saved.")); }}
      >
        <fieldset disabled={disabled}>
          <legend>{t("بازهٔ زمانی پیش‌فرض", "Default date range")}</legend>
          <div className="of-segmented" role="radiogroup" aria-label={t("بازهٔ زمانی پیش‌فرض", "Default date range")}>
            {RANGES.map((v) => (
              <button type="button" role="radio" key={v} aria-checked={current?.range === v} aria-pressed={current?.range === v} onClick={() => edit({ range: v })}>{v}</button>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={disabled}>
          <legend>{t("چیدمان داشبورد", "Dashboard layout")}</legend>
          <div className="of-settings-options">
            {[["comfortable", "راحت", "Comfortable"], ["compact", "فشرده", "Compact"]].map(([v, fa, en]) => (
              <label key={v}><input type="radio" name="journal-layout" value={v} checked={current?.layout === v} onChange={() => edit({ layout: v })} /> {t(fa, en)}</label>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={disabled}>
          <legend>{t("کارت‌های نمایش‌داده‌شده", "Visible cards")}</legend>
          <div className="of-settings-options">
            {JOURNAL_CARD_LABELS.map(([en, fa]) => (
              <label key={en}>
                <input type="checkbox" checked={!hidden.includes(en)} onChange={(e) => edit({ hidden: e.target.checked ? hidden.filter((v) => v !== en) : [...hidden, en] })} /> {t(fa, en)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="of-settings-actions">
          <button type="submit" className="of-primary" disabled={disabled || !draft}>{t("ذخیرهٔ تنظیمات", "Save preferences")}</button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void save({ ...(current || {}), range: "All", layout: "comfortable", hidden: [] }, t("تنظیمات نمایش بازگردانی شد.", "Display preferences restored."))}
          >
            {t("بازگردانی تنظیمات نمایش", "Restore display preferences")}
          </button>
        </div>
        {status && <p role="status">{status}</p>}
      </form>
      <details className="of-settings-raw">
        <summary>{t("دادهٔ خام (عیب‌یابی)", "Raw data (troubleshooting)")}</summary>
        <pre dir="ltr">{JSON.stringify(prefs.data, null, 2)}</pre>
      </details>
    </section>
  );
}
