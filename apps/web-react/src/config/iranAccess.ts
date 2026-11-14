/** Owner approval gate for the Persian Iran-access notice.
 *
 *  The notice presents https://iran.openfund.cloud as an alternative address
 *  that serves the same Openfund service through domestic hosting (the Liara
 *  edge, ADR 0031). It states that the address still depends on Openfund's
 *  international servers and does not work during an international-internet
 *  cutoff, and that sign-in there is separate. Corrected on 2026-11-14: the
 *  earlier copy promised availability during disruption, paused challenge
 *  sales and domestic price/depth sources, none of which the edge provides.
 *  On 2026-11-11 that host had no
 *  DNS record. On 2026-11-11 the owner approved showing the notice in
 *  production ahead of connecting that host (owner decision; the route itself
 *  is configured outside this repository). Set to `false` to hide it again.
 *  Flipping the flag changes presentation only; it does not touch routing,
 *  market data or purchasing. */
export const IRAN_ACCESS_NOTICE_APPROVED = true

import { publicRuntimeConfig } from './runtime'

/* The notice describes the ADR 0031 edge (a proxy to the international
   servers). The independent Iran runtime (ADR 0033) is not that, so the copy
   would be false there: it is never shown when the serving region is IRAN.
   Replacement copy for the Iran runtime is an owner decision. */
export const iranAccessNoticeEnabled = (): boolean =>
  publicRuntimeConfig().region !== 'IRAN' && (IRAN_ACCESS_NOTICE_APPROVED || Boolean(import.meta.env.DEV))
