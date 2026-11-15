# SIWE and DePay read-only domain check

Observed November 15, 2026. Public HTTP probes sent no transaction, checkout
order, signed verification request or nonce request.

| Host | HTTPS and runtime | SIWE | Checkout | DePay |
| --- | --- | --- | --- | --- |
| openfi.cloud | Verified TLS, GLOBAL, source 60d5df9 | Anonymous session returns 401; same-origin preflight returns 204 with credentials and origin headers; signed login untested | Catalog 200 and payments enabled; browser-document checkout returns HTML 200 | Public widget and integration ID configured; live checkout untested |
| openfund.cloud | Verified TLS, GLOBAL, source 60d5df9 | Anonymous session 401; preflight 204 without an allow-origin header; signed login untested | Catalog 200 and payments enabled; browser-document checkout returns HTML 200 | Public widget and integration ID configured; live checkout untested |
| openfund-our6.onrender.com | Verified TLS, GLOBAL, source 60d5df9 | Anonymous session 401; preflight 204 without an allow-origin header; signed login untested | Catalog 200 and payments enabled; browser-document checkout returns HTML 200 | Public widget and integration ID configured; live checkout untested |
| iran.openfund.cloud | Verified TLS; Liara returned 503 | Blocked by 503 | Blocked by 503 | Unknown |
| iran.openfi.cloud | Verified TLS; Liara returned 503 | Blocked by 503 | Blocked by 503 | Unknown |
| openfi.live | Verified TLS; Liara returned 503 | Blocked by 503 | Blocked by 503 | Unknown |
| www.openfi.live | TLS handshake rejected | Unknown | Unknown | Unknown |
| openfund-iran-staging.liara.run | DNS did not resolve from the probe location | Unknown | Unknown | Unknown |
| www.openfi.cloud | Verified TLS; redirects to openfi.cloud | Canonical origin | Canonical origin | Canonical origin |
| www.openfund.cloud | Verified TLS; redirects to openfund.cloud | Canonical origin | Canonical origin | Canonical origin |
| cms.openfi.cloud | Verified TLS; separate CMS host | Commerce session path 404 | Checkout path 404 | Commerce not deployed here |
| openfund-cms.onrender.com | Verified TLS; separate CMS host | Commerce session path 404 | Checkout path 404 | Commerce not deployed here |

The GLOBAL catalog advertises Ethereum, Arbitrum, Base, Polygon, Optimism,
Solana and BNB Chain. This confirms that its advertised checkout networks
extend beyond the Arbitrum One SIWE policy. GLOBAL checkout responses
included a Content Security Policy. Browser widget startup, session cookies
and redirect continuity require separate browser acceptance. Lack of
allow-origin on a preflight is relevant to cross-origin callers, while
same-origin browser requests do not require CORS.

Source review found signed DePay configuration, callback and event endpoints
in [purchases.js](../../apps/backend/purchases.js), with receipt verification
and purchase binding. The merchant dashboard's callback destinations,
receiving configuration and end-to-end verification were unavailable to these
public checks. Documented source aliases do not confirm merchant configuration.

The public [treasury snapshot](https://openfi.cloud/economy/treasury) returned
`not_configured` for the central reporting treasury. The separate
[checkout receiver balance view](https://openfi.cloud/economy/treasury/networks)
reported six successful reads and one Optimism read error. Those checkout
receivers do not establish an authorized payout sender.

A later read-only probe requested `Accept: text/html` on `/en/challenges`
and the registered `/en/checkout` route. Both returned HTML 200 on all
three GLOBAL hosts. The previous bare HTTP 404 did not exercise the
browser-document fallback. The local checkout flow provides plan selection
on the challenge page and carries the choice into checkout. Real order
creation, signed session restoration and actual transfers remain separate
acceptance steps.
