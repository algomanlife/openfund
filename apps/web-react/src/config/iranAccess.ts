/** Owner approval gate and the owner-confirmed address list for the Iran
 *  access notice (features/notice/IranAccessNotice.tsx).
 *
 *  History: the 2026-11-11 copy promised availability during disruption; the
 *  2026-11-14 copy described only iran.openfund.cloud as a proxy to the
 *  international servers (ADR 0031). Since ADR 0033 the notice lists all
 *  three Iran addresses and its wording follows the verified serving region
 *  and mode (runtime configuration), not the hostname. The owner reported the
 *  DNS records and SSL of all three addresses as active in the Liara panel on
 *  2026-11-14; reachability during a long international outage is not
 *  guaranteed for any `.cloud` or `.live` name and is never claimed.
 *  Set the flag to `false` to hide the notice. Presentation only: it does not
 *  touch routing, market data or purchasing. */
export const IRAN_ACCESS_NOTICE_APPROVED = true

/** Iran access addresses, in display order. */
export const IRAN_ACCESS_DOMAINS = ['iran.openfund.cloud', 'iran.openfi.cloud', 'openfi.live'] as const
/** The separately registered domain with authoritative DNS on Liara. */
export const IRAN_INDEPENDENT_DOMAIN = 'openfi.live'

export const iranAccessNoticeEnabled = (): boolean =>
  IRAN_ACCESS_NOTICE_APPROVED || Boolean(import.meta.env.DEV)
