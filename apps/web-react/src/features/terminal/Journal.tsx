import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSession } from "../../session/useOpenfundSession";
import { AccessGate } from "./TerminalShell";
import { useTerminal } from "./TerminalContext";
import { api, download, money, useResource } from "./model";
import { GainsAnalytics } from "./GainsPortfolio";
import { PnlCalendar } from "./Analytics";
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
export default function ProductJournal() {
  const { product, context, t, message } = useTerminal(),
    session = useSession(),
    [params] = useSearchParams(),
    [draft, setDraft] = useState(() => ({
      ...empty(),
      tradeId: params.get("trade") || "",
      body: params.get("transaction")
        ? `https://arbiscan.io/tx/${params.get("transaction")}`
        : "",
    })),
    [editing, setEditing] = useState(
      !!params.get("trade") || !!params.get("transaction"),
    ),
    [filter, setFilter] = useState({ search: "", from: "", to: "" }),
    [page, setPage] = useState(0),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [calendar, setCalendar] = useState(false),
    file = useRef<HTMLInputElement>(null);
  const signed = session.status === "authenticated",
    query = new URLSearchParams(
      Object.entries(filter).filter(([, v]) => v),
    ).toString(),
    journal = useResource(
      product,
      signed ? `/journal?${query}&limit=20&offset=${page * 20}` : null,
      revision,
    ),
    overview = useResource(
      product,
      signed && product === "prop" ? "/overview" : null,
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
      setDraft(empty());
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
          onClick={() => {
            setDraft(empty());
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
          disabled={busy || !context}
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
          {t(
            "عملیات ناموفق بود؛ داده ذخیره نشده را نگه دارید.",
            "Request failed; retain any unsaved changes.",
          )}
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
                  <bdi>{money(trade.data.trade.netPnl)} DAI</bdi>
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
            <button type="submit" disabled={busy}>
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
                disabled={busy}
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
