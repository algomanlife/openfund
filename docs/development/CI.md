# Continuous integration: workflows, tiers and timing

This page is the reference for what runs on every pull request and why. The
required status checks and their names are owned by the repository owner and are
not changed here (see [Required checks](#required-checks)).

## Workflows

| Workflow | Trigger | Purpose | Measured duration (typical) |
| --- | --- | --- | --- |
| `ci.yml` | pull request, push to `main`, manual, nightly | Docs contract, typecheck, unit tests, production build (`Web`); migrations, backend suites, core browser journeys (`Backend`); Blueprint validation; secret scan; dependency audit report | Web ≈ 1.6 min, Backend ≈ 21 min (before sharding), Blueprint and Secret scan < 1 min |
| `release.yml` | pull request, push to `main`, manual dispatch | `Release package gates` (every gate plus candidate packaging), `Release secret scan`, Directus bootstrap; dispatch with `publish=true` publishes, deploys and builds the image | ≈ 42 min before sharding (median of successful runs) |
| `deploy-release.yml`, `deploy-candidate.yml` | called by `release.yml` / manual | Deploy a verified release or gated candidate to Render and verify live identity | not part of PR validation |
| `package-image.yml` | called by `release.yml` / manual | Versioned GHCR image from the verified archive | not part of PR validation |

## Where the time went (measured)

Source: the `Unified release` run on `main` (run 42734918145) and a `CI` pull
request run (42764406699), per-step timestamps from the GitHub Actions logs.

| Stage | Before | Cause |
| --- | --- | --- |
| `test:browser:locale` | 17.2 min | 10 viewport×locale combinations × 31 routes, run strictly one after another with fixed 2.5–4 s waits |
| `test:browser:polish` | 15.5 min | 2 connection states × 2 locales × 2 themes × 3 widths, run strictly one after another |
| Everything else in the release gates | ≈ 7.5 min | install, docs, typecheck, unit tests, two frontend builds, backend suite, other journeys, packaging |
| `Backend` job, polish matrix | 16.2 min | the same polish matrix, run again in `ci.yml` |

Both matrices are read-only and independent per combination, so they are now run
as concurrent shards against the same server.

## Sharded browser matrices

`scripts/ci/run-parallel.mjs` starts independent commands concurrently, prefixes
their output and prints a timing summary. It has **no retry** and kills a job
that exceeds its timeout, so a deterministic failure always fails the run, and
all shards finish so a single run reports every failing shard.

- `e2e/test-locale-matrix.cjs`: `LOCALE_MATRIX_SHARD=i/n`, `LOCALE_MATRIX_OUT=<dir>`. The
  persistence checks run on shard 1.
- `e2e/test-ui-polish.cjs`: `POLISH_SHARD=i/n`, `POLISH_PART=matrix|tail|all`,
  `POLISH_OUTPUT=<dir>`, `AUTO_DARK_OUTPUT=<dir>`. The union of the matrix shards
  and one `tail` run equals the unsharded run (same check count).

Unsharded behaviour (no variables set) is unchanged, so local runs such as
`npm run test:browser:polish` still execute everything.

Retries: `scripts/release/build.mjs` still retries a failing sequential browser
journey once, but every retry is annotated and recorded as `attempts: 2` in the
verification evidence. A journey that passes only on retry is a flaky test to be
fixed, not a pass to ignore. Sharded matrices are never retried.

## Tiers

`scripts/ci/changes.mjs` classifies a pull request from its changed files:

| Tier | When | Effect |
| --- | --- | --- |
| `docs` | every changed file is documentation or repository metadata (`docs/**`, root `*.md`, PR template, issue templates) | `Backend`, `Release package gates` and the Directus bootstrap job are skipped; `Web` still runs the full docs contract |
| `full` | anything else, any unknown path, any shared path (workflows, lockfiles, `scripts/`, `e2e/`, `packages/`, `vendor/`, `third_party/`, `render.yaml`) and every non-PR event | all gates run |
| `affected` | opt-in with the repository variable `CI_TIER_AFFECTED=1`; a code change confined to one component | the backend suite is skipped when no backend input changed; the presentation matrices are skipped when no web or CMS input changed; skipped stages are recorded as `skipped-by-tier` |

A job skipped by a job-level condition reports as passing to required status
checks, which is why a documentation-only pull request still shows green. Pushes
to `main`, the nightly schedule, manual runs and release dispatches are always
`full`. A new top-level directory classifies as shared, so adding code can never
silently reduce coverage.

Enable `affected` only after the owner has reviewed a few pull requests under it.

## Caches

Dependency installs use the npm cache keyed by the three lockfiles. Playwright
browsers are cached under `~/.cache/ms-playwright`. Builds are not shared between
jobs: the web build is fast (≈ 10 s) and the release gates deliberately build the
frontend twice to prove reproducibility.

## Concurrency

Superseded pull request runs are cancelled. Runs for `main`, schedules and manual
dispatches are keyed by commit and are never cancelled, because
`scripts/release/check-secrets.mjs` verifies that the exact commit being released
has a completed secret scan. Official release runs stay serialized and are never
cancelled.

## Required checks

Branch protection requires: `Web (React + Vite)`, `Backend (API + engine)`,
`Render Blueprint`, `Secret scan`, `Release package gates` and
`Release secret scan`. This change keeps all six names and their meaning for
code pull requests. New non-required jobs: `Classify change (CI tier)` (both
workflows). Recommended owner follow-up: none of them needs to be required.

## Local reproduction

Use Node 26, an isolated PostgreSQL database whose name contains `test`, and the
variables from `scripts/release/build.mjs`. See
[Local development](LOCAL_DEVELOPMENT.md) and [Testing](TESTING.md).
