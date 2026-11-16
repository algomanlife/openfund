# Launch-completion review — out-of-scope findings

Findings recorded during the launch-completion mission
(branch `agent/claude/launch-completion`). These are outside the mission's
write scope and are reported for the owner, not fixed here.

| # | Area | Location | Severity | Finding | Suggested fix |
| - | ---- | -------- | -------- | ------- | ------------- |
| 1 | ADR numbering | `docs/decisions/0033-certificate-event-attestations.md`, `docs/decisions/0033-regional-authority-and-synchronization.md` | Low (documentation) | Two ADRs share number 0033, and number 0039 is skipped (…0037, 0038, 0040). Reproduce: `ls docs/decisions/ \| sort`. Cross-references elsewhere cite "ADR 0033" ambiguously. | Renumber `0033-certificate-event-attestations.md` to the free `0039` slot and update every cross-reference in one dedicated PR; renumbering was not done here because the cross-reference risk is out of mission scope. |
| 2 | Desktop editorial | `apps/open-trade/**` | Low | Open Trade desktop app has no editorial/visual-editing wiring; its copy does not flow through the content registry. | Separate task: wire the desktop surfaces through the same registry without touching order/wallet logic. |

## Pre-existing baseline failures

None. At the baseline commit (`00a470f`, latest `main` on 2026-11-16), all
recorded suites passed before any mission change: `npm run docs:check`,
`npm run test:release`, `npm --prefix apps/backstage test`,
`npm --prefix apps/web-react run typecheck`, `npm run test:web`, and
`npm --prefix apps/backend run test:all` (347 integration assertions plus
17 node:test files, 0 failures, against a disposable local PostgreSQL 17
database with a booted test server on :8080, CI pattern).
