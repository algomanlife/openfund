# ADR 0050: Openfund Premium League (tournament subsystem)

**Status:** Accepted for local implementation (item A of the second owner batch). Not deployed. Registration stays closed until the owner publishes the terms and configures the email provider.

## Context

The owner asked for a 30-trading-day competition in analysis and risk management: one $125,000 demo account per entrant, daily loss 5% (UTC+3 day basis), static maximum loss 10%, consistency 35%, ranked by final equity. Prizes: cash for ranks 1 to 3, a $50K Standard challenge plus hardware and games for ranks 4 to 10, and a 35% single-use coupon for ranks 11 to 100. Start: Monday 4 January 2027, 00:00 UTC.

The platform already has a challenge engine that enforces daily and maximum loss on demo accounts, a certificates service, notifications, coupons, and (since ADR 0049) granted entitlements. It had no email sending and no notion of a competition.

## Decision

1. **Accounts are challenge accounts.** A hidden, inactive plan `premium-league` (never sold) has no profit target (`phases: 0`) and the tournament's loss limits. At the start, each verified registration gets an ordinary challenge with a frozen rules snapshot, so the existing engine enforces the limits. One engine branch differs: a breach marks the registration `out_of_ranking` (once) and leaves the account open for practice; the time limit is the competition end, where open positions close at the mark and the account is frozen.
2. **Rules are data.** The `tournaments` row holds schedule, limits and prizes. Backstage may change them only before the start; the end is computed from the start and the number of weekdays (`tradingEnd`, the same rule in the backend and the website).
3. **Registration.** A SIWE session, then email + optional nickname + acceptance of the published terms (`legal_documents`, `doc_type 'tournament-terms'`, `status 'published'`; the accepted version is stored), then a 6-digit code sent by email and stored only as an HMAC. One entry per wallet and per email address; code requests are rate-limited. Registration is open only while the terms are published, the email provider is configured and the start is in the future. Until then the page says "opens soon" and collects nothing.
4. **Email.** `apps/backend/email.js` is one adapter behind `EMAIL_PROVIDER` (`resend`, or `log` for development and tests, refused in production), `EMAIL_API_KEY` (secret, `sync: false`) and `EMAIL_FROM`. It reports `configured: false` until valid values exist.
5. **Ranking is computed once and frozen.** Equity is sampled server-side (`tournament_snapshots`, every `TOURNAMENT_SAMPLE_INTERVAL_MS`). After the end, the owner finalizes in Backstage: every account must be settled; ranked entries need an `active` registration, at least one closed trade and the consistency rule (no single UTC+3 day above 35% of total profit). Order: final equity to the cent, then lower maximum drawdown, then the earlier time the final equity was reached. The result goes to the append-only `tournament_standings`.
6. **Awards come from the frozen standings and are idempotent.** Cash and hardware are tracked to fulfilment in `tournament_awards` (KYC and sanctions checks happen outside the platform). Ranks 4 to 10 receive an entitlement (ADR 0049); ranks 11 to 100 a single-use 35% coupon bound to the wallet for 90 days; ranks 1 to 10 a badge and every entrant who keeps the account to the end a Finisher badge, both as certificates.
7. **Review, not automation.** Backstage shows signals (shared network prefixes, mirrored or opposite trades within 60 seconds, registration bursts) for human review. Disqualification is a reasoned, owner-gated, audited action.
8. **Region.** The competition runs on GLOBAL only. IRAN does not mount the routes and the page shows that it is not available there.
9. **Operator surface.** Backstage (owner session, CSRF, password re-entry, audit) is the operator surface. Tournament tables are not registered as Directus collections, so registrant emails are not exposed through the CMS.

## Consequences

- No new trading or settlement path: the engine, marks and settlement are shared with challenges, and so are their tests.
- The public page never invents numbers: before the start it shows only the real count of verified registrations; the leaderboard appears at the start from server-side samples.
- The owner must publish the reviewed terms (a draft is seeded once by `seed_production_content.mjs` and never overwritten) and set the email secrets before registration opens.
- Third-party product names appear in text only; the artwork is original and draws generic shapes.
