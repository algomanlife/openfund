# Repository transformation delivery

Task 1 transforms repository identity and documentation, based on latest `origin/main` `2f5cf93afcbd97caa9b80e6de8a703fa707f6e16`. PR #23 (Render foundation) and PR #24 (integrated trading/wallet fixes) were inspected; no subsequent main commits existed at the initial audit. Work uses branch `docs/openfund-repository-transformation` in an isolated worktree. No force push, history rewrite, merge or production deployment is part of this delivery.

## Result

- Flagship English README with approved-logo hero, product narrative, accurate delivery boundaries, genuine screenshot gallery, architecture, stack, setup, testing, deployment and contributor navigation.
- Seven business/product guides plus Prop, Perpetual, Terminal, Wallet/Identity and Portfolio/Journal contracts.
- Canonical capability register; seven-phase roadmap with description/status/dependencies/acceptance/evidence per milestone.
- Verified React/Node/PostgreSQL/Directus/Vela/Gains/SIWE/SSE architecture and five Mermaid diagram sources/rendered SVGs.
- Central documentation index, updated nested READMEs, contribution/agent requirements, GitHub PR template and English documentation CI gates.
- Full English preservation of the Persian integration report, translated historical quotations and clearly marked historical audit/research snapshots.
- Three exact approved logo copies, four presentation graphics and thirteen genuine current application screenshots with provenance.
- GitHub description/topics updated; existing homepage retained without claiming live health. Social preview upload recommendation prepared.

## Scope preservation and cleanup

No MUX Protocol or other protocol source was imported, copied or integrated. The Protocol description is final-release intent only. No financial/business state, application localization, RTL behavior, database schema or Render resource was changed. First-party source changes are limited to one explanatory comment and three test descriptions translated to English; executable localization expectations are preserved.

`render.yaml`, infrastructure, backend runtime, vendor sources, licenses, `dist/` and application assets remain unchanged. Generated `react/` build churn is excluded after verification. Existing generated compatibility files were audited and retained because the application still depends on them. No source deletion was proposed without dependency evidence.

[Cleanup manifest](REMOVED_FILES.md) lists every removed documentation file: 53 obsolete screenshot files, retained by immutable historical Git links, and the Persian report replaced by its English preservation. Historical evidence was not silently erased. Superseded deployment/roadmap paths remain navigation pointers to avoid broken links.

## Screenshots and visual QA

[Gallery and manifest](../../assets/screenshots/README.md) cover Home, Prop Terminal, Perpetual Terminal, Markets, Challenges, Prop/Perpetual Portfolio, Journal, Account/Profile, Wallet connection, Dashboard analytics, sample Transparency and Rulebook. Captures use the current production build, local Directus public content and live Gains; no market/CMS/financial fixtures or manufactured history. Authenticated captures use a disclosed generated wallet, actual local SIWE and the backend's normal virtual account, with no personal wallet or chain transactions.

English application captures retain native localization controls and current profile numeral/date behavior. This is an explicit image-language limitation: authentic application output was preserved rather than edited. Diagrams and presentation graphics use English text and current brand colors. Images and README layout are visually inspected; the approved logo copies are also compared byte-for-byte by the validator.

## Validation

[validation.json](validation.json) records exact branch-check outcomes and known limits. Raw logs are under ignored `output/validation/`; browser evidence is under ignored `output/playwright/`.

- Frontend TypeScript, 17 unit checks and production build executed successfully; existing wallet chunk-size warning remains.
- Backend suites executed successfully: SIWE 22, trading 54, portfolio 31, products 58, Gains 5, audit 11 = **181** checks on isolated PostgreSQL 17.11 / Node 22.23.4.
- Controlled browser integration executed successfully: **31** checks using generated EIP-1193 signers and CMS/Gains protocol fixtures against the real API/database. Those fixtures are separate from genuine documentation captures.
- Additive migration executed twice, followed by catalog seed. Blueprint offline structural/semantic validation executed successfully: two services, one database, same-origin frontend and existing engine ownership.
- Documentation language/comment checks, local link/image/fragment checks, Markdown structure and Mermaid parse checks executed; negative fixtures confirm untranslated prose and broken links fail. Final results are in the validation record.
- Dependency audits use the official npm registry because the configured mirror lacks the audit endpoint. New documentation tooling pins patched transitive packages; runtime dependency versions/lockfiles are unchanged. Existing frontend advisories remain and are reported separately.
- Gitleaks clean exports of baseline and candidate each found the same 47 matches in unchanged upstream sources/translation strings, contract-address data and runtime bundles: **zero new findings**. Ignored local output is excluded from that comparison. The new-commit patch scan also passed with zero findings; a broad clean-security claim is not made.

## Limits and follow-up

Authenticated Render CLI validation, Blueprint apply, deployed HTTPS/session/CMS acceptance, recovery operations and real extension/hardware/remote WalletConnect acceptance were not performed. Local checks do not establish production health. Current English Profile uses Persian numerals for some dates/identifiers. Challenge purchase/evaluation/funded capital/payouts, authentic depth/tape and live perpetual execution remain future or blocked capabilities. Openfund Protocol remains planned for Task 2/final-release work.

The existing `https://openfund.cloud` homepage failed TLS negotiation in this environment; its field was preserved and no live deployment link was invented. Social preview upload remains manual. Dependency advisories and baseline scanner matches require scoped security triage outside this documentation transformation. The PR is for review; it does not merge or deploy the repository.
