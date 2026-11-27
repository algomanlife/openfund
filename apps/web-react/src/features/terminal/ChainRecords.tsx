import { useEffect, useState } from "react";
import { intlLocale } from "../../i18n/locales";
import { useTerminal } from "./TerminalContext";

interface ChainRecord {
  kind: "certificate" | "certificate_status" | "trade";
  action: "open" | "modify" | "partial_close" | "close" | null;
  certificateKind: string | null; certificateStatus: string | null;
  market: string | null; side: string | null; quantity: string | null;
  entryPrice: string | null; exitPrice: string | null; stopLoss: string | null; takeProfit: string | null; realizedPnl: string | null;
  at: string; status: "pending" | "sending" | "confirmed" | "failed"; txUrl: string | null; tokenUrl: string | null;
}
interface ChainResponse { network: string; explorerUrl: string; contracts: { certificate: string | null; ledger: string | null }; records: ChainRecord[] }

const num = (v: string | null) => (v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 8 }));

/**
 * ADR 0063: the public on-chain records of an evaluation (certificates,
 * outcome and every position event), newest first, each linked to its
 * Arbitrum Sepolia transaction. Records are queued in the same transaction
 * as the trade and sent shortly after; until then they show as pending.
 */
export function ChainRecords({ challengeId }: { challengeId: string }) {
  const { locale, t } = useTerminal();
  const [data, setData] = useState<ChainResponse | null>(null), [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`${(window as any).__ofBackendUrl || ""}/chain/challenges/${encodeURIComponent(challengeId)}/records`, { credentials: "include" });
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        if (active) { setData(body); setError(false); }
      } catch { if (active) setError(true); }
    };
    void load();
    const timer = setInterval(load, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [challengeId]);
  const action = (r: ChainRecord) =>
    r.kind === "certificate" ? ({
      purchase: t("گواهی خرید چالش", "Challenge purchase certificate"), trial: t("گواهی شروع تست رایگان", "Free Trial start certificate"),
      stage_pass: t("گواهی قبولی مرحلهٔ اول", "Phase 1 pass certificate"), final_pass: t("گواهی قبولی چالش", "Challenge pass certificate"),
      trial_pass: t("گواهی قبولی تست رایگان", "Free Trial pass certificate"), payout: t("گواهی دریافت پاداش", "Payout certificate"),
    } as Record<string, string>)[r.certificateKind ?? ""] ?? t("گواهی", "Certificate")
      : r.kind === "certificate_status" ? `${t("نتیجهٔ ارزیابی", "Evaluation outcome")} · ${r.certificateStatus === "passed" ? t("قبول", "passed") : r.certificateStatus === "failed" ? t("رد", "failed") : t("پایان مهلت", "expired")}`
        : ({ open: t("باز کردن پوزیشن", "Position opened"), modify: t("تغییر حد ضرر / حد سود", "Stop loss / take profit changed"),
          partial_close: t("بستن بخشی از پوزیشن", "Partial close"), close: t("بستن پوزیشن", "Position closed") } as Record<string, string>)[r.action ?? ""] ?? "—";
  const state = (r: ChainRecord) => r.status === "confirmed" ? t("ثبت‌شده", "Recorded") : r.status === "failed" ? t("ناموفق", "Failed") : t("در صف ثبت", "Queued");
  return <section className="of-panel of-chain-records" aria-labelledby={`chain-${challengeId}`}>
    <div className="of-dashboard-section-title"><h2 id={`chain-${challengeId}`}>{t("ثبت روی بلاکچین", "On-chain records")}</h2>{data && <span>{data.network}</span>}</div>
    <p className="of-muted">{t("گواهی‌ها و همهٔ رویدادهای معاملاتی این ارزیابی به‌صورت عمومی روی بلاکچین ثبت می‌شوند. هزینهٔ ثبت با اوپن‌فاند است و نیازی به امضای شما نیست.", "The certificates and every trading event of this evaluation are recorded publicly on the blockchain. Openfund pays for every record; no signature from you is needed.")}</p>
    {error && <p role="alert" className="of-error">{t("دریافت سوابق بلاکچین ناموفق بود.", "On-chain records could not be loaded.")}</p>}
    {!data && !error && <p role="status">{t("در حال دریافت…", "Loading…")}</p>}
    {data && !data.records.length && <p>{t("هنوز رکوردی ثبت نشده است.", "No records yet.")}</p>}
    {data && data.records.length > 0 && <div className="of-table-wrap"><table>
      <thead><tr><th>{t("رویداد", "Event")}</th><th>{t("بازار", "Market")}</th><th>{t("جزئیات", "Details")}</th><th>{t("زمان", "Time")}</th><th>{t("تراکنش", "Transaction")}</th></tr></thead>
      <tbody>{data.records.map((r, i) => <tr key={i} data-status={r.status}>
        <td>{action(r)}</td>
        <td dir="ltr">{r.market ? `${r.market} · ${r.side === "long" ? "Long" : "Short"}` : "—"}</td>
        <td dir="ltr">{r.kind === "trade"
          ? [r.quantity && `qty ${num(r.quantity)}`, r.exitPrice ? `exit ${num(r.exitPrice)}` : r.entryPrice && `entry ${num(r.entryPrice)}`,
              r.stopLoss && `SL ${num(r.stopLoss)}`, r.takeProfit && `TP ${num(r.takeProfit)}`, r.realizedPnl && `PnL ${num(r.realizedPnl)}`].filter(Boolean).join(" · ")
          : "—"}</td>
        <td><bdo dir="ltr">{new Date(r.at).toLocaleString(intlLocale(locale))}</bdo></td>
        <td>{r.txUrl ? <a href={r.txUrl} target="_blank" rel="noopener noreferrer">{t("مشاهده در Arbiscan", "View on Arbiscan")}</a> : state(r)}
          {r.tokenUrl ? <> · <a href={r.tokenUrl} target="_blank" rel="noopener noreferrer">NFT</a></> : null}</td>
      </tr>)}</tbody>
    </table></div>}
  </section>;
}
