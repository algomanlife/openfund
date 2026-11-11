# Repository governance

How the Openfund **source repository** is maintained: who may review, merge and
release code, and how decisions about the code are made.

This is not product governance. The hybrid community council, proposals and
votes described in [GOVERNANCE.md](../../GOVERNANCE.md) govern the Openfund
product; they do not grant write access, review authority or release authority
over this repository, and this document does not create a foundation, DAO,
elected maintainer body or community vote.

## Roles

| Role | Who today | Can do |
| --- | --- | --- |
| **Owner** | `@algomanlife` (sole administrator) | Repository settings, branch rules, environments, secrets, releases, production deployment approval, licensing decisions, final say on critical changes |
| **Maintainer** | `@algomanlife` | Review and merge pull requests, triage issues, label, close |
| **Contributor** | Anyone with a GitHub account | Open issues, discussions and pull requests from a fork or branch |
| **Coding agent** | Claude, Codex, Qwen and others, acting for a maintainer | Prepare branches and pull requests under [AGENTS.md](../../AGENTS.md); never approve, merge or release on their own authority |

New maintainers are added by the owner after a record of reviewed
contributions. The change is made in GitHub settings and in
[CODEOWNERS](../../.github/CODEOWNERS) in the same week, and noted in the changelog.

## Review authority

**Current limitation: Openfund has one maintainer.** GitHub does not let a pull
request author approve their own pull request, so a rule that requires one
approving review would block every pull request the owner opens, including
pull requests that coding agents open with the owner's account. Until a second
qualified reviewer exists:

- every change still goes through a pull request and all required checks;
- the owner reviews the full diff before merging, and records the review in the
  pull request (a comment, or an approval when the author is someone else);
- AI reviews may be attached as supplementary evidence but are never presented
  as an independent human approval;
- outside contributors' pull requests require the owner's approving review.

When a second maintainer joins, the target is: one approving review for normal
changes, code-owner review for the paths marked *heightened review* in
CODEOWNERS, and dismissal of stale approvals on new commits.

### Heightened review areas

Changes to these areas need the owner's explicit review even when CI is green,
a rollback note in the pull request, and, where relevant, evidence from an
isolated test environment:

- authentication, SIWE and sessions; wallet integration;
- payments, purchases, coupons, payouts, treasury, referrals and the economy ledgers;
- the trading engine, Prop challenge evaluation and risk calculations;
- database schema and migrations;
- smart contracts in `packages/openfund-protocol/` (dormant) and vendored upstream code;
- GitHub Actions, release scripts, the Render Blueprint and deployment runbooks;
- security policy, secret-scanning configuration and licensing documents.

## Merge rules

- `main` only changes through pull requests that pass every required check.
- Review conversations are resolved before merging.
- **Merge method: merge commits.** The release summary tool
  (`scripts/release/summary.mjs`) reads first-parent `Merge pull request #N`
  commits, so squash or rebase merges would drop pull requests from release
  summaries. Keep commits on a branch clean and conventional instead. Changing
  the merge method requires updating that tool first.
- Nobody merges their own pull request without the review step above.
- A merge does not deploy. See [Releases](../deployment/RELEASES.md).

## Decision-making

- **Code and architecture**: proposed in an issue or pull request, decided by
  the maintainer; significant decisions are recorded as ADRs in `docs/decisions/`.
- **Features**: open a feature request; the maintainer labels it, and work
  starts once it is accepted. Proposals that depend on commercial policy follow
  [ECONOMY.md](../../ECONOMY.md); delegated product domains follow
  [GOVERNANCE.md](../../GOVERNANCE.md).
- **Disagreements**: discussed in the issue or pull request; the owner decides.

## Issue triage

New issues get `needs-triage`. The maintainer aims to triage weekly (best
effort): confirm or close, add area labels (`frontend`, `backend`, `terminal`,
`prop-engine`, `documentation`), and mark suitable work `good first issue` or
`help wanted`. Issues that turn out to describe a vulnerability are moved to a
private security advisory and the public text is reduced to a neutral note.

## Security escalation

Vulnerabilities follow [SECURITY.md](../../SECURITY.md): private advisory,
acknowledgement, fix on a private fork or branch, coordinated disclosure.
Suspected credential exposure is treated as real until disproven: the owner
revokes and rotates the credential first, then investigates. History is never
rewritten without the owner's explicit decision.

## Release approval

Only the owner publishes releases. A release is published by dispatching the
*Unified release* workflow from `main` with `publish=true`; production
deployment then waits for approval in the protected `production` environment.
See [Releases](../deployment/RELEASES.md) and [Rollback](../deployment/ROLLBACK.md).

## Branch naming

| Prefix | Use |
| --- | --- |
| `feat/`, `fix/`, `ui/`, `security/`, `docs/`, `chore/`, `ci/` | Human contributor branches (`<type>/<short-description>`) |
| `agent/<agent>/<task>` | New coding-agent branches |
| `claude/`, `codex/`, `qwen/` | Established agent prefixes; still accepted |
| `dependabot/`, `upstream-watch/`, `upstream-candidate/` | Automation |
| `release/<version>` | Reserved; the current release flow tags `main` directly and does not use release branches |

There is no long-lived `develop` branch.

## Related documents

[CONTRIBUTING.md](../../CONTRIBUTING.md) ·
[Pull requests](PULL_REQUESTS.md) ·
[Repository security settings](REPOSITORY_SECURITY.md) ·
[AGENTS.md](../../AGENTS.md) ·
[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)
