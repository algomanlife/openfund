# Pull requests, branches and merge readiness

Rules for opening, stacking, updating and merging pull requests. Releases are
separate: merging never deploys ([Releases](../deployment/RELEASES.md)).

## Opening a pull request

1. Branch from the latest `main`: `codex/<topic>`, `qwen/<topic>`, `docs/<topic>`,
   `ci/<topic>`, `chore/<topic>` or `feat/<topic>`. One logical change per branch.
2. Title: a Conventional Commit, `type(scope): subject`.
3. Description: use the template. `PR description` (workflow `pr-description.yml`)
   checks that every section exists and is answered, and that the title is
   conventional. It checks structure only, never the quality of the answers.
   Dependabot pull requests are exempt.
4. Keep generated output out of the diff (`react/` is not tracked).

## Conventional Commit types and scopes

Types: `feat`, `fix`, `perf`, `security`, `refactor`, `docs`, `test`, `ci`,
`build`, `chore`, `revert`. A `!` after the scope, or a `BREAKING CHANGE:` footer,
marks a breaking change (it drives the next version, see `scripts/release/lib.mjs`).

Scopes (lower case; combine with a comma when a change really spans two):

| Scope | Area |
| --- | --- |
| `terminal`, `chart`, `charts` | shared terminal UI, quick trade, Vela bridge |
| `engine`, `prop`, `perpetual` | trading engine, Prop and Perpetual products |
| `payments`, `checkout`, `purchases` | challenge purchases, DePay, verification |
| `funded`, `payouts`, `economy`, `treasury` | funded accounts, withdrawals, Economy ledgers |
| `governance` | hybrid governance |
| `wallet`, `auth` | wallet connection, SIWE sessions |
| `i18n`, `cms` | localization, Directus schema and content |
| `gains` | Gains Network market data |
| `release`, `deploy`, `ci` | release tooling, Render deployment, workflows |
| `deps`, `repo` | dependencies, repository hygiene |
| `docs`, `brand`, `website` | documentation, brand assets, public website |

## Stacked pull requests

A pull request whose base is another pull request's branch is *stacked*.

- Prefer independent pull requests. Stack only when B cannot be reviewed without A.
- Name the base in the description (`Related PRs`) and in the title suffix if helpful.
- **A stacked pull request must contain only its own commits on top of its base.**
  Do not merge another feature branch into a stacked branch; that makes the pull
  request carry foreign commits (this happened: PR #65 contains every #63 and #64
  commit, so its "1 of 5" scope is not reviewable on its own).
- Merge bottom-up. After the base merges, retarget the next pull request to `main`
  (`gh pr edit <n> --base main`) *before* deleting the base branch, then update it.
- Never force-push a shared branch; update with a merge of `main` (below).

## Keeping a branch current

```bash
git fetch origin
git merge origin/main          # never rebase or force-push a shared branch
```

Resolve conflicts by combining both sides; never drop another contributor's change.
`CHANGELOG.md` entries are added at the top of `## Unreleased`, which is the usual
conflict: keep every entry. Re-run the relevant checks after the merge.

## Dependency-aware merge plan

For several open pull requests:

1. List each head and base (`gh pr list --json number,baseRefName,headRefName`).
2. Compute ancestry: `git merge-base --is-ancestor origin/<headA> origin/<headB>`.
   If A is an ancestor of B, A must merge first, and B's diff shrinks automatically.
3. For unrelated heads, check conflicts without touching either branch:
   `git merge-tree --write-tree origin/<headA> origin/<headB>` (exit 1 = conflicts).
4. Order: ancestors first; then shared/schema/lockfile/CI changes; then features;
   documentation last. Re-run the plan after every merge.

## Merge-readiness checklist

- [ ] Up to date with `main`; no unresolved conflicts or foreign commits
- [ ] All six required checks pass on the head commit (`Web (React + Vite)`, `Backend (API + engine)`, `Render Blueprint`, `Secret scan`, `Release package gates`, `Release secret scan`)
- [ ] `PR description` check passes and the template is truthfully filled in
- [ ] Docs contract met: `npm run docs:check`, Feature Status, roadmap, ADR, `CHANGELOG.md`
- [ ] Schema changes are additive and go through `schema.sql` + `migrate.js`
- [ ] New env vars are in `render.yaml`, `docs/deployment/ENVIRONMENT.md` and `.env.example`
- [ ] Dependency changes have a registry entry (`npm run deps:check`)
- [ ] Disabled-by-default features remain disabled; nothing is described as deployed
- [ ] Rollback is stated and credible
- [ ] Review approval recorded; stacked bases merged first

## After merging

Merging to `main` runs the candidate gates but does **not** deploy. Production is
whatever `/version` reports. See the version authority hierarchy in
[Releases](../deployment/RELEASES.md) and generate a release summary with
`node scripts/release/summary.mjs`.
