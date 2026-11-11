/** Owner approval gate for the Persian Iran-access notice.
 *
 *  The notice states that https://iran.openfund.cloud keeps Openfund
 *  reachable during international-internet disruption, with challenge sales
 *  paused and domestic price/depth sources. On 2026-11-11 that host had no
 *  DNS record. On 2026-11-11 the owner approved showing the notice in
 *  production ahead of connecting that host (owner decision; the route itself
 *  is configured outside this repository). Set to `false` to hide it again.
 *  Flipping the flag changes presentation only; it does not touch routing,
 *  market data or purchasing. */
export const IRAN_ACCESS_NOTICE_APPROVED = true

export const iranAccessNoticeEnabled = (): boolean =>
  IRAN_ACCESS_NOTICE_APPROVED || Boolean(import.meta.env.DEV)
