# Openfund Protocol — Development Guide

How to work on the protocol module **without affecting the Openfund
application**.

## Repository position

- Module root: `packages/openfund-protocol/` (self-contained Hardhat project)
- Docs: `docs/protocol/`
- Provenance (exact imported revision): `packages/openfund-protocol/PROVENANCE.md`
- License: GPL-2.0 (upstream, retained)

## Hard isolation rules (must hold in every PR)

1. The module is **not** part of the application dependency graph: nothing in
   `apps/` may import it, and its `package.json` is never hoisted into the root
   install (root `package.json` stays orchestration-only; per-app lockfiles are
   untouched).
2. No changes to `render.yaml`, CI workflows or application code are needed to
   add/modify protocol sources — protocol work must not touch them.
3. No deployment, chain interaction, background service, scheduled job or new
   production environment variable.
4. `npm run validate:blueprint`, the React build and the backend tests must
   stay green without the module being installed anywhere.
5. Upstream license and provenance stay intact.

## Workflow

```bash
# branch as always
git checkout -b qwen/protocol-<topic> origin/main

cd packages/openfund-protocol
npm install          # module-local node_modules (gitignored)
npx hardhat compile  # compile contracts
npx hardhat test     # run the imported test suite
```

- Keep changes scoped to `packages/openfund-protocol/**` and `docs/protocol/**`.
- When pulling a newer upstream revision, update `PROVENANCE.md` (commit SHA,
  date, diff summary) and list any local modifications there.
- Contract identifiers, storage layouts and interface names are
  compatibility-relevant: changing them is a breaking change and must be called
  out in the PR (the imported deployment records in `deployments/` assume the
  upstream layouts).

## Current module state (verified at import)

- `npx hardhat compile` **fails at the imported HEAD** — upstream regression
  (`Stack too deep`, OrderBook.sol:417, introduced by upstream's final commit;
  no upstream CI). The parent revision compiles cleanly with the identical
  config. Details and evidence: `packages/openfund-protocol/PROVENANCE.md`.
- Consequence: `npx hardhat test` cannot run at HEAD either (compilation is a
  prerequisite). First protocol-engineering task: repair OrderBook within the
  upstream semantics so the suite runs again.

## Validation checklist for protocol PRs

- [ ] `npx hardhat compile` succeeds in the module (or the known upstream
      defect is explicitly unchanged and called out)
- [ ] `npx hardhat test` passes (or regressions are justified)
- [ ] `npm run validate:blueprint` still green (repository root)
- [ ] React `tsc --noEmit` and app unit tests still green (they must be — the
      module is invisible to them; run them to prove it)
- [ ] No file outside `packages/openfund-protocol/**` and `docs/protocol/**`
      changed (except this documentation)
