# ADR 0043 — Canonical domains, geographic routing and Geo-IP language

- **Status:** Accepted (owner decisions 1–3, 2026-11-17). Cloudflare part applied; application part on branch `agent/claude/geo-canonical-locale`; geographic redirect created **disabled** (gated).
- **Date:** 2026-11-17
- **Builds on:** [ADR 0033](0033-regional-authority-and-synchronization.md) (regions), [ADR 0042](0042-liara-infrastructure-source-of-truth.md) (Liara manifest).
- **Register:** [infrastructure decisions](../deployment/INFRASTRUCTURE_DECISIONS.md).

## Context

The two regions served the website on seven hostnames with no canonical
domain. Every first visit without a saved language got Persian. Cloudflare
proxies only `openfi.cloud` and `openfund.cloud`; `openfi.live` is on Liara
DNS, and the `iran.*` hosts are DNS-only records pointing at Liara. The Iran
web process held no market prices, so every order there was refused as
`stale_price`.

## Decision

1. **One canonical website domain per region:** GLOBAL `https://openfi.cloud`,
   IRAN `https://openfi.live`. Aliases answer **301** with path and query:
   - `openfund.cloud`, `www.openfund.cloud`, `www.openfi.cloud`: Cloudflare
     redirect rules (proxied zones). The origin repeats it
     (`CANONICAL_ALIAS_HOSTS`) for requests that bypass Cloudflare.
   - `iran.openfund.cloud`, `iran.openfi.cloud`: the Iran app
     (`canonical-host.js`), because Cloudflare is not in their path. Proxying
     them would put a non-Iranian network in front of the Iran domain.
   - `www.openfi.live`: Liara's domain redirect (`set-redirect`, 301 to
     `https://openfi.live`) with a Let's Encrypt certificate.
   Never redirected: methods other than GET/HEAD, signed sync, probes, the
   JSON API prefixes, payments, CMS snapshot, admin, assets, WebSocket and
   event streams. `cms.openfi.cloud` and `backstage.openfi.cloud` are
   operational hosts, not aliases.
2. **Geographic routing at Cloudflare's edge only:** a **302** from
   `openfi.cloud` to `openfi.live` for `ip.src.country eq "IR"`, top-level
   GET document navigation only. Navigation means `Sec-Fetch-Dest: document`;
   without that header, an `Accept` that includes `text/html`. Excluded:
   machine paths, a browser with a session (`openfund_session`), and an
   explicit choice (`?region=global`, remembered by the origin in the
   `of-region` cookie). `XX` and `T1` are never Iran. There is no reverse
   rule, so no loop: Cloudflare does not see `openfi.live`. **The rule exists
   disabled** until the readiness gates in §Gates pass.
3. **Geo-IP default language, one policy for both regions**
   (`apps/backend/geo-locale.js`): IR→`fa`, RU→`ru`, CN→`zh-CN`, the 22 Arab
   League members→`ar`, others→`en`, unknown→`en`. Priority:
   1. a locale in the URL;
   2. the saved preference (`of-language`);
   3. the Geo-IP default (`runtime-config.js` `geoLocale`, private,
      `no-store`);
   4. English.
   The pre-paint script applies it before first paint.
4. **Trusted country:** `CF-IPCountry` counts only when the hop that reached
   the platform proxy is a published Cloudflare address
   (`apps/backend/geo-trust.js`). The header is removed before routing. A
   direct request to `onrender.com` with a forged header gets the fallback.
   The country chooses a language only, never access or money. On Liara (no
   Cloudflare) the fallback is `GEO_FALLBACK_LOCALE=fa`.
5. **TLS:** both Cloudflare zones use Full (strict), with the Render origin
   certificates verified for `openfi.cloud` and `openfund.cloud` first.
   Minimum TLS 1.2, Always Use HTTPS on.
6. **Iran pricing:** the Iran web app runs `http,market-data`. It executes
   orders and closes with its own fresh marks; the worker's engine loop runs
   SL/TP, liquidation and conduct. PostgreSQL row locks (`SELECT … FOR UPDATE`
   on the account) serialize the two processes.
   `test/split-process-engine.test.mjs` races them in separate module
   instances and proves exactly-once closes and reconciled balances. Market
   data never writes to the database.
7. **Central status:** Backstage (Render) shows GLOBAL and IRAN side by side
   from IRAN's public `/runtime/status`, `/ready` and `/version`
   (`BACKSTAGE_IRAN_ORIGIN`). No credential is sent to the other region.

## Gates for enabling the geographic redirect

The Cloudflare rule `openfund_geo_iran` stays disabled until all hold:

1. A release with this ADR's application changes runs on both regions, and
   the Iran alias redirects are verified (`verify-public.mjs --iran-aliases`).
2. The Iran web reports fresh marks (`/ready` `available_for_fresh_markets`).
3. The worker's default subdomain is disabled.
4. Cross-region identity and operation forwarding
   ([ADR 0044](0044-cross-region-operation-forwarding.md)) are implemented,
   tested on two regions and approved. Without them, a routed GLOBAL user
   meets a separate Iran account.
5. Explicit owner approval to enable it.

## Consequences

- Sessions are host-only cookies, so a visitor moved from an alias signs in
  again once on the canonical host.
- Sitemaps use the canonical origin, and `x-default` is English.
- Geographic routing cannot send non-Iranian visitors away from `openfi.live`:
  Cloudflare is not in that path, and moving its nameservers is not approved.
