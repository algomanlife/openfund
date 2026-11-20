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
   **Allow-list, shared by the edge and the origin**
   (`apps/backend/redirect-policy.js`). Only a top-level browser document
   navigation qualifies: GET/HEAD with `Sec-Fetch-Dest: document`, or with no
   Sec-Fetch headers and an `Accept` that includes `text/html`. It must also
   target a client page path: `/`, `/{locale}` and below, `/terminal`,
   `/portfolio`, `/journal`, `/react` and the legacy section links.
   Everything else is served where it arrives: every API read and write
   (`/trading/state`, `/portfolio/overview`, …), event streams, WebSocket,
   payment callbacks, signed sync, probes and assets. A test evaluates the
   exact tree Cloudflare runs against every route the backend declares
   (331). The test found that `/accounts` is both a legacy section link and
   the authenticated `GET /accounts` API, so it is not a page path.
   `cms.openfi.cloud` and `backstage.openfi.cloud` are operational hosts,
   not aliases.
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
   2. the visitor's explicit choice (`of-language-choice`, written only by
      the language selector; see the amendment below);
   3. the Geo-IP default (`runtime-config.js` `geoLocale`, private,
      `no-store`);
   4. English.
   The pre-paint script applies it before first paint; the static
   `<html>` default is `lang="en" dir="ltr"`, the English fallback.

   *Amendment (2026-11-20).* Priority 2 originally read the `of-language`
   key. Every shell wrote that key on each render, so any locale a visitor
   had merely displayed — the Geo-IP default, a shared `/fa/…` link, or the
   Persian default of releases before 0.7 — became a permanent "preference"
   that outranked Geo-IP. Returning visitors therefore never saw their
   country default. The explicit choice now lives in its own key;
   `of-language` remains a render-tracking value for the classic scripts and
   never decides a locale-less visit. Visitors who chose a language before
   this change are treated as first-time visitors once and keep any choice
   they make afterwards.
4. **Trusted country:** `CF-IPCountry` counts only when the hop that reached
   the platform proxy is a published Cloudflare address
   (`apps/backend/geo-trust.js`). The header is removed before routing. A
   direct request to `onrender.com` with a forged header gets the fallback.
   The country chooses a language only, never access or money.
   On Liara (no Cloudflare), `GEO_COUNTRY_SOURCE=ip-database` looks up the
   visitor's IPv4 address in a licensed IP-to-country table (`geo-ipdb.js`,
   no new dependency). It reads the address at the `X-Forwarded-For`
   position the platform writes (`GEO_CLIENT_HOP`) and never reads
   `CF-IPCountry`. That hop must be **measured** on the real ingress with
   `GET /runtime/ingress`, which needs a deploy. Until then IRAN keeps
   `GEO_COUNTRY_SOURCE=cloudflare` (no trusted country there) and
   `GEO_FALLBACK_LOCALE=fa`. Direct visitors to `openfi.live` from Russia,
   China or Arab countries therefore get Persian until the measurement is
   done, a database is licensed and both are configured.
   **Ingress, measured 2026-11-17 with the rate limiter as a probe:**
   - On `openfi.cloud` the last `X-Forwarded-For` hop is a Cloudflare edge
     (two edges, two counters), and forged entries never changed it.
   - On `onrender.com` direct and on `openfi.live`, forged entries never
     changed the key.
   - Whether that key is the visitor or a shared proxy could not be settled
     from one network vantage point; `/runtime/ingress` settles it after
     deploy.
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
