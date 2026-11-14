# Certificate issuance and verification

## Contract

Source implementation, not a deployment or official release. The certificate
service reads existing financial evidence and never writes balances, trades,
payments, evaluation results or withdrawals.

- Purchase: paid order with a recorded paid date and an owned provisioned challenge.
- Completion: passed challenge, completion date and approved operator review with
  a funded-account reference. A temporary frontend pass is insufficient.
- Payout: owned challenge, paid withdrawal, recorded payout reference and review
  date. Pending and approved requests are ineligible.

Before first issuance, the owner confirms a display name or elects the connected
wallet address. The page explains one-time selection and public disclosure. The
unique identity insert enforces this even with concurrent requests. Later profile
changes do not change certificates. The name is not proof of legal identity.

Issuance is reconciled when the authenticated certificate list is requested,
after identity confirmation. The server selects eligible evidence independently
of the client. A per-user row lock and `(kind, source_id)` uniqueness prevent
concurrent duplicate issuance. Identifiers are random UUIDs with 122 random bits,
serialized as 32 lowercase hexadecimal characters. There is no client issuance
endpoint accepting a type, amount, event, holder or serial.

## API and access

| Endpoint | Access and behavior |
| --- | --- |
| `GET /certificates` | Session-owned list; reconcile eligible evidence |
| `POST /certificates/identity` | Session; explicit `confirmed: true`, nullable `displayName`; one-time |
| `POST /certificates/verify` | Anonymous lookup by `serial`; 30 requests/IP/minute across serials |
| `POST /admin/certificates/:serial/revoke` | Existing admin token, named actor, required reason; idempotent revocation |
| `POST /admin/certificates/identities/:userId/correct` | Existing admin token, named actor, reason; audited future-issuance correction |

Public lookup returns only serial, certificate type/status, holder, plan, amount,
currency, event/issue dates and revocation date. It excludes internal user,
challenge, order and withdrawal IDs, payout references, operator notes and trading
records. Revoked lookups disclose only serial, status and revocation date. All
certificate reads are `no-store`. Draft editorial content has no authority over
issuance. Directus receives no permission on certificate operational tables.

Issued snapshots and event history are protected from rewriting/deletion by
PostgreSQL triggers. Revocation is permanent and retains the event history.
Administrative name correction affects future issuance only; an incorrect issued
snapshot must be revoked, not silently rewritten.

## Presentation and editing

Three canvas compositions share the original `mark-mint.svg` emblem, Openfund
font and dark-green/mint palette: purchase uses nested geometry, completion uses
concentric rings, payout uses diagonal accents. These are original compositions;
no reference image was supplied with this task.

Static labels, eligibility copy and certificate headings are in
`apps/web-react/src/features/certificates/content.ts`, consumed through the
existing `pickRecord` localization path. The content registry/Directus override
workstream owns their editor mapping. Financial values and evidence are never
CMS values. Additional locales use the existing English fallback behavior.

The browser shapes Persian text using the existing packaged font, renders a
2400 × 1600 image and encodes a genuine QR linking to the current origin's
localized verification route. PNG and a landscape PDF carry the same raster
image; the PDF is not a text-searchable/vector document. The public verification
page can be opened by a phone's normal QR scanner; no camera permission is needed.
A downloaded copy cannot prove current validity: its QR must be checked for
revocation.

## Validation

The isolated PostgreSQL acceptance suite is registered as `test:certificates`
in `apps/backend/package.json`, including the existing `test:all` CI entry.
It tests identity races, input validation, missing eligibility evidence,
all three types, concurrent issuance, owner isolation, public data minimization,
revocation, snapshot immutability, administrative corrections and rate limiting.

Local verification on 2026-11-14:

- Node 26: typecheck and production build passed with the root-owned route and
  public-page type integration applied temporarily in the isolated worktree.
- PostgreSQL 17 on a newly created disposable cluster: 11/11 backend tests passed.
- `e2e/test-certificates.cjs`: real SIWE/API, disposable test records, UI name
  confirmation, all three eligible certificate types and reload persistence.
- Public verification: 20 responsive combinations passed (English/Persian,
  light/dark, widths 1440, 1024, 768, 390 and 360); no document overflow.
- Both locales/themes: actual PNG/PDF download controls worked; PNG dimensions
  were 2400 × 1600 and an independent QR decoder recovered the exact real local
  verification URL and serial. Unknown serials rendered no certificate.
- Persian PDF parsed as one 900 × 600-point page, rendered using PyMuPDF and
  visually inspected for connected Persian text, layout, emblem and QR.
- Blueprint, documentation checks, license inventory and diff whitespace passed.

Evidence is generated under `output/playwright/certificates/` by the browser
suite. The test certificates are explicitly isolated synthetic test events,
not real purchases, successful evaluations or payouts. Local CMS was unavailable;
its fallback content was exercised, not live Directus publication.

Initial local attempts exposed setup issues (an unmigrated test database, missing
root tooling, unavailable system Chrome and a wallet already connected before a
connect-button click). These were corrected before the passing acceptance run.
The default wallet dependency install reports existing upstream vulnerabilities;
no dependency-security baseline was weakened.
Production acceptance remains unverified and requires human-reviewed deployment.
