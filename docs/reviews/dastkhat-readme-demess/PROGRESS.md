# Progress — Dastkhat migration, de-mess, README, gates, release

Branch: `agent/claude/dastkhat-readme-demess` (from `main` `a797a5f`).
Resume from the first unchecked item. Final report: [REPORT.md](REPORT.md).

- [x] W1 Dastkhat migration (one `dastkhat.css`, `dist/` migrated, 54 retired files
      deleted, brandbook and FA investor documents regenerated, blocker resolved by removal)
- [x] W1 render evidence — [results.json](evidence/results.json), 7/7 surfaces
- [x] W2 retired registry (`docs/development/RETIRED.json` + generated `RETIRED.md`)
- [x] W2 dated galleries and superseded reviews archived under `docs/reviews/_archive/`
- [x] W2 single-source facts; stale docs fixed
- [x] W3 README rewrite (289 lines, 1,458 words, exact skeleton)
- [x] W4 gates `check-readme`, `check-retired`, `check-fonts` in `docs:check` (24 tests);
      `README_STRUCTURE.md`; AGENTS.md reference
- [x] Verification and final report; PR body validated by `scripts/pr/check-pr-description.mjs`
- [ ] Owner: push the branch (this session had no GitHub write access), open the PR, merge
- [ ] Owner: release v0.9.0 and approve `production`; run `evidence/verify-live.mjs`
- [ ] Post-release docs PR: `status.json` latestOfficial → v0.9.0, CHANGELOG heading, README version paragraph
