/** Pure presentation rules for the read-only Perpetual (Gains) account view.
 * No network, no wallet and no financial calculation lives here: the backend
 * snapshot (apps/backend/gains-portfolio.js) is the only source of record. */

export type GainsFeedState =
  | "signedout"
  | "loading"
  | "live"
  | "stale"
  | "inconsistent"
  | "outdated"
  | "unavailable";

export interface GainsResourceView {
  data: any | null;
  loading: boolean;
  error: string | null;
}

/** A retained snapshot after a failed refresh is "outdated", never "live";
 * an upstream-declared stale or inconsistent snapshot keeps that label. */
export function gainsFeedState(signedIn: boolean, r: GainsResourceView): GainsFeedState {
  if (!signedIn) return "signedout";
  if (r.error) return r.data ? "outdated" : "unavailable";
  if (!r.data) return "loading";
  const status = r.data.freshness?.status;
  if (status === "stale") return "stale";
  if (status === "inconsistent") return "inconsistent";
  /* a snapshot without freshness metadata cannot be presented as current */
  return status === "fresh" ? "live" : "stale";
}

/** Severity drives colour and the ARIA role (alert only for failures). */
export const feedSeverity = (s: GainsFeedState) =>
  s === "live" ? "ok" : s === "loading" || s === "signedout" ? "info" : s === "unavailable" ? "error" : "warn";

/** Gains SDK TradeType: TRADE=0, LIMIT=1, STOP=2 (backend `orderType`). */
export const ORDER_TYPES = ["market", "limit", "stop"] as const;

/** The most recent verified time a snapshot represents (oldest source fetch). */
export const snapshotTime = (data: any): string | null =>
  data?.freshness?.fetchedAt || null;

/** Transaction links only for well-formed Arbitrum transaction hashes. */
export const arbiscanTx = (tx: unknown): string | null =>
  typeof tx === "string" && /^0x[0-9a-fA-F]{64}$/.test(tx) ? `https://arbiscan.io/tx/${tx}` : null;
