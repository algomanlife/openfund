# Infrastructure decision register

Owner decisions that shape the production topology. Each links to the ADR
that implements it and its current state. Iran lockdown behaviour is
explicitly out of scope until the owner defines it.

| # | Decision (owner, 2026-11-17) | ADR | State |
| :--- | :--- | :--- | :--- |
| 1 | **Canonical domains.** GLOBAL `https://openfi.cloud`, IRAN `https://openfi.live`. Every other regional website domain redirects (301) to its region's canonical domain | [0043](../decisions/0043-canonical-domains-geo-routing-and-locale.md) | GLOBAL aliases and `www.openfi.live`: deployed and verified. `iran.openfund.cloud` and `iran.openfi.cloud`: implemented, deploy with the next release |
| 2 | **Active regional architecture.** Render and Liara are both operational regions with one user identity, safe cross-region access, consistent account state and one central Backstage. Only Iranian public website traffic is routed to Liara | [0043](../decisions/0043-canonical-domains-geo-routing-and-locale.md), [0044](../decisions/0044-cross-region-operation-forwarding.md) | Iran pricing fixed in code (deploy pending). Central Backstage regional status implemented. Cross-region identity and forwarding: proposed (ADR 0044), not implemented. Geographic redirect created **disabled** |
| 3 | **Geo-IP language.** Iran → Persian, Russia → Russian, China → Simplified Chinese, Arab League countries → Arabic, rest of the world → English. Manual language selection always wins | [0043](../decisions/0043-canonical-domains-geo-routing-and-locale.md) | Implemented and tested; deploy with the next release |

## Where each piece lives

| Concern | Source of truth |
| :--- | :--- |
| Cloudflare zones, DNS, TLS and rules | [`infra/cloudflare/`](../../infra/cloudflare/README.md) |
| Liara apps, roles, domains, GitHub environments | [`infra/liara-iran-runtime/stack.json`](../../infra/liara-iran-runtime/stack.json) |
| Render services and variables | [`render.yaml`](../../render.yaml) |
| Country → language | [`apps/backend/geo-locale.js`](../../apps/backend/geo-locale.js) |
| Alias redirects in the application | [`apps/backend/canonical-host.js`](../../apps/backend/canonical-host.js) |
