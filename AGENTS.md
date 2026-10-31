# Openfund — Shared Instructions for Coding Agents

Applies to Codex, QwenWork, ChatGPT Work and any other development agent.

## Source of truth

- Canonical repository: `https://github.com/algomanlife/openfund`.
- Inspect the working tree, branch, remotes, package scripts, existing files and current docs before changing anything.
- Never create a separate disconnected Openfund repository or overwrite the current prototype.
- `dist/` is currently a source-critical deliverable, not disposable generated output.

## Git collaboration

1. Fetch and branch from latest `main`: `codex/<topic>`, `qwen/<topic>` or `docs/<topic>`.
2. Do not force-push, rewrite history or push directly to `main`.
3. Keep commits scoped and descriptive (Conventional Commits preferred).
4. Open a Pull Request with summary, files changed, tests, risks and screenshots when UI changes.
5. Resolve conflicts rather than replacing others' changes; obtain review before merge.
6. Never delete or rename files outside the approved task scope.

## Documentation contract

- Update the root README when setup, architecture, capabilities or project status changes.
- Update `docs/product/FEATURE_STATUS.md` for any feature status transition.
- Update the relevant integration or architecture specification when interfaces change.
- Add a concise entry to `CHANGELOG.md` for user-visible or architectural changes.
- Distinguish `Implemented`, `Prototype`, `Planned`, `Blocked` and `Unverified`; never claim an API or network address is verified without evidence.
- Record architectural decisions in `docs/decisions/` as ADRs.

## Engineering and security

- Keep third-party upstream licensing and required attribution intact.
- Never commit private keys, seed phrases, API secrets, tokens or user data.
- Gains transaction execution must remain disabled by default until supported testnet contracts, transaction simulation and validation are established.
- Do not infer order-book depth or footprint data from oracle price feeds.
- Validate dependencies and tests before marking work complete. Report blocked tests and reasons.
- Preserve Openfund's visual identity and accessibility standards.

## Definition of done

Code/config changes (if any), documentation, test results, change log, accurate feature status, and a reviewable Pull Request. A placeholder folder or npm dependency is **not** a completed integration.
