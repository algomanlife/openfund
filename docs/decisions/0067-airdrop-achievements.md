# ADR 0067 — Openfund airdrop: certificate-based achievements and reviewed claims

- Status: Accepted by the owner (2026-11-28).

## Decision

1. The Openfund airdrop pays **cash or other prizes, never a token**, and is
   separate from the Premium League. Only a wallet that bought a challenge
   takes part, and only that wallet is paid. No KYC
   ([ADR 0065](0065-no-kyc-terms-and-privacy.md)).
2. Five missions, shown as achievements with a badge each:

   | Mission | Valid certificates needed | Reward |
   | --- | --- | --- |
   | Buy and share | 1 purchase | $1,000 |
   | Pass and share | 1 purchase, 1 pass | $2,000 |
   | Get paid and share | 1 purchase, 1 pass, 1 payout | $3,000 |
   | Three purchases and a pass | 3 purchases, 1 pass | $4,000 |
   | Ten payouts | 10 payouts (and a purchase) | $5,000 |

3. Progress is computed only from **valid** certificates of the account
   (`certificates`, revoked ones excluded), never from anything the trader
   types (`apps/backend/airdrop.js`).
4. A completed mission is claimed once per wallet with 1 to 5 public https
   post links (`POST /airdrop/claims`). A rejected claim can be sent again.
5. Openfund reviews every claim in Backstage (Airdrop claims): approve or
   reject with a reason, then record the payment with its on-chain
   transaction (`paid`). States: submitted, approved, rejected, paid.

## Consequences

- New table `airdrop_claims` (additive), protected and outside Directus
  (`infra/postgres/cms-privileges.json`).
- Routes: `GET /airdrop/missions` (public), `GET /airdrop/me` and
  `POST /airdrop/claims` (signed-in), `GET /admin/airdrop/claims` and
  `POST /admin/airdrop/claims/:id/decide` (admin).
- The `/:locale/airdrop` page shows the achievements, progress and the claim
  form; amounts are the same in the page and the backend (tested).
