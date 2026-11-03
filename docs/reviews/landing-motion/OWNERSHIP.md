# Persian landing motion ownership

Baseline: official `v0.1.1`, `ce9ddd0e4ead5da899fba512870e369820489187`.
Dedicated branch: `codex/landing-persian-motion-redesign`.

## Allowed files

- `apps/web-react/src/features/home/`: gateway, scoped styles, decorative components.
- `e2e/test-integration-audit.cjs`: update only obsolete landing decoration selectors.
- `e2e/test-landing-motion.cjs`: responsive, navigation, motion and accessibility checks.
- `.github/workflows/ci.yml`: invoke the landing browser acceptance check.
- `docs/reviews/landing-motion/`, screenshot evidence/manifest, README, changelog,
  feature status and milestone registers: accurate delivery documentation.

## Protected scope

No edits to router, shared header, wallet/session code, terminal, challenges,
profiles, payments, DePay, invoices, withdrawals, backend, schemas or migrations.
Existing English Home already mounts the existing Prop challenge page; retain it.
Shared header interfaces and CMS contracts remain intact. Build output is isolated
in this worktree; generated historical React bundles are not hand-edited.

## Source findings

The active Home uses `Home.tsx`, `home.css`, `InformationShell`, Directus
`home_content` and `assets/home/*.svg`. Existing design tokens, Irancell/Ubuntu
fonts and approved mint emblem are reused. The four original technical cards,
inline SVGs and Persian copy are in `pages/landing-body.html` and reused read-only.
Their titles are retained as explicitly proposed Perpetual concepts, with source
copy disclosed for review. No operational routing, liquidity aggregation or
zero-cost execution is claimed.

Qwen's checkout `/Users/algoman/openfund` has an uncommitted schema change and
untracked invoice implementation. Neither is read for implementation or changed.
Port 8080 is occupied by the canonical runtime and must remain untouched.
