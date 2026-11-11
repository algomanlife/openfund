/** Owner approval gate for the Persian Iran-access notice.
 *
 *  The notice states that https://iran.openfund.cloud keeps Openfund
 *  reachable during international-internet disruption, with challenge sales
 *  paused and domestic price/depth sources. On 2026-11-11 that host had no
 *  DNS record, so the claim is not operationally verified. The notice is
 *  therefore shown only in development builds (for review) until the owner
 *  verifies the route and its capabilities and sets this flag to `true`.
 *  Flipping the flag changes presentation only; it does not touch routing,
 *  market data or purchasing. */
export const IRAN_ACCESS_NOTICE_APPROVED = false

export const iranAccessNoticeEnabled = (): boolean =>
  IRAN_ACCESS_NOTICE_APPROVED || Boolean(import.meta.env.DEV)
