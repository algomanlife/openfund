# ADR 0031 — Iran edge on Liara (same-origin reverse proxy, phase one)

- **Status:** Proposed (implemented on branch `infra/liara-iran-mirror`; not deployed)
- **Date:** 2026-11-14
- **Related:** [ADR 0013](0013-release-driven-production-deployment.md), [ADR 0014](0014-ghcr-release-image.md), [ADR 0027](0027-trading-stream-fan-out-and-engine-loop-isolation.md)

## Context

The owner asked for an Iranian deployment of Openfund on Liara at
`iran.openfund.cloud`, running the same verified version as Render, with
country-based routing prepared but disabled.

The repository audit at `d0e0909` (the commit `https://openfund.cloud/version`
reported on 2026-11-14) found the following:

1. Render runs **one** Node process (`apps/backend/server.js`). It serves the
   API, SIWE sessions, the SSE streams and the built React app from the same
   origin. At start-up it also runs migrations and starts these jobs without
   any switch to turn them off:
   - the trading engine loop (SL/TP, liquidation, pending orders, risk sweeps, every 1 s)
   - purchase-order expiry
   - on-chain payment recovery, which provisions challenges
   - live-settlement retries and treasury snapshots
   - Footprint ingestion from Hyperliquid
2. The only authoritative state is the Render PostgreSQL database.

A second copy of the backend could only connect to that database, which would
run every non-idempotent financial loop twice, or to a new database, which
would create a second writable ledger. Both are forbidden by the task. Making
the jobs switchable would change the application, and the release would no
longer match Render's.

## Decision

1. **Phase one is a same-origin edge, not a second backend.** A Liara Docker
   app (`infra/liara-iran`, nginx 1.28 unprivileged) reverse-proxies every
   request to the Render origin. The proxy contains no Openfund code, database,
   payment handler or secret. HTML, CSP, `/runtime-config.js`, the API, SSE and
   `/version` come from Render, so the edge always serves exactly the release
   Render serves. It needs no version of its own.
2. **Browser semantics are preserved.**
   - Cookies stay host-only on the edge host.
   - The edge translates only the `Origin` value equal to its own public
     origin into the upstream origin. The backend's same-origin CSRF check
     therefore still accepts first-party requests and rejects every other
     origin.
   - Redirects are rewritten to relative URLs.
   - Proxy buffering is off so SSE events are forwarded immediately.
3. **Edge-local behaviour:**
   - Content-hashed `/assets/` files are cached for seven days.
   - `/__edge/live` (liveness), `/__edge/ready` (the origin's `/health`) and
     `/__edge/info` (the deployed edge commit) are served by the edge.
   - `robots.txt` disallows crawling, `X-Robots-Tag: noindex` is set, and
     `sitemap.xml` is not served. The mirror is not indexed because the backend
     builds canonical URLs from the Host it receives.
4. **Never forwarded:** `/admin`, `/internal` and the DePay signed
   server-to-server routes (configuration, callback, events). DePay keeps
   calling the Render origin, so routing can never divert or duplicate a
   payment callback.
5. **Deployment:** `.github/workflows/deploy-liara-iran.yml`.
   - It runs only by manual dispatch of an exact 40-character `main` commit,
     with a typed confirmation and the `liara-iran` environment's required
     reviewers.
   - It builds the image, runs contract tests against a stub upstream, deploys
     with the pinned Liara CLI, then verifies the live edge with
     `scripts/liara/verify-edge.mjs`.
   - Rollback is the same dispatch with an older edge commit.
   - It never touches Render.
6. **Country routing** is a separate, owner-approved activation. The
   recommended mechanism is a Cloudflare Single Redirect rule that applies only
   to top-level document navigations. It ships disabled. See
   [Liara Iran edge](../deployment/LIARA_IRAN.md#country-routing).

## Consequences

- No duplicate engine, payment or settlement processing and no second ledger.
  The Iran edge is stateless and can be deleted at any time without data loss.
- **The edge does not make Openfund independent of the international
  internet.** If the Liara-to-Render path or Render is unreachable, the edge
  answers 502 and only `/__edge/live` stays up.
  - The Persian notice shipped on 2026-11-11 (`config/iranAccess.ts`) promises
    reachability during international-internet disruption and domestic
    price/depth sources. This phase does not deliver that. The owner must
    reword or hide the notice before routing users here.
- Browsers still contact some origins directly:
  - the CMS (`CMS_PUBLIC_URL`, on Render)
  - the market-data and wallet services the CSP allows (Gains, Hyperliquid,
    WalletConnect, TradingView, DePay, `api.bitpin.ir`)

  Their reachability from Iranian networks is outside this edge.
- Wallet sign-in on the edge host needs `iran.openfund.cloud` (and, while
  testing, the Liara default host) added to Render's `ALLOWED_DOMAINS` through a
  reviewed `render.yaml` change. Without it, SIWE answers `invalid_domain` and
  the edge is read-only. Sessions are per host: a user signs in again on the
  edge.
- The backend trusts one proxy hop, so it sees every edge user as Liara's
  egress IP. Per-IP rate limits (for example 60 `/auth/verify` per minute) and
  audit-log IPs are shared by all edge users. Fixing this needs a backend
  change (a trusted edge header) in a later release.
- Phase two (a domestic backend) needs the engine and payment jobs to become
  single-leader or switchable, and needs domestic market data. Those are
  application changes with their own ADR.
