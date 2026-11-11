# Repository security settings

What protects the `algomanlife/openfund` repository, where each control is
configured, and what is still pending an owner decision. Many of these
settings live only on GitHub, not in repository files; this page records them
so a reviewer can check them. Audit date: **2026-11-11**, read through the
GitHub REST API with the owner's administrator access.

The application's own security model (SIWE, sessions, authorization) is in
[SECURITY.md](../../SECURITY.md) and [Security architecture](../security/SECURITY.md).

## Protection matrix

| Protection | Before 2026-11-11 | Now | Where |
| --- | --- | --- | --- |
| `main`: no force push, no deletion | On | On | Branch protection (classic) |
| `main`: required status checks, branch up to date | On (6 checks, strict) | On | Branch protection |
| `main`: rules apply to administrators | On | On | Branch protection |
| `main`: pull request required | **Off** (a push of an already-checked commit was possible) | Pending owner approval | Branch protection |
| `main`: required approving reviews | Off | Off, **by design while there is one maintainer** ([why](REPOSITORY_GOVERNANCE.md#review-authority)) | Branch protection |
| `main`: conversation resolution required | Off | Pending owner approval | Branch protection |
| Required checks bound to GitHub Actions | 4 of 6 (`Release package gates` and `Release secret scan` accept any app) | Pending owner approval | Branch protection |
| Release tags `v*` immutable (no update/delete) | On | On | Ruleset *Immutable Openfund release tags* |
| Production deployment approval | On (owner as required reviewer, protected branches only) | On | Environment `production` |
| Admin bypass of production approval | Allowed | Allowed — recommend disabling | Environment `production` |
| Secret scanning (alerts) | Off | **On** | Settings → Code security |
| Secret scanning push protection | Off | Pending owner approval | Settings → Code security |
| gitleaks on pull requests and releases | On | On; third-party action pinned to a commit | `ci.yml`, `release.yml` |
| Full-history gitleaks baseline | 49 unreviewed false positives | Clean (reviewed fingerprints in `.gitleaksignore`) | `.gitleaksignore` |
| Private vulnerability reporting | **Off** (SECURITY.md pointed to a form that did not accept reports) | **On** | Settings → Code security |
| Dependabot alerts | Off | **On** | Settings → Code security |
| Dependabot security updates | Off (although the dependency policy assumed them) | **On** | Settings → Code security |
| Dependabot version updates | On (weekly, grouped, no majors) | On | `.github/dependabot.yml` |
| Dependency review on pull requests | Off | **On** (not required yet) | `dependency-review.yml` |
| CodeQL code scanning | Off | **On** (default setup: Actions, JavaScript/TypeScript, Python) | Settings → Code security |
| Default `GITHUB_TOKEN` permission | Read | Read | Settings → Actions |
| Actions may approve pull requests | No | No | Settings → Actions |
| Allowed actions | All actions | All actions — recommend restricting | Settings → Actions |
| CODEOWNERS | None | Present (advisory; one owner) | `.github/CODEOWNERS` |

"On" in the *Now* column for a GitHub setting means it was read back from the
GitHub API after the change, not only requested.

## Pending owner approval

These can block pushes or merges, so they were prepared but not applied.

### 1. Require pull requests and resolved conversations on `main`

Effect: every change to `main` goes through a pull request, even for
administrators; zero approvals are required, so the sole maintainer can still
merge. Release automation is unaffected: it only pushes tags. The upstream
automation only pushes its own branches.

GitHub UI: **Settings → Branches → `main` → Edit**, then tick **Require a pull
request before merging** (leave *Required approvals* at 0) and **Require
conversation resolution before merging**. Save.

### 2. Bind the two release checks to GitHub Actions

Effect: a status named `Release package gates` or `Release secret scan` can
only be satisfied by GitHub Actions, not by any other integration that can
post statuses. Same UI page: under **Require status checks to pass**, remove
the two checks and add them again, choosing **GitHub Actions** as the source.

### 3. Turn on secret scanning push protection

Effect: pushes containing a recognized provider credential are blocked unless
the pusher records a bypass reason. Generated bundles in `dist/` contain
documented public SDK constants (see `gitleaks.toml`); if one of them is ever
recognized as a provider secret, the push can be allowed with a "false
positive" bypass. **Settings → Code security → Secret Protection → Push protection → Enable.**

### 4. Production environment hardening

**Settings → Environments → production**: untick **Allow administrators to
bypass configured protection rules**. The owner remains the required reviewer,
so this does not lock anyone out; it only removes the silent skip. *Prevent
self-review* stays off until a second reviewer exists.

The environments `main - openfund` and `main - openfund-db` were created by
Render's GitHub deployment status integration. They hold no secrets or rules;
leave them unless that integration is removed.

### 5. Restrict allowed actions

**Settings → Actions → General → Actions permissions**: *Allow algomanlife,
and select non-algomanlife, actions and reusable workflows* → tick *Allow
actions created by GitHub* and add `gitleaks/gitleaks-action@*`. All workflows
currently use only GitHub-owned actions and gitleaks. Re-check before
enabling if a new action was added.

### 6. When a second maintainer joins

Set *Required approvals* to 1, enable *Dismiss stale approvals*, *Require
review from Code Owners* and *Require approval of the most recent push*; add
the maintainer to `.github/CODEOWNERS`; enable *Prevent self-review* on the
`production` environment.

## GitHub Actions review (2026-11-11)

| Finding | Severity | Status |
| --- | --- | --- |
| No `pull_request_target` or `workflow_run` triggers; fork pull requests run without secrets | — | Safeguard already in place |
| Workflow-level permissions are `contents: read`, widened per job only where needed | — | Safeguard already in place |
| Pull request title and body reach scripts through `env`, not `${{ }}` in shell | — | Safeguard already in place |
| Production deploys run only from `main` in the protected `production` environment; the Render token is an environment secret | — | Safeguard already in place |
| `gitleaks/gitleaks-action@v2` (third-party, receives a token with `pull-requests: write`) referenced by a movable tag | Medium | Fixed: pinned to commit `ff98106` (v2.3.9) |
| `package-image.yml` interpolated the `version` dispatch input directly into a shell script | Low (needs write access) | Fixed: passed via `env` and validated as `vX.Y.Z` |
| `release.yml` *Release secret scan* job had no timeout | Low | Fixed: 15 minutes |
| `ci.yml` *Render Blueprint* job would download the Render CLI from `releases/latest` without a checksum. The step only runs when `RENDER_API_TOKEN` is visible to the job, and that secret exists only in the `production` environment, so today it always skips | Informational | Left unchanged; pin a version and checksum before ever exposing the token to that job |
| GitHub-owned actions (`actions/*`) use major-version tags | Low | Accepted: GitHub-owned; Dependabot keeps them current. Pin to commits if *Allowed actions* is restricted further |
| `upstream-watch.yml` force-pushes (`--force-with-lease`) only its own `upstream-watch/proposal` branch | Informational | Accepted |

## Secret exposure review (2026-11-11)

- No `.env`, key, certificate or credential file has ever been committed; only
  `.env.example` templates with placeholders.
- gitleaks 8.30.1 over the full history of a fresh clone (329 commits scanned)
  with the repository configuration: 49
  `generic-api-key` matches, all reviewed as false positives (public contract
  addresses, Solidity comments, translation strings, typed SDK fields in
  vendored or dormant upstream code). Their exact fingerprints are in
  `.gitleaksignore`; no rule was disabled. A rescan reports no leaks.
- With the default configuration (no allowlist), the remaining matches are the
  documented public constants in generated bundles (RainbowKit's public
  provider fallback key, wallet-SDK telemetry keys) and the checksum manifest.
- GitHub secret scanning was enabled on 2026-11-11 and reported 0 alerts when
  first read; it continues scanning history in the background, so check
  **Security → Secret scanning** again later.
- `.gitignore` now ignores `.env` and `.env.*` (except `.env.example`) and
  common key files anywhere in the tree.

## Maintenance

- Dependabot proposes updates for pinned action commits weekly (minor and patch only).
- Review **Security → Overview** monthly: Dependabot, code scanning and secret scanning alerts.
- Re-run this audit after adding a workflow, an environment, a secret or a collaborator.
