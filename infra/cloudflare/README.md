# Cloudflare (openfi.cloud, openfund.cloud)

Desired state: [`policy.mjs`](policy.mjs) (DNS, TLS settings, redirect rules,
machine paths). Applied on 2026-11-17 through the authenticated Cloudflare
connector, after a read-only snapshot. No credentials are stored here.
`openfi.live` is on Liara DNS and is not managed by Cloudflare
([ADR 0043](../../docs/decisions/0043-canonical-domains-geo-routing-and-locale.md)).

Account `ce7d296d88407cc57f0376f0277b672d` (Free plan zones).

## Applied state

| Zone | Change | Before | After / identifier |
| :--- | :--- | :--- | :--- |
| both | `ssl` | `full` | `strict` (Render origin certificates verified first) |
| both | `min_tls_version` | `1.0` | `1.2` |
| both | `always_use_https` | `off` | `on` |
| openfund.cloud | DNS `www` (record `ce6c0ccdaedb719e0127edd29aa9329e`) | CNAME `openfi.cloud`, DNS-only | CNAME `openfund-our6.onrender.com`, proxied. A proxied CNAME to the other zone's host bypassed this zone's rules |
| openfi.cloud | redirect rule `025b2b6238574c5c996022b6d4eb9037` "Static" | 302 → `https://openfi.cloud:8443`; its expression never matched | deleted |
| openfi.cloud | ruleset `92e35ec37fa246cf9a99f6edee62a2b4` (dynamic redirect) | v2 | v5: `a7bf4b9ab19e4150b36b88278de6cf2c` `openfund_canonical_openfi_cloud` (301, enabled); `a1fd3b9a3f8a4693868234c45c920c17` `openfund_geo_iran` (302, **disabled**) |
| openfund.cloud | ruleset `a1993c3d9af5437ba86d5698e3e849a9` (dynamic redirect, new) | none | `9e25c9b852904f1086d9f0dffd9805e0` `openfund_canonical_openfund_cloud` (301, enabled) |

Unchanged: IP geolocation (on), WebSockets (on), every other DNS record
(`cms`, `backstage`, `iran.*` and ACME records stay DNS-only), no Workers,
no page rules.

## Verify

```bash
node scripts/cloudflare/verify-public.mjs
```

It makes real HTTPS requests: alias 301s with path and query, no redirect on
probes/sync/API/POST, HTTP→HTTPS, operational hosts, and certificate
validity of every hostname. It cannot prove geographic routing; that needs a
probe inside Iran once the rule is enabled.

## Enable geographic routing (owner approval required)

Only after the gates in ADR 0043 §Gates. Then, in this zone's ruleset, set
`enabled: true` on rule `a1fd3b9a3f8a4693868234c45c920c17`
(`PATCH /zones/b6dd98ace3338cf967451697ae2aca61/rulesets/92e35ec37fa246cf9a99f6edee62a2b4/rules/a1fd3b9a3f8a4693868234c45c920c17`).
Verify from an Iranian network that `https://openfi.cloud/` answers 302 to
`https://openfi.live/` and that `?region=global` stays.

## Rollback

| Change | Undo |
| :--- | :--- |
| Canonical rules | `DELETE /zones/{zone}/rulesets/{ruleset}/rules/{rule}` for the three IDs above (or set `enabled: false`) |
| Geographic rule | set `enabled: false` (it is created disabled) |
| TLS settings | `PATCH /zones/{zone}/settings/ssl` `{"value":"full"}`; `min_tls_version` `1.0`; `always_use_https` `off` |
| `www.openfund.cloud` | `PATCH` the record back to `content: openfi.cloud, proxied: false` |
| Deleted "Static" rule | not restored: it never matched and targeted port 8443 |
