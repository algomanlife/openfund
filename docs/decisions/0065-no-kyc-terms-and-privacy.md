# ADR 0065 — No KYC: the wallet owner is the account owner; Terms of Use and Privacy Policy

- Status: Accepted by the owner (2026-11-28).
- Amends: [ADR 0050](0050-openfund-premium-league.md) (prize payment),
  [ADR 0051](0051-migration-to-openfund.md) (migration review),
  [ADR 0054](0054-funded-trader-agreement.md) (already wallet-based).

## Decision

1. **Openfund runs no KYC.** It does not ask for, collect or verify names,
   identity documents, photos or home addresses, and it makes no
   identity-verification commitment to anyone. The wallet that signs in
   (EIP-4361) owns the account, its challenges, certificates and rewards.
   Rewards, prizes and refunds go only to that wallet. Openfund may refuse a
   payment to a wallet on a public sanctions list where the law requires it.
2. **Migration review has no identity step.** The `identity` evidence kind
   is no longer accepted, the checklist is the funded-account proof and the
   distinct payouts, and an approval needs the checklist, a size and a reason
   (no `kycVerified` / `nameMatched`). The `kyc_verified` and `name_matched`
   columns stay for existing rows and are never set.
3. **Premium League prizes** are paid to the winning wallet; a physical prize
   needs only a delivery address, used for nothing else.
4. **Terms of Use and Privacy Policy** are public pages, `/:locale/terms` and
   `/:locale/privacy`, in all five locales, linked from every footer. The
   built-in copy (`apps/web-react/src/features/legal/content.ts`) is the
   reviewed text; a published `legal_documents` row (`doc_type` `terms` or
   `privacy`) replaces it, and the built-in copy stays when Directus is down.

## Consequences

- Product copy, the rulebook, learning paths, the Backstage review screen and
  the tests say "no KYC" and never ask for identity documents.
- A Premium League terms draft already stored in Directus keeps the wording it
  was seeded with; the owner updates or republishes it in Backstage (the seed
  never overwrites an editor's row).
