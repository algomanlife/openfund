# 0057 — Bug bounty program

- **Status:** Accepted (2026-11-23)
- **Scope:** website (`/:locale/bug-bounty`, Resources → Security, footer), backend (`/.well-known/security.txt`, the `bug_bounty` expense category), Directus (`bug_bounty_tiers`, `bug_bounty_hall_of_fame`), Backstage (Security → Bug bounty), `SECURITY.md`
- **Item:** batch 3, J

## Context

Openfund already takes private security reports through GitHub's advisory
flow (`SECURITY.md`). The owner wants a paid program with a published reward
table, clear scope and rules, and a public record of what is paid.

## Decision

1. **Reports stay on GitHub's private advisory flow.** The page and
   `security.txt` point there. No new intake form or inbox is added.
2. **Reward amounts are owner-edited data.** `bug_bounty_tiers` holds one
   row per severity (critical, high, medium, low) with whole-USD minimum and
   maximum amounts. The defaults are Critical $2,000, High $1,000 to $1,500,
   Medium $500 to $800 and Low $300. Amounts change only in
   Backstage → Security → Bug bounty, behind the owner gate: session, CSRF,
   password re-entry, GLOBAL region and the audit log. The collection is on the
   forbidden list of the generic text editor, because amounts are financial
   values. The page shows the published table. When no content source
   answers, it shows the same published defaults, and it never mixes the two
   sources.
3. **Copy is interface text.** Severity labels, examples, scope, rules, the
   safe-harbor statement, the process and the FAQ are registered strings,
   editable in the Content workspace, in five locales.
4. **Hall of fame by consent only.** `bug_bounty_hall_of_fame` entries need
   recorded consent to be published. Both Backstage and the public read
   permission enforce this. Until there is one, the page shows an honest
   empty state.
5. **Payouts are economy expenses.** A payout is a verified expense in the
   new `bug_bounty` category (Backstage → Finance → Expenses), so it appears in
   the public transparency figures. The `verified_expenses` category
   constraint is widened additively.
6. **security.txt (RFC 9116)** is served by the backend at
   `/.well-known/security.txt` (and `/security.txt`) from the request's
   validated origin, so each region serves its own canonical URL. `Expires` is
   a fixed date, and `test/seo.test.mjs` fails when fewer than 60 days remain,
   so renewal is a deliberate change.
7. **No third-party names or footage.** The hero is an original drawing: a
   shield carrying the approved OpenFi mark, five component nodes and a scan
   line. It is labelled "illustrative". Public copy does not name the
   hosting provider (an existing content rule), so the out-of-scope line
   reads "our infrastructure services".

## Consequences

- The reward table can change without a deploy, and every change is owner
  gated and audited.
- Payouts are visible in the economy figures under their own category.
- `security.txt` must be renewed before 2027-10-31. The test reminds 60
  days ahead.

## Verification

- Backend: `test/bug-bounty.test.mjs` (`npm run test:bug-bounty`) and `test/seo.test.mjs`.
- Backstage: `operations/test/bounty.test.js`.
- Browser: `e2e/test-bug-bounty.cjs` (`npm run test:browser:bug-bounty`) covers five locales, both themes, 390/768/1440, reduced motion, the scope filter, the menu, the footer and `security.txt`.
