# Whitepaper governance chapter

The Whitepaper application is **not part of this base branch**. It lives on the
unmerged branch `feat/openfund-whitepaper-v1` (typed bilingual chapters, Directus
`whitepaper_*` collections and a bundled fallback). This work therefore does not add
a competing Whitepaper. It prepares the chapter and records how to integrate it.

## What is prepared

`apps/web-react/src/features/governance/whitepaperChapter.ts` exports the chapter as
plain bilingual data whose shape matches the Whitepaper branch's `WpChapter`
(`slug`, `sort`, `kicker`, `title`, `summary`, `blocks`) using only block types that
branch already supports: lead, paragraph, heading, list, callout, definitions, table
and references. A test checks that every string exists in both languages and that
the chapter states the approved policy (ten seats, six of ten approvals, seven for
amendments, advisory-only financial topics, appointed versus elected, no token, not
yet in production use).

## Conflict to resolve at merge

That branch already has a chapter `governance` (sort 16, "Company-operated, publicly
accountable") that says contributions "do not confer voting rights or operational
authority". That wording predates Hybrid Governance and contradicts delegated council
authority. The prepared chapter **replaces** it. The parts about audited financial
decisions, four-eyes expenses and Directus not editing financial records remain true
and should be kept in the "Public accountability" or "Disclosures" chapters.

## Integration steps

1. Merge or rebase onto `feat/openfund-whitepaper-v1` once it is on `main`.
2. In `apps/web-react/src/cms/seed/whitepaper/chapters-future.ts`, replace the `governance` chapter object with `governanceChapter` (import from the governance feature, or move the module next to the other seeds).
3. Re-run `apps/backstage/scripts/seed_whitepaper_content.mjs` so Directus receives the new chapter. Editors then maintain it in Directus; the long-form text is not hard-coded in components.
4. Add `docs/governance` and `GOVERNANCE.md` to the chapter's `refs` list if reference keys are added for them.
5. Keep statuses honest: governance is built and tested, not in production use, until a council is seated.
6. Link the Governance page to the Whitepaper chapter when its route exists. Today the page links only to the repository documents.

## Outline

| Section | Content |
|---|---|
| Lead and status | The two authorities; not a DAO, no token, off-chain records, not yet in production use |
| Council | Ten seats, five constituencies, six-month terms, appointed first term |
| Authority boundary | Delegated domains versus reserved company powers |
| Proposal to decision | OFP lifecycle, quorum 7, approval 6 of 10, amendments 7 |
| Accountability | Conflicts, audit trail, signed votes, financial isolation |
| Evolution | On-chain governance is optional research, not planned |
